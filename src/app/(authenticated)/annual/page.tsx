'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type PointRanking = {
  rank: number;
  player_id: string;
  player_name: string;
  gender: string;
  birth_year: number | null;
  initial_handicap: number;
  current_handicap: number;
  total_points: number;
  participation_count: number;
};

type FinalizedEvent = {
  id: string;
  name: string;
  event_date: string;
  event_type?: string;
};

type Tab = 'points' | 'handicaps' | 'events';

export default function TourInfoPage() {
  const router = useRouter();
  const [pointRankings, setPointRankings] = useState<PointRanking[]>([]);
  const [finalizedEvents, setFinalizedEvents] = useState<FinalizedEvent[]>([]);
  const [year, setYear] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('points');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [rankingsRes, eventsRes] = await Promise.all([
      fetch(`/api/rankings/annual?year=${year}`),
      fetch(`/api/events?year=${year}&finalized=true`),
    ]);
    if (rankingsRes.ok) {
      setPointRankings(await rankingsRes.json());
    }
    if (eventsRes.ok) {
      setFinalizedEvents(await eventsRes.json());
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // 参加0回のメンバーはポイントランキングに出さない
  const rankedParticipants = pointRankings.filter((r) => r.participation_count > 0);
  const leader = rankedParticipants[0];
  const rest = rankedParticipants.slice(1);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header style={{ backgroundColor: '#12211F', padding: '22px 20px 14px' }}>
        <p className="font-num" style={{ fontSize: '12px', fontWeight: 700, color: '#BE9B4B', letterSpacing: '.18em' }}>
          ANNUAL TOUR
        </p>
        <div className="flex items-center justify-between">
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff' }}>ツアー情報</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear(year - 1)}
              className="font-num flex items-center justify-center"
              style={{ width: '28px', height: '28px', borderRadius: '999px', backgroundColor: '#1B322C', color: '#8FA69C', fontSize: '14px' }}
            >
              ‹
            </button>
            <span className="font-num" style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{year}</span>
            <button
              onClick={() => setYear(year + 1)}
              className="font-num flex items-center justify-center"
              style={{ width: '28px', height: '28px', borderRadius: '999px', backgroundColor: '#1B322C', color: '#8FA69C', fontSize: '14px' }}
            >
              ›
            </button>
          </div>
        </div>
        <p style={{ fontSize: '15px', color: '#8FA69C' }}>確定済み {finalizedEvents.length}戦</p>
      </header>

      <main className="p-5 space-y-4">
        {/* タブ */}
        <div className="flex gap-2">
          {([
            ['points', 'ポイント'],
            ['handicaps', 'ハンデ'],
            ['events', '大会結果'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="font-bold"
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                fontSize: '14px',
                backgroundColor: tab === key ? '#BE9B4B' : '#1B322C',
                color: tab === key ? '#12211F' : '#8FA69C',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#8FA69C' }} className="text-sm">読み込み中...</p>
        ) : (
          <>
            {/* ポイントランキングタブ */}
            {tab === 'points' && (
              <div className="space-y-2">
                {rankedParticipants.length === 0 ? (
                  <p style={{ color: '#8FA69C' }} className="text-sm">{year}年の成績データがありません</p>
                ) : (
                  <>
                    {leader && (
                      <div
                        style={{
                          borderRadius: '20px',
                          padding: '20px',
                          background: 'linear-gradient(140deg, #1F4A3F, #12211F)',
                          border: '1px solid #2E6B52',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#BE9B4B', letterSpacing: '.14em' }}>CURRENT LEADER</p>
                            <p className="truncate" style={{ fontSize: '30px', fontWeight: 900, color: '#ffffff' }}>{leader.player_name}</p>
                            <p className="font-num truncate" style={{ fontSize: '15px', color: '#8FA69C' }}>
                              {leader.participation_count}戦出場 · HC {leader.initial_handicap.toFixed(1)} → {leader.current_handicap.toFixed(1)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-num" style={{ fontSize: '54px', fontWeight: 800, color: '#6BAF8E', lineHeight: 1 }}>
                              {leader.total_points}
                            </p>
                            <p style={{ fontSize: '14px', color: '#8FA69C' }}>POINTS</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {rest.map((ranking) => (
                      <div
                        key={ranking.player_id}
                        className="flex items-center justify-between"
                        style={{ backgroundColor: '#182D28', borderRadius: '14px', padding: '12px 16px' }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-num shrink-0" style={{ fontSize: '24px', fontWeight: 800, color: '#5C7A70' }}>{ranking.rank}</span>
                          <div className="min-w-0">
                            <p className="truncate" style={{ fontSize: '21px', fontWeight: 700, color: '#ffffff' }}>{ranking.player_name}</p>
                            <p className="font-num truncate" style={{ fontSize: '13px', color: '#8FA69C' }}>
                              {ranking.participation_count}戦 · HC {ranking.initial_handicap.toFixed(1)} → {ranking.current_handicap.toFixed(1)}
                            </p>
                          </div>
                        </div>
                        <span className="font-num shrink-0" style={{ fontSize: '30px', fontWeight: 800, color: '#C9D8D2' }}>{ranking.total_points}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ハンデ一覧タブ */}
            {tab === 'handicaps' && (
              <div className="space-y-2">
                {pointRankings.length === 0 ? (
                  <p style={{ color: '#8FA69C' }} className="text-sm">{year}年のデータがありません</p>
                ) : (
                  [...pointRankings]
                    .sort((a, b) => a.current_handicap - b.current_handicap)
                    .map((ranking) => (
                      <div
                        key={ranking.player_id}
                        className="flex items-center justify-between"
                        style={{ backgroundColor: '#182D28', borderRadius: '14px', padding: '12px 16px' }}
                      >
                        <span style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>{ranking.player_name}</span>
                        <div className="font-num flex items-center gap-2" style={{ fontSize: '18px' }}>
                          <span style={{ color: '#5C7A70' }}>{ranking.initial_handicap.toFixed(1)}</span>
                          <span style={{ color: '#5C7A70' }}>→</span>
                          <span style={{ fontWeight: 800, color: '#6BAF8E' }}>{ranking.current_handicap.toFixed(1)}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* 大会結果タブ */}
            {tab === 'events' && (
              <div className="space-y-2">
                {finalizedEvents.length === 0 ? (
                  <p style={{ color: '#8FA69C' }} className="text-sm">{year}年の確定済み大会はありません</p>
                ) : (
                  finalizedEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => router.push(`/events/${event.id}`)}
                      className="w-full flex items-center justify-between text-left"
                      style={{ backgroundColor: '#182D28', borderRadius: '14px', padding: '14px 16px' }}
                    >
                      <div>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{event.name}</p>
                        <p className="font-num" style={{ fontSize: '13px', color: '#8FA69C' }}>{formatDate(event.event_date)}</p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: '#3E574F' }}>
                        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l6.5 6.5a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 11-1.06-1.06L14.19 12 8.22 6.03a.75.75 0 010-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
