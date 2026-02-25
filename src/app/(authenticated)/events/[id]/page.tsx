'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

type CourseHole = { hole_number: number; par: number };
type Score = {
  id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
  putts: number;
};
type Participant = {
  id: string;
  player_id: string;
  players: { id: string; name: string };
};
type GroupMember = {
  id: string;
  player_id: string;
  players: { id: string; name: string };
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

type Tab = 'scores' | 'groups' | 'ranking';

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
      body: JSON.stringify({})
    });

    if (res.ok) {
      alert('イベントを確定しました');
      fetchEvent();
      fetchResults();
      setTab('ranking');
    } else {
      const data = await res.json();
      alert(`確定に失敗しました: ${data.error}`);
    }
    setFinalizing(false);
  };

  // ランキング計算（未確定時用：スコアデータからグロス/ネット順位を算出）
  const liveRanking = useMemo(() => {
    if (!event || !event.courses) return [];
    const holes = event.courses.course_holes || [];
    const participants = event.event_participants || [];

    const rankings = participants.map((p) => {
      let gross = 0;
      let holesPlayed = 0;
      for (const hole of holes) {
        const s = event.scores.find((sc) => sc.player_id === p.player_id && sc.hole_number === hole.hole_number);
        if (s && s.strokes > 0) {
          gross += s.strokes;
          holesPlayed++;
        }
      }
      return {
        player_id: p.player_id,
        name: p.players.name,
        gross,
        holesPlayed,
      };
    }).filter(r => r.holesPlayed > 0);

    // グロスでソート
    rankings.sort((a, b) => a.gross - b.gross);
    return rankings;
  }, [event]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#91855a]">読み込み中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#91855a]">イベントが見つかりません</p>
      </div>
    );
  }

  const holes = event.courses?.course_holes || [];
  const outHoles = holes.filter((h) => h.hole_number <= 9);
  const inHoles = holes.filter((h) => h.hole_number > 9);

  const getScore = (playerId: string, holeNumber: number) =>
    event.scores.find((s) => s.player_id === playerId && s.hole_number === holeNumber);

  const playerTotal = (playerId: string, holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => {
      const s = getScore(playerId, h.hole_number);
      return sum + (s?.strokes || 0);
    }, 0);

  const playerPutts = (playerId: string, holeRange: CourseHole[]) =>
    holeRange.reduce((sum, h) => {
      const s = getScore(playerId, h.hole_number);
      return sum + (s?.putts || 0);
    }, 0);

  const calcPenalty = (playerId: string) => {
    let total = 0;
    for (const hole of holes) {
      const s = getScore(playerId, hole.hole_number);
      if (!s || s.strokes === 0) continue;
      // パット罰金: 3パット以上で (putts-2)×100円
      if (s.putts >= 3) total += (s.putts - 2) * 100;
      // PAR3ワンオン失敗: 到達打数(strokes-putts)≥2で100円
      if (hole.par === 3 && (s.strokes - s.putts) >= 2) total += 100;
    }
    return total;
  };

  const participants = event.event_participants || [];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#d6cabc]/30">
      <header className="bg-gradient-to-r from-[#1d3937] to-[#195042] text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/events')} className="text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{event.name}</h1>
            <p className="text-xs text-[#d6cabc]">
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
            href={`/events/${eventId}/score/select-group`}
            className="block w-full bg-gradient-to-r from-[#1d3937] to-[#195042] text-white text-center py-3 rounded-lg font-bold"
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
            className="block w-full bg-[#91855a] text-white text-center py-3 rounded-lg font-bold hover:bg-[#91855a]/80 disabled:opacity-50"
          >
            {finalizing ? '確定中...' : 'イベント確定（順位・ポイント・ハンデ計算）'}
          </button>
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b border-[#d6cabc] mt-3">
        {([
          ['scores', 'スコア'],
          ['groups', '組み合わせ'],
          ['ranking', 'ランキング'],
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

      <main className="p-4">
        {/* スコア一覧タブ */}
        {tab === 'scores' && (
          <div className="overflow-x-auto">
            {participants.length === 0 ? (
              <p className="text-[#91855a] text-sm">参加者がいません</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d6cabc]">
                    <th className="sticky left-0 bg-[#d6cabc] px-2 py-1 text-left text-[#1d3937]">名前</th>
                    {outHoles.map((h) => (
                      <th key={h.hole_number} className="px-1 py-1 text-center min-w-[28px] text-[#1d3937]">
                        {h.hole_number}
                      </th>
                    ))}
                    <th className="px-1 py-1 text-center font-bold bg-[#195042] text-white">OUT</th>
                    {inHoles.map((h) => (
                      <th key={h.hole_number} className="px-1 py-1 text-center min-w-[28px] text-[#1d3937]">
                        {h.hole_number}
                      </th>
                    ))}
                    <th className="px-1 py-1 text-center font-bold bg-[#195042] text-white">IN</th>
                    <th className="px-1 py-1 text-center font-bold bg-gradient-to-r from-[#1d3937] to-[#195042] text-white">計</th>
                    <th className="px-1 py-1 text-center font-bold bg-[#91855a] text-white">P-Point</th>
                  </tr>
                  <tr className="bg-[#d6cabc]/50 text-[#91855a]">
                    <td className="sticky left-0 bg-[#d6cabc]/50 px-2 py-1">PAR</td>
                    {outHoles.map((h) => (
                      <td key={h.hole_number} className="px-1 py-1 text-center">{h.par}</td>
                    ))}
                    <td className="px-1 py-1 text-center bg-[#d6cabc]">
                      {outHoles.reduce((s, h) => s + h.par, 0)}
                    </td>
                    {inHoles.map((h) => (
                      <td key={h.hole_number} className="px-1 py-1 text-center">{h.par}</td>
                    ))}
                    <td className="px-1 py-1 text-center bg-[#d6cabc]">
                      {inHoles.reduce((s, h) => s + h.par, 0)}
                    </td>
                    <td className="px-1 py-1 text-center bg-[#d6cabc] text-[#1d3937]">
                      {holes.reduce((s, h) => s + h.par, 0)}
                    </td>
                    <td className="bg-[#91855a]/20" />
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => {
                    const outScore = playerTotal(p.player_id, outHoles);
                    const inScore = playerTotal(p.player_id, inHoles);
                    const outPutts = playerPutts(p.player_id, outHoles);
                    const inPutts = playerPutts(p.player_id, inHoles);
                    const penalty = calcPenalty(p.player_id);
                    return (
                      <tr key={p.id} className="border-t border-[#d6cabc]">
                        <td className="sticky left-0 bg-white px-2 py-1 font-medium whitespace-nowrap text-[#1d3937]">
                          {p.players.name}
                        </td>
                        {outHoles.map((h) => {
                          const s = getScore(p.player_id, h.hole_number);
                          const diff = s ? s.strokes - h.par : 0;
                          return (
                            <td
                              key={h.hole_number}
                              className={`px-1 py-1 text-center whitespace-nowrap ${
                                diff > 0 ? 'text-[#91855a]' : diff < 0 ? 'text-[#195042]' : 'text-[#1d3937]'
                              }`}
                            >
                              {s ? `${s.strokes}/(${s.putts})` : '-'}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1 text-center font-bold bg-[#d6cabc]/50 whitespace-nowrap text-[#1d3937]">
                          {outScore ? `${outScore}/(${outPutts})` : '-'}
                        </td>
                        {inHoles.map((h) => {
                          const s = getScore(p.player_id, h.hole_number);
                          const diff = s ? s.strokes - h.par : 0;
                          return (
                            <td
                              key={h.hole_number}
                              className={`px-1 py-1 text-center whitespace-nowrap ${
                                diff > 0 ? 'text-[#91855a]' : diff < 0 ? 'text-[#195042]' : 'text-[#1d3937]'
                              }`}
                            >
                              {s ? `${s.strokes}/(${s.putts})` : '-'}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1 text-center font-bold bg-[#d6cabc]/50 whitespace-nowrap text-[#1d3937]">
                          {inScore ? `${inScore}/(${inPutts})` : '-'}
                        </td>
                        <td className="px-1 py-1 text-center font-bold bg-[#d6cabc] whitespace-nowrap text-[#1d3937]">
                          {(outScore + inScore) ? `${outScore + inScore}/(${outPutts + inPutts})` : '-'}
                        </td>
                        <td className="px-1 py-1 text-center font-bold bg-[#91855a]/20 text-[#91855a] whitespace-nowrap">
                          {penalty > 0 ? `${penalty}` : '-'}
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
              <p className="text-[#91855a] text-sm">組み合わせが設定されていません</p>
            ) : (
              event.event_groups.map((group) => (
                <div key={group.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#1d3937]">{group.group_number}組</span>
                    <span className="text-sm text-[#91855a]">{group.start_time}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.group_members.map((gm) => (
                      <span
                        key={gm.id}
                        className="bg-[#d6cabc] text-[#1d3937] px-3 py-1 rounded-full text-sm"
                      >
                        {gm.players.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ランキングタブ */}
        {tab === 'ranking' && (
          <div className="space-y-4">
            {/* 確定後: 公式結果 */}
            {event.is_finalized && results.length > 0 ? (
              <>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#d6cabc]">
                      <tr>
                        <th className="px-3 py-2 text-center text-[#1d3937]">順位</th>
                        <th className="px-3 py-2 text-left text-[#1d3937]">名前</th>
                        <th className="px-3 py-2 text-center text-[#1d3937]">グロス</th>
                        <th className="px-3 py-2 text-center text-[#1d3937]">ネット</th>
                        <th className="px-3 py-2 text-center text-[#1d3937]">Pt</th>
                        <th className="px-3 py-2 text-center text-[#1d3937]">HC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => {
                        const handicapChanged = result.handicap_before !== result.handicap_after;
                        return (
                          <tr key={result.player_id} className="border-t border-[#d6cabc]">
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                result.rank === 1 ? 'bg-[#91855a] text-white' :
                                result.rank === 2 ? 'bg-[#d6cabc] text-[#1d3937]' :
                                result.rank === 3 ? 'bg-[#195042] text-white' :
                                'bg-white text-[#91855a] border border-[#d6cabc]'
                              }`}>
                                {result.rank}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-medium text-[#1d3937]">{result.players.name}</td>
                            <td className="px-3 py-3 text-center text-[#1d3937]">{result.gross_score}</td>
                            <td className="px-3 py-3 text-center font-bold text-[#195042]">
                              {result.net_score}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-[#195042]">
                              {result.points}pt
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className={handicapChanged ? 'line-through text-[#91855a]' : 'text-[#1d3937]'}>
                                  {result.handicap_before.toFixed(1)}
                                </span>
                                {handicapChanged && (
                                  <>
                                    <span className="text-[#91855a]">→</span>
                                    <span className="font-bold text-[#91855a]">
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

                <div className="bg-[#d6cabc] border border-[#91855a] rounded-lg p-3 text-xs text-[#1d3937]">
                  <p className="font-bold mb-1">イベント情報</p>
                  <p>
                    種別: {event.event_type === 'major' ? 'メジャー大会' : event.event_type === 'final' ? '最終戦' : '通常大会'}
                  </p>
                </div>
              </>
            ) : (
              /* 未確定: ライブランキング（グロス順） */
              <>
                {liveRanking.length === 0 ? (
                  <p className="text-[#91855a] text-sm">スコアデータがありません</p>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="bg-[#d6cabc]/50 px-3 py-2 text-xs text-[#91855a] font-medium">
                      グロススコア順（暫定）
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-[#d6cabc]">
                        <tr>
                          <th className="px-3 py-2 text-center text-[#1d3937]">#</th>
                          <th className="px-3 py-2 text-left text-[#1d3937]">名前</th>
                          <th className="px-3 py-2 text-center text-[#1d3937]">グロス</th>
                          <th className="px-3 py-2 text-center text-[#1d3937]">ホール数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveRanking.map((r, idx) => (
                          <tr key={r.player_id} className="border-t border-[#d6cabc]">
                            <td className="px-3 py-3 text-center font-bold text-[#91855a]">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-3 font-medium text-[#1d3937]">{r.name}</td>
                            <td className="px-3 py-3 text-center font-bold text-[#1d3937]">{r.gross}</td>
                            <td className="px-3 py-3 text-center text-[#91855a]">
                              {r.holesPlayed}H
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
