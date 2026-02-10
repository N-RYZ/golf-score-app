'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type CourseHole = { hole_number: number; par: number };
type Score = {
  id: string;
  user_id: string;
  hole_number: number;
  strokes: number;
  putts: number;
};
type Participant = {
  id: string;
  user_id: string;
  users: { id: string; name: string };
};
type GroupMember = {
  id: string;
  user_id: string;
  users: { id: string; name: string };
};
type EventGroup = {
  id: string;
  group_number: number;
  start_time: string;
  group_members: GroupMember[];
};
type EventDetail = {
  id: string;
  name: string;
  event_date: string;
  status: string;
  event_type?: string;
  is_finalized?: boolean;
  courses: {
    id: string;
    name: string;
    course_holes: CourseHole[];
  } | null;
  event_participants: Participant[];
  event_groups: EventGroup[];
  scores: Score[];
};

type EventResult = {
  rank: number;
  player_id: string;
  players: { name: string };
  gross_score: number;
  net_score: number;
  points: number;
  handicap_before: number;
  handicap_after: number;
  under_par_strokes: number;
};

type Tab = 'scores' | 'groups' | 'penalties' | 'results';

export default function EventDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [results, setResults] = useState<EventResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [tab, setTab] = useState<Tab>('scores');

  const fetchEvent = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    if (res.ok) {
      setEvent(await res.json());
    }
    setLoading(false);
  }, [eventId]);

  const fetchResults = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/finalize`);
    if (res.ok) {
      setResults(await res.json());
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    if (event?.is_finalized) {
      fetchResults();
    }
  }, [event, fetchResults]);

  const handleFinalize = async () => {
    if (!confirm('イベントを確定しますか？\n確定後は順位・ポイント・ハンデが計算され、変更できません。')) {
      return;
    }

    setFinalizing(true);
    const res = await fetch(`/api/events/${eventId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id })
    });

    if (res.ok) {
      alert('イベントを確定しました');
      fetchEvent();
      fetchResults();
      setTab('results');
    } else {
      const data = await res.json();
      alert(`確定に失敗しました: ${data.error}`);
    }
    setFinalizing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">イベントが見つかりません</p>
      </div>
    );
  }

  const holes = event.courses?.course_holes || [];
  const outHoles = holes.filter((h) => h.hole_number <= 9);
  const inHoles = holes.filter((h) => h.hole_number > 9);

  const getScore = (userId: string, holeNumber: number) =>
    event.scores.find((s) => s.user_id === userId && s.hole_number === holeNumber);

  const playerTotal = (userId: string, holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => {
      const s = getScore(userId, h.hole_number);
      return sum + (s?.strokes || 0);
    }, 0);

  const playerPutts = (userId: string, holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => {
      const s = getScore(userId, h.hole_number);
      return sum + (s?.putts || 0);
    }, 0);

  // 罰金計算
  const calcPenalty = (userId: string) => {
    let penalty = 0;
    for (const hole of holes) {
      const s = getScore(userId, hole.hole_number);
      if (!s) continue;
      // 3パット以上: (パット数 - 2) × 100円
      if (s.putts >= 3) penalty += (s.putts - 2) * 100;
      // パー3で1オン失敗: ストローク数2以上の場合100円
      if (hole.par === 3 && s.strokes >= 2) penalty += 100;
    }
    return penalty;
  };

  const participants = event.event_participants || [];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#166534] text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/events')} className="text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{event.name}</h1>
            <p className="text-xs text-green-200">
              {formatDate(event.event_date)} - {event.courses?.name}
            </p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push(`/admin/events/${eventId}/edit`)}
              className="text-white p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* スコア入力ボタン */}
      {event.status !== 'completed' && (
        <div className="px-4 pt-3">
          <Link
            href={`/events/${eventId}/score`}
            className="block w-full bg-[#166534] text-white text-center py-3 rounded-lg font-bold"
          >
            スコア入力
          </Link>
        </div>
      )}

      {/* イベント確定ボタン（管理者のみ、未確定の場合のみ表示） */}
      {user?.role === 'admin' && !event.is_finalized && (
        <div className="px-4 pt-3">
          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className="block w-full bg-orange-600 text-white text-center py-3 rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-400"
          >
            {finalizing ? '確定中...' : 'イベント確定（順位・ポイント・ハンデ計算）'}
          </button>
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b border-gray-200 mt-3">
        {([
          ['scores', 'スコア'],
          ['groups', '組み合わせ'],
          ['penalties', '罰金'],
          ...(event.is_finalized ? [['results', '結果']] : [])
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

      <main className="p-4">
        {/* スコア一覧タブ */}
        {tab === 'scores' && (
          <div className="overflow-x-auto">
            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm">参加者がいません</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="sticky left-0 bg-gray-100 px-2 py-1 text-left">名前</th>
                    {outHoles.map((h) => (
                      <th key={h.hole_number} className="px-1 py-1 text-center min-w-[28px]">
                        {h.hole_number}
                      </th>
                    ))}
                    <th className="px-1 py-1 text-center font-bold bg-gray-200">OUT</th>
                    {inHoles.map((h) => (
                      <th key={h.hole_number} className="px-1 py-1 text-center min-w-[28px]">
                        {h.hole_number}
                      </th>
                    ))}
                    <th className="px-1 py-1 text-center font-bold bg-gray-200">IN</th>
                    <th className="px-1 py-1 text-center font-bold bg-gray-300">計</th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-400">
                    <td className="sticky left-0 bg-gray-50 px-2 py-1">PAR</td>
                    {outHoles.map((h) => (
                      <td key={h.hole_number} className="px-1 py-1 text-center">{h.par}</td>
                    ))}
                    <td className="px-1 py-1 text-center bg-gray-100">
                      {outHoles.reduce((s, h) => s + h.par, 0)}
                    </td>
                    {inHoles.map((h) => (
                      <td key={h.hole_number} className="px-1 py-1 text-center">{h.par}</td>
                    ))}
                    <td className="px-1 py-1 text-center bg-gray-100">
                      {inHoles.reduce((s, h) => s + h.par, 0)}
                    </td>
                    <td className="px-1 py-1 text-center bg-gray-200">
                      {holes.reduce((s, h) => s + h.par, 0)}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => {
                    const outScore = playerTotal(p.user_id, outHoles);
                    const inScore = playerTotal(p.user_id, inHoles);
                    return (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="sticky left-0 bg-white px-2 py-1 font-medium whitespace-nowrap">
                          {p.users.name}
                        </td>
                        {outHoles.map((h) => {
                          const s = getScore(p.user_id, h.hole_number);
                          const diff = s ? s.strokes - h.par : 0;
                          return (
                            <td
                              key={h.hole_number}
                              className={`px-1 py-1 text-center ${
                                diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : ''
                              }`}
                            >
                              {s ? s.strokes : '-'}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1 text-center font-bold bg-gray-50">
                          {outScore || '-'}
                        </td>
                        {inHoles.map((h) => {
                          const s = getScore(p.user_id, h.hole_number);
                          const diff = s ? s.strokes - h.par : 0;
                          return (
                            <td
                              key={h.hole_number}
                              className={`px-1 py-1 text-center ${
                                diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : ''
                              }`}
                            >
                              {s ? s.strokes : '-'}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1 text-center font-bold bg-gray-50">
                          {inScore || '-'}
                        </td>
                        <td className="px-1 py-1 text-center font-bold bg-gray-100">
                          {outScore + inScore || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 組み合わせタブ */}
        {tab === 'groups' && (
          <div className="space-y-3">
            {event.event_groups.length === 0 ? (
              <p className="text-gray-500 text-sm">組み合わせが設定されていません</p>
            ) : (
              event.event_groups.map((group) => (
                <div key={group.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800">{group.group_number}組</span>
                    <span className="text-sm text-gray-500">{group.start_time}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.group_members.map((gm) => (
                      <span
                        key={gm.id}
                        className="bg-green-50 text-green-800 px-3 py-1 rounded-full text-sm"
                      >
                        {gm.users.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 罰金タブ */}
        {tab === 'penalties' && (
          <div className="space-y-2">
            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm">参加者がいません</p>
            ) : (
              <>
                {participants.map((p) => {
                  const penalty = calcPenalty(p.user_id);
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-800">{p.users.name}</span>
                      <span className={`font-bold ${penalty > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {penalty > 0 ? `${penalty.toLocaleString()}円` : '0円'}
                      </span>
                    </div>
                  );
                })}
                <div className="bg-gray-800 text-white rounded-lg p-4 flex items-center justify-between mt-3">
                  <span className="font-bold">合計</span>
                  <span className="font-bold text-lg">
                    {participants
                      .reduce((sum, p) => sum + calcPenalty(p.user_id), 0)
                      .toLocaleString()}
                    円
                  </span>
                </div>
              </>
            )}

            {/* 罰金ルール説明 */}
            {user && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                <p className="font-bold mb-1">罰金ルール</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>3パット以上: (パット数 - 2) × 100円</li>
                  <li>パー3で1オン失敗（ストローク数2以上）: 100円</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 結果タブ（イベント確定後のみ表示） */}
        {tab === 'results' && event.is_finalized && (
          <div className="space-y-2">
            {results.length === 0 ? (
              <p className="text-gray-500 text-sm">結果データがありません</p>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-center">順位</th>
                        <th className="px-3 py-2 text-left">名前</th>
                        <th className="px-3 py-2 text-center">グロス</th>
                        <th className="px-3 py-2 text-center">ネット</th>
                        <th className="px-3 py-2 text-center">ポイント</th>
                        <th className="px-3 py-2 text-center">ハンデ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => {
                        const handicapChanged = result.handicap_before !== result.handicap_after;
                        return (
                          <tr key={result.player_id} className="border-t border-gray-100">
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                result.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                                result.rank === 2 ? 'bg-gray-300 text-gray-800' :
                                result.rank === 3 ? 'bg-orange-300 text-orange-900' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {result.rank}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-medium">{result.players.name}</td>
                            <td className="px-3 py-3 text-center">{result.gross_score}</td>
                            <td className="px-3 py-3 text-center font-bold text-blue-600">
                              {result.net_score}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-green-600">
                              {result.points}pt
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className={handicapChanged ? 'line-through text-gray-400' : ''}>
                                  {result.handicap_before.toFixed(1)}
                                </span>
                                {handicapChanged && (
                                  <>
                                    <span className="text-gray-400">→</span>
                                    <span className="font-bold text-red-600">
                                      {result.handicap_after.toFixed(1)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* イベントタイプ表示 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <p className="font-bold mb-1">イベント情報</p>
                  <p>
                    種別: {event.event_type === 'major' ? 'メジャー大会' : event.event_type === 'final' ? '最終戦' : '通常大会'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
