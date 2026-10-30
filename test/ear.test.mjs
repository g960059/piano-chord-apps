// 和音の聴きわけ（ear.html）のテスト：node --test test/
// ear.html の「ここから test/ear.test.mjs もよむ」〜「ここまで」を読みこんでたしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','ear.html'),'utf8');
const A=html.indexOf('/* ===== ここから test/ear.test.mjs もよむ'), B=html.indexOf('/* ===== ここまで ===== */');
assert.ok(A>0&&B>A,'ear.html にテスト用のしるしがない');
const PA=loadPA();
const ctx=vm.createContext({PA});
const E=vm.runInContext(html.slice(A,B)+';({T,ORDER,LEVELS,MAXLV,build,makeQ,validQ,abNotes,readLink,replaysOf})',ctx);
const J=x=>JSON.parse(JSON.stringify(x));
const mod=PA.mod;
const pcs=ms=>ms.map(m=>mod(m,12)).sort((a,b)=>a-b);
const rootPc=q=>mod(PA.NAT[q.root.letter]+q.root.acc,12);

// どのレベル・どのしゅるいも何回もつくってためす
const QS=[];
for(let lv=1;lv<=E.MAXLV;lv++) for(let i=0;i<400;i++) QS.push(E.makeQ(lv,null,i%2?'ch':'free'));

test('makeQ：つくったもんだいは validQ をとおる',()=>{
  QS.forEach(q=>assert.ok(E.validQ(q,q.lv),JSON.stringify(q)));
});

test('replaysOf：れんしゅうはいつもなんどでも、チャレンジはレベルのきまり',()=>{
  for(let lv=1;lv<=E.MAXLV;lv++){
    assert.equal(E.replaysOf(lv,'free'),null);
    assert.equal(E.replaysOf(lv,'ch'),E.LEVELS[lv].replays==null?null:E.LEVELS[lv].replays);
  }
  assert.equal(E.replaysOf(5,'ch'),3);
  assert.equal(E.replaysOf(8,'ch'),2);
  assert.equal(E.replaysOf(1,'ch'),null);
});

test('LEVELS：どのレベルにも小さな説明がある',()=>{
  for(let lv=1;lv<=E.MAXLV;lv++){
    const L=E.LEVELS[lv];
    assert.ok(typeof L.desc==='string'&&L.desc.length>0&&L.desc.length<=24,`レベル${lv}`);
  }
});

test('abNotes：せいかいのしゅるいならもんだいとおなじ音',()=>{
  QS.forEach(q=>assert.deepEqual(J(E.abNotes(q,q.type)),J(q.notes.map(n=>n.midi)),JSON.stringify(q)));
});

test('abNotes：ほかのしゅるいはおなじ根音・おなじつみかた（ちがうのはしゅるいだけ）',()=>{
  QS.forEach(q=>{
    const from=E.T[q.type].ints;
    E.ORDER.forEach(t=>{
      const ms=J(E.abNotes(q,t)), to=E.T[t].ints, w=`${q.type}→${t} ${JSON.stringify(q.notes.map(n=>n.midi))} → ${ms}`;
      assert.equal(ms.length,to.length,w);
      // 音の高さの名前は、おなじ根音からつくったそのしゅるいの和音
      assert.deepEqual(J(pcs(ms)),J(pcs(to.map(([,s])=>rootPc(q)+s))),w);
      // おなじ音は2つない
      assert.equal(new Set(ms).size,ms.length,w);
      // 根音の高さ（オクターブも）はそのまま
      const r=q.notes.find(n=>mod(n.midi-rootPc(q),12)===0).midi;
      assert.ok(ms.includes(r),w+'根音');
      // 音の数がおなじ（三和音どうし・七の和音どうし）か、三和音 → 七の和音なら、いちばん下の音の役はおなじ
      if(to.length>=from.length){
        const role=(m,ints)=>ints.findIndex(([,s])=>mod(m-r-s,12)===0);
        assert.equal(role(ms[0],to),role(q.notes[0].midi,from),w+'いちばん下');
      }
      // はばは2オクターブよりせまい（鳴らしてへんにならない）
      assert.ok(ms[ms.length-1]-ms[0]<24,w+'はば');
    });
  });
});

test('readLink：ただしい値だけつかう',()=>{
  const R=p=>J(E.readLink(p));
  assert.deepEqual(R({}),{mode:null,level:null,n:null});
  assert.deepEqual(R({mode:'practice'}),{mode:'free',level:null,n:null});
  assert.deepEqual(R({mode:'challenge'}),{mode:'ch',level:null,n:null});
  assert.deepEqual(R({mode:'practice',level:'3',n:'5'}),{mode:'free',level:3,n:5});
  // level・n だけでもれんしゅう
  assert.deepEqual(R({level:'8'}),{mode:'free',level:8,n:null});
  assert.deepEqual(R({n:'20'}),{mode:'free',level:null,n:20});
  // チャレンジでは level・n はつかわない
  assert.deepEqual(R({mode:'challenge',level:'5',n:'5'}),{mode:'ch',level:null,n:null});
  // へんな値はすてる
  assert.deepEqual(R({mode:'free',level:'9',n:'0'}),{mode:null,level:null,n:null});
  assert.deepEqual(R({mode:'<b>',level:'1e0',n:'21'}),{mode:null,level:null,n:null});
  assert.deepEqual(R({level:'03'}),{mode:null,level:null,n:null});
  assert.deepEqual(R({level:' 3',n:'5 '}),{mode:null,level:null,n:null});
  assert.deepEqual(R(PA.parseParams('?mode=practice&level=2&n=5&x=1')),{mode:'free',level:2,n:5});
});
