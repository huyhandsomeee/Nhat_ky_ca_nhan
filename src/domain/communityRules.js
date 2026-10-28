const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function canMessage({ areFriends, blocked } = {}) {
  return Boolean(areFriends && !blocked);
}

function canInteractWithEntry(entry) {
  return entry?.visibility === 'public';
}

function normalizeReaction(value) {
  return REACTIONS.includes(value) ? value : null;
}

function normalizeUsernameSearch(value) {
  return String(value || '').trim().toLowerCase().slice(0, 30);
}

module.exports = { REACTIONS, canMessage, canInteractWithEntry, normalizeReaction, normalizeUsernameSearch };
