export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
export const MOOD_EMOJI = { 'vui': '😊', 'biết ơn': '🙏', 'bình yên': '😌', 'bình thường': '🙂', 'buồn': '😔', 'lo lắng': '😟', 'tức giận': '😠', 'mệt mỏi': '😴' };
export const MOODS = ['vui', 'biết ơn', 'bình yên', 'bình thường', 'buồn', 'lo lắng', 'tức giận', 'mệt mỏi'];

export function parseTagInput(value) {
  return String(value || '').split(',').map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean);
}

export function getActiveHashtag(value) {
  const match = String(value || '').match(/(?:^|\s)#([^\s,]*)$/u);
  return match ? match[1] : null;
}

export function replaceActiveHashtag(value, tag) {
  const match = String(value || '').match(/(?:^|\s)#([^\s,]*)$/u);
  if (!match) return `#${tag}`;
  return `${value.slice(0, match.index)}${match[0].slice(0, match[0].lastIndexOf('#'))}#${tag}`;
}

export function formatDay(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(new Date(`${value}T12:00:00`));
}

export function formatMonthYear(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function formatLongDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function formatTimestamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function getCommentDepth(comment, comments, seen = new Set()) {
  if (!comment?.parentComment || seen.has(String(comment._id)) || seen.size >= 5) return 0;
  seen.add(String(comment._id));
  const parentId = String(comment.parentComment?._id || comment.parentComment);
  const parent = comments.find((item) => String(item._id) === parentId);
  return parent ? 1 + getCommentDepth(parent, comments, seen) : 0;
}

export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function capitalize(value) {
  return value.charAt(0).toLocaleUpperCase('vi-VN') + value.slice(1);
}
