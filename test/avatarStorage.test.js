const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const avatarStorage = (() => {
  try { return require('../backend/services/avatarStorage'); }
  catch { return null; }
})();

function validPng() {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
}

test('avatar validator accepts supported images with matching file signatures', () => {
  assert.equal(avatarStorage?.validateAvatar(validPng(), 'image/png').extension, '.png');
  assert.equal(avatarStorage?.validateAvatar(Buffer.from([255, 216, 255, 0]), 'image/jpeg').extension, '.jpg');
  assert.equal(avatarStorage?.validateAvatar(Buffer.from('RIFFxxxxWEBP'), 'image/webp').extension, '.webp');
});

test('avatar validator rejects unsupported, mismatched, empty, and oversized files', () => {
  assert.equal(avatarStorage?.validateAvatar(validPng(), 'image/svg+xml').code, 'INVALID_AVATAR_TYPE');
  assert.equal(avatarStorage?.validateAvatar(validPng(), 'image/jpeg').code, 'INVALID_AVATAR_CONTENT');
  assert.equal(avatarStorage?.validateAvatar(Buffer.alloc(0), 'image/png').code, 'INVALID_AVATAR_CONTENT');
  assert.equal(avatarStorage?.validateAvatar(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png').code, 'AVATAR_TOO_LARGE');
});

test('stored avatar path resolver only accepts generated avatar URLs', () => {
  const directory = 'C:/app/uploads/avatars';
  assert.equal(avatarStorage?.resolveStoredAvatarPath('/api/avatars/2b931b4b-2612-4ae0-a71f-c0bdce6c3183.webp', directory), path.join(directory, '2b931b4b-2612-4ae0-a71f-c0bdce6c3183.webp'));
  assert.equal(avatarStorage?.resolveStoredAvatarPath('/api/avatars/../../.env', directory), null);
});
