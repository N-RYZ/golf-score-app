import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 年間総合ランキング取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || '2026';

    // プレイヤーと年度別成績をJOINしてランキング取得
    const { data: rankings, error } = await supabase
      .from('player_season_stats')
      .select(`
        *,
        players(
          id,
          name,
          gender,
          birth_year
        )
      `)
      .eq('year', parseInt(year))
      .order('total_points', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ランキングを整形（タイブレーク適用）
    const sortedRankings = (rankings || []).sort((a, b) => {
      // 1. ポイント総数（降順）
      if (a.total_points !== b.total_points) {
        return b.total_points - a.total_points;
      }

      // 2. 参加回数（降順）
      if (a.participation_count !== b.participation_count) {
        return b.participation_count - a.participation_count;
      }

      // 3. 初期ハンデが低い（昇順）
      if (a.initial_handicap !== b.initial_handicap) {
        return a.initial_handicap - b.initial_handicap;
      }

      // 4. 年齢が上（生年が早い = 昇順）
      const birthYearA = a.players?.birth_year || 9999;
      const birthYearB = b.players?.birth_year || 9999;
      return birthYearA - birthYearB;
    });

    // 順位を付与
    const rankingsWithRank = sortedRankings.map((item, index) => ({
      rank: index + 1,
      player_id: item.player_id,
      player_name: item.players?.name || '',
      gender: item.players?.gender || '',
      birth_year: item.players?.birth_year || null,
      initial_handicap: item.initial_handicap,
      current_handicap: item.current_handicap,
      total_points: item.total_points,
      participation_count: item.participation_count
    }));

    return NextResponse.json(rankingsWithRank);
  } catch (error) {
    console.error('Error fetching annual rankings:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
