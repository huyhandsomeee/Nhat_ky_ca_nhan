const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['friend_request', 'friend_accepted', 'message', 'entry_comment', 'comment_reply', 'comment_reaction', 'entry_tag'], required: true },
  reference: { type: mongoose.Schema.Types.ObjectId },
  entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry' },
  readAt: { type: Date, default: null }
}, { timestamps: true });

schema.index({ recipient: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', schema);
