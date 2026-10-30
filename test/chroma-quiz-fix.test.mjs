// 変化和音クイズ（chroma-quiz.html）のなおし：ホームのにがてふくしゅう（key と n）は 🎹 おさえるでひらく・iOS 12.0にない API をつかわない
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

test('linkOf：key と n だけ（ホームのにがてふくしゅう）は keys',()=>{
  assert.equal(link({key:'M2',n:'3'}).mode,'keys');
  assert.equal(link(PA.parseParams('?key=m5&n=3')).mode,'keys');
  assert.equal(link({mode:'ear',key:'M2',n:'3'}).mode,'ear','mode があればそのまま');
  assert.equal(link({key:'M2'}).mode,null,'key だけならそのまま');
  assert.equal(link({n:'3'}).mode,null,'n だけならそのまま');
});

test('ブラウザの JS に Object.fromEntries をつかわない（iOS 12.0・12.1にない）',()=>{
  const js=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
  assert.ok(js.length>1000);
  assert.ok(!/Object\.fromEntries\s*\(/.test(js));
});
