// 和音クイズ（chord-quiz.html）のテスト：node --test test/
// ページの<cq-logic>のところだけ切りだして、リンクのパラメータ・⭐の数えかた・もんだいとえらぶ答えをたしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA(), mod=PA.mod;
const html=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','chord-quiz.html'),'utf8');
const m=html.match(/\/\/ <cq-logic>[^\n]*\n([\s\S]*?)\/\/ <\/cq-logic>/);
assert.ok(m,'chord-quiz.html に<cq-logic>のしるしがない');
const CQ=new Function('PA',m[1]+'\nreturn {CHORDS,CHORD_IDS,FIRST,chordTones,makeChoices,linkSettings,linkSig,sameKeyIds,scoreAnswer};')(PA);

const KEYS=[...Array(13).keys()].flatMap(i=>[{minor:false,keyIdx:i},{minor:true,keyIdx:i}]);
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const plain=o=>JSON.parse(JSON.stringify(o));

test('はじめての人：長調・やさしい・ⅠⅣⅤ（Ⅴ7なし）・けんばん',()=>{
  assert.deepEqual(plain(CQ.FIRST),{type:'keys',tier:'easy',keyset:'major',chords:{I:true,IV:true,V:true,V7:false}});
});

test('リンクのパラメータ：きまった値だけとる',()=>{
  assert.deepEqual(plain(CQ.linkSettings(PA.parseParams('?key=M1&chord=I,V7&mode=choice&tier=normal&keyset=minor&n=5'))),
    {type:'choice',tier:'normal',keyset:'minor',chords:{I:true,IV:false,V:false,V7:true},key:'M1',n:5});
  // わからない値・あぶない文字はすてる
  const bad=CQ.linkSettings(PA.parseParams('?key=M13&chord=II,%3Cb%3E&mode=ear&tier=super&keyset=all&n=0'));
  assert.deepEqual(plain(bad),{});
  assert.deepEqual(plain(CQ.linkSettings(PA.parseParams('?key=m01&n=21'))),{},'0ではじまる番号・21もんはだめ');
  assert.deepEqual(plain(CQ.linkSettings(PA.parseParams('?key=%22%3E%3Cscript%3E&n=3'))),{n:3});
  assert.deepEqual(plain(CQ.linkSettings(PA.parseParams('?chord=V'))),{chords:{I:false,IV:false,V:true,V7:false}});
  assert.deepEqual(plain(CQ.linkSettings({})),{});
  assert.deepEqual(plain(CQ.linkSettings(null)),{});
});

test('リンクのしるし：おなじせっていならおなじ文字',()=>{
  const a=CQ.linkSettings(PA.parseParams('?tier=easy&chord=I,IV,V&n=5')), b=CQ.linkSettings(PA.parseParams('?n=5&chord=V,I,IV&tier=easy'));
  assert.equal(CQ.linkSig(a),CQ.linkSig(b));
  assert.equal(CQ.linkSig(a),'chord=I,IV,V&tier=easy');
  assert.notEqual(CQ.linkSig(a),CQ.linkSig(CQ.linkSettings(PA.parseParams('?tier=easy&chord=I,IV,V&keyset=minor'))));
});

test('この調だけ：おなじ音の2つの書きかたはいっしょ',()=>{
  assert.deepEqual([...CQ.sameKeyIds('M6')].sort(),['M12','M6']);
  assert.deepEqual([...CQ.sameKeyIds('M12')].sort(),['M12','M6']);
  assert.deepEqual([...CQ.sameKeyIds('m6')].sort(),['m12','m6']);
  assert.deepEqual([...CQ.sameKeyIds('M1')],['M1']);
  assert.deepEqual([...CQ.sameKeyIds('x')],[]);
});

test('⭐：ヒントを見てできたときはふやさず、れんぞくもそのまま',()=>{
  const s={right:2,total:2,streak:2};
  CQ.scoreAnswer(s,true,true); assert.deepEqual(s,{right:2,total:3,streak:2});
  CQ.scoreAnswer(s,true,false); assert.deepEqual(s,{right:3,total:4,streak:3});
  CQ.scoreAnswer(s,false,true); assert.deepEqual(s,{right:3,total:5,streak:0},'ヒントを見てもまちがいは ×');
  CQ.scoreAnswer(s,false,false); assert.deepEqual(s,{right:3,total:6,streak:0});
});

test('和音の音と4つのえらぶ答え（26調 × ⅠⅣⅤⅤ7）',()=>{
  for(const q0 of KEYS) for(const ch of CQ.CHORD_IDS){
    const q={...q0,chord:ch}, key=PA.keyOf(q.minor,q.keyIdx,60), t=CQ.chordTones(key,ch), c=CQ.CHORDS[ch];
    const lab=`${PA.keyName(key)} ${c.label}`;
    assert.equal(t.length,c.n,lab);
    t.forEach((n,j)=>{
      assert.equal(n.letter,(key.l+c.deg+2*j)%7,lab+'：ひとつとばし');
      assert.equal(pc(n),mod(n.midi,12),lab+'：つづりと高さ');
      assert.ok(n.midi>=60&&n.midi<=88,lab+'：けんばんの中');
    });
    if(key.minor&&(ch==='V'||ch==='V7')) assert.ok(t.some(n=>n.raised),lab+'：7ばんめを上げる');
    for(let r=0;r<5;r++){
      const cs=CQ.makeChoices(q), sig=a=>a.map(n=>n.letter+':'+n.acc).join(',');
      assert.equal(cs.length,4,lab);
      assert.equal(cs.filter(x=>x.ok).length,1,lab+'：こたえは1つ');
      assert.equal(new Set(cs.map(x=>sig(x.notes))).size,4,lab+'：おなじ答えがない');
      assert.equal(sig(cs.find(x=>x.ok).notes),sig(t),lab);
    }
  }
});
