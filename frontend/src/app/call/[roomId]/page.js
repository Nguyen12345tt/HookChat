'use client';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { io } from 'socket.io-client';

export default function CallPage() {
  const containerRef = useRef(null);
  const zegoInstanceRef = useRef(null);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const callType = searchParams.get('type');
  const roomID = Array.isArray(params?.roomId) ? params.roomId[0] : params?.roomId;

  useEffect(() => {
    const initCall = async () => {
      if (!roomID || !containerRef.current) return;
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
        if (!serverSecret) {
          alert('Thiếu cấu hình cuộc gọi. Vui lòng thử lại sau!');
          router.replace('/');
          return;
        }

        // Tự tạo Token ngay tại máy tính trình duyệt
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

          // 🔥 TÍNH NĂNG 1: TỰ ĐỘNG THOÁT KHI NGƯỜI KIA CÚP MÁY
          onUserLeave: (users) => {
            if (zegoInstanceRef.current && zegoInstanceRef.current !== 'LOADING') {
              try {
                zegoInstanceRef.current.destroy();
              } catch (e) {}
            }
            window.location.href = '/';
          },

          // 🔥 TÍNH NĂNG 2 & 3: LƯU THỜI GIAN CHUẨN VÀ ÉP CHỜ SOCKET KẾT NỐI
          onLeaveRoom: () => {
            const durationInSeconds = Math.floor((Date.now() - startTime) / 1000);
            let textLog = '';

            // Nếu gọi dưới 2 giây thì coi như Hủy
            if (durationInSeconds < 2) {
              textLog = 'canceled';
            } else {
              // Tính Giờ - Phút - Giây
              const hours = Math.floor(durationInSeconds / 3600);
              const minutes = Math.floor((durationInSeconds % 3600) / 60);
              const seconds = durationInSeconds % 60;

              if (hours > 0) {
                textLog = `${hours} giờ ${minutes} phút ${seconds} giây`;
              } else {
                textLog = `${minutes} phút ${seconds} giây`;
              }
            }

            // Mở Socket kết nối lên Server
            const tempSocket = io('https://hookchat-e6ad.onrender.com');

            // BẮT BUỘC ĐỢI CONNECT XONG MỚI GỬI
            tempSocket.on('connect', () => {
              tempSocket.emit('send_message', {
                conversationId: roomID,
                senderId: currentUser._id || currentUser.id,
                text: textLog,
                messageType: 'call',
                mediaUrl: '',
              });

              // Đợi thêm 500ms cho tin nhắn vào DB rồi mới về bờ
              setTimeout(() => {
                tempSocket.disconnect();
                window.location.href = '/';
              }, 500);
            });

            // Dự phòng: Mạng lag không connect được trong 2.5s thì vẫn ép thoát để không bị treo đen xì
            setTimeout(() => {
              window.location.href = '/';
            }, 2500);

            // DỌN DẸP ZEGOCLOUD ĐỂ KHÔNG BỊ KẸT CAMERA/MIC TRÊN ĐIỆN THOẠI
            if (zegoInstanceRef.current && zegoInstanceRef.current !== 'LOADING') {
              try {
                zegoInstanceRef.current.destroy();
              } catch (e) {}
            }
            zegoInstanceRef.current = null;
          },
        });
      } catch (error) {
        console.error('Lỗi khởi tạo cuộc gọi:', error);
        zegoInstanceRef.current = null;
        alert('Không thể tải trang cuộc gọi. Vui lòng thử lại!');
        router.replace('/');
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
