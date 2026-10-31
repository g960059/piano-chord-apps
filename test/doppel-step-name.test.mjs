// 先生 2026-11-01（2）のなおし：node --test test/
// ・変化和音クイズのステップ1（Ⅱ7とドッペルドミナントの場所から入る）は、Ⅱ7とドッペルドミナントだけ。
//   ⅤのⅤ9の根音省略（ddim）は副属和音のステップ2と「ぜんぶ」に
// ・副属和音のページ：目標がⅤ（ⅤのⅤ）のときは、まず「ドッペルドミナントとよぶ」と言ってから、記号の読みかた（Ⅴ度調の…）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const STUB='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){},querySelectorAll:function(){return [];},style:{}};};document.querySelector=function(){return null;};\n';
const plain=h=>h.replace(/<[^>]+>/g,'');

function openQuiz(search,mem=new Map()){
  const js=read('chroma-quiz.html').match(/<script>\n(\/\* 変化和音クイズ[\s\S]*?)<\/script>/)[1];
  return loadPA(STUB+read('assets/core.js')+'\nwindow.scrollTo=function(){};window.innerHeight=800;PA.paint=function(el,h,sig){if(sig!=="bar")PA.__html=h;};'
    +'document.addEventListener=function(){};\n'+js+'\nPA.__Q=Q;PA.__render=render;PA.__new=newQ;',{storage:mem,search,href:'https://example.test/chroma-quiz.html'+search});
}
const typesSeen=P=>{const s=new Set();for(let i=0;i<120;i++){P.__new();s.add(P.__Q.q.type);}return s;};

test('変化和音クイズ：doppel.html のためしてみる（step=1）は Ⅱ7 とドッペルドミナントだけ',()=>{
  const P=openQuiz('?mode=keys&step=1&key=M0&n=5');
  assert.equal(P.__Q.kLv,1);
  assert.deepEqual(Object.keys(P.__Q.types).filter(t=>P.__Q.types[t]),['ii7','dd']);
  assert.deepEqual([...typesSeen(P)].sort(),['dd','ii7']);
  P.__render();
  assert.ok(!/ステップ1<\/b>：[^<]*根音省略/.test(P.__html),'ステップ1の説明に根音省略は出さない');
});

test('変化和音クイズ：ⅤのⅤ9の根音省略は副属和音のステップ2と「ぜんぶ」で出る。secondary.html のリンクにも',()=>{
  assert.ok(typesSeen(openQuiz('?mode=keys&step=2')).has('ddim'));
  assert.ok(typesSeen(openQuiz('?mode=keys&step=6')).has('ddim'));
  const P=openQuiz('?mode=keys&chord=dd,s2,s3,s4,s6,ddim&key=M0&n=5');
  assert.deepEqual(Object.keys(P.__Q.types).filter(t=>P.__Q.types[t]),['dd','s2','s3','s4','s6','ddim']);
});

test('変化和音クイズ：まえの保存 kStep=1（ddim が入っていたころ）は、いまのステップ1（Ⅱ7・ドッペルだけ）でよむ',()=>{
  const mem=new Map([['chroma-quiz',JSON.stringify({mode:'keys',kStep:1,types:{ii7:true,dd:true,ddim:true}})]]);
  const P=openQuiz('',mem);
  assert.equal(P.__Q.kLv,1);
  assert.deepEqual(Object.keys(P.__Q.types).filter(t=>P.__Q.types[t]),['ii7','dd']);
});

// 副属和音のページの<script>を core のあとにうごかして、説明の関数をとりだす
function secPage(){
  const js=[...read('secondary.html').matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  return loadPA(STUB+read('assets/core.js')+'\nwindow.scrollTo=function(){};PA.paint=function(el,h){PA.__html=h;};document.addEventListener=function(){};\n'
    +js+'\nPA.__state=state;PA.__info=info;PA.__hero=heroMsg;');
}

test('副属和音：目標がⅤのときは、まず「ドッペルドミナントとよぶ」。記号の読みかた（Ⅴ度調の…）はそのあと',()=>{
  const P=secPage(), S=P.__state;
  for(const minor of [false,true]) for(let i=0;i<P.keyCount(minor);i++){
    const key=P.keyOf(minor,i);
    S.minor=minor; S.keyIdx=i; S.target=5;
    for(const kind of ['V7','vii7','vii7h']){
      if(!P.henka.secondary(key,5,kind)) continue;
      S.kind=kind;
      const m=plain(P.__hero(key,P.__info(key))), a=m.indexOf('ドッペルドミナント'), b=m.indexOf('Ⅴ度調の');
      assert.ok(a>=0&&b>a,`${P.keyName(key)} ${kind}：${m.slice(0,80)}`);
      assert.ok(m.startsWith(kind==='V7'?'この和音をドッペルドミナント（ⅤのⅤ）とよぶよ。':'この和音はドッペルドミナント（ⅤのⅤ）の家族だよ。'),m.slice(0,40));
    }
    // ほかの目標はいままでどおり「x度調のⅤ7と読む」から
    const t=minor?4:2; S.target=t; S.kind='V7';
    const m=plain(P.__hero(key,P.__info(key)));
    assert.ok(!/ドッペルドミナント/.test(m.split('<br>')[0])&&/度調のⅤ7」と読むよ/.test(m),m.slice(0,60));
  }
});
