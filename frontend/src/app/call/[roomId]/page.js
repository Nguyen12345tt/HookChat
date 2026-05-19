"use client";
import { useEffect, useRef, use } from 'react';
import { useRouter, useSearchParams } from "next/navigation";

export default function CallPage({ params }) {
  const containerRef = useRef(null);
  const zegoInstanceRef = useRef(null); 
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const callType = searchParams.get("type"); 
  
  const unwrappedParams = use(params);
  const roomID = unwrappedParams.roomId;

  useEffect(() => {
    const initCall = async () => {
      if (!roomID) return;
      if (zegoInstanceRef.current) return; 

      zegoInstanceRef.current = "LOADING";

      try {
        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');

        const userStr = localStorage.getItem("user");
        if (!userStr) {
          router.push("/login");
          return;
        }
        const currentUser = JSON.parse(userStr);

        // 🛑 BÁC ĐIỀN ĐÚNG 2 THÔNG TIN CỦA BÁC VÀO ĐÂY LÀ XONG:
        const appID = 2003933466; 
        const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SECRET;
        
        // Tự tạo Token ngay tại máy tính trình duyệt (Không cần Backend nữa)
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID, 
          serverSecret, 
          roomID, 
          currentUser._id || currentUser.id || String(Date.now()), 
          currentUser.name || "Người dùng"
        );

        const isVideoCall = callType === 'video';
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        
        zegoInstanceRef.current = zp; 

        zp.joinRoom({
          container: containerRef.current,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          turnOnCameraWhenJoining: isVideoCall, 
          showPreJoinView: false, 
          onLeaveRoom: () => {
            if (zegoInstanceRef.current && zegoInstanceRef.current !== "LOADING") {
              try { zegoInstanceRef.current.destroy(); } catch(e){}
            }
            zegoInstanceRef.current = null;
            router.push('/'); 
          }
        });
      } catch (error) {
        console.error("Lỗi khởi tạo cuộc gọi:", error);
        zegoInstanceRef.current = null; 
      }
    };

    initCall();

    return () => {
      if (zegoInstanceRef.current && zegoInstanceRef.current !== "LOADING") {
        try { zegoInstanceRef.current.destroy(); } catch(e) {}
        zegoInstanceRef.current = null;
      }
    };
  }, [roomID, router, callType]); 

  return (
    <div className="w-full h-screen bg-[#18191a]" ref={containerRef}></div>
  );
}