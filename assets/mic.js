/* 🎤 本物の ピアノで ひいた 和音を マイクで たしかめる（PA.mic）
 *
 * iPhone・iPad の Safari には MIDI が ないので、生のピアノで ひいてもらい、ページが 耳で きく。
 * これは「楽譜に おこす」ものでは なく「こたえあわせ」。こたえの 和音（音の なまえ＝pc 0〜11）は
 * わかっているので、「いま 鳴っている 音の なまえが ちょうど それだけか」だけを しらべる。
 * どの 高さ（オクターブ）で ひいても OK。
 *
 * よみこみ：<script src="assets/core.js"></script><script src="assets/mic.js"></script>
 *
 * つかいかた（ページの くみこみかた・たとえば chord-quiz.html）
 *   - PA.mic.supported() が false なら ボタンを 出さない（または 「この ブラウザでは つかえないよ」）。
 *   - ボタン：「🎤 ピアノで ひいて こたえる」（44px 以上、aria-pressed で オン・オフ）。
 *   - はじめて おす まえに、子どもと おうちの 人むけに みじかく 書いておく：
 *       「マイクで ピアノの 音を きいて、あっているか しらべるよ。
 *         音は この 端末の 中だけで しらべて、どこにも 送らないよ。録音も しないよ。
 *         『マイクを つかっても いい？』と きかれたら『許可』を おしてね。」
 *   - おした（タップの 中で よぶ。iOS は タップの 中でないと 音の しくみが うごかない）：
 *       const L=new PA.mic.Listener({target:pcs, onVerdict:v=>{ v.ok ? せいかい() : もういちど(v.missing,v.extra) }});
 *       PA.mic.start({onFrame:f=>L.feed(f), onError:msg=>{ 画面に msg を 出す; ボタンを もどす }});
 *     L.feed(f) は f.t（ミリ秒）を 時計に つかう。
 *   - 問題が かわったら L.setTarget(新しい pcs)。
 *   - おてほんの 音（PA.chord など）を 鳴らしている あいだは マイクが それを ひろうので、
 *     鳴らしおわるまで feed しないで、おわったら L.reset()（reset の あとは 新しく ひいた 音だけ きく）。
 *   - 画面を はなれる（pagehide・visibilitychange で hidden）・クイズを おえる・もういちど ボタン → PA.mic.stop()。
 *   - 画面の ようす：L.state が 'idle'＝「ひいてみてね」、'listen'＝「きいているよ…」、'done'＝こたえを 出した。
 *     v.missing／v.extra は 音の なまえ（pc）なので、PA.nm などで やさしく 出す
 *     （「ミ が きこえないよ」「ファ♯ も 鳴っているみたい」）。むずかしい ことばは つかわない。
 *   - しずかな 部屋で、端末を ピアノの 近く（譜面台など）に おくと よく きこえる、と 書いておく。
 *
 * テストできる ところ（ブラウザなしで うごく）
 *   PA.mic.peaks(spec, sampleRate, fftSize, opts)   … スペクトルの 山（ピーク）を ひろう
 *   PA.mic.chroma(spec, sampleRate, fftSize, opts)  … 12この 音の なまえごとの 強さ（いちばん強い ものが 1）
 *   PA.mic.match(chroma, targetPcs, {strict})       … こたえあわせ {ok, score, missing, extra}
 *   PA.mic.Listener                                 … 音が おちつくのを まって 1回だけ こたえを 出す
 *   PA.mic.onsetTracker()                           … 音の 大きさから「いま ひいた」「しずか」を きめる
 */
(function(){
'use strict';
const PA=window.PA; if(!PA) return;
const M=PA.mic={};

/* ===== きまりの 数（しきい値）と その わけ ===== */
const T={
  minHz:60, maxHz:2100,   // 60Hz（シ1 あたり）〜 2100Hz（ド7 あたり）。ここより 上は ほとんど 倍音なので 見ない
  peakRelDb:-40,          // いちばん強い 山より 40dB 以上 小さい 山は すてる（窓の すそ・小さな 雑音）
  peakOverMedDb:12,       // その帯の まんなかの 強さ（中央値＝ふつうの 雑音の 高さ）より 12dB 以上 大きい 山だけ
  centOk:25, centMax:45,  // 平均律から 25セント までは そのまま 数える。45セント で 0 に なるよう だんだん へらす
                          // （ピアノの 調律の ずれ・高い倍音の ずれは 小さい。半音の まんなかに ある 山は 音では ない）
  harmLo:-35, harmHi:60,  // 「下の 音の h倍」と みなす はば（セント）。ピアノの 弦は 倍音が 少し 高めに ずれるので 上を 広く
  octRef:0.7,             // 下の 音の 基音が 小さい（低い音・スマホの マイクは 低音が 苦手）ときは 1オクターブ上の 山も 手がかりに
  envK:1.2,               // 倍音の 大きさは、となりの 倍音（h-1倍・h+1倍の 小さいほう）の 1.2倍 までと みなす
  envHz:4200              // となりの 倍音を さがすため、山は 4200Hz まで ひろう（数えるのは maxHz まで）
};
/* 倍音で 音の なまえが かわる もの（2・4・8倍は 同じ なまえ なので そのまま）。
 * 数は「下の 音の 強さの 何わり まで 倍音として ひくか」の 上限。本物の ピアノは 低い音ほど 倍音が 強いので、
 * やや 大きめに しておき、となりの 倍音の 大きさ（envK）で おさえる。本当に ひいた 音は 倍音より ずっと 強いので のこる。
 * 3倍＝ド→ソ、5倍＝ド→ミ、6倍＝ソ、7倍＝シ♭（少し 低い）、9倍＝レ、10倍＝ミ、11倍は 半音の あいだ、12倍＝ソ */
const HR={3:0.6,5:0.4,6:0.45,7:0.35,9:0.3,10:0.3,11:0.25,12:0.3};
/* こたえあわせの しきい値（いちばん強い 音の なまえを 1 とした わりあい）。
 * テストの ピアノの 音（test/mic.test.mjs）で、○を ○、まちがいを × に する わりあいが いちばん よい ところ。
 * あいだ（0.12〜0.2）は「こたえの 音なら ある、ほかの 音なら むし」：倍音の のこりで × に しないため。 */
const PRES=0.12, PRES_STRICT=0.12;  // こたえの 音は これ以上 あれば「鳴っている」
const EXTRA=0.2, EXTRA_STRICT=0.15; // こたえに ない 音が これ以上 あれば ×（strict は きびしめ）
M.T=T;

const log2=x=>Math.log(x)/Math.LN2;
const zeros=()=>[0,0,0,0,0,0,0,0,0,0,0,0];

/* スペクトル（AnalyserNode の getFloatFrequencyData＝dB、または ふつうの 大きさ）から 山を ひろう。
 * かえす もの：[{f:周波数Hz, a:大きさ}]（低い じゅん） */
M.peaks=(spec,sampleRate,fftSize,opts)=>{
  opts=opts||{};
  const n=spec.length, binHz=sampleRate/fftSize;
  const minHz=opts.minHz||T.minHz, maxHz=opts.maxHz||T.maxHz;
  let db=opts.db;
  if(typeof db!=='boolean'){db=false;for(let i=0;i<n;i++){if(spec[i]<0){db=true;break;}}}
  const k0=Math.max(2,Math.floor(minHz/binHz)), k1=Math.min(n-3,Math.ceil(maxHz/binHz));
  if(k1<=k0) return [];
  // dB に そろえる（-Infinity は とても小さい 数に）
  const lo=k0-2, len=k1-k0+5, L=new Float32Array(len);
  for(let i=0;i<len;i++){
    const v=spec[lo+i];
    L[i]=db?(v>-300?v:-300):(v>1e-15?20*Math.log(v)/Math.LN10:-300);
  }
  let top=-300; for(let i=2;i<len-2;i++) if(L[i]>top) top=L[i];
  if(top<=-299) return [];
  const mid=Array.prototype.slice.call(L,2,len-2).sort((a,b)=>a-b)[(len-4)>>1];
  const thr=Math.max(top+(opts.peakRelDb||T.peakRelDb), mid+(opts.peakOverMedDb||T.peakOverMedDb));
  const out=[];
  for(let i=2;i<len-2;i++){
    const b=L[i];
    if(b<thr||!(b>L[i-1])||b<L[i+1]||b<L[i-2]||b<L[i+2]) continue;
    // となりの 3つで 山の てっぺんを 細かく さがす（放物線）
    const a=L[i-1], c=L[i+1], den=a-2*b+c;
    let d=den<0?0.5*(a-c)/den:0; if(d>0.5) d=0.5; if(d<-0.5) d=-0.5;
    out.push({f:(lo+i+d)*binHz, a:Math.pow(10,(b-0.25*(a-c)*d)/20)});
  }
  return out;
};

/* 12この 音の なまえ（ド＝0 … シ＝11）ごとの 強さ。いちばん強い ものが 1。
 * ピアノの 音には 倍音が あるので（ドの 3倍＝ソ、5倍＝ミ）、そのまま 数えると 鳴らしていない 音が 出てくる。
 * そこで、低い 山から じゅんに 見て、下の 山の「3・5・6・7…倍」に ある 山は、倍音の ぶんを ひいてから 数える。 */
M.chroma=(spec,sampleRate,fftSize,opts)=>{
  opts=opts||{};
  const pitchA=opts.pitchA||(PA.settings&&PA.settings.pitchA)||440;
  const maxHz=opts.maxHz||T.maxHz;
  const ps=M.peaks(spec,sampleRate,fftSize,{db:opts.db,minHz:opts.minHz,maxHz:Math.max(maxHz,T.envHz)}), n=ps.length, out=zeros();
  if(!n) return out;
  // A(j,h)：山 j の h倍の ところに ある 山の 大きさ（なければ 0）
  const A=(j,h)=>{
    if(h===1) return ps[j].a;
    const f=h*ps[j].f; let o=0;
    for(let k=j+1;k<n;k++){const c=1200*log2(ps[k].f/f); if(c>T.harmHi) break; if(c>=T.harmLo&&ps[k].a>o) o=ps[k].a;}
    return o;
  };
  const eff=new Array(n);
  for(let i=0;i<n;i++){
    const q=ps[i]; let sub=0;
    for(let j=0;j<i;j++){
      if(!(eff[j]>0)) continue;
      const r=q.f/ps[j].f, h=Math.round(r), w=HR[h];
      if(!w) continue;
      const c=1200*log2(r/h);
      if(c<T.harmLo||c>T.harmHi) continue;
      // 倍音の 大きさの 見つもり：基音（または 1オクターブ上）の w わり。
      // ただし となりの 倍音（h-1倍・h+1倍）より ずっと 大きい ことは ないので、そこで おさえる
      // （低い ド と 1オクターブ半 上の ソ を 両方 ひいた とき、ソ を けしすぎない。
      //   ぴったり 重なる 音は 波が 強めあったり 弱めあったり するので、どうしても まちがう ことが ある）
      let s=Math.max(eff[j],T.octRef*A(j,2))*w;
      const a=A(j,h-1), b=A(j,h+1), e=a&&b?Math.min(a,b):a+b;  // 小さいほう（片方が 本当に ひいた 音でも だいじょうぶ）
      if(e>0) s=Math.min(s,T.envK*e);
      // 足しあわせず いちばん 大きい ものだけ（ド の 6倍 と ド の 1オクターブ上の 3倍 は 同じ 山なので 2回 ひかない）
      if(s>sub) sub=s;
    }
    eff[i]=Math.max(0,q.a-sub);
  }
  let mx=0;
  for(let i=0;i<n;i++){
    if(!(eff[i]>0)||ps[i].f>maxHz) continue;
    const m=69+12*log2(ps[i].f/pitchA), r=Math.round(m), dev=Math.abs(m-r)*100;
    const w=dev<=T.centOk?1:dev>=T.centMax?0:(T.centMax-dev)/(T.centMax-T.centOk);
    const pc=((r%12)+12)%12;
    out[pc]+=eff[i]*w;
  }
  for(let i=0;i<12;i++) if(out[i]>mx) mx=out[i];
  if(mx>0) for(let i=0;i<12;i++) out[i]/=mx;
  return out;
};

/* こたえあわせ。ok＝こたえの 音が ぜんぶ はっきり 鳴っていて、ほかの 音が 小さい。
 * score（0〜1）＝ぜんぶの 強さの うち こたえの 音の わりあい（いちばん弱い こたえの 音が 小さいと へる）
 * strict：ほかの 音に きびしく（上級むけ） */
M.match=(chroma,target,opts)=>{
  opts=opts||{};
  const strict=!!opts.strict;
  const pres=opts.present!=null?opts.present:(strict?PRES_STRICT:PRES);
  const ext=opts.extra!=null?opts.extra:(strict?EXTRA_STRICT:EXTRA);
  const want=[false,false,false,false,false,false,false,false,false,false,false,false];
  (target||[]).forEach(p=>{want[((p%12)+12)%12]=true;});
  const missing=[], extra=[]; let inT=0, all=0, minT=1, nT=0;
  for(let pc=0;pc<12;pc++){
    const v=chroma&&chroma[pc]>0?+chroma[pc]:0; all+=v;
    if(want[pc]){nT++; inT+=v; if(v<minT) minT=v; if(v<pres) missing.push(pc);}
    else if(v>=ext) extra.push(pc);
  }
  const score=all>0&&nT?(inT/all)*Math.min(1,minT/pres):0;
  return {ok:nT>0&&all>0&&!missing.length&&!extra.length, score:Math.round(score*1000)/1000, missing, extra};
};

/* 音の 大きさ（dB）から「しずか」「いま ひいた（音が ぐっと 大きく なった）」を きめる。
 * ずっと しずかな ときの 大きさ（floor）を おぼえて、それより 10dB 大きければ「鳴っている」。
 * 250ms の あいだの いちばん小さい ときより 6dB 以上 大きく なったら「いま ひいた」。
 * 1回 ひくと 音が 立ちあがる あいだ 2回 数えて しまうので、250ms は あける。 */
M.onsetTracker=o=>{
  o=o||{};
  const rise=o.riseDb||6, gate=o.gateDb||10, absMin=o.minDb||-72, back=o.backMs||250, gap=o.gapMs||250;
  let floor=null, lastOn=-1e9; const hist=[];
  return (level,t)=>{
    if(!(level>-200)) level=-200;
    if(floor==null) floor=Math.min(level,-55);  // さいしょから 鳴っていても しずかと まちがえないように
    else if(level<floor) floor=level;
    else floor+=Math.min(level-floor,0.06);       // ゆっくり 上げる（1秒で 1dB くらい。部屋の 音が かわっても ついていく）
    const silent=level<Math.max(absMin,floor+gate);
    while(hist.length&&t-hist[0].t>back) hist.shift();
    let lo=Infinity; for(let i=0;i<hist.length;i++) if(hist[i].l<lo) lo=hist[i].l;
    const onset=!silent&&level-lo>=rise&&t-lastOn>=gap;
    if(onset) lastOn=t;
    hist.push({t:t,l:level});
    return {silent:silent, onset:onset, floor:floor};
  };
};

/* 音が おちつくのを まって、1回だけ こたえを 出す しくみ。
 *   new PA.mic.Listener({target:[0,4,7], strict:false, onVerdict:v=>{}, stableMs:300, maxWaitMs:2500})
 *   feed({chroma, level, onset, silent, t}) … こたえが きまった ときだけ v を かえす（ほかは null）
 * きまり：
 *   - しずか（silent）な ときは なにも しない（とちゅうなら やめる）。
 *   - 「いま ひいた」（onset、または しずか→鳴った）から きき はじめる。
 *     ばらばらに ひいても、新しい 音が 入るたびに きき なおす。
 *   - さいごの stableMs（300ms）の あいだ、12この 強さが ほとんど かわらない（ならした 形との にかよりが 0.9 以上）
 *     ときに、その ならした 形で こたえあわせ。これで ひいた しゅんかんの まざった 音では きめない。
 *   - maxWaitMs すぎても おちつかないときは、それまでの ならした 形で こたえる（v.stable＝false）。
 *   - こたえを 出したら、つぎに ひくまで まつ。reset() の あとも、しずか か 新しく ひいた 音を まつ。 */
function Listener(o){
  if(!(this instanceof Listener)) return new Listener(o);
  o=o||{};
  this.target=(o.target||[]).slice(); this.strict=!!o.strict;
  this.stableMs=o.stableMs||300; this.maxWaitMs=o.maxWaitMs||2500; this.similar=o.similar||0.9;
  this.onVerdict=o.onVerdict||null; this.onState=o.onState||null;
  this.reset();
}
Listener.prototype.reset=function(){this.buf=[]; this.t0=0; this.last=null; this.wasSilent=false; this._set('idle');};
Listener.prototype.setTarget=function(pcs,strict){this.target=(pcs||[]).slice(); if(typeof strict==='boolean') this.strict=strict; this.reset();};
Listener.prototype._set=function(s){if(this.state===s) return; this.state=s; if(this.onState) this.onState(s);};
Listener.prototype.feed=function(fr,t){
  if(!fr) return null;
  if(t==null) t=fr.t!=null?fr.t:Date.now();
  const silent=typeof fr.silent==='boolean'?fr.silent:!(fr.level>-60);
  if(silent){this.wasSilent=true; this.buf=[]; if(this.state==='listen') this._set('idle'); return null;}
  if(fr.onset||this.wasSilent){this.wasSilent=false; this.buf=[]; this.t0=t; this._set('listen');}
  if(this.state!=='listen'||!fr.chroma) return null;
  this.buf.push({t:t,c:fr.chroma});
  const from=t-this.stableMs;
  while(this.buf.length>1&&this.buf[1].t<=from) this.buf.shift(); // まどの はじめ（from）より 前の ものは 1つだけ のこす
  const win=this.buf, m=zeros();
  win.forEach(x=>{for(let i=0;i<12;i++) m[i]+=x.c[i];});
  let mx=0; for(let i=0;i<12;i++) if(m[i]>mx) mx=m[i];
  if(mx>0) for(let i=0;i<12;i++) m[i]/=mx;
  const long=t-this.t0>=this.stableMs&&win.length>=3&&win[0].t<=from;
  let stable=long&&mx>0;
  if(stable) for(let k=0;k<win.length;k++){if(cos(win[k].c,m)<this.similar){stable=false;break;}}
  const late=t-this.t0>=this.maxWaitMs&&mx>0;
  if(!stable&&!late) return null;
  const v=M.match(m,this.target,{strict:this.strict});
  v.chroma=m; v.stable=stable; v.ms=Math.round(t-this.t0);
  this.last=v; this._set('done');
  if(this.onVerdict) this.onVerdict(v);
  return v;
};
function cos(a,b){let ab=0,aa=0,bb=0;for(let i=0;i<12;i++){ab+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa>0&&bb>0?ab/Math.sqrt(aa*bb):0;}
M.Listener=Listener;

/* ===== マイク（ブラウザ） ===== */
M.supported=()=>{
  try{return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&(window.AudioContext||window.webkitAudioContext));}catch(e){return false;}
};
// こまったときの ことば（子どもにも わかるように）
M.errorText=err=>{
  const n=err&&err.name||'';
  if(n==='NotAllowedError'||n==='PermissionDeniedError'||n==='SecurityError')
    return 'マイクが つかえないよ。「マイクを つかっても いい？」で「許可」を おしてね。まちがえて「許可しない」を おしたときは、ブラウザの 設定で この ページの マイクを「許可」に して、ページを 読みなおしてね。';
  if(n==='NotFoundError'||n==='DevicesNotFoundError'||n==='OverconstrainedError')
    return 'マイクが 見つからないよ。マイクの ある 端末で ためしてね。';
  if(n==='NotReadableError'||n==='TrackStartError'||n==='AbortError')
    return 'マイクを ほかの アプリが つかっているみたい。ほかの アプリを とじてから、もういちど おしてね。';
  if(n==='unsupported')
    return 'この ブラウザでは マイクが つかえないよ。画面の 鍵盤で こたえてね。';
  if(n==='ended')
    return 'マイクが とまったよ。もういちど 🎤 を おしてね。';
  return 'マイクが うまく うごかなかったよ。もういちど おしてね。';
};

let cur=null;
M.active=()=>!!cur;
M.start=o=>{
  o=o||{};
  const onFrame=o.onFrame||function(){}, onError=o.onError||function(){};
  M.stop();
  if(!M.supported()){onError(M.errorText({name:'unsupported'})); return Promise.resolve(false);}
  // 音の しくみは タップの 中で 用意する（iOS は あとからだと うごかない）。core と 同じ ものを つかう
  let ac=null;
  try{ac=PA.audio?PA.audio():null;}catch(e){}
  if(!ac){try{const AC=window.AudioContext||window.webkitAudioContext; ac=new AC();}catch(e){}}
  if(!ac){onError(M.errorText({name:'unsupported'})); return Promise.resolve(false);}
  // iOS 17〜：core は 'playback'（鳴らすだけ）に しているので、きく あいだは 'play-and-record' に
  try{if(navigator.audioSession) navigator.audioSession.type='play-and-record';}catch(e){}
  const sess={stopped:false, ac:ac, onError:onError};
  cur=sess;
  let p;
  try{
    // 声むけの くふう（エコー・雑音けし・音量の 自動調整）は ピアノの 音を こわすので ぜんぶ オフ
    p=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  }catch(e){p=Promise.reject(e);}
  return p.then(stream=>{
    if(sess.stopped||cur!==sess){stream.getTracks().forEach(tr=>tr.stop()); return false;}
    sess.stream=stream;
    if(ac.state!=='running'&&ac.state!=='closed') ac.resume().catch(()=>{});
    const src=ac.createMediaStreamSource(stream), an=ac.createAnalyser(), mute=ac.createGain();
    // 16384：48kHz で 1目もり 約3Hz（低い ドと レも わけられる）。ただし 0.34秒ぶんを まとめて 見るので、
    // ひいた 直後は 前の 音が まざる → Listener が おちつくのを まつ
    try{an.fftSize=o.fftSize||16384;}catch(e){an.fftSize=8192;}
    an.smoothingTimeConstant=o.smoothing!=null?o.smoothing:0.5;
    an.minDecibels=-110; an.maxDecibels=-10;
    mute.gain.value=0;                       // スピーカーには 出さない（ハウリングしない）。つなぐのは 古い Safari でも うごかすため
    src.connect(an); an.connect(mute); mute.connect(ac.destination);
    sess.nodes=[src,an,mute];
    const freq=new Float32Array(an.frequencyBinCount);
    const useF=typeof an.getFloatTimeDomainData==='function';
    const td=useF?new Float32Array(an.fftSize):new Uint8Array(an.fftSize);
    const tail=Math.min(2048,an.fftSize);  // 音の 大きさは さいごの 約40ms で（ひいた しゅんかんが わかるように）
    const track=M.onsetTracker(o.onset);
    stream.getTracks().forEach(tr=>{tr.onended=()=>{if(cur===sess){M.stop(); onError(M.errorText({name:'ended'}));}};});
    const tick=()=>{
      if(cur!==sess) return;
      try{
        if(useF) an.getFloatTimeDomainData(td); else an.getByteTimeDomainData(td);
        let s=0; const N=td.length;
        for(let i=N-tail;i<N;i++){const v=useF?td[i]:(td[i]-128)/128; s+=v*v;}
        const level=10*Math.log(s/tail+1e-12)/Math.LN10;   // dBFS（0 が いちばん 大きい）
        const now=Date.now(), st=track(level,now);
        // しずかな ときも 読む（analyser の ならし（smoothing）は 読んだ ときに 進むので、読まないと 前の 和音が のこる）
        an.getFloatFrequencyData(freq);
        const chroma=st.silent?zeros():M.chroma(freq,ac.sampleRate,an.fftSize,{db:true,pitchA:o.pitchA});
        onFrame({chroma:chroma, level:level, onset:st.onset, silent:st.silent, t:now});
      }catch(e){}
    };
    sess.timer=setInterval(tick,o.intervalMs||60); // requestAnimationFrame より かるい・画面に 関係なく まわる
    return true;
  },err=>{
    if(cur===sess){M.stop(); onError(M.errorText(err));}
    return false;
  });
};
M.stop=()=>{
  const s=cur; cur=null;
  if(!s) return;
  s.stopped=true;
  if(s.timer) clearInterval(s.timer);
  if(s.nodes) s.nodes.forEach(nd=>{try{nd.disconnect();}catch(e){}});
  if(s.stream) s.stream.getTracks().forEach(tr=>{tr.onended=null; try{tr.stop();}catch(e){}});
  try{if(navigator.audioSession) navigator.audioSession.type='playback';}catch(e){}
};
})();
