// 和音クイズ（chord-quiz.html）のレビューのなおし
// ・⏱ 12の調：画面をはなれたら（タブをかえる・画面をロック・アプリをうしろへ）はかるのをやめる（はなれていた時間が足されない）
// ・⏱ スタートしたら、フォーカスはひくけんばんへ。「さいしょから」は2回おす（1回でそれまでの時間がきえない）
// ・がくふの問題の見出し：「ハ長調の、」をひとかたまりに（「の、」から行がはじまらない）
// ・がくふで転回形：転回形は④「和音をもっと知ろう」でならうので、はじめての子へ「和音のかたち」へのリンク
// ・ステップのいちらん：ならびのあとのステップは「もっと」「ぜんぶの調」（まえの段階にもどったように見えない）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'chord-quiz.html'),'utf8');
const js=html.match(/<script>\n(\/\* 和音クイズ[\s\S]*?)<\/script>/)[1];

function openPage(search,mem=new Map()){
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){},querySelectorAll:function(){return [];}};};'
    +'var PA_FOCUS=[];document.querySelector=function(s){if(/data-sk="kb"/.test(s)) return {focus:function(o){PA_FOCUS.push([s,o]);}};return null;};\n';
  const core=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
  const P=loadPA(stub+core+'\nwindow.scrollTo=function(){};PA.paint=function(el,h,sig){if(sig!=="bar"){PA.__html=h;}else PA.__bar=h;};'
    +'document.addEventListener=function(t,f){if(t==="click")PA.__click=f;if(t==="visibilitychange")PA.__vis=f;};'
    +'window.addEventListener=function(t,f){if(t==="pagehide")PA.__pagehide=f;};\n'+js
    +'\nPA.__Q=Q;PA.__CR=CR;PA.__doc=document;PA.__focus=function(){return PA_FOCUS;};',{storage:mem,search});
  P.click=(act,v)=>P.__click({target:{closest:()=>({dataset:{act,v},disabled:false})}});
  return P;
}
const plain=h=>h.replace(/<[^>]+>/g,'');

test('⏱ 12の調：画面をはなれたら、はかるのをやめる（はなれていた時間が足されない）',async()=>{
  const P=openPage('?cat=chromatic&keyset=major'), CR=P.__CR;
  assert.equal(typeof P.__vis,'function'); assert.equal(typeof P.__pagehide,'function');
  P.click('crstart'); assert.equal(CR.phase,'run');
  const tok=CR.tok;
  // 見えているあいだの visibilitychange ではやめない
  P.__vis(); assert.equal(CR.phase,'run');
  // 画面をはなれた
  P.__doc.hidden=true; P.__vis(); P.__doc.hidden=false;
  assert.equal(CR.phase,'idle'); assert.equal(CR.run,null); assert.ok(CR.tok>tok,'タイマーのくりかえしもとまる（tok がかわる）');
  assert.equal(CR.left,true);
  assert.match(P.__html,/とちゅうで画面をはなれたので、はかるのをやめたよ/);
  assert.match(P.__bar,/data-act="crstart"/);
  // タイマー（100ms ごと）がもうのこっていない：まってから時計の字をかえない
  await new Promise(r=>setTimeout(r,250));
  assert.equal(CR.phase,'idle');
  // もういちどスタートすると、おしらせはけす
  P.click('crstart'); assert.equal(CR.phase,'run'); assert.equal(CR.left,false);
  assert.ok(!/とちゅうで画面をはなれた/.test(P.__html));
  // pagehide でもやめる
  P.__pagehide(); assert.equal(CR.phase,'idle'); assert.equal(CR.left,true);
  // おわったあと（done）は、はなれてもけっかをのこす
  P.click('crstop'); assert.equal(CR.phase,'idle');
  P.click('crstart'); CR.phase='done'; P.__doc.hidden=true; P.__vis(); P.__doc.hidden=false;
  assert.equal(CR.phase,'done');
});

test('⏱ 12の調：スタートしたらフォーカスはけんばんへ。「さいしょから」は2回おす',()=>{
  const P=openPage('?cat=chromatic&keyset=minor');
  P.click('crstart');
  const f=P.__focus();
  assert.equal(f.length,1,'けんばんへフォーカス');
  assert.match(f[0][0],/#view \[data-sk="kb"\] \[data-m\]\[tabindex="0"\]/);
  assert.equal(f[0][1].preventScroll,true);
  assert.match(P.__bar,/data-act="crrestart" data-confirm="もう1回おす"/);
  assert.ok(!/data-act="crstop" data-confirm/.test(P.__bar),'やめるはそのまま');
  P.click('crstop'); assert.equal(P.__CR.phase,'idle'); // タイマーをとめる
});

test('がくふの問題の見出し：「ハ長調の、」はひとかたまり',()=>{
  for(const cat of ['staff','inv']){
    const P=openPage('?cat='+cat+'&keyset=major');
    assert.equal(P.__Q.dr.cat,cat);
    assert.match(P.__html,/<div class="qtitle"><span class="tg"><span class="qkey">[^<]+<\/span><span>の、<\/span><\/span><span>この和音は？/,cat);
  }
  assert.match(html,/\.qtitle \.tg\{display:inline-flex/,'.tg はひとかたまり（折りかえさない）');
});

test('がくふで転回形：はじめての子へ「和音のかたち（転回形）」へのリンク（問題とステップのいちらん）',()=>{
  const P=openPage('?cat=inv&keyset=major');
  assert.match(P.__html,/<a class="btn small" href="inversion\.html" data-go="inversion"><span aria-hidden="true">🔄<\/span> 転回形がはじめてなら：和音のかたち ›<\/a>/);
  const S=openPage('?cat=staff&keyset=major');
  assert.ok(!/href="inversion\.html"/.test(S.__html),'ほかの問題には出さない');
  // ステップのいちらん（長調はステップ8、短調はステップ10）
  for(const [ks,n] of [['major',8],['minor',10]]){
    const L=openPage('?keyset='+ks);
    assert.match(L.__html,new RegExp(`ステップ${n}（がくふで転回形）がはじめてなら、さきに<a href="inversion\\.html">和音のかたち（転回形）</a>を見てね`),ks);
  }
  // できたら出さない
  const mem=new Map([['pianoapps.chord-quiz-steps',JSON.stringify({'major:inv-easy':5})]]);
  assert.ok(!/href="inversion\.html"/.test(openPage('?keyset=major',mem).__html));
});

test('ステップのいちらん：ならびのあとは「もっと」「ぜんぶの調」。見出しの矢印もおなじ',()=>{
  const want={
    major:['まねる','うめる','うめる','つくる','つくる','つくる','べつの出しかた','べつの出しかた','べつの出しかた','ならび','もっと','ぜんぶの調','すらすら'],
    minor:['まねる','まねる','うめる','うめる','うめる','つくる','つくる','つくる','べつの出しかた','べつの出しかた','べつの出しかた','ならび','もっと','ぜんぶの調','すらすら']
  };
  for(const ks of ['major','minor']){
    const P=openPage('?keyset='+ks);
    const got=[...P.__html.matchAll(/<span class="stg">([^<]*)<\/span>/g)].map(m=>m[1]);
    assert.deepEqual(got,want[ks],ks);
    assert.match(plain(P.__html),/まねる → うめる → つくる → べつの出しかた → ならび → もっと → すらすら/);
  }
});
