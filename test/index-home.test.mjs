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

// ホームの<script>を core のあとにうごかして、PA.paint にわたる HTML を見る（extra＝ホームの前に入れるコード）
function renderHome(mem,opts={},extra=''){
  const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const js=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){}};};document.querySelector=function(){return {};};\n';
  const core=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
  return loadPA(stub+core+'\nPA.paint=function(el,h,sig){PA.__html=h;PA.__sig=sig;};\n'+extra+'\n'+js,{storage:mem,...opts});
}
test('index.html：はじめての人には地図のスタートへさそう。どのアプリにも行ける',()=>{
  const PA=renderHome(new Map());
  const h=PA.__html;
  assert.equal(PA.__sig,'home');
  assert.match(h,/class="card hero"/);
  assert.match(h,/class="btn" href="chord-build\.html"/);
  for(const a of PA.APPS) assert.ok(h.includes(`href="${a.href||a.id+'.html'}"`),a.id);
  // 島は PA.UNITS ごとに1つ。🐸 はさいしょの島に
  assert.equal((h.match(/<details class="stage /g)||[]).length,PA.UNITS.length);
  assert.match(h,/<details class="stage l here" data-d="stage-u1"[^>]* open>/);
  assert.ok(!/コース/.test(h),'「コース」ということばはつかわない');
  // クイズだけあそぶ：クイズと耳のアプリ
  for(const a of PA.APPS.filter(a=>a.type==='quiz'||a.type==='ear')) assert.match(h,new RegExp(`class="qz" href="${a.id}\\.html"`));
  assert.match(h,/support\.html/); assert.match(h,/privacy\.html/); assert.match(h,/ホーム画面に追加/); assert.match(h,/ランキング/);
});
test('index.html：つづきから・つぎの島・星・とじた島・にがて・iOS アプリ',()=>{
  const mem=new Map();
  let PA=renderHome(mem);
  PA.store.set('visited',{'chord-build':1,'chord-quiz':2,'cadence':3,'chord-table':4});
  PA.store.set('last-learn',{app:'chord-build',t:Date.now()});
  let h=renderHome(mem).__html;
  assert.ok(!/class="card hero"/.test(h));
  assert.match(h,/class="go" href="chord-build\.html"/);
  assert.match(h,/和音クイズでれんしゅう/);
  // 1つめの島はクリア、🐸 は2つめの島（右がわ）
  assert.match(h,/<details class="stage l done" data-d="stage-u1"/);
  assert.match(h,/<details class="stage r here" data-d="stage-u2"[^>]* open>/);
  assert.match(h,/4ページのうち4ページひらいた/);
  // もどってきた人にも、どのアプリへも行ける（とじた島の中にもリンクはある）
  for(const a of PA.APPS) assert.ok(h.includes(`href="${a.href||a.id+'.html'}"`),a.id);
  // じぶんでとじた島（'home-units'）はとじたまま
  PA.store.set('home-units',{u2:false});
  h=renderHome(mem).__html;
  assert.ok(!/data-d="stage-u2"[^>]* open>/.test(h));
  // つづきがクイズなら、にがての調を3もん
  PA.store.set('last-learn',null);
  PA.store.set('last-practice',{app:'chord-quiz',t:Date.now()});
  h=renderHome(mem,{},"PA.weakSummary=function(){return [{quiz:'chord-quiz',title:'和音クイズ',id:'M0',name:'ハ長調',mastery:'weak'}];};").__html;
  assert.match(h,/class="go" href="chord-quiz\.html"/);
  assert.match(h,/にがてを3もん（和音クイズ）/);
  assert.match(h,/href="chord-quiz\.html\?[^"]*n=3/);
  // iOS アプリ：ホーム画面とランキングのおしらせは出さない
  h=renderHome(mem,{protocol:'capacitor:'}).__html;
  assert.ok(!/ホーム画面に追加/.test(h)); assert.ok(!/ランキング/.test(h));
  assert.match(h,/support\.html/); assert.match(h,/privacy\.html/);
});
