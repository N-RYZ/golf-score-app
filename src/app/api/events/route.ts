import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// イベント一覧取得
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');

  let query = supabase
    .from('events')
    .select(`
      id, name, event_date, status, score_edit_deadline,
      courses ( id, name ),
      event_participants ( id, user_id, users ( id, name ) )
    `)
    .order('event_date', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
