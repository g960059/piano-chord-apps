// PA.session：ちがうリンクでとちゅうの回がきえない（sessionpause-<quiz>）テスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPA} from './_load.mjs';

const mk=()=>{const mem=new Map();return {PA:loadPA(undefined,{storage:mem}),mem};};

test('ふくしゅうのリンクで上がきしても、きょうの5もんはとっておき、けしたらもどる',()=>{
  const {PA,mem}=mk(); let t=1e7; const now=()=>t;
  const a=PA.session('chord-quiz',{now,sig:''}); a.start(5);
  a.record({ok:true,label:'1'}); a.record({ok:false,label:'2'});
  // にがてふくしゅう（key=M7&n=3）
  const b=PA.session('chord-quiz',{n:3,sig:'key=M7',now});
  assert.equal(b.n(),3); assert.equal(b.count(),0);
  assert.equal(JSON.parse(mem.get('pianoapps.sessionpause-chord-quiz')).done.length,2,'5もんをとっておく');
  b.record({ok:true,label:'r1'});
  b.clear();
  const c=PA.session('chord-quiz',{now});
  assert.equal(c.n(),5); assert.equal(c.count(),2,'つづきから');
  assert.equal(mem.get('pianoapps.sessionpause-chord-quiz'),'null');
});

test('ふくしゅうがおわって10分まではけっか、そのあと5もんにもどる',()=>{
  const {PA}=mk(); let t=2e7; const now=()=>t;
  const a=PA.session('minor-quiz',{n:5,sig:'',now}); a.record({ok:true,label:'1'});
  const b=PA.session('minor-quiz',{n:2,sig:'key=m3',now});
  b.record({ok:true,label:'x'}); b.record({ok:true,label:'y'});
  t+=60e3;
  assert.equal(PA.session('minor-quiz',{now}).finished(),true,'けっかのカード');
  t+=11*60e3;
  const c=PA.session('minor-quiz',{now});
  assert.equal(c.active(),true); assert.equal(c.n(),5); assert.equal(c.count(),1);
});

test('とっておいた回のリンクをまたひらくとその回にもどり、いまの回をとっておく',()=>{
  const {PA,mem}=mk(); let t=3e7; const now=()=>t;
  PA.session('ear',{n:5,sig:'mode=a',now}).record({ok:true,label:'1'});
  const b=PA.session('ear',{n:3,sig:'mode=b',now}); b.record({ok:false,label:'r'});
  const c=PA.session('ear',{n:5,sig:'mode=a',now});
  assert.equal(c.n(),5); assert.equal(c.count(),1);
  const p=JSON.parse(mem.get('pianoapps.sessionpause-ear'));
  assert.equal(p.n,3); assert.equal(p.done.length,1);
});

test('おなじ回を start でまたはじめるとつづきから。おなじ sig の上がきはとっておかない',()=>{
  const {PA,mem}=mk(); let t=4e7; const now=()=>t;
  const a=PA.session('ending-quiz',{sig:'',now}); a.start(5); a.record({ok:true,label:'1'});
  const b=PA.session('ending-quiz',{sig:'pick=M2',now}); b.start(3);
  b.clear();
  b.start(3); // pick の3もんをまた：とっておいた5もんとはちがう
  assert.equal(b.n(),3); assert.equal(b.count(),0);
  b.clear();
  const c=PA.session('ending-quiz',{sig:'',now}); // ページをひらく → 5もんにもどる
  assert.equal(c.count(),1);
  c.clear();
  const d=PA.session('ending-quiz',{sig:'',now}); d.start(5); d.record({ok:true,label:'a'});
  d.start(5); // おなじ sig ではじめから
  assert.equal(d.count(),0);
  assert.equal(JSON.parse(mem.get('pianoapps.sessionpause-ending-quiz')||'null'),null);
});

test('とっておいた回も12時間たったらすてる',()=>{
  const {PA,mem}=mk(); let t=5e7; const now=()=>t;
  PA.session('chord-quiz',{n:5,sig:'',now}).record({ok:true,label:'1'});
  PA.session('chord-quiz',{n:3,sig:'key=M1',now}).clear();
  t+=13*36e5;
  const s=PA.session('chord-quiz',{now});
  assert.equal(s.n(),0);
  assert.equal(mem.get('pianoapps.sessionpause-chord-quiz'),'null');
});
