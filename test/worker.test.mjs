// node --test test/
// ランキングの Worker（src/worker.js）の テスト。もとは 和音ききわけ（waon-kikiwake）の test/worker.test.mjs。
// D1 は node:sqlite で まねをして（Node.js 22.13 いじょう）、時計（Date.now）は 手で 進める。wrangler は いらない。
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker, { checkName, normalizeName, isoWeekJST, jstDay, ipKey, safeEqual, sha256Hex, isUuid, checkScoreBody, LIMITS } from '../src/worker.js';
import '../assets/ear-game.js';

const { mulberry32, newChallenge, nextType, applyAnswer, simulate, TYPE_IDS, LEVELS, compareResults } = globalThis.EarGame;
const here = p => fileURLToPath(new URL(p, import.meta.url));

// node:sqlite が ない Node.js（22.13 より 前）では D1 を つかう テストを とばす
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* とばす */ }
const test = (name, fn) => nodeTest(name, { skip: DatabaseSync ? false : 'node:sqlite が ない（Node.js 22.13 いじょうで うごく）' }, fn);

/* ===== D1 のまね（prepare/bind/first/all/run/batch） ===== */
class Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...p) { return new Stmt(this.db, this.sql, p); }
  async first() { return this.db.prepare(this.sql).get(...this.params) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params), success: true, meta: {} }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: Number(r.changes) } }; }
  runSync() { const r = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: Number(r.changes) } }; }
}
function makeEnv(extra = {}) {
  const db = new DatabaseSync(':memory:');
  for (const m of readdirSync(here('../migrations')).filter(x => x.endsWith('.sql')).sort()) db.exec(readFileSync(here('../migrations/' + m), 'utf8'));
  const DB = {
    prepare: sql => new Stmt(db, sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map(s => s.runSync()); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  const ASSETS = { fetch: async () => new Response('<!doctype html>asset', { status: 200, headers: { 'Content-Type': 'text/html' } }) };
  return { env: { DB, ASSETS, ...extra }, db };
}

/* ===== 時計 ===== */
const realNow = Date.now;
let clock = Date.UTC(2026, 9, 28, 3, 0); // 2026-10-28（水）12:00 JST
Date.now = () => clock;
nodeTest.after(() => { Date.now = realNow; });
const tick = ms => { clock += ms; };

/* ===== リクエスト ===== */
const BASE = 'https://piano.example';
const ctx = { waitUntil: p => p };
async function call(env, method, path, { body, headers = {}, ip = '203.0.113.7', raw } = {}) {
  const h = { 'CF-Connecting-IP': ip, ...headers };
  let b;
  if (raw !== undefined) b = raw;
  else if (body !== undefined) { b = JSON.stringify(body); h['Content-Type'] ??= 'application/json'; }
  const init = { method, headers: h, body: b };
  if (b instanceof ReadableStream) init.duplex = 'half';
  const res = await worker.fetch(new Request(BASE + path, init), env, ctx);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
const newRun = (env, ip) => call(env, 'POST', '/api/run', { ip });
const pid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* seed から 答えの列を作る（policy(i, type, level) → 答え） */
function play(seed, policy, max = 600) {
  const rng = mulberry32(seed), st = newChallenge(), answers = [];
  for (let i = 0; i < max && !st.over; i++) {
    const t = nextType(st, rng), a = policy(i, t, st.level);
    answers.push(a);
    applyAnswer(st, t, a);
  }
  return answers;
}
const wrongOf = t => (t === 'maj' ? 'dim7' : 'maj');
// k 問目まで正解、そのあと全部まちがい
const rightThenWrong = k => (i, t) => (i < k ? t : wrongOf(t));

async function submit(env, { runId, playerId = pid(1), name = 'たろう', answers, elapsedMs, ...rest }) {
  return call(env, 'POST', '/api/score', {
    body: { runId, playerId, name, answers, elapsedMs: elapsedMs ?? answers.length * 1000, ...rest },
  });
}
// run を作って、ちょうどよい時間を待ってから送る
async function playAndSubmit(env, policy, opts = {}) {
  const r = await newRun(env, opts.ip);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const answers = play(r.data.seed, policy);
  tick(answers.length * 1000);
  const s = await submit(env, { runId: r.data.runId, answers, ...opts });
  return { run: r.data, answers, res: s };
}

/* ===== 名前（くわしい テストは test/ear-game.test.mjs。ここでは サーバーが 画面と おなじ きまりを つかうか） ===== */
nodeTest('checkName・normalizeName：assets/ear-game.js と おなじ', () => {
  const EG = globalThis.EarGame;
  for (const s of ['たろう', 'ｼﾝﾃﾞﾚﾗ', 'ばか', 'test@example.com', 'あいうえおかきくけこさしす', 'おどる ペンギン', '山田先生', 'sh1t', '', null]) {
    assert.deepEqual(checkName(s), EG.checkName(s), String(s));
  }
  assert.equal(normalizeName('ＡＢＣ　ｄ'), 'ABC d');
  assert.equal(LIMITS.nameMax, 12);
});

/* ===== 日付・道具 ===== */
nodeTest('isoWeekJST：日本時間の 月曜 0時で 週が かわる', () => {
  assert.equal(isoWeekJST(Date.UTC(2026, 9, 29, 3)), '2026-W44');
  assert.equal(isoWeekJST(Date.UTC(2026, 9, 25, 14, 59, 59)), '2026-W43'); // 10/25（日）23:59:59 JST
  assert.equal(isoWeekJST(Date.UTC(2026, 9, 25, 15, 0, 0)), '2026-W44');   // 10/26（月）0:00 JST
  assert.equal(isoWeekJST(Date.UTC(2020, 11, 31, 15)), '2020-W53');       // 2021-01-01 JST
  assert.equal(isoWeekJST(Date.UTC(2026, 11, 31, 15)), '2026-W53');       // 2027-01-01（金）JST
  assert.equal(isoWeekJST(Date.UTC(2027, 0, 3, 15)), '2027-W01');         // 2027-01-04（月）JST
  assert.equal(isoWeekJST(Date.UTC(2025, 11, 28, 15)), '2026-W01');       // 2025-12-29（月）JST
  assert.equal(jstDay(Date.UTC(2026, 9, 28, 15)), '2026-10-29');
});
nodeTest('ipKey・safeEqual・sha256Hex・isUuid', async () => {
  assert.equal(ipKey('203.0.113.7'), '203.0.113.7');
  assert.equal(ipKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(ipKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(ipKey('2001:db8:0:0:ffff::9'), ipKey('2001:0db8:0000:0000:1::'));
  assert.equal(ipKey(''), 'unknown');
  assert.equal(await safeEqual('abc', 'abc'), true);
  assert.equal(await safeEqual('abc', 'abd'), false);
  assert.equal(await safeEqual('', 'abc'), false);
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(isUuid(pid(1)), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid(pid(1) + 'x'), false);
});
nodeTest('checkScoreBody：形のチェック', () => {
  const ok = { runId: pid(9), playerId: pid(1), name: 'たろう', answers: ['maj'], elapsedMs: 1000 };
  assert.equal(checkScoreBody(ok).ok, true);
  assert.equal(checkScoreBody({ ...ok, playerId: pid(1).toUpperCase() }).value.playerId, pid(1));
  for (const bad of [
    null, [], 'x', {}, { ...ok, runId: 'x' }, { ...ok, playerId: 'abc' }, { ...ok, answers: [] }, { ...ok, answers: 'maj' },
    { ...ok, answers: ['maj', 'xxx'] }, { ...ok, answers: ['maj', 7] }, { ...ok, answers: ['__proto__'] }, { ...ok, answers: ['toString'] },
    { ...ok, answers: Array(LIMITS.maxAnswers + 1).fill('maj') }, { ...ok, elapsedMs: '1000' }, { ...ok, elapsedMs: -1 },
    { ...ok, elapsedMs: Infinity }, { ...ok, elapsedMs: NaN }, { ...ok, name: 'ばか' }, { ...ok, name: '' },
  ]) assert.equal(checkScoreBody(bad).ok, false, JSON.stringify(bad)?.slice(0, 80));
});

/* ===== API ===== */
test('POST /api/run：runId と seed、IP は ハッシュだけ 保存', async () => {
  const { env, db } = makeEnv();
  const r = await newRun(env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.match(r.headers.get('Content-Type'), /application\/json/);
  assert.ok(isUuid(r.data.runId));
  assert.ok(Number.isInteger(r.data.seed) && r.data.seed >= 0 && r.data.seed <= 0xffffffff);
  const row = db.prepare('SELECT * FROM runs').get();
  assert.equal(row.id, r.data.runId);
  assert.equal(row.seed, r.data.seed);
  assert.equal(row.used, 0);
  assert.match(row.ip_hash, /^[0-9a-f]{64}$/);
  const dump = JSON.stringify(db.prepare('SELECT * FROM runs').all()) + JSON.stringify(db.prepare('SELECT * FROM salts').all());
  assert.ok(!dump.includes('203.0.113.7'), 'IP そのものは 保存しない');
  assert.equal((await call(env, 'GET', '/api/run')).status, 405);
});

test('POST /api/score：サーバーで 採点し直して 記録する', async () => {
  const { env } = makeEnv();
  const { run, answers, res } = await playAndSubmit(env, rightThenWrong(12), { name: 'おどる ペンギン', level: 9, mastered: true, correct: 999 });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const exp = simulate(run.seed, answers);
  assert.equal(res.data.level, exp.level);
  assert.equal(res.data.level, 3); // 12問 正解 → L3（10問で L3 へ）
  assert.equal(res.data.correct, 12);
  assert.equal(res.data.total, exp.total);
  assert.equal(res.data.mastered, false);
  assert.equal(res.data.rankAll, 1);
  assert.equal(res.data.rankWeek, 1);
  assert.equal(res.data.week, '2026-W44');
  assert.deepEqual(
    { name: res.data.bestAll.name, level: res.data.bestAll.level, correct: res.data.bestAll.correct, mastered: res.data.bestAll.mastered },
    { name: 'おどる ペンギン', level: 3, correct: 12, mastered: false },
  );
  assert.equal(res.data.newBestAll, true);
});

test('不正：同じ run を 2回 送る・同時に 送る', async () => {
  const { env } = makeEnv();
  const { run, answers, res } = await playAndSubmit(env, rightThenWrong(3));
  assert.equal(res.status, 200);
  const again = await submit(env, { runId: run.runId, answers });
  assert.equal(again.status, 409);
  assert.ok(again.data.error);

  const r2 = (await newRun(env)).data;
  const a2 = play(r2.seed, rightThenWrong(4));
  tick(a2.length * 1000);
  const both = await Promise.all([submit(env, { runId: r2.runId, answers: a2 }), submit(env, { runId: r2.runId, answers: a2 })]);
  assert.deepEqual(both.map(x => x.status).sort(), [200, 409]);
});

test('不正：はやすぎる・古すぎる・ない run', async () => {
  const { env } = makeEnv();
  const r = (await newRun(env)).data;
  const answers = play(r.seed, rightThenWrong(20));
  tick(answers.length * LIMITS.minMsPerAnswer - 1);
  let s = await submit(env, { runId: r.runId, answers, elapsedMs: answers.length * 900 });
  assert.equal(s.status, 400, 'サーバーの時計で はやすぎる');
  assert.match(s.data.error, /もういちど/);
  assert.equal(s.headers.get('Retry-After'), '1');
  tick(1);
  s = await submit(env, { runId: r.runId, answers, elapsedMs: answers.length * 100 });
  assert.equal(s.status, 400, '送られた 時間が はやすぎる');
  s = await submit(env, { runId: r.runId, answers, elapsedMs: answers.length * 800 });
  assert.equal(s.status, 200, 'ちょうど 0.8秒ずつなら OK（はやすぎで 弾いても run は 使えるまま）');

  const old = (await newRun(env)).data;
  tick(LIMITS.runTtlMs + 1);
  s = await submit(env, { runId: old.runId, answers: ['maj'] });
  assert.equal(s.status, 410);
  // 画面を 2時間 いじょう ひらいていると elapsedMs も 大きい：それでも「時間ぎれ」（410）を かえす
  tick(10 * 60000);
  s = await submit(env, { runId: old.runId, answers: ['maj'], elapsedMs: LIMITS.runTtlMs + 11 * 60000 });
  assert.equal(s.status, 410, '大きい elapsedMs でも 400 ではなく 410');
  assert.match(s.data.error, /時間/);
  // 時間内の run で elapsedMs が 大きすぎても、サーバーの 時計で はかるので とおる
  const fresh = (await newRun(env)).data;
  const fa = play(fresh.seed, rightThenWrong(3));
  tick(fa.length * 1000);
  s = await submit(env, { runId: fresh.runId, answers: fa, elapsedMs: 10 * LIMITS.runTtlMs });
  assert.equal(s.status, 200, JSON.stringify(s.data));

  s = await submit(env, { runId: pid(777), answers: ['maj'] });
  assert.equal(s.status, 404);
});

test('不正：レベルを いつわっても サーバーの 採点だけが のこる', async () => {
  const { env, db } = makeEnv();
  const r = (await newRun(env)).data;
  // seed とは 関係なく 「ぜんぶ maj」と 送る → まちがいが あれば その分だけ
  const answers = Array(40).fill('maj');
  tick(60000);
  const s = await submit(env, { runId: r.runId, answers, level: 8, mastered: true, correct: 40, total: 40 });
  assert.equal(s.status, 200);
  const exp = simulate(r.seed, answers);
  assert.equal(s.data.level, exp.level);
  assert.equal(s.data.correct, exp.correct);
  assert.equal(s.data.total, exp.total);
  assert.ok(exp.total < 40, 'ライフ 0 の あとの 答えは むし');
  const row = db.prepare("SELECT * FROM scores WHERE period = 'all'").get();
  assert.equal(row.level, exp.level);
  assert.equal(row.correct, exp.correct);
});

test('マスター：40問 正解で マスター、マスターは どの L8 より 上', async () => {
  const { env } = makeEnv();
  const a = await playAndSubmit(env, rightThenWrong(40), { playerId: pid(1), name: 'マスター' });
  assert.equal(a.res.status, 200);
  assert.equal(a.res.data.mastered, true);
  assert.equal(a.res.data.level, 8);
  const b = await playAndSubmit(env, rightThenWrong(39), { playerId: pid(2), name: 'えいと' }); // L8 で 4問 正解（35問で L8）
  assert.equal(b.res.data.level, 8);
  assert.equal(b.res.data.mastered, false);
  assert.equal(b.res.data.rankAll, 2);
  const rk = await call(env, 'GET', '/api/ranking?period=all');
  assert.deepEqual(rk.data.top.map(x => x.name), ['マスター', 'えいと']);
  assert.equal(rk.data.top[0].mastered, true);
});

test('ランキング：並び・自己ベスト・今週と ぜんぶ・me', async () => {
  const { env } = makeEnv();
  // p1：L3・12問  p2：L3・13問（p1 より上） p3：L2・9問  p4：L3・12問（p1 と同じ。あとから なので 下）
  await playAndSubmit(env, rightThenWrong(12), { playerId: pid(1), name: 'いち' });
  await playAndSubmit(env, rightThenWrong(13), { playerId: pid(2), name: 'に' });
  await playAndSubmit(env, rightThenWrong(9), { playerId: pid(3), name: 'さん' });
  await playAndSubmit(env, rightThenWrong(12), { playerId: pid(4), name: 'よん' });
  let rk = await call(env, 'GET', `/api/ranking?period=all&player=${pid(4)}`);
  assert.equal(rk.status, 200);
  assert.equal(rk.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(rk.data.top.map(x => [x.rank, x.name, x.level, x.correct]), [[1, 'に', 3, 13], [2, 'いち', 3, 12], [3, 'よん', 3, 12], [4, 'さん', 2, 9]]);
  assert.equal(rk.data.me.rank, 3);
  assert.equal(rk.data.me.name, 'よん');
  assert.equal(rk.data.top[2].isMe, true);
  assert.equal(rk.data.top.filter(x => x.isMe).length, 1);
  assert.ok(!('player_id' in rk.data.top[0]) && !JSON.stringify(rk.data).includes(pid(2)), '他人の 端末ID は 出さない');
  // compareResults と 同じ 並び
  const sorted = [...rk.data.top].sort(compareResults).map(x => x.name);
  assert.deepEqual(sorted, rk.data.top.map(x => x.name));

  // わるい記録は 自己ベストを 上書きしない（名前は 新しく なる）
  const worse = await playAndSubmit(env, rightThenWrong(2), { playerId: pid(1), name: 'いちばん' });
  assert.equal(worse.res.data.level, 1);
  assert.equal(worse.res.data.bestAll.level, 3);
  assert.equal(worse.res.data.bestAll.correct, 12);
  assert.equal(worse.res.data.bestAll.name, 'いちばん');
  assert.equal(worse.res.data.newBestAll, false);
  assert.equal(worse.res.data.rankAll, 2);

  // 次の週：今週は からっぽ、ぜんぶ は のこる
  tick(7 * 86400000);
  rk = await call(env, 'GET', `/api/ranking?period=week&player=${pid(1)}`);
  assert.equal(rk.data.period, 'week');
  assert.equal(rk.data.week, '2026-W45');
  assert.deepEqual(rk.data.top, []);
  assert.equal(rk.data.me, null);
  const nw = await playAndSubmit(env, rightThenWrong(5), { playerId: pid(3), name: 'さん' });
  assert.equal(nw.res.data.rankWeek, 1);
  assert.equal(nw.res.data.rankAll, 4);
  rk = await call(env, 'GET', '/api/ranking?period=week');
  assert.deepEqual(rk.data.top.map(x => x.name), ['さん']);
  assert.equal(rk.data.me, null);
  rk = await call(env, 'GET', '/api/ranking');
  assert.equal(rk.data.period, 'all');
  assert.equal(rk.data.top.length, 4);

  // よりよい記録は 上書き
  const better = await playAndSubmit(env, rightThenWrong(20), { playerId: pid(3), name: 'さん' });
  assert.equal(better.res.data.rankAll, 1);
  assert.equal(better.res.data.newBestAll, true);

  assert.equal((await call(env, 'GET', '/api/ranking?period=month')).status, 400);
  assert.equal((await call(env, 'GET', '/api/ranking?player=xyz')).status, 400);
  assert.equal((await call(env, 'POST', '/api/ranking')).status, 405);
});

test('ランキング：上位 50 人まで', async () => {
  const { env, db } = makeEnv();
  const ins = db.prepare('INSERT INTO scores VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (let i = 1; i <= 60; i++) { const m = i % 13 === 0; ins.run(pid(i), 'all', 'p' + i, m ? 8 : 1 + (i % 8), m ? 1 : 0, i % 20, i + 30, 1000 - i); } // マスターなら level は 8
  const rk = await call(env, 'GET', `/api/ranking?period=all&player=${pid(1)}`);
  assert.equal(rk.data.top.length, 50);
  const all = db.prepare("SELECT * FROM scores WHERE period='all'").all()
    .map(r => ({ name: r.name, level: r.level, mastered: !!r.mastered, correct: r.correct, at: r.at })).sort(compareResults);
  assert.deepEqual(rk.data.top.map(x => x.name), all.slice(0, 50).map(x => x.name));
  assert.equal(rk.data.me.rank, all.findIndex(x => x.name === 'p1') + 1);
  assert.ok(rk.data.me.rank > 50);
});

test('不正：本文の 形・大きさ・種類', async () => {
  const { env } = makeEnv();
  const r = (await newRun(env)).data;
  tick(10000);
  const okBody = { runId: r.runId, playerId: pid(1), name: 'たろう', answers: ['maj'], elapsedMs: 5000 };
  const cases = [
    [{ raw: '{bad json', headers: { 'Content-Type': 'application/json' } }, 400],
    [{ raw: JSON.stringify(okBody), headers: { 'Content-Type': 'text/plain' } }, 415],
    [{ raw: JSON.stringify({ ...okBody, pad: 'x'.repeat(20000) }), headers: { 'Content-Type': 'application/json' } }, 413],
    [{ body: [] }, 400],
    [{ body: { ...okBody, answers: ['maj', 'xx'] } }, 400],
    [{ body: { ...okBody, answers: Array(601).fill('maj') } }, 400],
    [{ body: { ...okBody, playerId: '1234' } }, 400],
    [{ body: { ...okBody, name: 'ばか' } }, 400],
    [{ body: { ...okBody, name: 'mail@example.com' } }, 400],
    [{ body: { ...okBody, name: 'あいうえおかきくけこさしす' } }, 400],
    [{ body: okBody, headers: { Origin: 'https://evil.example' } }, 403],
  ];
  for (const [opt, status] of cases) {
    const s = await call(env, 'POST', '/api/score', opt);
    assert.equal(s.status, status, JSON.stringify(opt).slice(0, 100));
    assert.equal(typeof s.data.error, 'string');
  }
  // 弾いた あとでも run は まだ 使える
  const s = await call(env, 'POST', '/api/score', { body: okBody, headers: { Origin: BASE } });
  assert.equal(s.status, 200);
});

test('回数制限：1つの IP から 1時間に 30回まで', async () => {
  const { env } = makeEnv();
  for (let i = 0; i < LIMITS.runsPerHour; i++) assert.equal((await newRun(env, '198.51.100.1')).status, 200, `run ${i + 1}`);
  const over = await newRun(env, '198.51.100.1');
  assert.equal(over.status, 429);
  assert.ok(over.headers.get('Retry-After'));
  assert.equal((await newRun(env, '198.51.100.2')).status, 200, 'べつの IP は だいじょうぶ');
  assert.equal((await newRun(env, '2001:db8:1:2::5')).status, 200);
  tick(3600 * 1000 + 1);
  assert.equal((await newRun(env, '198.51.100.1')).status, 200, '1時間 たてば また 作れる');
  // 同じ日なら 同じ塩、日が かわると ちがう塩
  const { env: env2, db } = makeEnv();
  await newRun(env2, '198.51.100.9');
  await newRun(env2, '198.51.100.9');
  tick(86400000);
  await newRun(env2, '198.51.100.9');
  const hs = db.prepare('SELECT ip_hash FROM runs ORDER BY created_at').all().map(x => x.ip_hash);
  assert.equal(hs[0], hs[1]);
  assert.notEqual(hs[1], hs[2]);
});

test('回数制限：同時に たくさん 作っても 30回まで', async () => {
  const { env, db } = makeEnv();
  const res = await Promise.all(Array.from({ length: 60 }, () => newRun(env, '198.51.100.50')));
  assert.equal(res.filter(r => r.status === 200).length, LIMITS.runsPerHour);
  assert.equal(res.filter(r => r.status === 429).length, 60 - LIMITS.runsPerHour);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM runs').get().n, LIMITS.runsPerHour);
});

test('回数制限：日本時間 0時を またいでも 1時間は 数えつづける', async () => {
  const { env, db } = makeEnv();
  const save = clock;
  clock = Date.UTC(2026, 9, 28, 14, 50); // 23:50 JST
  for (let i = 0; i < LIMITS.runsPerHour; i++) assert.equal((await newRun(env, '198.51.100.60')).status, 200);
  tick(20 * 60000); // 0:10 JST
  assert.equal((await newRun(env, '198.51.100.60')).status, 429, '0時で 数えなおしに ならない');
  assert.equal((await newRun(env, '198.51.100.61')).status, 200);
  tick(60 * 60000); // 1:10 JST：きのうの 塩は 消える
  assert.equal((await newRun(env, '198.51.100.60')).status, 200);
  assert.deepEqual(db.prepare('SELECT day FROM salts').all().map(x => x.day), ['2026-10-29']);
  clock = save;
});

test('ランキングを まもる：1つの IP から 1日に のせられる 人数と 回数', async () => {
  const { env, db } = makeEnv();
  for (let i = 1; i <= LIMITS.newPlayersPerDay; i++) {
    const { res } = await playAndSubmit(env, rightThenWrong(5), { playerId: pid(i), name: 'ひと' + i, ip: '198.51.100.70' });
    assert.equal(res.data.ranked, true, `player ${i}`);
  }
  const over = await playAndSubmit(env, rightThenWrong(5), { playerId: pid(99), name: 'ひとおおい', ip: '198.51.100.70' });
  assert.equal(over.res.status, 200, '採点は する');
  assert.equal(over.res.data.ranked, false);
  assert.equal(over.res.data.rankAll, null);
  assert.equal(over.res.data.level, simulate(over.run.seed, over.answers).level);
  const again = await playAndSubmit(env, rightThenWrong(6), { playerId: pid(1), name: 'ひと1', ip: '198.51.100.70' });
  assert.equal(again.res.data.ranked, true, 'もう のった 人は だいじょうぶ');
  assert.equal((await playAndSubmit(env, rightThenWrong(5), { playerId: pid(99), name: 'べつの IP', ip: '198.51.100.71' })).res.data.ranked, true);
  // 1日に 送った run が 多すぎる IP
  const hash = db.prepare("SELECT ip_hash FROM runs WHERE id = ?").get(again.run.runId).ip_hash;
  const ins = db.prepare('INSERT INTO runs (id, seed, created_at, ip_hash, used) VALUES (?, 1, ?, ?, 1)');
  for (let i = 0; i < LIMITS.rankWritesPerDay; i++) ins.run(`fake-${i}`, clock - 2 * 3600000, hash); // 1時間より 前（run の 回数制限には 入らない）
  const busy = await playAndSubmit(env, rightThenWrong(30), { playerId: pid(1), name: 'ひと1', ip: '198.51.100.70' });
  assert.equal(busy.res.data.ranked, false);
  assert.equal(busy.res.data.rankAll, 1, 'じぶんの いまの 順位は かえす');
  assert.equal(busy.res.data.newBestAll, false);
  assert.equal(db.prepare("SELECT correct FROM scores WHERE player_id = ? AND period = 'all'").get(pid(1)).correct, 6, '書きかえない');
});

test('ランキングを まもる：同時に たくさんの 端末ID で 送っても 1日 8人まで', async () => {
  const { env, db } = makeEnv();
  const ip = '198.51.100.72', n = LIMITS.newPlayersPerDay + 4;
  const runs = [];
  for (let i = 0; i < n; i++) runs.push((await newRun(env, ip)).data);
  const plays = runs.map(r => play(r.seed, rightThenWrong(5)));
  tick(Math.max(...plays.map(a => a.length)) * 1000);
  const res = await Promise.all(runs.map((r, i) => submit(env, { runId: r.runId, answers: plays[i], playerId: pid(500 + i), name: 'どうじ' + i })));
  assert.deepEqual(res.map(s => s.status), Array(n).fill(200), '採点は ぜんぶ する');
  assert.equal(res.filter(s => s.data.ranked).length, LIMITS.newPlayersPerDay);
  for (const s of res) {
    if (s.data.ranked) assert.equal(typeof s.data.rankAll, 'number');
    else { assert.equal(s.data.rankAll, null); assert.equal(s.data.bestAll, null); }
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ip_players').get().n, LIMITS.newPlayersPerDay);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM scores WHERE period = 'all'").get().n, LIMITS.newPlayersPerDay);
  // のった 人は 同時に 2回 送っても だいじょうぶ（席は ふえない）
  const ok = res.findIndex(s => s.data.ranked);
  const two = [];
  for (let k = 0; k < 2; k++) two.push((await newRun(env, ip)).data);
  const a2 = two.map(r => play(r.seed, rightThenWrong(6)));
  tick(Math.max(...a2.map(a => a.length)) * 1000);
  const again = await Promise.all(two.map((r, k) => submit(env, { runId: r.runId, answers: a2[k], playerId: pid(500 + ok), name: 'どうじ' + ok })));
  assert.deepEqual(again.map(s => s.data.ranked), [true, true]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ip_players').get().n, LIMITS.newPlayersPerDay);
});

test('記録に しっぱい したら run を もどす（もういちど 送れる）', async () => {
  const { env } = makeEnv();
  const r = (await newRun(env)).data;
  const answers = play(r.seed, rightThenWrong(4));
  tick(answers.length * 1000);
  const realBatch = env.DB.batch;
  env.DB.batch = async () => { throw new Error('D1 is busy'); };
  const origErr = console.error; console.error = () => {};
  const fail = await submit(env, { runId: r.runId, answers });
  console.error = origErr;
  env.DB.batch = realBatch;
  assert.equal(fail.status, 500);
  const ok = await submit(env, { runId: r.runId, answers });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.correct, 4);
});

test('本文：Content-Length の ない 大きな 本文は とちゅうで やめる', async () => {
  const { env } = makeEnv();
  let pulled = 0;
  const chunk = new Uint8Array(64 * 1024).fill(0x20);
  const stream = new ReadableStream({ pull(c) { pulled++; if (pulled > 1000) c.close(); else c.enqueue(chunk); } });
  const s = await call(env, 'POST', '/api/score', { raw: stream, headers: { 'Content-Type': 'application/json' } });
  assert.equal(s.status, 413);
  assert.ok(pulled < 10, `読んだのは ${pulled} かたまり だけ`);
});

test('そうじ：scheduled で 古い run・塩・週の 記録を 消す', async () => {
  const { env, db } = makeEnv();
  await playAndSubmit(env, rightThenWrong(5), { playerId: pid(1) });
  const thisWeek = isoWeekJST(clock), lastWeek = isoWeekJST(clock - 7 * 86400000);
  db.prepare("INSERT INTO scores VALUES (?, ?, 'むかし', 1, 0, 1, 1, 1)").run(pid(2), isoWeekJST(clock - 21 * 86400000));
  db.prepare("INSERT INTO scores VALUES (?, ?, 'せんしゅう', 1, 0, 1, 1, 1)").run(pid(3), lastWeek);
  db.prepare("INSERT INTO salts VALUES ('2026-01-20', 'old')").run();
  tick(LIMITS.runKeepMs + 1);
  if (isoWeekJST(clock) !== thisWeek) tick(-(LIMITS.runKeepMs + 1) + 3600000 * 2); // 週を またがない ように
  await worker.scheduled({ scheduledTime: Date.now() }, env, ctx);
  assert.ok(!db.prepare('SELECT day FROM salts').all().some(x => x.day === '2026-01-20'), '古い 塩は 消える');
  assert.deepEqual(db.prepare('SELECT period FROM scores').all().map(x => x.period).sort(), [lastWeek, thisWeek, 'all'].sort());
  // 1日 たてば run と ip_players も 消える
  tick(LIMITS.runKeepMs + 1);
  await worker.scheduled({ scheduledTime: Date.now() }, env, ctx);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM runs').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ip_players').get().n, 0);
  assert.deepEqual(db.prepare('SELECT day FROM salts').all(), []);
});

test('先生用の 削除：ADMIN_KEY', async () => {
  const noKey = makeEnv().env;
  assert.equal((await call(noKey, 'DELETE', `/api/admin/scores/${pid(1)}`, { headers: { Authorization: 'Bearer x' } })).status, 404);
  const shortKey = makeEnv({ ADMIN_KEY: 'piano2026' }).env;
  const origWarn = console.warn; console.warn = () => {};
  assert.equal((await call(shortKey, 'DELETE', `/api/admin/scores/${pid(1)}`, { headers: { Authorization: 'Bearer piano2026' } })).status, 404, '短い キーは つかえない');
  console.warn = origWarn;

  const { env, db } = makeEnv({ ADMIN_KEY: 'test-admin-key-0123456789' });
  await playAndSubmit(env, rightThenWrong(6), { playerId: pid(1), name: 'けす' });
  await playAndSubmit(env, rightThenWrong(6), { playerId: pid(2), name: 'のこす' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scores').get().n, 4);
  const path = `/api/admin/scores/${pid(1)}`;
  assert.equal((await call(env, 'DELETE', path)).status, 401);
  assert.equal((await call(env, 'DELETE', path, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await call(env, 'DELETE', path, { headers: { Authorization: 'test-admin-key-0123456789' } })).status, 401);
  assert.equal((await call(env, 'GET', path, { headers: { Authorization: 'Bearer test-admin-key-0123456789' } })).status, 405);
  assert.equal((await call(env, 'DELETE', '/api/admin/scores/zzz', { headers: { Authorization: 'Bearer test-admin-key-0123456789' } })).status, 400);
  const d = await call(env, 'DELETE', path, { headers: { Authorization: 'Bearer test-admin-key-0123456789' } });
  assert.equal(d.status, 200);
  assert.equal(d.data.deleted, 2, '「ぜんぶ」と「今週」の 両方');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scores WHERE player_id = ?').get(pid(1)).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scores').get().n, 2);
  const rk = await call(env, 'GET', '/api/ranking?period=week');
  assert.deepEqual(rk.data.top.map(x => x.name), ['のこす']);
});

const KEY = 'test-admin-key-0123456789';
const auth = { Authorization: `Bearer ${KEY}` };
test('先生用：端末ID つきの 一覧・名前で さがす・もう のせない', async () => {
  const { env } = makeEnv({ ADMIN_KEY: KEY });
  await playAndSubmit(env, rightThenWrong(8), { playerId: pid(1), name: 'わるい なまえ' });
  await playAndSubmit(env, rightThenWrong(6), { playerId: pid(2), name: 'よい こ' });
  assert.equal((await call(env, 'GET', '/api/admin/scores')).status, 401);
  assert.equal((await call(env, 'POST', '/api/admin/scores', { headers: auth })).status, 405);
  let l = await call(env, 'GET', '/api/admin/scores?period=all', { headers: auth });
  assert.equal(l.status, 200);
  assert.deepEqual(l.data.rows.map(r => [r.rank, r.playerId, r.name]), [[1, pid(1), 'わるい なまえ'], [2, pid(2), 'よい こ']]);
  l = await call(env, 'GET', `/api/admin/scores?name=${encodeURIComponent('わるい')}`, { headers: auth });
  assert.deepEqual(l.data.rows.map(r => [r.period, r.rank, r.playerId]), [['all', 1, pid(1)], ['week', 1, pid(1)]]);
  l = await call(env, 'GET', `/api/admin/scores?name=${encodeURIComponent('よい　こ')}`, { headers: auth });
  assert.deepEqual(l.data.rows.map(r => [r.period, r.rank]), [['all', 2], ['week', 2]], '名前は そろえてから さがす');
  // 消して「もう のせない」
  const d = await call(env, 'DELETE', `/api/admin/scores/${pid(1)}?block=1`, { headers: auth });
  assert.deepEqual(d.data, { deleted: 2, blocked: true });
  const again = await playAndSubmit(env, rightThenWrong(9), { playerId: pid(1), name: 'わるい なまえ' });
  assert.equal(again.res.status, 200);
  assert.equal(again.res.data.ranked, false);
  assert.deepEqual((await call(env, 'GET', '/api/ranking')).data.top.map(x => x.name), ['よい こ']);
  // とりけす
  assert.equal((await call(env, 'DELETE', `/api/admin/blocks/${pid(1)}`)).status, 401);
  assert.deepEqual((await call(env, 'DELETE', `/api/admin/blocks/${pid(1)}`, { headers: auth })).data, { unblocked: 1 });
  assert.equal((await playAndSubmit(env, rightThenWrong(9), { playerId: pid(1), name: 'なおした' })).res.data.ranked, true);
});

test('先生用：キーの まちがいは 1時間に 10回まで', async () => {
  const { env } = makeEnv({ ADMIN_KEY: KEY });
  for (let i = 0; i < LIMITS.adminFailsPerHour; i++) {
    assert.equal((await call(env, 'GET', '/api/admin/scores', { headers: { Authorization: 'Bearer guess' + i }, ip: '198.51.100.80' })).status, 401);
  }
  assert.equal((await call(env, 'GET', '/api/admin/scores', { headers: auth, ip: '198.51.100.80' })).status, 429, '正しい キーでも まつ');
  assert.equal((await call(env, 'GET', '/api/admin/scores', { headers: auth, ip: '198.51.100.81' })).status, 200, 'べつの IP');
  tick(3600 * 1000 + 1);
  assert.equal((await call(env, 'GET', '/api/admin/scores', { headers: auth, ip: '198.51.100.80' })).status, 200);
});

test('静的ファイルと 知らない API', async () => {
  const { env } = makeEnv();
  const a = await call(env, 'GET', '/index.html');
  assert.equal(a.status, 200);
  assert.equal(a.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(a.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.ok(!/microphone/.test(a.headers.get('Permissions-Policy')), 'マイク（assets/mic.js）は とめない');
  const n = await call(env, 'GET', '/api/nothing');
  assert.equal(n.status, 404);
  assert.equal(typeof n.data.error, 'string');
  // /api いがいは ASSETS に まかせる（ASSETS の 404 は そのまま）
  const { env: env2 } = makeEnv();
  env2.ASSETS = { fetch: async req => new Response('nf ' + new URL(req.url).pathname, { status: 404 }) };
  const nf = await call(env2, 'GET', '/nope.html');
  assert.equal(nf.status, 404);
  assert.equal(nf.data, 'nf /nope.html');
});

/* ===== 公開の 設定（wrangler.jsonc・.assetsignore・migrations） ===== */
const jsonc = s => JSON.parse(s.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));
nodeTest('wrangler.jsonc：名前・Worker・静的ファイル・D1（もとの waon-ranking）・cron', () => {
  const text = readFileSync(here('../wrangler.jsonc'), 'utf8'), w = jsonc(text);
  assert.equal(w.name, 'piano-chord-apps');
  assert.equal(w.main, 'src/worker.js');
  assert.equal(w.assets.directory, '.');
  assert.equal(w.assets.binding, 'ASSETS');
  assert.deepEqual(w.assets.run_worker_first, ['/api/*']);
  assert.equal(w.assets.html_handling, 'auto-trailing-slash');
  assert.equal(w.d1_databases.length, 1);
  assert.deepEqual(w.d1_databases[0], { binding: 'DB', database_name: 'waon-ranking', database_id: '43b354cf-87c0-411f-b2f0-5fd06a1efdec', migrations_dir: 'migrations' });
  assert.deepEqual(w.triggers.crons, ['5 16 * * *']);
  assert.equal(w.observability.logs.invocation_logs, false);
  assert.ok(!/"ADMIN_KEY"\s*:/.test(text), 'キーを 書かない');
});
nodeTest('.assetsignore：サーバー・テスト・道具・説明・設定は 公開しない', () => {
  const lines = readFileSync(here('../.assetsignore'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  for (const p of ['src/', 'test/', 'tools/', 'migrations/', 'docs/', '.github/', '.claude/', 'node_modules/', 'package.json', 'package-lock.json',
    'wrangler.jsonc', '*.md', '.assetsignore', '.gitignore', '.git', '.wrangler/', '.dev.vars']) assert.ok(lines.includes(p), p);
  // ページ・assets・sw.js などは 公開する
  for (const p of lines) assert.ok(!/^(\*\.html|\*\.js|assets\/?|sw\.js|index\.html|ear\.html|\*|\/)$/.test(p), p);
});
nodeTest('migrations：もとの 和音ききわけと おなじ 名前（D1 は もう あてた 分を 2回 あてない）', () => {
  assert.deepEqual(readdirSync(here('../migrations')).filter(x => x.endsWith('.sql')).sort(), ['0001_init.sql', '0002_moderation.sql']);
});

nodeTest('worker.js：SQL は bind だけ（テンプレートに 値を うめこまない）', () => {
  const src = readFileSync(here('../src/worker.js'), 'utf8');
  // prepare( の 中で ${...} に つかうのは 定数（ORDER / BETTER / better）だけ
  const used = [...src.matchAll(/\$\{(\w+)\}/g)].map(m => m[1]);
  const inSql = [...src.matchAll(/prepare\(\s*`([\s\S]*?)`/g)].flatMap(m => [...m[1].matchAll(/\$\{(\w+)\}/g)].map(x => x[1]));
  assert.ok(used.length > 0);
  for (const v of inSql) assert.ok(['ORDER', 'BETTER', 'better', 'cols'].includes(v), v);
  assert.ok(!/ADMIN_KEY\s*[:=]\s*['"]/.test(src), 'キーを 書かない');
  // 全レベルの しゅるいが game.js と 同じ id
  for (let l = 1; l <= 8; l++) for (const t of LEVELS[l].types) assert.ok(TYPE_IDS.includes(t));
});
