// PA.mic（マイクで ピアノの 和音を たしかめる）の テスト：node --test test/
// node の 中で ピアノっぽい 音を つくり（倍音 1〜8・少し 高めに ずれる 倍音・だんだん 小さく なる）、
// じぶんで FFT して、chroma＋match が 正しい 和音を とおし、まちがいを はじくか しらべる。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

// core.js の あとに mic.js を つづけて 同じ 場所で 読みこむ（_load.mjs は かえない）
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(dir,'..','assets',f),'utf8');
const PA=loadPA(read('core.js')+'\n;\n'+read('mic.js'));
const MIC=PA.mic;
const J=x=>JSON.parse(JSON.stringify(x));

/* ===== 小さな FFT（2の べき）と ハン窓 ===== */
function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1) j^=b; j^=b; if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang), h=len>>1;
    for(let i=0;i<n;i+=len){
      let cr=1,ci=0;
      for(let k=0;k<h;k++){
        const a=i+k,b=a+h, tr=re[b]*cr-im[b]*ci, ti=re[b]*ci+im[b]*cr;
        re[b]=re[a]-tr; im[b]=im[a]-ti; re[a]+=tr; im[a]+=ti;
        const t=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=t;
      }
    }
  }
}
// AnalyserNode と 同じく dB で かえす（db=false なら ふつうの 大きさ）
function spectrum(sig,db=true){
  const N=sig.length, re=new Float64Array(N), im=new Float64Array(N);
  for(let i=0;i<N;i++) re[i]=sig[i]*(0.5-0.5*Math.cos(2*Math.PI*i/N));
  fft(re,im);
  const out=new Float32Array(N/2);
  for(let k=0;k<N/2;k++){const m=Math.hypot(re[k],im[k])/N; out[k]=db?20*Math.log10(m+1e-20):m;}
  return out;
}

/* ===== ピアノっぽい 音 ===== */
const mulberry=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const SR=48000;
// notes：[{m:midi, v:強さ}]。startSec＝ひいてから 何秒後の 窓か。phone：スマホの マイク（低音が 弱い）
function synth(notes,{pitchA=440,N=16384,startSec=0.08,rnd=Math.random,phone=false,noise=0.001,sr=SR}={}){
  const sig=new Float64Array(N);
  for(const {m,v} of notes){
    const f0=pitchA*Math.pow(2,(m-69)/12);
    const B=0.0002+0.0008*rnd();                      // 弦の かたさで 倍音が 少し 高めに ずれる
    for(let h=1;h<=8;h++){
      const fh=h*f0*Math.sqrt(1+B*h*h); if(fh>=sr/2*0.9) break;
      let a=v/Math.pow(h,1.2)*(0.6+0.9*rnd());        // 倍音ごとに ばらつき
      if(m<52&&h>1&&h<5) a*=1.5;                      // 低い音は 倍音が 強め
      if(phone&&fh<150) a*=Math.pow(fh/150,2);        // スマホの マイクは 低音が 小さい
      const tau=1.6/(1+0.35*h)*(m<60?1.5:1);         // 高い 倍音ほど はやく 小さく なる
      const w=2*Math.PI*fh/sr, c=Math.cos(w), s=Math.sin(w), dk=Math.exp(-1/(sr*tau));
      const ph=2*Math.PI*rnd(); let x=Math.cos(ph+w*startSec*sr)*a*Math.exp(-startSec/tau), y=Math.sin(ph+w*startSec*sr)*a*Math.exp(-startSec/tau);
      for(let i=0;i<N;i++){sig[i]+=y; const nx=(x*c-y*s)*dk; y=(x*s+y*c)*dk; x=nx;}
    }
  }
  for(let i=0;i<N;i++) sig[i]+=noise*(rnd()*2-1);
  return sig;
}
const chromaOf=(notes,o={})=>{
  const N=o.N||16384, sp=spectrum(synth(notes,o),o.db!==false);
  return MIC.chroma(sp,o.sr||SR,N,{pitchA:o.pitchA||440,db:o.db!==false});
};
const pcsOf=ms=>[...new Set(ms.map(m=>((m%12)+12)%12))].sort((a,b)=>a-b);
const nv=(ms,v=0.8)=>ms.map(m=>({m,v}));

/* ===== いろいろな 和音を ならべる ===== */
const TYPES={maj:[0,4,7],min:[0,3,7],dim:[0,3,6],aug:[0,4,8],dom7:[0,4,7,10],maj7:[0,4,7,11],min7:[0,3,7,10],hdim7:[0,3,6,10],dim7:[0,3,6,9]};
function voicing(root,iv,rnd){
  // てんかい（いちばん下を かえる）・オクターブ・広げかた・根音の かさね を ばらばらに
  const inv=Math.floor(rnd()*iv.length), pcs=iv.slice(inv).concat(iv.slice(0,inv)).map(i=>(root+i)%12);
  let m=40+Math.floor(rnd()*20); while(((m%12)+12)%12!==pcs[0]) m++;
  const ms=[m];
  for(let i=1;i<pcs.length;i++){let x=ms[ms.length-1]+1; while(x%12!==pcs[i]) x++; ms.push(x);}
  if(rnd()<0.35){const k=1+Math.floor(rnd()*(ms.length-1)); if(ms[k]+12<=86) ms[k]+=12; ms.sort((a,b)=>a-b);}
  if(rnd()<0.3&&ms[0]+12<=86&&!ms.includes(ms[0]+12)) ms.push(ms[0]+12);  // いちばん下の 音を 1オクターブ上にも
  if(rnd()<0.2&&ms[0]-12>=36) ms[0]-=12;                                   // 左手で 低く
  return ms.sort((a,b)=>a-b);
}

/* ===== 1音・しくみの テスト ===== */
test('ドの 1音：ド が いちばん、倍音の ソ・ミ は 小さい',()=>{
  for(const m of [48,60,72]){
    const c=chromaOf(nv([m],1),{rnd:mulberry(m)});
    assert.equal(c.indexOf(1),0,'ド '+m);
    assert.ok(c[7]<0.15&&c[4]<0.15,`ソ ${c[7].toFixed(2)} ミ ${c[4].toFixed(2)} (${m})`);
    assert.ok(MIC.match(c,[0]).ok);
  }
});

test('基準の 音 442Hz：設定（pitchA）を つかう',()=>{
  const notes=nv([60,64,67]);
  const c=chromaOf(notes,{pitchA:442,rnd:mulberry(3)});
  assert.ok(MIC.match(c,[0,4,7]).ok,J(c));
  PA.settings.pitchA=442;
  const sp=spectrum(synth(notes,{pitchA:442,rnd:mulberry(3)}));
  assert.ok(MIC.match(MIC.chroma(sp,SR,16384),[0,4,7]).ok,'設定から');  // pitchA を わたさない
  PA.settings.pitchA=440;
});

test('ふつうの 大きさ（dB でない）でも おなじ',()=>{
  const c=chromaOf(nv([54,58,61]),{db:false,rnd:mulberry(5)});
  assert.ok(MIC.match(c,[6,10,1]).ok,J(c));
});

test('match：たりない・よけい・からっぽ',()=>{
  const c=[1,0,0,0,0.6,0,0,0.5,0,0,0,0];
  assert.deepEqual(J(MIC.match(c,[0,4,7])),{ok:true,score:1,missing:[],extra:[]});
  const r=MIC.match(c,[0,4,7,10]);
  assert.equal(r.ok,false); assert.deepEqual(J(r.missing),[10]);
  const e=MIC.match([1,0,0,0,0.6,0,0.5,0.5,0,0,0,0],[0,4,7]);
  assert.equal(e.ok,false); assert.deepEqual(J(e.extra),[6]); assert.ok(e.score<1);
  assert.equal(MIC.match([0,0,0,0,0,0,0,0,0,0,0,0],[0,4,7]).ok,false);
  // ゆるい／きびしい：小さな よけいな 音（0.17）は ゆるいと ○、きびしいと ×
  const s=[1,0,0.17,0,0.6,0,0,0.5,0,0,0,0];
  assert.equal(MIC.match(s,[0,4,7]).ok,true);
  assert.equal(MIC.match(s,[0,4,7],{strict:true}).ok,false);
  // 12 より 大きい 数・マイナスも 音の なまえに
  assert.equal(MIC.match(c,[12,16,-5]).ok,true);
});

test('しずかな ときは 0 ばかり',()=>{
  const z=new Float32Array(8192).fill(-Infinity);
  assert.deepEqual(J(MIC.chroma(z,SR,16384)),[0,0,0,0,0,0,0,0,0,0,0,0]);
  assert.deepEqual(J(MIC.peaks(new Float32Array(8192),SR,16384,{db:false})),[]);
});

test('Listener：ひいてから 300ms おちつくまで まつ・しずかは むし・reset',()=>{
  const C=[1,0,0,0,0.6,0,0,0.5,0,0,0,0], W=[1,0,0,0,0.6,0,0.7,0,0,0,0,0], mix=[0.3,0,1,0,0,0,0.6,0.2,0,0.8,0,0]; // まえの 和音が まだ まざっている
  const got=[]; const L=new MIC.Listener({target:[0,4,7],onVerdict:v=>got.push(v)});
  let t=0; const f=(chroma,o={})=>L.feed(Object.assign({chroma,level:-30,onset:false,silent:false},o),t+=60);
  assert.equal(L.state,'idle');
  // reset の あとは、まえから 鳴っている 音では きめない（新しく ひくのを まつ）
  for(let i=0;i<10;i++) assert.equal(f(C),null);
  assert.equal(L.state,'idle');
  // しずか → ひいた。まざった 音の あいだは まつ
  f(null,{silent:true,level:-80});
  assert.equal(f(mix,{onset:true}),null); assert.equal(L.state,'listen');
  f(mix); f(C); f(C); f(C); f(C);
  assert.equal(got.length,0,'まだ 300ms たたない／まざった 音が 窓に のこる');
  let v=null; for(let i=0;i<6&&!v;i++) v=f(C);
  assert.ok(v&&v.ok&&v.stable,'おちついたら ○'); assert.equal(got.length,1); assert.equal(L.state,'done');
  assert.ok(v.ms>=300);
  for(let i=0;i<10;i++) assert.equal(f(C),null,'1回だけ');
  // まちがえて ひきなおす（onset）→ ×
  f(W,{onset:true}); v=null; for(let i=0;i<10&&!v;i++) v=f(W);
  assert.ok(v&&!v.ok); assert.deepEqual(J(v.missing),[7]); assert.deepEqual(J(v.extra),[6]);
  // とちゅうで しずかに なったら やめる
  f(C,{onset:true}); f(C); f(null,{silent:true,level:-80});
  assert.equal(L.state,'idle');
  // ずっと かわりつづける → maxWaitMs で こたえる（stable＝false）
  L.setTarget([0,4,7]); f(null,{silent:true}); f(C,{onset:true});
  v=null; for(let i=0;i<60&&!v;i++) v=f(i%2?C:mix);
  assert.ok(v&&v.stable===false&&v.ms>=2500);
});

test('onsetTracker：しずか・ひいた しゅんかん',()=>{
  const tr=MIC.onsetTracker(); let t=0; const s=l=>tr(l,t+=60);
  for(let i=0;i<10;i++){const r=s(-70); assert.ok(r.silent&&!r.onset);}
  const a=s(-25); assert.ok(!a.silent&&a.onset,'ぐっと 大きく');
  assert.ok(!s(-26).onset&&!s(-27).onset,'鳴りつづけ');
  for(let i=0;i<6;i++) s(-30-i);
  assert.ok(s(-22).onset,'鳴っている 上から もういちど ひいた');
  for(let i=0;i<30;i++) s(-75);
  assert.ok(s(-75).silent);
});

test('supported／errorText（ブラウザが ない ときは false、ことばは やさしく）',()=>{
  assert.equal(MIC.supported(),false);
  for(const n of ['NotAllowedError','NotFoundError','NotReadableError','unsupported','ended','x']){
    const s=MIC.errorText({name:n}); assert.ok(typeof s==='string'&&s.length>8,n);
    assert.ok(!/[TSD]\b|semitone|半音/.test(s));
  }
  assert.ok(/許可/.test(MIC.errorText({name:'NotAllowedError'})));
  let msg=null;
  return MIC.start({onError:m=>{msg=m;}}).then(ok=>{assert.equal(ok,false); assert.ok(/つかえない/.test(msg)); assert.equal(MIC.active(),false);});
});

/* ===== 名前つきの 和音 ===== */
const NAMED=[
  ['ドミソ（C）',[60,64,67],[0,4,7]],
  ['ドミソ 第1てんかい',[52,55,60],[0,4,7]],
  ['ドミソ 広く',[36,55,64,72],[0,4,7]],
  ['ファ♯ラ♯ド♯（F♯）',[54,58,61],[6,10,1]],
  ['F♯ 第2てんかい',[49,54,58,66],[6,10,1]],
  ['B♭7',[46,50,53,56],[10,2,5,8]],
  ['B♭7 第3てんかい',[56,58,62,65],[10,2,5,8]],
  ['G7 ひだり ひくく',[43,59,62,65,67],[7,11,2,5]],
  ['ラドミ（Am）',[57,60,64],[9,0,4]],
  ['減七 シレファラ♭',[59,62,65,68],[11,2,5,8]],
  ['E♭maj7',[51,55,58,62],[3,7,10,2]],
];
// ○は ぜんぶ ○、半音 ずれは ぜんぶ ×。たりない・よけいは、ぴったり 重なる 倍音で まちがう ことが あるので
// ぜんぶで 数えて 2つ まで（どれを まちがえたかは 表示する）
const named=[];
for(const [name,ms,pcs] of NAMED){
  for(const pitchA of [440,442]){
    test(`${name} @${pitchA}Hz：○ と、半音 ずれは ×`,()=>{
      const rnd=mulberry(ms[0]*7+pitchA), o={pitchA,rnd};
      const c=chromaOf(nv(ms),o);
      const ok=MIC.match(c,pcs);
      assert.ok(ok.ok,`○の はず ${J(ok)} ${c.map(x=>x.toFixed(2))}`);
      // いちばん上の 音を 半音 上げる
      const up=ms.slice(); up[up.length-1]+=1;
      if(pcsOf(up).join()!==pcsOf(ms).join()) assert.equal(MIC.match(chromaOf(nv(up),o),pcs).ok,false,'半音 上');
      // まんなかの 音を 半音 下げる
      const dn=ms.slice(); const k=ms.length>>1; dn[k]-=1;
      if(pcsOf(dn).join()!==pcsOf(ms).join()) assert.equal(MIC.match(chromaOf(nv(dn),o),pcs).ok,false,'半音 下');
      // 根音いがいの 音を 1つ ぬく（同じ なまえの 音は ぜんぶ）
      for(const drop of pcs.slice(1)){
        const less=ms.filter(m=>m%12!==drop);
        const r=MIC.match(chromaOf(nv(less),o),pcs);
        named.push({ok:!r.ok,what:`${name} @${pitchA} たりない ${drop} ${JSON.stringify(r)}`});
      }
      // こたえに ない 音を 1つ たす
      const ex=[1,2,3,4,5,6,7,8,9,10,11].map(i=>(pcs[0]+i)%12).filter(p=>!pcs.includes(p));
      const add=ex[(ms[0]+pitchA)%ex.length]; let am=ms[1]; while(am%12!==add) am++;
      const r=MIC.match(chromaOf(nv(ms.concat([am])),o),pcs);
      named.push({ok:!r.ok,what:`${name} @${pitchA} よけい ${add} ${JSON.stringify(r)}`});
    });
  }
}
test('名前つきの 和音：たりない・よけいを × に する',()=>{
  const bad=named.filter(x=>!x.ok);
  console.log(`# mic named wrong-chords rejected ${named.length-bad.length}/${named.length}`);
  bad.forEach(x=>console.log('#   ✗ '+x.what));
  assert.ok(named.length>=60&&bad.length<=2);
});

/* ===== たくさん ためして 正しさを 数える ===== */
function trial(rnd,{N=16384,phone=false,strict=false}={}){
  const tk=Object.keys(TYPES), iv=TYPES[tk[Math.floor(rnd()*tk.length)]];
  const root=Math.floor(rnd()*12), pitchA=440+Math.floor(rnd()*4);
  const ms=voicing(root,iv,rnd), pcs=pcsOf(ms);
  const vel=()=>0.5+0.5*rnd();
  const o={pitchA,rnd,N,phone,startSec:0.05+0.3*rnd()};
  const judge=notes=>MIC.match(chromaOf(notes,o),pcs,{strict}).ok;
  const res={};
  res.right=judge(ms.map(m=>({m,v:vel()})));
  // 半音 ずれ
  let sh; do{sh=ms.slice(); const k=Math.floor(rnd()*sh.length); sh[k]+=rnd()<0.5?-1:1;}while(pcsOf(sh).join()===pcs.join());
  res.semitone=judge(sh.map(m=>({m,v:vel()})));
  // たりない（1つの 音の なまえを ぜんぶ ぬく）
  const drop=pcs[Math.floor(rnd()*pcs.length)];
  res.missing=judge(ms.filter(m=>m%12!==drop).map(m=>({m,v:vel()})));
  // よけい
  const others=[0,1,2,3,4,5,6,7,8,9,10,11].filter(p=>!pcs.includes(p)), add=others[Math.floor(rnd()*others.length)];
  let am=ms[0]+Math.floor(rnd()*(ms[ms.length-1]-ms[0]+6)); while(am%12!==add) am++;
  res.extra=judge(ms.concat([am]).map(m=>({m,v:vel()})));
  return res;
}
function accuracy(n,seed,opt){
  const rnd=mulberry(seed), cnt={right:0,semitone:0,missing:0,extra:0};
  for(let i=0;i<n;i++){const r=trial(rnd,opt); cnt.right+=r.right; cnt.semitone+=!r.semitone; cnt.missing+=!r.missing; cnt.extra+=!r.extra;}
  const pct=k=>Math.round(cnt[k]/n*1000)/10;
  return {n,accept:pct('right'),rejectSemitone:pct('semitone'),rejectMissing:pct('missing'),rejectExtra:pct('extra')};
}
test('せいかくさ：ばらばらな 和音 300こ（3和音・7の和音・てんかい・オクターブ・440〜443Hz・強さ ばらばら）',()=>{
  const a=accuracy(300,2026);
  console.log('# mic accuracy fft16384',JSON.stringify(a));
  assert.ok(a.accept>=96,'○を ○に '+a.accept);
  assert.ok(a.rejectSemitone>=98,'半音 ずれを ×に '+a.rejectSemitone);
  assert.ok(a.rejectMissing>=96,'たりないを ×に '+a.rejectMissing);
  assert.ok(a.rejectExtra>=94,'よけいを ×に '+a.rejectExtra);
});
test('せいかくさ：fftSize 8192・スマホの マイク（低音が 弱い）',()=>{
  const a=accuracy(150,7,{N:8192}), p=accuracy(150,11,{phone:true});
  console.log('# mic accuracy fft8192',JSON.stringify(a));
  console.log('# mic accuracy phone-mic fft16384',JSON.stringify(p));
  assert.ok(a.accept>=93&&p.accept>=95,'○');
  assert.ok(Math.min(a.rejectSemitone,p.rejectSemitone)>=97,'半音 ずれ');
  assert.ok(Math.min(a.rejectMissing,p.rejectMissing)>=95,'たりない');
  assert.ok(Math.min(a.rejectExtra,p.rejectExtra)>=90,'よけい');
});
