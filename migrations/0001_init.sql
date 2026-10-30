-- 和音ききわけ：ランキング用の D1（SQLite）

-- 1回の チャレンジ（seed はサーバーが決める。1回だけ送れる）
CREATE TABLE IF NOT EXISTS runs (
  id         TEXT PRIMARY KEY,           -- ランダムな UUID
  seed       INTEGER NOT NULL,           -- 0..4294967295
  created_at INTEGER NOT NULL,           -- ミリ秒（サーバーの時計）
  ip_hash    TEXT NOT NULL,              -- SHA-256(日ごとの塩 + IP)。IP そのものは保存しない
  used       INTEGER NOT NULL DEFAULT 0  -- 1 = 結果を送りおえた
);
CREATE INDEX IF NOT EXISTS idx_runs_ip_time ON runs (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_time ON runs (created_at);

-- 自己ベスト（1人＝端末ID につき、period ごとに 1行）
CREATE TABLE IF NOT EXISTS scores (
  player_id TEXT NOT NULL,               -- 端末で作る UUID（小文字）
  period    TEXT NOT NULL,               -- 'all' または '2026-W44'（日本時間の ISO 週）
  name      TEXT NOT NULL,
  level     INTEGER NOT NULL,            -- 到達レベル 1..8
  mastered  INTEGER NOT NULL DEFAULT 0,  -- 1 = L8 クリア（マスター）
  correct   INTEGER NOT NULL,
  total     INTEGER NOT NULL,
  at        INTEGER NOT NULL,            -- 記録した時刻（ミリ秒）
  PRIMARY KEY (player_id, period)
);
-- 順位：マスター → 到達レベル → 正解数 → 先に記録（マスターなら level は 8 なので、この並びで「マスター＝9」と同じ）
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (period, mastered DESC, level DESC, correct DESC, at ASC);

-- IP のハッシュ用の、日ごとに変わるランダムな塩（2日たったら消す）
CREATE TABLE IF NOT EXISTS salts (
  day  TEXT PRIMARY KEY,                 -- '2026-10-29'（日本時間）
  salt TEXT NOT NULL
);
