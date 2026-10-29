const MOODS = ['vui', 'biết ơn', 'bình yên', 'bình thường', 'buồn', 'lo lắng', 'tức giận', 'mệt mỏi'];
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

function validateEntryInput(input, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  const title = String(input?.title ?? '').trim();
  const content = String(input?.content ?? '').trim();
  const journalDate = String(input?.journalDate ?? '');
  const visibility = String(input?.visibility || 'private');
  const mood = String(input?.mood || '');
  const tags = parseTags(input?.tags);

  if (!title || title.length > 120) errors.push({ field: 'title', message: 'Tiêu đề cần từ 1 đến 120 ký tự.' });
  if (!content || content.length > 10000) errors.push({ field: 'content', message: 'Nội dung cần từ 1 đến 10.000 ký tự.' });
  if (!isCalendarDate(journalDate) || journalDate > today) errors.push({ field: 'journalDate', message: 'Ngày nhật ký cần hợp lệ và không được ở tương lai.' });
  if (!['private', 'public'].includes(visibility)) errors.push({ field: 'visibility', message: 'Chế độ hiển thị không hợp lệ.' });
  if (mood && !MOODS.includes(mood)) errors.push({ field: 'mood', message: 'Tâm trạng không hợp lệ.' });
  if (tags.length > MAX_TAGS || tags.some((tag) => !tag || tag.length > MAX_TAG_LENGTH)) {
    errors.push({ field: 'tags', message: `Mỗi bài có tối đa ${MAX_TAGS} thẻ, mỗi thẻ không quá ${MAX_TAG_LENGTH} ký tự.` });
  }

  return errors;
}

function normalizeEntryInput(input) {
  return {
    title: String(input?.title ?? '').trim(),
    content: String(input?.content ?? '').trim(),
    journalDate: String(input?.journalDate ?? ''),
    mood: String(input?.mood || '') || null,
    tags: parseTags(input?.tags),
    visibility: String(input?.visibility || 'private')
  };
}

function canReadEntry(entry, userId) {
  if (!entry) return false;
  return entry.visibility === 'public' || (Boolean(userId) && sameId(entry.author, userId));
}

function canDeleteComment(comment, entry, userId) {
  if (!comment || !entry || !userId) return false;
  return sameId(comment.author, userId) || sameId(entry.author, userId);
}

function parseTags(value) {
  const rawTags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const normalized = rawTags.map((tag) => String(tag).trim()).filter(Boolean);
  return [...new Map(normalized.map((tag) => [tag.toLocaleLowerCase(), tag])).values()];
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function sameId(left, right) {
  const leftId = left?._id ?? left?.id ?? left;
  const rightId = right?._id ?? right?.id ?? right;
  return String(leftId) === String(rightId);
}

module.exports = { MOODS, validateEntryInput, normalizeEntryInput, canReadEntry, canDeleteComment };
