const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
}, { timestamps: true });

schema.index({ recipient: 1, status: 1, createdAt: -1 });
schema.index({ sender: 1, recipient: 1, status: 1 });

module.exports = mongoose.model('FriendRequest', schema);
