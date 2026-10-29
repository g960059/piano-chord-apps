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
// 𝄪 は 端末によって 出ないので、楽譜と同じ「x」の形で 出す
PA.H=s=>String(s).replace(/𝄪/g,'<span class="ds">x</span>');
PA.Svg=s=>String(s).replace(/𝄪/g,'<tspan font-family="Arial,Helvetica,sans-serif" font-weight="900">x</tspan>');
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
PA.reduceMotion=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
PA.scrollTop=()=>window.scrollTo({top:0,behavior:PA.reduceMotion()?'auto':'smooth'});
})();
