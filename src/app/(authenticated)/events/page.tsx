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
  all: 'すべて',
  upcoming: '予定',
  in_progress: '進行中',
  completed: '完了',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#166534] text-white px-4 py-3">
        <h1 className="text-lg font-bold">イベント一覧</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* ステータスフィルタ */}
        <div className="flex gap-2 overflow-x-auto">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-[#166534] text-white'
                  : 'bg-white text-gray-600 border border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* イベント一覧 */}
        {loading ? (
          <p className="text-gray-500 text-sm">読み込み中...</p>
        ) : events.length === 0 ? (
          <p className="text-gray-500 text-sm">イベントがありません</p>
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
                    <p className="font-bold text-gray-800">{event.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(event.event_date)}
                    </p>
                    {event.courses && (
                      <p className="text-sm text-gray-500">{event.courses.name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
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
