// interval.html（音の へだたり）の 計算の テスト：node --test test/
// ページの「IV:start 〜 IV:end」の ぶぶんを 読みこんで、13の長調・13の短調（24調と、べつの 書きかた 2つ）すべてで たしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','interval.html'),'utf8');
const m=/\/\* IV:start[^]*?\*\/([^]*?)\/\* IV:end \*\//.exec(html);
const PA=loadPA(), mod=PA.mod;
const IV=new Function('PA',m[1]+'\nreturn IV;')(PA);
const KEYS=[...Array(13).keys()].flatMap(i=>[PA.keyOf(false,i,60),PA.keyOf(true,i,60)]);
const kn=k=>PA.keyName(k);
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const en=n=>PA.LET_EN[n.letter]+PA.ACC[n.acc];
const N=(l,a,o=4)=>({letter:'CDEFGAB'.indexOf(l),acc:a,midi:12*(o+1)+PA.NAT['CDEFGAB'.indexOf(l)]+a});
const fmt=i=>IV.label(i)[1];

test('IV の ぶぶんが ページから 読める', ()=>{
  assert.ok(m, 'IV:start 〜 IV:end が ある');
  assert.ok(!/\?\.|\?\?/.test(m[1]), 'iOS 12 で うごかない 書きかた（?. ??）が ない');
});

test('名前の 例（文字で かぞえる・広さ）', ()=>{
  const c=[
    [N('C',0),N('E',0),'長3度'],[N('D',0),N('F',0),'短3度'],[N('C',0),N('G',0),'完全5度'],[N('B',0),N('F',0,5),'減5度'],
    [N('F',0),N('B',0),'増4度'],[N('C',0),N('C',0),'完全1度'],[N('C',0),N('C',0,5),'完全8度'],[N('A',-1),N('F',1,5),'増6度'],
    [N('B',0),N('D',-1,5),'減3度'],[N('C',1),N('B',-1),'減7度'],[N('C',0),N('E',-1),'短3度'],[N('E',-1),N('G',-1),'短3度'],
    [N('C',0),N('E',1),'増3度'],[N('C',0),N('C',1),'増1度'],[N('E',0),N('C',0,5),'短6度'],[N('C',0),N('B',0),'長7度']
  ];
  for(const [a,b,want] of c) assert.equal(fmt(IV.pair(a,b)),want,`${en(a)}→${en(b)}`);
  assert.equal(IV.pair(N('C',0),N('E',0,5)).num,10,'10度');
  assert.deepEqual(IV.label(IV.pair(N('C',0),N('E',0,5))),['広い3度','長3度'],'1オクターブと 3度');
  assert.equal(IV.pair(N('G',0),N('C',0)).lo.letter,0,'低い じゅんに ならべる');
});

test('白鍵だけ：ミファ・シド を またぐ 数で 広さが きまる（3度・5度）', ()=>{
  for(let l=0;l<7;l++){
    const lo=IV.noteAt(28+l,0);
    const t3=IV.info(lo,IV.noteAt(28+l+2,0)), c3=IV.crosses(lo,2).length;
    assert.equal(t3.q,c3?'m':'M',`${en(lo)} の 3度`);
    const t5=IV.info(lo,IV.noteAt(28+l+4,0)), c5=IV.crosses(lo,4).length;
    assert.equal(t5.q,c5===2?'D':'P',`${en(lo)} の 5度`);
    assert.ok(c5>=1,'5度は かならず 1つは またぐ');
    // ほかの 度も：はばは 2×（文字の 差）−（またいだ 数）
    for(let st=0;st<=7;st++){
      const hi=IV.noteAt(28+l+st,0);
      assert.equal(hi.midi-lo.midi,2*st-IV.crosses(lo,st).length,`${en(lo)} +${st}`);
      assert.ok(IV.info(lo,hi).q,`${en(lo)} +${st} の 名前`);
    }
  }
});

test('24調：主音から 音階の 音への へだたり（何度か・広さ）', ()=>{
  const MAJ=['P','M','M','P','P','M','M','P'], MIN=['P','M','m','P','P','m','M','P']; // 短調は 7ばんめを 上げた 音階
  for(const key of KEYS){
    for(let k=0;k<=7;k++){
      const lo=PA.at(key.scale,0), hi=PA.at(key.scale,k), i=IV.info(lo,hi);
      assert.equal(i.num,k+1,`${kn(key)} ${k+1}ばんめ`);
      assert.equal(i.q,(key.minor?MIN:MAJ)[k],`${kn(key)} 主音→${en(hi)}`);
    }
    // 音階の 3度は どれも 広いか せまい（クイズの「広い？せまい？」が かならず 答えられる）
    for(let k=-7;k<7;k++){
      const i=IV.info(PA.at(key.scale,k),PA.at(key.scale,k+2));
      assert.ok(i.q==='M'||i.q==='m',`${kn(key)} ${en(i.lo)}→${en(i.hi)} は ${i.q}`);
      assert.equal(i.num,3);
    }
    // 2度〜8度：音階の 音どうしは 文字の 差＋1
    for(let k=0;k<7;k++) for(let st=1;st<=7;st++){
      const i=IV.info(PA.at(key.scale,k),PA.at(key.scale,k+st));
      assert.equal(i.num,st+1); assert.ok(i.q,`${kn(key)} ${en(i.lo)}→${en(i.hi)}`);
    }
  }
});

test('24調：タップした 2つの 音の 書きかた（調の 音を つかい、名前が いつも つく）', ()=>{
  for(const key of KEYS){
    const inKey=n=>key.scale.concat(key.nat||[]).some(s=>s.letter===n.letter&&s.acc===n.acc);
    // 1つめの 音：音階の 音は 音階の 書きかた
    for(const s of key.scale){
      for(const o of [0,12]){
        const n=IV.spell1(s.midi+o,key);
        assert.equal(n.letter,s.letter,`${kn(key)} ${en(s)}`); assert.equal(n.acc,s.acc,`${kn(key)} ${en(s)}`);
      }
    }
    for(let a=60;a<=84;a++) for(let b=60;b<=84;b++){
      const ns=IV.spell2(a,b,key), i=IV.pair(ns[0],ns[1]);
      assert.equal(ns[0].midi,a); assert.equal(ns[1].midi,b);
      ns.forEach(n=>{assert.equal(pc(n),mod(n.midi,12),`${kn(key)} ${en(n)}`);assert.ok(Math.abs(n.acc)<=1||inKey(n),`${kn(key)} ${en(n)}`);});
      assert.ok(i.steps>=0,`${kn(key)} ${a} ${b}`);
      assert.ok(i.q,`${kn(key)} ${en(ns[0])}${a} ${en(ns[1])}${b} に 名前`);
      if(a===b) assert.equal(i.num,1);
      // 音階の 音どうしは 音階の 書きかた
      const sa=key.scale.find(s=>mod(s.midi,12)===mod(a,12)), sb=key.scale.find(s=>mod(s.midi,12)===mod(b,12));
      if(sa&&sb&&a!==b){
        const lo=a<b?ns[0]:ns[1], hi=a<b?ns[1]:ns[0];
        assert.ok(inKey(lo)&&inKey(hi),`${kn(key)} ${en(lo)}→${en(hi)} は 調の 音`);
      }
    }
  }
  // ハ長調：黒鍵は ふつうの 名前（ド→ミ♭ は 3度。ド→レ♯ の 増2度に しない）
  const C=PA.majorKey(0);
  assert.deepEqual(IV.spell2(60,63,C).map(en),['C','E♭']);
  assert.deepEqual(IV.spell2(60,66,C).map(en),['C','F♯']); // 増4度と 減5度は どちらも とくべつ → ♯の ほう
  assert.deepEqual(IV.spell2(61,64,C).map(en),['C♯','E']);
});

test('24調：♯・♭で 広さを かえる（1だんずつ。増・減 より 先へは 行かない）', ()=>{
  for(const key of KEYS) for(const wn of [3,5,6,7]){
    const base=IV.widget(key,wn,0,0);
    assert.ok(base.ok); assert.equal(base.i.num,wn,`${kn(key)} ${wn}度`);
    const rs=IV.rungs(wn), b=rs.indexOf(base.i.q);
    assert.ok(b>=0);
    for(let ml=-2;ml<=2;ml++) for(let mh=-2;mh<=2;mh++){
      const W=IV.widget(key,wn,ml,mh), want=b+mh-ml;
      assert.equal(W.i.num,wn,'文字が おなじなら 度は かわらない');
      assert.equal(W.lo.letter,base.lo.letter); assert.equal(W.hi.letter,base.hi.letter);
      assert.equal(pc(W.lo),mod(W.lo.midi,12)); assert.equal(pc(W.hi),mod(W.hi.midi,12));
      const inRange=want>=0&&want<rs.length&&Math.abs(W.lo.acc)<=2&&Math.abs(W.hi.acc)<=2;
      assert.equal(W.ok,inRange,`${kn(key)} ${wn}度 ${ml},${mh}`);
      if(W.ok) assert.equal(W.i.q,rs[want],`${kn(key)} ${wn}度 ${en(W.lo)}→${en(W.hi)}`);
    }
  }
  // ページの リンク先の 名前
  const C=PA.majorKey(0);
  assert.equal(fmt(IV.widget(C,6,0,1).i),'増6度');
  assert.equal(fmt(IV.widget(C,3,0,-2).i),'減3度');
  assert.equal(fmt(IV.widget(C,7,0,-2).i),'減7度');
});

test('名前の 表示（音名の せってい 3つ）に undefined などが 出ない', ()=>{
  for(const naming of ['solfa','en','ja']){
    PA.settings.naming=naming;
    let s='';
    for(const key of KEYS){
      for(let a=60;a<=84;a+=1){const ns=IV.spell2(a,a+((a*7)%13),key);s+=PA.namesH(ns)+IV.label(IV.pair(ns[0],ns[1])).join('');}
      for(const wn of [3,5,6,7]) for(let d=-1;d<=1;d++){const W=IV.widget(key,wn,0,d);if(W.ok)s+=PA.namesH([W.lo,W.hi])+IV.label(W.i).join('');}
    }
    for(const bad of ['undefined','NaN','null','[object']) assert.ok(!s.includes(bad),`${naming}: ${bad}`);
  }
  PA.settings.naming='solfa';
});
