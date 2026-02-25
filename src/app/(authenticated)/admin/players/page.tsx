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
    return <div className="p-6 text-[#91855a]">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#d6cabc]/30">
      <header className="bg-gradient-to-r from-[#1d3937] to-[#195042] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">プレイヤー管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-2 py-1 rounded text-[#1d3937] text-sm bg-white border border-white/30"
          >
            {[2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}年度</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1 bg-white text-[#1d3937] rounded text-sm font-bold"
          >
            + 登録
          </button>
        </div>
      </header>
      <main className="p-4">

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-[#1d3937]/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-[#1d3937]">
              {editingId ? 'プレイヤー編集' : '新規プレイヤー登録'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[#91855a]">名前*</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#d6cabc] rounded-lg text-[#1d3937]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#91855a]">性別</label>
                <select
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as 'male' | 'female')}
                  className="w-full px-3 py-2 border border-[#d6cabc] rounded-lg text-[#1d3937]"
                >
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#91855a]">生年（西暦）</label>
                <input
                  type="number"
                  value={formBirthYear}
                  onChange={(e) => setFormBirthYear(e.target.value)}
                  placeholder="1980"
                  className="w-full px-3 py-2 border border-[#d6cabc] rounded-lg text-[#1d3937]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#91855a]">{year}年度 初期HC{!editingId && '*'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formInitialHandicap}
                    onChange={(e) => setFormInitialHandicap(e.target.value)}
                    className="w-full px-3 py-2 border border-[#d6cabc] rounded-lg text-[#1d3937]"
                    required={!editingId}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#91855a]">{year}年度 現在HC</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formCurrentHandicap}
                    onChange={(e) => setFormCurrentHandicap(e.target.value)}
                    className="w-full px-3 py-2 border border-[#d6cabc] rounded-lg text-[#1d3937]"
                  />
                </div>
              </div>

              {editingId && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#91855a]">{year}年度 ポイント</label>
                  <input
                    type="number"
                    min="0"
                    value={formTotalPoints}
                    onChange={(e) => setFormTotalPoints(e.target.value)}
                    className="w-full px-3 py-2 border border-[#d6cabc] rounded-lg text-[#1d3937]"
                  />
                </div>
              )}

              {error && <p className="text-[#91855a] text-sm">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#1d3937] to-[#195042] text-white rounded-lg hover:opacity-90"
                >
                  {editingId ? '更新' : '登録'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-[#d6cabc] text-[#1d3937] rounded-lg hover:bg-[#d6cabc]/70"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* プレイヤー一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#d6cabc]">
          <thead className="bg-[#d6cabc]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#1d3937] uppercase">名前</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#1d3937] uppercase">性別</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#1d3937] uppercase">生年</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#1d3937] uppercase">初期HC</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#1d3937] uppercase">現在HC</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#1d3937] uppercase">ポイント</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#1d3937] uppercase">参加数</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[#1d3937] uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#d6cabc]">
            {players.map((player) => (
              <tr key={player.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-[#1d3937]">{player.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#91855a]">
                  {player.gender === 'female' ? '女性' : '男性'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#91855a]">
                  {player.birth_year || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-[#91855a]">
                  {player.initial_handicap?.toFixed(1) || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-[#1d3937]">
                  {player.current_handicap?.toFixed(1) || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-[#195042]">
                  {player.total_points}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-[#91855a]">
                  {player.participation_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => handleEdit(player)}
                    className="text-[#195042] hover:text-[#1d3937] mr-3"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(player.id, player.name)}
                    className="text-[#91855a] hover:text-[#1d3937]"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {players.length === 0 && (
        <p className="text-center text-[#91855a] py-8">プレイヤーが登録されていません</p>
      )}
      </main>
    </div>
  );
}
