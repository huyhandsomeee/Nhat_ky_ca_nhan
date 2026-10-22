const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true, maxlength: 1000 },
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

commentSchema.index({ entry: 1, createdAt: 1 });
module.exports = mongoose.model('Comment', commentSchema);
