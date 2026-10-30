// ピアノの録音で鳴らすしくみ（assets/core.js の PA.PIANO・PA.voice など）と、録音ファイル・sw.js のテスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const PA=loadPA();

test('PIANO.notes：A0〜C8 の3半音おき（30こ）で、ファイルがぜんぶある',()=>{
  const n=PA.PIANO.notes;
  assert.equal(n.length,30);
  assert.deepEqual([...n.slice(0,4).map(x=>x.file)],['A0.mp3','C1.mp3','Ds1.mp3','Fs1.mp3']);
  assert.equal(n.at(-1).midi,108);assert.equal(n.at(-1).file,'C8.mp3');
  n.forEach((x,i)=>{
    if(i) assert.equal(x.midi-n[i-1].midi,3);
    const f=path.join(ROOT,'assets','piano',x.file);
    assert.ok(fs.existsSync(f),x.file+' がない');
    const b=fs.readFileSync(f);
    assert.ok(b.length>5000&&b.length<200000,x.file+' の大きさ '+b.length);
    assert.ok(b[0]===0xff&&(b[1]&0xe0)===0xe0||b.subarray(0,3).toString()==='ID3',x.file+' は mp3');
  });
});

test('pianoNearest：いちばん近い録音。同じ近さなら下。はしの外は、いちばんはしの録音',()=>{
  const list=PA.PIANO.notes;
  assert.equal(PA.pianoNearest(list,60).midi,60);
  assert.equal(PA.pianoNearest(list,61).midi,60);
  assert.equal(PA.pianoNearest(list,62).midi,63);
  assert.equal(PA.pianoNearest(list,10).midi,21);
  assert.equal(PA.pianoNearest(list,120).midi,108);
  // ずらすのは、いつも1半音まで（音色がかわりすぎない）
  for(let m=21;m<=108;m++) assert.ok(Math.abs(PA.pianoNearest(list,m).midi-m)<=1,String(m));
});

test('pianoRate：半音の数・録音全体のずれ・基準ピッチを再生速度にする',()=>{
  const c=PA.PIANO.cents, near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} と ${b}`);
  near(PA.pianoRate(60,60,440),Math.pow(2,-c/1200));
  near(PA.pianoRate(61,60,440),Math.pow(2,1/12-c/1200));
  near(PA.pianoRate(69,69,442),Math.pow(2,-c/1200)*442/440);
  // 録音は少し高い（＋）ので、少しおそく鳴らして平均律にもどす
  assert.ok(c>0&&c<10);assert.ok(PA.pianoRate(60,60,440)<1);
});

test('voice：録音を読む前は合成の音。lockVoice は piano｜synth｜null だけ',()=>{
  assert.equal(PA.settings.voice,'piano');
  assert.equal(PA.pianoReady(),false);
  assert.equal(PA.voice(),'synth'); // まだ読めていない
  assert.equal(PA.lockVoice('piano'),'piano');assert.equal(PA.voice(),'synth');
  assert.equal(PA.lockVoice('synth'),'synth');assert.equal(PA.voice(),'synth');
  assert.equal(PA.lockVoice('organ'),null);
  assert.equal(PA.lockVoice(null),null);
});

test('せってい：音色は piano｜synth だけ読む（ほかはピアノ）',()=>{
  const ok=loadPA(undefined,{storage:new Map([['pianoapps.settings',JSON.stringify({voice:'synth'})]])});
  assert.equal(ok.settings.voice,'synth');
  const bad=loadPA(undefined,{storage:new Map([['pianoapps.settings',JSON.stringify({voice:'organ'})]])});
  assert.equal(bad.settings.voice,'piano');
});

test('loadPiano：fetch や OfflineAudioContext がないところでは false（こわれない）',async()=>{
  assert.equal(await PA.loadPiano(),false);
});

test('sw.js：録音はべつの保存場所。build-meta の一覧とファイルがそろっている',()=>{
  const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  const list=[...sw.match(/const AUDIO=\[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
  assert.deepEqual(list,[...PA.PIANO.notes.map(n=>'assets/piano/'+n.file)].sort());
  assert.match(sw,/const AUDIO_VERSION='[0-9a-f]{10}';/);
  assert.match(sw,/k!==CACHE&&k!==AUDIO_CACHE/,'あたらしくしたときに録音の保存場所を消さない');
  assert.ok(!/const PRECACHE=\[[^\]]*\.mp3/.test(sw),'録音は PRECACHE（毎回とりなおす）に入れない');
});
