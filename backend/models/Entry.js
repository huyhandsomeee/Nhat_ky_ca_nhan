const mongoose = require('mongoose');
const { MOODS } = require('../domain/entryRules');

const entrySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  journalDate: {
    type: String,
    required: true,
    validate: {
      validator: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
      message: 'Ngày nhật ký không hợp lệ.'
    }
  },
  mood: { type: String, enum: [null, ...MOODS], default: null },
  tags: { type: [{ type: String, trim: true, maxlength: 30 }], default: [] },
  taggedUsers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  visibility: { type: String, enum: ['private', 'public'], default: 'private' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

entrySchema.index({ author: 1, journalDate: -1, createdAt: -1 });
entrySchema.index({ visibility: 1, journalDate: -1, createdAt: -1 });

module.exports = mongoose.model('Entry', entrySchema);
