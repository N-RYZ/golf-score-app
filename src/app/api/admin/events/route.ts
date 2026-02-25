import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// イベント作成（参加者・組み合わせ含む）
export async function POST(req: NextRequest) {
  try {
    const { name, event_date, course_id, event_type, participants, groups } = await req.json();

    if (!name || !event_date || !course_id) {
      return NextResponse.json(
        { error: 'イベント名、日付、コースは必須です' },
        { status: 400 }
      );
    }

    // イベント作成
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({ name, event_date, course_id, event_type: event_type || '1', status: 'upcoming' })
      .select('id')
      .single();

    if (eventError) {
      console.error('Event insert error:', eventError);
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    if (!event) {
      return NextResponse.json({ error: 'イベントの作成に失敗しました（データ取得エラー）' }, { status: 500 });
    }

    const eventId = event.id;

    // 参加者登録
    if (participants && participants.length > 0) {
      const participantRecords = participants.map((userId: string) => ({
        event_id: eventId,
        player_id: userId,
      }));

      const { error: partError } = await supabase
        .from('event_participants')
        .insert(participantRecords);

      if (partError) {
        console.error('Participants insert error:', partError);
        await supabase.from('events').delete().eq('id', eventId);
        return NextResponse.json({ error: partError.message }, { status: 500 });
      }
    }

    // 組み合わせ登録
    if (groups && groups.length > 0) {
      for (const group of groups) {
        const { data: groupData, error: groupError } = await supabase
          .from('event_groups')
          .insert({
            event_id: eventId,
            group_number: group.group_number,
            start_time: group.start_time,
          })
          .select('id')
          .single();

        if (groupError) {
          console.error('Group insert error:', groupError);
          await supabase.from('events').delete().eq('id', eventId);
          return NextResponse.json({ error: groupError.message }, { status: 500 });
        }

        if (!groupData) {
          await supabase.from('events').delete().eq('id', eventId);
          return NextResponse.json({ error: '組の作成に失敗しました（データ取得エラー）' }, { status: 500 });
        }

        if (group.members && group.members.length > 0) {
          const memberRecords = group.members.map((userId: string, index: number) => ({
            group_id: groupData.id,
            player_id: userId,
            order_index: index,
          }));

          const { error: memberError } = await supabase
            .from('group_members')
            .insert(memberRecords);

          if (memberError) {
            console.error('Group members insert error:', memberError);
            await supabase.from('events').delete().eq('id', eventId);
            return NextResponse.json({ error: memberError.message }, { status: 500 });
          }
        }
      }
    }

    return NextResponse.json({ id: eventId }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/admin/events:', err);
    return NextResponse.json({ error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
