// 伴奏づけ（accompaniment.html）の テスト：node --test test/
// ページの <script> を ブラウザなしで 読みこみ（PA.mountBar より 前＝関数と データだけ）、
// リンクの パラメータ・マスの 読み上げ・つぎへ／もどす・少しずつ 鳴らす しくみ を たしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const CORE=fs.readFileSync(path.join(dir,'..','assets','core.js'),'utf8');
const HTML=fs.readFileSync(path.join(dir,'..','accompaniment.html'),'utf8');
const PAGE=(()=>{
  const all=[...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  const cut=all.indexOf("PA.mountBar({title:'伴奏づけ'");
  assert.ok(cut>0,'PA.mountBar が 見つからない');
  return all.slice(0,cut);
})();

// 時計と タイマーを じぶんで すすめる 小さな 世界
function world(search=''){
  const mem=new Map(), noop=()=>{};
  let now=0, seq=0; const timers=new Map();
  const ctx={
    console:{log:noop,warn:noop,error:noop},
    document:{documentElement:{},addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,hidden:false,body:{},contains:()=>false},
    localStorage:{getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>{mem.set(k,String(v));},removeItem:k=>{mem.delete(k);},key:i=>[...mem.keys()][i]||null,get length(){return mem.size;}},
    navigator:{},matchMedia:()=>({matches:false}),CSS:{escape:s=>String(s)},
    location:{href:'http://example.test/accompaniment.html'+search,search,protocol:'http:',origin:'http://example.test'},
    URL,Date:{now:()=>now*1000},
    setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,at:now+(ms||0)/1000});return id;},
    clearTimeout:id=>{timers.delete(id);},
  };
  ctx.window=ctx; ctx.addEventListener=noop;
  vm.createContext(ctx);
  vm.runInContext(CORE,ctx,{filename:'core.js'});
  vm.runInContext(PAGE,ctx,{filename:'accompaniment.html'});
  const run=src=>vm.runInContext(src,ctx);
  run('render=function(){}; renderPlayback=function(){}; followSlot=function(){}; scrollSelIntoView=function(){}');
  // 時間を すすめて、その間の タイマーを じゅんに うごかす
  const advance=sec=>{
    const end=now+sec;
    for(;;){
      let best=null; timers.forEach((t,id)=>{if(t.at<=end&&(!best||t.at<best.t.at)) best={id,t};});
      if(!best) break;
      timers.delete(best.id); now=Math.max(now,best.t.at); best.t.fn();
    }
    now=end;
  };
  return {ctx,run,advance,timers,get now(){return now;}};
}

test('スクリプトに ?. と ?? が ない（iOS Safari 12）',()=>{
  const code=PAGE.replace(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g,'""');
  assert.ok(!/\?\./.test(code.replace(/\?\.\d/g,'')),'?. が ある');
  assert.ok(!/\?\?/.test(code),'?? が ある');
});

test('リンク：?song=twinkle&key=M1 で きらきら星・ト長調',()=>{
  const w=world('?song=twinkle&key=M1');
  w.run('load(); applyLink();');
  assert.equal(w.run('state.songId'),'twinkle');
  assert.equal(w.run('state.keyIdx'),1);
  assert.equal(w.run('PA.keyName(curKey())'),'ト長調');
  assert.deepEqual(JSON.parse(w.run('JSON.stringify(shareParams())')),{song:'twinkle',key:'M1'});
});

test('リンク：ちがう 値は つかわない（短調・ない 曲・はんいの 外）',()=>{
  for(const q of ['?song=%3Cscript%3E&key=m3','?song=toString&key=M13','?key=M01','?song=&key=','?song=constructor']){
    const w=world(q);
    w.run('load(); applyLink();');
    assert.equal(w.run('state.songId'),'mary',q);
    assert.equal(w.run('state.keyIdx'),0,q);
  }
});

test('マスの 読み上げ：小節・えらんだ 和音・◎○×',()=>{
  const w=world();
  w.run("state.songId='mary'");
  assert.equal(w.run("slotAria(curSong(),2,'IV','good',false)"),'3小節目、Ⅳ を えらんだ（○ これでも 合う）');
  assert.equal(w.run("slotAria(curSong(),0,'I','best',false)"),'1小節目、Ⅰ を えらんだ（◎ おてほんと おなじ）');
  assert.equal(w.run("slotAria(curSong(),1,null,null,false)"),'2小節目、まだ えらんでいない');
  assert.equal(w.run("state.reveal=true; slotAria(curSong(),2,'IV','bad',false)"),'3小節目、Ⅳ を えらんだ（× 合わない。おてほんは Ⅴ7）');
  // 2拍ずつの 曲は 前半・後半
  assert.equal(w.run("state.songId='twinkle'; slotAria(curSong(),1,'I',null,false)"),'1小節目の 後半、Ⅰ を えらんだ');
});

test('えらんでも すすまない（はじめは オフ）・オンなら すすむ・ほぞんした 設定を つかう',()=>{
  const w=world();
  w.run("load(); state.autoPlay=false; state.sel=0; pick('I'); pick('IV');");
  assert.equal(w.run('state.autoNext'),false);
  assert.equal(w.run('state.sel'),0);
  assert.equal(w.run('choices()[0]'),'IV');
  w.run("moveSel(1)"); assert.equal(w.run('state.sel'),1);
  w.run("moveSel(-5)"); assert.equal(w.run('state.sel'),0);
  w.run("state.autoNext=true; save(); pick('I')");
  assert.equal(w.run('state.sel'),1);
  // ほぞんした オンは よみなおしても オン
  w.run("state.autoNext=false; load();");
  assert.equal(w.run('state.autoNext'),true);
});

test('↩ ひとつ もどす：なんかいも もどせる・ぜんぶ けすも もどせる・曲ごと',()=>{
  const w=world();
  w.run("load(); state.autoPlay=false; state.sel=0; pick('I'); pick('IV'); pick('V7'); pick('V7');"); // おなじ 和音は きろくしない
  assert.equal(w.run('histOf(state.songId).length'),3);
  w.run('undo()'); assert.equal(w.run('choices()[0]'),'IV');
  w.run('undo()'); assert.equal(w.run('choices()[0]'),'I');
  w.run('undo()'); assert.equal(w.run('choices()[0]'),null);
  assert.equal(w.run('canUndo()'),false);
  w.run("state.sel=2; pick('V7'); state.sel=5; pick('I');");
  // 🧽 ぜんぶ けす と おなじ ことを して もどす
  w.run("pushHist({all:choices().slice(),sel:state.sel}); state.choices[curSong().id]=Array(curSong().slots.length).fill(null); state.sel=0;");
  w.run('undo()');
  assert.equal(w.run('choices()[2]'),'V7'); assert.equal(w.run('choices()[5]'),'I'); assert.equal(w.run('state.sel'),5);
  // ほかの 曲の きろくとは べつ
  w.run("state.songId='london'"); assert.equal(w.run('canUndo()'),false);
  w.run("state.songId='mary'"); assert.equal(w.run('canUndo()'),true);
});

test('再生：先の 1.2秒ぶん だけ 用意し、すすむと たす。とめると もう 鳴らない',()=>{
  const w=world();
  // 音の 時計（ctx の Date と おなじ 時間で すすむ）と 鳴らした 音の きろく
  w.run(`var __played=[]; var __ac={state:'running',get currentTime(){return Date.now()/1000;}};
    PA.audio=function(){return __ac;}; PA.playNote=function(m,when,d,v){__played.push({m:m,at:Date.now()/1000+when});}; PA.stopSound=function(){};
    load(); state.songId='alps'; state.tempo=120; state.autoPlay=false;
    curSong().slots.forEach(function(sl,i){choices()[i]=sl.ans;});`);
  w.run('playRange(0,curSong().slots.length-1,false,true)');
  const first=w.run('__played.length');
  const total=w.run('(function(){var n=0;curSong().slots.forEach(function(sl,i){n+=sounding(sl.notes).length+accEvents(curKey(),choices()[i],curSong().slotBeats,curSong().meter,0).reduce(function(a,e){return a+e.ms.length;},0);});return n;})()');
  assert.ok(first>0&&first<total/4,`はじめに 用意した 音 ${first}／${total}`);
  assert.ok(w.run('__played.every(function(p){return p.at<=1.2+0.3+0.01;})'),'1.5秒より 先の 音を 用意していない');
  w.advance(3);
  const mid=w.run('__played.length');
  assert.ok(mid>first,'すすむと たす');
  assert.ok(w.run('state.play&&state.play.slot>=1'),'光る 場所が すすむ');
  w.run('stopPlay()');
  assert.equal(w.timers.size,0,'タイマーが のこっていない');
  w.advance(10);
  assert.equal(w.run('__played.length'),mid,'とめたら もう 鳴らない');
  // さいごまで きくと おわる・ぜんぶの 音を 1回ずつ
  w.run('__played=[]; playRange(0,curSong().slots.length-1,false,true)');
  w.advance(200);
  assert.equal(w.run('state.play'),null);
  assert.equal(w.run('__played.length'),total);
  assert.equal(w.timers.size,0);
});

test('再生：メロディー・伴奏の オン・オフは とちゅうからでも きく',()=>{
  const w=world();
  w.run(`var __played=[]; var __ac={state:'running',get currentTime(){return Date.now()/1000;}};
    PA.audio=function(){return __ac;}; PA.playNote=function(m){__played.push(m);}; PA.stopSound=function(){};
    load(); state.songId='mary'; state.tempo=120; curSong().slots.forEach(function(sl,i){choices()[i]=sl.ans;});`);
  w.run('playRange(0,curSong().slots.length-1)');
  w.advance(1);
  w.run('state.accOn=false; __played=[];');
  w.advance(100);
  const bass=w.run('__played.filter(function(m){return m<curKey().tonicMidi-12;}).length');
  assert.equal(bass,0,'伴奏を オフに したら ベースは 鳴らない');
  assert.ok(w.run('__played.length')>0,'メロディーは 鳴る');
});
