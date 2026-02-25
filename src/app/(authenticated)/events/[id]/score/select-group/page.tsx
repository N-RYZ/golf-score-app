'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type GroupMember = { player_id: string; players: { id: string; name: string } };
type EventGroup = { id: string; group_number: number; start_time: string; group_members: GroupMember[] };
type EventInfo = {
  id: string;
  name: string;
  event_groups: EventGroup[];
};

export default function SelectGroupPage() {
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
      <div className="min-h-screen flex items-center justify-center bg-[#d6cabc]/30">
        <p className="text-[#91855a]">読み込み中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#d6cabc]/30">
        <p className="text-[#91855a]">イベントが見つかりません</p>
      </div>
    );
  }

  const groups = event.event_groups?.sort((a, b) => a.group_number - b.group_number) || [];

  return (
    <div className="h-screen flex flex-col bg-[#d6cabc]/30">
      <div className="bg-gradient-to-r from-[#1d3937] to-[#195042] text-white px-4 py-4 flex items-center gap-3 shrink-0">
        <Link href={`/events/${eventId}`} className="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold">組を選択</h1>
      </div>

      <div className="flex-1 flex flex-col gap-3 p-4 overflow-auto">
        {groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-[#91855a] mb-4">組み合わせが設定されていません</p>
            <button
              onClick={() => router.push(`/events/${eventId}/score`)}
              className="px-6 py-3 bg-gradient-to-r from-[#1d3937] to-[#195042] text-white font-bold rounded-lg"
            >
              全員でスコア入力
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <button
              key={group.id}
              onClick={() => router.push(`/events/${eventId}/score?group=${group.id}`)}
              className="h-[20vh] bg-white rounded-lg shadow-sm px-5 py-3 text-left hover:bg-[#d6cabc]/20 transition-colors flex flex-col justify-center shrink-0"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-2xl text-[#1d3937]">
                  第{group.group_number}組
                </span>
                {group.start_time && (
                  <span className="text-2xl font-bold text-[#91855a]">
                    {group.start_time.slice(0, 5)} START
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.group_members.map((m) => (
                  <span
                    key={m.player_id}
                    className="py-2 bg-[#d6cabc] text-[#1d3937] rounded-lg text-xl font-medium text-center"
                  >
                    {m.players.name}
                  </span>
                ))}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
