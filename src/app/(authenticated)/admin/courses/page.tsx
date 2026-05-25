'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type CourseHole = {
  id: string;
  hole_number: number;
  par: number;
};

type Course = {
  id: string;
  name: string;
  created_at: string;
  nine_names: string[];
  course_holes: CourseHole[];
};

const DEFAULT_PARS_9 = [4, 4, 4, 4, 3, 4, 4, 3, 5];

export default function CoursesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  // nineNames[0]=OUT nine, nineNames[1]=IN nine, nineNames[2+]=extra nines
  const [nineNames, setNineNames] = useState<string[]>(['OUT', 'IN']);
  // formHoles: flat par array, length = nineNames.length * 9
  const [formHoles, setFormHoles] = useState<number[]>([...DEFAULT_PARS_9, ...DEFAULT_PARS_9]);
  const [activeNineTab, setActiveNineTab] = useState<'out' | 'in' | 'extra'>('out');
  const [error, setError] = useState('');

  const fetchCourses = useCallback(async () => {
    const res = await fetch('/api/admin/courses');
    if (res.ok) {
      setCourses(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/admin');
      return;
    }
    fetchCourses();
  }, [user, router, fetchCourses]);

  const resetForm = () => {
    setFormName('');
    setNineNames(['OUT', 'IN']);
    setFormHoles([...DEFAULT_PARS_9, ...DEFAULT_PARS_9]);
    setActiveNineTab('out');
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const setHolePar = (index: number, par: number) => {
    if (par < 3) par = 3;
    if (par > 5) par = 5;
    const newHoles = [...formHoles];
    newHoles[index] = par;
    setFormHoles(newHoles);
  };

  const updateNineName = (nineIdx: number, name: string) => {
    setNineNames((prev) => prev.map((n, i) => (i === nineIdx ? name : n)));
  };

  const addExtraNine = () => {
    setNineNames((prev) => [...prev, '']);
    setFormHoles((prev) => [...prev, ...DEFAULT_PARS_9]);
  };

  const removeExtraNine = (extraIdx: number) => {
    const nineIdx = extraIdx + 2;
    setNineNames((prev) => prev.filter((_, i) => i !== nineIdx));
    setFormHoles((prev) => prev.filter((_, i) => i < nineIdx * 9 || i >= (nineIdx + 1) * 9));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const url = editingId ? `/api/admin/courses/${editingId}` : '/api/admin/courses';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formName,
        holes: formHoles,
        nine_names: nineNames,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || '保存に失敗しました');
      return;
    }

    resetForm();
    fetchCourses();
  };

  const handleEdit = (course: Course) => {
    const pars = course.course_holes.map((h) => h.par);
    const names = course.nine_names?.length >= 2
      ? course.nine_names
      : ['OUT', 'IN'];
    setFormName(course.name);
    setNineNames(names);
    setFormHoles(pars);
    setActiveNineTab('out');
    setEditingId(course.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (course: Course) => {
    if (!confirm(`「${course.name}」を削除しますか？`)) return;
    const res = await fetch(`/api/admin/courses/${course.id}`, { method: 'DELETE' });
    if (res.ok) fetchCourses();
  };

  const nineTotal = (nineIdx: number) =>
    formHoles.slice(nineIdx * 9, nineIdx * 9 + 9).reduce((a, b) => a + b, 0);

  const renderNineHoles = (nineIdx: number) => {
    const startH = nineIdx * 9 + 1;
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-[#1d3937]">
            ホール {startH}–{startH + 8}
          </span>
          <span className="text-xs text-[#91855a]">合計: {nineTotal(nineIdx)}</span>
        </div>
        <div className="grid grid-cols-9 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="text-center">
              <div className="text-xs text-[#91855a] mb-1">{startH + i}H</div>
              <select
                value={formHoles[nineIdx * 9 + i] ?? 4}
                onChange={(e) => setHolePar(nineIdx * 9 + i, Number(e.target.value))}
                className="w-full text-center border border-[#d6cabc] rounded py-1 text-sm text-[#1d3937]"
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (user?.role !== 'admin') return null;

  const totalPar = formHoles.reduce((a, b) => a + b, 0);
  const extraNines = nineNames.slice(2);

  return (
    <div className="min-h-screen bg-[#d6cabc]/30">
      <header className="bg-gradient-to-r from-[#1d3937] to-[#195042] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">コース管理</h1>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-white text-[#1d3937] px-3 py-1 rounded-md text-sm font-bold"
        >
          + 追加
        </button>
      </header>

      <main className="p-4">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 mb-4 space-y-4">
            <h2 className="font-bold text-[#1d3937]">
              {editingId ? 'コース編集' : '新規コース登録'}
            </h2>

            {error && (
              <div className="bg-[#91855a]/20 border border-[#91855a] text-[#1d3937] px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#91855a] mb-1">コース名</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
                placeholder="例: ○○カントリークラブ"
              />
            </div>

            {/* ナインタブ */}
            <div>
              <div className="flex rounded overflow-hidden border border-[#d6cabc] mb-3">
                <button
                  type="button"
                  onClick={() => setActiveNineTab('out')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    activeNineTab === 'out'
                      ? 'bg-gradient-to-r from-[#1d3937] to-[#195042] text-white'
                      : 'bg-white text-[#91855a]'
                  }`}
                >
                  OUT
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNineTab('in')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors border-x border-[#d6cabc] ${
                    activeNineTab === 'in'
                      ? 'bg-gradient-to-r from-[#1d3937] to-[#195042] text-white'
                      : 'bg-white text-[#91855a]'
                  }`}
                >
                  IN
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNineTab('extra')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    activeNineTab === 'extra'
                      ? 'bg-gradient-to-r from-[#1d3937] to-[#195042] text-white'
                      : 'bg-white text-[#91855a]'
                  }`}
                >
                  入力{extraNines.length > 0 && ` (${extraNines.length})`}
                </button>
              </div>

              {/* OUT タブ */}
              {activeNineTab === 'out' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[#91855a] mb-1">ナイン名</label>
                    <input
                      type="text"
                      value={nineNames[0]}
                      onChange={(e) => updateNineName(0, e.target.value)}
                      className="w-full px-3 py-2 border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
                      placeholder="OUT"
                    />
                  </div>
                  {renderNineHoles(0)}
                </div>
              )}

              {/* IN タブ */}
              {activeNineTab === 'in' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[#91855a] mb-1">ナイン名</label>
                    <input
                      type="text"
                      value={nineNames[1]}
                      onChange={(e) => updateNineName(1, e.target.value)}
                      className="w-full px-3 py-2 border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
                      placeholder="IN"
                    />
                  </div>
                  {renderNineHoles(1)}
                </div>
              )}

              {/* 入力タブ（第3ナイン以降） */}
              {activeNineTab === 'extra' && (
                <div className="space-y-4">
                  {extraNines.length === 0 && (
                    <p className="text-sm text-[#91855a] text-center py-2">
                      第3ナイン以降を追加できます（27H、36H、45H…）
                    </p>
                  )}
                  {extraNines.map((nineName, extraIdx) => {
                    const nineIdx = extraIdx + 2;
                    return (
                      <div key={extraIdx} className="border border-[#d6cabc] rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#1d3937]">
                            第{nineIdx + 1}ナイン
                          </span>
                          <button
                            type="button"
                            onClick={() => removeExtraNine(extraIdx)}
                            className="text-[#91855a] text-sm"
                          >
                            削除
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#91855a] mb-1">ナイン名</label>
                          <input
                            type="text"
                            value={nineName}
                            onChange={(e) => updateNineName(nineIdx, e.target.value)}
                            className="w-full px-3 py-2 border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
                            placeholder={`EXT${extraIdx > 0 ? extraIdx + 1 : ''}`}
                          />
                        </div>
                        {renderNineHoles(nineIdx)}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addExtraNine}
                    className="w-full py-2 bg-gradient-to-r from-[#1d3937] to-[#195042] text-white text-sm font-bold rounded-md"
                  >
                    + ナインを追加
                  </button>
                </div>
              )}
            </div>

            <div className="text-right text-sm text-[#91855a]">
              合計パー: {totalPar}（{nineNames.length}ナイン / {formHoles.length}H）
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-[#1d3937] to-[#195042] text-white py-2 rounded-md text-sm font-bold"
              >
                {editingId ? '更新' : '登録'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-[#d6cabc] text-[#1d3937] py-2 rounded-md text-sm"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        {/* コース一覧 */}
        {loading ? (
          <p className="text-[#91855a] text-sm">読み込み中...</p>
        ) : courses.length === 0 ? (
          <p className="text-[#91855a] text-sm">コースが登録されていません</p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const names = course.nine_names?.length >= 2 ? course.nine_names : ['OUT', 'IN'];
              return (
                <div key={course.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-[#1d3937]">{course.name}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(course)}
                        className="text-[#195042] text-sm px-2 py-1"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(course)}
                        className="text-[#91855a] text-sm px-2 py-1"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  {course.course_holes.length > 0 && (
                    <div className="text-xs text-[#91855a] space-y-0.5">
                      {names.map((nineName, i) => (
                        <div key={i} className="flex gap-1 flex-wrap">
                          <span className="font-bold">{nineName || `${i + 1}N`}:</span>
                          {course.course_holes.slice(i * 9, (i + 1) * 9).map((h) => (
                            <span key={h.hole_number}>{h.par}</span>
                          ))}
                          <span className="ml-1 font-bold">
                            = {course.course_holes.slice(i * 9, (i + 1) * 9).reduce((a, h) => a + h.par, 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
