'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Event = {
  id: string;
  name: string;
  event_date: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  courses: { id: string; name: string } | null;
  event_participants: { id: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: '予定',
  completed: '完了',
  in_progress: '進行中',
  all: 'すべて',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-[#d6cabc] text-[#1d3937]',
  in_progress: 'bg-[#195042] text-white',
  completed: 'bg-[#91855a] text-white',
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/events?status=${filter}`);
    if (res.ok) {
      setEvents(await res.json());
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#d6cabc]/30">
      <header className="bg-gradient-to-r from-[#1d3937] to-[#195042] text-white px-4 py-3">
        <h1 className="text-lg font-bold">イベント一覧</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* ステータスフィルタ */}
        <div className="flex">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 py-3 text-lg font-medium transition-colors ${
                filter === key
                  ? 'bg-gradient-to-r from-[#1d3937] to-[#195042] text-white'
                  : 'bg-white text-[#91855a] border border-[#d6cabc]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* イベント一覧 */}
        {loading ? (
          <p className="text-[#91855a] text-sm">読み込み中...</p>
        ) : events.length === 0 ? (
          <p className="text-[#91855a] text-sm">イベントがありません</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block bg-white rounded-lg shadow p-4"
              >
                <div className="flex items-center gap-4">
                  {/* 1列目：MM/DD・YYYY */}
                  <div className="shrink-0 w-16 text-center border-r border-[#d6cabc] pr-3">
                    <p className="text-base font-bold text-[#1d3937]">{formatDate(event.event_date).slice(5)}</p>
                    <p className="text-xs text-[#91855a]">{formatDate(event.event_date).slice(0, 4)}</p>
                  </div>
                  {/* 2列目：コース・参加者 / イベント名・ステータス */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {event.courses && (
                        <p className="text-xs text-[#91855a] truncate">{event.courses.name}</p>
                      )}
                      <p className="text-xs text-[#91855a] shrink-0">{event.event_participants?.length || 0}人</p>
                    </div>
                    <p className="font-bold text-[#1d3937]">{event.name}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
