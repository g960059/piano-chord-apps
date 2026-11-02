// 耳のひろば：つづけた日（PA.earDays・'ear-days'）。にせの時計で、月・年のさかいめ・うるう年・夏時間・時間帯をたしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const TZ0=process.env.TZ;
// 時間帯をかえてためす（node は process.env.TZ をかえると、つぎの Date からその時間帯になる）
function inTZ(tz,fn){process.env.TZ=tz;try{return fn();}finally{if(TZ0==null) delete process.env.TZ; else process.env.TZ=TZ0;}}
const J=x=>JSON.parse(JSON.stringify(x)); // vm の中の配列をふつうの配列に
const mk=()=>{const mem=new Map();return {PA:loadPA(undefined,{storage:mem}),mem};};
// その時間帯の「年・月・日 時:分」（月は1から）
const at=(y,m,d,h=12,mi=0)=>new Date(y,m-1,d,h,mi).getTime();

test('key：端末の日づけ（ローカル時刻）で YYYY-MM-DD。UTC の日づけではない',()=>{
  const t=Date.UTC(2026,10,1,15,30); // 2026-11-01 15:30 UTC
  inTZ('Asia/Tokyo',()=>{const {PA}=mk();assert.equal(PA.earDays.key(t),'2026-11-02');assert.equal(PA.earDays.key(new Date(t)),'2026-11-02');});
  inTZ('America/Los_Angeles',()=>{const {PA}=mk();assert.equal(PA.earDays.key(t),'2026-11-01');});
  inTZ('UTC',()=>{const {PA}=mk();assert.equal(PA.earDays.key(t),'2026-11-01');});
  // 日本の夜中0時のすぐ前・すぐあと
  inTZ('Asia/Tokyo',()=>{const {PA}=mk();
    assert.equal(PA.earDays.key(at(2026,12,31,23,59)),'2026-12-31');
    assert.equal(PA.earDays.key(at(2027,1,1,0,0)),'2027-01-01');});
});

test('mark：その日はじめてだけ first。おなじ日は1つ。古いじゅんにのこす',()=>inTZ('Asia/Tokyo',()=>{
  const {PA}=mk(), D=PA.earDays;
  assert.deepEqual(J(D.list()),[]);
  let r=D.mark(at(2026,11,2,8));
  assert.equal(r.first,true); assert.equal(r.info.today,true); assert.equal(r.info.run,1);
  r=D.mark(at(2026,11,2,21)); // おなじ日の2回め
  assert.equal(r.first,false);
  D.mark(at(2026,10,30,19)); // あとから前の日（時計をもどした）
  assert.deepEqual(J(D.list()),['2026-10-30','2026-11-02']);
  assert.deepEqual(J(PA.store.get('ear-days',null)),['2026-10-30','2026-11-02']);
}));

test('つづけた日数：月・年のさかいめ・うるう年をまたいでつづく',()=>inTZ('Asia/Tokyo',()=>{
  const cases=[
    [[2026,1,30],[2026,1,31],[2026,2,1]],          // 1月→2月
    [[2026,2,27],[2026,2,28],[2026,3,1]],          // 2月（うるう年でない）→3月
    [[2028,2,28],[2028,2,29],[2028,3,1]],          // うるう年の2月29日
    [[2026,12,30],[2026,12,31],[2027,1,1],[2027,1,2]], // 年のさかいめ
    [[2026,4,30],[2026,5,1]]                        // 30日の月
  ];
  for(const days of cases){
    const {PA}=mk(), D=PA.earDays;
    days.forEach(([y,m,d],i)=>{const r=D.mark(at(y,m,d,7+i));assert.equal(r.first,true);assert.equal(r.info.run,i+1,JSON.stringify(days));});
  }
  // うるう年でない年は2月28日→3月1日でつづく。うるう年は2月29日がぬけるとつづかない
  const {PA}=mk(), D=PA.earDays;
  D.mark(at(2028,2,28)); assert.equal(D.mark(at(2028,3,1)).info.run,1);
}));

test('休んでも、しるしは消さない。きょうまだなら、きのうまでの日数。あいだがあれば 0（「とぎれた」とは言わない）',()=>inTZ('Asia/Tokyo',()=>{
  const {PA}=mk(), D=PA.earDays;
  [[10,26],[10,27],[10,28]].forEach(([m,d])=>D.mark(at(2026,m,d)));
  let I=D.info(at(2026,10,29,9)); // きょうはまだ：きのうまで3日
  assert.equal(I.today,false); assert.equal(I.run,3);
  I=D.info(at(2026,10,30,9)); // 1日やすんだ
  assert.equal(I.run,0); assert.equal(I.weekCount,3); assert.equal(I.total,3);
  assert.deepEqual(J(D.list()),['2026-10-26','2026-10-27','2026-10-28']);
  const h=D.weekHTML(I);
  assert.ok(!/とぎれ|きえ|消え|リセット|0日つづけて|つづけて<b>0/.test(h),h);
  assert.ok(!/pw-run/.test(h),'1日いかはつづけた日数を出さない');
  D.mark(at(2026,10,30,20));
  assert.equal(D.info(at(2026,10,30,21)).run,1);
}));

test('今週：月曜〜日曜。月・年のさかいめの週',()=>inTZ('Asia/Tokyo',()=>{
  const {PA}=mk(), D=PA.earDays;
  D.mark(at(2026,10,26)); D.mark(at(2026,10,31)); D.mark(at(2026,11,1)); D.mark(at(2026,11,2));
  const I=D.info(at(2026,11,1,10)); // 2026-11-01 は日曜
  assert.deepEqual(J(I.week.map(x=>x.key)),['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']);
  assert.deepEqual(I.week.map(x=>x.wd).join(''),'月火水木金土日');
  assert.deepEqual(J(I.week.map(x=>x.on)),[true,false,false,false,false,true,true]);
  assert.equal(I.week[6].now,true); assert.ok(I.week.every(x=>!x.future));
  assert.equal(I.weekCount,3); assert.equal(I.run,2);
  // 月曜になると、あたらしい週（前の週の丸は今週には出ないが、つづけた日数はつづく）
  const N=D.info(at(2026,11,2,10));
  assert.equal(N.week[0].key,'2026-11-02'); assert.equal(N.week[0].now,true);
  assert.deepEqual(J(N.week.map(x=>x.future)),[false,true,true,true,true,true,true]);
  assert.equal(N.weekCount,1); assert.equal(N.run,3);
  // 年をまたぐ週（2025-12-29 月 〜 2026-01-04 日）
  const K=D.info(at(2026,1,1));
  assert.equal(K.week[0].key,'2025-12-29'); assert.equal(K.week[6].key,'2026-01-04'); assert.equal(K.week[3].now,true);
}));

test('夏時間のある時間帯でも、日づけと日数がずれない',()=>inTZ('America/Los_Angeles',()=>{
  const {PA}=mk(), D=PA.earDays;
  // 2026-03-08（夏時間がはじまる日：23時間）・2026-11-01（おわる日：25時間）をまたぐ
  [[3,7,23,30],[3,8,0,30],[3,8,23,30],[3,9,0,10]].forEach(([m,d,h,mi])=>D.mark(at(2026,m,d,h,mi)));
  assert.deepEqual(J(D.list()),['2026-03-07','2026-03-08','2026-03-09']);
  assert.equal(D.info(at(2026,3,9,23,59)).run,3);
  [[10,31,23,50],[11,1,23,50],[11,2,0,5]].forEach(([m,d,h,mi])=>D.mark(at(2026,m,d,h,mi)));
  assert.equal(D.info(at(2026,11,2,12)).run,3);
  const I=D.info(at(2026,11,1,23,59));
  assert.equal(I.week[6].key,'2026-11-01'); assert.equal(I.week[0].key,'2026-10-26');
}));

test('こわれたきろく：配列でない・ない日・同じ日・数字はすてる。KEEP 日ぶんまで',()=>inTZ('Asia/Tokyo',()=>{
  const {PA}=mk(), D=PA.earDays;
  PA.store.set('ear-days',{a:1}); assert.deepEqual(J(D.list()),[]);
  assert.equal(D.info(at(2026,11,1)).run,0);
  PA.store.set('ear-days',['2026-02-30','2026-13-01','x',20261101,null,'1999-12-31','2026-11-01','2026-11-01','2026-10-31','2026-1-5']);
  assert.deepEqual(J(D.list()),['2026-10-31','2026-11-01']);
  assert.equal(D.info(at(2026,11,1)).run,2);
  // localStorage がつかえなくても、こわれない
  // たくさん：さいごの KEEP 日ぶんだけ
  const many=[]; for(let i=0;i<D.KEEP+50;i++) many.push(D.key(new Date(2024,0,1+i,12)));
  PA.store.set('ear-days',many);
  const l=D.list(); assert.equal(l.length,D.KEEP); assert.equal(l[l.length-1],many[many.length-1]);
  D.mark(new Date(2024,0,1+D.KEEP+50,12));
  assert.equal(PA.store.get('ear-days',[]).length,D.KEEP);
  assert.equal(D.info(new Date(2024,0,1+D.KEEP+50,13)).run,D.KEEP);
}));

test('localStorage がつかえない端末でも、こわれない',()=>{
  const PA=loadPA(undefined,{storage:{has(){throw new Error('x');},get(){throw new Error('x');},set(){throw new Error('x');},delete(){},keys(){return [][Symbol.iterator]();},get size(){return 0;}}});
  assert.deepEqual(J(PA.earDays.list()),[]);
  assert.equal(PA.earDays.mark().first,true);
  assert.equal(PA.earDays.info().run,0);
});

test('weekHTML・cheerHTML：7つの丸、読み上げは1つの文、紙ふぶきは aria-hidden、やさしいことば',()=>inTZ('Asia/Tokyo',()=>{
  const {PA}=mk(), D=PA.earDays;
  D.mark(at(2026,10,29)); D.mark(at(2026,10,30)); D.mark(at(2026,10,31));
  const I=D.info(at(2026,10,31,18));
  const h=D.weekHTML(I);
  assert.match(h,/^<div class="pa-week" role="img" aria-label="今週は3日できたよ（木・金・土）。つづけて3日">/);
  assert.equal((h.match(/class="pw-d[ "]/g)||[]).length,7);
  assert.equal((h.match(/class="pw-d on/g)||[]).length,3);
  assert.match(h,/class="pw-d on now"/);
  assert.match(h,/<span class="pw-run"><span aria-hidden="true">🔥<\/span>つづけて<b>3<\/b>日<\/span>/);
  assert.match(D.weekHTML(I,{dark:true}),/class="pa-week dark"/);
  assert.match(h,/<span class="pw-n"><b>3<\/b>日できた<\/span>/);
  // まだ何もない週
  const E=mk().PA.earDays, h0=E.weekHTML(E.info(at(2026,10,31)));
  // 0日は数を出さない（「0日できた」はがっかりする）。「これから」
  assert.match(h0,/aria-label="今週はまだこれから"/); assert.match(h0,/<span class="pw-n">これから<\/span>/);
  assert.ok(!/0日|<b>0<\/b>/.test(h0),h0);
  // 5もんのけっか：その日はじめて（fx）は紙ふぶき。2回めはうごきなし
  const c1=D.cheerHTML({fx:true,n:5,info:I});
  assert.match(c1,/^<div class="pa-cheer">/);
  assert.match(c1,/<span class="pa-confetti" aria-hidden="true">(<i style="[^"]+"><\/i>){14}<\/span>/);
  // 紙ふぶきは 0.06びょうずつずらして、5こごとにくりかえす（さいごは 0.24びょう）
  const ds=[...c1.matchAll(/--d:([\d.]+)s/g)].map(m=>+m[1]);
  assert.deepEqual(ds.slice(0,6),[0,0.06,0.12,0.18,0.24,0]); assert.ok(Math.max(...ds)<=0.24);
  assert.match(c1,/きょうの5もん、できたね！/); assert.match(c1,/毎日つづいているね！/);
  const c2=D.cheerHTML({fx:false,n:10,info:I});
  assert.match(c2,/^<div class="pa-cheer still">/); assert.ok(!/pa-confetti/.test(c2)); assert.match(c2,/きょうの10もん、できたね！/);
  // きょうのしるしがない（日づけがかわった）ときは「できたね」と言わない
  const c3=D.cheerHTML({fx:true,info:D.info(at(2026,11,1))});
  assert.ok(!/できたね|pa-confetti/.test(c3)); assert.match(c3,/pa-week/);
  // 1日めは、つづけた日数ではなく「またあした」
  const F=mk().PA.earDays; F.mark(at(2026,10,31));
  assert.match(F.cheerHTML({fx:true,info:F.info(at(2026,10,31))}),/またあしたも、まってるよ/);
  // ことば：分かち書きのスペースがない
  for(const x of [h,c1,c2,c3]){
    const text=x.replace(/<[^>]*>/g,'');
    assert.ok(!/[ぁ-んァ-ヶ一-龠] [ぁ-んァ-ヶ一-龠]/.test(text),text);
  }
}));

test('PA.session のけっかのカード：extra をひとことの下に入れる',()=>{
  const {PA}=mk();
  const s=PA.session('ear',{n:2,sig:''}); s.record({ok:true,label:'a'}); s.record({ok:false,label:'b'});
  const h=s.summaryHTML({title:'和音の聴きわけ',page:'ear',params:{},extra:'<div class="pa-cheer">X</div>'});
  assert.ok(h.indexOf('class="sess-msg"')<h.indexOf('<div class="pa-cheer">X</div>'));
  assert.ok(h.indexOf('<div class="pa-cheer">X</div>')<h.indexOf('class="sess-counts"'));
  assert.ok(!/pa-cheer/.test(s.summaryHTML({title:'t',page:'ear',params:{}})));
});

test('app.css：丸・紙ふぶき。うごきをへらす設定では紙ふぶきを出さない',()=>{
  const css=fs.readFileSync(path.join(root,'assets','app.css'),'utf8');
  assert.match(css,/\.pa-week \.pw-d i\{[^}]*width:16px/);
  assert.match(css,/@keyframes pa-fall/);
  // 「できたね！」は pa-celebrate（ふつうの「ぽん」より、すこしゆっくり）
  assert.match(css,/\.pa-cheer\{[^}]*animation:pa-celebrate var\(--dur-celebrate\) var\(--ease-out\)\}/);
  assert.match(css,/@keyframes pa-celebrate\{0%\{transform:scale\(\.96\)\}60%\{transform:scale\(1\.02\);animation-timing-function:var\(--ease-in-out\)\}100%\{transform:none\}\}/); // もどるところは、ゆっくりはじまってゆっくりおわる
  assert.ok(!/@keyframes pop\b/.test(css));
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\.pa-cheer\{animation:none\}\.pa-confetti\{display:none\}\}/);
});

/* ----- ページ ----- */
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const scriptOf=h=>h.replace(/<style>[\s\S]*?<\/style>/,'');
for(const [f,label] of [['ear.html','和音の聴きわけ'],['progression.html','ならびの聴きわけ']]){
  test(`${f}：さいごまでやったら PA.earDays.mark。けっかに「できたね」、5もんの行に今週の丸`,()=>{
    const h=read(f), js=scriptOf(h);
    assert.match(js,/if\((r|rr)&&\1\.finished\) dayFx=PA\.earDays\.mark\(\)\.first;/);
    assert.match(js,/const extra=PA\.earDays\.cheerHTML\(\{fx:dayFx,n:sess\.n\(\)\}\); dayFx=false;/);
    assert.match(js,new RegExp(`summaryHTML\\(\\{title:'${label}'[^\\n]*extra\\}\\)`));
    assert.match(js,/PA\.earDays\.list\(\)\.length\?PA\.earDays\.weekHTML\(\):''/);
    assert.ok(!/\?\.|\?\?/.test(js),'?. ?? をつかわない');
  });
}

// ホームの<script>を core のあとにうごかして、PA.paint にわたる HTML を見る（時計は Date.now をおきかえる）
function renderHome(mem,now){
  const page=read('index.html'), js=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const stub='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){}};};document.querySelector=function(){return {};};\n';
  return loadPA(stub+'Date.now=function(){return '+now+';};\n'+read('assets/core.js')+'\nPA.paint=function(el,h,sig){PA.__html=h;};\n'+js,{storage:mem});
}
const plazaOf=h=>{const m=h.match(/<section class="card plaza[\s\S]*?<\/section>/);return m?m[0]:'';};
test('index.html：耳のひろばのカードに今週の丸。きょうできたら灯り（🌟）',()=>inTZ('Asia/Tokyo',()=>{
  const mem=new Map();
  // まだ1日もない：丸は出さない
  let p=plazaOf(renderHome(mem,at(2026,11,1,9)).__html);
  assert.match(p,/^<section class="card plaza"/); assert.ok(!/pa-week/.test(p)); assert.match(p,/和音を聴いて、明るい？さびしい？/);
  mem.set('pianoapps.ear-days',JSON.stringify(['2026-10-30','2026-10-31']));
  // きょうはまだ：きのうまで2日つづいている
  p=plazaOf(renderHome(mem,at(2026,11,1,9)).__html);
  assert.match(p,/^<section class="card plaza"/);
  assert.match(p,/<div class="days"><div class="pa-week dark" role="img" aria-label="今週は2日できたよ（金・土）。つづけて2日">/);
  // きょうできた
  mem.set('pianoapps.ear-days',JSON.stringify(['2026-10-30','2026-10-31','2026-11-01']));
  p=plazaOf(renderHome(mem,at(2026,11,1,20)).__html);
  assert.match(p,/^<section class="card plaza lit"/); assert.match(p,/>🌟<\/span>/);
  assert.match(p,/きょうはできたね！もっとやってもいいよ/);
  assert.match(p,/つづけて3日/);
  // 月曜：あたらしい週は0日。でも、つづけた日数はつづいている（休んでいない）
  p=plazaOf(renderHome(mem,at(2026,11,2,7)).__html);
  assert.match(p,/aria-label="今週はまだこれから。つづけて3日"/);
  assert.ok(!/0日|<b>0<\/b>/.test(p.match(/<div class="days">[\s\S]*?<\/div><\/div>/)[0]),'月曜に「0日」を出さない');
  // 何日も休んだ：しるしはのこる（「とぎれた」とは言わない）
  p=plazaOf(renderHome(mem,at(2026,11,20,7)).__html);
  assert.match(p,/aria-label="今週はまだこれから"/); assert.ok(!/とぎれ|pw-run|0日できた/.test(p));
  assert.deepEqual(JSON.parse(mem.get('pianoapps.ear-days')),['2026-10-30','2026-10-31','2026-11-01']);
  // ランキングのことばは出さない（アプリでもウェブでも、この丸は自分だけのきろく）
  assert.ok(!/ランキング/.test(p.match(/<div class="days">[\s\S]*?<\/div><\/div>/)[0]));
}));
