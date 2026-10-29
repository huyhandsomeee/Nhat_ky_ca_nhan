const mongoose = require('mongoose');
const { MOODS } = require('../domain/entryRules');

const schema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  title: { type: String, default: '', trim: true, maxlength: 120 },
  content: { type: String, default: '', trim: true, maxlength: 10000 },
  journalDate: { type: String, default: '' },
  mood: { type: String, enum: [null, ...MOODS], default: null },
  tags: { type: [{ type: String, trim: true, maxlength: 30 }], default: [] },
  visibility: { type: String, enum: ['private', 'public'], default: 'private' }
}, { timestamps: true });

module.exports = mongoose.model('Draft', schema);
