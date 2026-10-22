const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  displayName: { type: String, default: '', trim: true, maxlength: 40 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
