// 名曲で楽曲分析（piece.html・assets/piece.js・assets/pieces/*.json）のテスト：node --test test/
// ・曲のデータ：和音の音（骨組み）が、書いた調・記号の和音になっているか。いちばん下＝転回形、いちばん上＝sop
// ・こたえあわせ：答えかた（和音の番号だけ・転回形も・ぜんぶ）ごと、べつの正解（accept）
// ・ページ：読みこみ → 「？」をえらぶ → 答える → きろく（PA.store 'piece-<id>'・'pieces'）。ホームの「名曲で楽曲分析」
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const CORE=read('assets/core.js'), PIECE=read('assets/piece.js'), SCORE=read('assets/score.js'), VEX=read('assets/vendor/vexflow-bravura.js');
const FAKE=read('test/_fakedom.mjs').replace(/^export /m,'');
const load=(opts)=>loadPA(CORE+'\n'+PIECE,opts);
const DATA=read('assets/pieces/k545-1.json');
const K545=()=>JSON.parse(DATA);
const J=x=>JSON.parse(JSON.stringify(x));
const nm=(PA,t)=>PA.LET_EN[t.letter]+({'-1':'b','0':'','1':'#'})[t.acc];

test('曲のデータ：K.545 はデータのきまりどおり（PA.piece.validate）',()=>{
  const PA=load(), pc=K545();
  assert.deepEqual(J(PA.piece.validate(pc)),[]);
  assert.equal(pc.id,'k545-1'); assert.equal(pc.key,'C');
  assert.deepEqual(pc.excerpts.map(x=>[x.from,x.to]),[[1,12]]);
  // 版・小節の数えかた・作りかた・ライセンスを書く（ほかのデータを写していない）
  // 版：じっさいに見たもの（Mutopia）と、見ていないもの（旧全集のスキャン＝未確認）を書きわける
  assert.match(pc.source.edition,/^Mutopia Project の楽譜/); assert.match(pc.source.edition,/旧モーツァルト全集（ブライトコプフ・ウント・ヘルテル、1878年）/);
  assert.match(pc.source.edition,/未確認/);
  assert.equal(pc.titleShort,'ピアノ・ソナタ K.545'); assert.ok(!/長調|短調/.test(pc.titleShort),'titleShort に調を書かない');
  assert.match(pc.source.license,/著作権が切れて/);
  assert.match(pc.source.made,/アプリには入れていません/);
  // 1〜12小節をすきまなく（4/4 で 48拍。12小節の4拍めは休み）
  assert.equal(pc.events.reduce((a,e)=>a+e.dur,0),47);
});

test('曲のデータ：骨組みの音は、書いた調の和音の音（つづりも）。いちばん下が転回形の音',()=>{
  const PA=load(), P=PA.piece, pc=K545();
  // 楽譜で見た和音（手でたしかめたもの。DCML の記号とも同じ）
  const want={m1:'Ⅰ',m2a:'Ⅴ₇²',m2b:'Ⅰ',m3a:'Ⅳ²',m3b:'Ⅰ',m4a:'Ⅴ¹',m4b:'Ⅴ₇¹',m4c:'Ⅰ',m5:'Ⅳ',m6:'Ⅰ¹',m7a:'Ⅱ₇',m7b:'Ⅴ₇²',m8:'Ⅰ',
    m9:'Ⅱ¹',m10a:'Ⅳ',m10b:'Ⅳ¹',m10c:'ⅤのⅤ₇¹',m11a:'Ⅴ',m11b:'Ⅰ²',m11c:'Ⅴ',m11d:'Ⅰ²',m12:'Ⅴ'};
  assert.deepEqual(pc.events.map(e=>e.id),Object.keys(want));
  pc.events.forEach(e=>{
    assert.equal(PA.rnText(e.rn),want[e.id],e.id);
    const k=P.key(e.key), T=P.tones(k,e.rn), sk=e.skel.lh.concat(e.skel.rh).map(P.note);
    sk.forEach(n=>assert.ok(T.some(t=>P.same(t,n)),e.id+'：'+nm(PA,n)+' は和音の音'));
    const lo=sk.reduce((a,b)=>b.midi<a.midi?b:a), hi=sk.reduce((a,b)=>b.midi>a.midi?b:a);
    assert.ok(P.same(lo,T[e.rn.inv||0]),e.id+'：いちばん下');
    assert.ok(P.same(lo,P.note(e.bass))&&P.same(hi,P.note(e.sop)),e.id+'：bass・sop');
    assert.equal(lo.midi,P.note(e.bass).midi,e.id+'：bass は骨組みのいちばん下とおなじ高さ'); assert.equal(hi.midi,P.note(e.sop).midi,e.id+'：sop もおなじ高さ');
    assert.ok(sk.some(n=>P.same(n,T[1])),e.id+'：第3音');
    if(e.rn.form) assert.ok(sk.some(n=>P.same(n,T[3])),e.id+'：第7音');
  });
  // つづり：ⅤのⅤ7＝レ・ファ♯・ラ・ド（ソ♭ではない）。Ⅴ7＝ソ・シ・レ・ファ、Ⅱ7＝レ・ファ・ラ・ド
  const C=P.key('C'), names=p=>P.tones(C,p).map(t=>nm(PA,t)).join(' ');
  assert.equal(names({of:5,deg:5,form:7}),'D F# A C');
  assert.equal(names({deg:5,form:7}),'G B D F');
  assert.equal(names({deg:2,form:7}),'D F A C');
  assert.equal(names({deg:4,borrowed:true}),'F Ab C');
  assert.equal(names({deg:6,borrowed:true}),'Ab C Eb');
  assert.equal(names({deg:5,form:9,borrowed:true}),'G B D F Ab');
  const a=P.key('a');
  assert.equal(P.tones(a,{deg:5,form:7}).map(t=>nm(PA,t)).join(' '),'E G# B D');
  assert.equal(P.tones(a,{of:5,deg:5,form:7}).map(t=>nm(PA,t)).join(' '),'B D# F# A');
  assert.equal(P.tones(a,{deg:5,form:9,omit:true}).filter(t=>!t.omit).map(t=>nm(PA,t)).join(' '),'G# B D F');
  // 調の名前
  assert.equal(PA.keyName(P.key('G')),'ト長調'); assert.equal(PA.keyName(P.key('a')),'イ短調');
  assert.equal(P.key('H'),null); assert.equal(P.key('x'),null);
  assert.deepEqual(J(P.note('F#3')),{letter:3,acc:1,midi:54});
  assert.equal(P.note('C4').midi,60); assert.equal(P.note('Bb2').midi,46); assert.equal(P.note('H4'),null);
});

test('曲のデータ：validate はまちがいを見つける',()=>{
  const PA=load(), V=pc=>PA.piece.validate(pc);
  const bad=f=>{const pc=K545();f(pc);return V(pc);};
  assert.ok(bad(pc=>{pc.events[1].bass='G4';pc.events[1].skel.lh=['G3'];}).some(e=>/bass が転回形/.test(e)));
  assert.ok(bad(pc=>{pc.events[0].skel.rh=['E4','A4','C5'];}).some(e=>/和音の外の音/.test(e)));
  assert.ok(bad(pc=>{pc.events[0].skel.rh=['G4','C5'];}).some(e=>/第3音がない/.test(e)));
  assert.ok(bad(pc=>{pc.events[1].skel.rh=['F4','B4'];}).some(e=>/根音がない/.test(e)));
  assert.ok(bad(pc=>{pc.events[0].sop='E5';}).some(e=>/いちばん上が sop/.test(e)));
  // オクターブちがいの bass・sop も見つける（音名だけでくらべない）
  assert.ok(bad(pc=>{pc.events[4].bass='F4';}).some(e=>/いちばん下が bass/.test(e)),'m5：bass F4・骨組み F3');
  assert.ok(bad(pc=>{pc.events[0].sop='C6';}).some(e=>/いちばん上が sop/.test(e)));
  assert.ok(bad(pc=>{pc.events[0].acceptNote='x';}).some(e=>/acceptNote/.test(e)),'accept がないのに acceptNote');
  assert.ok(bad(pc=>{pc.titleShort='';}).some(e=>/titleShort/.test(e)));
  assert.ok(bad(pc=>{pc.events[16].level='deg';}).some(e=>/level:full/.test(e)),'ⅤのⅤ は「ぜんぶ」だけ');
  assert.ok(bad(pc=>{pc.events[1].dur=3;}).some(e=>/すきま・かさなり|小節の外/.test(e)));
  assert.ok(bad(pc=>{pc.events[1].rn={deg:5,form:8};}).some(e=>/rn の部品/.test(e)));
  assert.ok(bad(pc=>{pc.events[5].accept=[{deg:5,inv:1}];}).some(e=>/accept/.test(e)),'おなじ記号を accept に入れない');
  assert.ok(bad(pc=>{pc.events[2].rn={deg:1,omit:true,alt5:'down'};pc.events[2].level='full';}).length>0);
  assert.ok(bad(pc=>{pc.questions[1].choices=['half','nope'];}).some(e=>/choices|おわりかた/.test(e)));
  assert.ok(bad(pc=>{pc.events[3].m=13;}).some(e=>/ぬき出しの外/.test(e)));
  assert.ok(bad(pc=>{delete pc.source.license;}).some(e=>/source/.test(e)));
  assert.deepEqual(J(V(null)),['データがない']);
});

test('記号：どの和音も PA.rn で描けて、読み上げのことばがある',()=>{
  const PA=load(), pc=K545();
  pc.events.forEach(e=>[e.rn].concat(e.accept||[]).forEach(p=>{
    const h=PA.rn(p);
    assert.match(h,/^<span class="rnum" role="img" aria-label="[^"]+"><svg/,e.id);
  }));
  const ev=pc.events.find(e=>e.id==='m10c');
  assert.equal(PA.rnAria(ev.rn),'ⅤのⅤ、7の和音、第1転回形');
  assert.equal(PA.rnAria(pc.events.find(e=>e.id==='m2a').rn),'Ⅴ、7の和音、第2転回形');
  // せつめいの1行
  const tx=h=>h.replace(/<[^>]+>/g,'');
  assert.equal(tx(PA.piece.explainHTML(pc.events.find(e=>e.id==='m2a'))),'ソ・シ・レ・ファの和音。いちばん下がレ（第5音）なので第2転回形');
  assert.equal(tx(PA.piece.explainHTML(ev)),'レ・ファ♯・ラ・ドの和音。いちばん下がファ♯（第3音）なので第1転回形');
});

test('こたえあわせ：答えかたごとにくらべる部品がちがう。accept も正解',()=>{
  const PA=load(), P=PA.piece, pc=K545(), E=id=>pc.events.find(e=>e.id===id);
  const m2a=E('m2a'); // Ⅴ₇²
  assert.ok(P.check(m2a,{deg:5},'deg')); assert.ok(P.check(m2a,{deg:5,inv:1},'deg')); assert.ok(!P.check(m2a,{deg:4},'deg'));
  assert.ok(P.check(m2a,{deg:5,inv:2},'inv')); assert.ok(!P.check(m2a,{deg:5},'inv')); assert.ok(P.check(m2a,{deg:5,form:7,inv:2},'inv'));
  assert.ok(P.check(m2a,{deg:5,form:7,inv:2},'full')); assert.ok(!P.check(m2a,{deg:5,inv:2},'full')); assert.ok(!P.check(m2a,{deg:5,form:7,inv:2,borrowed:true},'full'));
  // 4小節1拍め：Ⅴ¹（2拍めのファまで見て Ⅴ₇¹ も正解）
  const m4a=E('m4a');
  assert.ok(P.check(m4a,{deg:5,inv:1},'full')); assert.ok(P.check(m4a,{deg:5,form:7,inv:1},'full')); assert.ok(!P.check(m4a,{deg:5,form:7},'full'));
  // ⅤのⅤ₇¹：ⅤのⅤ がなければちがう
  const m10c=E('m10c');
  assert.ok(P.check(m10c,{of:5,deg:5,form:7,inv:1},'full')); assert.ok(!P.check(m10c,{deg:5,form:7,inv:1},'full'));
  assert.ok(!P.check(m10c,'Ⅴ','full')); assert.ok(!P.check(m10c,null,'full'));
  // 調・おわりかた
  const q=id=>pc.questions.find(x=>x.id===id);
  assert.ok(P.check(q('key'),'C','full')); assert.ok(!P.check(q('key'),'G','full'));
  assert.ok(P.check(q('cad12'),'half','full')); assert.ok(!P.check(q('cad12'),'perfect','full'));
  assert.ok(P.check(q('cad4'),'imperfect','full'));
  // 番号だけの4択：Ⅰ・Ⅳ・Ⅴ＋こたえ（なければⅡ）。かならずこたえが入る
  pc.events.forEach(e=>{const c=P.degChoices(e);assert.equal(c.length,4,e.id);assert.ok(c.includes(e.rn.deg),e.id);assert.equal(new Set(c).size,4);});
  assert.deepEqual(J(P.degChoices(E('m7a'))),[1,2,4,5]);
});

test('問題のならび：答えかたで数がかわる。調の問題がさいしょ、おわりかたはその小節のあと',()=>{
  const PA=load(), P=PA.piece, pc=K545();
  const ids=lv=>P.items(pc,lv).map(x=>x.id);
  assert.deepEqual(ids('deg'),['m2a','m2b','m3a','m4a','m4c','m5','m6','m7a','m7b','m9','m10a','m11a']);
  assert.deepEqual(ids('inv'),['m2a','m2b','m3a','m4a','m4c','m5','m6','m7a','m7b','m9','m10a','m10b','m11a']);
  assert.deepEqual(ids('full'),['key','m2a','m2b','m3a','m4a','m4b','m4c','cad4','m5','m6','m7a','m7b','m9','m10a','m10b','m10c','m11a','cad12']);
  assert.deepEqual(J(P.items(pc,'nope')),[]);
  assert.equal(P.beatText(4.5),'4拍めのうら'); assert.equal(P.beatText(3),'3拍め');
});

test('ことば：やさしい日本語（分かち書きなし・半減七なし・まえの記号なし）',()=>{
  const pc=K545();
  const texts=[pc.title,pc.composer,pc.movement,...Object.values(pc.source),...pc.excerpts.map(x=>x.label),
    ...pc.events.map(e=>e.note||''),...pc.questions.map(q=>(q.ask||'')+(q.range||'')+q.note)];
  texts.forEach(t=>{
    assert.ok(!/半減七|♭Ⅵ|♭Ⅱ|Ⅰ6\/4|Ⅴ6\/5|N6/.test(t),t);
    // 日本語どうしのあいだにスペースを入れない（分かち書き）
    assert.ok(!/[ぁ-んァ-ヶー一-龠][ 　][ぁ-んァ-ヶー一-龠]/.test(t),'分かち書き：'+t);
    assert.ok(!/(?<![A-Za-z])半音\d/.test(t),t);
  });
  const h=read('piece.html'), js=h.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Function(js),'文法');
  assert.ok(!/\?\.|\?\?/.test(js),'iOS 12でうごかない ?. ?? をつかわない');
  assert.ok(!/\?\.|\?\?/.test(PIECE));
  assert.match(js,/じぶんの楽譜もひらいて、いっしょに見てね/);
  assert.match(h,/<script src="assets\/core\.js"><\/script>\n<script src="assets\/piece\.js"><\/script>/);
  assert.match(js,/PA\.rnHelp\(\)/,'記号のみかた');
  assert.match(js,/PA\.staffSVG\(key,cols,o\)/);
});

// ページの<script>を core・piece.js のあとにうごかす。fetch は曲のデータをかえす。クリックは document の click をよぶ
function runPage(mem,search,opts){
  const js=read('piece.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  const stub=`(function(){const els={};document.getElementById=function(id){return els[id]||(els[id]={id,innerHTML:'',style:{},parentNode:null,addEventListener:function(){}});};
    window.__els=els;window.__clicks=[];window.__dl={};window.__wl={};
    document.addEventListener=function(t,f){if(t==='click') window.__clicks.push(f);(window.__dl[t]=window.__dl[t]||[]).push(f);};
    window.addEventListener=function(t,f){(window.__wl[t]=window.__wl[t]||[]).push(f);};
    document.querySelector=function(){return null;};window.scrollTo=function(){};document.querySelectorAll=function(){return [];};
    window.__fetched=[];window.fetch=function(u){window.__fetched.push(u);return Promise.resolve({ok:true,json:function(){return Promise.resolve(JSON.parse(${JSON.stringify(DATA)}));}});};})();\n`;
  // 音：PA.sleep はおわらない（鳴らしているとちゅうのまま）。PA.chord は数えるだけ
  const snd='PA.sleep=function(){return new Promise(function(){});};window.__chords=0;PA.chord=function(){window.__chords++;};window.__notes=[];PA.playNote=function(m,w,d,v){window.__notes.push([m,w,d]);};PA.stopSound=function(){};\n';
  // vex：VexFlow と、それが要素をつくる DOM のかわり（test/_fakedom.mjs）も入れる（本物の楽譜を描く）。ないときは骨組みだけのまえの形
  const vex=opts&&opts.vex?FAKE+'\n;(function(){var d=fakeDocument();document.createElement=d.createElement;document.createElementNS=d.createElementNS;})();\n'+VEX+'\n':'';
  return loadPA(stub+vex+CORE+'\n'+PIECE+'\n'+(opts&&opts.vex?SCORE+'\n':'')+'PA.paint=function(el,h){el.innerHTML=h;};PA.__ctx=function(k){return window[k];};\n'+snd+js,{storage:mem,search,href:'https://example.test/apps/piece.html'+search});
}
const tick=()=>new Promise(r=>setTimeout(r,0));
function clicker(PA){
  // ページの click（さいごに足したもの）
  return (act,v,extra={})=>{
    const el={dataset:{act,v:v==null?undefined:String(v),...extra},disabled:false};
    const fs=PA.__clicks();
    fs[fs.length-1]({target:{closest:()=>el}});
  };
}

test('ページ：読みこみ → 「？」 → 答える → きろく（和音の番号だけ）',async()=>{
  const mem=new Map();
  const PA=loadPA2(mem,'?id=k545-1');
  await tick(); await tick();
  const view=()=>PA.__el('view').innerHTML;
  assert.deepEqual(J(PA.__fetched()),['assets/pieces/k545-1.json']);
  let h=view();
  assert.match(h,/モーツァルト/); assert.match(h,/ピアノ・ソナタ K\.545（ハ長調）/);
  assert.match(h,/じぶんの楽譜もひらいて、いっしょに見てね/);
  assert.match(h,/ブライトコプフ/);
  // 2小節ずつ6段。小節の番号のボタン、がくふは大譜表（ト音記号・ヘ音記号）で全音符
  assert.equal((h.match(/<div class="sys" /g)||[]).length,6);
  for(let m=1;m<=12;m++) assert.match(h,new RegExp(`data-act="pm" data-v="${m}"`),m+'小節');
  assert.equal((h.match(/class="slot[^"]* q"/g)||[]).length,12,'「？」は12');
  assert.match(h,/aria-label="2小節1拍めの和音（まだ）">？<\/button>/);
  assert.match(h,/<span class="kpre"[^>]*>C:<\/span>/);
  // 番号だけで出さない和音は記号で見せる（読み上げに場所）
  assert.match(h,/<span class="slot given" data-i="0"><span class="pa-sr">1小節1拍め：<\/span><span class="rnum" role="img" aria-label="Ⅰ">/);
  assert.match(h,/aria-label="ⅤのⅤ、7の和音、第1転回形"/);
  const click=clicker(PA);
  click('pick','m2a');
  h=view();
  assert.match(h,/<h3 id="pick-h" tabindex="-1">2小節1拍めの和音は？<\/h3>/);
  assert.equal((h.match(/data-act="adeg"/g)||[]).length,4);
  click('adeg',4); // まちがい
  h=view();
  assert.match(h,/class="fb bad"/); assert.match(h.replace(/<[^>]+>/g,''),/ソ・シ・レ・ファの和音/);
  // 番号だけ：こたえはまず番号（Ⅴ）、記号はあとにそえる（記号でかくと Ⅴ₇²）
  assert.match(h,/ざんねん。こたえは <span class="rnum" role="img" aria-label="Ⅴ">[\s\S]*?<span class="yours">（記号でかくと <span class="rnum" role="img" aria-label="Ⅴ、7の和音、第2転回形">/);
  click('adeg',5); // もうこたえたので、かわらない
  let st=PA.store.get('piece-k545-1');
  assert.deepEqual(J(st.ans.deg.m2a),{a:{deg:4},ok:false});
  // 4小節1拍め：番号だけでは7の和音をえらべないので「…でも正解」は出さない
  click('pick','m4a'); click('adeg',5);
  assert.ok(!/でも正解/.test(view()),'番号だけ：accept の行を出さない');
  assert.match(view(),/せいかい！ <span class="rnum" role="img" aria-label="Ⅴ">[\s\S]*?記号でかくと <span class="rnum" role="img" aria-label="Ⅴ、第1転回形">/);
  click('pick','m2a');
  click('pnext');
  assert.match(view(),/2小節3拍めの和音は？/);
  click('adeg',1);
  assert.equal(PA.store.get('piece-k545-1').ans.deg.m2b.ok,true);
  assert.match(view(),/<span aria-hidden="true">⭕ <\/span>せいかい！/);
  assert.equal(PA.store.get('pieces')['k545-1'].n,3);
  assert.ok(PA.store.get('pieces')['k545-1'].t>0);
  // のこりをぜんぶ正解 → けっか・いちばんよいけっか
  const pc=K545();
  PA.piece.items(pc,'deg').forEach(x=>{if(x.id==='m2a'||x.id==='m2b'||x.id==='m4a') return;click('pick',x.id);click('adeg',x.item.rn.deg);});
  h=view();
  assert.match(h,/id="sum"/); assert.match(h,/<b>11<\/b> \/ 12もん正解/);
  assert.deepEqual(J(PA.store.get('pieces')['k545-1'].best),{deg:{ok:11,n:12}});
  // おわりかたは、その段の「？」にぜんぶ答えたらおしえる
  assert.match(h,/10〜12小節のおわりかた：<b>半終止<\/b>/);
});

test('ページ：ぜんぶ（部品で記号をつくる・調とおわりかた）、リンクの mode、ひらきなおしてものこる',async()=>{
  const mem=new Map();
  let PA=loadPA2(mem,'?id=k545-1&mode=full');
  await tick(); await tick();
  const view=()=>PA.__el('view').innerHTML;
  let h=view();
  assert.match(h,/data-act="plv" data-v="full" aria-pressed="true"/);
  assert.match(h,/<span class="kpre"[^>]*>？:<\/span>/,'調の問題に答えるまでは ？:');
  assert.match(h,/1〜12小節は、何調？/);
  // 調の問題に答えるまで、見出しにも調を書かない（答えが見えないように）
  assert.match(h,/<h2 id="ph">ピアノ・ソナタ K\.545<small>/); assert.ok(!/ハ長調/.test(h.slice(0,h.indexOf('id="lv-h"'))),'見出しに調がない');
  // おわりかたの問題は、その範囲の「？」をうめてから（説明に和音の答えが書いてあるので）
  assert.ok(!/3〜4小節のおわりかたは？|10〜12小節のおわりかたは？/.test(h));
  assert.match(h,/3〜4小節の「？」をうめたら、おわりかたの問題が出るよ/); assert.match(h,/10〜12小節の「？」をうめたら、おわりかたの問題が出るよ/);
  assert.ok(!/Ⅴ7のいちばん下が根音ではなく|ⅤのⅤ7からⅤへすすんで/.test(h));
  let click=clicker(PA);
  click('aq','C',{q:'key'});
  assert.match(view(),/<span class="kpre"[^>]*>C:<\/span>/);
  assert.match(view(),/<h2 id="ph">ピアノ・ソナタ K\.545（ハ長調）<small>/,'答えたら調も');
  // 4小節1拍め：ぜんぶでは「2拍めのファまでいっしょに見て、Ⅴ₇¹でも正解」。べつの正解で答えたら、えらんだ記号を先に
  click('pick','m4a'); click('bdeg',5); click('binv',1); click('bok');
  assert.match(view(),/せいかい！ <span class="rnum" role="img" aria-label="Ⅴ、第1転回形">/);
  assert.match(view(),/<p class="note">2拍めのファまでいっしょに見て、<span class="rnum" role="img" aria-label="Ⅴ、7の和音、第1転回形">[\s\S]*?<\/span>でも正解<\/p>/);
  assert.ok(!/記号でかくと/.test(view()),'ぜんぶでは記号をそえない（おなじ記号）');
  click('pick','m10c');
  h=view();
  assert.equal((h.match(/data-act="bdeg"/g)||[]).length,7);
  assert.match(h,/data-act="bform"/); assert.match(h,/data-act="binv"/); assert.match(h,/data-act="bborrow"/); assert.match(h,/data-act="bof"/);
  assert.match(h,/data-act="bok" data-hot="check" disabled/);
  click('bdeg',5); click('bform',7); click('binv',1); click('bof');
  h=view();
  assert.match(h,/こたえ：<span class="rnum" role="img" aria-label="ⅤのⅤ、7の和音、第1転回形">/);
  click('bok');
  assert.deepEqual(J(PA.store.get('piece-k545-1').ans.full.m10c),{a:{deg:5,form:7,inv:1,of:5},ok:true});
  // 10〜12小節の「？」がのこっているあいだは、おわりかたに答えられない
  click('aq','imperfect',{q:'cad12'});
  assert.equal(PA.store.get('piece-k545-1').ans.full.cad12,undefined);
  click('pick','m10a'); click('bdeg',4); click('bok');
  click('pick','m10b'); click('bdeg',4); click('binv',1); click('bok');
  assert.ok(!/10〜12小節のおわりかたは？/.test(view()));
  click('pick','m11a'); click('bdeg',5); click('bok');
  assert.match(view(),/10〜12小節のおわりかたは？/);
  assert.ok(!/3〜4小節のおわりかたは？/.test(view()),'3〜4小節はまだ');
  click('aq','imperfect',{q:'cad12'});
  assert.equal(PA.store.get('piece-k545-1').ans.full.cad12.ok,false);
  assert.match(view(),/ざんねん。こたえは<b>半終止<\/b>/);
  // 答えかたをかえる → べつのきろく。もどすとのこっている
  click('plv','deg');
  assert.match(view(),/こたえた 0 \/ 12もん/);
  click('plv','full');
  assert.match(view(),/こたえた 7 \/ 18もん/);
  // ひらきなおす（mode なし）→ さいごの答えかた・こたえ
  PA=loadPA2(mem,'?id=k545-1'); await tick(); await tick();
  assert.match(PA.__el('view').innerHTML,/こたえた 7 \/ 18もん/);
  // さいしょから（この答えかただけけす）
  click=clicker(PA);
  click('preset');
  assert.deepEqual(J(PA.store.get('piece-k545-1').ans.full),{});
  // こわれたきろくでもだいじょうぶ
  mem.set('pianoapps.piece-k545-1',JSON.stringify({lv:'nope',ans:{deg:{m2a:{a:'x',ok:true},zz:{a:{deg:1},ok:true}},full:[1]}}));
  PA=loadPA2(mem,'?id=k545-1'); await tick(); await tick();
  assert.match(PA.__el('view').innerHTML,/data-act="plv" data-v="deg" aria-pressed="true"/,'しらない答えかたは「和音の番号だけ」');
  assert.match(PA.__el('view').innerHTML,/こたえた 0 \/ 12もん/,'形のちがうこたえ・しらない問題はすてる');
});

test('ページ：しらない id は「見つからない」（データを読まない）。id なしはさいごの曲',async()=>{
  let PA=loadPA2(new Map(),'?id=nope');
  await tick();
  assert.deepEqual(J(PA.__fetched()),[]);
  assert.match(PA.__el('view').innerHTML,/その曲は見つからなかったよ/);
  assert.match(PA.__el('view').innerHTML,/href="piece\.html\?id=k545-1"/);
  PA=loadPA2(new Map(),'');
  await tick();
  assert.deepEqual(J(PA.__fetched()),['assets/pieces/k545-1.json']);
});

test('ホーム：名曲で楽曲分析は基本の地図のあと・レベルアップの前。これからの曲は1行のメモ（アプリでは出さない）。★',()=>{
  const page=read('index.html'), js=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const render=(mem,protocol)=>{
    const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){}};};document.querySelector=function(){return {};};\n';
    return loadPA(stub+CORE+'\nPA.paint=function(el,h,sig){PA.__html=h;};\n'+js,{storage:mem,protocol}).__html;
  };
  let h=render(new Map());
  const pm=h.match(/<details class="card xmap pmap"[\s\S]*?<\/details>/)[0];
  assert.ok(h.indexOf('class="card map"')<h.indexOf('pmap')&&h.indexOf('pmap')<h.indexOf('data-d="xmap-extra"'));
  assert.match(pm,/名曲で楽曲分析/);
  assert.match(pm,/href="piece\.html\?id=k545-1"/);
  assert.equal((pm.match(/<a /g)||[]).length,1,'リンクは K.545 だけ');
  // これからの曲：番号つきの4行ではなく、1行のメモ（作りかけに見えないように）
  assert.match(pm,/<\/ol><p class="note soonnote"><span aria-hidden="true">🎼 <\/span>これから、ベートーヴェン・シューベルト・ショパンの曲もふえるよ<\/p><\/details>/);
  assert.ok(!/じゅんびちゅう|class="soon"/.test(pm));
  assert.equal((pm.match(/<li/g)||[]).length,1,'地図の行は K.545 だけ');
  // iOS アプリ（App Review 2.1：作りかけの中身を出さない）ではメモも出さない
  const app=render(new Map(),'capacitor:').match(/<details class="card xmap pmap"[\s\S]*?<\/details>/)[0];
  assert.ok(!/soonnote|ふえるよ/.test(app)); assert.match(app,/href="piece\.html\?id=k545-1"/);
  assert.ok(!/<details class="stage [^"]*" data-d="stage-pieces"/.test(h),'基本の島にはしない');
  assert.match(pm,/aria-label="ほし3こ中0こ"/);
  // ひらいた → ★、5もん → ★★、8わりいじょう → ★★★
  const st=me=>{const m=new Map();m.set('pianoapps.pieces',JSON.stringify({'k545-1':me}));m.set('pianoapps.visited',JSON.stringify({piece:Date.now()}));
    return render(m).match(/<details class="card xmap pmap"[\s\S]*?<\/details>/)[0];};
  assert.match(st({t:1,n:0,best:{}}),/aria-label="ほし3こ中1こ"/);
  assert.match(st({t:1,n:5,best:{}}),/aria-label="ほし3こ中2こ"/);
  assert.match(st({t:1,n:12,best:{deg:{ok:9,n:12}}}),/aria-label="ほし3こ中2こ"/);
  assert.match(st({t:1,n:12,best:{deg:{ok:10,n:12}}}),/aria-label="ほし3こ中3こ"/);
  assert.match(st({t:1,n:'x',best:{deg:{ok:99,n:12}}}),/aria-label="ほし3こ中1こ"/,'こわれたきろく');
});

test('オフライン：曲のデータも sw.js の PRECACHE に入る',()=>{
  const sw=read('sw.js');
  assert.match(sw,/'piece\.html',/); assert.match(sw,/'assets\/piece\.js',/); assert.match(sw,/'assets\/pieces\/k545-1\.json',/);
});

// runPage の PA に、テストでつかう入り口をつける
function loadPA2(mem,search,opts){
  const PA=runPage(mem,search,opts);
  return Object.assign(PA,{__fetched:()=>PA.__ctx('__fetched'),__clicks:()=>PA.__ctx('__clicks'),__el:id=>PA.__ctx('__els')[id]});
}

test('曲のデータ：K.545 の見なおし（楽譜にある高さの骨組み・13小節は左手だけのつなぎ・べつの正解の文はデータの note に書かない）',()=>{
  const pc=K545(), E=id=>pc.events.find(e=>e.id===id);
  // 8小節の左手は C3+C4 → C3+E3（ソは右手の音階だけ）。12小節の左手は G2・G3（レは右手だけ）
  assert.deepEqual(J(E('m8').skel),{lh:['C3','C4'],rh:['E4']});
  assert.deepEqual(J(E('m12').skel),{lh:['G2','G3'],rh:['B4','D5']});
  assert.equal(E('m5').bass,'F3');
  assert.match(E('m12').note,/13小節からト長調になり、左手だけのつなぎのあと、14小節から新しいメロディーがはじまる/);
  assert.ok(!/13小節から、ト長調の新しいメロディー/.test(E('m12').note));
  // 「…と答えても正解」は note ではなく accept の行（答えかたで出しわける）
  pc.events.forEach(e=>assert.ok(!/正解/.test(e.note||''),e.id));
  assert.equal(E('m4a').acceptNote,'2拍めのファまでいっしょに見て');
});

test('こたえあわせ：「こう答えても正解」は、その答えかたでちがいがわかるときだけ（PA.piece.altAccepts）',()=>{
  const PA=load(), P=PA.piece, pc=K545(), m4a=pc.events.find(e=>e.id==='m4a');
  assert.deepEqual(J(P.altAccepts(m4a,'deg')),[]);
  assert.deepEqual(J(P.altAccepts(m4a,'inv')),[],'転回形も：7の和音はえらべないので Ⅴ¹ と Ⅴ₇¹ はおなじ');
  assert.deepEqual(J(P.altAccepts(m4a,'full')),[{deg:5,form:7,inv:1}]);
  pc.events.filter(e=>e.id!=='m4a').forEach(e=>assert.deepEqual(J(P.altAccepts(e,'full')),[],e.id));
});

test('ページ：ぜんぶでべつの正解（accept）で答えたら、えらんだ記号を先に「せいかい！Ⅴ₇¹（Ⅴ¹でも正解）」',async()=>{
  const PA=loadPA2(new Map(),'?id=k545-1&mode=full'); await tick(); await tick();
  const view=()=>PA.__el('view').innerHTML, click=clicker(PA);
  click('pick','m4a'); click('bdeg',5); click('bform',7); click('binv',1); click('bok');
  const h=view();
  assert.match(h,/せいかい！ <span class="rnum" role="img" aria-label="Ⅴ、7の和音、第1転回形">[\s\S]*?<span class="yours">（<span class="rnum" role="img" aria-label="Ⅴ、第1転回形">[\s\S]*?<\/span>でも正解）<\/span>/);
  assert.ok(!/2拍めのファまでいっしょに見て/.test(h),'えらんだのが accept なら、下の行はいらない');
  assert.equal(PA.store.get('piece-k545-1').ans.full.m4a.ok,true);
});

test('ページ：音（鳴らしているあいだは描きなおさない・おなじボタンでとめる・ページをはなれたらとめる）',async()=>{
  const PA=loadPA2(new Map(),'?id=k545-1'); await tick(); await tick();
  const view=()=>PA.__el('view').innerHTML, bar=()=>PA.__el('actions').innerHTML, click=clicker(PA);
  assert.match(bar(),/data-act="pall" data-hot="listen" aria-pressed="false">[\s\S]*?ぜんぶ聴く（1〜12小節）/);
  // 鳴らすボタンは data-act を pm・pplay のままにする（pstop にかえるとキーボードのフォーカスがとぶ）
  assert.match(view(),/<button type="button" class="btn small" data-act="pm" data-v="1" aria-pressed="false">/);
  assert.ok(!/data-act="pstop"/.test(view()+bar()));
  const before=view();
  click('pall'); await tick();
  // 本物の楽譜の音を、リズムどおりにいっぺんに予約する（191音。4小節のトリルは ソファソファ の4つ）
  const ns=PA.__ctx('__notes');
  assert.equal(ns.length,194,'ぜんぶの音');
  assert.equal(PA.__ctx('__chords'),0,'骨組みの和音は鳴らさない');
  assert.deepEqual(J(ns.slice(0,2)),[[60,0,0.5+0.15],[72,0,2+0.15]],'1小節1拍め：左手のド（8分）と右手のド（2分）。ゆっくり＝4分音符1秒');
  assert.ok(ns.some(n=>n[0]===54&&Math.abs(n[1]-(9*4+3.5))<1e-9),'10小節4拍めのうらの左手のファ♯');
  assert.equal(view(),before,'鳴らしはじめても、ページを描きなおさない（role=status・aria-live をつくりなおさない）');
  assert.match(bar(),/data-act="pall" data-hot="listen" aria-pressed="true">[\s\S]*?とめる/);
  // もういちど「ぜんぶ聴く」のボタン（いまは「とめる」）をおすと、とめる
  click('pall');
  assert.match(bar(),/aria-pressed="false">[\s\S]*?ぜんぶ聴く/);
  // ページをはなれた（pagehide）・見えなくなった（visibilitychange）・「もどる」でもどった（pageshow）
  click('pall'); assert.match(bar(),/とめる/);
  PA.__ctx('__wl').pagehide.forEach(f=>f({}));
  assert.match(bar(),/ぜんぶ聴く/,'pagehide でとめる');
  click('pall'); assert.match(bar(),/とめる/);
  PA.__ctx('document').hidden=true; PA.__ctx('__dl').visibilitychange.forEach(f=>f({}));
  assert.match(bar(),/ぜんぶ聴く/,'visibilitychange でとめる');
  PA.__ctx('document').hidden=false;
  click('pall'); PA.onPageShow(); assert.match(bar(),/ぜんぶ聴く/,'pageshow でとめる');
});

test('ページ：見た目とことば（せまい画面の①のボタン・「Ⅴの調（2だん）」・楽譜の出どころはとじて「おとなの人へ」）',async()=>{
  const h=read('piece.html');
  assert.match(h,/@media \(max-width:429px\)\{\.degs\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}\}/,'7つが1行だと44pxにとどかない');
  const PA=loadPA2(new Map(),'?id=k545-1&mode=full'); await tick(); await tick();
  const view=()=>PA.__el('view').innerHTML, click=clicker(PA);
  click('pick','m2a');
  assert.match(view(),/data-act="bof" aria-pressed="false">Ⅴの調（2だん）<\/button>/);
  assert.ok(!/ⅤのⅤ（2だん）/.test(view()));
  assert.match(view(),/<button type="button" class="btn small" data-act="pplay" data-v="m2a" aria-pressed="false" data-hot="listen">/);
  const src=view().match(/<details class="card fold src" data-d="src">[\s\S]*?<\/details>/)[0];
  assert.match(src,/この楽譜について（おとなの人へ）<small>曲も楽譜も、だれでもつかえるものだよ<\/small>/);
  assert.match(src,/Mutopia Project/); assert.match(src,/未確認/);
  assert.ok(!/ open/.test(src.slice(0,60)),'はじめはとじておく');
  // ほかのページの記号ボタン（secondary.html の目標の和音）も44pxいじょう
  assert.match(read('secondary.html'),/\.tseg button\{min-width:44px\}/);
});

/* ===== 本物の楽譜（2026-11-01（2）：先生「その曲のまま分析したかった。和音に直した形はヒントとして」） ===== */
const FAKE_DOC=async()=>(await import('./_fakedom.mjs')).fakeDocument();
// VexFlow と score.js を node で（document をにせものに）
async function loadVex(){
  const PA=loadPA(VEX+'\n'+CORE+'\n'+PIECE+'\n'+SCORE+'\nPA.__doc=function(d){document.createElement=d.createElement;document.createElementNS=d.createElementNS;};');
  PA.__doc(await FAKE_DOC());
  return PA;
}

test('本物の楽譜：データ（12小節・どの小節も4拍・191音・臨時記号・音部記号）',()=>{
  const PA=load(), P=PA.piece, pc=K545(), S=P.score(pc);
  assert.deepEqual(J(S.map(x=>x.m)),[1,2,3,4,5,6,7,8,9,10,11,12]);
  S.forEach(x=>{assert.deepEqual(J(x.rh.err),[],x.m+'右手');assert.deepEqual(J(x.lh.err),[],x.m+'左手');assert.equal(x.rh.end,5,x.m);assert.equal(x.lh.end,5,x.m);});
  const tl=P.timeline(pc);
  assert.equal(tl.length,191,'DCML の notes.tsv とおなじ数（tools/piece-check.mjs で1音ずつくらべた）');
  // 1小節：右手 ド（2分）・ミ・ソ、左手 ド・ソ・ミ・ソ…（アルベルティ・バス）
  const nm=n=>n.keys.map(k=>k.name).join('+')+'/'+n.len;
  assert.deepEqual(J(S[0].rh.notes.map(nm)),['C5/2','E5/1','G5/1']);
  assert.deepEqual(J(S[0].lh.notes.map(nm)),['C4/0.5','G4/0.5','E4/0.5','G4/0.5','C4/0.5','G4/0.5','E4/0.5','G4/0.5']);
  assert.deepEqual(J(S[1].rh.notes.map(n=>n.rest?'r':nm(n))),['B4/1.5','C5/0.25','D5/0.25','C5/1','r']);
  // 4小節：トリルつきのファ（8分）。10小節：左手のファ♯は4拍めのうら、右手のドに♮（前の小節のド♯をもどす）
  assert.deepEqual(J(S[3].rh.notes[1].orn),['tr']);
  const fis=S[9].lh.notes[3]; assert.equal(fis.t,4.5); assert.equal(fis.keys[0].name,'F#3');
  assert.ok(S[9].rh.notes[2].keys[0].force&&S[9].rh.notes[15].keys[0].force,'C6!・C5!');
  // 左手は1〜5小節がト音記号、5小節4拍めからヘ音記号（Mutopia・DCML の MuseScore とおなじ）
  assert.equal(S[0].lh.clef0,'treble'); assert.equal(S[4].lh.notes[3].clefChange,'bass'); assert.equal(S[5].lh.clef0,'bass');
  assert.equal(S[0].rh.clef0,'treble');
  // 出どころ：どうたしかめたか（Mutopia で書いて、DCML と1音ずつ）。ほかのデータの写しではない
  assert.match(pc.source.score,/Mutopia/); assert.match(pc.source.score,/DCML/); assert.match(pc.source.score,/tools\/piece-check\.mjs/);
  assert.equal(pc.score.time,'C');
  // 長さ・書きかたのまちがい
  const ps=P.parseStaff;
  assert.ok(ps('C5/4 D5 E5','treble').end===4,'3拍');
  assert.ok(ps('[C5/8 D5','treble').err.some(e=>/連桁/.test(e)));
  assert.ok(ps('H5/4','treble').err.length);
  assert.ok(ps('[C5/4 D5]','treble').err.some(e=>/8分音符より短い/.test(e)));
  assert.ok(ps('C5/4:xx','treble').err.some(e=>/しるし/.test(e)));
  assert.ok(ps('clef:alto C4/1','treble').err.some(e=>/音部記号/.test(e)));
});

test('本物の楽譜：validate は、本物の楽譜と骨組み・記号のくいちがい（どちらの書きまちがいも）を見つける',()=>{
  const PA=load(), V=pc=>PA.piece.validate(pc), bad=f=>{const pc=K545();f(pc);return V(pc);};
  const M=(pc,m)=>pc.score.measures.find(x=>x.m===m);
  // 本物の楽譜のまちがい
  assert.ok(bad(pc=>{M(pc,2).rh='B4/4 [C5/16 D5] C5/4 r';}).some(e=>/2小節の右手：長さが3\.5拍/.test(e)),'付点わすれ');
  assert.ok(bad(pc=>{M(pc,4).lh='[C4/8 G4 D4 G4] [C4 G4 E4 G4]';}).some(e=>/m4a.*いちばん下（C4）が bass（B3）/.test(e)),'左手のシ→ド');
  assert.ok(bad(pc=>{M(pc,11).rh='[A4/8:ac G5 E5:st C5:st] [D5 G5 E5:st C5:st]';}).some(e=>/m11a.*鳴りはじめるA4が和音の音ではない/.test(e)));
  assert.ok(bad(pc=>{M(pc,7).rh='[F4/8 G4/16 A4] [B4 C5 D5 E5] [F5 E5 D5 C5] [B4 A4 G4 E4]';}).some(e=>/m7b.*骨組みの第7音（F）が本物の楽譜で鳴っていない/.test(e)),'7小節4拍めの右手のファ→ミ');
  assert.ok(bad(pc=>{pc.score.measures.pop();}).some(e=>/score の小節/.test(e)));
  assert.ok(bad(pc=>{delete pc.score;}).some(e=>/score（本物の楽譜）がない/.test(e)));
  assert.ok(bad(pc=>{delete pc.source.score;}).some(e=>/source\.score/.test(e)));
  // 骨組み・記号のまちがい（骨組みだけならあっている形でも、本物の楽譜とあわない）
  assert.ok(bad(pc=>{const e=pc.events.find(x=>x.id==='m5');e.bass='F2';e.skel.lh=['F2'];}).some(e=>/m5.*いちばん下（F3）が bass（F2）/.test(e)),'オクターブちがいの bass');
  assert.ok(bad(pc=>{const e=pc.events.find(x=>x.id==='m9');e.rn={deg:4};e.bass='F3';e.skel={lh:['F3','A3'],rh:['C4']};e.sop='C4';}).some(e=>/m9.*鳴りはじめるD4が和音の音ではない/.test(e)),'Ⅱ¹ を Ⅳ と書いた');
  // hear：4小節2拍めのⅤ₇¹ は、1拍めの左手のシ（第3音）もいっしょに見る
  assert.deepEqual(J(K545().events.find(x=>x.id==='m4b').hear),[1,3]);
  assert.ok(bad(pc=>{delete pc.events.find(x=>x.id==='m4b').hear;}).some(e=>/m4b/.test(e)),'hear がないと、2拍めだけではシが鳴っていない');
  assert.ok(bad(pc=>{pc.events.find(x=>x.id==='m4b').hear=[3,4];}).some(e=>/m4b.*hear/.test(e)));
});

test('本物の楽譜：VexFlow で描く（スマホ＝1段1小節で12段・広い画面＝2小節で6段。どの「？」も拍の位置）',async()=>{
  const PA=await loadVex(), pc=K545(), S=PA.piece.score(pc);
  assert.ok(PA.score.ready());
  const L1=PA.score.layout(pc,1), L2=PA.score.layout(pc,2);
  assert.equal(L1.systems.length,12); assert.equal(L2.systems.length,6);
  assert.deepEqual(J(L2.systems.map(s=>s.ms)),[[1,2],[3,4],[5,6],[7,8],[9,10],[11,12]]);
  assert.equal(PA.score.layout(pc,1),L1,'おなじ曲はいちど描いたらとっておく');
  [L1,L2].forEach(L=>{
    const svg=L.systems.map(s=>s.svg).join('');
    assert.equal((svg.match(/<svg /g)||[]).length,L.systems.length);
    assert.match(L.systems[0].svg,/^<svg [^>]*viewBox="0 0 \d+ 200"[^>]*class="vfsvg"[^>]*aria-hidden="true"/);
    assert.ok(!/<svg[^>]* style=/.test(svg),'はばは CSS で（style をけす）');
    // 小節の数＝段の数×2（右手・左手）、音符・休符の数＝データの数（和音は1つ）
    assert.equal((svg.match(/class="vf-stave"/g)||[]).length,24);
    const n=S.reduce((a,x)=>a+x.rh.notes.length+x.lh.notes.length,0);
    assert.equal((svg.match(/class="vf-stavenote"/g)||[]).length,n);
    // 連桁の数＝データの [ ] の数
    const beams=S.reduce((a,x)=>a+new Set(x.rh.notes.filter(q=>q.beam!=null).map(q=>'r'+q.beam)).size+new Set(x.lh.notes.filter(q=>q.beam!=null).map(q=>'l'+q.beam)).size,0);
    assert.equal((svg.match(/class="vf-beam"/g)||[]).length,beams);
    // どの和音にも位置。段の中で左から右へ、はばの中
    const evs=[].concat(...L.systems.map(s=>s.evs));
    assert.deepEqual(J(evs.map(v=>v.i)),pc.events.map((e,i)=>i));
    L.systems.forEach(s=>s.evs.forEach((v,k)=>{
      assert.ok(v.x>0&&v.x<L.W&&v.x0<v.x&&v.x<v.x1&&v.x1<=L.W,'はばの中');
      if(k) assert.ok(v.x>s.evs[k-1].x&&v.x0>=s.evs[k-1].x1-1e-6,'じゅんに・かさならない');
    }));
  });
  // 4小節：Ⅴ¹（1拍め）・Ⅴ₇¹（2拍め）・Ⅰ（3拍め）。1拍ぶんは、せまい画面（276px）でも「？」（52px）が入るはば
  const s4=L1.systems[3], u=276/L1.W;
  assert.equal(s4.evs.length,3); assert.ok((s4.evs[1].x-s4.evs[0].x)*u>=40,'となりの拍との間');
  // 線のあいだ（VexFlow の10）が、320px の画面（楽譜のはば276px）で7pxいじょう
  assert.ok(10*276/L1.W>=7);
});

test('ページ：本物の楽譜がふつう。「？」は楽譜の上の列、骨組みは「ヒント」で（段ごと）',async()=>{
  const PA=loadPA2(new Map(),'?id=k545-1',{vex:true}); await tick(); await tick();
  const view=()=>PA.__el('view').innerHTML, click=clicker(PA);
  let h=view();
  assert.match(h,/下は本物の楽譜だよ/); assert.match(h,/じぶんの楽譜もひらいて、いっしょに見てね/);
  assert.equal((h.match(/<div class="sys" /g)||[]).length,12,'スマホ：1段に1小節');
  assert.equal((h.match(/<div class="sheet" /g)||[]).length,12);
  assert.equal((h.match(/<svg [^>]*class="vfsvg"/g)||[]).length,12);
  assert.equal((h.match(/<div class="lslot" style="left:[\d.]+%">/g)||[]).length,22,'和音がかわる所ぜんぶ（答えるのも、見せるだけのも）');
  assert.equal((h.match(/class="slot[^"]* q"/g)||[]).length,12,'「？」は12');
  assert.equal((h.match(/<i class="tick" style="left:[\d.]+%" aria-hidden="true"><\/i>/g)||[]).length,22,'拍の位置のしるし');
  assert.equal((h.match(/<i class="hl" data-ev="\d+"/g)||[]).length,22);
  assert.ok(!/class="hintbox"/.test(h),'骨組みははじめはとじている');
  assert.equal((h.match(/data-act="phint"/g)||[]).length,12);
  assert.match(h,/data-act="phint" data-v="2" aria-pressed="false" aria-label="ヒント：和音だけにした形を見る"><svg[^>]*>[\s\S]*?<\/svg>ヒント<span class="hx">：和音だけ<\/span><\/button>/);
  // ヒント：その段だけ骨組み（全音符）をひらく・とじる
  click('phint','2');
  h=view();
  assert.equal((h.match(/class="hintbox"/g)||[]).length,1);
  assert.match(h,/data-act="phint" data-v="2" aria-pressed="true"/);
  const hb=h.match(/<div class="hintbox">[\s\S]*?<\/svg><\/div>/)[0];
  assert.match(hb,/和音の音だけを、全音符にした形だよ/); assert.match(hb,/data-ev="1"/); assert.match(hb,/data-ev="2"/); assert.ok(!/data-ev="3"/.test(hb),'2小節の和音だけ');
  click('phint','2'); assert.ok(!/class="hintbox"/.test(view()));
  click('phint','99'); assert.ok(!/class="hintbox"/.test(view()),'しらない小節');
  // 「？」をえらぶ → その段の下に答える所。「この和音」（本物の楽譜）と「和音にして聴く」（骨組み）
  click('pick','m10c');
  h=view();
  assert.match(h,/10小節4拍めのうらの和音は？/);
  assert.match(h,/data-act="pplay" data-v="m10c"/); assert.match(h,/data-act="pskel" data-v="m10c" aria-pressed="false">[\s\S]*?和音にして聴く/);
  assert.match(h,/<i class="hl" data-ev="16" style="left:[\d.]+%;width:[\d.]+%;background:#e6eefc"/,'えらんだ和音の所に色');
  click('pskel','m10c'); await tick();
  assert.equal(PA.__ctx('__chords'),1,'骨組みの和音'); assert.equal(PA.__ctx('__notes').length,0);
  click('pskel','m10c');
  click('pplay','m10c'); await tick();
  // 10小節4拍めのうら（8分）：左手のファ♯と右手のレ・ド（16分）
  assert.deepEqual(J(PA.__ctx('__notes').map(n=>n[0]).sort()),[54,72,74]);
  // 答えて正解すると、列の「？」が記号に
  click('pclose');
  click('pick','m2a'); click('adeg',5);
  assert.match(view(),/<div class="lslot" style="left:[\d.]+%"><button type="button" class="slot[^"]* ok"[^>]*data-v="m2a"/);
});

test('オフライン・ライセンス：VexFlow 4.2.5（そのまま）を assets/vendor に。sw.js の PRECACHE・サポートのページ',()=>{
  const v=read('assets/vendor/vexflow-bravura.js');
  assert.match(v.slice(0,200),/VexFlow 4\.2\.5 /);
  // npm の vexflow@4.2.5 の build/cjs/vexflow-bravura.js のまま（かえていない）
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/vendor/vexflow-bravura.js'))).digest('hex'),'d632111c9dc0eedc095e22b1a61913c23c5d166865e4fece61e1554535de355e');
  assert.ok(!/\?\.[a-zA-Z_$(]|\?\?/.test(v.replace(/\?\.\d/g,'')),'古い Safari でうごかない ?. ?? がない');
  const h=read('piece.html');
  assert.match(h,/<script src="assets\/vendor\/vexflow-bravura\.js"><\/script>\n<script src="assets\/core\.js"><\/script>\n<script src="assets\/piece\.js"><\/script>\n<script src="assets\/score\.js"><\/script>/);
  assert.ok(!/https?:\/\/[^"']*\.js/.test(h),'ネットから読まない');
  const sw=read('sw.js');
  assert.match(sw,/'assets\/vendor\/vexflow-bravura\.js',/); assert.match(sw,/'assets\/score\.js',/);
  assert.match(read('assets/licenses/VEXFLOW-LICENSE.txt'),/Mohit Muthanna Cheppudira/);
  assert.ok(!/\?\.|\?\?/.test(SCORE),'score.js も ?. ?? をつかわない');
  assert.match(read('assets/licenses/BRAVURA-OFL.txt'),/SIL Open Font License, Version 1\.1/);
  const sp=read('support.html');
  assert.match(sp,/VexFlow[\s\S]*?assets\/licenses\/VEXFLOW-LICENSE\.txt/); assert.match(sp,/Bravura[\s\S]*?assets\/licenses\/BRAVURA-OFL\.txt/);
  // ことば：やさしい日本語（分かち書きなし）
  const js=h.match(/<script>([\s\S]*?)<\/script>/)[1];
  ['下は本物の楽譜だよ','和音にして聴く','ヒント：和音だけにした形を見る','和音の音だけを、全音符にした形だよ'].forEach(t=>assert.ok(js.includes(t),t));
  assert.ok(!/[ぁ-んァ-ヶー一-龠][ 　][ぁ-んァ-ヶー一-龠]/.test(K545().source.score));
});
