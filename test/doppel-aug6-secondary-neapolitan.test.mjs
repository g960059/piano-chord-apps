// 変化和音の 学ぶ ページ（doppel・secondary・aug6・neapolitan）の かんたんな テスト：node --test test/
// ・iOS 12 で うごかない 書きかた（?. ??）が ない、スクリプトが 読める
// ・変化和音クイズへは PA.tryHTML（いまの 調・n=5・その 和音が 出る レベル）。むかしの ふつうの リンク・PA.go は のこっていない
// ・「🔊 いっしょに」に data-hot="listen"（スペースで 鳴らす）、「🎲 もんだいを 出す」に data-hot="next"（doppel・secondary・neapolitan）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(dir,'..',f),'utf8');
const scriptOf=html=>[...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]).join('\n');

// ページ → クイズの 🎹 レベル と、その レベルの 名前に 入っている はずの ことば
const PAGES={
  'doppel.html':{level:1,word:'ドッペル',ear:1},
  'secondary.html':{level:5,word:'副属和音',ear:null},
  'aug6.html':{level:3,word:'増六',ear:2},
  'neapolitan.html':{level:4,word:'ナポリ',ear:3}
};
const quiz=read('chroma-quiz.html');
const klv=lv=>{const m=new RegExp(`\\{lv:${lv},[^\\n]*\\}`).exec(quiz);return m?m[0]:'';};
const ear=lv=>{const m=/const EAR_LV=\{([^\n]*)\};/.exec(quiz);return m?(new RegExp(`${lv}:\\[([^\\]]*)\\]`).exec(m[1])||[])[1]||'':'';};

for(const [file,want] of Object.entries(PAGES)){
  const html=read(file), js=scriptOf(html);
  test(`${file}：古い 端末でも 読める`,()=>{
    assert.ok(js.length>1000,'スクリプトが ある');
    assert.ok(!/\?\.|\?\?/.test(js),'?. ?? が ない');
    assert.doesNotThrow(()=>new Function(js),'文法');
  });
  test(`${file}：変化和音クイズへは PA.tryHTML（調・n=5・レベル${want.level}）`,()=>{
    assert.ok(!/href="chroma-quiz\.html"/.test(html),'ふつうの リンクは のこっていない');
    assert.ok(!/PA\.go\('chroma-quiz/.test(html),'PA.go は のこっていない');
    const m=/PA\.tryHTML\(\{to:'chroma-quiz',params:\{([^}]*)\}/.exec(js);
    assert.ok(m,'PA.tryHTML で クイズへ');
    const p=m[1];
    assert.match(p,/mode:'keys'/);
    assert.match(p,new RegExp(`level:${want.level}\\b`));
    assert.match(p,/key:PA\.keyDeck\.id\(state\.minor,state\.keyIdx\)/);
    assert.match(p,/n:5\b/);
    assert.ok(klv(want.level).includes(want.word),`クイズの レベル${want.level} に「${want.word}」が 入っている`);
    if(want.ear){
      assert.match(js,new RegExp(`mode:'ear',level:${want.ear},key:PA\\.keyDeck\\.id\\(state\\.minor,state\\.keyIdx\\),n:5\\}`),'👂 聴きわけの レベル・調・n=5');
      assert.ok(ear(want.ear).length>0,`クイズに 👂 レベル${want.ear} が ある`);
    }
  });
  test(`${file}：「🔊 いっしょに」に data-hot="listen"`,()=>{
    assert.match(html,/data-act="play" data-hot="listen"/);
    if(file!=='aug6.html') assert.match(html,/data-act="qnext" data-hot="next">🎲 もんだいを 出す/);
  });
}

test('secondary.html：Ⅴ7/Ⅴ と 副属和音だけに しぼる chord（クイズの 和音の id）',()=>{
  const m=/chord:'([^']*)'/.exec(scriptOf(read('secondary.html')));
  assert.ok(m);
  assert.deepEqual(m[1].split(','),['dd','s2','s3','s4','s6']);
  const g=/const GROUPS=([^\n]*);/.exec(quiz);
  assert.ok(g,'クイズの GROUPS');
  for(const id of m[1].split(',')) assert.ok(g[1].includes(`'${id}'`),`クイズに ${id} が ある`);
});
