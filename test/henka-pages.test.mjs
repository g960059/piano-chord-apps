// 準固有和音・異名同音の読みかえ（学ぶページ）の文とリンクのきまり（Ⅴ9の根音省略（dim-halfdim）は test/lesson-map.test.mjs）
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const PAGES=['borrowed.html','enharmonic.html'];

test('家族・聴きくらべのよびかたに A・B・C をつかわない（CDE の音の名前とまちがえる）',()=>{
  for(const f of PAGES){
    const s=read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,''); // コメントはのぞく（画面の文だけ）
    assert.ok(!/[ＡＢＣ]の家族/.test(s),f+'：Ａ・Ｂ・Ｃの家族');
    assert.ok(!/[AB] をきく|[AB] が /.test(s),f+'：A／B のボタン');
    assert.ok(!/芸大/.test(s),f+'：画面の文に芸大');
  }
});

test('どのページにも「ためしてみる」（変化和音クイズ・n=5）と、聴くボタンの data-hot',()=>{
  for(const f of PAGES){
    const s=read(f);
    assert.match(s,/PA\.tryHTML\(\{to:'chroma-quiz',params:\{key,mode:'keys',[^}]*n:5\}/,f);
    assert.ok(!/to:'chroma-quiz',params:\{[^}]*level:/.test(s),f+'：🎹 はまえの level をつかわない（step か chord）');
    assert.match(s,/data-hot="listen"/,f);
    assert.match(s,/data-hot="next"/,f);
  }
});

test('リンクの key は keyDeck の id だけ（ほかはすてる）',()=>{
  const PA=loadPA();
  assert.deepEqual({...PA.keyDeck.parse('M7')},{minor:false,idx:7,id:'M7'});
  assert.deepEqual({...PA.keyDeck.parse('m3')},{minor:true,idx:3,id:'m3'});
  for(const bad of ['M13','m-1','M07','<script>','',undefined]) assert.equal(PA.keyDeck.parse(bad),null,String(bad));
  assert.equal(PA.url('chroma-quiz',{key:'M7',mode:'keys',chord:'ivm,bvi',n:5}),'chroma-quiz.html?key=M7&mode=keys&chord=ivm%2Cbvi&n=5');
});
