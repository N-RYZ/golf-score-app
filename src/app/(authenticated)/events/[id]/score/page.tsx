'use client';

import { useAuth } from '@/lib/auth-context';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';

type CourseHole = { hole_number: number; par: number };
type GroupMember = { user_id: string; users: { id: string; name: string } };
type EventGroup = { id: string; group_number: number; group_members: GroupMember[] };
type Participant = { user_id: string; users: { id: string; name: string } };
type ScoreData = {
  event_id: string;
  user_id: string;
  hole_number: number;
  strokes: number;
  putts: number;
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
const LAST_POS_KEY = (eventId: string) => `golf-lastpos-${eventId}`;
const PENDING_KEY = (eventId: string) => `golf-pending-${eventId}`;

export default function ScoreInputPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, ScoreData>>({});
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const prevUserRef = useRef<string>('');
  const prevHoleRef = useRef<number>(1);

  // スコアのキー
  const scoreKey = (userId: string, holeNumber: number) => `${userId}-${holeNumber}`;

  // 同組メンバーの取得
  const getGroupMembers = useCallback((): Participant[] => {
    if (!event || !user) return [];

    // 自分が所属する組を探す
    const myGroup = event.event_groups.find((g) =>
      g.group_members.some((m) => m.user_id === user.id)
    );

    if (myGroup) {
      // 同組のメンバーのみ
      return myGroup.group_members.map((m) => ({
        user_id: m.user_id,
        users: m.users,
      }));
    }

    // 組が未設定の場合は全参加者を表示
    return event.event_participants;
  }, [event, user]);

  // イベントデータ取得
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) return;
      const data: EventInfo = await res.json();
      setEvent(data);

      // サーバーのスコアをローカルに反映
      const scoreMap: Record<string, ScoreData> = {};
      data.scores.forEach((s) => {
        scoreMap[scoreKey(s.user_id, s.hole_number)] = s;
      });

      // ローカルの未送信スコアがあればマージ
      const pendingRaw = localStorage.getItem(PENDING_KEY(eventId));
      if (pendingRaw) {
        const pending: ScoreData[] = JSON.parse(pendingRaw);
        pending.forEach((s) => {
          scoreMap[scoreKey(s.user_id, s.hole_number)] = s;
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
    if (!event || !user) return;

    const lastPos = localStorage.getItem(LAST_POS_KEY(eventId));
    if (lastPos) {
      const { hole, userId } = JSON.parse(lastPos);
      setCurrentHole(hole);
      setSelectedUserId(userId);
    } else {
      setSelectedUserId(user.id);
    }
  }, [event, user, eventId]);

  // 位置を記録
  useEffect(() => {
    if (selectedUserId && currentHole) {
      localStorage.setItem(
        LAST_POS_KEY(eventId),
        JSON.stringify({ hole: currentHole, userId: selectedUserId })
      );
    }
  }, [selectedUserId, currentHole, eventId]);

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
    async (userId: string, holeNumber: number) => {
      const key = scoreKey(userId, holeNumber);
      const score = scores[key];
      if (!score || (score.strokes === 0 && score.putts === 0)) return;

      const payload = {
        event_id: eventId,
        user_id: userId,
        hole_number: holeNumber,
        strokes: score.strokes,
        putts: score.putts,
        updated_by: user?.id,
      };

      if (!navigator.onLine) {
        // オフライン: ペンディングに追加
        const pendingRaw = localStorage.getItem(PENDING_KEY(eventId));
        const pending: ScoreData[] = pendingRaw ? JSON.parse(pendingRaw) : [];
        const idx = pending.findIndex(
          (p) => p.user_id === userId && p.hole_number === holeNumber
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
        await fetch('/api/scores', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // 失敗時はペンディングに追加
        const pendingRaw = localStorage.getItem(PENDING_KEY(eventId));
        const pending: ScoreData[] = pendingRaw ? JSON.parse(pendingRaw) : [];
        pending.push(payload);
        localStorage.setItem(PENDING_KEY(eventId), JSON.stringify(pending));
      }
      setSaving(false);
    },
    [scores, eventId, user?.id]
  );

  // メンバー切替時・ホール移動時に自動保存
  const handleMemberSwitch = useCallback(
    (newUserId: string) => {
      // 前のユーザーのスコアを保存
      if (prevUserRef.current) {
        saveScore(prevUserRef.current, currentHole);
      }
      prevUserRef.current = newUserId;
      setSelectedUserId(newUserId);
    },
    [saveScore, currentHole]
  );

  const handleHoleChange = useCallback(
    (newHole: number) => {
      if (newHole < 1 || newHole > 18) return;
      // 現在のユーザーのスコアを保存
      if (selectedUserId) {
        saveScore(selectedUserId, currentHole);
      }
      prevHoleRef.current = newHole;
      setCurrentHole(newHole);
    },
    [saveScore, selectedUserId, currentHole]
  );

  // スコア値の更新
  const updateScore = (field: 'strokes' | 'putts', delta: number) => {
    if (!selectedUserId) return;
    const key = scoreKey(selectedUserId, currentHole);
    const current = scores[key] || {
      event_id: eventId,
      user_id: selectedUserId,
      hole_number: currentHole,
      strokes: 0,
      putts: 0,
    };

    let newVal = (current[field] || 0) + delta;
    if (field === 'strokes' && newVal < 1) newVal = 1;
    if (field === 'putts' && newVal < 0) newVal = 0;

    const updated = { ...current, [field]: newVal };
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
    strokes: 0,
    putts: 0,
  };

  // パーとの差分表示
  const getDiffLabel = (strokes: number, par: number): string => {
    if (strokes === 0) return '';
    const diff = strokes - par;
    if (diff <= -2) return 'イーグル';
    if (diff === -1) return 'バーディ';
    if (diff === 0) return 'パー';
    if (diff === 1) return 'ボギー';
    if (diff === 2) return 'Wボギー';
    return `+${diff}`;
  };

  const diffLabel = getDiffLabel(currentScore.strokes, currentPar);
  const diff = currentScore.strokes > 0 ? currentScore.strokes - currentPar : 0;

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50 overflow-hidden select-none">
      {/* ステータスバー */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#166534] text-white text-xs">
        <button onClick={() => router.push(`/events/${eventId}`)} className="text-white py-1">
          ← 戻る
        </button>
        <span>{event.name}</span>
        <div className="flex items-center gap-1">
          {saving && <span className="text-yellow-300">保存中</span>}
          {!isOnline && <span className="text-red-300">オフライン</span>}
        </div>
      </div>

      {/* 1. メンバー選択（2行×2列） */}
      <div className="grid grid-cols-2 gap-[2px] p-1 bg-white">
        {groupMembers.slice(0, 4).map((p) => (
          <button
            key={p.user_id}
            onClick={() => handleMemberSwitch(p.user_id)}
            className={`py-3 rounded-md font-bold transition-colors ${
              selectedUserId === p.user_id
                ? 'bg-[#166534] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={{ fontSize: 'min(22px, 5vw)' }}
          >
            {p.users.name}
          </button>
        ))}
      </div>

      {/* 2. 打数エリア */}
      <div className="flex-1 flex flex-col justify-center items-center bg-green-50 px-4">
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-sm font-bold text-gray-600">打数</span>
          {diffLabel && (
            <span
              className={`text-sm font-bold ${
                diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              {diffLabel}
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-6 w-full">
          <button
            onClick={() => updateScore('strokes', -1)}
            className="w-[min(64px,16vw)] h-[min(64px,16vw)] rounded-full bg-white border-2 border-gray-300 flex items-center justify-center active:bg-gray-100"
          >
            <span className="text-[min(62px,15vw)] leading-none text-gray-600 font-light" style={{ marginTop: '-4px' }}>
              −
            </span>
          </button>
          <span
            className="font-bold text-gray-900 min-w-[80px] text-center"
            style={{ fontSize: 'min(64px, 16vw)' }}
          >
            {currentScore.strokes || '-'}
          </span>
          <button
            onClick={() => updateScore('strokes', 1)}
            className="w-[min(64px,16vw)] h-[min(64px,16vw)] rounded-full bg-white border-2 border-gray-300 flex items-center justify-center active:bg-gray-100"
          >
            <span className="text-[min(62px,15vw)] leading-none text-gray-600 font-light" style={{ marginTop: '-4px' }}>
              +
            </span>
          </button>
        </div>
      </div>

      {/* 3. パットエリア */}
      <div className="flex-1 flex flex-col justify-center items-center bg-gray-100 px-4">
        <div className="w-full mb-1">
          <span className="text-sm font-bold text-gray-600">パット</span>
        </div>
        <div className="flex items-center justify-center gap-6 w-full">
          <button
            onClick={() => updateScore('putts', -1)}
            className="w-[min(64px,16vw)] h-[min(64px,16vw)] rounded-full bg-white border-2 border-gray-300 flex items-center justify-center active:bg-gray-100"
          >
            <span className="text-[min(62px,15vw)] leading-none text-gray-600 font-light" style={{ marginTop: '-4px' }}>
              −
            </span>
          </button>
          <span
            className="font-bold text-gray-900 min-w-[80px] text-center"
            style={{ fontSize: 'min(64px, 16vw)' }}
          >
            {currentScore.putts || '-'}
          </span>
          <button
            onClick={() => updateScore('putts', 1)}
            className="w-[min(64px,16vw)] h-[min(64px,16vw)] rounded-full bg-white border-2 border-gray-300 flex items-center justify-center active:bg-gray-100"
          >
            <span className="text-[min(62px,15vw)] leading-none text-gray-600 font-light" style={{ marginTop: '-4px' }}>
              +
            </span>
          </button>
        </div>
      </div>

      {/* 4. ホール番号ナビ */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <button
          onClick={() => handleHoleChange(currentHole - 1)}
          disabled={currentHole <= 1}
          className="w-[56px] h-[56px] rounded-xl bg-gray-100 flex items-center justify-center disabled:opacity-30 active:bg-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-700">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="text-center">
          <span className="font-bold text-gray-900" style={{ fontSize: 'min(56px, 14vw)' }}>
            {currentHole}
          </span>
          <span className="text-sm text-gray-500 block -mt-1">
            PAR {currentPar}
          </span>
        </div>

        <button
          onClick={() => handleHoleChange(currentHole + 1)}
          disabled={currentHole >= 18}
          className="w-[56px] h-[56px] rounded-xl bg-gray-100 flex items-center justify-center disabled:opacity-30 active:bg-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-700">
            <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
