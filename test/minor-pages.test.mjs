// 短調のページ（Ⅴの家族・短調クイズ）のテスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');

test('Ⅴの家族：減七の ①②③のなかまは、どの短調の減七ともけんばんがあう',()=>{
  const PA=loadPA();
  const src=read('minor-family.html');
  const m=/const DIM_FAMS=(\[[^;]*\]);/.exec(src); assert.ok(m,'DIM_FAMS がある');
  const FAMS=JSON.parse(m[1]);
  assert.match(src,/const FAM_NO=\['①','②','③'\]/);
  assert.doesNotMatch(src,/[ＡＢＣ]の/,'Ａ・Ｂ・Ｃの家族はもうつかわない');
  const pcs=ns=>ns.map(([l,a])=>PA.mod(PA.NAT[l]+a,12)).sort((a,b)=>a-b).join(',');
  for(let i=0;i<PA.keyCount(true);i++){
    const key=PA.minorKey(i), dim=[6,8,10,12].map(k=>PA.at(key.harm,k));
    const fam=PA.mod(key.lt.midi,3); // ページとおなじきめかた
    assert.equal(dim.map(n=>PA.mod(n.midi,12)).sort((a,b)=>a-b).join(','),pcs(FAMS[fam]),PA.keyName(key)+'は'+(fam+1)+'のなかま');
  }
});

test('短調クイズ：こたえるまえにこたえの鍵に focus をつけない・古いしくみをのこさない',()=>{
  const src=read('minor-quiz.html');
  assert.doesNotMatch(src,/fixNames|kdArm|嬰ヘ長調と変ト長調/);
  assert.doesNotMatch(src,/\[t\[0\]\.midi,t\[t\.length-1\]\.midi\]\.forEach/,'こたえのはしの鍵に focus をつけない');
  assert.match(src,/PA\.HINT_NOTE/);
  assert.match(src,/data-hot="check"/); assert.match(src,/data-hot="next"/); assert.match(src,/data-hot="listen"/);
});

test('学ぶページの「ためしてみる」は短調クイズのゆるされたパラメータだけ',()=>{
  const PA=loadPA();
  for(const f of ['minor-why.html','minor-signature.html','minor-family.html']) assert.match(read(f),/PA\.tryHTML\(\{to:'minor-quiz'/,f);
  const h=PA.tryHTML({to:'minor-quiz',params:{mode:'mark',key:PA.keyDeck.id(true,3),n:3}});
  assert.match(h,/href="minor-quiz\.html\?mode=mark&amp;key=m3&amp;n=3"/);
});

test('短調クイズ：リンクのパラメータは1回だけ（アドレスからけす）・もどしたもんだいはおなじしゅるいだけ',()=>{
  const src=read('minor-quiz.html');
  assert.match(src,/history\.replaceState\(\{mqLink:true\},'',location\.pathname\+location\.hash\)/);
  assert.match(src,/q:Q\.q\?\{keyIdx:Q\.q\.keyIdx,fam:Q\.q\.fam,type:Q\.type\}/);
  assert.match(src,/q\.type===Q\.type/);
  assert.doesNotMatch(src,/\bsessDone\b/,'「けっかを見る」は sessDoneId（そのもんだい）できめる');
});

test('Ⅴの家族の「3もんためしてみる」：見ている和音ともう1つをまぜる（3もんともおなじにしない）',()=>{
  const src=read('minor-family.html');
  const m=/const TRY_PAIR=(\{[^;]*\});/.exec(src); assert.ok(m);
  const pair=Function('return '+m[1])();
  for(const f of ['V','V7','V9','DIM']){assert.equal(pair[f][0],f); assert.equal(new Set(pair[f]).size,2);}
});

test('短調クイズ：記号のもんだい（と和音1つ）の key はさいしょの1もんだけ・チェック表のことばをなおせる',()=>{
  const PA=loadPA();
  const src=read('minor-quiz.html');
  assert.match(src,/const onceMode=\(\)=>Q\.type==='mark'\|\|FAM_KEYS\.filter\(f=>Q\.fams\[f\]\)\.length===1;/);
  assert.match(src,/let k=Q\.fixKey&&!\(once&&Q\.fixUsed\)\?KD\.parse\(Q\.fixKey\):null;/);
  assert.match(src,/fixUsed:Q\.fixUsed/,'読みなおしてもおぼえている');
  assert.doesNotMatch(src,/orderFor|Q\.order/,'おなじ調がつづかないので記号のならびはまぜない');
  assert.match(src,/else if\(linkKey\) Q\.type='chord';/,'key だけのリンク（にがてふくしゅう）は和音をおさえる');
  assert.match(src,/if\(fixOnce\(\)&&Q\.fixUsed&&!sess\.active\(\)\)\{Q\.fixKey=null;Q\.fixUsed=false;\}/,'回のそとでは2もんめから 🔑 をけす');
  // ページがなおす core のことば（core をかえたらページの PICK_NOTE・PICK_SR も）
  const m=/PICK_NOTE='([^']*)', PICK_SR='([^']*)'/.exec(src); assert.ok(m);
  const h=PA.keyDeck.checkTableHTML('minor-quiz',{modes:['minor'],pickable:true});
  assert.ok(h.includes(m[1]),'チェック表の説明に「'+m[1]+'」');
  assert.ok(h.includes(m[2]),'ますの aria-label に「'+m[2]+'」');
});
