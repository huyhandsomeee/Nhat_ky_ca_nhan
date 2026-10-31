const mongoose = require('mongoose');

const entryLikeSchema = new mongoose.Schema({
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
entryLikeSchema.index({ entry: 1, user: 1 }, { unique: true });
entryLikeSchema.index({ entry: 1 });

module.exports = mongoose.model('EntryLike', entryLikeSchema);
