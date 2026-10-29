// PA.staffSVG の autoCarry（小節の 中の 臨時記号）の テスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const G=PA.majorKey(1); // ト長調（ファ♯）
const n=(letter,acc,midi)=>({letter,acc,midi});
const C4=n(0,0,60), Cs4=n(0,1,61), C3=n(0,0,48), Cs3=n(0,1,49), C5=n(0,0,72);
const glyphs=svg=>(svg.match(/<g stroke="/g)||[]).length; // 臨時記号（♯・♮ など）の かず。調号は 2段で 2つ
const draw=cols=>PA.staffSVG(G,cols,{grand:true,autoCarry:true});

test('ト音記号の ド♯4 → ヘ音記号の ド3 → ト音記号の ド4：ド3 にも ド4 にも ♮（ヘ音記号の 音で きえない）',()=>{
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[],lh:[C3]},{notes:[C4]}])),2+1+1+1);
});
test('べつの 段の ド♯3 の あとの ト音記号の ド4 にも、ねんのため ♮',()=>{
  assert.equal(glyphs(draw([{notes:[],lh:[Cs3]},{notes:[C4]}])),2+1+1);
});
test('ド♯4 → ド5 → ド4：ド4 に ♮（とちゅうの ド5 で きえない）',()=>{
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[C5]},{notes:[C4]}])),2+1+1+1);
});
test('かわらない 音名には なにも つけない',()=>{
  assert.equal(glyphs(draw([{notes:[C4]},{notes:[],lh:[C3]},{notes:[C5]}])),2);
});
test('おなじ 段なら オクターブちがいでも ♮（ド♯4 → ド5）、2回目の ♯ も 書く',()=>{
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[C5]}])),2+1+1);
  assert.equal(glyphs(draw([{notes:[Cs4]},{notes:[Cs4]}])),2+1+1);
});
test('autoCarry なしは 前と おなじ（c.carry を つかう）',()=>{
  const cols=[{notes:[Cs4]},{notes:[C4],carry:{0:1}}];
  assert.equal(glyphs(PA.staffSVG(G,cols,{grand:true})),2+1+1);
  assert.equal(glyphs(PA.staffSVG(G,[{notes:[Cs4]},{notes:[C4]}],{grand:true})),2+1);
});
