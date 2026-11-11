import { articleNumber } from './ieee-link.mjs';

export const serialPii = /^S(\d{7}[\dX])\d{2}[\dA-Z]{6}$/;

export function normalizeDoi(value) {
  if (typeof value !== 'string') return '';
  const doi = value.trim().toLowerCase();
  if (doi.length > 300 || !/^10\.\d{4,9}\/[^\s?#\\]+$/i.test(doi)) return '';
  return doi.split('/').some((part) => part === '.' || part === '..') ? '' : doi;
}

export function articleIdentifiers(href, scholarOrigin) {
  if (!href) return {};
  try {
    let url = new URL(href, scholarOrigin);
    if (url.origin === scholarOrigin && ['/scholar_url', '/url'].includes(url.pathname)) {
      url = new URL(url.searchParams.get('url') || url.searchParams.get('q'));
    }
    if (url.protocol !== 'https:' || url.username || url.password) return {};
    const pathname = decodeURIComponent(url.pathname);
    const sourcePath = url.hostname === 'link.springer.com' && pathname.startsWith('/content/pdf/')
      ? pathname.replace(/\.pdf$/i, '') : pathname;
    const doiPath = sourcePath.match(/(?:^|\/)(10\.\d{4,9}\/[^?#]+)$/i)?.[1].replace(/\/$/, '');
    const doi = normalizeDoi(url.searchParams.get('doi')) || normalizeDoi(url.searchParams.get('id')) || normalizeDoi(doiPath);
    let pii = '';
    if (/^(?:www\.)?sciencedirect\.com$/.test(url.hostname)) {
      pii = pathname.match(/^\/(?:org\/)?science\/article\/(?:abs\/)?pii\/([a-z\d]+)(?:\/|$)/i)?.[1] || '';
    } else if (url.hostname === 'linkinghub.elsevier.com') {
      pii = pathname.match(/^\/retrieve\/pii\/([a-z\d]+)\/?$/i)?.[1] || '';
    } else if (url.hostname === 'pdf.sciencedirectassets.com' || url.hostname === 'ars.els-cdn.com') {
      pii = pathname.match(/\/1-s2\.0-([a-z\d]+)-main\.pdf$/i)?.[1] || '';
    }
    pii = pii.toUpperCase();
    const serial = serialPii.exec(pii)?.[1];
    if (serial) return { doi, pii, issn: `${serial.slice(0, 4)}-${serial.slice(4)}` };
    const mdpi = url.host === 'mdpi.com' || url.host === 'www.mdpi.com';
    const issn = mdpi ? pathname.match(/^\/(\d{4}-\d{3}[\dX])\/\d+\/\d+\/\d+(?:\/|$)/i)?.[1] : '';
    return { doi, issn, ieee: articleNumber(url.href) };
  } catch {
    return {};
  }
}
