const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get("/users/:myId", async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.myId } }).select(
      "-password",
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Lỗi", error });
  }
});

router.post("/conversation/direct", async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [senderId, receiverId] },
    }).populate("participants", "name avatar");

    if (conversation) return res.status(200).json(conversation);

    const newConversation = new Conversation({
      participants: [senderId, receiverId],
      isGroup: false,
    });
    await newConversation.save();
    const populatedConv = await Conversation.findById(
      newConversation._id,
    ).populate("participants", "name avatar");
    res.status(201).json(populatedConv);
  } catch (error) {
    res.status(500).json({ message: "Lỗi Server" });
  }
});

router.get("/messages/:conversationId", async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    })
      .populate("senderId", "name avatar")
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Lỗi", error });
  }
});

router.get("/upload-signature", (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp: timestamp, folder: "chat_images" },
      process.env.CLOUDINARY_API_SECRET,
    );
    res.json({
      signature,
      timestamp,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi" });
  }
});

router.put("/users/:id/avatar", async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { avatar: avatarUrl },
      { new: true },
    ).select("-password");
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Lỗi" });
  }
});

router.put("/users/:id/name", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Lỗi" });
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true },
    ).select("-password");
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Lỗi" });
  }
});

router.post("/conversation/group", async (req, res) => {
  try {
    const { creatorId, groupName, participantIds } = req.body;
    const members = [...new Set([...participantIds, creatorId])];
    if (members.length < 3) return res.status(400).json({ message: "Lỗi" });
    const newGroup = new Conversation({
      participants: members,
      isGroup: true,
      groupName: groupName.trim(),
      admins: [creatorId],
    });
    await newGroup.save();
    const populatedGroup = await Conversation.findById(newGroup._id)
      .populate("participants", "name avatar")
      .populate("admins", "name avatar");
    res.status(201).json(populatedGroup);
  } catch (error) {
    res.status(500).json({ message: "Lỗi" });
  }
});
// ======================= QUẢN LÝ NHÓM =======================

// 1. Thêm thành viên vào nhóm (chỉ chủ nhóm hoặc admin)
router.post("/group/add-members", async (req, res) => {
  try {
    const { groupId, userIds, requesterId } = req.body;
    const conversation = await Conversation.findById(groupId);
    if (!conversation || !conversation.isGroup)
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    // Kiểm tra quyền: requesterId phải là chủ nhóm (admins[0])
    if (conversation.admins[0].toString() !== requesterId)
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thêm thành viên" });
    // Lọc những người chưa có trong nhóm
    const newMembers = userIds.filter(
      (id) => !conversation.participants.includes(id),
    );
    if (newMembers.length === 0)
      return res
        .status(400)
        .json({ message: "Không có thành viên mới để thêm" });
    conversation.participants.push(...newMembers);
    await conversation.save();
    res.json({
      message: "Thêm thành viên thành công",
      participants: conversation.participants,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
});

// 2. Xóa thành viên khỏi nhóm (chỉ chủ nhóm, không thể xóa chính mình)
router.post("/group/remove-member", async (req, res) => {
  try {
    const { groupId, memberId, requesterId } = req.body;
    const conversation = await Conversation.findById(groupId);
    if (!conversation || !conversation.isGroup)
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    if (conversation.admins[0].toString() !== requesterId)
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xóa thành viên" });
    if (memberId === requesterId)
      return res.status(400).json({
        message: "Bạn không thể tự xóa mình, hãy dùng chức năng rời nhóm",
      });
    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== memberId,
    );
    await conversation.save();
    res.json({
      message: "Xóa thành viên thành công",
      participants: conversation.participants,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
});

// 3. Rời nhóm (thành viên tự rời)
router.post("/group/leave", async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const conversation = await Conversation.findById(groupId);
    if (!conversation || !conversation.isGroup)
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    if (!conversation.participants.includes(userId))
      return res.status(400).json({ message: "Bạn không ở trong nhóm này" });
    // Nếu là chủ nhóm thì không cho rời mà phải giải tán hoặc chuyển quyền
    if (conversation.admins[0].toString() === userId) {
      return res.status(400).json({
        message: "Chủ nhóm không thể rời nhóm, hãy giải tán hoặc chuyển quyền",
      });
    }
    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== userId,
    );
    await conversation.save();
    res.json({ message: "Rời nhóm thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
});

// 4. Chuyển quyền nhóm (chủ nhóm chỉ định người khác làm chủ mới)
router.post("/group/transfer-ownership", async (req, res) => {
  try {
    const { groupId, currentOwnerId, newOwnerId } = req.body;
    const conversation = await Conversation.findById(groupId);
    if (!conversation || !conversation.isGroup)
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    if (conversation.admins[0].toString() !== currentOwnerId)
      return res.status(403).json({ message: "Bạn không phải chủ nhóm" });
    if (!conversation.participants.includes(newOwnerId))
      return res
        .status(400)
        .json({ message: "Người nhận không có trong nhóm" });
    // Cập nhật chủ nhóm: thay đổi admins[0] thành newOwnerId
    conversation.admins = [newOwnerId];
    await conversation.save();
    res.json({ message: "Chuyển quyền nhóm thành công", newOwnerId });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
});

// 5. Giải tán nhóm (chỉ chủ nhóm, xóa luôn conversation)
router.post("/group/dismiss", async (req, res) => {
  try {
    const { groupId, requesterId } = req.body;
    const conversation = await Conversation.findById(groupId);
    if (!conversation || !conversation.isGroup)
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    if (conversation.admins[0].toString() !== requesterId)
      return res.status(403).json({ message: "Bạn không phải chủ nhóm" });
    await Conversation.findByIdAndDelete(groupId);
    // Có thể xóa toàn bộ tin nhắn liên quan đến nhóm này (tuỳ chọn)
    await Message.deleteMany({ conversationId: groupId });
    res.json({ message: "Nhóm đã được giải tán" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
});

router.get("/conversations/user/:userId", async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.params.userId,
    })
      .populate("participants", "name avatar")
      .populate("admins", "name avatar") // ← THÊM DÒNG NÀY
      .populate("latestMessage")
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: "Lỗi" });
  }
});

module.exports = router;
