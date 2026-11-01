// 異名同音の読みかえ：増六が入る問題は「🔥 チャレンジ」としてわける（先生の意見：docs/TEACHER-FEEDBACK.md 2026-10-31 追加の意見）
// ・enharmonic.html：ふつうの読みかえ（🎲 どこへ行った？・ためしてみる）は減七だけ。増六（ドイツの6）の問題はチャレンジのカードの中だけ
// ・chroma-quiz.html：読みかえのチャレンジから来たとき（chord=ger&chal=1）と、読みかえの和音（減七/Ⅴ・Ⅶ7）もいっしょに出すとき
//   （まえの ger,ddim,vii7）のドイツの6に 🔥 チャレンジのしるし。🎛 でドイツだけを選んだとき・ステップ5（増六）・6（ぜんぶ）では出さない
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
  return new Function('PA',m[1]+'\nreturn {TYPES,KLV,KLV_VIEW,stepNo,READ_SET,CHAL,chalOf,linkOf};')(loadPA());
})();
const levelOf=sel=>(L.KLV.find(x=>x.types.length===sel.length&&sel.every(t=>x.types.includes(t)))||{lv:0}).lv;
const chalSel=(sel,fromChal)=>L.chalOf('ger',levelOf(sel),sel,fromChal);

test('変化和音クイズ：🔥 チャレンジになるのは、読みかえの和音といっしょに出すドイツの6だけ',()=>{
  assert.deepEqual([...L.READ_SET],['ddim','vii7']);
  assert.deepEqual([...L.CHAL],['ger']);
  assert.equal(chalSel(['ger'],true),true,'enharmonic の 🔥 チャレンジのリンク（chord=ger&chal=1）');
  assert.equal(chalSel(['ger'],false),false,'🎛 でドイツだけを選んで増六の練習をするときはしるしなし');
  assert.equal(chalSel(['ger']),false);
  assert.equal(chalSel(['ddim','ger','vii7']),true,'まえのリンク chord=ger,ddim,vii7 もドイツの6はそのまま出して、しるしをつける');
  assert.equal(chalSel(['ger','vii7']),true);
  assert.equal(chalSel(['it','fr','ger']),false,'ステップ5（増六）はふつうの増六の問題');
  assert.equal(chalSel([...L.TYPES]),false,'ステップ6（ぜんぶ）もしるしなし');
  assert.equal(chalSel(['ii7','ger']),false,'読みかえとかんけいない和音といっしょならしるしなし');
  assert.equal(chalSel(['ii7','ger'],true),false);
  assert.equal(chalSel(['it','fr','ger'],true),false);
  assert.equal(L.chalOf('vii7',0,['ger','vii7']),false,'減七の問題はふつうの読みかえ');
  assert.equal(L.chalOf('ddim',0,['ddim','ger']),false);
  assert.equal(L.chalOf('ger',0,['vii7']),false,'えらんでいない和音にはつけない');
  // まえのリンクの和音はかわらない（ドイツの6も出る）
  const lk=L.linkOf(loadPA().parseParams('?chord=ger,ddim,vii7&key=m0&n=5'),['easy','normal','hard','all']);
  assert.deepEqual([...lk.types],['ddim','ger','vii7']);
});

test('変化和音クイズ：ステップの名前とならびは先生のじゅん（異名同音の読みかえはいちばん最後）',()=>{
  // KLV は lv（リンクの step）のじゅん。ドリアのⅣ（lv 7）はあとから足したので、画面では KLV_VIEW のじゅん（ナポリのつぎ）で番号もそのじゅん
  assert.deepEqual(L.KLV.map(x=>x.name),['Ⅱ7・ドッペル','副属和音','準固有','ナポリ','増六','ぜんぶ','ドリア']);
  assert.deepEqual(L.KLV_VIEW.map(lv=>L.KLV[lv-1].name),['Ⅱ7・ドッペル','副属和音','準固有','ナポリ','ドリア','増六','ぜんぶ']);
  assert.deepEqual(L.KLV_VIEW.map(L.stepNo),[1,2,3,4,5,6,7]);
  assert.match(L.KLV[5].desc,/ほかのステップの和音ぜんぶと、異名同音の読みかえで出てくるⅤ9の根音省略/);
  assert.match(cq,/Ⅱ7・ドッペル → 副属和音 → 準固有和音 → ナポリの六 → ドリアのⅣ → 増六 → 異名同音/);
  // 💡 のメモと「くわしくは」のリンクも、ナポリの六のつぎにドリアのⅣ
  const tips=cq.slice(cq.indexOf('function tipsHTML'));
  assert.ok(tips.indexOf('<b>ナポリの六</b>')>0&&tips.indexOf('<b>ナポリの六</b>')<tips.indexOf('<b>ドリアのⅣ</b>')&&tips.indexOf('<b>ドリアのⅣ</b>')<tips.indexOf('<b>増六の和音</b>'),'💡 のメモのじゅん');
  const more=['borrowed','neapolitan','dorian','aug6','enharmonic'].map(id=>tips.indexOf(`href="${id}.html"`));
  assert.ok(more.every((v,i)=>v>0&&(i===0||v>more[i-1])),'くわしくは：'+more);
});

// ページをひらく（変化和音クイズ）
function openQuiz(search,mem=new Map()){
  const js=cq.match(/<script>\n(\/\* 変化和音クイズ[\s\S]*?)<\/script>/)[1];
  const core=read('assets/core.js');
  return loadPA(STUB+core+'\nwindow.scrollTo=function(){};window.innerHeight=800;PA.paint=function(el,h,sig){if(sig!=="bar")PA.__html=h;};'
    +'document.addEventListener=function(){};\n'+js+'\nPA.__Q=Q;PA.__start=startQ;PA.__render=render;PA.__check=checkKeys;',{storage:mem,search,href:'https://example.test/chroma-quiz.html'+search});
}

test('変化和音クイズのページ：chord=ger&chal=1（読みかえの 🔥 チャレンジ）では、ドイツの6の問題にチャレンジのしるし',()=>{
  const P=openQuiz('?key=m0&mode=keys&chord=ger&chal=1&n=5'), Q=P.__Q;
  assert.equal(Q.q.type,'ger'); assert.equal(Q.kLv,0); assert.equal(Q.chal,true);
  // このもんだいはけんばんでおさえるだけ：「読みかえる問題」とは言わない
  assert.match(P.__html,/class="challine"[^]*チャレンジ[^]*読みかえのチャレンジで出るドイツの6。けんばんではⅤ7と同じ音になる和音だよ/);
  assert.ok(!/増六に読みかえる問題/.test(P.__html));
  assert.match(P.__html,/ドイツ（<span aria-hidden="true">🔥<\/span>チャレンジ）/,'じぶんで選ぶの説明にも');
  // こたえたあとの「けんばんではⅤ7と同じ音」にも 🔥 チャレンジ
  const key=PA_keyOf(P,Q.q); P.__Q.picked=new Set(P.chroma.aug6(key,'ger').map(n=>n.midi)); P.__check(); P.__render();
  assert.match(P.__html,/🎉 正解/); assert.match(P.__html,/チャレンジ：読みかえ<\/span> けんばんでは/);
});
const PA_keyOf=(P,q)=>P.keyOf(q.minor,q.keyIdx);

test('変化和音クイズのページ：chal のない chord=ger（🎛 でドイツだけ・ふつうのリンク）はしるしなし。ステップをかえるとチャレンジはおしまい',()=>{
  const P=openQuiz('?key=m0&mode=keys&chord=ger&n=5'), Q=P.__Q;
  assert.equal(Q.q.type,'ger'); assert.equal(Q.chal,false);
  assert.ok(!/class="challine"/.test(P.__html));
  assert.ok(!/チャレンジ/.test(P.__html.replace(/<[^>]+>/g,'').split('じぶんで選ぶ：')[1].split('（下の')[0]),'じぶんで選ぶの説明にもつけない');
  // 保存はしない：おなじ設定でひらきなおしたら（リンクなし）しるしなし
  const mem=new Map(), P2=openQuiz('?key=m0&mode=keys&chord=ger&chal=1&n=5',mem);
  assert.match(P2.__html,/class="challine"/);
  assert.ok(![...mem.values()].some(v=>/"chal"/.test(v)),'chal は保存しない');
});

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
  // ドイツの6をけんばんで5問（変化和音クイズの chord=ger&chal=1。クイズでもチャレンジのしるし）
  assert.match(card,/href="chroma-quiz\.html\?key=m0&amp;mode=keys&amp;chord=ger&amp;chal=1&amp;n=5"/);
  // 子どもが見ることばは「ナポリの和音」（♭Ⅱ は出さない。先生：♭のついた記号はコードネームのよう）
  assert.ok(!/♭Ⅱ/.test(plain(card)),'チャレンジのカードに ♭Ⅱ を出さない');
  assert.match(card,/ドイツの6と、ナポリの和音のためのⅤ7/);
});

test('異名同音の読みかえ：🔥 チャレンジ問題（ドイツの6 → Ⅰ6/4 → Ⅴ か、Ⅴ7/♭Ⅱ → ♭Ⅱ か）',()=>{
  const P=openEnh(), S=P.__state;
  P.click('gqnext');
  assert.ok(S.gq&&['ger','v7'].includes(S.gq.ans)); assert.equal(S.gq.pick,null);
  assert.match(P.__html,/data-act="gqchoose" data-v="ger"[^>]*>ドイツの6/);
  assert.match(P.__html,/data-act="gqchoose" data-v="v7"[^>]*>[^<]*（ナポリの和音のためのⅤ7）<small>→ [^<]*（ナポリの和音）/);
  assert.match(P.__html,/data-act="gqchoose" data-v="ger"[^>]*>ドイツの6<small>→ <span class="rnum" role="img" aria-label="Ⅰ、第2転回形">/);
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
    assert.match(plain(P.__html),a==='ger'?/Ⅴへの導音。半音上へすすんで、Ⅰ?2?へ行ったね。このあとⅤへすすむよ/:/第7音。半音下へすすんで、ナポリの和音の/);
  }
  assert.equal(S.gN,21); assert.equal(S.gOk,20);
  assert.match(P.__html,/20 \/ 21問正解/);
  // 調がかわったら問題はおしまい
  P.click('gqnext'); P.click('pick',String(P.__state.keyIdx===0?[...Array(P.keyCount(true)).keys()].find(i=>i>0&&P.mod(P.minorKey(i).lt.midi,3)===P.__state.fam):0));
  assert.equal(S.gq,null);
});

test('異名同音の読みかえ：チャレンジ問題で鳴る和音の数はどちらも同じ（数で答えがわからない）。こたえたあとはさいごまで',()=>{
  const src=en.match(/const gqSeq=[^\n]*/)[0];
  const P=openEnh(), gqSeq=new Function(src+'\nreturn gqSeq;')();
  for(let i=0;i<P.keyCount(true);i++){
    const g=P.__gerSet(P.minorKey(i)), lab=P.keyName(P.minorKey(i));
    const a=gqSeq(g,'ger',false), b=gqSeq(g,'v7',false);
    assert.equal(a.length,b.length,lab+'：問題ではおなじ数');
    assert.equal(a.length,2,lab);
    assert.deepEqual(a[0].map(n=>n.midi),b[0].map(n=>n.midi),lab+'：1つめはおなじけんばん');
    assert.equal(a[1],g.gerRes[0],lab+'：ドイツの6 → Ⅰ6/4'); assert.equal(b[1],g.v7Res,lab+'：Ⅴ7 → ナポリの和音');
    // こたえたあと：ドイツの6はⅤまで
    const fa=gqSeq(g,'ger',true);
    assert.equal(fa.length,3); assert.equal(fa[2],g.gerRes[1]);
  }
  // gqPlay は gqSeq をつかい、こたえたあと（pick がある）はさいごまで。こたえたら鳴らす
  assert.match(enJs,/const seq=gqSeq\(gerSet\(curKey\(\)\),Q\.ans,Q\.pick!=null\);/);
  assert.match(enJs,/state\.gN\+\+; if\(v===Q\.ans\) state\.gOk\+\+; render\(\);\n\s*gqPlay\(\);/);
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
  assert.deepEqual(JSON.parse(JSON.stringify(PA.unit('extra').tasks.map(t=>t.app))),['doppel','secondary','borrowed','neapolitan','dorian','aug6','enharmonic','chroma-quiz']);
  const dp=screenOf(read('doppel.html'));
  assert.ok(!/次は増六/.test(dp),'ドッペルのつぎは副属和音（増六ではない）');
  assert.match(dp,/href="secondary\.html" data-go="secondary"><span aria-hidden="true">🧭<\/span> <span>次は副属和音/);
  assert.match(scriptOf(read('doppel.html')),/PA\.store\.set\('secondary',\{minor:state\.minor,keyIdx:state\.keyIdx,target:5,kind:'V7'\}\)/);
  // 副属和音 → 次は準固有和音（どの目標でも）、準固有 → 次はナポリの六、ナポリ → 次はドリアのⅣ、ドリア → 次は増六（2026-11-01（4）先生がきめた）
  const sc=read('secondary.html');
  assert.match(sc,/<a class="btn" href="borrowed\.html" data-go="borrowed"><span aria-hidden="true">🎁<\/span> <span>次は準固有和音 ›<small>同じ主音の短調からかりる\$\{PA\.rn\(\{deg:4,borrowed:true\}\)\}・\$\{PA\.rn\(\{deg:6,borrowed:true\}\)\}<\/small><\/span><\/a>/);
  assert.ok(!/if\(I\.t===5\) return '';/.test(sc),'目標がⅤのときもつながるアプリを出す');
  assert.match(scriptOf(sc),/g\.dataset\.go==='borrowed'&&!state\.minor/);
  assert.doesNotThrow(()=>new Function(scriptOf(sc)));
  // 「長調の形」だけでは何の形かわからない：長調のⅤ9の根音省略だとそえる（「半減七」は出さない）
  assert.match(sc,/には長調の形（長調のⅤ9の根音省略）は使わないよ（\$\{I\.tmin\?'目標が短三和音':'長調のⅤ9の第9音がこの調にない音'\}だから）/);
  assert.match(sc,/のⅤ9の根音省略は減七にならない（長調の形）ので/);
  assert.match(sc,/k==='vii7'\?'短調のⅤ9の根音省略':'長調のⅤ9の根音省略'/);
  assert.ok(!/半減七/.test(screenOf(sc)));
  const bw=read('borrowed.html');
  assert.match(bw,/href="neapolitan\.html" data-go="neapolitan">🌋 <span>次はナポリの六 ›/);
  assert.ok(bw.indexOf('次はナポリの六')<bw.indexOf('href="dorian.html" data-go="dorian"'),'次はをいちばん上に');
  assert.ok(!/次はドリアのⅣ/.test(bw),'準固有のつぎはナポリの六');
  assert.match(bw,/href="dorian\.html" data-go="dorian">🌗 <span>ドリアのⅣ ›/,'ドリアのⅣへのリンクはのこす（次は、ではない）');
  const np=read('neapolitan.html');
  assert.match(np,/data-act="go" data-v="dorian"><span aria-hidden="true">🌗<\/span> 次はドリアのⅣ/);
  assert.ok(np.indexOf('次はドリアのⅣ')<np.indexOf('data-act="go" data-v="aug6"'),'次はをいちばん上に');
  assert.match(np,/data-act="go" data-v="aug6"><span aria-hidden="true">↔️<\/span> 増六の和音/);
  assert.ok(!/次は増六/.test(np),'ナポリのつぎはドリアのⅣ');
  assert.match(scriptOf(np),/if\(v==='dorian'\)\{[\s\S]*?PA\.go\('dorian\.html'\)/,'go:dorian のしょり');
  assert.doesNotThrow(()=>new Function(scriptOf(np)));
  const dr=read('dorian.html');
  assert.match(dr,/href="aug6\.html" data-go="aug6">↔️ <span>次は増六の和音 ›/);
  assert.ok(dr.indexOf('次は増六の和音')<dr.indexOf('href="neapolitan.html" data-go="neapolitan"'),'次はをいちばん上に');
  assert.ok(!/次はナポリの六/.test(dr),'ドリアのつぎは増六');
  assert.match(scriptOf(dr),/go==='aug6'\)\{[^\n]*PA\.store\.set\('aug6',\{[^\n]*minor:true,keyIdx:state\.keyIdx/,'data-go="aug6" で増六のページを短調・おなじ調に');
  assert.doesNotThrow(()=>new Function(scriptOf(dr)));
  const a6=read('aug6.html');
  assert.match(a6,/data-v="enharmonic"><span aria-hidden="true">🔀<\/span> 次は異名同音の読みかえ/);
  assert.match(a6,/<span class="chalbadge"><span aria-hidden="true">🔥<\/span> チャレンジ<\/span>けんばんでは/,'増六のページの読みかえもチャレンジのしるし');
  assert.doesNotThrow(()=>new Function(scriptOf(a6)));
  // どのページの画面にも「♭Ⅵ」「Ⅳm」で準固有を書かない（この変更でふやしていない）
  for(const f of ['enharmonic.html','chroma-quiz.html','aug6.html','doppel.html']) assert.ok(!/♭Ⅵ|Ⅳm/.test(screenOf(read(f))),f);
});
