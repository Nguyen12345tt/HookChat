const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// 📦 Import Routes
const chatRoutes = require("./routes/chat");
const authRoutes = require("./routes/auth");

// 📦 Import Models
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");
const User = require("./models/User");

let onlineUsers = [];

const app = express();
const server = http.createServer(app);

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

app.use(
  cors({
    origin: ["http://localhost:3000", "https://hook-chat-three.vercel.app"],
  }),
);
app.use(express.json());

app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://hook-chat-three.vercel.app"],

    methods: ["GET", "POST", "PUT"],
  },
});

io.on("connection", (socket) => {
  socket.on("user_connected", (userId) => {
    if (!onlineUsers.some((user) => user.userId === userId)) {
      onlineUsers.push({ userId, socketId: socket.id });
    }
    io.emit(
      "get_online_users",
      onlineUsers.map((u) => u.userId),
    );
  });

  socket.on("typing", (data) =>
    socket.to(data.conversationId).emit("user_typing", data),
  );
  socket.on("stop_typing", (data) =>
    socket.to(data.conversationId).emit("user_stopped_typing", data),
  );

  socket.on("mark_as_read", async (data) => {
    const { conversationId, userId } = data;
    await Message.updateMany(
      {
        conversationId: conversationId,
        senderId: { $ne: userId },
        isRead: false,
      },
      { $set: { isRead: true } },
    );
    socket.to(conversationId).emit("messages_read", { conversationId });
  });

  socket.on("disconnect", async () => {
    const user = onlineUsers.find((u) => u.socketId === socket.id);
    if (user) {
      try {
        await User.findByIdAndUpdate(user.userId, { lastSeen: new Date() });
      } catch (error) {}
    }
    onlineUsers = onlineUsers.filter((u) => u.socketId !== socket.id);
    io.emit(
      "get_online_users",
      onlineUsers.map((u) => u.userId),
    );
  });

  socket.on("join_conversation", (conversationId) =>
    socket.join(conversationId),
  );

  socket.on("toggle_pin", async (data) => {
    const { messageId, conversationId } = data;
    try {
      const msg = await Message.findById(messageId).populate(
        "senderId",
        "name avatar",
      );
      if (msg) {
        msg.isPinned = !msg.isPinned;
        await msg.save();
        io.to(conversationId).emit("update_message", msg);
      }
    } catch (error) {}
  });

  socket.on("recall_message", async (data) => {
    const { messageId, conversationId } = data;
    try {
      await Message.findByIdAndUpdate(messageId, {
        isRecalled: true,
        text: "Tin nhắn đã thu hồi",
        mediaUrl: "",
        messageType: "text",
      });
      io.to(conversationId).emit("message_recalled", { messageId });
    } catch (error) {}
  });

  // --- THÊM ĐOẠN NÀY ĐỂ XỬ LÝ ĐỔ CHUÔNG ---
  socket.on("initiate_call", (data) => {
    // Phát tín hiệu cho toàn bộ những người dùng khác trong server
    socket.broadcast.emit("incoming_call", data);
  });

  // 🔥 THÊM SỰ KIỆN NÀY: MÁY B BÁO CHO MÁY A BIẾT LÀ ĐÃ BẤM NGHE MÁY
  socket.on("accept_call", (data) => {
    socket.broadcast.emit("call_accepted", data);
  });

  socket.on("send_message", async (data) => {
    // 🔥 Lấy thêm biến replyTo từ Frontend gửi lên
    const { conversationId, senderId, text, messageType, mediaUrl, replyTo } =
      data;
    try {
      const newMessage = new Message({
        conversationId,
        senderId,
        text,
        messageType,
        mediaUrl,
        replyTo, // 🔥 Lưu vào Database
      });
      await newMessage.save();
      await Conversation.findByIdAndUpdate(conversationId, {
        latestMessage: newMessage._id,
      });
      const populatedMsg = await Message.findById(newMessage._id).populate(
        "senderId",
        "name avatar",
      );
      io.to(conversationId).emit("receive_message", populatedMsg);
    } catch (error) {}
  });
});

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✅ Đã thông mạch Database!");
    server.listen(5000, () => console.log("🚀 Server đang chạy tại cổng 5000"));
  })
  .catch((err) => console.log("Lỗi kết nối DB:", err));
