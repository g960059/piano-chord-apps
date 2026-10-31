// 和音クイズ（chord-quiz.html）：もんだいのしゅるい（CATS）・ステップ（STEPS）・えらんでこたえるもんだい（makeDrill）
// 26調 × 和音 × しゅるい × いくつもの seed で、音のつづり・こたえが1つ・まちがいの答えがこたえとおなじにならないことをたしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'chord-quiz.html'),'utf8');
const m=html.match(/\/\/ <cq-logic>[^\n]*\n([\s\S]*?)\/\/ <\/cq-logic>/);
assert.ok(m,'chord-quiz.html に<cq-logic>のしるしがない');
const PA=loadPA(), mod=PA.mod;
const CQ=new Function('PA',m[1]+'\nreturn {CHORDS,CHORD_IDS,CATS,CAT_IDS,OLD_TYPES,STEPS,STAGES,STEP_N,STEP_PASS,stepOf,stepById,stepKey,stepSig,catChords,catModes,quizOf,isDrill,linkSettings,chordTones,makeDrill,drillDone,drillOk,MARKS,MARK3,progPairs,PROG_S1,PROG_S2};')(PA);

const KEYS=[false,true].flatMap(minor=>[...Array(13).keys()].map(keyIdx=>({minor,keyIdx})));
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const sp=n=>n.letter+':'+n.acc;
const keyOf=k=>PA.keyOf(k.minor,k.keyIdx,60);
const nameOf=k=>PA.keyName(keyOf(k));
const SEEDS=Array.from({length:12},(_,i)=>1+i*104729);
const plain=o=>JSON.parse(JSON.stringify(o));
// その調でつかう音のつづり（和声的短音階・自然的短音階もふくむ）
const keyNotes=key=>(key.minor?key.harm.concat(key.nat):key.scale);
const usesSpelling=(key,n)=>keyNotes(key).some(x=>x.letter===n.letter&&x.acc===n.acc);
// しゅるいごとにありうる和音
const chordsFor=cat=>cat==='add7'?['V7']:cat==='lt'?['V']:cat==='mark'?['V','V7']:CQ.CHORD_IDS;
const DRILLS=CQ.CAT_IDS.filter(CQ.isDrill);
// まちがいの答え（音）：こたえとちがう高さ・ほかの答えともちがう高さ・𝄫 なし・𝄪 や白いけんばんの♯♭（ミ♯など）はその調でつかうときだけ
function checkNoteOpts(key,part,lab,o={}){
  const ans=part.opts.filter(x=>x.ok);
  assert.equal(ans.length,1,lab+'：こたえは1つ');
  assert.ok(part.opts.length>=(o.min||4),lab+`：ボタンが${o.min||4}ついじょう（${part.opts.length}）`);
  assert.equal(new Set(part.opts.map(x=>pc(x.note))).size,part.opts.length,lab+'：おなじ高さのボタンがない');
  part.opts.forEach(x=>{
    const n=x.note;
    assert.ok(Number.isInteger(n.letter)&&n.letter>=0&&n.letter<=6,lab+'：音名');
    assert.ok(n.acc>=-1&&n.acc<=2,lab+'：𝄫 は出さない');
    assert.equal(mod(n.midi,12),pc(n),lab+'：つづりと高さ');
    if(!x.ok){
      assert.notEqual(sp(n),sp(ans[0].note),lab+'：まちがいの答えがこたえとおなじ');
      assert.ok(typeof x.kind==='string'&&x.kind,lab+'：まちがいのわけ');
      if(n.acc===2||(n.acc!==0&&!PA.BLACK.has(pc(n)))) assert.ok(usesSpelling(key,n),lab+`：その調でつかわない ${PA.nm(n)}`);
    }
  });
  return ans[0].note;
}

test('しゅるい：ぜんぶで10。けんばん・えらぶはまえからのきろく、ほかはしゅるいごと',()=>{
  assert.deepEqual([...CQ.CAT_IDS],['root','fill','add7','choice','keys','staff','fix','prog','lt','mark']);
  assert.deepEqual(CQ.CATS.filter(c=>c.minor).map(c=>c.id),['lt','mark'],'短調だけ');
  assert.equal(CQ.quizOf('keys'),'chord-quiz'); assert.equal(CQ.quizOf('choice'),'chord-quiz');
  DRILLS.forEach(c=>{assert.equal(CQ.quizOf(c),'chord-quiz-'+c);assert.match(CQ.quizOf(c),/^[a-z0-9][a-z0-9-]{0,40}$/);});
  CQ.CATS.forEach(c=>{assert.ok(CQ.STAGES[c.stage],c.id);assert.ok(!/半減七/.test(c.name+c.desc));});
  assert.deepEqual(plain(CQ.catModes('lt','major')),['minor']); assert.deepEqual(plain(CQ.catModes('root','both')),['major','minor']);
  assert.deepEqual(plain(CQ.catChords('add7',['I'])),['V7']);
  assert.deepEqual(plain(CQ.catChords('lt',['I','IV'])),['V']);
  assert.deepEqual(plain(CQ.catChords('mark',['I','V'])),['V']);
  assert.deepEqual(plain(CQ.catChords('mark',['I','IV'])),['V7']);
  assert.deepEqual(plain(CQ.catChords('fill',[])),['I']);
});

test('リンク：cat・step。mode はまえからの keys・choice だけ。keyset だけのリンクはそのまま',()=>{
  const ls=s=>plain(CQ.linkSettings(PA.parseParams(s)));
  assert.deepEqual(ls('?cat=fix&keyset=minor'),{type:'fix',keyset:'minor'});
  assert.deepEqual(ls('?mode=keys&cat=staff'),{type:'staff'},'cat が mode よりさき');
  assert.deepEqual(ls('?mode=root'),{},'mode に新しいしゅるいは入れない');
  assert.deepEqual(ls('?cat=ear'),{});
  assert.deepEqual(ls('?step=3&keyset=minor'),{step:3,keyset:'minor'});
  assert.deepEqual(ls('?step=0'),{}); assert.deepEqual(ls('?step=x'),{}); assert.deepEqual(ls('?step=123'),{});
  assert.deepEqual(ls('?keyset=major'),{keyset:'major'});
  assert.deepEqual(ls('?mode=keys&chord=V7'),{type:'keys',chords:{I:false,IV:false,V:false,V7:true}},'まえのリンク');
});

test('ステップ：長調・短調、やさしいじゅん。1つのステップでむずかしくするのは1つだけ',()=>{
  const RANK={easy:0,normal:1,hard:2,all:3};
  for(const ks of ['major','minor']){
    const list=CQ.STEPS[ks];
    assert.ok(list.length>=10,ks+'：たくさん');
    assert.equal(new Set(list.map(s=>s.id)).size,list.length,ks+'：id がかさならない');
    assert.equal(list[0].tier,'easy',ks+'：さいしょはやさしい');
    assert.equal(list[list.length-1].tier,'all',ks+'：さいごはぜんぶの調');
    const seen=new Set();
    list.forEach((s,i)=>{
      const lab=`${ks} ${i+1} ${s.id}`;
      assert.ok(CQ.CAT_IDS.includes(s.cat),lab); assert.ok(RANK[s.tier]!=null,lab);
      assert.ok(s.chords.length&&s.chords.every(c=>CQ.CHORD_IDS.includes(c)),lab);
      if(ks==='major') assert.ok(!CQ.CATS.find(c=>c.id===s.cat).minor,lab+'：長調に短調だけのしゅるいはない');
      assert.deepEqual(plain(CQ.stepById(CQ.stepKey(CQ.stepOf(ks,i+1)))),plain(CQ.stepOf(ks,i+1)),lab);
      assert.equal(CQ.stepSig(CQ.stepOf(ks,i+1)),'step='+ks+':'+s.id);
      // はじめて出るしゅるいは、その前までのいちばんむずかしい調号よりむずかしくしない（短調の「どの記号？」だけべつ：♮の調も出すため）
      const maxBefore=Math.max(0,...list.slice(0,i).map(x=>RANK[x.tier]));
      if(!seen.has(s.cat)&&!(ks==='minor'&&s.id==='mark-normal')) assert.ok(RANK[s.tier]<=maxBefore,lab+'：新しいしゅるいと調号を同時にむずかしくしない');
      // おなじしゅるいがつづくときは、調号か和音のどちらか1つだけかえる
      const p=list[i-1];
      if(p&&p.cat===s.cat) assert.ok((p.tier!==s.tier)!==(p.chords.join()!==s.chords.join()),lab+'：1つだけかえる');
      seen.add(s.cat);
    });
  }
  assert.equal(CQ.stepOf('major',0),null); assert.equal(CQ.stepOf('major',99),null); assert.equal(CQ.stepOf('both',1),null);
  assert.equal(CQ.stepById('major:zzz-easy'),null); assert.equal(CQ.stepById('x'),null);
  assert.equal(CQ.STEP_N,5); assert.equal(CQ.STEP_PASS,4);
  // 短調の「どの記号？」：さいしょのステップから♮の調が出る（「短調はぜんぶ♯」とおぼえないように）。𝄪 は「むずかしい」から
  const KD=PA.keyDeck, lt=id=>{const p=KD.parse(id);return PA.minorKey(p.idx).ltType;};
  const first=CQ.STEPS.minor.find(s=>s.cat==='mark');
  const types=new Set(KD.ids({tier:first.tier,modes:['minor']}).map(lt));
  assert.ok(types.has(0)&&types.has(1)&&!types.has(2),'♯と♮。𝄪 はまだ');
  for(const t of ['easy','normal']) assert.ok(!KD.ids({tier:t,modes:['minor']}).map(lt).includes(2),t+'：𝄪 は出ない');
  assert.ok(KD.ids({tier:'hard',modes:['minor']}).map(lt).includes(2),'むずかしい：𝄪 が出る');
});

test('和音の音：短調のⅤ・Ⅴ7は導音を上げる、Ⅳは調号どおりの6ばんめ',()=>{
  for(const k of KEYS) for(const ch of CQ.CHORD_IDS){
    const key=keyOf(k), t=CQ.chordTones(key,ch), lab=`${nameOf(k)} ${ch}`;
    t.forEach((n,j)=>{
      assert.equal(n.letter,(key.l+CQ.CHORDS[ch].deg+2*j)%7,lab+'：ひとつとばし');
      const deg=(CQ.CHORDS[ch].deg+2*j)%7;
      if(key.minor&&deg===6) {assert.ok(n.raised,lab);assert.equal(pc(n),mod(key.tpc-1,12),lab+'：導音は主音のすぐ下');}
      else assert.equal(n.acc,key.sig[n.letter],lab+'：調号どおり');
    });
  }
});

test('はじまりの音：こたえは根音。まちがいはよくある形（調号をわすれた・となり・ほかの和音）',()=>{
  for(const k of KEYS) for(const ch of CQ.CHORD_IDS) for(const seed of SEEDS){
    const key=keyOf(k), t=CQ.chordTones(key,ch), lab=`${nameOf(k)} ${ch} root ${seed}`;
    const d=CQ.makeDrill('root',{...k,chord:ch},seed);
    assert.equal(d.parts.length,1);
    assert.equal(sp(checkNoteOpts(key,d.parts[0],lab)),sp(t[0]),lab);
    // 調号のつく根音なら、調号をわすれた音はかならず出す
    if(t[0].acc&&!t[0].raised) assert.ok(d.parts[0].opts.some(o=>o.kind==='sig'&&o.note.acc===0&&o.note.letter===t[0].letter),lab+'：調号をわすれた');
  }
});

test('たりない音：□は1つ。まちがいの答えは見えている音の高さにならない。短調で導音が□なら上げわすれを出す',()=>{
  for(const k of KEYS) for(const ch of CQ.CHORD_IDS) for(const seed of SEEDS){
    const key=keyOf(k), t=CQ.chordTones(key,ch), lab=`${nameOf(k)} ${ch} fill ${seed}`;
    const d=CQ.makeDrill('fill',{...k,chord:ch},seed);
    assert.ok(Number.isInteger(d.blank)&&d.blank>=0&&d.blank<t.length,lab);
    const ans=checkNoteOpts(key,d.parts[0],lab);
    assert.equal(sp(ans),sp(t[d.blank]),lab);
    const shown=new Set(t.filter((_,i)=>i!==d.blank).map(pc));
    d.parts[0].opts.filter(o=>!o.ok).forEach(o=>assert.ok(!shown.has(pc(o.note)),lab+'：見えている音とおなじ高さ'));
    if(t[d.blank].raised) assert.ok(d.parts[0].opts.some(o=>o.kind==='raise'&&sp(o.note)===sp(key.natLT)),lab+'：上げわすれ');
  }
});

test('Ⅴ7にするには：こたえは第7音（調号どおりの4ばんめ）',()=>{
  for(const k of KEYS) for(const seed of SEEDS){
    const key=keyOf(k), t=CQ.chordTones(key,'V7'), lab=`${nameOf(k)} add7 ${seed}`;
    const d=CQ.makeDrill('add7',{...k,chord:'V7'},seed);
    const ans=checkNoteOpts(key,d.parts[0],lab);
    assert.equal(sp(ans),sp(t[3]),lab);
    assert.equal(ans.letter,(key.l+3)%7,lab+'：4ばんめ'); assert.equal(ans.acc,key.sig[ans.letter],lab+'：調号どおり');
    d.parts[0].opts.filter(o=>!o.ok).forEach(o=>assert.ok(![pc(t[1]),pc(t[2])].includes(pc(o.note)),lab+'：Ⅴの上の2つとおなじ高さは出さない'));
  }
});

test('まちがいさがし：まちがいはちょうど1つ（高さもちがう）。短調で調号・導音のまちがいは、なおす記号も',()=>{
  const kinds=new Set();
  for(const k of KEYS) for(const ch of CQ.CHORD_IDS) for(const seed of SEEDS){
    const key=keyOf(k), t=CQ.chordTones(key,ch), lab=`${nameOf(k)} ${ch} fix ${seed}`;
    const d=CQ.makeDrill('fix',{...k,chord:ch},seed), w=d.written;
    assert.equal(w.length,t.length,lab);
    const diff=w.map((n,i)=>sp(n)!==sp(t[i])?i:-1).filter(i=>i>=0);
    assert.deepEqual(diff,[d.wrong],lab+'：ちょうど1つ');
    assert.notEqual(pc(w[d.wrong]),pc(t[d.wrong]),lab+'：高さもちがう');
    assert.equal(new Set(w.map(n=>n.letter)).size,w.length,lab+'：おなじ音名が2つない');
    assert.equal(new Set(w.map(pc)).size,w.length,lab+'：おなじ高さが2つない');
    w.forEach(n=>{assert.ok(n.acc>=-1&&n.acc<=2,lab);assert.equal(mod(n.midi,12),pc(n),lab);});
    // 1つめ：書いたじゅんのボタン、こたえはまちがいの音
    assert.deepEqual(d.parts[0].opts.map(o=>sp(o.note)),w.map(sp),lab);
    assert.deepEqual(d.parts[0].opts.map((o,i)=>o.ok?i:-1).filter(i=>i>=0),[d.wrong],lab);
    kinds.add((key.minor?'m':'M')+d.kind);
    const x=t[d.wrong];
    if(d.kind==='raise'){assert.ok(key.minor&&x.raised,lab);assert.equal(sp(w[d.wrong]),sp(key.natLT),lab+'：上げわすれ');}
    if(d.kind==='sig'){assert.ok(x.acc!==0&&!x.raised,lab);assert.equal(w[d.wrong].acc,0,lab+'：調号をわすれた');}
    if(d.kind==='shift') assert.ok([1,6].includes(mod(w[d.wrong].letter-x.letter,7)),lab+'：となりの音名');
    // 2つめ（短調で調号・導音のまちがい）：なおす記号。こたえはただしい音の記号
    if(key.minor&&d.kind!=='shift'){
      assert.equal(d.parts.length,2,lab);
      assert.deepEqual(d.parts[1].opts.map(o=>o.acc),[...CQ.MARKS],lab);
      assert.deepEqual(d.parts[1].opts.filter(o=>o.ok).map(o=>o.acc),[x.acc],lab);
    }else assert.equal(d.parts.length,1,lab);
  }
  ['Mshift','Msig','mshift','msig','mraise'].forEach(k=>assert.ok(kinds.has(k),'出るまちがい：'+k));
});

test('がくふを見て・ならびの「？」：Ⅰ・Ⅳ・Ⅴ・Ⅴ7 から1つ。ならびは Ⅰ・Ⅳ・Ⅴ・Ⅴ7 だけ',()=>{
  const T=PA.prog.TPL;
  [...CQ.PROG_S1,...CQ.PROG_S2].forEach(id=>T[id].rows.forEach(r=>assert.ok(CQ.CHORD_IDS.includes(r[0])&&r[2]==null,id+'：基本形の Ⅰ・Ⅳ・Ⅴ・Ⅴ7 だけ')));
  CQ.CHORD_IDS.forEach(ch=>assert.ok(CQ.progPairs(ch).length>=2,ch+'：ならびがいくつかある'));
  for(const k of KEYS) for(const ch of CQ.CHORD_IDS) for(const seed of SEEDS.slice(0,4)){
    const lab=`${nameOf(k)} ${ch} ${seed}`;
    for(const cat of ['staff','prog']){
      const d=CQ.makeDrill(cat,{...k,chord:ch},seed);
      assert.deepEqual(d.parts[0].opts.map(o=>o.ch),[...CQ.CHORD_IDS],lab);
      assert.deepEqual(d.parts[0].opts.filter(o=>o.ok).map(o=>o.ch),[ch],lab);
      if(cat==='prog'){
        assert.equal(T[d.t].rows[d.i][0],ch,lab+'：「？」の和音');
        assert.ok(T[d.t].chord.includes(d.i),lab+'：「？」にしてよい場所');
        if(ch!=='V7') assert.ok(T[d.t].rows.every(r=>r[0]!=='V7'),lab+'：Ⅴ7 がないステップでも出せる');
        const data=PA.prog.buildT(PA.prog.keyFor(k.minor,k.keyIdx,d.t),d.t);
        assert.ok(data&&data.length===T[d.t].rows.length,lab+'：鳴らせる');
      }
    }
  }
});

test('7ばんめの音（短調）：調号どおりの7ばんめ → Ⅴでは上げた音（ソ→ソ♯、シ♭→シ♮、ファ♯→ファ𝄪）',()=>{
  const want={'イ短調':['ソ','ソ♯'],'ハ短調':['シ♭','シ'],'嬰ト短調':['ファ♯','ファ𝄪'],'嬰ニ短調':['ド♯','ド𝄪'],'ヘ短調':['ミ♭','ミ'],'嬰ハ短調':['シ','シ♯']};
  const got={};
  for(const k of KEYS.filter(k=>k.minor)) for(const seed of SEEDS){
    const key=keyOf(k), lab=`${nameOf(k)} lt ${seed}`;
    const d=CQ.makeDrill('lt',{...k,chord:'V'},seed);
    assert.equal(d.parts.length,2,lab);
    const a1=checkNoteOpts(key,d.parts[0],lab+' 1');
    const a2=checkNoteOpts(key,d.parts[1],lab+' 2',{min:3});
    assert.equal(sp(a1),sp(key.natLT),lab); assert.equal(a1.acc,key.sig[a1.letter],lab+'：調号どおり');
    assert.equal(sp(a2),sp(key.lt),lab); assert.equal(a2.letter,a1.letter,lab+'：おなじ音名で上げる');
    assert.equal(pc(a2),mod(key.tpc-1,12),lab+'：主音のすぐ下');
    assert.ok(!d.parts[0].opts.some(o=>pc(o.note)===pc(key.lt)),lab+'：1つめに上げた音は出さない');
    got[PA.keyName(key)]=[PA.nm(a1),PA.nm(a2)];
  }
  Object.entries(want).forEach(([k,v])=>assert.deepEqual(got[k],v,k));
});

test('どの記号？（短調）：♯・♮・𝄪 から。こたえは導音の記号',()=>{
  const want={'イ短調':1,'ホ短調':1,'ハ短調':0,'ト短調':1,'ヘ短調':0,'嬰ヘ短調':1,'嬰ト短調':2,'嬰ニ短調':2,'変ホ短調':0};
  for(const k of KEYS.filter(k=>k.minor)) for(const ch of ['V','V7']){
    const key=keyOf(k), d=CQ.makeDrill('mark',{...k,chord:ch},7);
    assert.deepEqual(d.parts[0].opts.map(o=>o.acc),[...CQ.MARK3]);
    const a=d.parts[0].opts.filter(o=>o.ok).map(o=>o.acc);
    assert.deepEqual(a,[key.ltType],PA.keyName(key));
    assert.equal(key.lt.acc,key.ltType);
    if(want[PA.keyName(key)]!=null) assert.equal(key.ltType,want[PA.keyName(key)],PA.keyName(key));
  }
});

test('おなじ seed ならおなじもんだい（ひらきなおしてもつづきから）・こたえおわりのきまり',()=>{
  for(const cat of DRILLS) for(const k of [{minor:false,keyIdx:1},{minor:true,keyIdx:4}]){
    if(CQ.CATS.find(c=>c.id===cat).minor&&!k.minor) continue;
    const q={...k,chord:chordsFor(cat)[chordsFor(cat).length-1]};
    assert.deepEqual(plain(CQ.makeDrill(cat,q,12345)),plain(CQ.makeDrill(cat,q,12345)),cat);
  }
  assert.equal(CQ.makeDrill('keys',{minor:false,keyIdx:0,chord:'I'},1),null,'けんばんはべつ');
  const d={parts:[{opts:[{ok:false},{ok:true}]},{opts:[{ok:true},{ok:false}]}]};
  assert.equal(CQ.drillDone(d,[]),false);
  assert.equal(CQ.drillDone(d,[0]),true,'1つめをまちがえたらおわり'); assert.equal(CQ.drillOk(d,[0]),false);
  assert.equal(CQ.drillDone(d,[1]),false,'1つめがあっていたら2つめへ');
  assert.equal(CQ.drillDone(d,[1,0]),true); assert.equal(CQ.drillOk(d,[1,0]),true);
  assert.equal(CQ.drillOk(d,[1,1]),false);
});

// ページぜんぶを、DOM のかわりの入れもので動かす（ひらいたときにエラーにならない・リンクでひらくところ）
function openPage(search,mem=new Map()){
  const js=html.match(/<script>\n(\/\* 和音クイズ[\s\S]*?)<\/script>/)[1];
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){},querySelectorAll:function(){return [];}};};document.querySelector=function(){return null;};\n';
  const core=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
  const PA=loadPA(stub+core+'\nPA.paint=function(el,h,sig){if(sig!=="bar"){PA.__html=h;PA.__sig=sig;}};\n'+js+'\nPA.__Q=Q;PA.__run=function(){return RUN;};PA.__sess=function(){return sess;};PA.__choose=drillChoose;PA.__next=newQuestion;',{storage:mem,search});
  return PA;
}

test('ページ：keyset だけのリンクはステップのいちらん。cat・step のリンク。ひらきなおしてもおなじもんだい',()=>{
  let P=openPage('?keyset=minor');
  assert.equal(P.__Q.view,'steps'); assert.match(P.__html,/class="steps"/);
  assert.match(P.__html,/7ばんめの音/); assert.match(P.__html,/data-act="stepks" data-v="minor" aria-pressed="true"/);
  P=openPage('?keyset=major');
  assert.equal(P.__Q.view,'steps'); assert.ok(!/7ばんめの音/.test(P.__html),'長調のステップに短調だけのしゅるいはない');
  // まえのリンクはまえのまま
  P=openPage('?mode=keys&chord=V7');
  assert.equal(P.__Q.view,'quiz'); assert.equal(P.__Q.type,'keys'); assert.equal(P.__Q.q.chord,'V7');
  P=openPage('?keyset=minor&mode=choice');
  assert.equal(P.__Q.view,'quiz'); assert.equal(P.__Q.type,'choice'); assert.equal(P.__Q.q.minor,true);
  // しゅるいのリンク：短調だけのしゅるいは短調に
  const mem=new Map();
  P=openPage('?cat=mark&keyset=major',mem);
  assert.equal(P.__Q.type,'mark'); assert.equal(P.__Q.keyset,'minor'); assert.equal(P.__Q.q.minor,true);
  assert.match(P.__html,/につける記号は？/);
  const seed=P.__Q.dseed, q=JSON.stringify(P.__Q.q);
  // 「もどる」の読みなおし（おなじれきしのページ）ではないふつうのひらきなおし：リンクの1回はおわり（BASE にもどる）
  P=openPage('',mem);
  assert.equal(P.__Q.type,'keys');
  // ステップのリンク：そのステップの5もん
  const mem2=new Map();
  P=openPage('?keyset=minor&step=5',mem2);
  assert.equal(P.__Q.view,'quiz'); assert.equal(P.__Q.type,'mark'); assert.equal(P.__Q.tier,'normal');
  assert.equal(P.__run().step,'minor:mark-normal'); assert.equal(P.__sess().n(),5);
  assert.match(P.__html,/ステップ5（短調）/);
  const s2=P.__Q.dseed, q2=JSON.stringify(P.__Q.q);
  // ひらきなおし：おなじステップの回のつづき・おなじもんだい（おなじ seed）
  P=openPage('',mem2);
  assert.equal(P.__run()&&P.__run().step,'minor:mark-normal'); assert.equal(P.__Q.dseed,s2); assert.equal(JSON.stringify(P.__Q.q),q2);
  assert.ok(seed>0&&q);
});

test('ページ：ステップの5もんを4もんいじょうじぶんでできたら ✓（chord-quiz-steps にいちばんよかった数）',()=>{
  const mem=new Map();
  // ステップの5もんをとく（wrong＝まちがえる番号）
  const run=(wrong)=>{
    const P=openPage('?keyset=major&step=2',mem), Q=P.__Q;
    assert.equal(Q.type,'fill');
    // おわってすぐおなじステップのリンク：けっかのカード →「もういちど」
    if(P.__sess().finished()){assert.equal(Q.view,'summary');P.__sess().start(5);Q.view='quiz';P.__next();}
    for(let i=0;i<5;i++){
      const dr=Q.dr;
      dr.parts.forEach((p,j)=>{const k=p.opts.findIndex(o=>wrong.includes(i)?!o.ok:o.ok);P.__choose(j,k);});
      if(i<4) P.__next();
    }
    assert.equal(P.__sess().finished(),true);
    return P;
  };
  let P=run([0,3]); // 3もん
  assert.deepEqual(plain(P.store.get('chord-quiz-steps',null)),{'major:fill-easy':3},'3もんはまだ ✓ ではない');
  P=run([1]); // 4もん → ✓
  assert.deepEqual(plain(P.store.get('chord-quiz-steps',null)),{'major:fill-easy':4});
  P=run([0,1,2]); // わるくなっても、いちばんよかった数はそのまま
  assert.deepEqual(plain(P.store.get('chord-quiz-steps',null)),{'major:fill-easy':4});
  // きろくはしゅるいごと（まえからの chord-quiz にはまぜない）
  assert.ok(mem.has('pianoapps.keystats-chord-quiz-fill')); assert.ok(!mem.has('pianoapps.keystats-chord-quiz'));
  assert.ok(mem.has('pianoapps.session-chord-quiz-fill'));
});

test('ホーム：和音クイズのほかのしゅるいでといても ★★（その課題の調で）',()=>{
  const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const js=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){}};};document.querySelector=function(){return {};};\n';
  const core=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
  const mem=new Map([['pianoapps.visited',JSON.stringify({'chord-quiz':1})],['pianoapps.keystats-chord-quiz-root',JSON.stringify({m0:{right:1,wrong:0,hint:0,last:1,recent:'o'}})]]);
  const H=loadPA(stub+core+'\nPA.paint=function(el,h){PA.__html=h;};\n'+js,{storage:mem}).__html;
  const st=id=>(H.match(new RegExp(`<details class="stage [^"]*" data-d="stage-${id}"[\\s\\S]*?</details>`))||[''])[0];
  assert.match(st('minor'),/href="chord-quiz\.html\?keyset=minor"[\s\S]*?aria-label="ほし3こ中2こ"/,'短調でといた → ②は★★');
  assert.match(st('major'),/href="chord-quiz\.html\?keyset=major"[\s\S]*?aria-label="ほし3こ中1こ"/,'長調はまだ★');
});
