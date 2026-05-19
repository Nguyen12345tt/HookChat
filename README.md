# 🚀 HookChat - Ứng dụng Chat & Video Call Hiện Đại

## 📝 Giới thiệu dự án
**HookChat** là một hệ sinh thái ứng dụng nhắn tin và gọi điện video thời gian thực (Real-time), được xây dựng trên kiến trúc Full-Stack hiện đại. Dự án mô phỏng lại các tính năng cốt lõi của các nền tảng phổ biến như Messenger hay Zalo, mang đến trải nghiệm giao tiếp mượt mà, độ trễ thấp và bảo mật cao.

Dự án được tối ưu hóa cấu trúc mã nguồn, tách biệt hoàn toàn giữa Backend (Node.js) và Frontend (Next.js) nhằm nâng cao khả năng mở rộng, đồng thời tích hợp các giải pháp đám mây tiên tiến nhất hiện nay.

---

## 🌟 Tính năng nổi bật

### 💬 Nhắn tin Real-time
* **Chat 1-1 & Chat Nhóm:** Tự động kiểm tra và khởi tạo phòng chat đơn hoặc nhóm từ 3 thành viên trở lên.
* **Trạng thái hoạt động:** Hiển thị danh sách Online/Offline và thời gian truy cập cuối (`lastSeen`).
* **Hiệu ứng gõ chữ:** Hiển thị "Ai đó đang gõ..." trực quan ngay khi đối phương nhập dữ liệu.
* **Đánh dấu đã xem:** Tự động đánh dấu tin nhắn "Đã xem" khi người dùng vào phòng chat.

### 🛠️ Tương tác tin nhắn
* **Thu hồi & Ghim tin nhắn:** Rút lại tin nhắn đã gửi ở cả 2 phía hoặc ghim các tin nhắn quan trọng lên đầu nhóm.
* **Thả cảm xúc (Reactions):** Thả, đổi hoặc xóa emoji linh hoạt trên từng dòng tin nhắn.
* **Gửi hình ảnh bảo mật:** Tích hợp Cloudinary với cơ chế Upload Signature an toàn từ Backend.

### 📞 Gọi điện Video & Voice (ZegoCloud)
* Tích hợp ZegoCloud WebRTC cho luồng video/audio chất lượng cao, độ trễ thấp.
* Cơ chế khóa chống lặp phòng gọi (`joinRoom repeat`) bảo đảm luồng kết nối ổn định.
* Tự động điều chỉnh Camera/Mic theo chế độ (Video Call hoặc Voice Call).

---

## 💻 Công nghệ sử dụng
* **Frontend:** Next.js 15 (App Router), Tailwind CSS, Axios, ZegoCloud UIKit.
* **Backend:** Node.js, Express, Socket.IO.
* **Cơ sở dữ liệu & Lưu trữ:** MongoDB Cloud Atlas, Mongoose, Cloudinary.

---

## 📂 Cấu trúc thư mục

```text
HookChat/
├── backend/               # Hệ thống máy chủ API & Socket.IO
│   ├── models/            # Schema MongoDB (User, Message, Conversation)
│   ├── routes/            # API xử lý Chat, Auth, Upload...
│   ├── server.js          # File khởi chạy trung tâm
│   └── .env               # File chứa biến môi trường Database/Cloudinary (Đã giấu)
└── frontend/              # Giao diện người dùng
    ├── src/app/           # Next.js App Router
    ├── public/            # Tài nguyên tĩnh
    └── .env.local         # Biến môi trường chứa Key ZegoCloud (Đã giấu)
```

## 🚀 Hướng dẫn cài đặt & Khởi chạy
### Để chạy thử nghiệm hệ thống dưới môi trường máy tính cá nhân (Localhost), hãy thực hiện tuần tự theo các bước sau:

⚙️ Bước 1: Khởi động Backend (Máy chủ)

1. Mở Terminal và di chuyển vào thư mục backend:
```sh
cd backend
```

2. Cài đặt các thư viện cần thiết:
```sh
npm install
```

3. Tạo file .env (nằm ngang hàng với server.js) và điền các thông số bảo mật:
```text
MONGO_URL=chuỗi_kết_nối_mongodb_của_bạn
CLOUDINARY_CLOUD_NAME=tên_tài_khoản_cloudinary
CLOUDINARY_API_KEY=mã_api_key_cloudinary
CLOUDINARY_API_SECRET=mã_api_secret_cloudinary
```

4. Khởi chạy server:
```sh
npm start
```
hoặc
```sh
npm run dev
```
(Thành công khi báo: Server đang chạy tại cổng 5000 và kết nối DB thành công).

💻 Bước 2: Khởi động Frontend (Giao diện)

1. Mở một Terminal mới, di chuyển vào thư mục frontend:
```sh
cd frontend
```
2. Cài đặt các gói thư viện giao diện:
```sh
npm install
```
3. Tạo file .env.local (nằm ngang hàng với package.json) và cấu hình khóa bảo mật cuộc gọi (ZegoCloud):
```text
NEXT_PUBLIC_ZEGO_SECRET=mã_secret_key_32_ký_tự_của_bạn
```
4. Khởi chạy ứng dụng (trang web):
```sh
npm run dev
```
(Mở trình duyệt tại địa chỉ http://localhost:3000 để trải nghiệm).
