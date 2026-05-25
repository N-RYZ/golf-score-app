-- coursesテーブルにナイン名配列カラムを追加（任意のナイン数に対応）
-- nine1_name/nine2_name/nine3_name の固定列アプローチを廃止し、
-- nine_names text[] で可変長に対応する
DO $$
BEGIN
  -- nine_names カラムがなければ追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'nine_names'
  ) THEN
    ALTER TABLE courses ADD COLUMN nine_names text[] NOT NULL DEFAULT ARRAY['OUT','IN'];

    -- nine1/2/3_name カラムが存在する場合はデータを移行して削除
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'courses' AND column_name = 'nine1_name'
    ) THEN
      UPDATE courses SET nine_names =
        ARRAY[COALESCE(nine1_name, 'OUT'), COALESCE(nine2_name, 'IN')]
        || CASE WHEN nine3_name IS NOT NULL THEN ARRAY[nine3_name] ELSE ARRAY[]::text[] END;
      ALTER TABLE courses DROP COLUMN IF EXISTS nine1_name;
      ALTER TABLE courses DROP COLUMN IF EXISTS nine2_name;
      ALTER TABLE courses DROP COLUMN IF EXISTS nine3_name;
    END IF;
  END IF;

  -- nine1_name だけ残っている場合（nine_namesは既存）も削除
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'nine1_name'
  ) THEN
    ALTER TABLE courses DROP COLUMN IF EXISTS nine1_name;
    ALTER TABLE courses DROP COLUMN IF EXISTS nine2_name;
    ALTER TABLE courses DROP COLUMN IF EXISTS nine3_name;
  END IF;
END $$;
