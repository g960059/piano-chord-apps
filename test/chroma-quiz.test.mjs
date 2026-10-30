// 変化和音クイズ（chroma-quiz.html）の テスト：node --test test/
// ページの <cq-link> の ところだけ 切りだして、レベルの なかみ（学ぶ ページの リンクが つかう）と リンクの しらべかたを たしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const html=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','chroma-quiz.html'),'utf8');
const m=html.match(/\/\/ <cq-link>[^\n]*\n([\s\S]*?)\/\/ <\/cq-link>/);
assert.ok(m,'chroma-quiz.html に <cq-link> の しるしが ない');
const L=new Function('PA',m[1]+'\nreturn {GROUPS,TYPES,AUG,KLV,EAR_LV,EAR_NAME,linkOf};')(PA);
const J=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,msg)=>assert.deepStrictEqual(J(a),J(b),msg);
const TIERS=['easy','normal','hard','all'];
const link=p=>L.linkOf(p,TIERS);
const NONE={mode:null,kLv:null,types:null,earLv:null,tier:null,key:null,n:null};
const W=o=>Object.assign({},NONE,o);

test('レベルの なかみ（学ぶ ページの level= と そろえる）',()=>{
  eq(L.TYPES,['ii7','dd','ddim','it','fr','ger','n6','ivm','bvi','s2','s3','s4','s6','vii7']);
  eq(L.KLV.map(x=>x.lv),[1,2,3,4,5]);
  eq(L.KLV[0].types,['ii7','dd'],'1：doppel');
  eq(L.KLV[1].types,['ii7','dd','ddim'],'2：doppel（家族まで）');
  eq(L.KLV[2].types,['it','fr','ger'],'3：aug6');
  eq(L.KLV[3].types,['it','fr','ger','n6','ivm','bvi'],'4：neapolitan・borrowed');
  eq(L.KLV[4].types,L.TYPES,'5：secondary・dim-halfdim・enharmonic');
  eq(L.EAR_LV,{1:['ii7','dd'],2:['it','fr','ger'],3:['iv','ivm','n6']});
  assert.ok([1,2,3].every(k=>typeof L.EAR_NAME[k]==='string'));
  // ヘッダーの chord= の 例は どれも 40文字（PA.params の 上限）いない で、ぜんぶ つかえる
  ['n6','ivm,bvi','s2,s3,s4,s6','vii7,ddim','ger,ddim,vii7'].forEach(c=>{
    assert.ok(c.length<=40);
    eq(link(PA.parseParams('?chord='+encodeURIComponent(c))).types,L.TYPES.filter(t=>c.split(',').includes(t)),c);
  });
});

test('linkOf：mode・level',()=>{
  assert.equal(link({}),null);
  assert.equal(link({x:'1'}),null);
  eq(link({mode:'keys',level:'3'}),W({mode:'keys',kLv:3}));
  eq(link({mode:'ear',level:'3'}),W({mode:'ear',earLv:3}));
  eq(link({mode:'ear',level:'4'}),W({mode:'ear'}),'👂 は 3まで');
  eq(link({level:'5'}),W({mode:'keys',kLv:5}),'mode が なければ keys');
  eq(link({level:'6'}),W({mode:'keys'}));
  eq(link({level:'0'}),W({mode:'keys'}),'0（じぶんで えらぶ）は リンクでは chord で');
  eq(link({level:'2.5'}),W({mode:'keys'}));
  eq(link({mode:'piano'}),null);
  eq(link({mode:'<b>'}),null);
  eq(link({key:'M1'}),W({key:'M1'}),'key だけ なら mode は そのまま');
});

test('linkOf：chord・tier・key・n',()=>{
  eq(link({chord:'it,fr,xx'}),W({mode:'keys',types:['it','fr']}));
  eq(link({chord:'fr,it,it'}),W({mode:'keys',types:['it','fr']}),'じゅんは TYPES・おなじ ものは 1つ');
  eq(link({chord:'<script>',level:'2'}),W({mode:'keys',kLv:2}),'つかえない chord は すてて level');
  eq(link({chord:'n6',level:'2'}),W({mode:'keys',types:['n6']}),'chord が level より さき');
  eq(link({mode:'ear',chord:'n6',level:'1'}),W({mode:'ear',earLv:1}),'👂 では chord を つかわない');
  eq(link({tier:'hard'}),W({mode:'keys',tier:'hard'}));
  eq(link({mode:'ear',tier:'nope'}),W({mode:'ear'}));
  eq(link({key:'m12'}),W({key:'m12'}));
  ['M13','m13','M01','x1','M-1','M1 ',''].forEach(k=>assert.equal(link({key:k}),null,k));
  eq(link({n:'5'}),W({n:5}));
  eq(link({n:'20'}),W({n:20}));
  ['0','21','-1','5x','1e1'].forEach(n=>assert.equal(link({n}),null,n));
  eq(link(PA.parseParams('?mode=keys&level=1&key=M3&n=5')),W({mode:'keys',kLv:1,key:'M3',n:5}),'doppel.html の ためしてみる');
  // 文字いがい（ほかの ページが まちがえて わたした とき）は すてる
  eq(link({level:3,key:{},n:5}),null);
});
