/* 音の聴き比べ（試作）のしくみ。lab/sound-test.html から使う。
 * - いまの音（core.js と同じ合成）と、録音したピアノの音（サンプル）を、同じ出口（コンプレッサー）を通して鳴らす
 * - サンプルは、いちばん近い高さの録音を再生速度で高さ合わせする
 * - 読みこんだとき、頭の無音をはかってとばし、高さのずれ（セント）をはかって平均律に直せるようにする
 * - 音量は、ド4（midi 60）の最初の1秒の大きさ（RMS）を、いまの音にそろえる
 * ブラウザなしで動く部分（高さはかり・近いサンプルえらび など）は test/lab-sampler.test.mjs でたしかめる。
 */
(function(G){
'use strict';
const L={};
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
L.noteName=m=>NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1); // 60 → C4
L.hz=(m,a4)=>(a4||440)*Math.pow(2,(m-69)/12);

/* ===== 音のもと ===== */
// Salamander Grand Piano V3（Yamaha C5、Alexander Holm、CC BY 3.0）。Tone.js が公開している1段階・3半音おきの版
const SAL_PC={9:'A',0:'C',3:'Ds',6:'Fs'};
const salamander=[];
for(let m=21;m<=108;m+=3) salamander.push({midi:m,file:SAL_PC[m%12]+(Math.floor(m/12)-1)+'.mp3'});
// Splendid Grand Piano（AKAI の Steinway、パブリックドメイン）。smplr が使う MF（やや強め）の段。名前は C3＝midi 60 の書きかた
const SPL_MF=[[23,'Mf B-1'],[27,'Mf D#0'],[29,'Mf F0'],[31,'Mf G0'],[33,'Mf A0'],[35,'Mf B0'],[37,'MF C#1'],[38,'MF D1'],[40,'MF E1'],[41,'MF F1'],
  [43,'MF G1'],[45,'MF A1'],[47,'MF B1'],[48,'MF C2'],[50,'MF D2'],[52,'MF E2'],[53,'MF F2'],[55,'MF G2'],[56,'MF G#2'],[57,'MF A2'],[58,'MF A#2'],
  [59,'MF B2'],[60,'MF C3'],[62,'MF D3'],[64,'MF E3'],[65,'MF F3'],[67,'MF G3'],[69,'MF A3'],[71,'MF B3'],[72,'MF C4'],[74,'Mf D4'],[76,'Mf E4'],
  [77,'Mf F4'],[79,'Mf G4'],[80,'Mf G#4'],[81,'Mf A4'],[82,'Mf A#4'],[83,'Mf B4'],[85,'Mf C#5'],[86,'Mf D5'],[87,'Mf D#5'],[88,'Mf E5'],[89,'Mf F5'],
  [90,'Mf F#5'],[91,'Mf G5'],[92,'Mf G#5'],[93,'Mf A5'],[94,'Mf A#5'],[95,'Mf B5'],[96,'Mf C6'],[97,'Mf C#6'],[98,'Mf D6'],[99,'Mf D#6'],[100,'Mf E6'],
  [101,'Mf F6'],[102,'Mf F#6'],[103,'Mf G6'],[104,'Mf G#6'],[105,'Mf A6'],[106,'Mf A#6'],[107,'Mf B6'],[108,'PP C7']];
L.SOURCES=[
  {id:'synth',name:'いまの音（合成）',short:'いまの音',piano:'合成',kind:'synth'},
  {id:'salamander',name:'Salamander（Yamaha C5）',short:'Salamander',piano:'Yamaha C5',kind:'sampler',base:'https://tonejs.github.io/audio/salamander/',samples:salamander,
    credit:'Salamander Grand Piano V3 — Alexander Holm（CC BY 3.0）。Tone.js が公開している1段階版'},
  {id:'splendid',name:'Splendid（Steinway）',short:'Splendid',piano:'Steinway',kind:'sampler',base:'https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples/',
    samples:SPL_MF.map(([midi,n])=>({midi,file:encodeURIComponent(n)+'.m4a'})),
    credit:'Splendid Grand Piano — AKAI の録音をもとにした sfzinstruments 版（パブリックドメイン）。MF の段'},
];

/* ===== ブラウザなしで動く部分 ===== */
// いちばん近いサンプル（同じ近さなら下のサンプルを上げて使う）。list は midi の小さいじゅん
L.nearest=(list,m)=>{
  let best=null,bd=1e9;
  for(const s of list){const d=Math.abs(s.midi-m);if(d<bd){best=s;bd=d;}}
  return best;
};
// 再生速度：サンプルの midi から target へ。cents＝そのサンプルの高さのずれ（＋なら高い）、a4＝基準ピッチ
L.rate=(target,sampleMidi,cents,a4)=>Math.pow(2,(target-sampleMidi)/12-(cents||0)/1200)*((a4||440)/440);
// 鳴りはじめ：いちばん大きいところの frac 倍をこえた最初の位置
L.onsetIndex=(x,frac)=>{
  const n=Math.min(x.length,200000);let pk=0;
  for(let i=0;i<n;i++){const v=Math.abs(x[i]);if(v>pk)pk=v;}
  const th=pk*(frac||0.02);
  for(let i=0;i<n;i++) if(Math.abs(x[i])>th) return i;
  return 0;
};
L.rms=(x,start,len)=>{
  let s=0,n=0;const e=Math.min(x.length,start+len);
  for(let i=start;i<e;i++){s+=x[i]*x[i];n++;}
  return n?Math.sqrt(s/n):0;
};
// 高さはかり：期待する高さ expHz の近く（±150セント）で、自己相関がいちばん大きい周期をさがす。
// 1回目は短い長さで大まかに、2回目は長い長さ（何周期ぶんか）で細かくはかる。{hz, cents, clarity}
const nsdfPeak=(x,s0,N,lo,hi)=>{
  const r=[];
  for(let lag=lo-1;lag<=hi+1;lag++){
    let ab=0,aa=0,bb=0;
    for(let i=0;i<N;i++){const a=x[s0+i],b=x[s0+i+lag];ab+=a*b;aa+=a*a;bb+=b*b;}
    r.push(aa&&bb?ab/Math.sqrt(aa*bb):0);
  }
  let bi=1;for(let i=2;i<r.length-1;i++) if(r[i]>r[bi]) bi=i;
  const y0=r[bi-1],y1=r[bi],y2=r[bi+1], den=y0-2*y1+y2;
  return {lag:lo-1+bi+(den?0.5*(y0-y2)/den:0),r:y1};
};
L.detectPitch=(x,sr,expHz,start)=>{
  const s0=start||0, T=sr/expHz, k=Math.min(5,Math.max(1,Math.floor(64/T))); // 周期が短い高い音は、k 周期ぶんで大まかに
  const lo=Math.floor(k*T*Math.pow(2,-1.5/12)), hi=Math.ceil(k*T*Math.pow(2,1.5/12));
  const N=Math.min(Math.max(4096,Math.ceil(8*T)),x.length-s0-hi-2);
  if(N<256) return null;
  const c=nsdfPeak(x,s0,N,lo,hi);
  let T1=c.lag/k, clarity=c.r;
  const K=Math.floor(1024/T1); // 高い音：K 周期ぶんはなれたところの山で、周期を細かくする
  if(K>=2){
    const lo2=Math.floor(K*T1-T1*0.3), hi2=Math.ceil(K*T1+T1*0.3), N2=Math.min(4096,x.length-s0-hi2-2);
    if(N2>=256){const f=nsdfPeak(x,s0,N2,lo2,hi2);T1=f.lag/K;}
  }
  const hz=sr/T1;
  return {hz,cents:1200*Math.log2(hz/expHz),clarity};
};
// 高さの直しかたを決める（list＝analyze のけっか、midi の小さいじゅん）
// - global：まんなか（ド3〜ド6）の、たしかにはかれた音のずれの中央値。録音のピアノ全体の調律のずれ
// - 1音ずつ：たしかにはかれた音（たしかさ0.9以上、全体から±40セントまで）はそのずれ。
//   そうでない音（いちばん低い・高い音に多い）は、いちばん近いたしかな音のずれを使う
L.tuning=list=>{
  const ok=s=>s.clarity>=0.9;
  const mid=list.filter(s=>ok(s)&&s.midi>=48&&s.midi<=84).map(s=>s.cents).sort((a,b)=>a-b);
  const global=mid.length?mid[Math.floor(mid.length/2)]:0;
  const good=list.filter(s=>ok(s)&&Math.abs(s.cents-global)<=40);
  list.forEach(s=>{
    s.sure=good.includes(s);
    s.fixCents=s.sure?s.cents:(good.length?L.nearest(good,s.midi).cents:global);
  });
  return global;
};
// ステレオを1本にまぜる（はかるときだけ）
L.mono=buf=>{
  const n=buf.length,c=buf.numberOfChannels,out=new Float32Array(n);
  for(let ch=0;ch<c;ch++){const d=buf.getChannelData(ch);for(let i=0;i<n;i++) out[i]+=d[i]/c;}
  return out;
};
// 頭の無音をとって、sec 秒だけのモノラルにする（メモリを小さく。おわりは0.4秒でフェード）
L.trimMono=(ac,buf,onset,sec)=>{
  const sr=buf.sampleRate, st=Math.max(0,onset-Math.round(sr*0.002)), n=Math.min(buf.length-st,Math.round(sr*sec));
  const out=ac.createBuffer(1,n,sr), d=out.getChannelData(0), c=buf.numberOfChannels, fade=Math.round(sr*0.4);
  for(let ch=0;ch<c;ch++){const x=buf.getChannelData(ch);for(let i=0;i<n;i++) d[i]+=x[st+i]/c;}
  for(let i=Math.max(0,n-fade);i<n;i++) d[i]*=(n-i)/fade;
  return out;
};
// サンプル1つをしらべる：頭の無音・高さのずれ・大きさ
L.analyze=(buf,midi)=>{
  const x=L.mono(buf), sr=buf.sampleRate, on=L.onsetIndex(x,0.02);
  const p=L.detectPitch(x,sr,L.hz(midi,440),on+Math.round(sr*0.12));
  return {onset:on, off:Math.max(0,on-Math.round(sr*0.002))/sr, cents:p?p.cents:0, clarity:p?p.clarity:0, rms:L.rms(x,on,sr)};
};

/* ===== 鳴らす（ブラウザだけ） ===== */
const KEEP_SEC=4.5; // 1つの録音をのこす長さ（いちばん長い音3秒＋はなしたあとの余韻）
L.Engine=function(){
  this.ctx=null;this.voices=new Set();this.a4=440;this.comp='now';this.stagger=0.012;this.fix='global';this.norm={synth:1};
};
const E=L.Engine.prototype;
E.ensure=function(){
  if(!this.ctx){
    try{if(navigator.audioSession) navigator.audioSession.type='playback';}catch(e){} // iPhone の消音スイッチでも鳴るように
    const ac=new AudioContext();
    this.ctx=ac;this.master=ac.createGain();this.master.gain.value=0.7;
    this.compNode=ac.createDynamicsCompressor();this.meter=ac.createAnalyser();this.meter.fftSize=2048;
    this.compNode.connect(this.meter);this.meter.connect(ac.destination);
    this.setComp(this.comp);
  }
  if(this.ctx.state!=='running') this.ctx.resume().catch(()=>{});
  return this.ctx;
};
// コンプレッサー：now＝いまのアプリ（ブラウザの初期値：-24dB・12:1）、soft＝弱め、off＝なし
E.setComp=function(mode){
  this.comp=mode;if(!this.ctx) return;
  const c=this.compNode,t=this.ctx.currentTime;
  this.master.disconnect();
  // ブラウザのコンプレッサーは自動で約3dB大きくする（makeup gain）。なしのときも同じくらいの大きさにして比べる
  this.master.gain.setValueAtTime(mode==='off'?0.7*1.41:0.7,t);
  if(mode==='off'){this.master.connect(this.meter);return;}
  const P=mode==='soft'?{threshold:-10,knee:6,ratio:3,attack:0.005,release:0.2}:{threshold:-24,knee:30,ratio:12,attack:0.003,release:0.25};
  Object.keys(P).forEach(k=>c[k].setValueAtTime(P[k],t));
  this.master.connect(c);
};
// いまの音：core.js の PA.playNote と同じ合成（out と ac をえらべるようにしただけ）
L.synthNote=(ac,out,midi,t,dur,vel,a4,voices)=>{
  const f=(a4||440)*Math.pow(2,(midi-69)/12);
  const g=ac.createGain(), lp=ac.createBiquadFilter();
  lp.type='lowpass';
  lp.frequency.setValueAtTime(Math.min(9000,f*9),t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f*1.6,350),t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vel,t+0.008);
  g.gain.exponentialRampToValueAtTime(vel*0.35,t+0.28);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  g.connect(lp); lp.connect(out);
  const v={g,os:[],t0:t};
  [[1,1,'triangle'],[2,0.42,'sine'],[3,0.16,'sine'],[4,0.08,'sine']].forEach(([h,a,type])=>{
    const o=ac.createOscillator(), og=ac.createGain();
    o.type=type; o.frequency.value=f*h; og.gain.value=a;
    o.connect(og); og.connect(g); o.start(t); o.stop(t+dur+0.05); v.os.push(o);
  });
  if(voices){voices.add(v);v.os[0].onended=()=>voices.delete(v);}
};
// サンプルをぜんぶ読みこむ。onProgress(読めた数, ぜんぶの数)
// 1つでも読めなかったら、のこりはやめて失敗にする（もう一度よべば、はじめから読みなおす）
E.load=function(src,onProgress){
  if(src.kind!=='sampler'||src.ready) return Promise.resolve(src);
  if(src.loading) return src.loading;
  const ac=this.ensure(), t0=performance.now(), run={}, q=src.samples.slice(), out=[];
  let bytes=0,full=0,done=0;
  src.run=run;
  const one=async s=>{
    const res=await fetch(src.base+s.file);
    if(!res.ok) throw new Error(s.file+' '+res.status);
    const ab=await res.arrayBuffer(), size=ab.byteLength; // decodeAudioData のあとは ab が空になるので、先にはかる
    const fb=await ac.decodeAudioData(ab);
    if(src.run!==run) return; // やめた回のおくれてきた分はすてる
    const a=L.analyze(fb,s.midi);
    bytes+=size;full+=fb.length*fb.numberOfChannels*4;
    out.push(Object.assign({},s,a,{buf:L.trimMono(ac,fb,a.onset,KEEP_SEC),off:0,headMs:a.off*1000}));
    if(onProgress) onProgress(++done,src.samples.length);
  };
  src.loading=(async()=>{
    try{await Promise.all(Array.from({length:6},async()=>{while(q.length&&src.run===run) await one(q.shift());}));}
    catch(e){q.length=0;src.run=null;src.loading=null;throw e;}
    out.sort((a,b)=>a.midi-b.midi);
    src.globalCents=L.tuning(out);
    src.bytes=bytes;src.fullMemory=full;src.loadMs=performance.now()-t0;
    src.memory=out.reduce((n,s)=>n+s.buf.length*s.buf.numberOfChannels*4,0);
    const ref=L.nearest(out,60);
    await this.calibrate();
    this.norm[src.id]=this.synthRms/(ref.rms||1);
    src.ready=out;
    return src;
  })();
  return src.loading;
};
// いまの音の大きさ（ド4・vel 0.22 の最初の1秒の RMS）を、音を出さずに一度だけはかる
E.calibrate=async function(){
  if(this.synthRms) return this.synthRms;
  const sr=44100, oc=new OfflineAudioContext(1,Math.round(sr*1.3),sr);
  L.synthNote(oc,oc.destination,60,0,1.6,0.22,440,null);
  const b=await oc.startRendering(), x=b.getChannelData(0);
  this.synthRms=L.rms(x,L.onsetIndex(x,0.02),sr);
  return this.synthRms;
};
// 1音。src＝音のもと、when＝いまから何秒後、dur＝鍵盤をおさえている長さ
E.note=function(src,midi,when,dur,vel){
  const ac=this.ensure(), t=ac.currentTime+(when||0)+0.01;
  vel=vel||0.22;dur=dur||1.6;
  if(src.kind==='synth'){L.synthNote(ac,this.master,midi,t,dur,vel,this.a4,this.voices);return;}
  if(!src.ready) return; // まだ読めていない録音は鳴らさない（合成音にすりかえない）
  const s=L.nearest(src.ready,midi), node=ac.createBufferSource(), g=ac.createGain();
  node.buffer=s.buf;
  node.playbackRate.value=L.rate(midi,s.midi,this.fix==='each'?s.fixCents:this.fix==='global'?src.globalCents:0,this.a4);
  const a=vel/0.22*(this.norm[src.id]||1);
  g.gain.setValueAtTime(a,t);
  g.gain.setValueAtTime(a,t+dur);g.gain.setTargetAtTime(0,t+dur,0.09); // 鍵盤をはなす（ダンパー）
  node.connect(g);g.connect(this.master);
  node.start(t,s.off);node.stop(t+dur+0.7);
  const v={g,os:[node],t0:t};this.voices.add(v);node.onended=()=>this.voices.delete(v);
};
// 和音。arp＝1音ずつ（gap 秒あけて）
E.chord=function(src,ms,when,dur,o){
  o=o||{};
  const vel=o.vel||(o.arp?0.22:Math.min(0.17,0.5/Math.max(ms.length,1)+0.05));
  ms.forEach((m,i)=>this.note(src,m,(when||0)+(o.arp?i*(o.gap||0.36):i*this.stagger),dur,vel));
};
E.stop=function(){
  if(!this.ctx) return;
  const t=this.ctx.currentTime;
  this.voices.forEach(v=>{try{
    const p=v.g.gain;
    if(v.t0>t){p.cancelScheduledValues(0);p.setValueAtTime(0,t);}
    else{if(p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else {p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);} p.setTargetAtTime(0.0001,t,0.015);}
    v.os.forEach(o=>o.stop(t+0.12));
  }catch(e){}});
  this.voices.clear();
};
// いちばん大きいところ（dBFS）。0 に近いほど音がわれやすい
E.peakDb=function(){
  if(!this.meter) return -Infinity;
  const a=new Float32Array(this.meter.fftSize);this.meter.getFloatTimeDomainData(a);
  let pk=0;for(const v of a){const w=Math.abs(v);if(w>pk)pk=w;}
  return pk?20*Math.log10(pk):-Infinity;
};

G.SoundLab=L;
})(typeof window!=='undefined'?window:globalThis);
