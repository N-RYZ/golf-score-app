import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// コース一覧取得（ホール情報付き）
export async function GET() {
  const { data, error } = await supabase
    .from('courses')
    .select(`
      id, name, created_at,
      course_holes (id, hole_number, par)
    `)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ホール情報をhole_number順にソート
  const sorted = data?.map((course) => ({
    ...course,
    course_holes: course.course_holes
      ?.sort((a: { hole_number: number }, b: { hole_number: number }) => a.hole_number - b.hole_number),
  }));

  return NextResponse.json(sorted);
}

// コース新規登録（18ホールのパー情報含む）
export async function POST(req: NextRequest) {
  try {
    const { name, holes } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'コース名は必須です' }, { status: 400 });
    }

    if (!holes || holes.length !== 18) {
      return NextResponse.json(
        { error: '18ホール全てのパーを設定してください' },
        { status: 400 }
      );
    }

    // コース作成
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({ name })
      .select('id, name, created_at')
      .single();

    if (courseError) {
      if (courseError.code === '23505') {
        return NextResponse.json(
          { error: 'このコース名は既に登録されています' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: courseError.message }, { status: 500 });
    }

    // ホール情報作成
    const holeRecords = holes.map((par: number, index: number) => ({
      course_id: course.id,
      hole_number: index + 1,
      par,
    }));

    const { error: holesError } = await supabase
      .from('course_holes')
      .insert(holeRecords);

    if (holesError) {
      // ロールバック：コースも削除
      await supabase.from('courses').delete().eq('id', course.id);
      return NextResponse.json({ error: holesError.message }, { status: 500 });
    }

    return NextResponse.json(course, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
