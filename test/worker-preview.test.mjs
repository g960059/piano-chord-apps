// ブランチの Preview（D1なし）：/api は501でことわり、画面は「オフライン」であそべる。本物のランキングにはふれない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));

test('D1がないときは /api/run・/api/score・/api/ranking が501（JSON のやさしいメッセージ）', async () => {
  const env = { ASSETS: { fetch: () => new Response('asset') } };
  for (const [method, path] of [['POST', '/api/run'], ['POST', '/api/score'], ['GET', '/api/ranking?period=all']]) {
    const res = await worker.fetch(new Request('https://example.workers.dev' + path, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined }), env, {});
    assert.equal(res.status, 501, path);
    const d = await res.json();
    assert.equal(typeof d.error, 'string');
  }
});

test('D1がないときの毎日のそうじはなにもしない', async () => {
  await worker.scheduled({ scheduledTime: Date.now() }, {}, { waitUntil: () => {} });
});

test('wrangler.jsonc に previews があり、Preview には本物の D1をつながない', () => {
  const src = readFileSync(here('../wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const cfg = JSON.parse(src);
  assert.ok(cfg.previews && typeof cfg.previews === 'object', 'previews がある');
  const ids = (cfg.previews.d1_databases || []).map(d => d.database_id);
  for (const d of cfg.d1_databases) assert.ok(!ids.includes(d.database_id), 'Preview に本番の D1をつながない');
});
