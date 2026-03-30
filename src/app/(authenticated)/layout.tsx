'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { FooterNav } from '@/components/footer-nav';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isViewer } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // フッターナビゲーションを表示するパス
  const showFooterPaths = ['/events', '/annual', '/admin'];
  // スコア入力画面・組選択画面ではフッターを非表示
  const isScoreInputPage = /\/events\/[^/]+\/score/.test(pathname);
  const shouldShowFooter = showFooterPaths.some(path => pathname === path || pathname.startsWith(path + '/')) && !isScoreInputPage;

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // 閲覧モードユーザーは管理者ページへのアクセス不可
  useEffect(() => {
    if (!loading && isViewer && pathname.startsWith('/admin')) {
      router.replace('/events');
    }
  }, [isViewer, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#91855a]">読み込み中...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={shouldShowFooter ? "min-h-screen pb-14" : "min-h-screen"}>
      {isViewer && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-xs font-bold py-1 pointer-events-none">
          閲覧モード（データの更新はできません）
        </div>
      )}
      <div className={isViewer ? "pt-6" : ""}>
        {children}
      </div>
      {shouldShowFooter && <FooterNav />}
    </div>
  );
}
