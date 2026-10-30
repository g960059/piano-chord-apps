// アプリの目次・リンクのパラメータ・ひかえ・音名の HTML・けんばんの読み上げなどのテスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const J=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepStrictEqual(J(a),J(b),m);
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');

test('目次：PA.UNITS・PA.APPS・PA.app',()=>{
  const PA=loadPA();
  eq(PA.UNITS.map(u=>u.id),['u1','u2','u3','u4','u5','u6','ear']);
  eq(PA.UNITS[0].apps,['chord-build','chord-quiz','cadence','chord-table']);
  eq(PA.UNITS[2].apps,['diatonic','inversion','interval']);
  eq(PA.UNITS[5].apps,['doppel','secondary','aug6','neapolitan','borrowed','dim-halfdim','enharmonic','chroma-quiz']);
  eq(PA.UNITS[6].apps,['ear']);
  const ids=PA.UNITS.flatMap(u=>u.apps);
  assert.equal(new Set(ids).size,ids.length,'おなじアプリは1回だけ');
  eq(PA.APPS.map(a=>a.id).sort(),[...ids].sort());
  PA.APPS.forEach(a=>{
    assert.ok(['learn','quiz','play','ref','ear'].includes(a.type),a.id);
    assert.ok(a.ic&&a.title&&a.d,a.id);
    assert.ok(PA.UNITS.find(u=>u.id===a.unit).apps.includes(a.id),a.id);
    if(a.practice){assert.ok(PA.app(a.practice),a.id+' → '+a.practice);assert.ok(['quiz','play','ear'].includes(PA.app(a.practice).type));}
    assert.ok(PA.APP_TYPES[a.type].dk);
  });
  // いまあるページはファイルがある（diatonic・inversion・interval はべつの人が書いている）
  PA.APPS.filter(a=>!['diatonic','inversion','interval'].includes(a.id)).forEach(a=>assert.ok(fs.existsSync(path.join(root,a.id+'.html')),a.id));
  assert.equal(PA.app('chord-build').practice,'chord-quiz');
  assert.equal(PA.app('minor-family').practice,'minor-quiz');
  assert.equal(PA.app('ending').practice,'ending-quiz');
  assert.equal(PA.app('enharmonic').practice,'chroma-quiz');
  assert.equal(PA.app('waon'),null); assert.equal(PA.app('nope'),null);
});

test('PA.url・PA.parseParams・PA.params・PA.fromLink・PA.paramInt',()=>{
  const PA=loadPA();
  assert.equal(PA.url('chord-quiz'),'chord-quiz.html');
  assert.equal(PA.url('chord-quiz.html',{key:'M1',n:5}),'chord-quiz.html?key=M1&n=5');
  assert.equal(PA.url('ear',{mode:'a b&c',x:null,y:undefined,z:'',w:false,level:0}),'ear.html?mode=a%20b%26c&level=0');
  assert.equal(PA.url('a.html?x=1',{n:2}),'a.html?x=1&n=2');
  eq(PA.parseParams('?key=M1&n=5&tier=easy'),{key:'M1',n:'5',tier:'easy'});
  eq(PA.parseParams('mode=a%20b%26c&Bad=1&9x=2&ok-1=3&key=M2'),{mode:'a b&c','ok-1':'3',key:'M2'});
  eq(PA.parseParams('?key=M1&key=M2'),{key:'M1'},'さいしょの1つ');
  eq(PA.parseParams('?chord='+'x'.repeat(41)+'&n=3'),{n:'3'},'40文字より長い値はすてる');
  eq(PA.parseParams('?key=%E0%A4%A&n=1&flag'),{n:'1',flag:''},'こわれた %');
  eq(PA.parseParams(''),{}); eq(PA.parseParams(undefined),{});
  eq(PA.parseParams('?constructor=1&__proto__=2'),{constructor:'1'});
  const L=loadPA(undefined,{search:'?key=m3&n=25&level=2&zzz=1'});
  eq(L.params(),{key:'m3',n:'25',level:'2',zzz:'1'});
  assert.equal(L.fromLink(),true);
  assert.equal(L.paramInt('n',1,20),null); assert.equal(L.paramInt('level',1,8),2); assert.equal(L.paramInt('nope',1,8),null);
  assert.equal(loadPA(undefined,{search:'?zzz=1'}).fromLink(),false);
  assert.equal(PA.fromLink(),false);
  eq(PA.PARAM_KEYS,['key','chord','mode','level','tier','n']);
});

test('PA.shareHTML・PA.tryHTML',()=>{
  const PA=loadPA();
  const s=PA.shareHTML('chord-quiz',{key:'M1',n:5});
  assert.match(s,/^<button type="button" class="btn small pa-share" data-pa="share" data-url="https:\/\/example\.test\/apps\/chord-quiz\.html\?key=M1&amp;n=5">🔗 リンクをおくる<\/button>$/);
  assert.ok(PA.shareHTML('ear',null,'おくる').includes('>おくる<'));
  const t=PA.tryHTML({to:'chord-quiz',params:{key:'M1',n:3},sub:'ト長調で3もん',links:[{to:'ear',label:'👂 耳で'},{to:'chord-table'}]});
  assert.ok(t.includes('class="card try-card"')&&t.includes('--tc:#c0392b'));
  assert.ok(t.includes('<a class="btn try-go" href="chord-quiz.html?key=M1&amp;n=3">🎯 ためしてみる</a>'));
  assert.ok(t.includes('「和音クイズ」でためしてみよう')&&t.includes('ト長調で3もん'));
  assert.ok(t.includes('href="ear.html">👂 耳で</a>')&&t.includes('href="chord-table.html">和音いちらん表</a>'));
  const t2=PA.tryHTML({to:'cadence',title:'ひいてみよう',btn:'🎹 ひく'});
  assert.ok(t2.includes('<h2>ひいてみよう</h2>')&&t2.includes('🎹 ひく')&&t2.includes('--tc:#15804f')&&!t2.includes('try-more'));
});

test('きろくのひかえ：checkBackup・backupData',()=>{
  const mem=new Map(), PA=loadPA(undefined,{storage:mem});
  PA.store.set('settings',{naming:'en'}); PA.store.set('keystats-chord-quiz',{M0:{right:1,wrong:0}});
  mem.set('other.thing','1');
  eq(PA.store.keys().sort(),['keystats-chord-quiz','settings']);
  const b=PA.backupData();
  eq(Object.keys(b).sort(),['pianoapps.keystats-chord-quiz','pianoapps.settings']);
  eq(PA.checkBackup(J(b)),b);
  for(const bad of [null,[],'x',5,{},{'other':'1'},{'pianoapps.a':5},{'pianoapps.a':'{bad json'},{'pianoapps.a':'1','x.b':'2'}]) assert.equal(PA.checkBackup(bad),null,JSON.stringify(bad));
});

test('音名の HTML：PA.nmH は<span class="nw">、PA.nm はただの文字',()=>{
  const PA=loadPA();
  assert.equal(PA.nmH({letter:3,acc:1}),'<span class="nw">ファ♯</span>');
  assert.equal(PA.nm({letter:3,acc:1}),'ファ♯');
  assert.equal(PA.namesH([{letter:0,acc:0},{letter:6,acc:-1}]),'<span class="nw">ド</span>・<span class="nw">シ♭</span>');
  assert.equal(PA.nmH({letter:3,acc:2}),'<span class="nw">ファ<span class="ds">x</span></span>');
  // core の中で nmH・namesH を属性（aria-label・title・data-*）や SVG の中につかっていない
  const src=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
  assert.ok(!/(aria-label|title|data-[a-z-]+)="[^"]*\$\{[^}]*(nmH|namesH)/.test(src));
  // おわりかたの説明：「音名」ごと行がかわらない
  assert.ok(PA.ending.why(PA.keyOf(false,1,60),'perfect').includes('<span class="nw">「ソ」</span>'));
});

test('けんばん：sr で読み上げのことばをたす。まんなかのドの字はこい色',()=>{
  const PA=loadPA();
  const s=PA.kbSVG(60,64,new Map([[64,{fill:'#d1495b',label:'ミ',sr:'えらんだ・まちがい'}],[62,{fill:'#fff',sr:'"<x>"'}]]));
  assert.ok(s.includes('aria-label="ミ、えらんだ・まちがい"'));
  assert.ok(s.includes('aria-label="レ、&quot;&lt;x&gt;&quot;"'));
  assert.ok(s.includes('aria-label="ド（まんなか）"'));
  assert.ok(s.includes('fill="#756c60">まんなかの'));
  assert.ok(!s.includes('#a99f93'));
});

test('古い端末：core.js に ?. と ?? がない',()=>{
  const src=fs.readFileSync(path.join(root,'assets','core.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  assert.ok(!/\?\.(?!\d)/.test(src),'?.');
  assert.ok(!/\?\?/.test(src),'??');
  assert.equal(loadPA().HINT_NOTE.includes('×にはならない'),true);
});

test('コントラスト：小さな字の色（WCAG AA 4.5:1）',()=>{
  const css=fs.readFileSync(path.join(root,'assets','app.css'),'utf8');
  const v=n=>{const m=new RegExp('--'+n+':(#[0-9a-f]{6})','i').exec(css);return m[1];};
  const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
  const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  for(const bg of ['#fdf8f0','#ffffff',v('soft2'),v('soft')]) assert.ok(cr(v('sub'),bg)>=4.5,'sub on '+bg);
  assert.ok(cr('#ffffff',v('ok'))>=4.5,'ok'); assert.ok(cr('#ffffff',v('ng'))>=4.5,'ng'); assert.ok(cr(v('ng'),'#ffffff')>=4.5);
  assert.notEqual(v('ok').toLowerCase(),v('c4').toLowerCase());
  assert.notEqual(v('ng').toLowerCase(),v('c1').toLowerCase());
  const PA=loadPA();
  Object.values(PA.APP_TYPES).forEach(t=>assert.ok(cr('#ffffff',t.dk)>=4.5,t.label));
});
