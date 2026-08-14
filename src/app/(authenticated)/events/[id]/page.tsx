'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';

// パー差の内訳カテゴリ（選択行のミニサマリーで使用）。パーのみ本数の文字色を白にする
const SCORE_CATEGORIES: { key: string; label: string; color: string; countColor: string; test: (diff: number) => boolean }[] = [
  { key: 'eagle', label: 'イーグル以下', color: '#8FD9B4', countColor: '#8FD9B4', test: (d) => d <= -2 },
  { key: 'birdie', label: 'バーディ', color: '#6BAF8E', countColor: '#6BAF8E', test: (d) => d === -1 },
  { key: 'par', label: 'パー', color: '#E4EDE9', countColor: '#FFFFFF', test: (d) => d === 0 },
  { key: 'bogey', label: 'ボギー', color: '#E5B39C', countColor: '#E5B39C', test: (d) => d === 1 },
  { key: 'double', label: 'ダボ', color: '#D98E6E', countColor: '#D98E6E', test: (d) => d === 2 },
  { key: 'triple', label: 'トリ以上', color: '#B45B3C', countColor: '#B45B3C', test: (d) => d >= 3 },
];

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

type Tab = 'scores' | 'ranking' | 'groups';

const eventTypeLabel = (eventType?: string) => {
  if (eventType === '2' || eventType === 'major') return 'メジャー大会';
  if (eventType === '3' || eventType === 'final') return '最終戦';
  return '通常大会';
};

export default function EventDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [results, setResults] = useState<EventResult[]>([]);
  const [handicaps, setHandicaps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [tab, setTab] = useState<Tab>('scores');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [liveRankingTab, setLiveRankingTab] = useState<'gross' | 'net'>('gross');
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 選択行が画面内に収まるようスクロール位置を調整（scrollIntoViewは使わない）
  useEffect(() => {
    if (!expandedPlayerId) return;
    const el = rowRefs.current.get(expandedPlayerId);
    if (!el) return;
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const topMargin = 12;
      const bottomMargin = 88;
      let delta = 0;
      if (rect.bottom > window.innerHeight - bottomMargin) {
        delta = rect.bottom - (window.innerHeight - bottomMargin);
      } else if (rect.top < topMargin) {
        delta = rect.top - topMargin;
      }
      if (delta !== 0) {
        window.scrollTo({ top: window.scrollY + delta, behavior: 'smooth' });
      }
    });
  }, [expandedPlayerId]);

  const fetchEvent = useCallback(async () => {
    const currentYear = new Date().getFullYear();
    const [res, playersRes] = await Promise.all([
      fetch(`/api/events/${eventId}`),
      fetch(`/api/admin/players?year=${currentYear}`)
    ]);
    if (res.ok) {
      const data: EventDetail = await res.json();
      setEvent(data);
      const eventYear = new Date(data.event_date).getFullYear();
      if (eventYear === currentYear && playersRes.ok) {
        const players: { id: string; current_handicap: number | null }[] = await playersRes.json();
        const hcMap: Record<string, number> = {};
        players.forEach(p => { hcMap[p.id] = p.current_handicap ?? 0; });
        setHandicaps(hcMap);
      } else if (eventYear !== currentYear) {
        fetch(`/api/admin/players?year=${eventYear}`)
          .then(r => r.ok ? r.json() : [])
          .then((players: { id: string; current_handicap: number | null }[]) => {
            const hcMap: Record<string, number> = {};
            players.forEach(p => { hcMap[p.id] = p.current_handicap ?? 0; });
            setHandicaps(hcMap);
          })
          .catch(() => {});
      }
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
      const hc = handicaps[p.player_id] ?? 0;
      return {
        player_id: p.player_id,
        name: p.players.name,
        gross,
        hc,
        net: gross > 0 ? gross - hc : 0,
        holesPlayed,
      };
    }).filter(r => r.holesPlayed > 0);

    return rankings;
  }, [event, handicaps]);

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

  const breakdownFor = (playerId: string) => {
    const counts = SCORE_CATEGORIES.map(() => 0);
    holes.forEach((h) => {
      const s = getScore(playerId, h.hole_number);
      if (!s || s.strokes <= 0) return;
      const diff = s.strokes - h.par;
      const idx = SCORE_CATEGORIES.findIndex((c) => c.test(diff));
      if (idx >= 0) counts[idx]++;
    });
    return SCORE_CATEGORIES.map((c, i) => ({ ...c, count: counts[i] })).filter((c) => c.count > 0);
  };

  const netRankFor = (playerId: string) => {
    const sorted = [...liveRanking].sort((a, b) => a.net - b.net);
    const idx = sorted.findIndex((r) => r.player_id === playerId);
    return idx >= 0 ? { rank: idx + 1, total: sorted.length } : null;
  };

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
    return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header style={{ backgroundColor: '#12211F', padding: '16px 20px' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/events')} style={{ color: '#ffffff' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate" style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>{event.name}</h1>
            <p className="font-num truncate" style={{ fontSize: '14px', color: '#8FA69C' }}>
              {formatDate(event.event_date)} · {event.courses?.name}
            </p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push(`/admin/events/${eventId}/edit`)}
              style={{ color: '#ffffff' }}
              className="p-1 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* スコア入力ボタン（viewer以外のみ） */}
      {event.status !== 'completed' && user?.role !== 'viewer' && (
        <div className="px-5 pt-4">
          <Link
            href={`/events/${eventId}/score/select-group`}
            className="flex items-center justify-center"
            style={{ height: '56px', borderRadius: '16px', backgroundColor: '#6BAF8E' }}
          >
            <span style={{ fontSize: '19px', fontWeight: 900, color: '#0E1A18' }}>スコア入力</span>
          </Link>
        </div>
      )}

      {/* イベント確定ボタン（管理者のみ、未確定の場合のみ表示） */}
      {user?.role === 'admin' && !event.is_finalized && (
        <div className="px-5 pt-3">
          <button
            onClick={handleFinalize}
            disabled={finalizing}
            className="w-full flex items-center justify-center disabled:opacity-50"
            style={{ height: '52px', borderRadius: '16px', backgroundColor: '#BE9B4B' }}
          >
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#1B1608' }}>
              {finalizing ? '確定中...' : 'イベント確定（順位・ポイント・ハンデ計算）'}
            </span>
          </button>
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-2 px-5 mt-4">
        {([
          ['scores', 'スコア'],
          ['ranking', 'ランキング'],
          ['groups', '組み合わせ'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="font-bold"
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              fontSize: '14px',
              backgroundColor: tab === key ? '#6BAF8E' : '#1B322C',
              color: tab === key ? '#0E1A18' : '#8FA69C',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="px-5 py-4">
        {/* スコアタブ */}
        {tab === 'scores' && (
          <div className="space-y-2">
            {participants.length === 0 ? (
              <p style={{ color: '#8FA69C' }} className="text-sm">参加者がいません</p>
            ) : (
              <>
                <div className="grid" style={{ gridTemplateColumns: '1fr 54px 54px 58px 62px', padding: '0 34px 6px' }}>
                  <span className="font-num" style={{ fontSize: '12px', color: '#5C7A70' }}>PAR {holes.reduce((s, h) => s + h.par, 0)}</span>
                  <span className="text-center" style={{ fontSize: '12px', color: '#5C7A70' }}>OUT</span>
                  <span className="text-center" style={{ fontSize: '12px', color: '#5C7A70' }}>IN</span>
                  <span className="text-center" style={{ fontSize: '12px', color: '#5C7A70' }}>計</span>
                  <span className="text-center" style={{ fontSize: '12px', color: '#5C7A70' }}>P-Point</span>
                </div>
                {participants.map((p) => {
                  const outScore = playerTotal(p.player_id, outHoles);
                  const inScore = playerTotal(p.player_id, inHoles);
                  const grossTotal = outScore + inScore;
                  const penalty = calcPenalty(p.player_id);
                  const isExpanded = expandedPlayerId === p.player_id;

                  if (!isExpanded) {
                    return (
                      <div key={p.id} style={{ backgroundColor: '#182D28', borderRadius: '14px' }}>
                        <button
                          onClick={() => setExpandedPlayerId(p.player_id)}
                          className="grid w-full items-center text-left"
                          style={{ gridTemplateColumns: '1fr 54px 54px 58px 62px', padding: '9px 14px' }}
                        >
                          <span className="truncate" style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>{p.players.name}</span>
                          <span className="font-num text-center" style={{ fontSize: '18px', fontWeight: 700, color: '#8FA69C' }}>{outScore || '-'}</span>
                          <span className="font-num text-center" style={{ fontSize: '18px', fontWeight: 700, color: '#8FA69C' }}>{inScore || '-'}</span>
                          <span className="font-num text-center" style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>{grossTotal || '-'}</span>
                          <span className="font-num text-center" style={{ fontSize: '17px', color: '#9A8F72' }}>{penalty || '-'}</span>
                        </button>
                      </div>
                    );
                  }

                  // 選択行（ミニサマリー）
                  const netEntry = liveRanking.find((r) => r.player_id === p.player_id);
                  const netScore = netEntry?.net;
                  const parDiff = grossTotal > 0 ? grossTotal - holes.reduce((s, h) => s + h.par, 0) : null;
                  const putts = playerPutts(p.player_id, holes);
                  const rankInfo = netRankFor(p.player_id);
                  const breakdown = breakdownFor(p.player_id);

                  return (
                    <div
                      key={p.id}
                      ref={(el) => { if (el) rowRefs.current.set(p.player_id, el); else rowRefs.current.delete(p.player_id); }}
                      style={{ backgroundColor: '#1F4A3F', border: '1.5px solid #6BAF8E', borderRadius: '16px', padding: '11px 14px 12px' }}
                    >
                      <button
                        onClick={() => setExpandedPlayerId(null)}
                        className="flex items-center justify-between w-full mb-3"
                      >
                        <span style={{ fontSize: '21px', fontWeight: 700, color: '#ffffff' }}>{p.players.name}</span>
                        <span className="font-num" style={{ fontSize: '24px', fontWeight: 800, color: '#6BAF8E' }}>{grossTotal || '-'}</span>
                      </button>

                      {/* 4指標タイル */}
                      <div className="grid grid-cols-4 gap-[7px] mb-3">
                        <div className="flex flex-col items-center justify-center" style={{ backgroundColor: '#16352E', borderRadius: '12px', padding: '7px 0' }}>
                          <span style={{ fontSize: '12px', color: '#8FA69C' }}>ネット</span>
                          <span className="font-num" style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>{netScore || '-'}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center" style={{ backgroundColor: '#16352E', borderRadius: '12px', padding: '7px 0' }}>
                          <span style={{ fontSize: '12px', color: '#8FA69C' }}>PAR差</span>
                          <span className="font-num" style={{ fontSize: '24px', fontWeight: 800, color: parDiff !== null && parDiff < 0 ? '#6BAF8E' : '#E5B39C' }}>
                            {parDiff === null ? '-' : parDiff === 0 ? 'E' : parDiff > 0 ? `+${parDiff}` : parDiff}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center" style={{ backgroundColor: '#16352E', borderRadius: '12px', padding: '7px 0' }}>
                          <span style={{ fontSize: '12px', color: '#9A8F72' }}>パット</span>
                          <span className="font-num" style={{ fontSize: '24px', fontWeight: 800, color: '#EDE3CB' }}>{putts || '-'}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center" style={{ backgroundColor: '#16352E', borderRadius: '12px', padding: '7px 0' }}>
                          <span style={{ fontSize: '12px', color: '#8FA69C' }}>順位</span>
                          <span className="font-num" style={{ fontSize: '24px', fontWeight: 800, color: '#BE9B4B' }}>
                            {rankInfo ? rankInfo.rank : '-'}
                            {rankInfo && <span style={{ fontSize: '13px', color: '#8FA69C' }}>/{rankInfo.total}</span>}
                          </span>
                        </div>
                      </div>

                      {/* 内訳バー */}
                      {breakdown.length > 0 && (
                        <div className="mb-3">
                          <div className="flex" style={{ height: '9px', borderRadius: '999px', overflow: 'hidden', gap: '2px' }}>
                            {breakdown.map((b) => (
                              <div key={b.key} style={{ flex: b.count, backgroundColor: b.color }} />
                            ))}
                          </div>
                          <p className="mt-1" style={{ fontSize: '13px', color: '#8FA69C' }}>
                            {breakdown.map((b, i) => (
                              <span key={b.key}>
                                {i > 0 && ' · '}
                                {b.label}{' '}
                                <span className="font-num" style={{ fontWeight: 800, fontSize: '15px', color: b.countColor }}>{b.count}</span>
                              </span>
                            ))}
                          </p>
                        </div>
                      )}

                      {/* 詳細へのボタン */}
                      <button
                        onClick={() => router.push(`/events/${eventId}/players/${p.player_id}`)}
                        className="w-full flex items-center justify-center gap-1.5"
                        style={{ height: '46px', borderRadius: '13px', backgroundColor: '#16352E', border: '1px solid #2E6B52' }}
                      >
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#6BAF8E' }}>18ホールの詳細を見る</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]" style={{ color: '#6BAF8E' }}>
                          <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l6.5 6.5a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 11-1.06-1.06L14.19 12 8.22 6.03a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* 組み合わせタブ */}
        {tab === 'groups' && (
          <div className="space-y-3">
            {event.event_groups.length === 0 ? (
              <p style={{ color: '#8FA69C' }} className="text-sm">組み合わせが設定されていません</p>
            ) : (
              event.event_groups.map((group) => (
                <div key={group.id} style={{ backgroundColor: '#182D28', borderRadius: '18px', padding: '16px 18px' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff' }}>{group.group_number}組</span>
                    <span className="font-num" style={{ fontSize: '15px', color: '#8FA69C' }}>{group.start_time}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.group_members.map((gm) => (
                      <span
                        key={gm.id}
                        className="text-center"
                        style={{ padding: '11px 0', borderRadius: '12px', backgroundColor: '#12211F', fontSize: '18px', fontWeight: 700, color: '#E4EDE9' }}
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
          <div className="space-y-2">
            {/* 確定後: 公式結果 */}
            {event.is_finalized && results.length > 0 ? (
              <>
                {results.map((result) => {
                  const isFirst = result.rank === 1;
                  const handicapChanged = result.handicap_before !== result.handicap_after;
                  return (
                    <div
                      key={result.player_id}
                      className="flex items-center justify-between"
                      style={{
                        borderRadius: '14px',
                        padding: '11px 16px',
                        backgroundColor: isFirst ? '#1F4A3F' : '#182D28',
                        border: isFirst ? '1px solid #2E6B52' : '1px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-num shrink-0" style={{ fontSize: '24px', fontWeight: 800, color: isFirst ? '#BE9B4B' : '#5C7A70' }}>
                          {result.rank}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>{result.players.name}</p>
                          <p className="font-num truncate" style={{ fontSize: '13px', color: '#8FA69C' }}>
                            GROSS {result.gross_score} · {result.points}pt ·{' '}
                            {handicapChanged ? (
                              <>
                                <span style={{ textDecoration: 'line-through' }}>{result.handicap_before.toFixed(1)}</span>
                                {' → '}
                                <span style={{ color: '#6BAF8E', fontWeight: 700 }}>{result.handicap_after.toFixed(1)}</span>
                              </>
                            ) : (
                              <>HC {result.handicap_before.toFixed(1)}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="font-num shrink-0" style={{ fontSize: '30px', fontWeight: 800, color: isFirst ? '#6BAF8E' : '#C9D8D2' }}>
                        {result.net_score}
                      </span>
                    </div>
                  );
                })}

                <div style={{ backgroundColor: '#182D28', borderRadius: '14px', padding: '12px 16px', marginTop: '10px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#8FA69C' }}>
                    種別: {eventTypeLabel(event.event_type)}
                  </p>
                </div>
              </>
            ) : (
              /* 未確定: ライブランキング（グロス/ネット切替） */
              <>
                <div className="flex gap-2 mb-1">
                  {(['gross', 'net'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setLiveRankingTab(t)}
                      className="font-bold"
                      style={{
                        padding: '7px 16px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        backgroundColor: liveRankingTab === t ? '#6BAF8E' : '#1B322C',
                        color: liveRankingTab === t ? '#0E1A18' : '#8FA69C',
                      }}
                    >
                      {t === 'gross' ? 'グロス' : 'ネット'}
                    </button>
                  ))}
                </div>
                {liveRanking.length === 0 ? (
                  <p style={{ color: '#8FA69C' }} className="text-sm">スコアデータがありません</p>
                ) : (
                  [...liveRanking]
                    .sort((a, b) => liveRankingTab === 'gross' ? a.gross - b.gross : a.net - b.net)
                    .map((r, idx) => {
                      const isFirst = idx === 0;
                      return (
                        <div
                          key={r.player_id}
                          className="flex items-center justify-between"
                          style={{
                            borderRadius: '14px',
                            padding: '11px 16px',
                            backgroundColor: isFirst ? '#1F4A3F' : '#182D28',
                            border: isFirst ? '1px solid #2E6B52' : '1px solid transparent',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-num shrink-0" style={{ fontSize: '24px', fontWeight: 800, color: isFirst ? '#BE9B4B' : '#5C7A70' }}>
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate" style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>{r.name}</p>
                              <p className="font-num truncate" style={{ fontSize: '13px', color: '#8FA69C' }}>GROSS {r.gross} · HC {r.hc}</p>
                            </div>
                          </div>
                          <span className="font-num shrink-0" style={{ fontSize: '30px', fontWeight: 800, color: isFirst ? '#6BAF8E' : '#C9D8D2' }}>
                            {liveRankingTab === 'gross' ? r.gross : r.net}
                          </span>
                        </div>
                      );
                    })
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
