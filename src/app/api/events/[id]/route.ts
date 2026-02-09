import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type RouteParams = { params: Promise<{ id: string }> };

// イベント詳細取得
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const { data: event, error } = await supabase
    .from('events')
    .select(`
      id, name, event_date, status, score_edit_deadline,
      courses ( id, name,
        course_holes ( hole_number, par )
      ),
      event_participants ( id, user_id,
        users ( id, name )
      ),
      event_groups ( id, group_number, start_time,
        group_members ( id, user_id,
          users ( id, name )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // スコア取得
  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .eq('event_id', id);

  // course_holes をソート
  if (event.courses && 'course_holes' in event.courses) {
    (event.courses as { course_holes: { hole_number: number }[] }).course_holes.sort(
      (a: { hole_number: number }, b: { hole_number: number }) => a.hole_number - b.hole_number
    );
  }

  // event_groups をソート
  if (event.event_groups) {
    event.event_groups.sort(
      (a: { group_number: number }, b: { group_number: number }) => a.group_number - b.group_number
    );
  }

  return NextResponse.json({ ...event, scores: scores || [] });
}

// イベント更新
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { name, event_date, course_id, status } = await req.json();

    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (event_date) updates.event_date = event_date;
    if (course_id) updates.course_id = course_id;
    if (status) updates.status = status;

    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント削除
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
