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
  event_date: string;
  courses: { name: string; course_holes: CourseHole[] } | null;
  event_participants: Participant[];
  event_groups: EventGroup[];
  scores: Score[];
};

type TrendPoint = { eventId: string; date: string; name: string; gross: number };

type Tab = 'holes' | 'trend';

const strokeColor = (strokeVal: number, diffVal: number) => {
  if (strokeVal <= 0) return '#3E574F';
  if (diffVal < 0) return '#6BAF8E';
  if (diffVal === 0) return '#ffffff';
  if (diffVal === 1) return '#E5B39C';
  return '#D98E6E';
};

// パー差の内訳カテゴリ（パーのみ本数の文字色を白にする）
const SCORE_CATEGORIES: { key: string; label: string; color: string; countColor: string; test: (diff: number) => boolean }[] = [
  { key: 'eagle', label: 'イーグル以下', color: '#8FD9B4', countColor: '#8FD9B4', test: (d) => d <= -2 },
  { key: 'birdie', label: 'バーディ', color: '#6BAF8E', countColor: '#6BAF8E', test: (d) => d === -1 },
  { key: 'par', label: 'パー', color: '#E4EDE9', countColor: '#FFFFFF', test: (d) => d === 0 },
  { key: 'bogey', label: 'ボギー', color: '#E5B39C', countColor: '#E5B39C', test: (d) => d === 1 },
  { key: 'double', label: 'ダボ', color: '#D98E6E', countColor: '#D98E6E', test: (d) => d === 2 },
  { key: 'triple', label: 'トリ以上', color: '#B45B3C', countColor: '#B45B3C', test: (d) => d >= 3 },
];

const formatDiff = (diff: number) => (diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`);

export default function PlayerScoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const playerId = params.playerId as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [handicaps, setHandicaps] = useState<Record<string, number>>({});
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [tab, setTab] = useState<Tab>('holes');

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

  // 全参加者のハンデ（グロス/ネット順位の算出に使用）
  useEffect(() => {
    if (!event) return;
    const year = new Date(event.event_date).getFullYear();
    fetch(`/api/admin/players?year=${year}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((players: { id: string; current_handicap: number | null }[]) => {
        const map: Record<string, number> = {};
        players.forEach((p) => { map[p.id] = p.current_handicap ?? 0; });
        setHandicaps(map);
      })
      .catch(() => {});
  }, [event]);

  // 年間推移（同じ年の確定済みイベントでのこの人のグロス推移）
  useEffect(() => {
    if (!event) return;
    const year = new Date(event.event_date).getFullYear();
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/events?year=${year}&finalized=true`);
      if (!res.ok || cancelled) return;
      const finalizedEvents: { id: string; name: string; event_date: string }[] = await res.json();
      const others = finalizedEvents.filter((ev) => ev.id !== eventId);
      const points = await Promise.all(
        others.map(async (ev) => {
          const r = await fetch(`/api/events/${ev.id}/finalize`);
          if (!r.ok) return null;
          const results: { player_id: string; gross_score: number }[] = await r.json();
          const mine = results.find((x) => x.player_id === playerId);
          return mine ? { eventId: ev.id, date: ev.event_date, name: ev.name, gross: mine.gross_score } : null;
        })
      );
      if (cancelled) return;
      setTrend(
        points
          .filter((p): p is TrendPoint => p !== null)
          .sort((a, b) => a.date.localeCompare(b.date))
      );
    })();
    return () => { cancelled = true; };
  }, [event, eventId, playerId]);

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
  const coursePar = holes.reduce((s, h) => s + h.par, 0);

  const getScore = (holeNumber: number) =>
    event.scores.find((s) => s.player_id === playerId && s.hole_number === holeNumber);

  const rangeTotal = (holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => sum + (getScore(h.hole_number)?.strokes || 0), 0);

  const rangePutts = (holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => sum + (getScore(h.hole_number)?.putts || 0), 0);

  const outTotal = rangeTotal(outHoles);
  const inTotal = rangeTotal(inHoles);
  const grossTotal = outTotal + inTotal;
  const myHandicap = handicaps[playerId] ?? 0;
  const netTotal = grossTotal > 0 ? grossTotal - myHandicap : null;
  const puttTotal = rangePutts(holes);

  // 全参加者のグロス・ネットからこの人の順位を算出
  const allStats = event.event_participants
    .map((p) => {
      let gross = 0;
      let played = 0;
      holes.forEach((h) => {
        const s = event.scores.find((sc) => sc.player_id === p.player_id && sc.hole_number === h.hole_number);
        if (s && s.strokes > 0) { gross += s.strokes; played++; }
      });
      const hc = handicaps[p.player_id] ?? 0;
      return { player_id: p.player_id, gross, net: gross > 0 ? gross - hc : 0, played };
    })
    .filter((r) => r.played > 0);

  const rankOf = (sortKey: 'gross' | 'net') => {
    const sorted = [...allStats].sort((a, b) => a[sortKey] - b[sortKey]);
    const idx = sorted.findIndex((r) => r.player_id === playerId);
    return idx >= 0 ? { rank: idx + 1, total: sorted.length } : null;
  };
  const grossRank = rankOf('gross');
  const netRank = rankOf('net');

  // スコア内訳（イーグル以下〜トリ以上）
  const breakdown = SCORE_CATEGORIES.map((c) => {
    let count = 0;
    holes.forEach((h) => {
      const s = getScore(h.hole_number);
      if (!s || s.strokes <= 0) return;
      if (c.test(s.strokes - h.par)) count++;
    });
    return { ...c, count };
  }).filter((c) => c.count > 0);

  // パット内訳
  const puttStats = holes.reduce(
    (acc, h) => {
      const s = getScore(h.hole_number);
      if (!s || s.strokes <= 0) return acc;
      acc.played++;
      if (s.putts <= 1) acc.one++;
      else if (s.putts === 2) acc.two++;
      else acc.threePlus++;
      return acc;
    },
    { played: 0, one: 0, two: 0, threePlus: 0 }
  );
  const puttAvg = puttStats.played > 0 ? puttTotal / puttStats.played : null;

  // PAR別平均
  const parAverages = ([3, 4, 5] as const)
    .map((par) => {
      const parHoles = holes.filter((h) => h.par === par);
      let total = 0;
      let played = 0;
      parHoles.forEach((h) => {
        const s = getScore(h.hole_number);
        if (s && s.strokes > 0) { total += s.strokes; played++; }
      });
      return { par, avg: played > 0 ? total / played : null };
    })
    .filter((x) => x.avg !== null);

  const tiles = [
    { label: 'OUT', value: outTotal || '-', bg: '#182D28', color: '#ffffff' },
    { label: 'IN', value: inTotal || '-', bg: '#182D28', color: '#ffffff' },
    { label: 'GROSS', value: grossTotal || '-', bg: '#1F4A3F', color: '#6BAF8E', border: '1.5px solid #6BAF8E' },
    { label: 'NET', value: netTotal ?? '-', bg: '#182D28', color: '#ffffff' },
  ];

  const parDiffTotal = grossTotal > 0 ? grossTotal - coursePar : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header style={{ backgroundColor: '#12211F', padding: '16px 20px' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/events/${eventId}`)} style={{ color: '#ffffff' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate" style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff' }}>
                {participant?.players.name || '選手'}
              </h1>
              <span
                className="font-num shrink-0 font-bold"
                style={{ backgroundColor: '#1F4A3F', color: '#6BAF8E', fontSize: '12px', padding: '3px 9px', borderRadius: '999px' }}
              >
                HC {myHandicap.toFixed(1)}
              </span>
            </div>
            <p className="truncate" style={{ fontSize: '14px', color: '#8FA69C' }}>
              {event.name}
              {group && ` · 第${group.group_number}組`}
            </p>
          </div>
        </div>
      </header>

      <main className="p-5 space-y-3">
        {/* 順位カード */}
        <div className="flex items-center" style={{ backgroundColor: '#182D28', borderRadius: '13px', padding: '9px 15px' }}>
          <div className="flex-1 text-center">
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#8FA69C' }}>グロス順位</p>
            <p className="font-num" style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
              {grossRank ? grossRank.rank : '-'}
              {grossRank && <span style={{ fontSize: '13px', color: '#8FA69C' }}> / {grossRank.total}</span>}
            </p>
          </div>
          <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(255,255,255,.12)' }} />
          <div className="flex-1 text-center">
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#8FA69C' }}>ネット順位</p>
            <p className="font-num" style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
              {netRank ? netRank.rank : '-'}
              {netRank && <span style={{ fontSize: '13px', color: '#8FA69C' }}> / {netRank.total}</span>}
            </p>
          </div>
        </div>

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

        {/* スコア内訳カード */}
        <div style={{ backgroundColor: '#182D28', borderRadius: '16px', padding: '13px 15px' }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#B9CFC5' }}>スコア内訳</span>
            {parDiffTotal !== null && (
              <span style={{ fontSize: '13px', color: '#8FA69C' }}>
                PAR {coursePar} に対して{' '}
                <span className="font-num" style={{ fontWeight: 800, fontSize: '15px', color: '#E5B39C' }}>{formatDiff(parDiffTotal)}</span>
              </span>
            )}
          </div>
          {breakdown.length > 0 && (
            <>
              <div className="flex mb-2" style={{ height: '10px', borderRadius: '999px', overflow: 'hidden', gap: '2px' }}>
                {breakdown.map((b) => (
                  <div key={b.key} style={{ flex: b.count, backgroundColor: b.color }} />
                ))}
              </div>
              <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${breakdown.length}, 1fr)` }}>
                {breakdown.map((b) => (
                  <div key={b.key} className="flex flex-col items-start">
                    <div className="flex items-center gap-1">
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: b.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '12px', color: '#8FA69C' }}>{b.label}</span>
                    </div>
                    <span className="font-num" style={{ fontSize: '20px', fontWeight: 800, color: b.countColor }}>{b.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* パットカード + PAR別平均カード */}
        <div className="grid grid-cols-2 gap-[10px]">
          <div style={{ backgroundColor: '#2C2A20', borderRadius: '16px', padding: '13px 15px' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#EDE3CB' }}>パット</span>
              <span>
                <span className="font-num" style={{ fontSize: '20px', fontWeight: 800, color: '#EDE3CB' }}>{puttTotal || '-'}</span>
                {puttAvg !== null && <span style={{ fontSize: '12px', color: '#9A8F72' }}> / 平均{puttAvg.toFixed(1)}</span>}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '13px', color: '#9A8F72' }}>1パット</span>
                <span className="font-num" style={{ fontSize: '15px', fontWeight: 700, color: '#C8BE9E' }}>{puttStats.one}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '13px', color: '#9A8F72' }}>2パット</span>
                <span className="font-num" style={{ fontSize: '15px', fontWeight: 700, color: '#C8BE9E' }}>{puttStats.two}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#D8C79A' }}>3パット以上</span>
                <span className="font-num" style={{ fontSize: '15px', fontWeight: 800, color: '#BE9B4B' }}>{puttStats.threePlus}</span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#182D28', borderRadius: '16px', padding: '13px 15px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#B9CFC5' }}>PAR別平均</span>
            <div className="mt-2 space-y-1">
              {parAverages.length === 0 ? (
                <span style={{ fontSize: '13px', color: '#8FA69C' }}>データなし</span>
              ) : (
                parAverages.map(({ par, avg }) => {
                  const diff = (avg as number) - par;
                  return (
                    <div key={par} className="flex items-center justify-between">
                      <span style={{ fontSize: '13px', color: '#8FA69C' }}>PAR {par}</span>
                      <span>
                        <span className="font-num" style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{(avg as number).toFixed(1)}</span>
                        <span className="font-num" style={{ fontSize: '12px', color: diff < 0 ? '#6BAF8E' : '#E5B39C' }}> ({formatDiff(Math.round(diff * 10) / 10)})</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ホール別 / 年間推移 タブ */}
        {trend.length > 0 && (
          <div className="flex gap-2">
            {([['holes', 'ホール別'], ['trend', '年間推移']] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="font-bold"
                style={{
                  padding: '8px 15px',
                  borderRadius: '999px',
                  fontSize: '14px',
                  backgroundColor: tab === key ? '#182D28' : 'transparent',
                  color: tab === key ? '#ffffff' : '#5C7A70',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === 'trend' && trend.length > 0 ? (
          <div className="space-y-2">
            {trend.map((t) => (
              <div key={t.eventId} className="flex items-center justify-between" style={{ backgroundColor: '#182D28', borderRadius: '14px', padding: '12px 16px' }}>
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{t.name}</p>
                  <p className="font-num" style={{ fontSize: '12px', color: '#8FA69C' }}>{t.date}</p>
                </div>
                <span className="font-num shrink-0" style={{ fontSize: '22px', fontWeight: 800, color: '#C9D8D2' }}>{t.gross}</span>
              </div>
            ))}
          </div>
        ) : (
          /* ホールごとのテーブル */
          <div style={{ borderRadius: '14px', overflow: 'hidden' }}>
            <div className="grid" style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', backgroundColor: '#1B322C' }}>
              <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>HOLE</span>
              <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>PAR</span>
              <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>打数</span>
              <span className="py-2 text-center" style={{ fontSize: '12px', color: '#9A8F72' }}>パット</span>
              <span className="py-2 text-center" style={{ fontSize: '12px', color: '#8FA69C' }}>累計</span>
            </div>
            {(() => {
              let cumulative = 0;
              return holes.map((h, idx) => {
                const s = getScore(h.hole_number);
                const strokeVal = s?.strokes || 0;
                const diffVal = strokeVal - h.par;
                if (strokeVal > 0) cumulative += diffVal;
                const rowBg = idx % 2 === 0 ? '#0E1A18' : '#101B19';
                const rows = [
                  <div key={h.hole_number} className="grid items-center" style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', backgroundColor: rowBg, padding: '5px 13px' }}>
                    <span className="font-num" style={{ fontSize: '17px', fontWeight: 700, color: '#B9CFC5' }}>{h.hole_number}</span>
                    <span className="font-num text-center" style={{ fontSize: '16px', color: '#8FA69C' }}>{h.par}</span>
                    <span className="font-num text-center" style={{ fontSize: '22px', fontWeight: 800, color: strokeColor(strokeVal, diffVal) }}>
                      {strokeVal || '–'}
                    </span>
                    <span className="font-num text-center" style={{ fontSize: '19px', fontWeight: 700, color: '#C8BE9E' }}>
                      {s?.putts ?? '–'}
                    </span>
                    <span className="font-num text-center" style={{ fontSize: '15px', fontWeight: 700, color: '#8FA69C' }}>
                      {strokeVal > 0 ? formatDiff(cumulative) : '–'}
                    </span>
                  </div>,
                ];
                if (h.hole_number === 9 || h.hole_number === 18) {
                  const isOut = h.hole_number === 9;
                  const subtotal = isOut ? outTotal : inTotal;
                  const subPutts = isOut ? rangePutts(outHoles) : rangePutts(inHoles);
                  rows.push(
                    <div key={`${h.hole_number}-sub`} className="grid items-center" style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', backgroundColor: '#1B322C', padding: '6px 13px' }}>
                      <span className="font-num" style={{ fontSize: '15px', fontWeight: 800, color: '#8FA69C' }}>{isOut ? 'OUT' : 'IN'}</span>
                      <span />
                      <span className="font-num text-center" style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>{subtotal || '-'}</span>
                      <span className="font-num text-center" style={{ fontSize: '15px', fontWeight: 700, color: '#8FA69C' }}>{subPutts || '-'}</span>
                      <span className="font-num text-center" style={{ fontSize: '15px', fontWeight: 700, color: '#E5B39C' }}>{formatDiff(cumulative)}</span>
                    </div>
                  );
                }
                return rows;
              });
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
