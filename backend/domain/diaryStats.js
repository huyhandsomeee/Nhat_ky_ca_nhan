const DAY_MS = 24 * 60 * 60 * 1000;

function dateInVietnam(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function calculateStreaks(values, today = dateInVietnam()) {
  const dates = [...new Set(values)].filter(isDate).sort();
  if (!dates.length) return { currentStreak: 0, longestStreak: 0 };
  let longestStreak = 1;
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (dayDistance(dates[index - 1], dates[index]) === 1) run += 1;
    else run = 1;
    longestStreak = Math.max(longestStreak, run);
  }
  const latest = dates.at(-1);
  if (dayDistance(latest, today) > 1) return { currentStreak: 0, longestStreak };
  let currentStreak = 1;
  for (let index = dates.length - 1; index > 0 && dayDistance(dates[index - 1], dates[index]) === 1; index -= 1) currentStreak += 1;
  return { currentStreak, longestStreak };
}

function dayDistance(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

module.exports = { calculateStreaks, dateInVietnam };
