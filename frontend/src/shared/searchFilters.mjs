export function parseEntrySearch(value) {
  const source = String(value || '').trim();
  const date = source.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/)?.[1] || '';
  const withoutDate = source.replace(/(?:^|\s)\d{4}-\d{2}-\d{2}(?=\s|$)/, ' ').trim();
  const hashtagIndex = withoutDate.indexOf('#');
  const authorIndex = withoutDate.lastIndexOf('@');
  const tag = hashtagIndex >= 0 ? withoutDate.slice(hashtagIndex + 1, authorIndex > hashtagIndex ? authorIndex : undefined).trim() : '';
  return { date, tag };
}

export function getSearchHashtagFragment(value) {
  const match = String(value || '').match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);
  return match ? match[1] : null;
}

export function replaceSearchHashtag(value, tag) {
  const match = String(value || '').match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);
  if (!match) return `#${tag}`;
  return `${value.slice(0, match.index)}${match[0].slice(0, match[0].lastIndexOf('#'))}#${tag}`;
}

export function getAuthorSearchTerm(value) {
  const source = String(value || '').replace(/(?:^|\s)\d{4}-\d{2}-\d{2}(?=\s|$)/g, ' ').trim();
  const atIndex = source.lastIndexOf('@');
  if (atIndex >= 0) return source.slice(atIndex + 1).trim();
  return source.includes('#') ? '' : source;
}

export function replaceSearchAuthor(value, username) {
  const { tag } = parseEntrySearch(value);
  return [tag ? `#${tag}` : '', `@${username}`].filter(Boolean).join(' ');
}
