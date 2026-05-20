const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    avatar: {
      type: String,
      default: "https://ui-avatars.com/api/?name=User&background=random",
    },
    // 🔥 THÊM DÒNG NÀY: Lưu danh sách ID những người mà user này đã chặn
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
