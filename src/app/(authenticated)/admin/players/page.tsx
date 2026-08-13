'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type Player = {
  id: string;
  name: string;
  gender?: string;
  birth_year?: number;
  initial_handicap?: number;
  current_handicap?: number;
  total_points: number;
  participation_count: number;
  is_active: boolean;
};

export default function PlayersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [year, setYear] = useState(2026);

  // フォームの状態
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'male' | 'female'>('male');
  const [formBirthYear, setFormBirthYear] = useState('');
  const [formInitialHandicap, setFormInitialHandicap] = useState('');
  const [formCurrentHandicap, setFormCurrentHandicap] = useState('');
  const [formTotalPoints, setFormTotalPoints] = useState('');
  const [error, setError] = useState('');

  const fetchPlayers = useCallback(async () => {
    const res = await fetch(`/api/admin/players?year=${year}`);
    if (res.ok) {
      setPlayers(await res.json());
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/admin');
      return;
    }
    fetchPlayers();
  }, [user, router, fetchPlayers]);

  const resetForm = () => {
    setFormName('');
    setFormGender('male');
    setFormBirthYear('');
    setFormInitialHandicap('');
    setFormCurrentHandicap('');
    setFormTotalPoints('');
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editingId) {
      // 更新
      const body = {
        name: formName,
        gender: formGender,
        birth_year: formBirthYear ? parseInt(formBirthYear) : null,
        initial_handicap: formInitialHandicap ? parseFloat(formInitialHandicap) : null,
        current_handicap: formCurrentHandicap ? parseFloat(formCurrentHandicap) : null,
        total_points: formTotalPoints ? parseInt(formTotalPoints) : 0,
        year
      };

      const res = await fetch(`/api/admin/players/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '更新に失敗しました');
        return;
      }
    } else {
      // 新規登録
      if (!formInitialHandicap) {
        setError('初期ハンデは必須です');
        return;
      }

      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          gender: formGender,
          birth_year: formBirthYear ? parseInt(formBirthYear) : null,
          initial_handicap: parseFloat(formInitialHandicap),
          year
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '登録に失敗しました');
        return;
      }
    }

    resetForm();
    fetchPlayers();
  };

  const handleEdit = (player: Player) => {
    setFormName(player.name);
    setFormGender((player.gender || 'male') as 'male' | 'female');
    setFormBirthYear(player.birth_year?.toString() || '');
    setFormInitialHandicap(player.initial_handicap?.toString() || '');
    setFormCurrentHandicap(player.current_handicap?.toString() || '');
    setFormTotalPoints(player.total_points?.toString() || '0');
    setEditingId(player.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name}を削除しますか？この操作は取り消せません。`)) return;

    const res = await fetch(`/api/admin/players/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchPlayers();
    } else {
      alert('削除に失敗しました');
    }
  };

  if (loading) {
    return <div className="p-6" style={{ color: '#8FA69C', backgroundColor: '#0E1A18' }}>読み込み中...</div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header className="flex items-center justify-between" style={{ backgroundColor: '#12211F', padding: '16px 20px' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} style={{ color: '#ffffff' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>プレイヤー管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="text-sm"
            style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: '#1B322C', color: '#E4EDE9', border: '1px solid #2E4A43' }}
          >
            {[2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}年度</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="font-bold"
            style={{ padding: '7px 16px', borderRadius: '999px', fontSize: '14px', backgroundColor: '#6BAF8E', color: '#0E1A18' }}
          >
            ＋ 登録
          </button>
        </div>
      </header>
      <main className="p-5 space-y-3">

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(14,26,24,.7)' }}>
          <div className="p-6 rounded-2xl max-w-md w-full mx-4" style={{ backgroundColor: '#182D28' }}>
            <h2 className="mb-4" style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>
              {editingId ? 'プレイヤー編集' : '新規プレイヤー登録'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>名前*</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>性別</label>
                <select
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as 'male' | 'female')}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                >
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>生年（西暦）</label>
                <input
                  type="number"
                  value={formBirthYear}
                  onChange={(e) => setFormBirthYear(e.target.value)}
                  placeholder="1980"
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>{year}年度 初期HC{!editingId && '*'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formInitialHandicap}
                    onChange={(e) => setFormInitialHandicap(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                    required={!editingId}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>{year}年度 現在HC</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formCurrentHandicap}
                    onChange={(e) => setFormCurrentHandicap(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                  />
                </div>
              </div>

              {editingId && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>{year}年度 ポイント</label>
                  <input
                    type="number"
                    min="0"
                    value={formTotalPoints}
                    onChange={(e) => setFormTotalPoints(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                  />
                </div>
              )}

              {error && <p className="text-sm" style={{ color: '#D98E6E' }}>{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg font-bold"
                  style={{ backgroundColor: '#6BAF8E', color: '#0E1A18' }}
                >
                  {editingId ? '更新' : '登録'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2 rounded-lg font-bold"
                  style={{ backgroundColor: '#1B322C', color: '#8FA69C' }}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* プレイヤー一覧（カード） */}
      {players.map((player) => (
        <div key={player.id} style={{ backgroundColor: '#182D28', borderRadius: '16px', padding: '14px 16px' }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>{player.name}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(player)}
                className="font-bold"
                style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '14px', backgroundColor: '#1F4A3F', color: '#B9CFC5' }}
              >
                編集
              </button>
              <button
                onClick={() => handleDelete(player.id, player.name)}
                className="font-bold"
                style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '14px', backgroundColor: '#2A1E1A', color: '#D98E6E' }}
              >
                削除
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <p style={{ fontSize: '12px', color: '#5C7A70' }}>初期HC</p>
              <p className="font-num" style={{ fontSize: '19px', color: '#C9D8D2' }}>{player.initial_handicap?.toFixed(1) || '-'}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#5C7A70' }}>現在HC</p>
              <p className="font-num" style={{ fontSize: '19px', color: '#ffffff' }}>{player.current_handicap?.toFixed(1) || '-'}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#5C7A70' }}>ポイント</p>
              <p className="font-num" style={{ fontSize: '19px', color: '#6BAF8E' }}>{player.total_points}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#5C7A70' }}>参加</p>
              <p className="font-num" style={{ fontSize: '19px', color: '#C9D8D2' }}>{player.participation_count}</p>
            </div>
          </div>
        </div>
      ))}

      {players.length === 0 && (
        <p className="text-center py-8" style={{ color: '#8FA69C' }}>プレイヤーが登録されていません</p>
      )}
      </main>
    </div>
  );
}
