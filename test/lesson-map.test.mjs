// 学ぶ地図（先生のじゅん）にあわせたなおしのテスト：node --test test/
// ・「半減七」ということばは、どのページの画面にも出さない（先生の意見：docs/TEACHER-FEEDBACK.md の4）
// ・Ⅴ9の根音省略（dim-halfdim.html）：「根音」「省略」の意味 → 短調で Ⅴ→Ⅴ7→Ⅴ9→根音を省略（減七）→Ⅰ、そのあと同じ主音の長調とくらべる
// ・Ⅴの家族は「短調では」減七、とはっきり書く
// ・和音クイズの ①長調・②短調のリンク（keyset）・変化和音クイズのまえの保存（kLv）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const scriptOf=html=>[...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]).join('\n');
// 画面に出る文だけ（JS のコメント・HTML のコメントをのぞく）
const screenOf=html=>html.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'');

test('「半減七」はどのページの画面にも出さない',()=>{
  const pages=fs.readdirSync(dir).filter(f=>/\.html$/.test(f));
  assert.ok(pages.length>20);
  for(const f of pages) assert.ok(!/半減七/.test(screenOf(read(f))),f);
  // 目次（ホーム・上のバー・シェアの説明）にも出さない
  const PA=loadPA();
  PA.APPS.forEach(a=>assert.ok(!/半減七/.test(a.title+a.d),a.id));
});

test('「減七と半減七」のページは「Ⅴ9の根音省略」に（ファイル名・保存の名前はそのまま）',()=>{
  const h=read('dim-halfdim.html'), js=scriptOf(h);
  assert.match(h,/<title>Ⅴ9の根音省略<\/title>/);
  assert.match(js,/PA\.mountBar\(\{title:'Ⅴ9の根音省略',app:'dim-halfdim'\}\)/);
  // はじめに「根音」と「省略」の意味を教える（先生）
  assert.match(js,/<b>根音<\/b><span class="yomi">（こんおん）<\/span>＝和音の土台になる、いちばん下の音。<b>省略<\/b><span class="yomi">（しょうりゃく）<\/span>＝はぶくこと。/);
  assert.match(js,/\$\{wordBox\(\)\}/);
  assert.match(js,/PA\.store\.get\('dim-halfdim',/);
  assert.match(js,/PA\.store\.set\('dim-halfdim',\{minor:state\.minor,keyIdx:state\.keyIdx\}\)/);
  assert.match(js,/PA\.keyDeck\.parse\(PA\.params\(\)\.key\)/,'先生のリンク key はそのまま');
  assert.doesNotThrow(()=>new Function(js),'文法');
  assert.ok(!/\?\.|\?\?/.test(js),'iOS 12でうごかない ?. ?? をつかわない');
  // 短調でつくるじゅん：Ⅴ→Ⅴ7→Ⅴ9→省略→Ⅰ
  assert.match(js,/const STEPS=\[\{label:'Ⅴ'[^\n]*\{label:'Ⅴ7'[^\n]*\{label:'Ⅴ9'[^\n]*\{label:'省略'[^\n]*\{label:'Ⅰへ'/);
  // ほかのページから「減七と半減七」とよばない
  for(const f of fs.readdirSync(dir).filter(f=>/\.html$/.test(f))) assert.ok(!/減七と半減七/.test(screenOf(read(f))),f);
  // 聴きくらべは「減七（短調の形）」と「長調の形」
  assert.match(js,/が長調の形/);
  // ためしてみる：短調クイズで減七とⅤ9（5もん）。Ⅶ7（変化和音クイズ）は入口にしない
  assert.match(js,/PA\.tryHTML\(\{to:'minor-quiz',params:\{mode:'chord',key,chord:'DIM,V9',n:5\}/);
  assert.ok(!/to:'chroma-quiz'/.test(js));
  assert.match(js,/data-hot="listen"/); assert.match(js,/data-hot="next"/);
  assert.ok(!/[AB] をきく|[AB] が /.test(screenOf(h)),'A／B のボタン（CDE の音名とまぎらわしい）');
  assert.ok(!/芸大/.test(screenOf(h)),'画面の文に芸大');
});

test('長調と短調のⅤ・Ⅴ7は同じ音、ちがうのはⅤ9の第9音だけ。根音をはぶくと短調だけ減七（PA.henka）',()=>{
  const PA=loadPA(), H=PA.henka, pc=n=>PA.mod(PA.NAT[n.letter]+n.acc,12), nm=n=>n.letter+':'+n.acc;
  const dim7=ns=>{const p=ns.map(pc).sort((a,b)=>a-b);return p.every((x,i)=>PA.mod(p[(i+1)%4]-x,12)===3);};
  for(let i=0;i<PA.keyCount(true);i++){
    const min=PA.minorKey(i);
    const mj=PA.MAJOR_KEYS.findIndex(([l,a])=>l===min.l&&a===min.a);
    const v9min=H.v9(min);
    assert.ok(dim7(H.vii7(min)),PA.keyName(min)+'：根音なしのⅤ9は減七');
    if(mj<0) continue; // 嬰ト・嬰ニ長調などリストにない長調はページの中でつくる
    const M=PA.majorKey(mj), v9maj=H.v9(M);
    assert.ok(!dim7(H.vii7(M)),PA.keyName(M)+'：根音なしのⅤ9は減七にならない');
    // 根音・第3音（導音）・第7音は同じ。第9音だけちがう（短調のほうが半音低い）
    assert.deepEqual(v9maj.slice(0,3).map(nm),v9min.slice(0,3).map(nm),PA.keyName(M));
    assert.equal(v9maj[3].letter,v9min[3].letter);
    assert.equal(v9maj[3].acc-1,v9min[3].acc,PA.keyName(M)+'：第9音');
  }
});

test('Ⅴの家族：減七は「短調では」とはっきり書き、長調とくらべるページへつなぐ',()=>{
  const h=read('minor-family.html'), js=scriptOf(h);
  assert.match(js,/DIM:\{label:'減七',ks:\[6,8,10,12\],title:'減七の和音（短調のⅤ9から根音をはぶいた形）'\}/);
  assert.match(js,/DIM:`<b>短調では<\/b>、Ⅴ9から根音/);
  assert.match(js,/PA\.url\('dim-halfdim',\{key:PA\.keyDeck\.id\(true,state\.keyIdx\)\}\)/);
  assert.match(js,/to:'dim-halfdim',params:\{key:PA\.keyDeck\.id\(true,state\.keyIdx\)\}/);
  assert.match(js,/短調で「Ⅴ9の根音省略形」と書いてあったら減七の和音/);
  assert.doesNotThrow(()=>new Function(js),'文法');
});

test('和音クイズ：①長調・②短調の課題のリンク（keyset だけ）がつかえる',()=>{
  const PA=loadPA(), html=read('chord-quiz.html');
  const m=html.match(/\/\/ <cq-logic>[^\n]*\n([\s\S]*?)\/\/ <\/cq-logic>/);
  const CQ=new Function('PA',m[1]+'\nreturn {linkSettings};')(PA);
  const tasks=PA.UNITS.flatMap(u=>u.tasks).filter(t=>t.app==='chord-quiz');
  assert.equal(tasks.length,2);
  for(const t of tasks){
    const want=t.href.includes('major')?'major':'minor';
    assert.deepEqual(JSON.parse(JSON.stringify(CQ.linkSettings(PA.parseParams(t.href.split('?')[1])))),{keyset:want},t.href);
  }
});

test('変化和音クイズ：まえの保存（kLv レベル1〜5）は、そのときとおなじ和音でよむ。ほぞんは kStep',()=>{
  const js=scriptOf(read('chroma-quiz.html'));
  assert.match(js,/else if\(!hasStep&&isInt\(d\.kLv,1,5\)\)\{Q\.types=mapTypes\(t=>OLD_KLV\[d\.kLv\]\.includes\(t\)\);Q\.kLv=levelOf\(Q\.types\);\}/);
  assert.match(js,/PA\.store\.set\('chroma-quiz',\{[^}]*kStep:Q\.kLv,/);
  assert.ok(!/PA\.store\.set\('chroma-quiz',\{[^}]*\bkLv:/.test(js),'kLv（まえの番号）ではほぞんしない');
  assert.match(js,/if\(Q\.kLv\) p\.step=Q\.kLv;/,'先生へのリンクは step');
});

// dim-halfdim.html の<script>を core のあとにうごかして、中の関数をとりだす
function dimPage(){
  const js=scriptOf(read('dim-halfdim.html'));
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){},querySelectorAll:function(){return [];}};};document.querySelector=function(){return null;};\n';
  return loadPA(stub+read('assets/core.js')+'\nwindow.scrollTo=function(){};PA.paint=function(el,h){PA.__html=h;};\n'+js+'\nPA.__stepMsg=stepMsg;PA.__pairOf=pairOf;PA.__side=sideCard;PA.__more=moreHTML;');
}
const plainText=h=>h.replace(/<[^>]+>/g,'');

test('Ⅴ9の根音省略のつくるじゅん①：調号どおりの7ばんめ → 半音上げた音（イ短調「ソ」→「ソ♯」、ハ短調「シ♭」→「シ」）',()=>{
  const PA=dimPage();
  for(const minor of [true,false]) for(let i=0;i<PA.keyCount(minor);i++){
    const P=PA.__pairOf(PA.keyOf(minor,i)), N=P.min, t=plainText(PA.__stepMsg(P,0)), lab=PA.keyName(N.k);
    const nat=plainText(PA.nmH(N.k.natLT)), lt=plainText(PA.nmH(N.stack[0]));
    assert.notEqual(nat,lt,lab);
    assert.ok(t.includes(`7ばんめ「${nat}」は、短調では半音上げて「${lt}」にする`),lab+'：'+t);
    assert.equal(N.stack[0].letter,N.k.natLT.letter,lab+'：おなじ文字');
    assert.equal(N.stack[0].acc,N.k.natLT.acc+1,lab+'：半音上げる');
  }
  const a=plainText(PA.__stepMsg(PA.__pairOf(PA.minorKey(0)),0)), c=PA.__pairOf(PA.minorKey(PA.MINOR_KEYS.findIndex(([l,acc])=>l===0&&acc===0)));
  assert.match(a,/7ばんめ「ソ」は、短調では半音上げて「ソ♯」/);
  assert.match(plainText(PA.__stepMsg(c,0)),/7ばんめ「シ♭」は、短調では半音上げて「シ」/);
});

test('Ⅴ9の根音省略：くらべるカードにコードネーム（Bm7(♭5) など）は出さず、「もっとくわしく」に',()=>{
  const PA=dimPage(), P=PA.__pairOf(PA.majorKey(0));
  assert.ok(!/m7\(♭5\)|dim7/.test(PA.__side(P.maj,'☀️','')+PA.__side(P.min,'🌙','')));
  assert.match(PA.__more(P),/コードネーム/);
});

test('「Ⅴ9の根音省略＝減七」は、短調の話だとはっきり書く（Ⅴの家族へのボタン・音のへだたり・異名同音の読みかえ）',()=>{
  for(const f of ['aug6.html','interval.html','enharmonic.html','minor-family.html']){
    const s=screenOf(read(f));
    // 「Ⅴ9…根音…減七」の1つの文（。で区切る）には「短調」も入れる
    s.split(/[。\n]/).filter(x=>/Ⅴ9[^。]*根音[^。]*減七/.test(x)&&!/長調/.test(x)).forEach(x=>assert.match(x,/短調/,f+'：'+x.trim().slice(0,80)));
  }
});
