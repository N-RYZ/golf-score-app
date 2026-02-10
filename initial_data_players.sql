-- ゴルフスコア管理アプリ - プレイヤー初期データ投入
-- Supabaseダッシュボード > SQL Editor で実行してください
-- 前提: migration_handicap_system.sql を先に実行済みであること

-- ============================================
-- 1. プレイヤー基本情報登録（約40名）
-- ============================================

INSERT INTO players (name, gender, is_active) VALUES
  ('根岸 一幸', 'male', true),
  ('岩瀬 健太', 'male', true),
  ('泉井 悟', 'male', true),
  ('諸野 淳一', 'male', true),
  ('石川 輝', 'male', true),
  ('堀江 直樹', 'male', true),
  ('冨士谷 修男', 'male', true),
  ('松本 敏夫', 'male', true),
  ('白山 二夫', 'male', true),
  ('小川 裕文', 'male', true),
  ('甲神 良尚', 'male', true),
  ('諏訪 孝', 'male', true),
  ('高橋 俊太', 'male', true),
  ('吉川 葵', 'male', true),
  ('永井 良蔵', 'male', true),
  ('野上 洋史', 'male', true),
  ('北山 衣里子', 'female', true),
  ('本郷 泰士', 'male', true),
  ('和田 元', 'male', true),
  ('三沢 尚之', 'male', true),
  ('古木 康代', 'female', true),
  ('金関 鳩子', 'female', true),
  ('内田 勝也', 'male', true),
  ('西堀 修平', 'male', true),
  ('中沢 安里', 'male', true),
  ('鈴木 大輔', 'male', true),
  ('斉藤 大介', 'male', true),
  ('小池 正二', 'male', true),
  ('田中 淳一', 'male', true),
  ('田中 健介', 'male', true),
  ('渡邉 貴', 'male', true),
  ('千村 嘉久', 'male', true),
  ('柴田 晃一', 'male', true),
  ('山田 江梨', 'female', true),
  ('垣田 智雄', 'male', true),
  ('三浦 慎吾', 'male', true),
  ('佐瀬 剛司', 'male', true),
  ('三須 康弘', 'male', true),
  ('今井 恵', 'female', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. 2026年度の初期ハンデ設定
-- ============================================

-- 一時テーブルでプレイヤーIDを取得しながら初期ハンデを設定
WITH player_handicaps AS (
  SELECT
    p.id,
    p.name,
    CASE p.name
      WHEN '根岸 一幸' THEN 0
      WHEN '岩瀬 健太' THEN 1
      WHEN '泉井 悟' THEN 0
      WHEN '諸野 淳一' THEN 11
      WHEN '石川 輝' THEN 9
      WHEN '堀江 直樹' THEN 14
      WHEN '冨士谷 修男' THEN 13
      WHEN '松本 敏夫' THEN 18
      WHEN '白山 二夫' THEN 18
      WHEN '小川 裕文' THEN 18
      WHEN '甲神 良尚' THEN 18
      WHEN '諏訪 孝' THEN 18
      WHEN '高橋 俊太' THEN 12
      WHEN '吉川 葵' THEN 19
      WHEN '永井 良蔵' THEN 23
      WHEN '野上 洋史' THEN 23
      WHEN '北山 衣里子' THEN 23
      WHEN '本郷 泰士' THEN 36
      WHEN '和田 元' THEN 24
      WHEN '三沢 尚之' THEN 31
      WHEN '古木 康代' THEN 40
      WHEN '金関 鳩子' THEN 40
      WHEN '内田 勝也' THEN 36
      WHEN '西堀 修平' THEN 24
      WHEN '中沢 安里' THEN 36
      WHEN '鈴木 大輔' THEN 16
      WHEN '斉藤 大介' THEN 16
      WHEN '小池 正二' THEN 21
      WHEN '田中 淳一' THEN 23
      WHEN '田中 健介' THEN 23
      WHEN '渡邉 貴' THEN 23
      WHEN '千村 嘉久' THEN 24
      WHEN '柴田 晃一' THEN 30
      WHEN '山田 江梨' THEN 32
      WHEN '垣田 智雄' THEN 33
      WHEN '三浦 慎吾' THEN 36
      WHEN '佐瀬 剛司' THEN 36
      WHEN '三須 康弘' THEN 36
      WHEN '今井 恵' THEN 40
      ELSE 36
    END AS handicap
  FROM players p
)
INSERT INTO player_season_stats (player_id, year, initial_handicap, current_handicap, total_points, participation_count)
SELECT id, 2026, handicap, handicap, 0, 0
FROM player_handicaps
ON CONFLICT (player_id, year) DO NOTHING;

-- ============================================
-- 3. 認証用アカウントの整理
-- ============================================

-- usersテーブルを認証用2アカウントのみに整理
-- 既存のプレイヤーアカウントを削除し、admin と player のみに
DELETE FROM users WHERE role = 'player';

-- 管理者アカウント確認・作成（パスワード: golf1234）
INSERT INTO users (name, password_hash, role)
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye7J8XZGqD2h5PZQK5K5K5K5K5K5K5K5K', 'admin')
ON CONFLICT (name) DO UPDATE SET role = 'admin';

-- プレイヤー共用アカウント作成（パスワード: golf1234）
INSERT INTO users (name, password_hash, role)
VALUES ('player', '$2a$10$N9qo8uLOickgx2ZMRZoMye7J8XZGqD2h5PZQK5K5K5K5K5K5K5K5K', 'player')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4. 確認クエリ
-- ============================================

-- 登録されたプレイヤー数を確認
SELECT COUNT(*) AS total_players FROM players WHERE is_active = true;

-- 2026年度のハンデ設定を確認
SELECT
  p.name,
  pss.initial_handicap,
  pss.current_handicap,
  pss.total_points
FROM player_season_stats pss
JOIN players p ON p.id = pss.player_id
WHERE pss.year = 2026
ORDER BY pss.initial_handicap ASC, p.name ASC;

-- 認証アカウント確認
SELECT name, role FROM users ORDER BY role DESC;

-- 初期データ投入完了
-- ログイン情報:
--   管理者: admin / golf1234
--   プレイヤー: player / golf1234
