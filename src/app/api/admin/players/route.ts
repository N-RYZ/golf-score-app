import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// プレイヤー一覧取得（年度別ハンデ・ポイント情報含む）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || '2026';

    // プレイヤー基本情報と年度別成績をJOIN
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select(`
        id,
        name,
        gender,
        birth_year,
        is_active,
        created_at
      `)
      .eq('is_active', true)
      .order('name');

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    // 年度別成績を取得
    const { data: seasonStats, error: statsError } = await supabase
      .from('player_season_stats')
      .select('*')
      .eq('year', parseInt(year));

    if (statsError) {
      return NextResponse.json({ error: statsError.message }, { status: 500 });
    }

    // プレイヤーデータに年度別成績をマージ
    const playersWithStats = players.map(player => {
      const stats = seasonStats?.find(s => s.player_id === player.id);
      return {
        ...player,
        initial_handicap: stats?.initial_handicap ?? null,
        current_handicap: stats?.current_handicap ?? null,
        total_points: stats?.total_points || 0,
        participation_count: stats?.participation_count || 0
      };
    });

    playersWithStats.sort((a, b) => {
      const ha = a.current_handicap ?? 999;
      const hb = b.current_handicap ?? 999;
      return ha - hb;
    });

    return NextResponse.json(playersWithStats);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// プレイヤー新規登録
export async function POST(req: NextRequest) {
  try {
    const { name, gender, birth_year, initial_handicap, year } = await req.json();

    if (!name || initial_handicap === undefined || !year) {
      return NextResponse.json(
        { error: '名前、初期ハンデ、年度は必須です' },
        { status: 400 }
      );
    }

    // プレイヤー基本情報を登録
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ name, gender, birth_year, is_active: true })
      .select()
      .single();

    if (playerError) {
      if (playerError.code === '23505') {
        return NextResponse.json(
          { error: 'この名前は既に登録されています' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: playerError.message }, { status: 500 });
    }

    // 年度別成績を登録
    const { error: statsError } = await supabase
      .from('player_season_stats')
      .insert({
        player_id: player.id,
        year: parseInt(year),
        initial_handicap,
        current_handicap: initial_handicap,
        total_points: 0,
        participation_count: 0
      });

    if (statsError) {
      // プレイヤー登録は成功したが、成績登録に失敗した場合はロールバック
      await supabase.from('players').delete().eq('id', player.id);
      return NextResponse.json({ error: statsError.message }, { status: 500 });
    }

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
