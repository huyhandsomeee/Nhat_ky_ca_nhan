const test = require('node:test');
const assert = require('node:assert/strict');

const profileData = (() => {
  try { return require('../backend/services/profileData'); }
  catch { return null; }
})();

test('authenticated profile serialization includes editable profile fields', () => {
  assert.deepEqual(profileData?.toAuthUser({
    _id: 'user-2', username: 'may', displayName: 'Mây', bio: 'Ghi chép mỗi ngày.',
    avatarPath: '/api/avatars/avatar.png'
  }), {
    id: 'user-2', username: 'may', displayName: 'Mây', bio: 'Ghi chép mỗi ngày.',
    avatarUrl: '/api/avatars/avatar.png', needsProfileSetup: false
  });
});

test('public profile serialization excludes credentials and private fields', () => {
  const entries = [{ _id: 'entry-1', title: 'Một ngày', visibility: 'public' }];
  const response = profileData?.toPublicProfile({
    _id: 'user-1',
    username: 'secret-handle',
    password: 'hashed-password',
    displayName: 'Mây',
    bio: 'Thích ghi chép.',
    avatarPath: '/api/avatars/avatar.webp',
    friends: ['friend-1']
  }, entries);

  assert.deepEqual(response, {
    profile: {
      id: 'user-1',
      username: 'secret-handle',
      displayName: 'Mây',
      bio: 'Thích ghi chép.',
      avatarUrl: '/api/avatars/avatar.webp'
    },
    entries
  });
});
