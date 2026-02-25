-- scoresテーブルの user_id を nullable にする
-- player_id ベースのシステムに移行したため
-- Supabaseダッシュボード > SQL Editor で実行してください

ALTER TABLE scores ALTER COLUMN user_id DROP NOT NULL;
