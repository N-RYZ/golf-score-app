'use client';

import { useState, useEffect, useCallback } from 'react';

type EventScore = {
  event_id: string;
  event_name: string;
  event_date: string;
  total: number;
  penalty: number;
};

type PlayerStats = {
  user_id: string;
  name: string;
  event_count: number;
  total_strokes: number;
  total_putts: number;
  total_penalty: number;
  best_score: number | null;
  avg_score: number | null;
  event_scores: EventScore[];
};

type AnnualData = {
  year: number;
  events: { id: string; name: string; event_date: string }[];
  rankings: PlayerStats[];
  penalties: PlayerStats[];
};

type Tab = 'ranking' | 'penalties';

export default function AnnualPage() {
  const [data, setData] = useState<AnnualData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('ranking');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/annual?year=${year}`);
    if (res.ok) {
      setData(await res.json());
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#166534] text-white px-4 py-3">
        <h1 className="text-lg font-bold">年間成績</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* 年度選択 */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setYear(year - 1)}
            className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm"
          >
            ◀
          </button>
          <span className="text-lg font-bold text-gray-800">{year}年</span>
          <button
            onClick={() => setYear(year + 1)}
            className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm"
          >
            ▶
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200">
          {([
            ['ranking', 'ランキング'],
            ['penalties', '罰金累計'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#166534] text-[#166534]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">読み込み中...</p>
        ) : !data || data.rankings.length === 0 ? (
          <p className="text-gray-500 text-sm">{year}年の成績データがありません</p>
        ) : (
          <>
            {/* ランキングタブ */}
            {tab === 'ranking' && (
              <div className="space-y-2">
                {data.rankings.map((player, index) => (
                  <div key={player.user_id}>
                    <button
                      onClick={() =>
                        setExpandedUser(expandedUser === player.user_id ? null : player.user_id)
                      }
                      className="w-full bg-white rounded-lg shadow p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0
                                ? 'bg-yellow-400 text-white'
                                : index === 1
                                ? 'bg-gray-300 text-white'
                                : index === 2
                                ? 'bg-amber-600 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800">{player.name}</p>
                            <p className="text-xs text-gray-500">
                              {player.event_count}回参加
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-800">
                            {player.avg_score}
                          </p>
                          <p className="text-xs text-gray-500">平均スコア</p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>ベスト: {player.best_score}</span>
                        <span>総パット: {player.total_putts}</span>
                      </div>
                    </button>

                    {/* 展開時：イベントごとの詳細 */}
                    {expandedUser === player.user_id && (
                      <div className="ml-4 mt-1 space-y-1">
                        {player.event_scores.map((es) => (
                          <div
                            key={es.event_id}
                            className="bg-gray-50 rounded px-3 py-2 flex justify-between text-sm"
                          >
                            <div>
                              <span className="text-gray-600">{formatDate(es.event_date)}</span>
                              <span className="ml-2 text-gray-800">{es.event_name}</span>
                            </div>
                            <span className="font-bold text-gray-800">{es.total}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 罰金累計タブ */}
            {tab === 'penalties' && (
              <div className="space-y-2">
                {data.penalties.map((player) => (
                  <div key={player.user_id}>
                    <button
                      onClick={() =>
                        setExpandedUser(expandedUser === player.user_id ? null : player.user_id)
                      }
                      className="w-full bg-white rounded-lg shadow p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-800">{player.name}</p>
                          <p className="text-xs text-gray-500">{player.event_count}回参加</p>
                        </div>
                        <span
                          className={`text-lg font-bold ${
                            player.total_penalty > 0 ? 'text-red-600' : 'text-gray-400'
                          }`}
                        >
                          {player.total_penalty.toLocaleString()}円
                        </span>
                      </div>
                    </button>

                    {expandedUser === player.user_id && (
                      <div className="ml-4 mt-1 space-y-1">
                        {player.event_scores.map((es) => (
                          <div
                            key={es.event_id}
                            className="bg-gray-50 rounded px-3 py-2 flex justify-between text-sm"
                          >
                            <div>
                              <span className="text-gray-600">{formatDate(es.event_date)}</span>
                              <span className="ml-2 text-gray-800">{es.event_name}</span>
                            </div>
                            <span className={`font-bold ${es.penalty > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {es.penalty.toLocaleString()}円
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* 合計 */}
                <div className="bg-gray-800 text-white rounded-lg p-4 flex items-center justify-between mt-3">
                  <span className="font-bold">年間合計</span>
                  <span className="font-bold text-lg">
                    {data.penalties
                      .reduce((sum, p) => sum + p.total_penalty, 0)
                      .toLocaleString()}
                    円
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
