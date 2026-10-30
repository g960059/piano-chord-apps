// iOS アプリ（Capacitor）のためのしくみのテスト：node --test test/
//   PA.native・PA.absUrl（アプリの中でも公開サイトのアドレス）・PA.midi（電子ピアノの和音）・PA.onStore・
//   tools/build-app.mjs（アプリに入れるファイル）・ear.html のランキングなし（NO_RANK）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const app=()=>loadPA(undefined,{href:'capacitor://localhost/chord-quiz.html',protocol:'capacitor:'});

test('PA.native：ウェブでは false、アプリ（capacitor:）では true',()=>{
  assert.equal(loadPA().native,false);
  assert.equal(app().native,true);
});

test('PA.absUrl・PA.shareHTML：アプリの中でも公開サイトのアドレス',()=>{
  const PA=app();
  assert.equal(PA.absUrl('ear.html?n=5'),PA.SITE+'ear.html?n=5');
  assert.equal(PA.absUrl(PA.url('chord-quiz',{key:'M1',n:3})),PA.SITE+'chord-quiz.html?key=M1&n=3');
  assert.match(PA.shareHTML('ear',{mode:'challenge'}),/data-url="https:\/\/piano-chord-apps\.g960059\.workers\.dev\/ear\.html\?mode=challenge"/);
  // ウェブはいままでどおり、いまのページの場所から
  assert.equal(loadPA().absUrl('ear.html?n=5'),'https://example.test/apps/ear.html?n=5');
});

test('PA.onStore：きろくを書くたびによばれる（アプリのひかえ用）',()=>{
  const PA=loadPA(); let n=0;
  PA.onStore=()=>{n++;};
  PA.store.set('a',1); PA.store.set('b',{x:2});
  assert.equal(n,2);
  PA.onStore=()=>{throw new Error('x');};
  assert.doesNotThrow(()=>PA.store.set('c',3)); // ひかえがこわれても、きろくは書ける
  assert.equal(PA.store.get('c'),3);
});

test('PA.midi：和音をおさえたら PA.onMidiChord が1回（低いじゅん）',async()=>{
  const PA=loadPA(); const got=[];
  PA.onMidiChord=ms=>got.push(ms);
  PA.midi.note(true,67,80); PA.midi.note(true,60,80); await sleep(20); PA.midi.note(true,64,80);
  await sleep(PA.midi.CHORD_WAIT+60);
  assert.deepEqual(got.map(a=>[...a]),[[60,64,67]]);
  assert.deepEqual([...PA.midi.held()].sort(),[60,64,67]);
  // おさえたまま、もう1つ足すと、もう1回
  PA.midi.note(true,72,80); await sleep(PA.midi.CHORD_WAIT+60);
  assert.deepEqual([...got[1]],[60,64,67,72]);
  // ベロシティ0のノートオン＝はなした。おなじ鍵のオンが2回きても1回だけ
  [60,64,67,72].forEach(m=>PA.midi.note(true,m,0));
  assert.equal(PA.midi.held().size,0);
  PA.midi.note(true,62,80); PA.midi.note(true,62,80); await sleep(PA.midi.CHORD_WAIT+60);
  assert.deepEqual([...got[2]],[62]);
  PA.midi.note(false,62,0); PA.midi.note(true,200,80); PA.midi.note(true,-1,80); // はんいの外はすてる
  assert.equal(PA.midi.held().size,0);
});

test('PA.midi：PA.onMidiChord がないページは、鍵ごとに PA.onKey（画面のけんばんとおなじ）',()=>{
  const PA=loadPA(); const keys=[];
  PA.onKey=m=>keys.push(m);
  PA.midi.note(true,60,90); PA.midi.note(true,64,90); PA.midi.note(false,60,0);
  assert.deepEqual(keys,[60,64]);
});

test('PA.midi：機器・ネイティブのつなぎかた',async()=>{
  const PA=loadPA(); let changes=0;
  PA.onMidiChange=()=>changes++;
  assert.equal(PA.midi.available(),false); // navigator.requestMIDIAccess がない（iPhone の Safari）＝⚙️ に出さない
  assert.equal(PA.midi.active(),false);
  let started=0, paired=0;
  PA.midi.useNative({start:()=>{started++;PA.midi.setDevices(['Digital Piano']);return Promise.resolve();},pair:()=>{paired++;}});
  assert.equal(PA.midi.available(),true); assert.equal(PA.midi.canPair(),true);
  assert.equal(await PA.midi.connect(),true);
  await PA.midi.pair();
  assert.equal(started,1); assert.equal(paired,1);
  assert.deepEqual(PA.midi.devices(),['Digital Piano']); assert.equal(PA.midi.active(),true);
  PA.midi.setDevices(['Digital Piano']); // おなじなら知らせない
  const c=changes;
  PA.midi.note(true,60,90);
  PA.midi.setDevices([]); // はずしたら、おさえている音もわすれる
  assert.equal(changes,c+1); assert.equal(PA.midi.held().size,0);
});

test('ear.html：アプリ（NO_RANK）ではランキングを出さず、サーバーにつながない',()=>{
  const html=fs.readFileSync(path.join(root,'ear.html'),'utf8');
  assert.match(html,/const NO_RANK=PA\.native;/);
  assert.match(html,/if\(NO_RANK\)\{PA\.stopSound\(\);chClear\(\);chBegin\(null,randomSeed\(\),true\);return;\}chConnect\(\);/);
  assert.match(html,/\.concat\(NO_RANK\?\[\]:\[\['rank',PA\.icon\('chart'\)\+'ランキング'\]\]\)/);
  assert.match(html,/if\(NO_RANK&&v==='rank'\) v='free';/);
  // 📊 ランキングへのボタンは、どれも NO_RANK のときは出さない
  const btns=html.match(/[^\n]*data-v="rank"[^\n]*/g)||[];
  btns.forEach(l=>{if(!/rkBtn=/.test(l)) assert.match(l,/NO_RANK\?''/,l.trim().slice(0,80));});
});

test('tools/build-app.mjs：アプリに入れるのは許可リストのものだけ、各ページに native.js',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'pca-app-'));
  try{
    execFileSync(process.execPath,[path.join(root,'tools','build-app.mjs'),'--out',out],{stdio:'pipe'});
    const pages=fs.readdirSync(root).filter(f=>/\.html$/.test(f));
    pages.forEach(f=>{
      const h=fs.readFileSync(path.join(out,f),'utf8');
      assert.ok(h.includes('<script src="assets/core.js"></script><script src="assets/native.js"></script>'),f);
    });
    assert.ok(fs.existsSync(path.join(out,'assets','native.js')));
    assert.ok(fs.existsSync(path.join(out,'assets','piano','C4.mp3')));
    ['src','test','tools','docs','migrations','native','sw.js','manifest.webmanifest','wrangler.jsonc','package.json','README.md',path.join('assets','og.png')]
      .forEach(f=>assert.ok(!fs.existsSync(path.join(out,f)),'入れない：'+f));
  }finally{fs.rmSync(out,{recursive:true,force:true});}
});

test('.assetsignore：native/（Xcode のプロジェクト・www）は公開しない',()=>{
  const ig=fs.readFileSync(path.join(root,'.assetsignore'),'utf8').split('\n').map(s=>s.trim());
  assert.ok(ig.includes('native/'));
  // assets/native.js はアプリだけでつかうが、公開しても害はない（PA.native でないと何もしない）
  assert.match(fs.readFileSync(path.join(root,'assets','native.js'),'utf8'),/if\(!PA\|\|!PA\.native\|\|!cap/);
});

test('iOS：プライバシーマニフェスト（UserDefaults＝CA92.1）があり、ビルドに入っている',()=>{
  const pm=fs.readFileSync(path.join(root,'native','ios','App','App','PrivacyInfo.xcprivacy'),'utf8');
  assert.match(pm,/NSPrivacyAccessedAPICategoryUserDefaults/); assert.match(pm,/CA92\.1/);
  assert.match(pm,/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  const pbx=fs.readFileSync(path.join(root,'native','ios','App','App.xcodeproj','project.pbxproj'),'utf8');
  assert.match(pbx,/PrivacyInfo\.xcprivacy in Resources \*\/,/);
  const plist=fs.readFileSync(path.join(root,'native','ios','App','App','Info.plist'),'utf8');
  ['NSMicrophoneUsageDescription','NSBluetoothAlwaysUsageDescription','ITSAppUsesNonExemptEncryption'].forEach(k=>assert.ok(plist.includes(`<key>${k}</key>`),k));
});

test('PA.midiIn：電子ピアノの鍵のときだけ、PA.onKey の中で true',()=>{
  const PA=loadPA(); const seen=[];
  PA.onKey=m=>seen.push([m,PA.midiIn]);
  PA.midi.note(true,30,90);
  assert.deepEqual(seen,[[30,true]]);
  assert.equal(PA.midiIn,false);
  PA.onKey=()=>{throw new Error('x');};
  assert.throws(()=>PA.midi.note(true,31,90));
  assert.equal(PA.midiIn,false); // ページがエラーでも、もどす
});

test('PA.midi：機器がかわったら、おさえている音はわすれる',()=>{
  const PA=loadPA();
  PA.midi.setDevices(['A','B']); PA.midi.note(true,60,90);
  PA.midi.setDevices(['A']);
  assert.equal(PA.midi.held().size,0);
});

test('PA.haptic・PA.answerFx：ウェブではなにもしない。こたえたら success／light',()=>{
  const PA=loadPA();
  assert.doesNotThrow(()=>PA.haptic('success'));
  const got=[]; PA.haptic=k=>got.push(k);
  PA.answerFx(true); PA.answerFx(false);
  assert.deepEqual(got,['success','light']);
  PA.haptic=()=>{throw new Error('x');};
  assert.doesNotThrow(()=>PA.answerFx(true)); // ふるえがこわれても、こたえあわせはつづく
});

test('クイズ：こたえあわせのところで PA.answerFx をよぶ',()=>{
  const want={'chord-quiz.html':2,'minor-quiz.html':2,'chroma-quiz.html':2,'ending-quiz.html':1,'ear.html':2,'progression.html':1};
  Object.entries(want).forEach(([f,n])=>assert.equal((fs.readFileSync(path.join(root,f),'utf8').match(/PA\.answerFx\(/g)||[]).length,n,f));
});

test('アプリ：リンクの長おしプレビューをとめる・ふるえのプラグインを登録する',()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'native','capacitor.config.json'),'utf8'));
  assert.equal(cfg.ios.allowsLinkPreview,false);
  const vc=fs.readFileSync(path.join(root,'native','ios','App','App','MainViewController.swift'),'utf8');
  assert.match(vc,/registerPluginInstance\(PianoHapticsPlugin\(\)\)/);
  const pbx=fs.readFileSync(path.join(root,'native','ios','App','App.xcodeproj','project.pbxproj'),'utf8');
  assert.match(pbx,/PianoHapticsPlugin\.swift in Sources \*\/,/);
});

test('app.css：おしたときの見た目（:active と .is-pressed）・動きをへらす設定',()=>{
  const css=fs.readFileSync(path.join(root,'assets','app.css'),'utf8');
  assert.match(css,/:is\(:active,\.is-pressed\)/);
  assert.match(css,/\[open\]\.closing\{animation:pa-sheet-down/);
  assert.match(css,/\.kb \.key\.w\.down/);
  const rm=css.split('@media (prefers-reduced-motion:reduce)').slice(1).join('');
  assert.match(rm,/transform:none/); assert.match(rm,/animation:none/);
  // ページごとの .echoice:active はなくして app.css にまとめた
  ['chroma-quiz.html','ending-quiz.html','ear.html','progression.html'].forEach(f=>assert.ok(!fs.readFileSync(path.join(root,f),'utf8').includes('.echoice:not([disabled]):active'),f));
});

test('PA.midi.reset：おさえていた鍵の画面のへこみも、もどす（機器がはずれたとき）',()=>{
  const PA=loadPA(); const lit=[];
  PA.keyLight=(m,on)=>lit.push([m,on]);
  PA.midi.setDevices(['Piano']); PA.midi.note(true,60,90); PA.midi.note(true,64,90);
  PA.midi.setDevices([]);
  assert.deepEqual(lit,[[60,true],[64,true],[60,false],[64,false]]);
  assert.equal(PA.midi.held().size,0);
});
