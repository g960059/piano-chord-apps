// 短調の ページ（Ⅴの家族・短調クイズ）の テスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');

test('Ⅴの家族：減七の ①②③の なかまは、どの 短調の 減七とも けんばんが あう',()=>{
  const PA=loadPA();
  const src=read('minor-family.html');
  const m=/const DIM_FAMS=(\[[^;]*\]);/.exec(src); assert.ok(m,'DIM_FAMS が ある');
  const FAMS=JSON.parse(m[1]);
  assert.match(src,/const FAM_NO=\['①','②','③'\]/);
  assert.doesNotMatch(src,/[ＡＢＣ]の/,'Ａ・Ｂ・Ｃの 家族 は もう つかわない');
  const pcs=ns=>ns.map(([l,a])=>PA.mod(PA.NAT[l]+a,12)).sort((a,b)=>a-b).join(',');
  for(let i=0;i<PA.keyCount(true);i++){
    const key=PA.minorKey(i), dim=[6,8,10,12].map(k=>PA.at(key.harm,k));
    const fam=PA.mod(key.lt.midi,3); // ページと おなじ きめかた
    assert.equal(dim.map(n=>PA.mod(n.midi,12)).sort((a,b)=>a-b).join(','),pcs(FAMS[fam]),PA.keyName(key)+' は '+(fam+1)+'の なかま');
  }
});

test('短調クイズ：こたえる まえに こたえの 鍵に focus を つけない・古い しくみを のこさない',()=>{
  const src=read('minor-quiz.html');
  assert.doesNotMatch(src,/fixNames|kdArm|嬰ヘ長調と 変ト長調/);
  assert.doesNotMatch(src,/\[t\[0\]\.midi,t\[t\.length-1\]\.midi\]\.forEach/,'こたえの はしの 鍵に focus を つけない');
  assert.match(src,/PA\.HINT_NOTE/);
  assert.match(src,/data-hot="check"/); assert.match(src,/data-hot="next"/); assert.match(src,/data-hot="listen"/);
});

test('学ぶ ページの「ためしてみる」は 短調クイズの ゆるされた パラメータだけ',()=>{
  const PA=loadPA();
  for(const f of ['minor-why.html','minor-signature.html','minor-family.html']) assert.match(read(f),/PA\.tryHTML\(\{to:'minor-quiz'/,f);
  const h=PA.tryHTML({to:'minor-quiz',params:{mode:'mark',key:PA.keyDeck.id(true,3),n:3}});
  assert.match(h,/href="minor-quiz\.html\?mode=mark&amp;key=m3&amp;n=3"/);
});

test('短調クイズ：リンクの パラメータは 1回だけ（アドレスから けす）・もどした もんだいは おなじ しゅるいだけ',()=>{
  const src=read('minor-quiz.html');
  assert.match(src,/history\.replaceState\(\{mqLink:true\},'',location\.pathname\+location\.hash\)/);
  assert.match(src,/q:Q\.q\?\{keyIdx:Q\.q\.keyIdx,fam:Q\.q\.fam,type:Q\.type\}/);
  assert.match(src,/q\.type===Q\.type/);
  assert.doesNotMatch(src,/\bsessDone\b/,'「けっかを 見る」は sessDoneId（その もんだい）で きめる');
});

test('Ⅴの家族の「3もん ためしてみる」：見ている 和音と もう1つを まぜる（3もんとも おなじに しない）',()=>{
  const src=read('minor-family.html');
  const m=/const TRY_PAIR=(\{[^;]*\});/.exec(src); assert.ok(m);
  const pair=Function('return '+m[1])();
  for(const f of ['V','V7','V9','DIM']){assert.equal(pair[f][0],f); assert.equal(new Set(pair[f]).size,2);}
});
