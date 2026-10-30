// 7つの 和音（diatonic.html）の なおし：なかまの もんだいと ひびきの ことば
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(dir,'diatonic.html'),'utf8');
const m=html.match(/\/\/ <dia-logic>[^\n]*\n([\s\S]*?)\/\/ <\/dia-logic>/);
const DIA=new Function('PA',m[1]+'\nreturn DIA;')(PA);
const KEYS=[...Array(13).keys()].flatMap(i=>[PA.keyOf(false,i,60),PA.keyOf(true,i,60)]);

test('なかまの もんだい：「おなじ 音が 2つ」で こたえが 1つに きまる 和音だけ 出す',()=>{
  let s=7;const rnd=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};
  for(let r=0;r<300;r++){
    const b=DIA.quiz(rnd)[1];
    for(const key of KEYS){
      const heads=DIA.FAMS.map((F,f)=>f).filter(f=>DIA.common(key,b.d,DIA.FAMS[f].head).length===2);
      assert.deepEqual(heads,[b.ans],`${PA.keyName(key)} ${DIA.ROM[b.d]}`);
    }
  }
});

test('ひびきの ことばは 聴きわけ（ear.html）と おなじ',()=>{
  const ear=fs.readFileSync(path.join(dir,'ear.html'),'utf8');
  for(const [q,em,w] of [['min','🌧️','さびしい'],['dim','😖','きゅうくつ']]){
    assert.match(ear,new RegExp(`${q}:\\{[^}]*word:'${w}',emoji:'${em}'`));
    assert.match(html,new RegExp(`${q}:\\{em:'${em}',w:'${w}'`));
  }
  assert.doesNotMatch(html,/くらい|ドキドキ|☁️|💓/);
});
