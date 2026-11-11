const han = /\p{Script=Han}/u;
const normalized = (text) => String(text || '').normalize('NFKC').trim();
const letters = (text) => normalized(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().match(/[a-z]+/g) || [];
const titles = /\b(?:professor|prof|dr|phd|mr|mrs|ms)\b\.?/gi;

function nameVariants(value, pinyin) {
  const literal = new Set();
  const script = new Set();
  const spellings = new Set();
  const pairs = [];
  function addPair(family, given) {
    pairs.push({ family, given });
    spellings.add(family + given.join(''));
    spellings.add(given.join('') + family);
  }
  for (const part of normalized(value).split(/[()|/]/)) {
    const text = part.replace(titles, '').toLowerCase();
    const compact = text.replace(/[^\p{L}\p{M}]/gu, '');
    if (compact) literal.add(compact);
    for (const candidate of text.matchAll(/[\p{Script=Han}·・]+(?:\s+[\p{Script=Han}·・]+)*/gu)) {
      const chinese = candidate[0].replace(/[\s·・]/g, '');
      if (!han.test(chinese)) continue;
      script.add(chinese);
      if (!pinyin) continue;
      const syllables = pinyin(chinese, { mode: 'surname', toneType: 'none' }).map((word) => letters(word.result).join(''));
      if (syllables.length > 1 && syllables.every(Boolean)) addPair(syllables[0], syllables.slice(1));
    }
    const words = letters(text);
    if (words.length === 1) spellings.add(words[0]);
    if (words.length > 1) {
      addPair(words[0], words.slice(1));
      addPair(words.at(-1), words.slice(0, -1));
    }
  }
  return { literal, script, spellings, pairs };
}

function overlaps(left, right) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function initialsMatch(short, long) {
  if (short.family !== long.family) return false;
  const initial = long.given.map((part) => part[0]).join('');
  return short.given.join('') === initial ||
    (short.given.every((part) => part.length === 1) && short.given[0] === initial[0]);
}

export function identifyOwner(name, pinyin) {
  const owner = nameVariants(name, pinyin);
  const scores = new Map();
  function score(label) {
    if (scores.has(label)) return scores.get(label);
    const author = nameVariants(label, pinyin);
    let value = 0;
    if (owner.script.size && author.script.size) value = overlaps(owner.script, author.script) ? 3 : 0;
    else if (overlaps(owner.literal, author.literal) || overlaps(owner.spellings, author.spellings)) value = 2;
    else if (author.pairs.some((a) => owner.pairs.some((b) => initialsMatch(a, b) || initialsMatch(b, a)))) value = 1;
    scores.set(label, value);
    return value;
  }
  return (labels) => {
    let best = 0;
    let index = -1;
    for (const [i, label] of labels.entries()) {
      const value = score(label);
      if (value > best) { best = value; index = i; }
      else if (value === best) index = -1;
    }
    return index;
  };
}

export function authorship(byline, identify) {
  const truncated = /(?:\.{3}|…)\s*$/.test(byline);
  const authors = normalized(byline).replace(/(?:\.{3}|…)\s*$/, '').split(/[,，、;；]/)
    .map((name) => name.trim()).filter(Boolean);
  const index = identify(authors);
  let role = truncated ? 'hidden' : 'unmatched';
  if (index === 0) role = 'first';
  if (index > 0) role = !truncated && index === authors.length - 1 ? 'last' : 'middle';
  return { authors, index, truncated, role, corresponding: index >= 0 && /[*＊∗]\s*$/.test(authors[index]) };
}

export function sum(values) { return values.reduce((total, n) => total + n, 0); }
export function average(values) { return values.length ? sum(values) / values.length : 0; }
export function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return average(ordered.slice(Math.floor((ordered.length - 1) / 2), Math.floor(ordered.length / 2) + 1));
}

export function impact(papers) {
  const cites = papers.map((p) => p.cites).sort((a, b) => b - a);
  let h = 0, g = 0, cumulative = 0;
  for (const [i, count] of cites.entries()) {
    const n = i + 1;
    cumulative += count;
    if (count >= n) h = n;
    if (cumulative >= n * n) g = n;
  }
  return {
    papers: cites.length, cites: cumulative, h, g, i10: cites.filter((c) => c >= 10).length,
    e: Math.sqrt(sum(cites.slice(0, h)) - h * h), hShare: cumulative ? sum(cites.slice(0, h)) / cumulative : 0,
    average: average(cites), median: median(cites), max: cites[0] || 0, uncited: cites.filter((c) => !c).length,
  };
}

function group(items, label) {
  const result = new Map();
  for (const item of items) {
    const key = label(item);
    if (!key) continue;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  }
  return result;
}

export function analyze(papers, received, now = new Date().getFullYear()) {
  const base = impact(papers);
  const dated = papers.filter((paper) => paper.year >= 1800 && paper.year <= now + 1);
  const years = [...new Set(dated.map((paper) => paper.year))].sort((a, b) => a - b);
  const span = years.length ? Math.max(1, now - years[0] + 1) : 0;
  const recent = dated.filter((paper) => paper.year >= now - 4);
  const receivedCounts = [...received];
  const annualCites = new Map(receivedCounts);
  const thisYear = annualCites.get(now - 1);
  const previousYear = annualCites.get(now - 2);
  const roles = group(papers, (paper) => paper.authorship.role);
  const position = group(papers, (paper) => paper.authorship.index >= 0 ? String(Math.min(6, paper.authorship.index + 1)) : '');
  const authorCounts = papers.filter((paper) => !paper.authorship.truncated && paper.authorship.authors.length)
    .map((paper) => paper.authorship.authors.length);
  const ranks = new Map();
  const coauthors = new Map();
  let collaborative = 0;
  for (const paper of papers) {
    for (const hit of paper.ranks) {
      if (!ranks.has(hit.id)) ranks.set(hit.id, []);
      ranks.get(hit.id).push({ paper, hit });
    }
    const partners = new Set(paper.authorship.authors.flatMap((name, index) =>
      index === paper.authorship.index ? [] : [normalized(name).replace(/[*＊∗]+$/, '').trim()]).filter(Boolean));
    if (paper.authorship.index >= 0 && partners.size) collaborative++;
    for (const partner of partners) {
      const key = partner.toLowerCase().replace(/\s+/g, ' ');
      if (!coauthors.has(key)) coauthors.set(key, { name: partner, papers: [] });
      coauthors.get(key).papers.push(paper);
    }
  }
  const ranges = [[0, 0], [1, 9], [10, 49], [50, 99], [100, 499], [500, 999], [1000, Infinity]];
  return {
    ...base, span, firstYear: years[0], m: span ? base.h / span : null,
    rate: span ? dated.length / span : null,
    topShare: base.cites ? base.max / base.cites : 0,
    recent: recent.length, recentCites: sum(receivedCounts.filter(([year]) => year >= now - 4).map(([, count]) => count)),
    recentShare: sum([...annualCites.values()]) ? sum(receivedCounts.filter(([year]) => year >= now - 4).map(([, count]) => count)) / sum([...annualCites.values()]) : null,
    thisYear, growth: previousYear && thisYear != null ? thisYear / previousYear - 1 : null,
    yearPapers: years.map((year) => [year, dated.filter((paper) => paper.year === year).length]),
    buckets: ranges.map(([min, max]) => [min === max ? String(min) : max === Infinity ? `${min}+` : `${min}–${max}`,
      papers.filter(({ cites }) => cites >= min && cites <= max).length]),
    roles, position, corresponding: papers.filter((paper) => paper.authorship.corresponding),
    meanAuthors: average(authorCounts), medianAuthors: median(authorCounts),
    ranks, collaborative, coauthors: [...coauthors.values()],
    types: group(papers, (paper) => paper.type),
    venues: group(papers, (paper) => paper.venue),
  };
}
