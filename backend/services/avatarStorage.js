const path = require('node:path');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

function validateAvatar(buffer, contentType) {
  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
  const extension = IMAGE_TYPES.get(normalizedType);
  if (!extension) return { code: 'INVALID_AVATAR_TYPE', message: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.' };
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { code: 'INVALID_AVATAR_CONTENT', message: 'Tệp tải lên không phải ảnh hợp lệ.' };
  }
  if (buffer.length > MAX_AVATAR_BYTES) {
    return { code: 'AVATAR_TOO_LARGE', message: 'Ảnh đại diện không được vượt quá 2 MB.' };
  }

  const validSignature = extension === '.jpg'
    ? buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : extension === '.png'
      ? buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

  return validSignature
    ? { extension }
    : { code: 'INVALID_AVATAR_CONTENT', message: 'Nội dung ảnh không khớp với định dạng tệp.' };
}

function createAvatarFilename(extension) {
  return `${randomUUID()}${extension}`;
}

function resolveStoredAvatarPath(avatarUrl, avatarDirectory) {
  const match = /^\/api\/avatars\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/i.exec(String(avatarUrl || ''));
  return match ? path.join(avatarDirectory, match[1]) : null;
}

async function removeStoredAvatar(avatarUrl, avatarDirectory) {
  const filename = resolveStoredAvatarPath(avatarUrl, avatarDirectory);
  if (!filename) return;
  try {
    await fs.unlink(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = { MAX_AVATAR_BYTES, validateAvatar, createAvatarFilename, resolveStoredAvatarPath, removeStoredAvatar };
