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

  return (
    <div className="min-h-screen bg-[#d6cabc]/30">
      <header className="bg-gradient-to-r from-[#1d3937] to-[#195042] text-white px-4 py-3">
        <h1 className="text-lg font-bold">ツアー情報</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* 年度選択 */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setYear(year - 1)}
            className="px-3 py-1 bg-white border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
          >
            ◀
          </button>
          <span className="text-lg font-bold text-[#1d3937]">{year}年</span>
          <button
            onClick={() => setYear(year + 1)}
            className="px-3 py-1 bg-white border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
          >
            ▶
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-[#d6cabc]">
          {([
            ['points', 'ポイントランキング'],
            ['handicaps', 'ハンデ一覧'],
            ['events', '大会結果'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#1d3937] text-[#1d3937]'
                  : 'border-transparent text-[#91855a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-[#91855a] text-sm">読み込み中...</p>
        ) : (
          <>
            {/* ポイントランキングタブ */}
            {tab === 'points' && (
              <div className="space-y-2">
                {pointRankings.length === 0 ? (
                  <p className="text-[#91855a] text-sm">{year}年の成績データがありません</p>
                ) : (
                  pointRankings.map((ranking) => (
                    <div key={ranking.player_id} className="bg-white rounded-lg shadow p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              ranking.rank === 1
                                ? 'bg-[#91855a] text-white'
                                : ranking.rank === 2
                                ? 'bg-[#d6cabc] text-[#1d3937]'
                                : ranking.rank === 3
                                ? 'bg-[#195042] text-white'
                                : 'bg-white text-[#91855a] border border-[#d6cabc]'
                            }`}
                          >
                            {ranking.rank}
                          </span>
                          <div>
                            <p className="font-bold text-[#1d3937]">{ranking.player_name}</p>
                            <p className="text-xs text-[#91855a]">
                              {ranking.participation_count}回参加
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-[#195042]">
                            {ranking.total_points}
                          </p>
                          <p className="text-xs text-[#91855a]">ポイント</p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 text-xs">
                        <div>
                          <span className="text-[#91855a]">初期HC: </span>
                          <span className="font-medium text-[#1d3937]">
                            {ranking.initial_handicap.toFixed(1)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#91855a]">現在HC: </span>
                          <span className={`font-bold ${
                            ranking.current_handicap < ranking.initial_handicap
                              ? 'text-[#91855a]'
                              : 'text-[#1d3937]'
                          }`}>
                            {ranking.current_handicap.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ハンデ一覧タブ */}
            {tab === 'handicaps' && (
              <div>
                {pointRankings.length === 0 ? (
                  <p className="text-[#91855a] text-sm">{year}年のデータがありません</p>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#d6cabc] border-b border-[#d6cabc]">
                          <th className="text-left px-4 py-3 font-medium text-[#1d3937]">名前</th>
                          <th className="text-center px-4 py-3 font-medium text-[#1d3937]">初期HC</th>
                          <th className="text-center px-4 py-3 font-medium text-[#1d3937]">現在HC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointRankings.map((ranking) => (
                          <tr key={ranking.player_id} className="border-b border-[#d6cabc] last:border-b-0">
                            <td className="px-4 py-3 font-medium text-[#1d3937]">{ranking.player_name}</td>
                            <td className="px-4 py-3 text-center text-[#91855a]">{ranking.initial_handicap.toFixed(1)}</td>
                            <td className={`px-4 py-3 text-center font-bold ${
                              ranking.current_handicap < ranking.initial_handicap
                                ? 'text-[#91855a]'
                                : 'text-[#1d3937]'
                            }`}>
                              {ranking.current_handicap.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 大会結果タブ */}
            {tab === 'events' && (
              <div className="space-y-2">
                {finalizedEvents.length === 0 ? (
                  <p className="text-[#91855a] text-sm">{year}年の確定済み大会はありません</p>
                ) : (
                  finalizedEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => router.push(`/events/${event.id}`)}
                      className="w-full bg-white rounded-lg shadow p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#1d3937]">{event.name}</p>
                          <p className="text-xs text-[#91855a]">{formatDate(event.event_date)}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#91855a]">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </div>
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
