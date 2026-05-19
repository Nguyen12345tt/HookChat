"use client";
import EmojiPicker from 'emoji-picker-react';
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import axios from "axios";

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
      'https://media.giphy.com/media/XG1ZvlZf4aMfe/giphy.gif?type=sticker'
    ]
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
      'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif?type=sticker'
    ]
  }
];

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
const DEFAULT_GROUP_AVATAR = "https://cdn-icons-png.flaticon.com/512/166/166258.png";

export default function Home() {
  const router = useRouter();

  // --- 1. CHỐT BẢO VỆ & AUTH ---
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    
    if (!token || !userStr) {
      router.push("/login");
    } else {
      setCurrentUser(JSON.parse(userStr));
      setIsCheckingAuth(false);
    }
  }, [router]);

  // --- 2. STATE DỮ LIỆU & GIAO DIỆN ---
  const [users, setUsers] = useState([]); 
  const [conversations, setConversations] = useState([]); // 🔥 Danh sách phòng chat cột trái
  
  const [activeConversation, setActiveConversation] = useState(null); 
  const [messages, setMessages] = useState([]); 
  const [inputText, setInputText] = useState("");
  const [drafts, setDrafts] = useState({}); // 🔥 State lưu bản nháp của từng phòng chat
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); 
  const [defaultEmojiToInput, setDefaultEmojiToInput] = useState("🙂"); 
  const [replyingTo, setReplyingTo] = useState(null); 
  const [openMenuId, setOpenMenuId] = useState(null); 
  const [activeReactionId, setActiveReactionId] = useState(null); 
  const [popupPosition, setPopupPosition] = useState("up");

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [tick, setTick] = useState(0);

  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeStickerTab, setActiveStickerTab] = useState(STICKER_PACKS[0].id);

  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // State quản lý Hộp thoại Thu hồi
  const [recallModalData, setRecallModalData] = useState(null); 
  const [recallOption, setRecallOption] = useState("everyone"); 

  // 🔥 Quản lý Modal Tạo Nhóm
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  // State quản lý Avatar
  const avatarInputRef = useRef(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // --- 3. ĐỒNG HỒ ĐẾM NHỊP ---
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000); 
    return () => clearInterval(interval); 
  }, []);

  // --- 4. KHỞI ĐỘNG HỆ THỐNG ---
  useEffect(() => {
    if (isCheckingAuth || !currentUser) return;

    // Hàm gọi API lấy danh sách phòng chat cho cột trái
    const fetchConversationsSafe = async (userId) => {
      try {
        const res = await axios.get(`https://hookchat-e6ad.onrender.com/api/chat/conversations/user/${userId}`);
        setConversations(res.data);
      } catch (error) {
        console.log("Lỗi tải danh sách phòng chat", error);
      }
    };

    socketRef.current = io("https://hookchat-e6ad.onrender.com");
    socketRef.current.emit("user_connected", currentUser.id);

    socketRef.current.on("get_online_users", (users) => {
      setOnlineUsers(users);
    });

    socketRef.current.on("receive_message", (newMsg) => {
      setMessages((prev) => {
        if (prev.find(m => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });
      fetchConversationsSafe(currentUser.id); // Load lại cột trái cho mới
    });

    socketRef.current.on("messages_read", ({ conversationId }) => {
      setMessages((prev) => 
        prev.map((msg) => ({ ...msg, isRead: true }))
      );
    });

    socketRef.current.on("update_message", (updatedMsg) => {
      setMessages((prev) => 
        prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m))
      );
    });

    socketRef.current.on("message_recalled", ({ messageId }) => {
      setMessages((prev) => 
        prev.map((msg) => 
          msg._id === messageId 
            ? { ...msg, isRecalled: true, text: "Bạn đã thu hồi tin nhắn", mediaUrl: "", messageType: "text" } 
            : msg
        )
      );
      fetchConversationsSafe(currentUser.id);
    });

    socketRef.current.on("user_typing", (data) => {
      if (data.senderId !== currentUser.id) setIsTyping(true);
    });

    socketRef.current.on("user_stopped_typing", (data) => {
      if (data.senderId !== currentUser.id) setIsTyping(false);
    });

    const fetchUsers = async () => {
      try {
        const res = await axios.get(`https://hookchat-e6ad.onrender.com/api/chat/users/${currentUser.id}`);
        setUsers(res.data);
      } catch (error) {
        console.log("Lỗi lấy danh sách user:", error);
      }
    };

    fetchUsers();
    fetchConversationsSafe(currentUser.id); // Kích hoạt lấy ds Phòng chat

    return () => socketRef.current.disconnect();
  }, [isCheckingAuth, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]); 

  // --- 5. HÀM CHỌN PHÒNG CHAT (TỪ CỘT TRÁI) ---
  const handleSelectConversation = async (conv) => {
    try {
      setActiveConversation(conv);
      // 🔥 Phục hồi bản nháp (nếu có), nếu không thì để trống ô input
      setInputText(drafts[conv._id] || "");

      socketRef.current.emit("join_conversation", conv._id);

      const resMsgs = await axios.get(`https://hookchat-e6ad.onrender.com/api/chat/messages/${conv._id}`);
      setMessages(resMsgs.data);

      socketRef.current.emit("mark_as_read", { 
        conversationId: conv._id, 
        userId: currentUser.id 
      });
      
      setShowEmojiPicker(false); 
      setShowStickerPicker(false);
      setShowPinnedModal(false);
      setShowSettingsMenu(false); 
      setReplyingTo(null);
      setOpenMenuId(null);
      setActiveReactionId(null);
      
      setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    } catch (error) {
      console.log("Lỗi khi mở phòng chat:", error);
    }
  };

  // 🔥 Hàm xử lý Gọi API tạo nhóm chat hoặc chat 1-1
  const handleCreateNewChat = async () => {
    if (selectedMembers.length === 0) return alert("Vui lòng chọn bạn bè!");

    try {
      let resConv;
      
      if (selectedMembers.length === 1) {
        // TẠO HOẶC MỞ CHAT 1-1
        const res = await axios.post("https://hookchat-e6ad.onrender.com/api/chat/conversation/direct", {
          senderId: currentUser.id,
          receiverId: selectedMembers[0]
        });
        resConv = res.data;
      } else {
        // TẠO GROUP CHAT
        if (!newGroupName.trim()) return alert("Vui lòng đặt tên cho nhóm!");
        const res = await axios.post("https://hookchat-e6ad.onrender.com/api/chat/conversation/group", {
          creatorId: currentUser.id,
          groupName: newGroupName,
          participantIds: selectedMembers
        });
        resConv = res.data;
      }

      // Mở phòng chat vừa tạo
      handleSelectConversation(resConv);

      // Gọi API tải lại cột bên trái
      const resRefresh = await axios.get(`https://hookchat-e6ad.onrender.com/api/chat/conversations/user/${currentUser.id}`);
      setConversations(resRefresh.data);

      // Đóng Hộp thoại & Reset dữ liệu
      setShowCreateGroupModal(false);
      setNewGroupName("");
      setSelectedMembers([]);
      
    } catch (error) {
      console.log("Lỗi tạo phòng:", error);
      alert("Khởi tạo thất bại, vui lòng thử lại!");
    }
  };

  // --- 6. CÁC HÀM XỬ LÝ SỰ KIỆN GỬI TIN NHẮN ---
const handleTyping = (e) => {
    const text = e.target.value;
    setInputText(text); // Cập nhật ô input hiện tại
    
    if (!activeConversation) return;

    // 🔥 Lưu ngay chữ đang gõ vào kho Bản nháp của phòng này
    setDrafts(prev => ({ ...prev, [activeConversation._id]: text }));

    socketRef.current.emit("typing", {
      conversationId: activeConversation._id,
      senderId: currentUser.id
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit("stop_typing", {
        conversationId: activeConversation._id,
        senderId: currentUser.id
      });
    }, 2000);
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !activeConversation) return;

    const msgData = {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: inputText,
      messageType: "text",
      mediaUrl: ""
    };

    socketRef.current.emit("send_message", msgData);
    // 🔥 Xóa bản nháp của phòng này vì đã gửi đi rồi
    setDrafts(prev => {
      const newDrafts = { ...prev };
      delete newDrafts[activeConversation._id];
      return newDrafts;
    });

    socketRef.current.emit("stop_typing", {
      conversationId: activeConversation._id,
      senderId: currentUser.id
    });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setInputText(""); 
    setShowEmojiPicker(false); 
    setReplyingTo(null); 
    inputRef.current?.focus();
  };

  const handleSendLike = () => {
    if (!activeConversation) return;
    const msgData = {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: "👍",
      messageType: "text",
      mediaUrl: ""
    };
    socketRef.current.emit("send_message", msgData);
    setShowEmojiPicker(false); 
  };

  const handleRecallMessage = (messageId) => {
    if (!activeConversation) return;
    socketRef.current.emit("recall_message", {
      messageId: messageId,
      conversationId: activeConversation._id
    });
    setOpenMenuId(null); 
  };

  const handleChangeAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUpdatingAvatar(true);
    try {
      const sigResponse = await axios.get('https://hookchat-e6ad.onrender.com/api/chat/upload-signature');
      const { signature, timestamp, cloud_name, api_key } = sigResponse.data;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", api_key);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("folder", "chat_images");

      const uploadResponse = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        formData
      );
      const newAvatarUrl = uploadResponse.data.secure_url;

      await axios.put(`https://hookchat-e6ad.onrender.com/api/chat/users/${currentUser.id}/avatar`, {
        avatarUrl: newAvatarUrl
      });

      const updatedUser = { ...currentUser, avatar: newAvatarUrl };
      setCurrentUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      alert("Đổi ảnh đại diện thành công! 🎉");
    } catch (error) {
      console.log("❌ LỖI ĐỔI AVATAR:", error);
      alert("Đổi ảnh thất bại, thử lại nhé!");
    } finally {
      setIsUpdatingAvatar(false);
      setShowSettingsMenu(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleChangeName = async () => {
    const newName = prompt("Nhập tên người dùng mới:", currentUser?.name);
    
    if (newName === null) return;
    if (!newName.trim() || newName.trim() === currentUser?.name) {
      alert("Vui lòng nhập tên mới!");
      return; 
    }

    try {
      const response = await axios.put(`https://hookchat-e6ad.onrender.com/api/chat/users/${currentUser.id}/name`, {
        name: newName.trim()
      });

      const updatedUser = { ...currentUser, name: response.data.name };
      setCurrentUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      alert("Đổi tên người dùng thành công! 🎉");
    } catch (error) {
      console.log("❌ LỖI ĐỔI TÊN NGƯỜI DÙNG:", error);
      alert("Đổi tên thất bại, vui lòng thử lại!");
    } finally {
      setShowSettingsMenu(false); 
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeConversation) return;

    setIsUploading(true);

    try {
      const sigResponse = await axios.get('https://hookchat-e6ad.onrender.com/api/chat/upload-signature');
      const { signature, timestamp, cloud_name, api_key } = sigResponse.data;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", api_key);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("folder", "chat_images");

      const uploadResponse = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        formData
      );

      const imageUrl = uploadResponse.data.secure_url;

      const msgData = {
        conversationId: activeConversation._id,
        senderId: currentUser.id, 
        text: "Đã gửi một ảnh",
        messageType: "image",
        mediaUrl: imageUrl
      };
      
      socketRef.current.emit("send_message", msgData);

    } catch (error) {
      console.log("❌ LỖI UPLOAD TRỰC TIẾP:", error.response?.data || error);
      alert("Up ảnh thất bại, check tab Console nhé!");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSendSticker = (stickerUrl) => {
    if (!activeConversation) return;
    const msgData = {
      conversationId: activeConversation._id,
      senderId: currentUser.id,
      text: "Đã gửi một nhãn dán",
      messageType: "image", 
      mediaUrl: stickerUrl  
    };
    socketRef.current.emit("send_message", msgData);
    setShowStickerPicker(false); 
  };

  const handleScrollToMessage = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("animate-pulse", "bg-[#3a3b3c]/50");
      setTimeout(() => {
        element.classList.remove("animate-pulse", "bg-[#3a3b3c]/50");
      }, 1500);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const formatLastActive = (lastSeenDate) => {
    const targetDate = lastSeenDate ? new Date(lastSeenDate) : new Date(Date.now() - 5 * 60000);
    const now = new Date();
    const diffMs = now - targetDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Vừa mới truy cập";
    if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;
    if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
    return null; 
  };

  if (isCheckingAuth) return <div className="h-screen bg-[#242526]"></div>;

  const pinnedMessages = messages.filter(m => m.isPinned);
  const latestPinnedMsg = pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  return (
    <div className="dark">
      <div 
        className="flex h-screen bg-[#242526] font-sans text-[#e4e6eb] overflow-hidden relative"
        onClick={() => { 
          setOpenMenuId(null); 
          setActiveReactionId(null); 
          setShowEmojiPicker(false); 
          setShowStickerPicker(false);
          setShowSettingsMenu(false); 
        }} 
      >
        
        {/* === 1. MENU TRÁI CÙNG === */}
        <div className="w-[68px] border-r border-gray-700 flex flex-col items-center py-4 justify-between bg-[#242526] shrink-0 z-20 relative">
          <div className="flex flex-col gap-4">
            <button className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center">💬</button>
            <button className="w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center text-xl">👥</button>
            <button className="w-10 h-10 rounded-full hover:bg-gray-700 flex items-center justify-center text-xl">🏪</button>
          </div>
          
          <div className="relative mt-auto flex flex-col items-center">
            {showSettingsMenu && (
              <div 
                className="absolute bottom-12 left-4 w-[280px] bg-[#242526] border border-gray-700 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] py-2 z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()} 
              >
                <div className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer flex items-center justify-between text-[#e4e6eb] transition">
                  <span className="font-semibold">Tùy chọn</span>
                  <span className="text-[#b0b3b8]">⚙️</span>
                </div>
                
                <input type="file" ref={avatarInputRef} onChange={handleChangeAvatar} accept="image/*" className="hidden" />
                <div 
                  onClick={() => avatarInputRef.current.click()} 
                  className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition flex items-center justify-between"
                >
                  <span>{isUpdatingAvatar ? "⏳ Đang tải ảnh lên..." : "🖼️ Đổi ảnh đại diện"}</span>
                </div>

                <div 
                  onClick={handleChangeName}
                  className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition">Chỉnh sửa tên người dùng
                </div>
                <div className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition">Tài khoản đã hạn chế</div>
                <div className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition flex items-center justify-between">
                  Quyền riêng tư và an toàn <span>›</span>
                </div>
                <div className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition">Trợ năng</div>
                <div className="border-t border-gray-700 my-1"></div>
                <div className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition">Trợ giúp</div>
                <div className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition">Báo cáo sự cố</div>
                <div className="border-t border-gray-700 my-1"></div>
                <div 
                  onClick={handleLogout} 
                  className="px-4 py-2 hover:bg-[#3a3b3c] cursor-pointer text-[#e4e6eb] transition flex items-center gap-2"
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
              className="w-10 h-10 rounded-full bg-blue-500 overflow-hidden ring-2 ring-transparent cursor-pointer hover:opacity-80 transition"
              title="Tùy chọn"
            >
              <img src={currentUser?.avatar || DEFAULT_AVATAR} alt="Me" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* === 2. DANH SÁCH BẠN BÈ & NHÓM CHAT (CỘT BÊN TRÁI) === */}
        <div className="w-[360px] border-r border-gray-700 flex flex-col bg-[#242526] shrink-0 z-10 relative">
          <div className="p-4 border-b border-gray-700/50 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Đoạn chat</h1>
              <button 
                onClick={() => setShowCreateGroupModal(true)}
                className="w-9 h-9 bg-[#3a3b3c] hover:bg-[#4e4f50] rounded-full flex items-center justify-center transition text-[15px]"
                title="Tạo nhóm mới"
              >
                ✏️
              </button>
            </div>
            <input type="text" placeholder="Tìm kiếm trên Messenger" className="w-full p-2 bg-[#3a3b3c] rounded-full outline-none px-4 text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-center text-gray-500 mt-4 text-sm">Chưa có đoạn chat nào, hãy bấm ✏️ để bắt đầu!</p>
            )}

            {conversations.map(conv => {
              const isGroup = conv.isGroup;
              let name = "Người dùng";
              let avatar = DEFAULT_AVATAR;
              let isOnline = false;

              // Trích xuất an toàn dữ liệu Người kia hoặc Nhóm
              if (isGroup) {
                name = conv.groupName || "Nhóm không tên";
                avatar = conv.groupAvatar || DEFAULT_GROUP_AVATAR;
              } else {
                let partner = conv.participants?.find(p => (p._id || p) !== currentUser.id);
                if (!partner) partner = conv.participants?.[0]; // Lỡ chat với chính mình
                
                if (partner) {
                  name = partner.name || "Người dùng";
                  avatar = partner.avatar || DEFAULT_AVATAR;
                  isOnline = onlineUsers.includes(partner._id || partner);
                }
              }

              return (
                <div 
                  key={conv._id} 
                  onClick={() => handleSelectConversation(conv)}
                  className={`flex items-center px-4 py-3 cursor-pointer transition ${activeConversation?._id === conv._id ? 'bg-[#3a3b3c]' : 'hover:bg-[#3a3b3c]/50'}`}
                >
                  <div className="relative w-14 h-14 shrink-0">
                    <div className="w-full h-full bg-gray-600 rounded-full overflow-hidden flex items-center justify-center">
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    {isOnline && !isGroup && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#242526] rounded-full"></div>
                    )}
                  </div>
                  <div className="ml-3 flex-1 overflow-hidden">
                    <h3 className="font-semibold text-[15px] truncate">{name}</h3>
                    
                  {/* BẮT ĐẦU ĐOẠN XỬ LÝ TEXT PREVIEW XỊN SÒ */}
                    {(() => {
                      // 🔥 1. KIỂM TRA XEM CÓ BẢN NHÁP KHÔNG TRƯỚC TIÊN
                      const draftText = drafts[conv._id];
                      if (draftText && draftText.trim() !== "") {
                        return (
                          <p className="text-[13px] text-[#ff3040] font-medium truncate">
                            Bản nháp: {draftText}
                          </p>
                        );
                      }

                      // 2. NẾU KHÔNG CÓ BẢN NHÁP THÌ MỚI HIỆN TIN NHẮN CUỐI
                      let messagePreview = 'Nhấn để chat ngay';
                      
                      if (conv.latestMessage) {
                        const isMine = conv.latestMessage.senderId?._id === currentUser.id || conv.latestMessage.senderId === currentUser.id;
                        
                        const realSenderId = conv.latestMessage.senderId?._id || conv.latestMessage.senderId;
                        const senderObj = conv.participants?.find(p => p._id === realSenderId);
                        
                        const senderNameParts = senderObj?.name?.split(' ') || [];
                        const shortName = senderNameParts[senderNameParts.length - 1] || "Ai đó"; 
                        
                        const prefix = isMine ? "Bạn" : shortName;
                        
                        let content = "";
                        if (conv.latestMessage.isRecalled) {
                          content = "Đã thu hồi một tin nhắn";
                        } else if (conv.latestMessage.messageType === 'image') {
                          content = conv.latestMessage.mediaUrl?.includes('sticker') ? 'đã gửi nhãn dán' : 'đã gửi một ảnh';
                        } else {
                          content = conv.latestMessage.text;
                        }

                        if (conv.isGroup) {
                          messagePreview = `${prefix}: ${content}`;
                        } else {
                          messagePreview = isMine ? `Bạn: ${content}` : content;
                        }
                      }
                      
                      const isUnread = conv.latestMessage?.isRead === false && 
                                       conv.latestMessage?.senderId?._id !== currentUser.id && 
                                       conv.latestMessage?.senderId !== currentUser.id;

                      return (
                        <p className={`text-[13px] truncate ${isUnread ? 'text-[#e4e6eb] font-bold' : 'text-[#b0b3b8]'}`}>
                          {messagePreview}
                        </p>
                      );
                    })()}
                    {/* KẾT THÚC ĐOẠN XỬ LÝ TEXT PREVIEW */}
                    
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* === 3. KHUNG CHAT CHÍNH === */}
        <div className="flex-1 flex flex-col bg-[#242526] min-w-0 w-full relative">
          
          {/* 🔥 MODAL: TẠO TIN NHẮN / TẠO NHÓM MỚI */}
          {showCreateGroupModal && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 transition-opacity">
              <div 
                className="w-[420px] bg-[#242526] rounded-xl shadow-2xl flex flex-col border border-gray-700 animate-in zoom-in-95 overflow-hidden"
                onClick={(e) => e.stopPropagation()} 
              >
                {/* Header Modal */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700 relative">
                  <h2 className="text-[20px] font-bold text-[#e4e6eb] w-full text-center">Tạo tin nhắn mới</h2>
                  <button 
                    onClick={() => setShowCreateGroupModal(false)} 
                    className="absolute right-4 w-9 h-9 bg-[#3a3b3c] hover:bg-[#4e4f50] rounded-full flex items-center justify-center text-[#b0b3b8] transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Nội dung: Nhập tên nhóm & Chọn bạn bè */}
                <div className="p-4 flex flex-col gap-4">
                  {selectedMembers.length >= 2 && (
                    <input 
                      type="text" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Nhập tên nhóm..." 
                      className="w-full p-3 bg-[#3a3b3c] rounded-lg outline-none text-[#e4e6eb] text-[15px]"
                    />
                  )}
                  
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#b0b3b8] mb-2 mt-2">Chọn bạn bè để bắt đầu</h3>
                    <div className="max-h-[200px] overflow-y-auto pr-2 flex flex-col gap-1">
                      {users.map(user => (
                        <label key={user._id} className="flex items-center gap-3 p-2 hover:bg-[#3a3b3c] rounded-lg cursor-pointer transition">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 accent-[#0084ff] cursor-pointer rounded-sm"
                            checked={selectedMembers.includes(user._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMembers(prev => [...prev, user._id]);
                              } else {
                                setSelectedMembers(prev => prev.filter(id => id !== user._id));
                              }
                            }}
                          />
                          <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden shrink-0">
                            <img src={user.avatar || DEFAULT_AVATAR} alt={user.name} />
                          </div>
                          <span className="text-[#e4e6eb] font-medium">{user.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Nút bấm */}
                <div className="p-4 border-t border-gray-700 flex justify-end gap-2 bg-[#242526]">
                  <button 
                    onClick={() => setShowCreateGroupModal(false)} 
                    className="px-5 py-2 hover:bg-[#3a3b3c] text-[#e4e6eb] rounded-lg font-semibold transition"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleCreateNewChat} 
                    className="px-6 py-2 bg-[#0084ff] hover:bg-[#0073e6] text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selectedMembers.length === 0}
                  >
                    {selectedMembers.length > 1 ? "Tạo Nhóm" : "Chat"}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* BẢNG HIỂN THỊ "DANH SÁCH TIN NHẮN ĐÃ GHIM" (MODAL) */}
          {showPinnedModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity">
              <div 
                className="w-[480px] bg-[#242526] rounded-xl shadow-2xl flex flex-col max-h-[80vh] border border-gray-700 animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()} 
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-700 relative">
                  <h2 className="text-[20px] font-bold text-[#e4e6eb] w-full text-center">Tin nhắn đã ghim</h2>
                  <button 
                    onClick={() => setShowPinnedModal(false)} 
                    className="absolute right-4 w-9 h-9 bg-[#3a3b3c] hover:bg-[#4e4f50] rounded-full flex items-center justify-center text-[#b0b3b8] transition"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {pinnedMessages.length === 0 ? (
                    <div className="p-6 text-center text-[#b0b3b8]">Chưa có tin nhắn nào được ghim.</div>
                  ) : (
                    pinnedMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className="flex gap-3 p-3 hover:bg-[#3a3b3c]/50 rounded-xl cursor-pointer group transition relative items-center"
                        onClick={() => { 
                          handleScrollToMessage(msg._id); 
                          setShowPinnedModal(false); 
                        }}
                      >
                        <div className="w-11 h-11 rounded-full bg-gray-600 overflow-hidden shrink-0">
                          <img src={msg.senderId?.avatar || DEFAULT_AVATAR} alt="Avatar" />
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden pr-10">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[15px] text-[#e4e6eb]">
                              {msg.senderId?._id === currentUser.id ? 'Bạn' : msg.senderId?.name}
                            </span>
                            <span className="text-[12px] text-[#b0b3b8]">
                              {new Date(msg.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          <span className="text-[14px] text-[#b0b3b8] truncate mt-0.5">
                            {msg.messageType === 'image' 
                              ? (msg.mediaUrl?.includes('?type=sticker') ? '🧸 Nhãn dán' : '🖼️ Hình ảnh') 
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

          {/* HỘP THOẠI XÁC NHẬN GỠ/THU HỒI TIN NHẮN */}
          {recallModalData && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 transition-opacity">
              <div 
                className="w-[420px] bg-[#242526] rounded-xl shadow-2xl flex flex-col border border-gray-700 animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()} 
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-700 relative">
                  <h2 className="text-[20px] font-bold text-[#e4e6eb] w-full text-left">Bạn muốn thu hồi tin nhắn này ở phía ai?</h2>
                  <button 
                    onClick={() => setRecallModalData(null)} 
                    className="absolute right-4 w-9 h-9 bg-[#3a3b3c] hover:bg-[#4e4f50] rounded-full flex items-center justify-center text-[#b0b3b8] transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 flex flex-col gap-5">
                  {(recallModalData.senderId?._id === currentUser.id || recallModalData.senderId === currentUser.id) && (
                    <label className="flex gap-3 cursor-pointer group items-start">
                      <input 
                        type="radio" 
                        name="recallOption" 
                        value="everyone" 
                        checked={recallOption === "everyone"} 
                        onChange={() => setRecallOption("everyone")} 
                        className="mt-1.5 w-5 h-5 accent-[#0084ff] cursor-pointer shrink-0" 
                      />
                      <div className="flex flex-col">
                        <span className="text-[15px] text-[#e4e6eb] font-semibold">Thu hồi với mọi người</span>
                      </div>
                    </label>
                  )}

                  <label className="flex gap-3 cursor-pointer group items-start">
                    <input 
                      type="radio" 
                      name="recallOption" 
                      value="only_me" 
                      checked={recallOption === "only_me"} 
                      onChange={() => setRecallOption("only_me")} 
                      className="mt-1.5 w-5 h-5 accent-[#0084ff] cursor-pointer shrink-0" 
                    />
                    <div className="flex flex-col">
                      <span className="text-[15px] text-[#e4e6eb] font-semibold">Thu hồi với bạn</span>
                    </div>
                  </label>
                </div>

                <div className="p-4 flex justify-end gap-2 mt-2">
                  <button 
                    onClick={() => setRecallModalData(null)} 
                    className="px-5 py-2 hover:bg-[#3a3b3c] text-[#0084ff] rounded-lg font-semibold transition"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => {
                      if (recallOption === "everyone") {
                        handleRecallMessage(recallModalData._id); 
                      } else {
                        setMessages(prev => prev.filter(m => m._id !== recallModalData._id));
                      }
                      setRecallModalData(null); 
                    }} 
                    className="px-6 py-2 bg-[#0084ff] hover:bg-[#0073e6] text-white rounded-lg font-semibold transition"
                  >
                    Gỡ
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeConversation ? (
            <>
              {/* Header Phòng chat */}
              {(() => {
                let headerName = "Đang tải...";
                let headerAvatar = DEFAULT_AVATAR;
                let headerSubText = "";
                let showOnlineDot = false;

                if (activeConversation) {
                  if (activeConversation.isGroup) {
                    headerName = activeConversation.groupName || "Nhóm";
                    headerAvatar = activeConversation.groupAvatar || DEFAULT_GROUP_AVATAR;
                    headerSubText = `${activeConversation.participants?.length || 0} thành viên`;
                  } else {
                    let partner = activeConversation.participants?.find(p => (p._id || p) !== currentUser.id);
                    if (!partner) partner = activeConversation.participants?.[0]; 
                    
                    if (partner) {
                      headerName = partner.name || "Người dùng";
                      headerAvatar = partner.avatar || DEFAULT_AVATAR;
                      showOnlineDot = onlineUsers.includes(partner._id || partner);
                      headerSubText = showOnlineDot ? "Đang hoạt động" : (partner.lastSeen ? formatLastActive(partner.lastSeen) : "");
                    }
                  }
                }

return (
                  <div className="h-[68px] px-4 border-b border-gray-700 flex items-center justify-between shadow-sm shrink-0 bg-[#242526] z-10">
                    
                    {/* Thông tin người/nhóm đang chat */}
                    <div className="flex items-center">
                      <div className="relative w-10 h-10 shrink-0">
                        <img src={headerAvatar} alt="Partner" className="w-full h-full bg-gray-600 rounded-full object-cover" />
                        {showOnlineDot && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#242526] rounded-full"></div>}
                      </div>
                      <div className="ml-3">
                        <h2 className="font-semibold text-[15px]">{headerName}</h2>
                        <p className="text-[12px] text-[#b0b3b8]">{headerSubText}</p>
                      </div>
                    </div>

                    {/* 🔥 2 NÚT GỌI THOẠI & GỌI VIDEO Ở ĐÂY */}
                    <div className="flex items-center gap-2 text-[#0084ff]">
                      <button 
                        onClick={() => router.push(`/call/${activeConversation._id}?type=voice`)} 
                        className="w-9 h-9 hover:bg-[#3a3b3c] rounded-full flex items-center justify-center text-[18px] transition"
                        title="Bắt đầu gọi thoại"
                      >
                        📞
                      </button>
                      <button 
                        onClick={() => router.push(`/call/${activeConversation._id}?type=video`)} 
                        className="w-9 h-9 hover:bg-[#3a3b3c] rounded-full flex items-center justify-center text-[18px] transition"
                        title="Bắt đầu gọi video"
                      >
                        🎥
                      </button>
                      <button className="w-9 h-9 hover:bg-[#3a3b3c] rounded-full flex items-center justify-center text-[20px] transition">
                        ⋮
                      </button>
                    </div>

                  </div>
                );
              })()}

              {/* THANH "TIN NHẮN ĐÃ GHIM" */}
              {pinnedMessages.length > 0 && (
                <div 
                  onClick={() => setShowPinnedModal(true)} 
                  className="px-4 py-3 border-b border-gray-700/50 bg-[#242526] flex items-center justify-between shrink-0 shadow-sm z-10 cursor-pointer hover:bg-[#3a3b3c]/30 transition"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-full bg-[#0084ff]/20 text-[#0084ff] flex items-center justify-center text-[16px] shrink-0">
                      📌
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[13px] font-semibold text-[#e4e6eb]">
                        {pinnedMessages.length} Tin nhắn đã ghim
                      </span>
                      <span className="text-[14px] text-[#b0b3b8] truncate">
                        {latestPinnedMsg.messageType === 'image' 
                          ? (latestPinnedMsg.mediaUrl?.includes('?type=sticker') ? '🧸 Nhãn dán' : '🖼️ Hình ảnh') 
                          : latestPinnedMsg.text}
                      </span>
                    </div>
                  </div>
                  <div className="text-[#0084ff] font-medium text-[13px] hover:bg-[#3a3b3c] px-3 py-1.5 rounded-lg transition">
                    Xem tất cả
                  </div>
                </div>
              )}

              {/* Lịch sử Tin nhắn */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {messages.map((msg, index) => {
                  const isMine = msg.senderId?._id === currentUser.id || msg.senderId === currentUser.id;
                  const isOnlyEmoji = /^[\p{Extended_Pictographic}\s]+$/u.test(msg.text);
                  const isSticker = msg.messageType === 'image' && msg.mediaUrl?.includes('?type=sticker');
                  const isLastMessage = index === messages.length - 1;
                  
                  const HoverActions = () => {
                    const visibilityClass = (activeReactionId === msg._id || openMenuId === msg._id) 
                      ? 'opacity-100' 
                      : 'opacity-0 group-hover:opacity-100';

                    const popupPlacementClass = popupPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1';

                    return (
                      <div className={`transition-opacity flex items-center gap-1 text-[#b0b3b8] ${isMine ? 'mr-2' : 'ml-2'} ${visibilityClass}`}>
                        <div className="relative flex items-center">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (activeReactionId === msg._id) setActiveReactionId(null);
                              else { setActiveReactionId(msg._id); setOpenMenuId(null); setPopupPosition(e.clientY < 300 ? 'down' : 'up'); }
                            }} 
                            className="flex items-center justify-center w-8 h-8 hover:bg-[#3a3b3c] hover:text-[#e4e6eb] rounded-full transition text-[18px]" 
                          >
                            🙂
                          </button>

                          {activeReactionId === msg._id && (
                            <div className={`absolute ${isMine ? 'right-0' : 'left-0'} ${popupPlacementClass} flex items-center gap-1 bg-[#242526] border border-gray-700 rounded-full px-2 py-1 shadow-[0_0_15px_rgba(0,0,0,0.5)] z-50`}>
                              {['❤️', '😆', '😮', '😢', '😡', '👍'].map((emoji) => (
                                <button 
                                  key={emoji}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    socketRef.current.emit("react_message", {
                                      messageId: msg._id, userId: currentUser.id, emoji: emoji, conversationId: activeConversation._id
                                    });
                                    setActiveReactionId(null); 
                                  }}
                                  className="hover:scale-125 transition-transform text-[22px] px-1 hover:-translate-y-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <button onClick={() => setReplyingTo(msg)} className="flex items-center justify-center w-8 h-8 hover:bg-[#3a3b3c] hover:text-[#e4e6eb] rounded-full transition text-[18px]">
                          ↩️
                        </button>
                        
                        <div className="relative flex items-center">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (openMenuId === msg._id) setOpenMenuId(null);
                              else { setOpenMenuId(msg._id); setActiveReactionId(null); setPopupPosition(e.clientY < 300 ? 'down' : 'up'); }
                            }} 
                            className="flex items-center justify-center w-8 h-8 hover:bg-[#3a3b3c] hover:text-[#e4e6eb] rounded-full transition font-bold text-[18px]" 
                          >
                            ⋮
                          </button>
                          
                          {openMenuId === msg._id && (
                            <div className={`absolute ${isMine ? 'right-0' : 'left-0'} ${popupPlacementClass} w-[160px] bg-[#242526] border border-gray-700 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] py-1.5 z-50 overflow-hidden`}>
                              <div 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  socketRef.current.emit("toggle_pin", { messageId: msg._id, conversationId: activeConversation._id });
                                  setOpenMenuId(null); 
                                }} 
                                className="px-4 py-2.5 hover:bg-[#3a3b3c] cursor-pointer text-[14px] text-[#e4e6eb] font-medium transition flex items-center justify-between"
                              >
                                {msg.isPinned ? "Bỏ ghim" : "Ghim"} 
                              </div>
                              <div 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setRecallModalData(msg); 
                                  setRecallOption(isMine ? "everyone" : "only_me"); 
                                  setOpenMenuId(null); 
                                }} 
                                className="px-4 py-2.5 hover:bg-[#3a3b3c] cursor-pointer text-[14px] text-red-500 font-medium transition"
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
                    <div key={index} id={`msg-${msg._id}`} className={`flex flex-col w-full rounded-lg p-1 transition-all duration-500 ${msg.isPinned ? 'mb-4 mt-2' : 'mb-1'} ${(activeReactionId === msg._id || openMenuId === msg._id) ? 'z-20' : 'z-0'}`}>
                      {msg.isPinned && (
                        <div className={`text-[11px] text-[#b0b3b8] font-medium mb-0.5 ${isMine ? 'self-end mr-[4.5rem]' : 'self-start ml-[3.25rem]'}`}>
                          Đã ghim
                        </div>
                      )}
                      
                      {activeConversation.isGroup && !isMine && (
                        <span className="text-[11px] text-[#b0b3b8] ml-10 mb-0.5">{msg.senderId?.name}</span>
                      )}

                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start items-end'} group relative w-full`}>
                        {!isMine && (
                          <div className="w-7 h-7 rounded-full bg-gray-600 overflow-hidden shrink-0 mr-2 self-end mb-1">
                            <img src={msg.senderId?.avatar || DEFAULT_AVATAR} alt="Avatar" />
                          </div>
                        )}
                        
                        {isMine && !msg.isRecalled && <HoverActions />}
                        
                        <div className="relative">
                          {msg.isPinned && (
                            <div className="absolute -top-2 -left-2 w-[20px] h-[20px] bg-[#e41e3f] rounded-full flex items-center justify-center ring-2 ring-[#242526] z-10 shadow-sm">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h4.2v6h1.6v-6H16v-2l-2-2z"/>
                              </svg>
                            </div>
                          )}

                          {msg.isRecalled ? (
                            <div className="border border-gray-600 bg-transparent text-[#b0b3b8] italic text-[15px] px-4 py-2 rounded-[18px] max-w-md select-none">
                              Tin nhắn đã thu hồi
                            </div>
                          ) : (
                            <>
                              {msg.messageType === "image" ? (
                                isSticker ? (
                                  <img src={msg.mediaUrl || undefined} alt="Sticker" className="w-[120px] h-[120px] object-contain drop-shadow-lg" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="max-w-md overflow-hidden rounded-2xl border border-gray-700 bg-[#3a3b3c] p-1">
                                    <img src={msg.mediaUrl || undefined} alt="Hình ảnh" className="max-w-xs max-h-64 object-cover rounded-xl cursor-pointer" />
                                  </div>
                                )
                              ) : isOnlyEmoji ? (
                                <div className="text-[44px] leading-none drop-shadow-md pb-1 drop-shadow-md">
                                  {msg.text}
                                </div>
                              ) : (
                                <div className={`${isMine ? 'bg-[#0084ff] text-white' : 'bg-[#3a3b3c] text-[#e4e6eb]'} text-[15px] px-3.5 py-2 rounded-[18px] max-w-md`}>
                                  {msg.text}
                                </div>
                              )}
                            </>
                          )}

                          {msg.reactions && msg.reactions.length > 0 && !msg.isRecalled && (
                            <div className={`absolute -bottom-2 ${isMine ? 'right-0' : 'left-0'} bg-[#242526] border border-gray-700 rounded-full px-1.5 py-[1px] flex items-center shadow-md z-10 scale-90 origin-bottom`}>
                              {[...new Set(msg.reactions.map(r => r.emoji))].map((emo, idx) => (
                                <span key={idx} className="text-[13px]">{emo}</span>
                              ))}
                              {msg.reactions.length > 1 && (
                                <span className="text-[#b0b3b8] font-medium text-[11px] ml-1">{msg.reactions.length}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {!isMine && !msg.isRecalled && <HoverActions />}
                      </div>

                      {isMine && isLastMessage && msg.isRead && (
                        <div className="flex justify-end mt-1 mr-2 animate-in slide-in-from-top-1 fade-in duration-300">
                          <div className="w-3.5 h-3.5 rounded-full overflow-hidden bg-gray-600 ring-[1.5px] ring-[#242526] shadow-sm">
                            {/* Trích xuất avatar người đã xem an toàn */}
                            {(() => {
                              let seenAvatar = DEFAULT_AVATAR;
                              if (activeConversation && !activeConversation.isGroup) {
                                let partner = activeConversation.participants?.find(p => (p._id || p) !== currentUser.id);
                                if (!partner) partner = activeConversation.participants?.[0]; 
                                if (partner) seenAvatar = partner.avatar || DEFAULT_AVATAR;
                              }
                              return <img src={seenAvatar} alt="Seen" className="w-full h-full object-cover" />;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {isUploading && (
                  <div className="flex justify-end mt-2"><div className="bg-[#3a3b3c] text-xs px-3 py-2 rounded-xl animate-pulse">⏳ Đang tải ảnh...</div></div>
                )}
                
                {isTyping && (
                  <div className="flex items-center gap-2 mb-2 ml-1 z-10 animate-in fade-in duration-300 mt-2">
                    <div className="bg-[#3a3b3c] px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1.5 w-fit h-[36px]">
                      <span className="w-1.5 h-1.5 bg-[#b0b3b8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-[#b0b3b8] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-[#b0b3b8] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* KHU VỰC NHẬP TIN NHẮN */}
              <div className="flex flex-col border-t border-transparent bg-[#242526]">
                {replyingTo && (
                  <div className="px-4 py-2 flex items-center justify-between border-t border-gray-700/50 bg-[#242526] animate-in slide-in-from-bottom-2">
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[13px] font-semibold text-[#b0b3b8]">
                        Đang trả lời {replyingTo.senderId?._id === currentUser.id ? 'chính mình' : (replyingTo.senderId?.name || "người dùng")}
                      </span>
                      <span className="text-[14px] text-gray-400 truncate">
                        {replyingTo.messageType === "image" ? "Đã gửi một ảnh" : replyingTo.text}
                      </span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-[#e4e6eb] bg-[#3a3b3c] rounded-full w-7 h-7 flex items-center justify-center transition">✕</button>
                  </div>
                )}

              <div 
                className="p-2 px-2 sm:p-3 sm:px-4 flex items-center gap-1.5 sm:gap-2 shrink-0 relative w-full"
                onClick={(e) => e.stopPropagation()} 
                >
                  <button className="text-[#0084ff] text-2xl hover:bg-[#3a3b3c] w-9 h-9 flex items-center justify-center rounded-full transition shrink-0">⊕</button>
                  
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  <button onClick={() => fileInputRef.current.click()} className="text-[#0084ff] text-xl hover:bg-[#3a3b3c] w-9 h-9 flex items-center justify-center rounded-full transition relative shrink-0">🖼️</button>

                  <button 
                    onClick={() => {
                      setShowStickerPicker(!showStickerPicker);
                      setShowEmojiPicker(false);
                      setShowSettingsMenu(false);
                    }} 
                    className={`text-[#0084ff] text-[20px] hover:bg-[#3a3b3c] w-9 h-9 flex items-center justify-center rounded-full transition relative shrink-0 ${showStickerPicker ? 'bg-[#3a3b3c]' : ''}`}
                    title="Nhãn dán"
                  >
                    🧸
                  </button>

                  <div className="flex-1 bg-[#3a3b3c] flex items-center rounded-full pl-3 pr-1 relative">
                    <input 
                      ref={inputRef}
                      type="text" 
                      value={inputText}
                      onChange={handleTyping}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Aa" 
                      className="flex-1 bg-transparent py-2.5 outline-none text-[15px] min-w-0"
                    />
                    
                    <button 
                      onClick={() => {
                        setShowEmojiPicker(!showEmojiPicker);
                        setShowStickerPicker(false); 
                        setShowSettingsMenu(false);
                      }}
                      className="text-[#0084ff] text-xl hover:bg-[#4e4f50] w-8 h-8 flex items-center justify-center rounded-full transition shrink-0 ml-1"
                    >
                      {defaultEmojiToInput}
                    </button>
                  </div>
                  
                  <button 
                    onClick={inputText.trim() ? handleSendMessage : handleSendLike} 
                    className="text-[#0084ff] hover:bg-[#3a3b3c] w-10 h-10 flex items-center justify-center rounded-full font-bold transition shrink-0 text-xl"
                  >
                    {inputText.trim() ? "Gửi" : "👍"} 
                  </button>

                  {showStickerPicker && (
                    <div className="absolute bottom-16 left-20 z-50 shadow-2xl bg-[#242526] border border-gray-700 rounded-xl w-[320px] h-[340px] flex flex-col overflow-hidden">
                      <div className="flex items-center gap-1 border-b border-gray-700 p-2 overflow-x-auto bg-[#3a3b3c]/50">
                        {STICKER_PACKS.map(pack => (
                          <button
                            key={pack.id}
                            onClick={() => setActiveStickerTab(pack.id)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition ${activeStickerTab === pack.id ? 'bg-[#4e4f50] border-b-2 border-[#0084ff]' : 'hover:bg-[#3a3b3c]/50'}`}
                          >
                            {pack.icon}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 gap-2">
                        {STICKER_PACKS.find(p => p.id === activeStickerTab)?.stickers.map((url, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => handleSendSticker(url)}
                            className="cursor-pointer hover:bg-[#3a3b3c]/80 p-1.5 rounded-xl flex items-center justify-center transition-colors"
                          >
                            <img src={url || undefined} alt="Sticker" className="w-16 h-16 object-contain hover:scale-110 transition-transform duration-200 drop-shadow-sm" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {showEmojiPicker && (
                    <div className="absolute bottom-16 right-12 z-50 shadow-2xl">
                      <EmojiPicker 
                        theme="dark" 
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
            <div className="flex-1 flex items-center justify-center text-gray-500 flex-col">
              <span className="text-6xl mb-4">💬</span>
              <p>Chọn một người bạn ở cột bên trái hoặc bấm ✏️ để bắt đầu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}