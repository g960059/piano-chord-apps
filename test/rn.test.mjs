// 和音記号（藝大式）の描きかた PA.rn をたしかめる
// 先生の決め（docs/TEACHER-FEEDBACK.md 2026-10-31）：増六は先生の写真のとおり。根音省略の斜線は下の（大きい）Ⅴだけ。
//   第5音下方変位は、下のⅤの上の横棒の左はしに、左むきのチョン。右上の数字は転回形（はぶいた根音を入れて数える）
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const eq=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);
// ハ短調・ハ長調の増六（先生の写真）
const IT={of:5,deg:5,form:7,inv:2,alt5:'down',omit:true};
const FR={of:5,deg:5,form:7,inv:2,alt5:'down'};
const GER={of:5,deg:5,form:9,inv:2,alt5:'down',omit:true};
const maj=p=>({...p,borrowed:true});
const cMin=PA.minorKey(PA.MINOR_KEYS.findIndex(([l,a])=>l===0&&a===0)), cMaj=PA.majorKey(0);

// SVG の中身をしらべる（大きい数字＝translate のついていない g、小さい数字＝scale のついた g）
const nums=s=>[...s.matchAll(/<g transform="translate\(([-\d.]+) ([-\d.]+)\)( scale\(([\d.]+)\))?"/g)].map(m=>({x:+m[1],y:+m[2],s:m[4]?+m[4]:1}));
const big=s=>nums(s).find(g=>g.s===1);
const small=s=>nums(s).find(g=>g.s<1);
const pathOf=(s,cls)=>{const m=new RegExp(`<path class="${cls}" d="M([-\\d.]+) ([-\\d.]+)L([-\\d.]+) ([-\\d.]+)"`).exec(s);return m&&{x1:+m[1],y1:+m[2],x2:+m[3],y2:+m[4]};};
const textOf=(s,cls)=>{const m=new RegExp(`<text class="${cls}" x="([-\\d.]+)" y="([-\\d.]+)"[^>]*>([^<]*)</text>`).exec(s);return m&&{x:+m[1],y:+m[2],t:m[3]};};

test('PA.rn：増六（先生の写真）の文字と読み上げ',()=>{
  assert.equal(PA.rnText(IT),'ⅤのⅤ₇²（第5音下方変位・根音省略）');
  assert.equal(PA.rnText(FR),'ⅤのⅤ₇²（第5音下方変位）');
  assert.equal(PA.rnText(GER),'ⅤのⅤ₉²（第5音下方変位・根音省略）');
  assert.equal(PA.rnText(maj(GER)),'○ⅤのⅤ₉²（第5音下方変位・根音省略）');
  assert.equal(PA.rnAria(IT),'ⅤのⅤ、7の和音、第2転回形、第5音下方変位、根音省略');
  assert.equal(PA.rnAria(FR),'ⅤのⅤ、7の和音、第2転回形、第5音下方変位');
  assert.equal(PA.rnAria(GER),'ⅤのⅤ、9の和音、第2転回形、第5音下方変位、根音省略');
  assert.equal(PA.rnAria(maj(IT)),'準固有のⅤのⅤ、7の和音、第2転回形、第5音下方変位、根音省略');
  // 調のしるし：短調＝小文字、長調＝大文字（ドイツ語の音名）
  assert.equal(PA.rnKey(cMin),'c:'); assert.equal(PA.rnKey(cMaj),'C:');
  const h=PA.rn(GER,{key:cMin});
  assert.match(h,/^<span class="rnum" role="img" aria-label="ハ短調、ⅤのⅤ、9の和音、第2転回形、第5音下方変位、根音省略"><span class="rnum-k">c:<\/span><svg class="rnum-svg"/);
  assert.match(PA.rn(maj(GER),{key:cMaj}),/aria-label="ハ長調、準固有のⅤのⅤ、9の和音/);
});

test('PA.rn：斜線は下の大きいⅤだけ・チョンは大きいⅤの上の横棒の左はし・○は左',()=>{
  for(const [p,omit] of [[IT,true],[FR,false],[GER,true],[maj(IT),true],[maj(FR),false],[maj(GER),true]]){
    const s=PA.rnSvg(p), B=big(s), S=small(s), w=JSON.stringify(p);
    assert.ok(B&&S,w+'：2段（大きい数字と小さい数字）');
    assert.ok(S.y+20*S.s<B.y,w+'：小さい数字は大きい数字の上');
    // 斜線
    const o=pathOf(s,'rn-omit');
    assert.equal(!!o,omit,w+'：斜線');
    assert.equal((s.match(/rn-omit/g)||[]).length,omit?1:0,w+'：斜線は1本だけ');
    if(o){
      assert.ok(Math.min(o.y1,o.y2)>S.y+20*S.s,w+'：斜線は小さい数字にかからない');
      assert.ok(Math.min(o.y1,o.y2)<B.y&&Math.max(o.y1,o.y2)>B.y+20,w+'：斜線は大きい数字をまたぐ');
      assert.ok(o.x1<B.x&&o.x2>B.x+15,w+'：大きいⅤの左下から右上へ');
    }
    // 第5音下方変位のチョン：大きいⅤの上の横棒（y＝B.y）の左はしから左へ
    const t=pathOf(s,'rn-alt5');
    assert.ok(t,w+'：チョン');
    assert.ok(Math.abs(t.y1-B.y)<1,w+'：上の横棒の高さ');
    assert.ok(t.x1<=B.x&&t.x1>B.x-2,w+'：左はしから');
    assert.ok(t.x2<t.x1-3,w+'：左むき');
    assert.ok(t.y1<S.y+20*S.s+20,w);
    assert.ok(!/rn-root/.test(s),w+'：根音下方変位ではない');
    // ○（準固有）：大きい数字の左
    const c=/<circle cx="([\d.]+)"/.exec(s);
    assert.equal(!!c,!!p.borrowed,w+'：○');
    if(c) assert.ok(+c[1]<t.x2,w+'：○はチョンよりも左');
    // 右上＝転回形、右下＝7・9（大きい数字の右）
    const inv=textOf(s,'rn-inv'), form=textOf(s,'rn-form');
    assert.equal(inv.t,'2',w); assert.equal(form.t,String(p.form),w);
    assert.ok(inv.y<form.y,w+'：転回形は上、7・9は下');
    assert.ok(inv.x>B.x+15&&form.x>B.x+15,w+'：大きい数字の右');
    assert.ok(inv.y<=B.y+12&&form.y>=B.y+20,w);
  }
});

test('PA.rn：Ⅴ9の根音省略・ⅤのⅤ・準固有・転回形・ナポリ',()=>{
  assert.equal(PA.rnText({deg:5,form:9,omit:true}),'Ⅴ₉（根音省略）');
  assert.equal(PA.rnAria({deg:5,form:9,omit:true,inv:1}),'Ⅴ、9の和音、第1転回形、根音省略');
  const s=PA.rnSvg({deg:5,form:9,omit:true});
  assert.equal(nums(s).length,1,'1段'); assert.match(s,/rn-omit/); assert.ok(!/rn-inv/.test(s));
  assert.equal(PA.rnText({of:5,deg:5,form:7}),'ⅤのⅤ₇');
  assert.equal(PA.rnText({of:5,deg:5,form:9,omit:true}),'ⅤのⅤ₉（根音省略）');
  assert.equal(PA.rnText({of:2,deg:5,form:7}),'ⅡのⅤ₇');
  eq(['○Ⅳ','○Ⅵ','○Ⅱ','○Ⅴ₉'],[{deg:4},{deg:6},{deg:2},{deg:5,form:9}].map(p=>PA.rnText({...p,borrowed:true})));
  eq(['Ⅰ','Ⅰ¹','Ⅰ²','Ⅴ₇¹','Ⅴ₇²','Ⅴ₇³'],[{deg:1},{deg:1,inv:1},{deg:1,inv:2},{deg:5,form:7,inv:1},{deg:5,form:7,inv:2},{deg:5,form:7,inv:3}].map(PA.rnText));
  assert.equal(PA.rnAria({deg:1,inv:2}),'Ⅰ、第2転回形');
  assert.equal(PA.rnAria({deg:4,borrowed:true}),'準固有のⅣ');
  assert.equal(PA.rnText({deg:3,natural:true}),'Ⅲ（自然）');
  // ナポリ：Ⅱの根音下方変位（印の形は先生に確認まち）。チョンは下の横棒の左
  const n=PA.rnSvg({deg:2,rootDown:true,inv:1}), B=big(n), r=pathOf(n,'rn-root');
  assert.ok(r&&Math.abs(r.y1-(B.y+20))<1&&r.x2<r.x1,'下の横棒の左はしから左へ');
  // 下方変位のチョンは、どれも左へ行くほど下がる（第5音・根音・上の小さい数字の根音でおなじ向き）
  assert.ok(r.y2>r.y1,'根音下方変位：左下へ');
  const t5=pathOf(PA.rnSvg(GER),'rn-alt5'); assert.ok(t5.y2>t5.y1,'第5音下方変位：左下へ');
  const od=/<path d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)" stroke="currentColor" stroke-width="1.8"/.exec(PA.rnSvg({of:2,ofDown:true,deg:5,form:7}));
  assert.ok(od&&+od[3]<+od[1]&&+od[4]>+od[2]&&+od[3]>0,'上の小さい数字の根音下方変位：左下へ（左がきれない）');
  assert.equal(PA.rnText({deg:2,rootDown:true,inv:1}),'Ⅱ¹（根音下方変位）');
  // 字の大きさでのびちぢみ（em）・色はまわりの字（currentColor）・読み上げはそと、svg は aria-hidden
  assert.match(s,/^<svg class="rnum-svg" viewBox="0 -4 [\d.]+ [\d.]+" style="width:[\d.]+em;height:[\d.]+em;vertical-align:-[\d.]+em" aria-hidden="true" focusable="false">/);
  assert.match(s,/stroke="currentColor"/); assert.ok(!/#[0-9a-f]{3,6}/i.test(s),'色を決めうちしない');
  // へんな値は描かない
  assert.equal(PA.rnText({deg:9,form:8,inv:7,alt5:'up'}),'Ⅰ');
  assert.equal(PA.rnText({deg:5,ofDown:true}),'Ⅴ','of がなければ ofDown はつかわない');
  // 読み上げに < > " が入っても HTML がこわれない
  assert.match(PA.rn({deg:1},{name:'"<x>"'}),/aria-label="&quot;&lt;x&gt;&quot;、Ⅰ"/);
});

test('PA.rnKey：24調（ドイツ語の音名、大文字＝長調・小文字＝短調）',()=>{
  const M=PA.MAJOR_KEYS.map((_,i)=>PA.rnKey(PA.majorKey(i))), m=PA.MINOR_KEYS.map((_,i)=>PA.rnKey(PA.minorKey(i)));
  eq(M,['C:','G:','D:','A:','E:','H:','Fis:','F:','B:','Es:','As:','Des:','Ges:']);
  eq(m,['a:','e:','h:','fis:','cis:','gis:','dis:','d:','g:','c:','f:','b:','es:']);
});

test('PA.rnOf／PA.rnH：文字からは「Ⅰ〜Ⅶ」「Ⅴ7」のような決まった形だけを記号にする',()=>{
  eq(PA.rnOf('Ⅴ7'),{deg:5,form:7}); eq(PA.rnOf('Ⅰ'),{deg:1}); eq(PA.rnOf('Ⅴ9'),{deg:5,form:9});
  for(const x of ['ドイツ','Ⅰ6/4','Ⅴ7/Ⅴ','？','Ⅳ（てんかい）','',null]) assert.equal(PA.rnOf(x),null,String(x));
  assert.match(PA.rnH('Ⅴ7'),/^<span class="rnum" role="img" aria-label="Ⅴ、7の和音">/);
  assert.equal(PA.rnH('ドイツ'),'ドイツ');
  assert.match(PA.rnH({deg:1,inv:2}),/aria-label="Ⅰ、第2転回形"/);
  assert.equal(PA.rnA('Ⅴ7'),'Ⅴ、7の和音'); assert.equal(PA.rnA('？'),'？');
});

test('PA.staffSVG：和音名に部品をわたすと記号で描く（文字の「Ⅴ7」も記号に、ほかの字はそのまま）',()=>{
  const key=cMin, n={letter:0,acc:0,midi:60};
  const s=PA.staffSVG(key,[{notes:[n],label:GER,labelColor:'#8a4fe0'},{notes:[n],label:'Ⅴ7'},{notes:[n],label:'ドイツ'}]);
  const inner=[...s.matchAll(/<svg x="[-\d.]+" y="[-\d.]+" width="[\d.]+" height="[\d.]+" viewBox="[^"]+" overflow="visible" color="([^"]+)" aria-hidden="true">/g)];
  eq(inner.map(m=>m[1]),['#8a4fe0','#3a3245']);
  // 読み上げ：role=img の子は読まれないので、和音名は外の svg の aria-label に（中の記号・文字は aria-hidden）
  assert.match(s,/^<svg viewBox="[^"]+" role="img" aria-label="がくふ：ⅤのⅤ、9の和音、第2転回形、第5音下方変位、根音省略。Ⅴ、7の和音。ドイツ"/);
  assert.equal((s.match(/role="img"/g)||[]).length,1,'role=img は外の svg だけ');
  assert.match(s,/<text aria-hidden="true" [^>]*>ドイツ<\/text>/);
  assert.match(PA.staffSVG(key,[{notes:[n]}]),/^<svg viewBox="[^"]+" role="img" aria-label="がくふ"/,'和音名がなければ「がくふ」だけ');
  assert.match(PA.staffSVG(key,[{notes:[n],label:'Ⅰ',sub:'はじめ'}]),/aria-label="がくふ：Ⅰ（はじめ）"/);
  assert.ok(!/>Ⅴ7<\/text>/.test(s),'文字の Ⅴ7 は描かない');
  // 2段の記号があると、名前を下げて音符とかさならないようにする
  const H=x=>+/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(x)[1];
  assert.ok(H(PA.staffSVG(key,[{notes:[n],label:GER}]))>H(PA.staffSVG(key,[{notes:[n],label:'Ⅰ'}])));
});

test('PA.rnHelp：記号のみかた（やさしいことば）',()=>{
  const h=PA.rnHelp();
  assert.match(h,/^<details class="more rnhelp" data-d="rnhelp"><summary><span aria-hidden="true">🔤<\/span> 記号のみかた<\/summary>/);
  for(const w of ['右上の小さい数字</b>＝転回形','右下の小さい数字</b>＝7の和音・9の和音','ななめの線</b>＝根音省略','前の小さい○</b>＝準固有和音','2だん</b>＝ⅤのⅤ','左上のチョン</b>＝第5音下方変位',
    // 斜線の和音の右上の数字は、はぶいた根音も入れて数える（先生の写真のきまり）。調はドイツ語の音名
    'はぶいた根音もあるつもりで数えるよ（いちばん下が第3音なら1）','調はドイツ語の音名で書くよ（H:＝ロ長調、Es:＝変ホ長調、fis:＝嬰ヘ短調、B:＝変ロ長調）'])
    assert.ok(h.includes(w),w);
  assert.ok(!/半減七/.test(h));
  assert.equal((h.match(/class="rnum"/g)||[]).length,6,'れいの記号が6つ');
  assert.match(PA.rnHelp({open:true}),/data-d="rnhelp" open>/);
});
