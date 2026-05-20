'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function Login() {
  const router = useRouter();

  // Các state quản lý form
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State quản lý trạng thái tải và lỗi
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // GỌI API ĐĂNG NHẬP
        const res = await axios.post('https://hookchat-e6ad.onrender.com/api/auth/login', {
          email,
          password,
        });

        // 1. Cất Token và Thông tin User vào trình duyệt
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        // 2. Đá người dùng vào trang Chat (Trang chủ)
        router.push('/');
      } else {
        // GỌI API ĐĂNG KÝ
        await axios.post('https://hookchat-e6ad.onrender.com/api/auth/register', {
          name,
          email,
          password,
        });

        alert('Đăng ký thành công! Vui lòng đăng nhập lại.');
        setIsLoginMode(true); // Tự động lật sang form đăng nhập
        setPassword(''); // Xóa pass cũ đi cho an toàn
      }
    } catch (err) {
      // Bắt lỗi từ Backend trả về (như sai pass, trùng email...)
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen flex-col justify-center bg-gray-100 py-12 transition-colors duration-300 sm:px-6 lg:px-8 dark:bg-[#18191a]'>
      <div className='text-center sm:mx-auto sm:w-full sm:max-w-md'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 shadow-lg'>
          <span className='text-3xl text-white'>💬</span>
        </div>
        <h2 className='text-center text-3xl font-extrabold text-gray-900 dark:text-white'>
          HookChat
        </h2>
        <p className='mt-2 text-center text-sm text-gray-600 dark:text-gray-400'>
          Kết nối với mọi người mọi lúc, mọi nơi
        </p>
      </div>

      <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
        <div className='border border-gray-200 bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10 dark:border-gray-700 dark:bg-[#242526]'>
          <h3 className='mb-6 text-center text-xl font-bold text-gray-800 dark:text-gray-100'>
            {isLoginMode ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
          </h3>

          <form className='space-y-6' onSubmit={handleSubmit}>
            {/* Hiện ô Nhập tên nếu đang ở chế độ Đăng ký */}
            {!isLoginMode && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                  Tên hiển thị
                </label>
                <div className='mt-1'>
                  <input
                    type='text'
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className='block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-[#3a3b3c] dark:text-white'
                    placeholder='Nguyễn Văn A'
                  />
                </div>
              </div>
            )}

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Email
              </label>
              <div className='mt-1'>
                <input
                  type='email'
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-[#3a3b3c] dark:text-white'
                  placeholder='name@example.com'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Mật khẩu
              </label>
              <div className='mt-1'>
                <input
                  type='password'
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-[#3a3b3c] dark:text-white'
                  placeholder='••••••••'
                />
              </div>
            </div>

            {/* Khung báo lỗi màu đỏ */}
            {error && (
              <div className='rounded bg-red-50 p-2 text-center text-sm text-red-500 dark:bg-red-900/30'>
                {error}
              </div>
            )}

            <div>
              <button
                type='submit'
                disabled={isLoading}
                className='flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
              >
                {isLoading ? 'Đang xử lý...' : isLoginMode ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            </div>
          </form>

          <div className='mt-6 text-center'>
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsLoginMode((prev) => !prev);
                setError('');
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                setIsLoginMode((prev) => !prev);
                setError('');
              }}
              className='inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 active:bg-blue-50 dark:text-blue-400 dark:active:bg-[#3a3b3c]'
            >
              {isLoginMode
                ? 'Chưa có tài khoản? Đăng ký ngay'
                : 'Đã có tài khoản? Quay lại Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
