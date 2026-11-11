import { lists } from './catalog.mjs';
import { impact, average } from './model.mjs';
import { element as el, gradeLabel } from './ui.mjs';

const tabs = ['overview', 'venues', 'people', 'rankings'];
const number = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
const percent = (value) => value == null ? '—' : `${number(value * 100, 1)}%`;
const note = (text) => el('p', text, { class: 'note' });
const div = (className) => el('div', null, { class: className });

function figures(items) {
  const grid = div('figures');
  for (const [label, value, detail] of items) {
    const tile = div('figure');
    tile.append(el('span', label), el('strong', value));
    if (detail) tile.append(el('small', detail));
    grid.append(tile);
  }
  return grid;
}

function section(title, ...children) {
  const block = el('section');
  if (title) block.append(el('h3', title));
  block.append(...children);
  return block;
}

function bars(title, points) {
  if (!points.length) return el('span');
  const block = section(title);
  const chart = div('bars');
  const max = Math.max(1, ...points.map(([, value]) => value));
  for (const [label, value] of points) {
    const line = div('bar-row');
    const bar = div('bar');
    const fill = div('fill');
    fill.style.width = `${(value / max) * 100}%`;
    bar.append(fill);
    line.append(el('span', label), bar, el('span', number(value)));
    chart.append(line);
  }
  block.append(chart);
  return block;
}

function table(headers, data) {
  const viewport = div('table-scroll');
  const table = el('table');
  const head = el('thead');
  const headerRow = el('tr');
  for (const header of headers) headerRow.append(el('th', header, { scope: 'col' }));
  head.append(headerRow);
  const body = el('tbody');
  for (const row of data) {
    const tr = el('tr');
    for (const cell of row) {
      const td = el('td');
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell;
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(head, body);
  viewport.append(table);
  return viewport;
}

export function createPanel(applyAlias) {
  const host = el('div', null, { class: 'cl-panel-host' });
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.append(el('link', null, { rel: 'stylesheet', href: chrome.runtime.getURL('app/panel.css') }));
  const wrap = el('details', null, { open: '' });
  const header = el('summary');
  const tabsEl = el('nav');
  const body = div('body');
  wrap.append(header, tabsEl, body);
  shadow.append(wrap);
  const sidebar = document.querySelector('#gsc_rsb_cit, #gsc_rsb');
  if (sidebar) sidebar.append(host);
  else document.querySelector('#gsc_a_b')?.closest('table')?.before(host);

  let active = 'overview', selectedList = '', selectedRank = '', visible = 40;
  let state;

  function overview() {
    const { language: { t, label }, results: r } = state;
    const metrics = [
      [t('articles'), number(r.papers)], [t('citations'), number(r.cites)], ['h', number(r.h)], ['g', number(r.g)], ['i10', number(r.i10)],
      ['e', number(r.e, 1)], ['m', number(r.m, 2)], [t('yearsActive'), number(r.span), r.firstYear],
      [t('rate'), number(r.rate, 1)], [t('meanCites'), number(r.average, 1)], [t('medianCites'), number(r.median, 1)],
      [t('maxCites'), number(r.max)], [t('uncited'), number(r.uncited)], [t('topShare'), percent(r.topShare)], [t('hShare'), percent(r.hShare)],
      [t('recent'), number(r.recent)], [t('recentCites'), number(r.recentCites)], [t('recentShare'), percent(r.recentShare)],
      [t('previousCites'), number(r.thisYear)], [t('growth'), percent(r.growth)],
    ];
    const roles = [['first', 'firstFull'], ['last', 'last'], ['middle', 'middle'], ['hidden', 'hidden'], ['unmatched', 'unmatched']];
    const authorTable = roles.map(([key, labelKey]) => [t(labelKey), impact(r.roles.get(key) || [])]);
    authorTable.push([t('corresponding'), impact(r.corresponding)]);
    const aliases = el('form');
    const input = el('input', null, { type: 'text', maxlength: '150', placeholder: state.profileName, 'aria-label': t('nameField') });
    input.value = state.alias;
    const status = el('output', '', { 'aria-live': 'polite' });
    aliases.append(input, el('button', t('saveName'), { type: 'submit' }), status);
    aliases.addEventListener('submit', async (event) => {
      event.preventDefault();
      try { await applyAlias(input.value.trim()); status.textContent = t('saved'); }
      catch { status.textContent = t('storageError'); }
    });
    const catalogs = Object.entries(lists).filter(([id]) => state.catalogs[id] && state.enabled[id]);
    const overviewCounts = catalogs.map(([id, spec]) => [
      label(spec.short), number((r.ranks.get(id) || []).filter(({ hit }) => !hit.track).length),
    ]);
    body.append(note(t(state.partial ? 'visibleScope' : 'completeScope')), figures(metrics));
    if (state.official.length >= 6) {
      const cells = state.official;
      body.append(section(t('official'), figures([[t('citations'), cells[0]], ['h', cells[2]], ['i10', cells[4]]])));
    }
    if (overviewCounts.length) body.append(section(t('rankings'), figures(overviewCounts)));
    body.append(section(t('bylinePositions'),
      table([t('grade'), t('articles'), t('citations'), 'h'], authorTable.map(([name, metrics]) => [name, number(metrics.papers), number(metrics.cites), number(metrics.h)])),
      figures([[t('authorAverage'), number(r.meanAuthors, 1)], [t('authorMedian'), number(r.medianAuthors, 1)]])),
      bars(t('bylinePositions'), [...r.position].sort(([a], [b]) => Number(a) - Number(b))
        .map(([pos, papers]) => [pos === '6' ? '6+' : pos, papers.length])),
      bars(t('received'), state.received), bars(t('yearly'), r.yearPapers), bars(t('buckets'), r.buckets),
      section(t('nameField'), note(t('nameHint')), aliases, note(t('authorNote'))));
  }

  function venues() {
    const { language: { t }, results: r } = state;
    const names = [...r.venues].sort(([, a], [, b]) => b.length - a.length).slice(0, 25);
    body.append(figures([[t('sources'), number(r.venues.size)], [t('unknown'), number(r.types.get('unknown')?.length || 0)]]),
      bars(t('types'), [...r.types].map(([name, rows]) => [t(name), rows.length])),
      table([t('name'), t('articles'), t('citations'), t('meanCites')], names.map(([name, rows]) => {
        const totals = impact(rows);
        return [name, number(totals.papers), number(totals.cites), number(totals.average, 1)];
      })));
  }

  function people() {
    const { language: { t }, results: r } = state;
    const partners = [...r.coauthors].sort((a, b) => b.papers.length - a.papers.length).slice(0, 30);
    body.append(figures([[t('people'), number(r.coauthors.length)], [t('repeat'), number(r.coauthors.filter((p) => p.papers.length > 1).length)],
      [t('collaborative'), percent(r.papers ? r.collaborative / r.papers : 0)]]),
    table([t('name'), t('articles'), t('citations'), 'h'], partners.map(({ name, papers }) => {
      const totals = impact(papers);
      return [name, number(totals.papers), number(totals.cites), number(totals.h)];
    })));
  }

  function rankings() {
    const { language, results: r } = state;
    const { t, label } = language;
    const options = Object.keys(lists).filter((id) => state.catalogs[id] && state.enabled[id]);
    body.append(note(t('rankHelp')));
    if (!options.length) return;
    if (!options.includes(selectedList)) { selectedList = options[0]; selectedRank = ''; }
    const spec = lists[selectedList];
    const menu = el('select', null, { 'aria-label': t('rankings') });
    for (const id of options) menu.append(el('option', [label(lists[id].title), state.catalogs[id].edition].filter(Boolean).join(' · '), { value: id }));
    menu.value = selectedList;
    menu.onchange = () => { selectedList = menu.value; selectedRank = ''; visible = 40; render(); };
    const filter = el('select', null, { 'aria-label': t('grade') });
    filter.append(el('option', t('all'), { value: '' }));
    const grade = (rank) => rank === 'Indexed' ? t('indexed') : rank === 'Warning' ? t('warning') : rank;
    for (const rank of spec.grades) filter.append(el('option', grade(rank), { value: rank }));
    filter.value = selectedRank;
    filter.onchange = () => { selectedRank = filter.value; visible = 40; render(); };
    const filters = div('filters');
    filters.append(menu, filter);
    const hits = r.ranks.get(selectedList) || [];
    const main = hits.filter(({ hit }) => !hit.track);
    const metrics = impact(main.map(({ paper }) => paper));
    const values = main.map(({ hit }) => hit.impact).filter((value) => value != null);
    const tiles = [[t('indexed'), number(metrics.papers)], [t('citations'), number(metrics.cites)], ['h', number(metrics.h)]];
    if (values.length) tiles.push([t('ifMean'), number(average(values), 2)], [t('ifMax'), number(Math.max(...values), 1)]);
    const grades = spec.grades.map((rank) => {
      const rows = main.filter(({ hit }) => hit.rank === rank);
      const stats = impact(rows.map(({ paper }) => paper));
      return [grade(rank), number(stats.papers), number(stats.cites), number(rows.filter(({ paper }) => paper.authorship.role === 'first' || paper.authorship.corresponding).length),
        number(rows.filter(({ hit }) => hit.type === 'journal').length), number(rows.filter(({ hit }) => hit.type === 'conference').length), number(stats.h)];
    });
    body.append(filters, figures(tiles), table([t('grade'), t('articles'), t('citations'), t('firstCorr'), t('journal'), t('conference'), 'h'], grades),
      bars(t('grade'), grades.map(([rank], i) => [rank, main.filter(({ hit }) => hit.rank === spec.grades[i]).length])));
    const rows = hits.filter(({ hit }) => !selectedRank || hit.rank === selectedRank)
      .sort((a, b) => b.paper.cites - a.paper.cites);
    if (!rows.length) { body.append(note(t('noPapers'))); return; }
    body.append(table([t('paper'), t('grade'), t('citations')], rows.slice(0, visible).map(({ paper, hit }) =>
      [paper.link ? el('a', paper.title, { href: paper.link }) : paper.title, gradeLabel(hit, language), number(paper.cites)])));
    if (rows.length > visible) {
      const button = el('button', `${visible} / ${rows.length} +`, { type: 'button' });
      button.onclick = () => { visible += 40; render(); };
      body.append(button);
    }
  }

  function render() {
    const { language: { t } } = state;
    header.textContent = t('brand');
    tabsEl.replaceChildren();
    for (const tab of tabs) {
      const button = el('button', t(tab), { type: 'button', 'aria-pressed': tab === active });
      button.onclick = () => { active = tab; render(); };
      tabsEl.append(button);
    }
    body.replaceChildren();
    ({ overview, venues, people, rankings })[active]();
  }

  return { update(value) {
    const activeField = shadow.activeElement;
    const editing = active === 'overview' && activeField?.tagName === 'INPUT';
    const pendingValue = editing ? activeField.value : null;
    const position = editing ? activeField.selectionStart : null;
    state = value;
    render();
    if (editing) {
      const input = body.querySelector('input');
      input.value = pendingValue;
      input.focus();
      input.setSelectionRange(position, position);
    }
  } };
}
