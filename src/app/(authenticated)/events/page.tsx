'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Event = {
  id: string;
  name: string;
  event_date: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  event_type?: string;
  courses: { id: string; name: string } | null;
  event_participants: { id: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: '予定',
  completed: '完了',
  in_progress: '進行中',
  all: 'すべて',
};

const CARD_GRADIENTS = [
  { from: '#1d3937', to: '#195042', textMain: '#ffffff', textSub: 'rgba(255,255,255,0.65)' },
  { from: '#195042', to: '#91855a', textMain: '#ffffff', textSub: 'rgba(255,255,255,0.65)' },
  { from: '#91855a', to: '#d6cabc', textMain: '#1d3937', textSub: 'rgba(29,57,55,0.65)' },
  { from: '#d6cabc', to: '#1d3937', textMain: '#ffffff', textSub: 'rgba(255,255,255,0.65)' },
];

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
            {events.map((event) => {
              const typeIndex: Record<string, number> = { '1': 0, 'regular': 0, '2': 1, 'major': 1, '3': 2, 'final': 2 };
              const g = CARD_GRADIENTS[typeIndex[event.event_type || '1'] ?? 0];
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-lg shadow p-4"
                  style={{ background: `linear-gradient(to right, ${g.from}, ${g.to})` }}
                >
                  <div className="flex items-center gap-4">
                    {/* 1列目：MM/DD・YYYY */}
                    <div className="shrink-0 w-16 text-center border-r pr-3" style={{ borderColor: g.textSub }}>
                      <p className="text-base font-bold" style={{ color: g.textMain }}>{formatDate(event.event_date).slice(5)}</p>
                      <p className="text-xs" style={{ color: g.textSub }}>{formatDate(event.event_date).slice(0, 4)}</p>
                    </div>
                    {/* 2列目：コース・参加者 / イベント名 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {event.courses && (
                          <p className="text-xs truncate" style={{ color: g.textSub }}>{event.courses.name}</p>
                        )}
                        <p className="text-xs shrink-0" style={{ color: g.textSub }}>{event.event_participants?.length || 0}人</p>
                      </div>
                      <p className="font-bold" style={{ color: g.textMain }}>{event.name}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
