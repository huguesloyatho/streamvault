import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'StreamVault - Your Personal IPTV Experience',
  description: 'Modern IPTV streaming application with Netflix-like interface',
  keywords: ['IPTV', 'streaming', 'TV', 'live TV', 'movies', 'series'],
  authors: [{ name: 'StreamVault' }],
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#141414',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
