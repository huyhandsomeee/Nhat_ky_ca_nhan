export function parseEntrySearch(value) {
  const source = String(value || '').trim();
  const date = source.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/)?.[1] || '';
  const withoutDate = source.replace(/(?:^|\s)\d{4}-\d{2}-\d{2}(?=\s|$)/, ' ').trim();
  const hashtag = withoutDate.match(/(?:^|\s)#(.+?)\s*$/u);
  return { date, tag: hashtag?.[1]?.trim() || '' };
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
