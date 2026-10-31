/* 名曲で楽曲分析（piece.html）の「本物の楽譜」を描く
 * assets/vendor/vexflow-bravura.js（VexFlow 4.2.5・MIT。音符の字は Bravura・SIL OFL 1.1）と core.js・piece.js のあとに読む
 *
 * PA.score.ready() → VexFlow を読めたか（読めなければ、ページは骨組みだけを出す）
 * PA.score.layout(pc, per) → {W, H, systems:[{ms:[小節…], svg（文字）, evs:[{i（pc.events の番号）, x（「？」をおく所＝符頭のまんなか）,
 *     x0・x1（色をつける所）}], bars:[{m, x0, x1}], heads:[{m, hand（rh｜lh）, t（拍）, x（符頭のまんなか）}]}]}
 *   単位は VexFlow の単位（線と線のあいだ＝10）。ページは viewBox で画面のはばにあわせ、位置は W に対する % でつかう
 *   per＝1段の小節の数（1｜2）。おなじ曲・per は1回だけ描く（テストでは document を test/_fakedom.mjs にする）
 * 音の書きかた（pc.score）は piece.js の PA.piece.parseStaff */
(function(){
'use strict';
const PA=window.PA; if(!PA||!PA.piece) return;
const PC=PA.piece;
const VF=()=>(window.Vex&&window.Vex.Flow)||null;
// 段のはば（VexFlow の単位）。1小節：320px の画面でも線のあいだが8pxくらい
const W_OF={1:360,2:700};
const LEFT=22;          // 大かっこ（ブレース）のぶん
const Y_RH=-10, Y_LH=90; // 上の段・下の段の y（線は y＋40 から）
const H=200;
const ACC={'-2':'bb','-1':'b','0':'n','1':'#','2':'##'};
const vkey=k=>{const m=/^([A-G])(##|#|bb|b)?(-?\d)$/.exec(k.name);return m[1].toLowerCase()+(m[2]||'')+'/'+m[3];};
const cache=new Map();

// 1つの手（右手・左手）の1小節の音符。st＝PA.piece.parseStaff のけっか
function makeNotes(V,st,sig){
  const ticks=[], list=[], beams={}, state=new Map();
  st.notes.forEach(n=>{
    const sn=new V.StaveNote(n.rest
      ?{keys:[n.clef==='bass'?'d/3':'b/4'],duration:n.dur+(n.dots?'d':'')+'r',clef:n.clef}
      :{keys:n.keys.map(vkey),duration:n.dur+(n.dots?'d':''),clef:n.clef,auto_stem:true});
    if(n.dots) V.Dot.buildAndAttach([sn],{all:true});
    // 臨時記号：おなじ小節・おなじ高さ（オクターブも）で、前とちがうとき。'!' はかならず
    n.keys.forEach((k,i)=>{
      const id=k.letter+'/'+k.name.slice(-1), cur=state.has(id)?state.get(id):(sig[k.letter]||0);
      if(k.force||cur!==k.acc) sn.addModifier(new V.Accidental(ACC[k.acc]),i);
      state.set(id,k.acc);
    });
    if(n.orn.includes('tr')) sn.addModifier(new V.Ornament('tr'),0);
    // 小節のとちゅうの音部記号は、その音符の前にそえる（べつの音符にすると、拍の列がずれる）
    if(n.clefChange) sn.addModifier(new V.NoteSubGroup([new V.ClefNote(n.clefChange,'small')]),0);
    if(n.beam!=null) (beams[n.beam]=beams[n.beam]||[]).push(sn);
    ticks.push(sn); list.push({sn,n});
  });
  const bl=Object.keys(beams).map(b=>new V.Beam(beams[b],true));
  // スタッカート・アクセントは符頭のがわ（ぼうの反対）
  list.forEach(({sn,n})=>n.art.forEach(a=>{
    const ar=new V.Articulation(a==='st'?'a.':'a>');
    ar.setPosition(sn.getStemDirection()===1?V.Modifier.Position.BELOW:V.Modifier.Position.ABOVE);
    sn.addModifier(ar,0);
  }));
  const voice=new V.Voice({num_beats:4,beat_value:4}).setMode(V.Voice.Mode.SOFT);
  voice.addTickables(ticks);
  return {voice,list,beams:bl};
}
function staves(V,x,w,mx,first,firstSys,time){
  const r=new V.Stave(x,Y_RH,w), l=new V.Stave(x,Y_LH,w);
  if(first){r.addClef(mx.rh.clef0);l.addClef(mx.lh.clef0);if(firstSys){r.addTimeSignature(time);l.addTimeSignature(time);}}
  const s=Math.max(r.getNoteStartX(),l.getNoteStartX());
  r.setNoteStartX(s); l.setNoteStartX(s);
  return {r,l};
}
function drawSystem(V,pc,mxs,firstSys,W){
  const sig=(PC.key(pc.key)||{sig:{}}).sig||{}, time=(pc.score&&pc.score.time)||'4/4';
  // 1回め：いちばんせまいはば
  const need=mxs.map((mx,i)=>{
    const {r,l}=staves(V,0,200,mx,i===0,firstSys,time), a=makeNotes(V,mx.rh,sig), b=makeNotes(V,mx.lh,sig);
    a.voice.setStave(r); b.voice.setStave(l);
    const f=new V.Formatter(); f.joinVoices([a.voice]); f.joinVoices([b.voice]);
    return {mod:r.getNoteStartX()-r.getX(),notes:f.preCalculateMinTotalWidth([a.voice,b.voice])+12};
  });
  const sumN=need.reduce((s,n)=>s+n.notes,0), sumM=need.reduce((s,n)=>s+n.mod,0), avail=W-LEFT-2-sumM;
  const div=document.createElement('div'), rd=new V.Renderer(div,V.Renderer.Backends.SVG);
  rd.resize(W,H);
  const ctx=rd.getContext();
  let x=LEFT;
  const out={evs:[],bars:[],heads:[]};
  const evs=pc.events.map((e,i)=>({e,i}));
  mxs.forEach((mx,i)=>{
    // 小節のはば：音の多さにあわせる（半分）＋おなじはば（半分）。音の少ない小節がつぶれないように
    const w=need[i].mod+avail*(0.5*need[i].notes/sumN+0.5/mxs.length);
    const {r,l}=staves(V,x,w,mx,i===0,firstSys,time), a=makeNotes(V,mx.rh,sig), b=makeNotes(V,mx.lh,sig);
    a.voice.setStave(r); b.voice.setStave(l);
    const f=new V.Formatter(); f.joinVoices([a.voice]); f.joinVoices([b.voice]);
    f.formatToStave([a.voice,b.voice],r);
    r.setContext(ctx).draw(); l.setContext(ctx).draw();
    if(i===0){
      new V.StaveConnector(r,l).setType('brace').setContext(ctx).draw();
      new V.StaveConnector(r,l).setType('singleLeft').setContext(ctx).draw();
    }
    new V.StaveConnector(r,l).setType('singleRight').setContext(ctx).draw();
    a.voice.draw(ctx,r); b.voice.draw(ctx,l);
    a.beams.concat(b.beams).forEach(bm=>bm.setContext(ctx).draw());
    // 小節の番号
    ctx.save(); ctx.setFont('Times New Roman, serif',12,'normal','italic'); ctx.fillText(String(mx.m),x+(i===0?2:3),Y_RH+20); ctx.restore();
    // 拍ごとの位置（右手・左手のどちらかで、その拍に鳴りはじめる音）
    const at={};
    a.list.concat(b.list).forEach(({sn,n})=>{
      const met=sn.getMetrics(), hb=sn.getNoteHeadBeginX(), he=sn.getNoteHeadEndX(), x0=sn.getAbsoluteX()-met.modLeftPx-met.leftDisplacedHeadPx;
      const o=at[n.t]||(at[n.t]={hb:1e9,he:-1e9,x0:1e9,rest:true});
      if(!n.rest||o.rest){
        if(!n.rest&&o.rest){o.hb=1e9;o.he=-1e9;o.rest=false;}
        o.hb=Math.min(o.hb,hb); o.he=Math.max(o.he,he);
      }
      o.x0=Math.min(o.x0,x0);
      if(!n.rest) out.heads.push({m:mx.m,hand:a.list.some(q=>q.sn===sn)?'rh':'lh',t:n.t,x:(hb+he)/2});
    });
    const ns=r.getNoteStartX(), end=r.getX()+r.getWidth();
    out.bars.push({m:mx.m,x0:r.getX(),x1:end,ns});
    const mine=evs.filter(y=>y.e.m===mx.m);
    mine.forEach((y,k)=>{
      const o=at[y.e.beat], nx=mine[k+1]&&at[mine[k+1].e.beat];
      if(!o) return;
      out.evs.push({i:y.i,x:(o.hb+o.he)/2,x0:k===0?Math.min(o.x0,ns)-4:o.x0-3,x1:nx?nx.x0-3:end-2});
    });
    x+=w;
  });
  const svg=div.firstChild;
  svg.removeAttribute('style'); svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('class','vfsvg');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  out.svg=div.innerHTML;
  return out;
}
function layout(pc,per){
  const V=VF(); if(!V) return null;
  per=per===2?2:1;
  const k=pc.id+'|'+per;
  if(cache.has(k)&&cache.get(k).pc===pc) return cache.get(k).L;
  const W=W_OF[per], all=PC.score(pc), systems=[];
  for(let i=0;i<all.length;i+=per){
    const mxs=all.slice(i,i+per), s=drawSystem(V,pc,mxs,i===0,W);
    systems.push({ms:mxs.map(x=>x.m),svg:s.svg,evs:s.evs,bars:s.bars,heads:s.heads});
  }
  const L={W,H,per,systems};
  cache.set(k,{pc,L});
  return L;
}
PA.score={ready:()=>!!VF(),layout,W_OF,H};
})();
