'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type Event = {
  id: string;
  name: string;
  event_date: string;
  status: string;
};

export default function CsvPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    const res = await fetch('/api/events?status=all');
    if (res.ok) {
      setEvents(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/admin');
      return;
    }
    fetchEvents();

    // デフォルト期間: 今年
    const year = new Date().getFullYear();
    setStartDate(`${year}-01-01`);
    setEndDate(`${year}-12-31`);
  }, [user, router, fetchEvents]);

  const downloadEventCsv = async (eventId: string) => {
    setDownloading(eventId);
    try {
      const res = await fetch(`/api/admin/csv?event_id=${eventId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`エラー: ${err.error || res.status}`);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const rfc5987 = disposition.match(/filename\*=UTF-8''(.+)/);
      const legacy = disposition.match(/filename="(.+)"/);
      const match = rfc5987 || legacy;
      const filename = match ? decodeURIComponent(match[1]) : 'scores.csv';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const downloadBulkCsv = async () => {
    if (!startDate || !endDate) return;
    setDownloading('bulk');
    try {
      const res = await fetch(`/api/admin/csv?start_date=${startDate}&end_date=${endDate}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`エラー: ${err.error || res.status}`);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const rfc5987 = disposition.match(/filename\*=UTF-8''(.+)/);
      const legacy = disposition.match(/filename="(.+)"/);
      const match = rfc5987 || legacy;
      const filename = match ? match[1] : 'all_scores.csv';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header className="flex items-center gap-3" style={{ backgroundColor: '#12211F', padding: '16px 20px' }}>
        <button onClick={() => router.push('/admin')} style={{ color: '#ffffff' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>CSV出力</h1>
      </header>

      <main className="p-5 space-y-6">
        {/* 期間一括出力 */}
        <section className="space-y-3" style={{ backgroundColor: '#182D28', borderRadius: '18px', padding: '18px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>期間一括出力</h2>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
            />
            <span style={{ color: '#8FA69C' }}>〜</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
            />
          </div>
          <button
            onClick={downloadBulkCsv}
            disabled={downloading === 'bulk'}
            className="w-full flex items-center justify-center disabled:opacity-50"
            style={{ height: '56px', borderRadius: '16px', backgroundColor: '#BE9B4B' }}
          >
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#1B1608' }}>
              {downloading === 'bulk' ? 'ダウンロード中...' : '一括ダウンロード'}
            </span>
          </button>
        </section>

        {/* イベント単位出力 */}
        <section>
          <h2 className="mb-3" style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>イベント単位出力</h2>
          {loading ? (
            <p style={{ color: '#8FA69C' }} className="text-sm">読み込み中...</p>
          ) : events.length === 0 ? (
            <p style={{ color: '#8FA69C' }} className="text-sm">イベントがありません</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const notPlayed = event.status !== 'completed';
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between"
                    style={{
                      backgroundColor: notPlayed ? '#141F1D' : '#182D28',
                      opacity: notPlayed ? 0.6 : 1,
                      borderRadius: '16px',
                      padding: '16px',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{event.name}</p>
                      <p className="font-num" style={{ fontSize: '12px', color: '#8FA69C' }}>{formatDate(event.event_date)}</p>
                    </div>
                    <button
                      onClick={() => downloadEventCsv(event.id)}
                      disabled={downloading === event.id}
                      className="font-bold disabled:opacity-50"
                      style={{ padding: '6px 16px', borderRadius: '999px', fontSize: '13px', backgroundColor: '#1F4A3F', color: '#B9CFC5' }}
                    >
                      {downloading === event.id ? '...' : 'CSV'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
