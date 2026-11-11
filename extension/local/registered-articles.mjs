import { normalizeDoi, serialPii } from '../app/article-link.mjs';
import { articleReference, matchesReference } from '../app/article-reference.mjs';
import { verifiedArticle } from './verified-articles.mjs';
import { onlineFetch } from './online-access.mjs';

const registryOrigins = new Set(['https://doi.org', 'https://api.crossref.org', 'https://data.crosscite.org']);
const articleTypes = new Map([
  ['article-journal', 'journal'], ['journal-article', 'journal'],
  ['paper-conference', 'conference'], ['proceedings-article', 'conference'],
]);
// Springer links journal 521 to this DOI stem and both ISSNs.
// https://link.springer.com/journal/521
const springerJournals = new Map([
  ['s00521', { venue: 'Neural Computing and Applications', type: 'journal', issns: ['0941-0643', '1433-3058'] }],
]);

export function registeredVenue(record) {
  const type = articleTypes.get(record?.type);
  const source = record?.['container-title'];
  const venue = (Array.isArray(source) ? source[0] : source);
  if (!type || typeof venue !== 'string' || !venue.trim() || venue.length > 400) return null;
  const issns = type === 'journal' ? String(record.ISSN || '').match(/\b\d{4}-\d{3}[\dX]\b/gi) || [] : [];
  return { venue: venue.trim(), type, issns };
}

const requests = new Map();
let pending = Promise.resolve();
let retryAfter = 0;
const dateFields = ['issued', 'published', 'published-online', 'published-print'];

async function fetchJson(url, accept) {
  try {
    const response = await onlineFetch(url, {
      credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(5000),
      headers: { Accept: accept },
    });
    if (!response) return null;
    if (response.status === 429 || response.status === 503) retryAfter = Date.now() + 60000;
    if (!response.ok || !registryOrigins.has(new URL(response.url).origin)) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function matchRegisteredReference(reference, records) {
  const matching = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const doi = normalizeDoi(record?.DOI);
    const source = registeredVenue(record);
    if (!doi || !source || !Array.isArray(record.title)) continue;
    const years = dateFields.map((field) => record[field]?.['date-parts']?.[0]?.[0]);
    // Scholar can display the early deposit year for articles assigned to an issue the next year.
    const depositedYear = record.created?.['date-parts']?.[0]?.[0];
    if (Number.isInteger(depositedYear) && years.includes(depositedYear + 1)) years.push(depositedYear);
    if (matchesReference(reference, record.title, record.author?.[0], years)) matching.set(doi, source);
  }
  return matching.size === 1 ? matching.values().next().value : null;
}

async function resolve(kind, id) {
  if (Date.now() < retryAfter) return null;
  try {
    if (kind === 'doi') {
      const path = id.split('/').map(encodeURIComponent).join('/');
      const crossref = await fetchJson(`https://api.crossref.org/works/${path}`, 'application/json');
      if (normalizeDoi(crossref?.message?.DOI) === id) return registeredVenue(crossref.message);
      if (Date.now() >= retryAfter) {
        const record = await fetchJson(`https://doi.org/${path}`, 'application/vnd.citationstyles.csl+json');
        if (normalizeDoi(record?.DOI) === id) return registeredVenue(record);
      }
      return null;
    }
    const url = new URL('https://api.crossref.org/works');
    if (kind === 'title') {
      url.searchParams.set('query.title', id.title);
      url.searchParams.set('rows', '8');
      url.searchParams.set('select', ['DOI', 'type', 'title', 'author', 'container-title', 'ISSN', 'created', ...dateFields].join(','));
      const payload = await fetchJson(url.href, 'application/json');
      return matchRegisteredReference(id, payload?.message?.items);
    }
    url.searchParams.set('filter', `alternative-id:${id}`);
    url.searchParams.set('rows', '2');
    url.searchParams.set('select', 'DOI,type,container-title,ISSN,alternative-id');
    const payload = await fetchJson(url.href, 'application/json');
    const records = payload?.message?.items;
    if (payload?.message?.['total-results'] !== 1 || records?.length !== 1) return null;
    const [record] = records;
    if (!record['alternative-id']?.some((value) => String(value).toUpperCase() === id)) return null;
    return registeredVenue(record);
  } catch {
    return null;
  }
}

function lookup(kind, id) {
  const verified = verifiedArticle(kind, id);
  if (verified) return Promise.resolve(verified);
  if (kind === 'doi') {
    const springer = id.match(/^10\.1007\/(s\d{5})-\d{3}-\d{5}-[\da-z]$/)?.[1];
    if (springerJournals.has(springer)) return Promise.resolve(springerJournals.get(springer));
  }
  const key = JSON.stringify([kind, id]);
  if (requests.has(key)) return requests.get(key);
  const request = pending.then(() => resolve(kind, id));
  requests.set(key, request);
  if (requests.size > 128) requests.delete(requests.keys().next().value);
  void request.then((record) => { if (!record && requests.get(key) === request) requests.delete(key); });
  pending = request;
  return request;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const kind = /^citelocus-(doi|pii|title)-article$/.exec(message?.type)?.[1];
  if (!kind || sender.id !== chrome.runtime.id) return;
  const id = kind === 'title' ? articleReference(message.id?.title, message.id?.author, message.id?.year)
    : kind === 'doi' ? normalizeDoi(message.id) : typeof message.id === 'string' && message.id.toUpperCase();
  if (!id || (kind === 'pii' && !serialPii.test(id))) return;
  const source = URL.canParse(sender.url) && new URL(sender.url);
  if (!source || source.protocol !== 'https:' || !source.hostname.startsWith('scholar.google.') ||
      source.pathname !== '/scholar') return;
  lookup(kind, id).then(respond);
  return true;
});
