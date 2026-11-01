function moodsByDateFromLatestEntries(entries) {
  const moodByDate = {};
  for (const entry of entries) {
    if (entry.mood && !Object.hasOwn(moodByDate, entry.journalDate)) moodByDate[entry.journalDate] = entry.mood;
  }
  return moodByDate;
}

function summarizeMoodWeek(week) {
  const weekMoodCounts = {};
  let weekMoodDays = 0;
  for (const day of week) {
    if (!day.mood) continue;
    weekMoodDays += 1;
    weekMoodCounts[day.mood] = (weekMoodCounts[day.mood] || 0) + 1;
  }
  return { weekMoodDays, weekMoodCounts };
}

module.exports = { moodsByDateFromLatestEntries, summarizeMoodWeek };
