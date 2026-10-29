// 7つの 和音（diatonic.html）の テスト：node --test test/
// ページの <dia-logic> の ところだけ 切りだして、13の長調・13の短調（24調と、べつの 書きかた 2つ）すべてで たしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA(), mod=PA.mod;
const html=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','diatonic.html'),'utf8');
const m=html.match(/\/\/ <dia-logic>[^\n]*\n([\s\S]*?)\/\/ <\/dia-logic>/);
assert.ok(m,'diatonic.html に <dia-logic> の しるしが ない');
const DIA=new Function('PA',m[1]+'\nreturn DIA;')(PA);

const KEYS=[...Array(13).keys()].flatMap(i=>[PA.keyOf(false,i,60),PA.keyOf(true,i,60)]);
const kn=k=>PA.keyName(k);
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const nm=ns=>ns.map(n=>PA.LET_EN[n.letter]+PA.ACC[n.acc]+n.midi).join(' ');
const QMAJ=['maj','min','min','maj','maj','min','dim'], QMIN=['min','dim','maj','min','maj','maj','dim'];

test('Ⅰ〜Ⅶ：音階の なんばんめから ひとつとばし（文字・高さ・つづり）',()=>{
  for(const key of KEYS) for(let d=0;d<7;d++){
    const t=DIA.tones(key,d), lab=`${kn(key)} ${DIA.ROM[d]} ${nm(t)}`;
    assert.equal(t.length,3,lab);
    assert.equal(t[0].letter,(key.l+d)%7,lab+'：根音の 文字');
    t.forEach((n,j)=>{
      assert.equal(n.letter,(t[0].letter+2*j)%7,lab+'：ひとつとばしの 文字');
      assert.equal(pc(n),mod(n.midi,12),lab+'：つづりと 高さ');
    });
    assert.ok(t[0].midi<t[1].midi&&t[1].midi<t[2].midi,lab+'：下から 上へ');
    assert.ok(t[0].midi>=60&&t[2].midi<=88,lab+'：けんばん（ド4〜ミ6）の 中');
    // 短調：Ⅴ・Ⅶ だけ 7ばんめを 上げる（Ⅲ は 上げない）
    t.forEach(n=>{
      const is7=key.minor&&n.letter===key.natLT.letter;
      if(is7&&(d===4||d===6)){assert.ok(n.raised,lab+'：上げた 7ばんめ');assert.equal(n.acc,key.natLT.acc+1,lab);}
      else assert.equal(n.acc,key.sig[n.letter]||0,lab+'：調号どおり');
    });
  }
});

test('ひびき：長調 ☀️☁️☁️☀️☀️☁️💓、短調 ☁️💓☀️☁️☀️☀️💓（どの 調でも おなじ）',()=>{
  for(const key of KEYS) for(let d=0;d<7;d++){
    assert.equal(DIA.quality(DIA.tones(key,d)),(key.minor?QMIN:QMAJ)[d],`${kn(key)} ${DIA.ROM[d]}`);
  }
});

test('コードネーム（ハ長調・イ短調）',()=>{
  const C=PA.majorKey(0), Am=PA.minorKey(0);
  assert.deepEqual([0,1,2,3,4,5,6].map(d=>DIA.sym(DIA.tones(C,d))),['C','Dm','Em','F','G','Am','Bdim']);
  assert.deepEqual([0,1,2,3,4,5,6].map(d=>DIA.sym(DIA.tones(Am,d))),['Am','Bdim','C','Dm','E','F','G♯dim']);
});

test('3つの なかま：どの 和音も 1つの なかま。中心の 和音と おなじ 音が 2つ',()=>{
  for(let d=0;d<7;d++) assert.equal(DIA.FAMS.filter(f=>f.ds.includes(d)).length,1,DIA.ROM[d]);
  assert.deepEqual(DIA.FAMS.map(f=>f.ds),[[0,5,2],[3,1],[4,6]]);
  for(const key of KEYS) DIA.FAMS.forEach(F=>F.ds.filter(d=>d!==F.head).forEach(d=>{
    assert.equal(DIA.common(key,d,F.head).length,2,`${kn(key)} ${DIA.ROM[d]} と ${DIA.ROM[F.head]}`);
  }));
});

test('ながれ：和音の 音・左手は 根音・右手は まとまった 形・平行の 5度と 8度なし',()=>{
  for(const key of KEYS) for(const pid of Object.keys(DIA.PROGS)){
    const fl=DIA.flow(key,pid), seq=DIA.PROGS[pid], lab0=`${kn(key)} ${pid}`;
    assert.deepEqual(fl.map(c=>c.d),seq,lab0);
    fl.forEach((c,i)=>{
      const lab=`${lab0} ${i+1}つめ ${DIA.ROM[c.d]} ${nm(c.lh)} | ${nm(c.rh)}`, t=DIA.tones(key,c.d);
      [...c.lh,...c.rh].forEach(n=>assert.equal(pc(n),mod(n.midi,12),lab+'：つづりと 高さ'));
      assert.deepEqual(c.rh.map(n=>n.letter*10+n.acc).sort(),t.map(n=>n.letter*10+n.acc).sort(),lab+'：右手は 和音の 3つの 音');
      assert.equal(c.lh[0].letter,t[0].letter,lab+'：左手は 根音');
      assert.equal(c.lh[0].acc,t[0].acc,lab);
      assert.ok(c.lh[0].midi>=40&&c.lh[0].midi<=59,lab+'：左手は ミ2〜シ3');
      assert.ok(c.lh[0].midi<=c.rh[0].midi-3,lab+'：左手が いちばん下');
      assert.ok(c.rh[0].midi<c.rh[1].midi&&c.rh[1].midi<c.rh[2].midi&&c.rh[2].midi-c.rh[0].midi<12,lab+'：右手は 1オクターブの 中');
      if(i===0){assert.deepEqual(c.rh.map(n=>n.midi),t.map(n=>n.midi),lab+'：はじめは Ⅰ の もとの 形');assert.ok(c.lh[0].midi>=48,lab);}
      if(i>0){
        const p=fl[i-1], A=[p.lh[0].midi,...p.rh.map(n=>n.midi)], B=[c.lh[0].midi,...c.rh.map(n=>n.midi)];
        assert.equal(DIA.parallels(A,B),0,lab+'：平行の 5度・8度');
        assert.ok(Math.abs(B[0]-A[0])<=9,lab+'：左手の とびが 大きすぎない');
        for(let v=1;v<4;v++) assert.ok(Math.abs(B[v]-A[v])<=5,lab+'：右手が なめらか');
      }
    });
  }
});

test('たしかめ：選択肢は ちがう ものが 4つ（3つ）、こたえが 入っている',()=>{
  let s=1;const rnd=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};
  for(let r=0;r<300;r++){
    const Q=DIA.quiz(rnd);
    assert.equal(Q.length,3);
    const [a,b,c]=Q;
    assert.equal(a.choices.length,4); assert.equal(new Set(a.choices).size,4); assert.ok(a.choices.includes(a.ans));
    assert.ok([1,2,5,6].includes(a.d)&&[1,2,5,6].includes(b.d));
    assert.equal(b.ans,DIA.famOf(b.d)); assert.deepEqual(b.choices,[0,1,2]);
    assert.ok(new Set([a.d,b.d,c.d]).size===3,'おなじ 和音を 2回 きかない');
    for(const key of KEYS) for(const x of Q) DIA.tones(key,x.d); // どの 調でも つくれる
    // ひびきの 選択肢に こたえが ある（増三和音は 出ない）
    for(const key of KEYS) assert.ok(c.choices.includes(DIA.quality(DIA.tones(key,c.d))));
    // 4つの 選択肢の 音は どの 調でも ちがう
    for(const key of KEYS) assert.equal(new Set(a.choices.map(d=>nm(DIA.tones(key,d)))).size,4);
  }
});
