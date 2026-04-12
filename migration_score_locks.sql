-- score_locks テーブル: スコア入力中の組をロック管理
CREATE TABLE IF NOT EXISTS score_locks (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  group_id text NOT NULL,
  device_id text NOT NULL,
  locked_at timestamptz DEFAULT now(),
  heartbeat_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, group_id)
);

ALTER TABLE score_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON score_locks;
CREATE POLICY "Allow all for anon" ON score_locks
  FOR ALL USING (true) WITH CHECK (true);
