// 和音記号はアプリ全体で藝大式（先生の決め：docs/TEACHER-FEEDBACK.md 2026-10-31）。
// 画面に出る文字に、まえの書きかた（英米式・数字付き低音・コードネームふうのローマ数字）がのこっていないかしらべる。
//   コメント（// … ・/* … */・<!-- … -->）はしらべない（作る人のメモ）。記号は PA.rn で描く。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.html')),'assets/core.js','assets/piece.js'];
// 曲のデータ（名曲で楽曲分析）：画面に出る note・ask などの文字。JSON は文字の値だけをしらべる
const pieces=fs.readdirSync(path.join(root,'assets','pieces')).filter(f=>f.endsWith('.json')).map(f=>'assets/pieces/'+f);
const strs=v=>typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(strs):v&&typeof v==='object'?Object.values(v).flatMap(strs):[];
// コメントをとる（URL の // はのこす）
const strip=s=>s.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`\\])\/\/.*$/gm,'$1');
const R='[ⅠⅡⅢⅣⅤⅥⅦ]';
const OLD=[
  ['数字付き低音の転回形（Ⅰ6・Ⅰ6/4・Ⅴ6/5・Ⅴ4/3・Ⅴ4/2 など）',new RegExp(`${R}(?:6|6/4|6/5|4/3|4/2|64|65|43|42)(?![0-9])`)],
  ['「／」で目標を書く副属和音（Ⅴ7/Ⅱ・V/V・減七/Ⅴ など）',new RegExp(`(?:${R}[79]?|減七|V)/(?:${R}|♭|V)`)],
  ['♭のついたローマ数字（♭Ⅱ・♭Ⅵ。準固有は○Ⅳ・○Ⅵ）',new RegExp(`♭${R}`)],
  ['コードネームふうのローマ数字（Ⅳm など）',new RegExp(`${R}m(?![a-z])`)],
  ['N6（ナポリの六）',/N6[（・」）]|[「（・]N6|>N6</],
  ['It6・Fr6・Ger6',/\b(?:It|Fr|Ger)\+?6\b/],
  ['半減七',/半減七/],
  // 先生：「Ⅴ9の根音省略」という言い方で伝える。導音からつむ七の和音を「Ⅶ7」とは書かない
  ['Ⅶ7（「Ⅴ9の根音省略」と書く）',/Ⅶ7|Ⅶ₇/],
];
// ゆるす行：「Ⅶ7と書く本もある」という注意書き（dim-halfdim.html の「もっとくわしく」）だけ
const ALLOW=[/Ⅶ7<\/b>と書く本もあるよ/];

test('画面の文字にまえの和音記号がのこっていない（コメントはのぞく）',()=>{
  const bad=[];
  const look=(f,lines)=>lines.forEach((ln,i)=>{if(ALLOW.some(r=>r.test(ln))) return;OLD.forEach(([what,re])=>{const m=re.exec(ln);if(m) bad.push(`${f}:${i+1} ${what}：${m[0]}`);});});
  for(const f of files) look(f,strip(fs.readFileSync(path.join(root,f),'utf8')).split('\n'));
  for(const f of pieces) look(f,strs(JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))));
  assert.ok(pieces.includes('assets/pieces/k545-1.json'));
  assert.deepEqual(bad,[]);
  // ゆるす行は1つだけ
  assert.equal(files.filter(f=>ALLOW.some(r=>r.test(strip(fs.readFileSync(path.join(root,f),'utf8'))))).join(),'dim-halfdim.html');
});

test('記号をつかうページには「記号のみかた」がある',()=>{
  for(const f of ['aug6','neapolitan','secondary','doppel','borrowed','enharmonic','dim-halfdim','inversion']){
    assert.match(fs.readFileSync(path.join(root,f+'.html'),'utf8'),/PA\.rnHelp\(\)/,f);
  }
});

test('ならべた形の記号：根音省略のⅤ9はいちばん下が導音なので第1転回形（H.rnParts の5ばんめに {voiced:true}）',()=>{
  const read=f=>fs.readFileSync(path.join(root,f),'utf8');
  assert.match(read('borrowed.html'),/H\.rnParts\(key,on\?'borrowed':'diatonic',id,null,\{voiced:true\}\)/);
  assert.match(read('secondary.html'),/H\.rnParts\(key,'secondary',t,k,\{voiced:true\}\)/);
  assert.match(read('dim-halfdim.html'),/const OMIT9=\{deg:5,form:9,omit:true,inv:1\}/);
  assert.match(read('minor-family.html'),/const DIM_RN=\{deg:5,form:9,omit:true,inv:1\}/);
});

test('しらべかたがはたらく（まえの書きかたを見つけられる）',()=>{
  const hit=s=>OLD.some(([,re])=>re.test(strip(s)));
  for(const s of ['Ⅰ6/4をはさむ','Ⅴ6/5','Ⅱ6から','`Ⅴ7/Ⅱ`','減七/Ⅴ','♭Ⅱの根音','○Ⅳ（Ⅳm）','（N6・♭Ⅱ6）','It+6','半減七','短調のⅦ7（減七）','○Ⅶ7']) assert.ok(hit(s),s);
  for(const s of ['○Ⅳ・○Ⅵ','Ⅴ9の根音省略','ⅤのⅤ7','// Ⅰ6/4 → Ⅴ','/* Ⅴ7/Ⅱ */','https://example.test/','const N6=key=>[','増6度','Ⅰの第2転回形']) assert.ok(!hit(s),s);
});

test('変化和音クイズの「Ⅴ9の根音省略」：音の名前もⅤ9から見たよびかた（導音＝第3音）。導音を根音とよばない',()=>{
  const h=fs.readFileSync(path.join(root,'chroma-quiz.html'),'utf8'), sc=strip(h);
  assert.match(sc,/if\(t==='vii7'\) return H\.vii7\(key\);/);
  assert.ok(!/H\.vii7\(key,'vii'\)/.test(sc),'導音を根音とする名前（まえの見かた）はつかわない');
  assert.match(sc,/名前はⅤ9から見たよびかた（根音をはぶいたので、いちばん下の導音が第3音）/);
  assert.ok(!/根音は<b>導音<\/b>/.test(sc));
  assert.match(sc,/いちばん下は<b>導音<\/b>（第3音）/);
  assert.match(sc,/if\(t==='vii7'\) return \{name:'導音',notes:\[chordOf\(key,t\)\[0\]\],root:true,low:'導音（第3音）'\};/);
  assert.match(sc,/いちばん下の\$\{b\.low\|\|'根音'\}は/);
  // 副属和音・異名同音の読みかえのページも「Ⅴ9の根音省略」
  const se=strip(fs.readFileSync(path.join(root,'secondary.html'),'utf8')), en=strip(fs.readFileSync(path.join(root,'enharmonic.html'),'utf8'));
  assert.match(se,/const srcWhat=I=>I\.k==='V7'\?`\$\{I\.tkName\}のⅤ7`:`\$\{I\.src\}のⅤ9の根音省略（\$\{KNAME\[I\.k\]\}）`;/);
  assert.match(en,/の減七（Ⅴ9の根音省略）をおさえてみよう/);
  assert.match(en,/4つの短調のⅤ9の根音省略（減七）になる/);
});
