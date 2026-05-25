import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type RouteParams = { params: Promise<{ id: string }> };

// コース更新（名前 + ホールパー + ナイン名）
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { name, holes, nine1_name, nine2_name, nine3_name } = await req.json();

    const courseUpdates: Record<string, string | null> = {};
    if (name) courseUpdates.name = name;
    if (nine1_name !== undefined) courseUpdates.nine1_name = nine1_name || 'OUT';
    if (nine2_name !== undefined) courseUpdates.nine2_name = nine2_name || 'IN';
    courseUpdates.nine3_name = nine3_name || null;

    if (Object.keys(courseUpdates).length > 0) {
      const { error } = await supabase
        .from('courses')
        .update(courseUpdates)
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'このコース名は既に登録されています' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (holes && (holes.length === 18 || holes.length === 27)) {
      for (let i = 0; i < holes.length; i++) {
        const { error } = await supabase
          .from('course_holes')
          .upsert(
            { course_id: id, hole_number: i + 1, par: holes[i] },
            { onConflict: 'course_id,hole_number' }
          );
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      // 18ホールに戻した場合は19H以降を削除
      if (holes.length <= 18) {
        await supabase
          .from('course_holes')
          .delete()
          .eq('course_id', id)
          .gt('hole_number', 18);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// コース削除（CASCADE で course_holes も削除される）
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('courses')
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
