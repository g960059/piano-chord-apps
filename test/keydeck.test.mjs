// PA.keyDeck（クイズ用の 調の ふくろ・24調 チェック表）の テスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPA} from './_load.mjs';

const PA=loadPA(), D=PA.keyDeck;
const J=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepStrictEqual(J(a),J(b),m);
// きろくは Map に 文字列で（localStorage と おなじ ように JSON で 入れる）
const raw=new Map();
PA.store={
  get(k,d){try{const v=raw.get('pianoapps.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){raw.set('pianoapps.'+k,JSON.stringify(v));}
};
const mulberry=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const TIERS=['easy','normal','hard','all'], MODES=[['major'],['minor'],['major','minor']];
let qn=0; const q=()=>'t-'+(qn++);
const name=id=>{const p=D.parse(id);return PA.keyName(PA.keyOf(p.minor,p.idx));};

test('調の id：26こ（長調13・短調13）、parse と id が もどる',()=>{
  const all=D.ids({tier:'all'});
  assert.equal(all.length,26);
  assert.equal(new Set(all).size,26);
  for(let i=0;i<13;i++){
    assert.ok(all.includes('M'+i)&&all.includes('m'+i));
    eq(D.parse('M'+i),{minor:false,idx:i,id:'M'+i});
    eq(D.parse('m'+i),{minor:true,idx:i,id:'m'+i});
  }
  ['M13','m13','M01','x3','M-1','','M','3',null,undefined,'M1 '].forEach(b=>assert.equal(D.parse(b),null,String(b)));
  // 嬰ヘ長調／変ト長調、嬰ニ短調／変ホ短調 は 調号6つ
  assert.equal(D.sigOf(false,6).n,6); assert.equal(D.sigOf(false,12).n,6);
  assert.equal(D.sigOf(true,6).n,6); assert.equal(D.sigOf(true,12).n,6);
});

test('むずかしさ：調号の 数で わける（長調・短調）',()=>{
  const want={easy:[0,1],normal:[2,3],hard:[4,5],all:[0,6]};
  assert.equal(D.TIERS.length,4);
  D.TIERS.forEach(t=>{assert.deepEqual([t.min,t.max],want[t.id]);assert.ok(t.label.includes(`調号 ${t.min}〜${t.max}`));});
  for(const tier of TIERS) for(const modes of MODES){
    const ids=D.ids({tier,modes});
    const exp=D.ids({tier:'all'}).filter(id=>{const p=D.parse(id),n=D.sigOf(p.minor,p.idx).n;return modes.includes(p.minor?'minor':'major')&&n>=want[tier][0]&&n<=want[tier][1];});
    eq([...ids].sort(),[...exp].sort(),tier+' '+modes);
    assert.ok(ids.length>0);
  }
  // 名前で たしかめる
  eq(D.ids({tier:'easy',modes:['major']}).map(name),['ハ長調','ト長調','ヘ長調']);
  eq(D.ids({tier:'easy',modes:['minor']}).map(name),['イ短調','ホ短調','ニ短調']);
  eq(D.ids({tier:'normal',modes:['major']}).map(name),['ニ長調','変ロ長調','イ長調','変ホ長調']);
  eq(D.ids({tier:'hard',modes:['minor']}).map(name),['嬰ハ短調','ヘ短調','嬰ト短調','変ロ短調']);
  // easy＋normal＋hard＋調号6つ ＝ all
  const six=D.ids({tier:'all'}).filter(id=>{const p=D.parse(id);return D.sigOf(p.minor,p.idx).n===6;});
  assert.equal(six.length,4);
  eq([...D.ids({tier:'easy'}),...D.ids({tier:'normal'}),...D.ids({tier:'hard'}),...six].sort(),[...D.ids({tier:'all'})].sort());
  // わからない tier・modes は ぜんぶ
  eq(D.ids({tier:'??',modes:[]}),D.ids({tier:'all'}));
  eq(D.create({quiz:q(),tier:'zzz',modes:['x']}).options,{tier:'all',modes:['major','minor'],weak:true});
});

test('ふくろ：1つの ふくろで どの 調も ちょうど 1回、ふくろを またいでも つづけて 同じ 調は 出ない',()=>{
  for(const tier of TIERS) for(const modes of MODES) for(const weak of [false,true]) for(let seed=1;seed<=6;seed++){
    const deck=D.create({quiz:q(),tier,modes,weak,rng:mulberry(seed)}), n=deck.size, ids=deck.ids, seq=[];
    for(let i=0;i<n*12;i++){const r=deck.draw();assert.ok(r);assert.equal(r.id,D.id(r.minor,r.idx));seq.push(r.id);}
    for(let b=0;b<12;b++) eq(seq.slice(b*n,b*n+n).sort(),[...ids].sort(),`${tier} ${modes} bag ${b}`);
    for(let i=1;i<seq.length;i++) assert.notEqual(seq[i],seq[i-1],`${tier} ${modes} seed ${seed} @${i}`);
  }
  // 'all' は 26の 調を ぜんぶ 出す
  const deck=D.create({quiz:q(),tier:'all',rng:mulberry(9)}), got=new Set();
  for(let i=0;i<26;i++) got.add(deck.draw().id);
  assert.equal(got.size,26);
});

test('rng：おなじ たねなら おなじ じゅん、Math.random でも うごく',()=>{
  const a=D.create({quiz:q(),rng:mulberry(42)}), b=D.create({quiz:q(),rng:mulberry(42)});
  const sa=[...Array(60)].map(()=>a.draw().id), sb=[...Array(60)].map(()=>b.draw().id);
  eq(sa,sb);
  const c=D.create({quiz:q(),rng:mulberry(43)});
  assert.notDeepStrictEqual(sa,[...Array(60)].map(()=>c.draw().id));
  const d=D.create({quiz:q(),tier:'easy'});
  for(let i=0;i<30;i++) assert.ok(d.draw());
  // こわれた rng（NaN・1 いじょう）でも こわれない
  for(const bad of [()=>NaN,()=>1,()=>-5,()=>0.9999999999]){
    const e=D.create({quiz:q(),rng:bad}), s=[...Array(52)].map(()=>e.draw().id);
    eq(s.slice(0,26).sort(),[...e.ids].sort());
  }
});

test('filter：合う 調だけ ふくろから とり、合わない 調は のこす',()=>{
  const isMaj=k=>!k.minor, isMin=k=>k.minor;
  for(let seed=1;seed<=8;seed++){
    // 長調だけを 13回ずつ：13回ごとに 長調 ぜんぶ
    const deck=D.create({quiz:q(),tier:'all',rng:mulberry(seed)});
    const seq=[...Array(13*6)].map(()=>deck.draw(isMaj));
    seq.forEach(r=>assert.equal(r.minor,false));
    for(let b=0;b<6;b++) eq(seq.slice(b*13,b*13+13).map(r=>r.id).sort(),D.ids({modes:['major']}).sort());
    assert.ok(deck.bag.length<=26,'ふくろが 大きく なりすぎない');
    // その あと 短調を 13回：短調は まだ 1回も 出ていないので、13回で 短調 ぜんぶ
    const mins=[...Array(13)].map(()=>deck.draw(isMin).id);
    eq(mins.sort(),D.ids({modes:['minor']}).sort());

    // 長調・短調・filterなし を まぜても、26回で 26の 調が 1回ずつ（むだに しない）
    const d2=D.create({quiz:q(),tier:'all',rng:mulberry(seed+100)}), got=[];
    const f=[isMaj,isMin,undefined];
    for(let i=0;i<26;i++){
      // のこりに 合う 調が ないときは ほかの filter を つかう（ふくろの 外から とらない ように）
      const left=d2.bag, fi=[i%3,(i+1)%3,(i+2)%3].find(j=>i===0||left.some(id=>!f[j]||f[j](D.parse(id))));
      const r=d2.draw(f[fi]); got.push(r.id);
      if(f[fi]) assert.ok(f[fi](r));
    }
    eq(got.sort(),D.ids({tier:'all'}).sort());
  }
  // 合う 調が ない → null。合う 調が 1つだけ → その 調を くりかえす
  const deck=D.create({quiz:q(),tier:'easy',modes:['minor'],rng:mulberry(1)});
  assert.equal(deck.draw(isMaj),null);
  for(let i=0;i<5;i++) eq(deck.draw(k=>k.id==='m1'),{minor:true,idx:1,id:'m1'});
  assert.equal(D.create({quiz:q(),tier:'hard',modes:['major']}).draw(k=>k.idx===0),null);
  // filter に わたす もの
  const seen=[]; D.create({quiz:q(),tier:'easy',modes:['major'],rng:mulberry(2)}).draw(k=>{seen.push(J(k));return true;});
  seen.forEach(k=>{assert.equal(typeof k.minor,'boolean');assert.ok(Number.isInteger(k.idx));assert.equal(k.id,D.id(k.minor,k.idx));});
});

test('weak：まちがいの 多い 調は 新しい ふくろに 多く 入る（2こまで）',()=>{
  // よぶんの 数
  assert.equal(D.extraCopies(undefined),0);
  assert.equal(D.extraCopies({right:5,wrong:0}),0);
  assert.equal(D.extraCopies({right:0,wrong:1}),1);
  assert.equal(D.extraCopies({right:0,wrong:2}),2);
  assert.equal(D.extraCopies({right:0,wrong:9}),2);
  assert.equal(D.extraCopies({right:3,wrong:2}),1);
  assert.equal(D.extraCopies({right:6,wrong:2}),0);

  for(let seed=1;seed<=6;seed++){
    const quiz=q(), deck=D.create({quiz,tier:'all',weak:true,rng:mulberry(seed)});
    deck.record('M4',false); deck.record('M4',false); deck.record('M4',false);
    deck.record('m9',false);
    deck.record('M0',true);
    const N=29*10, cnt={};
    for(let i=0;i<N;i++){const id=deck.draw().id;cnt[id]=(cnt[id]||0)+1;}
    // ふくろ 1つ＝26＋2＋1＝29こ。10ぶくろで M4＝30、m9＝20、ほか＝10
    assert.equal(cnt.M4,30); assert.equal(cnt.m9,20); assert.equal(cnt.M0,10); assert.equal(cnt.m3,10);
    // weak：false なら ふつう
    const plain=D.create({quiz,tier:'all',weak:false,rng:mulberry(seed)}), c2={};
    for(let i=0;i<260;i++){const id=plain.draw().id;c2[id]=(c2[id]||0)+1;}
    assert.ok(Object.values(c2).every(v=>v===10));
    assert.equal(Object.keys(c2).length,26);
  }
  // 小さい ふくろでも つづけて 同じ 調は 出ない（できる ときは）
  for(let seed=1;seed<=40;seed++){
    const quiz=q(), deck=D.create({quiz,tier:'easy',weak:true,rng:mulberry(seed)});
    deck.record('M1',false); deck.record('M1',false);
    let prev=null, cM1=0;
    for(let i=0;i<8*20;i++){const id=deck.draw().id;assert.notEqual(id,prev,`seed ${seed} @${i}`);prev=id;if(id==='M1')cM1++;}
    assert.equal(cM1,60);
  }
  // 新しい ふくろから 重みが つく（いまの ふくろは そのまま）。reset で もとに もどる
  const quiz=q(), deck=D.create({quiz,tier:'easy',modes:['major'],rng:mulberry(3)});
  deck.draw(); assert.equal(deck.bag.length,2);
  deck.record('M7',false); deck.record('M7',false);
  deck.draw(); deck.draw(); deck.draw();
  assert.equal(deck.bag.filter(id=>id==='M7').length+(deck.last==='M7'?1:0),3);
  deck.reset(); eq(deck.stats(),{}); assert.equal(deck.bag.length,0);
  const s=[...Array(9)].map(()=>deck.draw().id);
  ['M0','M1','M7'].forEach(id=>assert.equal(s.filter(x=>x===id).length,3));
});

test('きろく：record・stats・reset と、こわれた きろく',()=>{
  const quiz=q(), sk='pianoapps.keystats-'+quiz;
  let t=1000; const deck=D.create({quiz,now:()=>t});
  eq(deck.stats(),{});
  eq(deck.record('m5',true),{right:1,wrong:0,last:1000});
  t=2000; deck.record('m5',false); t=3000; deck.record('M12',false);
  eq(deck.stats(),{m5:{right:1,wrong:1,last:2000},M12:{right:0,wrong:1,last:3000}});
  eq(JSON.parse(raw.get(sk)),{m5:{right:1,wrong:1,last:2000},M12:{right:0,wrong:1,last:3000}});
  // べつの deck・べつの quiz
  eq(D.create({quiz}).stats(),deck.stats());
  eq(D.stats(quiz),deck.stats());
  eq(D.create({quiz:q()}).stats(),{});
  // まちがった id は きろくしない
  ['M13','x','m01',null,5].forEach(b=>assert.equal(deck.record(b,true),null));
  eq(Object.keys(deck.stats()).sort(),['M12','m5']);
  deck.reset(); eq(deck.stats(),{}); eq(D.stats(quiz),{});
  // こわれた きろく
  for(const bad of ['nope','[1,2]','null','42','"s"','{"M0":7}','{"M0":[1,2]}']){
    raw.set(sk,bad); eq(D.stats(quiz),{},bad);
    eq(D.create({quiz,now:()=>5}).record('M0',true),{right:1,wrong:0,last:5},bad);
  }
  raw.set(sk,JSON.stringify({
    M0:{right:-1,wrong:'3',last:'x'}, M1:{right:2.7,wrong:1e12,last:-4}, M99:{right:1,wrong:1}, X:{right:1}, m01:{right:1},
    m3:{right:4,wrong:1,last:123,extra:'zzz'}, m4:{right:0,wrong:0}, M2:null
  }));
  eq(D.stats(quiz),{M1:{right:2,wrong:1e6,last:0},m3:{right:4,wrong:1,last:123}});
  eq(deck.record('M1',false),{right:2,wrong:1e6,last:deck.stats().M1.last});
  const draws=D.create({quiz,weak:true,rng:mulberry(1)});
  for(let i=0;i<40;i++) assert.ok(draws.draw());
  // quiz の 名前は 英小文字・数字・-
  for(const bad of ['','A B','../x','あ',undefined,'-x']) assert.throws(()=>D.create({quiz:bad}),{name:'TypeError'},String(bad));
  assert.doesNotThrow(()=>D.create({quiz:'minor-quiz'}));
});

test('mastery：まだ・にがて・れんしゅう中・できた',()=>{
  assert.equal(D.mastery(undefined),'none');
  assert.equal(D.mastery({right:0,wrong:0}),'none');
  assert.equal(D.mastery({right:0,wrong:1}),'weak');
  assert.equal(D.mastery({right:2,wrong:2}),'weak');
  assert.equal(D.mastery({right:1,wrong:0}),'learning');
  assert.equal(D.mastery({right:3,wrong:1}),'learning');
  assert.equal(D.mastery({right:3,wrong:0}),'good');
  assert.equal(D.mastery({right:8,wrong:2}),'good');
});

test('tierSeg：4つの ボタン（PA.seg）',()=>{
  const h=D.tierSeg('tier','normal');
  assert.equal((h.match(/<button /g)||[]).length,4);
  assert.match(h,/class="on" data-act="tier" data-v="normal" aria-pressed="true"/);
  assert.equal((h.match(/aria-pressed="true"/g)||[]).length,1);
  ['🌱','🌿','🌳','🌏','調号 0〜1','調号 2〜3','調号 4〜5','調号 0〜6'].forEach(s=>assert.ok(h.includes(s),s));
  assert.match(h,/^<div class="seg kd-tiers" style="display:grid;/);
  assert.match(D.tierSeg('tier','???'),/class="on" data-act="tier" data-v="all"/);
});

test('checkTableHTML：24調 チェック表',()=>{
  const quiz=q(), deck=D.create({quiz});
  [['M0',true],['M0',true],['M0',true],['M1',false],['m6',true],['m12',false],['m12',true]].forEach(([id,ok])=>deck.record(id,ok));
  const h=D.checkTableHTML(quiz);
  assert.ok(h.includes('24調 チェック表'));
  const cells=[...h.matchAll(/<li data-key="(\w+)" data-mastery="(\w+)"/g)].map(m=>[m[1],m[2]]);
  assert.equal(cells.length,26);
  const ms=Object.fromEntries(cells);
  assert.equal(ms.M0,'good'); assert.equal(ms.M1,'weak'); assert.equal(ms.m6,'learning'); assert.equal(ms.m12,'weak'); assert.equal(ms.M5,'none');
  // ならび：調号の 少ない じゅん（♯ → ♭）
  eq(cells.slice(0,13).map(c=>name(c[0])),['ハ長調','ト長調','ヘ長調','ニ長調','変ロ長調','イ長調','変ホ長調','ホ長調','変イ長調','ロ長調','変ニ長調','嬰ヘ長調','変ト長調']);
  eq(cells.slice(13).map(c=>name(c[0])),['イ短調','ホ短調','ニ短調','ロ短調','ト短調','嬰ヘ短調','ハ短調','嬰ハ短調','ヘ短調','嬰ト短調','変ロ短調','嬰ニ短調','変ホ短調']);
  // ✓・✗ の 数と 読み上げ
  assert.ok(h.includes('ハ長調（調号なし）：できた。せいかい 3、まちがい 0'));
  assert.ok(h.includes('変ホ短調（♭6つ）：にがて。せいかい 1、まちがい 1'));
  assert.ok(h.includes('✓3</span>')&&h.includes('✗1</span>'));
  assert.ok(h.includes('できた 調：1 ／ 26'));
  assert.match(h,/<button class="btn small" data-act="keystats-reset" data-v="[^"]+">/);
  // 375px：横に はみださない（はばの 決まった 大きい 要素が ない、grid は 54px から）
  assert.ok(!/(?:^|[^-])width:\s*(?:[1-9]\d{2,})px/.test(h),'固定の はば');
  assert.ok(!/min-width:\s*[1-9]\d{2,}px/.test(h));
  assert.match(h,/grid-template-columns:repeat\(auto-fill,minmax\(54px,1fr\)\)/);
  assert.ok(!/𝄪|𝄫/.test(h));
  // 長調だけ
  const hm=D.checkTableHTML(quiz,{modes:['major']});
  assert.equal((hm.match(/<li /g)||[]).length,13);
  assert.ok(hm.includes('できた 調：1 ／ 13')&&!hm.includes('🌙 短調'));
  // reset の あとは ぜんぶ「まだ」
  deck.reset();
  assert.ok([...D.checkTableHTML(quiz).matchAll(/data-mastery="(\w+)"/g)].every(m=>m[1]==='none'));
});

test('state / restore：ふくろの のこりと last を その まま もどす（重みは つけなおさない）',()=>{
  const quiz=q(), mk=()=>D.create({quiz,tier:'all',modes:['major'],weak:true,rng:mulberry(5)});
  const a=mk(); a.draw(); a.draw();
  const s=a.state(); a.record(s.last,false); a.record(s.last,false); // まちがいが ふえても
  const b=mk(); assert.equal(b.restore(J(s)),true);
  eq(b.state(),s,'ふくろが かわらない');
  assert.ok(!b.bag.includes(s.last)||s.bag.includes(s.last),'出た 調が もどってこない');
  assert.notEqual(b.draw().id,s.last);
  // こわれた きろく
  const c=mk();
  assert.equal(c.restore(null),false); assert.equal(c.restore({bag:'x'}),false);
  assert.equal(c.restore({bag:['M0','zz',3,'m1'],last:'qq'}),true);
  eq(c.state(),{bag:['M0'],last:null},'えらべない 調は のぞく');
  // setOptions の あと、おなじ 調の はんいなら のこりを もどせる
  const d=mk(); d.draw(); const ds=d.state(); d.setOptions({weak:false}); d.restore(ds); eq(d.state(),ds);
});
