-- 和音ききわけ：ランキングをまもるためのテーブル

-- 1つの IP（日ごとのハッシュ）からランキングにのった端末ID。1日にふやせる人数をしぼる（1日たったら消す）
CREATE TABLE IF NOT EXISTS ip_players (
  ip_hash    TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, player_id)
);
CREATE INDEX IF NOT EXISTS idx_ip_players_time ON ip_players (created_at);

-- 先生が「もうのせない」にした端末ID（DELETE /api/admin/scores/<id>?block=1）
CREATE TABLE IF NOT EXISTS blocked_players (
  player_id TEXT PRIMARY KEY,
  at        INTEGER NOT NULL
);

-- 先生用キーのまちがい（IP のハッシュごと。1時間に10回まで。1日たったら消す）
CREATE TABLE IF NOT EXISTS admin_fail (
  ip_hash TEXT NOT NULL,
  at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_fail ON admin_fail (ip_hash, at);
