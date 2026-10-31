// PA.staffSVG の autoCarry（小節の中の臨時記号）のテスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const G=PA.majorKey(1); // ト長調（ファ♯）
const n=(letter,acc,midi)=>({letter,acc,midi});
const C4=n(0,0,60), Cs4=n(0,1,61), C3=n(0,0,48), Cs3=n(0,1,49), C5=n(0,0,72);
const glyphs=svg=>(svg.match(/<g stroke="/g)||[]).length; // 臨時記号（♯・♮など）のかず。調号は2段で2つ
const draw=cols=>PA.staffSVG(G,cols,{grand:true,autoCarry:true});

test('ト音記号のド♯4 → ヘ音記号のド3 → ト音記号のド4：ド3にもド4にも♮（ヘ音記号の音できえない）',()=>{
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[],lh:[C3]},{notes:[C4]}])),2+1+1+1);
});
test('べつの段のド♯3のあとのト音記号のド4にも、ねんのため♮',()=>{
  assert.equal(glyphs(draw([{notes:[],lh:[Cs3]},{notes:[C4]}])),2+1+1);
});
test('ド♯4 → ド5 → ド4：ド4に♮（とちゅうのド5できえない）',()=>{
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[C5]},{notes:[C4]}])),2+1+1+1);
});
test('かわらない音名にはなにもつけない',()=>{
  assert.equal(glyphs(draw([{notes:[C4]},{notes:[],lh:[C3]},{notes:[C5]}])),2);
});
test('おなじ段ならオクターブちがいでも♮（ド♯4 → ド5）、2回目の♯も書く',()=>{
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[C5]}])),2+1+1);
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[Cs4]}])),2+1+1);
});
test('autoCarry なしは前とおなじ（c.carry をつかう）',()=>{
  const cols=[{notes:[Cs4]},{notes:[C4],carry:{0:1}}];
  assert.equal(glyphs(PA.staffSVG(G,cols,{grand:true})),2+1+1);
  assert.equal(glyphs(PA.staffSVG(G,[{notes:[Cs4]},{notes:[C4]}],{grand:true})),2+1);
});

// 先生の指摘（2026-10-31）：符頭の中を白でぬると、線の上の音が「間の音」に見える
const E4=n(2,0,64), F4=n(3,0,65);
test('白い符頭は中をぬらない（五線が符頭の中を通って見える）',()=>{
  const svg=draw([{notes:[E4,F4]},{notes:[C4],lh:[C3]}]);
  const heads=svg.match(/<ellipse [^>]*>/g)||[];
  assert.equal(heads.length,4);
  heads.forEach(h=>assert.match(h,/fill="none"/));
});
test('列の色・かわった調号の赤い丸は、五線より先にぬる（五線の上をぬりつぶさない）',()=>{
  const svg=PA.staffSVG(PA.minorKey(0),[{notes:[E4],hl:'#fff1cc'}],{sigOverride:{letter:4,acc:1}});
  const firstLine=svg.indexOf('<line');
  assert.ok(firstLine>0);
  for(const m of svg.matchAll(/<(rect|circle)[^>]*fill="#(fff1cc|fde4e7)"/g)) assert.ok(m.index<firstLine,m[0]);
  assert.ok(svg.includes('#fde4e7')&&svg.includes('#fff1cc'));
});
