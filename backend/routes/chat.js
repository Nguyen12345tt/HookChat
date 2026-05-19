const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2; 

const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

router.get('/users/:myId', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.myId } }).select('-password');
    res.json(users);
  } catch (error) { res.status(500).json({ message: "Lỗi", error }); }
});

router.post('/conversation/direct', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    let conversation = await Conversation.findOne({
      isGroup: false, participants: { $all: [senderId, receiverId] } 
    }).populate('participants', 'name avatar');

    if (conversation) return res.status(200).json(conversation);

    const newConversation = new Conversation({ participants: [senderId, receiverId], isGroup: false });
    await newConversation.save();
    const populatedConv = await Conversation.findById(newConversation._id).populate('participants', 'name avatar');
    res.status(201).json(populatedConv);
  } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

router.get('/messages/:conversationId', async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId })
      .populate('senderId', 'name avatar').sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) { res.status(500).json({ message: "Lỗi", error }); }
});

router.get('/upload-signature', (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp: timestamp, folder: 'chat_images' }, process.env.CLOUDINARY_API_SECRET
    );
    res.json({ signature, timestamp, cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY });
  } catch (error) { res.status(500).json({ message: "Lỗi" }); }
});

router.put('/users/:id/avatar', async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.params.id, { avatar: avatarUrl }, { new: true }).select('-password');
    res.json(updatedUser);
  } catch (error) { res.status(500).json({ message: "Lỗi" }); }
});

router.put('/users/:id/name', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Lỗi" });
    const updatedUser = await User.findByIdAndUpdate(req.params.id, { name: name.trim() }, { new: true }).select('-password');
    res.json(updatedUser);
  } catch (error) { res.status(500).json({ message: "Lỗi" }); }
});

router.post('/conversation/group', async (req, res) => {
  try {
    const { creatorId, groupName, participantIds } = req.body;
    const members = [...new Set([...participantIds, creatorId])];
    if (members.length < 3) return res.status(400).json({ message: "Lỗi" });
    const newGroup = new Conversation({ participants: members, isGroup: true, groupName: groupName.trim(), admins: [creatorId] });
    await newGroup.save();
    const populatedGroup = await Conversation.findById(newGroup._id).populate('participants', 'name avatar');
    res.status(201).json(populatedGroup);
  } catch (error) { res.status(500).json({ message: "Lỗi" }); }
});

router.get('/conversations/user/:userId', async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.params.userId })
    .populate('participants', 'name avatar').populate('latestMessage').sort({ updatedAt: -1 }); 
    res.json(conversations);
  } catch (error) { res.status(500).json({ message: "Lỗi" }); }
});

module.exports = router;