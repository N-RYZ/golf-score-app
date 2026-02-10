-- ゴルフスコア管理アプリ - ハンデキャップ・ポイント管理機能追加マイグレーション
-- Supabaseダッシュボード > SQL Editor で実行してください

-- ============================================
-- 1. 新テーブル作成
-- ============================================

-- プレイヤー基本情報テーブル
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  gender VARCHAR(10), -- 'male' | 'female' (オプション)
  birth_year INTEGER, -- ランキングタイブレーク用（オプション）
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 年度別プレイヤー成績テーブル
CREATE TABLE IF NOT EXISTS player_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  year INTEGER NOT NULL, -- 2026, 2027...
  initial_handicap DECIMAL(4,1) NOT NULL, -- 年度初期ハンデ
  current_handicap DECIMAL(4,1) NOT NULL, -- 現在のハンデ
  total_points INTEGER DEFAULT 0, -- 年間累計ポイント
  participation_count INTEGER DEFAULT 0, -- 参加回数
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, year)
);

-- イベント結果テーブル
CREATE TABLE IF NOT EXISTS event_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  gross_score INTEGER, -- グロススコア合計
  net_score INTEGER, -- ネットスコア（グロス - ハンデ）
  rank INTEGER, -- 順位
  points INTEGER DEFAULT 0, -- 獲得ポイント
  handicap_before DECIMAL(4,1), -- イベント前のハンデ
  handicap_after DECIMAL(4,1), -- イベント後のハンデ
  under_par_strokes INTEGER, -- アンダー打数（アンダーカット用）
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, player_id)
);

-- ハンデ変更履歴テーブル
CREATE TABLE IF NOT EXISTS handicap_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  handicap_before DECIMAL(4,1),
  handicap_after DECIMAL(4,1),
  adjustment_reason TEXT, -- '期中更新', '手動調整', '初期設定' など
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. 既存テーブルへのカラム追加
-- ============================================

-- eventsテーブルに年度・イベントタイプ・確定フラグ追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='year') THEN
    ALTER TABLE events ADD COLUMN year INTEGER NOT NULL DEFAULT 2026;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='event_type') THEN
    ALTER TABLE events ADD COLUMN event_type VARCHAR(20) DEFAULT 'regular' CHECK (event_type IN ('regular', 'major', 'final'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='is_finalized') THEN
    ALTER TABLE events ADD COLUMN is_finalized BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='finalized_at') THEN
    ALTER TABLE events ADD COLUMN finalized_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='finalized_by') THEN
    ALTER TABLE events ADD COLUMN finalized_by UUID REFERENCES users(id);
  END IF;
END $$;

-- ============================================
-- 3. 既存データの移行（users → players）
-- ============================================

-- 全てのusersをplayersに移行（管理者も一時的に含む）
INSERT INTO players (id, name, is_active, created_at, updated_at)
SELECT id, name, true, created_at, updated_at
FROM users
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4. 既存テーブルのFK変更準備
-- ============================================

-- event_participantsテーブルにplayer_idカラム追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_participants' AND column_name='player_id') THEN
    ALTER TABLE event_participants ADD COLUMN player_id UUID REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 既存のuser_idからplayer_idにデータコピー（playersテーブルに存在するもののみ）
UPDATE event_participants
SET player_id = user_id
WHERE player_id IS NULL
  AND user_id IN (SELECT id FROM players);

-- group_membersテーブルにplayer_idカラム追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_members' AND column_name='player_id') THEN
    ALTER TABLE group_members ADD COLUMN player_id UUID REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE group_members
SET player_id = user_id
WHERE player_id IS NULL
  AND user_id IN (SELECT id FROM players);

-- scoresテーブルにplayer_idカラム追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scores' AND column_name='player_id') THEN
    ALTER TABLE scores ADD COLUMN player_id UUID REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE scores
SET player_id = user_id
WHERE player_id IS NULL
  AND user_id IN (SELECT id FROM players);

-- ============================================
-- 5. インデックス作成（パフォーマンス向上）
-- ============================================

CREATE INDEX IF NOT EXISTS idx_player_season_stats_player_year ON player_season_stats(player_id, year);
CREATE INDEX IF NOT EXISTS idx_event_results_event ON event_results(event_id);
CREATE INDEX IF NOT EXISTS idx_event_results_player ON event_results(player_id);
CREATE INDEX IF NOT EXISTS idx_handicap_history_player ON handicap_history(player_id);
CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_finalized ON events(is_finalized);

-- マイグレーション完了
-- 次のステップ: initial_data_players.sql で初期ハンデデータを投入
