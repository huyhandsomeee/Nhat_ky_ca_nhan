const VIETNAMESE_LETTER_GROUPS = [
  'aàáảãạăằắẳẵặâầấẩẫậ',
  'eèéẻẽẹêềếểễệ',
  'iìíỉĩị',
  'oòóỏõọôồốổỗộơờớởỡợ',
  'uùúủũụưừứửữự',
  'yỳýỷỹỵ',
  'dđ'
];

function buildVietnameseSearchPattern(value) {
  return Array.from(String(value || '').normalize('NFC')).map((character) => {
    const lower = character.toLocaleLowerCase('vi-VN');
    const group = VIETNAMESE_LETTER_GROUPS.find((letters) => letters.includes(lower));
    return group ? `[${group}]` : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
}

function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = { buildVietnameseSearchPattern, escapeRegex };
