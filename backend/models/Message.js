const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 5000 }
}, { timestamps: true });

schema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', schema);
