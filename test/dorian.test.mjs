// ドリアのⅣ（先生：2026-11-01「ドリアのⅣも入れてほしい」）：node --test test/
// ・PA.henka.dorian・dorianToV・dorianCad：13の短調で、Ⅳの第3音（6ばんめ）を半音上げた長三和音。上げた音は導音へ2度上、連続5度・8度なし
// ・記号：Ⅳの第3音上方変位（PA.rn の alt3。印の形は先生に確認まち）
// ・dorian.html：学ぶページのきまり（古い端末・ためしてみる・記号のみかた・聴くボタン）
// ・chroma-quiz.html：chord=ivd（ステップ7）で短調のドリアのⅣが出て、こたえあわせ・ヒントが出る
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const scriptOf=html=>[...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const screenOf=html=>html.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'');
const PA=loadPA(), H=PA.henka, mod=PA.mod;
const MIN=[...Array(13).keys()].map(i=>PA.minorKey(i)), MAJ=[...Array(13).keys()].map(i=>PA.majorKey(i));
const kn=k=>PA.LET_EN[k.l]+PA.ACC[k.a]+(k.minor?'m':'');
const pc=n=>mod(PA.NAT[n.letter]+n.acc,12);
const nm=ns=>ns.map(n=>PA.LET_EN[n.letter]+PA.ACC[n.acc]+n.midi).join(' ');
const sp=(k,lo,so)=>{const L=mod(k.l+lo,7);return [L,PA.spell(L,k.tpc+so)];};

test('ドリアのⅣ：短調のⅣの第3音（6ばんめ）を半音上げた長三和音。ふつうのⅣとは第3音だけちがう',()=>{
  for(const k of MIN){
    const d=H.dorian(k), m=H.dorian(k,false), w=kn(k);
    assert.equal(d.length,4,w);
    assert.deepEqual([d[0].letter,d[0].acc],sp(k,3,5),w+'：ベース＝4ばんめ');
    assert.deepEqual([d[2].letter,d[2].acc],sp(k,3,5),w+'：根音');
    assert.deepEqual([d[3].letter,d[3].acc],sp(k,5,9),w+'：第3音＝上げた6ばんめ');
    assert.deepEqual([d[1].letter,d[1].acc],sp(k,0,0),w+'：第5音＝主音');
    assert.equal(mod(pc(d[3])-pc(d[2]),12),4,w+'：長3度（長三和音）');
    assert.equal(d[3].tag,'raised',w);
    assert.deepEqual([m[3].letter,m[3].acc],sp(k,5,8),w+'：ふつうのⅣは調号どおり');
    assert.equal(m[3].tag,null);
    d.forEach((n,i)=>{if(i!==3) assert.equal(n.midi,m[i].midi,w+'：ほかの音はおなじ高さ');});
    assert.equal(d[3].midi-m[3].midi,1,w+'：半音上');
    // 楽譜に書く音：重嬰・重変は出ない（13の短調では）
    H.dorianCad(k).flat().concat(H.dorianCad(k,false).flat()).forEach(n=>assert.ok(Math.abs(n.acc)<=1||n.tag==='lt',w+' '+nm([n])));
  }
  for(const k of MAJ){assert.equal(H.dorian(k),null);assert.equal(H.dorianCad(k),null);assert.equal(H.rnParts(k,'dorian'),null);assert.equal(H.symbol(k,'dorian'),'');}
});

test('ドリアのⅣ → Ⅴ：上げた6ばんめは導音へ2度上、ふつうのⅣからは増2度。カデンツ Ⅰ→Ⅳ→Ⅴ→Ⅰ に連続5度・8度・交差なし',()=>{
  for(const k of MIN){
    const w=kn(k), d=H.dorian(k), m=H.dorian(k,false), V=H.dorianToV(k);
    assert.equal(V[3].tag,'lt'); assert.deepEqual([V[3].letter,V[3].acc],sp(k,6,11),w+'：導音');
    assert.equal(V[3].midi-d[3].midi,2,w+'：ドリア → 導音は2度（全音）');
    assert.equal(PA.stepOf(V[3])-PA.stepOf(d[3]),1,w);
    assert.equal(V[3].midi-m[3].midi,3,w+'：ふつうのⅣ → 導音は増2度');
    assert.equal(PA.stepOf(V[3])-PA.stepOf(m[3]),1,w);
    for(const on of [true,false]){
      const cad=H.dorianCad(k,on);
      assert.equal(cad.length,4);
      cad.forEach((c,ci)=>{
        for(let i=1;i<c.length;i++) assert.ok(c[i].midi>c[i-1].midi,`${w} #${ci}: 交差（${nm(c)}）`);
        c.forEach((n,i)=>{const [lo,hi]=i?[55,79]:[40,55];assert.ok(n.midi>=lo-2&&n.midi<=hi+2,`${w} #${ci}: 音域（${nm(c)}）`);});
        for(let i=2;i<c.length;i++) assert.ok(c[i].midi-c[i-1].midi<=12,`${w} #${ci}: 上の声のあいだは1オクターブまで`);
        assert.ok(c.filter(n=>pc(n)===mod(k.tpc+11,12)).length<=1,w+'：導音は1つ');
      });
      for(let s=1;s<4;s++){
        const A=cad[s-1], B=cad[s];
        for(let i=0;i<4;i++) for(let j=i+1;j<4;j++){
          const a=mod(A[j].midi-A[i].midi,12), b=mod(B[j].midi-B[i].midi,12);
          if(a===b&&(a===0||a===7)&&A[i].midi!==B[i].midi&&A[j].midi!==B[j].midi) assert.fail(`${w} ${on}: 連続${a?5:8}度 #${s}（${nm(A)} → ${nm(B)}）`);
        }
        A.forEach((n,i)=>{if(n.tag==='lt') assert.equal(B[i].midi-n.midi,1,w+'：導音は半音上へ');});
      }
      assert.deepEqual(cad[1].map(n=>n.midi),H.dorian(k,on).map(n=>n.midi));
      assert.deepEqual(cad[2].map(n=>n.midi),V.map(n=>n.midi),'どちらのⅣからもおなじⅤ');
    }
  }
});

test('記号：ドリアのⅣ＝Ⅳの第3音上方変位（左の＋。印の形は先生に確認まち）。「記号のみかた」はたのまれたときだけ＋の行',()=>{
  const k=PA.minorKey(9); // ハ短調
  assert.deepEqual({...H.rnParts(k,'dorian')},{deg:4,alt3:'up',name:'ivd'});
  assert.equal(H.label(k,'dorian'),'Ⅳ（第3音上方変位）');
  assert.equal(H.symbol(k,'dorian'),'F'); assert.equal(H.symbol(k,'minorIV'),'Fm');
  assert.equal(PA.rnAria({deg:4,alt3:'up',form:7}),'Ⅳ、7の和音、第3音上方変位');
  const svg=PA.rn({deg:4,alt3:'up'});
  assert.match(svg,/class="rn-alt3"/); assert.match(svg,/aria-label="Ⅳ、第3音上方変位"/);
  assert.ok(!/rn-alt3/.test(PA.rn({deg:4})));
  assert.ok(!/rn-alt3/.test(PA.rn({deg:4,alt3:'down'})),'下方変位の第3音はまだない');
  // ＋が左にはみださない（viewBox の中）
  const vb=/viewBox="0 ([-\d.]+) ([\d.]+) /.exec(PA.rnSvg({deg:4,alt3:'up'})), d=/class="rn-alt3" d="M([\d.]+) /.exec(svg);
  assert.ok(vb&&d&&+d[1]>=0,'＋の左はしが0より右');
  assert.match(PA.rnHelp({alt3:true}),/左の＋<\/b>＝第3音上方変位/);
  assert.ok(!/左の＋/.test(PA.rnHelp()));
});

test('dorian.html：学ぶページのきまり',()=>{
  const html=read('dorian.html'), js=scriptOf(html), sc=screenOf(html);
  assert.ok(js.length>1000);
  assert.ok(!/\?\.|\?\?/.test(js),'?. ?? がない（古い iPhone）');
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/PA\.tryHTML\(\{to:'chroma-quiz',params:\{key:PA\.keyDeck\.id\(true,state\.keyIdx\),mode:'keys',chord:'ivd',n:5\}/);
  assert.match(js,/PA\.rnHelp\(\{alt3:true\}\)/);
  assert.match(html,/data-hot="listen"/); assert.match(html,/data-hot="next"/);
  assert.ok(!/半減七|芸大/.test(sc));
  assert.ok(!/[AB] をきく|[AB] が /.test(sc),'聴きくらべは①②');
  assert.match(html,/<title>ドリアのⅣ<\/title>/);
  assert.match(html,/<meta name="description" content="短調のⅣの第3音（6ばんめ）を半音上げた、明るいⅣ。導音へなめらかに上がる">/,'build-meta の説明');
  assert.match(read('sw.js'),/'dorian\.html'/,'オフライン用の PRECACHE');
  const PB=loadPA();
  assert.equal(PB.app('dorian').practice,'chroma-quiz');
  assert.equal(PB.app('dorian').unit,'extra');
  // 旋律的短音階のことば：minor-why の「このアプリでは使わない」をなおした
  assert.ok(!/旋律的短音階[^\n]*このアプリでは使わないよ/.test(read('minor-why.html')));
});

// 変化和音クイズのページをひらく（test/enharmonic-challenge.test.mjs とおなじしかた）
const STUB='document.getElementById=function(){return {innerHTML:"",parentNode:null,addEventListener:function(){},querySelectorAll:function(){return [];},style:{}};};document.querySelector=function(){return null;};\n';
function openQuiz(search,mem=new Map()){
  const cq=read('chroma-quiz.html'), js=cq.match(/<script>\n(\/\* 変化和音クイズ[\s\S]*?)<\/script>/)[1];
  return loadPA(STUB+read('assets/core.js')+'\nwindow.scrollTo=function(){};window.innerHeight=800;PA.paint=function(el,h,sig){if(sig!=="bar")PA.__html=h;};'
    +'document.addEventListener=function(){};\n'+js+'\nPA.__Q=Q;PA.__render=render;PA.__check=checkKeys;PA.__new=newQ;',{storage:mem,search,href:'https://example.test/chroma-quiz.html'+search});
}
test('変化和音クイズ：chord=ivd（ドリアのページのためしてみる）は短調のドリアのⅣ。正解・ヒント',()=>{
  const P=openQuiz('?key=m9&mode=keys&chord=ivd&n=5'), Q=P.__Q;
  assert.equal(Q.q.type,'ivd'); assert.equal(Q.q.minor,true); assert.equal(Q.q.keyIdx,9); assert.equal(Q.kLv,7,'ステップ7とおなじ和音');
  P.__render();
  assert.match(P.__html,/ステップ4<\/b>：ドリアのⅣ/,'画面の番号は準固有のつぎの4');
  const key=P.keyOf(true,9), d=P.henka.dorian(key);
  // ふつうのⅣ（ファ・ラ♭・ド）をおさえる → 第3音を上げるヒント
  Q.picked=new Set(P.henka.dorian(key,false).map(n=>n.midi)); P.__check(); P.__render();
  assert.match(P.__html,/🤔 おしい/); assert.match(P.__html,/<b>半音上げて<\/b>/);
  // ドリアのⅣ → 正解
  Q.checked=false; Q.picked=new Set(d.map(n=>n.midi)); P.__check(); P.__render();
  assert.match(P.__html,/🎉 正解/); assert.match(P.__html,/コードネームでは<b>F<\/b>/); assert.match(P.__html,/rn-alt3/);
  assert.match(P.__html,/2度上がる/);
  // 長調だけにしても、ドリアのⅣは短調から出す
  const P2=openQuiz('?mode=keys&chord=ivd'); P2.__Q.keyset='major'; for(let i=0;i<5;i++){P2.__new();assert.equal(P2.__Q.q.minor,true);}
  // ステップ7（step=7）・ぜんぶ（step=6）にも入る
  assert.equal(openQuiz('?step=7').__Q.types.ivd,true);
  assert.equal(openQuiz('?step=6').__Q.types.ivd,true);
  assert.equal(openQuiz('?step=3').__Q.types.ivd,false,'準固有のステップには入れない');
});
