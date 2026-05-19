"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function Login() {
  const router = useRouter();
  
  // Các state quản lý form
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // State quản lý trạng thái tải và lỗi
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // GỌI API ĐĂNG NHẬP
        const res = await axios.post("https://hookchat-e6ad.onrender.com/api/auth/login", {
          email,
          password,
        });
        
        // 1. Cất Token và Thông tin User vào trình duyệt
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        
        // 2. Đá người dùng vào trang Chat (Trang chủ)
        router.push("/");
      } else {
        // GỌI API ĐĂNG KÝ
        await axios.post("https://hookchat-e6ad.onrender.com/api/auth/register", {
          name,
          email,
          password,
        });
        
        alert("Đăng ký thành công! Vui lòng đăng nhập lại.");
        setIsLoginMode(true); // Tự động lật sang form đăng nhập
        setPassword(""); // Xóa pass cũ đi cho an toàn
      }
    } catch (err) {
      // Bắt lỗi từ Backend trả về (như sai pass, trùng email...)
      setError(err.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#18191a] flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center shadow-lg mb-4">
          <span className="text-3xl text-white">💬</span>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          HookChat
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Kết nối với mọi người mọi lúc, mọi nơi
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#242526] py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200 dark:border-gray-700">
          
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
            {isLoginMode ? "Đăng nhập tài khoản" : "Tạo tài khoản mới"}
          </h3>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Hiện ô Nhập tên nếu đang ở chế độ Đăng ký */}
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tên hiển thị
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-[#3a3b3c] text-gray-900 dark:text-white"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-[#3a3b3c] text-gray-900 dark:text-white"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mật khẩu
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-[#3a3b3c] text-gray-900 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Khung báo lỗi màu đỏ */}
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/30 p-2 rounded">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
              >
                {isLoading ? "Đang xử lý..." : (isLoginMode ? "Đăng nhập" : "Đăng ký")}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError("");
              }}
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {isLoginMode
                ? "Chưa có tài khoản? Đăng ký ngay"
                : "Đã có tài khoản? Quay lại Đăng nhập"}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}