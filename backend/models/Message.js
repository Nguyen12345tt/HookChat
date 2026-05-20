const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 1. Phân loại tin nhắn để Frontend biết đường hiển thị
    messageType: {
      type: String,
      enum: ["text", "image", "audio", "video", "call"],
      default: "text",
    },

    // 2. Nội dung text (Dùng cho tin nhắn chữ, hoặc dùng để lưu Text được dịch từ Giọng nói)
    text: { type: String },

    // 3. Đường link file (Lấy từ Cloudinary)
    mediaUrl: { type: String },

    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 4. Ghim tin nhắn (Dùng để đánh dấu tin nhắn quan trọng, có thể hiển thị ở đầu cuộc trò chuyện)
    isPinned: { type: Boolean, default: false },

    // 5. Đã xem (Dùng để đánh dấu tin nhắn đã được người nhận xem, có thể hiển thị dấu tích hoặc thay đổi màu sắc)
    isRead: { type: Boolean, default: false },

    // 6. Thu hổi tin nhắn (Dùng để đánh dấu tin nhắn đã bị thu hồi, có thể hiển thị thông báo "Tin nhắn đã được thu hồi" thay vì nội dung gốc)
    isRecalled: { type: Boolean, default: false },

    replyTo: {
      massageId: string,
      text: string,
      senderName: string,
      messageType: string,
      mediaUrl: string,
    },

    // 🔥 THÊM DÒNG NÀY: Mảng lưu trữ cảm xúc
    reactions: [
      {
        emoji: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", MessageSchema);
