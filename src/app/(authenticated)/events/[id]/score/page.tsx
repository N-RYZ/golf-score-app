'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { useAuth } from '@/lib/auth-context';

type CourseHole = { hole_number: number; par: number };
type GroupMember = { player_id: string; players: { id: string; name: string } };
type EventGroup = { id: string; group_number: number; start_hole: number; group_members: GroupMember[] };
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
  courses: { name: string; course_holes: CourseHole[]; nine_names: string[] } | null;
  event_participants: Participant[];
  event_groups: EventGroup[];
  scores: ScoreData[];
};

const surname = (fullName: string) => fullName.split(/[ 　]/)[0];

const parDiffPill = (diff: number) => {
  if (diff <= -2) return { bg: '#1B5B44', color: '#8FD9B4', label: diff <= -3 ? `${diff}` : 'EAGLE' };
  if (diff === -1) return { bg: '#2E6B52', color: '#DFF3E8', label: 'BIRDIE' };
  if (diff === 0) return { bg: '#25574F', color: '#B9CFC5', label: 'PAR' };
  if (diff === 1) return { bg: '#B45B3C', color: '#ffffff', label: 'BOGEY' };
  return { bg: '#7A3B26', color: '#F0C4B2', label: `+${diff}` };
};

const strokeColor = (strokeVal: number, diffVal: number) => {
  if (strokeVal <= 0) return '#3E574F';
  if (diffVal < 0) return '#6BAF8E';
  if (diffVal === 0) return '#ffffff';
  if (diffVal === 1) return '#E5B39C';
  return '#D98E6E';
};

// ローカルストレージキー
const STORAGE_KEY = (eventId: string) => `golf-scores-${eventId}`;
const LAST_POS_KEY = (eventId: string, groupId?: string | null) => `golf-lastpos-${eventId}-${groupId || 'all'}`;
const PENDING_KEY = (eventId: string) => `golf-pending-${eventId}`;

export default function ScoreInputPage() {
  const { isViewer } = useAuth();
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

  // このグループのスタートホール（1=OUTスタート, 10=INスタート）
  const startHole = useMemo(() => {
    if (!event || !groupId) return 1;
    return event.event_groups.find((g) => g.id === groupId)?.start_hole ?? 1;
  }, [event, groupId]);

  // プレー順のホール配列（コースの全ホールを基準にスタートホールから18ホール分）
  const holeSequence = useMemo(() => {
    const allHoleNums = (event?.courses?.course_holes ?? [])
      .map((h) => h.hole_number)
      .sort((a, b) => a - b);

    if (allHoleNums.length === 0) {
      // コースデータなし: フォールバック（18ホール固定）
      if (startHole === 1) return Array.from({ length: 18 }, (_, i) => i + 1);
      return [
        ...Array.from({ length: 9 }, (_, i) => i + 10),
        ...Array.from({ length: 9 }, (_, i) => i + 1),
      ];
    }

    const startIdx = allHoleNums.indexOf(startHole);
    const effectiveStart = startIdx === -1 ? 0 : startIdx;
    const totalHoles = allHoleNums.length;

    // スタートホールから18ホール分を順に取得（巻き戻しあり）
    return Array.from({ length: 18 }, (_, i) =>
      allHoleNums[(effectiveStart + i) % totalHoles]
    );
  }, [startHole, event]);

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
      const currentYear = new Date().getFullYear();
      const [res, playersRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/admin/players?year=${currentYear}`)
      ]);
      if (!res.ok) return;
      const data: EventInfo = await res.json();
      setEvent(data);

      // ハンデ取得
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
      setCurrentHole(startHole);
      setSelectedUserId(members[0].player_id);
    }
  }, [event, eventId, getGroupMembers, startHole]);

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
    if (isViewer) return;
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
      if (isViewer) return;
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

      if (!isViewer) {
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
      }

      setSelectedUserId(newUserId);
    },
    [isViewer, selectedUserId, saveScore, currentHole, scores, eventId]
  );

  const handleHoleChange = useCallback(
    (newHole: number) => {
      const members = getGroupMembers();

      if (!isViewer) {
        // 現在のホールの全メンバーのスコアを保存（デフォルト値も確定スコアとして扱う）
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
      }

      // 前半終了（シーケンス9番目→10番目: OUT=9→10, IN=18→1）
      if (currentHole === holeSequence[8] && newHole === holeSequence[9]) {
        setAttestType('front');
        setShowAttest(true);
        setAttestTab('scores');
        return;
      }

      // 全体終了（最後のホールから sentinel -1）
      if (currentHole === holeSequence[17] && newHole === -1) {
        setAttestType('full');
        setShowAttest(true);
        setAttestTab('scores');
        return;
      }

      // 範囲チェック
      if (!holeSequence.includes(newHole)) return;

      prevHoleRef.current = newHole;
      setCurrentHole(newHole);

      // ホール変更時は先頭メンバーを選択
      if (members.length > 0) {
        setSelectedUserId(members[0].player_id);
      }
    },
    [isViewer, saveScore, currentHole, getGroupMembers, scores, eventId, holeSequence]
  );

  // アテスト確認OK
  const handleAttestConfirm = () => {
    setShowAttest(false);
    if (attestType === 'front') {
      setCurrentHole(holeSequence[9]); // OUTスタート: 10, INスタート: 1
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
    // event_participants と全組のメンバーをマージして重複除去
    const seen = new Set<string>();
    const allParticipants: Participant[] = [];
    [...event.event_participants, ...event.event_groups.flatMap(g =>
      g.group_members.map(m => ({ player_id: m.player_id, players: m.players }))
    )].forEach(p => {
      if (!seen.has(p.player_id)) {
        seen.add(p.player_id);
        allParticipants.push(p);
      }
    });
    return allParticipants.map(p => {
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
    if (isViewer || !selectedUserId) return;
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
  const currentHoleIdx = holeSequence.indexOf(currentHole);
  const groupMembers = getGroupMembers();
  const currentScore = scores[scoreKey(selectedUserId, currentHole)] || {
    strokes: currentPar,
    putts: 2,
  };

  const currentGroup = groupId ? event.event_groups.find((g) => g.id === groupId) : null;
  const nineLabel = startHole === 10 ? 'IN' : startHole === 19 ? 'EXT' : 'OUT';
  const currentGroupLabel = currentGroup ? `第${currentGroup.group_number}組` : null;
  const headerSubtitle = [nineLabel, currentGroupLabel, `${currentHoleIdx + 1}/18ホール`]
    .filter(Boolean)
    .join(' · ');

  const diff = currentScore.strokes > 0 ? currentScore.strokes - currentPar : 0;

  // リーダーズボードモーダル（フローティングボタンから）
  const renderLeaderboardModal = () => {
    if (!showLeaderboard) return null;
    const maxEnteredHole = Object.values(scores)
      .filter(s => s.strokes > 0 && !s.isDefault)
      .reduce((max, s) => Math.max(max, s.hole_number), 0);
    const displayHole = maxEnteredHole || currentHole;
    const board = calculateLeaderboard(displayHole);
    const sorted = [...board].sort((a, b) =>
      leaderboardTab === 'gross' ? a.gross - b.gross : a.net - b.net
    );

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0E1A18' }}>
        <div className="shrink-0" style={{ backgroundColor: '#12211F', padding: '18px 20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>リーダーズボード</h2>
          <p style={{ fontSize: '14px', color: '#8FA69C' }}>{displayHole}H時点 · 参加{sorted.length}名</p>
          <div className="flex gap-2 mt-3">
            {(['gross', 'net'] as const).map(t => (
              <button
                key={t}
                onClick={() => setLeaderboardTab(t)}
                className="font-bold"
                style={{
                  padding: '7px 16px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  backgroundColor: leaderboardTab === t ? '#6BAF8E' : '#1B322C',
                  color: leaderboardTab === t ? '#0E1A18' : '#8FA69C',
                }}
              >
                {t === 'gross' ? 'グロス' : 'ネット'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {sorted.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: '#8FA69C' }}>スコアデータがありません</p>
          ) : (
            sorted.map((r, idx) => {
              const isFirst = idx === 0;
              const holeLabel = r.holesPlayed >= 18 ? 'F' : `${r.latestHole}H`;
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
                      <p className="font-num truncate" style={{ fontSize: '13px', color: '#8FA69C' }}>
                        GROSS {r.gross} · HC {r.hc} · {holeLabel}
                      </p>
                    </div>
                  </div>
                  <span className="font-num shrink-0" style={{ fontSize: '30px', fontWeight: 800, color: isFirst ? '#6BAF8E' : '#C9D8D2' }}>
                    {leaderboardTab === 'gross' ? r.gross : r.net}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0" style={{ padding: '12px 16px' }}>
          <button
            onClick={() => setShowLeaderboard(false)}
            className="w-full flex items-center justify-center"
            style={{ height: '60px', borderRadius: '16px', backgroundColor: '#182D28' }}
          >
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#B9CFC5' }}>← スコア入力に戻る</span>
          </button>
        </div>
      </div>
    );
  };

  // スコア一覧モーダル（当組メンバーのみ・いつでも表示可能）
  const renderScoreListModal = () => {
    if (!showScoreList) return null;
    const displayHoles = holeSequence;
    const cols = groupMembers.length || 1;

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0E1A18' }}>
        <div className="shrink-0" style={{ backgroundColor: '#12211F', padding: '18px 20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>
            スコア一覧{currentGroupLabel ? `（${currentGroupLabel}）` : ''}
          </h2>
          <p style={{ fontSize: '14px', color: '#8FA69C' }}>数字をタップでそのホールを修正</p>
        </div>

        <div className="flex-1 overflow-auto">
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${cols}, 1fr)` }}>
            <div className="sticky top-0" style={{ backgroundColor: '#1B322C' }} />
            {groupMembers.map((member) => (
              <div key={member.player_id} className="sticky top-0 flex items-center justify-center py-2" style={{ backgroundColor: '#1B322C' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#E4EDE9' }}>{surname(member.players.name)}</span>
              </div>
            ))}

            {displayHoles.map((h, hi) => {
              const holePar = holes.find((hole) => hole.hole_number === h)?.par || 4;
              const isCurrent = h === currentHole;
              const rowBg = isCurrent ? '#1F4A3F' : hi % 2 === 0 ? '#0E1A18' : '#101B19';
              return (
                <Fragment key={h}>
                  <button
                    onClick={() => { setShowScoreList(false); setCurrentHole(h); }}
                    className="flex flex-col items-center justify-center py-2"
                    style={{ backgroundColor: rowBg }}
                  >
                    <span className="font-num" style={{ fontSize: '16px', fontWeight: 800, color: '#6BAF8E' }}>{h}</span>
                    <span style={{ fontSize: '11px', color: '#5C7A70' }}>P{holePar}</span>
                  </button>
                  {groupMembers.map((member) => {
                    const score = scores[scoreKey(member.player_id, h)];
                    const strokeVal = score && !score.isDefault ? score.strokes : 0;
                    const puttVal = score && !score.isDefault ? score.putts : 0;
                    const diffVal = strokeVal - holePar;
                    return (
                      <button
                        key={member.player_id}
                        onClick={() => { setShowScoreList(false); setSelectedUserId(member.player_id); setCurrentHole(h); }}
                        className="flex items-baseline justify-center gap-1 py-2"
                        style={{ backgroundColor: rowBg }}
                      >
                        {strokeVal > 0 ? (
                          <>
                            <span className="font-num" style={{ fontSize: '19px', fontWeight: 700, color: strokeColor(strokeVal, diffVal) }}>{strokeVal}</span>
                            <span className="font-num" style={{ fontSize: '12px', color: '#8FA69C' }}>({puttVal})</span>
                          </>
                        ) : (
                          <span style={{ fontSize: '19px', color: '#3E574F' }}>–</span>
                        )}
                      </button>
                    );
                  })}
                </Fragment>
              );
            })}

            <div className="flex items-center justify-center py-3" style={{ backgroundColor: '#2C2A20' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#9A8F72' }}>合計</span>
            </div>
            {groupMembers.map((member) => {
              const total = calculateTotal(member.player_id, 1, 18);
              return (
                <div key={member.player_id} className="flex flex-col items-center justify-center py-3" style={{ backgroundColor: '#2C2A20' }}>
                  <span className="font-num" style={{ fontSize: '22px', fontWeight: 800, color: '#EDE3CB' }}>{total.strokes || '-'}</span>
                  <span className="font-num" style={{ fontSize: '11px', color: '#9A8F72' }}>P {total.putts || '-'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0" style={{ padding: '12px 16px' }}>
          <button
            onClick={() => setShowScoreList(false)}
            className="w-full flex items-center justify-center"
            style={{ height: '60px', borderRadius: '16px', backgroundColor: '#182D28' }}
          >
            <span style={{ fontSize: '19px', fontWeight: 700, color: '#B9CFC5' }}>← スコア入力に戻る</span>
          </button>
        </div>
      </div>
    );
  };

  // アテストモーダルの表示内容
  const renderAttestModal = () => {
    if (!showAttest || !attestType) return null;

    const isFront = attestType === 'front';
    const displayHoles = isFront ? holeSequence.slice(0, 9) : holeSequence;
    const cols = groupMembers.length || 1;

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#0E1A18' }}>
        <div className="shrink-0" style={{ backgroundColor: '#1F4A3F', borderBottom: '1px solid #2E6B52', padding: '18px 20px' }}>
          <p className="font-num" style={{ fontSize: '13px', fontWeight: 700, color: '#6BAF8E', letterSpacing: '.1em' }}>ATTEST</p>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff' }}>
            {isFront ? '前半9ホール 確認' : '18ホール 確認'}
          </h2>
        </div>

        <div className="flex-1 overflow-auto">
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${cols}, 1fr)` }}>
            <div className="sticky top-0" style={{ backgroundColor: '#1B322C' }} />
            {groupMembers.map((member) => (
              <div key={member.player_id} className="sticky top-0 flex items-center justify-center py-2" style={{ backgroundColor: '#1B322C' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#E4EDE9' }}>{surname(member.players.name)}</span>
              </div>
            ))}

            {displayHoles.map((h, hi) => {
              const holePar = holes.find((hole) => hole.hole_number === h)?.par || 4;
              const rowBg = hi % 2 === 0 ? '#0E1A18' : '#101B19';
              return (
                <Fragment key={h}>
                  <button
                    onClick={() => handleAttestEdit(h)}
                    className="flex flex-col items-center justify-center py-2"
                    style={{ backgroundColor: rowBg }}
                  >
                    <span className="font-num" style={{ fontSize: '16px', fontWeight: 800, color: '#6BAF8E' }}>{h}</span>
                    <span style={{ fontSize: '11px', color: '#5C7A70' }}>P{holePar}</span>
                  </button>

                  {groupMembers.map((member) => {
                    const score = scores[scoreKey(member.player_id, h)];
                    const strokeVal = score?.strokes || 0;
                    const puttVal = score?.putts || 0;
                    const diffVal = strokeVal - holePar;

                    return (
                      <button
                        key={member.player_id}
                        onClick={() => handleAttestEdit(h, member.player_id)}
                        className="flex items-baseline justify-center gap-1 py-2"
                        style={{ backgroundColor: rowBg }}
                      >
                        {strokeVal > 0 ? (
                          <>
                            <span className="font-num" style={{ fontSize: '19px', fontWeight: 700, color: strokeColor(strokeVal, diffVal) }}>{strokeVal}</span>
                            <span className="font-num" style={{ fontSize: '12px', color: '#8FA69C' }}>({puttVal})</span>
                          </>
                        ) : (
                          <span style={{ fontSize: '19px', color: '#3E574F' }}>–</span>
                        )}
                      </button>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>

          {/* 集計行 */}
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${cols}, 1fr)`, backgroundColor: '#2C2A20' }} className="mt-1">
            <div className="flex items-center justify-center py-3">
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#9A8F72' }}>{isFront ? 'OUT' : '合計'}</span>
            </div>
            {groupMembers.map((member) => {
              const outTotal = calculateTotal(member.player_id, 1, 9);
              const inTotal = calculateTotal(member.player_id, 10, 18);
              const fullTotal = {
                strokes: outTotal.strokes + inTotal.strokes,
                putts: outTotal.putts + inTotal.putts,
              };
              // 前半アテスト: OUTスタートなら1-9合計、INスタートなら10-18合計
              const firstHalfTotal = startHole === 1 ? outTotal : inTotal;
              const shown = isFront ? firstHalfTotal : fullTotal;

              return (
                <div key={member.player_id} className="flex flex-col items-center justify-center py-3">
                  {!isFront && (
                    <div className="font-num flex gap-2 mb-1" style={{ fontSize: '11px', color: '#9A8F72' }}>
                      <span>{event.courses?.nine_names?.[0] || 'OUT'} {outTotal.strokes || '-'}</span>
                      <span>{event.courses?.nine_names?.[1] || 'IN'} {inTotal.strokes || '-'}</span>
                    </div>
                  )}
                  <span className="font-num" style={{ fontSize: '28px', fontWeight: 800, color: '#EDE3CB' }}>{shown.strokes || '-'}</span>
                  <span className="font-num" style={{ fontSize: '11px', color: '#9A8F72' }}>P {shown.putts || '-'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0" style={{ padding: '12px 16px' }}>
          <button
            onClick={handleAttestConfirm}
            className="w-full flex items-center justify-center"
            style={{ height: '64px', borderRadius: '16px', backgroundColor: '#6BAF8E' }}
          >
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#0E1A18' }}>
              {isFront ? '確認OK（後半へ）' : '確認OK（完了）'}
            </span>
          </button>
        </div>
      </div>
    );
  };

  const pill = parDiffPill(diff);

  return (
    <div className="h-dvh flex flex-col select-none" style={{ backgroundColor: '#0E1A18' }}>
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between gap-3 shrink-0"
        style={{ backgroundColor: '#12211F', padding: '12px 16px 10px', borderBottom: '1px solid rgba(255,255,255,.08)' }}
      >
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{event.courses?.name}</p>
          <p className="font-num truncate" style={{ fontSize: '12px', color: '#8FA69C' }}>{headerSubtitle}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowScoreList(true)}
            className="flex flex-col items-center justify-center gap-0.5 active:opacity-70"
            style={{ height: '46px', padding: '0 13px', borderRadius: '13px', backgroundColor: '#2C2A20', color: '#D8C79A' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[19px] h-[19px]">
              <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>一覧</span>
          </button>
          <button
            onClick={() => { setLeaderboardTab('gross'); setShowLeaderboard(true); }}
            className="flex flex-col items-center justify-center gap-0.5 active:opacity-70"
            style={{ height: '46px', padding: '0 13px', borderRadius: '13px', backgroundColor: '#1F4A3F', border: '1.5px solid #6BAF8E', color: '#6BAF8E' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-[19px] h-[19px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>順位</span>
          </button>
        </div>
      </div>

      {/* 進捗バー */}
      <div className="shrink-0" style={{ height: '3px', backgroundColor: '#1B322C' }}>
        <div style={{ height: '100%', width: `${((currentHoleIdx + 1) / 18) * 100}%`, backgroundColor: '#6BAF8E' }} />
      </div>

      {/* メンバー4カード */}
      <div className="shrink-0 grid grid-cols-2 gap-[10px]" style={{ padding: '14px 14px 0' }}>
        {Array.from({ length: 4 }).map((_, i) => {
          const p = groupMembers[i];
          if (!p) {
            return <div key={`empty-${i}`} style={{ borderRadius: '14px', backgroundColor: '#141F1D', minHeight: '58px' }} />;
          }
          const memberScore = scores[scoreKey(p.player_id, currentHole)];
          const isSelected = selectedUserId === p.player_id;
          const strokeDisplay = memberScore && !memberScore.isDefault ? memberScore.strokes : null;
          return (
            <button
              key={p.player_id}
              onClick={() => handleMemberSwitch(p.player_id)}
              className="flex items-center justify-between active:opacity-80"
              style={{
                borderRadius: '14px',
                padding: '12px 14px',
                backgroundColor: isSelected ? '#1F4A3F' : '#182D28',
                border: isSelected ? '2px solid #6BAF8E' : '2px solid transparent',
              }}
            >
              <span className="truncate" style={{ fontSize: '23px', fontWeight: 700, color: isSelected ? '#ffffff' : '#C9D8D2' }}>
                {p.players.name}
              </span>
              <span className="font-num shrink-0" style={{ fontSize: '30px', fontWeight: 800, color: isSelected ? '#6BAF8E' : '#5C7A70' }}>
                {strokeDisplay !== null ? strokeDisplay : '–'}
              </span>
            </button>
          );
        })}
      </div>

      {/* 打数・パット入力エリア */}
      <div className="flex-1 flex flex-col gap-[10px] min-h-0" style={{ padding: '10px 14px' }}>
        {/* 打数ブロック */}
        <div className="flex gap-[10px]" style={{ flex: 1.45 }}>
          <button
            onClick={() => updateScore('strokes', -1)}
            disabled={isViewer}
            className="shrink-0 flex items-center justify-center active:opacity-70 disabled:opacity-30"
            style={{ width: '96px', borderRadius: '18px', backgroundColor: '#1B3A32' }}
          >
            <span className="font-num leading-none" style={{ fontSize: 'min(76px, 19vw)', fontWeight: 300, color: '#8FD9B4' }}>−</span>
          </button>

          <div className="flex-1 flex flex-col items-center justify-center relative" style={{ borderRadius: '18px', backgroundColor: '#1F4A3F' }}>
            <span
              className="absolute top-3 left-4"
              style={{ fontSize: '15px', fontWeight: 700, color: '#8FA69C', letterSpacing: '.14em' }}
            >
              打数
            </span>
            <span className="font-num font-extrabold text-white" style={{ fontSize: 'min(112px, 26vw)', lineHeight: 1 }}>
              {currentScore.strokes}
            </span>
            {currentScore.strokes > 0 && (
              <span
                className="font-bold mt-2"
                style={{ padding: '5px 14px', borderRadius: '999px', fontSize: '15px', backgroundColor: pill.bg, color: pill.color }}
              >
                {pill.label}
              </span>
            )}
          </div>

          <button
            onClick={() => updateScore('strokes', 1)}
            disabled={isViewer}
            className="shrink-0 flex items-center justify-center active:opacity-80 disabled:opacity-30"
            style={{ width: '96px', borderRadius: '18px', backgroundColor: '#2E6B52' }}
          >
            <span className="font-num font-semibold leading-none text-white" style={{ fontSize: 'min(72px, 18vw)' }}>+</span>
          </button>
        </div>

        {/* パットブロック */}
        <div className="flex gap-[10px] flex-1">
          <button
            onClick={() => updateScore('putts', -1)}
            disabled={isViewer}
            className="shrink-0 flex items-center justify-center active:opacity-70 disabled:opacity-30"
            style={{ width: '96px', borderRadius: '18px', backgroundColor: '#3A3427' }}
          >
            <span className="font-num leading-none" style={{ fontSize: 'min(76px, 19vw)', fontWeight: 300, color: '#D8C79A' }}>−</span>
          </button>

          <div className="flex-1 flex flex-col items-center justify-center relative" style={{ borderRadius: '18px', backgroundColor: '#2C2A20' }}>
            <span
              className="absolute top-3 left-4"
              style={{ fontSize: '15px', fontWeight: 700, color: '#9A8F72', letterSpacing: '.14em' }}
            >
              パット
            </span>
            <span className="font-num font-extrabold" style={{ fontSize: 'min(80px, 20vw)', lineHeight: 1, color: '#EDE3CB' }}>
              {currentScore.putts}
            </span>
          </div>

          <button
            onClick={() => updateScore('putts', 1)}
            disabled={isViewer}
            className="shrink-0 flex items-center justify-center active:opacity-80 disabled:opacity-30"
            style={{ width: '96px', borderRadius: '18px', backgroundColor: '#BE9B4B' }}
          >
            <span className="font-num font-semibold leading-none" style={{ fontSize: 'min(72px, 18vw)', color: '#1B1608' }}>+</span>
          </button>
        </div>
      </div>

      {/* ホール移動バー */}
      <div className="shrink-0 flex gap-[10px]" style={{ height: '100px', padding: '0 14px 16px' }}>
        <button
          onClick={() => currentHoleIdx > 0 && handleHoleChange(holeSequence[currentHoleIdx - 1])}
          disabled={currentHoleIdx <= 0}
          className="flex items-center justify-center disabled:opacity-25 active:opacity-60"
          style={{ width: '78px', borderRadius: '18px', backgroundColor: '#182D28' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[38px] h-[38px]" style={{ color: '#8FA69C' }}>
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex-1 flex items-center justify-center gap-3" style={{ borderRadius: '18px', backgroundColor: '#182D28' }}>
          <span className="font-num font-extrabold text-white" style={{ fontSize: 'min(44px, 11vw)' }}>{currentHole}</span>
          <div className="flex flex-col items-start">
            <span style={{ fontSize: '13px', color: '#8FA69C' }}>
              {(() => {
                const nineIdx = Math.floor((currentHole - 1) / 9);
                return event.courses?.nine_names?.[nineIdx] || (nineIdx === 0 ? 'OUT' : nineIdx === 1 ? 'IN' : `N${nineIdx + 1}`);
              })()}
            </span>
            <span className="font-num font-bold" style={{ fontSize: '19px', color: '#B9CFC5' }}>PAR {currentPar}</span>
          </div>
        </div>

        <button
          onClick={() => handleHoleChange(currentHoleIdx < 17 ? holeSequence[currentHoleIdx + 1] : -1)}
          className="flex items-center justify-center active:opacity-60"
          style={{ width: '78px', borderRadius: '18px', backgroundColor: '#6BAF8E', opacity: currentHoleIdx >= 17 ? 0.25 : 1 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[38px] h-[38px]" style={{ color: '#0E1A18' }}>
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
