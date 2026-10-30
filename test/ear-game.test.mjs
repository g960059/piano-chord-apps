// 🏆 チャレンジ（ランキング）の きまり assets/ear-game.js の テスト：node --test test/
// もとは 和音ききわけ（waon-kikiwake）の test/game.test.mjs。採点が かわると いままでの ランキングと くらべられなく なるので、
// きまった 答え（GOLDEN）とも くらべる。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';
import '../assets/ear-game.js'; // Worker と おなじ 読みかた（export の ない ファイルを import すると globalThis.EarGame が できる）

const EG=globalThis.EarGame;
const dir=path.dirname(fileURLToPath(import.meta.url));
const SRC=fs.readFileSync(path.join(dir,'..','assets','ear-game.js'),'utf8');
const {TYPE_IDS,LEVELS,MAX_LEVEL,CHALLENGE,mulberry32,voiceSeed,nextType,remember,newChallenge,applyAnswer,simulate,createRun,
  scoreKey,rankLevel,compareResults,checkName,normalizeName,weekId,jstDay,makeNickname,NICK_ADJ,NICK_ANIMAL,isTypeId}=EG;

/* ===== ear.html の 画面の しくみ（「ここから test/ear.test.mjs も よむ」〜「ここまで」） ===== */
const html=fs.readFileSync(path.join(dir,'..','ear.html'),'utf8');
const A=html.indexOf('/* ===== ここから test/ear.test.mjs も よむ'), B=html.indexOf('/* ===== ここまで ===== */');
const PA=loadPA();
const E=vm.runInContext(html.slice(A,B)+';({T,ORDER,LEVELS,MAXLV,makeQ,makeQOf,validQ,replaysOf})',vm.createContext({PA}));
const J=x=>JSON.parse(JSON.stringify(x));

test('ear-game.js：ES モジュールとして import すると globalThis.EarGame（Worker の 読みかた）',()=>{
  assert.equal(typeof EG,'object');
  assert.ok(Object.isFrozen(EG));
  for(const k of ['simulate','isTypeId','CHALLENGE','checkName','normalizeName','weekId','jstDay','createRun','nextType']) assert.ok(k in EG,k);
});

test('ear-game.js：ふつうの script としても うごく（ブラウザ。PA が あれば PA.earGame）',()=>{
  const ctx={PA:{}}; ctx.window=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC,ctx,{filename:'ear-game.js'});
  assert.equal(typeof ctx.EarGame.simulate,'function');
  assert.equal(ctx.PA.earGame,ctx.EarGame);
  assert.deepEqual(J(ctx.EarGame.simulate(42,['maj','dim7','maj'])),J(simulate(42,['maj','dim7','maj'])));
});

test('ear-game.js：iOS Safari 12 で うごく 書きかた・DOM と Math.random を つかわない・export が ない',()=>{
  const code=SRC.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  assert.ok(!/\?\.|\?\?/.test(code),'?. ?? を つかわない');
  assert.ok(!/Object\.fromEntries|\.flat\(|\.flatMap\(|\bclass\s|matchAll|replaceAll|\.at\(/.test(code),'新しい 関数を つかわない');
  assert.ok(!/catch\s*\{/.test(code),'catch には かならず (e)');
  assert.ok(!/Math\.random|document|localStorage|\bPA\.(?!earGame)/.test(code),'DOM・PA・Math.random を つかわない');
  assert.ok(!/^\s*(export|import)\b/m.test(code),'ふつうの script として 読める（export・import なし）');
  new vm.Script(SRC); // 文法の エラーが ない
});

test('LEVELS・しゅるいは ear.html と おなじ（name・types・replays・wide・arp）',()=>{
  assert.deepEqual([...TYPE_IDS],J(E.ORDER));
  assert.deepEqual(Object.keys(E.T).sort(),[...TYPE_IDS].sort());
  assert.equal(LEVELS.length,9); assert.equal(LEVELS[0],null); assert.equal(MAX_LEVEL,8); assert.equal(E.MAXLV,8);
  for(let lv=1;lv<=8;lv++){
    const a=LEVELS[lv], e=E.LEVELS[lv];
    assert.equal(a.n,lv); assert.equal(a.name,e.name,`レベル${lv}`);
    assert.deepEqual([...a.types],J(e.types),`レベル${lv}`);
    assert.equal(a.replays,e.replays==null?null:e.replays,`レベル${lv}`);
    assert.equal(a.wide,!!e.wide); assert.equal(a.arp,!!e.arp);
    // 🏆 チャレンジの もういちど きける 回数は ear-game.js の きまり
    assert.equal(E.replaysOf(lv,'ch'),a.replays);
  }
});

test('mulberry32：おなじ たねなら おなじ 列、[0,1)、よく 知られた 値',()=>{
  for(const seed of [0,1,42,123456789,0x7fffffff,0xffffffff,-1,0x9e3779b9]){
    const a=mulberry32(seed), b=mulberry32(seed);
    for(let i=0;i<500;i++){const x=a();assert.equal(x,b());assert.ok(x>=0&&x<1);}
  }
  const u=mulberry32(0xffffffff), s=mulberry32(-1);
  for(let i=0;i<50;i++) assert.equal(u(),s());
  assert.equal(Math.round(mulberry32(0)()*4294967296),1144304738);
  assert.equal(voiceSeed(0),0x9e3779b9|0);
});

/* もとの 和音ききわけ（waon-kikiwake の game.js）で 出した 値。ここが かわったら ランキングの 採点が かわっている */
const GOLDEN=[
  [0,'maj,maj,maj,maj,dim7,maj,dim7,min,min,min,maj,maj,dim7,min,dim7,min,dim7,dom7,min,maj,min,dim7,min',23,4,false,20,23],
  [1,'dim7,maj,dim7,dim7,dim7,maj,dim7,dim7,maj,dim7,min,min,maj,min,maj,maj,min,maj,min,dim7,maj,min,maj,dom7',26,4,false,23,26],
  [42,'dim7,maj,dim7,dim7,maj,min,maj,dim7,dim7,maj,maj,dim7,min,maj,maj,min,dom7,min,maj,min,dim7,maj,dom7,maj',28,4,false,25,28],
  [123456789,'maj,dim7,dim7,maj,maj,dim7,min,maj,maj,maj,dim7,maj,dim7,maj,min,dim7,min,min,dim7,dim7,maj,min,dim7,min',30,4,false,27,30],
  [4294967295,'dim7,maj,dim7,dim7,dim7,maj,dim7,maj,maj,dim7,dim7,maj,min,dim7,min,dim7,dim7,maj,maj,min,dim7,dim7,dom7,dim7',26,4,false,23,26],
  [987654321,'dim7,maj,maj,dim7,maj,dim7,maj,dim7,maj,min,dim7,min,dim7,min,maj,maj,dim7,dim7,maj,dom7,maj,min,dim7,dom7',25,4,false,22,25],
];
test('採点は もとの 和音ききわけと おなじ（きまった seed・答えかた）',()=>{
  for(const [seed,types,n,level,mastered,correct,total] of GOLDEN){
    const rng=mulberry32(seed), st=newChallenge(), ans=[], seq=[];
    for(let i=0;i<120&&!st.over;i++){
      const t=nextType(st,rng); seq.push(t);
      const a=((i*7+(seed%97))%11===0)?(t==='maj'?'dim7':'maj'):t;
      ans.push(a); applyAnswer(st,t,a);
    }
    assert.equal(seq.slice(0,24).join(','),types,`seed ${seed}`);
    assert.equal(ans.length,n);
    assert.deepEqual([st.best,st.mastered,st.correct,st.total],[level,mastered,correct,total],`seed ${seed}`);
    const r=simulate(seed,ans);
    assert.deepEqual([r.level,r.mastered,r.correct,r.total],[level,mastered,correct,total]);
  }
});

test('nextType：乱数は 1回だけ、レベルの しゅるいだけ、ear.html（れんしゅう）と おなじ くりかえし率',()=>{
  for(let lv=1;lv<=8;lv++){
    const types=LEVELS[lv].types, n=types.length, base=mulberry32(1000+lv);
    let calls=0; const rng=()=>{calls++;return base();};
    const st={level:lv,recent:[]}, seq=[], N=20000;
    for(let i=0;i<N;i++){
      const before=calls, t=nextType(st,rng);
      assert.equal(calls-before,1);
      assert.ok(types.includes(t));
      remember(st,t); seq.push(t);
    }
    let same=0; for(let i=1;i<N;i++) if(seq[i]===seq[i-1]) same++;
    // ear.html の makeQ（前と おなじなら 60% で えらびなおす）の くりかえし率 = (2n+3)/(5n²)
    const want=(2*n+3)/(5*n*n);
    assert.ok(Math.abs(same/(N-1)-want)<0.015,`lv${lv}: ${same/(N-1)} vs ${want}`);
  }
});

const wrongOf=t=>(t==='maj'?'dim7':'maj');
function run(seed,policy,max=600){
  const rng=mulberry32(seed), st=newChallenge(), events=[];
  for(let i=0;i<max&&!st.over;i++){const t=nextType(st,rng);events.push(applyAnswer(st,t,policy(i,t,st.level)));}
  return {st,events};
}
test('チャレンジ：ずっと 正解 → 35もんで L8、40もんで マスター、そのあとも L8',()=>{
  const {st,events}=run(7,(i,t)=>t,45);
  assert.equal(events.filter(e=>e==='up').length,7);
  assert.equal(events.indexOf('master'),39);
  assert.equal(events[34],'up'); assert.equal(st.level,8); assert.equal(st.best,8);
  assert.equal(st.mastered,true); assert.equal(st.lives,3); assert.equal(st.correct,45);
  assert.equal(scoreKey(st),9*1000+45);
});
test('チャレンジ：ずっと まちがい → 3もんで おわり、そのあとの 答えは むし',()=>{
  const {st,events}=run(3,(i,t)=>wrongOf(t));
  assert.deepEqual(events,['down','down','over']);
  assert.equal(st.over,true); assert.equal(st.lives,0); assert.equal(st.level,1); assert.equal(st.best,1);
  assert.equal(applyAnswer(st,'maj','maj'),null);
  assert.equal(st.total,3);
  const r=simulate(3,['x','y','z','maj','maj']);
  assert.equal(r.total,3,'ライフ 0 の あとは かぞえない');
  assert.equal(isTypeId('x'),false); assert.equal(isTypeId('__proto__'),false); assert.equal(isTypeId('toString'),false);
});
test('チャレンジ：まちがえると ライフ −1・1つ下へ・れんぞく 0、とどいた レベルは のこる',()=>{
  const {st}=run(11,(i,t)=>(i<12?t:i===12?wrongOf(t):t),13);
  assert.equal(st.best,3); assert.equal(st.level,2); assert.equal(st.lives,2); assert.equal(st.streak,0);
  const h=st.history[12]; assert.deepEqual([h.level,h.ok,h.event,h.lives],[3,false,'down',2]);
});
test('マスターの あと まちがえても マスターは のこる',()=>{
  const {st}=run(5,(i,t)=>(i===41?wrongOf(t):t),43);
  assert.equal(st.mastered,true); assert.equal(st.best,8); assert.equal(st.level,7,'まちがえたら 1つ下（L7）へ');
  assert.equal(st.history[41].event,'down'); assert.equal(st.history[41].level,8);
});
test('createRun（画面用）と simulate は おなじ',()=>{
  const r0=mulberry32(99);
  for(let k=0;k<200;k++){
    const seed=(r0()*4294967296)>>>0, p=r0()*0.4+0.6, rr=mulberry32(seed^7);
    const rn=createRun(seed);
    for(let i=0;i<600&&!rn.state.over;i++){const t=rn.type();assert.equal(rn.type(),t,'こたえるまで おなじ');rn.answer(rr()<p?t:wrongOf(t));}
    assert.deepEqual(J(rn.result()),J(simulate(seed,rn.answers)));
  }
});
test('scoreKey・rankLevel・compareResults：レベル（マスター＝9）→ 正解数 → 先に きろく',()=>{
  const a={level:8,mastered:true,correct:1,at:5}, b={level:8,mastered:false,correct:500,at:1}, c={level:3,mastered:false,correct:12,at:2}, d={level:3,mastered:false,correct:12,at:3};
  assert.equal(rankLevel(a),9); assert.equal(rankLevel(c),3);
  assert.deepEqual([d,c,b,a].sort(compareResults),[a,b,c,d]);
  assert.ok(scoreKey({level:2,mastered:false,correct:999})<scoreKey({level:3,mastered:false,correct:0}));
  assert.equal(compareResults({level:1,mastered:false,correct:0},{level:1,mastered:false,correct:0}),0);
});
test('CHALLENGE：ライフ 3・5もんで レベルアップ・600もん・0.8秒・2時間',()=>{
  assert.deepEqual(J(CHALLENGE),{lives:3,clear:5,startLevel:1,maxLevel:8,maxAnswers:600,minMsPerAnswer:800,runTtlMs:7200000});
});

test('ear.html：チャレンジの 和音（makeQOf）は おなじ 乱数なら おなじ 和音。どれも validQ を とおる',()=>{
  for(const seed of [1,2,3,42,0xffffffff]){
    const r1=mulberry32(voiceSeed(seed)), r2=mulberry32(voiceSeed(seed));
    for(let lv=1;lv<=8;lv++) for(const t of LEVELS[lv].types){
      const a=E.makeQOf(t,lv,'ch',r1), b=E.makeQOf(t,lv,'ch',r2);
      assert.deepEqual(J(a),J(b));
      assert.equal(a.type,t); assert.equal(a.lv,lv); assert.equal(a.mode,'ch');
      assert.ok(E.validQ(a,lv),JSON.stringify(a));
    }
  }
});

/* ===== 名前（画面と サーバーで おなじ きまり） ===== */
test('checkName：つかえる 名前（そろえた 形で かえす）',()=>{
  for(const [input,out] of [
    ['たろう','たろう'],['おどる ペンギン','おどる ペンギン'],['Taro123','Taro123'],['山田 花子','山田 花子'],
    ['ｼﾝﾃﾞﾚﾗ','シンデレラ'],['ＡＢＣ１２','ABC12'],['  ねこ　　ちゃん ','ねこ ちゃん'],['ﾊﾟﾝﾀﾞ・ﾁｬﾝ','パンダ・チャン'],
    ['ほしねこ','ほしねこ'],['ころすけ','ころすけ'],['えっちゃん','えっちゃん'],['grape','grape'],['skill','skill'],
    ['あいうえおかきくけこさし','あいうえおかきくけこさし'],['々ちゃん','々ちゃん'],['ピアノー','ピアノー'],['1234','1234'],
    ['こころせな','こころせな'],['こころ せな','こころ せな'],['ゆきえ ろーず','ゆきえ ろーず'],['うんちく','うんちく'],['Dickson','Dickson'],
    ['殺陣','殺陣'],['まんこう','まんこう'],['かすみ','かすみ'],['ばかうけ','ばかうけ'],['くずもち','くずもち'],['一郎','一郎'],['健一 2026','健一 2026'],
  ]) assert.deepEqual(checkName(input),{ok:true,name:out},input);
});
test('checkName：はじく 名前（日本語の メッセージ）',()=>{
  for(const input of [
    '','   ','　','ー','・・',null,123,'あいうえおかきくけこさしす','x'.repeat(200),
    'test@example.com','a＠b','example.com','ｅｘａｍｐｌｅ．ｊｐ','https://x','www','ｗｗｗ','http','line me',
    '09012345678','０９０１２３４５','👍','たろう!','a_b','<b>','たろう\u0000','た​ろう',
    'ばか','バカ','ば か','ばーか','しね','シネ','死ね','殺す','うんこ','ウンコマン','fuck','FUCK you','f u c k','kill','Kill me',
    'せんせい','先生','admin','ちんこ','おっぱい',
    '馬鹿','阿呆','消えろ','変態','気持ち悪い','不細工','雑魚','ざこ','気違い','池沼','がいじ','ガイジ','ちんちん','おちんちん','きんたま',
    'くたばれ','しんじまえ','ぶっころ','ヒトラー','ナチス','杀','baka','aho','kuso','unko','unchi','chinko','manko','korosu','kimoi','busu',
    'die','kys','killyou','fvck','fuk','sh1t','b1tch','p0rn','s3x','n1gger','shine',
    'おまえしね','しねばか','ばかばか','ばかあほ','しねぇ','しねよ','ばかぁ','うざっ','ㇱネ','てめー しね','ば か ば か',
    'ひらかわせんせい','山田先生','ピアノ先生','せんせー','運営チーム','公式','official',
    '03 1234 5678','090 123 456','〇九〇一二三四五六七八',
  ]){
    const r=checkName(input);
    assert.equal(r.ok,false,String(input));
    assert.match(r.error,/[ぁ-ん]/,'日本語の メッセージ');
  }
  assert.equal(normalizeName('ＡＢＣ　ｄ'),'ABC d');
  assert.equal(normalizeName(5),'');
});
test('自動ニックネームは ぜんぶ つかえる 名前',()=>{
  for(const a of NICK_ADJ) for(const b of NICK_ANIMAL){const r=checkName(a+' '+b);assert.equal(r.ok,true,a+' '+b);assert.equal(r.name,a+' '+b);}
  const rr=mulberry32(3);
  for(let i=0;i<50;i++) assert.equal(checkName(makeNickname(rr)).ok,true);
});
test('weekId・jstDay：日本時間の 月曜 0時で 週が かわる',()=>{
  assert.equal(weekId(Date.UTC(2026,9,29,3)),'2026-W44');
  assert.equal(weekId(Date.UTC(2026,9,25,14,59,59)),'2026-W43');
  assert.equal(weekId(Date.UTC(2026,9,25,15,0,0)),'2026-W44');
  assert.equal(weekId(Date.UTC(2020,11,31,15)),'2020-W53');
  assert.equal(weekId(Date.UTC(2026,11,31,15)),'2026-W53');
  assert.equal(weekId(Date.UTC(2027,0,3,15)),'2027-W01');
  assert.equal(weekId(Date.UTC(2025,11,28,15)),'2026-W01');
  assert.equal(jstDay(Date.UTC(2026,9,28,15)),'2026-10-29');
  assert.match(weekId(),/^\d{4}-W\d{2}$/);
});
