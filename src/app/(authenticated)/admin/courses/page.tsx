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
  nine1_name: string;
  nine2_name: string;
  nine3_name: string | null;
  course_holes: CourseHole[];
};

const DEFAULT_PARS_18 = [4, 4, 4, 4, 3, 4, 4, 3, 5, 4, 4, 4, 4, 3, 4, 4, 3, 5];
const DEFAULT_PARS_EXT = [4, 4, 3, 4, 4, 3, 4, 4, 5];

export default function CoursesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formNine1Name, setFormNine1Name] = useState('OUT');
  const [formNine2Name, setFormNine2Name] = useState('IN');
  const [formNine3Name, setFormNine3Name] = useState('');
  const [formHoles, setFormHoles] = useState<number[]>([...DEFAULT_PARS_18]);
  const [is27hole, setIs27hole] = useState(false);
  const [activeNineTab, setActiveNineTab] = useState<'out' | 'in' | 'ext'>('out');
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
    setFormNine1Name('OUT');
    setFormNine2Name('IN');
    setFormNine3Name('');
    setFormHoles([...DEFAULT_PARS_18]);
    setIs27hole(false);
    setActiveNineTab('out');
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const toggleIs27hole = (enable: boolean) => {
    setIs27hole(enable);
    if (enable) {
      setFormHoles((prev) => prev.length === 18 ? [...prev, ...DEFAULT_PARS_EXT] : prev);
    } else {
      setFormHoles((prev) => prev.slice(0, 18));
      setFormNine3Name('');
    }
  };

  const setHolePar = (index: number, par: number) => {
    if (par < 3) par = 3;
    if (par > 5) par = 5;
    const newHoles = [...formHoles];
    newHoles[index] = par;
    setFormHoles(newHoles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const url = editingId
      ? `/api/admin/courses/${editingId}`
      : '/api/admin/courses';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formName,
        holes: formHoles,
        nine1_name: formNine1Name || 'OUT',
        nine2_name: formNine2Name || 'IN',
        nine3_name: is27hole ? (formNine3Name || 'EXT') : null,
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
    setFormName(course.name);
    setFormNine1Name(course.nine1_name || 'OUT');
    setFormNine2Name(course.nine2_name || 'IN');
    setFormNine3Name(course.nine3_name || '');
    setFormHoles(pars);
    setIs27hole(pars.length >= 27);
    setActiveNineTab('out');
    setEditingId(course.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (course: Course) => {
    if (!confirm(`「${course.name}」を削除しますか？`)) return;

    const res = await fetch(`/api/admin/courses/${course.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchCourses();
    }
  };

  const outTotal = (holes: number[]) => holes.slice(0, 9).reduce((a, b) => a + b, 0);
  const inTotal = (holes: number[]) => holes.slice(9, 18).reduce((a, b) => a + b, 0);
  const extTotal = (holes: number[]) => holes.slice(18, 27).reduce((a, b) => a + b, 0);

  if (user?.role !== 'admin') return null;

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
        {/* 登録フォーム */}
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
                  onClick={() => setActiveNineTab('ext')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    activeNineTab === 'ext'
                      ? 'bg-gradient-to-r from-[#1d3937] to-[#195042] text-white'
                      : 'bg-white text-[#91855a]'
                  }`}
                >
                  入力
                </button>
              </div>

              {/* OUT タブ */}
              {activeNineTab === 'out' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[#91855a] mb-1">ナイン名</label>
                    <input
                      type="text"
                      value={formNine1Name}
                      onChange={(e) => setFormNine1Name(e.target.value)}
                      className="w-full px-3 py-2 border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
                      placeholder="OUT"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#1d3937]">ホール 1-9</span>
                      <span className="text-xs text-[#91855a]">合計: {outTotal(formHoles)}</span>
                    </div>
                    <div className="grid grid-cols-9 gap-1">
                      {formHoles.slice(0, 9).map((par, i) => (
                        <div key={i} className="text-center">
                          <div className="text-xs text-[#91855a] mb-1">{i + 1}H</div>
                          <select
                            value={par}
                            onChange={(e) => setHolePar(i, Number(e.target.value))}
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
                </div>
              )}

              {/* IN タブ */}
              {activeNineTab === 'in' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[#91855a] mb-1">ナイン名</label>
                    <input
                      type="text"
                      value={formNine2Name}
                      onChange={(e) => setFormNine2Name(e.target.value)}
                      className="w-full px-3 py-2 border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
                      placeholder="IN"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#1d3937]">ホール 10-18</span>
                      <span className="text-xs text-[#91855a]">合計: {inTotal(formHoles)}</span>
                    </div>
                    <div className="grid grid-cols-9 gap-1">
                      {formHoles.slice(9, 18).map((par, i) => (
                        <div key={i + 9} className="text-center">
                          <div className="text-xs text-[#91855a] mb-1">{i + 10}H</div>
                          <select
                            value={par}
                            onChange={(e) => setHolePar(i + 9, Number(e.target.value))}
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
                </div>
              )}

              {/* 入力タブ（第3ナイン） */}
              {activeNineTab === 'ext' && (
                <div className="space-y-3">
                  {!is27hole ? (
                    <div className="flex flex-col items-center py-6 gap-3">
                      <p className="text-sm text-[#91855a]">第3ナインを追加する場合はボタンを押してください</p>
                      <button
                        type="button"
                        onClick={() => toggleIs27hole(true)}
                        className="px-4 py-2 bg-gradient-to-r from-[#1d3937] to-[#195042] text-white text-sm font-bold rounded-md"
                      >
                        + 第3ナインを追加
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[#91855a] mb-1">ナイン名</label>
                        <input
                          type="text"
                          value={formNine3Name}
                          onChange={(e) => setFormNine3Name(e.target.value)}
                          className="w-full px-3 py-2 border border-[#d6cabc] rounded-md text-sm text-[#1d3937]"
                          placeholder="EXT"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-[#1d3937]">ホール 19-27</span>
                          <span className="text-xs text-[#91855a]">合計: {extTotal(formHoles)}</span>
                        </div>
                        <div className="grid grid-cols-9 gap-1">
                          {(formHoles.slice(18, 27).length > 0 ? formHoles.slice(18, 27) : DEFAULT_PARS_EXT).map((par, i) => (
                            <div key={i + 18} className="text-center">
                              <div className="text-xs text-[#91855a] mb-1">{i + 19}H</div>
                              <select
                                value={par}
                                onChange={(e) => setHolePar(i + 18, Number(e.target.value))}
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
                      <button
                        type="button"
                        onClick={() => toggleIs27hole(false)}
                        className="text-[#91855a] text-sm underline"
                      >
                        第3ナインを削除
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="text-right text-sm text-[#91855a]">
              合計パー: {outTotal(formHoles) + inTotal(formHoles) + (is27hole ? extTotal(formHoles) : 0)}
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
            {courses.map((course) => (
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
                  <div className="text-xs text-[#91855a]">
                    <div className="flex gap-1 flex-wrap">
                      <span className="font-bold">{course.nine1_name || 'OUT'}:</span>
                      {course.course_holes.slice(0, 9).map((h) => (
                        <span key={h.hole_number}>{h.par}</span>
                      ))}
                      <span className="ml-1 font-bold">
                        = {course.course_holes.slice(0, 9).reduce((a, h) => a + h.par, 0)}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <span className="font-bold">{course.nine2_name || 'IN'}:</span>
                      {course.course_holes.slice(9, 18).map((h) => (
                        <span key={h.hole_number}>{h.par}</span>
                      ))}
                      <span className="ml-1 font-bold">
                        = {course.course_holes.slice(9, 18).reduce((a, h) => a + h.par, 0)}
                      </span>
                    </div>
                    {course.course_holes.length >= 27 && (
                      <div className="flex gap-1 flex-wrap">
                        <span className="font-bold">{course.nine3_name || 'EXT'}:</span>
                        {course.course_holes.slice(18, 27).map((h) => (
                          <span key={h.hole_number}>{h.par}</span>
                        ))}
                        <span className="ml-1 font-bold">
                          = {course.course_holes.slice(18, 27).reduce((a, h) => a + h.par, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
