'use client';
import EmojiPicker from 'emoji-picker-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import axios from 'axios';

// ==========================================
// 📦 DỮ LIỆU TĨNH (Stickers, Avatar mặc định)
// ==========================================
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

  // Hiệu ứng chạy 1 lần lúc mở trang: Kiểm tra xem đã đăng nhập chưa
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
  const [users, setUsers] = useState([]); // Danh sách tất cả người dùng
  const [conversations, setConversations] = useState([]); // Danh sách các phòng chat cột trái

  const [activeConversation, setActiveConversation] = useState(null); // Phòng chat đang mở
  const [messages, setMessages] = useState([]); // Danh sách tin nhắn trong phòng
  const [inputText, setInputText] = useState(''); // Chữ đang gõ
  const [drafts, setDrafts] = useState({}); // Lưu bản nháp tin nhắn chưa gửi
  const [isUploading, setIsUploading] = useState(false); // Trạng thái đang up ảnh
  const [isTyping, setIsTyping] = useState(false); // Trạng thái "đang gõ..." của người kia

  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // Bật/tắt bảng icon
  const [defaultEmojiToInput, setDefaultEmojiToInput] = useState('🙂');
  const [replyingTo, setReplyingTo] = useState(null); // Đang trả lời tin nhắn nào
  const [openMenuId, setOpenMenuId] = useState(null); // Mở menu 3 chấm của tin nhắn nào
  const [activeReactionId, setActiveReactionId] = useState(null); // Mở menu thả tim của tin nhắn nào
  const [popupPosition, setPopupPosition] = useState('up'); // Hướng hiển thị popup

  const [onlineUsers, setOnlineUsers] = useState([]); // Danh sách những người đang online
  const [tick, setTick] = useState(0); // Đồng hồ nhịp (để cập nhật phút hoạt động)

  const [showStickerPicker, setShowStickerPicker] = useState(false); // Bật/tắt bảng Nhãn dán
  const [activeStickerTab, setActiveStickerTab] = useState(STICKER_PACKS[0].id);

  const [showPinnedModal, setShowPinnedModal] = useState(false); // Modal xem tin nhắn ghim
  const [showSettingsMenu, setShowSettingsMenu] = useState(false); // Menu cài đặt cá nhân

  // Quản lý Gọi điện & Nhạc chuông
  const [incomingCall, setIncomingCall] = useState(null); // Có ai đang gọi tới không
  const [outgoingCall, setOutgoingCall] = useState(null); // 🔥 LƯU TRẠNG THÁI MÁY A ĐANG ĐỢI MÁY B
  const ringtoneRef = useRef(null); // Loa phát nhạc chuông

  // Quản lý Modal Thu hồi & Tạo nhóm
  const [recallModalData, setRecallModalData] = useState(null);
  const [recallOption, setRecallOption] = useState('everyone');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // ==========================================
  // 3️⃣ CÁC USE_REF (Biến không làm re-render giao diện)
  // ==========================================
  const socketRef = useRef(null); // Chứa kết nối tới máy chủ Socket
  const messagesEndRef = useRef(null); // Điểm đánh dấu cuối khung chat để cuộn
  const fileInputRef = useRef(null); // Trỏ tới ô input file ẩn
  const inputRef = useRef(null); // Trỏ tới ô nhập chữ
  const typingTimeoutRef = useRef(null); // Bộ đếm thời gian gõ chữ
  const avatarInputRef = useRef(null); // Trỏ tới ô up ảnh đại diện

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

      // Đếm ngược 45s nếu không ai thưa máy
      const timer = setTimeout(() => {
        socketRef.current.emit('send_message', {
          conversationId: incomingCall.roomId,
          senderId: incomingCall.callerId, // Ép A làm người gửi để bong bóng đúng vị trí
          text: 'missed',
          messageType: 'call',
          mediaUrl: '',
        });
        setIncomingCall(null);
      }, 45000);

      return () => clearTimeout(timer); // Hủy bộ đếm nếu nghe/từ chối trước 45s
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

    // Lấy danh sách phòng chat từ Database
    const fetchConversationsSafe = async (userId) => {
      try {
        const res = await axios.get(
          `https://hookchat-e6ad.onrender.com/api/chat/conversations/user/${userId}`
        );
        setConversations(res.data);
      } catch (error) {}
    };

    // Khởi tạo Socket
    socketRef.current = io('https://hookchat-e6ad.onrender.com');
    socketRef.current.emit('user_connected', currentUser.id);

    // Lắng nghe các sự kiện từ Server trả về
    socketRef.current.on('get_online_users', (users) => {
      setOnlineUsers(users);
    });

    socketRef.current.on('receive_message', (newMsg) => {
      setMessages((prev) => {
        if (prev.find((m) => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });
      fetchConversationsSafe(currentUser.id);

      // 🔥 LOGIC TỰ ĐÓNG BẢNG GỌI NẾU BỊ HỦY / TỪ CHỐI
      if (newMsg.messageType === 'call') {
        if (newMsg.text === 'canceled' || newMsg.text === 'missed') {
          setIncomingCall((prev) => (prev && prev.roomId === newMsg.conversationId ? null : prev)); // Máy B tự tắt chuông
        }
        if (newMsg.text === 'rejected' || newMsg.text === 'missed') {
          setOutgoingCall((prev) => (prev && prev.roomId === newMsg.conversationId ? null : prev)); // Máy A tự tắt bảng Đợi
        }
      }
    });

    // 🔥 MÁY A LẮNG NGHE MÁY B BẤM "NGHE MÁY" ĐỂ CÙNG NHAU VÀO PHÒNG
    // 🔥 MÁY A LẮNG NGHE MÁY B BẤM "NGHE MÁY"
    socketRef.current.on('call_accepted', (data) => {
      // Nhận được tín hiệu là bẻ lái thẳng luôn, không thông qua State của React nữa!
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

    // Bắt tín hiệu có người gọi tới
    socketRef.current.on('incoming_call', (callData) => {
      if (callData.participantIds.includes(currentUser.id)) {
        setIncomingCall(callData);
      }
    });

    // Lấy danh sách toàn bộ người dùng để thêm vào nhóm
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

    // Dọn dẹp khi tắt trang
    return () => socketRef.current.disconnect();
  }, [isCheckingAuth, currentUser]);

  // Cuộn xuống dòng tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ==========================================
  // 6️⃣ CÁC HÀM XỬ LÝ SỰ KIỆN (Click, Gõ phím...)
  // ==========================================

  // Mở một phòng chat cụ thể
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

    // Lấy thông tin người/nhóm mình chuẩn bị gọi để hiện lên UI Đang gọi
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

    // 1. Hiện bảng Đang gọi (cho Máy A)
    setOutgoingCall(callData);

    // 2. Bắn tín hiệu Đổ chuông sang Máy B
    socketRef.current.emit('initiate_call', callData);
  };

  // Tạo nhóm mới hoặc chat 1-1
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

  // Xử lý khi đang gõ chữ
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

  // Gửi tin nhắn Text
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeConversation) return;
    const msgData = {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: inputText,
      messageType: 'text',
      mediaUrl: '',
    };
    socketRef.current.emit('send_message', msgData);
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

  // Gửi Like
  const handleSendLike = () => {
    if (!activeConversation) return;
    socketRef.current.emit('send_message', {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: '👍',
      messageType: 'text',
      mediaUrl: '',
    });
    setShowEmojiPicker(false);
  };

  // Gỡ/Thu hồi tin nhắn
  const handleRecallMessage = (messageId) => {
    if (!activeConversation) return;
    socketRef.current.emit('recall_message', {
      messageId: messageId,
      conversationId: activeConversation._id,
    });
    setOpenMenuId(null);
  };

  // Up Ảnh đại diện (Cloudinary)
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

  // Đổi tên người dùng
  const handleChangeName = async () => {
    const newName = prompt('Nhập tên người dùng mới:', currentUser?.name);
    if (newName === null) return;
    if (!newName.trim() || newName.trim() === currentUser?.name) {
      alert('Vui lòng nhập tên mới!');
      return;
    }
    try {
      const response = await axios.put(
        `https://hookchat-e6ad.onrender.com/api/chat/users/${currentUser.id}/name`,
        { name: newName.trim() }
      );
      const updatedUser = { ...currentUser, name: response.data.name };
      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      alert('Đổi tên người dùng thành công! 🎉');
    } catch (error) {
      alert('Đổi tên thất bại, vui lòng thử lại!');
    } finally {
      setShowSettingsMenu(false);
    }
  };

  // Gửi Hình ảnh vào đoạn chat
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
      });
    } catch (error) {
      alert('Up ảnh thất bại, check tab Console nhé!');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Gửi Nhãn dán
  const handleSendSticker = (stickerUrl) => {
    if (!activeConversation) return;
    socketRef.current.emit('send_message', {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: 'Đã gửi một nhãn dán',
      messageType: 'image',
      mediaUrl: stickerUrl,
    });
    setShowStickerPicker(false);
  };

  // Bấm vào tin nhắn ghim để cuộn tới tin nhắn đó
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

  // Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  // Format thời gian hoạt động cuối cùng
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

  // Màn hình chờ Load dữ liệu lúc đầu
  if (isCheckingAuth)
    return (
      <div className='flex h-[100dvh] flex-col items-center justify-center bg-[#242526] text-[#b0b3b8]'>
        <p className='mb-4 animate-pulse'>Đang tải dữ liệu...</p>
        <button
          onClick={() => (window.location.href = '/login')}
          className='rounded-lg bg-[#0084ff] px-5 py-2 font-semibold text-white transition hover:bg-[#0073e6]'
        >
          Đăng nhập để tiếp tục
        </button>
      </div>
    );

  // Lọc ra các tin nhắn đã ghim
  const pinnedMessages = messages.filter((m) => m.isPinned);
  const latestPinnedMsg =
    pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  return (
    <div className='dark'>
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

        {/* --- MODAL 1: BẢNG ĐỔ CHUÔNG GỌI ĐIỆN TỚI --- */}
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
                {/* 🔴 NÚT TỪ CHỐI (MÀU ĐỎ) */}
                <button
                  onClick={() => {
                    // 1. Bắn tin nhắn báo từ chối vào chat (không chuyển trang)
                    socketRef.current.emit('send_message', {
                      conversationId: incomingCall.roomId,
                      senderId: incomingCall.callerId, // Ép A làm người gửi để bong bóng đúng chiều
                      text: 'rejected',
                      messageType: 'call',
                      mediaUrl: '',
                    });
                    // 2. Chỉ đóng bảng đổ chuông lại
                    setIncomingCall(null);
                  }}
                  className='group flex flex-1 flex-col items-center gap-2'
                >
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-[#ff3b30] shadow-lg transition-transform group-hover:bg-[#ff1a1a] hover:scale-110'>
                    <span className='rotate-[135deg] text-2xl text-white'>📞</span>
                  </div>
                  <span className='text-sm font-medium text-gray-300'>Từ chối</span>
                </button>

                {/* 🟢 NÚT NGHE MÁY (MÀU XANH) */}
                <button
                  onClick={() => {
                    // 1. Máy B báo cho máy A biết là đã đồng ý
                    socketRef.current.emit('accept_call', {
                      roomId: incomingCall.roomId,
                      participantIds: incomingCall.participantIds,
                      type: incomingCall.type,
                    });

                    // 2. Máy B tự động chuyển sang trang gọi
                    const callUrl = `/call/${incomingCall.roomId}?type=${incomingCall.type}`;
                    setIncomingCall(null);
                    window.location.href = callUrl;
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

        {/* --- 🔥 MODAL ĐANG GỌI ĐI (DÀNH CHO MÁY A NGỒI ĐỢI) 🔥 --- */}
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
                  // A đổi ý, bấm Hủy gọi
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

        {/* --- MODAL 2: TẠO NHÓM / CHAT 1-1 MỚI --- */}
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

        {/* --- MODAL 3: BẢNG XEM TIN NHẮN ĐÃ GHIM --- */}
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
                      <div className='flex flex-1 flex-col overflow-hidden pr-10'>
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
                            : msg.text}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 4: XÁC NHẬN THU HỒI/GỠ TIN NHẮN --- */}
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

        {/* ==================================================== */}
        {/* 📚 CỘT 1: DANH SÁCH BẠN BÈ & NHÓM CHAT (Đứng giữa màn hình máy tính) */}
        {/* ==================================================== */}
        <div
          className={`relative z-10 w-full flex-1 shrink-0 flex-col border-r border-gray-700 bg-[#242526] md:w-[360px] md:flex-none ${activeConversation ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Header Tìm kiếm & Nút tạo mới */}
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

          {/* Vòng lặp hiển thị danh sách phòng chat */}
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
        {/* 💬 CỘT 2: KHUNG CHAT CHÍNH (Chiếm diện tích lớn nhất) */}
        {/* ==================================================== */}
        <div
          className={`relative flex min-h-0 w-full min-w-0 flex-1 flex-col bg-[#242526] ${!activeConversation ? 'hidden md:flex' : 'flex'}`}
        >
          {activeConversation ? (
            <>
              {/* --- HEADER KHUNG CHAT (Ảnh đại diện, Tên, Nút gọi điện) --- */}
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
                      {/* Nút Quay Lại dành riêng cho màn hình Mobile */}
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
                    {/* Các Nút Gọi Điện / Menu */}
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

              {/* --- THANH THÔNG BÁO TIN NHẮN ĐÃ GHIM --- */}
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
                          : latestPinnedMsg.text}
                      </span>
                    </div>
                  </div>
                  <div className='rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#0084ff] transition hover:bg-[#3a3b3c]'>
                    Xem tất cả
                  </div>
                </div>
              )}

              {/* --- DANH SÁCH TIN NHẮN (LỊCH SỬ CHAT) --- */}
              <div className='min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-4'>
                {messages.map((msg, index) => {
                  const isMine =
                    msg.senderId?._id === currentUser.id || msg.senderId === currentUser.id;
                  const isOnlyEmoji = /^[\p{Extended_Pictographic}\s]+$/u.test(msg.text);
                  const isSticker =
                    msg.messageType === 'image' && msg.mediaUrl?.includes('?type=sticker');
                  const isLastMessage = index === messages.length - 1;

                  // Bộ 3 nút thao tác khi di chuột vào tin nhắn (Reaction, Trả lời, Mở rộng)
                  const HoverActions = () => {
                    const visibilityClass =
                      activeReactionId === msg._id || openMenuId === msg._id
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100';
                    const popupPlacementClass =
                      popupPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1';

                    // 🔥 BƯỚC 1: KIỂM TRA XEM CÓ PHẢI LÀ TIN NHẮN CUỘC GỌI KHÔNG
                    const isCallMsg = msg.messageType === 'call';

                    return (
                      <div
                        className={`flex items-center gap-1 text-[#b0b3b8] transition-opacity ${isMine ? 'mr-2' : 'ml-2'} ${visibilityClass}`}
                      >
                        {/* 🔥 BƯỚC 2: CHỈ HIỆN NÚT THẢ TIM VÀ TRẢ LỜI NẾU KHÔNG PHẢI LÀ CUỘC GỌI */}
                        {!isCallMsg && (
                          <>
                            {/* Biểu tượng Reaction (Thả tim) */}
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

                            {/* Nút Trả lời (Reply) */}
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

                        {/* Nút Tùy chọn 3 chấm (Luôn hiện để lấy nút Xóa) */}
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
                              {/* 🔥 BƯỚC 3: CHỈ CHO PHÉP GHIM NẾU KHÔNG PHẢI CUỘC GỌI */}
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

                              {/* Nút Gỡ (Xóa) thì ai cũng được dùng */}
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
                              {msg.messageType === 'image' ? (
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
                                /* 🔥 BƯỚC 4: GIAO DIỆN BONG BÓNG CUỘC GỌI CHUẨN APP 🔥 */
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
                                </div>
                              )}
                            </>
                          )}
                          {/* Hiển thị danh sách Reaction của tin nhắn */}
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
                        {!isMine && !msg.isRecalled && <HoverActions />}
                      </div>
                      {/* Avatar thu nhỏ báo hiệu người nhận đã đọc */}
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
                {/* Dấu hiệu ⏳ Đang tải ảnh */}
                {isUploading && (
                  <div className='mt-2 flex justify-end'>
                    <div className='animate-pulse rounded-xl bg-[#3a3b3c] px-3 py-2 text-xs'>
                      ⏳ Đang tải ảnh...
                    </div>
                  </div>
                )}
                {/* Dấu hiệu nhảy "..." khi đang gõ */}
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
              {/* KHU VỰC NHẬP TIN NHẮN */}
              {/* (Bao gồm chức năng Trả lời, Thêm Ảnh, Sticker, Gửi) */}
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
                        {replyingTo.messageType === 'image' ? 'Đã gửi một ảnh' : replyingTo.text}
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

                {/* --- KHUNG NHẬP CHÍNH (Đã áp dụng responsive cho Mobile) --- */}
                <div
                  className='relative flex w-full shrink-0 items-center gap-1.5 p-2 px-2 sm:gap-2 sm:p-3 sm:px-4'
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* CỤM 3 NÚT TIỆN ÍCH (Tự động giấu đi khi gõ chữ trên màn hình nhỏ) */}
                  <div
                    className={`shrink-0 items-center gap-1.5 transition-all sm:gap-2 ${inputText.trim() ? 'hidden sm:flex' : 'flex'}`}
                  >
                    {/* Nút cộng thêm tiện ích (Hiện đang để Decorate) */}
                    <button className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl text-[#0084ff] transition hover:bg-[#3a3b3c]'>
                      ⊕
                    </button>
                    {/* Nút chọn Ảnh */}
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
                    {/* Nút gọi Modal Sticker (Nhãn dán) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStickerPicker(!showStickerPicker);
                        setShowEmojiPicker(false);
                        setShowSettingsMenu(false);
                      }}
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[20px] text-[#0084ff] transition hover:bg-[#3a3b3c] ${showStickerPicker ? 'bg-[#3a3b3c]' : ''}`}
                      title='Nhãn dán'
                    >
                      🧸
                    </button>
                  </div>

                  {/* KHUNG GÕ CHỮ (Sử dụng min-w-0 để không bị đẩy tràn viền trên Mobile) */}
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
                    {/* Bật/Tắt bảng icon Emoji */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEmojiPicker(!showEmojiPicker);
                        setShowStickerPicker(false);
                        setShowSettingsMenu(false);
                      }}
                      className='ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-[#0084ff] transition hover:bg-[#4e4f50]'
                    >
                      {defaultEmojiToInput}
                    </button>
                  </div>

                  {/* NÚT GỬI / LIKE (Đã thêm min-w để chữ Gửi không bị bóp méo) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      inputText.trim() ? handleSendMessage() : handleSendLike();
                    }}
                    className='flex h-10 min-w-[40px] shrink-0 items-center justify-center rounded-full px-2 text-[16px] font-bold text-[#0084ff] transition hover:bg-[#3a3b3c]'
                  >
                    {inputText.trim() ? 'Gửi' : '👍'}
                  </button>

                  {/* --- Bảng hiển thị Nhãn Dán (Stickers Picker) --- */}
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

                  {/* --- Bảng hiển thị Icon (Emoji Picker) --- */}
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
              </div>
            </>
          ) : (
            // Trạng thái khi chưa chọn người để nhắn tin
            <div className='flex flex-1 flex-col items-center justify-center text-gray-500'>
              <span className='mb-4 text-6xl'>💬</span>
              <p>Chọn một người bạn ở cột bên trái hoặc bấm ✏️ để bắt đầu</p>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* 🧭 CỘT 3: THANH ĐIỀU HƯỚNG TỔNG QUÁT */}
        {/* (Nằm Nganh dưới đáy trên Mobile / Nằm dọc bên trái trên Desktop) */}
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
            {/* Modal Tùy chọn Tài khoản cá nhân */}
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
                  onClick={handleChangeName}
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
            {/* Cục bấm Avatar bật Tùy chọn */}
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
