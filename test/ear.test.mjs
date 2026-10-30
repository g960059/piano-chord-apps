// 和音の 聴きわけ（ear.html）の テスト：node --test test/
// ear.html の「ここから test/ear.test.mjs も よむ」〜「ここまで」を 読みこんで たしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','ear.html'),'utf8');
const A=html.indexOf('/* ===== ここから test/ear.test.mjs も よむ'), B=html.indexOf('/* ===== ここまで ===== */');
assert.ok(A>0&&B>A,'ear.html に テスト用の しるしが ない');
const PA=loadPA();
const ctx=vm.createContext({PA});
const E=vm.runInContext(html.slice(A,B)+';({T,ORDER,LEVELS,MAXLV,build,makeQ,validQ,abNotes,readLink,replaysOf})',ctx);
const J=x=>JSON.parse(JSON.stringify(x));
const mod=PA.mod;
const pcs=ms=>ms.map(m=>mod(m,12)).sort((a,b)=>a-b);
const rootPc=q=>mod(PA.NAT[q.root.letter]+q.root.acc,12);

// どの レベル・どの しゅるいも 何回も つくって ためす
const QS=[];
for(let lv=1;lv<=E.MAXLV;lv++) for(let i=0;i<400;i++) QS.push(E.makeQ(lv,null,i%2?'ch':'free'));

test('makeQ：つくった もんだいは validQ を とおる',()=>{
  QS.forEach(q=>assert.ok(E.validQ(q,q.lv),JSON.stringify(q)));
});

test('replaysOf：れんしゅうは いつも なんどでも、チャレンジは レベルの きまり',()=>{
  for(let lv=1;lv<=E.MAXLV;lv++){
    assert.equal(E.replaysOf(lv,'free'),null);
    assert.equal(E.replaysOf(lv,'ch'),E.LEVELS[lv].replays==null?null:E.LEVELS[lv].replays);
  }
  assert.equal(E.replaysOf(5,'ch'),3);
  assert.equal(E.replaysOf(8,'ch'),2);
  assert.equal(E.replaysOf(1,'ch'),null);
});

test('LEVELS：どの レベルにも 小さな 説明が ある',()=>{
  for(let lv=1;lv<=E.MAXLV;lv++){
    const L=E.LEVELS[lv];
    assert.ok(typeof L.desc==='string'&&L.desc.length>0&&L.desc.length<=24,`レベル${lv}`);
  }
});

test('abNotes：せいかいの しゅるいなら もんだいと おなじ 音',()=>{
  QS.forEach(q=>assert.deepEqual(J(E.abNotes(q,q.type)),J(q.notes.map(n=>n.midi)),JSON.stringify(q)));
});

test('abNotes：ほかの しゅるいは おなじ 根音・おなじ つみかた（ちがうのは しゅるいだけ）',()=>{
  QS.forEach(q=>{
    const from=E.T[q.type].ints;
    E.ORDER.forEach(t=>{
      const ms=J(E.abNotes(q,t)), to=E.T[t].ints, w=`${q.type}→${t} ${JSON.stringify(q.notes.map(n=>n.midi))} → ${ms}`;
      assert.equal(ms.length,to.length,w);
      // 音の 高さの 名前は、おなじ 根音から つくった その しゅるいの 和音
      assert.deepEqual(J(pcs(ms)),J(pcs(to.map(([,s])=>rootPc(q)+s))),w);
      // おなじ 音は 2つ ない
      assert.equal(new Set(ms).size,ms.length,w);
      // 根音の 高さ（オクターブも）は そのまま
      const r=q.notes.find(n=>mod(n.midi-rootPc(q),12)===0).midi;
      assert.ok(ms.includes(r),w+' 根音');
      // 音の 数が おなじ（三和音どうし・七の和音どうし）か、三和音 → 七の和音 なら、いちばん下の 音の 役は おなじ
      if(to.length>=from.length){
        const role=(m,ints)=>ints.findIndex(([,s])=>mod(m-r-s,12)===0);
        assert.equal(role(ms[0],to),role(q.notes[0].midi,from),w+' いちばん下');
      }
      // はばは 2オクターブ より せまい（鳴らして へんに ならない）
      assert.ok(ms[ms.length-1]-ms[0]<24,w+' はば');
    });
  });
});

test('readLink：ただしい 値だけ つかう',()=>{
  const R=p=>J(E.readLink(p));
  assert.deepEqual(R({}),{mode:null,level:null,n:null});
  assert.deepEqual(R({mode:'practice'}),{mode:'free',level:null,n:null});
  assert.deepEqual(R({mode:'challenge'}),{mode:'ch',level:null,n:null});
  assert.deepEqual(R({mode:'practice',level:'3',n:'5'}),{mode:'free',level:3,n:5});
  // level・n だけでも れんしゅう
  assert.deepEqual(R({level:'8'}),{mode:'free',level:8,n:null});
  assert.deepEqual(R({n:'20'}),{mode:'free',level:null,n:20});
  // チャレンジでは level・n は つかわない
  assert.deepEqual(R({mode:'challenge',level:'5',n:'5'}),{mode:'ch',level:null,n:null});
  // へんな 値は すてる
  assert.deepEqual(R({mode:'free',level:'9',n:'0'}),{mode:null,level:null,n:null});
  assert.deepEqual(R({mode:'<b>',level:'1e0',n:'21'}),{mode:null,level:null,n:null});
  assert.deepEqual(R({level:'03'}),{mode:null,level:null,n:null});
  assert.deepEqual(R({level:' 3',n:'5 '}),{mode:null,level:null,n:null});
  assert.deepEqual(R(PA.parseParams('?mode=practice&level=2&n=5&x=1')),{mode:'free',level:2,n:5});
});
