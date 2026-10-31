const mongoose = require('mongoose');

const savedEntrySchema = new mongoose.Schema({
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
savedEntrySchema.index({ entry: 1, user: 1 }, { unique: true });
savedEntrySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('SavedEntry', savedEntrySchema);
