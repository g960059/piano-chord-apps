// PA.prog（ならびの聴きわけ）のテスト：node --test test/
// つかうすべての TPL を、つかう長調・短調（13ずつ）すべてでたしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const PA=loadPA(), P=PA.prog, E=PA.ending, mod=PA.mod;
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const nm=ns=>ns.map(n=>PA.LET_EN[n.letter]+PA.ACC[n.acc]+n.midi).join(' ');
const voices=c=>[c.lh[0],...c.rh];
const J=x=>JSON.parse(JSON.stringify(x));
// きまった乱数（mulberry32）
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

// TPL ごとに、つかう調（長調・短調）
const USE={};
for(let step=1;step<=5;step++) for(const minor of [false,true]) for(const type of ['chord','bass','top'])
  P.pool(step,minor,type).forEach(t=>{(USE[t]=USE[t]||new Set()).add(minor);});
const cases=[];
Object.keys(USE).forEach(t=>USE[t].forEach(minor=>{for(let idx=0;idx<PA.keyCount(minor);idx++){
  const q={step:5,type:'chord',t,i:1,minor,keyIdx:idx}, key=P.key(q);
  cases.push({t,minor,idx,key,d:P.build(q),w:`${t} ${PA.keyName(key)}`});
}}));
const each=fn=>cases.forEach(c=>fn(c));

test('つかう TPL はぜんぶある。どの TPL もどこかでつかう',()=>{
  assert.deepEqual(Object.keys(USE).sort(),[...P.IDS].sort());
  assert.ok(cases.length>=P.IDS.length*13);
  each(({d,w,t})=>{assert.ok(Array.isArray(d)&&d.length===P.TPL[t].rows.length,w);});
});

test('ルール5：どの和音も、その和音の音だけ（三和音は3つの音ぜんぶ・Ⅴ7は根音・第3音・第7音がある）。左手は TPL の音',()=>{
  each(({key,d,w,t})=>d.forEach((c,i)=>{
    const row=P.TPL[t].rows[i], degs=(c.ch==='V7'?[0,2,4,6]:[0,2,4]).map(x=>E.ROOT[c.ch]+x);
    const want=degs.map(k=>pc(PA.at(key.scale,k)));
    const ww=`${w} ${i}（${c.label}）${nm(voices(c))}`;
    voices(c).forEach(n=>{assert.equal(mod(n.midi,12),pc(n),ww+' 高さとつづり');assert.ok(want.includes(pc(n)),ww+' 和音にない音');});
    const have=new Set(voices(c).map(pc));
    if(c.ch==='V7') [0,1,3].forEach(j=>assert.ok(have.has(want[j]),ww+' Ⅴ7の音'));
    else assert.equal(have.size,3,ww+' 三和音の3つの音');
    const bd=row[2]==null?E.ROOT[row[0]]:row[2];
    assert.equal(pc(c.lh[0]),pc(PA.at(key.scale,bd)),ww+' 左手');
    assert.equal(c.ch,row[0]); assert.equal(c.label,E.LABEL[row[0]]);
    // 短調：Ⅴ・Ⅴ7の7ばんめは上げた音、ほかは調号どおり
    if(key.minor) voices(c).forEach(n=>{
      if(mod(n.letter-key.l,7)===6&&(c.ch==='V'||c.ch==='V7')) assert.ok(n.raised,ww+' 導音');
      else assert.equal(n.acc,key.sig[n.letter],ww+' 調号どおり');
    });
  }));
});

// 5度・8度のまま（どちらの声もうごく）。sameDir＝おなじ向き、false＝反対むき
const parallels=(A,B,sameDir)=>{
  const out=[];
  for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++){
    const a=mod(A[j].midi-A[i].midi,12), b=mod(B[j].midi-B[i].midi,12);
    const di=Math.sign(B[i].midi-A[i].midi), dj=Math.sign(B[j].midi-A[j].midi);
    if(a===b&&(a===0||a===7)&&di&&dj&&(sameDir?di===dj:di!==dj)) out.push(`${a?5:8}度 声${i}-声${j}`);
  }
  return out;
};
test('ルール1：となりの和音で、5度・8度のままうごく2つの声がない（おなじ向きも反対むきも）',()=>{
  each(({d,w})=>{for(let i=1;i<d.length;i++){
    const A=voices(d[i-1]), B=voices(d[i]);
    assert.deepEqual([...parallels(A,B,true),...parallels(A,B,false)],[],`${w} ${i}→${i+1}: ${nm(A)} → ${nm(B)}`);
  }});
});

test('ルール2：右手は左手より上・下からじゅん・となりは1オクターブまで。となりの和音で右手の声がいれかわらない',()=>{
  each(({d,w})=>{d.forEach((c,i)=>{
    const ms=c.rh.map(n=>n.midi);
    assert.ok(c.lh[0].midi<ms[0],`${w} ${i}: ${nm(voices(c))}`);
    for(let j=1;j<3;j++){assert.ok(ms[j]>ms[j-1],`${w} ${i}: 下からじゅん`);assert.ok(ms[j]-ms[j-1]<=12,`${w} ${i}: となりは1オクターブまで`);}
    if(i){const A=d[i-1].rh.map(n=>n.midi);
      for(let j=0;j<2;j++){assert.ok(ms[j]<=A[j+1],`${w} ${i}: 声${j}が前の声${j+1}をこえる`);assert.ok(ms[j+1]>=A[j],`${w} ${i}: 声${j+1}が前の声${j}より下`);}}
  });});
});

test('ルール3：右手はソ3〜ド6（55〜84）、左手はミ2〜シ3（40〜59）',()=>{
  assert.deepEqual(J(P.RH),[55,84]); assert.deepEqual(J(P.BASS),[40,59]);
  each(({d,w})=>d.forEach((c,i)=>{
    c.rh.forEach(n=>assert.ok(n.midi>=55&&n.midi<=84,`${w} ${i}: 右手${n.midi}`));
    assert.ok(c.lh[0].midi>=40&&c.lh[0].midi<=59,`${w} ${i}: 左手${c.lh[0].midi}`);
  }));
});

test('ルール4：Ⅴ7・Ⅴ → Ⅰ・Ⅵ：第7音は1つ下へ、いちばん上の導音は主音へ上がる',()=>{
  let n=0;
  each(({key,d,w})=>{for(let i=1;i<d.length;i++){
    const a=d[i-1], b=d[i]; if((a.ch!=='V7'&&a.ch!=='V')||(b.ch!=='I'&&b.ch!=='VI')) continue;
    n++;
    voices(a).forEach((x,v)=>{
      const y=voices(b)[v], dg=mod(x.k,7);
      if(dg===3){assert.equal(y.k-x.k,-1,`${w} ${i}: 第7音${nm([x])}→${nm([y])}`);assert.ok(y.midi<x.midi);}
    });
    const top=a.rh[2], tb=b.rh[2];
    if(mod(top.k,7)===6){assert.equal(pc(tb),key.tpc,`${w} ${i}: 導音`);assert.equal(tb.k-top.k,1);}
  }});
  assert.ok(n>50);
});

test('となりの和音で、どの声も増2度をとばない。左手は長6度より大きくとばない。いちばん上と左手の並達5度・8度がない',()=>{
  each(({d,w})=>{for(let i=1;i<d.length;i++){
    const A=voices(d[i-1]), B=voices(d[i]);
    A.forEach((a,v)=>{const s=Math.abs(B[v].midi-a.midi), l=Math.abs(B[v].k-a.k);assert.ok(!(s===3&&l===1),`${w} ${i}声${v}増2度 ${nm([a])}→${nm([B[v]])}`);});
    const b1=A[0].midi, b2=B[0].midi, s1=A[3].midi, s2=B[3].midi;
    assert.ok(Math.abs(b2-b1)<=9,`${w} ${i}: 左手${b2-b1}`);
    const hid=[0,7].includes(mod(s2-b2,12))&&b1!==b2&&s1!==s2&&Math.sign(b2-b1)===Math.sign(s2-s1)&&Math.abs(s2-s1)>2;
    assert.ok(!hid,`${w} ${i}: ${nm(A)} → ${nm(B)}`);
  }});
});

test('ルール6：「？」の場所は1から。なかまは3つで、和音のならびはおなじ・いちばん上の動きはぜんぶちがう',()=>{
  P.IDS.forEach(t=>{
    const T=P.TPL[t]; assert.ok(T.chord||T.bass,t);
    ['chord','bass'].forEach(k=>(T[k]||[]).forEach(i=>assert.ok(Number.isInteger(i)&&i>=1&&i<T.rows.length,`${t} ${k} ${i}`)));
    assert.ok(T.rows[0][0]==='I'&&T.rows[0][2]==null,t+' はじめは基本の形のⅠ');
  });
  assert.equal(P.FAMS.length,4);
  P.FAMS.forEach(f=>{
    assert.ok(f.tpls.length>=3,f.id);
    const seq=t=>P.TPL[t].rows.map(r=>r[0]+':'+(r[2]==null?'':r[2])).join(' ');
    f.tpls.forEach(t=>assert.equal(seq(t),seq(f.tpls[0]),f.id+' '+t));
    for(const minor of [false,true]) for(let idx=0;idx<PA.keyCount(minor);idx++){
      const lines=f.tpls.map(t=>P.topLine(P.build({step:5,type:'top',t,i:-1,minor,keyIdx:idx})).map(n=>n.midi).join(','));
      assert.equal(new Set(lines).size,f.tpls.length,`${f.id} ${minor?'m':'M'}${idx} ${lines.join(' / ')}`);
      // おなじなかまはおなじ調の高さ・おなじ左手（くらべて聴くとき、ちがうのは右手だけ）
      assert.equal(new Set(f.tpls.map(t=>P.keyFor(minor,idx,t).tonicMidi)).size,1);
      const bs=f.tpls.map(t=>P.build({step:5,type:'top',t,i:-1,minor,keyIdx:idx}).map(c=>c.lh[0].midi).join(','));
      assert.equal(new Set(bs).size,1,`${f.id} ${minor?'m':'M'}${idx} 左手 ${bs.join(' / ')}`);
    }
  });
});

test('ステップ4のなかまのいちばん上（ハ長調）',()=>{
  PA.settings.naming='solfa';
  const line=t=>PA.namesT(P.topLine(P.build({step:4,type:'top',t,i:-1,minor:false,keyIdx:0})),' ');
  assert.equal(line('s1a'),'ソ ラ ソ ソ'); assert.equal(line('s1b'),'ド ド シ ド'); assert.equal(line('s1c'),'ミ ファ レ ミ');
  assert.equal(line('s2a'),'ソ ラ ソ ソ'); assert.equal(line('s2b'),'ド ド シ ド'); assert.equal(line('s2g'),'ミ ファ レ ミ');
  assert.equal(line('s2d'),'ド ド ド シ'); assert.equal(line('t3b'),'ソ ラ ラ ソ'); assert.equal(line('t3c'),'ミ ミ ファ レ');
});

test('ステップ3：Ⅰの第2転回形 → Ⅴ はいちばん下がそのまま。転回形の名前',()=>{
  for(let idx=0;idx<13;idx++){
    const d=P.build({step:3,type:'bass',t:'s3a',i:2,minor:false,keyIdx:idx});
    assert.equal(d.length,5);
    assert.equal(d[2].lh[0].midi,d[3].lh[0].midi);
    assert.equal(d[2].inv,2); assert.equal(P.roleOf(d[2]),'fifth');
    const e=P.build({step:3,type:'bass',t:'s3e',i:1,minor:false,keyIdx:idx});
    assert.equal(P.roleOf(e[1]),'seventh'); assert.equal(e[1].inv,3); assert.equal(e[2].lh[0].midi-e[1].lh[0].midi<0,true);
    const f=P.build({step:3,type:'bass',t:'s3f',i:2,minor:false,keyIdx:idx});
    assert.equal(f[2].label,'Ⅱ'); assert.equal(P.roleOf(f[2]),'third');
    const h=P.build({step:3,type:'bass',t:'s3h',i:2,minor:false,keyIdx:idx});
    assert.equal(h[2].label,'Ⅱ'); assert.equal(P.roleOf(h[2]),'root');
    const k=P.build({step:3,type:'bass',t:'s3k',i:1,minor:false,keyIdx:idx});
    assert.equal(P.roleOf(k[1]),'fifth'); assert.equal(k[0].lh[0].midi,k[1].lh[0].midi); assert.equal(k[1].lh[0].midi,k[2].lh[0].midi);
  }
  assert.equal(E.LABEL.II,'Ⅱ'); assert.equal(E.ROOT.II,1);
});

test('もんだいをつくる：「？」の場所・こたえ・えらぶもの。ステップ5は短調もまざる',()=>{
  for(let step=1;step<=5;step++){
    const bags={}, r=rng(step*101); let prev=null; const ans={}, types={}, modes={}; let s1=0;
    for(let k=0;k<600;k++){
      const q=P.make(step,{rand:r,bags,prev});
      assert.ok(P.validQ(q),JSON.stringify(q));
      assert.equal(q.step,step);
      if(prev){assert.ok(!(prev.minor===q.minor&&prev.keyIdx===q.keyIdx),'おなじ調がつづかない');}
      const ch=P.choices(q), a=P.answer(q);
      assert.ok(ch.includes(a),JSON.stringify(q));
      assert.equal(new Set(ch).size,ch.length);
      if(q.type!=='top') assert.ok(q.i>=1&&q.i<P.TPL[q.t].rows.length);
      if(q.type==='bass') assert.equal(ch.includes('seventh'),P.TPL[q.t].rows[q.i][0]==='V7','第7音は7の和音だけ');
      if(q.type==='top'){assert.equal(ch.length,3);assert.equal(q.i,-1);
        const lines=ch.map(c=>P.choiceLabel(q,c)); assert.equal(new Set(lines).size,3);}
      if(q.type==='chord') assert.deepEqual(J(ch),step===1?['I','IV','V']:['I','IV','V','V7','VI']);
      if(step<5) assert.equal(q.minor,false);
      if(step===2&&['s1a','s1b','s1c','s1d','s1e','s1f'].includes(q.t)) s1++;
      ans[a]=(ans[a]||0)+1; types[q.type]=(types[q.type]||0)+1; modes[q.minor]=(modes[q.minor]||0)+1;
      prev=q;
    }
    if(step===1) ['I','IV','V'].forEach(c=>assert.ok(ans[c]>=180,`${c} ${ans[c]}`));
    if(step===2){['I','IV','V','V7','VI'].forEach(c=>assert.ok(ans[c]>=100,`${c} ${ans[c]}`));assert.ok(s1>=70&&s1<=250,'ステップ1のならび '+s1);}
    // いちばん下：look をさきにえらぶので、第7音（Ⅴ7だけ）はすこし少ない
    if(step===3){['root','third','fifth'].forEach(c=>assert.ok(ans[c]>=80,`${c} ${ans[c]}`));assert.ok(ans.seventh>=30,'seventh '+ans.seventh);}
    if(step===5){
      assert.ok(modes.true>=250&&modes.false>=250,JSON.stringify(modes));
      ['chord','bass','top'].forEach(t=>assert.ok(types[t]>=100,t));
      // 短調でも、和音・いちばん下・いちばん上のもんだいが出る
      const qs=[]; const b2={}, r2=rng(9);
      for(let k=0;k<300;k++) qs.push(P.make(5,{rand:r2,bags:b2}));
      ['chord','bass','top'].forEach(t=>assert.ok(qs.some(q=>q.minor&&q.type===t),'短調の'+t));
      assert.ok(qs.some(q=>q.minor&&q.t==='m4'),'フリギア');
    }
  }
});

test('こたえる前に見えるもの（和音の数・「？」の場所・いちばん下は「？」の和音の名前）だけでは、こたえがきまらない',()=>{
  // どのステップ・長調／短調・こたえかたでも、おなじ look のなかにこたえが2ついじょう
  for(let step=1;step<=5;step++) for(const minor of [false,true]) for(const type of ['chord','bass']){
    const by={};
    P.pool(step,minor,type).forEach(t=>(P.TPL[t][type]||[]).forEach(i=>{const lk=P.look(t,i,type,minor);(by[lk]=by[lk]||new Set()).add(P.answer({t,i,type}));}));
    Object.keys(by).forEach(lk=>assert.ok(by[lk].size>=2,`ステップ${step} ${type} ${lk}: ${[...by[lk]].join(',')}`));
  }
  // 見えるものがおなじもんだいのなかで、いちばん多いこたえは7わりまで（ためしにたくさんつくって）
  for(let step=1;step<=5;step++){
    const r=rng(step*31), bags={}; let prev=null; const by={};
    for(let k=0;k<3000;k++){
      const q=P.make(step,{rand:r,bags,prev}); prev=q; if(q.type==='top') continue;
      const lk=q.type+P.look(q.t,q.i,q.type,q.minor), a=P.answer(q); (by[lk]=by[lk]||{})[a]=(by[lk][a]||0)+1;
    }
    Object.keys(by).forEach(lk=>{const v=Object.values(by[lk]), n=v.reduce((x,y)=>x+y,0);
      if(n>=60) assert.ok(Math.max(...v)/n<=0.7,`ステップ${step} ${lk} ${JSON.stringify(by[lk])}`);});
  }
  // カードの名前：chord はさいしょのⅠだけ、bass はさいしょと「？」、top はぜんぶ
  const q1={step:1,type:'chord',t:'s1a',i:2,minor:false,keyIdx:0}, q3={step:3,type:'bass',t:'s3b',i:1,minor:false,keyIdx:0};
  assert.deepEqual([0,1,2,3].map(i=>P.shown(q1,i)),[true,false,false,false]);
  assert.deepEqual([0,1,2,3].map(i=>P.shown(q3,i)),[true,true,false,false]);
  assert.ok([0,1,2,3].every(i=>P.shown({step:4,type:'top',t:'s1a',i:-1,minor:false,keyIdx:0},i)));
});

test('validQ：こわれた・ちがうもんだいはつかわない',()=>{
  const ok={step:1,type:'chord',t:'s1a',i:2,minor:false,keyIdx:3};
  assert.ok(P.validQ(ok));
  const bad=[null,[],'x',{...ok,step:6},{...ok,step:'1'},{...ok,type:'bass'},{...ok,t:'nope'},{...ok,t:'__proto__'},{...ok,t:'s3a'},{...ok,i:0},{...ok,i:4},
    {...ok,minor:true},{...ok,keyIdx:13},{...ok,keyIdx:-1},{...ok,keyIdx:1.5},{step:4,type:'top',t:'s1a',i:0,minor:false,keyIdx:0},
    {step:4,type:'top',t:'s2c',i:-1,minor:false,keyIdx:0},{step:5,type:'chord',t:'m4',i:3,minor:false,keyIdx:0},{step:3,type:'bass',t:'s3a',i:3,minor:false,keyIdx:0}];
  bad.forEach(q=>assert.equal(P.validQ(q),false,JSON.stringify(q)));
  assert.ok(P.validQ({step:5,type:'chord',t:'m4',i:3,minor:true,keyIdx:0}));
  assert.ok(P.validQ({step:5,type:'bass',t:'m4',i:2,minor:true,keyIdx:12}));
  assert.ok(P.validQ({step:4,type:'top',t:'t3c',i:-1,minor:false,keyIdx:12}));
});

test('ためしに入れて聴く・くらべてきく：「？」に入れた和音はその和音の音がそろう・となりと5度8度のままうごかない。ほかの和音はそのまま',()=>{
  for(const minor of [false,true]) for(let idx=0;idx<13;idx++) for(let step=1;step<=5;step++){
    const types=step===5?['chord','bass','top']:[step===3?'bass':step===4?'top':'chord'];
    types.forEach(type=>P.pool(step,minor,type).forEach(t=>{
      const is=type==='top'?[-1]:P.TPL[t][type]||[];
      is.forEach(i=>{
        const q={step,type,t,i,minor,keyIdx:idx}, key=P.key(q), d=P.build(q), w=`${step} ${t} ${i} ${PA.keyName(key)}`;
        P.choices(q).forEach(c=>{
          const s=P.subst(q,c); assert.ok(s&&s.length===d.length,w+' '+c);
          if(c===P.answer(q)){assert.deepEqual(J(s),J(d));return;}
          if(type==='top'){assert.deepEqual(J(s.map(x=>x.ch)),J(d.map(x=>x.ch)));return;}
          s.forEach((x,j)=>{if(j!==i) assert.deepEqual(J(x),J(d[j]),w);});
          const x=s[i], ch=type==='chord'?c:d[i].ch, ww=`${w} ${c} ${nm(voices(x))}`;
          const want=(ch==='V7'?[0,2,4,6]:[0,2,4]).map(k=>pc(PA.at(key.scale,E.ROOT[ch]+k)));
          voices(x).forEach(n=>{assert.ok(want.includes(pc(n)),ww);assert.equal(mod(n.midi,12),pc(n));});
          assert.ok(x.lh[0].midi<x.rh[0].midi,w+' 左手が下');
          for(let j=1;j<3;j++){assert.ok(x.rh[j].midi>x.rh[j-1].midi);assert.ok(x.rh[j].midi-x.rh[j-1].midi<=12);}
          // 和音の音がそろう（Ⅴ7は根音・第3音・第7音）。導音と第7音は1つだけ
          const pcs=voices(x).map(pc), have=new Set(pcs);
          if(ch==='V7') [0,1,3].forEach(j=>assert.ok(have.has(want[j]),ww+' Ⅴ7'));
          else assert.equal(have.size,3,ww);
          if(ch==='V'||ch==='V7') assert.equal(pcs.filter(p=>p===want[1]).length,1,ww+' 導音が2つ');
          if(ch==='V7') assert.equal(pcs.filter(p=>p===want[3]).length,1,ww+' 第7音が2つ');
          // 右手・左手の高さ。となりの和音と5度・8度のままうごかない
          x.rh.forEach((n,j)=>{assert.ok(n.midi>=P.RH[0]&&n.midi<=P.RH[1],ww);assert.ok(Math.abs(n.midi-d[i].rh[j].midi)<=12,ww);});
          assert.ok(x.lh[0].midi>=P.BASS[0]&&x.lh[0].midi<=P.BASS[1],ww+' 左手の高さ');
          const pp=[];
          if(i>0) pp.push(...parallels(voices(s[i-1]),voices(x),true),...parallels(voices(s[i-1]),voices(x),false));
          if(s[i+1]) pp.push(...parallels(voices(x),voices(s[i+1]),true),...parallels(voices(x),voices(s[i+1]),false));
          assert.deepEqual(pp,[],ww);
          if(type==='chord'){assert.equal(x.ch,c); assert.equal(x.inv,0); assert.equal(pc(x.lh[0]),want[0]);}
          else{assert.equal(x.ch,d[i].ch); assert.equal(P.roleOf(x),c); assert.equal(pc(x.lh[0]),want[P.BASS_ROLES[c].d/2]);}
        });
        assert.equal(P.subst(q,'nope'),null);
      });
    }));
  }
});

test('why・choiceLabel：やさしい説明に undefined などがない（3つの音名で）',()=>{
  for(const naming of ['solfa','en','ja']){
    PA.settings.naming=naming;
    const r=rng(5);
    for(let k=0;k<400;k++){
      const q=P.make(1+k%5,{rand:r,bags:{}}), s=P.why(q);
      assert.ok(s.length>8,JSON.stringify(q));
      for(const bad of ['undefined','NaN','[object','null']) assert.ok(!s.includes(bad),JSON.stringify(q)+' '+s);
      P.choices(q).forEach(c=>{const l=P.choiceLabel(q,c);assert.ok(l&&!/undefined|NaN/.test(l),l);});
    }
  }
  PA.settings.naming='solfa';
  const q={step:2,type:'chord',t:'s2a',i:2,minor:false,keyIdx:0};
  assert.equal(P.why(q).replace(/<[^>]+>/g,''),'ⅤにファがくわわったⅤ7。だから「もっともどりたい」。Ⅴ7のシがドへ上がり、ファがミへ下がって、Ⅰでおちついた');
  assert.match(P.why({step:3,type:'bass',t:'s3a',i:2,minor:false,keyIdx:0}).replace(/<[^>]+>/g,''),/いちばん下がソのままで、上がド→シ、ミ→レと動く/);
  assert.match(P.why({step:2,type:'chord',t:'s2c',i:3,minor:false,keyIdx:0}).replace(/<[^>]+>/g,''),/ⅠのかわりになるⅥ|Ⅰのかわりになる和音/);
  // 分かち書き（日本語のあいだの空白）をしない
  const r=rng(7);
  for(let k=0;k<200;k++){const s=P.why(P.make(1+k%5,{rand:r,bags:{}})).replace(/<[^>]+>/g,'');assert.ok(!/[ぁ-んァ-ヶ一-龠ー] [ぁ-んァ-ヶ一-龠ー]/.test(s),s);}
});

test('リンクのパラメータ：step・n・slow はゆるされた値だけ',()=>{
  const L=p=>J(P.readLink(p));
  assert.deepEqual(L({step:'3',n:'5',slow:'1'}),{step:3,n:5,slow:true});
  assert.deepEqual(L({}),{step:null,n:null,slow:false});
  assert.deepEqual(L(null),{step:null,n:null,slow:false});
  ['0','6','1.5','03','x','-1',' 2'].forEach(v=>assert.equal(P.readLink({step:v}).step,null,v));
  ['0','21','100','x','-1','1e1'].forEach(v=>assert.equal(P.readLink({n:v}).n,null,v));
  assert.equal(P.readLink({n:'20'}).n,20); assert.equal(P.readLink({n:'1'}).n,1);
  ['0','true','yes','2'].forEach(v=>assert.equal(P.readLink({slow:v}).slow,false,v));
  // ページはおなじ関数をつかう
  const h=fs.readFileSync(path.join(root,'progression.html'),'utf8');
  assert.match(h,/P\.readLink\(PA\.params\(\)\)/);
});

test('PA.ending.build は前とまったくおなじ（voiceSpec にまとめたあとも）',()=>{
  const out=[];
  for(const minor of [false,true]) for(let i=0;i<13;i++){const key=PA.keyOf(minor,i,60);
    for(const p of E.PATTERNS) out.push(JSON.stringify(E.build(key,p.type,p.variant)));}
  const h=crypto.createHash('sha256').update(out.join('\n')).digest('hex');
  assert.equal(h,'49c3dbbcef6e32a1e2ac0431837b2028292e07ad7e881d5fc054d7505989a55c');
});

test('目次：👂 耳をきたえる に ear のつぎ。progression.html がある',()=>{
  const a=PA.app('progression');
  assert.ok(a); assert.equal(a.type,'ear'); assert.equal(a.unit,'ear');
  assert.deepEqual(J(PA.UNITS.find(u=>u.id==='ear').apps),['ear','progression']);
  const h=fs.readFileSync(path.join(root,'progression.html'),'utf8');
  assert.ok(h.includes('<title>ならびの聴きわけ</title>'));
  assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'progression.html'"));
});
