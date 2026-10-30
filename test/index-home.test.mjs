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

// ホームを描いてみる（core.js＋index.html の script を1つにして、#view の innerHTML を見る）
function renderHome(seed={},opts={}){
  const h=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const js=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  const stub='var __view={innerHTML:"",querySelectorAll:function(){return [];},contains:function(){return false;},addEventListener:function(){}};\n'
    +'document.getElementById=function(id){return id==="view"?__view:{innerHTML:"",parentNode:null};};\n'
    +'document.querySelector=function(){return {outerHTML:""};};\n';
  const mem=new Map(Object.entries(seed).map(([k,v])=>['pianoapps.'+k,JSON.stringify(v)]));
  const PA=loadPA(stub+fs.readFileSync(path.join(root,'assets','core.js'),'utf8')+'\n'+js+'\nPA.__view=__view;\n',
    {storage:mem,protocol:opts.protocol,href:'https://example.test/apps/index.html'});
  return {html:PA.__view.innerHTML,PA};
}

test('index.html：はじめての人は まなぶ のタブとはじめのカード、すべてのアプリへいける',()=>{
  const {html:h,PA}=renderHome();
  assert.match(h,/id="hero-h"/);
  assert.match(h,/href="chord-build\.html">ここから始める/);
  assert.match(h,/role="tablist"/);
  assert.match(h,/id="tab-learn"[^>]*aria-selected="true"/);
  assert.match(h,/id="panel-play"[^>]*hidden/);
  for(const a of PA.APPS) assert.ok(h.includes(`href="${a.id}.html"`),a.id+' へのリンク');
  assert.ok(!/コース/.test(h),'コースということばはつかわない');
  assert.equal((h.match(/次はこれ/g)||[]).length,1,'次はこれは1つだけ');
  assert.match(h,/href="support\.html"/); assert.match(h,/href="privacy\.html"/);
  assert.match(h,/ホーム画面に追加/,'ウェブではホーム画面の話');
});

test('index.html：クイズのきろくがある人は あそぶ、つづき・にがての3もん・できた調',()=>{
  const now=Date.now();
  const {html:h,PA}=renderHome({
    'visited':{'chord-quiz':now},
    'last-practice':{app:'chord-quiz',title:'和音クイズ',t:now},
    'keystats-chord-quiz':{M0:{right:1,wrong:3,recent:'oxxx',last:1}}
  });
  assert.ok(!/id="hero-h"/.test(h));
  assert.match(h,/class="go" href="chord-quiz\.html"/);
  assert.match(h,/つづきから/);
  assert.match(h,/id="tab-play"[^>]*aria-selected="true"/);
  assert.match(h,/id="panel-learn"[^>]*hidden/);
  assert.match(h,/href="chord-quiz\.html\?key=M0&amp;n=3"/,'にがての調を3もん');
  assert.match(h,/できた調 0／24/);
  for(const a of PA.APPS) assert.ok(h.includes(`href="${a.id}.html"`),a.id+' へのリンク（2回目の人）');
  assert.ok(!/コース/.test(h));
});

test('index.html：えらんだタブはおぼえる・アプリではホーム画面の話をしない',()=>{
  const {html:h}=renderHome({'home-tab':'play','visited':{'chord-build':1},'last-learn':{app:'chord-build',title:'和音のしくみ',t:1}},{protocol:'capacitor:'});
  assert.match(h,/id="tab-play"[^>]*aria-selected="true"/);
  assert.match(h,/id="panel-learn"[^>]*hidden/);
  assert.match(h,/href="chord-quiz\.html">.*和音クイズでれんしゅう/,'しくみのつづきなら、そのクイズ');
  assert.ok(!/ホーム画面に追加/.test(h)); assert.ok(!/ランキング/.test(h));
});
