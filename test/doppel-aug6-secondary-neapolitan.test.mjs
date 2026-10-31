// 変化和音の学ぶページ（doppel・secondary・aug6・neapolitan）のかんたんなテスト：node --test test/
// ・iOS 12でうごかない書きかた（?. ??）がない、スクリプトが読める
// ・変化和音クイズへは PA.tryHTML（いまの調・n=5・その和音が出るステップ）。むかしのふつうのリンク・PA.go はのこっていない
// ・「🔊 いっしょに」に data-hot="listen"（スペースで鳴らす）、「🎲 問題を出す」に data-hot="next"（doppel・secondary・neapolitan）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(dir,'..',f),'utf8');
const scriptOf=html=>[...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m=>m[1]).join('\n');

// ページ → クイズの 🎹 ステップ（先生のじゅん）と、そのステップの名前に入っているはずのことば。secondary は chord でしぼる（step なし）
const PAGES={
  'doppel.html':{step:1,word:'ドッペル',ear:1},
  'secondary.html':{step:null,word:'副属和音',ear:null},
  'aug6.html':{step:5,word:'増六',ear:2},
  'neapolitan.html':{step:4,word:'ナポリ',ear:3}
};
const quiz=read('chroma-quiz.html');
const klv=lv=>{const m=new RegExp(`\\{lv:${lv},[^\\n]*\\}`).exec(quiz);return m?m[0]:'';};
const ear=lv=>{const m=/const EAR_LV=\{([^\n]*)\};/.exec(quiz);return m?(new RegExp(`${lv}:\\[([^\\]]*)\\]`).exec(m[1])||[])[1]||'':'';};

for(const [file,want] of Object.entries(PAGES)){
  const html=read(file), js=scriptOf(html);
  test(`${file}：古い端末でも読める`,()=>{
    assert.ok(js.length>1000,'スクリプトがある');
    assert.ok(!/\?\.|\?\?/.test(js),'?. ?? がない');
    assert.doesNotThrow(()=>new Function(js),'文法');
  });
  test(`${file}：変化和音クイズへは PA.tryHTML（調・n=5・ステップ${want.step||'なし'}）`,()=>{
    assert.ok(!/href="chroma-quiz\.html"/.test(html),'ふつうのリンクはのこっていない');
    assert.ok(!/PA\.go\('chroma-quiz/.test(html),'PA.go はのこっていない');
    const m=/PA\.tryHTML\(\{to:'chroma-quiz',params:\{([^}]*)\}/.exec(js);
    assert.ok(m,'PA.tryHTML でクイズへ');
    const p=m[1];
    assert.match(p,/mode:'keys'/);
    assert.ok(!/level:/.test(p),'🎹 はまえの level をつかわない');
    if(want.step) assert.match(p,new RegExp(`step:${want.step}\\b`));
    assert.match(p,/key:PA\.keyDeck\.id\(state\.minor,state\.keyIdx\)/);
    assert.match(p,/n:5\b/);
    if(want.step) assert.ok(klv(want.step).includes(want.word),`クイズのステップ${want.step}に「${want.word}」が入っている`);
    if(want.ear){
      assert.match(js,new RegExp(`mode:'ear',level:${want.ear},key:PA\\.keyDeck\\.id\\(state\\.minor,state\\.keyIdx\\),n:5\\}`),'👂 聴きわけのレベル・調・n=5');
      assert.ok(ear(want.ear).length>0,`クイズに 👂 レベル${want.ear}がある`);
    }
  });
  test(`${file}：「🔊 いっしょに」に data-hot="listen"`,()=>{
    assert.match(html,/data-act="play" data-hot="listen"/);
    if(file!=='aug6.html') assert.match(html,/data-act="qnext" data-hot="next">\$\{PA\.icon\('dice'\)\}問題を出す/);
  });
}

test('secondary.html：Ⅴ7/Ⅴと副属和音だけにしぼる chord（クイズの和音の id）',()=>{
  const m=/chord:'([^']*)'/.exec(scriptOf(read('secondary.html')));
  assert.ok(m);
  assert.deepEqual(m[1].split(','),['dd','s2','s3','s4','s6']);
  const g=/const GROUPS=([^\n]*);/.exec(quiz);
  assert.ok(g,'クイズの GROUPS');
  for(const id of m[1].split(',')) assert.ok(g[1].includes(`'${id}'`),`クイズに${id}がある`);
});
