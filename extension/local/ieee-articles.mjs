import { articleNumber, ieeeArticleId, ieeeHost } from '../app/ieee-link.mjs';
import { verifiedArticle } from './verified-articles.mjs';
import { onlineFetch } from './online-access.mjs';

function entities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name) => {
    const known = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
    const lower = name.toLowerCase();
    if (Object.hasOwn(known, lower)) return known[lower];
    const code = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : Number(lower.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function journalRecord(title, issn) {
  if (typeof title !== 'string') return null;
  const journal = entities(title).replace(/\s+/g, ' ').trim();
  return journal && journal.length <= 400 ? {
    journal, issn: String(issn || '').match(/\b\d{4}-\d{3}[\dX]\b/i)?.[0] || '',
  } : null;
}

export function journalFromHtml(html) {
  const meta = new Map();
  const head = html.split(/<\/head\s*>/i, 1)[0].replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');
  for (const [tag] of head.matchAll(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    const attributes = new Map();
    for (const [, key, quoted, single, plain] of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+))/g)) {
      attributes.set(key.toLowerCase(), quoted ?? single ?? plain);
    }
    const name = attributes.get('name')?.toLowerCase();
    if (name?.startsWith('citation_') && attributes.has('content')) meta.set(name, attributes.get('content'));
  }
  if (meta.has('citation_conference_title')) return null;
  if (meta.has('citation_journal_title')) return journalRecord(meta.get('citation_journal_title'), meta.get('citation_issn'));

  // Some Xplore pages expose the same metadata as a JSON object.
  const embedded = html.match(/\b(?:xpl)?global\.document\.metadata\s*=\s*(\{[\s\S]*?\})\s*;/i)?.[1];
  if (!embedded) return null;
  try {
    const metadata = JSON.parse(embedded);
    const type = metadata.contentType || metadata.publicationType || metadata.docType;
    if (!/^journals?(?:\s+article)?$/i.test(type || '') && metadata.isJournal !== true) return null;
    return journalRecord(metadata.publicationTitle, metadata.issn);
  } catch {
    return null;
  }
}

const requests = new Map();
let pending = Promise.resolve();
let retryAfter = 0;

async function readIeeeArticle(id) {
  if (Date.now() < retryAfter) return null;
  try {
    const response = await onlineFetch(`https://${ieeeHost}/document/${id}/`, {
      credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(6000),
    });
    if (!response) return null;
    if ([202, 401, 403, 418, 429].includes(response.status)) retryAfter = Date.now() + 60000;
    if (response.status !== 200 || articleNumber(response.url) !== id) return null;
    const html = await response.text();
    return html.length <= 2_000_000 ? journalFromHtml(html) : null;
  } catch {
    return null;
  }
}

function lookup(id) {
  const verified = verifiedArticle('ieee', id);
  if (verified) return Promise.resolve(verified);
  if (requests.has(id)) return requests.get(id);
  const request = pending.then(() => readIeeeArticle(id));
  requests.set(id, request);
  if (requests.size > 128) requests.delete(requests.keys().next().value);
  void request.then((record) => { if (!record && requests.get(id) === request) requests.delete(id); });
  pending = request;
  return request;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'citelocus-ieee-article' || sender.id !== chrome.runtime.id ||
      typeof message.id !== 'string' || !ieeeArticleId.test(message.id)) return;
  const source = URL.canParse(sender.url) && new URL(sender.url);
  if (!source || source.protocol !== 'https:' || !source.hostname.startsWith('scholar.google.') ||
      source.pathname !== '/scholar') return;
  lookup(message.id).then(respond);
  return true;
});
