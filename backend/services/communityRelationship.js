function getRelationshipState({ currentUserId, targetUserId, blocked = false, friends = false, pendingRequest = null }) {
  if (String(currentUserId) === String(targetUserId)) return { state: 'self' };
  if (blocked) return { state: 'unavailable' };
  if (friends) return { state: 'friends' };
  if (pendingRequest) {
    const outgoing = String(pendingRequest.senderId) === String(currentUserId);
    return { state: outgoing ? 'outgoing' : 'incoming', requestId: String(pendingRequest.id) };
  }
  return { state: 'none' };
}

module.exports = { getRelationshipState };
