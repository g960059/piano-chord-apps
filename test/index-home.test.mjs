// ホーム（index.html）：ぼうけんの地図（基本①〜⑥）・耳のひろば・レベルアップの地図、と PA.mountBar のきろく
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

const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('index.html：目次は core の PA.UNITS・PA.APPS をつかう',()=>{
  assert.ok(!/const (CATS|TYPES)\s*=/.test(page),'ページの中に目次をもたない');
  assert.match(page,/PA\.UNITS/); assert.match(page,/PA\.APP_TYPES/); assert.match(page,/PA\.weakSummary/);
  assert.ok(!/\?\.|\?\?/.test(page.replace(/<style>[\s\S]*?<\/style>/,'')),'iOS 12でうごかない ?. ?? をつかわない');
  assert.ok(!/waon-kikiwake/.test(page),'外のランキングのカードはもうない');
  assert.ok(!/クイズだけあそぶ/.test(page),'「クイズだけあそぶ」はなくした（先生：わかりにくい）');
  assert.ok(!/半減七/.test(page));
});

// ホームの<script>を core のあとにうごかして、PA.paint にわたる HTML を見る（extra＝ホームの前に入れるコード）
function renderHome(mem,opts={},extra=''){
  const js=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){}};};document.querySelector=function(){return {};};\n';
  const core=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
  return loadPA(stub+core+'\nPA.paint=function(el,h,sig){PA.__html=h;PA.__sig=sig;};\n'+extra+'\n'+js,{storage:mem,...opts});
}
// 島（<details class="stage …" data-d="stage-ID">）の HTML
const stageOf=(h,id)=>{const m=h.match(new RegExp(`<details class="stage [^"]*" data-d="stage-${id}"[\\s\\S]*?</details>`));return m?m[0]:'';};
const cls=(h,id)=>{const m=h.match(new RegExp(`<details class="(stage [^"]*)" data-d="stage-${id}"`));return m?m[1]:'';};
// 調のきろくをつくる（ids の調を「できた」に、または1回だけこたえたことに）
const goodStats=ids=>Object.fromEntries(ids.map(id=>[id,{right:3,wrong:0,hint:0,last:1,recent:'ooo'}]));
const triedStats=ids=>Object.fromEntries(ids.map(id=>[id,{right:0,wrong:1,hint:0,last:1,recent:'x'}]));
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+i);

test('index.html：はじめての人には「長調の4つの和音から始めよう」。どのアプリにも行ける',()=>{
  const PA=renderHome(new Map());
  const h=PA.__html;
  assert.equal(PA.__sig,'home');
  assert.match(h,/class="card hero"/);
  assert.match(h,/長調の4つの和音から始めよう/);
  assert.match(h,/class="btn" href="chord-build\.html"/);
  for(const a of PA.APPS) assert.ok(h.includes(`href="${a.id}.html`),a.id);
  // 基本の島は kind basic の単元（①〜⑥）。🐸 はさいしょの島に
  const basic=PA.UNITS.filter(u=>u.kind==='basic');
  assert.equal(basic.length,6);
  assert.equal((h.match(/<details class="stage /g)||[]).length,basic.length);
  assert.match(h,/<details class="stage l here" data-d="stage-major"[^>]* open>/);
  assert.match(h,/①<\/span>長調の4つの和音/); assert.match(h,/②<\/span>短調の4つの和音/); assert.match(h,/③<\/span>短調のⅤ9と減七/);
  // 和音クイズは①と②に、それぞれの href で
  assert.match(stageOf(h,'major'),/href="chord-quiz\.html\?keyset=major"/);
  assert.match(stageOf(h,'minor'),/href="chord-quiz\.html\?keyset=minor"/);
  assert.ok(!/コース/.test(h),'「コース」ということばはつかわない');
  assert.ok(!/class="qz"/.test(h)&&!/クイズだけあそぶ/.test(h));
  // 耳のひろばはカード（つづきの下・地図の上）。きょうの5もんは ear.html?n=5
  assert.ok(h.indexOf('class="card plaza"')<h.indexOf('class="card map"'));
  assert.ok(h.indexOf('class="card hero"')<h.indexOf('class="card plaza"'));
  assert.match(h,/class="today" href="ear\.html\?n=5"/);
  assert.match(h,/href="progression\.html"/);
  // 2列のボタンは、ことばのとちゅうで折りかえさない（「の」のあとだけ）
  assert.match(h,/和音の<wbr>聴きわけ/); assert.match(h,/ならびの<wbr>聴きわけ/);
  assert.match(page,/\.plaza \.ways a\{[^}]*word-break:keep-all/);
  assert.match(h,/href="ear\.html\?mode=challenge"/);
  assert.match(h,/まだきろくはないよ/);
  // レベルアップの地図は地図の下で、はじめはとじている。先生のじゅん
  assert.ok(h.indexOf('class="card xmap"')>h.indexOf('class="card map"'));
  assert.match(h,/<details class="card xmap" data-d="xmap-extra" data-u="extra">/);
  const x=h.slice(h.indexOf('class="card xmap"'));
  const order=['doppel','secondary','borrowed','neapolitan','dorian','aug6','enharmonic','chroma-quiz'].map(id=>x.indexOf(`href="${id}.html"`));
  assert.ok(order.every((v,i)=>v>0&&(i===0||v>order[i-1])),String(order));
  // ひらいていないので ★ はなし
  assert.ok(!/<span class="on">★/.test(h));
  assert.match(h,/support\.html/); assert.match(h,/privacy\.html/); assert.match(h,/ホーム画面に追加/); assert.match(h,/ランキング/);
});

test('index.html：★ は開いただけでは1つ。その調で5もんやって★★、ステップぜんぶ✓かぜんぶの調ができて★★★',()=>{
  const mem=new Map();
  let PA=renderHome(mem);
  PA.store.set('visited',{'chord-build':1,'chord-quiz':2,'cadence':3,'chord-table':4,'diatonic':5});
  let h=renderHome(mem).__html;
  // 開いただけ：①は4つとも★1つ。クリアではない
  assert.ok(!/stage[^"]*done[^"]*" data-d="stage-major"/.test(h));
  assert.match(stageOf(h,'major'),/aria-label="ほし3こ中1こ"/);   // 和音クイズ
  assert.match(stageOf(h,'major'),/aria-label="ほし2こ中1こ"/);   // 和音のしくみ（練習クイズあり）
  assert.match(stageOf(h,'major'),/aria-label="ほし9こ中4こ"/);   // 島ぜんぶ（3＋2＋2＋2）
  // 練習の問題がないページ（7つの和音）は★まで
  assert.match(stageOf(h,'more'),/href="diatonic\.html"[\s\S]*?aria-label="ほし1こ中1こ"/);
  // 長調で4もんだけ → まだ★（★★は5もんやったとき）
  PA.store.set('keystats-chord-quiz',triedStats(ids('M',4)));
  h=renderHome(mem).__html;
  assert.ok(!/done/.test(cls(h,'major')));
  assert.match(stageOf(h,'major'),/aria-label="ほし9こ中4こ"/);
  // 短調で5もん → ①のしくみ・カデンツ・いちらん表は★のまま（島の調＝長調の記録だけ）
  PA.store.set('keystats-chord-quiz',triedStats(ids('m',5)));
  h=renderHome(mem).__html;
  assert.ok(!/done/.test(cls(h,'major')));
  assert.match(stageOf(h,'major'),/href="chord-build\.html"[\s\S]*?aria-label="ほし2こ中1こ"/);
  // 長調で5もんこたえた → ①の和音クイズ・しくみ・カデンツ・いちらん表が★★、①はクリア。②の和音クイズ（短調）はひらいていない（☆）
  PA.store.set('keystats-chord-quiz',triedStats(ids('M',5)));
  PA.store.set('chord-quiz',{keyset:'major',q:{minor:false,keyIdx:0,chord:'I'}});
  h=renderHome(mem).__html;
  assert.match(cls(h,'major'),/done/);
  assert.match(stageOf(h,'major'),/クリア！/);
  assert.match(stageOf(h,'major'),/aria-label="ほし9こ中8こ"/);
  assert.match(stageOf(h,'minor'),/href="chord-quiz\.html\?keyset=minor"[\s\S]*?aria-label="ほし3こ中0こ"/,'長調しかひらいていない → ②の和音クイズに★はつかない');
  // 長調の6調が「できた」→ まだ★★（先生の目標は全部の調）
  PA.store.set('keystats-chord-quiz',goodStats(ids('M',6)));
  h=renderHome(mem).__html;
  assert.match(stageOf(h,'major'),/href="chord-quiz\.html\?keyset=major"[\s\S]*?aria-label="ほし3こ中2こ"[\s\S]*?できた調6／12/);
  // 長調のぜんぶの調が「できた」→ ★★★
  PA.store.set('keystats-chord-quiz',goodStats(ids('M',13)));
  h=renderHome(mem).__html;
  assert.match(stageOf(h,'major'),/href="chord-quiz\.html\?keyset=major"[\s\S]*?aria-label="ほし3こ中3こ"[\s\S]*?できた調12／12/);
  assert.match(stageOf(h,'major'),/aria-label="ほし9こ中9こ"/);
  // ステップ：1つおえたら★★（こたえの数が5より少なくても）。ステップがぜんぶ ✓ なら★★★。ホームにステップの数も出す
  PA.store.set('keystats-chord-quiz',{});
  PA.store.set('chord-quiz-steps',{'major:root-easy':3});
  h=renderHome(mem).__html;
  assert.match(stageOf(h,'major'),/href="chord-quiz\.html\?keyset=major"[\s\S]*?aria-label="ほし3こ中2こ"[\s\S]*?ステップ✓0／13/);
  const all=Object.fromEntries(Array.from({length:PA.STEP_INFO['chord-quiz'].major},(_,i)=>['major:s'+i+'-easy',4]));
  PA.store.set('chord-quiz-steps',all);
  h=renderHome(mem).__html;
  assert.match(stageOf(h,'major'),/href="chord-quiz\.html\?keyset=major"[\s\S]*?aria-label="ほし3こ中3こ"[\s\S]*?ステップ✓13／13/);
  assert.match(stageOf(h,'minor'),/href="chord-quiz\.html\?keyset=minor"[\s\S]*?aria-label="ほし3こ中0こ"/,'長調のステップは②に入れない');
});

test('index.html：和音クイズの短調だけをやった子 → 🐸 は②。①の和音クイズに★★はつかない',()=>{
  const mem=new Map();
  let PA=renderHome(mem);
  const now=Date.now();
  // ホームの②から ?keyset=minor&step=3 だけをといた（ほぞんの keyset は長調のまま・とちゅうの回は短調）
  PA.store.set('visited',{'chord-quiz':now});
  PA.store.set('last-practice',{app:'chord-quiz',t:now});
  PA.store.set('keystats-chord-quiz-fill',triedStats(ids('m',3)));
  PA.store.set('chord-quiz',{keyset:'major',view:'quiz',run:{keyset:'minor',step:'minor:fill-easy'},q:{minor:true,keyIdx:0,chord:'I'}});
  let h=renderHome(mem).__html;
  assert.match(cls(h,'minor'),/here/); assert.ok(!/here/.test(cls(h,'major')));
  assert.match(stageOf(h,'minor'),/href="chord-quiz\.html\?keyset=minor"[\s\S]*?aria-label="ほし3こ中1こ"/);
  assert.match(stageOf(h,'major'),/href="chord-quiz\.html\?keyset=major"[\s\S]*?aria-label="ほし3こ中1こ"/,'ほぞんの keyset が長調なので①は★（見た）だけ');
  // いちらんで短調を見ている（view＝steps）→ ②
  PA.store.set('chord-quiz',{keyset:'major',view:'steps',stepsKs:'minor'});
  h=renderHome(mem).__html;
  assert.match(cls(h,'minor'),/here/);
  // ほぞんにてがかりがないときは、さいごにこたえた調（keystats の last）
  PA.store.set('chord-quiz',{});
  PA.store.set('keystats-chord-quiz',{M0:{right:1,wrong:0,hint:0,last:now-9e5,recent:'o'}});
  PA.store.set('keystats-chord-quiz-fill',{m0:{right:1,wrong:0,hint:0,last:now-1e3,recent:'o'}});
  h=renderHome(mem).__html;
  assert.match(cls(h,'minor'),/here/);
  PA.store.set('keystats-chord-quiz',{M0:{right:1,wrong:0,hint:0,last:now,recent:'o'}});
  h=renderHome(mem).__html;
  assert.match(cls(h,'major'),/here/);
});

test('index.html：🐸 はさいごにやった島。クリアした島からは先へ。とじた島・ゴール',()=>{
  const mem=new Map();
  let PA=renderHome(mem);
  const now=Date.now();
  // ①を見て、さいごに③（Ⅴの家族）を見た → 🐸 は③（まだひらいていない②へはもどらない）
  PA.store.set('visited',{'chord-build':now-5e3,'minor-family':now-1e3});
  PA.store.set('last-learn',{app:'minor-family',t:now-1e3});
  let h=renderHome(mem).__html;
  assert.match(cls(h,'minor9'),/here/);
  assert.ok(!/here/.test(cls(h,'major'))&&!/here/.test(cls(h,'minor')));
  assert.match(h,/<details class="stage l here" data-d="stage-minor9"[^>]* open>/);
  assert.match(stageOf(h,'minor9'),/いまここ/);
  // さいごが和音クイズで①がクリアずみなら、和音クイズのもう1つの島（②）
  PA.store.set('visited',{'chord-build':now-5e3,'chord-quiz':now-2e3,'cadence':now-4e3,'chord-table':now-3e3});
  PA.store.set('last-learn',null);
  PA.store.set('last-practice',{app:'chord-quiz',t:now-2e3});
  PA.store.set('keystats-chord-quiz',triedStats(ids('M',5)));
  h=renderHome(mem).__html;
  assert.match(cls(h,'major'),/done/);
  assert.match(cls(h,'minor'),/here/);
  // さいごが①のページでも、①がクリアなら つぎのまだクリアしていない島へ
  PA.store.set('last-practice',null);
  PA.store.set('last-learn',{app:'chord-build',t:now});
  h=renderHome(mem).__html;
  assert.match(cls(h,'minor'),/here/);
  // つづきから・練習のすすめ
  assert.match(h,/class="go" href="chord-build\.html"/);
  assert.match(h,/和音クイズでれんしゅう/);
  // どのアプリへも行ける（とじた島の中にもリンクはある）
  for(const a of PA.APPS) assert.ok(h.includes(`href="${a.id}.html`),a.id);
  // じぶんでとじた島（'home-units'）はとじたまま。レベルアップの地図はじぶんでひらいたらひらいたまま
  PA.store.set('home-units',{minor:false,extra:true});
  h=renderHome(mem).__html;
  assert.ok(!/data-d="stage-minor"[^>]* open>/.test(h));
  assert.match(h,/data-d="xmap-extra" data-u="extra" open>/);
  // レベルアップのページをさいごにやったら、その地図はひらく（🐸 は基本の地図のまま）
  PA.store.set('home-units',{});
  PA.store.set('visited',{'chord-build':now-5e3,'doppel':now});
  PA.store.set('last-learn',{app:'doppel',t:now});
  PA.store.set('keystats-chord-quiz',{});
  h=renderHome(mem).__html;
  assert.match(h,/data-d="xmap-extra" data-u="extra" open>/);
  assert.match(cls(h,'major'),/here/);
  // ぜんぶの島をクリア → 🐸 はゴール
  const all={}; PA.APPS.forEach(a=>{all[a.id]=now;});
  PA.store.set('visited',all);
  PA.store.set('keystats-chord-quiz',triedStats([...ids('M',5),...ids('m',5)]));
  PA.store.set('keystats-minor-quiz',triedStats(ids('m',5)));
  PA.store.set('keystats-ending-quiz',triedStats(ids('M',5)));
  PA.store.set('accompaniment',{choices:{mary:['I',null]}});
  h=renderHome(mem).__html;
  for(const u of PA.UNITS.filter(u=>u.kind==='basic')) assert.match(cls(h,u.id),/done/,u.id);
  assert.ok(!/<details class="stage [^"]*here/.test(h));
  assert.match(h,/class="goal [lr] here"/);
});

test('index.html：🐸 がうつった島へは1回だけおりてくる（.arrive は🐸の span だけ。ずっとはねない）',()=>{
  const mem=new Map();
  const frogs=h=>h.match(/<span class="frog[^"]*">🐸<\/span>/g)||[];
  // はじめて：うごかない。いまの島をおぼえる
  let PA=renderHome(mem), h=PA.__html;
  assert.deepEqual(frogs(h),['<span class="frog">🐸</span>']);
  assert.equal(PA.store.get('home-frog',null),'major');
  // おなじ島のまま描きなおし：うごかない
  h=renderHome(mem).__html;
  assert.ok(!/arrive/.test(h));
  // つぎの島へうつった：その島の🐸だけ .arrive。島（details）や看板の class にはつけない
  const now=Date.now();
  PA.store.set('visited',{'chord-build':now-5e3,'minor-family':now-1e3});
  PA.store.set('last-learn',{app:'minor-family',t:now-1e3});
  h=renderHome(mem).__html;
  assert.deepEqual(frogs(h),['<span class="frog arrive">🐸</span>']);
  assert.match(stageOf(h,'minor9'),/class="frog arrive"/);
  assert.match(cls(h,'minor9'),/^stage [lr] here$/);
  assert.equal((h.match(/arrive/g)||[]).length,1);
  assert.equal(PA.store.get('home-frog',null),'minor9');
  // もういちど見ても（設定をかえた・もどってきた）1回きり
  h=renderHome(mem).__html;
  assert.deepEqual(frogs(h),['<span class="frog">🐸</span>']);
  // CSS：くりかえしのうごき（hop・twinkle）はもうない。へらす設定ではふわっと出るだけ
  assert.ok(!/infinite/.test(page)&&!/@keyframes (hop|twinkle)/.test(page));
  assert.match(page,/\.isle \.frog\.arrive\{animation:pa-frog-land 600ms var\(--ease-out\) 150ms both\}/);
  assert.match(page,/prefers-reduced-motion:reduce\)\{\.isle \.frog\.arrive\{animation-name:pa-frog-fade\}/);
  assert.match(page,/@keyframes pa-frog-fade\{from\{opacity:0\}\}/);
});

test('index.html：耳のひろばのきろく・とちゅうの5もん・にがて・iOS アプリ',()=>{
  const mem=new Map();
  let PA=renderHome(mem);
  const now=Date.now();
  PA.store.set('visited',{'ear':now});
  PA.store.set('last-practice',{app:'ear',t:now});
  PA.store.set('ear',{v:4,right:12,total:15,streak:2,ch:{best:3}});
  PA.store.set('progression',{v:1,step:1,rec:{1:{right:5,hint:0,total:6,streak:2,best:4}}});
  PA.store.set('session-ear',{n:5,done:[{ok:true,hint:false,label:'a'},{ok:false,hint:false,label:'b'}],startedAt:now,sig:''});
  let h=renderHome(mem).__html;
  assert.match(h,/チャレンジ：レベル3までクリア/);
  assert.match(h,/和音の聴きわけ：12もん正解/);
  assert.match(h,/ならび：さいこう4もんれんぞく正解/);
  assert.match(h,/class="today" href="ear\.html\?n=5"[\s\S]*?とちゅうから（2 \/ 5）/);
  assert.ok(!/まだきろくはないよ/.test(h));
  // つづきがクイズなら、にがての調を3もん
  PA.store.set('last-practice',{app:'chord-quiz',t:now});
  h=renderHome(mem,{},"PA.weakSummary=function(){return [{quiz:'chord-quiz',title:'和音クイズ',id:'M0',name:'ハ長調',mastery:'weak'}];};").__html;
  assert.match(h,/class="go" href="chord-quiz\.html"/);
  assert.match(h,/にがてを3もん（和音クイズ）/);
  assert.match(h,/href="chord-quiz\.html\?[^"]*n=3/);
  // iOS アプリ：ホーム画面とランキングのおしらせは出さない（チャレンジはある）
  h=renderHome(mem,{protocol:'capacitor:'}).__html;
  assert.ok(!/ホーム画面に追加/.test(h)); assert.ok(!/ランキング/.test(h));
  assert.match(h,/href="ear\.html\?mode=challenge"/);
  assert.match(h,/support\.html/); assert.match(h,/privacy\.html/);
});

test('ear.html：ホームの「きょうの5もん」（?n=5）と「チャレンジ」（?mode=challenge）のリンクをよめる',()=>{
  const ear=fs.readFileSync(path.join(root,'ear.html'),'utf8');
  const fn=ear.match(/function readLink\(p\)\{[\s\S]*?\n\}/)[0];
  const readLink=new Function(fn+';return readLink;')();
  assert.deepEqual(readLink({n:'5'}),{mode:'free',level:null,n:5});
  assert.deepEqual(readLink({mode:'challenge'}),{mode:'ch',level:null,n:null});
});
