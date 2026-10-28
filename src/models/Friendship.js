const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  users: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }], validate: (value) => value.length === 2 },
  pairKey: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

schema.index({ pairKey: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', schema);
