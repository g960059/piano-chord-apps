// 和音クイズ（chord-quiz.html）：ヒントでできた数・リンクのせっていをほぞんしないしくみ・ためしてみるのリンク
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(dir,'chord-quiz.html'),'utf8');
const m=html.match(/\/\/ <cq-logic>[^\n]*\n([\s\S]*?)\/\/ <\/cq-logic>/);
const CQ=new Function('PA',m[1]+'\nreturn {scoreAnswer,scoreText};')(PA);

test('⭐：ヒントでできた数はべつにかぞえる（×に見えない）',()=>{
  const s={right:0,total:0,hinted:0,streak:0};
  CQ.scoreAnswer(s,true,true);
  assert.deepEqual(s,{right:0,total:1,hinted:1,streak:0});
  CQ.scoreAnswer(s,true,false);
  assert.deepEqual(s,{right:1,total:2,hinted:1,streak:1});
  CQ.scoreAnswer(s,false,true);
  assert.deepEqual(s,{right:1,total:3,hinted:1,streak:0},'ヒントを見てもまちがいは ×');
  assert.equal(CQ.scoreText(s),'⭐ じぶんで1・💡 ヒントで1／3もん');
  assert.equal(CQ.scoreText({right:2,total:3,hinted:0}),'⭐ 2 / 3もん正解');
});

test('リンクのせっていは RUN にだけ入れ、ほぞんは BASE。アドレスからリンクをけす',()=>{
  assert.match(html,/history\.replaceState\(\{cqLink:/);
  assert.match(html,/PA\.store\.set\('chord-quiz',\{type:BASE\.type,tier:BASE\.tier,[^}]*keyset:BASE\.keyset,chords:BASE\.chords/);
  assert.doesNotMatch(html,/d\.view==='summary'/,'古いけっかのカードは10分ですてる');
});

test('和音のしくみのためしてみる：おなじ調のⅠ・Ⅳ・Ⅴ（3もんがぜんぶおなじにならない）',()=>{
  const b=fs.readFileSync(path.join(dir,'chord-build.html'),'utf8');
  assert.match(b,/PA\.tryHTML\(\{to:'chord-quiz',params:\{key:kid,chord:tryChords\(ch\)\.join\(','\)/);
  const tc=new Function(/const tryChords=[^\n]*/.exec(b)[0]+'\nreturn tryChords;')();
  assert.deepEqual(tc('I'),['I','IV','V']);
  assert.deepEqual(tc('V7'),['I','IV','V','V7']);
});
