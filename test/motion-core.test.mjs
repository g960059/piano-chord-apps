// うごき・おしたときの手ごたえのしくみ（assets/core.js）のテスト：node --test test/
//   PA.paint の data-fx（はじめてだけうごく＝.still）・2回おすボタンののこり時間（--arm-d）・シート（transitionend をまつ・Esc・ひっぱってとじる・調をえらんだら描きなおしはあと）・
//   PRESS_SEL（おせるものぜんぶ。文の中のリンク・鍵盤はのぞく）・PA.scrollTop（すぐ）
// ブラウザのかわりに、小さな DOM（タグ・class・属性・かんたんなセレクタ）をつかう
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const CORE=fs.readFileSync(path.join(root,'assets','core.js'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ----- 小さな DOM ----- */
// セレクタ：tag・*・.cls・#id・[a]・[a="v"]・:not()・:is()・:where()、' ' と '>'、カンマ
const split=(s,ch)=>{const out=[];let d=0,cur='';for(const c of s){if('(['.includes(c))d++;if(')]'.includes(c))d--;if(c===ch&&!d){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out.map(x=>x.trim()).filter(Boolean);};
function parseComplex(sel){ // [[comp, それより左とのつなぎ（' '｜'>'）], ...]
  const comps=[],combs=[];let d=0,cur='',pend=' ';
  for(const c of sel.trim()){
    if(!d&&(c===' '||c==='>')){if(cur){comps.push(cur);cur='';pend=' ';}if(c==='>')pend='>';continue;}
    if('(['.includes(c))d++; if(')]'.includes(c))d--;
    if(cur===''&&comps.length) combs.push(pend);
    cur+=c;
  }
  if(cur) comps.push(cur);
  return comps.map((c,i)=>[c,i?combs[i-1]:null]);
}
function matchCompound(el,comp){
  if(!el||!el.tagName) return false;
  let i=0;const m=comp.match(/^([a-z][a-z0-9-]*|\*)/i);
  if(m){if(m[1]!=='*'&&m[1].toLowerCase()!==el.tagName) return false;i=m[1].length;}
  while(i<comp.length){
    const c=comp[i];
    if(c==='.'||c==='#'){const n=comp.slice(i+1).match(/^[\w-]+/)[0];i+=1+n.length;if(c==='.'?!el.classList.contains(n):el.getAttribute('id')!==n) return false;}
    else if(c==='['){const j=comp.indexOf(']',i);const [k,v]=comp.slice(i+1,j).split('=');i=j+1;
      if(!el.hasAttribute(k)) return false; if(v!=null&&el.getAttribute(k)!==v.replace(/^"|"$/g,'')) return false;}
    else if(c===':'){const n=comp.slice(i+1).match(/^[\w-]+/)[0];let j=i+1+n.length,arg='';
      if(comp[j]==='('){let d=0,k=j;for(;k<comp.length;k++){if(comp[k]==='(')d++;if(comp[k]===')'&&!--d)break;}arg=comp.slice(j+1,k);j=k+1;}
      i=j;const any=split(arg,',').some(s=>matches(el,s));
      if(n==='not'?any:(n==='is'||n==='where')?!any:true) return false;}
    else throw new Error('セレクタ？ '+comp);
  }
  return true;
}
function matchParts(el,parts,k){
  if(!matchCompound(el,parts[k][0])) return false;
  if(k===0) return true;
  if(parts[k][1]==='>') return matchParts(el.parentNode,parts,k-1);
  for(let a=el.parentNode;a&&a.tagName;a=a.parentNode) if(matchParts(a,parts,k-1)) return true;
  return false;
}
function matches(el,sel){return split(sel,',').some(s=>{const p=parseComplex(s);return matchParts(el,p,p.length-1);});}
const kebab=k=>k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
class El{
  constructor(tag){
    this.tagName=tag;this.attrs=new Map();this.childNodes=[];this.parentNode=null;this.L={};this._text='';
    const st={};st.setProperty=(k,v)=>{st[k]=String(v);};st.removeProperty=k=>{delete st[k];};st.getPropertyValue=k=>st[k]||'';this.style=st;
    this.dataset=new Proxy({},{get:(t,k)=>typeof k==='string'?(this.attrs.has('data-'+kebab(k))?this.attrs.get('data-'+kebab(k)):undefined):undefined,
      set:(t,k,v)=>{this.attrs.set('data-'+kebab(k),String(v));return true;},deleteProperty:(t,k)=>{this.attrs.delete('data-'+kebab(k));return true;},
      has:(t,k)=>this.attrs.has('data-'+kebab(k))});
  }
  setAttribute(k,v){this.attrs.set(k,String(v));} getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}
  hasAttribute(k){return this.attrs.has(k);} removeAttribute(k){this.attrs.delete(k);}
  get id(){return this.getAttribute('id')||'';}
  get disabled(){return this.hasAttribute('disabled');}
  get className(){return this.getAttribute('class')||'';} set className(v){this.setAttribute('class',v);}
  get classList(){const el=this,get=()=>new Set(el.className.split(/\s+/).filter(Boolean)),put=s=>el.setAttribute('class',[...s].join(' '));
    return {contains:c=>get().has(c),add:(...cs)=>{const s=get();cs.forEach(c=>s.add(c));put(s);},remove:(...cs)=>{const s=get();cs.forEach(c=>s.delete(c));put(s);},
      toggle:(c,v)=>{const s=get();(v??!s.has(c))?s.add(c):s.delete(c);put(s);}};}
  appendChild(c){c.parentNode=this;this.childNodes.push(c);return c;}
  set textContent(v){this.childNodes=[];this._text=String(v);} get textContent(){return this._text+this.childNodes.map(c=>c.textContent).join('');}
  set innerHTML(h){this.childNodes=[];this._text='';parseInto(this,String(h));}
  get innerHTML(){return this._text+this.childNodes.map(c=>`<${c.tagName}${[...c.attrs].map(([k,v])=>` ${k}="${v}"`).join('')}>${c.innerHTML}</${c.tagName}>`).join('');}
  matches(s){return matches(this,s);}
  closest(s){for(let a=this;a&&a.tagName;a=a.parentNode) if(matches(a,s)) return a;return null;}
  querySelectorAll(s){const out=[];const walk=n=>n.childNodes.forEach(c=>{if(matches(c,s)) out.push(c);walk(c);});walk(this);return out;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  contains(n){for(let a=n;a;a=a.parentNode) if(a===this) return true;return false;}
  addEventListener(t,f){(this.L[t]=this.L[t]||[]).push(f);} removeEventListener(t,f){this.L[t]=(this.L[t]||[]).filter(x=>x!==f);}
  fire(t,e={}){const ev={type:t,target:this,preventDefault(){},stopImmediatePropagation(){},...e};(this.L[t]||[]).slice().forEach(f=>f(ev));return ev;}
  focus(){}
}
function parseInto(root,h){
  let cur=root;const re=/<(\/?)([a-z][a-z0-9]*)([^>]*)>|([^<]+)/gi;let m;
  while((m=re.exec(h))){
    if(m[4]!=null){cur._text+=m[4];continue;}
    if(m[1]){cur=cur.parentNode||root;continue;}
    const el=new El(m[2].toLowerCase());
    for(const a of m[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) el.setAttribute(a[1],a[2]??'');
    cur.appendChild(el); if(!/^(input|br|img)$/.test(el.tagName)&&!/\/\s*$/.test(m[3])) cur=el;
  }
}
class Dialog extends El{
  constructor(){super('dialog');this.open=false;this.offsetHeight=600;}
  showModal(){this.open=true;}
  close(){if(!this.open) return;this.open=false;this.fire('close');}
}
// core.js をこの DOM で読みこむ（document の addEventListener はあとでよべるように、ためておく）
function load(opts){
  const pre='document.__L=[];document.addEventListener=function(t,f,o){document.__L.push([t,f,o]);};\n';
  const PA=loadPA(pre+CORE+'\nPA.__doc=document;PA.__win=window;',opts);
  const doc=PA.__doc, body=new El('body');
  doc.body=body; doc.createElement=t=>t==='dialog'?new Dialog():new El(t);
  doc.querySelectorAll=s=>body.querySelectorAll(s); doc.querySelector=s=>body.querySelector(s);
  doc.contains=n=>body.contains(n);
  const on=(type,needle)=>{const l=doc.__L.find(([t,f])=>t===type&&String(f).includes(needle));assert.ok(l,type+' '+needle);return l[1];};
  return {PA,doc,body,on};
}
const mount=(body,h)=>{const v=new El('main');v.setAttribute('id','view');body.appendChild(v);v.innerHTML=h;return v;};

/* ----- PA.paint の data-fx ----- */
test('PA.paint：data-fx は、はじめて出たときだけうごく（.still でとめる）。ひらいたときにもう出ていたら、うごかない',()=>{
  const {PA,body}=load(), view=new El('main'); body.appendChild(view);
  const still=sel=>view.querySelector(sel).classList.contains('still');
  // ひらいたとき（はじめての PA.paint）にもうおわっていた：うごかない
  PA.paint(view,'<section class="card" data-fx="done">おわり</section>','a');
  assert.equal(still('[data-fx="done"]'),true);
  // つぎの問題のとちゅう（data-fx なし）→ おわった：このときだけうごく
  PA.paint(view,'<div class="card">もんだい</div>','a');
  PA.paint(view,'<section class="card" data-fx="done">おわり</section><button class="choice right" data-act="ans" data-v="1">Ⅰ</button>','a');
  assert.equal(still('[data-fx="done"]'),false,'おわったときはうごく');
  assert.equal(still('.choice.right'),false);
  // 描きなおし（おなじ名前がまえにもあった）：うごきをくりかえさない。ちがう名前の新しいカードはうごく
  PA.paint(view,'<section class="card" data-fx="done">おわり</section><section class="card" data-fx="best">新記録</section><button class="choice right" data-act="ans" data-v="1">Ⅰ</button>','a');
  assert.equal(still('[data-fx="done"]'),true); assert.equal(still('.choice.right'),true);
  assert.equal(still('[data-fx="best"]'),false);
  // 答えあわせのカード（.fb）は data-fx がなければ何もつけない（うごかないので）
  PA.paint(view,'<div class="fb good">せいかい</div>','a');
  assert.equal(view.querySelector('.fb').classList.contains('still'),false);
});

test('PA.session のけっかのカード：data-fx="sess"・3つの数に --i（じゅんに出る）。ほしの字はそのまま',()=>{
  const {PA,body}=load(), view=new El('main'); body.appendChild(view);
  const s=PA.session('ear',{n:3,sig:''}); s.record({ok:true,label:'a'}); s.record({ok:true,label:'b'}); s.record({ok:false,label:'c'});
  const h=s.summaryHTML({title:'和音の聴きわけ',page:'ear',params:{}});
  assert.match(h,/^<section class="card sess-card" data-fx="sess" aria-labelledby="sess-h">/);
  assert.match(h,/<div class="sc-self" style="--i:0"><b>2<\/b>/); assert.match(h,/<div class="sc-hint" style="--i:1">/); assert.match(h,/<div class="sc-wrong" style="--i:2"><b>1<\/b>/);
  assert.match(h,/>★★☆<\/span>/);
  PA.paint(view,'<p>3もんめ</p>','q'); PA.paint(view,h,'q');
  assert.equal(view.querySelector('.sess-card').classList.contains('still'),false);
  PA.paint(view,h,'q'); // 「先生に見せる」をひらくなどの描きなおし
  assert.equal(view.querySelector('.sess-card').classList.contains('still'),true);
});

test('app.css：data-fx のうごき（すっと上がる・数はじゅんに・へらす設定はうすさだけ）',()=>{
  const css=fs.readFileSync(path.join(root,'assets','app.css'),'utf8');
  assert.match(css,/@keyframes pa-rise\{from\{opacity:0;transform:translateY\(8px\) scale\(\.98\)\}\}/);
  assert.match(css,/\[data-fx\]:not\(\.still\)\{animation:pa-rise var\(--dur-celebrate\) var\(--ease-out\) both\}/);
  assert.match(css,/\.sess-card\[data-fx\]:not\(\.still\) \.sess-counts>div\{[^}]*animation-delay:calc\(120ms \+ var\(--i,0\)\*var\(--stagger\)\)\}/);
  assert.match(css,/\.sess-card\[data-fx\]:not\(\.still\) \.sess-stars\{display:inline-block;animation:pa-celebrate var\(--dur-celebrate\) var\(--ease-out\) 260ms both\}/);
  const rm=css.split('@media (prefers-reduced-motion:reduce)').slice(1).join('');
  assert.match(rm,/\[data-fx\]:not\(\.still\)\{animation-name:pa-fade-in\}/);
  assert.ok(!/\[data-fx\][^{]*\{[^}]*pointer-events/.test(css),'おせなくしない');
  // <details>：ひらくときだけ中がうすく出る（とじるのはすぐ＝transition は [open] のほうだけ）
  assert.match(css,/details::details-content\{opacity:0\}\ndetails\[open\]::details-content\{opacity:1;transition:opacity var\(--dur-enter\) var\(--ease-out\)\}/);
});

/* ----- 2回おすボタン ----- */
test('data-confirm：のこり時間の線は、描きなおしても --arm-d（すぎた時間）からつづく',async()=>{
  const {PA,body,on}=load();
  const click=on('click','[data-confirm]');
  const view=mount(body,'<button class="btn" data-act="reset" data-v="q" data-confirm="ほんとうにけす？">けす</button>');
  let b=view.querySelector('[data-confirm]');
  const ev={target:b,preventDefault(){this.pd=true;},stopImmediatePropagation(){}};
  click(ev);
  assert.equal(ev.pd,true); assert.ok(b.classList.contains('armed')); assert.equal(b.textContent,'ほんとうにけす？');
  assert.ok(/^-?\d+ms$/.test(b.style['--arm-d'])&&parseInt(b.style['--arm-d'],10)>-20,b.style['--arm-d']); // はじめから（0ms ちかく）
  await sleep(40);
  PA.paint(view,'<button class="btn" data-act="reset" data-v="q" data-confirm="ほんとうにけす？">けす</button>','x');
  b=view.querySelector('[data-confirm]');
  assert.ok(b.classList.contains('armed'));
  const d=parseInt(b.style['--arm-d'],10);
  assert.ok(/^-\d+ms$/.test(b.style['--arm-d'])&&d<=-30&&d>-1000,b.style['--arm-d']);
  // 2回め：ふつうの click（もとにもどす）
  const ev2={target:b,preventDefault(){this.pd=true;},stopImmediatePropagation(){}};
  click(ev2);
  assert.ok(!ev2.pd); assert.ok(!b.classList.contains('armed')); assert.equal(b.style['--arm-d'],undefined); assert.equal(b.textContent,'けす');
  const css=fs.readFileSync(path.join(root,'assets','app.css'),'utf8');
  assert.match(css,/\.armed::after\{[^}]*animation:pa-arm 4s linear var\(--arm-d,0s\) forwards\}/);
});

/* ----- シート ----- */
const keySheet=(PA,picks)=>{PA.openKeySheet({minor:false,idx:0,onPick:(mi,i)=>picks.push([mi,i])});return PA.__doc.body.querySelector('dialog');};
test('シート：つまみがある。とじるのは transition（.closing）がおわってから（transitionend・こなくても 0.34びょうで）',async()=>{
  const {PA}=load(), picks=[];
  const el=keySheet(PA,picks);
  assert.equal(el.open,true);
  assert.ok(el.querySelector('.sheet-in>.sheet-grab'),'つまみ');
  el.close();
  assert.ok(el.classList.contains('closing')); assert.equal(el.open,true); assert.equal(el.paClosing,true);
  el.fire('transitionend',{propertyName:'opacity',pseudoElement:'::backdrop'}); // うしろの幕のは、まだ
  el.fire('transitionend',{propertyName:'color'});
  assert.equal(el.open,true);
  el.fire('transitionend',{propertyName:'transform'});
  assert.equal(el.open,false); assert.ok(!el.classList.contains('closing')); assert.equal(el.paClosing,false);
  // transitionend がこない（うごかなかった）ときも、かならずとじる
  keySheet(PA,picks); el.close(); await sleep(200); assert.equal(el.open,true); await sleep(170);
  assert.equal(el.open,false); assert.ok(!el.classList.contains('closing'));
  // 動きをへらす設定でも、すぐはとじない（app.css でうすくなって消える）
  PA.__win.matchMedia=()=>({matches:true});
  keySheet(PA,picks); el.close();
  assert.equal(el.open,true); el.fire('transitionend',{propertyName:'opacity'}); assert.equal(el.open,false);
});

test('シート：とじているとちゅうにまたひらく・Esc（ブラウザがじかにとじる）で、とじる印がのこらない',async()=>{
  const {PA}=load(), picks=[];
  const el=keySheet(PA,picks);
  el.close(); keySheet(PA,picks); // またひらく
  assert.ok(!el.classList.contains('closing')); assert.equal(el.paClosing,false); assert.equal(el.open,true);
  await sleep(370); assert.equal(el.open,true,'まえのとじる時計はとまっている');
  el.close();
  Dialog.prototype.close.call(el); // Esc：ブラウザがすぐとじる（'close' がくる）
  assert.equal(el.open,false); assert.ok(!el.classList.contains('closing')); assert.equal(el.paClosing,false);
  await sleep(370); assert.equal(el.open,false);
  assert.ok(!(el.L.cancel||[]).length,'Esc（cancel）でうごかさない');
});

test('シート：調をえらぶと、さきにとじはじめて、描きなおし（onPick）はそのあと',async()=>{
  const {PA}=load(), picks=[];
  const el=keySheet(PA,picks);
  const k=el.querySelector('[data-sheet="key"][data-v="3"]');
  el.onclick({target:k});
  assert.ok(el.classList.contains('closing')); assert.deepEqual(picks,[]);
  await sleep(5);
  assert.deepEqual(picks,[[false,3]]);
});

test('シート：つまみ・見出しを下へひっぱるととじる。ゆっくり・すこしだけなら、もとにもどる。上へはすこしだけ',async()=>{
  const {PA}=load(), picks=[];
  const el=keySheet(PA,picks);
  const head=()=>el.querySelector('.sheet-head h2');
  const down=(t,y,ts)=>el.fire('pointerdown',{target:t,pointerId:1,clientY:y,timeStamp:ts,button:0});
  const move=(y,ts)=>el.fire('pointermove',{target:head(),pointerId:1,clientY:y,timeStamp:ts});
  const up=(y,ts,type='pointerup')=>el.fire(type,{target:head(),pointerId:1,clientY:y,timeStamp:ts});
  // ボタンからは、ひっぱらない
  down(el.querySelector('[data-sheet="close"]'),100,0); assert.equal(el.style.transition,undefined); up(100,10);
  // 上へ：12px までしかのびない
  down(head(),100,0); assert.equal(el.style.transition,'none');
  move(0,50); assert.equal(el.style.transform,'translateY(-12px)');
  move(140,60); assert.equal(el.style.transform,'translateY(40px)');
  // ゆっくり 100px（高さ600の3わりより小さい）：もどる
  move(200,2000); up(200,2000);
  assert.equal(el.style.transform,''); assert.equal(el.style.transition,'transform var(--dur-sheet-in) var(--ease-drawer)');
  assert.ok(!el.classList.contains('closing'));
  // 6px だけ（タップ）：はやくても、とじない
  down(head(),100,0); move(106,10); up(106,10); assert.ok(!el.classList.contains('closing'));
  // はやくはらう（0.11px/ms より速い）：とじる。いまの場所から .closing の transition で下へ
  down(head(),100,0); move(160,100); up(160,200);
  assert.ok(el.classList.contains('closing')); assert.equal(el.style.transform,''); assert.equal(el.style.transition,'');
  el.fire('transitionend',{propertyName:'transform'}); assert.equal(el.open,false);
  // ゆっくりでも、高さの3わりより下げたらとじる
  keySheet(PA,picks);
  down(head(),100,0); move(300,3000); up(300,3000); assert.ok(el.classList.contains('closing'));
  // スクロールなどでとられた（pointercancel）ときは、とじない
  keySheet(PA,picks);
  down(head(),100,0); move(400,100); up(400,100,'pointercancel'); assert.ok(!el.classList.contains('closing'));
  assert.equal(el.style.transform,'');
});

test('シート：上がっている・もどっているとちゅうにつかむと、いま見えている場所からひっぱる（ぱっともとにもどらない）',()=>{
  const {PA}=load(), picks=[];
  const el=keySheet(PA,picks);
  PA.__win.getComputedStyle=()=>({transform:'matrix(1, 0, 0, 1, 0, 60)'}); // まだ 60px 下
  PA.__win.DOMMatrixReadOnly=class{constructor(t){this.m42=Number(String(t).match(/(-?[\d.]+)\)$/)[1]);}};
  const head=()=>el.querySelector('.sheet-head h2');
  const ev=(t,y,ts,type)=>el.fire(type,{target:head(),pointerId:1,clientY:y,timeStamp:ts,button:0});
  ev(head(),100,0,'pointerdown');
  assert.equal(el.style.transition,'none'); assert.equal(el.style.transform,'translateY(60px)');
  // つかんですぐはなした（タップ）：60px 下にいても、とじない。もとの場所へもどる
  ev(head(),100,60,'pointerup');
  assert.ok(!el.classList.contains('closing')); assert.equal(el.style.transform,'');
  // ひっぱる：ゆびがうごいた分だけ（つかんだ場所から）
  ev(head(),100,100,'pointerdown');
  ev(head(),110,150,'pointermove'); assert.equal(el.style.transform,'translateY(70px)');
  ev(head(),95,2000,'pointermove'); assert.equal(el.style.transform,'translateY(55px)');
  ev(head(),95,2000,'pointerup'); assert.ok(!el.classList.contains('closing')); // 上へもどした：とじない
});

/* ----- おしたときの手ごたえ ----- */
test('PRESS_SEL：おせるものはぜんぶ .is-pressed。文の中のリンク・鍵盤・data-nopress はのぞく。横いっぱいの行・横スクロールの中はすこしまつ',async()=>{
  const {body,on}=load();
  const down=on('pointerdown','PRESS_SEL'), up=on('pointerup','pressOff(true)');
  mount(body,'<p>くわしくは<a href="x.html" id="prose">こちら</a>、<a class="btn" href="y.html" id="pbtn">ひらく</a></p>'
    +'<div class="card"><button class="scard" id="sc">曲</button><a class="arow" href="z.html" id="row">行</a><details><summary id="sum">ひらく</summary></details>'
    +'<button data-nopress id="np">x</button><button disabled id="dis">x</button><label class="sw" id="sw">オン</label><span id="txt">文</span></div>'
    +'<div class="scroll"><svg class="kb"><rect role="button" data-m="60" id="key"></rect></svg><button class="go" id="inscroll">x</button></div>');
  const $=id=>body.querySelector('#'+id);
  const pressed=async(id,wait=0)=>{down({pointerType:'touch',target:$(id),clientX:0,clientY:0});if(wait) await sleep(wait);const r=$(id).classList.contains('is-pressed');up({});return r;};
  for(const id of ['pbtn','sc','sw']) assert.equal(await pressed(id),true,id);
  for(const id of ['prose','np','dis','key']) assert.equal(await pressed(id,80),false,id);
  assert.equal(await pressed('txt',80),false);
  // 横いっぱいの行・summary・横スクロールの中：すぐには光らない（0.06びょうまつ）
  for(const id of ['row','sum','inscroll']){
    down({pointerType:'touch',target:$(id),clientX:0,clientY:0});
    assert.equal($(id).classList.contains('is-pressed'),false,id);
    await sleep(80); assert.equal($(id).classList.contains('is-pressed'),true,id); up({});
  }
  // マウスは :active（app.css）にまかせる
  down({pointerType:'mouse',target:$('sc'),clientX:0,clientY:0}); await sleep(130);
  assert.equal($('sc').classList.contains('is-pressed'),false);
});

test('PRESS_OFF：<li> の中の行（a.arow）はおせる（すこしまってから）。<li> の中の class のないリンクと、svg の中（楽譜のます）はおさない',async()=>{
  const {body,on}=load();
  const down=on('pointerdown','PRESS_SEL'), up=on('pointerup','pressOff(true)');
  mount(body,'<ul><li><a class="arow" href="z.html" id="lirow">島の行</a></li><li><a href="x.html" id="liprose">こちら</a></li></ul>'
    +'<div class="weakrow"><a href="w.html" id="weak">にがて</a></div>'
    +'<svg class="score"><rect class="hit" role="button" data-slot="0" id="hit"></rect></svg>');
  const $=id=>body.querySelector('#'+id);
  down({pointerType:'touch',target:$('lirow'),clientX:0,clientY:0});
  assert.equal($('lirow').classList.contains('is-pressed'),false,'すぐには光らない');
  await sleep(80); assert.equal($('lirow').classList.contains('is-pressed'),true,'0.06びょうあと'); up({});
  for(const id of ['liprose','hit']){
    down({pointerType:'touch',target:$(id),clientX:0,clientY:0}); await sleep(80);
    assert.equal($(id).classList.contains('is-pressed'),false,id); up({});
  }
  // にがての丸いボタンは、ふつうのボタンとおなじくすぐ
  down({pointerType:'touch',target:$('weak'),clientX:0,clientY:0});
  assert.equal($('weak').classList.contains('is-pressed'),true); up({});
});

test('core.js：古いブラウザのための分かれ道はもうない（<dialog>なし・Pointer Events なし・touchstart）',()=>{
  assert.ok(!/pa-fb|showModal!==|!window\.PointerEvent|'touchstart'|animationend/.test(CORE));
  assert.ok(!/addEventListener\('cancel'/.test(CORE),'Esc はうごかさずにとじる');
});

test('PA.scrollTop：すぐ上へ（なめらかにしない）。もう上なら何もしない',()=>{
  const {PA}=load(), calls=[];
  PA.__win.scrollTo=(...a)=>calls.push(a);
  PA.__win.scrollY=0; PA.scrollTop(); assert.deepEqual(calls,[]);
  PA.__win.scrollY=500; PA.scrollTop(); assert.deepEqual(calls.map(a=>[...a]),[[0,0]]);
});
