// 2026-11-01 さわってみての意見：①島をひらいたとき、ひらいているのかわかりにくい ②クイズの中の「くらべてきく」はいらない
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('クイズの聴きわけ（和音の聴きわけ・変化和音クイズ）に「くらべてきく」はもうない',()=>{
  for(const f of ['ear.html','chroma-quiz.html']){
    const s=read(f);
    assert.ok(!s.includes('🎧 くらべてきく'),f+'：見出し');
    assert.ok(!/data-act="ecmp"|case 'ecmp'|a==='ecmp'/.test(s),f+'：ボタンと操作');
    assert.ok(!/state\.hinted|Q\.eHint/.test(s),f+'：くらべてきくでの「ヒントでできた」');
  }
});
test('学ぶページの「くらべて聴く」（おわりかた）とおわりかたクイズの答えたあとのくらべては残す',()=>{
  assert.ok(read('ending.html').includes('🎧 くらべて聴く'));
  assert.ok(read('ending-quiz.html').includes('くらべて聴く'));
});
test('地図：ひらいた島の中身は色のついたパネルに入り、「とじる」がある。ひらく島は1つだけ',()=>{
  const s=read('index.html');
  assert.ok(/<div class="apanel"><ul class="alist"/.test(s),'パネル');
  assert.ok(/class="aclose" data-close>/.test(s),'とじるボタン');
  assert.ok(/\.apanel\{[^}]*background:var\(--l\)/.test(s),'パネルは島のうすい色');
  assert.ok(/details\.stage\[open\] \.sign::after[^{]*\{content:"▲"/.test(s),'ひらいているときは▲');
  assert.ok(s.includes("const open=s.id===openId;"),'はじめに出すときも1つだけ');
  assert.ok(s.includes("document.querySelectorAll('#view details.stage[open]').forEach(o=>{if(o!==d){o.open=false;"),'ひらくとほかはとじる');
});
