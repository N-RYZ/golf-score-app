'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type CourseHole = { hole_number: number; par: number };
type Score = { player_id: string; hole_number: number; strokes: number; putts: number };
type Participant = { player_id: string; players: { id: string; name: string } };
type GroupMember = { player_id: string };
type EventGroup = { id: string; group_number: number; group_members: GroupMember[] };
type EventDetail = {
  id: string;
  name: string;
  courses: { name: string; course_holes: CourseHole[] } | null;
  event_participants: Participant[];
  event_groups: EventGroup[];
  scores: Score[];
};

const strokeColor = (strokeVal: number, diffVal: number) => {
  if (strokeVal <= 0) return '#3E574F';
  if (diffVal < 0) return '#6BAF8E';
  if (diffVal === 0) return '#ffffff';
  if (diffVal === 1) return '#E5B39C';
  return '#D98E6E';
};

export default function PlayerScoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const playerId = params.playerId as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    if (res.ok) {
      setEvent(await res.json());
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

  const participant = event.event_participants.find((p) => p.player_id === playerId);
  const group = event.event_groups.find((g) => g.group_members.some((m) => m.player_id === playerId));
  const holes = (event.courses?.course_holes || []).slice().sort((a, b) => a.hole_number - b.hole_number);
  const outHoles = holes.filter((h) => h.hole_number <= 9);
  const inHoles = holes.filter((h) => h.hole_number > 9);

  const getScore = (holeNumber: number) =>
    event.scores.find((s) => s.player_id === playerId && s.hole_number === holeNumber);

  const rangeTotal = (holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => sum + (getScore(h.hole_number)?.strokes || 0), 0);

  const rangePutts = (holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => sum + (getScore(h.hole_number)?.putts || 0), 0);

  const outTotal = rangeTotal(outHoles);
  const inTotal = rangeTotal(inHoles);
  const puttTotal = rangePutts(holes);

  const tiles = [
    { label: 'OUT', value: outTotal || '-', bg: '#182D28', color: '#ffffff' },
    { label: 'IN', value: inTotal || '-', bg: '#182D28', color: '#ffffff' },
    { label: 'GROSS', value: (outTotal + inTotal) || '-', bg: '#1F4A3F', color: '#6BAF8E', border: '1.5px solid #6BAF8E' },
    { label: 'PUTT', value: puttTotal || '-', bg: '#2C2A20', color: '#EDE3CB' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header style={{ backgroundColor: '#12211F', padding: '16px 20px' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/events/${eventId}`)} style={{ color: '#ffffff' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="truncate" style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff' }}>
              {participant?.players.name || '選手'}
            </h1>
            <p className="truncate" style={{ fontSize: '14px', color: '#8FA69C' }}>
              {event.name}
              {group && ` · 第${group.group_number}組`}
            </p>
          </div>
        </div>
      </header>

      <main className="p-5 space-y-4">
        {/* 指標タイル */}
        <div className="grid grid-cols-4 gap-[9px]">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="flex flex-col items-center"
              style={{ borderRadius: '14px', padding: '10px 0', backgroundColor: t.bg, border: t.border }}
            >
              <span style={{ fontSize: '12px', color: '#8FA69C' }}>{t.label}</span>
              <span className="font-num" style={{ fontSize: '26px', fontWeight: 800, color: t.color }}>{t.value}</span>
            </div>
          ))}
        </div>

        {/* ホールごとのテーブル */}
        <div style={{ borderRadius: '14px', overflow: 'hidden' }}>
          <div className="grid" style={{ gridTemplateColumns: '64px 1fr 1fr 1fr', backgroundColor: '#1B322C' }}>
            <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>HOLE</span>
            <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>PAR</span>
            <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>打数</span>
            <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>パット</span>
          </div>
          {holes.map((h, idx) => {
            const s = getScore(h.hole_number);
            const strokeVal = s?.strokes || 0;
            const diffVal = strokeVal - h.par;
            const rowBg = idx % 2 === 0 ? '#0E1A18' : '#101B19';
            const rows = [
              <div key={h.hole_number} className="grid items-center" style={{ gridTemplateColumns: '64px 1fr 1fr 1fr', backgroundColor: rowBg, padding: '5px 14px' }}>
                <span className="font-num" style={{ fontSize: '17px', fontWeight: 700, color: '#B9CFC5' }}>{h.hole_number}</span>
                <span className="font-num text-center" style={{ fontSize: '16px', color: '#5C7A70' }}>{h.par}</span>
                <span className="font-num text-center" style={{ fontSize: '22px', fontWeight: 800, color: strokeColor(strokeVal, diffVal) }}>
                  {strokeVal || '–'}
                </span>
                <span className="font-num text-center" style={{ fontSize: '19px', fontWeight: 700, color: '#C8BE9E' }}>
                  {s?.putts ?? '–'}
                </span>
              </div>,
            ];
            if (h.hole_number === 9 || h.hole_number === 18) {
              const isOut = h.hole_number === 9;
              const subtotal = isOut ? outTotal : inTotal;
              const subPutts = isOut ? rangePutts(outHoles) : rangePutts(inHoles);
              rows.push(
                <div key={`${h.hole_number}-sub`} className="grid items-center" style={{ gridTemplateColumns: '64px 1fr 1fr 1fr', backgroundColor: '#1B322C', padding: '6px 14px' }}>
                  <span className="font-num" style={{ fontSize: '15px', fontWeight: 800, color: '#8FA69C' }}>{isOut ? 'OUT' : 'IN'}</span>
                  <span />
                  <span className="font-num text-center" style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>{subtotal || '-'}</span>
                  <span className="font-num text-center" style={{ fontSize: '15px', fontWeight: 700, color: '#8FA69C' }}>{subPutts || '-'}</span>
                </div>
              );
            }
            return rows;
          })}
        </div>
      </main>
    </div>
  );
}
