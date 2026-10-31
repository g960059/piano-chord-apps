// 名曲で楽曲分析（piece.html・assets/piece.js・assets/pieces/*.json）のテスト：node --test test/
// ・曲のデータ：和音の音（骨組み）が、書いた調・記号の和音になっているか。いちばん下＝転回形、いちばん上＝sop
// ・こたえあわせ：答えかた（和音の番号だけ・転回形も・ぜんぶ）ごと、べつの正解（accept）
// ・ページ：読みこみ → 「？」をえらぶ → 答える → きろく（PA.store 'piece-<id>'・'pieces'）。ホームの「名曲で楽曲分析」
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const CORE=read('assets/core.js'), PIECE=read('assets/piece.js');
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
  assert.match(pc.source.edition,/ブライトコプフ/); assert.match(pc.source.edition,/1878/);
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
function runPage(mem,search){
  const js=read('piece.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  const stub=`(function(){const els={};document.getElementById=function(id){return els[id]||(els[id]={id,innerHTML:'',style:{},parentNode:null,addEventListener:function(){}});};
    window.__els=els;window.__clicks=[];document.addEventListener=function(t,f){if(t==='click') window.__clicks.push(f);};
    document.querySelector=function(){return null;};window.scrollTo=function(){};document.querySelectorAll=function(){return [];};
    window.__fetched=[];window.fetch=function(u){window.__fetched.push(u);return Promise.resolve({ok:true,json:function(){return Promise.resolve(JSON.parse(${JSON.stringify(DATA)}));}});};})();\n`;
  return loadPA(stub+CORE+'\n'+PIECE+'\nPA.paint=function(el,h){el.innerHTML=h;};PA.__ctx=function(k){return window[k];};\n'+js,{storage:mem,search,href:'https://example.test/apps/piece.html'+search});
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
  assert.match(h,/<span class="slot given"><span class="pa-sr">1小節1拍め：<\/span><span class="rnum" role="img" aria-label="Ⅰ">/);
  assert.match(h,/aria-label="ⅤのⅤ、7の和音、第1転回形"/);
  const click=clicker(PA);
  click('pick','m2a');
  h=view();
  assert.match(h,/<h3 id="pick-h" tabindex="-1">2小節1拍めの和音は？<\/h3>/);
  assert.equal((h.match(/data-act="adeg"/g)||[]).length,4);
  click('adeg',4); // まちがい
  h=view();
  assert.match(h,/class="fb bad"/); assert.match(h.replace(/<[^>]+>/g,''),/ソ・シ・レ・ファの和音/);
  click('adeg',5); // もうこたえたので、かわらない
  let st=PA.store.get('piece-k545-1');
  assert.deepEqual(J(st.ans.deg.m2a),{a:{deg:4},ok:false});
  click('pnext');
  assert.match(view(),/2小節3拍めの和音は？/);
  click('adeg',1);
  assert.equal(PA.store.get('piece-k545-1').ans.deg.m2b.ok,true);
  assert.match(view(),/<span aria-hidden="true">⭕ <\/span>せいかい！/);
  assert.equal(PA.store.get('pieces')['k545-1'].n,2);
  assert.ok(PA.store.get('pieces')['k545-1'].t>0);
  // のこりをぜんぶ正解 → けっか・いちばんよいけっか
  const pc=K545();
  PA.piece.items(pc,'deg').forEach(x=>{if(x.id==='m2a'||x.id==='m2b') return;click('pick',x.id);click('adeg',x.item.rn.deg);});
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
  assert.match(h,/3〜4小節のおわりかたは？/); assert.match(h,/10〜12小節のおわりかたは？/);
  let click=clicker(PA);
  click('aq','C',{q:'key'});
  assert.match(view(),/<span class="kpre"[^>]*>C:<\/span>/);
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
  click('aq','imperfect',{q:'cad12'});
  assert.equal(PA.store.get('piece-k545-1').ans.full.cad12.ok,false);
  assert.match(view(),/ざんねん。こたえは<b>半終止<\/b>/);
  // 答えかたをかえる → べつのきろく。もどすとのこっている
  click('plv','deg');
  assert.match(view(),/こたえた 0 \/ 12もん/);
  click('plv','full');
  assert.match(view(),/こたえた 3 \/ 18もん/);
  // ひらきなおす（mode なし）→ さいごの答えかた・こたえ
  PA=loadPA2(mem,'?id=k545-1'); await tick(); await tick();
  assert.match(PA.__el('view').innerHTML,/こたえた 3 \/ 18もん/);
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

test('ホーム：名曲で楽曲分析は基本の地図のあと・レベルアップの前。じゅんびちゅうの曲はリンクにしない。★',()=>{
  const page=read('index.html'), js=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const render=mem=>{
    const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){}};};document.querySelector=function(){return {};};\n';
    return loadPA(stub+CORE+'\nPA.paint=function(el,h,sig){PA.__html=h;};\n'+js,{storage:mem}).__html;
  };
  let h=render(new Map());
  const pm=h.match(/<details class="card xmap pmap"[\s\S]*?<\/details>/)[0];
  assert.ok(h.indexOf('class="card map"')<h.indexOf('pmap')&&h.indexOf('pmap')<h.indexOf('data-d="xmap-extra"'));
  assert.match(pm,/名曲で楽曲分析/);
  assert.match(pm,/href="piece\.html\?id=k545-1"/);
  assert.equal((pm.match(/<a /g)||[]).length,1,'リンクは K.545 だけ');
  ['ベートーヴェンのソナタ第1番 Op.2-1','シューベルトの曲','ショパンのエチュード Op.10-8','ショパンのスケルツォ第2番'].forEach(t=>{
    assert.match(pm,new RegExp(`<li class="soon">[\\s\\S]*?<b>${t.replace(/[.]/g,'\\.')}</b>`),t);
  });
  assert.equal((pm.match(/じゅんびちゅう/g)||[]).length,4);
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
function loadPA2(mem,search){
  const PA=runPage(mem,search);
  return Object.assign(PA,{__fetched:()=>PA.__ctx('__fetched'),__clicks:()=>PA.__ctx('__clicks'),__el:id=>PA.__ctx('__els')[id]});
}
