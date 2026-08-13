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
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
            ホール {startH}–{startH + 8}
          </span>
          <span style={{ fontSize: '12px', color: '#8FA69C' }}>合計: {nineTotal(nineIdx)}</span>
        </div>
        <div className="grid grid-cols-9 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="text-center">
              <div style={{ fontSize: '11px', color: '#5C7A70', marginBottom: '4px' }}>{startH + i}H</div>
              <select
                value={formHoles[nineIdx * 9 + i] ?? 4}
                onChange={(e) => setHolePar(nineIdx * 9 + i, Number(e.target.value))}
                className="w-full text-center rounded py-1 text-sm"
                style={{ backgroundColor: '#12211F', border: '1px solid #2E4A43', color: '#E4EDE9' }}
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
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header className="flex items-center justify-between" style={{ backgroundColor: '#12211F', padding: '16px 20px' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} style={{ color: '#ffffff' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>コース管理</h1>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="font-bold"
          style={{ padding: '7px 16px', borderRadius: '999px', fontSize: '14px', backgroundColor: '#6BAF8E', color: '#0E1A18' }}
        >
          ＋ 追加
        </button>
      </header>

      <main className="p-5 space-y-3">
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4" style={{ backgroundColor: '#182D28', borderRadius: '16px', padding: '16px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 900, color: '#ffffff' }}>
              {editingId ? 'コース編集' : '新規コース登録'}
            </h2>

            {error && (
              <div className="px-3 py-2 rounded text-sm" style={{ backgroundColor: '#2A1E1A', border: '1px solid #7A3B26', color: '#D98E6E' }}>
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>コース名</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm"
                style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                placeholder="例: ○○カントリークラブ"
              />
            </div>

            {/* ナインタブ */}
            <div>
              <div className="flex rounded-lg overflow-hidden mb-3" style={{ border: '1px solid #2E4A43' }}>
                {([
                  ['out', 'OUT'],
                  ['in', 'IN'],
                  ['extra', `入力${extraNines.length > 0 ? ` (${extraNines.length})` : ''}`],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveNineTab(key)}
                    className="flex-1 py-2 text-sm font-bold transition-colors"
                    style={{
                      backgroundColor: activeNineTab === key ? '#6BAF8E' : 'transparent',
                      color: activeNineTab === key ? '#0E1A18' : '#8FA69C',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* OUT タブ */}
              {activeNineTab === 'out' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>ナイン名</label>
                    <input
                      type="text"
                      value={nineNames[0]}
                      onChange={(e) => updateNineName(0, e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm"
                      style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
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
                    <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>ナイン名</label>
                    <input
                      type="text"
                      value={nineNames[1]}
                      onChange={(e) => updateNineName(1, e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm"
                      style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
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
                    <p className="text-sm text-center py-2" style={{ color: '#8FA69C' }}>
                      第3ナイン以降を追加できます（27H、36H、45H…）
                    </p>
                  )}
                  {extraNines.map((nineName, extraIdx) => {
                    const nineIdx = extraIdx + 2;
                    return (
                      <div key={extraIdx} className="rounded-lg p-3 space-y-3" style={{ border: '1px solid #2E4A43' }}>
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                            第{nineIdx + 1}ナイン
                          </span>
                          <button
                            type="button"
                            onClick={() => removeExtraNine(extraIdx)}
                            className="text-sm"
                            style={{ color: '#D98E6E' }}
                          >
                            削除
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{ color: '#8FA69C' }}>ナイン名</label>
                          <input
                            type="text"
                            value={nineName}
                            onChange={(e) => updateNineName(nineIdx, e.target.value)}
                            className="w-full px-3 py-2 rounded-md text-sm"
                            style={{ backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
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
                    className="w-full py-3 text-sm font-bold rounded-md"
                    style={{ border: '1.5px dashed #2E4A43', color: '#6BAF8E' }}
                  >
                    ＋ ナインを追加
                  </button>
                </div>
              )}
            </div>

            <div className="text-right text-sm" style={{ color: '#8FA69C' }}>
              合計パー: {totalPar}（{nineNames.length}ナイン / {formHoles.length}H）
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 rounded-md text-sm font-bold"
                style={{ backgroundColor: '#6BAF8E', color: '#0E1A18' }}
              >
                {editingId ? '更新' : '登録'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2 rounded-md text-sm"
                style={{ backgroundColor: '#1B322C', color: '#8FA69C' }}
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        {/* コース一覧 */}
        {loading ? (
          <p style={{ color: '#8FA69C' }} className="text-sm">読み込み中...</p>
        ) : courses.length === 0 ? (
          <p style={{ color: '#8FA69C' }} className="text-sm">コースが登録されていません</p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const names = course.nine_names?.length >= 2 ? course.nine_names : ['OUT', 'IN'];
              return (
                <div key={course.id} style={{ backgroundColor: '#182D28', borderRadius: '16px', padding: '14px 16px' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>{course.name}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(course)}
                        className="font-bold"
                        style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '13px', backgroundColor: '#1F4A3F', color: '#B9CFC5' }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(course)}
                        className="font-bold"
                        style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '13px', backgroundColor: '#2A1E1A', color: '#D98E6E' }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  {course.course_holes.length > 0 && (
                    <div className="space-y-0.5" style={{ fontSize: '12px', color: '#8FA69C' }}>
                      {names.map((nineName, i) => (
                        <div key={i} className="font-num flex gap-1 flex-wrap">
                          <span className="font-bold" style={{ color: '#B9CFC5' }}>{nineName || `${i + 1}N`}:</span>
                          {course.course_holes.slice(i * 9, (i + 1) * 9).map((h) => (
                            <span key={h.hole_number}>{h.par}</span>
                          ))}
                          <span className="ml-1 font-bold" style={{ color: '#B9CFC5' }}>
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
