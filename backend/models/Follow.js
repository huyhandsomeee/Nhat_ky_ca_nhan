const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
followSchema.index({ follower: 1, author: 1 }, { unique: true });
followSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Follow', followSchema);
