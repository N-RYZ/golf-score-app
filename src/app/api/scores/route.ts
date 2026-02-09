import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// スコア取得（イベント＋ユーザー指定）
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  const userId = req.nextUrl.searchParams.get('user_id');

  if (!eventId) {
    return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
  }

  let query = supabase
    .from('scores')
    .select('*')
    .eq('event_id', eventId);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('hole_number');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// スコア保存（upsert）
export async function PUT(req: NextRequest) {
  try {
    const { event_id, user_id, hole_number, strokes, putts, updated_by } = await req.json();

    if (!event_id || !user_id || !hole_number) {
      return NextResponse.json(
        { error: 'event_id, user_id, hole_number は必須です' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('scores')
      .upsert(
        {
          event_id,
          user_id,
          hole_number,
          strokes: strokes || 0,
          putts: putts || 0,
          updated_by: updated_by || user_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id,hole_number' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// スコア一括保存
export async function POST(req: NextRequest) {
  try {
    const { scores } = await req.json();

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json({ error: 'scores array is required' }, { status: 400 });
    }

    const records = scores.map((s: {
      event_id: string;
      user_id: string;
      hole_number: number;
      strokes: number;
      putts: number;
      updated_by?: string;
    }) => ({
      event_id: s.event_id,
      user_id: s.user_id,
      hole_number: s.hole_number,
      strokes: s.strokes || 0,
      putts: s.putts || 0,
      updated_by: s.updated_by || s.user_id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('scores')
      .upsert(records, { onConflict: 'event_id,user_id,hole_number' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
