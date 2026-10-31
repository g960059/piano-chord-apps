// 変化和音クイズ（chroma-quiz.html）のテスト：node --test test/
// ページの<cq-link>のところだけ切りだして、レベルのなかみ（学ぶページのリンクがつかう）とリンクのしらべかたをたしかめる
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const html=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','chroma-quiz.html'),'utf8');
const m=html.match(/\/\/ <cq-link>[^\n]*\n([\s\S]*?)\/\/ <\/cq-link>/);
assert.ok(m,'chroma-quiz.html に<cq-link>のしるしがない');
const L=new Function('PA',m[1]+'\nreturn {GROUPS,TYPES,AUG,KLV,KLV_VIEW,stepNo,OLD_KLV,EAR_LV,EAR_NAME,EAR_ORDER,linkOf};')(PA);
const J=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,msg)=>assert.deepStrictEqual(J(a),J(b),msg);
const TIERS=['easy','normal','hard','all'];
const link=p=>L.linkOf(p,TIERS);
const NONE={mode:null,kLv:null,types:null,earLv:null,tier:null,key:null,n:null,chal:null};
const W=o=>Object.assign({},NONE,o);

test('ステップのなかみ（先生のじゅん。学ぶページの step= とそろえる）',()=>{
  // Ⅱ7・ドッペル → 副属和音 → 準固有和音 → ドリアのⅣ → ナポリの六 → 増六 → Ⅶ7（異名同音はいちばん最後）
  eq(L.TYPES,['ii7','dd','ddim','s2','s3','s4','s6','ivm','bvi','ivd','n6','it','fr','ger','vii7']);
  eq(L.KLV.map(x=>x.lv),[1,2,3,4,5,6,7],'KLV[lv-1]（リンクの step の番号はかえない）');
  eq(L.KLV_VIEW,[1,2,3,7,4,5,6],'画面のならび：ドリアのⅣ（あとから足した 7）は準固有のつぎ');
  eq(L.KLV[0].types,['ii7','dd','ddim'],'1：doppel');
  eq(L.KLV[1].types,['s2','s3','s4','s6'],'2：secondary');
  eq(L.KLV[2].types,['ivm','bvi'],'3：borrowed');
  eq(L.KLV[3].types,['n6'],'4：neapolitan');
  eq(L.KLV[4].types,['it','fr','ger'],'5：aug6');
  eq(L.KLV[5].types,L.TYPES,'6：ぜんぶ（enharmonic）');
  eq(L.KLV[6].types,['ivd'],'7：dorian（短調だけ）');
  // まえのステップより先の和音は出さない：画面のならびで「ぜんぶ」のまえまでの和音は、TYPES のならびで前から順に出てくる
  const seen=L.KLV_VIEW.filter(lv=>lv!==6).flatMap(lv=>L.KLV[lv-1].types);
  eq(seen,L.TYPES.slice(0,seen.length),'ステップのじゅん＝TYPES のじゅん');
  assert.equal(new Set(seen).size,seen.length,'1つの和音は1つのステップだけ');
  // 画面に「半減七」を出さない
  assert.ok(!/半減七/.test(JSON.stringify(L.GROUPS)+JSON.stringify(L.KLV)));
  eq(L.EAR_LV,{1:['ii7','dd'],2:['it','fr','ger'],3:['iv','ivm','n6']});
  eq(L.EAR_ORDER,[1,3,2],'👂 は画面ではナポリ（3）を増六（2）より前に');
  assert.ok([1,2,3].every(k=>typeof L.EAR_NAME[k]==='string'));
  // まえの「レベル」1〜5の和音（まえのリンク・保存をおなじ和音でひらく）
  eq(L.OLD_KLV,{1:['ii7','dd'],2:['ii7','dd','ddim'],3:['it','fr','ger'],4:['it','fr','ger','n6','ivm','bvi'],5:L.TYPES});
  // ヘッダーの chord= の例はどれも40文字（PA.params の上限）いないで、ぜんぶつかえる
  ['n6','ivm,bvi','ivd','s2,s3,s4,s6','dd,s2,s3,s4,s6','ger,ddim,vii7'].forEach(c=>{
    assert.ok(c.length<=40);
    eq(link(PA.parseParams('?chord='+encodeURIComponent(c))).types,L.TYPES.filter(t=>c.split(',').includes(t)),c);
  });
});

test('linkOf：mode・step・まえの level',()=>{
  assert.equal(link({}),null);
  assert.equal(link({x:'1'}),null);
  eq(link({mode:'keys',step:'3'}),W({mode:'keys',kLv:3}));
  eq(link({step:'6'}),W({mode:'keys',kLv:6}),'mode がなければ keys');
  eq(link({step:'7'}),W({mode:'keys',kLv:7}),'7＝ドリアのⅣ');
  eq(link({step:'8'}),W({mode:'keys'}));
  eq(link({step:'0'}),W({mode:'keys'}),'0（じぶんでえらぶ）はリンクでは chord で');
  eq(link({step:'2.5'}),W({mode:'keys'}));
  // まえのリンクの level（🎹）：そのときとおなじ和音。ステップとおなじならそのステップ
  eq(link({mode:'keys',level:'1'}),W({mode:'keys',types:['ii7','dd']}),'まえの1＝Ⅱ7・ドッペル');
  eq(link({mode:'keys',level:'2'}),W({mode:'keys',kLv:1}),'まえの2＝ステップ1');
  eq(link({mode:'keys',level:'3'}),W({mode:'keys',kLv:5}),'まえの3（増六）＝ステップ5');
  eq(link({level:'4'}),W({mode:'keys',types:['ivm','bvi','n6','it','fr','ger']}),'まえの4（増六＋ナポリ・Ⅳm・♭Ⅵ）');
  eq(link({level:'5'}),W({mode:'keys',kLv:6}),'まえの5（ぜんぶ）＝ステップ6');
  eq(link({level:'6'}),W({mode:'keys'}));
  eq(link({step:'2',level:'3'}),W({mode:'keys',kLv:2}),'step が level よりさき');
  eq(link({mode:'ear',level:'3'}),W({mode:'ear',earLv:3}));
  eq(link({mode:'ear',level:'4'}),W({mode:'ear'}),'👂 は3まで');
  eq(link({mode:'ear',step:'2'}),W({mode:'ear'}),'👂 では step をつかわない');
  eq(link({mode:'piano'}),null);
  eq(link({mode:'<b>'}),null);
  eq(link({key:'M1'}),W({key:'M1'}),'key だけなら mode はそのまま');
});

test('linkOf：chord・tier・key・n',()=>{
  eq(link({chord:'it,fr,xx'}),W({mode:'keys',types:['it','fr']}));
  eq(link({chord:'fr,it,it'}),W({mode:'keys',types:['it','fr']}),'じゅんは TYPES・おなじものは1つ');
  eq(link({chord:'<script>',step:'2'}),W({mode:'keys',kLv:2}),'つかえない chord はすてて step');
  eq(link({chord:'<script>',level:'1'}),W({mode:'keys',types:['ii7','dd']}),'つかえない chord はすてて まえの level');
  eq(link({chord:'n6',step:'2'}),W({mode:'keys',types:['n6']}),'chord が step よりさき');
  eq(link({chord:'n6',level:'2'}),W({mode:'keys',types:['n6']}),'chord が まえの level よりさき');
  eq(link({mode:'ear',chord:'n6',level:'1'}),W({mode:'ear',earLv:1}),'👂 では chord をつかわない');
  eq(link({tier:'hard'}),W({mode:'keys',tier:'hard'}));
  eq(link({mode:'ear',tier:'nope'}),W({mode:'ear'}));
  eq(link({key:'m12'}),W({key:'m12'}));
  ['M13','m13','M01','x1','M-1','M1 ',''].forEach(k=>assert.equal(link({key:k}),null,k));
  eq(link({n:'5'}),W({n:5}));
  eq(link({n:'20'}),W({n:20}));
  ['0','21','-1','5x','1e1'].forEach(n=>assert.equal(link({n}),null,n));
  eq(link(PA.parseParams('?mode=keys&step=1&key=M3&n=5')),W({mode:'keys',kLv:1,key:'M3',n:5}),'doppel.html のためしてみる');
  eq(link(PA.parseParams('?mode=keys&level=1&key=M3&n=5')),W({mode:'keys',types:['ii7','dd'],key:'M3',n:5}),'まえの doppel.html のリンク');
  // 文字いがい（ほかのページがまちがえてわたしたとき）はすてる
  eq(link({level:3,key:{},n:5}),null);
  // chal=1（異名同音の読みかえの 🔥 チャレンジから）は chord といっしょのときだけ
  eq(link(PA.parseParams('?key=m0&mode=keys&chord=ger&chal=1&n=5')),W({mode:'keys',types:['ger'],key:'m0',n:5,chal:true}));
  eq(link(PA.parseParams('?key=m0&mode=keys&chord=ger&n=5')),W({mode:'keys',types:['ger'],key:'m0',n:5}));
  eq(link({chal:'1'}),null,'chal だけのリンクはなにもしない');
  eq(link({chord:'ger',chal:'yes'}),W({mode:'keys',types:['ger']}));
  eq(link({step:'5',chal:'1'}),W({mode:'keys',kLv:5}),'ステップには chal をつけない');
});

test('準固有和音は ○Ⅳ・○Ⅵ と書く（先生：♭Ⅵ・Ⅳm はつかわない）。画面・目次・聴きわけの名前',()=>{
  const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
  const screen=f=>fs.readFileSync(path.join(dir,f),'utf8').replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'');
  for(const f of fs.readdirSync(dir).filter(f=>/\.html$/.test(f))) assert.ok(!/Ⅳm|♭Ⅵ|♭Ⅲ|♭Ⅶ/.test(screen(f)),f);
  PA.APPS.forEach(a=>assert.ok(!/Ⅳm|♭Ⅵ/.test(a.title+a.d),a.id));
  assert.match(PA.app('borrowed').d,/○Ⅳ・○Ⅵ/);
  assert.match(L.EAR_NAME[3],/○Ⅳ/);
  assert.match(html,/ivm: \{label:'○Ⅳ'/); assert.match(html,/bvi: \{label:'○Ⅵ'/);
});

test('Ⅶ7のヒント：おさえかた（転回）で上下がかわらない名前「第9音（音階の6ばんめ）」で',()=>{
  const fn=s=>(html.match(new RegExp(`function ${s}\\(key,t,[^)]*\\)\\{[\\s\\S]*?\\n\\}`))||[''])[0];
  const h=fn('hintsNew'), o=fn('okExtraNew');
  assert.ok(h&&o);
  const v=h.slice(h.indexOf("if(t==='vii7')")), w=o.slice(o.indexOf("if(t==='vii7')"));
  assert.ok(!/いちばん上の音/.test(v+w));
  assert.equal((v.match(/第9音（音階の6ばんめ）/g)||[]).length,2);
  assert.equal((w.match(/第9音（音階の6ばんめ）/g)||[]).length,2,'長調・短調おなじことば');
});
