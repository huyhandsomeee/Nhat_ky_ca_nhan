const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  visibility: { type: String, enum: ['private', 'public'], default: 'private' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

entrySchema.index({ visibility: 1, createdAt: -1 });
module.exports = mongoose.model('Entry', entrySchema);
