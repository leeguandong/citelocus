export const lists = {
  ccf: { title: ['CCF 推荐目录', 'CCF Recommended List'], short: ['CCF', 'CCF'], grades: ['A', 'B', 'C'] },
  pku: { title: ['北大核心', 'PKU Core'], short: ['北大核心', 'PKU Core'], grades: ['Indexed'], type: 'journal' },
  jcr: { title: ['JCR 分区与影响因子', 'JCR Quartiles and Impact Factors'], short: ['JCR', 'JCR'], grades: ['Q1', 'Q2', 'Q3', 'Q4'], type: 'journal' },
  cas: { title: ['中科院分区', 'CAS Journal Ranking'], short: ['中科院', 'CAS'], grades: ['1', '2', '3', '4'], type: 'journal' },
  xr: { title: ['新锐期刊分区', 'XR Journal Ranking'], short: ['新锐', 'XR'], grades: ['1', '2', '3', '4'], type: 'journal' },
  warning: { title: ['国际期刊预警', 'Journal Early Warning List'], short: ['预警', 'Warning'], grades: ['Warning'], type: 'journal' },
  sci: { title: ['SCI 收录（SCIE）', 'SCI indexing (SCIE)'], short: ['SCI', 'SCI'], grades: ['Indexed'], type: 'journal' },
};

const han = /\p{Script=Han}/u;
const omitted = /(?:…|\.{3,})/;
const containerWords = /\b(?:the|of|on|and|for|in|at|proceedings|proc|ieee|acm|cvf|annual|international|conference|symposium|congress|meeting|colloquium|\d+(?:st|nd|rd|th))\b/g;
const conferenceWords = /\b(?:conference|symposium|congress|colloquium|workshops?)\b/i;
const unavailableKinds = /\b(?:arxiv|biorxiv|medrxiv|ssrn|preprint|patent|dissertation|thesis)\b/i;
const sideEvent = /\b(?:companion|extended abstracts?|adjunct|posters?|demos?|technical[- ]briefs?|doctoral consortium|tutorials?)\b/i;
const folded = (value) => String(value ?? '').normalize('NFKC').trim();

function key(value) {
  const text = folded(value).toLowerCase();
  if (han.test(text)) return text.replace(/[^\p{L}\p{N}]/gu, '');
  return text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function csvRows(text) {
  const separator = text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
  const rows = [];
  let cells = [], field = '', quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    if (char === '"' && (quoted || field === '')) {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === separator || char === '\n' || char === undefined)) {
      cells.push(field.trim());
      field = '';
      if (char !== separator) {
        if (cells.some(Boolean)) rows.push(cells);
        cells = [];
      }
    } else if (char !== undefined) {
      field += char;
    }
  }
  if (quoted) throw new Error('unclosedQuote');
  const [headers, ...records] = rows;
  if (!headers) return [];
  return records.map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i]])));
}

function typeOf(value) {
  const type = folded(value);
  if (/\b(?:conference|conf|proceedings)\b|会议/i.test(type)) return 'conference';
  if (/\b(?:journal|periodical)\b|期刊|刊物/i.test(type)) return 'journal';
  return '';
}

function gradeFor(id, value) {
  if (id === 'pku' || id === 'warning' || id === 'sci') return lists[id].grades[0];
  const input = folded(value).toUpperCase();
  const patterns = { ccf: /^(?:CCF[-\s]*)?([ABC])(?:类|级)?$/, jcr: /\b(Q[1-4])\b/, cas: /^([1-4])(?:区|\s*\[.*\])?$/, xr: /^([1-4])(?:区|\s*\[.*\])?$/ };
  return input.match(patterns[id])?.[1];
}

const splitAliases = (value) => (Array.isArray(value) ? value : folded(value).split(/[|;；]/)).map(folded).filter(Boolean);
const warningWord = /预警|warning|under review/i;
const scieCode = /\b(?:SCIE|Science Citation Index Expanded)\b/i;

export function normalizeIssn(value) {
  const code = folded(value).toUpperCase().replace('-', '');
  if (!/^\d{7}[\dX]$/.test(code)) return '';
  const checksum = [...code].reduce((sum, char, i) => sum + (char === 'X' ? 10 : Number(char)) * (8 - i), 0);
  return checksum % 11 === 0 ? code : '';
}

export function parseCatalog(id, raw, edition = '') {
  if (!Object.hasOwn(lists, id)) throw new Error('unknownCatalog');
  const input = raw.trim();
  const parsed = /^[\[{]/.test(input) ? JSON.parse(input) : csvRows(input);
  return normalizeCatalog(id, parsed, edition);
}

export function parseBundle(raw) {
  const data = JSON.parse(raw);
  const ids = Object.keys(data?.catalogs || {});
  if (data?.schema !== 'citelocus-local-lists-1' || !ids.length || ids.some((id) => !Object.hasOwn(lists, id))) {
    throw new Error('badRecords');
  }
  return Object.fromEntries(ids.map((id) => [id, normalizeCatalog(id, data.catalogs[id])]));
}

function normalizeCatalog(id, parsed, edition) {
  const rows = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(rows) || !rows.length || rows.length > 50000) throw new Error('badRecords');
  const records = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`row:${index + 1}`);
    const fields = new Map(Object.entries(row).map(([name, value]) => [folded(name).toLowerCase(), value]));
    const get = (...names) => names.map((name) => fields.get(name)).find((v) => folded(v));
    if (id === 'sci') {
      const collection = folded(get('index', 'collection', 'web of science', '数据库', '收录'));
      if (!scieCode.test(collection) || /on[\s-]*hold|suppressed/i.test(collection)) continue;
    }
    const title = folded(get('title', 'name', 'journal', '刊名', '期刊名称', '全称', '会议名称', '刊物名称'));
    let rank = gradeFor(id, get('rank', 'tier', 'grade', '等级', '分区', '类别', '大类分区', '大类新锐分区',
      'ccf推荐类别(国际学术刊物/会议)'));
    if (!rank && id === 'jcr') {
      rank = [...fields].filter(([name]) => /^(?:if )?quartile(?:\(|_)/.test(name))
        .map(([, value]) => gradeFor(id, value)).filter(Boolean).sort()[0];
    }
    if (!title || title.length > 400 || !rank) throw new Error(`row:${index + 1}`);
    const type = lists[id].type || typeOf(get('type', 'kind', '类型', 'ccf推荐类型'));
    const abbr = folded(get('abbr', 'acronym', '简称', '缩写', ...(id === 'ccf' && fields.has('journal') ? ['刊物名称'] : [])));
    const aliases = [...new Set([...splitAliases(get('aliases', 'alias', '别名')), ...splitAliases(get('中文刊名'))])]
      .filter((alias) => key(alias) !== key(title));
    if (abbr.length > 100 || aliases.length > 50 || aliases.some((alias) => alias.length > 400)) throw new Error(`row:${index + 1}`);
    const metric = id === 'jcr' ? folded(get('if', 'impactfactor', 'impact factor', '影响因子',
      ...[...fields.keys()].filter((name) => /^if\(\d{4}\)$/.test(name)))) : '';
    const value = metric && Number(metric);
    const impact = Number.isFinite(value) && value >= 0 ? value : null;
    const flag = folded(get('flags', 'flag', '标记', '标注', '预警标记'));
    const top = /\btop\b/i.test(flag) || /^(?:yes|true|1|是|top)$/i.test(folded(get('top')));
    const reason = folded(get('reason', '预警原因', ...[...fields.keys()].filter((name) => name.startsWith('预警原因('))));
    const warning = id === 'warning' || warningWord.test(flag) || Boolean(reason);
    const record = [title, type, rank, abbr, aliases, impact, top, warning, reason.slice(0, 240)];
    if (id === 'sci') {
      const codes = ['issn', 'eissn', 'e-issn', 'issns', 'issn/eissn']
        .flatMap((column) => folded(fields.get(column)).match(/\b\d{4}-?\d{3}[\dX]\b/gi) || []);
      const identifiers = [...new Set(codes.map(normalizeIssn).filter(Boolean))];
      if (identifiers.length) record.push(identifiers);
    }
    const signature = JSON.stringify(record);
    if (!seen.has(signature)) { seen.add(signature); records.push(JSON.parse(signature)); }
  }
  if (!records.length) throw new Error('badRecords');
  return { edition: folded(edition || parsed?.edition).slice(0, 80), records };
}

function trackOf(source) {
  const findings = /\bfindings of (?:the )?association for computational linguistics\b/i;
  const series = findings.exec(source);
  if (series) {
    const parent = source.slice(series.index + series[0].length).match(/^\s*[:：–—]\s*(.+)$/)?.[1] || '';
    return { label: 'Findings', parent };
  }
  const match = /\b(workshops?|findings|short[ -]+papers?)\b/i.exec(source);
  if (!match) return null;
  const label = /^workshop/i.test(match[0]) ? 'Workshop' : /^findings/i.test(match[0]) ? 'Findings' : 'Short Paper';
  const before = source.slice(0, match.index).replace(/\s*\((?:volume|vol\.)\s+\d+\s*:\s*$/i, '').replace(/[\s(:,-]+$/, '');
  const after = source.slice(match.index + match[0].length);
  const related = after.match(/\b(?:of|at|in conjunction with|co-located with)\s+(.+)/i)?.[1];
  return { label, parent: related || before };
}

export function hasConferenceTrack(source) {
  return sideEvent.test(source) || Boolean(trackOf(source));
}

function sourceForm(value) {
  return folded(value).replace(/^[《「]/, '').replace(/[》」]/g, '')
    .replace(/[\s,:]*第?\s*\d{1,4}\s*卷(?:\s*第?\s*\d{1,4}\s*期)?(?:[,:].*)?$/, '')
    .replace(/(?<=[\p{Script=Han})])\s*,?\s*(?:第\s*\d+\s*期|\(\d+(?:[–—-]\d+)?\))(?:\s*[,:].*)?$/u, '')
    .replace(/\s*,?\s*\d{1,4}\s*\(\s*\d+(?:\s*[-–—]\s*\d+)?\s*\)(?:\s*[,:].*)?$/, '')
    .replace(/\s*[,:]\s*\d+(?:\s*[-–—]\s*\d+)?\s*$/, '')
    .replace(/\s*\(?(?:19|20)\d{2}\)?\s*$/, '').replace(/^(?:the\s+)?(?:19|20)\d{2}\s+/i, '')
    .replace(/[\s,:]+$/, '');
}

function loose(value) {
  return key(value).replace(containerWords, ' ').replace(/\s+/g, ' ').trim();
}

function truncatedNames(catalogs) {
  const names = new Map();
  for (const { records } of Object.values(catalogs)) {
    for (const [title, type] of records) {
      if (han.test(title)) continue;
      const name = key(title);
      if (!names.has(name)) names.set(name, { phrase: loose(title), name, types: new Set() });
      names.get(name).types.add(type);
    }
  }
  const sortedBy = (field) => [...names.values()].filter((entry) => entry[field]).sort((a, b) =>
    a[field] === b[field] ? 0 : a[field] < b[field] ? -1 : 1);
  const literalNames = sortedBy('name');
  const simplifiedNames = sortedBy('phrase');
  const uniquePrefix = (sorted, field, prefix, type) => {
    let start = 0, end = sorted.length;
    while (start < end) {
      const center = (start + end) >>> 1;
      if (sorted[center][field] < prefix) start = center + 1;
      else end = center;
    }
    let result = '';
    for (let i = start; i < sorted.length && sorted[i][field].startsWith(prefix); i++) {
      const { name, types } = sorted[i];
      if (type && !types.has(type) && !types.has('')) continue;
      if (result) return '';
      result = name;
    }
    return result;
  };
  return (visible, type) => {
    const prefix = loose(visible);
    const words = prefix.split(' ');
    const literal = key(visible);
    // A substantial exact prefix can identify titles shortened just after a connector.
    if (literal.length >= 18 && words.length >= 2) {
      const name = uniquePrefix(literalNames, 'name', literal + ' ', type);
      if (name) return name;
    }
    if (words.length < 3 || words.at(-1).length < 3) return '';
    return uniquePrefix(simplifiedNames, 'phrase', prefix, type);
  };
}

function withoutVolume(title) {
  // Keep the original as an exact-match candidate before trying to remove a volume.
  return title.replace(/(?:\s*,\s*|\s+)(?:vol(?:ume)?\.?\s*)?\d{1,4}(?:\s*,?\s*no\.?\s*\d{1,4})?(?:\s*,?\s*pp?\.?\s*\d+(?:\s*[-–—]\s*\d+)?)?$/i, '').trim();
}

const titleConnectors = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'the', 'to']);
const ieeeWords = (normalized) => normalized.split(' ').slice(1).filter((word) => !titleConnectors.has(word));

function ieeeJournalNames(catalogs) {
  const titles = new Map();
  const aliases = new Map();
  const add = (abbreviation, name) => {
    if (!aliases.has(abbreviation)) aliases.set(abbreviation, new Set());
    aliases.get(abbreviation).add(name);
  };
  for (const catalog of Object.values(catalogs)) {
    for (const [title, type, , abbr] of catalog.records) {
      if (type !== 'journal' || !/^IEEE[\s/-]/i.test(title)) continue;
      const name = key(title);
      const words = ieeeWords(name);
      titles.set(name, words);
      if (abbr) {
        const shortened = key(abbr);
        if (shortened) add(shortened, name);
        if (shortened && !shortened.startsWith('ieee ')) add(`ieee ${shortened}`, name);
      }
      // Publisher-prefixed initialisms disambiguate unregistered forms such as IEEE TGRS.
      if (words.length >= 3) add(`ieee ${words.map((word) => word[0]).join('')}`, name);
    }
  }
  return (title) => {
    const normalized = key(title);
    const abbreviated = aliases.get(normalized);
    if (abbreviated) return abbreviated.size === 1 ? abbreviated.values().next().value : '';
    if (!normalized.startsWith('ieee ')) return '';
    const words = ieeeWords(normalized);
    const kindIndex = words[0] === 'acm' ? 1 : 0;
    if (words.length < kindIndex + 3) return '';
    // Some all-caps citation exports shorten Transactions/Journal to T/J and omit the tail.
    const prefix = /^[tj]$/.test(words[kindIndex]) && title === title.toUpperCase();
    const candidates = [...titles].filter(([, full]) => {
      if (words.length > full.length || (!prefix && words.length !== full.length)) return false;
      return words.every((word, i) => word === full[i] || (word.length >= 3 && full[i].startsWith(word)) ||
        (i === kindIndex && ((word === 't' && full[i] === 'transactions') || (word === 'j' && full[i] === 'journal'))));
    });
    return candidates.length === 1 ? candidates[0][0] : '';
  };
}

export function inferType(source) {
  if (!source) return 'unknown';
  if (/\b(?:arxiv|biorxiv|medrxiv|ssrn|preprint)\b/i.test(source)) return 'preprint';
  if (/\bpatent\b|专利/i.test(source)) return 'patent';
  if (/\b(?:dissertation|thesis)\b|学位论文/i.test(source)) return 'thesis';
  if (conferenceWords.test(source) || /\bproceedings of the\b/i.test(source)) return 'conference';
  if (/\b(?:journal|transactions|letters|magazine|bulletin|annals)\b|学报|杂志|\d+\s*\(\s*\d+\s*\)/i.test(source)) return 'journal';
  if (/\b(?:book|chapter|handbook|edition|press)\b/i.test(source)) return 'book';
  return 'other';
}

function sharedAliases(catalogs) {
  const aliases = new Map();
  for (const { records } of Object.values(catalogs)) {
    for (const [title, type, , abbr, otherNames] of records) {
      if (!abbr && !otherNames.length) continue;
      const name = key(title);
      for (const alternate of [abbr, ...otherNames]) {
        const alias = key(alternate);
        if (!alias || alias === name) continue;
        if (!aliases.has(alias)) {
          aliases.set(alias, { name, type });
          continue;
        }
        const previous = aliases.get(alias);
        if (previous && (previous.name !== name || (previous.type && type && previous.type !== type))) aliases.set(alias, null);
        else if (previous && !previous.type) previous.type = type;
      }
    }
  }
  // A full title elsewhere takes precedence over an unrelated abbreviation.
  for (const { records } of Object.values(catalogs)) {
    for (const [title] of records) {
      const full = key(title);
      if (aliases.has(full)) aliases.set(full, null);
    }
  }
  return (title) => aliases.get(key(title));
}

export function createMatcher(catalogs, enabled = {}) {
  const resolveIEEE = ieeeJournalNames(catalogs);
  const resolveTruncated = truncatedNames(catalogs);
  const resolveAlias = sharedAliases(catalogs);
  const issnTitles = new Map();
  for (const [name, , , , , , , , , identifiers] of catalogs.sci?.records || []) {
    for (const issn of identifiers || []) {
      if (!issnTitles.has(issn)) issnTitles.set(issn, name);
      else if (key(issnTitles.get(issn)) !== key(name)) issnTitles.set(issn, '');
    }
  }
  const indexes = [];
  for (const [id, spec] of Object.entries(lists)) {
    const catalog = catalogs[id];
    if (enabled[id] === false || !catalog?.records?.length) continue;
    const exact = new Map(), simplified = new Map();
    const add = (map, name, record) => {
      if (!name) return;
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(record);
    };
    for (const record of catalog.records) {
      const [title, , , abbr, aliases] = record;
      [title, abbr, ...aliases].forEach((name) => add(exact, key(name), record));
      if (id === 'pku' || id === 'warning' || id === 'sci' || han.test(title)) continue;
      add(simplified, loose(title), record);
    }
    indexes.push({ id, spec, edition: catalog.edition, exact, simplified });
  }
  const cache = new Map();
  return function match(raw, hint = '', identifier = '') {
    const serials = Array.isArray(identifier) ? identifier : [identifier];
    const names = new Set(serials.map((issn) => issnTitles.get(normalizeIssn(issn))).filter(Boolean));
    const journalById = names.size === 1 ? names.values().next().value : '';
    const cached = `${hint}\0${raw}\0${journalById || ''}`;
    if (cache.has(cached)) return cache.get(cached);
    const source = folded(raw);
    if (unavailableKinds.test(source) || sideEvent.test(source)) return [];
    const track = trackOf(source);
    const target = track ? track.parent : source;
    const truncated = omitted.test(target);
    const title = sourceForm(target.split(omitted)[0]);
    const conference = track || hint === 'conference' || conferenceWords.test(target);
    const byIdentifier = () => journalById && !conference ? match(journalById, 'journal') : [];
    if (!title || (truncated && han.test(title))) return byIdentifier();
    const expanded = title.replace(/^proceedings of (?:the )?/i, '');
    const parenthetical = title.match(/\(([A-Z][A-Z0-9& .-]{1,20})\)\s*$/);
    const base = parenthetical ? title.slice(0, parenthetical.index).trim() : title;
    const abbreviation = parenthetical?.[1].replace(/\s+(?:19|20)\d{2}$/, '');
    const journal = !conference && (hint === 'journal' || inferType(target) === 'journal');
    const full = truncated ? resolveTruncated(expanded, conference ? 'conference' : journal ? 'journal' : '') : '';
    const volumeFree = !conference && !truncated ? withoutVolume(title) : title;
    const ieee = !conference && !truncated ? resolveIEEE(volumeFree) : '';
    const alias = !truncated && (resolveAlias(volumeFree) || resolveAlias(base));
    const matches = [];
    for (const index of indexes) {
      if ((track && index.id !== 'ccf') || (conference && index.spec.type === 'journal')) continue;
      const choose = (entries) => {
        const fitting = [...(entries || [])].filter(([, type]) => !(type === 'journal' && conference) && !(type === 'conference' && journal));
        const identical = fitting.filter(([name]) => key(name) === key(title));
        const choices = identical.length ? identical : fitting;
        return choices.length === 1 ? choices[0] : null;
      };
      let record = !truncated && (choose(index.exact.get(key(title))) || choose(index.exact.get(key(expanded))));
      if (!record && abbreviation) record = choose(index.exact.get(key(base))) || choose(index.exact.get(key(abbreviation)));
      if (!record && volumeFree !== title) {
        const volumes = index.exact.get(key(volumeFree));
        record = choose([...(volumes || [])].filter(([, type]) => type === 'journal'));
      }
      if (!record && alias) {
        const canonical = index.exact.get(alias.name);
        record = choose([...(canonical || [])].filter(([, type]) => !alias.type || !type || alias.type === type));
      }
      if (!record && ieee) record = choose(index.exact.get(ieee));
      if (!record && !truncated) record = choose(index.simplified.get(loose(expanded)));
      if (!record && full) record = choose(index.exact.get(full));
      if (!record) continue;
      const [name, type, rank, , , impact, top, warning, reason] = record;
      matches.push({ id: index.id, edition: index.edition, name, type, rank, impact, top, warning, reason, track: track?.label });
    }
    let result = matches;
    if (!matches.length) result = byIdentifier();
    else if (journalById && matches.some(({ name }) => key(name) === key(journalById))) {
      const byList = new Map([...byIdentifier(), ...matches].map((hit) => [hit.id, hit]));
      result = indexes.map(({ id }) => byList.get(id)).filter(Boolean);
    }
    cache.set(cached, result);
    return result;
  };
}
