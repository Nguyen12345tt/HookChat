const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // 1. Quản lý thành viên và tin nhắn
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },

    // 2. Nhận diện Chat Nhóm
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: "" },
    groupAvatar: { type: String, default: "" },

    // Dùng mảng admins (nhiều quản trị viên) thay vì 1 adminId như lúc nãy cho xịn!
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 3. Tùy chỉnh giao diện phòng chat (Tính năng rất hay của bạn!)
    themeColor: { type: String, default: "#0084ff" }, // Mặc định là màu xanh Messenger
    backgroundImage: { type: String, default: "" }, // Link ảnh nền
  },
  { timestamps: true },
);

module.exports = mongoose.model("Conversation", conversationSchema);
