/* ピアノ和音アプリ：Worker（和音の 聴きわけ の ランキング API ＋ 静的ファイル）
 *
 *   POST   /api/run                    チャレンジの開始 → { runId, seed }
 *   POST   /api/score                  結果を送る（サーバーで assets/ear-game.js の simulate で採点し直す）
 *   GET    /api/ranking?period=&player= 上位 50 人と自分
 *   先生用（Authorization: Bearer <ADMIN_KEY>。くわしくは docs/RANKING-ADMIN.md）
 *   GET    /api/admin/scores?period=all|week[&name=]  上位 50 人（または 名前で さがす）を 端末ID つきで
 *   DELETE /api/admin/scores/:playerId[?block=1]      その人の 記録を 消す（block=1 なら もう のせない）
 *   DELETE /api/admin/blocks/:playerId                「もう のせない」を とりけす
 *
 * scheduled（毎日 1:05 日本時間）で 古い run・塩・週の 記録を そうじする。
 *
 * もとは 和音ききわけ（g960059/waon-kikiwake）の src/worker.js。API・D1（waon-ranking）・採点は おなじ なので、
 * いままでの ランキングが そのまま つづく。
 *
 * /api/* いがいは wrangler.jsonc の assets（リポジトリの いちばん上。.assetsignore で のぞいた ものは 公開しない）。
 * ファイルが あれば Worker を とおらずに そのまま 出る。ないときだけ ここへ 来て env.ASSETS に まかせる（404）。
 * D1 はかならず bind() で値をわたす（文字列をつなげて SQL を作らない）。 */
// ゲームの きまりは 画面（ear.html）と おなじ ファイル。export の ない ふつうの script なので、読みこむと globalThis.EarGame が できる
import '../assets/ear-game.js';

const EG = globalThis.EarGame;
if (!EG) throw new Error('assets/ear-game.js did not define globalThis.EarGame');
const { simulate, isTypeId, CHALLENGE } = EG;

/* ===== きまり ===== */
export const LIMITS = Object.freeze({
  runTtlMs: CHALLENGE.runTtlMs,       // run は 2時間まで
  runsPerHour: 30,                    // 1つの IP から 1時間に作れる run
  maxBodyBytes: 16 * 1024,            // /api/score の本文（600問 × 8文字でも 6KB ほど）
  maxAnswers: CHALLENGE.maxAnswers,   // 600
  minMsPerAnswer: CHALLENGE.minMsPerAnswer, // 800
  nameMax: EG.NAME_MAX,
  topN: 50,
  runKeepMs: 24 * 60 * 60 * 1000,     // そうじ：1日より古い run（と ip_players・admin_fail）は消す
  rankWritesPerDay: 30,               // 1つの IP から 1日に ランキングを 書きかえられる回数（こえたら 採点だけ）
  newPlayersPerDay: 8,                // 1つの IP から 1日に ランキングに のせられる 端末ID の数
  adminKeyMin: 24,                    // これより 短い ADMIN_KEY は 「ない」と 同じ（404）
  adminFailsPerHour: 10,              // 先生用キーの まちがいは 1時間に 10回まで（IP ごと）
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = v => typeof v === 'string' && UUID_RE.test(v);

/* ===== 日付（日本時間）・名前のチェック（assets/ear-game.js。画面と おなじ きまり） ===== */
export const jstDay = (now = Date.now()) => EG.jstDay(now);
// 日本時間の ISO 週（月曜はじまり）。例：'2026-W44'
export const isoWeekJST = (now = Date.now()) => EG.weekId(now);
export const normalizeName = raw => EG.normalizeName(raw);
/* → { ok: true, name } または { ok: false, error } */
export const checkName = raw => EG.checkName(raw);

/* ===== 本文のチェック ===== */
/* → { ok: true, value: {runId, playerId, name, answers, elapsedMs} } または { ok: false, error } */
export function checkScoreBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: '送る データの 形が ちがうよ' };
  const { runId, playerId, name, answers, elapsedMs } = body;
  if (!isUuid(runId)) return { ok: false, error: 'チャレンジの 番号が ちがうよ' };
  if (!isUuid(playerId)) return { ok: false, error: '端末の 番号が ちがうよ' };
  if (!Array.isArray(answers) || answers.length < 1) return { ok: false, error: '答えが ないよ' };
  if (answers.length > LIMITS.maxAnswers) return { ok: false, error: '答えが 多すぎるよ' };
  if (!answers.every(isTypeId)) return { ok: false, error: '答えの 中に 知らない 和音が あるよ' };
  // 上限は 見ない：画面を 2時間 いじょう ひらいていても run の 時間ぎれ（410）を かえせるように。
  // 大きすぎる 値は submitScore で サーバーの 時計（run を 作ってからの 時間）に おさえる。
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { ok: false, error: 'かかった 時間が おかしいよ' };
  }
  const nm = checkName(name);
  if (!nm.ok) return nm;
  return { ok: true, value: { runId: runId.toLowerCase(), playerId: playerId.toLowerCase(), name: nm.name, answers, elapsedMs } };
}

/* ===== 小さな道具 ===== */
const enc = new TextEncoder();
const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function sha256Hex(s) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
// 長さや中身で時間が変わらない比較（両方を SHA-256 にしてから 32バイトを全部くらべる）
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const ux = new Uint8Array(x), uy = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ux.length; i++) diff |= ux[i] ^ uy[i];
  return diff === 0;
}
// IPv6 は /64 にまとめる（同じ回線の中で番号を変えても同じに数える）
export function ipKey(ip) {
  ip = String(ip || '').trim().toLowerCase();
  if (!ip.includes(':')) return ip || 'unknown';
  const v4 = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) return v4[1];
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  // マイク（assets/mic.js）は ページで つかうので ここでは とめない（この ヘッダーが つくのは API と 見つからない ページだけ）
  'Permissions-Policy': 'camera=(), geolocation=(), payment=()',
};
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS, ...extra },
  });
}
const err = (status, message, extra) => json({ error: message }, status, extra);
const methodNotAllowed = allow => err(405, 'その 方法では つかえないよ', { Allow: allow });

// ほかのサイトからの POST・DELETE は受けつけない（Origin があるときだけ見る）
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

// 本文を すこしずつ 読み、max バイトを こえたら そこで やめる（Content-Length が ない chunked でも 全部は 読まない）
async function readBodyCapped(request, max) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { try { await reader.cancel(); } catch { /* もう とじている */ } return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}
async function readJson(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (!/^application\/json\b/i.test(ct)) return { error: [415, 'JSON で 送ってね'] };
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > LIMITS.maxBodyBytes) return { error: [413, 'データが 大きすぎるよ'] };
  const buf = await readBodyCapped(request, LIMITS.maxBodyBytes);
  if (!buf) return { error: [413, 'データが 大きすぎるよ'] };
  try { return { body: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf)) }; }
  catch { return { error: [400, 'JSON の 形が ちがうよ'] }; }
}

/* ===== IP のハッシュ（日ごとの塩） ===== */
async function dailySalt(env, day) {
  const fresh = toHex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?1, ?2)').bind(day, fresh).run();
  const row = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?1').bind(day).first();
  return row ? row.salt : fresh;
}
/* → { today, yesterday }。日本時間の 0時〜1時は、きのうの 塩が のこって いれば きのうの ハッシュも 出す
 * （「1時間に 30回」が 0時で 数えなおしに ならないように）。それ以外は yesterday = today。 */
async function ipHashes(env, request, now) {
  const day = jstDay(now), ip = ipKey(request.headers.get('CF-Connecting-IP'));
  const today = await sha256Hex(`${await dailySalt(env, day)}|${day}|${ip}`);
  const hourAgo = jstDay(now - 3600000);
  if (hourAgo === day) return { today, yesterday: today };
  const y = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?1').bind(hourAgo).first();
  return { today, yesterday: y ? await sha256Hex(`${y.salt}|${hourAgo}|${ip}`) : today };
}

/* ===== そうじ（run を 作るたびと、毎日の scheduled） =====
 * 塩は 日本時間 1時を すぎたら きのうの 分を 消す（のこると IP を 総当たりで もどせて しまう）。 */
async function cleanup(env, now, withScores = false) {
  const stmts = [
    env.DB.prepare('DELETE FROM runs WHERE created_at < ?1').bind(now - LIMITS.runKeepMs),
    env.DB.prepare('DELETE FROM salts WHERE day < ?1').bind(jstDay(now - 3600000)),
    env.DB.prepare('DELETE FROM ip_players WHERE created_at < ?1').bind(now - LIMITS.runKeepMs),
    env.DB.prepare('DELETE FROM admin_fail WHERE at < ?1').bind(now - LIMITS.runKeepMs),
  ];
  // 「今週」と「先週」いがいの 週の 記録は もう 見せないので 消す
  if (withScores) {
    stmts.push(env.DB.prepare("DELETE FROM scores WHERE period <> 'all' AND period <> ?1 AND period <> ?2")
      .bind(isoWeekJST(now), isoWeekJST(now - 7 * 86400000)));
  }
  await env.DB.batch(stmts);
}

/* ===== ランキングの読み書き ===== */
// 並び：マスター → 到達レベル → 正解数 → 先に記録 →（最後の念のため）player_id
const ORDER = 'mastered DESC, level DESC, correct DESC, at ASC, player_id ASC';
const BETTER = `(mastered > ?2 OR (mastered = ?2 AND (level > ?3 OR (level = ?3 AND (correct > ?4 OR (correct = ?4 AND (at < ?5 OR (at = ?5 AND player_id < ?6))))))))`;
const rowOut = (r, rank) => ({ rank, name: r.name, level: r.level, mastered: !!r.mastered, correct: r.correct, total: r.total, at: r.at });

async function playerEntry(env, period, playerId) {
  const r = await env.DB.prepare('SELECT player_id, name, level, mastered, correct, total, at FROM scores WHERE player_id = ?1 AND period = ?2')
    .bind(playerId, period).first();
  if (!r) return null;
  const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE period = ?1 AND ${BETTER}`)
    .bind(period, r.mastered, r.level, r.correct, r.at, r.player_id).first();
  return rowOut(r, (c ? c.n : 0) + 1);
}

// 自己ベストのときだけ上書き。名前はいつも新しいものにする
function upsertBest(env, period, playerId, name, res, at) {
  const m = res.mastered ? 1 : 0;
  const better = `(excluded.mastered > scores.mastered OR (excluded.mastered = scores.mastered AND (excluded.level > scores.level OR (excluded.level = scores.level AND excluded.correct > scores.correct))))`;
  return env.DB.prepare(
    `INSERT INTO scores (player_id, period, name, level, mastered, correct, total, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT (player_id, period) DO UPDATE SET
       name = excluded.name,
       level    = CASE WHEN ${better} THEN excluded.level    ELSE scores.level    END,
       mastered = CASE WHEN ${better} THEN excluded.mastered ELSE scores.mastered END,
       correct  = CASE WHEN ${better} THEN excluded.correct  ELSE scores.correct  END,
       total    = CASE WHEN ${better} THEN excluded.total    ELSE scores.total    END,
       at       = CASE WHEN ${better} THEN excluded.at       ELSE scores.at       END`,
  ).bind(playerId, period, name, res.level, m, res.correct, res.total, at);
}

/* ===== API ===== */
async function createRun(request, env, ctx) {
  if (!sameOrigin(request)) return err(403, 'ほかの サイトからは つかえないよ');
  const now = Date.now();
  const { today, yesterday } = await ipHashes(env, request, now);
  const runId = crypto.randomUUID();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  // 数えるのと 入れるのを 1つの 文で（同時に たくさん 来ても 30回を こえない）
  const ins = await env.DB.prepare(
    `INSERT INTO runs (id, seed, created_at, ip_hash, used)
     SELECT ?1, ?2, ?3, ?4, 0
     WHERE (SELECT COUNT(*) FROM runs WHERE ip_hash IN (?4, ?5) AND created_at > ?6) < ?7`,
  ).bind(runId, seed, now, today, yesterday, now - 3600000, LIMITS.runsPerHour).run();
  if (!ins.meta || ins.meta.changes !== 1) {
    return err(429, 'チャレンジが 多すぎるよ。すこし 休んでから また やってね', { 'Retry-After': '600' });
  }
  const job = cleanup(env, now).catch(e => console.error('cleanup', e && e.message));
  if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
  return json({ runId, seed });
}

/* ランキングに のせて よいか（だめでも 採点した 結果は かえす）
 * - 先生が「もう のせない」に した 端末ID は のせない
 * - 1つの IP から 1日に 送った run が rankWritesPerDay を こえたら のせない
 * - 1つの IP から 1日に のせられる 端末ID は newPlayersPerDay 人まで
 *   （数えるのと 席を とるのを 1つの 文で。同時に たくさんの 端末ID で 送られても こえない）
 * 席が とれたら true。席は 記録を 書く 前に とる（書けなかったら run は もどるが 席は のこるので、送りなおせば のる） */
async function mayRank(env, ipHash, playerId, now) {
  const blocked = await env.DB.prepare('SELECT 1 AS b FROM blocked_players WHERE player_id = ?1').bind(playerId).first();
  if (blocked) return false;
  const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM runs WHERE ip_hash = ?1 AND used = 1 AND created_at > ?2')
    .bind(ipHash, now - LIMITS.runKeepMs).first();
  if ((used ? used.n : 0) > LIMITS.rankWritesPerDay) return false;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO ip_players (ip_hash, player_id, created_at)
     SELECT ?1, ?2, ?3
     WHERE (SELECT COUNT(*) FROM ip_players WHERE ip_hash = ?1) < ?4`,
  ).bind(ipHash, playerId, now, LIMITS.newPlayersPerDay).run();
  // 新しく とれた、または もう 席が ある
  const mine = await env.DB.prepare('SELECT 1 AS m FROM ip_players WHERE ip_hash = ?1 AND player_id = ?2').bind(ipHash, playerId).first();
  return !!mine;
}

async function submitScore(request, env) {
  if (!sameOrigin(request)) return err(403, 'ほかの サイトからは つかえないよ');
  const parsed = await readJson(request);
  if (parsed.error) return err(...parsed.error);
  const chk = checkScoreBody(parsed.body);
  if (!chk.ok) return err(400, chk.error);
  const { runId, playerId, name, answers, elapsedMs } = chk.value;

  const now = Date.now();
  const run = await env.DB.prepare('SELECT seed, created_at, used, ip_hash FROM runs WHERE id = ?1').bind(runId).first();
  if (!run) return err(404, 'その チャレンジは 見つからないよ');
  if (run.used) return err(409, 'この チャレンジは もう 送ってあるよ');
  if (now - run.created_at > LIMITS.runTtlMs) return err(410, '時間が たちすぎたよ（2時間まで）。もういちど チャレンジしてね');
  const minMs = answers.length * LIMITS.minMsPerAnswer;
  const took = Math.min(now - run.created_at, elapsedMs);
  if (took < minMs) {
    // run は 使わずに のこるので、すこし まって もういちど 送れば とおる
    return err(400, 'ちょっと はやすぎたみたい。すこし まってから もういちど おしてね',
      { 'Retry-After': String(Math.max(1, Math.ceil((minMs - took) / 1000))) });
  }

  // サーバーで 採点し直す（送られてきた レベルや 点数は つかわない）
  const res = simulate(Number(run.seed), answers);

  // 1回だけ：まだ 使っていない run だけを「使った」にする（同時に2回 送られても 1回しか 通らない）
  const claim = await env.DB.prepare('UPDATE runs SET used = 1 WHERE id = ?1 AND used = 0 AND created_at >= ?2')
    .bind(runId, now - LIMITS.runTtlMs).run();
  if (!claim.meta || claim.meta.changes !== 1) return err(409, 'この チャレンジは もう 送ってあるよ');

  const week = isoWeekJST(now);
  let ranked;
  try {
    ranked = await mayRank(env, run.ip_hash, playerId, now);
    if (ranked) {
      await env.DB.batch([
        upsertBest(env, 'all', playerId, name, res, now),
        upsertBest(env, week, playerId, name, res, now),
      ]);
    }
  } catch (e) {
    // 記録できなかったら「使った」を もどす（画面は もういちど 送れる）
    await env.DB.prepare('UPDATE runs SET used = 0 WHERE id = ?1').bind(runId).run().catch(() => {});
    throw e;
  }
  let bestAll = null, bestWeek = null;
  try {
    [bestAll, bestWeek] = await Promise.all([playerEntry(env, 'all', playerId), playerEntry(env, week, playerId)]);
  } catch (e) { console.error('rank read', e && e.message); }
  return json({
    level: res.level, mastered: res.mastered, correct: res.correct, total: res.total,
    rankAll: bestAll ? bestAll.rank : null, rankWeek: bestWeek ? bestWeek.rank : null,
    bestAll, bestWeek, week, ranked,
    newBestAll: ranked && !!bestAll && bestAll.at === now, newBestWeek: ranked && !!bestWeek && bestWeek.at === now,
  });
}

async function getRanking(url, env) {
  const p = url.searchParams.get('period') || 'all';
  if (p !== 'all' && p !== 'week') return err(400, 'period は all か week だよ');
  const player = url.searchParams.get('player') || '';
  if (player && !isUuid(player)) return err(400, '端末の 番号が ちがうよ');
  const week = isoWeekJST();
  const period = p === 'all' ? 'all' : week;
  const { results = [] } = await env.DB.prepare(
    `SELECT player_id, name, level, mastered, correct, total, at FROM scores WHERE period = ?1 ORDER BY ${ORDER} LIMIT ?2`,
  ).bind(period, LIMITS.topN).all();
  const pid = player.toLowerCase();
  const top = results.map((r, i) => {
    const o = rowOut(r, i + 1);
    if (pid && r.player_id === pid) o.isMe = true;
    return o;
  });
  const me = pid ? await playerEntry(env, period, pid) : null;
  return json({ period: p, week, top, me });
}

/* ===== 先生用 =====
 * キーが ない・短い（24文字 未満）ときは 404（あることも 見せない）。
 * まちがいは IP ごとに 1時間 10回まで（こえたら 429）。 */
let warnedShortKey = false;
async function adminAuth(request, env) {
  const key = env.ADMIN_KEY;
  if (typeof key !== 'string' || key.length < LIMITS.adminKeyMin) {
    if (typeof key === 'string' && key.length > 0 && !warnedShortKey) {
      warnedShortKey = true;
      console.warn(`ADMIN_KEY is shorter than ${LIMITS.adminKeyMin} characters; admin API is disabled`);
    }
    return err(404, '見つからないよ');
  }
  const now = Date.now();
  const { today } = await ipHashes(env, request, now);
  const fails = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fail WHERE ip_hash = ?1 AND at > ?2')
    .bind(today, now - 3600000).first();
  if ((fails ? fails.n : 0) >= LIMITS.adminFailsPerHour) return err(429, 'まちがいが 多すぎるよ。1時間 まってね', { 'Retry-After': '3600' });
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  const ok = await safeEqual(m ? m[1].trim() : '', key);
  if (!m || !ok) {
    await env.DB.prepare('INSERT INTO admin_fail (ip_hash, at) VALUES (?1, ?2)').bind(today, now).run();
    return err(401, 'キーが ちがうよ', { 'WWW-Authenticate': 'Bearer' });
  }
  return null;
}

// 上位 50 人、または 名前に name を ふくむ 人（「ぜんぶ」と「今週」の 両方から）を 端末ID つきで
async function adminList(request, url, env) {
  const denied = await adminAuth(request, env);
  if (denied) return denied;
  const p = url.searchParams.get('period') || 'all';
  if (p !== 'all' && p !== 'week') return err(400, 'period は all か week だよ');
  const week = isoWeekJST();
  const q = normalizeName(url.searchParams.get('name') || '');
  const cols = `s.player_id, s.period, s.name, s.level, s.mastered, s.correct, s.total, s.at,
    (SELECT COUNT(*) FROM scores b WHERE b.period = s.period AND (b.mastered > s.mastered OR (b.mastered = s.mastered AND (b.level > s.level
      OR (b.level = s.level AND (b.correct > s.correct OR (b.correct = s.correct AND (b.at < s.at OR (b.at = s.at AND b.player_id < s.player_id))))))))) + 1 AS rank,
    EXISTS (SELECT 1 FROM blocked_players k WHERE k.player_id = s.player_id) AS blocked`;
  const stmt = q
    ? env.DB.prepare(`SELECT ${cols} FROM scores s WHERE s.period IN ('all', ?1) AND instr(s.name, ?2) > 0 ORDER BY s.period = 'all' DESC, rank LIMIT ?3`)
      .bind(week, q, LIMITS.topN)
    : env.DB.prepare(`SELECT ${cols} FROM scores s WHERE s.period = ?1 ORDER BY ${ORDER} LIMIT ?2`)
      .bind(p === 'all' ? 'all' : week, LIMITS.topN);
  const { results = [] } = await stmt.all();
  return json({
    period: q ? null : p, week, name: q || null,
    rows: results.map(r => ({
      rank: r.rank, period: r.period === 'all' ? 'all' : 'week', playerId: r.player_id, name: r.name,
      level: r.level, mastered: !!r.mastered, correct: r.correct, total: r.total, at: r.at, blocked: !!r.blocked,
    })),
  });
}

async function adminDelete(request, url, env, playerId) {
  const denied = await adminAuth(request, env);
  if (denied) return denied;
  if (!isUuid(playerId)) return err(400, '端末の 番号が ちがうよ');
  const id = playerId.toLowerCase();
  const block = url.searchParams.get('block') === '1';
  const stmts = [env.DB.prepare('DELETE FROM scores WHERE player_id = ?1').bind(id)];
  if (block) stmts.push(env.DB.prepare('INSERT OR IGNORE INTO blocked_players (player_id, at) VALUES (?1, ?2)').bind(id, Date.now()));
  const [r] = await env.DB.batch(stmts);
  return json({ deleted: (r.meta && r.meta.changes) || 0, blocked: block });
}

async function adminUnblock(request, env, playerId) {
  const denied = await adminAuth(request, env);
  if (denied) return denied;
  if (!isUuid(playerId)) return err(400, '端末の 番号が ちがうよ');
  const r = await env.DB.prepare('DELETE FROM blocked_players WHERE player_id = ?1').bind(playerId.toLowerCase()).run();
  return json({ unblocked: (r.meta && r.meta.changes) || 0 });
}

export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  if (path === '/api/run') return method === 'POST' ? createRun(request, env, ctx) : methodNotAllowed('POST');
  if (path === '/api/score') return method === 'POST' ? submitScore(request, env) : methodNotAllowed('POST');
  if (path === '/api/ranking') return method === 'GET' ? getRanking(url, env) : methodNotAllowed('GET');
  if (path === '/api/admin/scores') return method === 'GET' ? adminList(request, url, env) : methodNotAllowed('GET');
  const adm = path.match(/^\/api\/admin\/(scores|blocks)\/([^/]+)$/);
  if (adm) {
    if (method !== 'DELETE') return methodNotAllowed('DELETE');
    let id;
    try { id = decodeURIComponent(adm[2]); } catch { return err(400, '端末の 番号が ちがうよ'); }
    return adm[1] === 'scores' ? adminDelete(request, url, env, id) : adminUnblock(request, env, id);
  }
  return err(404, '見つからないよ');
}

// 静的ファイル（見つからないときなど Worker を通ったもの）にも安全用のヘッダーをつける
async function serveAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEC_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, ctx);
      } catch (e) {
        console.error('api error', e && e.stack || e);
        return err(500, 'サーバーで こまったことが おきたよ。あとで もういちど ためしてね');
      }
    }
    return serveAsset(request, env);
  },
  // 毎日の そうじ（wrangler.jsonc の triggers.crons）
  async scheduled(controller, env, ctx) {
    const job = cleanup(env, (controller && controller.scheduledTime) || Date.now(), true);
    if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
  },
};
