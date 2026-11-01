function buildDateTagFilter({ date = '', tag = '' } = {}) {
  const filter = {};
  if (date) filter.journalDate = date;
  const normalizedTag = String(tag || '').trim().replace(/^#+/, '').slice(0, 30);
  if (normalizedTag) filter.tags = { $regex: `^${escapeRegex(normalizedTag)}$`, $options: 'i' };
  return filter;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = { buildDateTagFilter, isCalendarDate };
