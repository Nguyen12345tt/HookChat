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

// --- 🤖 API TRỢ LÝ OPENAI (DỊCH & BÓC BĂNG) ---
app.post("/api/openai/translate", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Bạn là chuyên gia ngôn ngữ. Hãy dịch đoạn văn bản sau sang Tiếng Việt thật tự nhiên. Nếu nó đã là tiếng Việt, hãy sửa lỗi chính tả, viết hoa và diễn đạt lại cho mượt mà hơn. Chỉ trả về kết quả.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await response.json();
    res.json({ translatedText: data.choices[0].message.content });
  } catch (error) {
    console.error("Lỗi dịch:", error);
    res.status(500).json({ error: "Lỗi dịch thuật" });
  }
});

app.post("/api/openai/transcribe", async (req, res) => {
  try {
    const { audioUrl } = req.body;

    // 1. Tải file âm thanh từ Cloudinary về Backend
    const audioRes = await fetch(audioUrl);
    const audioBlob = await audioRes.blob();

    // 2. Gói file gửi sang OpenAI Whisper (Bắt buộc phải ép tên đuôi .webm)
    const formData = new FormData();
    formData.append("file", audioBlob, "voice.webm");
    formData.append("model", "whisper-1");

    const whisperRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      },
    );

    const data = await whisperRes.json();
    res.json({ text: data.text });
  } catch (error) {
    console.error("Lỗi Whisper:", error);
    res.status(500).json({ error: "Lỗi bóc băng" });
  }
});
// ----------------------------------------------

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

  // 🔥 LỖI Ở ĐÂY: ĐÃ THÊM LẠI BIẾN replyTo CHO BÁC
  socket.on("send_message", async (data) => {
    const { conversationId, senderId, text, messageType, mediaUrl, replyTo } =
      data;
    try {
      const newMessage = new Message({
        conversationId,
        senderId,
        text,
        messageType,
        mediaUrl,
        replyTo, // 🔥 Kẹp thông tin trả lời vào đây để DB lưu
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
    } catch (error) {
      console.log("Lỗi gửi tin nhắn:", error);
    }
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

  socket.on("initiate_call", (data) => {
    socket.broadcast.emit("incoming_call", data);
  });

  socket.on("accept_call", (data) => {
    socket.broadcast.emit("call_accepted", data);
  });

  socket.on("react_message", async (data) => {
    const { messageId, userId, emoji, conversationId } = data;
    try {
      const msg = await Message.findById(messageId).populate(
        "senderId",
        "name avatar",
      );
      if (!msg) return;
      const existingReactionIndex = msg.reactions.findIndex(
        (r) => r.userId.toString() === userId,
      );
      if (existingReactionIndex !== -1) {
        if (msg.reactions[existingReactionIndex].emoji === emoji)
          msg.reactions.splice(existingReactionIndex, 1);
        else msg.reactions[existingReactionIndex].emoji = emoji;
      } else {
        msg.reactions.push({ emoji, userId });
      }
      await msg.save();
      io.to(conversationId).emit("update_message", msg);
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
