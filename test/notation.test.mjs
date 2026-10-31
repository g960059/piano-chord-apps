// 和音記号はアプリ全体で藝大式（先生の決め：docs/TEACHER-FEEDBACK.md 2026-10-31）。
// 画面に出る文字に、まえの書きかた（英米式・数字付き低音・コードネームふうのローマ数字）がのこっていないかしらべる。
//   コメント（// … ・/* … */・<!-- … -->）はしらべない（作る人のメモ）。記号は PA.rn で描く。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.html')),'assets/core.js'];
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
];

test('画面の文字にまえの和音記号がのこっていない（コメントはのぞく）',()=>{
  const bad=[];
  for(const f of files){
    const lines=strip(fs.readFileSync(path.join(root,f),'utf8')).split('\n');
    lines.forEach((ln,i)=>OLD.forEach(([what,re])=>{const m=re.exec(ln);if(m) bad.push(`${f}:${i+1} ${what}：${m[0]}`);}));
  }
  assert.deepEqual(bad,[]);
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
  for(const s of ['Ⅰ6/4をはさむ','Ⅴ6/5','Ⅱ6から','`Ⅴ7/Ⅱ`','減七/Ⅴ','♭Ⅱの根音','○Ⅳ（Ⅳm）','（N6・♭Ⅱ6）','It+6','半減七']) assert.ok(hit(s),s);
  for(const s of ['○Ⅳ・○Ⅵ','Ⅴ9の根音省略','ⅤのⅤ7','// Ⅰ6/4 → Ⅴ','/* Ⅴ7/Ⅱ */','https://example.test/','const N6=key=>[','増6度','Ⅰの第2転回形']) assert.ok(!hit(s),s);
});
