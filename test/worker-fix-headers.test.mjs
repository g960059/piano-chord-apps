// 静的ファイルの 安全用ヘッダー（_headers）と、公開ランキングに 時刻を 出さないことの テスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = p => fileURLToPath(new URL(p, import.meta.url));

test('_headers：すべての 静的ファイルに iframe 禁止などの ヘッダーを つける', () => {
  const lines = readFileSync(here('../_headers'), 'utf8').split('\n').filter(s => s.trim() && !s.trim().startsWith('#'));
  assert.equal(lines[0], '/*');
  const h = {};
  for (const l of lines.slice(1)) {
    assert.ok(/^\s+\S/.test(l), 'ヘッダーの 行は 字下げ: ' + l);
    const i = l.indexOf(':');
    h[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
  }
  assert.equal(h['x-frame-options'], 'DENY');
  assert.match(h['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(h['content-security-policy'], /base-uri 'self'/);
  assert.match(h['content-security-policy'], /object-src 'none'/);
  assert.equal(h['x-content-type-options'], 'nosniff');
  assert.equal(h['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.ok(!/microphone/.test(h['permissions-policy']), 'マイクは とめない');
  assert.match(h['permissions-policy'], /camera=\(\)/);
});

test('_headers は .assetsignore で 外さない', () => {
  const ign = readFileSync(here('../.assetsignore'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  assert.ok(!ign.some(p => p === '_headers' || p === '_*' || p === '/_headers'));
});

test('worker：公開ランキングの 行に 時刻（at）を 入れない', () => {
  const src = readFileSync(here('../src/worker.js'), 'utf8');
  const m = src.match(/const rowOut = [^\n]*/);
  assert.ok(m, 'rowOut が ある');
  assert.ok(!/\bat\s*:/.test(m[0]), m[0]);
});
