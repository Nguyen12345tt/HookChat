import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'HookChat',
  description: 'A simple and intuitive chat application built with React and Node.js.',
  icons: {
    icon: '/chat.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang='en' className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className='flex min-h-full flex-col'>
        {children}
      </body>
    </html>
  );
}
