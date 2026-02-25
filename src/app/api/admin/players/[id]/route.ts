import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// プレイヤー詳細取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 500 });
    }

    if (!player) {
      return NextResponse.json({ error: 'プレイヤーが見つかりません' }, { status: 404 });
    }

    // 全年度の成績を取得
    const { data: seasonStats, error: statsError } = await supabase
      .from('player_season_stats')
      .select('*')
      .eq('player_id', id)
      .order('year', { ascending: false });

    if (statsError) {
      return NextResponse.json({ error: statsError.message }, { status: 500 });
    }

    return NextResponse.json({ ...player, season_stats: seasonStats });
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// プレイヤー情報更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, gender, birth_year, initial_handicap, current_handicap, total_points, year } = await req.json();

    // プレイヤー基本情報を更新
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (gender !== undefined) updateData.gender = gender;
    if (birth_year !== undefined) updateData.birth_year = birth_year;

    if (Object.keys(updateData).length > 0) {
      const { error: playerError } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', id);

      if (playerError) {
        if (playerError.code === '23505') {
          return NextResponse.json(
            { error: 'この名前は既に登録されています' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: playerError.message }, { status: 500 });
      }
    }

    // 年度別成績を更新（指定された場合）
    if (year && (initial_handicap !== undefined || current_handicap !== undefined || total_points !== undefined)) {
      const statsUpdate: any = {};
      if (initial_handicap !== undefined) statsUpdate.initial_handicap = initial_handicap;
      if (current_handicap !== undefined) statsUpdate.current_handicap = current_handicap;
      if (total_points !== undefined) statsUpdate.total_points = total_points;

      const { error: statsError } = await supabase
        .from('player_season_stats')
        .update(statsUpdate)
        .eq('player_id', id)
        .eq('year', parseInt(year));

      if (statsError) {
        return NextResponse.json({ error: statsError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// プレイヤー削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // プレイヤーを削除（CASCADE設定により関連データも削除される）
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
