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

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type EventTypeKey = 'major' | 'final' | 'regular';

const EVENT_TYPE_INFO: Record<EventTypeKey, { label: string; accent: string; pillText: string; date: string }> = {
  major: { label: 'メジャー', accent: '#BE9B4B', pillText: '#12211F', date: '#BE9B4B' },
  final: { label: '最終戦', accent: '#B45B3C', pillText: '#FFFFFF', date: '#E5B39C' },
  regular: { label: '通常大会', accent: '#25574F', pillText: '#B9CFC5', date: '#6BAF8E' },
};

const eventTypeKey = (eventType?: string): EventTypeKey => {
  if (eventType === '2' || eventType === 'major') return 'major';
  if (eventType === '3' || eventType === 'final') return 'final';
  return 'regular';
};

// 大会種別の見た目（左端カラーバー・種別ピル・日付の色）。終了済みは種別を問わずミュートする
const eventTypeStyle = (eventType: string | undefined, isCompleted: boolean) => {
  const info = EVENT_TYPE_INFO[eventTypeKey(eventType)];
  if (isCompleted) {
    return { label: info.label, accent: '#2E4A43', pillBg: '#1B322C', pillText: '#8FA69C', date: '#8FA69C' };
  }
  return { label: info.label, accent: info.accent, pillBg: info.accent, pillText: info.pillText, date: info.date };
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

  const dateParts = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      md: `${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`,
      year: d.getFullYear(),
      weekday: WEEKDAYS[d.getDay()],
    };
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header style={{ backgroundColor: '#12211F', padding: '22px 20px 14px' }}>
        <p className="font-num" style={{ fontSize: '12px', fontWeight: 700, color: '#6BAF8E', letterSpacing: '.18em' }}>
          2026 SEASON
        </p>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff' }}>イベント</h1>
      </header>

      <main className="p-5 space-y-4">
        {/* ステータスフィルタ */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="font-bold transition-colors"
              style={{
                padding: '9px 18px',
                borderRadius: '999px',
                fontSize: '14px',
                backgroundColor: filter === key ? '#6BAF8E' : '#1B322C',
                color: filter === key ? '#0E1A18' : '#8FA69C',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* イベント一覧 */}
        {loading ? (
          <p style={{ color: '#8FA69C' }} className="text-sm">読み込み中...</p>
        ) : events.length === 0 ? (
          <p style={{ color: '#8FA69C' }} className="text-sm">イベントがありません</p>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => {
              const { md, year, weekday } = dateParts(event.event_date);
              const isCompleted = event.status === 'completed';
              const isFeatured = !isCompleted && index === 0 && filter === 'upcoming';
              const type = eventTypeStyle(event.event_type, isCompleted);

              if (isFeatured) {
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block"
                    style={{
                      backgroundColor: '#1F4A3F',
                      border: '1px solid #2E6B52',
                      borderLeft: `6px solid ${type.accent}`,
                      borderRadius: '18px',
                      padding: '18px 20px 20px',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="font-bold"
                        style={{ backgroundColor: type.pillBg, color: type.pillText, fontSize: '13px', padding: '5px 12px', borderRadius: '999px' }}
                      >
                        {type.label}
                      </span>
                      <span style={{ fontSize: '13px', color: '#8FA69C' }}>{STATUS_LABELS[event.status]}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-num" style={{ fontSize: '44px', fontWeight: 800, color: type.date, lineHeight: 1 }}>{md}</span>
                      <span style={{ fontSize: '15px', color: '#8FA69C' }}>{year} ({weekday})</span>
                    </div>
                    <p style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff' }}>{event.name}</p>
                    <p style={{ fontSize: '15px', color: '#8FA69C' }}>
                      {event.courses?.name}
                      {event.courses && ' · '}
                      {event.event_participants?.length || 0}人
                    </p>
                  </Link>
                );
              }

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center gap-4"
                  style={{
                    backgroundColor: isCompleted ? '#141F1D' : '#182D28',
                    opacity: isCompleted ? 0.75 : 1,
                    borderLeft: `6px solid ${type.accent}`,
                    borderRadius: '18px',
                    padding: '13px 18px',
                  }}
                >
                  <div className="shrink-0">
                    <span
                      className="font-num block"
                      style={{ fontSize: '26px', fontWeight: 800, color: type.date }}
                    >
                      {md}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block font-bold mb-1"
                      style={{ backgroundColor: type.pillBg, color: type.pillText, fontSize: '12px', padding: '4px 10px', borderRadius: '999px' }}
                    >
                      {type.label}
                    </span>
                    <p
                      className="font-bold truncate"
                      style={{ fontSize: '21px', color: isCompleted ? '#C9D8D2' : '#ffffff' }}
                    >
                      {event.name}
                    </p>
                    <p style={{ fontSize: '13px', color: '#8FA69C' }}>
                      {event.courses?.name}
                      {event.courses && ' · '}
                      {event.event_participants?.length || 0}人
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px] shrink-0" style={{ color: '#3E574F' }}>
                    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l6.5 6.5a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 11-1.06-1.06L14.19 12 8.22 6.03a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
