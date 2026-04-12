import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ハートビートなしで2分経過したロックは失効とみなす
const LOCK_TIMEOUT_MS = 2 * 60 * 1000;

function isExpired(heartbeatAt: string): boolean {
  return Date.now() - new Date(heartbeatAt).getTime() > LOCK_TIMEOUT_MS;
}

// ロック状態確認
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  const groupId = req.nextUrl.searchParams.get('group_id');

  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  let query = supabase
    .from('score_locks')
    .select('group_id, device_id, heartbeat_at')
    .eq('event_id', eventId);

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 失効済みロックを除外
  const activeLocks = (data || []).filter((l) => !isExpired(l.heartbeat_at));
  return NextResponse.json(activeLocks);
}

// ロック取得
export async function POST(req: NextRequest) {
  try {
    const { event_id, group_id, device_id, force } = await req.json();

    if (!event_id || !group_id || !device_id) {
      return NextResponse.json({ error: 'event_id, group_id, device_id required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 既存ロック確認（maybeSingle: 0行でもエラーにならない）
    const { data: existing, error: selectError } = await supabase
      .from('score_locks')
      .select('device_id, heartbeat_at')
      .eq('event_id', event_id)
      .eq('group_id', group_id)
      .maybeSingle();

    // テーブル未作成などインフラエラー → ロック機能をスキップして通過
    if (selectError) {
      console.error('score_locks select error:', selectError.message);
      return NextResponse.json({ success: true, skipped: true });
    }

    if (existing) {
      const expired = isExpired(existing.heartbeat_at);
      const isSameDevice = existing.device_id === device_id;

      if (!isSameDevice && !expired && !force) {
        // 他端末がアクティブにロック中 → 拒否
        return NextResponse.json({ success: false, locked: true }, { status: 409 });
      }

      // 同デバイス or 失効済み or force → 上書き
      await supabase
        .from('score_locks')
        .update({ device_id, locked_at: now, heartbeat_at: now })
        .eq('event_id', event_id)
        .eq('group_id', group_id);

      return NextResponse.json({ success: true });
    }

    // 新規作成
    const { error: insertError } = await supabase
      .from('score_locks')
      .insert({ event_id, group_id, device_id, locked_at: now, heartbeat_at: now });

    if (insertError) {
      console.error('score_locks insert error:', insertError.message);
      // 挿入エラーはロックとして扱わず通過
      return NextResponse.json({ success: true, skipped: true });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// ハートビート更新
export async function PUT(req: NextRequest) {
  try {
    const { event_id, group_id, device_id } = await req.json();

    await supabase
      .from('score_locks')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('event_id', event_id)
      .eq('group_id', group_id)
      .eq('device_id', device_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// ロック解放
export async function DELETE(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('event_id');
  const groupId = req.nextUrl.searchParams.get('group_id');
  const deviceId = req.nextUrl.searchParams.get('device_id');

  if (!eventId || !groupId || !deviceId) {
    return NextResponse.json({ error: 'event_id, group_id, device_id required' }, { status: 400 });
  }

  await supabase
    .from('score_locks')
    .delete()
    .eq('event_id', eventId)
    .eq('group_id', groupId)
    .eq('device_id', deviceId);

  return NextResponse.json({ success: true });
}
