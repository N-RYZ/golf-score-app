import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type RouteParams = { params: Promise<{ id: string }> };

// コース更新（名前 + 18ホールのパー）
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { name, holes } = await req.json();

    if (name) {
      const { error } = await supabase
        .from('courses')
        .update({ name })
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

    if (holes && holes.length === 18) {
      for (let i = 0; i < 18; i++) {
        const { error } = await supabase
          .from('course_holes')
          .upsert(
            {
              course_id: id,
              hole_number: i + 1,
              par: holes[i],
            },
            { onConflict: 'course_id,hole_number' }
          );

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
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
