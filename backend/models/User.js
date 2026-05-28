const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, index: true, unique: true, required: true },
    email: { type: String, index: true },
    name: { type: String },
    role: { type: String, enum: ['manager', 'rep'], default: 'rep', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

