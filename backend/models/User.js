const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Thời gian người dùng cuối cùng trực tuyến
  lastSeen: { type: Date, default: Date.now },
  avatar: { type: String, default: 'https://ui-avatars.com/api/?name=User&background=random' },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);