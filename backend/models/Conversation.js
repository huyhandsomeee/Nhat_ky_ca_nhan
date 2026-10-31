const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  users: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }], validate: (value) => value.length === 2 },
  pairKey: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'accepted'], default: 'accepted' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', schema);
