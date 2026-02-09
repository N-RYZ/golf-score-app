'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type Member = {
  id: string;
  name: string;
  role: 'admin' | 'player';
  created_at: string;
};

export default function MembersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'player'>('player');
  const [error, setError] = useState('');

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/admin/members');
    if (res.ok) {
      setMembers(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/home');
      return;
    }
    fetchMembers();
  }, [user, router, fetchMembers]);

  const resetForm = () => {
    setFormName('');
    setFormPassword('');
    setFormRole('player');
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editingId) {
      // 更新
      const body: Record<string, string> = { name: formName, role: formRole };
      if (formPassword) body.password = formPassword;

      const res = await fetch(`/api/admin/members/${editingId}`, {
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
      if (!formPassword) {
        setError('パスワードは必須です');
        return;
      }

      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, password: formPassword, role: formRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '登録に失敗しました');
        return;
      }
    }

    resetForm();
    fetchMembers();
  };

  const handleEdit = (member: Member) => {
    setFormName(member.name);
    setFormPassword('');
    setFormRole(member.role);
    setEditingId(member.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (member: Member) => {
    if (!confirm(`「${member.name}」を削除しますか？`)) return;

    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchMembers();
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#166534] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/home')} className="text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">メンバー管理</h1>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-white text-[#166534] px-3 py-1 rounded-md text-sm font-bold"
        >
          + 追加
        </button>
      </header>

      <main className="p-4">
        {/* 登録フォーム */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
            <h2 className="font-bold text-gray-800">
              {editingId ? 'メンバー編集' : '新規メンバー登録'}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード{editingId && '（変更する場合のみ）'}
              </label>
              <input
                type="password"
                required={!editingId}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">権限</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as 'admin' | 'player')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="player">一般プレイヤー</option>
                <option value="admin">幹事</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-[#166534] text-white py-2 rounded-md text-sm font-bold"
              >
                {editingId ? '更新' : '登録'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md text-sm"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        {/* メンバー一覧 */}
        {loading ? (
          <p className="text-gray-500 text-sm">読み込み中...</p>
        ) : members.length === 0 ? (
          <p className="text-gray-500 text-sm">メンバーが登録されていません</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-gray-800">{member.name}</p>
                  <p className="text-xs text-gray-500">
                    {member.role === 'admin' ? '幹事' : 'プレイヤー'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(member)}
                    className="text-blue-600 text-sm px-2 py-1"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
                    className="text-red-600 text-sm px-2 py-1"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
