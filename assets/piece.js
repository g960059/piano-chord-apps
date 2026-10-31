/* 名曲で楽曲分析（piece.html）のしくみ：曲のデータ（assets/pieces/<id>.json）をたしかめる・こたえあわせ・せつめい
 * core.js のあとに読む（PA をつかう）。ページのほかに、テスト（test/piece.test.mjs）と tools/piece-check.mjs もつかう
 *
 * 曲のデータ（手で書く。DCML などのデータは写さない。docs/REPERTOIRE-ANALYSIS.md）
 *   {id, title, titleShort（調を書かない名前。調の問題に答えるまで見出しに出す）, composer, composerFull, movement, key:'C', meter:[4,4], tempo:{slow,normal}（4分音符／分）,
 *    source:{edition, measures, made, license}, excerpts:[{from,to,label}],
 *    events:[{id, m（小節）, beat（何拍めから。4分音符で数える。4.5＝4拍めのうら）, dur（何拍ぶん）, key（その和音の調）,
 *             rn（PA.rn の部品）, bass・sop（いちばん下・いちばん上の音。'F#3' のように）, skel:{lh:[…], rh:[…]}（骨組み：がくふと音）,
 *             blank（穴うめにするか）, level（'deg'｜'inv'｜'full'：どの答えかたから穴にするか）, accept:[部品]（べつの正解）,
 *             acceptNote（べつの正解のわけ：「2拍めのファまでいっしょに見て」→「…、Ⅴ₇¹でも正解」）,
 *             cad（ここでのおわりかた：PA.piece.CAD の id）, note（こたえたあとの1行）}],
 *    questions:[{id, type:'key'|'cadence', m, level, ask（type:'key'）, range（type:'cadence'：「3〜4小節」）, answer, choices, note}]}
 *   調の名前：大文字＝長調（'C'・'G'・'F#'・'Bb'）、小文字＝短調（'a'・'c#'・'eb'）
 *   skel：lh＝ヘ音記号、rh＝ト音記号。lh のいちばん下の音＝bass、rh のいちばん上の音＝sop（音名もオクターブもおなじ）
 *
 * 答えかた（先生：人ではなく「何を答えるか」で分けて、自分でえらぶ）
 *   'deg'＝和音の番号だけ（Ⅰ〜Ⅶの4択）、'inv'＝転回形も（番号＋転回形）、'full'＝ぜんぶ（番号・7／9・転回形・○・ⅤのⅤ、調とおわりかたも）
 *
 * PA.piece.key(name) → PA の調（わからなければ null）。PA.piece.note('F#3') → {letter, acc, midi}（null）
 * PA.piece.tones(key, parts) → 和音の音 [{letter, acc, pc, role}]（根音から。根音省略でも根音を入れて omit:true）
 * PA.piece.validate(piece) → まちがいのリスト（文字）。[] ならよい
 * PA.piece.items(piece, lv) → その答えかたで出す問題 [{kind:'ev'|'q', id, m, item}]（調の問題 → 小節のじゅん。おわりかたはその小節の和音のあと）
 * PA.piece.check(item, ans, lv) → 正解か（和音は accept もみる）
 * PA.piece.altAccepts(ev, lv) → その答えかたでくらべる部品で、ev.rn とちがう accept（なければ []。「こう答えても正解」を出すときだけ）
 * PA.piece.degChoices(ev) → 和音の番号だけの4択 [deg…]
 * PA.piece.explainHTML(ev) → 「ソ・シ・レ・ファの和音。いちばん下がレ（第5音）なので第2転回形」（HTML） */
(function(){
'use strict';
const PA=window.PA; if(!PA) return;
const mod=PA.mod;
const LEVELS=['deg','inv','full'];
const LV_RANK={deg:0,inv:1,full:2};
const CAD={perfect:'完全終止',imperfect:'不完全終止',half:'半終止',plagal:'変格終止',deceptive:'偽終止'};
const ROLE=['根音','第3音','第5音','第7音','第9音'];
const INV=['基本形','第1転回形','第2転回形','第3転回形'];
// 答えのボタンでつくれる部品（ぜんぶ：番号・7／9・転回形・○・ⅤのⅤ）
const PICKABLE=['deg','form','inv','borrowed','of'];

// 'C'・'F#'・'Bb'・'a'・'c#'・'eb' → PA の調
const key=name=>{
  const m=/^([A-Ga-g])(#|b)?$/.exec(String(name==null?'':name)); if(!m) return null;
  const l='CDEFGAB'.indexOf(m[1].toUpperCase()), a=m[2]==='#'?1:m[2]==='b'?-1:0, minor=m[1]===m[1].toLowerCase();
  const idx=(minor?PA.MINOR_KEYS:PA.MAJOR_KEYS).findIndex(([L,A])=>L===l&&A===a);
  return idx<0?null:PA.keyOf(minor,idx);
};
// 'F#3' → {letter, acc, midi}（C4＝60）
const note=s=>{
  const m=/^([A-G])(##|#|bb|b)?(-?\d)$/.exec(String(s==null?'':s)); if(!m) return null;
  const letter='CDEFGAB'.indexOf(m[1]), acc={'##':2,'#':1,'':0,'b':-1,'bb':-2}[m[2]||''];
  return {letter,acc,midi:12*(+m[3]+1)+PA.NAT[letter]+acc};
};
const same=(a,b)=>!!a&&!!b&&a.letter===b.letter&&a.acc===b.acc;
// 和音の音。調の音階：長調は長音階、短調と ○（準固有）は同じ主音の和声的短音階。ⅤのⅤなど（of）は、その度の音を主音にした調
//   その調が長調か短調か：もとの調でその度の三和音が短三和音なら短調（長調のⅡ・Ⅲ・Ⅵ、短調のⅠ・Ⅳ・Ⅴ）。○ がつけば短調
const tones=(k,p)=>{
  p=PA.rnNorm(p);
  const tonicPc=PA.NAT[k.l]+k.a, scale=k.minor||(p.borrowed&&!p.of)?PA.HMIN:PA.MAJ;
  let tl=k.l, tpc=tonicPc, sc=scale;
  if(p.of){
    tl=mod(k.l+p.of-1,7); tpc=tonicPc+(k.minor?PA.NMIN:PA.MAJ)[p.of-1];
    const minorKey=p.borrowed||(k.minor?[1,4,5]:[2,3,6]).includes(p.of);
    sc=minorKey?PA.HMIN:PA.MAJ;
  }
  const n=p.form===9?5:p.form===7?4:3, out=[];
  for(let i=0;i<n;i++){
    const d=p.deg-1+2*i, letter=mod(tl+d,7);
    let pc=mod(tpc+sc[mod(d,7)],12);
    if(i===0&&p.rootDown) pc=mod(pc-1,12);
    if(i===2&&p.alt5==='down') pc=mod(pc-1,12);
    out.push({letter,acc:PA.spell(letter,pc),pc,role:ROLE[i],...(i===0&&p.omit?{omit:true}:{})});
  }
  return out;
};
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
// 部品をくらべる（キーのじゅんはかまわない）
const J=v=>JSON.stringify(Object.keys(v).sort().map(k=>[k,v[k]]));
const normEq=p=>J(PA.rnNorm(p))===J(p); // へんな値・しらない部品がない

function validate(pc){
  const err=[], e=s=>err.push(s);
  if(!isObj(pc)) return ['データがない'];
  ['id','title','composer','movement'].forEach(f=>{if(typeof pc[f]!=='string'||!pc[f]) e(f+' がない');});
  if(pc.titleShort!=null&&(typeof pc.titleShort!=='string'||!pc.titleShort)) e('titleShort');
  if(!/^[a-z0-9-]{1,40}$/.test(pc.id||'')) e('id の形');
  if(!key(pc.key)) e('key（曲の調）がわからない：'+pc.key);
  const meter=Array.isArray(pc.meter)&&pc.meter.length===2?pc.meter:null; if(!meter) e('meter');
  const beats=meter?meter[0]*4/meter[1]:4;
  if(!isObj(pc.tempo)||!(pc.tempo.slow>0)||!(pc.tempo.normal>0)) e('tempo');
  if(!isObj(pc.source)||['edition','measures','made','license'].some(f=>typeof pc.source[f]!=='string'||!pc.source[f])) e('source（版・小節の数えかた・作りかた・ライセンス）');
  const ex=Array.isArray(pc.excerpts)?pc.excerpts:[];
  if(!ex.length) e('excerpts がない');
  ex.forEach((x,i)=>{if(!Number.isInteger(x.from)||!Number.isInteger(x.to)||x.from>x.to||!x.label) e('excerpts['+i+']');});
  const inEx=m=>ex.some(x=>m>=x.from&&m<=x.to);
  const evs=Array.isArray(pc.events)?pc.events:[];
  if(!evs.length) e('events がない');
  const ids=new Set();
  let prevEnd=null;
  evs.forEach((ev,i)=>{
    const w=`${ev&&ev.id||'#'+i}（${ev&&ev.m}小節${ev&&ev.beat}拍）：`;
    if(!isObj(ev)){e(w+'形');return;}
    if(typeof ev.id!=='string'||!/^[a-z0-9-]+$/.test(ev.id)||ids.has(ev.id)) e(w+'id'); ids.add(ev.id);
    if(!Number.isInteger(ev.m)||!inEx(ev.m)) e(w+'小節がぬき出しの外');
    if(!(ev.beat>=1)||!(ev.dur>0)||ev.beat+ev.dur>beats+1+1e-9) e(w+'拍が小節の外');
    // 和音はすきまなく、じゅんにならぶ（小節をまたがない）
    const at=(ev.m-1)*beats+ev.beat-1, exStart=ev.beat===1&&ex.some(x=>x.from===ev.m);
    if(prevEnd==null||exStart){if(!exStart) e(w+'ぬき出しのはじめから');}
    else if(Math.abs(at-prevEnd)>1e-9) e(w+'前の和音とのあいだ（すきま・かさなり）');
    prevEnd=at+ev.dur;
    const k=key(ev.key); if(!k){e(w+'調');return;}
    if(!isObj(ev.rn)||!normEq(ev.rn)) e(w+'rn の部品の形');
    if(!LEVELS.includes(ev.level)) e(w+'level');
    if(typeof ev.blank!=='boolean') e(w+'blank');
    if(ev.cad!=null&&!CAD[ev.cad]) e(w+'cad');
    if(ev.note!=null&&typeof ev.note!=='string') e(w+'note');
    if(ev.acceptNote!=null&&(typeof ev.acceptNote!=='string'||!ev.acceptNote||!ev.accept)) e(w+'acceptNote');
    if(ev.accept!=null&&(!Array.isArray(ev.accept)||ev.accept.some(a=>!isObj(a)||!normEq(a)||J(PA.rnNorm(a))===J(PA.rnNorm(ev.rn))))) e(w+'accept');
    // 番号だけ・転回形の答えでは、○・ⅤのⅤ・斜線などは答えられない → 'full' だけで穴にする
    const p=PA.rnNorm(ev.rn), fancy=p.of||p.borrowed||p.omit||p.alt5||p.rootDown||p.natural;
    if(ev.blank&&fancy&&ev.level!=='full') e(w+'○・ⅤのⅤ・斜線などのある和音は level:full');
    if(ev.blank&&Object.keys(p).some(f=>!PICKABLE.includes(f)&&f!=='name')) e(w+'答えのボタンでつくれない部品');
    if(ev.blank&&p.of&&p.of!==5) e(w+'答えのボタンは ⅤのⅤ だけ');
    // 音：和音の音だけ。いちばん下＝bass（転回形の音）、いちばん上＝sop
    const T=tones(k,p), has=n=>T.some(t=>same(t,n)&&!(t.omit));
    const bass=note(ev.bass), sop=note(ev.sop);
    if(!bass) e(w+'bass'); else if(!same(bass,T[p.inv||0])) e(w+'bass が転回形の音とちがう');
    if(!sop) e(w+'sop'); else if(!has(sop)) e(w+'sop が和音の音ではない');
    const sk=isObj(ev.skel)?ev.skel:{}, lh=(sk.lh||[]).map(note), rh=(sk.rh||[]).map(note);
    if(!lh.length||!rh.length||lh.some(n=>!n)||rh.some(n=>!n)){e(w+'skel の音');return;}
    const all=lh.concat(rh);
    all.forEach(n=>{if(!has(n)) e(w+'skel に和音の外の音：'+PA.LET_EN[n.letter]+n.acc);});
    const lo=all.reduce((a,b)=>b.midi<a.midi?b:a), hi=all.reduce((a,b)=>b.midi>a.midi?b:a);
    // 音名だけでなく高さ（オクターブ）もおなじ
    if(bass&&!(same(lo,bass)&&lo.midi===bass.midi)) e(w+'skel のいちばん下が bass ではない');
    if(sop&&!(same(hi,sop)&&hi.midi===sop.midi)) e(w+'skel のいちばん上が sop ではない');
    if(Math.max(...lh.map(n=>n.midi))>Math.min(...rh.map(n=>n.midi))) e(w+'skel の左手が右手より上');
    if(new Set(all.map(n=>n.midi)).size!==all.length) e(w+'skel におなじ高さの音が2つ');
    // 根音（省略でなければ）・第3音・第7音・第9音はかならず。第5音ははぶいてよい
    T.forEach((t,i)=>{if(i===2||t.omit) return;if(!all.some(n=>same(n,t))) e(w+'skel に'+t.role+'がない');});
  });
  const qs=Array.isArray(pc.questions)?pc.questions:[];
  qs.forEach((q,i)=>{
    const w='questions['+(q&&q.id||i)+']：';
    if(!isObj(q)){e(w+'形');return;}
    if(typeof q.id!=='string'||!/^[a-z0-9-]+$/.test(q.id)||ids.has(q.id)) e(w+'id'); ids.add(q.id);
    if(!LEVELS.includes(q.level)) e(w+'level');
    if(!Number.isInteger(q.m)||!inEx(q.m)) e(w+'小節');
    if(!Array.isArray(q.choices)||q.choices.length<2||new Set(q.choices).size!==q.choices.length||!q.choices.includes(q.answer)) e(w+'choices・answer');
    if(q.type==='key'){if(!q.ask||(q.choices||[]).some(c=>!key(c))) e(w+'調の名前');}
    else if(q.type==='cadence'){if(!q.range||(q.choices||[]).some(c=>!CAD[c])) e(w+'おわりかたの名前');}
    else e(w+'type');
    if(typeof q.note!=='string'||!q.note) e(w+'note');
  });
  return err;
}

// 問題のならび：調の問題 → 小節のじゅんに和音（おわりかたの問題は、その小節の和音のあと）
function items(pc,lv){
  const r=LV_RANK[lv]; if(r==null) return [];
  const qs=(pc.questions||[]).filter(q=>LV_RANK[q.level]<=r);
  const out=qs.filter(q=>q.type==='key').map(q=>({kind:'q',id:q.id,m:q.m,item:q}));
  const cads=qs.filter(q=>q.type!=='key');
  pc.events.forEach((ev,i)=>{
    if(ev.blank&&LV_RANK[ev.level]<=r) out.push({kind:'ev',id:ev.id,m:ev.m,item:ev});
    const last=!pc.events[i+1]||pc.events[i+1].m!==ev.m;
    if(last) cads.filter(q=>q.m===ev.m).forEach(q=>out.push({kind:'q',id:q.id,m:q.m,item:q}));
  });
  return out;
}
const asked=(ev,lv)=>!!ev.blank&&LV_RANK[ev.level]<=LV_RANK[lv];

// こたえあわせ。和音：lv の部品だけくらべる（番号だけ＝deg、転回形も＝deg・inv、ぜんぶ＝ぜんぶの部品）
function matchParts(p,a,lv){
  p=PA.rnNorm(p); a=PA.rnNorm(a);
  if(p.deg!==a.deg) return false;
  if(lv==='deg') return true;
  if((p.inv||0)!==(a.inv||0)) return false;
  if(lv==='inv') return true;
  return ['form','borrowed','of','omit','alt5','rootDown','natural'].every(f=>(p[f]||null)===(a[f]||null));
}
function check(it,ans,lv){
  if(it.type) return ans===it.answer; // 調・おわりかたの問題
  if(!isObj(ans)) return false;
  return [it.rn].concat(it.accept||[]).some(p=>matchParts(p,ans,lv));
}
// その答えかたで ev.rn とくらべてちがいがわかる accept だけ（番号だけ・転回形もでは7の和音をえらべないので、Ⅴ¹ と Ⅴ₇¹ はおなじ）
const altAccepts=(ev,lv)=>(ev.accept||[]).filter(p=>!matchParts(ev.rn,p,lv));
// 和音の番号だけ：Ⅰ・Ⅳ・Ⅴに、こたえ（なければⅡ）をたした4つ
function degChoices(ev){
  const d=ev.rn.deg, s=[1,4,5];
  s.push(s.includes(d)?(d===2?6:2):d);
  return s.sort((a,b)=>a-b);
}
function explainHTML(ev){
  const k=key(ev.key), p=PA.rnNorm(ev.rn), T=tones(k,p), on=T.filter(t=>!t.omit), b=T[p.inv||0];
  return `${PA.namesH(on)}の和音。いちばん下が${PA.nmH(b)}（${b.role}）なので<b>${INV[p.inv||0]}</b>`;
}
const beatText=b=>Number.isInteger(b)?b+'拍め':Math.floor(b)+'拍めのうら';

PA.piece={LEVELS,LV_RANK,CAD,ROLE,INV,key,note,tones,validate,items,asked,check,altAccepts,degChoices,explainHTML,beatText,same};
})();
