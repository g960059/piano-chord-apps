// PA.session（れんしゅうの回とけっかのカード）のテスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPA} from './_load.mjs';

const J=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepStrictEqual(J(a),J(b),m);
const mk=()=>{const mem=new Map();return {PA:loadPA(undefined,{storage:mem}),mem};};

test('start・record・active・finished・count',()=>{
  const {PA,mem}=mk(); let t=1000;
  const s=PA.session('chord-quiz',{now:()=>t});
  assert.equal(s.active(),false); assert.equal(s.finished(),false); assert.equal(s.count(),0); assert.equal(s.n(),0);
  assert.equal(s.record({ok:true,label:'x'}),null,'はじめるまえはきろくしない');
  assert.equal(s.progressHTML(),'');
  s.start(3);
  assert.equal(s.active(),true); assert.equal(s.n(),3);
  eq(s.record({ok:true,label:'ト長調のⅤ7',key:'M1'}),{count:1,n:3,finished:false});
  eq(s.record({ok:true,hint:true,label:'ニ長調のⅣ'}),{count:2,n:3,finished:false});
  assert.match(s.progressHTML(),/📝 きょうの3もん　2 \/ 3/);
  eq(s.record({ok:false,hint:true,label:'変ロ長調のⅠ'}),{count:3,n:3,finished:true});
  assert.equal(s.active(),false); assert.equal(s.finished(),true);
  assert.equal(s.record({ok:true,label:'もういっぱい'}),null);
  // ほぞんの形
  eq(JSON.parse(mem.get('pianoapps.session-chord-quiz')),{n:3,done:[
    {ok:true,hint:false,label:'ト長調のⅤ7',key:'M1'},{ok:true,hint:true,label:'ニ長調のⅣ'},{ok:false,hint:false,label:'変ロ長調のⅠ'}],startedAt:1000,sig:'',endedAt:1000});
  // べつのページでよみこむとつづき
  const s2=PA.session('chord-quiz',{now:()=>t});
  assert.equal(s2.finished(),true); assert.equal(s2.count(),3);
  s2.clear(); assert.equal(s2.active(),false); assert.equal(PA.session('chord-quiz').n(),0);
  // n：1〜20、文字でもよい
  assert.equal(PA.session('chord-quiz').start(99).n(),20);
  assert.equal(PA.session('chord-quiz').start('5').n(),5);
  assert.equal(PA.session('chord-quiz').start(0).n(),0);
  assert.throws(()=>PA.session('../x'),{name:'TypeError'});
});

test('{n}：おなじ n で12時間いないならつづき、ちがえば新しく',()=>{
  const {PA}=mk(); let t=5e6;
  const a=PA.session('ending-quiz',{n:'5',now:()=>t});
  assert.equal(a.n(),5); a.record({ok:true,label:'a'});
  t+=36e5;
  assert.equal(PA.session('ending-quiz',{n:5,now:()=>t}).count(),1,'つづき');
  assert.equal(PA.session('ending-quiz',{now:()=>t}).count(),1,'n なしでもつづき');
  t+=13*36e5;
  assert.equal(PA.session('ending-quiz',{n:5,now:()=>t}).count(),0,'12時間すぎたら新しく');
  const b=PA.session('ending-quiz',{n:5,now:()=>t}); b.record({ok:false,label:'b'});
  assert.equal(PA.session('ending-quiz',{n:3,now:()=>t}).count(),0,'n がちがう');
  assert.equal(PA.session('ending-quiz',{n:'abc',now:()=>t}).n(),3,'へんな n はむし');
});

test('n なしでも12時間たった回はすてる',()=>{
  const {PA,mem}=mk(); let t=2e7;
  PA.session('chord-quiz',{n:5,now:()=>t}).record({ok:true,label:'a'});
  t+=5*24*36e5;
  const s=PA.session('chord-quiz',{now:()=>t});
  assert.equal(s.active(),false); assert.equal(s.n(),0); assert.equal(s.progressHTML(),'');
  assert.equal(mem.get('pianoapps.session-chord-quiz'),'null');
});

test('ちがう宿題のリンク（sig）なら新しい回',()=>{
  const {PA}=mk(); const t=3e7;
  const a=PA.session('chord-quiz',{n:5,sig:'key=M3',now:()=>t}); a.record({ok:true,label:'a'}); a.record({ok:true,label:'b'});
  assert.equal(PA.session('chord-quiz',{n:5,sig:'key=M3',now:()=>t}).count(),2,'おなじリンク');
  assert.equal(PA.session('chord-quiz',{n:5,sig:'key=M5',now:()=>t}).count(),0,'key がちがう');
  assert.equal(PA.session('chord-quiz',{n:5,sig:'key=M5',now:()=>t}).state().sig,'key=M5');
  assert.equal(PA.sessionSig({n:'5',tier:'easy',key:'M3',x:'1',mode:''}),'key=M3&tier=easy');
});

test('sig をわたさなければリンク（location.search）からつくる',()=>{
  const mem=new Map(); const t=4e7;
  const P1=loadPA(undefined,{storage:mem,search:'?key=M3&n=5'});
  P1.session('chord-quiz',{n:P1.params().n,now:()=>t}).record({ok:true,label:'a'});
  assert.equal(P1.session('chord-quiz',{n:5,now:()=>t}).count(),1);
  const P2=loadPA(undefined,{storage:mem,search:'?key=M5&n=5'});
  assert.equal(P2.session('chord-quiz',{n:P2.params().n,now:()=>t}).count(),0,'べつの宿題');
});

test('おわった回をおなじリンクであけなおす：10分いないはけっか、それよりあとははじめから',()=>{
  const {PA}=mk(); let t=5e7;
  const s=PA.session('ending-quiz',{n:2,sig:'',now:()=>t}); s.record({ok:true,label:'a'}); s.record({ok:false,label:'b'});
  t+=5*6e4;
  const r=PA.session('ending-quiz',{n:2,sig:'',now:()=>t});
  assert.equal(r.finished(),true,'「もどる」で読みなおし → けっかのまま');
  t+=6*6e4;
  const r2=PA.session('ending-quiz',{n:2,sig:'',now:()=>t});
  assert.equal(r2.finished(),false); assert.equal(r2.active(),true); assert.equal(r2.count(),0);
});

test('こわれたきろく',()=>{
  const {PA,mem}=mk();
  for(const bad of ['nope','[]','null','{"n":0,"done":[]}','{"n":3}','{"n":3,"done":"x"}']){
    mem.set('pianoapps.session-q1',bad);
    assert.equal(PA.session('q1').n(),0,bad);
  }
  const t=9e6;
  mem.set('pianoapps.session-q1',JSON.stringify({n:2,done:[{ok:1,hint:true,label:5},null,{ok:true,hint:true,label:'x'.repeat(200),key:'k'.repeat(30)},{ok:true}],startedAt:t,sig:7}));
  const s=PA.session('q1',{now:()=>t});
  eq(s.state(),{n:2,done:[{ok:false,hint:false,label:''},{ok:true,hint:true,label:'x'.repeat(80)}],startedAt:t,sig:''});
  assert.equal(s.finished(),true);
  // startedAt がこわれている → 12時間たったものとおなじ（すてる）
  mem.set('pianoapps.session-q1',JSON.stringify({n:2,done:[],startedAt:'x'}));
  assert.equal(PA.session('q1').n(),0);
});

test('tally：数・ほし・ひとこと',()=>{
  const {PA}=mk();
  const T=(arr,n)=>PA.sessionTally(arr.map(c=>({ok:c!=='x',hint:c==='h'})),n);
  const a=T(['o','o','o','o','o'],5);
  eq([a.self,a.hint,a.wrong,a.ok,a.stars],[5,0,0,5,3]); assert.ok(a.msg.includes('ぜんぶ、じぶんで'));
  const b=T(['o','h','o','o','o'],5);
  eq([b.self,b.hint,b.wrong,b.ok,b.stars],[4,1,0,5,3]); assert.ok(b.msg.includes('ヒントを見ないで'));
  const c=T(['o','x','o','h','o'],5);
  eq([c.ok,c.stars],[4,2]); assert.ok(c.msg.includes('よくできたね'));
  const d=T(['x','x','h','x','o'],5);
  eq([d.ok,d.stars],[2,1]); assert.ok(d.msg.includes('さいごまで'));
  eq(PA.sessionTally([],0),{n:0,done:0,self:0,hint:0,wrong:0,ok:0,stars:1,msg:PA.sessionTally([],0).msg});
});

test('summaryHTML：けっかのカード',()=>{
  const {PA}=mk(); const t=new Date(2026,9,30,16,5).getTime();
  const s=PA.session('chord-quiz',{n:4,now:()=>t});
  s.record({ok:true,label:'ト長調のⅤ7'});
  s.record({ok:true,hint:true,label:'嬰ヘ長調のⅣ'});
  s.record({ok:false,label:'変ロ長調の<b>Ⅰ</b>'});
  s.record({ok:false,label:'嬰ハ長調ソ𝄪'});
  const h=s.summaryHTML({params:{key:'M1',tier:'easy',level:'2'}});
  assert.ok(h.includes('4もん中2もん'));
  assert.ok(h.includes('★☆☆')||h.includes('★★☆'));
  for(const w of ['じぶんでできた','ヒントを見てできた','まちがえた','👩‍🏫 先生に見せる','2026年10月30日（金）16:05','和音クイズ']) assert.ok(h.includes(w),w);
  assert.ok(h.includes('調：ト長調')&&h.includes('むずかしさ：やさしい（調号0〜1）')&&h.includes('レベル2'));
  // まちがえた・ヒントのもんだいだけ。label は文字（タグはにがす）、𝄪 は x の形
  assert.ok(h.includes('嬰ヘ長調のⅣ')&&h.includes('変ロ長調の&lt;b&gt;Ⅰ&lt;/b&gt;')&&!h.includes('ト長調のⅤ7</li>'));
  assert.ok(h.includes('ソ<span class="ds">x</span>'));
  // おなじれんしゅうのリンク（n つき、さいしょから https）
  assert.match(h,/data-pa="share" data-url="https:\/\/example\.test\/apps\/chord-quiz\.html\?key=M1&amp;tier=easy&amp;level=2&amp;n=4"/);
  assert.ok(h.includes('data-act="session-again"')&&h.includes('data-act="session-free"'));
  // settings をわたすとそれをつかう
  assert.ok(s.summaryHTML({title:'ためし',page:'chroma-quiz',settings:'けんばんで<おさえる>'}).includes('けんばんで&lt;おさえる&gt;'));
  assert.ok(s.summaryHTML({page:'chroma-quiz'}).includes('chroma-quiz.html?n=4'));
  assert.ok(!/undefined|NaN/.test(h));
});
