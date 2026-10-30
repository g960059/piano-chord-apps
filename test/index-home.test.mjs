// ホーム（index.html）がつかうきろく：PA.mountBar が 'visited' にひらいたアプリをのこす
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
// 上のバーの入れものだけあるふりをする
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
  // 目次にない名前・app のないバーはのこさない
  PA.mountBar({title:'?',app:'nope'});
  PA.mountBar({title:'ホーム',back:'#'});
  assert.deepEqual(Object.keys(PA.store.get('visited',null)).sort(),['chord-build','chord-quiz']);
  // こわれたきろくでもだいじょうぶ
  PA.store.set('visited',[1,2]);
  PA.mountBar({title:'カデンツ',app:'cadence'});
  assert.deepEqual(Object.keys(PA.store.get('visited',null)),['cadence']);
});

test('index.html：目次は core の PA.UNITS・PA.APPS をつかう',()=>{
  const h=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(!/const (CATS|TYPES)\s*=/.test(h),'ページの中に目次をもたない');
  assert.match(h,/PA\.UNITS/); assert.match(h,/PA\.APP_TYPES/); assert.match(h,/PA\.weakSummary/);
  assert.ok(!/\?\.|\?\?/.test(h.replace(/<style>[\s\S]*?<\/style>/,'')),'iOS 12でうごかない ?. ?? をつかわない');
  assert.ok(!/waon-kikiwake/.test(h),'外のランキングのカードはもうない');
});

test('index.html：あそぶ（クイズ・耳のタイル）とまなぶ。「コース」と番号の単元はない',()=>{
  const h=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const js=h.replace(/<style>[\s\S]*?<\/style>/,'');
  assert.ok(!/コース/.test(js),'「コース」という言葉をつかわない');
  assert.match(js,/a\.type==='quiz'\|\|a\.type==='ear'/,'あそぶは quiz・ear のアプリぜんぶ');
  assert.match(js,/にがてをやっつけよう/); assert.match(js,/'home-units'/); assert.match(js,/PA\.native\?/);
  assert.match(js,/support\.html/); assert.match(js,/privacy\.html/);
  // あそぶのタイルの色：白い字で4.5:1いじょう
  const lum=x=>{const c=[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  const cols=[...js.matchAll(/\{c:'(#[0-9a-f]{6})'/g)].map(m=>m[1]);
  assert.ok(cols.length>=6);
  cols.forEach(c=>assert.ok(1.05/(lum(c)+.05)>=4.5,c+' は白い字で4.5:1いじょう'));
});
