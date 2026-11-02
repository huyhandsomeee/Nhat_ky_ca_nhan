const Block = require('../models/Block');

async function getHiddenAuthors(viewerId) {
  if (!viewerId) return [];
  const [blockers, blockedUsers] = await Promise.all([
    Block.find({ blocked: viewerId }).distinct('blocker'),
    Block.find({ blocker: viewerId }).distinct('blocked')
  ]);
  return [...new Map([...blockers, ...blockedUsers].map((id) => [String(id), id])).values()];
}

async function isBlockRelationship(viewerId, authorId) {
  if (!viewerId || !authorId) return false;
  return Boolean(await Block.exists({ $or: [
    { blocker: authorId, blocked: viewerId },
    { blocker: viewerId, blocked: authorId }
  ] }));
}

function removeHiddenReactions(comments, hiddenUserIds) {
  const hidden = new Set((hiddenUserIds || []).map(String));
  for (const comment of comments) {
    comment.reactions = comment.reactions.filter((reaction) => !hidden.has(String(reaction.user?._id || reaction.user)));
  }
  return comments;
}

module.exports = { getHiddenAuthors, isBlockRelationship, removeHiddenReactions };
