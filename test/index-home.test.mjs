// ホーム（index.html）が つかう きろく：PA.mountBar が 'visited' に ひらいた アプリを のこす
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
// 上のバーの 入れものだけ ある ふりを する
const src='document.getElementById=function(){return {innerHTML:"",parentNode:null};};\n'+fs.readFileSync(path.join(root,'assets','core.js'),'utf8');

test('PA.mountBar：visited・last-practice・last-learn',()=>{
  const mem=new Map();
  const PA=loadPA(src,{storage:mem});
  PA.mountBar({title:'和音のしくみ',app:'chord-build'});
  PA.mountBar({title:'和音クイズ',app:'chord-quiz'});
  const v=PA.store.get('visited',null);
  assert.deepEqual(Object.keys(v).sort(),['chord-build','chord-quiz']);
  assert.ok(v['chord-quiz']>0);
  assert.equal(PA.store.get('last-practice',null).app,'chord-quiz');
  assert.equal(PA.store.get('last-learn',null).app,'chord-build');
  // 目次に ない 名前・app の ない バーは のこさない
  PA.mountBar({title:'?',app:'nope'});
  PA.mountBar({title:'ホーム',back:'#'});
  assert.deepEqual(Object.keys(PA.store.get('visited',null)).sort(),['chord-build','chord-quiz']);
  // こわれた きろくでも だいじょうぶ
  PA.store.set('visited',[1,2]);
  PA.mountBar({title:'カデンツ',app:'cadence'});
  assert.deepEqual(Object.keys(PA.store.get('visited',null)),['cadence']);
});

test('index.html：目次は core の PA.UNITS・PA.APPS を つかう',()=>{
  const h=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(!/const (CATS|TYPES)\s*=/.test(h),'ページの 中に 目次を もたない');
  assert.match(h,/PA\.UNITS/); assert.match(h,/PA\.APP_TYPES/); assert.match(h,/PA\.weakSummary/);
  assert.ok(!/\?\.|\?\?/.test(h.replace(/<style>[\s\S]*?<\/style>/,'')),'iOS 12 で うごかない ?. ?? を つかわない');
  assert.ok(!/waon-kikiwake/.test(h),'外の ランキングの カードは もう ない');
});
