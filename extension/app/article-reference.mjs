const fold = (value) => String(value ?? '').normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '');
const key = (value) => fold(value).replace(/[^\p{L}\p{N}]/gu, '');

export function articleReference(heading, byline, year) {
  const title = String(heading ?? '').replace(/^(?:\s*\[[^\]]{1,12}\]\s*)+/, '').trim();
  const author = String(byline ?? '').trim();
  if (title.length > 450 || key(title).length < 8 || /…|\.{3,}/.test(title)) return null;
  if (author.length > 100 || key(author).length < 2 || /…|\.{3,}/.test(author)) return null;
  if (!Number.isInteger(year) || year < 1800 || year > 2199) return null;
  return { title, author, year };
}

function sameAuthor(author, person) {
  const name = key(author);
  const family = key(person?.family);
  if (!family) return false;
  const given = key(person?.given);
  if (name === given + family || name === family + given) return true;
  const initials = (fold(person?.given).match(/\p{L}+/gu) || []).map((word) => word[0]).join('');
  return Boolean(initials && (name === initials + family || name === family + initials));
}

export function matchesReference(reference, titles, author, years) {
  const title = key(reference.title);
  return years.includes(reference.year) && sameAuthor(reference.author, author) &&
    titles.some((candidate) => key(String(candidate).replace(/<\/?(?:jats:)?[\w-]+(?:\s[^>]*)?>/gi, '')) === title);
}
