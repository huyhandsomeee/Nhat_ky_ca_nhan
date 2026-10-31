const mongoose = require('mongoose');
const { REACTIONS } = require('../domain/entryInteractionRules');

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, enum: REACTIONS, required: true }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true, maxlength: 1000 },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  reactions: { type: [reactionSchema], default: [] },
  deleted: { type: Boolean, default: false },
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

commentSchema.index({ entry: 1, createdAt: 1 });
commentSchema.index({ parentComment: 1 });
module.exports = mongoose.model('Comment', commentSchema);
