'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';

type CourseHole = { hole_number: number; par: number };
type GroupMember = { player_id: string; players: { id: string; name: string } };
type EventGroup = { id: string; group_number: number; group_members: GroupMember[] };
type Participant = { player_id: string; players: { id: string; name: string } };
type ScoreData = {
  event_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
  putts: number;
  isDefault?: boolean;
};
type EventInfo = {
  id: string;
  name: string;
  event_date: string;
  status: string;
  courses: { course_holes: CourseHole[] } | null;
  event_participants: Participant[];
  event_groups: EventGroup[];
  scores: ScoreData[];
};

// ローカルストレージキー
const STORAGE_KEY = (eventId: string) => `golf-scores-${eventId}`;
const LAST_POS_KEY = (eventId: string, groupId?: string | null) => `golf-lastpos-${eventId}-${groupId || 'all'}`;
const PENDING_KEY = (eventId: string) => `golf-pending-${eventId}`;

export default function ScoreInputPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const groupId = searchParams.get('group');

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, ScoreData>>({});
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showAttest, setShowAttest] = useState(false);
  const [attestType, setAttestType] = useState<'front' | 'full' | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'gross' | 'net'>('gross');
  const [attestTab, setAttestTab] = useState<'scores' | 'ranking'>('scores');
  const [handicaps, setHandicaps] = useState<Record<string, number>>({});
  const [showScoreList, setShowScoreList] = useState(false);

  const prevHoleRef = useRef<number>(1);

  // スコアのキー
  const scoreKey = (userId: string, holeNumber: number) => `${userId}-${holeNumber}`;

  // 同組メンバーの取得
  const getGroupMembers = useCallback((): Participant[] => {
    if (!event) return [];

    // groupIdパラメータで組を検索
    if (groupId) {
      const group = event.event_groups.find((g) => g.id === groupId);
      if (group) {
        return group.group_members.map((m) => ({
          player_id: m.player_id,
          players: m.players,
        }));
      }
    }

    // 組が未指定の場合は全参加者を表示
    return event.event_participants;
  }, [event, groupId]);

  // イベントデータ取得
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) return;
      const data: EventInfo = await res.json();
      setEvent(data);

      // ハンデ取得
      const year = new Date(data.event_date).getFullYear();
      fetch(`/api/admin/players?year=${year}`)
        .then(r => r.ok ? r.json() : [])
        .then((players: { id: string; current_handicap: number | null }[]) => {
          const hcMap: Record<string, number> = {};
          players.forEach(p => { hcMap[p.id] = p.current_handicap ?? 0; });
          setHandicaps(hcMap);
        })
        .catch(() => {});

      // サーバーのスコアをローカルに反映
      const scoreMap: Record<string, ScoreData> = {};
      data.scores.forEach((s) => {
        scoreMap[scoreKey(s.player_id, s.hole_number)] = s;
      });

      // ローカルの未送信スコアがあればマージ
      const pendingRaw = localStorage.getItem(PENDING_KEY(eventId));
      if (pendingRaw) {
        const pending: ScoreData[] = JSON.parse(pendingRaw);
        pending.forEach((s) => {
          scoreMap[scoreKey(s.player_id, s.hole_number)] = s;
        });
      }

      setScores(scoreMap);

      // ローカルにも保存
      localStorage.setItem(STORAGE_KEY(eventId), JSON.stringify(scoreMap));
    } catch {
      // オフライン時はローカルから復元
      const cached = localStorage.getItem(STORAGE_KEY(eventId));
      if (cached) {
        setScores(JSON.parse(cached));
      }
    }
    setLoading(false);
  }, [eventId]);

  // 初期化
  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // 最後の位置を復元
  useEffect(() => {
    if (!event) return;

    const members = getGroupMembers();
    if (members.length === 0) return;

    const lastPos = localStorage.getItem(LAST_POS_KEY(eventId, groupId));
    if (lastPos) {
      const { hole, userId } = JSON.parse(lastPos);
      setCurrentHole(hole);
      // 保存されたuserIdがこの組に所属しているか確認
      if (members.some(m => m.player_id === userId)) {
        setSelectedUserId(userId);
      } else {
        setSelectedUserId(members[0].player_id);
      }
    } else {
      setSelectedUserId(members[0].player_id);
    }
  }, [event, eventId, getGroupMembers]);

  // 位置を記録
  useEffect(() => {
    if (selectedUserId && currentHole) {
      localStorage.setItem(
        LAST_POS_KEY(eventId, groupId),
        JSON.stringify({ hole: currentHole, userId: selectedUserId })
      );
    }
  }, [selectedUserId, currentHole, eventId]);

  // 現在のホールの全メンバーにスコアがない場合、デフォルト値で初期化
  useEffect(() => {
    if (!currentHole || !event) return;

    const members = getGroupMembers();
    if (members.length === 0) return;

    const holePar = event.courses?.course_holes?.find((h) => h.hole_number === currentHole)?.par || 4;
    let hasUpdate = false;
    const newScores = { ...scores };

    members.forEach((member) => {
      const key = scoreKey(member.player_id, currentHole);
      if (!scores[key]) {
        newScores[key] = {
          event_id: eventId,
          player_id: member.player_id,
          hole_number: currentHole,
          strokes: holePar,
          putts: 2,
          isDefault: true,
        };
        hasUpdate = true;
      }
    });

    if (hasUpdate) {
      setScores(newScores);
      localStorage.setItem(STORAGE_KEY(eventId), JSON.stringify(newScores));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHole, event, scores, eventId]);

  // オンライン状態監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingScores();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // 未送信スコアの同期
  const syncPendingScores = useCallback(async () => {
    const pendingRaw = localStorage.getItem(PENDING_KEY(eventId));
    if (!pendingRaw) return;

    const pending: ScoreData[] = JSON.parse(pendingRaw);
    if (pending.length === 0) return;

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: pending }),
      });

      if (res.ok) {
        localStorage.removeItem(PENDING_KEY(eventId));
      }
    } catch {
      // 次回の接続時にリトライ
    }
  }, [eventId]);

  // スコア保存
  const saveScore = useCallback(
    async (userId: string, holeNumber: number, scoreData?: ScoreData) => {
      const key = scoreKey(userId, holeNumber);
      const score = scoreData || scores[key];
      if (!score || (score.strokes === 0 && score.putts === 0)) return;

      const payload = {
        event_id: eventId,
        player_id: userId,
        hole_number: holeNumber,
        strokes: score.strokes,
        putts: score.putts,
      };

      if (!navigator.onLine) {
        // オフライン: ペンディングに追加
        const pendingRaw = localStorage.getItem(PENDING_KEY(eventId));
        const pending: ScoreData[] = pendingRaw ? JSON.parse(pendingRaw) : [];
        const idx = pending.findIndex(
          (p) => p.player_id === userId && p.hole_number === holeNumber
        );
        if (idx >= 0) {
          pending[idx] = payload;
        } else {
          pending.push(payload);
        }
        localStorage.setItem(PENDING_KEY(eventId), JSON.stringify(pending));
        return;
      }

      setSaving(true);
      try {
        const res = await fetch('/api/scores', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error('Score save failed:', res.status, errBody);
        }
      } catch {
        // 失敗時はペンディングに追加
        const pendingRaw = localStorage.getItem(PENDING_KEY(eventId));
        const pending: ScoreData[] = pendingRaw ? JSON.parse(pendingRaw) : [];
        pending.push(payload);
        localStorage.setItem(PENDING_KEY(eventId), JSON.stringify(pending));
      }
      setSaving(false);
    },
    [scores, eventId]
  );

  // メンバー切替時・ホール移動時に自動保存
  const handleMemberSwitch = useCallback(
    (newUserId: string) => {
      if (!selectedUserId || selectedUserId === newUserId) return;

      const key = scoreKey(selectedUserId, currentHole);
      const prevScore = scores[key];

      if (prevScore?.isDefault) {
        // 何も入力せずに切替 → デフォルト値を確定スコアとして保存
        const confirmedScore = { ...prevScore, isDefault: false };
        const newScores = { ...scores, [key]: confirmedScore };
        setScores(newScores);
        localStorage.setItem(STORAGE_KEY(eventId), JSON.stringify(newScores));
        saveScore(selectedUserId, currentHole, confirmedScore);
      } else {
        saveScore(selectedUserId, currentHole);
      }

      setSelectedUserId(newUserId);
    },
    [selectedUserId, saveScore, currentHole, scores, eventId]
  );

  const handleHoleChange = useCallback(
    (newHole: number) => {
      // 現在のホールの全メンバーのスコアを保存（デフォルト値も確定スコアとして扱う）
      const members = getGroupMembers();
      let updatedScores = { ...scores };
      let hasConfirmed = false;

      members.forEach((member) => {
        const key = scoreKey(member.player_id, currentHole);
        const memberScore = updatedScores[key];
        if (memberScore?.isDefault) {
          updatedScores[key] = { ...memberScore, isDefault: false };
          hasConfirmed = true;
        }
      });

      if (hasConfirmed) {
        setScores(updatedScores);
        localStorage.setItem(STORAGE_KEY(eventId), JSON.stringify(updatedScores));
      }

      members.forEach((member) => {
        const key = scoreKey(member.player_id, currentHole);
        saveScore(member.player_id, currentHole, updatedScores[key]);
      });

      // 9H終了後（10Hに進む前）にアテスト画面を表示
      if (currentHole === 9 && newHole === 10) {
        setAttestType('front');
        setShowAttest(true);
        setAttestTab('scores');
        return;
      }

      // 18H終了後にアテスト画面を表示
      if (currentHole === 18 && newHole === 19) {
        setAttestType('full');
        setShowAttest(true);
        setAttestTab('scores');
        return;
      }

      // 範囲チェック
      if (newHole < 1 || newHole > 18) return;

      prevHoleRef.current = newHole;
      setCurrentHole(newHole);

      // ホール変更時は先頭メンバーを選択
      if (members.length > 0) {
        setSelectedUserId(members[0].player_id);
      }
    },
    [saveScore, currentHole, getGroupMembers, scores, eventId]
  );

  // アテスト確認OK
  const handleAttestConfirm = () => {
    setShowAttest(false);
    if (attestType === 'front') {
      setCurrentHole(10);
    } else if (attestType === 'full') {
      window.location.href = '/events';
    }
    setAttestType(null);
  };

  // アテスト修正
  const handleAttestEdit = (holeNumber: number, userId?: string) => {
    setShowAttest(false);
    if (userId) {
      setSelectedUserId(userId);
    }
    setCurrentHole(holeNumber);
    setAttestType(null);
  };

  // スコア集計（指定範囲のストローク・パット合計）
  const calculateTotal = (userId: string, startHole: number, endHole: number) => {
    let totalStrokes = 0;
    let totalPutts = 0;
    for (let h = startHole; h <= endHole; h++) {
      const key = scoreKey(userId, h);
      const score = scores[key];
      if (score) {
        totalStrokes += score.strokes || 0;
        totalPutts += score.putts || 0;
      }
    }
    return { strokes: totalStrokes, putts: totalPutts };
  };

  // リーダーズボード計算（全参加者・指定ホールまで）
  const calculateLeaderboard = useCallback((maxHole: number) => {
    if (!event) return [];
    return event.event_participants.map(p => {
      let gross = 0;
      let holesPlayed = 0;
      let latestHole = 0;
      for (let h = 1; h <= maxHole; h++) {
        const s = scores[scoreKey(p.player_id, h)];
        if (s) {
          latestHole = h;
          if (s.strokes > 0 && !s.isDefault) {
            gross += s.strokes;
            holesPlayed++;
          }
        }
      }
      const hc = handicaps[p.player_id] ?? 0;
      return {
        player_id: p.player_id,
        name: p.players.name,
        gross,
        net: gross > 0 ? gross - hc : 0,
        hc,
        holesPlayed,
        latestHole,
      };
    }).filter(r => r.holesPlayed > 0);
  }, [event, scores, handicaps]);

  // スコア値の更新
  const updateScore = (field: 'strokes' | 'putts', delta: number) => {
    if (!selectedUserId) return;
    const key = scoreKey(selectedUserId, currentHole);
    const holePar = event?.courses?.course_holes?.find((h) => h.hole_number === currentHole)?.par || 4;
    const current = scores[key] || {
      event_id: eventId,
      player_id: selectedUserId,
      hole_number: currentHole,
      strokes: holePar,
      putts: 2,
    };

    let newVal = (current[field] || 0) + delta;
    if (field === 'strokes' && newVal < 1) newVal = 1;
    if (field === 'putts' && newVal < 0) newVal = 0;

    const updated = { ...current, [field]: newVal, isDefault: false };
    const newScores = { ...scores, [key]: updated };
    setScores(newScores);
    localStorage.setItem(STORAGE_KEY(eventId), JSON.stringify(newScores));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">イベントが見つかりません</p>
      </div>
    );
  }

  const holes = event.courses?.course_holes?.sort((a, b) => a.hole_number - b.hole_number) || [];
  const currentPar = holes.find((h) => h.hole_number === currentHole)?.par || 4;
  const groupMembers = getGroupMembers();
  const currentScore = scores[scoreKey(selectedUserId, currentHole)] || {
    strokes: currentPar,
    putts: 2,
  };

  const diff = currentScore.strokes > 0 ? currentScore.strokes - currentPar : 0;

  // ランキングテーブル描画（グロス/ネット切り替え対応）
  const renderRankingContent = (maxHole: number) => {
    const board = calculateLeaderboard(maxHole);
    const sorted = [...board].sort((a, b) =>
      leaderboardTab === 'gross' ? a.gross - b.gross : a.net - b.net
    );
    return (
      <div>
        <div className="flex border-b border-gray-200 mb-1">
          {(['gross', 'net'] as const).map(t => (
            <button
              key={t}
              onClick={() => setLeaderboardTab(t)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                leaderboardTab === t ? 'border-[#22393c] text-[#22393c]' : 'border-transparent text-gray-500'
              }`}
            >
              {t === 'gross' ? 'グロス' : 'ネット'}
            </button>
          ))}
        </div>
        {sorted.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">スコアデータがありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-center text-gray-700 w-10">#</th>
                <th className="px-2 py-2 text-left text-gray-700">名前</th>
                <th className="px-2 py-2 text-center text-gray-500">H</th>
                <th className={`px-2 py-2 text-center ${leaderboardTab === 'gross' ? 'text-[#22393c] font-bold' : 'text-gray-700'}`}>グロス</th>
                <th className="px-2 py-2 text-center text-gray-500 text-xs">HC</th>
                <th className={`px-2 py-2 text-center ${leaderboardTab === 'net' ? 'text-[#22393c] font-bold' : 'text-gray-700'}`}>ネット</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => {
                const holeLabel = r.holesPlayed >= 18 ? 'F' : `${r.latestHole}`;
                return (
                  <tr key={r.player_id} className={`border-t border-gray-200 ${idx === 0 ? 'bg-yellow-50' : idx === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="px-2 py-2 text-center font-bold text-gray-500">{idx + 1}</td>
                    <td className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                    <td className={`px-2 py-2 text-center text-xs font-bold ${r.holesPlayed >= 18 ? 'text-green-700' : 'text-gray-400'}`}>{holeLabel}</td>
                    <td className={`px-2 py-2 text-center font-bold ${leaderboardTab === 'gross' ? 'text-[#22393c]' : 'text-gray-600'}`}>{r.gross}</td>
                    <td className="px-2 py-2 text-center text-gray-400 text-xs">{r.hc}</td>
                    <td className={`px-2 py-2 text-center font-bold ${leaderboardTab === 'net' ? 'text-[#22393c]' : 'text-gray-600'}`}>{r.net}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  // リーダーズボードモーダル（フローティングボタンから）
  const renderLeaderboardModal = () => {
    if (!showLeaderboard) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-h-[85vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold text-gray-900">リーダーズボード</h2>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
          <div className="overflow-auto p-4">
            {renderRankingContent(currentHole)}
          </div>
        </div>
      </div>
    );
  };

  // スコア一覧モーダル（いつでも表示可能）
  const renderScoreListModal = () => {
    if (!showScoreList) return null;
    const displayHoles = Array.from({ length: currentHole }, (_, i) => i + 1);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
          <div className="p-4 border-b border-gray-200 sticky top-0 bg-white flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">スコア一覧（1H〜{currentHole}H）</h2>
            <button
              onClick={() => setShowScoreList(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 sticky left-0 bg-gray-100 z-10">
                    ホール
                  </th>
                  {groupMembers.map((member) => (
                    <th key={member.player_id} className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 min-w-[100px]">
                      {member.players.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayHoles.map((h) => {
                  const holePar = holes.find((hole) => hole.hole_number === h)?.par || 4;
                  return (
                    <tr key={h} className={h === currentHole ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                      <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 bg-gray-50 sticky left-0 z-10">
                        <button
                          onClick={() => { setShowScoreList(false); setCurrentHole(h); }}
                          className="text-green-700 hover:text-green-900 hover:underline"
                        >
                          {h}H
                        </button>
                        <div className="text-xs text-gray-600 font-normal">PAR {holePar}</div>
                      </td>
                      {groupMembers.map((member) => {
                        const score = scores[scoreKey(member.player_id, h)];
                        const strokeVal = score?.strokes || 0;
                        const puttVal = score?.putts || 0;
                        const diffVal = strokeVal - holePar;
                        let bgColor = 'bg-white';
                        let textColor = 'text-gray-900';
                        if (strokeVal > 0) {
                          if (diffVal <= -1) { bgColor = 'bg-blue-50'; textColor = 'text-blue-900'; }
                          else if (diffVal === 1) { bgColor = 'bg-orange-50'; textColor = 'text-orange-900'; }
                          else if (diffVal >= 2) { bgColor = 'bg-red-50'; textColor = 'text-red-900'; }
                        }
                        return (
                          <td
                            key={member.player_id}
                            onClick={() => { setShowScoreList(false); setSelectedUserId(member.player_id); setCurrentHole(h); }}
                            className={`border border-gray-300 px-3 py-2 text-center cursor-pointer ${bgColor} hover:ring-2 hover:ring-inset hover:ring-green-600`}
                          >
                            <div className={`text-2xl font-bold ${textColor}`}>
                              {strokeVal > 0 ? `${strokeVal} (${puttVal})` : '-'}
                            </div>
                            {strokeVal > 0 && diffVal !== 0 && (
                              <div className={`text-xs font-semibold ${textColor} mt-1`}>
                                ({diffVal > 0 ? '+' : ''}{diffVal})
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-green-50 font-bold">
                  <td className="border-2 border-green-700 px-3 py-3 text-center text-green-900 sticky left-0 bg-green-50 z-10">
                    合計
                  </td>
                  {groupMembers.map((member) => {
                    const total = calculateTotal(member.player_id, 1, currentHole);
                    return (
                      <td key={member.player_id} className="border-2 border-green-700 px-3 py-3 text-center">
                        <div className="text-2xl font-bold text-green-900">{total.strokes || '-'}</div>
                        <div className="text-xs text-gray-600 mt-1">P: {total.putts || '-'}</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              onClick={() => setShowScoreList(false)}
              className="w-full py-3 px-4 bg-gray-600 text-white font-bold rounded hover:bg-gray-700 active:bg-gray-700"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  };

  // アテストモーダルの表示内容
  const renderAttestModal = () => {
    if (!showAttest || !attestType) return null;

    const isFront = attestType === 'front';
    const displayHoles = isFront ? Array.from({ length: 9 }, (_, i) => i + 1) : Array.from({ length: 18 }, (_, i) => i + 1);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
          <div className="p-4 border-b border-gray-200 sticky top-0 bg-white">
            <h2 className="text-lg font-bold text-gray-900">
              {isFront ? '前半9ホール アテスト' : '18ホール アテスト'}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 sticky left-0 bg-gray-100 z-10">
                    ホール
                  </th>
                  {groupMembers.map((member) => (
                    <th key={member.player_id} className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 min-w-[100px]">
                      {member.players.name}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {displayHoles.map((h) => {
                  const holePar = holes.find((hole) => hole.hole_number === h)?.par || 4;

                  return (
                    <tr key={h} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 bg-gray-50 sticky left-0 z-10">
                        <button
                          onClick={() => handleAttestEdit(h)}
                          className="text-green-700 hover:text-green-900 hover:underline"
                        >
                          {h}H
                        </button>
                        <div className="text-xs text-gray-600 font-normal">
                          PAR {holePar}
                        </div>
                      </td>

                      {groupMembers.map((member) => {
                        const score = scores[scoreKey(member.player_id, h)];
                        const strokeVal = score?.strokes || 0;
                        const puttVal = score?.putts || 0;
                        const diffVal = strokeVal - holePar;
                        let bgColor = 'bg-white';
                        let textColor = 'text-gray-900';

                        if (strokeVal > 0) {
                          if (diffVal <= -1) {
                            bgColor = 'bg-blue-50';
                            textColor = 'text-blue-900';
                          } else if (diffVal === 1) {
                            bgColor = 'bg-orange-50';
                            textColor = 'text-orange-900';
                          } else if (diffVal >= 2) {
                            bgColor = 'bg-red-50';
                            textColor = 'text-red-900';
                          }
                        }

                        return (
                          <td
                            key={member.player_id}
                            onClick={() => handleAttestEdit(h, member.player_id)}
                            className={`border border-gray-300 px-3 py-2 text-center cursor-pointer ${bgColor} hover:ring-2 hover:ring-inset hover:ring-green-600`}
                          >
                            <div className={`text-2xl font-bold ${textColor}`}>
                              {strokeVal > 0 ? `${strokeVal} (${puttVal})` : '-'}
                            </div>
                            {strokeVal > 0 && diffVal !== 0 && (
                              <div className={`text-xs font-semibold ${textColor} mt-1`}>
                                ({diffVal > 0 ? '+' : ''}{diffVal})
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                <tr className="bg-green-50 font-bold">
                  <td className="border-2 border-green-700 px-3 py-3 text-center text-green-900 sticky left-0 bg-green-50 z-10">
                    合計
                  </td>
                  {groupMembers.map((member) => {
                    const outTotal = calculateTotal(member.player_id, 1, 9);
                    const inTotal = calculateTotal(member.player_id, 10, 18);
                    const fullTotal = {
                      strokes: outTotal.strokes + inTotal.strokes,
                      putts: outTotal.putts + inTotal.putts
                    };

                    return (
                      <td key={member.player_id} className="border-2 border-green-700 px-3 py-3 text-center">
                        {!isFront && (
                          <div className="flex justify-center gap-4 mb-2 text-sm">
                            <div>
                              <span className="text-gray-600">OUT:</span>{' '}
                              <span className="text-gray-900">{outTotal.strokes || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">IN:</span>{' '}
                              <span className="text-gray-900">{inTotal.strokes || '-'}</span>
                            </div>
                          </div>
                        )}
                        <div className="text-2xl font-bold text-green-900">
                          {isFront ? (outTotal.strokes || '-') : (fullTotal.strokes || '-')}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          P: {isFront ? (outTotal.putts || '-') : (fullTotal.putts || '-')}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 flex gap-2 sticky bottom-0 bg-white">
            <button
              onClick={handleAttestConfirm}
              className="flex-1 py-3 px-4 bg-[#22393c] text-white font-bold rounded hover:bg-[#1a2c2e] active:bg-[#1a2c2e]"
            >
              {isFront ? '確認OK（後半へ）' : '確認OK（完了）'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#cecdb9] select-none">
      {/* 1. メンバー選択（2行×2列）＋右サイドパネル */}
      <div className="flex-[2] flex gap-px" style={{ backgroundColor: '#b0a898' }}>
        <div className="flex-1 grid grid-cols-2 gap-px">
          {Array.from({ length: 4 }).map((_, i) => {
            const p = groupMembers[i];
            if (!p) {
              return (
                <div
                  key={`empty-${i}`}
                  style={{ backgroundColor: '#d6cabc' }}
                />
              );
            }
            const memberScore = scores[scoreKey(p.player_id, currentHole)];
            return (
              <button
                key={p.player_id}
                onClick={() => handleMemberSwitch(p.player_id)}
                className="pt-3 pb-5 pl-3 font-bold transition-colors relative overflow-hidden flex items-start justify-start text-white"
                style={{
                  fontSize: 'min(28px, 6.5vw)',
                  backgroundColor: selectedUserId === p.player_id ? '#1d3937' : '#d6cabc',
                }}
              >
                {memberScore && !memberScore.isDefault && (
                  <span
                    className="absolute bottom-1 right-2 font-black leading-none pointer-events-none"
                    style={{ fontSize: 'min(42px, 10vw)', opacity: selectedUserId === p.player_id ? 0.35 : 0.7, color: '#ffffff' }}
                  >
                    {memberScore.strokes}({memberScore.putts})
                  </span>
                )}
                <span className="relative z-10">{p.players.name}</span>
              </button>
            );
          })}
        </div>
        {/* 右サイドパネル：一覧・順位 */}
        <div className="flex flex-col gap-px" style={{ width: 'min(112px, 28vw)' }}>
          <button
            onClick={() => setShowScoreList(true)}
            className="flex-1 flex flex-col items-center justify-center font-bold text-white active:opacity-70"
            style={{ backgroundColor: '#556b4e', fontSize: 'min(20px, 5vw)' }}
          >
            一覧
          </button>
          <button
            onClick={() => { setLeaderboardTab('gross'); setShowLeaderboard(true); }}
            className="flex-1 flex flex-col items-center justify-center font-bold text-white active:opacity-70"
            style={{ backgroundColor: '#1d3937', fontSize: 'min(20px, 5vw)' }}
          >
            順位
          </button>
        </div>
      </div>

      {/* 2. 打数エリア */}
      <div className="flex-[2] flex">
        <button
          onClick={() => updateScore('strokes', -1)}
          className="flex-1 flex items-center justify-center active:opacity-70"
          style={{ backgroundColor: '#195042' }}
        >
          <span className="text-[min(80px,20vw)] leading-none font-light text-white">
            −
          </span>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#556b4e' }}>
          <span className="text-4xl font-bold mb-2 text-white">打数</span>
          <span
            className="font-bold text-white"
            style={{ fontSize: 'min(100px, 25vw)' }}
          >
            {currentScore.strokes}
          </span>
          <span
            className={`text-sm font-bold mt-1 min-h-[20px] ${
              diff > 0 ? 'text-red-300' : diff < 0 ? 'text-blue-300' : 'text-white/60'
            }`}
          >
            {currentScore.strokes > 0 && diff !== 0 ? `${diff > 0 ? '+' : ''}${diff}` : ''}
          </span>
        </div>

        <button
          onClick={() => updateScore('strokes', 1)}
          className="flex-1 flex items-center justify-center active:opacity-80"
          style={{ backgroundColor: '#195042' }}
        >
          <span className="text-[min(80px,20vw)] leading-none text-white font-bold">
            +
          </span>
        </button>
      </div>

      {/* 3. パットエリア */}
      <div className="flex-[2] flex">
        <button
          onClick={() => updateScore('putts', -1)}
          className="flex-1 flex items-center justify-center active:opacity-70"
          style={{ backgroundColor: '#91855a' }}
        >
          <span className="text-[min(80px,20vw)] leading-none font-light" style={{ color: '#1d3937' }}>
            −
          </span>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#b3a78b' }}>
          <span className="text-4xl font-bold mb-2" style={{ color: '#1d3937' }}>パット</span>
          <span
            className="font-bold"
            style={{ fontSize: 'min(100px, 25vw)', color: '#1d3937' }}
          >
            {currentScore.putts}
          </span>
        </div>

        <button
          onClick={() => updateScore('putts', 1)}
          className="flex-1 flex items-center justify-center active:opacity-80"
          style={{ backgroundColor: '#91855a' }}
        >
          <span className="text-[min(80px,20vw)] leading-none font-bold" style={{ color: '#1d3937' }}>
            +
          </span>
        </button>
      </div>

      {/* 4. ホール番号ナビ */}
      <div className="flex-1 flex">
        <button
          onClick={() => handleHoleChange(currentHole - 1)}
          disabled={currentHole <= 1}
          className="flex-1 flex items-center justify-center disabled:opacity-25 active:opacity-60"
          style={{ backgroundColor: '#d6cabc' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[70px] h-[70px] text-[#1d3937]">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#7a827a' }}>
          <span className="font-bold text-white" style={{ fontSize: 'min(56px, 14vw)' }}>
            {currentHole}H
          </span>
          <span className="font-bold block -mt-1 text-white/70" style={{ fontSize: 'min(30px, 7vw)' }}>
            PAR {currentPar}
          </span>
        </div>

        <button
          onClick={() => handleHoleChange(currentHole + 1)}
          className="flex-1 flex items-center justify-center active:opacity-60"
          style={{ backgroundColor: '#d6cabc', color: '#1d3937', opacity: currentHole >= 18 ? 0.25 : 1 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[70px] h-[70px] text-[#1d3937]">
            <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
          </svg>
        </button>
      </div>


{/* スコア一覧モーダル */}
      {renderScoreListModal()}

      {/* リーダーズボードモーダル */}
      {renderLeaderboardModal()}

      {/* アテストモーダル */}
      {renderAttestModal()}
    </div>
  );
}
