// PA.henka（変化和音）のテスト：node --test test/
// 13の長調・13の短調すべてと、音名の3つの書きかた（solfa / en / ja）でたしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA(), H=PA.henka, mod=PA.mod;
const KEYS=[...Array(13).keys()].flatMap(i=>[PA.majorKey(i),PA.minorKey(i)]);
const MAJ=KEYS.filter(k=>!k.minor), MIN=KEYS.filter(k=>k.minor);
const kn=k=>PA.LET_EN[k.l]+PA.ACC[k.a]+(k.minor?'m':'');
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const step=n=>PA.stepOf(n);
const TAGS=new Set([null,'lt','seventh','b9','ninth','low','borrowed','raised','chrom']);
// vm の中の配列は別の realm なので、JSON にしてくらべる
const J=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepStrictEqual(J(a),J(b),m), neq=(a,b,m)=>assert.notDeepStrictEqual(J(a),J(b),m);
const nm=ns=>ns.map(n=>PA.LET_EN[n.letter]+PA.ACC[n.acc]+n.midi).join(' ');

// ---------- 共通のしらべかた ----------
function checkNotes(ns,where){
  assert.ok(Array.isArray(ns)&&ns.length>0,where+': 音がない');
  ns.forEach((n,i)=>{
    const w=`${where} [${i}] ${JSON.stringify(n)}`;
    eq(Object.keys(n).sort(),['acc','letter','midi','role','tag'],w);
    assert.ok(Number.isInteger(n.letter)&&n.letter>=0&&n.letter<=6,w);
    assert.ok(Number.isInteger(n.acc)&&Math.abs(n.acc)<=2,w);
    assert.ok(Number.isInteger(n.midi),w);
    assert.equal(mod(n.midi,12),pc(n),w+'高さとつづりがちがう');
    assert.ok(typeof n.role==='string'&&n.role.length>0,w);
    assert.ok(TAGS.has(n.tag),w+' tag');
  });
}
// 根音（letter, pc）から見た和音の音：members＝[[文字の差, 半音の差]...]、omit＝はぶいてよい音
function chordIs(ns,root,members,where,omit=[]){
  const key=([l,s])=>l+':'+s;
  const got=new Set(ns.map(n=>key([mod(n.letter-root.letter,7),mod(pc(n)-root.pc,12)])));
  const want=new Set(members.map(([l,s])=>key([mod(l,7),mod(s,12)])));
  got.forEach(g=>assert.ok(want.has(g),`${where}: 和音にない音${g}（${nm(ns)}）`));
  members.forEach(m=>{if(!omit.some(o=>key(o)===key(m))) assert.ok(got.has(key(m)),`${where}: ${key(m)}がない（${nm(ns)}）`);});
}
const R=(key,lo,so)=>({letter:mod(key.l+lo,7),pc:mod(key.tpc+so,12)});
const MAJ3=[[0,0],[2,4],[4,7]], MIN3=[[0,0],[2,3],[4,7]], DIM3=[[0,0],[2,3],[4,6]];
const DOM7=[[0,0],[2,4],[4,7],[6,10]], HDIM7=[[0,0],[2,3],[4,6],[6,10]], DIM7=[[0,0],[2,3],[4,6],[6,9]], MIN7=[[0,0],[2,3],[4,7],[6,10]];
// 交差なし（下からじゅんに高くなる）。strict＝おなじ高さもだめ
function noCross(ns,where,strict=true){
  for(let i=1;i<ns.length;i++){
    if(strict) assert.ok(ns[i].midi>ns[i-1].midi,`${where}: 声がかさなる・交差（${nm(ns)}）`);
    else assert.ok(ns[i].midi>=ns[i-1].midi,`${where}: 声の交差（${nm(ns)}）`);
  }
}
// 連続5度・連続8度（反行もふくむ。どちらの声も動くとき）
function noParallels(A,B,where){
  for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++){
    const a=mod(A[j].midi-A[i].midi,12), b=mod(B[j].midi-B[i].midi,12);
    if(a===b&&(a===0||a===7)&&A[i].midi!==B[i].midi&&A[j].midi!==B[j].midi)
      assert.fail(`${where}: 連続${a?5:8}度声${i}と声${j}（${nm(A)} → ${nm(B)}）`);
  }
}
// バスをふくむ減5度 → 完全5度（芸大ではだめ）
function noDim5P5Bass(A,B,where){
  for(let j=1;j<A.length;j++){
    if(mod(A[j].midi-A[0].midi,12)===6&&mod(B[j].midi-B[0].midi,12)===7)
      assert.fail(`${where}: バスと声${j}が減5度→完全5度（${nm(A)} → ${nm(B)}）`);
  }
}
// ベース40〜55・上の声55〜79。解決先は2まではみだしてよい（♭Ⅵ→Ⅴのト長調・嬰ヘ長調・変ト長調が1はみだす）
const RANGE={b:[40,55],u:[55,79]};
function inRange(ns,where,slack=0){
  ns.forEach((n,i)=>{
    const [lo,hi]=i?RANGE.u:RANGE.b;
    assert.ok(n.midi>=lo-slack&&n.midi<=hi+slack,`${where}: 音域の外 [${i}] ${n.midi}（${nm(ns)}）`);
  });
}
// 声の動き（半音の差・文字の差）
const mv=(a,b)=>({s:b.midi-a.midi,d:step(b)-step(a)});
function progression(chords,where,{strict=true,slack=2}={}){
  chords.forEach((c,ci)=>{checkNotes(c,where+'#'+ci);noCross(c,where+'#'+ci,strict||ci===0);inRange(c,where+'#'+ci,ci?slack:0);});
  for(let i=1;i<chords.length;i++){
    assert.equal(chords[i].length,chords[i-1].length,where+': 声の数');
    noParallels(chords[i-1],chords[i],where+`#${i-1}→${i}`);
    noDim5P5Bass(chords[i-1],chords[i],where+`#${i-1}→${i}`);
  }
}
// tag が 'lt' の声は2度上へ（半音）、'seventh'・'b9'・'ninth' の声は2度下へ
function tendencies(A,B,where,{ltSemis=[1],sevenOk=()=>true}={}){
  A.forEach((n,i)=>{
    const m=mv(n,B[i]);
    if(n.tag==='lt'){
      assert.equal(m.d,1,`${where}: 導音が2度上へすすまない [${i}]`);
      assert.ok(ltSemis.includes(m.s),`${where}: 導音のすすみ [${i}] ${m.s}`);
    }
    if((n.tag==='seventh'||n.tag==='b9'||n.tag==='ninth')&&sevenOk(i)){
      assert.equal(m.d,-1,`${where}: ${n.tag}が2度下へすすまない [${i}]（${nm(A)} → ${nm(B)}）`);
      assert.ok(m.s===-1||m.s===-2,`${where}: ${n.tag}のすすみ [${i}]`);
    }
  });
}

// ---------- 1) ナポリの六 ----------
test('ナポリの六：♭Ⅱの第1転回形・ベース（第4音）を重ねる・根音はソプラノ',()=>{
  for(const k of KEYS){
    const w='N6 '+kn(k), n=H.neapolitan(k);
    checkNotes(n,w); noCross(n,w); inRange(n,w);
    chordIs(n,R(k,1,1),MAJ3,w);
    assert.equal(pc(n[0]),mod(k.tpc+5,12),w+': ベースは第4音');
    assert.equal(n[0].letter,mod(k.l+3,7),w);
    assert.equal(n.filter(x=>pc(x)===pc(n[0])).length,2,w+': ベースを重ねる');
    assert.equal(pc(n[3]),mod(k.tpc+1,12),w+': ソプラノは根音（♭2）');
    assert.equal(n[3].tag,'low',w);
    const six=n.find(x=>x.letter===mod(k.l+5,7));
    assert.equal(six.tag,k.minor?null:'borrowed',w+': 長調の♭6はかりた音');
  }
});
test('ナポリの六 → Ⅴ：根音は導音へ減3度下へ、第5音はⅤの根音へ、ベースは上へ',()=>{
  for(const k of KEYS){
    const w='N6→V '+kn(k), n=H.neapolitan(k), v=H.toV(k);
    progression([n,v],w);
    chordIs(v,R(k,4,7),MAJ3,w);
    const r=mv(n[3],v[3]); eq(r,{s:-2,d:-2},w+': 減3度下へ');
    assert.equal(v[3].tag,'lt',w);
    assert.equal(pc(v[3]),mod(k.tpc+11,12),w+': 導音（短調も上げた第7音）');
    eq(mv(n[2],v[2]),{s:-1,d:-1},w+': 第5音（♭6）はⅤの根音へ半音下へ');
    eq(mv(n[0],v[0]),{s:2,d:1},w+': ベースは2度上へ');
  }
});
test('ナポリの六 → Ⅰ6/4 → Ⅴ',()=>{
  for(const k of KEYS){
    const w='N6→I64→V '+kn(k), n=H.neapolitan(k), [i64,v]=H.viaI64(k);
    progression([n,i64,v],w);
    chordIs(i64,R(k,0,0),k.minor?MIN3:MAJ3,w);
    assert.equal(pc(i64[0]),mod(k.tpc+7,12),w+': Ⅰ6/4のベースは第5音');
    chordIs(v,R(k,4,7),MAJ3,w);
    n.forEach((x,i)=>{const m=mv(x,i64[i]);assert.ok(Math.abs(m.d)<=1,w+': 2度ですすむ ['+i+']');});
    i64.forEach((x,i)=>{const m=mv(x,v[i]);assert.ok(Math.abs(m.d)<=1,w+': 2度ですすむ ['+i+']');});
    eq(mv(n[3],i64[3]),{s:-1,d:-1},w+': ♭2 → 主音');
  }
});

// ---------- 2) 準固有和音 ----------
const BEXP={
  iv:{root:[3,5],b:MIN3,d:MAJ3,next:[[0,0],MAJ3]},
  ii_dim:{root:[1,2],b:DIM3,d:MIN3,bass:[3,5],next:[[4,7],MAJ3]},
  ii_hdim7:{root:[1,2],b:HDIM7,d:MIN7,next:[[4,7],DOM7,[[4,7]]]},
  bVI:{root:[5,8],droot:[5,9],b:MAJ3,d:MIN3,next:[[4,7],MAJ3]},
  V9_b9:{root:[4,7],b:[...DOM7,[1,1]],d:[...DOM7,[1,2]],omit:[[4,7]],next:[[0,0],MAJ3]},
  vii_dim7:{root:[6,11],b:DIM7,d:HDIM7,next:[[0,0],MAJ3]}
};
test('準固有和音（長調）：かりた形・ふつうの形・つぎの和音',()=>{
  eq(H.BORROWED_IDS,Object.keys(BEXP));
  for(const k of MAJ) for(const id of H.BORROWED_IDS){
    const e=BEXP[id], w=`${id} ${kn(k)}`, b=H.borrowed(k,id), d=H.diatonic(k,id), nx=H.nextOf(k,id), nxd=H.nextOf(k,id,false);
    progression([b,nx],w); progression([d,nxd],w+'（ふつうの形）');
    chordIs(b,R(k,...e.root),e.b,w,e.omit);
    chordIs(d,R(k,...(e.droot||e.root)),e.d,w+'（ふつうの形）',e.omit);
    if(e.bass) assert.equal(pc(b[0]),mod(k.tpc+e.bass[1],12),w+': 第1転回形');
    // ちがうのはかりた音だけ（半音下）
    b.forEach((x,i)=>{
      if(x.tag==='borrowed'){
        assert.equal(x.letter,d[i].letter,w); assert.equal(x.midi,d[i].midi-1,w);
        assert.ok([mod(k.l+5,7),mod(k.l+2,7)].includes(x.letter),w+': かりるのは第6音・第3音');
      }else eq([x.letter,x.acc,x.midi],[d[i].letter,d[i].acc,d[i].midi],w+': おなじ音 ['+i+']');
    });
    assert.ok(b.some(x=>x.tag==='borrowed'),w);
    chordIs(nx,R(k,...e.next[0]),e.next[1],w+'つぎ',e.next[2]||[]);
    nx.forEach((x,i)=>eq([x.letter,x.acc],[nxd[i].letter,nxd[i].acc],w+': つぎの和音はおなじ'));
    tendencies(b,nx,w); tendencies(d,nxd,w+'（ふつうの形）');
    // かりた♭6は半音下の第5音へ
    b.forEach((x,i)=>{if(x.tag==='borrowed'&&x.letter===mod(k.l+5,7)) eq(mv(x,nx[i]),{s:-1,d:-1},w+': ♭6 → 5');});
    assert.ok(H.symbol(k,'borrowed',id)&&H.symbol(k,'diatonic',id),w);
  }
  for(const k of MIN) for(const id of H.BORROWED_IDS){
    assert.equal(H.borrowed(k,id),null); assert.equal(H.diatonic(k,id),null); assert.equal(H.nextOf(k,id),null);
  }
  assert.equal(H.borrowed(MAJ[0],'nope'),null);
});

// ---------- 3) 副属和音 ----------
const targetQ=(k,t)=>k.minor?(t===4?'m':'M'):([2,3,6].includes(t)?'m':'M');
test('副属和音：Ⅴ7/x・Ⅶ7/x（つづり・和音の中身・解決）',()=>{
  for(const k of KEYS){
    eq(H.targets(k),k.minor?[3,4,5,6,7]:[2,3,4,5,6]);
    for(const t of H.targets(k)){
      const T=H.targetTriad(k,t), sc=k.minor?PA.NMIN:PA.MAJ, rs=sc[t-1], root=R(k,t-1,rs), q=targetQ(k,t);
      const w0=`${kn(k)} ${H.label(k,'target',t)}`;
      checkNotes(T,w0); noCross(T,w0); inRange(T,w0);
      chordIs(T,root,q==='m'?MIN3:MAJ3,w0);
      assert.equal(H.targetIsMinor(k,t),q==='m');
      for(const kind of ['V7','vii7','vii7h']){
        const s=H.secondary(k,t,kind), r=H.resolveSecondary(k,t,kind), w=`${kn(k)} ${H.label(k,'secondary',t,kind)}`;
        if(kind==='vii7h'&&(q==='m'||(k.minor&&t===5))){assert.equal(s,null);assert.equal(r,null);assert.equal(H.symbol(k,'secondary',t,kind),'');continue;}
        progression([s,r],w);
        const lt={letter:mod(root.letter+6,7),pc:mod(root.pc+11,12)};
        if(kind==='V7') chordIs(s,{letter:mod(root.letter+4,7),pc:mod(root.pc+7,12)},DOM7,w);
        else chordIs(s,lt,kind==='vii7'?DIM7:HDIM7,w);
        const L=s.filter(x=>x.tag==='lt'); assert.equal(L.length,1,w+': 導音は1つ');
        eq([L[0].letter,pc(L[0])],[lt.letter,lt.pc],w+': 目標の導音');
        assert.equal(s.filter(x=>x.tag==='seventh').length,1,w+': 第7音は1つ');
        chordIs(r,root,q==='m'?MIN3:MAJ3,w+'解決',kind==='V7'?[[4,7]]:[]);
        if(kind!=='V7'){
          // Ⅶ7/x → x：[根音 | 3, 5, 根音]（目標の第3音は重ねない）
          assert.equal(r.filter(x=>x.letter===root.letter).length,2,w+': 根音を重ねる');
          assert.equal(r.filter(x=>x.letter===mod(root.letter+2,7)).length,1,w+': 第3音は1つ');
        }
        tendencies(s,r,w);
        r.forEach((x,i)=>{if(i) assert.ok(Math.abs(mv(s[i],x).d)<=1,w+': 上の声は2度か同音ですすむ ['+i+']');});
        // 目標の和音とおなじ音（つづり）
        r.forEach(x=>assert.ok(T.some(y=>y.letter===x.letter&&y.acc===x.acc),w+': 目標の和音の音'));
        assert.ok(H.symbol(k,'secondary',t,kind),w);
        // 調にない音の tag
        s.forEach(x=>{
          const diat=(k.minor?k.nat:k.scale).some(y=>y.letter===x.letter&&y.acc===x.acc);
          if(!x.tag) assert.ok(diat,w+': 調にない音に tag がない'+JSON.stringify(x));
          if(x.tag==='chrom'||x.tag==='raised') assert.ok(!diat,w);
        });
      }
    }
    for(const bad of k.minor?[1,2,8]:[1,7,0]){assert.equal(H.secondary(k,bad,'V7'),null);assert.equal(H.targetTriad(k,bad),null);}
    assert.equal(H.secondary(k,5,'nope'),null);
  }
});
test('Ⅴ/Ⅴは PA.chroma のドッペルドミナント、Ⅶ°7/Ⅴは減七/Ⅴとおなじ音',()=>{
  const pcs=ns=>[...new Set(ns.map(n=>n.letter+':'+n.acc))].sort().join(',');
  for(const k of KEYS){
    assert.equal(pcs(H.secondary(k,5,'V7')),pcs(PA.chroma.ddStack(k,'dd')),kn(k));
    assert.equal(pcs(H.secondary(k,5,'vii7')),pcs(PA.chroma.ddStack(k,'ddim')),kn(k));
    // 長9度のⅦ7/Ⅴ（半減七）は長調だけ（短調のドッペル9は短9度だけ：PA.chroma.ddStack とおなじきまり）
    if(!k.minor) assert.equal(pcs(H.secondary(k,5,'vii7h')),pcs(PA.chroma.ddStack(k,'dd9',true).slice(1)),kn(k));
    else{assert.equal(H.secondary(k,5,'vii7h'),null,kn(k));assert.equal(H.label(k,'secondary',5,'vii7h'),'',kn(k));}
    // ならびも PA.chroma.dd（[根音 | 5, 7, 3]）とおなじ
    eq(H.secondary(k,5,'V7').map(n=>n.letter+':'+n.acc),PA.chroma.dd(k).map(n=>n.letter+':'+n.acc),kn(k));
  }
});

// ---------- 4) 減七と半減七 ----------
test('Ⅶ7：長調は半減七、短調は減七。Ⅴ9の根音省略とおなじ。Ⅰへ',()=>{
  for(const k of KEYS){
    const w='vii7 '+kn(k), v=H.vii7(k), r=H.vii7ToI(k), r9=H.rootless9(k), v9=H.v9(k), v9r=H.v9ToI(k);
    progression([v,r],w); progression([v9,v9r],'V9 '+kn(k));
    checkNotes(r9,w);
    const lt=R(k,6,11);
    chordIs(v,lt,k.minor?DIM7:HDIM7,w);
    assert.equal(v[0].tag,'lt',w);
    eq(r9,v,w+': 根音省略のⅤ9とおなじ（音・名前・tag）');
    eq(v.map(n=>n.role),['第3音（導音）','第7音',k.minor?'第9音（ひくいほう）':'第9音（たかいほう）','第5音'],w+': Ⅴ9から見た名前');
    eq(v.map(n=>n.tag),['lt','seventh',k.minor?'b9':'ninth',null],w);
    const vv=H.vii7(k,'vii'); checkNotes(vv,w);
    eq(vv.map(n=>n.role),['根音（導音）','第5音','第7音','第3音'],w+': Ⅶ7から見た名前');
    eq(vv.map(n=>[n.letter,n.acc,n.midi,n.tag]),v.map(n=>[n.letter,n.acc,n.midi,n.tag]),w+': tag はおなじ');
    // 2 → 主音（根音を重ねる）。6は2の下（4度）なので連続5度にならない
    assert.ok(v[2].midi<v[3].midi&&mod(v[3].midi-v[2].midi,12)<=6,w+': 6は2の下');
    assert.equal(r.filter(x=>x.letter===k.l).length,2,w+': Ⅰの根音を重ねる');
    assert.equal(H.label(k,'vii7'),'Ⅴ₉（根音省略）',w);
    chordIs(v9,R(k,4,7),[...DOM7,[1,k.minor?1:2]],'V9 '+kn(k),[[4,7]]);
    // Ⅴ9の上の3声（導音・第7音・第9音）はⅦ7の音
    v9.slice(1).forEach(x=>assert.ok(v.some(y=>y.letter===x.letter&&y.acc===x.acc),w+': Ⅴ9の上の声はⅦ7の音'));
    chordIs(r,R(k,0,0),k.minor?MIN3:MAJ3,w+'Ⅰ');
    chordIs(v9r,R(k,0,0),k.minor?MIN3:MAJ3,'V9→I '+kn(k));
    tendencies(v,r,w); tendencies(r9,r,w+' (Ⅴ9)'); tendencies(v9,v9r,'V9 '+kn(k));
    r.forEach((x,i)=>assert.equal(Math.abs(mv(v[i],x).d),1,w+': すべて2度ですすむ ['+i+']'));
    assert.ok(H.symbol(k,'vii7')&&H.symbol(k,'v9'),w);
  }
});
test('半減七と減七のくらべ：ちがうのは第9音（♮6と♭6）だけ',()=>{
  for(const k of KEYS){
    const w='cmp '+kn(k), c=H.viiCompare(k);
    checkNotes(c.half,w); checkNotes(c.dim,w); progression([c.half,c.toI],w); progression([c.dim,c.toI],w);
    chordIs(c.half,R(k,6,11),HDIM7,w); chordIs(c.dim,R(k,6,11),DIM7,w);
    const diffs=c.half.map((n,i)=>i).filter(i=>c.half[i].midi!==c.dim[i].midi||c.half[i].acc!==c.dim[i].acc);
    eq(diffs,[c.diff],w);
    const a=c.half[c.diff], b=c.dim[c.diff];
    assert.equal(a.letter,mod(k.l+5,7),w+': 第6音'); assert.equal(b.letter,a.letter,w); assert.equal(b.midi,a.midi-1,w);
    assert.equal(b.tag,k.minor?'b9':'borrowed',w); assert.equal(a.tag,k.minor?'raised':'ninth',w);
    assert.equal(c.half[1].tag,'seventh',w); assert.equal(c.dim[1].tag,'seventh',w);
    assert.equal(c.halfInKey,!k.minor,w); assert.equal(c.dimInKey,k.minor,w);
    const own=k.minor?c.dim:c.half;
    eq(own.map(n=>[n.letter,n.acc,n.midi]),H.vii7(k).map(n=>[n.letter,n.acc,n.midi]),w+': 調のⅦ7とおなじ');
  }
});

// ---------- 5) 異名同音の読み替え ----------
const CLASSES=[[11,2,5,8],[1,4,7,10],[0,3,6,9]];
const DIM_TAG={11:'lt',2:null,5:'seventh',8:'b9'};
function checkReadings(rs,w){
  assert.equal(rs.length,4,w);
  const mids=rs[0].spelling.map(n=>n.midi);
  rs.forEach((r,i)=>{
    const ww=`${w} ${kn(r.key)}`;
    assert.ok(r.key.minor,ww); assert.equal(PA.minorKey(r.keyIdx).tpc,r.key.tpc,ww);
    if(r.key.enh) assert.ok(r.given,ww+': PA.MINOR_KEYS にない調はわたした読みだけ');
    else eq([r.key.l,r.key.a],PA.MINOR_KEYS[r.keyIdx],ww);
    assert.ok(Math.abs(r.key.a)<=1,ww);
    checkNotes(r.spelling,ww); checkNotes(r.resolution,ww);
    eq(r.spelling.map(n=>n.midi),mids,ww+': おなじけんばん');
    noCross(r.spelling,ww,false);
    chordIs(r.spelling,R(r.key,6,11),DIM7,ww);
    assert.equal(mod(pc(r.lt)+1,12),r.key.tpc,ww+': 導音の半音上が主音');
    assert.equal(r.lt.tag,'lt',ww);
    // tag・名前はⅤ9の根音省略として
    r.spelling.forEach(n=>assert.equal(n.tag,DIM_TAG[mod(n.midi-r.key.tpc,12)],ww+' tag'));
    chordIs(r.resolution,R(r.key,0,0),MIN3,ww+'解決');
    const bassRel=mod(r.spelling[0].midi-r.key.tpc,12);
    // 交差なし。同度になってよいのは短3度でとなりあう（密集の）2つの声だけ（ほかによいすすみかたがない）
    for(let j=1;j<4;j++){
      const a=r.resolution[j-1].midi, b=r.resolution[j].midi;
      assert.ok(b>a||(b===a&&r.spelling[j].midi-r.spelling[j-1].midi===3),`${ww}解決: 声がかさなる・交差（${nm(r.resolution)}）`);
    }
    r.spelling.forEach((n,j)=>{
      const m=mv(n,r.resolution[j]);
      assert.equal(Math.abs(m.d),1,ww+': 2度ですすむ ['+j+']');
      assert.ok(Math.abs(m.s)<=2,ww);
      if(n.tag==='lt') eq(m,{s:1,d:1},ww);
      if(n.tag==='b9') eq(m,{s:-1,d:-1},ww);
      if(n.tag==='seventh') eq(m,{s:-2,d:-1},ww);
      // 上の声の2は主音へ（交差しないかぎり）
    });
    if(bassRel===2) eq(mv(r.spelling[0],r.resolution[0]),{s:1,d:1},ww+': ベースの2は♭3へ（Ⅰ6）');
    noParallels(r.spelling,r.resolution,ww);
    noDim5P5Bass(r.spelling,r.resolution,ww);
    assert.equal(r.resInv,{11:0,2:1,5:1,8:2}[bassRel],ww+' resInv');
    assert.equal(r.ninthInBass,bassRel===8,ww);
    if(r.ninthInBass){
      // Ⅰ6/4 → Ⅴ（ベースはそのまま）
      assert.ok(r.next,ww+': Ⅰ6/4のあとのⅤ');
      // （音域はわたされた音しだいなのでここではみない）
      checkNotes(r.next,ww+'Ⅴ'); noCross(r.next,ww+'Ⅴ',false);
      noParallels(r.resolution,r.next,ww+'Ⅰ6/4→Ⅴ'); noDim5P5Bass(r.resolution,r.next,ww+'Ⅰ6/4→Ⅴ');
      chordIs(r.next,R(r.key,4,7),MAJ3,ww+'Ⅴ');
      assert.equal(r.next[0].midi,r.resolution[0].midi,ww+': ベースはそのまま');
      assert.equal(r.next.filter(n=>n.tag==='lt').length,1,ww+': 導音は1つ');
      r.resolution.forEach((x,j)=>assert.ok(Math.abs(mv(x,r.next[j]).s)<=5,ww));
    }else assert.equal(r.next,null,ww);
    const dbl=r.spelling.some(n=>Math.abs(n.acc)>1);
    if(dbl) assert.ok(kn(r.key)==='G♯m'||r.given,ww+': 重嬰・重変が出る');
    if(i) assert.equal(mod(r.key.tpc-rs[i-1].key.tpc,12),3,w+': 主音は短3度ずつ');
  });
  assert.equal(new Set(rs.map(r=>r.key.tpc)).size,4,w);
  assert.ok(rs.filter(r=>r.given).length<=1,w);
}
// わたした減七の音が、given の読みとしてさいしょにそのままもどってくる
function givenFirst(ns,w){
  const rs=H.dimReadings(ns);
  assert.ok(rs,w);
  checkReadings(rs,w);
  assert.equal(rs[0].given,true,w+': given');
  const sorted=[...J(ns)].sort((a,b)=>a.midi-b.midi);
  eq(rs[0].spelling.map(n=>[n.letter,n.acc,n.midi]),sorted.map(n=>[n.letter,n.acc,n.midi]),w+': わたしたつづり');
  return rs;
}
test('減七の4つの読みかた（ピッチクラス・音・調から）',()=>{
  for(const c of CLASSES){
    const rs=H.dimReadings(c);
    checkReadings(rs,'pcs '+c);
    rs.forEach(r=>{assert.equal(r.given,false);inRange(r.spelling,'pcs '+c);inRange(r.resolution,'pcs '+c,2);if(r.next) inRange(r.next,'pcs '+c,2);});
    assert.equal(rs[0].lt.midi,rs[0].spelling[0].midi,'さいしょは導音がベースの読み');
    assert.ok(!rs.some(r=>r.key.tpc===3&&r.key.a>0),'D#m ではなく Ebm（x が出ない）');
    assert.ok(rs.some(r=>r.ninthInBass),'pcs '+c+': 第9音がベースの読み');
  }
  for(const k of MIN){
    const v=H.vii7(k), rs=givenFirst(v,'notes '+kn(k));
    assert.equal(rs[0].keyIdx,k.idx,kn(k)+': わたした調がさいしょ');
    eq(rs[0].spelling.map(n=>n.tag),v.map(n=>n.tag),kn(k)+': おなじ tag');
    const rk=H.dimReadings(k);
    checkReadings(rk,'key '+kn(k));
    assert.equal(rk[0].keyIdx,k.idx,kn(k)); assert.equal(rk[0].given,true);
    eq([rk[0].key.l,rk[0].key.a],[k.l,k.a],kn(k));
  }
  // 長調：同主短調の減七（準固有の ○Ⅶ7）として読む。つづりは H.borrowed(key,'vii_dim7') とおなじ（変イ長調で x を出さない）
  for(const k of MAJ){
    const w='major '+kn(k), rk=H.dimReadings(k);
    checkReadings(rk,w);
    assert.equal(rk[0].given,true,w); eq([rk[0].key.l,rk[0].key.a],[k.l,k.a],w+': 同主短調');
    const set=ns=>ns.map(n=>n.letter+':'+n.acc).sort().join(',');
    assert.equal(set(rk[0].spelling),set(H.borrowed(k,'vii_dim7')),w+': ○Ⅶ7のつづり');
    assert.ok(!rk[0].spelling.some(n=>n.acc===2),w+': x が出ない');
    givenFirst(H.borrowed(k,'vii_dim7'),'borrowed '+kn(k));
  }
  // ドッペルの減七・副属のⅦ7（目標ぜんぶ）
  for(const k of KEYS){
    givenFirst(PA.chroma.ddStack(k,'ddim'),'ddim '+kn(k));
    for(const t of H.targets(k)){
      const s=H.secondary(k,t,'vii7'), rs=givenFirst(s,`sec ${kn(k)} ${t}`);
      // おなじ音にはおなじ tag（secondary の 'chrom'・'raised' は調にない音のしるしなのでのぞく）
      const core=x=>['lt','seventh','b9','ninth'].includes(x)?x:null;
      eq(rs[0].spelling.map(n=>n.tag),[...J(s)].sort((a,b)=>a.midi-b.midi).map(n=>core(n.tag)),`sec ${kn(k)} ${t}: おなじ tag`);
    }
  }
  assert.equal(H.dimReadings([0,4,7,10]),null); assert.equal(H.dimReadings([0,3]),null); assert.equal(H.dimReadings(null),null);
});
test('ドイツの6とⅤ7/♭Ⅱ：おなじけんばん、♯4と♭5の読みかえ',()=>{
  for(const k of KEYS){
    const w='ger '+kn(k), g=H.ger6Vs7(k);
    // PA.chroma の増六とおなじ音（ベースだけ bassShift オクターブ）
    const sh=(ns,d)=>J(ns).map((n,i)=>({...n,midi:n.midi+(i?0:d)}));
    assert.ok(g.bassShift===0||g.bassShift===-12,w);
    eq(g.ger,sh(PA.chroma.aug6(k,'ger'),g.bassShift),w); eq(g.gerRes,[sh(PA.chroma.gerToI64(k),g.bassShift),sh(PA.chroma.aug6ToV(k,'ger'),g.bassShift)],w);
    [g.ger,...g.gerRes,g.v7,g.v7Res].forEach((c,i)=>inRange(c,w+'音域'+i));
    progression([g.ger,...g.gerRes],w+' ger→Ⅰ6/4→Ⅴ');
    noDim5P5Bass(g.v7,g.v7Res,w);
    checkNotes(g.v7,w); checkNotes(g.v7Res,w);
    eq(g.v7.map(n=>n.midi),g.ger.map(n=>n.midi),w+': おなじけんばん');
    g.v7.forEach((n,i)=>{
      if(i===g.diff){assert.notEqual(n.letter,g.ger[i].letter,w);assert.equal(n.letter,mod(k.l+4,7),w+': ♭5');}
      else eq([n.letter,n.acc],[g.ger[i].letter,g.ger[i].acc],w);
    });
    chordIs(g.v7,R(k,5,8),DOM7,w);
    chordIs(g.v7Res,R(k,1,1),MAJ3,w+'♭Ⅱ',[[4,7]]);
    noCross(g.v7,w); noCross(g.v7Res,w,false); noParallels(g.v7,g.v7Res,w);
    tendencies(g.v7,g.v7Res,w);
    g.v7Res.forEach((x,i)=>{if(i) assert.ok(Math.abs(mv(g.v7[i],x).d)<=1,w+': 上の声は2度で');});
    assert.ok(g.v7Res[0].midi<g.v7Res[1].midi,w);
  }
});

// ---------- 調の導音を重ねない・おなじ音にはおなじ tag ----------
test('どのすすみ先にも調の導音は2つ入らない',()=>{
  for(const k of KEYS){
    const lt=mod(k.tpc+11,12), g=H.ger6Vs7(k);
    const all={
      N6:[H.neapolitan(k),H.toV(k),...H.viaI64(k)],
      vii:[H.vii7(k),H.vii7ToI(k),H.v9(k),H.v9ToI(k),H.viiCompare(k).toI],
      ger:[g.ger,...g.gerRes,g.v7,g.v7Res],
      ...(k.minor?{}:Object.fromEntries(H.BORROWED_IDS.map(id=>['b:'+id,[H.borrowed(k,id),H.diatonic(k,id),H.nextOf(k,id),H.nextOf(k,id,false)]]))),
      ...Object.fromEntries(H.targets(k).flatMap(t=>['V7','vii7','vii7h'].map(kd=>['s:'+t+kd,[H.secondary(k,t,kd),H.resolveSecondary(k,t,kd),H.targetTriad(k,t)].filter(Boolean)]))),
    };
    for(const [name,lists] of Object.entries(all)) lists.forEach((c,i)=>
      assert.ok(c.filter(n=>pc(n)===lt).length<=1,`${kn(k)} ${name}#${i}: 導音が2つ（${nm(c)}）`));
    // 減七の読みの解決（それぞれの調の導音）
    for(const r of H.dimReadings(k)) [r.resolution,r.next].filter(Boolean).forEach(c=>
      assert.ok(c.filter(n=>pc(n)===mod(r.key.tpc+11,12)).length<=1,`${kn(k)} ${kn(r.key)}: 導音が2つ`));
  }
});
test('おなじ音にはおなじ tag（Ⅶ7・根音省略のⅤ9・準固有のⅦ7・Ⅶ7/Ⅴ）',()=>{
  const tagOf=ns=>Object.fromEntries(J(ns).map(n=>[n.letter+':'+n.acc,n.tag]));
  const core=x=>['lt','seventh','b9','ninth'].includes(x)?x:null;
  for(const k of KEYS){
    eq(tagOf(H.vii7(k)),tagOf(H.rootless9(k)),kn(k));
    eq(tagOf(H.vii7(k,'vii')),tagOf(H.vii7(k)),kn(k));
    if(!k.minor){
      eq(J(H.diatonic(k,'vii_dim7')).map(n=>[n.letter,n.acc,n.role,n.tag]),J(H.vii7(k)).map(n=>[n.letter,n.acc,n.role,n.tag]),kn(k)+': Ⅶ7とおなじ');
      const b=tagOf(H.borrowed(k,'vii_dim7')), d=tagOf(H.viiCompare(k).dim);
      eq(b,d,kn(k)+': 準固有のⅦ7とくらべの減七');
    }else eq(tagOf(H.viiCompare(k).dim),tagOf(H.vii7(k)),kn(k));
    // Ⅶ7/Ⅴを目標（Ⅴ）の短調として読むとおなじ tag
    const s=H.secondary(k,5,'vii7'), r=H.dimReadings(s)[0];
    const st=tagOf(s); Object.keys(st).forEach(x=>st[x]=core(st[x]));
    eq(tagOf(r.spelling),st,kn(k)+': Ⅶ7/Ⅴ');
  }
});
test('和音記号：藝大式（○＝準固有、2段＝○度調のⅤ、斜線＝根音省略、右上＝転回形、短調のⅢ・Ⅶは（自然））',()=>{
  const O='（根音省略）';
  for(const k of MAJ){
    eq(H.BORROWED_IDS.map(id=>H.label(k,'borrowed',id)),['○Ⅳ','○Ⅱ¹','○Ⅱ₇','○Ⅵ','○Ⅴ₉','○Ⅴ₉'+O],kn(k));
    eq(H.BORROWED_IDS.map(id=>H.label(k,'diatonic',id)),['Ⅳ','Ⅱ¹','Ⅱ₇','Ⅵ','Ⅴ₉','Ⅴ₉'+O],kn(k));
    eq(H.BORROWED_IDS.map(id=>H.label(k,'borrowed',id,null,{voiced:true})),['○Ⅳ','○Ⅱ¹','○Ⅱ₇','○Ⅵ','○Ⅴ₉','○Ⅴ₉¹'+O],kn(k)+' ならべた形');
    eq(H.targets(k).map(t=>H.label(k,'target',t)),['Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'],kn(k));
    eq(H.targets(k).map(t=>H.label(k,'secondary',t,'V7')),['ⅡのⅤ₇','ⅢのⅤ₇','ⅣのⅤ₇','ⅤのⅤ₇','ⅥのⅤ₇'],kn(k));
    eq(H.targets(k).map(t=>H.label(k,'secondary',t,'vii7')),['ⅡのⅤ₉'+O,'ⅢのⅤ₉'+O,'○ⅣのⅤ₉'+O,'○ⅤのⅤ₉'+O,'ⅥのⅤ₉'+O],kn(k));
    eq(H.targets(k).map(t=>H.label(k,'secondary',t,'vii7h')),['','','ⅣのⅤ₉'+O,'ⅤのⅤ₉'+O,''],kn(k));
    eq(H.targets(k).map(t=>H.label(k,'secondary',t,'vii7',{voiced:true})),['ⅡのⅤ₉¹'+O,'ⅢのⅤ₉¹'+O,'○ⅣのⅤ₉¹'+O,'○ⅤのⅤ₉¹'+O,'ⅥのⅤ₉¹'+O],kn(k));
    // ナポリの六：Ⅱの根音下方変位・第1転回形（長調は下げた第6音をかりるので○）
    assert.equal(H.label(k,'N6'),'○Ⅱ¹（根音下方変位）',kn(k));
    assert.ok(!H.label(k,'borrowed','vii_dim7').includes('°'));
  }
  for(const k of MIN){
    H.BORROWED_IDS.forEach(id=>{assert.equal(H.label(k,'borrowed',id),'');assert.equal(H.label(k,'diatonic',id),'');});
    eq(H.targets(k).map(t=>H.label(k,'target',t)),['Ⅲ（自然）','Ⅳ','Ⅴ','Ⅵ','Ⅶ（自然）'],kn(k));
    eq(H.targets(k).map(t=>H.targetIsNatural(k,t)),[true,false,false,false,true],kn(k));
    eq(H.targets(k).map(t=>H.label(k,'secondary',t,'V7')),['ⅢのⅤ₇（自然）','ⅣのⅤ₇','ⅤのⅤ₇','ⅥのⅤ₇','ⅦのⅤ₇（自然）'],kn(k));
    eq(H.targets(k).map(t=>H.label(k,'secondary',t,'vii7')),['○ⅢのⅤ₉（自然）'+O,'ⅣのⅤ₉'+O,'ⅤのⅤ₉'+O,'○ⅥのⅤ₉'+O,'○ⅦのⅤ₉（自然）'+O],kn(k));
    eq(H.targets(k).map(t=>H.label(k,'secondary',t,'vii7h')),['ⅢのⅤ₉（自然）'+O,'','','ⅥのⅤ₉'+O,'ⅦのⅤ₉（自然）'+O],kn(k));
    assert.equal(H.label(k,'N6'),'Ⅱ¹（根音下方変位）',kn(k));
  }
  for(const k of KEYS){
    assert.equal(H.label(k,'vii7'),'Ⅴ₉'+O);
    assert.equal(H.label(k,'vii7',null,null,{voiced:true}),'Ⅴ₉¹'+O);
    assert.equal(H.label(k,'v9'),'Ⅴ₉');
    eq(H.rnParts(k,'v7bII'),{of:2,ofDown:true,deg:5,form:7});
    for(const t of H.targets(k)) for(const kd of ['V7','vii7','vii7h']) assert.ok(!/[°ø/]/.test(H.label(k,'secondary',t,kd)),kn(k));
    // H.rn は PA.rn の HTML（読み上げのことばつき）
    assert.match(H.rn(k,'secondary',5,'V7'),/^<span class="rnum" role="img" aria-label="ⅤのⅤ、7の和音">/);
  }
});

// ---------- 重嬰・重変（どこで出るか） ----------
test('重嬰（x）・重変（𝄫）はきめたところだけ',()=>{
  for(const k of KEYS){
    const sig=PA.sigInfo(k), nSharp=sig.type>0?sig.letters.length:0, nFlat=sig.type<0?sig.letters.length:0;
    const all={
      N6:[H.neapolitan(k),H.toV(k),...H.viaI64(k)],
      vii:[H.vii7(k),H.vii7ToI(k),H.v9(k),H.v9ToI(k)],
      ...(k.minor?{}:Object.fromEntries(H.BORROWED_IDS.map(id=>['b:'+id,[H.borrowed(k,id),H.diatonic(k,id),H.nextOf(k,id)]]))),
      ...Object.fromEntries(H.targets(k).flatMap(t=>['V7','vii7','vii7h'].map(kd=>['s:'+t+kd,[H.secondary(k,t,kd)||[],H.resolveSecondary(k,t,kd)||[],H.targetTriad(k,t)]]))),
    };
    for(const [name,lists] of Object.entries(all)){
      const ns=lists.flat();
      if(ns.some(n=>n.acc===2)) assert.ok(nSharp>=3||(k.minor&&nSharp>=2),`${kn(k)} ${name}: x（${nm(ns.filter(n=>n.acc===2))}）`);
      if(ns.some(n=>n.acc===-2)) assert.ok(nFlat>=3,`${kn(k)} ${name}: 𝄫（${nm(ns.filter(n=>n.acc===-2))}）`);
    }
    // 調の音と主要な解決先には重変が出ない（長調のⅤ・Ⅰ）
    [H.toV(k),...H.viaI64(k),H.vii7ToI(k)].flat().forEach(n=>assert.ok(n.acc>-2,kn(k)));
  }
});

// ---------- 文字（3つの書きかた） ----------
test('表示の文字：undefined・NaN・[object・生の x/𝄫 が出ない（solfa / en / ja）',()=>{
  const old=PA.settings.naming;
  try{
    for(const naming of ['solfa','en','ja']){
      PA.settings.naming=naming;
      let html='', text='';
      const add=ns=>{if(!ns) return; html+=PA.namesH(ns)+'|'+ns.map(n=>n.role).join(',')+'|'; text+=PA.namesT(ns)+'|';};
      for(const k of KEYS){
        [H.neapolitan(k),H.toV(k),...H.viaI64(k),H.vii7(k),H.vii7ToI(k),H.rootless9(k),H.v9(k),H.v9ToI(k)].forEach(add);
        const c=H.viiCompare(k); [c.half,c.dim,c.toI].forEach(add);
        const g=H.ger6Vs7(k); [g.v7,g.v7Res].forEach(add);
        for(const id of H.BORROWED_IDS){[H.borrowed(k,id),H.diatonic(k,id),H.nextOf(k,id)].forEach(add);html+=H.symbol(k,'borrowed',id)+H.symbol(k,'diatonic',id)+H.label(k,'borrowed',id)+H.label(k,'diatonic',id);}
        for(const t of H.targets(k)){
          add(H.targetTriad(k,t)); html+=H.symbol(k,'target',t)+H.label(k,'target',t);
          for(const kd of ['V7','vii7','vii7h']){add(H.secondary(k,t,kd));add(H.resolveSecondary(k,t,kd));html+=H.symbol(k,'secondary',t,kd)+H.label(k,'secondary',t,kd);}
        }
        ['N6','bII','vii7','v9','v7bII'].forEach(x=>{html+=H.symbol(k,x)+H.label(k,x);});
        add(H.vii7(k,'vii'));
        H.dimReadings(k).forEach(r=>{add(r.spelling);add(r.resolution);add(r.next);html+=PA.keyName(r.key)+PA.keyEn(r.key)+PA.sigLabel(r.key);});
        H.dimReadings(H.secondary(k,5,'vii7')).forEach(r=>{add(r.spelling);add(r.resolution);add(r.next);html+=PA.keyName(r.key)+PA.keyEn(r.key);});
        [g.ger,...g.gerRes].forEach(add);
      }
      for(const bad of ['undefined','NaN','[object','𝄪','𝄫']) assert.ok(!html.includes(bad),`${naming}: ${bad}`);
      for(const bad of ['undefined','NaN','[object']) assert.ok(!text.includes(bad),`${naming}: ${bad}`);
      assert.ok(html.includes('class="ds"')&&html.includes('class="df"'),naming+': x・♭♭の表示');
    }
  }finally{PA.settings.naming=old;}
});
test('PA.H／PA.Svg：𝄫 は♭♭、𝄪 は太い x',()=>{
  assert.equal(PA.H('E𝄫'),'E<span class="df" style="letter-spacing:-.12em">♭♭</span>');
  assert.equal(PA.H('F𝄪'),'F<span class="ds">x</span>');
  assert.ok(!PA.Svg('B𝄫').includes('𝄫')&&PA.Svg('B𝄫').includes('♭♭'));
  assert.equal(PA.H('C♯ D♭'),'C♯ D♭');
});

// ---------- これまでのしくみはかわらない ----------
test('これまでの PA（PA.chroma など）の結果はかわらない（git の HEAD とくらべる）',t=>{
  const dir=path.dirname(fileURLToPath(import.meta.url));
  let old;
  try{old=execFileSync('git',['show','HEAD:assets/core.js'],{cwd:dir,encoding:'utf8'});}catch(e){t.skip('git がつかえない');return;}
  const PB=loadPA(old);
  if(PB.henka){t.skip('HEAD にすでに PA.henka がある');return;}
  const snap=P=>{
    const out=[];
    for(let i=0;i<13;i++) for(const minor of [false,true]){
      const k=P.keyOf(minor,i), C=P.chroma;
      out.push(k,C.ii7(k),C.dd(k),C.toV(k),C.ddStack(k,'dd'),C.ddStack(k,'dd9'),C.ddStack(k,'dd9',true),C.ddStack(k,'ddim'),
        ...['it','fr','ger'].flatMap(x=>[C.aug6(k,x),C.aug6ToV(k,x)]),C.gerToI64(k),C.gerMajorAlt(k),
        ...['ii7','dd','dd9','ddim'].map(x=>C.symbol(k,x)),P.keyName(k),P.sigLabel(k),
        P.staffSVG(k,[{notes:C.dd(k),label:'x'}]),P.kbSVG(48,72,new Map([[60,{fill:'#f00',label:'ド'}]])));
      for(const naming of ['solfa','en','ja']){P.settings.naming=naming;out.push(P.namesH(C.ddStack(k,'dd9')),P.namesT(C.aug6(k,'ger')));}
      P.settings.naming='solfa';
    }
    return JSON.stringify(out);
  };
  // 𝄫 の表示だけは新しく♭♭にした
  const norm=s=>s.replace(/<span class=\\"df\\" style=\\"letter-spacing:-\.12em\\">♭♭<\/span>/g,'𝄫').replace(/<tspan letter-spacing=\\"-1\.5\\">♭♭<\/tspan>/g,'𝄫');
  assert.equal(norm(snap(PA)),snap(PB));
});
