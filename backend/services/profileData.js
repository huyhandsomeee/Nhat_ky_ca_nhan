function toAuthUser(user) {
  return {
    id: String(user._id || user.id),
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio || '',
    avatarUrl: user.avatarPath || null,
    needsProfileSetup: !String(user.displayName || '').trim()
  };
}

function toPublicProfile(user, entries) {
  return {
    profile: {
      id: String(user._id || user.id),
      username: user.username,
      displayName: user.displayName || 'Người viết',
      bio: user.bio || '',
      avatarUrl: user.avatarPath || null
    },
    entries
  };
}

module.exports = { toAuthUser, toPublicProfile };
