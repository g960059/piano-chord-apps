/* 🎤 本物のピアノでひいた和音をマイクでたしかめる（PA.mic）
 *
 * iPhone・iPad の Safari には MIDI がないので、生のピアノでひいてもらい、ページが耳できく。
 * これは「楽譜におこす」ものではなく「こたえあわせ」。こたえの和音（音のなまえ＝pc 0〜11）は
 * わかっているので、「いま鳴っている音のなまえがちょうどそれだけか」だけをしらべる。
 * どの高さ（オクターブ）でひいても OK。
 *
 * よみこみ：<script src="assets/core.js"></script><script src="assets/mic.js"></script>
 *
 * つかいかた（ページのくみこみかた・たとえば chord-quiz.html）
 *   - PA.mic.supported() が false ならボタンを出さない（または「このブラウザではつかえないよ」）。
 *   - ボタン：「🎤 ピアノでひいてこたえる」（44px 以上、aria-pressed でオン・オフ）。
 *   - はじめておすまえに、子どもとおうちの人むけにみじかく書いておく：
 *       「マイクでピアノの音をきいて、あっているかしらべるよ。
 *         音はこの端末の中だけでしらべて、どこにも送らないよ。録音もしないよ。
 *         『マイクをつかってもいい？』ときかれたら『許可』をおしてね。」
 *   - おした（タップの中でよぶ。iOS はタップの中でないと音のしくみがうごかない）：
 *       const L=new PA.mic.Listener({target:pcs, onVerdict:v=>{ v.ok ? せいかい() : もういちど(v.missing,v.extra) }});
 *       PA.mic.start({onFrame:f=>L.feed(f), onError:msg=>{ 画面に msg を出す; ボタンをもどす }});
 *     L.feed(f) は f.t（ミリ秒）を時計につかう。
 *   - 問題がかわったら L.setTarget(新しい pcs)。
 *   - おてほんの音（PA.chord など）を鳴らしているあいだはマイクがそれをひろうので、
 *     鳴らしおわるまで feed しないで、おわったら L.reset()（reset のあとは新しくひいた音だけきく）。
 *   - 画面をはなれる（pagehide・visibilitychange で hidden）・クイズをおえる・もういちどボタン → PA.mic.stop()。
 *   - 画面のようす：L.state が 'idle'＝「ひいてみてね」、'listen'＝「きいているよ…」、'done'＝こたえを出した。
 *     v.missing／v.extra は音のなまえ（pc）なので、PA.nm などでやさしく出す
 *     （「ミがきこえないよ」「ファ♯も鳴っているみたい」）。むずかしいことばはつかわない。
 *   - しずかな部屋で、端末をピアノの近く（譜面台など）におくとよくきこえる、と書いておく。
 *
 * テストできるところ（ブラウザなしでうごく）
 *   PA.mic.peaks(spec, sampleRate, fftSize, opts)   … スペクトルの山（ピーク）をひろう
 *   PA.mic.chroma(spec, sampleRate, fftSize, opts)  … 12この音のなまえごとの強さ（いちばん強いものが1）
 *   PA.mic.match(chroma, targetPcs, {strict})       … こたえあわせ {ok, score, missing, extra}
 *   PA.mic.Listener                                 … 音がおちつくのをまって1回だけこたえを出す
 *   PA.mic.onsetTracker()                           … 音の大きさから「いまひいた」「しずか」をきめる
 */
(function(){
'use strict';
const PA=window.PA; if(!PA) return;
const M=PA.mic={};

/* ===== きまりの数（しきい値）とそのわけ ===== */
const T={
  minHz:60, maxHz:2100,   // 60Hz（シ1あたり）〜2100Hz（ド7あたり）。ここより上はほとんど倍音なので見ない
  peakRelDb:-40,          // いちばん強い山より40dB 以上小さい山はすてる（窓のすそ・小さな雑音）
  peakOverMedDb:12,       // その帯のまんなかの強さ（中央値＝ふつうの雑音の高さ）より12dB 以上大きい山だけ
  centOk:25, centMax:45,  // 平均律から25セントまではそのまま数える。45セントで0になるようだんだんへらす
                          // （ピアノの調律のずれ・高い倍音のずれは小さい。半音のまんなかにある山は音ではない）
  harmLo:-35, harmHi:60,  // 「下の音の h倍」とみなすはば（セント）。ピアノの弦は倍音が少し高めにずれるので上を広く
  octRef:0.7,             // 下の音の基音が小さい（低い音・スマホのマイクは低音が苦手）ときは1オクターブ上の山も手がかりに
  envK:1.2,               // 倍音の大きさは、となりの倍音（h-1倍・h+1倍の小さいほう）の1.2倍までとみなす
  envHz:4200              // となりの倍音をさがすため、山は4200Hz までひろう（数えるのは maxHz まで）
};
/* 倍音で音のなまえがかわるもの（2・4・8倍は同じなまえなのでそのまま）。
 * 数は「下の音の強さの何わりまで倍音としてひくか」の上限。本物のピアノは低い音ほど倍音が強いので、
 * やや大きめにしておき、となりの倍音の大きさ（envK）でおさえる。本当にひいた音は倍音よりずっと強いのでのこる。
 * 3倍＝ド→ソ、5倍＝ド→ミ、6倍＝ソ、7倍＝シ♭（少し低い）、9倍＝レ、10倍＝ミ、11倍は半音のあいだ、12倍＝ソ */
const HR={3:0.6,5:0.4,6:0.45,7:0.35,9:0.3,10:0.3,11:0.25,12:0.3};
/* こたえあわせのしきい値（いちばん強い音のなまえを1としたわりあい）。
 * テストのピアノの音（test/mic.test.mjs）で、○を ○、まちがいを × にするわりあいがいちばんよいところ。
 * あいだ（0.12〜0.2）は「こたえの音ならある、ほかの音ならむし」：倍音ののこりで × にしないため。 */
const PRES=0.12, PRES_STRICT=0.12;  // こたえの音はこれ以上あれば「鳴っている」
const EXTRA=0.2, EXTRA_STRICT=0.15; // こたえにない音がこれ以上あれば ×（strict はきびしめ）
M.T=T;

const log2=x=>Math.log(x)/Math.LN2;
const zeros=()=>[0,0,0,0,0,0,0,0,0,0,0,0];

/* スペクトル（AnalyserNode の getFloatFrequencyData＝dB、またはふつうの大きさ）から山をひろう。
 * かえすもの：[{f:周波数Hz, a:大きさ}]（低いじゅん） */
M.peaks=(spec,sampleRate,fftSize,opts)=>{
  opts=opts||{};
  const n=spec.length, binHz=sampleRate/fftSize;
  const minHz=opts.minHz||T.minHz, maxHz=opts.maxHz||T.maxHz;
  let db=opts.db;
  if(typeof db!=='boolean'){db=false;for(let i=0;i<n;i++){if(spec[i]<0){db=true;break;}}}
  const k0=Math.max(2,Math.floor(minHz/binHz)), k1=Math.min(n-3,Math.ceil(maxHz/binHz));
  if(k1<=k0) return [];
  // dB にそろえる（-Infinity はとても小さい数に）
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
    // となりの3つで山のてっぺんを細かくさがす（放物線）
    const a=L[i-1], c=L[i+1], den=a-2*b+c;
    let d=den<0?0.5*(a-c)/den:0; if(d>0.5) d=0.5; if(d<-0.5) d=-0.5;
    out.push({f:(lo+i+d)*binHz, a:Math.pow(10,(b-0.25*(a-c)*d)/20)});
  }
  return out;
};

/* 12この音のなまえ（ド＝0 … シ＝11）ごとの強さ。いちばん強いものが1。
 * ピアノの音には倍音があるので（ドの3倍＝ソ、5倍＝ミ）、そのまま数えると鳴らしていない音が出てくる。
 * そこで、低い山からじゅんに見て、下の山の「3・5・6・7…倍」にある山は、倍音のぶんをひいてから数える。 */
M.chroma=(spec,sampleRate,fftSize,opts)=>{
  opts=opts||{};
  const pitchA=opts.pitchA||(PA.settings&&PA.settings.pitchA)||440;
  const maxHz=opts.maxHz||T.maxHz;
  const ps=M.peaks(spec,sampleRate,fftSize,{db:opts.db,minHz:opts.minHz,maxHz:Math.max(maxHz,T.envHz)}), n=ps.length, out=zeros();
  if(!n) return out;
  // A(j,h)：山 j の h倍のところにある山の大きさ（なければ0）
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
      // 倍音の大きさの見つもり：基音（または1オクターブ上）の w わり。
      // ただしとなりの倍音（h-1倍・h+1倍）よりずっと大きいことはないので、そこでおさえる
      // （低いドと1オクターブ半上のソを両方ひいたとき、ソをけしすぎない。
      //   ぴったり重なる音は波が強めあったり弱めあったりするので、どうしてもまちがうことがある）
      let s=Math.max(eff[j],T.octRef*A(j,2))*w;
      const a=A(j,h-1), b=A(j,h+1), e=a&&b?Math.min(a,b):a+b;  // 小さいほう（片方が本当にひいた音でもだいじょうぶ）
      if(e>0) s=Math.min(s,T.envK*e);
      // 足しあわせずいちばん大きいものだけ（ドの6倍とドの1オクターブ上の3倍は同じ山なので2回ひかない）
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

/* こたえあわせ。ok＝こたえの音がぜんぶはっきり鳴っていて、ほかの音が小さい。
 * score（0〜1）＝ぜんぶの強さのうちこたえの音のわりあい（いちばん弱いこたえの音が小さいとへる）
 * strict：ほかの音にきびしく（上級むけ） */
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

/* 音の大きさ（dB）から「しずか」「いまひいた（音がぐっと大きくなった）」をきめる。
 * ずっとしずかなときの大きさ（floor）をおぼえて、それより10dB 大きければ「鳴っている」。
 * 250ms のあいだのいちばん小さいときより6dB 以上大きくなったら「いまひいた」。
 * 1回ひくと音が立ちあがるあいだ2回数えてしまうので、250ms はあける。 */
M.onsetTracker=o=>{
  o=o||{};
  const rise=o.riseDb||6, gate=o.gateDb||10, absMin=o.minDb||-72, back=o.backMs||250, gap=o.gapMs||250;
  let floor=null, lastOn=-1e9; const hist=[];
  return (level,t)=>{
    if(!(level>-200)) level=-200;
    if(floor==null) floor=Math.min(level,-55);  // さいしょから鳴っていてもしずかとまちがえないように
    else if(level<floor) floor=level;
    else floor+=Math.min(level-floor,0.06);       // ゆっくり上げる（1秒で1dB くらい。部屋の音がかわってもついていく）
    const silent=level<Math.max(absMin,floor+gate);
    while(hist.length&&t-hist[0].t>back) hist.shift();
    let lo=Infinity; for(let i=0;i<hist.length;i++) if(hist[i].l<lo) lo=hist[i].l;
    const onset=!silent&&level-lo>=rise&&t-lastOn>=gap;
    if(onset) lastOn=t;
    hist.push({t:t,l:level});
    return {silent:silent, onset:onset, floor:floor};
  };
};

/* 音がおちつくのをまって、1回だけこたえを出すしくみ。
 *   new PA.mic.Listener({target:[0,4,7], strict:false, onVerdict:v=>{}, stableMs:300, maxWaitMs:2500})
 *   feed({chroma, level, onset, silent, t}) … こたえがきまったときだけ v をかえす（ほかは null）
 * きまり：
 *   - しずか（silent）なときはなにもしない（とちゅうならやめる）。
 *   - 「いまひいた」（onset、またはしずか→鳴った）からききはじめる。
 *     ばらばらにひいても、新しい音が入るたびにききなおす。
 *   - さいごの stableMs（300ms）のあいだ、12この強さがほとんどかわらない（ならした形とのにかよりが0.9以上）
 *     ときに、そのならした形でこたえあわせ。これでひいたしゅんかんのまざった音ではきめない。
 *   - maxWaitMs すぎてもおちつかないときは、それまでのならした形でこたえる（v.stable＝false）。
 *   - こたえを出したら、つぎにひくまでまつ。reset() のあとも、しずかか新しくひいた音をまつ。 */
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
  while(this.buf.length>1&&this.buf[1].t<=from) this.buf.shift(); // まどのはじめ（from）より前のものは1つだけのこす
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
// こまったときのことば（子どもにもわかるように）
M.errorText=err=>{
  const n=err&&err.name||'';
  if(n==='NotAllowedError'||n==='PermissionDeniedError'||n==='SecurityError')
    return PA.native?'マイクが使えないよ。まちがえて「許可しない」をおしたときは、「設定」アプリ →「和音アプリ」で「マイク」をオンにしてね。'
      :'マイクが使えないよ。「マイクを使ってもいい？」で「許可」をおしてね。まちがえて「許可しない」をおしたときは、ブラウザの設定でこのページのマイクを「許可」にして、ページを読みなおしてね。';
  if(n==='NotFoundError'||n==='DevicesNotFoundError'||n==='OverconstrainedError')
    return 'マイクが見つからないよ。マイクのある端末でためしてね。';
  if(n==='NotReadableError'||n==='TrackStartError'||n==='AbortError')
    return 'マイクを、ほかのアプリが使っているみたい。ほかのアプリをとじてから、もういちどおしてね。';
  if(n==='unsupported')
    return (PA.native?'この端末ではマイクが使えないよ。':'このブラウザではマイクが使えないよ。')+'画面の鍵盤でこたえてね。';
  if(n==='ended')
    return 'マイクがとまったよ。もういちど 🎤 をおしてね。';
  return 'マイクがうまく動かなかったよ。もういちどおしてね。';
};

let cur=null;
M.active=()=>!!cur;
M.start=o=>{
  o=o||{};
  const onFrame=o.onFrame||function(){}, onError=o.onError||function(){};
  M.stop();
  if(!M.supported()){onError(M.errorText({name:'unsupported'})); return Promise.resolve(false);}
  // 音のしくみはタップの中で用意する（iOS はあとからだとうごかない）。core と同じものをつかう
  let ac=null;
  try{ac=PA.audio?PA.audio():null;}catch(e){}
  if(!ac){try{const AC=window.AudioContext||window.webkitAudioContext; ac=new AC();}catch(e){}}
  if(!ac){onError(M.errorText({name:'unsupported'})); return Promise.resolve(false);}
  // iOS 17〜：core は 'playback'（鳴らすだけ）にしているので、きくあいだは 'play-and-record' に
  try{if(navigator.audioSession) navigator.audioSession.type='play-and-record';}catch(e){}
  const sess={stopped:false, ac:ac, onError:onError};
  cur=sess;
  let p;
  try{
    // 声むけのくふう（エコー・雑音けし・音量の自動調整）はピアノの音をこわすのでぜんぶオフ
    p=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  }catch(e){p=Promise.reject(e);}
  return p.then(stream=>{
    if(sess.stopped||cur!==sess){stream.getTracks().forEach(tr=>tr.stop()); return false;}
    sess.stream=stream;
    if(ac.state!=='running'&&ac.state!=='closed') ac.resume().catch(()=>{});
    const src=ac.createMediaStreamSource(stream), an=ac.createAnalyser(), mute=ac.createGain();
    // 16384：48kHz で1目もり約3Hz（低いドとレもわけられる）。ただし0.34秒ぶんをまとめて見るので、
    // ひいた直後は前の音がまざる → Listener がおちつくのをまつ
    try{an.fftSize=o.fftSize||16384;}catch(e){an.fftSize=8192;}
    an.smoothingTimeConstant=o.smoothing!=null?o.smoothing:0.5;
    an.minDecibels=-110; an.maxDecibels=-10;
    mute.gain.value=0;                       // スピーカーには出さない（ハウリングしない）。つなぐのは古い Safari でもうごかすため
    src.connect(an); an.connect(mute); mute.connect(ac.destination);
    sess.nodes=[src,an,mute];
    const freq=new Float32Array(an.frequencyBinCount);
    const useF=typeof an.getFloatTimeDomainData==='function';
    const td=useF?new Float32Array(an.fftSize):new Uint8Array(an.fftSize);
    const tail=Math.min(2048,an.fftSize);  // 音の大きさはさいごの約40ms で（ひいたしゅんかんがわかるように）
    const track=M.onsetTracker(o.onset);
    stream.getTracks().forEach(tr=>{tr.onended=()=>{if(cur===sess){M.stop(); onError(M.errorText({name:'ended'}));}};});
    const tick=()=>{
      if(cur!==sess) return;
      try{
        if(useF) an.getFloatTimeDomainData(td); else an.getByteTimeDomainData(td);
        let s=0; const N=td.length;
        for(let i=N-tail;i<N;i++){const v=useF?td[i]:(td[i]-128)/128; s+=v*v;}
        const level=10*Math.log(s/tail+1e-12)/Math.LN10;   // dBFS（0がいちばん大きい）
        const now=Date.now(), st=track(level,now);
        // しずかなときも読む（analyser のならし（smoothing）は読んだときに進むので、読まないと前の和音がのこる）
        an.getFloatFrequencyData(freq);
        const chroma=st.silent?zeros():M.chroma(freq,ac.sampleRate,an.fftSize,{db:true,pitchA:o.pitchA});
        onFrame({chroma:chroma, level:level, onset:st.onset, silent:st.silent, t:now});
      }catch(e){}
    };
    sess.timer=setInterval(tick,o.intervalMs||60); // requestAnimationFrame よりかるい・画面に関係なくまわる
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
