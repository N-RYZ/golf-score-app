import type { Metadata, Viewport } from 'next';
import { Zen_Kaku_Gothic_New, Archivo } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-jp',
  display: 'swap',
});

const archivo = Archivo({
  weight: ['500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-num',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ゴルフスコア管理',
  description: '月例会スコア管理システム',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0E1A18',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${zenKaku.variable} ${archivo.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
