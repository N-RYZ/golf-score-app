'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type Member = { id: string; name: string };
type Course = { id: string; name: string; course_holes: { hole_number: number }[] };
type GroupDraft = {
  group_number: number;
  start_time: string;
  start_hole: number;
  members: string[];
};

export default function NewEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [courseId, setCourseId] = useState('');
  const [eventType, setEventType] = useState<'1' | '2' | '3'>('1');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    const [membersRes, coursesRes] = await Promise.all([
      fetch(`/api/admin/players?year=${new Date().getFullYear()}`),
      fetch('/api/admin/courses'),
    ]);
    if (membersRes.ok) setMembers(await membersRes.json());
    if (coursesRes.ok) setCourses(await coursesRes.json());
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/admin');
      return;
    }
    fetchData();
  }, [user, router, fetchData]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const addGroup = () => {
    setGroups((prev) => {
      const lastTime = prev.length > 0 ? prev[prev.length - 1].start_time : null;
      let nextTime = '08:00';
      if (lastTime) {
        const [h, m] = lastTime.split(':').map(Number);
        const total = h * 60 + m + 6;
        nextTime = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      }
      return [
        ...prev,
        {
          group_number: prev.length + 1,
          start_time: nextTime,
          start_hole: 1,
          members: [],
        },
      ];
    });
  };

  const removeGroup = (index: number) => {
    setGroups((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((g, i) => ({ ...g, group_number: i + 1 }));
    });
  };

  const updateGroupTime = (index: number, time: string) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, start_time: time } : g)));
  };

  const updateGroupStartHole = (index: number, startHole: number) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, start_hole: startHole } : g)));
  };

  const toggleGroupMember = (groupIndex: number, userId: string) => {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        const members = g.members.includes(userId)
          ? g.members.filter((m) => m !== userId)
          : [...g.members, userId];
        return { ...g, members };
      })
    );
  };

  // 組に割り当て済みのメンバーID一覧
  const assignedMembers = groups.flatMap((g) => g.members);

  // 参加者のうち未割り当てのメンバー
  const unassignedParticipants = selectedParticipants.filter(
    (id) => !assignedMembers.includes(id)
  );

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name || '';
  const selectedCourseHoleCount = courses.find((c) => c.id === courseId)?.course_holes?.length ?? 18;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!eventName || !eventDate || !courseId) {
      setError('イベント名、日付、コースは必須です');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (selectedParticipants.length === 0) {
      setError('参加者を1人以上選択してください');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventName,
          event_date: eventDate,
          course_id: courseId,
          event_type: eventType,
          participants: selectedParticipants,
          groups: groups.filter((g) => g.members.length > 0),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '作成に失敗しました');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      router.push(`/events/${data.id}`);
    } catch {
      setError('ネットワークエラーが発生しました');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSubmitting(false);
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0E1A18' }}>
      <header className="flex items-center gap-3" style={{ backgroundColor: '#12211F', padding: '16px 20px' }}>
        <button onClick={() => router.push('/admin')} style={{ color: '#ffffff' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff' }}>イベント作成</h1>
      </header>

      <main className="p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-3 py-2 rounded text-sm" style={{ backgroundColor: '#2A1E1A', border: '1px solid #7A3B26', color: '#D98E6E' }}>
              {error}
            </div>
          )}

          {/* 基本情報 */}
          <section className="space-y-3" style={{ backgroundColor: '#182D28', borderRadius: '18px', padding: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>基本情報</h2>
            <div>
              <label className="block mb-1" style={{ fontSize: '14px', fontWeight: 700, color: '#8FA69C' }}>イベント名</label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full px-3 rounded-md text-[18px]"
                style={{ height: '50px', backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
                placeholder="例: 第12回月例会"
              />
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: '14px', fontWeight: 700, color: '#8FA69C' }}>日付</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 rounded-md text-[18px]"
                style={{ height: '50px', backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
              />
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: '14px', fontWeight: 700, color: '#8FA69C' }}>コース</label>
              <select
                required
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3 rounded-md text-[18px]"
                style={{ height: '50px', backgroundColor: '#12211F', border: '1.5px solid #2E4A43', color: '#E4EDE9' }}
              >
                <option value="">選択してください</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1" style={{ fontSize: '14px', fontWeight: 700, color: '#8FA69C' }}>大会種別</label>
              <div className="grid grid-cols-3 gap-2">
                {([['1', '通常大会'], ['2', 'メジャー大会'], ['3', '最終戦']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEventType(val)}
                    className="py-2 rounded-md text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: eventType === val ? '#1F4A3F' : '#182D28',
                      color: eventType === val ? '#ffffff' : '#8FA69C',
                      border: eventType === val ? '1.5px solid #6BAF8E' : '1.5px solid #2E4A43',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 参加者選択 */}
          <section className="space-y-3" style={{ backgroundColor: '#182D28', borderRadius: '18px', padding: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
              参加者 ({selectedParticipants.length}人)
            </h2>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleParticipant(m.id)}
                  className="font-bold transition-colors"
                  style={{
                    padding: '9px 14px',
                    borderRadius: '999px',
                    fontSize: '17px',
                    backgroundColor: selectedParticipants.includes(m.id) ? '#1F4A3F' : '#182D28',
                    color: selectedParticipants.includes(m.id) ? '#ffffff' : '#8FA69C',
                    border: selectedParticipants.includes(m.id) ? '1.5px solid #6BAF8E' : '1.5px solid #2E4A43',
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </section>

          {/* 組み合わせ */}
          <section className="space-y-3" style={{ backgroundColor: '#182D28', borderRadius: '18px', padding: '16px' }}>
            <div className="flex items-center justify-between">
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>組み合わせ</h2>
              <button
                type="button"
                onClick={addGroup}
                className="font-bold"
                style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '13px', backgroundColor: '#6BAF8E', color: '#0E1A18' }}
              >
                + 組追加
              </button>
            </div>

            {groups.length === 0 && (
              <p className="text-sm" style={{ color: '#8FA69C' }}>組を追加してメンバーを割り当ててください</p>
            )}

            {groups.map((group, gi) => (
              <div key={gi} className="rounded-lg p-3 space-y-2" style={{ border: '1px solid #2E4A43' }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-sm" style={{ color: '#ffffff' }}>
                    {group.group_number}組
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <select
                        value={group.start_time.slice(0, 2)}
                        onChange={(e) => updateGroupTime(gi, `${e.target.value}:${group.start_time.slice(3, 5)}`)}
                        className="px-1 py-1 rounded text-sm"
                        style={{ backgroundColor: '#12211F', border: '1px solid #2E4A43', color: '#E4EDE9' }}
                      >
                        {Array.from({ length: 13 }, (_, i) => i + 5).map((h) => (
                          <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="font-bold" style={{ color: '#8FA69C' }}>:</span>
                      <select
                        value={group.start_time.slice(3, 5)}
                        onChange={(e) => updateGroupTime(gi, `${group.start_time.slice(0, 2)}:${e.target.value}`)}
                        className="px-1 py-1 rounded text-sm"
                        style={{ backgroundColor: '#12211F', border: '1px solid #2E4A43', color: '#E4EDE9' }}
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2E4A43' }}>
                      {([1, 10, ...(selectedCourseHoleCount >= 27 ? [19] : [])] as number[]).map((sh) => (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => updateGroupStartHole(gi, sh)}
                          className="px-2 py-1 text-xs font-bold transition-colors"
                          style={{
                            backgroundColor: (group.start_hole ?? 1) === sh ? '#6BAF8E' : 'transparent',
                            color: (group.start_hole ?? 1) === sh ? '#0E1A18' : '#8FA69C',
                          }}
                        >
                          {sh === 1 ? 'OUT' : sh === 10 ? 'IN' : 'EXT'}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGroup(gi)}
                      className="text-sm"
                      style={{ color: '#D98E6E' }}
                    >
                      削除
                    </button>
                  </div>
                </div>

                {/* 組メンバー */}
                <div className="flex flex-wrap gap-1">
                  {group.members.map((userId) => (
                    <span
                      key={userId}
                      onClick={() => toggleGroupMember(gi, userId)}
                      className="px-2 py-1 rounded text-xs cursor-pointer font-bold"
                      style={{ backgroundColor: '#1F4A3F', color: '#ffffff' }}
                    >
                      {getMemberName(userId)} ×
                    </span>
                  ))}
                </div>

                {/* 未割り当て参加者 */}
                {unassignedParticipants.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {unassignedParticipants.map((userId) => (
                      <button
                        key={userId}
                        type="button"
                        onClick={() => toggleGroupMember(gi, userId)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: '#182D28', color: '#8FA69C', border: '1.5px dashed #2E4A43' }}
                      >
                        + {getMemberName(userId)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center disabled:opacity-50"
            style={{ height: '62px', borderRadius: '16px', backgroundColor: '#6BAF8E' }}
          >
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#0E1A18' }}>
              {submitting ? '作成中...' : 'イベントを作成'}
            </span>
          </button>
        </form>
      </main>
    </div>
  );
}
