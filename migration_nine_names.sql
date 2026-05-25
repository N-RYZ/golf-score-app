-- coursesテーブルにナイン名カラムを追加
-- 既存コースは OUT / IN / null (デフォルト値)が設定される
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS nine1_name text NOT NULL DEFAULT 'OUT',
  ADD COLUMN IF NOT EXISTS nine2_name text NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS nine3_name text;
