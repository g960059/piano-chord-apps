// 和音の かたち（inversion.html）の 音楽の 計算を 24調 すべてで たしかめる：node --test test/
// ページの <inv-logic> の ところだけを 読んで、core.js の PA と いっしょに うごかす
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from './_load.mjs';

const PA=loadPA();
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','inversion.html'),'utf8');
const m=html.match(/\/\* <inv-logic>[^\n]*\*\/([\s\S]*?)\/\* <\/inv-logic> \*\//);
assert.ok(m,'inversion.html に <inv-logic> が ある');
const INV=new Function('PA',m[1]+'\nreturn INV;')(PA);

const KEYS=[];
for(let i=0;i<PA.keyCount(false);i++) KEYS.push(PA.keyOf(false,i,60));
for(let i=0;i<PA.keyCount(true);i++) KEYS.push(PA.keyOf(true,i,60));
const CHS=['I','IV','V','V7'];
const pc=n=>PA.mod(PA.NAT[n.letter]+n.acc,12);
const kn=k=>PA.LET_EN[k.l]+PA.ACC[k.a]+(k.minor?'m':'');

test('26の 調（24調）× Ⅰ・Ⅳ・Ⅴ・Ⅴ7：つづりと ひびき',()=>{
  assert.equal(KEYS.length,26);
  for(const key of KEYS) for(const ch of CHS){
    const t=INV.tones(key,ch), c=INV.CHORDS[ch], tag=kn(key)+' '+ch;
    assert.equal(t.length,c.n,tag);
    t.forEach((n,j)=>{
      assert.equal(n.letter,PA.mod(PA.at(key.scale,c.deg).letter+2*j,7),tag+' ひとつとばしの 文字');
      assert.equal(PA.mod(n.midi,12),pc(n),tag+' 高さと つづりが あう');
      assert.ok(Math.abs(n.acc)<=2,tag);
      assert.equal(n.role,j,tag);
    });
    assert.ok(t[0].midi>=57&&t[0].midi<=68,tag+' 根音は ラ3〜ソ♯4');
    const iv=t.map(n=>n.midi-t[0].midi);
    const major=key.minor?(ch==='V'||ch==='V7'):true;
    assert.deepEqual(iv.slice(0,3),major?[0,4,7]:[0,3,7],tag+' 長三和音／短三和音');
    if(ch==='V7') assert.equal(iv[3],10,tag+' 属七');
    if(key.minor&&ch!=='I'&&ch!=='IV'){ // 短調の Ⅴ・Ⅴ7 の 第3音は 上げた 7ばんめ（導音）
      assert.equal(t[1].letter,key.lt.letter,tag); assert.equal(t[1].acc,key.lt.acc,tag); assert.ok(t[1].raised,tag);
    }
  }
});

test('かたち：おなじ 音のまま、いちばん下を 1オクターブ 上へ うつす',()=>{
  for(const key of KEYS) for(const ch of CHS){
    const all=INV.shapes(key,ch), n=INV.CHORDS[ch].n, tag=kn(key)+' '+ch;
    assert.equal(all.length,n,tag);
    const set=s=>s.map(x=>PA.LET_EN[x.letter]+x.acc).sort().join(',');
    all.forEach((s,i)=>{
      assert.equal(s.length,n,tag);
      for(let j=1;j<n;j++) assert.ok(s[j].midi>s[j-1].midi,tag+' 下から 上へ ならぶ');
      assert.equal(s[0].role,i,tag+' いちばん下の やくわり＝かたちの 番号');
      assert.equal(set(s),set(all[0]),tag+' つかう 音は おなじ');
      s.forEach(x=>assert.equal(PA.mod(x.midi,12),pc(x),tag));
      assert.ok(s[n-1].midi-s[0].midi<12,tag+' 1オクターブの 中');
      assert.ok(s[n-1].midi<=88,tag+' 高すぎない');
      if(i+1<n){
        const nx=all[i+1];
        assert.deepEqual(nx.slice(0,n-1).map(x=>x.midi),s.slice(1).map(x=>x.midi),tag);
        const top=nx[n-1];
        assert.equal(top.midi,s[0].midi+12,tag+' 1オクターブ 上');
        assert.equal(top.letter,s[0].letter,tag); assert.equal(top.acc,s[0].acc,tag);
      }
    });
  }
});

test('数字の しるし：いちばん下から 文字で 数えた へだたり',()=>{
  const EXP3=[[3,5],[3,6],[4,6]], EXP7=[[3,5,7],[3,5,6],[3,4,6],[2,4,6]];
  for(const key of KEYS) for(const ch of CHS){
    INV.shapes(key,ch).forEach((s,i)=>{
      const nums=INV.nums(s), exp=(ch==='V7'?EXP7:EXP3)[i];
      assert.deepEqual(nums,exp,kn(key)+' '+ch+' '+i);
      assert.deepEqual(INV.fig(ch,i).all,exp);
    });
  }
  assert.deepEqual([0,1,2].map(i=>INV.labelText('I',i)),['Ⅰ','Ⅰ6','Ⅰ6/4']);
  assert.deepEqual([0,1,2].map(i=>INV.labelText('IV',i)),['Ⅳ','Ⅳ6','Ⅳ6/4']);
  assert.deepEqual([0,1,2,3].map(i=>INV.labelText('V7',i)),['Ⅴ7','Ⅴ6/5','Ⅴ4/3','Ⅴ2']);
  assert.equal(INV.fig('I',2).alt,'46'); assert.equal(INV.fig('V7',1).alt,'65');
  // 書く 数は ぜんぶの 数の 中から
  for(const ch of CHS) for(let i=0;i<INV.CHORDS[ch].n;i++) INV.fig(ch,i).fig.forEach(x=>assert.ok(INV.fig(ch,i).all.includes(x)));
});

test('コードネーム（/ の 右が いちばん下）',()=>{
  const C=PA.majorKey(0), a=PA.minorKey(0);
  assert.deepEqual([0,1,2].map(i=>INV.symbol(C,'I',i)),['C','C/E','C/G']);
  assert.deepEqual([0,1,2,3].map(i=>INV.symbol(C,'V7',i)),['G7','G7/B','G7/D','G7/F']);
  assert.deepEqual([0,1,2].map(i=>INV.symbol(a,'IV',i)),['Dm','Dm/F','Dm/A']);
  assert.equal(INV.symbol(a,'V',1),'E/G♯');
  for(const key of KEYS) for(const ch of CHS) INV.shapes(key,ch).forEach((s,i)=>{
    const sym=INV.symbol(key,ch,i);
    if(i) assert.ok(sym.endsWith('/'+PA.LET_EN[s[0].letter]+PA.ACC[s[0].acc]),kn(key)+' '+ch+' '+sym);
  });
});

test('むずかしい 調の つづり（嬰ヘ・変ト・ロ・変ニ長調、嬰ニ・変ホ・嬰ト短調）',()=>{
  const name=ns=>ns.map(n=>PA.LET_EN[n.letter]+PA.ACC[n.acc]).join(' ');
  const maj=i=>PA.majorKey(i,60), min=i=>PA.minorKey(i,60);
  const byKey=(minor,l,a)=>{const list=minor?PA.MINOR_KEYS:PA.MAJOR_KEYS;const i=list.findIndex(x=>x[0]===l&&x[1]===a);assert.ok(i>=0);return minor?min(i):maj(i);};
  assert.equal(name(INV.tones(byKey(false,3,1),'I')),'F♯ A♯ C♯');
  assert.equal(name(INV.tones(byKey(false,4,-1),'IV')),'C♭ E♭ G♭');
  assert.equal(name(INV.tones(byKey(true,1,1),'V7')),'A♯ C𝄪 E♯ G♯');
  assert.equal(name(INV.tones(byKey(true,2,-1),'V')),'B♭ D F');
  assert.equal(name(INV.tones(byKey(false,6,0),'V7')),'F♯ A♯ C♯ E');
  assert.equal(name(INV.tones(byKey(false,1,-1),'IV')),'G♭ B♭ D♭');
  assert.equal(name(INV.tones(byKey(true,4,1),'V')),'D♯ F𝄪 A♯');
  assert.equal(name(INV.shape(byKey(true,1,1),'V',1)),'C𝄪 E♯ A♯');
});

test('なぜ かたちを かえるの？：かえると 手が ほとんど 動かない（24調）',()=>{
  for(const key of KEYS){
    const inv=INV.cadence(key,'inv'), root=INV.cadence(key,'root'), tag=kn(key);
    assert.deepEqual(inv.map(c=>c.ch),['I','IV','V7','I']);
    assert.deepEqual(inv.map(c=>c.bass),[0,2,1,0],tag+' Ⅰ → Ⅳ6/4 → Ⅴ6/5 → Ⅰ');
    assert.deepEqual(inv.map(c=>INV.labelText(c.ch,c.bass)),['Ⅰ','Ⅳ6/4','Ⅴ6/5','Ⅰ']);
    assert.deepEqual(root.map(c=>c.bass),[0,0,0,0],tag);
    // 和音の 音だけを つかう
    for(const seq of [inv,root]) seq.forEach(c=>{
      const ok=new Set(INV.tones(key,c.ch).map(pc));
      c.rh.forEach(n=>{assert.ok(ok.has(pc(n)),tag+' '+c.ch);assert.equal(PA.mod(n.midi,12),pc(n),tag);});
      for(let j=1;j<c.rh.length;j++) assert.ok(c.rh[j].midi>c.rh[j-1].midi,tag);
    });
    // かえる ほうは、のこらない 音も となりの 音へ（文字で 1つ）
    for(let i=1;i<inv.length;i++) inv[i].rh.forEach((n,j)=>{
      const d=Math.abs(PA.stepOf(n)-PA.stepOf(inv[i-1].rh[j]));
      assert.ok(d<=1,tag+' '+i+' '+j);
    });
    const a=INV.handStats(inv), b=INV.handStats(root);
    assert.equal(a.kept,3,tag+' そのまま のこる 音');
    assert.ok(b.kept<a.kept,tag);
    const moves=s=>s.thumb.slice(1).reduce((t,n,i)=>t+Math.abs(PA.stepOf(n)-PA.stepOf(s.thumb[i])),0);
    assert.equal(moves(a),2,tag+' 親指は となりへ 2回だけ');
    assert.ok(moves(b)>moves(a),tag);
  }
});
