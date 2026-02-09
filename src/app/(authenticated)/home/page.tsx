'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Event = {
  id: string;
  name: string;
  event_date: string;
  status: string;
  courses: { name: string } | null;
  event_participants: { id: string }[];
};

type MyStats = {
  avg_score: number | null;
  best_score: number | null;
  event_count: number;
  total_penalty: number;
};

export default function HomePage() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [myStats, setMyStats] = useState<MyStats | null>(null);

  const fetchData = useCallback(async () => {
    // 直近イベント取得
    const eventsRes = await fetch('/api/events?status=all');
    if (eventsRes.ok) {
      const events = await eventsRes.json();
      setRecentEvents(events.slice(0, 3));
    }

    // 年間成績取得
    if (user) {
      const year = new Date().getFullYear();
      const annualRes = await fetch(`/api/annual?year=${year}`);
      if (annualRes.ok) {
        const data = await annualRes.json();
        const me = data.rankings?.find((r: { user_id: string }) => r.user_id === user.id);
        if (me) {
          setMyStats({
            avg_score: me.avg_score,
            best_score: me.best_score,
            event_count: me.event_count,
            total_penalty: me.total_penalty,
          });
        }
      }
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };

  const statusLabel: Record<string, string> = {
    upcoming: '予定',
    in_progress: '進行中',
    completed: '完了',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-[#166534] text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">ゴルフスコア管理</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm">{user?.name}</span>
          {user?.role === 'admin' && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1"
                aria-label="管理メニュー"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-10 bg-white text-gray-800 rounded-lg shadow-lg py-2 w-48 z-50">
                    <Link href="/admin/members" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>
                      メンバー管理
                    </Link>
                    <Link href="/admin/courses" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>
                      コース管理
                    </Link>
                    <Link href="/admin/events/new" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>
                      イベント作成
                    </Link>
                    <Link href="/admin/csv" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>
                      CSV出力
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4 space-y-6">
        {/* 直近イベント */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-3">直近のイベント</h2>
          {recentEvents.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-500 text-sm">まだイベントがありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block bg-white rounded-lg shadow p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{event.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(event.event_date)}
                        {event.courses && ` - ${event.courses.name}`}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                      {statusLabel[event.status] || event.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 自分の成績サマリー */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            {new Date().getFullYear()}年 成績サマリー
          </h2>
          {myStats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{myStats.avg_score ?? '-'}</p>
                <p className="text-xs text-gray-500 mt-1">平均スコア</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{myStats.best_score ?? '-'}</p>
                <p className="text-xs text-gray-500 mt-1">ベストスコア</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{myStats.event_count}</p>
                <p className="text-xs text-gray-500 mt-1">参加回数</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className={`text-2xl font-bold ${myStats.total_penalty > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {myStats.total_penalty.toLocaleString()}円
                </p>
                <p className="text-xs text-gray-500 mt-1">罰金累計</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-500 text-sm">まだ成績データがありません</p>
            </div>
          )}
        </section>

        {/* ログアウト */}
        <button
          onClick={logout}
          className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
        >
          ログアウト
        </button>
      </main>
    </div>
  );
}
