/* iOS アプリ（Capacitor）だけのしくみ。ウェブのページには入れない（tools/build-app.mjs がアプリのページにだけ足す）
 *
 * よみこみ：<script src="assets/core.js"></script><script src="assets/native.js"></script>（ページの script より前）
 *
 * 1. きろくのひかえ：WKWebView の localStorage は、端末の空きが少ないと iOS に消されることがある。
 *    'pianoapps.' のきろくをぜんぶ、Preferences（iOS の UserDefaults）にもひかえる（キー BACKUP_KEY に JSON）。
 *    ・きろくがかわったら（PA.onStore）0.8びょうまとめて書く。ページをはなれるとき・PA.flushStore() ですぐ書く
 *    ・ひらいたとき localStorage がからっぽで、ひかえがあれば、ひかえからもどしてページを読みなおす
 *      （からっぽかどうかは、ページの script がうごく前＝ここで見る。もどすまでひかえは書かない。
 *       もどすときはひかえのほうを入れる：いま localStorage にあるのは、このページがはじめの値で書いたものだけなので） 
 * 2. 電子ピアノ（MIDI）：ネイティブの PianoMidi（ios/App/App/PianoMidiPlugin.swift。CoreMIDI で USB・Bluetooth）を
 *    PA.midi.useNative でつなぐ。ページをひらくたびに start（ネイティブ側はずっとつないだまま。ページがかわると
 *    Capacitor がイベントのうけとりをはずすので、ページごとに addListener しなおす。「もどる」でもどったページ（bfcache）も） 
 * 3. アプリにもどったとき：着信などのあと AudioContext がうごかないままになることがあるので、つくりなおす
 * 4. ふるえ（PA.haptic）：ネイティブの PianoHaptics（ios/App/App/PianoHapticsPlugin.swift）。マイクできいているあいだ・
 *    電子ピアノからの入力ではふるえない（マイクがひろう・ピアノをひいている手にはいらない）。0.08びょうに1回まで
 */
(function(){
'use strict';
const PA=window.PA, cap=window.Capacitor;
if(!PA||!PA.native||!cap||typeof cap.nativePromise!=='function') return;
const call=(plugin,method,opt)=>{try{return cap.nativePromise(plugin,method,opt||{});}catch(e){return Promise.reject(e);}};
const listen=(plugin,eventName,fn)=>{try{cap.nativeCallback(plugin,'addListener',{eventName},d=>{if(d) fn(d);});}catch(e){}};

/* ===== 1. きろくのひかえ ===== */
const BACKUP_KEY='pianoapps-backup';
const RESTORED='pianoapps-restored'; // もどして読みなおした回（sessionStorage）。もどすのは1回だけ
const wasEmpty=PA.store.keys().length===0;
let ready=!wasEmpty, dirty=false, timer=0, writing=Promise.resolve();
const write=()=>{
  clearTimeout(timer); timer=0;
  if(!ready||!dirty) return writing;
  dirty=false;
  let value; try{value=JSON.stringify(PA.backupData());}catch(e){return writing;}
  writing=writing.then(()=>call('Preferences','set',{key:BACKUP_KEY,value})).catch(()=>{dirty=true;});
  return writing;
};
PA.onStore=()=>{dirty=true;if(ready&&!timer) timer=setTimeout(write,800);};
PA.flushStore=()=>{dirty=true;return write();};
const flushSoon=()=>{if(dirty) write();};
document.addEventListener('visibilitychange',()=>{if(document.hidden) flushSoon();});
window.addEventListener('pagehide',flushSoon);
if(wasEmpty){
  call('Preferences','get',{key:BACKUP_KEY}).then(r=>{
    let data=null; try{data=r&&typeof r.value==='string'?PA.checkBackup(JSON.parse(r.value)):null;}catch(e){}
    let once=false; try{once=sessionStorage.getItem(RESTORED)==='1';}catch(e){}
    if(data&&!once){
      try{
        Object.keys(data).forEach(k=>localStorage.setItem(k,data[k]));
        sessionStorage.setItem(RESTORED,'1');
      }catch(e){ready=true;return;}
      location.reload();
      return;
    }
    ready=true; if(dirty) write();
  },()=>{ready=true;if(dirty) write();});
}else if(!PA.store.get('native-backup-v1',false)){
  PA.store.set('native-backup-v1',true); // アプリを新しくして、はじめてひらいたとき：いまのきろくをすぐひかえる
}

/* ===== 4. ふるえ ===== */
let lastHaptic=0;
PA.haptic=kind=>{
  if(PA.midiIn||(PA.mic&&PA.mic.active&&PA.mic.active())) return;
  const t=Date.now(); if(t-lastHaptic<80) return; lastHaptic=t;
  try{cap.toNative('PianoHaptics','play',{kind});}catch(e){}
};

/* ===== 2. 電子ピアノ（MIDI）と 3. アプリにもどったとき ===== */
const devs=r=>{if(r&&Array.isArray(r.devices)) PA.midi.setDevices(r.devices);};
const hook=()=>{
  listen('PianoMidi','midi',d=>{
    if(d.type==='note') PA.midi.note(!!d.on,d.note,d.velocity);
    else if(d.type==='pedal') PA.midi.pedal(!!d.on);
  });
  listen('PianoMidi','devices',devs);
  // 着信などのあと、音のしくみがうごかないままになっていたら、つくりなおす
  listen('App','resume',()=>{setTimeout(()=>{if(PA.audioStuck&&PA.audioStuck()) PA.audioReset();},700);});
};
hook();
PA.midi.useNative({
  start:()=>call('PianoMidi','start').then(devs),
  pair:()=>call('PianoMidi','showBluetooth').then(devs)
});
PA.midi.connect();
// 「もどる」でもどったページ：Capacitor がうけとりをはずしているので、つけなおして、いまの機器をきく
window.addEventListener('pageshow',e=>{if(!e.persisted) return;PA.midi.reset();hook();PA.midi.connect();});
})();
