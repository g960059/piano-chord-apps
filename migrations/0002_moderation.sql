-- 和音ききわけ：ランキングを まもる ための テーブル

-- 1つの IP（日ごとの ハッシュ）から ランキングに のった 端末ID。1日に ふやせる 人数を しぼる（1日たったら 消す）
CREATE TABLE IF NOT EXISTS ip_players (
  ip_hash    TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, player_id)
);
CREATE INDEX IF NOT EXISTS idx_ip_players_time ON ip_players (created_at);

-- 先生が「もう のせない」に した 端末ID（DELETE /api/admin/scores/<id>?block=1）
CREATE TABLE IF NOT EXISTS blocked_players (
  player_id TEXT PRIMARY KEY,
  at        INTEGER NOT NULL
);

-- 先生用キーの まちがい（IP のハッシュごと。1時間に 10回まで。1日たったら 消す）
CREATE TABLE IF NOT EXISTS admin_fail (
  ip_hash TEXT NOT NULL,
  at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_fail ON admin_fail (ip_hash, at);
