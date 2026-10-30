// ブランチの Preview（D1 なし）：/api は 501 で ことわり、画面は「オフライン」で あそべる。本物の ランキングには ふれない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));

test('D1 が ない ときは /api/run・/api/score・/api/ranking が 501（JSON の やさしい メッセージ）', async () => {
  const env = { ASSETS: { fetch: () => new Response('asset') } };
  for (const [method, path] of [['POST', '/api/run'], ['POST', '/api/score'], ['GET', '/api/ranking?period=all']]) {
    const res = await worker.fetch(new Request('https://example.workers.dev' + path, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined }), env, {});
    assert.equal(res.status, 501, path);
    const d = await res.json();
    assert.equal(typeof d.error, 'string');
  }
});

test('D1 が ない ときの 毎日の そうじは なにも しない', async () => {
  await worker.scheduled({ scheduledTime: Date.now() }, {}, { waitUntil: () => {} });
});

test('wrangler.jsonc に previews が あり、Preview には 本物の D1 を つながない', () => {
  const src = readFileSync(here('../wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const cfg = JSON.parse(src);
  assert.ok(cfg.previews && typeof cfg.previews === 'object', 'previews が ある');
  const ids = (cfg.previews.d1_databases || []).map(d => d.database_id);
  for (const d of cfg.d1_databases) assert.ok(!ids.includes(d.database_id), 'Preview に 本番の D1 を つながない');
});
