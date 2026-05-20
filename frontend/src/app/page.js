'use client';
import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import axios from 'axios';

// ==========================================
// 📦 DỮ LIỆU TĨNH (Stickers, Avatar mặc định)
// ==========================================
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => null,
});

const STICKER_PACKS = [
  {
    id: 'bear',
    icon: '🐻',
    stickers: [
      'https://media.giphy.com/media/11s7Ke7jcNxCHS/giphy.gif?type=sticker',
      'https://media.giphy.com/media/l41lVsYDBC0UVQJCE/giphy.gif?type=sticker',
      'https://media.giphy.com/media/xT0xeDCj9LhRHLsP1C/giphy.gif?type=sticker',
      'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif?type=sticker',
      'https://media.giphy.com/media/cfuL5gqFDreXxkWQ4o/giphy.gif?type=sticker',
      'https://media.giphy.com/media/3o85xwxr06YNoFdSbm/giphy.gif?type=sticker',
      'https://media.giphy.com/media/11ezOCtJ7Eetri/giphy.gif?type=sticker',
      'https://media.giphy.com/media/XG1ZvlZf4aMfe/giphy.gif?type=sticker',
    ],
  },
  {
    id: 'cat',
    icon: '🐱',
    stickers: [
      'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif?type=sticker',
      'https://media.giphy.com/media/vFKqnCdLPNOKc/giphy.gif?type=sticker',
      'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif?type=sticker',
      'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif?type=sticker',
      'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif?type=sticker',
      'https://media.giphy.com/media/C9x8gX02SnMIoAClXa/giphy.gif?type=sticker',
      'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif?type=sticker',
      'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif?type=sticker',
    ],
  },
];

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const DEFAULT_GROUP_AVATAR = 'https://cdn-icons-png.flaticon.com/512/166/166258.png';

export default function Home() {
  const router = useRouter();

  // ==========================================
  // 1️⃣ STATE: QUẢN LÝ ĐĂNG NHẬP (Auth)
  // ==========================================
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (!token || !userStr) {
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
          return;
        }

        setCurrentUser(JSON.parse(userStr));
        setIsCheckingAuth(false);
      } catch (error) {
        console.log('Lỗi đọc dữ liệu trên iPhone:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
      }
    };
    checkAuth();
  }, []);

  // ==========================================
  // 2️⃣ STATE: QUẢN LÝ DỮ LIỆU CHAT & GIAO DIỆN
  // ==========================================
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [drafts, setDrafts] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [defaultEmojiToInput, setDefaultEmojiToInput] = useState('🙂');
  const [replyingTo, setReplyingTo] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [activeReactionId, setActiveReactionId] = useState(null);
  const [popupPosition, setPopupPosition] = useState('up');

  const [onlineUsers, setOnlineUsers] = useState([]);

  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeStickerTab, setActiveStickerTab] = useState(STICKER_PACKS[0].id);

  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Quản lý Gọi điện
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const ringtoneRef = useRef(null);

  // Quản lý Modal
  const [recallModalData, setRecallModalData] = useState(null);
  const [recallOption, setRecallOption] = useState('everyone');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // 🔥 QUẢN LÝ GIAO DIỆN THÔNG BÁO & ĐỔI TÊN MỚI
  const [toast, setToast] = useState(null);
  const [showChangeNameModal, setShowChangeNameModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [mobileMenuMsg, setMobileMenuMsg] = useState(null);
  const pressTimerRef = useRef(null);
  const [translatedMessages, setTranslatedMessages] = useState({});

  // ==========================================
  // 🎤 QUẢN LÝ GHI ÂM (CHUẨN ZALO UX VÀ THUẬT TOÁN MỚI)
  // ==========================================
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioText, setAudioText] = useState('');
  const [audioMode, setAudioMode] = useState('audio'); // 'audio' | 'text'

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recognitionRef = useRef(null);

  // Biến bảo vệ thuật toán Nhấn Giữ / Bấm (Không dùng State để tránh bị trễ)
  const recordModeRef = useRef('IDLE'); // 'IDLE' | 'HOLDING' | 'LOCKED'
  const touchStartTimerRef = useRef(0);
  const audioTextRef = useRef('');
  const currentAudioModeRef = useRef('audio');

  // ==========================================
  // 3️⃣ CÁC USE_REF
  // ==========================================
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const avatarInputRef = useRef(null);

  // ==========================================
  // 4️⃣ LOGIC NHẠC CHUÔNG GỌI ĐIỆN
  // ==========================================
  useEffect(() => {
    ringtoneRef.current = new Audio(
      'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'
    );
    ringtoneRef.current.loop = true;
  }, []);

  useEffect(() => {
    if (incomingCall) {
      ringtoneRef.current?.play().catch((e) => console.log('Trình duyệt chặn AutoPlay', e));
      const timer = setTimeout(() => {
        socketRef.current.emit('send_message', {
          conversationId: incomingCall.roomId,
          senderId: incomingCall.callerId,
          text: 'missed',
          messageType: 'call',
          mediaUrl: '',
        });
        setIncomingCall(null);
      }, 45000);
      return () => clearTimeout(timer);
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [incomingCall]);

  // ==========================================
  // 5️⃣ KẾT NỐI MÁY CHỦ (SOCKET.IO)
  // ==========================================
  useEffect(() => {
    if (isCheckingAuth || !currentUser) return;

    const fetchConversationsSafe = async (userId) => {
      try {
        const res = await axios.get(
          `https://hookchat-e6ad.onrender.com/api/chat/conversations/user/${userId}`
        );
        setConversations(res.data);
      } catch (error) {}
    };

    socketRef.current = io('https://hookchat-e6ad.onrender.com');
    socketRef.current.emit('user_connected', currentUser.id);

    socketRef.current.on('get_online_users', (users) => setOnlineUsers(users));

    socketRef.current.on('receive_message', (newMsg) => {
      setMessages((prev) => {
        if (prev.find((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });
      fetchConversationsSafe(currentUser.id);

      if (newMsg.messageType === 'call') {
        if (newMsg.text === 'canceled' || newMsg.text === 'missed') {
          setIncomingCall((prev) => (prev && prev.roomId === newMsg.conversationId ? null : prev));
        }
        if (newMsg.text === 'rejected' || newMsg.text === 'missed') {
          setOutgoingCall((prev) => (prev && prev.roomId === newMsg.conversationId ? null : prev));
        }
      }
    });

    socketRef.current.on('call_accepted', (data) => {
      window.location.href = `/call/${data.roomId}?type=${data.type}`;
    });

    socketRef.current.on('messages_read', ({ conversationId }) => {
      setMessages((prev) => prev.map((msg) => ({ ...msg, isRead: true })));
    });

    socketRef.current.on('update_message', (updatedMsg) => {
      setMessages((prev) => prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)));
    });

    socketRef.current.on('message_recalled', ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? {
                ...msg,
                isRecalled: true,
                text: 'Bạn đã thu hồi tin nhắn',
                mediaUrl: '',
                messageType: 'text',
              }
            : msg
        )
      );
      fetchConversationsSafe(currentUser.id);
    });

    socketRef.current.on('user_typing', (data) => {
      if (data.senderId !== currentUser.id) setIsTyping(true);
    });
    socketRef.current.on('user_stopped_typing', (data) => {
      if (data.senderId !== currentUser.id) setIsTyping(false);
    });

    socketRef.current.on('incoming_call', (callData) => {
      if (callData.participantIds.includes(currentUser.id)) setIncomingCall(callData);
    });

    const fetchUsers = async () => {
      try {
        const res = await axios.get(
          `https://hookchat-e6ad.onrender.com/api/chat/users/${currentUser.id}`
        );
        setUsers(res.data);
      } catch (error) {}
    };

    fetchUsers();
    fetchConversationsSafe(currentUser.id);

    return () => socketRef.current.disconnect();
  }, [isCheckingAuth, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ==========================================
  // 6️⃣ CÁC HÀM XỬ LÝ SỰ KIỆN CHUNG
  // ==========================================
  const handleSelectConversation = async (conv) => {
    try {
      setActiveConversation(conv);
      setInputText(drafts[conv._id] || '');
      socketRef.current.emit('join_conversation', conv._id);

      const resMsgs = await axios.get(
        `https://hookchat-e6ad.onrender.com/api/chat/messages/${conv._id}`
      );
      setMessages(resMsgs.data);

      socketRef.current.emit('mark_as_read', { conversationId: conv._id, userId: currentUser.id });

      setShowEmojiPicker(false);
      setShowStickerPicker(false);
      setShowPinnedModal(false);
      setShowSettingsMenu(false);
      setShowAudioRecorder(false); // Reset bảng ghi âm khi đổi chat
      setReplyingTo(null);
      setOpenMenuId(null);
      setActiveReactionId(null);
      setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } catch (error) {}
  };

  const handleStartCall = (type) => {
    if (!activeConversation) return;
    const participantIds = activeConversation.participants.map((p) => p._id || p);

    let partnerName = 'Nhóm';
    let partnerAvatar = DEFAULT_GROUP_AVATAR;
    if (!activeConversation.isGroup) {
      let partner = activeConversation.participants?.find((p) => (p._id || p) !== currentUser.id);
      if (!partner) partner = activeConversation.participants?.[0];
      if (partner) {
        partnerName = partner.name;
        partnerAvatar = partner.avatar;
      }
    }

    const callData = {
      callerId: currentUser.id,
      callerName: currentUser.name,
      callerAvatar: currentUser.avatar || DEFAULT_AVATAR,
      roomId: activeConversation._id,
      type: type,
      participantIds: participantIds,
      partnerName,
      partnerAvatar,
    };

    setOutgoingCall(callData);
    socketRef.current.emit('initiate_call', callData);
  };

  const handleCreateNewChat = async () => {
    if (selectedMembers.length === 0) return alert('Vui lòng chọn bạn bè!');
    try {
      let resConv;
      if (selectedMembers.length === 1) {
        const res = await axios.post(
          'https://hookchat-e6ad.onrender.com/api/chat/conversation/direct',
          { senderId: currentUser.id, receiverId: selectedMembers[0] }
        );
        resConv = res.data;
      } else {
        if (!newGroupName.trim()) return alert('Vui lòng đặt tên cho nhóm!');
        const res = await axios.post(
          'https://hookchat-e6ad.onrender.com/api/chat/conversation/group',
          { creatorId: currentUser.id, groupName: newGroupName, participantIds: selectedMembers }
        );
        resConv = res.data;
      }
      handleSelectConversation(resConv);
      const resRefresh = await axios.get(
        `https://hookchat-e6ad.onrender.com/api/chat/conversations/user/${currentUser.id}`
      );
      setConversations(resRefresh.data);
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setSelectedMembers([]);
    } catch (error) {
      alert('Khởi tạo thất bại, vui lòng thử lại!');
    }
  };

  const handleTyping = (e) => {
    const text = e.target.value;
    setInputText(text);
    if (!activeConversation) return;
    setDrafts((prev) => ({ ...prev, [activeConversation._id]: text }));
    socketRef.current.emit('typing', {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit('stop_typing', {
        conversationId: activeConversation._id,
        senderId: currentUser.id,
      });
    }, 2000);
  };

  const getReplyData = () => {
    if (!replyingTo) return null;
    return {
      messageId: replyingTo._id,
      text: replyingTo.text,
      messageType: replyingTo.messageType,
      senderName: replyingTo.senderId?.name || 'Người dùng',
    };
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !activeConversation) return;
    socketRef.current.emit('send_message', {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: inputText,
      messageType: 'text',
      mediaUrl: '',
      replyTo: getReplyData(),
    });
    setDrafts((prev) => {
      const newDrafts = { ...prev };
      delete newDrafts[activeConversation._id];
      return newDrafts;
    });
    socketRef.current.emit('stop_typing', {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setInputText('');
    setShowEmojiPicker(false);
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleSendLike = () => {
    if (!activeConversation) return;
    socketRef.current.emit('send_message', {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: '👍',
      messageType: 'text',
      mediaUrl: '',
      replyTo: getReplyData(),
    });
    setShowEmojiPicker(false);
    setReplyingTo(null);
  };

  const handleRecallMessage = (messageId) => {
    if (!activeConversation) return;
    socketRef.current.emit('recall_message', {
      messageId: messageId,
      conversationId: activeConversation._id,
    });
    setOpenMenuId(null);
  };

  const handleChangeAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUpdatingAvatar(true);
    try {
      const sigResponse = await axios.get(
        'https://hookchat-e6ad.onrender.com/api/chat/upload-signature'
      );
      const { signature, timestamp, cloud_name, api_key } = sigResponse.data;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', api_key);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', 'chat_images');
      const uploadResponse = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        formData
      );
      const newAvatarUrl = uploadResponse.data.secure_url;
      await axios.put(
        `https://hookchat-e6ad.onrender.com/api/chat/users/${currentUser.id}/avatar`,
        { avatarUrl: newAvatarUrl }
      );
      const updatedUser = { ...currentUser, avatar: newAvatarUrl };
      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      alert('Đổi ảnh đại diện thành công! 🎉');
    } catch (error) {
      alert('Đổi ảnh thất bại, thử lại nhé!');
    } finally {
      setIsUpdatingAvatar(false);
      setShowSettingsMenu(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleOpenChangeName = () => {
    setNewNameInput(currentUser?.name || '');
    setShowChangeNameModal(true);
    setShowSettingsMenu(false);
  };

  const submitChangeName = async () => {
    if (!newNameInput.trim() || newNameInput.trim() === currentUser?.name) {
      showToast('Vui lòng nhập tên mới khác tên hiện tại!', 'error');
      return;
    }
    try {
      const response = await axios.put(
        `https://hookchat-e6ad.onrender.com/api/chat/users/${currentUser.id}/name`,
        { name: newNameInput.trim() }
      );
      const updatedUser = { ...currentUser, name: response.data.name };
      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      showToast('Đổi tên hiển thị thành công!', 'success');
      setShowChangeNameModal(false);
    } catch (error) {
      showToast('Đổi tên thất bại, vui lòng thử lại!', 'error');
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeConversation) return;
    setIsUploading(true);
    try {
      const sigResponse = await axios.get(
        'https://hookchat-e6ad.onrender.com/api/chat/upload-signature'
      );
      const { signature, timestamp, cloud_name, api_key } = sigResponse.data;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', api_key);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', 'chat_images');
      const uploadResponse = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        formData
      );
      socketRef.current.emit('send_message', {
        conversationId: activeConversation._id,
        senderId: currentUser.id,
        text: 'Đã gửi một ảnh',
        messageType: 'image',
        mediaUrl: uploadResponse.data.secure_url,
        replyTo: getReplyData(),
      });
      setReplyingTo(null);
    } catch (error) {
      alert('Up ảnh thất bại!');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendSticker = (stickerUrl) => {
    if (!activeConversation) return;
    socketRef.current.emit('send_message', {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: 'Đã gửi một nhãn dán',
      messageType: 'image',
      mediaUrl: stickerUrl,
      replyTo: getReplyData(),
    });
    setShowStickerPicker(false);
    setReplyingTo(null);
  };

  const handleTranslate = async (msg) => {
    // BÓC BĂNG GHI ÂM SAU KHI BẤM NÚT (CHUẨN ZALO)
    const handleTranscribeAudio = async (msg) => {
      if (translatedMessages[msg._id]) return; // Nếu dịch rồi thì thôi
      try {
        // Mượn tạm State Loading để UX mượt hơn (hoặc bác có thể tự tạo State riêng)
        setTranslatedMessages((prev) => ({ ...prev, [msg._id]: '⏳ Đang bóc băng...' }));

        const whisperRes = await axios.post(
          'https://hookchat-e6ad.onrender.com/api/openai/transcribe',
          {
            audioUrl: msg.mediaUrl,
          }
        );

        if (whisperRes.data.text) {
          setTranslatedMessages((prev) => ({ ...prev, [msg._id]: whisperRes.data.text }));
        } else {
          setTranslatedMessages((prev) => ({
            ...prev,
            [msg._id]: 'Không nhận diện được giọng nói.',
          }));
        }
      } catch (error) {
        setTranslatedMessages((prev) => ({ ...prev, [msg._id]: '❌ Lỗi bóc băng!' }));
      }
    };
    if (translatedMessages[msg._id]) return;
    try {
      const response = await axios.post('https://hookchat-e6ad.onrender.com/api/openai/translate', {
        text: msg.text,
      });
      setTranslatedMessages((prev) => ({ ...prev, [msg._id]: response.data.translatedText }));
    } catch (error) {
      alert('Lỗi kết nối máy chủ dịch thuật!');
    }
  };

  // KHI BẮT ĐẦU CHẠM TAY VÀO NÚT MICRO
  const handlePressStart = (e) => {
    if (recordModeRef.current === 'LOCKED') {
      // Nếu nó đang khóa thu âm từ trước, bấm cái nữa là GỬI
      finishAndSendRecording();
      return;
    }

    if (recordModeRef.current === 'IDLE') {
      recordModeRef.current = 'HOLDING';
      touchStartTimerRef.current = Date.now();
      currentAudioModeRef.current = audioMode;

      // 🔥 CHỐT CHẶN 1: Dọn sạch mọi bộ đếm cũ ngay khi vừa chạm tay
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);

      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Nếu người dùng đã thả tay ra trước khi lấy được quyền Mic thì hủy luôn
      if (recordModeRef.current === 'IDLE') {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // 🔥 CHỐT CHẶN 2: Ép tắt cái Micro cũ nếu bị lỗi bấm đúp (chạm 2 lần)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // KHI DỪNG GHI ÂM SẼ TỰ ĐỘNG CHẠY VÀO ĐÂY ĐỂ GỬI LUÔN
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        let finalText = audioTextRef.current;
        if (recognitionRef.current) recognitionRef.current.stop();

        // 1. Nếu đang chọn Tab "Gửi chữ" (Gửi dạng văn bản)
        if (currentAudioModeRef.current === 'text') {
          if (finalText.trim()) {
            // 🔥 NÓI XONG -> CHÈN VÀO KHUNG NHẬP CHỮ, KHÔNG GỬI TỰ ĐỘNG!
            setInputText((prev) => (prev ? prev + ' ' + finalText.trim() : finalText.trim()));
            // Đóng bảng ghi âm để người dùng thấy ô chữ và tự bấm Gửi
            setShowAudioRecorder(false);
            setTimeout(() => inputRef.current?.focus(), 100);
          }
          setAudioText('');
        }
        // 2. Nếu đang chọn Tab "Gửi âm thanh"
        else {
          // Gửi file ghi âm đi luôn
          await handleUploadAndSendAudio(audioBlob);
          setShowAudioRecorder(false);
          setReplyingTo(null);
        }
      };

      // Bật bộ Dịch Live (Web Speech API)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'vi-VN';
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setAudioText(currentTranscript);
          audioTextRef.current = currentTranscript; // Cập nhật vào Ref để hàm onstop gọi
        };
        recognitionRef.current.start();
      }

      mediaRecorder.start();
      setIsRecording(true);

      // 🔥 CHỐT CHẶN 3: Đảm bảo chém đứt bộ đếm lần cuối trước khi tạo cái mới
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
      audioTextRef.current = '';

      // Bắt đầu đếm giây
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      recordModeRef.current = 'IDLE';
      setIsRecording(false);
      alert('Vui lòng cấp quyền Micro trên trình duyệt để ghi âm nhé!');
    }
  };

  // KHI THẢ TAY RA KHỎI NÚT MICRO
  const handlePressEnd = (e) => {
    if (recordModeRef.current === 'HOLDING') {
      const duration = Date.now() - touchStartTimerRef.current;
      if (duration < 400) {
        // Tốc độ nhả tay cực nhanh -> Chuyển sang chế độ Khóa màn hình (Tap Mode)
        recordModeRef.current = 'LOCKED';
        setRecordingTime((prev) => prev); // Ép render lại giao diện
      } else {
        // Nhấn giữ đã lâu xong thả ra -> Kết thúc và Gửi luôn
        finishAndSendRecording();
      }
    }
  };

  // HÀM ÉP KẾT THÚC VÀ GỬI (ĐÁNH THỨC SỰ KIỆN onStop Ở TRÊN)
  const finishAndSendRecording = () => {
    recordModeRef.current = 'IDLE';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // Chạy lệnh stop -> Đánh thức hàm mediaRecorder.onstop
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  // HÀM HỦY BỎ (GỠ BỎ BẢN GHI, KHÔNG GỬI)
  const cancelRecordingLocal = () => {
    recordModeRef.current = 'IDLE';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Ghi đè hàm onstop bằng hàm rỗng để không bị gửi đi
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    setAudioText('');
    audioTextRef.current = '';
  };

  // Hàm Up Cloudinary và Whisper gốc của bác (Chỉ điều chỉnh truyền biến)
  const handleUploadAndSendAudio = async (audioBlob) => {
    setIsUploading(true);
    try {
      const sigResponse = await axios.get(
        'https://hookchat-e6ad.onrender.com/api/chat/upload-signature'
      );
      const { signature, timestamp, cloud_name, api_key } = sigResponse.data;

      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append('file', audioBlob);
      cloudinaryFormData.append('api_key', api_key);
      cloudinaryFormData.append('timestamp', timestamp);
      cloudinaryFormData.append('signature', signature);
      cloudinaryFormData.append('folder', 'chat_audio');

      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
        cloudinaryFormData
      );

      // GỬI LÊN CHAT LUÔN MÀ KHÔNG CẦN CHỜ WHISPER
      socketRef.current.emit('send_message', {
        conversationId: activeConversation._id,
        senderId: currentUser.id,
        text: '🎤 Đã gửi một tin nhắn thoại',
        messageType: 'audio',
        mediaUrl: uploadRes.data.secure_url,
        replyTo: getReplyData(),
      });
    } catch (error) {
      alert('Gửi ghi âm thất bại!');
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // CÁC HÀM UI KHÁC
  // ==========================================
  const handleScrollToMessage = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('animate-pulse', 'bg-[#3a3b3c]/50');
      setTimeout(() => {
        element.classList.remove('animate-pulse', 'bg-[#3a3b3c]/50');
      }, 1500);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const formatLastActive = (lastSeenDate) => {
    const targetDate = lastSeenDate ? new Date(lastSeenDate) : new Date(Date.now() - 5 * 60000);
    const now = new Date();
    const diffMs = now - targetDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 1) return 'Vừa mới truy cập';
    if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;
    if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
    return null;
  };

  if (isCheckingAuth || !currentUser)
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-[#242526] text-[#b0b3b8]'>
        <p className='mb-4 animate-pulse'>Đang tải dữ liệu...</p>

        <a href='/login' className='rounded-lg bg-[#0084ff] px-5 py-2 font-semibold text-white'>
          Đăng nhập để tiếp tục
        </a>
      </div>
    );

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const latestPinnedMsg =
    pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  return (
    <div className='dark'>
      {/* --- 🔥 TOAST THÔNG BÁO NỔI GÓC PHẢI TRÊN 🔥 --- */}
      {toast && (
        <div className='animate-in slide-in-from-right-8 fade-in fixed top-6 right-4 z-[9999] flex duration-300'>
          <div className='flex items-center gap-3 rounded-xl border border-gray-700 bg-[#242526] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'>
            {toast.type === 'success' ? (
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500'>
                <svg
                  className='h-5 w-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={3}
                >
                  <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                </svg>
              </div>
            ) : (
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-500'>
                <svg
                  className='h-5 w-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={3}
                >
                  <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </div>
            )}
            <span className='text-[14px] font-medium text-[#e4e6eb]'>{toast.message}</span>
          </div>
        </div>
      )}

      {/* --- 🔥 MODAL ĐỔI TÊN NGƯỜI DÙNG 🔥 --- */}
      {showChangeNameModal && (
        <div className='absolute inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity'>
          <div
            className='animate-in zoom-in-95 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#242526] shadow-2xl'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative flex items-center justify-center border-b border-gray-700 p-4'>
              <h2 className='text-[18px] font-bold text-[#e4e6eb]'>Đổi tên hiển thị</h2>
              <button
                onClick={() => setShowChangeNameModal(false)}
                className='absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#3a3b3c] text-[#b0b3b8] transition hover:bg-[#4e4f50] hover:text-white'
              >
                ✕
              </button>
            </div>
            <div className='p-5'>
              <p className='mb-3 text-[14px] text-[#b0b3b8]'>
                Tên này sẽ hiển thị với bạn bè của bạn trong các cuộc trò chuyện.
              </p>
              <input
                type='text'
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                placeholder='Nhập tên mới...'
                autoFocus
                className='w-full rounded-xl bg-[#3a3b3c] p-3 text-[15px] text-[#e4e6eb] outline-none focus:ring-2 focus:ring-[#0084ff]'
              />
            </div>
            <div className='flex justify-end gap-3 border-t border-gray-700 bg-[#242526] p-4'>
              <button
                onClick={() => setShowChangeNameModal(false)}
                className='rounded-xl px-5 py-2 font-semibold text-[#b0b3b8] transition hover:bg-[#3a3b3c]'
              >
                Hủy
              </button>
              <button
                onClick={submitChangeName}
                className='rounded-xl bg-[#0084ff] px-6 py-2 font-semibold text-white shadow-md transition hover:bg-[#0073e6]'
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className='relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#242526] font-sans text-[#e4e6eb] md:flex-row'
        onClick={() => {
          setOpenMenuId(null);
          setActiveReactionId(null);
          setShowEmojiPicker(false);
          setShowStickerPicker(false);
          setShowSettingsMenu(false);
        }}
      >
        {/* ==================================================== */}
        {/* 🚀 CÁC HỘP THOẠI (MODAL) NỔI LÊN TOÀN MÀN HÌNH 🚀 */}
        {/* ==================================================== */}

        {incomingCall && (
          <div className='absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity'>
            <div className='animate-in zoom-in-95 flex w-[340px] flex-col items-center rounded-2xl border border-gray-700 bg-[#242526] p-8 shadow-[0_0_40px_rgba(0,132,255,0.3)]'>
              <div className='relative mb-4 h-24 w-24'>
                <div className='absolute inset-0 animate-ping rounded-full bg-[#0084ff] opacity-30'></div>
                <img
                  src={incomingCall.callerAvatar}
                  alt='Caller'
                  className='relative z-10 h-full w-full rounded-full border-4 border-[#242526] object-cover shadow-lg'
                />
              </div>
              <h2 className='mb-1 text-2xl font-bold text-white'>{incomingCall.callerName}</h2>
              <p className='mb-8 text-[#b0b3b8]'>
                Đang gọi {incomingCall.type === 'video' ? 'Video 🎥' : 'Thoại 📞'} cho bạn...
              </p>
              <div className='flex w-full justify-between gap-4 px-4'>
                <button
                  onClick={() => {
                    socketRef.current.emit('send_message', {
                      conversationId: incomingCall.roomId,
                      senderId: incomingCall.callerId,
                      text: 'rejected',
                      messageType: 'call',
                      mediaUrl: '',
                    });
                    setIncomingCall(null);
                  }}
                  className='group flex flex-1 flex-col items-center gap-2'
                >
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-[#ff3b30] shadow-lg transition-transform group-hover:bg-[#ff1a1a] hover:scale-110'>
                    <span className='rotate-[135deg] text-2xl text-white'>📞</span>
                  </div>
                  <span className='text-sm font-medium text-gray-300'>Từ chối</span>
                </button>
                <button
                  onClick={() => {
                    socketRef.current.emit('accept_call', {
                      roomId: incomingCall.roomId,
                      participantIds: incomingCall.participantIds,
                      type: incomingCall.type,
                    });
                    setIncomingCall(null);
                    window.location.href = `/call/${incomingCall.roomId}?type=${incomingCall.type}`;
                  }}
                  className='group flex flex-1 flex-col items-center gap-2'
                >
                  <div className='flex h-14 w-14 animate-bounce items-center justify-center rounded-full bg-[#34c759] shadow-lg transition-transform group-hover:bg-[#30d158] hover:scale-110'>
                    <span className='text-2xl text-white'>📞</span>
                  </div>
                  <span className='text-sm font-medium text-gray-300'>Nghe máy</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {outgoingCall && (
          <div className='absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity'>
            <div className='animate-in zoom-in-95 flex w-[340px] flex-col items-center rounded-2xl border border-gray-700 bg-[#242526] p-8 shadow-[0_0_40px_rgba(0,132,255,0.3)]'>
              <div className='relative mb-4 h-24 w-24'>
                <div className='absolute inset-0 animate-pulse rounded-full bg-[#34c759] opacity-30'></div>
                <img
                  src={outgoingCall.partnerAvatar}
                  alt='Partner'
                  className='relative z-10 h-full w-full rounded-full border-4 border-[#242526] object-cover shadow-lg'
                />
              </div>
              <h2 className='mb-1 text-2xl font-bold text-white'>{outgoingCall.partnerName}</h2>
              <p className='mb-8 text-[#b0b3b8]'>
                Đang gọi {outgoingCall.type === 'video' ? 'Video 🎥' : 'Thoại 📞'}...
              </p>
              <button
                onClick={() => {
                  socketRef.current.emit('send_message', {
                    conversationId: outgoingCall.roomId,
                    senderId: currentUser.id,
                    text: 'canceled',
                    messageType: 'call',
                    mediaUrl: '',
                  });
                  setOutgoingCall(null);
                }}
                className='group flex flex-col items-center gap-2'
              >
                <div className='flex h-14 w-14 items-center justify-center rounded-full bg-[#ff3b30] shadow-lg transition-transform group-hover:bg-[#ff1a1a] hover:scale-110'>
                  <span className='rotate-[135deg] text-2xl text-white'>📞</span>
                </div>
                <span className='text-sm font-medium text-gray-300'>Hủy</span>
              </button>
            </div>
          </div>
        )}

        {showCreateGroupModal && (
          <div className='absolute inset-0 z-[100] flex items-center justify-center bg-black/60 transition-opacity'>
            <div
              className='animate-in zoom-in-95 flex w-[420px] flex-col overflow-hidden rounded-xl border border-gray-700 bg-[#242526] shadow-2xl'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='relative flex items-center justify-between border-b border-gray-700 p-4'>
                <h2 className='w-full text-center text-[20px] font-bold text-[#e4e6eb]'>
                  Tạo tin nhắn mới
                </h2>
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className='absolute right-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3b3c] text-[#b0b3b8] transition hover:bg-[#4e4f50]'
                >
                  ✕
                </button>
              </div>
              <div className='flex flex-col gap-4 p-4'>
                {selectedMembers.length >= 2 && (
                  <input
                    type='text'
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder='Nhập tên nhóm...'
                    className='w-full rounded-lg bg-[#3a3b3c] p-3 text-[15px] text-[#e4e6eb] outline-none'
                  />
                )}
                <div>
                  <h3 className='mt-2 mb-2 text-[14px] font-semibold text-[#b0b3b8]'>
                    Chọn bạn bè để bắt đầu
                  </h3>
                  <div className='flex max-h-[200px] flex-col gap-1 overflow-y-auto pr-2'>
                    {users.map((user) => (
                      <label
                        key={user._id}
                        className='flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-[#3a3b3c]'
                      >
                        <input
                          type='checkbox'
                          className='h-5 w-5 cursor-pointer rounded-sm accent-[#0084ff]'
                          checked={selectedMembers.includes(user._id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMembers((prev) => [...prev, user._id]);
                            else setSelectedMembers((prev) => prev.filter((id) => id !== user._id));
                          }}
                        />
                        <div className='h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-600'>
                          <img src={user.avatar || DEFAULT_AVATAR} alt={user.name} />
                        </div>
                        <span className='font-medium text-[#e4e6eb]'>{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className='flex justify-end gap-2 border-t border-gray-700 bg-[#242526] p-4'>
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className='rounded-lg px-5 py-2 font-semibold text-[#e4e6eb] transition hover:bg-[#3a3b3c]'
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreateNewChat}
                  disabled={selectedMembers.length === 0}
                  className='rounded-lg bg-[#0084ff] px-6 py-2 font-semibold text-white transition hover:bg-[#0073e6] disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {selectedMembers.length > 1 ? 'Tạo Nhóm' : 'Chat'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPinnedModal && (
          <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity'>
            <div
              className='animate-in zoom-in-95 flex max-h-[80vh] w-[480px] flex-col rounded-xl border border-gray-700 bg-[#242526] shadow-2xl'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='relative flex items-center justify-between border-b border-gray-700 p-4'>
                <h2 className='w-full text-center text-[20px] font-bold text-[#e4e6eb]'>
                  Tin nhắn đã ghim
                </h2>
                <button
                  onClick={() => setShowPinnedModal(false)}
                  className='absolute right-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3b3c] text-[#b0b3b8] transition hover:bg-[#4e4f50]'
                >
                  ✕
                </button>
              </div>
              <div className='flex-1 overflow-y-auto p-2'>
                {pinnedMessages.length === 0 ? (
                  <div className='p-6 text-center text-[#b0b3b8]'>
                    Chưa có tin nhắn nào được ghim.
                  </div>
                ) : (
                  pinnedMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        handleScrollToMessage(msg._id);
                        setShowPinnedModal(false);
                      }}
                      className='group relative flex cursor-pointer items-center gap-3 rounded-xl p-3 transition hover:bg-[#3a3b3c]/50'
                    >
                      <div className='h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gray-600'>
                        <img src={msg.senderId?.avatar || DEFAULT_AVATAR} alt='Avatar' />
                      </div>
                      <div className='flex flex-1 flex-col overflow-hidden pr-12'>
                        <div className='flex items-center gap-2'>
                          <span className='text-[15px] font-semibold text-[#e4e6eb]'>
                            {msg.senderId?._id === currentUser.id ? 'Bạn' : msg.senderId?.name}
                          </span>
                          <span className='text-[12px] text-[#b0b3b8]'>
                            {new Date(msg.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <span className='mt-0.5 truncate text-[14px] text-[#b0b3b8]'>
                          {msg.messageType === 'image'
                            ? msg.mediaUrl?.includes('?type=sticker')
                              ? '🧸 Nhãn dán'
                              : '🖼️ Hình ảnh'
                            : msg.messageType === 'audio'
                              ? '🎤 Ghi âm thoại'
                              : msg.text}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          socketRef.current.emit('toggle_pin', {
                            messageId: msg._id,
                            conversationId: activeConversation._id,
                          });
                        }}
                        className='absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#242526] text-[#b0b3b8] opacity-0 shadow-md transition-all group-hover:opacity-100 hover:bg-[#4e4f50] hover:text-[#ff3b30]'
                        title='Bỏ ghim'
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {recallModalData && (
          <div className='absolute inset-0 z-[100] flex items-center justify-center bg-black/60 transition-opacity'>
            <div
              className='animate-in zoom-in-95 flex w-[420px] flex-col rounded-xl border border-gray-700 bg-[#242526] shadow-2xl'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='relative flex items-center justify-between border-b border-gray-700 p-4'>
                <h2 className='w-full text-left text-[20px] font-bold text-[#e4e6eb]'>
                  Bạn muốn thu hồi tin nhắn này ở phía ai?
                </h2>
                <button
                  onClick={() => setRecallModalData(null)}
                  className='absolute right-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3b3c] text-[#b0b3b8] transition hover:bg-[#4e4f50]'
                >
                  ✕
                </button>
              </div>
              <div className='flex flex-col gap-5 p-4'>
                {(recallModalData.senderId?._id === currentUser.id ||
                  recallModalData.senderId === currentUser.id) && (
                  <label className='group flex cursor-pointer items-start gap-3'>
                    <input
                      type='radio'
                      value='everyone'
                      checked={recallOption === 'everyone'}
                      onChange={() => setRecallOption('everyone')}
                      className='mt-1.5 h-5 w-5 shrink-0 cursor-pointer accent-[#0084ff]'
                    />
                    <span className='text-[15px] font-semibold text-[#e4e6eb]'>
                      Thu hồi với mọi người
                    </span>
                  </label>
                )}
                <label className='group flex cursor-pointer items-start gap-3'>
                  <input
                    type='radio'
                    value='only_me'
                    checked={recallOption === 'only_me'}
                    onChange={() => setRecallOption('only_me')}
                    className='mt-1.5 h-5 w-5 shrink-0 cursor-pointer accent-[#0084ff]'
                  />
                  <span className='text-[15px] font-semibold text-[#e4e6eb]'>Thu hồi với bạn</span>
                </label>
              </div>
              <div className='mt-2 flex justify-end gap-2 p-4'>
                <button
                  onClick={() => setRecallModalData(null)}
                  className='rounded-lg px-5 py-2 font-semibold text-[#0084ff] transition hover:bg-[#3a3b3c]'
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (recallOption === 'everyone') handleRecallMessage(recallModalData._id);
                    else setMessages((prev) => prev.filter((m) => m._id !== recallModalData._id));
                    setRecallModalData(null);
                  }}
                  className='rounded-lg bg-[#0084ff] px-6 py-2 font-semibold text-white transition hover:bg-[#0073e6]'
                >
                  Gỡ
                </button>
              </div>
            </div>
          </div>
        )}

        {mobileMenuMsg && (
          <div
            className='fixed inset-0 z-[300] flex flex-col justify-end bg-black/70 backdrop-blur-sm transition-opacity md:hidden'
            onClick={() => setMobileMenuMsg(null)}
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className='animate-in slide-in-from-bottom-8 mx-4 mb-3 flex justify-between rounded-full bg-[#242526] px-5 py-3.5 shadow-[0_0_30px_rgba(0,0,0,0.6)]'>
              {['❤️', '😆', '😮', '😢', '😡', '👍'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    socketRef.current.emit('react_message', {
                      messageId: mobileMenuMsg._id,
                      userId: currentUser.id,
                      emoji: emoji,
                      conversationId: activeConversation._id,
                    });
                    setMobileMenuMsg(null);
                  }}
                  className='text-[32px] transition-transform active:scale-125'
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div
              className='animate-in slide-in-from-bottom-full flex w-full flex-wrap justify-around gap-y-4 rounded-t-3xl bg-[#242526] pt-5 pb-8 shadow-2xl'
              onClick={(e) => e.stopPropagation()}
            >
              {mobileMenuMsg.messageType !== 'call' && (
                <button
                  onClick={() => {
                    setReplyingTo(mobileMenuMsg);
                    setMobileMenuMsg(null);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className='flex flex-col items-center gap-2.5 px-2'
                >
                  <div className='flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#3a3b3c] text-xl text-[#e4e6eb] active:bg-[#4e4f50]'>
                    ↩️
                  </div>
                  <span className='text-[13px] font-medium text-[#e4e6eb]'>Trả lời</span>
                </button>
              )}
              {mobileMenuMsg.messageType === 'text' && (
                <button
                  onClick={() => {
                    handleTranslate(mobileMenuMsg);
                    setMobileMenuMsg(null);
                  }}
                  className='flex flex-col items-center gap-2.5 px-2'
                >
                  <div className='flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#3a3b3c] text-[18px] font-bold text-[#e4e6eb] active:bg-[#4e4f50]'>
                    A/文
                  </div>
                  <span className='text-[13px] font-medium text-[#e4e6eb]'>Dịch</span>
                </button>
              )}
              {mobileMenuMsg.messageType === 'text' && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mobileMenuMsg.text);
                    setMobileMenuMsg(null);
                    alert('Đã sao chép vào khay nhớ tạm!');
                  }}
                  className='flex flex-col items-center gap-2.5 px-2'
                >
                  <div className='flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#3a3b3c] text-xl text-[#e4e6eb] active:bg-[#4e4f50]'>
                    📋
                  </div>
                  <span className='text-[13px] font-medium text-[#e4e6eb]'>Sao chép</span>
                </button>
              )}
              {mobileMenuMsg.messageType !== 'call' && (
                <button
                  onClick={() => {
                    socketRef.current.emit('toggle_pin', {
                      messageId: mobileMenuMsg._id,
                      conversationId: activeConversation._id,
                    });
                    setMobileMenuMsg(null);
                  }}
                  className='flex flex-col items-center gap-2.5 px-2'
                >
                  <div className='flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#3a3b3c] text-xl text-[#e4e6eb] active:bg-[#4e4f50]'>
                    📌
                  </div>
                  <span className='text-[13px] font-medium text-[#e4e6eb]'>
                    {mobileMenuMsg.isPinned ? 'Bỏ ghim' : 'Ghim'}
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setRecallModalData(mobileMenuMsg);
                  setRecallOption(
                    mobileMenuMsg.senderId?._id === currentUser.id ||
                      mobileMenuMsg.senderId === currentUser.id
                      ? 'everyone'
                      : 'only_me'
                  );
                  setMobileMenuMsg(null);
                }}
                className='flex flex-col items-center gap-2.5 px-2'
              >
                <div className='flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#3a3b3c] text-[22px] text-[#e4e6eb] active:bg-[#4e4f50]'>
                  ⋮
                </div>
                <span className='text-[13px] font-medium text-[#e4e6eb]'>Khác</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 📚 CỘT 1: DANH SÁCH BẠN BÈ & NHÓM CHAT */}
        {/* ==================================================== */}
        <div
          className={`relative z-10 w-full flex-1 shrink-0 flex-col border-r border-gray-700 bg-[#242526] md:w-[360px] md:flex-none ${activeConversation ? 'hidden md:flex' : 'flex'}`}
        >
          <div className='border-b border-gray-700/50 p-4 pb-3'>
            <div className='mb-4 flex items-center justify-between'>
              <h1 className='text-2xl font-bold'>Đoạn chat</h1>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreateGroupModal(true);
                }}
                className='flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3b3c] text-[15px] transition hover:bg-[#4e4f50]'
              >
                ✏️
              </button>
            </div>
            <input
              type='text'
              placeholder='Tìm kiếm trên Messenger'
              className='w-full rounded-full bg-[#3a3b3c] p-2 px-4 text-sm outline-none'
            />
          </div>
          <div className='flex-1 overflow-y-auto'>
            {conversations.length === 0 && (
              <p className='mt-4 text-center text-sm text-gray-500'>
                Chưa có đoạn chat nào, hãy bấm ✏️ để bắt đầu!
              </p>
            )}
            {conversations.map((conv) => {
              const isGroup = conv.isGroup;
              let name = 'Người dùng';
              let avatar = DEFAULT_AVATAR;
              let isOnline = false;
              if (isGroup) {
                name = conv.groupName || 'Nhóm không tên';
                avatar = conv.groupAvatar || DEFAULT_GROUP_AVATAR;
              } else {
                let partner = conv.participants?.find((p) => (p._id || p) !== currentUser.id);
                if (!partner) partner = conv.participants?.[0];
                if (partner) {
                  name = partner.name || 'Người dùng';
                  avatar = partner.avatar || DEFAULT_AVATAR;
                  isOnline = onlineUsers.includes(partner._id || partner);
                }
              }
              return (
                <div
                  key={conv._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectConversation(conv);
                  }}
                  className={`flex cursor-pointer items-center px-4 py-3 transition ${activeConversation?._id === conv._id ? 'bg-[#3a3b3c]' : 'hover:bg-[#3a3b3c]/50'}`}
                >
                  <div className='relative h-14 w-14 shrink-0'>
                    <div className='flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gray-600'>
                      <img src={avatar} alt='Avatar' className='h-full w-full object-cover' />
                    </div>
                    {isOnline && !isGroup && (
                      <div className='absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-[#242526] bg-green-500'></div>
                    )}
                  </div>
                  <div className='ml-3 flex-1 overflow-hidden'>
                    <h3 className='truncate text-[15px] font-semibold'>{name}</h3>
                    {(() => {
                      const draftText = drafts[conv._id];
                      if (draftText && draftText.trim() !== '')
                        return (
                          <p className='truncate text-[13px] font-medium text-[#ff3040]'>
                            Bản nháp: {draftText}
                          </p>
                        );
                      let messagePreview = 'Nhấn để chat ngay';
                      if (conv.latestMessage) {
                        const isMine =
                          conv.latestMessage.senderId?._id === currentUser.id ||
                          conv.latestMessage.senderId === currentUser.id;
                        const realSenderId =
                          conv.latestMessage.senderId?._id || conv.latestMessage.senderId;
                        const senderObj = conv.participants?.find((p) => p._id === realSenderId);
                        const senderNameParts = senderObj?.name?.split(' ') || [];
                        const shortName = senderNameParts[senderNameParts.length - 1] || 'Ai đó';
                        const prefix = isMine ? 'Bạn' : shortName;
                        let content = '';
                        if (conv.latestMessage.isRecalled) content = 'Đã thu hồi một tin nhắn';
                        else if (conv.latestMessage.messageType === 'image')
                          content = conv.latestMessage.mediaUrl?.includes('sticker')
                            ? 'đã gửi nhãn dán'
                            : 'đã gửi một ảnh';
                        else if (conv.latestMessage.messageType === 'audio')
                          content = '🎤 Ghi âm thoại';
                        else content = conv.latestMessage.text;
                        messagePreview = conv.isGroup
                          ? `${prefix}: ${content}`
                          : isMine
                            ? `Bạn: ${content}`
                            : content;
                      }
                      const isUnread =
                        conv.latestMessage?.isRead === false &&
                        conv.latestMessage?.senderId?._id !== currentUser.id &&
                        conv.latestMessage?.senderId !== currentUser.id;
                      return (
                        <p
                          className={`truncate text-[13px] ${isUnread ? 'font-bold text-[#e4e6eb]' : 'text-[#b0b3b8]'}`}
                        >
                          {messagePreview}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 💬 CỘT 2: KHUNG CHAT CHÍNH */}
        {/* ==================================================== */}
        <div
          className={`relative flex min-h-0 w-full min-w-0 flex-1 flex-col bg-[#242526] ${!activeConversation ? 'hidden md:flex' : 'flex'}`}
        >
          {activeConversation ? (
            <>
              {(() => {
                let headerName = 'Đang tải...';
                let headerAvatar = DEFAULT_AVATAR;
                let headerSubText = '';
                let showOnlineDot = false;
                if (activeConversation) {
                  if (activeConversation.isGroup) {
                    headerName = activeConversation.groupName || 'Nhóm';
                    headerAvatar = activeConversation.groupAvatar || DEFAULT_GROUP_AVATAR;
                    headerSubText = `${activeConversation.participants?.length || 0} thành viên`;
                  } else {
                    let partner = activeConversation.participants?.find(
                      (p) => (p._id || p) !== currentUser.id
                    );
                    if (!partner) partner = activeConversation.participants?.[0];
                    if (partner) {
                      headerName = partner.name || 'Người dùng';
                      headerAvatar = partner.avatar || DEFAULT_AVATAR;
                      showOnlineDot = onlineUsers.includes(partner._id || partner);
                      headerSubText = showOnlineDot
                        ? 'Đang hoạt động'
                        : partner.lastSeen
                          ? formatLastActive(partner.lastSeen)
                          : '';
                    }
                  }
                }
                return (
                  <div className='z-10 flex h-[68px] shrink-0 items-center justify-between border-b border-gray-700 bg-[#242526] px-4 shadow-sm'>
                    <div className='flex items-center'>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveConversation(null);
                        }}
                        className='mr-2 flex h-8 w-8 items-center justify-center rounded-full text-xl text-[#b0b3b8] transition hover:bg-[#3a3b3c] md:hidden'
                      >
                        ❮
                      </button>
                      <div className='relative h-10 w-10 shrink-0'>
                        <img
                          src={headerAvatar}
                          alt='Partner'
                          className='h-full w-full rounded-full bg-gray-600 object-cover'
                        />
                        {showOnlineDot && (
                          <div className='absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[#242526] bg-green-500'></div>
                        )}
                      </div>
                      <div className='ml-3'>
                        <h2 className='text-[15px] font-semibold'>{headerName}</h2>
                        <p className='text-[12px] text-[#b0b3b8]'>{headerSubText}</p>
                      </div>
                    </div>
                    <div className='flex items-center gap-2 text-[#0084ff]'>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCall('voice');
                        }}
                        className='flex h-9 w-9 items-center justify-center rounded-full text-[18px] transition hover:bg-[#3a3b3c]'
                      >
                        📞
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCall('video');
                        }}
                        className='flex h-9 w-9 items-center justify-center rounded-full text-[18px] transition hover:bg-[#3a3b3c]'
                      >
                        🎥
                      </button>
                      <button className='flex h-9 w-9 items-center justify-center rounded-full text-[20px] transition hover:bg-[#3a3b3c]'>
                        ⋮
                      </button>
                    </div>
                  </div>
                );
              })()}

              {pinnedMessages.length > 0 && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPinnedModal(true);
                  }}
                  className='z-10 flex shrink-0 cursor-pointer items-center justify-between border-b border-gray-700/50 bg-[#242526] px-4 py-3 shadow-sm transition hover:bg-[#3a3b3c]/30'
                >
                  <div className='flex items-center gap-3 overflow-hidden'>
                    <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0084ff]/20 text-[16px] text-[#0084ff]'>
                      📌
                    </div>
                    <div className='flex flex-col overflow-hidden'>
                      <span className='text-[13px] font-semibold text-[#e4e6eb]'>
                        {pinnedMessages.length} Tin nhắn đã ghim
                      </span>
                      <span className='truncate text-[14px] text-[#b0b3b8]'>
                        {latestPinnedMsg.messageType === 'image'
                          ? latestPinnedMsg.mediaUrl?.includes('?type=sticker')
                            ? '🧸 Nhãn dán'
                            : '🖼️ Hình ảnh'
                          : latestPinnedMsg.messageType === 'audio'
                            ? '🎤 Ghi âm thoại'
                            : latestPinnedMsg.text}
                      </span>
                    </div>
                  </div>
                  <div className='rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#0084ff] transition hover:bg-[#3a3b3c]'>
                    Xem tất cả
                  </div>
                </div>
              )}

              <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-4'>
                {messages.map((msg, index) => {
                  const isMine =
                    msg.senderId?._id === currentUser.id || msg.senderId === currentUser.id;
                  const isOnlyEmoji = /^[\p{Extended_Pictographic}\s]+$/u.test(msg.text);
                  const isSticker =
                    msg.messageType === 'image' && msg.mediaUrl?.includes('?type=sticker');
                  const isLastMessage = index === messages.length - 1;

                  const HoverActions = () => {
                    const visibilityClass =
                      activeReactionId === msg._id || openMenuId === msg._id
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100';
                    const popupPlacementClass =
                      popupPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1';
                    const isCallMsg = msg.messageType === 'call';

                    return (
                      <div
                        className={`hidden items-center gap-1 text-[#b0b3b8] transition-opacity md:flex ${isMine ? 'mr-2' : 'ml-2'} ${visibilityClass}`}
                      >
                        {!isCallMsg && (
                          <>
                            <div className='relative flex items-center'>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeReactionId === msg._id) setActiveReactionId(null);
                                  else {
                                    setActiveReactionId(msg._id);
                                    setOpenMenuId(null);
                                    setPopupPosition(e.clientY < 300 ? 'down' : 'up');
                                  }
                                }}
                                className='flex h-8 w-8 items-center justify-center rounded-full text-[18px] transition hover:bg-[#3a3b3c] hover:text-[#e4e6eb]'
                              >
                                🙂
                              </button>
                              {activeReactionId === msg._id && (
                                <div
                                  className={`absolute ${isMine ? 'right-0' : 'left-0'} ${popupPlacementClass} z-50 flex items-center gap-1 rounded-full border border-gray-700 bg-[#242526] px-2 py-1 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
                                >
                                  {['❤️', '😆', '😮', '😢', '😡', '👍'].map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        socketRef.current.emit('react_message', {
                                          messageId: msg._id,
                                          userId: currentUser.id,
                                          emoji: emoji,
                                          conversationId: activeConversation._id,
                                        });
                                        setActiveReactionId(null);
                                      }}
                                      className='px-1 text-[22px] transition-transform hover:-translate-y-1 hover:scale-125'
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingTo(msg);
                              }}
                              className='flex h-8 w-8 items-center justify-center rounded-full text-[18px] transition hover:bg-[#3a3b3c] hover:text-[#e4e6eb]'
                            >
                              ↩️
                            </button>
                          </>
                        )}
                        <div className='relative flex items-center'>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === msg._id) setOpenMenuId(null);
                              else {
                                setOpenMenuId(msg._id);
                                setActiveReactionId(null);
                                setPopupPosition(e.clientY < 300 ? 'down' : 'up');
                              }
                            }}
                            className='flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-bold transition hover:bg-[#3a3b3c] hover:text-[#e4e6eb]'
                          >
                            ⋮
                          </button>
                          {openMenuId === msg._id && (
                            <div
                              className={`absolute ${isMine ? 'right-0' : 'left-0'} ${popupPlacementClass} z-50 w-[160px] overflow-hidden rounded-xl border border-gray-700 bg-[#242526] py-1.5 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
                            >
                              {msg.messageType === 'text' && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTranslate(msg);
                                    setOpenMenuId(null);
                                  }}
                                  className='flex cursor-pointer items-center justify-between px-4 py-2.5 text-[14px] font-medium text-[#e4e6eb] transition hover:bg-[#3a3b3c]'
                                >
                                  Dịch tin nhắn
                                </div>
                              )}
                              {!isCallMsg && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    socketRef.current.emit('toggle_pin', {
                                      messageId: msg._id,
                                      conversationId: activeConversation._id,
                                    });
                                    setOpenMenuId(null);
                                  }}
                                  className='flex cursor-pointer items-center justify-between px-4 py-2.5 text-[14px] font-medium text-[#e4e6eb] transition hover:bg-[#3a3b3c]'
                                >
                                  {msg.isPinned ? 'Bỏ ghim' : 'Ghim'}
                                </div>
                              )}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecallModalData(msg);
                                  setRecallOption(isMine ? 'everyone' : 'only_me');
                                  setOpenMenuId(null);
                                }}
                                className='cursor-pointer px-4 py-2.5 text-[14px] font-medium text-red-500 transition hover:bg-[#3a3b3c]'
                              >
                                Gỡ
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div
                      key={index}
                      id={`msg-${msg._id}`}
                      className={`flex w-full flex-col rounded-lg p-1 transition-all duration-500 ${msg.isPinned ? 'mt-2 mb-4' : 'mb-1'} ${activeReactionId === msg._id || openMenuId === msg._id ? 'z-20' : 'z-0'}`}
                      onTouchStart={() => {
                        pressTimerRef.current = setTimeout(() => setMobileMenuMsg(msg), 500);
                      }}
                      onTouchEnd={() => clearTimeout(pressTimerRef.current)}
                      onTouchMove={() => clearTimeout(pressTimerRef.current)}
                    >
                      {msg.isPinned && (
                        <div
                          className={`mb-0.5 text-[11px] font-medium text-[#b0b3b8] ${isMine ? 'mr-[4.5rem] self-end' : 'ml-[3.25rem] self-start'}`}
                        >
                          Đã ghim
                        </div>
                      )}
                      {activeConversation.isGroup && !isMine && (
                        <span className='mb-0.5 ml-10 text-[11px] text-[#b0b3b8]'>
                          {msg.senderId?.name}
                        </span>
                      )}
                      <div
                        className={`flex ${isMine ? 'justify-end' : 'items-end justify-start'} group relative w-full`}
                      >
                        {!isMine && (
                          <div className='mr-2 mb-1 h-7 w-7 shrink-0 self-end overflow-hidden rounded-full bg-gray-600'>
                            <img src={msg.senderId?.avatar || DEFAULT_AVATAR} alt='Avatar' />
                          </div>
                        )}
                        {isMine && !msg.isRecalled && <HoverActions />}
                        <div
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} relative`}
                        >
                          {msg.replyTo && !msg.isRecalled && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScrollToMessage(msg.replyTo.messageId);
                              }}
                              className={`mb-1 flex max-w-[200px] cursor-pointer flex-col rounded-2xl bg-[#3a3b3c]/50 px-3 py-1.5 text-[12.5px] text-[#b0b3b8] opacity-70 transition-opacity hover:opacity-100 sm:max-w-xs ${isMine ? 'items-end' : 'items-start'}`}
                            >
                              <span className='mb-0.5 flex items-center font-semibold text-[#e4e6eb]'>
                                <span className='mr-1 text-[13px]'>↩</span>
                                {msg.replyTo.senderName === currentUser.name
                                  ? 'Đã trả lời chính mình'
                                  : `Đã trả lời ${msg.replyTo.senderName}`}
                              </span>
                              <span
                                className={`w-full truncate ${isMine ? 'text-right' : 'text-left'}`}
                              >
                                {msg.replyTo.messageType === 'image'
                                  ? 'Đã gửi một ảnh'
                                  : msg.replyTo.messageType === 'call'
                                    ? '📞 Cuộc gọi'
                                    : msg.replyTo.messageType === 'audio'
                                      ? '🎤 Ghi âm thoại'
                                      : msg.replyTo.text}
                              </span>
                            </div>
                          )}
                          <div className='relative'>
                            {msg.isPinned && (
                              <div className='absolute -top-2 -left-2 z-10 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#e41e3f] shadow-sm ring-2 ring-[#242526]'>
                                <svg width='12' height='12' viewBox='0 0 24 24' fill='white'>
                                  <path d='M16 12V4h1V2H7v2h1v8l-2 2v2h4.2v6h1.6v-6H16v-2l-2-2z' />
                                </svg>
                              </div>
                            )}
                            {msg.isRecalled ? (
                              <div className='max-w-md rounded-[18px] border border-gray-600 bg-transparent px-4 py-2 text-[15px] text-[#b0b3b8] italic select-none'>
                                Tin nhắn đã thu hồi
                              </div>
                            ) : (
                              <>
                                {msg.messageType === 'audio' ? (
                                  <div
                                    className={`${isMine ? 'bg-[#0084ff]' : 'bg-[#3a3b3c]'} flex flex-col rounded-[20px] p-2 shadow-sm`}
                                  >
                                    <div className='flex items-center gap-2'>
                                      <audio
                                        controls
                                        src={msg.mediaUrl}
                                        className='h-[40px] w-[200px] outline-none sm:w-[240px]'
                                      />
                                      {/* 🔥 NÚT BẤM ĐỂ DỊCH AUDIO THÀNH CHỮ (ICON "A") */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTranscribeAudio(msg);
                                        }}
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-[13px] font-bold transition hover:bg-black/40 ${isMine ? 'text-white' : 'text-[#e4e6eb]'}`}
                                        title='Chuyển thành văn bản'
                                      >
                                        A/文
                                      </button>
                                    </div>

                                    {/* KHU VỰC HIỂN THỊ CHỮ */}
                                    {/* 1. Lịch sử cũ có sẵn chữ từ Whisper */}
                                    {msg.text && msg.text !== '🎤 Đã gửi một tin nhắn thoại' ? (
                                      <div
                                        className={`mt-1.5 px-2 pb-1 text-[14px] leading-relaxed font-medium opacity-95 ${isMine ? 'text-white' : 'text-[#e4e6eb]'}`}
                                      >
                                        {msg.text}
                                      </div>
                                    ) : /* 2. Chữ vừa được người dùng bấm dịch xong */
                                    translatedMessages[msg._id] ? (
                                      <div
                                        className={`mt-1.5 border-t ${isMine ? 'border-white/20' : 'border-gray-500/30'} px-2 pt-1.5 pb-1 text-[14px] leading-relaxed font-medium opacity-95 ${isMine ? 'text-white' : 'text-[#e4e6eb]'}`}
                                      >
                                        {translatedMessages[msg._id]}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : msg.messageType === 'image' ? (
                                  isSticker ? (
                                    <img
                                      src={msg.mediaUrl || undefined}
                                      alt='Sticker'
                                      className='h-[120px] w-[120px] object-contain drop-shadow-lg'
                                      referrerPolicy='no-referrer'
                                    />
                                  ) : (
                                    <div className='max-w-md overflow-hidden rounded-2xl border border-gray-700 bg-[#3a3b3c] p-1'>
                                      <img
                                        src={msg.mediaUrl || undefined}
                                        alt='Hình ảnh'
                                        className='max-h-64 max-w-xs cursor-pointer rounded-xl object-cover'
                                      />
                                    </div>
                                  )
                                ) : msg.messageType === 'call' ? (
                                  (() => {
                                    let icon = '📞';
                                    let title = isMine ? 'Cuộc gọi đi' : 'Cuộc gọi đến';
                                    let subtitle = msg.text;
                                    let titleColor = '#e4e6eb';
                                    let subtitleColor = '#b0b3b8';
                                    if (msg.text === 'canceled') {
                                      title = isMine ? 'Cuộc gọi đi' : 'Cuộc gọi nhỡ';
                                      subtitle = isMine ? 'Bạn đã hủy' : 'Bị nhỡ';
                                      if (!isMine) {
                                        icon = '📵';
                                        titleColor = '#ff3b30';
                                        subtitleColor = '#ff3b30';
                                      }
                                    } else if (msg.text === 'rejected') {
                                      title = isMine ? 'Cuộc gọi đi' : 'Cuộc gọi đến';
                                      subtitle = 'Từ chối';
                                      icon = '📵';
                                      subtitleColor = '#ff3b30';
                                      titleColor = '#ff3b30';
                                    } else if (msg.text === 'missed') {
                                      title = isMine ? 'Cuộc gọi đi' : 'Cuộc gọi nhỡ';
                                      subtitle = isMine ? '0 phút 0 giây' : 'Bị nhỡ';
                                      if (!isMine) {
                                        icon = '📵';
                                        titleColor = '#ff3b30';
                                        subtitleColor = '#ff3b30';
                                      }
                                    }
                                    return (
                                      <div className='flex min-w-[200px] flex-col rounded-2xl border border-gray-700 bg-[#242526] p-3 shadow-sm select-none'>
                                        <div className='mb-1.5 flex items-center gap-3'>
                                          <div className='flex h-9 w-9 items-center justify-center rounded-full bg-[#3a3b3c]'>
                                            <span className='text-[16px]'>{icon}</span>
                                          </div>
                                          <span
                                            className='text-[15px] font-semibold'
                                            style={{ color: titleColor }}
                                          >
                                            {title}
                                          </span>
                                        </div>
                                        <span
                                          className='mb-2 pl-12 text-[13px] font-medium'
                                          style={{ color: subtitleColor }}
                                        >
                                          {subtitle}
                                        </span>
                                        <div className='pl-12'>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartCall('voice');
                                            }}
                                            className='w-fit rounded-full bg-[#3a3b3c] px-4 py-1.5 text-[13px] font-semibold text-[#e4e6eb] transition hover:bg-[#4e4f50]'
                                          >
                                            Gọi lại
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : isOnlyEmoji ? (
                                  <div className='pb-1 text-[44px] leading-none drop-shadow-md'>
                                    {msg.text}
                                  </div>
                                ) : (
                                  <div
                                    className={`${isMine ? 'bg-[#0084ff] text-white' : 'bg-[#3a3b3c] text-[#e4e6eb]'} max-w-md rounded-[18px] px-3.5 py-2 text-[15px]`}
                                  >
                                    {msg.text}
                                    {translatedMessages[msg._id] && (
                                      <div
                                        className={`mt-1.5 border-t ${isMine ? 'border-white/20' : 'border-gray-500/30'} pt-1.5 text-[13.5px] italic opacity-90`}
                                      >
                                        <span className='mr-1 text-[12px] font-semibold'>A/文</span>
                                        {translatedMessages[msg._id]}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                            {msg.reactions && msg.reactions.length > 0 && !msg.isRecalled && (
                              <div
                                className={`absolute -bottom-2 ${isMine ? 'right-0' : 'left-0'} z-10 flex origin-bottom scale-90 items-center rounded-full border border-gray-700 bg-[#242526] px-1.5 py-[1px] shadow-md`}
                              >
                                {[...new Set(msg.reactions.map((r) => r.emoji))].map((emo, idx) => (
                                  <span key={idx} className='text-[13px]'>
                                    {emo}
                                  </span>
                                ))}
                                {msg.reactions.length > 1 && (
                                  <span className='ml-1 text-[11px] font-medium text-[#b0b3b8]'>
                                    {msg.reactions.length}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {!isMine && !msg.isRecalled && <HoverActions />}
                      </div>
                      {isMine && isLastMessage && msg.isRead && (
                        <div className='animate-in slide-in-from-top-1 fade-in mt-1 mr-2 flex justify-end duration-300'>
                          <div className='h-3.5 w-3.5 overflow-hidden rounded-full bg-gray-600 shadow-sm ring-[1.5px] ring-[#242526]'>
                            {(() => {
                              let seenAvatar = DEFAULT_AVATAR;
                              if (activeConversation && !activeConversation.isGroup) {
                                let partner = activeConversation.participants?.find(
                                  (p) => (p._id || p) !== currentUser.id
                                );
                                if (!partner) partner = activeConversation.participants?.[0];
                                if (partner) seenAvatar = partner.avatar || DEFAULT_AVATAR;
                              }
                              return (
                                <img
                                  src={seenAvatar}
                                  alt='Seen'
                                  className='h-full w-full object-cover'
                                />
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {isUploading && (
                  <div className='mt-2 flex justify-end'>
                    <div className='animate-pulse rounded-xl bg-[#3a3b3c] px-3 py-2 text-xs'>
                      ⏳ Đang xử lý...
                    </div>
                  </div>
                )}
                {isTyping && (
                  <div className='animate-in fade-in z-10 mt-2 mb-2 ml-1 flex items-center gap-2 duration-300'>
                    <div className='flex h-[36px] w-fit items-center gap-1.5 rounded-2xl rounded-bl-sm bg-[#3a3b3c] px-3 py-2'>
                      <span
                        className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#b0b3b8]'
                        style={{ animationDelay: '0ms' }}
                      ></span>
                      <span
                        className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#b0b3b8]'
                        style={{ animationDelay: '150ms' }}
                      ></span>
                      <span
                        className='h-1.5 w-1.5 animate-bounce rounded-full bg-[#b0b3b8]'
                        style={{ animationDelay: '300ms' }}
                      ></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ==================================================== */}
              {/* KHU VỰC NHẬP TIN NHẮN CHÍNH */}
              {/* ==================================================== */}
              <div className='flex flex-col border-t border-transparent bg-[#242526]'>
                {/* Thanh thông báo Đang trả lời tin nhắn */}
                {replyingTo && (
                  <div className='animate-in slide-in-from-bottom-2 flex items-center justify-between border-t border-gray-700/50 bg-[#242526] px-4 py-2'>
                    <div className='flex flex-col overflow-hidden'>
                      <span className='text-[13px] font-semibold text-[#b0b3b8]'>
                        Đang trả lời{' '}
                        {replyingTo.senderId?._id === currentUser.id
                          ? 'chính mình'
                          : replyingTo.senderId?.name || 'người dùng'}
                      </span>
                      <span className='truncate text-[14px] text-gray-400'>
                        {replyingTo.messageType === 'image'
                          ? 'Đã gửi một ảnh'
                          : replyingTo.messageType === 'audio'
                            ? '🎤 Ghi âm thoại'
                            : replyingTo.text}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(null);
                      }}
                      className='flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3b3c] text-gray-400 transition hover:text-[#e4e6eb]'
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* KIỂM TRA: NẾU ĐANG BẬT BẢNG GHI ÂM THÌ HIỂN THỊ CÁI NÀY, KHÔNG THÌ HIỆN KHUNG CHAT BÌNH THƯỜNG */}
                {showAudioRecorder ? (
                  /* 🔥 BẢNG GHI ÂM MỚI (INLINE CHUẨN ZALO TỪNG MILIMET) 🔥 */
                  <div className='flex w-full flex-col bg-[#242526]'>
                    {/* Nút Đóng (X) ở góc trên bên phải */}
                    <div className='flex justify-end p-3 pb-0'>
                      <button
                        onClick={() => {
                          cancelRecordingLocal();
                          setShowAudioRecorder(false);
                        }}
                        className='flex h-8 w-8 items-center justify-center rounded-full bg-[#3a3b3c] text-gray-400 transition hover:bg-[#4e4f50] hover:text-white'
                      >
                        ✕
                      </button>
                    </div>

                    <div className='flex flex-col items-center pt-2 pb-8'>
                      {/* Hiển thị thời gian, chữ dịch live hoặc hướng dẫn */}
                      <div className='mb-6 flex min-h-[40px] w-full max-w-[90%] flex-col items-center justify-center text-center'>
                        {isRecording ? (
                          audioMode === 'text' && audioText ? (
                            <p className='text-[16px] text-[#e4e6eb] italic'>"{audioText}"</p>
                          ) : (
                            <div className='flex items-center gap-3'>
                              <span className='h-3.5 w-3.5 animate-pulse rounded-full bg-red-500'></span>
                              <span className='font-mono text-4xl tracking-wider text-[#0084ff]'>
                                {Math.floor(recordingTime / 60)
                                  .toString()
                                  .padStart(2, '0')}
                                :{(recordingTime % 60).toString().padStart(2, '0')}
                              </span>
                            </div>
                          )
                        ) : (
                          <span className='text-[15px] font-medium text-[#b0b3b8]'>
                            Bấm hoặc bấm giữ để ghi âm
                          </span>
                        )}
                      </div>

                      {/* Cụm Nút Điều khiển Trung tâm */}
                      <div className='relative flex w-full items-center justify-center'>
                        {/* Nút Hủy (Trash) - Xuất hiện bên trái khi đang khóa thu âm */}
                        {isRecording && (
                          <button
                            onClick={cancelRecordingLocal}
                            className='absolute left-8 flex h-12 w-12 items-center justify-center rounded-full bg-[#3a3b3c] text-xl text-gray-400 transition hover:bg-[#ff3b30]/20 hover:text-[#ff3b30] md:left-1/3'
                            title='Hủy bỏ'
                          >
                            🗑️
                          </button>
                        )}

                        {/* NÚT MICRO BỰ BÀ CHÀ BÁ CHÍNH GIỮA */}
                        <button
                          onPointerDown={handlePressStart}
                          onPointerUp={handlePressEnd}
                          onPointerCancel={handlePressEnd}
                          className={`flex touch-none items-center justify-center rounded-full text-white transition-all duration-200 ${
                            isRecording
                              ? 'h-24 w-24 scale-105 bg-[#0084ff] shadow-[0_0_30px_rgba(0,132,255,0.6)]'
                              : 'h-20 w-20 bg-[#0084ff] hover:bg-[#0073e6]'
                          }`}
                        >
                          {isRecording && recordModeRef.current === 'LOCKED' ? '⏹' : '🎤'}
                        </button>

                        {/* Nút Gửi (Mũi tên) - Xuất hiện bên phải khi đang khóa thu âm */}
                        {isRecording && recordModeRef.current === 'LOCKED' && (
                          <button
                            onClick={finishAndSendRecording}
                            className='absolute right-8 flex h-12 w-12 items-center justify-center rounded-full bg-[#0084ff] text-xl text-white shadow-lg transition hover:bg-[#0073e6] md:right-1/3'
                            title='Gửi đi'
                          >
                            ➤
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2 Tabs chuyển đổi chế độ thu âm ở dưới cùng */}
                    <div className='flex w-full border-t border-gray-700/50 bg-[#18191a]/50'>
                      <button
                        onClick={() => {
                          if (!isRecording) setAudioMode('audio');
                        }}
                        className={`flex-1 py-3.5 text-[14px] font-semibold transition ${
                          audioMode === 'audio'
                            ? 'bg-[#242526] text-[#0084ff] shadow-[inset_0_-2px_0_0_#0084ff]'
                            : 'text-[#b0b3b8] hover:text-[#e4e6eb]'
                        }`}
                      >
                        Gửi bản ghi âm
                      </button>
                      <button
                        onClick={() => {
                          if (!isRecording) setAudioMode('text');
                        }}
                        className={`flex-1 py-3.5 text-[14px] font-semibold transition ${
                          audioMode === 'text'
                            ? 'bg-[#242526] text-[#0084ff] shadow-[inset_0_-2px_0_0_#0084ff]'
                            : 'text-[#b0b3b8] hover:text-[#e4e6eb]'
                        }`}
                      >
                        Gửi dạng văn bản
                      </button>
                    </div>
                  </div>
                ) : (
                  /* --- KHUNG NHẬP CHÍNH (GÕ CHỮ BÌNH THƯỜNG) --- */
                  <div
                    className='relative flex w-full shrink-0 items-center gap-1.5 p-2 px-2 sm:gap-2 sm:p-3 sm:px-4'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`shrink-0 items-center gap-1.5 transition-all sm:gap-2 ${inputText.trim() ? 'hidden sm:flex' : 'flex'}`}
                    >
                      <button className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl text-[#0084ff] transition hover:bg-[#3a3b3c]'>
                        ⊕
                      </button>
                      <input
                        type='file'
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept='image/*'
                        className='hidden'
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current.click();
                        }}
                        className='relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-[#0084ff] transition hover:bg-[#3a3b3c]'
                      >
                        🖼️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStickerPicker(!showStickerPicker);
                          setShowEmojiPicker(false);
                          setShowSettingsMenu(false);
                          setShowAudioRecorder(false);
                        }}
                        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[20px] text-[#0084ff] transition hover:bg-[#3a3b3c] ${showStickerPicker ? 'bg-[#3a3b3c]' : ''}`}
                        title='Nhãn dán'
                      >
                        🧸
                      </button>
                      {/* BẤM NÚT NÀY SẼ MỞ BẢNG GHI ÂM RA */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAudioRecorder(true);
                          setShowStickerPicker(false);
                          setShowEmojiPicker(false);
                          setShowSettingsMenu(false);
                        }}
                        className='relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[20px] text-[#0084ff] transition hover:bg-[#3a3b3c] md:hidden'
                        title='Ghi âm thoại'
                      >
                        🎙️
                      </button>
                    </div>

                    <div className='relative flex min-w-0 flex-1 items-center rounded-full bg-[#3a3b3c] pr-1 pl-3'>
                      <input
                        ref={inputRef}
                        type='text'
                        value={inputText}
                        onChange={handleTyping}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder='Aa'
                        className='min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none'
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEmojiPicker(!showEmojiPicker);
                          setShowStickerPicker(false);
                          setShowAudioRecorder(false);
                          setShowSettingsMenu(false);
                        }}
                        className='ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-[#0084ff] transition hover:bg-[#4e4f50]'
                      >
                        {defaultEmojiToInput}
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        inputText.trim() ? handleSendMessage() : handleSendLike();
                      }}
                      className='flex h-10 min-w-[40px] shrink-0 items-center justify-center rounded-full px-2 text-[16px] font-bold text-[#0084ff] transition hover:bg-[#3a3b3c]'
                    >
                      {inputText.trim() ? 'Gửi' : '👍'}
                    </button>

                    {/* Các bảng Sticker và Emoji */}
                    {showStickerPicker && (
                      <div className='absolute bottom-16 left-20 z-50 flex h-[340px] w-[320px] flex-col overflow-hidden rounded-xl border border-gray-700 bg-[#242526] shadow-2xl'>
                        <div className='flex items-center gap-1 overflow-x-auto border-b border-gray-700 bg-[#3a3b3c]/50 p-2'>
                          {STICKER_PACKS.map((pack) => (
                            <button
                              key={pack.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveStickerTab(pack.id);
                              }}
                              className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition ${activeStickerTab === pack.id ? 'border-b-2 border-[#0084ff] bg-[#4e4f50]' : 'hover:bg-[#3a3b3c]/50'}`}
                            >
                              {pack.icon}
                            </button>
                          ))}
                        </div>
                        <div className='grid flex-1 grid-cols-4 gap-2 overflow-y-auto p-3'>
                          {STICKER_PACKS.find((p) => p.id === activeStickerTab)?.stickers.map(
                            (url, idx) => (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendSticker(url);
                                }}
                                className='flex cursor-pointer items-center justify-center rounded-xl p-1.5 transition-colors hover:bg-[#3a3b3c]/80'
                              >
                                <img
                                  src={url || undefined}
                                  alt='Sticker'
                                  className='h-16 w-16 object-contain drop-shadow-sm transition-transform duration-200 hover:scale-110'
                                  referrerPolicy='no-referrer'
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                    {showEmojiPicker && (
                      <div className='absolute right-12 bottom-16 z-50 shadow-2xl'>
                        <EmojiPicker
                          theme='dark'
                          onEmojiClick={(emojiObject) => {
                            setInputText((prev) => prev + emojiObject.emoji);
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className='flex flex-1 flex-col items-center justify-center text-gray-500'>
              <span className='mb-4 text-6xl'>💬</span>
              <p>Chọn một người bạn ở cột bên trái hoặc bấm ✏️ để bắt đầu</p>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* 🧭 CỘT 3: THANH ĐIỀU HƯỚNG TỔNG QUÁT */}
        {/* ==================================================== */}
        <div
          className={`relative z-20 w-full shrink-0 flex-row items-center justify-between border-t border-gray-700 bg-[#242526] px-6 py-2 md:order-first md:w-[68px] md:flex-col md:border-t-0 md:border-r md:px-0 md:py-4 ${activeConversation ? 'hidden md:flex' : 'flex'}`}
        >
          <div className='flex flex-row gap-8 md:flex-col md:gap-4'>
            <button
              onClick={(e) => {
                e.stopPropagation();
                alert('Chức năng Tin nhắn đang hoạt động!');
              }}
              className='flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600'
            >
              💬
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                alert('Chức năng Danh bạ đang phát triển!');
              }}
              className='flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-gray-700'
            >
              👥
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                alert('Chức năng Cửa hàng đang phát triển!');
              }}
              className='flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-gray-700'
            >
              🏪
            </button>
          </div>

          <div className='relative ml-auto flex items-center md:mt-auto md:ml-0 md:flex-col'>
            {showSettingsMenu && (
              <div
                className='absolute right-0 bottom-14 z-50 w-[280px] overflow-hidden rounded-xl border border-gray-700 bg-[#242526] py-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] md:right-auto md:bottom-12 md:left-4'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='flex cursor-pointer items-center justify-between px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'>
                  <span className='font-semibold'>Tùy chọn</span>
                  <span className='text-[#b0b3b8]'>⚙️</span>
                </div>
                <input
                  type='file'
                  ref={avatarInputRef}
                  onChange={handleChangeAvatar}
                  accept='image/*'
                  className='hidden'
                />
                <div
                  onClick={() => avatarInputRef.current.click()}
                  className='flex cursor-pointer items-center justify-between px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'
                >
                  <span>{isUpdatingAvatar ? '⏳ Đang tải ảnh lên...' : '🖼️ Đổi ảnh đại diện'}</span>
                </div>
                <div
                  onClick={handleOpenChangeName}
                  className='cursor-pointer px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'
                >
                  Chỉnh sửa tên người dùng
                </div>
                <div className='cursor-pointer px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'>
                  Tài khoản đã hạn chế
                </div>
                <div className='flex cursor-pointer items-center justify-between px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'>
                  Quyền riêng tư và an toàn <span>›</span>
                </div>
                <div className='cursor-pointer px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'>
                  Trợ năng
                </div>
                <div className='my-1 border-t border-gray-700'></div>
                <div className='cursor-pointer px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'>
                  Trợ giúp
                </div>
                <div className='cursor-pointer px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'>
                  Báo cáo sự cố
                </div>
                <div className='my-1 border-t border-gray-700'></div>
                <div
                  onClick={handleLogout}
                  className='flex cursor-pointer items-center gap-2 px-4 py-2 text-[#e4e6eb] transition hover:bg-[#3a3b3c]'
                >
                  🚪 Đăng xuất
                </div>
              </div>
            )}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsMenu(!showSettingsMenu);
              }}
              className='h-10 w-10 cursor-pointer overflow-hidden rounded-full bg-blue-500 ring-2 ring-transparent transition hover:opacity-80'
            >
              <img
                src={currentUser?.avatar || DEFAULT_AVATAR}
                alt='Me'
                className='h-full w-full object-cover'
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
