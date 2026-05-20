'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function Login() {
  const router = useRouter();

  // Các state quản lý form
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State quản lý trạng thái tải
  const [isLoading, setIsLoading] = useState(false);

  // 🔥 STATE QUẢN LÝ THÔNG BÁO NỔI (TOAST)
  const [toast, setToast] = useState(null);

  // Hàm hiển thị Toast (tự động tắt sau 3 giây)
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Vẫn giữ để nếu có ai gửi link /login?mode=register thì nó tự mở form đăng ký lúc tải trang
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');

      if (mode === 'register') {
        setIsLoginMode(false);
      } else {
        setIsLoginMode(true);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
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

        // 2. Hiện Toast Thành công và đợi 1 giây rồi mới vào trang Chủ cho mượt
        showToast('Đăng nhập thành công!', 'success');
        setTimeout(() => {
          window.location.href = '/'; // Ép tải lại trang cứng để kết nối Socket tươi mới 100%
        }, 1000);
      } else {
        // GỌI API ĐĂNG KÝ
        await axios.post('https://hookchat-e6ad.onrender.com/api/auth/register', {
          name,
          email,
          password,
        });

        // Hiện Toast Thành công thay vì alert()
        showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
        setName('');
        setEmail('');
        setPassword('');

        // 🔥 Tự động trượt về form Login sau 1.5 giây
        setTimeout(() => {
          setIsLoginMode(true);
        }, 1500);
      }
    } catch (err) {
      // Bắt lỗi từ Backend trả về (như sai pass, trùng email...) và hiện Toast Đỏ
      showToast(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại!', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='relative flex min-h-screen flex-col justify-center bg-gray-100 py-12 transition-colors duration-300 sm:px-6 lg:px-8 dark:bg-[#18191a]'>
      {/* --- 🔥 TOAST THÔNG BÁO NỔI GÓC PHẢI TRÊN 🔥 --- */}
      {toast && (
        <div className='animate-in slide-in-from-right-8 fade-in fixed top-6 right-4 z-[9999] flex duration-300'>
          <div className='flex items-center gap-3 rounded-xl border border-gray-700 bg-[#242526] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'>
            {toast.type === 'success' ? (
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500'>
                {/* ICON DẤU TÍCH XANH (Thành công) */}
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
                {/* ICON DẤU X ĐỎ (Thất bại) */}
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
            {/* 🔥 FIX SAFARI 16: Chỉ thay đổi State để trượt Form, KHÔNG GỌI router.push */}
            {isLoginMode ? (
              <button
                type='button'
                onClick={() => {
                  setToast(null); // Tắt thông báo cũ nếu có
                  setIsLoginMode(false); // Chuyển Form tại chỗ
                }}
                className='inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30'
              >
                Chưa có tài khoản? Đăng ký ngay
              </button>
            ) : (
              <button
                type='button'
                onClick={() => {
                  setToast(null); // Tắt thông báo cũ nếu có
                  setIsLoginMode(true); // Chuyển Form tại chỗ
                }}
                className='inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30'
              >
                Đã có tài khoản? Quay lại Đăng nhập
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
