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
  const [filter, setFilter] = useState('all');
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
      <header className="bg-[#1d3937] text-white px-4 py-3">
        <h1 className="text-lg font-bold">イベント一覧</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* ステータスフィルタ */}
        <div className="flex">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-[#1d3937] text-white'
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
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-[#1d3937]">{event.name}</p>
                    <p className="text-sm text-[#91855a] mt-1">
                      {formatDate(event.event_date)}
                    </p>
                    {event.courses && (
                      <p className="text-sm text-[#91855a]">{event.courses.name}</p>
                    )}
                    <p className="text-xs text-[#91855a] mt-1">
                      参加者: {event.event_participants?.length || 0}人
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[event.status]}`}>
                    {STATUS_LABELS[event.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
