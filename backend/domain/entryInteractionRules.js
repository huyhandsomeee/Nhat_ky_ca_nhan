const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function canInteractWithEntry(entry) {
  return entry?.visibility === 'public';
}

function normalizeReaction(value) {
  return REACTIONS.includes(value) ? value : null;
}

module.exports = { REACTIONS, canInteractWithEntry, normalizeReaction };
