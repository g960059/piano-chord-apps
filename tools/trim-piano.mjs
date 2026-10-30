#!/usr/bin/env node
// ピアノの録音（assets/piano/*.mp3）を、はじめの SEC 秒だけにする（つくりなおすときだけ使う。ffmpeg が要る）
//   node tools/trim-piano.mjs <もとの mp3 のフォルダ>
// - もとの音：Salamander Grand Piano V3（Yamaha C5、Alexander Holm、CC BY 3.0）を Tone.js が公開している版
//   https://tonejs.github.io/audio/salamander/ の A0.mp3〜C8.mp3（3半音おき・30こ）
// - 音はつくりなおさない（-c copy：mp3 のフレームのさかいで切るだけ）ので、音はもとのまま
// - アプリで使うのは鳴りはじめから6秒まで（core.js の PIANO.keep）。頭の無音（〜20ms）と、上にずらして速く鳴らす分があるので少し長めに切る
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SEC='6.3';
const src=process.argv[2];
if(!src){console.error('つかいかた: node tools/trim-piano.mjs <もとの mp3 のフォルダ>');process.exit(1);}
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','assets','piano');
fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(src).filter(f=>/^(A|C|Ds|Fs)\d\.mp3$/.test(f)).sort();
if(files.length!==30) throw new Error(`30こあるはずが ${files.length}こ`);
let total=0;
for(const f of files){
  const dst=path.join(out,f);
  execFileSync('ffmpeg',['-v','error','-y','-i',path.join(src,f),'-t',SEC,'-c','copy','-map_metadata','-1',dst]);
  total+=fs.statSync(dst).size;
}
console.log(`${files.length}こ、${(total/1048576).toFixed(2)}MB → ${out}`);
