/* ピアノ和音アプリ 共通の しくみ（すべてのページで使う）
 *
 * つかいかた（各ページ）
 *   <link rel="stylesheet" href="assets/app.css">
 *   <script src="assets/core.js"></script>
 *   <header class="appbar" id="appbar"></header><main class="page" id="view"></main>
 *   PA.mountBar({title:'和音のしくみ', app:'chord-build'})   … もどる・設定（音名・基準の音・音）
 *   PA.paint(document.getElementById('view'), html, sig)    … 描きかえ（横スクロール位置とフォーカスを たもつ）
 *   PA.onSettings = ()=>render()                            … 設定が かわったら 描きなおす
 *   PA.onKey = m=>{...}                                     … 鍵盤を タップしたとき（音は core が 鳴らす）
 *   PA.onStopDown = ()=>{...}                               … data-act="stop" を おした瞬間（描きなおさずに 音を止める）
 *   PA.onStopCancel = ()=>render()                          … ⏹ を おしたのに click が 来なかった（指が ずれた・スクロール）とき 画面を もどす
 *   PA.paint(document.getElementById('actions'), html, 'bar') … 下のボタンバーも これで 描くと フォーカスが のこる
 *   PA.onPageShow = ()=>render()                            … 「もどる」で bfcache から もどってきたとき
 *
 * 音楽：PA.majorKey(i) / PA.minorKey(i)、PA.at(scale,k)、PA.nm(note)、PA.nmH(note)、PA.namesH(notes)
 * 音  ：PA.playNote(midi,when,dur,vel)、PA.chord(midis,{when,dur,arp,vel})、PA.stopSound()
 * 図  ：PA.kbSVG(lo,hi,marks,opts)、PA.staffSVG(key,cols,opts)
 * UI  ：PA.keyChip(key)、PA.openKeySheet({minor,idx,onPick,both})、PA.seg(act,opts,cur)
 * 平均律・A4＝基準ピッチ（設定で 440〜443Hz）。生徒は絶対音感があるので、音の高さと表示は かならず そろえる。
 */
(function(){
'use strict';
const PA=window.PA={};
document.documentElement.lang='ja';

/* ===== 保存（使えないブラウザでも こわれないように） ===== */
PA.store={
  get(k,d){try{const v=localStorage.getItem('pianoapps.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('pianoapps.'+k,JSON.stringify(v));}catch(e){}}
};
const S=PA.settings={naming:'solfa',sound:true,pitchA:440};
(function(){
  const d=PA.store.get('settings',{})||{};
  if(['solfa','en','ja'].includes(d.naming)) S.naming=d.naming;
  if(typeof d.sound==='boolean') S.sound=d.sound;
  if([440,441,442,443].includes(d.pitchA)) S.pitchA=d.pitchA;
})();
PA.saveSettings=()=>PA.store.set('settings',S);

/* ===== 音楽の基本 ===== */
PA.LET_SOLFA=['ド','レ','ミ','ファ','ソ','ラ','シ'];
PA.LET_EN='CDEFGAB';
PA.LET_JA='ハニホヘトイロ';
PA.NAT=[0,2,4,5,7,9,11];
PA.ACC={'-2':'𝄫','-1':'♭','0':'','1':'♯','2':'𝄪'};
PA.MAJ=[0,2,4,5,7,9,11]; PA.NMIN=[0,2,3,5,7,8,10]; PA.HMIN=[0,2,3,5,7,8,11];
// [主音の文字, 変化記号]。♯系 → ♭系の順
PA.MAJOR_KEYS=[[0,0],[4,0],[1,0],[5,0],[2,0],[6,0],[3,1],[3,0],[6,-1],[2,-1],[5,-1],[1,-1],[4,-1]];
PA.MINOR_KEYS=[[5,0],[2,0],[6,0],[3,1],[0,1],[4,1],[1,1],[1,0],[4,0],[0,0],[3,0],[6,-1],[2,-1]];
PA.MAJOR_FLAT_FROM=7; PA.MINOR_FLAT_FROM=7;
PA.SHARP_ORDER=[3,0,4,1,5,2,6];
PA.BLACK=new Set([1,3,6,8,10]);
PA.COL={I:'#e8553d',IV:'#22a06b',V:'#2f7ee8',V7:'#8a4fe0'};
PA.LCOL={I:'#fde5df',IV:'#daf3e6',V:'#dfeafd',V7:'#ece2fb'};
const mod=PA.mod=(a,n)=>((a%n)+n)%n;
PA.spell=(L,pc)=>{let a=mod(pc-PA.NAT[L],12);if(a>6)a-=12;return a;};
PA.buildScale=(l,tpc,tonicMidi,ints)=>ints.map((iv,i)=>{const L=(l+i)%7;return {letter:L,acc:PA.spell(L,tpc+iv),midi:tonicMidi+iv,deg:i+1};});
const placeTonic=(tpc,base)=>base+mod(tpc-base,12);
// 長調：主音は base〜base+11（ふだんは ド4〜シ4）
PA.majorKey=(idx,base=60)=>{
  const [l,a]=PA.MAJOR_KEYS[idx], tpc=mod(PA.NAT[l]+a,12), tonicMidi=placeTonic(tpc,base);
  const scale=PA.buildScale(l,tpc,tonicMidi,PA.MAJ), sig={};
  scale.forEach(n=>sig[n.letter]=n.acc);
  return {idx,l,a,tpc,tonicMidi,minor:false,scale,sig};
};
// 短調：nat＝自然的短音階（調号のまま）、harm＝和声的短音階（7ばんめを上げる。harm[6].raised）
PA.minorKey=(idx,base=57)=>{
  const [l,a]=PA.MINOR_KEYS[idx], tpc=mod(PA.NAT[l]+a,12), tonicMidi=placeTonic(tpc,base);
  const nat=PA.buildScale(l,tpc,tonicMidi,PA.NMIN), harm=PA.buildScale(l,tpc,tonicMidi,PA.HMIN);
  harm[6].raised=true;
  const sig={}; nat.forEach(n=>sig[n.letter]=n.acc);
  const rl=(l+2)%7, rpc=mod(tpc+3,12);
  const rel={l:rl,a:PA.spell(rl,rpc),minor:false,tpc:rpc,tonicMidi:60+rpc}; rel.scale=PA.buildScale(rl,rpc,60+rpc,PA.MAJ);
  const par={l,a,minor:false,tpc,tonicMidi,scale:PA.buildScale(l,tpc,tonicMidi,PA.MAJ)};
  return {idx,l,a,tpc,tonicMidi,minor:true,nat,harm,scale:harm,sig,rel,par,lt:harm[6],natLT:nat[6],ltType:harm[6].acc};
};
PA.keyOf=(minor,idx,base)=>minor?PA.minorKey(idx,base):PA.majorKey(idx,base);
PA.keyCount=minor=>(minor?PA.MINOR_KEYS:PA.MAJOR_KEYS).length;
PA.at=(scale,k)=>{const s=scale[mod(k,7)];return {...s,midi:s.midi+12*Math.floor(k/7),k};};
PA.sigInfo=key=>{
  const sh=PA.SHARP_ORDER.filter(L=>key.sig[L]>0), fl=[...PA.SHARP_ORDER].reverse().filter(L=>key.sig[L]<0);
  return sh.length?{type:1,letters:sh}:{type:-1,letters:fl};
};
// 音階にない音（まちがえて押した音など）の 名前：♯の調・調号なしは ♯、♭の調は ♭ で
PA.spellMidi=(m,key)=>{
  const pc=mod(m,12), sc=[...(key.scale||[]),...(key.nat||[])];
  const s=sc.find(x=>mod(x.midi,12)===pc); if(s) return {letter:s.letter,acc:s.acc,midi:m};
  const SH=[[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
  const FL=[[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];
  const si=PA.sigInfo(key), [L,a]=((si.type>0||!si.letters.length)?SH:FL)[pc];
  return {letter:L,acc:a,midi:m};
};

/* ===== 名前 ===== */
PA.nm=n=>{
  const a=n.acc||0;
  if(S.naming==='en') return PA.LET_EN[n.letter]+PA.ACC[a];
  if(S.naming==='ja') return (a===1?'嬰':a===-1?'変':a===2?'重嬰':a===-2?'重変':'')+PA.LET_JA[n.letter];
  return PA.LET_SOLFA[n.letter]+PA.ACC[a];
};
// 𝄪 は 端末によって 出ないので、楽譜と同じ「x」の形で 出す。𝄫 も 出ない 端末が あるので ♭♭ で 出す
PA.H=s=>String(s).replace(/𝄪/g,'<span class="ds">x</span>').replace(/𝄫/g,'<span class="df" style="letter-spacing:-.12em">♭♭</span>');
PA.Svg=s=>String(s).replace(/𝄪/g,'<tspan font-family="Arial,Helvetica,sans-serif" font-weight="900">x</tspan>').replace(/𝄫/g,'<tspan letter-spacing="-1.5">♭♭</tspan>');
PA.nmH=n=>PA.H(PA.nm(n));
PA.namesH=(ns,sep='・')=>ns.map(PA.nmH).join(sep);
PA.namesT=(ns,sep='・')=>ns.map(PA.nm).join(sep);
PA.keyName=k=>(k.a>0?'嬰':k.a<0?'変':'')+PA.LET_JA[k.l]+(k.minor?'短調':'長調');
PA.keyEn=k=>PA.H(PA.LET_EN[k.l]+PA.ACC[k.a]+(k.minor?'m':''));
PA.sigLabel=k=>{const s=PA.sigInfo(k);return s.letters.length?(s.type>0?'♯':'♭')+s.letters.length+'つ':'調号なし';};

/* ===== 音 ===== */
let actx=null,master=null;
const voices=new Set();
PA.audio=()=>{
  if(!actx){
    try{if(navigator.audioSession) navigator.audioSession.type='playback';}catch(e){}
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    actx=new AC();
    const comp=actx.createDynamicsCompressor();
    master=actx.createGain(); master.gain.value=0.7;
    master.connect(comp); comp.connect(actx.destination);
  }
  if(actx.state!=='running'&&actx.state!=='closed') actx.resume().catch(()=>{});
  return actx;
};
PA.audioRunning=()=>!!(actx&&actx.state==='running');
['pointerup','touchend','click','keydown'].forEach(t=>document.addEventListener(t,()=>{if(S.sound)PA.audio();},{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&actx&&actx.state!=='running'&&actx.state!=='closed')actx.resume().catch(()=>{});});
PA.playNote=(midi,when=0,dur=1.6,vel=0.22)=>{
  if(!S.sound) return; const ac=PA.audio(); if(!ac) return;
  const t=ac.currentTime+when+0.01, f=S.pitchA*Math.pow(2,(midi-69)/12); // 平均律・A4＝基準ピッチ
  const g=ac.createGain(), lp=ac.createBiquadFilter();
  lp.type='lowpass';
  lp.frequency.setValueAtTime(Math.min(9000,f*9),t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f*1.6,350),t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vel,t+0.008);
  g.gain.exponentialRampToValueAtTime(vel*0.35,t+0.28);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  g.connect(lp); lp.connect(master);
  const parts=[[1,1,'triangle'],[2,0.42,'sine'],[3,0.16,'sine'],[4,0.08,'sine']], voice={os:[],g,t0:t};
  voices.add(voice);
  parts.forEach(([h,a,type],i)=>{
    const o=ac.createOscillator(), og=ac.createGain();
    o.type=type; o.frequency.value=f*h; og.gain.value=a;
    o.connect(og); og.connect(g); o.start(t); o.stop(t+dur+0.05);
    o.onended=()=>{try{o.disconnect();og.disconnect();if(i===parts.length-1){g.disconnect();lp.disconnect();voices.delete(voice);}}catch(e){}};
    voice.os.push(o);
  });
};
PA.stopSound=()=>{
  if(actx){
    const t=actx.currentTime;
    voices.forEach(v=>{try{
      const p=v.g.gain;
      if(v.t0>t){p.cancelScheduledValues(0);p.setValueAtTime(0,t);} // まだ鳴りはじめていない音は すぐ消す
      else{
        if(p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else {p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);}
        p.setTargetAtTime(0.0001,t,0.015);
      }
      v.os.forEach(o=>o.stop(t+0.12));
    }catch(e){}});
  }
  voices.clear();
};
PA.chord=(ms,o={})=>{
  const when=o.when||0, arp=!!o.arp, dur=o.dur||(arp?1.6:2.2);
  const vel=o.vel||(arp?0.22:Math.min(0.17,0.5/Math.max(ms.length,1)+0.05));
  ms.forEach((m,i)=>PA.playNote(m,when+(arp?i*(o.gap||0.36):i*0.012),dur,vel));
};
PA.sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ===== けんばん SVG =====
 * marks: Map midi -> {fill, label, tc(文字色), ring(わくの色), light(黒鍵を うすく), bubble(黒鍵ラベルの ふきだしの色), sub(下の小さな字), subColor, focus(最初に見せたい鍵)}
 * opts.mifa（ミファ・シドの目印。ふつうは表示）
 */
// 読み上げ用の 鍵の名前（白鍵は そのまま、黒鍵は ♯と♭の 両方）
const WL=[0,null,1,null,2,3,null,4,null,5,null,6];
const keyLabel=m=>{
  const pc=mod(m,12), L=WL[pc];
  const n=L!=null?PA.nm({letter:L,acc:0}):PA.nm({letter:WL[pc-1],acc:1})+'／'+PA.nm({letter:WL[pc+1],acc:-1});
  return n+(m===60?'（まんなか）':'');
};
PA.kbSVG=(lo,hi,marks=new Map(),opts={})=>{
  const W=40,H=170,BW=25,BH=106,TOP=34, mifa=opts.mifa!==false;
  const wh=[];for(let m=lo;m<=hi;m++) if(!PA.BLACK.has(mod(m,12))) wh.push(m);
  const X={}; wh.forEach((m,i)=>X[m]=i*W);
  const TW=wh.length*W, TH=TOP+H+24;
  // キーボードでも ひける：けんばん1つにつき Tab で 1か所（←→ で となりの鍵、Enter／スペースで ひく）
  const drawn=[];for(let m=lo;m<=hi;m++) if(!PA.BLACK.has(mod(m,12))||X[m-1]!==undefined) drawn.push(m);
  const tabM=(drawn.find(m=>{const k=marks.get(m);return k&&k.focus;})??drawn.find(m=>marks.get(m))??(drawn.includes(60)?60:drawn[0]));
  let s=`<svg viewBox="-2 0 ${TW+4} ${TH}" class="kb" style="min-width:${wh.length*36}px;max-width:${wh.length*56}px;margin-inline:auto" role="group" aria-label="けんばん">`;
  const attrs=(m,mk)=>`data-m="${m}" ${mk?'data-mk="1"':''} ${mk&&mk.focus?'data-focus="1"':''} tabindex="${m===tabM?0:-1}" role="button" aria-label="${keyLabel(m)}"`;
  wh.forEach(m=>{
    const x=X[m], mk=marks.get(m);
    s+=`<rect ${attrs(m,mk)} class="key" x="${x}" y="${TOP}" width="${W}" height="${H}" rx="5" fill="${mk&&mk.fill?mk.fill:'#fff'}" stroke="#8d8278" stroke-width="1.2"/>`;
    if(mk&&mk.ring) s+=`<rect x="${x+3}" y="${TOP+3}" width="${W-6}" height="${H-6}" rx="5" fill="none" stroke="${mk.ring}" stroke-width="4" pointer-events="none"/>`;
    if(mk&&mk.label) s+=`<text x="${x+W/2}" y="${TOP+H-40}" text-anchor="middle" font-size="${String(mk.label).length>3?12:15}" font-weight="800" fill="${mk.tc||'#fff'}">${PA.Svg(mk.label)}</text>`;
    if(mk&&mk.sub) s+=`<text x="${x+W/2}" y="${TOP+H+17}" text-anchor="middle" font-size="11" font-weight="700" fill="${mk.subColor||'#857c8f'}">${mk.sub}</text>`;
    else if(m===60) s+=`<text x="${m===lo?x+2:x+W/2}" y="${TOP+H+17}" text-anchor="${m===lo?'start':'middle'}" font-size="12" fill="#a99f93">まんなかの${PA.nm({letter:0,acc:0})}</text>`;
  });
  if(mifa) wh.forEach(m=>{const pc=mod(m,12);if((pc===4||pc===11)&&X[m+1]!==undefined) s+=`<rect x="${X[m]+W-3}" y="${TOP+H-30}" width="6" height="24" rx="3" fill="#f4a100" pointer-events="none"/>`;});
  for(let m=lo;m<=hi;m++){
    if(!PA.BLACK.has(mod(m,12))||X[m-1]===undefined) continue;
    const x=X[m-1]+W-BW/2, mk=marks.get(m);
    s+=`<rect ${attrs(m,mk)} class="key" x="${x}" y="${TOP}" width="${BW}" height="${BH}" rx="4" fill="${mk&&mk.fill?mk.fill:'#2b2630'}" stroke="#1e1a22" stroke-width="1"/>`;
    if(mk&&mk.light) s+=`<rect x="${x+3}" y="${TOP+3}" width="${BW-6}" height="${BH-6}" rx="3" fill="#fff" opacity=".45" pointer-events="none"/>`;
    if(mk&&mk.ring) s+=`<rect x="${x+2}" y="${TOP+2}" width="${BW-4}" height="${BH-4}" rx="4" fill="none" stroke="${mk.ring}" stroke-width="4" pointer-events="none"/>`;
    if(mk&&mk.label){
      const cx=x+BW/2, lc=mk.ring||mk.fill||'#3a3245';
      s+=`<line x1="${cx}" y1="27" x2="${cx}" y2="${TOP+4}" stroke="${lc}" stroke-width="2"/>`;
      s+=`<rect x="${cx-21}" y="3" width="42" height="24" rx="12" fill="${mk.bubble||mk.fill||'#fff'}" stroke="${lc}" stroke-width="2" pointer-events="none"/>`;
      s+=`<text x="${cx}" y="20" text-anchor="middle" font-size="${String(mk.label).length>3?10.5:13}" font-weight="800" fill="${mk.tc||'#fff'}">${PA.Svg(mk.label)}</text>`;
    }
    if(mk&&mk.sub) s+=`<text x="${x+BW/2}" y="${TOP+BH+14}" text-anchor="middle" font-size="11" font-weight="700" fill="${mk.subColor||'#857c8f'}">${mk.sub}</text>`;
  }
  return s+'</svg>';
};

/* ===== がくふ SVG ===== */
PA.stepOf=n=>n.letter+7*(Math.floor((n.midi-n.acc)/12)-1); // ド4＝28、ミ4＝30（ト音記号の第1線）
PA.accGlyph=(x,y,a,color='#3a3245')=>{
  if(a===1) return `<g stroke="${color}" fill="none"><line x1="${x-2}" x2="${x-2}" y1="${y-9}" y2="${y+8}" stroke-width="1.3"/><line x1="${x+2}" x2="${x+2}" y1="${y-8}" y2="${y+9}" stroke-width="1.3"/><line x1="${x-5}" x2="${x+5}" y1="${y-2}" y2="${y-4}" stroke-width="2.6"/><line x1="${x-5}" x2="${x+5}" y1="${y+4}" y2="${y+2}" stroke-width="2.6"/></g>`;
  if(a===-1) return `<g stroke="${color}" fill="none" stroke-width="1.5"><line x1="${x-3}" x2="${x-3}" y1="${y-13}" y2="${y+5}"/><path d="M${x-3} ${y+5} C${x+6} ${y} ${x+5} ${y-6} ${x-3} ${y-2}" stroke-width="2"/></g>`;
  if(a===0) return `<g stroke="${color}" fill="none"><line x1="${x-3}" x2="${x-3}" y1="${y-11}" y2="${y+4}" stroke-width="1.3"/><line x1="${x+3}" x2="${x+3}" y1="${y-4}" y2="${y+11}" stroke-width="1.3"/><line x1="${x-3}" x2="${x+3}" y1="${y-2}" y2="${y-4}" stroke-width="2.6"/><line x1="${x-3}" x2="${x+3}" y1="${y+4}" y2="${y+2}" stroke-width="2.6"/></g>`;
  if(a===2) return `<g stroke="${color}" stroke-width="2.6" stroke-linecap="round"><line x1="${x-4}" y1="${y-4}" x2="${x+4}" y2="${y+4}"/><line x1="${x-4}" y1="${y+4}" x2="${x+4}" y2="${y-4}"/></g>`;
  if(a===-2) return PA.accGlyph(x-4,y,-1,color)+PA.accGlyph(x+4,y,-1,color);
  return '';
};
// ト音記号（y0＝ソ4の線）／ヘ音記号（y0＝ファ3の線）。フォントに頼らない線画
PA.gClef=(x,y0)=>`<g transform="translate(${x} ${y0})" fill="none" stroke="#3a3245" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3 C8 3 7 -5 13 -7 C21 -9 25 0 20 7 C14 14 2 10 2 0 C2 -10 12 -17 17 -27 C20 -34 19 -44 15 -44 C10 -44 8 -34 10 -24 L16 24 C17 31 11 33 8 29"/><circle cx="9.5" cy="27.5" r="3.2" fill="#3a3245" stroke="none"/></g>`;
PA.fClef=(x,y0)=>`<g transform="translate(${x} ${y0})"><circle cx="5" cy="0" r="4" fill="#3a3245"/><path d="M3 -2 C4 -10 14 -12 19 -7 C25 -1 22 10 14 17 C9 21 4 24 -1 26" fill="none" stroke="#3a3245" stroke-width="2.8" stroke-linecap="round"/><circle cx="27" cy="-5" r="2.2" fill="#3a3245"/><circle cx="27" cy="5" r="2.2" fill="#3a3245"/></g>`;
/* cols: [{notes:[...ト音記号], lh:[...ヘ音記号], color, ltColor(導音の色), accColor, accRing, label, labelColor, op, noAcc, carry:{文字:変化記号}}]
 * opts: {grand, colW, minW, arrows:[{c1,i1,c2,i2,color,text,dash,dy}], sigOverride:{letter,acc}, noSig, maxScale} */
PA.staffSVG=(key,cols,o={})=>{
  const sig=o.noSig?{type:1,letters:[]}:PA.sigInfo(key), ov=o.sigOverride, grand=!!o.grand;
  const TSs=[38,35,39,36,33,37,34], TSf=[34,37,33,36,32,35,31];
  const TS=sig.type>0?TSs:TSf;
  const sigDraw=sig.letters.map((L,i)=>({L,st:TS[i],a:sig.type,red:false}));
  if(ov){
    const hit=sigDraw.find(d=>d.L===ov.letter);
    if(hit){hit.a=ov.acc;hit.red=true;}
    else sigDraw.push({L:ov.letter,st:TSs[PA.SHARP_ORDER.indexOf(ov.letter)],a:ov.acc,red:true});
  }
  const ns=sigDraw.length, TB=grand?96:110, BT=TB+82, cw=o.colW||70, sx=50, nx=sx+ns*10+(ns?24:14);
  const hasLabel=cols.some(c=>c.label);
  const ty=s=>TB-(s-30)*5, by=s=>BT-(s-26)*5;
  // いちばん低い音符の 下に 余白と 和音名を おく（低い ベースと 名前が 重ならないように）
  let lowY=grand?BT+40:TB;
  cols.forEach(c=>{
    (c.notes||[]).forEach(n=>{lowY=Math.max(lowY,ty(PA.stepOf(n)));});
    if(grand)(c.lh||[]).forEach(n=>{lowY=Math.max(lowY,by(PA.stepOf(n)));});
  });
  const baseH=grand?BT+48:TB+48, labelY=Math.max(baseH+16,lowY+30);
  const W=Math.max(nx+cols.length*cw+8,o.minW||0), H=hasLabel?labelY+6:Math.max(baseH,lowY+16);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="がくふ" style="max-width:${Math.round(W*(o.maxScale||1.5))}px;margin:0 auto">`;
  for(let i=0;i<5;i++) svg+=`<line x1="6" x2="${W-4}" y1="${TB-i*10}" y2="${TB-i*10}" stroke="#6b6273" stroke-width="1.2"/>`;
  svg+=PA.gClef(10,TB-10);
  if(grand){
    for(let i=0;i<5;i++) svg+=`<line x1="6" x2="${W-4}" y1="${BT+i*10}" y2="${BT+i*10}" stroke="#6b6273" stroke-width="1.2"/>`;
    svg+=`<line x1="6" x2="6" y1="${TB-40}" y2="${BT+40}" stroke="#6b6273" stroke-width="2"/>`;
    svg+=PA.fClef(12,BT+10);
  }
  sigDraw.forEach((d,i)=>{
    if(d.red) svg+=`<circle cx="${sx+i*10}" cy="${ty(d.st)}" r="10" fill="#fde4e7"/>`;
    svg+=PA.accGlyph(sx+i*10,ty(d.st),d.a,d.red?'#d1495b':'#3a3245');
    if(grand) svg+=PA.accGlyph(sx+i*10,by(d.st-14),d.a,d.red?'#d1495b':'#3a3245');
  });
  const pos=[];
  const drawNotes=(ci,c,arr,yf,lo,hi)=>{
    if(!arr||!arr.length) return '';
    const x=nx+ci*cw+cw/2;
    const P=arr.map((n,i)=>({n,i,s:PA.stepOf(n)})).sort((a,b)=>a.s-b.s);
    let ps=-99,po=false; P.forEach(p=>{p.off=(p.s-ps===1&&!po);po=p.off;ps=p.s;});
    const anyOff=P.some(p=>p.off), minS=P[0].s, maxS=P[P.length-1].s;
    let r='';
    for(let q=lo-2;q>=minS;q-=2) r+=`<line x1="${x-12}" x2="${x+12+(anyOff?13:0)}" y1="${yf(q)}" y2="${yf(q)}" stroke="#6b6273" stroke-width="1.4"/>`;
    for(let q=hi+2;q<=maxS;q+=2) r+=`<line x1="${x-12}" x2="${x+12+(anyOff?13:0)}" y1="${yf(q)}" y2="${yf(q)}" stroke="#6b6273" stroke-width="1.4"/>`;
    const accCols=[];
    [...P].reverse().forEach(p=>{
      const sigAcc=o.noSig?0:(key.sig[p.n.letter]||0);
      const need=(p.n.acc!==sigAcc)||(c.carry&&c.carry[p.n.letter]!==undefined&&c.carry[p.n.letter]!==p.n.acc);
      const hx=x+(p.off?13:0), hy=yf(p.s);
      if(need&&!c.noAcc){
        let k=0; while(accCols.some(q=>q.k===k&&Math.abs(q.s-p.s)<6)) k++;
        accCols.push({k,s:p.s});
        const ac=p.n.raised?(c.accColor||'#d1495b'):(c.color||'#3a3245');
        r+=PA.accGlyph(x-18-k*11,hy,p.n.acc,ac);
        if(p.n.raised&&c.accRing) r+=`<circle cx="${x-18-k*11}" cy="${hy}" r="11" fill="none" stroke="${ac}" stroke-width="2" opacity=".6"/>`;
      }
      const col=p.n.raised&&c.ltColor?c.ltColor:(c.color||'#3a3245');
      r+=`<ellipse cx="${hx}" cy="${hy}" rx="7" ry="5" fill="#fff" stroke="${col}" stroke-width="3" transform="rotate(-18 ${hx} ${hy})"/>`;
      if(yf===ty){pos[ci]=pos[ci]||[];pos[ci][p.i]={x:hx,y:hy};}
    });
    return r;
  };
  cols.forEach((c,ci)=>{
    const x=nx+ci*cw+cw/2;
    svg+=`<g opacity="${c.op==null?1:c.op}">`+drawNotes(ci,c,c.notes,ty,30,38)+(grand?drawNotes(ci,c,c.lh,by,18,26):'');
    if(c.label) svg+=`<text x="${x}" y="${labelY}" text-anchor="middle" font-size="17" font-weight="800" fill="${c.labelColor||'#3a3245'}">${PA.Svg(c.label)}</text>`;
    svg+=`</g>`;
  });
  (o.arrows||[]).forEach(a=>{
    const p=pos[a.c1]&&pos[a.c1][a.i1], q=pos[a.c2]&&pos[a.c2][a.i2]; if(!p||!q) return;
    svg+=`<path d="M${p.x+12} ${p.y} L${q.x-22} ${q.y}" stroke="${a.color}" stroke-width="2.2" fill="none" stroke-dasharray="${a.dash||''}" marker-end="url(#ar-${a.color.slice(1)})"/>`;
    if(a.text) svg+=`<text x="${q.x+14}" y="${q.y+5+(a.dy||0)}" font-size="14" font-weight="800" fill="${a.color}">${a.text}</text>`;
  });
  const cs=[...new Set((o.arrows||[]).map(a=>a.color))];
  if(cs.length) svg+=`<defs>${cs.map(c=>`<marker id="ar-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${c}"/></marker>`).join('')}</defs>`;
  return svg+'</svg>';
};

/* ===== 画面のしくみ ===== */
PA.seg=(act,opts,cur,cls='')=>`<div class="seg ${cls}" role="group">`+opts.map(([v,l])=>`<button class="${String(v)===String(cur)?'on':''}" data-act="${act}" data-v="${v}" aria-pressed="${String(v)===String(cur)}">${l}</button>`).join('')+`</div>`;
PA.keyChip=key=>`<button class="keychip" data-pa="keysheet" aria-haspopup="dialog">${PA.keyName(key)}<small>${PA.sigLabel(key)}</small></button>`;
let sheetEl=null;
function sheet(html){
  if(!sheetEl){sheetEl=document.createElement('dialog');sheetEl.className='sheet';document.body.appendChild(sheetEl);
    sheetEl.addEventListener('click',e=>{if(e.target===sheetEl) sheetEl.close();});}
  sheetEl.innerHTML=`<div class="sheet-in">${html}</div>`;
  if(!sheetEl.open){ if(sheetEl.showModal) sheetEl.showModal(); else sheetEl.setAttribute('open',''); }
  return sheetEl;
}
PA.closeSheet=()=>{if(sheetEl&&sheetEl.open) sheetEl.close();};
// 調をえらぶシート：minor（短調か）, idx（いま）, both（長調・短調を切りかえられる）, onPick(minor,idx)
PA.openKeySheet=o=>{
  let minor=!!o.minor;
  const draw=()=>{
    const n=PA.keyCount(minor), flatFrom=minor?PA.MINOR_FLAT_FROM:PA.MAJOR_FLAT_FROM;
    let h=`<div class="sheet-head"><h2>調を えらぶ</h2><button class="iconbtn" data-sheet="close" aria-label="とじる">✕</button></div>`;
    if(o.both) h+=`<div style="margin-bottom:10px">${PA.seg('pa-mode',[['0','☀️ 長調'],['1','🌙 短調']],minor?'1':'0','full')}</div>`;
    h+=`<div class="keygrid"><div class="sep">調号なし・♯の調</div>`;
    for(let i=0;i<n;i++){
      if(i===flatFrom) h+=`<div class="sep">♭の調</div>`;
      const k=PA.keyOf(minor,i);
      h+=`<button class="kbtn ${minor===!!o.minor&&i===o.idx?'on':''}" data-sheet="key" data-v="${i}">${PA.keyName(k)}<small>${PA.sigLabel(k)}・${PA.keyEn(k)}</small></button>`;
    }
    const el=sheet(h+`</div>`);
    el.onclick=e=>{
      if(e.target===el){el.close();return;}
      const b=e.target.closest('[data-sheet],[data-act="pa-mode"]'); if(!b) return;
      if(b.dataset.act==='pa-mode'){minor=b.dataset.v==='1';draw();const n=el.querySelector(`[data-act="pa-mode"][data-v="${minor?1:0}"]`);if(n)n.focus({preventScroll:true});return;}
      if(b.dataset.sheet==='close'){el.close();return;}
      if(b.dataset.sheet==='key'){
        el.close();o.onPick(minor,+b.dataset.v);
        // 描きなおしで 調のボタンが 入れかわっても、キーボードの フォーカスを 調のボタンに もどす
        const ae=document.activeElement;
        if(!ae||ae===document.body||!document.contains(ae)){const n=document.querySelector('[data-pa="keysheet"]');if(n)n.focus({preventScroll:true});}
      }
    };
  };
  draw();
};
PA.openSettings=()=>{
  const h=`<div class="sheet-head"><h2>⚙️ せってい</h2><button class="iconbtn" data-sheet="close" aria-label="とじる">✕</button></div>
    <div class="setrow"><label for="pa-naming">音の名前</label><select id="pa-naming"><option value="solfa">ドレミ</option><option value="en">CDE</option><option value="ja">ハニホ</option></select></div>
    <div class="setrow"><label for="pa-pitch">基準の音（ラ）</label><select id="pa-pitch"><option value="440">440Hz</option><option value="441">441Hz</option><option value="442">442Hz</option><option value="443">443Hz</option></select></div>
    <div class="setrow"><label for="pa-sound">音を 鳴らす</label><select id="pa-sound"><option value="1">🔊 鳴らす</option><option value="0">🔇 鳴らさない</option></select></div>
    <p class="note">音は平均律で、ラ（A4）を えらんだ周波数にして 鳴らします（440Hzのとき まんなかのド＝約261.6Hz）。教室のピアノが442Hzなら 442Hzに。<br>iPhone・iPad で音が出ないときは、消音（マナーモード）を解除してください。</p>`;
  const el=sheet(h);
  el.querySelector('#pa-naming').value=S.naming; el.querySelector('#pa-pitch').value=String(S.pitchA); el.querySelector('#pa-sound').value=S.sound?'1':'0';
  el.onclick=e=>{if(e.target===el||e.target.closest('[data-sheet="close"]')) el.close();};
  el.onchange=e=>{
    const t=e.target;
    if(t.id==='pa-naming') S.naming=t.value;
    if(t.id==='pa-pitch'){S.pitchA=+t.value;PA.playNote(69,0,1.6,0.25);}
    if(t.id==='pa-sound'){S.sound=t.value==='1';if(!S.sound)PA.stopSound();}
    PA.saveSettings(); if(PA.onSettings) PA.onSettings();
  };
};
// 上のバー（もどる・題名・設定）。app はホームの「つづき」に使う名前
// ほかのアプリから PA.go() で 来たときは、‹ で そのアプリに もどる（1時間以内・ホームを ひらくと リセット）
PA.mountBar=o=>{
  const bar=document.getElementById('appbar');
  PA.currentApp=o.app||null;
  const r=PA.store.get('return-to',null);
  let back=o.back||'index.html', label='ホームに もどる';
  if(!o.back&&r&&typeof r.app==='string'&&/^[a-z-]+$/.test(r.app)&&r.app!==o.app&&Date.now()-r.t<36e5){back=r.app+'.html';label='まえの アプリに もどる';}
  bar.innerHTML=`<a class="iconbtn" href="${back}" aria-label="${label}">‹</a><h1>${o.title}</h1><button class="iconbtn" data-pa="settings" aria-label="せってい">⚙️</button>`;
  document.title=o.title;
  if(o.app) PA.store.set('last',{app:o.app,title:o.title,t:Date.now()});
};
PA.go=page=>{if(PA.currentApp) PA.store.set('return-to',{app:PA.currentApp,t:Date.now()}); location.href=page;};
document.addEventListener('click',e=>{
  // ページの中の ふつうの リンクで ほかの アプリへ 行くときも、‹ で ここに もどれるように
  const a=e.target.closest&&e.target.closest('#view a[href$=".html"]');
  if(a&&PA.currentApp&&!/(^|\/)index\.html$/.test(a.getAttribute('href'))) PA.store.set('return-to',{app:PA.currentApp,t:Date.now()});
  const b=e.target.closest('[data-pa]'); if(!b) return;
  if(b.dataset.pa==='settings') PA.openSettings();
  if(b.dataset.pa==='keysheet'&&PA.onKeySheet) PA.onKeySheet();
});
// 「もどる」で 前の画面から そのまま もどってきたとき（bfcache）。ホームでは「まえの アプリ」を わすれる
window.addEventListener('pageshow',e=>{
  if(!e.persisted) return;
  if(!PA.currentApp) PA.store.set('return-to',null);
  if(PA.onPageShow) PA.onPageShow();
});

/* 描きかえ：横スクロール（data-sk の名前ごと）・ひらいた <details>・フォーカスを たもつ。sig が かわったら 横スクロールは 最初の位置に
 * 下のボタンバーも PA.paint(document.getElementById('actions'),html,'bar') で 描くと、押したボタンが 入れかわっても フォーカスが のこる */
const lastSigs=new WeakMap();
const FOCUS_NEXT={build:['stop'],stop:['build','cplay','wcad'],play:['stop'],cplay:['stop'],enew:['eplay'],eans:['enew'],qchoose:['qnext'],qmark:['qnext'],qcheck:['qnext'],qnext:['qcheck']};
const dKey=(d,i)=>d.id||(d.dataset&&d.dataset.d)||((d.className||'')+':'+((d.querySelector('summary')||{}).textContent||'').trim())||('#'+i);
const rove=k=>{const svg=k.closest('svg');if(svg) svg.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('tabindex',x===k?'0':'-1'));};
PA.paint=(el,html,sig)=>{
  const ae=document.activeElement, ds=ae&&ae.dataset?ae.dataset:{}, inEl=!!ae&&ae!==el&&el.contains(ae);
  const fa=ds.act||null, fv=ds.v, fp=ds.pa||null, wasBtn=inEl&&ae.tagName==='BUTTON';
  const km=inEl&&ds.m!=null&&ae.closest('.kb')?ds.m:null, kIdx=km!=null?[...el.querySelectorAll(`[data-m="${km}"]`)].indexOf(ae):-1;
  const keep={}; if(sig===lastSigs.get(el)) el.querySelectorAll('[data-sk]').forEach(b=>keep[b.dataset.sk]=b.scrollLeft);
  const openD=new Set(); el.querySelectorAll('details').forEach((d,i)=>{if(d.open) openD.add(dKey(d,i));});
  el.innerHTML=html;
  if(openD.size) el.querySelectorAll('details').forEach((d,i)=>{if(!d.open&&openD.has(dKey(d,i))) d.open=true;});
  el.querySelectorAll('[data-sk]').forEach(b=>{ if(keep[b.dataset.sk]!=null) b.scrollLeft=keep[b.dataset.sk]; else PA.placeScroll(b); });
  lastSigs.set(el,sig);
  if(!inEl||(document.activeElement!==document.body&&document.contains(ae))) return;
  const focus=n=>{if(n){n.focus({preventScroll:true});return true;}return false;};
  if(km!=null){ // けんばんの 鍵（キーボードで ひいた）
    const ks=el.querySelectorAll(`[data-m="${km}"]`), k=ks[kIdx]||ks[0];
    if(k){rove(k);k.focus({preventScroll:true});}
    return;
  }
  if(!wasBtn) return;
  if(fp&&focus(el.querySelector(`[data-pa="${CSS.escape(fp)}"]`))) return;
  if(!fa) return;
  const ok=':not([disabled])';
  const tryq=a=>{for(const r of [el,document]){const n=r.querySelector(`[data-act="${a}"][data-v="${CSS.escape(fv??'')}"]${ok}`)||r.querySelector(`[data-act="${a}"]${ok}`);if(n) return n;}return null;};
  if(focus(tryq(fa))) return;
  for(const a of FOCUS_NEXT[fa]||[]) if(focus(tryq(a))) return;
  focus(document.querySelector(`#actions .btn.primary${ok}`)||document.querySelector(`#actions button${ok}`));
};
// はじめて出す横スクロールの位置：鍵盤は focus の鍵（なければ 色つきの鍵、なければ まんなかのド）を まん中に。data-start="end" は右はし
// アニメの とちゅうなどで、色のついた鍵が 見えない ところに あるときだけ まん中へ（見えていれば 動かさない）
PA.follow=el=>{
  (el||document).querySelectorAll('[data-sk]').forEach(b=>{
    if(b.scrollWidth<=b.clientWidth+1) return;
    let t=[...b.querySelectorAll('[data-focus]')]; if(!t.length) t=[...b.querySelectorAll('[data-mk]')];
    if(!t.length) return;
    const br=b.getBoundingClientRect(), L=Math.min(...t.map(r=>r.getBoundingClientRect().left)), R=Math.max(...t.map(r=>r.getBoundingClientRect().right));
    if(L>=br.left-1&&R<=br.right+1) return;
    PA.placeScroll(b);
  });
};
PA.placeScroll=b=>{
  if(b.scrollWidth<=b.clientWidth+1) return;
  if(b.dataset.start==='end'){b.scrollLeft=b.scrollWidth;return;}
  if(b.dataset.start&&b.dataset.start.endsWith('%')){b.scrollLeft=b.scrollWidth*parseFloat(b.dataset.start)/100;return;}
  let t=[...b.querySelectorAll('[data-focus]')];
  if(!t.length) t=[...b.querySelectorAll('[data-mk]')];
  if(!t.length) t=[b.querySelector('[data-m="60"]')].filter(Boolean);
  if(!t.length) return;
  const br=b.getBoundingClientRect();
  const L=Math.min(...t.map(r=>r.getBoundingClientRect().left)), R=Math.max(...t.map(r=>r.getBoundingClientRect().right));
  b.scrollLeft+=(L+R)/2-(br.left+br.right)/2;
};
// 鍵盤の入力：マウスは押した瞬間。タッチは 指ごとに おぼえ、横スクロールなら 鳴らさない
const downs=new Map();
// ⏹：押した瞬間に 音を止める。click が 来ないまま（指が ずれた・スクロールした）おわったら PA.onStopCancel で 画面を もどしてもらう
let stopPend=false;
const stopCancel=()=>{if(!stopPend)return;stopPend=false;if(PA.onStopCancel)PA.onStopCancel();};
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-act="stop"]')) stopPend=false;},true);
document.addEventListener('pointerdown',e=>{
  if(e.target.closest('[data-act="stop"]')){stopPend=true;if(PA.onStopDown)PA.onStopDown();else PA.stopSound();return;}
  const k=e.target.closest('[data-m]'); if(!k) return;
  const m=+k.dataset.m;
  if(e.pointerType==='mouse'){if(e.button!==0)return;PA.audio();PA.playNote(m,0,1.4,0.24);if(PA.onKey)PA.onKey(m);return;}
  const box=k.closest('.scroll'), scrollable=!!box&&box.scrollWidth>box.clientWidth+1;
  const d={m,x:e.clientX,y:e.clientY,played:false};
  if(PA.audioRunning()&&!scrollable){PA.playNote(m,0,1.4,0.24);d.played=true;}
  downs.set(e.pointerId,d);
});
document.addEventListener('pointerup',e=>{
  if(stopPend&&!(e.target.closest&&e.target.closest('[data-act="stop"]'))) stopCancel();
  const d=downs.get(e.pointerId); if(!d) return;
  downs.delete(e.pointerId);
  if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>=10) return;
  if(!d.played){PA.audio();PA.playNote(d.m,0,1.4,0.24);}
  if(PA.onKey) PA.onKey(d.m);
});
document.addEventListener('pointercancel',e=>{downs.delete(e.pointerId);stopCancel();});
// キーボード・読み上げソフトで ひく：Enter／スペース（読み上げソフトの「タップ」は detail=0 の click）、←→ Home End で となりの鍵へ
const hitKey=k=>{const m=+k.dataset.m;PA.audio();PA.playNote(m,0,1.4,0.24);if(PA.onKey)PA.onKey(m);};
document.addEventListener('keydown',e=>{
  const k=e.target&&e.target.closest&&e.target.closest('.kb [data-m]'); if(!k||e.ctrlKey||e.metaKey||e.altKey||e.isComposing) return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat) hitKey(k);return;}
  const dir={ArrowLeft:-1,ArrowRight:1,Home:-1e3,End:1e3}[e.key]; if(!dir) return;
  e.preventDefault();e.stopImmediatePropagation();
  const ks=[...k.closest('svg').querySelectorAll('[data-m]')].sort((a,b)=>a.dataset.m-b.dataset.m);
  const n=ks[Math.max(0,Math.min(ks.length-1,ks.indexOf(k)+dir))];
  rove(n); n.focus();
});
document.addEventListener('click',e=>{if(e.detail===0){const k=e.target.closest&&e.target.closest('.kb [data-m]');if(k) hitKey(k);}});
/* ===== ドッペルドミナントと 増六の和音（芸大和声の 考え方） =====
 * 長調・短調どちらでも、key（PA.majorKey / PA.minorKey）を わたすと、正しい つづりと 高さの 音を かえす。
 * 音：{letter, acc, midi, role(日本語の役わり), tag('lt'＝Ⅴへの導音、'low'＝下げた音、'b9'＝短9度、'raised'＝上げた音)}
 *   Ⅱ7                 … 調の音だけで つくる Ⅱ の七の和音（下属の なかま）
 *   ドッペルドミナント   … Ⅱ7 の 第3音を 半音上げた「Ⅴ の ための Ⅴ7」。第3音が Ⅴ の 導音になる
 *   Ⅴ9/Ⅴ・減七/Ⅴ        … Ⅴの家族と おなじ しくみ（短9度・根音省略）
 *   増六（イタリア・フランス・ドイツ）… ドッペルドミナントの 第5音を 半音下げ、その音を いちばん下に おいた形
 *     イタリア＝Ⅴ7/Ⅴ の 根音省略、フランス＝Ⅴ7/Ⅴ（根音あり）、ドイツ＝Ⅴ9/Ⅴ（短9）の 根音省略
 *     下げた音（♭6）と 上げた音（♯4）が「増6度」。外へ ひらいて Ⅴ の オクターブに 解決する
 */
(function(){
  const C=PA.chroma={};
  // 主音から letterOff 文字・semis 半音 上の 音（base＝主音の 高さ）
  const tone=(key,letterOff,semis,base,role,tag)=>{
    const L=(key.l+letterOff)%7, pc=key.tpc+semis;
    return {letter:L,acc:PA.spell(L,pc),midi:base+semis,role,tag:tag||null};
  };
  // ベース（Ⅱ・Ⅴ/Ⅴ の 根音）を ラ2〜ソ♯3 に おく
  const rootBase=key=>{const r=PA.mod(key.tpc+2,12);return 45+PA.mod(r-45,12)-2;}; // 主音の 高さ（根音＝主音＋2 が 45〜56）
  C.TYPES={ii7:'Ⅱ7',dd:'ドッペルドミナント',dd9:'Ⅴ9/Ⅴ',ddim:'減七/Ⅴ',it:'イタリアの6',fr:'フランスの6',ger:'ドイツの6'};
  // ----- Ⅱ7 と ドッペルドミナント（根音を ベースに、上に 5音・7音・3音 の 形） -----
  C.ii7=key=>{
    const b=rootBase(key), fifth=key.minor?8:9;
    return [tone(key,1,2,b,'根音'),tone(key,5,fifth,b,'第5音'),tone(key,7,12,b,'第7音'),tone(key,3,17,b,'第3音')];
  };
  C.dd=key=>{
    const b=rootBase(key);
    return [tone(key,1,2,b,'根音'),tone(key,5,9,b,'第5音',key.minor?'raised':null),tone(key,7,12,b,'第7音'),tone(key,3,18,b,'第3音（Ⅴへの導音）','lt')];
  };
  // Ⅱ7・ドッペル → Ⅴ（ベースは 5度下へ、第3音は Ⅴ の 根音へ、第7音は 半音・全音 下へ）
  C.toV=key=>{
    const b=rootBase(key);
    return [tone(key,4,-5,b,'Ⅴの根音'),tone(key,4,7,b,'Ⅴの根音'),tone(key,6,11,b,'Ⅴの第3音（導音）',key.minor?'raised':null),tone(key,4,19,b,'Ⅴの根音')];
  };
  // ----- ドッペルドミナントの 家族（根音位置・よこに つみかさねた形。主音の 高さは key.tonicMidi） -----
  C.ddStack=(key,kind='dd',major9=false)=>{
    const b=key.tonicMidi-12;
    const r=tone(key,1,2,b,'根音'), t3=tone(key,3,6,b,'第3音（Ⅴへの導音）','lt'), t5=tone(key,5,9,b,'第5音',key.minor?'raised':null), t7=tone(key,7,12,b,'第7音');
    const t9=major9&&!key.minor?tone(key,9,16,b,'第9音'):tone(key,9,15,b,'第9音（短9度）','b9');
    if(kind==='dd') return [r,t3,t5,t7];
    if(kind==='dd9') return [r,t3,t5,t7,t9];
    if(kind==='ddim') return [t3,t5,t7,t9];
    return [];
  };
  // ----- 増六の和音（いちばん下＝下げた第5音 ♭6、いちばん上＝第3音 ♯4） -----
  const augBase=key=>{const p=PA.mod(key.tpc+8,12);return 52+PA.mod(p-52,12)-8;}; // ♭6 が 52〜63 に くるように
  C.aug6=(key,type)=>{
    const b=augBase(key);
    const low=tone(key,5,8,b,'下げた第5音（いちばん下）','low'), c=tone(key,7,12,b,'第7音'), up=tone(key,3,18,b,'第3音（Ⅴへの導音）','lt');
    if(type==='it') return [low,c,up];
    if(type==='fr') return [low,c,tone(key,1,14,b,'根音'),up];
    if(type==='ger') return [low,c,tone(key,9,15,b,'第9音（短9度）','b9'),up];
    return [];
  };
  // 増六 → Ⅴ（下の音は 半音下、上の音は 半音上：外へ ひらいて オクターブ）。aug6 と おなじ ならびで かえす
  C.aug6ToV=(key,type)=>{
    const b=augBase(key);
    const V1=tone(key,4,7,b,'Ⅴの根音'), V3=tone(key,6,11,b,'Ⅴの第3音',key.minor?'raised':null), V5=tone(key,1,14,b,'Ⅴの第5音'), V8=tone(key,4,19,b,'Ⅴの根音');
    if(type==='it') return [V1,V3,V8];
    return [V1,V3,V5,V8];
  };
  // ドイツの6 → Ⅰの第2転回形（Ⅰ6/4）→ Ⅴ（Ⅴへ 直接 すすむと 平行5度に なるため）
  C.gerToI64=key=>{
    const b=augBase(key), third=key.minor?15:16;
    return [tone(key,4,7,b,'Ⅰの第5音（いちばん下）'),tone(key,0,12,b,'Ⅰの根音'),tone(key,2,third,b,'Ⅰの第3音'),tone(key,4,19,b,'Ⅰの第5音')];
  };
  // 長調の ドイツの6 は、Ⅰ6/4 へ すすむとき 第9音を 二重増4度（♯2）で 書くことも ある
  C.gerMajorAlt=key=>{
    if(key.minor) return null;
    const b=augBase(key), n=C.aug6(key,'ger');
    n[2]=tone(key,1,15,b,'二重増4度で 書いた音','b9');
    return n;
  };
  // コードネーム（めやす）
  const nameOf=n=>PA.LET_EN[n.letter]+PA.ACC[n.acc];
  C.symbol=(key,type)=>{
    const r=tone(key,1,2,0), t3=tone(key,3,6,0);
    if(type==='ii7') return PA.H(nameOf(r)+(key.minor?'m7(♭5)':'m7'));
    if(type==='dd') return PA.H(nameOf(r)+'7');
    if(type==='dd9') return PA.H(nameOf(r)+'7(♭9)');
    if(type==='ddim') return PA.H(nameOf(t3)+'dim7');
    return '';
  };
})();
/* ===== 変化和音（芸大和声の 考え方）：ナポリの六・準固有和音・副属和音・減七と半減七・異名同音の読み替え =====
 * key（PA.majorKey / PA.minorKey）を わたすと、正しい つづりと 高さの 音を かえす。
 * 音：{letter, acc, midi, role(日本語の役わり), tag}
 *   tag：'lt'＝導音（上へ すすむ）、'seventh'＝第7音（下へ すすむ）、'b9'／'ninth'＝短9度／長9度（下へ）、
 *        'low'＝下げた音、'borrowed'＝同主短調から かりた音、'raised'＝短調で 上げた 第6音・第7音、'chrom'＝そのほかの 調にない音
 *   減七・半減七（Ⅶ7）は 芸大和声どおり Ⅴ9 の 根音省略 として 名前と tag を つける（導音＝第3音、4＝第7音 'seventh'、6＝第9音 'b9'／'ninth'、2＝第5音）。
 *   vii7・rootless9・borrowed('vii_dim7')・viiCompare・secondary(…,'vii7'|'vii7h')・dimReadings の どれでも、おなじ 音には おなじ tag。
 * 和音記号：芸大（島岡）の 書きかた。○＝準固有（同主短調から かりた）。転回形は 6・6/4（Ⅱ6、Ⅰ6/4）。
 *   短調の 目標 Ⅲ・Ⅶ（自然的短音階の 長三和音）は「Ⅲ（自然）」「Ⅶ（自然）」と 書いて、和声的短音階の Ⅲ（増）・Ⅶ（減）と 区別する。
 *   コードネーム（dim7・m7(♭5) など）は H.symbol だけで つかう。
 * ならび：[ベース, 上の声（低い→高い）]。解決（すすみ先）は おなじ ならびで、それぞれの 声が どこへ 行くかを かえす。
 * 高さ：ベース 40〜55、上の声 55〜79（平均律・表示の 音＝鳴らす 音）。すべての 和音が この中（解決先は 2 まで はみだす ことが ある）。
 * 声の すすみ：連続5度・連続8度、バスを ふくむ 減5度→完全5度、声の 交差、調の 導音の 重複 は つくらない（test/henka.test.mjs で たしかめる）。
 * 重変（𝄫）は 正しい つづりで どうしても 出る ところだけ（♭の多い 調のナポリ・準固有・副属の減七・Ⅴ7/♭Ⅱ）。PA.H／PA.Svg で ♭♭ と 表示する。
 * 重嬰（x）は ♯の多い 調の 副属和音と 短調の 導音で 出る（PA.H／PA.Svg で 太い x）。
 */
(function(){
  const H=PA.henka={}, mod=PA.mod;
  const ROMAN=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ'];
  H.ROMAN=ROMAN;
  // 調の音階（長調＝長音階、短調＝自然的短音階）で 主音から d 番め（0＝主音、負・7以上も可）の 半音の数
  const semi=(key,d)=>(key.minor?PA.NMIN:PA.MAJ)[mod(d,7)]+12*Math.floor(d/7);
  // 主音から lo 文字・so 半音 上の 音の つづり
  const sp=(key,lo,so)=>{const L=mod(key.l+lo,7);return {letter:L,acc:PA.spell(L,key.tpc+so)};};
  const pcOf=n=>mod(PA.NAT[n.letter]+n.acc,12);
  H.pcOf=pcOf;
  // 五線の 位置（PA.stepOf と おなじ 数えかた：ド4＝28）で つみかさねる。♭がついても ♮でも おなじ 位置に なるように
  const stepAtOrAbove=(n,s0)=>s0+mod(n.letter-s0,7);
  const midiOfStep=(n,st)=>12*(Math.floor(st/7)+1)+PA.NAT[n.letter]+n.acc;
  // from の 高さから、つづり n の 音へ：up＝上へ、down＝下へ、leap＝上下 近いほうではなく 中心（center）に 近いほう、near＝いちばん近い
  const move=(n,from,mv,center)=>{
    const p=pcOf(n), up=from+mod(p-from-1,12)+1, down=from-(mod(from-p-1,12)+1);
    if(mv==='up') return up;
    if(mv==='down') return down;
    if(mv==='leap') return Math.abs(up-center)<Math.abs(down-center)?up:down;
    return from+mod(p-from+6,12)-6;
  };
  const B_LO=40,B_HI=55,U_LO=55,U_HI=79,B_C=47,U_C=67;
  const mk=(key,v,midi)=>({...sp(key,v.lo,v.so),midi,role:v.role,tag:v.tag||null});
  /* 和音の 列（chain）を つくる。chain[0]＝はじめの和音（v＝{lo,so,role,tag}）、chain[1..]＝つぎの和音（v に mv＝動きかた）
   * はじめの和音：ベースは ファ2 以上、上の声は ラ3 以上から、五線の 位置で 下から じゅんに つみかさねる（♭6 と ♮6 が おなじ 高さに くる）。
   * そのあと chains ぜんぶを おなじ だけ オクターブで うごかして 音域に おさめる（おなじ 和音は どの 関数から 出しても おなじ 高さ） */
  const chainOf=(key,chain)=>{
    const out=[];
    chain.forEach((ch,ci)=>{
      const prev=out[ci-1], notes=[];
      let st=0;
      ch.forEach((v,i)=>{
        const s=sp(key,v.lo,v.so);
        let m;
        if(!prev){st=i===0?17:i===1?26:st+1;st=stepAtOrAbove(s,st);m=midiOfStep(s,st);}
        else m=move(s,prev[i].midi,v.mv||'near',i===0?B_C:U_C);
        notes.push(mk(key,v,m));
      });
      out.push(notes);
    });
    return out;
  };
  const fam=(key,chains)=>{
    const outs=chains.map(c=>chainOf(key,c)), all=outs.flat();
    let best=null;
    for(const sb of [0,-12,12]) for(const su of [0,-12,12]){
      let pen=0,bs=0,us=0,nb=0,nu=0;
      all.forEach(ch=>{
        ch.forEach((n,i)=>{
          const m=n.midi+(i?su:sb), lo=i?U_LO:B_LO, hi=i?U_HI:B_HI;
          pen+=Math.max(0,lo-m,m-hi)*10;
          if(i){us+=m;nu++;}else{bs+=m;nb++;}
        });
        if(ch[0].midi+sb>=Math.min(...ch.slice(1).map(n=>n.midi+su))) pen+=1000;
      });
      pen+=Math.abs(bs/nb-B_C)+Math.abs(us/nu-U_C);
      if(!best||pen<best.pen) best={pen,sb,su};
    }
    return outs.map(o=>o.map(ch=>ch.map((n,i)=>({...n,midi:n.midi+(i?best.su:best.sb)}))));
  };
  const prog=(key,chain)=>fam(key,[chain])[0];
  // 調の 音か（短調は 自然的短音階。和声的・旋律的に 上げた 第7音・第6音は 'raised'）
  const inScale=(key,n)=>(key.minor?key.nat:key.scale).some(s=>s.letter===n.letter&&s.acc===n.acc);
  const isRaised=(key,n)=>key.minor&&[[6,11],[5,9]].some(([lo,so])=>{const s=sp(key,lo,so);return s.letter===n.letter&&s.acc===n.acc;});
  const tagChrom=(key,ns)=>ns.map(n=>n.tag||inScale(key,n)?n:{...n,tag:isRaised(key,n)?'raised':'chrom'});
  const V=(lo,so,role,tag,mv)=>({lo,so,role,tag,mv});

  /* ----- 1) ナポリの六（♭Ⅱ の 第1転回形）：♭2・4・♭6。ベース＝第3音（調の 第4音）を 重ねる。根音（♭2）は ソプラノ ----- */
  const N6=key=>[
    V(3,5,'第3音（いちばん下）'),
    V(3,5,'第3音'),
    V(5,8,'第5音',key.minor?null:'borrowed'),
    V(1,1,'根音（下げた 第2音）','low')
  ];
  const N6TOV=()=>[
    V(4,7,'Ⅴの根音',null,'up'),
    V(1,2,'Ⅴの第5音',null,'down'),
    V(4,7,'Ⅴの根音',null,'down'),
    V(6,11,'Ⅴの第3音（導音）','lt','down')
  ];
  const N6I64=key=>[
    V(4,7,'Ⅰの第5音（いちばん下）',null,'up'),
    V(2,semi(key,2),'Ⅰの第3音',null,'down'),
    V(4,7,'Ⅰの第5音',null,'down'),
    V(0,0,'Ⅰの根音',null,'down')
  ];
  const I64V=()=>[
    V(4,7,'Ⅴの根音',null,'near'),
    V(1,2,'Ⅴの第5音',null,'down'),
    V(4,7,'Ⅴの根音',null,'near'),
    V(6,11,'Ⅴの第3音（導音）','lt','down')
  ];
  const n6fam=key=>fam(key,[[N6(key),N6TOV()],[N6(key),N6I64(key),I64V()]]);
  H.neapolitan=key=>n6fam(key)[0][0];
  // N6 → Ⅴ：根音（♭2）は 導音へ 減3度 下へ、第5音（♭6）は Ⅴ の 根音へ、ベースは Ⅴ へ 上へ。上の 第3音は Ⅴ の 第5音へ（平行8度を さける）
  H.toV=key=>n6fam(key)[0][1];
  // N6 → Ⅰ6/4 → Ⅴ（[Ⅰ6/4, Ⅴ] を かえす）
  H.viaI64=key=>{const r=n6fam(key)[1];return [r[1],r[2]];};

  /* ----- 2) 準固有和音（長調で、同主短調から かりる和音。かりた音に tag 'borrowed'） ----- */
  H.BORROWED_IDS=['iv','ii_dim','ii_hdim7','bVI','V9_b9','vii_dim7'];
  // label：芸大の 和音記号（○＝準固有）。ii_dim は 第1転回形（ベース＝第3音）で 鳴らすので Ⅱ6
  H.JUN='○';
  H.BORROWED={
    iv:{label:'○Ⅳ',diatonic:'Ⅳ',next:'Ⅰ'},
    ii_dim:{label:'○Ⅱ6',diatonic:'Ⅱ6',next:'Ⅴ',inv:1},
    ii_hdim7:{label:'○Ⅱ7',diatonic:'Ⅱ7',next:'Ⅴ7'},
    bVI:{label:'○Ⅵ',diatonic:'Ⅵ',next:'Ⅴ'},
    V9_b9:{label:'○Ⅴ9',diatonic:'Ⅴ9',next:'Ⅰ'},
    vii_dim7:{label:'○Ⅶ7',diatonic:'Ⅶ7',next:'Ⅰ'}
  };
  // b＝true で かりた形、false で 長調の ふつうの形（6・3 の ほかは おなじ ならび・おなじ 高さ）
  const BSPEC={
    iv:b=>[V(3,5,'根音'),V(0,0,'第5音'),V(3,5,'根音'),b?V(5,8,'第3音（下げた 第6音）','borrowed'):V(5,9,'第3音')],
    ii_dim:b=>[V(3,5,'第3音（いちばん下）'),V(1,2,'根音'),V(3,5,'第3音'),b?V(5,8,'第5音（下げた 第6音）','borrowed'):V(5,9,'第5音')],
    ii_hdim7:b=>[V(1,2,'根音'),b?V(5,8,'第5音（下げた 第6音）','borrowed'):V(5,9,'第5音'),V(7,12,'第7音','seventh'),V(3,5,'第3音')],
    bVI:b=>b?[V(5,8,'根音（下げた 第6音）','borrowed'),V(0,0,'第3音'),V(2,3,'第5音（下げた 第3音）','borrowed'),V(0,0,'第3音')]
            :[V(5,9,'根音'),V(0,0,'第3音'),V(2,4,'第5音'),V(0,0,'第3音')],
    V9_b9:b=>[V(4,7,'根音'),V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),b?V(5,8,'第9音（下げた 第6音）','borrowed'):V(5,9,'第9音','ninth')],
    // Ⅶ7＝Ⅴ9 の 根音省略（名前・tag は Ⅴ9 から 見た もの。H.vii7 と おなじ）
    vii_dim7:b=>[V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),b?V(5,8,'第9音（下げた 第6音）','borrowed'):V(5,9,'第9音（長9度）','ninth'),V(1,2,'第5音')]
  };
  const NEXT={
    iv:()=>[V(0,0,'Ⅰの根音',null,'leap'),V(0,0,'Ⅰの根音',null,'near'),V(2,4,'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down')],
    ii_dim:()=>[V(4,7,'Ⅴの根音',null,'up'),V(6,11,'Ⅴの第3音（導音）','lt','down'),V(1,2,'Ⅴの第5音',null,'down'),V(4,7,'Ⅴの根音',null,'down')],
    ii_hdim7:()=>[V(4,7,'Ⅴの根音',null,'leap'),V(4,7,'Ⅴの根音',null,'down'),V(6,11,'Ⅴの第3音（導音）','lt','down'),V(3,5,'Ⅴの第7音','seventh','near')],
    bVI:()=>[V(4,7,'Ⅴの根音',null,'down'),V(6,11,'Ⅴの第3音（導音）','lt','down'),V(4,7,'Ⅴの根音',null,'up'),V(1,2,'Ⅴの第5音',null,'up')],
    V9_b9:()=>[V(0,0,'Ⅰの根音',null,'leap'),V(0,0,'Ⅰの根音',null,'up'),V(2,4,'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down')],
    vii_dim7:()=>[V(0,0,'Ⅰの根音',null,'up'),V(2,4,'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down'),V(0,0,'Ⅰの根音',null,'down')]
  };
  const bfam=(key,id)=>key.minor||!BSPEC[id]?null:fam(key,[[BSPEC[id](true),NEXT[id]()],[BSPEC[id](false),NEXT[id]()]]);
  H.borrowed=(key,id)=>{const f=bfam(key,id);return f&&f[0][0];};
  H.diatonic=(key,id)=>{const f=bfam(key,id);return f&&f[1][0];};
  // つぎの和音（かりた形・ふつうの形の どちらから すすんでも おなじ 音。b＝false は ふつうの形から すすんだ ばあい）
  H.nextOf=(key,id,b=true)=>{const f=bfam(key,id);return f&&f[b?0:1][1];};

  /* ----- 3) 副属和音（Ⅴ7/x と Ⅶ7/x） -----
   * target：目標の 和音の 度数（2〜7）。長調 Ⅱ Ⅲ Ⅳ Ⅴ Ⅵ、短調 Ⅲ Ⅳ Ⅴ Ⅵ Ⅶ（Ⅶ＝自然的短音階の 長三和音）
   * kind：'V7'＝目標の Ⅴ7（4つの音が そろった形 [根音 | 5, 7, 3]。PA.chroma.dd と おなじ ならび → 第5音を はぶいた 目標の和音）、'vii7'＝目標の 導音の 七の和音＝Ⅴ9 の 根音省略で 短9度の 減七（目標が 長・短 どちらでも。
   *        PA.chroma の 減七/Ⅴ と おなじ きまり）、'vii7h'＝長9度の 根音省略＝半減七（目標が 長三和音で、長9度が 調の 音の ときだけ。
   *        短調の Ⅶ7/Ⅴ は 短9度だけ：PA.chroma.ddStack(key,'dd9',true) と おなじ きまりで null）
   * Ⅶ7/x → x：ならび [導音 | 7, 9, 5] → [根音 | 3, 5, 根音]（根音を 重ねる）。9 は 5 の 完全4度 下に あるので、
   *   5 → 根音 と 9 → 5 は 平行4度（よい）。連続5度に なるのは 9 が 5 より 上に あるとき だけ。
   *   目標の 第3音へ 上げると、目標が Ⅴ のとき 調の 導音が 2つに なるので しない */
  H.targets=key=>key.minor?[3,4,5,6,7]:[2,3,4,5,6];
  const tgt=(key,t)=>{
    if(!H.targets(key).includes(t)) return null;
    const TL=t-1, rs=semi(key,TL);
    let q3=mod(semi(key,TL+2)-rs,12);
    const q5=mod(semi(key,TL+4)-rs,12);
    if(key.minor&&t===5) q3=4; // 短調の Ⅴ は 和声的短音階（導音）で 長三和音
    const T={TL,rs,q3,q5,minor:q3===3,t};
    // 長9度（目標の 第6音＝rs+9）・短9度（rs+8）が 調の 音か（長調＝長音階、短調＝自然的短音階）
    T.maj9InKey=mod(semi(key,TL+5)-rs,12)===9;
    T.min9InKey=mod(semi(key,TL+5)-rs,12)===8;
    // 短調の Ⅲ・Ⅶ は 自然的短音階の 長三和音（和声的短音階の Ⅲ＝増三和音、Ⅶ＝減三和音 とは ちがう）
    T.natural=key.minor&&(t===3||t===7);
    return T;
  };
  const tSpec=(T,mv)=>[V(T.TL,T.rs,'目標の根音',null,mv[0]),V(T.TL,T.rs,'目標の根音',null,mv[1]),V(T.TL+2,T.rs+T.q3,'目標の第3音',null,mv[2]),V(T.TL+4,T.rs+T.q5,'目標の第5音',null,mv[3])];
  const secSpec=(T,kind)=>{
    const {TL,rs}=T;
    if(kind==='V7') return {
      ch:[V(TL+4,rs+7,'根音'),V(TL+1,rs+2,'第5音'),V(TL+3,rs+5,'第7音','seventh'),V(TL+6,rs+11,'第3音（導音）','lt')],
      res:[V(TL,rs,'目標の根音',null,'leap'),V(TL,rs,'目標の根音',null,'down'),V(TL+2,rs+T.q3,'目標の第3音',null,'down'),V(TL,rs,'目標の根音',null,'up')]
    };
    if(kind==='vii7'||(kind==='vii7h'&&!T.minor&&T.maj9InKey)){
      const n9=kind==='vii7'?V(TL+5,rs+8,'第9音（短9度）','b9'):V(TL+5,rs+9,'第9音（長9度）','ninth');
      return {
        ch:[V(TL+6,rs+11,'第3音（導音）','lt'),V(TL+3,rs+5,'第7音','seventh'),n9,V(TL+1,rs+2,'第5音')],
        res:[V(TL,rs,'目標の根音',null,'up'),V(TL+2,rs+T.q3,'目標の第3音',null,'down'),V(TL+4,rs+T.q5,'目標の第5音',null,'down'),V(TL,rs,'目標の根音',null,'down')]
      };
    }
    return null;
  };
  H.secondary=(key,target,kind='V7')=>{
    const T=tgt(key,target), s=T&&secSpec(T,kind); if(!s) return null;
    return tagChrom(key,prog(key,[s.ch,s.res])[0]);
  };
  H.resolveSecondary=(key,target,kind='V7')=>{
    const T=tgt(key,target), s=T&&secSpec(T,kind); if(!s) return null;
    return prog(key,[s.ch,s.res])[1];
  };
  // 目標の 三和音だけ（根音位置・根音を 重ねる）
  H.targetTriad=(key,target)=>{
    const T=tgt(key,target); if(!T) return null;
    return prog(key,[tSpec(T,[])])[0];
  };
  H.targetIsMinor=(key,target)=>{const T=tgt(key,target);return T?T.minor:null;};
  // 短調の Ⅲ・Ⅶ（自然的短音階の 長三和音）か
  H.targetIsNatural=(key,target)=>{const T=tgt(key,target);return T?T.natural:null;};

  /* ----- 4) 減七と 半減七（Ⅶ7）＝ Ⅴ9 の 根音省略 -----
   * 長調：半減七（7・2・4・6）、短調：減七（♯7・2・4・♭6）。ならび [導音 | 4, 6, 2]
   * 名前と tag は Ⅴ9 から 見た もの（導音＝第3音 'lt'、4＝第7音 'seventh'、6＝第9音 'ninth'／'b9'、2＝第5音）。
   *   H.vii7(key,'vii') だけ、名前を「Ⅶ7 から 見た 名前」（導音＝根音、2＝第3音、4＝第5音、6＝第7音）に する（tag は かわらない）。
   * Ⅰ へ：導音 → 主音（上へ）、4 → 3（下へ）、6 → 5（下へ）、2 → 主音（下へ）＝根音を 重ねた Ⅰ。
   *   この ならびでは 6 が 2 の 完全4度（短調は 増4度）下に あるので、6→5 と 2→1 は 平行4度（よい）。
   *   2 が 6 の 下に あって 5度に なる ならびなら、2→1 は 連続5度（長調）に なる */
  const VII_VIEW=['根音（導音）','第5音','第7音','第3音'];
  const viiSpec=(key,six,sixRole,sixTag)=>[
    V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),V(5,six,sixRole,sixTag),V(1,2,'第5音')
  ];
  const IRES=key=>[V(0,0,'Ⅰの根音',null,'up'),V(2,semi(key,2),'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down'),V(0,0,'Ⅰの根音',null,'down')];
  const sixOf=key=>semi(key,5); // 長調 ♮6、短調 ♭6
  // 調の Ⅶ7（＝根音省略の Ⅴ9）・半減七・減七を いっしょに つくって、おなじ 高さに そろえる
  const vfam=key=>fam(key,[
    [viiSpec(key,sixOf(key),key.minor?'第9音（短9度）':'第9音（長9度）',key.minor?'b9':'ninth'),IRES(key)],
    [viiSpec(key,9,key.minor?'第9音（上げた 第6音）':'第9音（長9度）',key.minor?'raised':'ninth'),IRES(key)],
    [viiSpec(key,8,key.minor?'第9音（短9度）':'第9音（下げた 第6音）',key.minor?'b9':'borrowed'),IRES(key)]
  ]);
  H.vii7=(key,view)=>{const v=vfam(key)[0][0];return view==='vii'?v.map((n,i)=>({...n,role:VII_VIEW[i]})):v;};
  H.vii7ToI=key=>vfam(key)[0][1];
  // 根音省略の Ⅴ9（H.vii7 と おなじ 音・おなじ 名前。名前を わけて 見せたいときは H.vii7(key,'vii')）
  H.rootless9=key=>vfam(key)[0][0];
  // Ⅴ9（根音あり・第5音を はぶく）：[5 | 7, 4, 9]（9 は 長調 ♮6、短調 ♭6）
  const v9Spec=key=>[V(4,7,'根音'),V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),V(5,sixOf(key),key.minor?'第9音（短9度）':'第9音（長9度）',key.minor?'b9':'ninth')];
  const v9fam=key=>prog(key,[v9Spec(key),[V(0,0,'Ⅰの根音',null,'leap'),V(0,0,'Ⅰの根音',null,'up'),V(2,semi(key,2),'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down')]]);
  H.v9=key=>v9fam(key)[0];
  H.v9ToI=key=>v9fam(key)[1];
  // 半減七と 減七の くらべ：ちがうのは 第9音（♮6 と ♭6）だけ。diff＝その 音の ならびの 番号
  // halfInKey／dimInKey＝その 調の 和音か。短調の half（♮6＝旋律的短音階の 上げた 第6音）は 音の くらべ だけで、
  //   短調の 和音（和音記号）としては つかわない。長調の dim は 準固有（○Ⅶ7）
  H.viiCompare=key=>{const f=vfam(key);return {half:f[1][0],dim:f[2][0],diff:2,toI:f[0][1],halfInKey:!key.minor,dimInKey:key.minor};};

  /* ----- 5) 異名同音の 読み替え ----- */
  const dblCount=ns=>ns.filter(n=>Math.abs(n.acc)>1).length;
  // 短調（PA.minorKey と おなじ 形）を 主音の 文字と 変化記号から つくる。PA.MINOR_KEYS に ない つづり（変イ短調・変ニ短調・
  // 変ト短調・嬰イ短調）も つくれる。そのときは enh:true、idx＝おなじ 主音の 高さの PA.MINOR_KEYS の 番号
  const minorOf=(l,a)=>{
    const i=PA.MINOR_KEYS.findIndex(([L,A])=>L===l&&A===a);
    if(i>=0) return PA.minorKey(i);
    const tpc=mod(PA.NAT[l]+a,12), idx=PA.MINOR_KEYS.findIndex(([L,A])=>mod(PA.NAT[L]+A,12)===tpc), tonicMidi=57+mod(tpc-57,12);
    const nat=PA.buildScale(l,tpc,tonicMidi,PA.NMIN), harm=PA.buildScale(l,tpc,tonicMidi,PA.HMIN);
    harm[6].raised=true;
    const sig={}; nat.forEach(n=>sig[n.letter]=n.acc);
    const rl=(l+2)%7, rpc=mod(tpc+3,12);
    const rel={l:rl,a:PA.spell(rl,rpc),minor:false,tpc:rpc,tonicMidi:60+rpc}; rel.scale=PA.buildScale(rl,rpc,60+rpc,PA.MAJ);
    const par={l,a,minor:false,tpc,tonicMidi,scale:PA.buildScale(l,tpc,tonicMidi,PA.MAJ)};
    return {idx,l,a,tpc,tonicMidi,minor:true,nat,harm,scale:harm,sig,rel,par,lt:harm[6],natLT:nat[6],ltType:harm[6].acc,enh:true};
  };
  H.minorOf=minorOf;
  /* 減七の 4つの 読みかた：おなじ けんばん（おなじ 高さ）を、4つの 短調の Ⅶ7（Ⅴ9 の 根音省略）として 書く
   * input：ピッチクラス 4つの 配列／減七の 音（{letter,acc,midi}）の 配列／key（長調なら 同主短調の 減七＝準固有の ○Ⅶ7、短調なら その 調の Ⅶ7）
   * かえす：[{keyIdx, key, lt, spelling, resolution, given, resInv, ninthInBass, next}]
   *   given（わたした つづり・調）の 読みが さいしょ、あとは 主音が 短3度ずつ 上へ。
   *   given の 読みは わたした つづりの まま（必要なら PA.MINOR_KEYS に ない 調：key.enh＝true、keyIdx＝おなじ 高さの 調の 番号）。
   *   そのほかの 読みは 重嬰・重変の すくない 調（嬰ニ短調より 変ホ短調。嬰ト短調は 変イ短調の かわりに そのまま）。
   * 名前・tag は Ⅴ9 の 根音省略として：導音＝第3音 'lt'、2＝第5音、4＝第7音 'seventh'、♭6＝第9音（短9度） 'b9'
   * resolution（Ⅰ）：導音→主音、4→♭3、♭6→5。2 は 上の声なら 主音へ（下へ）。ベースの 2 は ♭3 へ 上がる（Ⅰ6。
   *   主音へ 下りると ♭6→5 と バスを ふくむ 減5度→完全5度 に なる）。
   *   resInv：解決の Ⅰ の 形（0＝基本形、1＝Ⅰ6、2＝Ⅰ6/4）。
   *   ninthInBass：ベースが 第9音（♭6）＝Ⅴ9 の 第4転回形に あたる 形（芸大では ふつう つかわない）。解決は Ⅰ6/4 に なるので、
   *   next に そのあとの Ⅴ（おなじ ならび）を 入れる（それ以外は next＝null）。ふつうの Ⅶ7→Ⅰ として 見せない こと。
   *   密集（短3度で となりあう 声が ある）の ときは、その 2つの 声が 同度に なる ことが ある（ほかに よい すすみかたが ない） */
  const DIM_REL={11:[6,'第3音（導音）','lt'],2:[1,'第5音',null],5:[3,'第7音','seventh'],8:[5,'第9音（短9度）','b9']};
  H.dimReadings=input=>{
    let pcs, midis=null, givenKey=null, givenSp=null;
    if(input&&typeof input==='object'&&!Array.isArray(input)&&input.tpc!=null&&input.l!=null){
      givenKey=input; pcs=[11,2,5,8].map(x=>mod(input.tpc+x,12));
    }else if(Array.isArray(input)&&input.length===4&&input.every(n=>n&&typeof n==='object')){
      midis=input.map(n=>n.midi).sort((a,b)=>a-b); pcs=midis.map(m=>mod(m,12));
      givenSp=input;
    }else if(Array.isArray(input)&&input.length===4&&input.every(Number.isFinite)) pcs=input.map(x=>mod(x,12));
    else return null;
    const set=[...new Set(pcs)].sort((a,b)=>a-b);
    if(set.length!==4||set.some((p,i)=>i&&p-set[i-1]!==3)) return null;
    if(!midis){
      const a=58+mod(set.find(p=>p===10||p===11||p===0)-10,12);
      midis=[a-6,a,a+3,a+9];
    }
    const reading=key=>({keyIdx:key.idx,key,given:false,spelling:midis.map(m=>{
      const r=mod(m-key.tpc,12), [lo,role,tag]=DIM_REL[r];
      return {...sp(key,lo,r),midi:m,role,tag};
    })});
    const same=r=>givenSp.every(g=>r.spelling.some(n=>n.midi===g.midi&&n.letter===g.letter&&n.acc===g.acc));
    const out=set.map(p=>{
      const t=mod(p+1,12);
      // わたした 調・つづりの 読み
      if(givenKey&&givenKey.tpc===t){const r=reading(minorOf(givenKey.l,givenKey.a));r.given=true;return r;}
      if(givenSp){
        const g=givenSp.find(n=>pcOf(n)===p), L=(g.letter+1)%7, a=PA.spell(L,t);
        if(Math.abs(a)<=1){const r=reading(minorOf(L,a));if(same(r)){r.given=true;return r;}}
      }
      // そのほか：PA.MINOR_KEYS の 中で 重嬰・重変の すくない 調
      let best=null;
      PA.MINOR_KEYS.forEach(([L,A],i)=>{
        if(mod(PA.NAT[L]+A,12)!==t) return;
        const r=reading(PA.minorKey(i)), sc=dblCount(r.spelling);
        if(!best||sc<best.sc) best={r,sc};
      });
      return best.r;
    });
    out.forEach(r=>{
      const key=r.key, t=key.tpc, sv=r.spelling;
      const I=(lo,so,midi,role)=>({...sp(key,lo,so),midi,role,tag:null});
      const tgt=sv.map(n=>{
        const rel=mod(n.midi-t,12);
        if(rel===11) return [I(7,12,n.midi+1,'主音（根音）')];
        if(rel===5) return [I(2,3,n.midi-2,'第3音')];
        if(rel===8) return [I(4,7,n.midi-1,'第5音')];
        return [I(0,0,n.midi-2,'主音（根音）'),I(2,3,n.midi+1,'第3音')];
      });
      const res=tgt.map(c=>c[0]);
      tgt.forEach((c,i)=>{
        if(c.length<2) return;
        if(i===0){res[0]=c[1];return;} // ベースの 2 は ♭3 へ（Ⅰ6）
        // 上の声の 2 は 主音へ（下へ）。となりの 声と 交差する ときだけ ♭3 へ
        const lo=res[i-1].midi, hi=i<res.length-1?res[i+1].midi:Infinity;
        res[i]=c.find(x=>x.midi>lo&&x.midi<hi)||c.find(x=>x.midi>=lo&&x.midi<=hi)||c[0];
      });
      r.resolution=res;
      r.lt=sv.find(n=>n.tag==='lt');
      const bassRel=mod(sv[0].midi-t,12);
      r.resInv=bassRel===11?0:bassRel===8?2:1;
      r.ninthInBass=bassRel===8;
      r.next=r.ninthInBass?i64ToV(key,res):null;
    });
    const g=out.find(r=>r.given)||out.find(r=>r.lt.midi===midis[0]), t0=g.key.tpc;
    out.sort((a,b)=>mod(a.key.tpc-t0,12)-mod(b.key.tpc-t0,12));
    return out;
  };
  // Ⅰ6/4（ベース＝第5音）→ Ⅴ：ベースは そのまま、主音 → 導音（下へ）か 2（上へ）か 5（下へ）、♭3 → 2（下へ）、5 → そのまま。
  // 導音は 1つだけ、声の 交差・連続5度／8度なし、動きの 合計が いちばん 小さい ものを えらぶ（同度は 密集で さけられない ときだけ）
  const i64ToV=(key,ch)=>{
    const t=key.tpc;
    const O=(lo,so,midi,role,tag)=>({...sp(key,lo,so),midi,role,tag:tag||null});
    const opts=ch.map((n,i)=>{
      const rel=mod(n.midi-t,12);
      if(i===0||rel===7) return [O(4,7,n.midi,'Ⅴの根音')];
      if(rel===0) return [O(6,11,n.midi-1,'Ⅴの第3音（導音）','lt'),O(1,2,n.midi+2,'Ⅴの第5音'),O(4,7,n.midi-5,'Ⅴの根音')];
      return [O(1,2,n.midi-1,'Ⅴの第5音')];
    });
    let best=null, strict=true;
    const walk=(i,acc)=>{
      if(i===opts.length){
        if(acc.filter(n=>n.tag==='lt').length!==1) return;
        for(let j=1;j<acc.length;j++) if(strict?acc[j].midi<=acc[j-1].midi:acc[j].midi<acc[j-1].midi) return;
        for(let a=0;a<acc.length;a++) for(let b=a+1;b<acc.length;b++){
          const x=mod(ch[b].midi-ch[a].midi,12), y=mod(acc[b].midi-acc[a].midi,12);
          if(x===y&&(x===0||x===7)&&ch[a].midi!==acc[a].midi&&ch[b].midi!==acc[b].midi) return;
        }
        const cost=acc.reduce((s,n,j)=>s+Math.abs(n.midi-ch[j].midi),0);
        if(!best||cost<best.cost) best={cost,acc:[...acc]};
        return;
      }
      opts[i].forEach(o=>{acc.push(o);walk(i+1,acc);acc.pop();});
    };
    walk(0,[]);
    if(!best){strict=false;walk(0,[]);} // 密集で 同度が さけられない ときだけ
    return best?best.acc:null;
  };
  // ドイツの6 と、おなじ けんばんの Ⅴ7/♭Ⅱ（♯4 を ♭5 と 読みかえる）。PA.chroma の 増六（aug6・gerToI64・aug6ToV）の 音を つかう
  // かえす：{ger, gerRes:[Ⅰ6/4, Ⅴ], v7, v7Res(♭Ⅱ。第3音と第5音が どちらも 根音へ すすむので 2つの 声が おなじ 音), diff:3, bassShift}
  // ベースが 55 より 上に なる 調では、ベース（ならびの 0 番）だけを ger・gerRes・v7・v7Res ぜんぶ いっしょに 1オクターブ 下げる
  //   （bassShift＝-12。増6度は 複音程に なる。上の声は PA.chroma と おなじ 高さ。PA.chroma の 結果は かえない）
  H.ger6Vs7=key=>{
    const C=PA.chroma, raw=C.aug6(key,'ger'), sh=raw[0].midi>B_HI?-12:0;
    const low=ns=>ns.map((n,i)=>({...n,midi:n.midi+(i?0:sh)}));
    const ger=low(raw);
    const v7=[
      {...sp(key,5,8),midi:ger[0].midi,role:'根音',tag:null},
      {...sp(key,0,0),midi:ger[1].midi,role:'第3音（♭Ⅱへの導音）',tag:'lt'},
      {...sp(key,2,3),midi:ger[2].midi,role:'第5音',tag:null},
      {...sp(key,4,6),midi:ger[3].midi,role:'第7音','tag':'seventh'}
    ];
    const tn=(lo,so,from,mv,role)=>{const s=sp(key,lo,so);return {...s,midi:move(s,from,mv,B_C),role,tag:null};};
    const v7Res=[
      tn(1,1,v7[0].midi,'leap','♭Ⅱの根音'),
      tn(1,1,v7[1].midi,'up','♭Ⅱの根音'),
      tn(1,1,v7[2].midi,'down','♭Ⅱの根音'),
      tn(3,5,v7[3].midi,'down','♭Ⅱの第3音')
    ];
    return {ger,gerRes:[low(C.gerToI64(key)),low(C.aug6ToV(key,'ger'))],v7,v7Res,diff:3,bassShift:sh};
  };

  /* ----- コードネームと 和音記号（めやす） ----- */
  const nameOf=n=>PA.LET_EN[n.letter]+PA.ACC[n.acc];
  const cs=(root,suf,bass)=>PA.H(nameOf(root)+suf+(bass?'/'+nameOf(bass):''));
  H.chordName=cs;
  const d=(key,lo,so)=>sp(key,lo,so);
  const BSYM={
    iv:[k=>cs(d(k,3,5),'m'),k=>cs(d(k,3,5),'')],
    ii_dim:[k=>cs(d(k,1,2),'dim',d(k,3,5)),k=>cs(d(k,1,2),'m',d(k,3,5))],
    ii_hdim7:[k=>cs(d(k,1,2),'m7(♭5)'),k=>cs(d(k,1,2),'m7')],
    bVI:[k=>cs(d(k,5,8),''),k=>cs(d(k,5,9),'m')],
    V9_b9:[k=>cs(d(k,4,7),'7(♭9)'),k=>cs(d(k,4,7),'9')],
    vii_dim7:[k=>cs(d(k,6,11),'dim7'),k=>cs(d(k,6,11),'m7(♭5)')]
  };
  // what：'N6'｜'borrowed'(a＝id)｜'diatonic'(a＝id)｜'secondary'(a＝target, b＝kind)｜'target'(a＝target)｜'vii7'｜'v9'｜'v7bII'｜'bII'
  H.symbol=(key,what,a,b)=>{
    if(what==='N6') return cs(d(key,1,1),'',d(key,3,5));
    if(what==='bII') return cs(d(key,1,1),'');
    if(what==='borrowed'||what==='diatonic') return key.minor||!BSYM[a]?'':BSYM[a][what==='borrowed'?0:1](key);
    if(what==='target'){const T=tgt(key,a);return T?cs(d(key,T.TL,T.rs),T.minor?'m':''):'';}
    if(what==='secondary'){
      const T=tgt(key,a), k=b||'V7'; if(!T||!secSpec(T,k)) return '';
      if(k==='V7') return cs(d(key,T.TL+4,T.rs+7),'7');
      return cs(d(key,T.TL+6,T.rs+11),k==='vii7'?'dim7':'m7(♭5)');
    }
    if(what==='vii7') return cs(d(key,6,11),key.minor?'dim7':'m7(♭5)');
    if(what==='v9') return cs(d(key,4,7),key.minor?'7(♭9)':'9');
    if(what==='v7bII') return cs(d(key,5,8),'7');
    return '';
  };
  // 和音記号（ローマ数字。芸大の 書きかた：○＝準固有、和音の 種類（減・半減）は 書かない）
  //   target：短調の Ⅲ・Ⅶ は「Ⅲ（自然）」「Ⅶ（自然）」（自然的短音階の 長三和音）
  //   secondary：'V7'＝Ⅴ7/x、'vii7'＝Ⅶ7/x（目標が 長三和音で 短9度が 調にない 音なら 目標の 同主短調から かりた 形なので ○Ⅶ7/x）、'vii7h'＝Ⅶ7/x
  //   vii7：長調・短調とも その調の Ⅶ7（＝Ⅴ9 の 根音省略）。長調で かりた 減七は label(key,'borrowed','vii_dim7')＝○Ⅶ7
  const tName=(T,a)=>ROMAN[a-1]+(T.natural?'（自然）':'');
  H.label=(key,what,a,b)=>{
    if(what==='N6') return 'N6（♭Ⅱ6）';
    if(what==='borrowed') return !key.minor&&H.BORROWED[a]?H.BORROWED[a].label:'';
    if(what==='diatonic') return !key.minor&&H.BORROWED[a]?H.BORROWED[a].diatonic:'';
    if(what==='target'){const T=tgt(key,a);return T?tName(T,a):'';}
    if(what==='secondary'){
      const T=tgt(key,a), k=b||'V7'; if(!T||!secSpec(T,k)) return '';
      return (k==='V7'?'Ⅴ7':(k==='vii7'&&!T.minor&&!T.min9InKey?H.JUN:'')+'Ⅶ7')+'/'+tName(T,a);
    }
    if(what==='vii7') return 'Ⅶ7';
    if(what==='v9') return 'Ⅴ9';
    if(what==='v7bII') return 'Ⅴ7/♭Ⅱ';
    return '';
  };
})();
PA.reduceMotion=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
PA.scrollTop=()=>window.scrollTo({top:0,behavior:PA.reduceMotion()?'auto':'smooth'});
})();
