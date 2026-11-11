import { createMatcher, hasConferenceTrack, inferType } from './catalog.mjs';
import { analyze, authorship, identifyOwner } from './model.mjs';
import { snapshot, watchStorage, saveAlias } from './storage.mjs';
import { element, translator, rankingMarks } from './ui.mjs';
import { createPanel } from './dashboard.mjs';
import { articleIdentifiers, normalizeDoi } from './article-link.mjs';
import { articleReference } from './article-reference.mjs';

const plain = (node) => node?.textContent.replace(/\s+/g, ' ').trim() || '';
const numeric = (text) => Number(String(text).replace(/[^0-9]/g, '')) || 0;

function mark(container, marks, insertAfter = null) {
  const old = container.querySelector(':scope > .cl-badges');
  if (!marks.length) { old?.remove(); return; }
  const fingerprint = JSON.stringify(marks);
  if (old?.dataset.marks === fingerprint) {
    if (insertAfter && insertAfter.nextElementSibling !== old) insertAfter.after(old);
    return;
  }
  const line = element('div', null, { class: 'cl-badges' });
  line.dataset.marks = fingerprint;
  for (const { text, title, color } of marks) line.append(element('span', text, { title, class: `cl-badge cl-${color}` }));
  old?.remove();
  if (insertAfter) insertAfter.after(line);
  else container.append(line);
}

function searchFields(metadata) {
  const [byline, ...parts] = plain(metadata).split(/\s+[-–—]\s+/);
  const source = (parts.length > 1 ? parts.slice(0, -1) : parts).join(' - ');
  const date = source.match(/(?:^|,\s*|\s+)\(?((?:18|19|20|21)\d{2})\)?$/);
  const venue = (date ? source.slice(0, date.index) : source).trim();
  return {
    venue: /^[\w.-]+\.[a-z]{2,}$/i.test(venue) ? '' : venue,
    author: byline.split(/[,，;；]/, 1)[0].trim(),
    year: Number(date?.[1]),
  };
}

function sourceIssn(metadata) {
  return plain(metadata).match(/\b(?:e-?)?ISSN\s*[:：]?\s*(\d{4}-?\d{3}[\dX])\b/i)?.[1] || '';
}

const articleVenues = new Map();

function registeredSource(kind, id, refresh) {
  const key = JSON.stringify([kind, id]);
  if (!articleVenues.has(key)) {
    articleVenues.set(key, null);
    void chrome.runtime.sendMessage({ type: `citelocus-${kind}-article`, id })
      .catch(() => null).then((record) => {
        articleVenues.set(key, record || false);
        refresh();
      });
  }
  return articleVenues.get(key);
}

function resultIdentifiers(row, metadata) {
  const title = row.querySelector('.gs_rt a');
  const copies = row.closest('.gs_r')?.querySelectorAll('.gs_or_ggsm a[href], .gs_ggs a[href]') || [];
  const links = [title?.getAttribute('href'), title?.getAttribute('data-href'), ...[...copies].map((link) => link.href)];
  const textDoi = plain(metadata).match(/\b(?:doi\s*[:：]\s*|doi\.org\/)(10\.\d{4,9}\/[^\s<>,]+)/i)?.[1];
  return [...new Set(links)].map((link) => articleIdentifiers(link, location.origin))
    .concat({ doi: normalizeDoi(textDoi?.replace(/[.;]+$/, '')) });
}

function resolveResult(match, identifiers, expectedType, reference, refresh) {
  if (expectedType !== 'conference') {
    for (const { issn } of identifiers) {
      if (!issn) continue;
      const hits = match('', 'journal', issn);
      if (hits.length) return { hits };
    }
  }
  let pending = false;
  for (const ids of identifiers) {
    for (const kind of ['doi', 'ieee', 'pii']) {
      if (!ids[kind]) continue;
      const record = registeredSource(kind, ids[kind], refresh);
      if (record === null) { pending = true; continue; }
      if (!record) continue;
      const type = record.type || 'journal';
      if (expectedType && expectedType !== type) continue;
      const venue = record.venue || record.journal;
      if (venue) return { venue, hits: match(venue, type, record.issns || record.issn) };
    }
  }
  if (!pending && reference) {
    const record = registeredSource('title', reference, refresh);
    if (record && (!expectedType || expectedType === record.type)) {
      return { venue: record.venue, hits: match(record.venue, record.type, record.issns) };
    }
    pending = record === null;
  }
  return { pending };
}

function labelResults(match, preferences, language, refresh) {
  for (const row of document.querySelectorAll('.gs_r .gs_ri')) {
    const line = row.querySelector('.gs_a');
    const anchor = line || row.querySelector('.gs_rt');
    if (!anchor || !preferences.search) {
      row.querySelector(':scope > .cl-badges')?.remove();
      continue;
    }
    const { venue, author, year } = searchFields(line);
    const type = inferType(venue);
    const truncated = /…|\.{3,}/.test(venue);
    const typeBadge = ['preprint', 'patent', 'thesis', 'book'].includes(type) ? type : '';
    const issn = sourceIssn(line);
    let hits = match(venue, '', issn);
    let resolved;
    if ((!hits.length || truncated) && !typeBadge && !hasConferenceTrack(venue)) {
      const identifiers = [{ issn }, ...resultIdentifiers(row, line)];
      const expectedType = type === 'journal' || type === 'conference' ? type : '';
      const heading = row.querySelector('.gs_rt');
      const reference = hits.length ? null : articleReference(plain(heading?.querySelector('a') || heading), author, year);
      resolved = resolveResult(match, identifiers, expectedType, reference, refresh);
      if (resolved.hits?.length) hits = resolved.hits;
    }
    const marks = rankingMarks(hits, language);
    if (!marks.length) {
      const hasVenue = resolved?.venue || (venue && !truncated);
      const status = typeBadge || (resolved?.pending ? 'sourceChecking' : hasVenue ? 'noRankMatch' : 'sourceUnconfirmed');
      marks.push({ text: language.t(status), title: resolved?.venue || venue || language.t(status), color: 'status' });
    }
    mark(row, marks, anchor);
  }
}

const detailFields = [
  ['journal', /^(?:journal|revista|zeitschrift|revue|rivista|期刊(?:名称)?|刊物|杂志|雑誌|저널)$/i],
  ['conference', /^(?:conference|confer[eê]ncia|conferencia|konferenz|会议(?:名称)?|會議|会議|학회)$/i],
  ['', /^(?:source|publication|venue|出处|出處|发表源|出版物|來源|来源|发表刊物|刊载)$/i],
];

function labelDetails(match, language) {
  for (const table of document.querySelectorAll('#gsc_oci_table, .gsc_oci_table')) {
    const metadata = [...table.querySelectorAll('.gsc_oci_field')].flatMap((field) => {
      const type = detailFields.find(([, pattern]) => pattern.test(plain(field).replace(/[:：]$/, '')));
      const value = field.parentElement?.querySelector('.gsc_oci_value');
      return type && value ? [[type[0], value]] : [];
    });
    for (const [type, value] of metadata) {
      const raw = [...value.childNodes].filter((node) => !node.classList?.contains('cl-badges'))
        .map((node) => node.textContent).join(' ').trim();
      mark(value, rankingMarks(match(raw, type), language));
    }
  }
}

function visiblePapers(match, identify, preferences, language) {
  const publications = [];
  const seen = new Set();
  for (const row of document.querySelectorAll('#gsc_a_b > .gsc_a_tr')) {
    const cell = row.querySelector('.gsc_a_t');
    const title = cell?.querySelector('.gsc_a_at');
    if (!title) continue;
    const [byline, venueNode] = cell.querySelectorAll('.gs_gray');
    const source = venueNode?.cloneNode(true);
    source?.querySelectorAll('.gs_oph').forEach((year) => year.remove());
    const venue = plain(source);
    const role = authorship(plain(byline), identify);
    const ranks = match(venue);
    const badges = [];
    if (preferences.first && role.role === 'first') badges.push({ text: language.t('first'), title: language.t('firstFull'), color: 'role' });
    if (preferences.corresponding && role.corresponding) badges.push({ text: language.t('corresponding'), title: language.t('authorNote'), color: 'role' });
    mark(cell, [...badges, ...rankingMarks(ranks, language)]);
    const path = title.getAttribute('href') || title.getAttribute('data-href');
    let link = '';
    if (path) {
      try {
        const url = new URL(path, location.href);
        if (url.origin === location.origin && url.pathname === '/citations') link = url.href;
      } catch { /* The title is still available as plain text. */ }
    }
    const heading = plain(title);
    const year = numeric(plain(row.querySelector('.gsc_a_y .gsc_a_h')));
    const identity = link ? new URL(link).searchParams.get('citation_for_view') : null;
    const key = identity || JSON.stringify([heading, year, plain(byline), venue]);
    if (seen.has(key)) continue;
    seen.add(key);
    publications.push({ title: heading, link, venue, ranks, authorship: role,
      cites: numeric(plain(row.querySelector('.gsc_a_ac'))), year,
      type: ranks.find(({ type }) => type)?.type || inferType(venue) });
  }
  return publications;
}

function citationHistory() {
  const graph = document.querySelector('.gsc_md_hist_b, #gsc_rsb_cit');
  if (!graph) return [];
  const position = (node) => parseFloat(node.style.right);
  const years = [...graph.querySelectorAll('.gsc_g_t')].map((label) => ({ year: numeric(plain(label)), right: position(label) }))
    .filter(({ year }) => year >= 1800 && year < 2200);
  const bars = [...graph.querySelectorAll('.gsc_g_a')];
  const values = new Map(years.map(({ year }) => [year, 0]));
  for (const [i, bar] of bars.entries()) {
    const right = position(bar);
    const explicitYear = Number((bar.getAttribute('aria-label') || '').match(/\b(?:19|20)\d{2}\b/)?.[0]);
    const nearest = Number.isFinite(right) ? years.filter((year) => Number.isFinite(year.right))
      .sort((a, b) => Math.abs(a.right - right) - Math.abs(b.right - right))[0] : null;
    const year = explicitYear || nearest?.year || (years.length === bars.length ? years[i].year : null);
    if (year) values.set(year, numeric(plain(bar.querySelector('.gsc_g_al')) || plain(bar)));
  }
  return [...values].sort(([a], [b]) => a - b);
}

function onlyOurMarks(record) {
  if (record.target.nodeType === 1 && record.target.closest('.cl-badges, .cl-panel-host')) return true;
  const nodes = [...record.addedNodes, ...record.removedNodes];
  return nodes.length > 0 && nodes.every((node) => node.nodeType === 1 && node.matches('.cl-badges, .cl-panel-host'));
}

const observedAreas = '#gsc_a_b, #gsc_prf_in, #gsc_rsb_st, #gsc_rsb_cit, #gsc_oci_table, .gsc_oci_table, .gs_r';
function affectsAnnotations(record) {
  if (onlyOurMarks(record)) return false;
  const anchor = record.target.nodeType === 1 ? record.target : record.target.parentElement;
  if (anchor?.closest(observedAreas)) return true;
  return [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === 1 &&
    (node.matches(observedAreas) || node.querySelector(observedAreas)));
}

export async function launch() {
  if (!['/citations', '/scholar'].includes(location.pathname) || !document.body) return;
  const name = document.querySelector('#gsc_prf_in');
  const profile = name && document.querySelector('#gsc_a_b') ? new URL(location.href).searchParams.get('user') : null;
  let settings = await snapshot(profile);
  let match = createMatcher(settings.catalogs, settings.enabled);
  let language = translator(settings.preferences.locale);
  let identify = identifyOwner(settings.alias || plain(name), globalThis.pinyinPro?.segment);
  const panel = profile ? createPanel((alias) => saveAlias(profile, alias)) : null;
  let queued = false;
  const refresh = () => {
    queued = false;
    if (location.pathname === '/scholar') labelResults(match, settings.preferences, language, queue);
    labelDetails(match, language);
    if (!panel) return;
    const papers = visiblePapers(match, identify, settings.preferences, language);
    const received = citationHistory();
    const official = [...document.querySelectorAll('#gsc_rsb_st .gsc_rsb_std')].map((cell) => plain(cell));
    const more = document.querySelector('#gsc_bpf_more');
    panel.update({ language, results: analyze(papers, received), received, official,
      partial: Boolean(more && !more.disabled && !more.hidden), catalogs: settings.catalogs,
      enabled: settings.enabled, alias: settings.alias, profileName: plain(name) });
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    setTimeout(refresh, 0);
  };
  new MutationObserver((records) => {
    if (records.some(affectsAnnotations)) queue();
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributeFilter: ['href', 'data-href'] });
  let revision = 0;
  let catalogChanged = false;
  watchStorage(async (changes) => {
    if (Object.hasOwn(changes, 'onlineLookup')) articleVenues.clear();
    if (!Object.keys(changes).some((key) => !key.startsWith('alias-') || key === `alias-${profile}`)) return;
    catalogChanged ||= Object.keys(changes).some((key) => /^(?:catalog|enabled)-/.test(key));
    const pending = ++revision;
    try {
      const next = await snapshot(profile);
      if (pending !== revision) return;
      settings = next;
      if (catalogChanged) match = createMatcher(settings.catalogs, settings.enabled);
      catalogChanged = false;
      language = translator(settings.preferences.locale);
      identify = identifyOwner(settings.alias || plain(name), globalThis.pinyinPro?.segment);
      queue();
    } catch (error) { console.warn('CiteLocus', error); }
  });
  refresh();
}
