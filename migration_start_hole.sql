-- event_groups テーブルに start_hole カラムを追加
-- 既存データはすべて DEFAULT 1（OUTスタート）になり影響なし
ALTER TABLE event_groups
  ADD COLUMN IF NOT EXISTS start_hole smallint NOT NULL DEFAULT 1;
