'use client';
import { useEffect, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client'; // 🔥 THÊM IMPORT SOCKET VÀO ĐÂY

export default function CallPage({ params }) {
  const containerRef = useRef(null);
  const zegoInstanceRef = useRef(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callType = searchParams.get('type');

  const unwrappedParams = use(params);
  const roomID = unwrappedParams.roomId;

  useEffect(() => {
    const initCall = async () => {
      if (!roomID) return;
      if (zegoInstanceRef.current) return;

      zegoInstanceRef.current = 'LOADING';

      try {
        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');

        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/login');
          return;
        }
        const currentUser = JSON.parse(userStr);

        // Điền serverSecret và appID trong zegoCloud
        const appID = 2003933466;
        const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SECRET;

        // Tự tạo Token ngay tại máy tính trình duyệt (Không cần Backend nữa)
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomID,
          currentUser._id || currentUser.id || String(Date.now()),
          currentUser.name || 'Người dùng'
        );

        const isVideoCall = callType === 'video';
        const zp = ZegoUIKitPrebuilt.create(kitToken);

        zegoInstanceRef.current = zp;

        // 🔥 BẮT ĐẦU BẤM GIỜ NGAY KHI VÀO PHÒNG
        const startTime = Date.now();

        zp.joinRoom({
          container: containerRef.current,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          turnOnCameraWhenJoining: isVideoCall,
          showPreJoinView: false,
          onLeaveRoom: () => {
            // 1. TÍNH TOÁN THỜI GIAN GỌI
            const durationInSeconds = Math.floor((Date.now() - startTime) / 1000);
            let textLog = '';

            // Nếu thoát quá nhanh (< 2s) => Hủy cuộc gọi. Nếu không thì tính phút/giây.
            if (durationInSeconds < 2) {
              textLog = 'canceled';
            } else {
              const minutes = Math.floor(durationInSeconds / 60);
              const seconds = durationInSeconds % 60;
              textLog = `${minutes} phút ${seconds} giây`;
            }

            // 2. KẾT NỐI SOCKET TẠM THỜI ĐỂ GỬI BÁO CÁO VỀ PHÒNG CHAT
            const tempSocket = io('https://hookchat-e6ad.onrender.com');
            tempSocket.emit('send_message', {
              conversationId: roomID,
              senderId: currentUser._id || currentUser.id, // ID của người đang gọi
              text: textLog,
              messageType: 'call',
              mediaUrl: '',
            });

            // 3. DỌN DẸP ZEGOCLOUD ĐỂ KHÔNG BỊ TREO CAMERA
            if (zegoInstanceRef.current && zegoInstanceRef.current !== 'LOADING') {
              try {
                zegoInstanceRef.current.destroy();
              } catch (e) {}
            }
            zegoInstanceRef.current = null;

            // 4. CHỜ NỬA GIÂY CHO TIN NHẮN BAY ĐI RỒI MỚI VỀ TRANG CHỦ
            setTimeout(() => {
              tempSocket.disconnect();
              window.location.href = '/'; // Chuyển trang cứng để reset state hoàn toàn
            }, 500);
          },
        });
      } catch (error) {
        console.error('Lỗi khởi tạo cuộc gọi:', error);
        zegoInstanceRef.current = null;
      }
    };

    initCall();

    return () => {
      if (zegoInstanceRef.current && zegoInstanceRef.current !== 'LOADING') {
        try {
          zegoInstanceRef.current.destroy();
        } catch (e) {}
        zegoInstanceRef.current = null;
      }
    };
  }, [roomID, router, callType]);

  return <div className='h-screen w-full bg-[#18191a]' ref={containerRef}></div>;
}
