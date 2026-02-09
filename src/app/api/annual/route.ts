import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year') || new Date().getFullYear().toString();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // 年間のイベント取得
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(`
      id, name, event_date, status,
      courses ( id, name,
        course_holes ( hole_number, par )
      )
    `)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ events: [], rankings: [], penalties: [] });
  }

  const eventIds = events.map((e) => e.id);

  // 全スコア取得
  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('event_id, user_id, hole_number, strokes, putts')
    .in('event_id', eventIds);

  if (scoresError) {
    return NextResponse.json({ error: scoresError.message }, { status: 500 });
  }

  // ユーザー一覧取得
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .order('name');

  const userMap = new Map((users || []).map((u) => [u.id, u.name]));

  // コースホール情報のマップ
  const courseHolesMap = new Map<string, { hole_number: number; par: number }[]>();
  for (const event of events) {
    if (event.courses && 'course_holes' in event.courses) {
      const course = event.courses as unknown as { id: string; course_holes: { hole_number: number; par: number }[] };
      courseHolesMap.set(event.id, course.course_holes);
    }
  }

  // ユーザーごとの集計
  type UserStats = {
    user_id: string;
    name: string;
    event_count: number;
    total_strokes: number;
    total_putts: number;
    total_penalty: number;
    best_score: number | null;
    avg_score: number | null;
    event_scores: { event_id: string; event_name: string; event_date: string; total: number; penalty: number }[];
  };

  const statsMap = new Map<string, UserStats>();

  // イベントごとにスコアを集計
  for (const event of events) {
    const eventScores = (scores || []).filter((s) => s.event_id === event.id);
    const holes = courseHolesMap.get(event.id) || [];

    // ユーザーごとにグループ化
    const userScores = new Map<string, typeof eventScores>();
    for (const s of eventScores) {
      if (!userScores.has(s.user_id)) userScores.set(s.user_id, []);
      userScores.get(s.user_id)!.push(s);
    }

    for (const [userId, uScores] of userScores) {
      // 18ホール揃っていない場合はスキップ
      if (uScores.length < 18) continue;

      const totalStrokes = uScores.reduce((sum, s) => sum + (s.strokes || 0), 0);
      const totalPutts = uScores.reduce((sum, s) => sum + (s.putts || 0), 0);

      // 罰金計算
      let penalty = 0;
      for (const s of uScores) {
        if (s.putts >= 3) penalty += (s.putts - 2) * 100;
        const hole = holes.find((h) => h.hole_number === s.hole_number);
        if (hole && hole.par === 3 && s.strokes >= 2) penalty += 100;
      }

      if (!statsMap.has(userId)) {
        statsMap.set(userId, {
          user_id: userId,
          name: userMap.get(userId) || '不明',
          event_count: 0,
          total_strokes: 0,
          total_putts: 0,
          total_penalty: 0,
          best_score: null,
          avg_score: null,
          event_scores: [],
        });
      }

      const stats = statsMap.get(userId)!;
      stats.event_count++;
      stats.total_strokes += totalStrokes;
      stats.total_putts += totalPutts;
      stats.total_penalty += penalty;
      if (stats.best_score === null || totalStrokes < stats.best_score) {
        stats.best_score = totalStrokes;
      }
      stats.event_scores.push({
        event_id: event.id,
        event_name: event.name,
        event_date: event.event_date,
        total: totalStrokes,
        penalty,
      });
    }
  }

  // 平均スコア計算
  const rankings = Array.from(statsMap.values()).map((s) => ({
    ...s,
    avg_score: s.event_count > 0 ? Math.round((s.total_strokes / s.event_count) * 10) / 10 : null,
  }));

  // 平均スコアでソート（低い方が上位）
  rankings.sort((a, b) => {
    if (a.avg_score === null) return 1;
    if (b.avg_score === null) return -1;
    return a.avg_score - b.avg_score;
  });

  // 罰金ランキング（多い順）
  const penalties = [...rankings].sort((a, b) => b.total_penalty - a.total_penalty);

  return NextResponse.json({
    year: Number(year),
    events: events.map((e) => ({ id: e.id, name: e.name, event_date: e.event_date })),
    rankings,
    penalties,
  });
}
