// 和音クイズ（chord-quiz.html）：⏱ 12の調をじゅんばんに（時間をはかる）と、🔄 がくふで転回形
// 調のじゅんとつづり・基本形のしらべかた・にせの時計でタイマーとベスト・電子ピアノのおさえたままの音・転回形のもんだい
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'chord-quiz.html'),'utf8');
const m=html.match(/\/\/ <cq-logic>[^\n]*\n([\s\S]*?)\/\/ <\/cq-logic>/);
const PA=loadPA(), mod=PA.mod;
const CQ=new Function('PA',m[1]+'\nreturn {CHORDS,CHORD_IDS,CATS,STEPS,STEP_N,chordTones,makeDrill,drillDone,drillOk,SHAPES,ROLES,CHROMA_IDS,CHROMA_CHORDS,chromaIds,chromaNew,chromaNow,chromaJudge,chromaAnswer,chromaElapsed,chromaMidiPick,chromaClock,chromaRec,chromaBest};')(PA);
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const plain=o=>JSON.parse(JSON.stringify(o));
const keyOfId=id=>{const p=PA.keyDeck.parse(id);return PA.keyOf(p.minor,p.idx,60);};
const nmOf=n=>{const s=PA.settings.naming;PA.settings.naming='solfa';const r=PA.nm(n);PA.settings.naming=s;return r;};
const names=ns=>ns.map(nmOf).join('');

test('12の調：先生のじゅん（半音ずつ上）。長調は嬰ヘ長調、短調は変ホ短調。変ト長調にもかえられる',()=>{
  const want={
    major:['ハ長調','変ニ長調','ニ長調','変ホ長調','ホ長調','ヘ長調','嬰ヘ長調','ト長調','変イ長調','イ長調','変ロ長調','ロ長調'],
    minor:['ハ短調','嬰ハ短調','ニ短調','変ホ短調','ホ短調','ヘ短調','嬰ヘ短調','ト短調','嬰ト短調','イ短調','変ロ短調','ロ短調']
  };
  for(const mode of ['major','minor']){
    const ids=CQ.chromaIds(mode,false);
    assert.equal(ids.length,12);
    assert.deepEqual(ids.map(id=>PA.keyName(keyOfId(id))),want[mode],mode);
    ids.forEach((id,i)=>{
      assert.equal(keyOfId(id).tpc,i,mode+' '+id+'：ハから半音ずつ上');
      assert.equal(PA.keyDeck.parse(id).minor,mode==='minor');
    });
  }
  const gb=CQ.chromaIds('major',true).map(id=>PA.keyName(keyOfId(id)));
  assert.equal(gb[6],'変ト長調'); assert.deepEqual(gb.filter((_,i)=>i!==6),want.major.filter((_,i)=>i!==6));
  assert.deepEqual(plain(CQ.chromaIds('minor',true)),plain(CQ.chromaIds('minor',false)),'短調は gb でかわらない');
  assert.deepEqual([...CQ.CHROMA_CHORDS],['I','IV','V','V7']);
});

test('12の調：Ⅰ・Ⅳ・Ⅴ・Ⅴ7 のつづり（ぜんぶの調）。短調のⅤ・Ⅴ7は7ばんめを上げる',()=>{
  const want={
    'ハ長調':['ドミソ','ファラド','ソシレ','ソシレファ'],
    '変ニ長調':['レ♭ファラ♭','ソ♭シ♭レ♭','ラ♭ドミ♭','ラ♭ドミ♭ソ♭'],
    '嬰ヘ長調':['ファ♯ラ♯ド♯','シレ♯ファ♯','ド♯ミ♯ソ♯','ド♯ミ♯ソ♯シ'],
    '変ト長調':['ソ♭シ♭レ♭','ド♭ミ♭ソ♭','レ♭ファラ♭','レ♭ファラ♭ド♭'],
    'ロ長調':['シレ♯ファ♯','ミソ♯シ','ファ♯ラ♯ド♯','ファ♯ラ♯ド♯ミ'],
    'ハ短調':['ドミ♭ソ','ファラ♭ド','ソシレ','ソシレファ'],
    '嬰ハ短調':['ド♯ミソ♯','ファ♯ラド♯','ソ♯シ♯レ♯','ソ♯シ♯レ♯ファ♯'],
    '変ホ短調':['ミ♭ソ♭シ♭','ラ♭ド♭ミ♭','シ♭レファ','シ♭レファラ♭'],
    '嬰ト短調':['ソ♯シレ♯','ド♯ミソ♯','レ♯ファ𝄪ラ♯','レ♯ファ𝄪ラ♯ド♯'],
    '変ロ短調':['シ♭レ♭ファ','ミ♭ソ♭シ♭','ファラド','ファラドミ♭']
  };
  const got={};
  for(const mode of ['major','minor']) for(const gb of [false,true]) for(const id of CQ.chromaIds(mode,gb)){
    const key=keyOfId(id), kn=PA.keyName(key);
    got[kn]=CQ.CHROMA_CHORDS.map(ch=>{
      const t=CQ.chordTones(key,ch);
      t.forEach((n,j)=>{
        assert.equal(n.letter,(key.l+CQ.CHORDS[ch].deg+2*j)%7,kn+ch+'：ひとつとばし');
        assert.equal(mod(n.midi,12),pc(n),kn+ch+'：高さとつづり');
        if(key.minor&&(CQ.CHORDS[ch].deg+2*j)%7===6) assert.equal(pc(n),mod(key.tpc-1,12),kn+ch+'：導音');
      });
      return names(t);
    });
  }
  Object.entries(want).forEach(([k,v])=>assert.deepEqual(got[k],v,k));
});

test('基本形のしらべかた：音がぴったりで、いちばん下が根音。オクターブ・かさねる音・ならべかたは自由',()=>{
  for(const mode of ['major','minor']) for(const id of CQ.chromaIds(mode,false)) for(const ch of CQ.CHORD_IDS){
    const key=keyOfId(id), t=CQ.chordTones(key,ch), ms=t.map(n=>n.midi), lab=PA.keyName(key)+ch;
    assert.equal(CQ.chromaJudge(key,ch,ms).ok,true,lab+'：そのまま');
    assert.equal(CQ.chromaJudge(key,ch,ms.map(x=>x-12)).ok,true,lab+'：1オクターブ下');
    // ひろげる・根音をかさねる（左手の根音＋右手の和音）
    assert.equal(CQ.chromaJudge(key,ch,[ms[0]-12,...ms.slice(1).map(x=>x+12),ms[0]+12]).ok,true,lab+'：ひろげて根音をかさねる');
    // 転回形：音はあっているが、いちばん下が根音でない
    for(let i=1;i<t.length;i++){
      const inv=ms.slice(i).concat(ms.slice(0,i).map(x=>x+12)), j=CQ.chromaJudge(key,ch,inv);
      assert.equal(j.notesOk,true,lab+'：音はあう'); assert.equal(j.rootOk,false,lab+'：基本形ではない'); assert.equal(j.ok,false,lab);
    }
    // 7ばんめを上げわすれた・ほかの和音・たりない
    const j2=CQ.chromaJudge(key,ch,ms.slice(0,-1));
    assert.equal(j2.ok,false); assert.equal(j2.missing.length,1); assert.equal(j2.count,t.length-1);
    const wrong=ms.map((x,i)=>i===1?x+1:x), j3=CQ.chromaJudge(key,ch,wrong);
    assert.equal(j3.ok,false); assert.equal(j3.extra.length,1); assert.equal(j3.missing.length,1);
  }
  // Ⅴ7 をⅤでひいた（3つ）は、4つそろうまでまつ
  const C=keyOfId('M0'), r=CQ.chromaNew('major');
  r.ci=3;
  assert.equal(CQ.chromaAnswer(r,[67,71,74],1000).v,'wait');
  assert.equal(r.misses,0);
});

test('タイマー（にせの時計）：じゅんばんに、まちがえたらおなじ和音をもういちど。おわったら時間が止まる',()=>{
  const r=CQ.chromaNew('minor');
  assert.equal(r.startAt,null); assert.equal(CQ.chromaElapsed(r,5000),0,'はじまるまえは0');
  r.startAt=1000; // ページは、1つめの和音が出てからきめる
  let now=1000;
  assert.deepEqual(plain(CQ.chromaNow(r)),{id:'m9',minor:true,keyIdx:9,chord:'I',n:1,of:12});
  // 1つめ（ハ短調のⅠ）をまちがえる：転回形
  const c=keyOfId('m9'), tI=CQ.CHROMA_CHORDS.map(ch=>CQ.chordTones(c,ch).map(n=>n.midi));
  now+=800;
  let res=CQ.chromaAnswer(r,[63,67,72],now);
  assert.equal(res.v,'miss'); assert.equal(res.j.notesOk,true); assert.equal(res.j.rootOk,false);
  assert.equal(r.misses,1); assert.equal(r.ci,0,'おなじ和音のまま');
  assert.deepEqual(plain(CQ.chromaAnswer(r,[60],now)).v,'wait','1つだけではまつ');
  let keys=[];
  for(let ki=0;ki<12;ki++){
    const cur0=CQ.chromaNow(r), key=keyOfId(cur0.id);
    assert.equal(cur0.n,ki+1);
    for(const ch of CQ.CHROMA_CHORDS){
      assert.equal(CQ.chromaNow(r).chord,ch);
      now+=1000;
      res=CQ.chromaAnswer(r,CQ.chordTones(key,ch).map(n=>n.midi),now);
      assert.equal(res.v,'ok');
      if(res.keyDone) keys.push(res.keyDone);
      assert.equal(res.finished,ki===11&&ch==='V7');
    }
  }
  assert.equal(keys.length,12);
  assert.deepEqual(keys.map(k=>k.ok),[false,...Array(11).fill(true)],'まちがえた調だけ ×');
  assert.deepEqual(keys.map(k=>k.id),[...CQ.CHROMA_IDS.minor]);
  assert.equal(CQ.chromaNow(r),null);
  assert.equal(r.endAt,now);
  assert.equal(CQ.chromaElapsed(r,now+99999),now-1000,'おわったら時間はとまる');
  assert.equal(CQ.chromaAnswer(r,tI[0],now+1).v,'idle','おわったあとは答えない');
  assert.equal(r.misses,1);
  // startAt をきめるまえにひいた：その時からはかる
  const r2=CQ.chromaNew('major');
  CQ.chromaAnswer(r2,[60,64,67],7000);
  assert.equal(r2.startAt,7000); assert.equal(CQ.chromaElapsed(r2,9500),2500);
});

test('時間のことば・ベスト（はやいほうをのこす）・ほぞんの形',()=>{
  assert.equal(CQ.chromaClock(0),'0:00.0'); assert.equal(CQ.chromaClock(83456),'1:23.4'); assert.equal(CQ.chromaClock(9999),'0:09.9'); assert.equal(CQ.chromaClock(600000),'10:00.0');
  const rec=CQ.chromaRec(null);
  assert.deepEqual(plain(rec),{best:{},gb:false});
  assert.equal(CQ.chromaBest(rec,'major',90000,2,1),true);
  assert.equal(CQ.chromaBest(rec,'major',95000,0,2),false,'おそい');
  assert.equal(CQ.chromaBest(rec,'major',90000,0,3),false,'おなじ時間はまえのまま');
  assert.equal(CQ.chromaBest(rec,'major',80000,4,4),true);
  assert.equal(CQ.chromaBest(rec,'minor',120000,1,5),true,'長調・短調はべつ');
  assert.equal(CQ.chromaBest(rec,'minor',0,0,6),false);
  assert.deepEqual(plain(rec.best),{major:{ms:80000,misses:4,at:4},minor:{ms:120000,misses:1,at:5}});
  // こわれたほぞんはすてる
  assert.deepEqual(plain(CQ.chromaRec({best:{major:{ms:'1'},minor:{ms:5000,misses:-1}},gb:'yes'})),{best:{},gb:false});
  assert.deepEqual(plain(CQ.chromaRec({best:{minor:{ms:5000,misses:0}},gb:true})),{best:{minor:{ms:5000,misses:0,at:0}},gb:true});
  assert.deepEqual(plain(CQ.chromaRec([1])),{best:{},gb:false});
});

test('電子ピアノ：まえの和音でおさえたままの音があっても ×にしない',()=>{
  const C=keyOfId('M0');
  const stale=[60,64,67]; // Ⅰをおさえたまま
  assert.deepEqual(plain(CQ.chromaMidiPick(C,'IV',[60,64,65,67,69],stale)),null,'新しい音（ファ・ラ）だけではまだそろわない → まつ');
  assert.deepEqual(plain(CQ.chromaMidiPick(C,'IV',[53,64,65,67,69,72],stale)),[53,65,69,72],'新しくおさえたファ・ラ・ドでぴったり');
  assert.deepEqual(plain(CQ.chromaMidiPick(C,'IV',[53,57,60],[60])),[53,57,60],'ぜんぶでぴったりならそのまま');
  assert.deepEqual(plain(CQ.chromaMidiPick(C,'IV',[60,64,67,71,74],stale)),null,'新しい音が2つ（シ・レ）→ まつ');
  assert.deepEqual(plain(CQ.chromaMidiPick(C,'IV',[60,64,67,62,71,77].sort((a,b)=>a-b),stale)),[62,71,77],'新しい音が3つでちがう → それでしらべる（×）');
  assert.deepEqual(plain(CQ.chromaMidiPick(C,'IV',[62,66,69],[])),[62,66,69]);
  assert.deepEqual(plain(CQ.chromaMidiPick(C,'IV',[60,64,67],stale)),null,'まえの音だけ');
});

test('がくふで転回形：いちばん下の音で形がきまる。五線にのる・こたえは1つ・ボタンのかさなりなし',()=>{
  const KEYS=[false,true].flatMap(minor=>[...Array(13).keys()].map(keyIdx=>({minor,keyIdx})));
  const seen={};
  for(const k of KEYS) for(const ch of CQ.CHORD_IDS) for(let s=1;s<=40;s++){
    const seed=s*7919, key=PA.keyOf(k.minor,k.keyIdx,60), t=CQ.chordTones(key,ch), lab=`${PA.keyName(key)} ${ch} ${seed}`;
    const d=CQ.makeDrill('inv',{...k,chord:ch},seed), v=d.voice;
    assert.ok(Number.isInteger(d.inv)&&d.inv>=0&&d.inv<t.length,lab);
    seen[ch+d.inv]=true;
    assert.equal(v.length,t.length,lab+'：音の数');
    // いちばん下は ROLES[inv]（根音・第3音・第5音・第7音）
    assert.equal(v[0].letter,t[d.inv].letter,lab+'：いちばん下の音名'); assert.equal(v[0].acc,t[d.inv].acc,lab+'：いちばん下の記号');
    // おなじ音（つづりも）・下から上へ・となりどうし（1オクターブの中）
    assert.deepEqual(v.map(n=>n.letter+':'+n.acc).sort(),t.map(n=>n.letter+':'+n.acc).sort(),lab+'：おなじ音');
    for(let i=1;i<v.length;i++) assert.ok(v[i].midi>v[i-1].midi,lab+'：下から上');
    assert.ok(v[v.length-1].midi-v[0].midi<12,lab+'：1オクターブの中');
    v.forEach(n=>{
      assert.equal(mod(n.midi,12),pc(n),lab+'：高さとつづり');
      const st=PA.stepOf(n);
      assert.ok(st>=29&&st<=41,lab+`：五線にのる（加線1本まで）${st}`);
      assert.ok(n.midi>=60&&n.midi<=88,lab+'：けんばんの中');
      if(n.raised) assert.ok(key.minor&&pc(n)===mod(key.tpc-1,12),lab+'：上げた7ばんめ');
    });
    assert.ok(PA.stepOf(v[0])<=35,lab+'：いちばん下はシ4まで');
    // 1つめ：和音（Ⅰ・Ⅳ・Ⅴ・Ⅴ7 から1つ）、2つめ：かたち（三和音は3つ、Ⅴ7は4つ）
    assert.equal(d.parts.length,2,lab);
    assert.deepEqual(d.parts[0].opts.map(o=>o.ch),[...CQ.CHORD_IDS],lab);
    assert.deepEqual(d.parts[0].opts.filter(o=>o.ok).map(o=>o.ch),[ch],lab);
    assert.deepEqual(d.parts[1].opts.map(o=>o.inv),[...Array(t.length).keys()],lab+'：かたちのボタン');
    assert.deepEqual(d.parts[1].opts.filter(o=>o.ok).map(o=>o.inv),[d.inv],lab+'：かたちのこたえ');
    // 和音の音（ピッチクラス）から、こたえの和音は1つだけ
    const set=new Set(v.map(pc));
    const match=CQ.CHORD_IDS.filter(x=>{const u=CQ.chordTones(key,x).map(pc);return u.length===set.size&&u.every(p=>set.has(p));});
    assert.deepEqual(match,[ch],lab+'：ほかの和音とおなじ音にならない');
    const i0=d.parts[1].opts.findIndex(o=>o.ok);
    assert.equal(CQ.drillOk(d,[CQ.CHORD_IDS.indexOf(ch),i0]),true);
    assert.equal(CQ.drillDone(d,[(CQ.CHORD_IDS.indexOf(ch)+1)%4]),true,'和音をまちがえたらおわり');
  }
  ['I0','I1','I2','IV0','IV1','IV2','V0','V1','V2','V70','V71','V72','V73'].forEach(x=>assert.ok(seen[x],'出るかたち：'+x));
  assert.deepEqual([...CQ.SHAPES],['基本形','第1転回形','第2転回形','第3転回形']);
  assert.deepEqual([...CQ.ROLES],['根音','第3音','第5音','第7音']);
  // ハ長調のⅠ第1転回形：ミ・ソ・ド（ミ4から）
  for(let s=1;s<200;s++){const d=CQ.makeDrill('inv',{minor:false,keyIdx:0,chord:'I'},s);if(d.inv===1){assert.deepEqual(d.voice.map(n=>n.midi),[64,67,72]);break;}}
});

test('ステップ：がくふで転回形は「がくふを見て」のあと、⏱ は長調・短調ともさいご',()=>{
  for(const ks of ['major','minor']){
    const ids=CQ.STEPS[ks].map(s=>s.id);
    assert.equal(ids.indexOf('inv-easy'),ids.indexOf('staff-easy')+1,ks);
    assert.equal(ids[ids.length-1],'chromatic-all',ks);
    assert.equal(ids.filter(x=>x.startsWith('chromatic')).length,1);
  }
  assert.equal(PA.STEP_INFO['chord-quiz'].major,13); assert.equal(PA.STEP_INFO['chord-quiz'].minor,15);
  CQ.CATS.forEach(c=>assert.ok(!/ /.test(c.name+c.desc),c.id+'：分かち書きをしない'));
});

// ページをひらく（クリック・けんばん・電子ピアノもうごかす）
function openPageUI(search,mem=new Map()){
  const js=html.match(/<script>\n(\/\* 和音クイズ[\s\S]*?)<\/script>/)[1];
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){},querySelectorAll:function(){return [];}};};document.querySelector=function(){return null;};\n';
  const core=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
  const P=loadPA(stub+core+'\nwindow.scrollTo=function(){};PA.paint=function(el,h,sig){if(sig!=="bar"){PA.__html=h;PA.__sig=sig;}else PA.__bar=h;};'
    +'document.addEventListener=function(t,f){if(t==="click")PA.__click=f;};\n'+js
    +'\nPA.__Q=Q;PA.__CR=CR;PA.__run=function(){return RUN;};PA.__cur=curStep;PA.__choose=drillChoose;PA.__render=render;',{storage:mem,search});
  P.click=(act,v)=>P.__click({target:{closest:()=>({dataset:{act,v},disabled:false})}});
  return P;
}
const tap=(P,ms)=>ms.forEach(x=>P.onKey(x));
// いまの和音をひく（ずらし＝転回形にする数）
function playNow(P,inv=0){
  const cur=CQ.chromaNow(P.__CR.run), key=PA.keyOf(cur.minor,cur.keyIdx,60), ms=CQ.chordTones(key,cur.chord).map(n=>n.midi);
  tap(P,ms.slice(inv).concat(ms.slice(0,inv).map(x=>x+12)));
}

test('ページ：⏱ スタート → けんばんで12の調 → けっか・ベスト・調ごとのきろく',()=>{
  const mem=new Map();
  const P=openPageUI('?cat=chromatic&keyset=minor',mem), CR=P.__CR;
  assert.equal(P.__Q.type,'chromatic'); assert.equal(CR.phase,'idle');
  assert.match(P.__html,/12の調をじゅんばんに/); assert.match(P.__html,/基本形/); assert.match(P.__bar,/data-act="crstart"/);
  assert.match(P.__html,/ハ短調[\s\S]*嬰ハ短調[\s\S]*変ホ短調[\s\S]*ロ短調/);
  P.click('crstart');
  assert.equal(CR.phase,'run'); assert.equal(CR.run.mode,'minor');
  assert.match(P.__html,/role="timer"/); assert.match(P.__html,/1／12/); assert.match(P.__html,/ハ短調/);
  // まちがい：転回形 → ×、おなじ和音のまま
  playNow(P,1);
  assert.equal(CR.run.misses,1); assert.ok(CR.wrong); assert.match(P.__html,/いちばん下を根音/);
  playNow(P); // つぎにおすと、まえの音はけしてから
  assert.equal(CR.run.ci,1); assert.equal(CR.wrong,null);
  for(let i=0;i<47;i++) playNow(P);
  assert.equal(CR.phase,'done');
  assert.match(P.__html,/ぜんぶおわり/); assert.match(P.__html,/じぶんのベスト/); assert.match(P.__html,/まちがい1回/);
  const rec=JSON.parse(mem.get('pianoapps.chord-quiz-chromatic'));
  assert.ok(Number.isInteger(rec.best.minor.ms)&&rec.best.minor.misses===1,'ベストをほぞん');
  const ks=JSON.parse(mem.get('pianoapps.keystats-chord-quiz-chromatic'));
  assert.equal(Object.keys(ks).length,12); assert.equal(ks.m9.wrong,1); assert.equal(ks.m4.right,1);
  assert.ok(!mem.has('pianoapps.session-chord-quiz-chromatic')||JSON.parse(mem.get('pianoapps.session-chord-quiz-chromatic'))==null,'5もんの回はつくらない');
  // もういちど・やめる
  P.click('crstart'); assert.equal(CR.phase,'run'); assert.equal(CR.run.misses,0);
  P.click('crstop'); assert.equal(CR.phase,'idle'); assert.equal(CR.run,null);
  // 長調にして、変ト長調をえらぶ
  P.click('crmode','major'); P.click('crgb','gb');
  assert.equal(JSON.parse(mem.get('pianoapps.chord-quiz-chromatic')).gb,true);
  assert.match(P.__html,/変ト長調/);
  P.click('crstart'); assert.equal(CR.run.ids[6],'M12');
  // ほかのしゅるいにうつったら、はかるのはおしまい
  P.click('qcat','keys'); assert.equal(CR.phase,'idle');
});

test('ページ：⏱ ステップ（長調13・短調15）。さいごまでひけたら ✓。電子ピアノでもこたえる',()=>{
  const mem=new Map();
  let P=openPageUI('?keyset=major&step=13',mem);
  assert.equal(P.__Q.type,'chromatic'); assert.equal(P.__cur().id,'chromatic-all');
  assert.match(P.__html,/ステップ13（長調）/); assert.ok(!/data-act="crmode"/.test(P.__html),'ステップのあいだは長調／短調をかえない');
  P.click('crstart');
  for(let i=0;i<48;i++){
    const cur=CQ.chromaNow(P.__CR.run), key=PA.keyOf(cur.minor,cur.keyIdx,60);
    P.onMidiChord(CQ.chordTones(key,cur.chord).map(n=>n.midi-12).concat([CQ.chordTones(key,cur.chord)[0].midi-24]).sort((a,b)=>a-b));
  }
  assert.equal(P.__CR.phase,'done'); assert.equal(P.__CR.result.misses,0);
  assert.deepEqual(JSON.parse(mem.get('pianoapps.chord-quiz-steps')),{'major:chromatic-all':CQ.STEP_N});
  assert.match(P.__html,/ステップ13「12の調をじゅんばんに」クリア/);
  // いちらん：⏱ のステップにベスト
  P.click('steps');
  assert.match(P.__html,/12の調をじゅんばんに[\s\S]*ベスト\d+:\d\d\.\d/);
  // 短調のステップは15
  P=openPageUI('?keyset=minor&step=15',new Map());
  assert.equal(P.__cur().id,'chromatic-all'); assert.equal(P.__Q.type,'chromatic');
  P=openPageUI('?keyset=minor&step=10',new Map());
  assert.equal(P.__cur().id,'inv-easy'); assert.equal(P.__Q.type,'inv');
});

test('ページ：がくふで転回形。1つめ（和音）→ 2つめ（かたち）。まちがえたら、いちばん下の音のわけ',()=>{
  let ok=0;
  for(let tries=0;tries<60&&ok<6;tries++){
    const P=openPageUI('?cat=inv&keyset='+(tries%2?'minor':'major')), Q=P.__Q, dr=Q.dr;
    assert.equal(dr.cat,'inv');
    assert.match(P.__html,/この和音は？かたちは？/);
    P.__choose(0,dr.parts[0].opts.findIndex(o=>o.ok)); P.__render();
    assert.match(P.__html,/つぎは、かたち/); assert.match(P.__html,/いちばん下の音が根音なら基本形/);
    const wrong=dr.parts[1].opts.findIndex(o=>!o.ok);
    P.__choose(1,wrong); P.__render();
    assert.match(P.__html,new RegExp(CQ.ROLES[dr.inv]+'だから'+CQ.SHAPES[dr.inv]));
    assert.match(P.__html,/いちばん下は/);
    ok++;
  }
  assert.ok(ok>0);
  // 和音をまちがえた：いちばん下の音が根音とはかぎらない
  const want={0:/基本形なので、いちばん下の音が根音/,1:/いちばん下の音が根音とはかぎらない/};
  const got=new Set();
  for(let tries=0;tries<80&&got.size<2;tries++){
    const P=openPageUI('?cat=inv'), dr=P.__Q.dr, k=dr.inv?1:0;
    const i=dr.parts[0].opts.findIndex(o=>!o.ok&&CQ.CHORDS[o.ch].deg!==CQ.CHORDS[P.__Q.q.chord].deg);
    P.__choose(0,i); P.__render();
    assert.match(P.__html,want[k]); got.add(k);
  }
  assert.equal(got.size,2);
});
