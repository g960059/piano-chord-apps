// PA.ending（おわりかた：6つの 終止）の テスト：node --test test/
// 13の長調・13の短調（24調と、べつの 書きかた 2つ）すべてで たしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA(), E=PA.ending, mod=PA.mod;
const KEYS=[...Array(13).keys()].flatMap(i=>[PA.keyOf(false,i,60),PA.keyOf(true,i,60)]);
const kn=k=>PA.keyName(k);
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const nm=ns=>ns.map(n=>PA.LET_EN[n.letter]+PA.ACC[n.acc]+n.midi).join(' ');
const J=x=>JSON.parse(JSON.stringify(x));
// 根音から 見た 和音の 音（[文字の差, 半音の差]）
const ROOT={I:0,IV:3,V:4,V7:4,VI:5};
const TRI={maj:[[0,0],[2,4],[4,7]],min:[[0,0],[2,3],[4,7]]};
const quality=(key,ch)=>{
  if(ch==='V') return TRI.maj; // 短調も 7ばんめを 上げて 長三和音
  if(ch==='V7') return [...TRI.maj,[6,10]];
  if(key.minor) return ch==='VI'?TRI.maj:TRI.min; // 短調：Ⅰ・Ⅳ＝短三和音、Ⅵ＝長三和音
  return ch==='VI'?TRI.min:TRI.maj;
};
// 調の 主音から その和音の 根音までの 半音（長調＝長音階、短調＝自然的短音階。Ⅴ は どちらも 7）
const rootSemi=(key,ch)=>(key.minor?PA.NMIN:PA.MAJ)[ROOT[ch]];
// 調ごとに つくれる ならび
const patsFor=key=>E.PATTERNS.filter(p=>E.allowed(key,p.type));
const each=fn=>{for(const key of KEYS) for(const p of patsFor(key)){const d=E.build(key,p.type,p.variant);fn(key,p,d,`${kn(key)} ${p.id}`);}};
const voices=c=>[c.lh[0],...c.rh];

test('TYPES：6つ、名前・よみ・ニックネーム・説明がある。フリギアだけ 短調だけ',()=>{
  assert.deepEqual(J(E.IDS),['perfect','imperfect','half','plagal','deceptive','phrygian']);
  E.TYPES.forEach(t=>{
    ['name','yomi','nick','short','emoji','color','light'].forEach(f=>assert.ok(typeof t[f]==='string'&&t[f].length>0,t.id+' '+f));
    assert.equal(t.minorOnly,t.id==='phrygian');
    assert.equal(t.family,t.id==='perfect'||t.id==='imperfect'?'full':null);
  });
  assert.equal(E.FULL.name,'全終止');
  assert.equal(E.type('full'),E.FULL);
  assert.equal(E.type('x'),null);
  assert.equal(E.PATTERNS.length,7);
});

test('どの調でも：えらべる ならびは ぜんぶ 4つの 和音。フリギアは 長調では null',()=>{
  for(const key of KEYS){
    for(const t of E.IDS){
      const d=E.build(key,t,'A');
      if(t==='phrygian'&&!key.minor){assert.equal(d,null,kn(key));continue;}
      assert.ok(Array.isArray(d)&&d.length===4,`${kn(key)} ${t}`);
    }
    assert.equal(patsFor(key).length,key.minor?7:6);
    assert.equal(E.build(key,'nope'),null);
  }
});

test('ならびの 和音と 名前（ローマ数字・てんかい）',()=>{
  const want={perfect:['I','IV','V7','I'],imperfectA:['I','IV','V7','I'],imperfectB:['I','IV','V7','I'],half:['I','IV','I','V'],
    plagal:['I','VI','IV','I'],deceptive:['I','IV','V7','VI'],phrygian:['I','VI','IV','V']};
  const L={I:'Ⅰ',IV:'Ⅳ',V:'Ⅴ',V7:'Ⅴ7',VI:'Ⅵ'};
  each((key,p,d,w)=>{
    assert.deepEqual(J(d.map(c=>c.ch)),want[p.id],w);
    d.forEach((c,i)=>{
      assert.equal(c.label,L[c.ch],w);
      // 不完全B の Ⅴ7 は 第2転回形（いちばん下が 第5音）、フリギアの Ⅳ は 第1転回形（いちばん下が 第3音）
      const inv=p.id==='imperfectB'&&i===2?2:p.id==='phrygian'&&i===2?1:0;
      assert.equal(c.inv,inv,`${w} ${i} の 形`);
      assert.equal(E.labelText(c),c.label+(inv?'（てんかい）':''));
      assert.equal(c.rh.length,3,w);
      assert.equal(c.lh.length,1,w);
      // いちばん下の 音の 度数（0〜6）
      assert.equal(mod(c.lh[0].letter-key.l,7),c.bassDeg,w);
      assert.equal(mod(c.bassDeg-ROOT[c.ch],7),[0,2,4][inv],`${w} ${i} いちばん下`);
    });
  });
});

test('(a) 右手も 左手も その和音の 音（つづりも 高さも）。表示の 音＝鳴らす 音',()=>{
  each((key,p,d,w)=>d.forEach((c,i)=>{
    const rL=mod(key.l+ROOT[c.ch],7), rP=mod(key.tpc+rootSemi(key,c.ch),12), q=quality(key,c.ch);
    voices(c).forEach(n=>{
      const ww=`${w} ${i}（${c.label}）${nm(voices(c))}`;
      ['letter','acc','midi'].forEach(f=>assert.ok(Number.isInteger(n[f]),ww+' '+f));
      assert.ok(Math.abs(n.acc)<=2,ww);
      assert.equal(mod(n.midi,12),pc(n),ww+' 高さと つづり');
      const m=q.find(([l])=>l===mod(n.letter-rL,7));
      assert.ok(m,ww+' 和音に ない 文字');
      assert.equal(pc(n),mod(rP+m[1],12),ww+' 和音に ない 音');
    });
    // 根音と 第3音は かならず ある（Ⅴ7 は 第7音も）
    const has=l=>voices(c).some(n=>mod(n.letter-rL,7)===l);
    assert.ok(has(0)&&has(2),`${w} ${i} 根音・第3音`);
    if(c.ch==='V7') assert.ok(has(6),`${w} ${i} 第7音`);
  }));
});

test('短調：Ⅴ・Ⅴ7 の 7ばんめは 上げた音、Ⅳ・Ⅵ・Ⅰ は 調号どおり',()=>{
  each((key,p,d,w)=>{
    if(!key.minor) return;
    d.forEach((c,i)=>voices(c).forEach(n=>{
      const deg=mod(n.letter-key.l,7);
      if(c.ch==='V'||c.ch==='V7'){
        if(deg===6){assert.equal(pc(n),mod(key.tpc+11,12),`${w} ${i} 7ばんめ`);assert.ok(n.raised,`${w} ${i} raised`);}
      }else{
        assert.ok(!n.raised,`${w} ${i} raised`);
        assert.equal(n.acc,key.sig[n.letter],`${w} ${i} 調号どおり ${nm([n])}`);
      }
    }));
  });
  // 不完全B の Ⅴ7（てんかい）の いちばん下は 2ばんめ（レ）。上げた 7ばんめでは ない
  for(const key of KEYS){
    const b=E.build(key,'imperfect','B')[2].lh[0];
    assert.equal(mod(b.letter-key.l,7),1,kn(key));
    assert.ok(!b.raised,kn(key));
  }
});

// 平行の 5度・8度（ピッチクラスで 7 か 0、どちらの 声も おなじ 向きに うごく）
const parallels=(A,B,sameDir)=>{
  const out=[];
  for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++){
    const a=mod(A[j].midi-A[i].midi,12), b=mod(B[j].midi-B[i].midi,12);
    const di=Math.sign(B[i].midi-A[i].midi), dj=Math.sign(B[j].midi-A[j].midi);
    if(a===b&&(a===0||a===7)&&di&&dj&&(sameDir?di===dj:di!==dj)) out.push(`${a?5:8}度 声${i}-声${j}`);
  }
  return out;
};
test('(b) となりの 和音で、平行の 5度・8度（おなじ 向き）が ない',()=>{
  each((key,p,d,w)=>{for(let i=1;i<4;i++){
    const A=voices(d[i-1]), B=voices(d[i]), bad=parallels(A,B,true);
    assert.deepEqual(bad,[],`${w} ${i}→${i+1}: ${nm(A)} → ${nm(B)}`);
  }});
});
test('(b2) 反対の 向きの 5度・8度も ない',()=>{
  each((key,p,d,w)=>{for(let i=1;i<4;i++){
    const A=voices(d[i-1]), B=voices(d[i]), bad=parallels(A,B,false);
    assert.deepEqual(bad,[],`${w} ${i}→${i+1}: ${nm(A)} → ${nm(B)}`);
  }});
});

test('(c)(d) 左手は 右手の いちばん下より 下・ミ2〜シ3。右手の はばは 1オクターブまで',()=>{
  each((key,p,d,w)=>d.forEach((c,i)=>{
    const ms=c.rh.map(n=>n.midi), b=c.lh[0].midi;
    assert.ok(b<Math.min(...ms),`${w} ${i}: ${nm(voices(c))}`);
    assert.ok(b>=40&&b<=59,`${w} ${i}: 左手 ${b}`);
    assert.ok(Math.max(...ms)-Math.min(...ms)<=12,`${w} ${i}: 右手の はば`);
    for(let j=1;j<3;j++) assert.ok(ms[j]>ms[j-1],`${w} ${i}: 右手は 下から じゅんに`);
    assert.ok(ms.every(m=>m>=53&&m<=84),`${w} ${i}: 右手の 高さ`);
  }));
  // 1つめの 左手は 主音で ド3〜シ3
  each((key,p,d,w)=>{const b=d[0].lh[0];assert.equal(mod(b.midi,12),key.tpc,w);assert.ok(b.midi>=48&&b.midi<=59,w);});
});

test('(e) 完全終止は さいごの いちばん上が 主音、不完全終止A は 主音では ない',()=>{
  for(const key of KEYS){
    const top=d=>d[3].rh[2];
    assert.equal(pc(top(E.build(key,'perfect'))),key.tpc,kn(key));
    assert.notEqual(pc(top(E.build(key,'imperfect','A'))),key.tpc,kn(key));
    // 不完全B：Ⅴ7 の いちばん下が 根音では ない（さいごの Ⅰ は 基本形で、いちばん上は 主音）
    const b=E.build(key,'imperfect','B');
    assert.notEqual(mod(b[2].lh[0].letter-key.l,7),4,kn(key));
    assert.equal(b[3].inv,0);
    assert.equal(pc(top(b)),key.tpc,kn(key)+' 不完全B の さいごの 上');
    // 完全終止：Ⅴ7 も Ⅰ も いちばん下が 根音
    const pf=E.build(key,'perfect');
    assert.equal(mod(pf[2].lh[0].letter-key.l,7),4); assert.equal(mod(pf[3].lh[0].letter-key.l,7),0);
    // 不完全B と 完全終止の ちがいは 3つめ（Ⅴ7）の いちばん下だけ
    const sig=c=>c.ch+':'+c.rh.map(n=>n.midi).join(',');
    assert.deepEqual(J(b.map(sig)),J(pf.map(sig)),kn(key));
    // 左手の 音名（高さの オクターブは 4つ まとめて えらぶので ちがうことも ある）
    const ln=c=>c.lh[0].letter+':'+c.lh[0].acc;
    [0,1,3].forEach(i=>assert.equal(ln(b[i]),ln(pf[i]),`${kn(key)} ${i}`));
    assert.notEqual(ln(b[2]),ln(pf[2]),kn(key));
    assert.deepEqual(J(b.map(c=>c.bassDeg)),[0,3,1,0],kn(key));
    assert.equal(E.labelText(b[2]),'Ⅴ7（てんかい）');
  }
});

test('(g) 左手は 長6度より 大きく とばない。偽終止の Ⅴ7 → Ⅵ は 左手が 1つ 上がる',()=>{
  each((key,p,d,w)=>{for(let i=1;i<4;i++){const x=d[i].lh[0].midi-d[i-1].lh[0].midi;assert.ok(Math.abs(x)<=9,`${w} ${i}: ${x}`);}});
  for(const key of KEYS){const d=E.build(key,'deceptive'),x=d[3].lh[0].midi-d[2].lh[0].midi;assert.ok(x===1||x===2,`${kn(key)} ${x}`);}
});

test('(h) どの 声も 増2度（となりの 文字で 半音3つ）を とばない',()=>{
  each((key,p,d,w)=>{for(let i=1;i<4;i++){const A=voices(d[i-1]),B=voices(d[i]);A.forEach((a,v)=>{
    const s=Math.abs(B[v].midi-a.midi), l=Math.abs(B[v].k-a.k);
    assert.ok(!(s===3&&l===1),`${w} ${i} 声${v} 増2度 ${nm([a])}→${nm([B[v]])}`);
  });}});
});

test('(i) いちばん上と 左手が おなじ 向きに 5度・8度へ 入るとき、いちばん上は とばない（並達5度・8度が ない）',()=>{
  each((key,p,d,w)=>{for(let i=1;i<4;i++){
    const b1=d[i-1].lh[0].midi, b2=d[i].lh[0].midi, s1=d[i-1].rh[2].midi, s2=d[i].rh[2].midi;
    const bad=[0,7].includes(mod(s2-b2,12))&&b1!==b2&&s1!==s2&&Math.sign(b2-b1)===Math.sign(s2-s1)&&Math.abs(s2-s1)>2;
    assert.ok(!bad,`${w} ${i}: ${nm(voices(d[i-1]))} → ${nm(voices(d[i]))}`);
  }});
});

test('(f) フリギア終止：さいごに いちばん下が 6ばんめ → 5ばんめへ 半音 下がる',()=>{
  for(const key of KEYS.filter(k=>k.minor)){
    const d=E.build(key,'phrygian'), a=d[2].lh[0], b=d[3].lh[0];
    assert.equal(b.midi-a.midi,-1,kn(key));
    assert.equal(mod(a.letter-key.l,7),5); assert.equal(mod(b.letter-key.l,7),4);
  }
});

test('why：やさしい 説明に undefined などが ない（3つの 音名で）。フリギアは 長調で から',()=>{
  for(const naming of ['solfa','en','ja']){
    PA.settings.naming=naming;
    each((key,p,d,w)=>{
      const s=E.why(key,p.type,p.variant);
      assert.ok(s.length>0,w);
      for(const bad of ['undefined','NaN','[object']) assert.ok(!s.includes(bad),w+' '+bad);
      assert.ok(s.includes('→'),w);
    });
  }
  PA.settings.naming='solfa';
  assert.equal(E.why(PA.keyOf(false,0,60),'phrygian'),'');
  assert.ok(E.why(PA.keyOf(false,0,60),'perfect').includes('「ド」'));
});

test('がくふ：sub（和音名の 下の 小さな字）を つかわなければ 図は かわらない',t=>{
  const dir=path.dirname(fileURLToPath(import.meta.url));
  let old;
  try{old=execFileSync('git',['show','HEAD:assets/core.js'],{cwd:dir,encoding:'utf8'});}catch(e){t.skip('git が つかえない');return;}
  const PB=loadPA(old);
  if(PB.ending){t.skip('HEAD に すでに PA.ending が ある');return;}
  for(const key of KEYS){
    const d=E.build(key,'half'), cols=d.map((c,i)=>({notes:c.rh,lh:c.lh,color:'#e8553d',op:i?0.3:1,label:c.label}));
    assert.equal(PA.staffSVG(key,cols,{grand:true,colW:66}),PB.staffSVG(key,cols,{grand:true,colW:66}),kn(key));
    assert.equal(PA.staffSVG(key,[{notes:c0(d)}]),PB.staffSVG(key,[{notes:c0(d)}]));
  }
  const withSub=PA.staffSVG(KEYS[0],[{notes:[],label:'Ⅴ7',sub:'てんかい'}]);
  assert.ok(withSub.includes('てんかい'));
  ['I','IV','V','V7'].forEach(k=>{assert.equal(PA.COL[k],PB.COL[k]);assert.equal(PA.LCOL[k],PB.LCOL[k]);});
  assert.ok(PA.COL.VI&&PA.LCOL.VI);
});
const c0=d=>d[0].rh;
