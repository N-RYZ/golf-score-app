import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type RouteParams = { params: Promise<{ id: string }> };

// コース更新（名前 + ホールパー + ナイン名配列）
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { name, holes, nine_names } = await req.json();

    const courseUpdates: Record<string, unknown> = {};
    if (name) courseUpdates.name = name;

    if (holes && holes.length >= 18 && holes.length % 9 === 0) {
      const nineCount = holes.length / 9;
      const names: string[] = Array.from({ length: nineCount }, (_, i) =>
        nine_names?.[i] || (i === 0 ? 'OUT' : i === 1 ? 'IN' : `EXT${i - 1}`)
      );
      courseUpdates.nine_names = names;
    } else if (nine_names) {
      courseUpdates.nine_names = nine_names;
    }

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

    if (holes && holes.length >= 18 && holes.length % 9 === 0) {
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
      // ナイン数が減った場合は余分なホールを削除
      await supabase
        .from('course_holes')
        .delete()
        .eq('course_id', id)
        .gt('hole_number', holes.length);
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
