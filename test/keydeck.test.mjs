// PA.keyDeck（クイズ用の調のふくろ・24調チェック表）のテスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPA} from './_load.mjs';

const PA=loadPA(), D=PA.keyDeck;
const J=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepStrictEqual(J(a),J(b),m);
// きろくは Map に文字列で（localStorage とおなじように JSON で入れる）
const raw=new Map();
PA.store={
  get(k,d){try{const v=raw.get('pianoapps.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){raw.set('pianoapps.'+k,JSON.stringify(v));},
  keys(){return [...raw.keys()].filter(k=>k.startsWith('pianoapps.')).map(k=>k.slice(10));}
};
const mulberry=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const TIERS=['easy','normal','hard','all'], MODES=[['major'],['minor'],['major','minor']];
let qn=0; const q=()=>'t-'+(qn++);
const name=id=>{const p=D.parse(id);return PA.keyName(PA.keyOf(p.minor,p.idx));};

test('調の id：26こ（長調13・短調13）、parse と id がもどる',()=>{
  const all=D.ids({tier:'all'});
  assert.equal(all.length,26);
  assert.equal(new Set(all).size,26);
  for(let i=0;i<13;i++){
    assert.ok(all.includes('M'+i)&&all.includes('m'+i));
    eq(D.parse('M'+i),{minor:false,idx:i,id:'M'+i});
    eq(D.parse('m'+i),{minor:true,idx:i,id:'m'+i});
  }
  ['M13','m13','M01','x3','M-1','','M','3',null,undefined,'M1 '].forEach(b=>assert.equal(D.parse(b),null,String(b)));
  // 嬰ヘ長調／変ト長調、嬰ニ短調／変ホ短調は調号6つ
  assert.equal(D.sigOf(false,6).n,6); assert.equal(D.sigOf(false,12).n,6);
  assert.equal(D.sigOf(true,6).n,6); assert.equal(D.sigOf(true,12).n,6);
});

test('むずかしさ：調号の数でわける（長調・短調）',()=>{
  const want={easy:[0,1],normal:[2,3],hard:[4,5],all:[0,6]};
  assert.equal(D.TIERS.length,4);
  D.TIERS.forEach(t=>{assert.deepEqual([t.min,t.max],want[t.id]);assert.ok(t.label.includes(`調号${t.min}〜${t.max}`));});
  for(const tier of TIERS) for(const modes of MODES){
    const ids=D.ids({tier,modes});
    const exp=D.ids({tier:'all'}).filter(id=>{const p=D.parse(id),n=D.sigOf(p.minor,p.idx).n;return modes.includes(p.minor?'minor':'major')&&n>=want[tier][0]&&n<=want[tier][1];});
    eq([...ids].sort(),[...exp].sort(),tier+' '+modes);
    assert.ok(ids.length>0);
  }
  // 名前でたしかめる
  eq(D.ids({tier:'easy',modes:['major']}).map(name),['ハ長調','ト長調','ヘ長調']);
  eq(D.ids({tier:'easy',modes:['minor']}).map(name),['イ短調','ホ短調','ニ短調']);
  eq(D.ids({tier:'normal',modes:['major']}).map(name),['ニ長調','変ロ長調','イ長調','変ホ長調']);
  eq(D.ids({tier:'hard',modes:['minor']}).map(name),['嬰ハ短調','ヘ短調','嬰ト短調','変ロ短調']);
  // easy＋normal＋hard＋調号6つ＝ all
  const six=D.ids({tier:'all'}).filter(id=>{const p=D.parse(id);return D.sigOf(p.minor,p.idx).n===6;});
  assert.equal(six.length,4);
  eq([...D.ids({tier:'easy'}),...D.ids({tier:'normal'}),...D.ids({tier:'hard'}),...six].sort(),[...D.ids({tier:'all'})].sort());
  // わからない tier・modes はぜんぶ
  eq(D.ids({tier:'??',modes:[]}),D.ids({tier:'all'}));
  eq(D.create({quiz:q(),tier:'zzz',modes:['x']}).options,{tier:'all',modes:['major','minor'],weak:true});
});

test('ふくろ：1つのふくろでどの調もちょうど1回、ふくろをまたいでもつづけて同じ調は出ない',()=>{
  for(const tier of TIERS) for(const modes of MODES) for(const weak of [false,true]) for(let seed=1;seed<=6;seed++){
    const deck=D.create({quiz:q(),tier,modes,weak,rng:mulberry(seed)}), n=deck.size, ids=deck.ids, seq=[];
    for(let i=0;i<n*12;i++){const r=deck.draw();assert.ok(r);assert.equal(r.id,D.id(r.minor,r.idx));seq.push(r.id);}
    for(let b=0;b<12;b++) eq(seq.slice(b*n,b*n+n).sort(),[...ids].sort(),`${tier} ${modes} bag ${b}`);
    for(let i=1;i<seq.length;i++) assert.notEqual(seq[i],seq[i-1],`${tier} ${modes} seed ${seed} @${i}`);
  }
  // 'all' は26の調をぜんぶ出す
  const deck=D.create({quiz:q(),tier:'all',rng:mulberry(9)}), got=new Set();
  for(let i=0;i<26;i++) got.add(deck.draw().id);
  assert.equal(got.size,26);
});

test('rng：おなじたねならおなじじゅん、Math.random でもうごく',()=>{
  const a=D.create({quiz:q(),rng:mulberry(42)}), b=D.create({quiz:q(),rng:mulberry(42)});
  const sa=[...Array(60)].map(()=>a.draw().id), sb=[...Array(60)].map(()=>b.draw().id);
  eq(sa,sb);
  const c=D.create({quiz:q(),rng:mulberry(43)});
  assert.notDeepStrictEqual(sa,[...Array(60)].map(()=>c.draw().id));
  const d=D.create({quiz:q(),tier:'easy'});
  for(let i=0;i<30;i++) assert.ok(d.draw());
  // こわれた rng（NaN・1いじょう）でもこわれない
  for(const bad of [()=>NaN,()=>1,()=>-5,()=>0.9999999999]){
    const e=D.create({quiz:q(),rng:bad}), s=[...Array(52)].map(()=>e.draw().id);
    eq(s.slice(0,26).sort(),[...e.ids].sort());
  }
});

test('filter：合う調だけふくろからとり、合わない調はのこす',()=>{
  const isMaj=k=>!k.minor, isMin=k=>k.minor;
  for(let seed=1;seed<=8;seed++){
    // 長調だけを13回ずつ：13回ごとに長調ぜんぶ
    const deck=D.create({quiz:q(),tier:'all',rng:mulberry(seed)});
    const seq=[...Array(13*6)].map(()=>deck.draw(isMaj));
    seq.forEach(r=>assert.equal(r.minor,false));
    for(let b=0;b<6;b++) eq(seq.slice(b*13,b*13+13).map(r=>r.id).sort(),D.ids({modes:['major']}).sort());
    assert.ok(deck.bag.length<=26,'ふくろが大きくなりすぎない');
    // そのあと短調を13回：短調はまだ1回も出ていないので、13回で短調ぜんぶ
    const mins=[...Array(13)].map(()=>deck.draw(isMin).id);
    eq(mins.sort(),D.ids({modes:['minor']}).sort());

    // 長調・短調・filterなしをまぜても、26回で26の調が1回ずつ（むだにしない）
    const d2=D.create({quiz:q(),tier:'all',rng:mulberry(seed+100)}), got=[];
    const f=[isMaj,isMin,undefined];
    for(let i=0;i<26;i++){
      // のこりに合う調がないときはほかの filter をつかう（ふくろの外からとらないように）
      const left=d2.bag, fi=[i%3,(i+1)%3,(i+2)%3].find(j=>i===0||left.some(id=>!f[j]||f[j](D.parse(id))));
      const r=d2.draw(f[fi]); got.push(r.id);
      if(f[fi]) assert.ok(f[fi](r));
    }
    eq(got.sort(),D.ids({tier:'all'}).sort());
  }
  // 合う調がない → null。合う調が1つだけ → その調をくりかえす
  const deck=D.create({quiz:q(),tier:'easy',modes:['minor'],rng:mulberry(1)});
  assert.equal(deck.draw(isMaj),null);
  for(let i=0;i<5;i++) eq(deck.draw(k=>k.id==='m1'),{minor:true,idx:1,id:'m1'});
  assert.equal(D.create({quiz:q(),tier:'hard',modes:['major']}).draw(k=>k.idx===0),null);
  // filter にわたすもの
  const seen=[]; D.create({quiz:q(),tier:'easy',modes:['major'],rng:mulberry(2)}).draw(k=>{seen.push(J(k));return true;});
  seen.forEach(k=>{assert.equal(typeof k.minor,'boolean');assert.ok(Number.isInteger(k.idx));assert.equal(k.id,D.id(k.minor,k.idx));});
});

test('weak：まちがいの多い調は新しいふくろに多く入る（2こまで）',()=>{
  // よぶんの数
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
    // ふくろ1つ＝26＋2＋1＝29こ。10ぶくろで M4＝30、m9＝20、ほか＝10
    assert.equal(cnt.M4,30); assert.equal(cnt.m9,20); assert.equal(cnt.M0,10); assert.equal(cnt.m3,10);
    // weak：false ならふつう
    const plain=D.create({quiz,tier:'all',weak:false,rng:mulberry(seed)}), c2={};
    for(let i=0;i<260;i++){const id=plain.draw().id;c2[id]=(c2[id]||0)+1;}
    assert.ok(Object.values(c2).every(v=>v===10));
    assert.equal(Object.keys(c2).length,26);
  }
  // 小さいふくろでもつづけて同じ調は出ない（できるときは）
  for(let seed=1;seed<=40;seed++){
    const quiz=q(), deck=D.create({quiz,tier:'easy',weak:true,rng:mulberry(seed)});
    deck.record('M1',false); deck.record('M1',false);
    let prev=null, cM1=0;
    for(let i=0;i<8*20;i++){const id=deck.draw().id;assert.notEqual(id,prev,`seed ${seed} @${i}`);prev=id;if(id==='M1')cM1++;}
    assert.equal(cM1,60);
  }
  // 新しいふくろから重みがつく（いまのふくろはそのまま）。reset でもとにもどる
  const quiz=q(), deck=D.create({quiz,tier:'easy',modes:['major'],rng:mulberry(3)});
  deck.draw(); assert.equal(deck.bag.length,2);
  deck.record('M7',false); deck.record('M7',false);
  deck.draw(); deck.draw(); deck.draw();
  assert.equal(deck.bag.filter(id=>id==='M7').length+(deck.last==='M7'?1:0),3);
  deck.reset(); eq(deck.stats(),{}); assert.equal(deck.bag.length,0);
  const s=[...Array(9)].map(()=>deck.draw().id);
  ['M0','M1','M7'].forEach(id=>assert.equal(s.filter(x=>x===id).length,3));
});

test('きろく：record・stats・reset と、こわれたきろく',()=>{
  const quiz=q(), sk='pianoapps.keystats-'+quiz;
  let t=1000; const deck=D.create({quiz,now:()=>t});
  eq(deck.stats(),{});
  // hint（ヒントでできた）と recent（さいごの8回）もきろくする
  eq(deck.record('m5',true),{right:1,wrong:0,hint:0,last:1000,recent:'o'});
  t=2000; deck.record('m5',false); t=3000; deck.record('M12',false);
  eq(deck.stats(),{m5:{right:1,wrong:1,hint:0,last:2000,recent:'ox'},M12:{right:0,wrong:1,hint:0,last:3000,recent:'x'}});
  eq(JSON.parse(raw.get(sk)),{m5:{right:1,wrong:1,hint:0,last:2000,recent:'ox'},M12:{right:0,wrong:1,hint:0,last:3000,recent:'x'}});
  // べつの deck・べつの quiz
  eq(D.create({quiz}).stats(),deck.stats());
  eq(D.stats(quiz),deck.stats());
  eq(D.create({quiz:q()}).stats(),{});
  // まちがった id はきろくしない
  ['M13','x','m01',null,5].forEach(b=>assert.equal(deck.record(b,true),null));
  eq(Object.keys(deck.stats()).sort(),['M12','m5']);
  deck.reset(); eq(deck.stats(),{}); eq(D.stats(quiz),{});
  // こわれたきろく
  for(const bad of ['nope','[1,2]','null','42','"s"','{"M0":7}','{"M0":[1,2]}']){
    raw.set(sk,bad); eq(D.stats(quiz),{},bad);
    eq(D.create({quiz,now:()=>5}).record('M0',true),{right:1,wrong:0,hint:0,last:5,recent:'o'},bad);
  }
  raw.set(sk,JSON.stringify({
    M0:{right:-1,wrong:'3',last:'x'}, M1:{right:2.7,wrong:1e12,last:-4}, M99:{right:1,wrong:1}, X:{right:1}, m01:{right:1},
    m3:{right:4,wrong:1,last:123,extra:'zzz'}, m4:{right:0,wrong:0}, M2:null,
    m5:{right:1,wrong:0,hint:2,recent:'zzohhqoxoxoxoxo'}, m6:{hint:1,recent:5}
  }));
  // recent は o・x・h だけ、さいごの8つ。数字でない recent はすてる。hint だけでものこす
  eq(D.stats(quiz),{M1:{right:2,wrong:1e6,hint:0,last:0},m3:{right:4,wrong:1,hint:0,last:123},m5:{right:1,wrong:0,hint:2,last:0,recent:'xoxoxoxo'},m6:{right:0,wrong:0,hint:1,last:0}});
  // recent のない古いきろく：それまでのようす（にがて）から 'xx' をつくってつづける
  eq(deck.record('M1',false),{right:2,wrong:1e6,hint:0,last:deck.stats().M1.last,recent:'xxx'});
  const draws=D.create({quiz,weak:true,rng:mulberry(1)});
  for(let i=0;i<40;i++) assert.ok(draws.draw());
  // quiz の名前は英小文字・数字・-
  for(const bad of ['','A B','../x','あ',undefined,'-x']) assert.throws(()=>D.create({quiz:bad}),{name:'TypeError'},String(bad));
  assert.doesNotThrow(()=>D.create({quiz:'minor-quiz'}));
});

test('mastery（recent のない古いきろく）：まだ・にがて・れんしゅう中・できた',()=>{
  // recent がないきろく（このまえまでのきろく）はまえのきまりのまま
  assert.equal(D.mastery(undefined),'none');
  assert.equal(D.mastery({right:0,wrong:0}),'none');
  assert.equal(D.mastery({right:0,wrong:1}),'weak');
  assert.equal(D.mastery({right:2,wrong:2}),'weak');
  assert.equal(D.mastery({right:1,wrong:0}),'learning');
  assert.equal(D.mastery({right:3,wrong:1}),'learning');
  assert.equal(D.mastery({right:3,wrong:0}),'good');
  assert.equal(D.mastery({right:8,wrong:2}),'good');
});

test('tierSeg：4つのボタン（PA.seg）',()=>{
  const h=D.tierSeg('tier','normal');
  assert.equal((h.match(/<button /g)||[]).length,4);
  assert.match(h,/class="on" data-act="tier" data-v="normal" aria-pressed="true"/);
  assert.equal((h.match(/aria-pressed="true"/g)||[]).length,1);
  ['🌱','🌿','🌳','🌏','調号0〜1','調号2〜3','調号4〜5','調号0〜6'].forEach(s=>assert.ok(h.includes(s),s));
  assert.match(h,/^<div class="seg kd-tiers" style="display:grid;/);
  assert.match(D.tierSeg('tier','???'),/class="on" data-act="tier" data-v="all"/);
});

test('checkTableHTML：24調チェック表（merge:false＝26のます）',()=>{
  const quiz=q(), deck=D.create({quiz});
  [['M0',true],['M0',true],['M0',true],['M1',false],['M1',false],['m6',true],['m12',false],['m12',true]].forEach(([id,ok])=>deck.record(id,ok));
  const h=D.checkTableHTML(quiz,{merge:false});
  assert.ok(h.includes('24調チェック表'));
  const cells=[...h.matchAll(/<li data-key="(\w+)" data-mastery="(\w+)"/g)].map(m=>[m[1],m[2]]);
  assert.equal(cells.length,26);
  const ms=Object.fromEntries(cells);
  // さいごの3回できめる：M1は ✗✗ でにがて。m12は ✗○ なので（まえのきまりではにがて）いまはれんしゅう中
  assert.equal(ms.M0,'good'); assert.equal(ms.M1,'weak'); assert.equal(ms.m6,'learning'); assert.equal(ms.m12,'learning'); assert.equal(ms.M5,'none');
  // ならび：調号の少ないじゅん（♯ → ♭）
  eq(cells.slice(0,13).map(c=>name(c[0])),['ハ長調','ト長調','ヘ長調','ニ長調','変ロ長調','イ長調','変ホ長調','ホ長調','変イ長調','ロ長調','変ニ長調','嬰ヘ長調','変ト長調']);
  eq(cells.slice(13).map(c=>name(c[0])),['イ短調','ホ短調','ニ短調','ロ短調','ト短調','嬰ヘ短調','ハ短調','嬰ハ短調','ヘ短調','嬰ト短調','変ロ短調','嬰ニ短調','変ホ短調']);
  // ✓・✗ の数と読み上げ
  assert.ok(h.includes('ハ長調（調号なし）：できた。じぶんでできた3、まちがい0'));
  assert.ok(h.includes('変ホ短調（♭6つ）：れんしゅう中。じぶんでできた1、まちがい1'));
  assert.ok(h.includes('✓3</span>')&&h.includes('✗2</span>'));
  assert.ok(h.includes('できた調：1／26'));
  assert.match(h,/<button class="btn small" data-act="keystats-reset" data-v="[^"]+" data-confirm="[^"]+">/);
  assert.ok(!D.checkTableHTML(quiz,{confirm:false}).includes('data-confirm'));
  // 375px：横にはみださない（はばの決まった大きい要素がない、grid は54px から）
  assert.ok(!/(?:^|[^-])width:\s*(?:[1-9]\d{2,})px/.test(h),'固定のはば');
  assert.ok(!/min-width:\s*[1-9]\d{2,}px/.test(h));
  assert.match(h,/grid-template-columns:repeat\(auto-fill,minmax\(54px,1fr\)\)/);
  assert.ok(!/𝄪|𝄫/.test(h));
  // 長調だけ
  const hm=D.checkTableHTML(quiz,{modes:['major'],merge:false});
  assert.equal((hm.match(/<li /g)||[]).length,13);
  assert.ok(hm.includes('できた調：1／13')&&!hm.includes('🌙 短調'));
  assert.ok(hm.includes('📋 長調チェック表'));
  // reset のあとはぜんぶ「まだ」
  deck.reset();
  assert.ok([...D.checkTableHTML(quiz).matchAll(/data-mastery="(\w+)"/g)].every(m=>m[1]==='none'));
});

test('state / restore：ふくろののこりと last をそのままもどす（重みはつけなおさない）',()=>{
  const quiz=q(), mk=()=>D.create({quiz,tier:'all',modes:['major'],weak:true,rng:mulberry(5)});
  const a=mk(); a.draw(); a.draw();
  const s=a.state(); a.record(s.last,false); a.record(s.last,false); // まちがいがふえても
  const b=mk(); assert.equal(b.restore(J(s)),true);
  eq(b.state(),s,'ふくろがかわらない');
  assert.ok(!b.bag.includes(s.last)||s.bag.includes(s.last),'出た調がもどってこない');
  assert.notEqual(b.draw().id,s.last);
  // こわれたきろく
  const c=mk();
  assert.equal(c.restore(null),false); assert.equal(c.restore({bag:'x'}),false);
  assert.equal(c.restore({bag:['M0','zz',3,'m1'],last:'qq'}),true);
  eq(c.state(),{bag:['M0'],last:null},'えらべない調はのぞく');
  // setOptions のあと、おなじ調のはんいならのこりをもどせる
  const d=mk(); d.draw(); const ds=d.state(); d.setOptions({weak:false}); d.restore(ds); eq(d.state(),ds);
});

test('setOptions：えらべる調がかわらなければふくろののこりはそのまま、かわればつくりなおす',()=>{
  const d=D.create({quiz:q(),tier:'normal',modes:['major'],weak:true,rng:mulberry(9)});
  d.draw(); d.draw(); const s=d.state();
  d.setOptions({weak:false}); eq(d.state(),s,'weak だけ');
  d.setOptions({tier:'normal',modes:['major']}); eq(d.state(),s,'おなじせってい');
  d.setOptions({tier:'easy'}); eq(d.bag,[],'むずかしさがかわった'); assert.equal(d.last,s.last);
});

test('ヒント：こたえるまえに見てできたは ×にしない（right・wrong はふえず hint と recent の h）',()=>{
  const quiz=q(); let t=10; const deck=D.create({quiz,now:()=>t});
  eq(deck.record('M2',true,{hint:true}),{right:0,wrong:0,hint:1,last:10,recent:'h'});
  assert.equal(D.mastery(deck.stats().M2),'learning','ヒントだけでも「まだ」ではない');
  // ヒントを見てもまちがえたら ×
  t=11; eq(deck.record('M2',false,{hint:true}),{right:0,wrong:1,hint:1,last:11,recent:'hx'});
  t=12; deck.record('M2',true,{hint:false});
  eq(deck.stats().M2,{right:1,wrong:1,hint:1,last:12,recent:'hxo'});
  // recent はさいごの8つまで
  for(let i=0;i<10;i++) deck.record('M3',i%2===0);
  assert.equal(deck.stats().M3.recent,'oxoxoxox');
  assert.equal(PA.HINT_NOTE,'こたえるまえに見ても ×にはならないよ。「ヒントでできた」になるよ');
});

test('mastery（recent）：さいごの3回できめる',()=>{
  const m=(right,wrong,recent,hint=0)=>D.mastery({right,wrong,hint,recent});
  assert.equal(m(3,0,'ooo'),'good');
  assert.equal(m(10,9,'xxooo'),'good','まえにまちがえても、さいご3回 ○ ならできた');
  assert.equal(m(2,0,'oo'),'learning','3回いじょうじぶんでできていない');
  assert.equal(m(3,0,'ooh'),'learning','さいご3つに h がある');
  assert.equal(m(5,1,'ooxoo'),'learning');
  assert.equal(m(5,2,'ooxox'),'weak','さいご3つに x が2つ');
  assert.equal(m(0,1,'x'),'learning','x 1つだけではにがてにしない');
  assert.equal(m(0,2,'xx'),'weak');
  assert.equal(m(9,3,'xxx'),'weak');
  assert.equal(m(0,0,'hh',2),'learning');
  assert.equal(m(0,0,'',0),'none');
  // よぶんの数：さいご3つの x（2まで）
  assert.equal(D.extraCopies({right:9,wrong:0,recent:'ooo'}),0);
  assert.equal(D.extraCopies({right:0,wrong:1,recent:'oox'}),1);
  assert.equal(D.extraCopies({right:9,wrong:9,recent:'xox'}),2);
  assert.equal(D.extraCopies({right:9,wrong:9,recent:'xxx'}),2);
  assert.equal(D.extraCopies({right:0,wrong:5,recent:'xxooo'}),0,'さいごができていればふやさない');
  // 古いきろく（できた）をひきつぐ：○ 1つで「れんしゅう中」にもどらない
  const quiz=q(); raw.set('pianoapps.keystats-'+quiz,JSON.stringify({M0:{right:6,wrong:0,last:1}}));
  assert.equal(D.mastery(D.stats(quiz).M0),'good');
  D.create({quiz}).record('M0',true);
  eq(D.stats(quiz).M0.recent,'oooo'); assert.equal(D.mastery(D.stats(quiz).M0),'good');
});

test('checkTableHTML：merge（ふつう）でおなじ音の調を1つのますに → 12＋12＝24',()=>{
  const quiz=q(); let t=1; const deck=D.create({quiz,now:()=>t++});
  // 嬰ヘ長調 ○○、変ト長調 ○ → あわせて ○○○（できた）
  deck.record('M6',true); deck.record('M6',true); deck.record('M12',true);
  deck.record('m6',false); deck.record('m12',false); // 嬰ニ短調・変ホ短調 ✗✗ → にがて
  const h=D.checkTableHTML(quiz);
  const cells=[...h.matchAll(/<li data-key="(\w+)" data-mastery="(\w+)"( data-ids="([^"]+)")?/g)];
  assert.equal(cells.length,24);
  const M6=cells.find(c=>c[1]==='M6'), m6=cells.find(c=>c[1]==='m6');
  assert.equal(M6[2],'good'); assert.equal(M6[4],'M6 M12');
  assert.equal(m6[2],'weak'); assert.equal(m6[4],'m6 m12');
  assert.ok(!cells.some(c=>c[1]==='M12'||c[1]==='m12'));
  assert.ok(h.includes('できた調：1／24')&&h.includes('📋 24調チェック表'));
  assert.ok(h.includes('嬰ヘ長調・変ト長調（♯6つ・♭6つ）：できた。じぶんでできた3、まちがい0'));
  assert.ok(h.includes('嬰ヘ<br>変ト'));
  eq(D.tally(quiz),{total:24,good:1,learning:0,weak:1,none:22});
  eq(D.tally(quiz,{modes:['major'],merge:false}),{total:13,good:0,learning:2,weak:0,none:11});
  const hm=D.checkTableHTML(quiz,{modes:['minor']});
  assert.equal((hm.match(/<li /g)||[]).length,12);
  assert.ok(hm.includes('📋 短調チェック表')&&hm.includes('できた調：0／12'));
  assert.ok(hm.includes('嬰ニ短調と変ホ短調')&&!hm.includes('嬰ヘ長調と'));
  assert.ok(D.checkTableHTML(quiz,{title:'📋 しらべ'}).includes('<h2>📋 しらべ<small>'));
  assert.ok(D.checkTableHTML(quiz,{note:'メモ'}).includes('<p class="note">メモ</p>'));
  // ページが題をとりかえるための形（<h2>…</h2>）はそのまま
  assert.match(h,/<h2>[\s\S]*?<\/h2>/);
  // mergeStats：時刻のじゅんに recent をつなぐ
  eq(D.mergeStats([{right:1,wrong:0,hint:0,last:5,recent:'o'},{right:0,wrong:2,hint:1,last:3,recent:'xhx'}]),{right:1,wrong:2,hint:1,last:5,recent:'xhxo'});
  eq(D.mergeStats([{right:3,wrong:0,last:5},{right:0,wrong:1,last:3,recent:'x'}]),{right:3,wrong:1,hint:0,last:5},'古いきろくがまざると recent はつけない');
  assert.equal(D.mergeStats([undefined,undefined]),undefined);
});

test('checkTableHTML：pickable でますがボタン（data-act="kd-pick"）',()=>{
  const quiz=q(), deck=D.create({quiz}); deck.record('M1',false);
  const h=D.checkTableHTML(quiz,{pickable:true});
  const bs=[...h.matchAll(/<button type="button" class="kd-cell" data-act="kd-pick" data-v="(\w+)" aria-label="([^"]+)"/g)];
  assert.equal(bs.length,24);
  assert.ok(bs.find(b=>b[1]==='M1')[2].startsWith('ト長調を3もんれんしゅう'));
  assert.ok(bs.find(b=>b[1]==='M6')[2].startsWith('嬰ヘ長調・変ト長調を3もんれんしゅう'));
  assert.ok(h.includes('ますをおすと'));
  assert.ok(!/(?:^|[^-])width:\s*(?:[1-9]\d{2,})px/.test(h));
});

test('weakList・weakSummary：にがてなじゅん',()=>{
  const quiz='zz-'+(qn++); let t=100; const d2=D.create({quiz,now:()=>t++});
  d2.record('M0',true); d2.record('M0',true); d2.record('M0',true);   // できた
  d2.record('M1',false); d2.record('M1',false);                        // にがて（x2）
  d2.record('M2',false); d2.record('M2',false); d2.record('M2',false); // にがて（x3）
  d2.record('m0',true); d2.record('m0',false); d2.record('m0',true);   // れんしゅう中（x あり）
  d2.record('m1',true);                                               // れんしゅう中（x なし）
  eq(D.weakList(quiz),['M2','M1','m0']);
  const ws=PA.weakSummary(1e4).filter(w=>w.quiz===quiz); // ほかのテストのきろくもあるので多めに
  eq(ws.map(w=>[w.id,w.name,w.mastery]),[['M2','ニ長調','weak'],['M1','ト長調','weak'],['m0','イ短調','learning']]);
  assert.ok(PA.weakSummary(2).length<=2);
  // アプリの名前
  D.create({quiz:'chord-quiz'}).record('M4',false); D.create({quiz:'chord-quiz'}).record('M4',false);
  const c=PA.weakSummary(1e4).find(w=>w.quiz==='chord-quiz');
  assert.equal(c.title,'和音クイズ'); assert.equal(c.id,'M4');
});
