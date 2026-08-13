'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

type GroupMember = { player_id: string; players: { id: string; name: string } };
type EventGroup = { id: string; group_number: number; start_time: string; start_hole: number; group_members: GroupMember[] };
type EventInfo = {
  id: string;
  name: string;
  event_groups: EventGroup[];
};

const nineBadge = (startHole: number) => {
  if (startHole === 10) return { label: 'IN', bg: '#BE9B4B', color: '#12211F' };
  if (startHole === 19) return { label: 'EXT', bg: '#2E6B52', color: '#DFF3E8' };
  return { label: 'OUT', bg: '#1F4A3F', color: '#6BAF8E' };
};

export default function SelectGroupPage() {
  const { isViewer } = useAuth();
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvent(data);
    } catch {
      // エラー時は何もしない
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0E1A18' }}>
        <p style={{ color: '#8FA69C' }}>読み込み中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0E1A18' }}>
        <p style={{ color: '#8FA69C' }}>イベントが見つかりません</p>
      </div>
    );
  }

  const groups = event.event_groups?.sort((a, b) => a.group_number - b.group_number) || [];

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#0E1A18' }}>
      <div
        className="flex items-center gap-3 shrink-0"
        style={{ backgroundColor: '#12211F', padding: '18px 20px' }}
      >
        <Link href={`/events/${eventId}`} style={{ color: '#ffffff' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>
            {isViewer ? 'スコア閲覧（組を選択）' : '組を選択'}
          </h1>
          <p style={{ fontSize: '14px', color: '#8FA69C' }}>{event.name}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 p-5 overflow-auto">
        {groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p style={{ color: '#8FA69C' }} className="mb-4">組み合わせが設定されていません</p>
            <button
              onClick={() => router.push(`/events/${eventId}/score`)}
              className="font-bold"
              style={{ padding: '14px 24px', borderRadius: '16px', backgroundColor: '#6BAF8E', color: '#0E1A18' }}
            >
              {isViewer ? '全員のスコアを閲覧' : '全員でスコア入力'}
            </button>
          </div>
        ) : (
          groups.map((group) => {
            const badge = nineBadge(group.start_hole ?? 1);
            return (
              <button
                key={group.id}
                onClick={() => router.push(`/events/${eventId}/score?group=${group.id}`)}
                className="text-left shrink-0"
                style={{ backgroundColor: '#182D28', borderRadius: '18px', padding: '16px 18px' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff' }}>
                      第{group.group_number}組
                    </span>
                    <span
                      className="font-bold"
                      style={{ backgroundColor: badge.bg, color: badge.color, fontSize: '13px', padding: '3px 10px', borderRadius: '999px' }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {group.start_time && (
                    <span className="font-num" style={{ fontSize: '24px', fontWeight: 800, color: '#B9CFC5' }}>
                      {group.start_time.slice(0, 5)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.group_members.map((m) => (
                    <span
                      key={m.player_id}
                      className="text-center"
                      style={{ padding: '11px 0', borderRadius: '12px', backgroundColor: '#12211F', fontSize: '22px', fontWeight: 700, color: '#E4EDE9' }}
                    >
                      {m.players.name}
                    </span>
                  ))}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
