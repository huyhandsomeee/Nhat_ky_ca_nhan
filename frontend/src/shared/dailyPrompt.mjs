const PROMPTS = [
  'Có khoảnh khắc nhỏ nào trong ngày hôm nay khiến bạn mỉm cười?',
  'Hôm nay bạn biết ơn điều gì nhất?',
  'Một điều bạn muốn nhắn với chính mình của tuần trước là gì?',
  'Nơi nào hôm nay khiến bạn cảm thấy bình yên?',
  'Bạn đã vượt qua điều gì dù rất nhỏ trong hôm nay?'
];

export function getDailyPrompt(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  const index = date.split('-').reduce((sum, part) => sum + Number(part), 0) % PROMPTS.length;
  return PROMPTS[index];
}

export function getAlternativeDailyPrompt(currentPrompt, random = Math.random) {
  const alternatives = PROMPTS.filter((prompt) => prompt !== currentPrompt);
  if (!alternatives.length) return currentPrompt;
  const index = Math.min(alternatives.length - 1, Math.floor(random() * alternatives.length));
  return alternatives[Math.max(0, index)];
}
