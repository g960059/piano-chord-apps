// 異名同音の読みかえ：増六が入る問題は「🔥 チャレンジ」としてわける（先生の意見：docs/TEACHER-FEEDBACK.md 2026-10-31 追加の意見）
// ・enharmonic.html：ふつうの読みかえ（🎲 どこへ行った？・ためしてみる）は減七だけ。増六（ドイツの6）の問題はチャレンジのカードの中だけ
// ・chroma-quiz.html：読みかえの和音（減七/Ⅴ・Ⅶ7）とドイツの6だけを出すとき（chord=ger、まえの ger,ddim,vii7）は 🔥 チャレンジのしるし。
//   ステップ5（増六）・6（ぜんぶ）ではしるしを出さない
// ・レベルアップの順番：Ⅱ7・ドッペル → 副属和音 → 準固有和音 → ナポリの六 → 増六 → 異名同音の読みかえ（いちばん最後）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const scriptOf=html=>[...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const screenOf=html=>html.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'');
const plain=h=>h.replace(/<[^>]+>/g,'');
const STUB='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){},querySelectorAll:function(){return [];},style:{}};};document.querySelector=function(){return null;};\n';

/* ===== chroma-quiz.html ===== */
const cq=read('chroma-quiz.html');
const L=(()=>{
  const m=cq.match(/\/\/ <cq-link>[^\n]*\n([\s\S]*?)\/\/ <\/cq-link>/);
  return new Function('PA',m[1]+'\nreturn {TYPES,KLV,READ_SET,CHAL,chalOf,linkOf};')(loadPA());
})();
const levelOf=sel=>(L.KLV.find(x=>x.types.length===sel.length&&sel.every(t=>x.types.includes(t)))||{lv:0}).lv;
const chalSel=sel=>L.chalOf('ger',levelOf(sel),sel);

test('変化和音クイズ：🔥 チャレンジになるのは、読みかえの和音といっしょに出すドイツの6だけ',()=>{
  assert.deepEqual([...L.READ_SET],['ddim','vii7']);
  assert.deepEqual([...L.CHAL],['ger']);
  assert.equal(chalSel(['ger']),true,'enharmonic の 🔥 チャレンジのリンク（chord=ger）');
  assert.equal(chalSel(['ddim','ger','vii7']),true,'まえのリンク chord=ger,ddim,vii7 もドイツの6はそのまま出して、しるしをつける');
  assert.equal(chalSel(['ger','vii7']),true);
  assert.equal(chalSel(['it','fr','ger']),false,'ステップ5（増六）はふつうの増六の問題');
  assert.equal(chalSel([...L.TYPES]),false,'ステップ6（ぜんぶ）もしるしなし');
  assert.equal(chalSel(['ii7','ger']),false,'読みかえとかんけいない和音といっしょならしるしなし');
  assert.equal(L.chalOf('vii7',0,['ger','vii7']),false,'減七の問題はふつうの読みかえ');
  assert.equal(L.chalOf('ddim',0,['ddim','ger']),false);
  assert.equal(L.chalOf('ger',0,['vii7']),false,'えらんでいない和音にはつけない');
  // まえのリンクの和音はかわらない（ドイツの6も出る）
  const lk=L.linkOf(loadPA().parseParams('?chord=ger,ddim,vii7&key=m0&n=5'),['easy','normal','hard','all']);
  assert.deepEqual([...lk.types],['ddim','ger','vii7']);
});

test('変化和音クイズ：ステップの名前とならびは先生のじゅん（異名同音の読みかえはいちばん最後）',()=>{
  assert.deepEqual(L.KLV.map(x=>x.name),['Ⅱ7・ドッペル','副属和音','準固有','ナポリ','増六','ぜんぶ']);
  assert.match(L.KLV[5].desc,/ステップ1〜5と、異名同音の読みかえで出てくるⅦ7/);
  assert.match(cq,/Ⅱ7・ドッペル → 副属和音 → 準固有和音 → ナポリの六 → 増六 → 異名同音/);
});

// ページをひらく（変化和音クイズ）
function openQuiz(search,mem=new Map()){
  const js=cq.match(/<script>\n(\/\* 変化和音クイズ[\s\S]*?)<\/script>/)[1];
  const core=read('assets/core.js');
  return loadPA(STUB+core+'\nwindow.scrollTo=function(){};window.innerHeight=800;PA.paint=function(el,h,sig){if(sig!=="bar")PA.__html=h;};'
    +'document.addEventListener=function(){};\n'+js+'\nPA.__Q=Q;PA.__start=startQ;PA.__render=render;PA.__check=checkKeys;',{storage:mem,search,href:'https://example.test/chroma-quiz.html'+search});
}

test('変化和音クイズのページ：chord=ger（読みかえの 🔥 チャレンジ）では、ドイツの6の問題にチャレンジのしるし',()=>{
  const P=openQuiz('?key=m0&mode=keys&chord=ger&n=5'), Q=P.__Q;
  assert.equal(Q.q.type,'ger'); assert.equal(Q.kLv,0);
  assert.match(P.__html,/class="challine"[^]*チャレンジ[^]*増六に読みかえる問題/);
  assert.match(P.__html,/ドイツ（<span aria-hidden="true">🔥<\/span>チャレンジ）/,'じぶんで選ぶの説明にも');
  // こたえたあとの「けんばんではⅤ7と同じ音」にも 🔥 チャレンジ
  const key=PA_keyOf(P,Q.q); P.__Q.picked=new Set(P.chroma.aug6(key,'ger').map(n=>n.midi)); P.__check(); P.__render();
  assert.match(P.__html,/🎉 正解/); assert.match(P.__html,/チャレンジ：読みかえ<\/span> けんばんでは/);
});
const PA_keyOf=(P,q)=>P.keyOf(q.minor,q.keyIdx);

test('変化和音クイズのページ：まえのリンク chord=ger,ddim,vii7 もドイツの6を出して、しるしをつける。減七にはつけない',()=>{
  const P=openQuiz('?key=m0&mode=keys&chord=ger,ddim,vii7&n=5'), Q=P.__Q;
  assert.deepEqual(Object.keys(Q.types).filter(t=>Q.types[t]),['ddim','ger','vii7']);
  P.__start({minor:true,keyIdx:0,type:'ger'}); P.__render();
  assert.match(P.__html,/class="challine"/);
  P.__start({minor:true,keyIdx:0,type:'vii7'}); P.__render();
  assert.ok(!/class="challine"/.test(P.__html),'減七（ふつうの読みかえ）にはしるしなし');
});

test('変化和音クイズのページ：ステップ5（増六）・6（ぜんぶ）のドイツの6はふつうの問題（しるしなし）',()=>{
  for(const step of [5,6]){
    const P=openQuiz(`?key=m0&mode=keys&step=${step}&n=5`);
    P.__start({minor:true,keyIdx:0,type:'ger'}); P.__render();
    assert.ok(!/class="challine"/.test(P.__html),'ステップ'+step);
  }
});

/* ===== enharmonic.html ===== */
const en=read('enharmonic.html'), enJs=scriptOf(en);
function openEnh(mem=new Map()){
  const P=loadPA(STUB+read('assets/core.js')+'\nwindow.scrollTo=function(){};PA.paint=function(el,h,sig){if(sig!=="bar")PA.__html=h;};'
    +'document.addEventListener=function(t,f){if(t==="click")PA.__click=f;};\n'+enJs+'\nPA.__state=state;PA.__gerSet=gerSet;',{storage:mem,href:'https://example.test/enharmonic.html'});
  P.click=(act,v)=>P.__click({target:{closest:s=>s==='[data-act]'?{dataset:{act,v}}:null}});
  return P;
}

test('異名同音の読みかえ：ふつうの読みかえ（ためしてみる・🎲 どこへ行った？）に増六は入れない',()=>{
  assert.doesNotThrow(()=>new Function(enJs),'文法');
  assert.ok(!/\?\.|\?\?/.test(enJs),'?. ?? をつかわない');
  const P=openEnh(), h=P.__html;
  const i=h.indexOf('id="ger"');
  assert.ok(i>0,'🔥 チャレンジのカードがある');
  const before=plain(h.slice(0,i));
  assert.ok(!/増六|ドイツ/.test(before),'チャレンジのカードより前に増六・ドイツの6は出ない');
  // ためしてみる：Ⅶ7（減七）だけ。ステップ5（増六）へのリンクはない
  const tm=/PA\.tryHTML\(\{to:'chroma-quiz',params:\{([^}]*)\}[^;]*;/.exec(enJs);
  assert.ok(tm); assert.match(tm[1],/chord:'vii7'/); assert.ok(!/step:5|ger/.test(tm[0]));
  // 🎲 どこへ行った？：こたえは4つの短調（減七の読みかた）だけ
  P.click('qnext');
  assert.match(P.__html,/どの調へ行った？/);
  const choices=[...P.__html.matchAll(/data-act="qchoose" data-v="(\d+)"/g)].map(m=>+m[1]);
  assert.equal(choices.length,4);
  assert.ok(P.__state.quiz&&choices.includes(P.__state.quiz.ans));
});

test('異名同音の読みかえ：増六に読みかえるのは「🔥 チャレンジ」のカード（つぎのレベル）',()=>{
  const P=openEnh(), h=P.__html;
  const card=h.slice(h.indexOf('<details class="card fold chal" id="ger" data-d="ger">'));
  assert.ok(card.length<h.length,'data-d="ger" はそのまま（ひらいたかのきろく）');
  assert.match(card,/<span class="chalbadge"><span aria-hidden="true">🔥<\/span> チャレンジ<\/span>増六に読みかえる<small>つぎのレベル。増六の和音をならったら挑戦しよう<\/small>/);
  assert.match(card,/チャレンジ問題：どっちに読んだ？/);
  // ドイツの6をけんばんで5問（変化和音クイズの chord=ger。クイズでもチャレンジのしるし）
  assert.match(card,/href="chroma-quiz\.html\?key=m0&amp;mode=keys&amp;chord=ger&amp;n=5"/);
});

test('異名同音の読みかえ：🔥 チャレンジ問題（ドイツの6 → Ⅰ6/4 → Ⅴ か、Ⅴ7/♭Ⅱ → ♭Ⅱ か）',()=>{
  const P=openEnh(), S=P.__state;
  P.click('gqnext');
  assert.ok(S.gq&&['ger','v7'].includes(S.gq.ans)); assert.equal(S.gq.pick,null);
  assert.match(P.__html,/data-act="gqchoose" data-v="ger"[^>]*>ドイツの6/);
  assert.match(P.__html,/data-act="gqchoose" data-v="v7"[^>]*>[^<]*（Ⅴ7\/♭Ⅱ）/);
  // ちがう答え → おしい・せいかいは0
  const wrong=S.gq.ans==='ger'?'v7':'ger';
  P.click('gqchoose',wrong);
  assert.equal(S.gN,1); assert.equal(S.gOk,0);
  assert.match(P.__html,/🤔 おしい！/);
  P.click('gqchoose',S.gq.ans); assert.equal(S.gN,1,'こたえたあとはもうかぞえない');
  P.click('gqchoose','x');
  // つぎの問題 → せいかい
  for(let i=0;i<20;i++){
    P.click('gqnext'); const a=S.gq.ans; P.click('gqchoose',a);
    assert.match(P.__html,/🎉 そのとおり！/);
    assert.match(plain(P.__html),a==='ger'?/Ⅴへの導音。半音上へすすんで/:/第7音。半音下へすすんで/);
  }
  assert.equal(S.gN,21); assert.equal(S.gOk,20);
  assert.match(P.__html,/20 \/ 21問正解/);
  // 調がかわったら問題はおしまい
  P.click('gqnext'); P.click('pick',String(P.__state.keyIdx===0?[...Array(P.keyCount(true)).keys()].find(i=>i>0&&P.mod(P.minorKey(i).lt.midi,3)===P.__state.fam):0));
  assert.equal(S.gq,null);
});

test('異名同音の読みかえ：チャレンジ問題の音（ドイツの6とⅤ7/♭Ⅱは同じけんばん、すすむ先だけがちがう）',()=>{
  const P=openEnh();
  for(let i=0;i<P.keyCount(true);i++){
    P.__state.keyIdx=i;
    const g=P.__gerSet(P.minorKey(i)), lab=P.keyName(P.minorKey(i));
    assert.deepEqual(g.ger.map(n=>n.midi),g.v7.map(n=>n.midi),lab+'：同じけんばん');
    const pc=n=>P.mod(P.NAT[n.letter]+n.acc,12);
    assert.deepEqual(g.ger.map(pc),g.v7.map(pc),lab);
    // ドイツの6の上の音（♯4）は半音上へ（Ⅰ6/4）、Ⅴ7/♭Ⅱの第7音（♭5）は半音下へ（♭Ⅱ）
    const d=g.diff;
    assert.equal(g.gerRes[0][d].midi-g.ger[d].midi,1,lab+'：導音は半音上');
    assert.equal(g.v7Res[d].midi-g.v7[d].midi,-1,lab+'：第7音は半音下');
    // 書きかたはちがう（異名同音）。ふつうは♯4と♭5。ド♭などになる調（plain）はⅤ7/♭Ⅱをけんばんのふつうの名前で書くので、ほかの音の名前がちがう
    if(!g.plain) assert.notEqual(g.ger[d].letter,g.v7[d].letter,lab+'：♯4と♭5');
    assert.ok(g.ger.some((n,j)=>n.letter!==g.v7[j].letter||n.acc!==g.v7[j].acc),lab+'：ちがう名前');
  }
});

/* ===== レベルアップの順番（ほかのページの文） ===== */
test('レベルアップの順番：地図・ページの「次は」も先生のじゅん（異名同音の読みかえはいちばん最後）',()=>{
  const PA=loadPA();
  assert.deepEqual(JSON.parse(JSON.stringify(PA.unit('extra').tasks.map(t=>t.app))),['doppel','secondary','borrowed','neapolitan','aug6','enharmonic','chroma-quiz']);
  const dp=screenOf(read('doppel.html'));
  assert.ok(!/次は増六/.test(dp),'ドッペルのつぎは副属和音（増六ではない）');
  assert.match(dp,/href="secondary\.html" data-go="secondary"><span aria-hidden="true">🧭<\/span> <span>次は副属和音/);
  assert.match(scriptOf(read('doppel.html')),/PA\.store\.set\('secondary',\{minor:state\.minor,keyIdx:state\.keyIdx,target:5,kind:'V7'\}\)/);
  const a6=read('aug6.html');
  assert.match(a6,/data-v="enharmonic"><span aria-hidden="true">🔀<\/span> 次は異名同音の読みかえ/);
  assert.match(a6,/<span class="chalbadge"><span aria-hidden="true">🔥<\/span> チャレンジ<\/span>けんばんでは/,'増六のページの読みかえもチャレンジのしるし');
  assert.doesNotThrow(()=>new Function(scriptOf(a6)));
  // どのページの画面にも「♭Ⅵ」「Ⅳm」で準固有を書かない（この変更でふやしていない）
  for(const f of ['enharmonic.html','chroma-quiz.html','aug6.html','doppel.html']) assert.ok(!/♭Ⅵ|Ⅳm/.test(screenOf(read(f))),f);
});
