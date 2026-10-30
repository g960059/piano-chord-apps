// 変化和音クイズ（chroma-quiz.html）の なおし：ホームの にがて ふくしゅう（key と n）は 🎹 おさえる で ひらく・iOS 12.0 に ない API を つかわない
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const html=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','chroma-quiz.html'),'utf8');
const m=html.match(/\/\/ <cq-link>[^\n]*\n([\s\S]*?)\/\/ <\/cq-link>/);
const L=new Function('PA',m[1]+'\nreturn {linkOf};')(PA);
const link=p=>L.linkOf(p,['easy','normal','hard','all']);

test('linkOf：key と n だけ（ホームの にがて ふくしゅう）は keys',()=>{
  assert.equal(link({key:'M2',n:'3'}).mode,'keys');
  assert.equal(link(PA.parseParams('?key=m5&n=3')).mode,'keys');
  assert.equal(link({mode:'ear',key:'M2',n:'3'}).mode,'ear','mode が あれば そのまま');
  assert.equal(link({key:'M2'}).mode,null,'key だけ なら そのまま');
  assert.equal(link({n:'3'}).mode,null,'n だけ なら そのまま');
});

test('ブラウザの JS に Object.fromEntries を つかわない（iOS 12.0・12.1 に ない）',()=>{
  const js=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
  assert.ok(js.length>1000);
  assert.ok(!/Object\.fromEntries\s*\(/.test(js));
});
