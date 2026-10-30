// 音の聴き比べ（試作）lab/sampler.js の、ブラウザなしで動く部分のテスト：node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import '../lab/sampler.js'; // export のないファイルを import すると globalThis.SoundLab ができる

const L=globalThis.SoundLab;
const SR=44100;
// f Hz の音（倍音つき・すこしずつ小さくなる）を、頭に pad 秒の無音をつけて作る
const tone=(f,sec,pad=0,inharm=0)=>{
  const n=Math.round(SR*(sec+pad)),x=new Float32Array(n),p0=Math.round(SR*pad);
  for(let i=p0;i<n;i++){
    const t=(i-p0)/SR;let v=0;
    for(let h=1;h<=6&&f*h<SR/2.2;h++) v+=Math.sin(2*Math.PI*f*h*Math.sqrt(1+inharm*h*h)*t)/h;
    x[i]=v*0.3*Math.exp(-t*1.5);
  }
  return x;
};

test('noteName：60 は C4、21 は A0、108 は C8',()=>{
  assert.equal(L.noteName(60),'C4');assert.equal(L.noteName(21),'A0');assert.equal(L.noteName(108),'C8');assert.equal(L.noteName(61),'C#4');
});

test('Salamander は A0〜C8 の3半音おき（30こ）で、ファイル名は Tone.js の書きかた',()=>{
  const s=L.SOURCES.find(x=>x.id==='salamander').samples;
  assert.equal(s.length,30);
  assert.deepEqual(s.slice(0,4).map(x=>x.file),['A0.mp3','C1.mp3','Ds1.mp3','Fs1.mp3']);
  assert.deepEqual(s.at(-1),{midi:108,file:'C8.mp3'});
  s.forEach((x,i)=>{if(i) assert.equal(x.midi-s[i-1].midi,3);});
});

test('Splendid のファイル名は # や空白をエンコードする',()=>{
  const s=L.SOURCES.find(x=>x.id==='splendid').samples;
  assert.equal(s.find(x=>x.midi===60).file,'MF%20C3.m4a');
  assert.equal(s.find(x=>x.midi===80).file,'Mf%20G%234.m4a');
  s.forEach((x,i)=>{if(i) assert.ok(x.midi>s[i-1].midi,'midi が小さいじゅん');});
});

test('nearest：いちばん近いサンプル。同じ近さなら下',()=>{
  const list=[{midi:57},{midi:60},{midi:63}];
  assert.equal(L.nearest(list,61).midi,60);
  assert.equal(L.nearest(list,62).midi,63);
  assert.equal(L.nearest(list,58).midi,57);
  assert.equal(L.nearest([{midi:57},{midi:59}],58).midi,57);
  assert.equal(L.nearest(list,20).midi,57);
});

test('rate：半音の数・高さのずれ・基準ピッチを再生速度にする',()=>{
  assert.equal(L.rate(60,60,0,440),1);
  assert.ok(Math.abs(L.rate(62,60,0,440)-Math.pow(2,2/12))<1e-12);
  assert.ok(Math.abs(L.rate(60,60,0,442)-442/440)<1e-12);
  // 録音が +10セント高いなら、10セント下げる
  assert.ok(Math.abs(L.rate(60,60,10,440)-Math.pow(2,-10/1200))<1e-12);
});

test('onsetIndex：頭の無音をはかる',()=>{
  const x=tone(261.63,0.5,0.05);
  const i=L.onsetIndex(x,0.02);
  assert.ok(Math.abs(i-Math.round(SR*0.05))<=3,String(i));
});

test('detectPitch：低い音から高い音まで、ずれを1セントくらいではかれる',()=>{
  for(const [m,c] of [[21,0],[33,7],[45,-12],[60,5],[69,0],[81,-3],[96,9],[108,-6]]){
    const exp=L.hz(m,440), f=exp*Math.pow(2,c/1200);
    const x=tone(f,0.6);
    const p=L.detectPitch(x,SR,exp,Math.round(SR*0.05));
    assert.ok(p,'はかれた '+m);
    assert.ok(Math.abs(p.cents-c)<1.5,`${L.noteName(m)}：${p.cents.toFixed(2)} のはずが ${c}`);
  }
});

test('detectPitch：オクターブちがい（2倍音）にまちがえない',()=>{
  const exp=L.hz(48,440);
  const x=tone(exp,0.6);
  const p=L.detectPitch(x,SR,exp,2000);
  assert.ok(Math.abs(p.cents)<2,String(p.cents));
});

test('tuning：全体のずれはまんなかの中央値。たしかでない音はとなりのたしかな音のずれを使う',()=>{
  const list=[
    {midi:21,cents:60,clarity:0.6},   // たしかでない（低い）
    {midi:48,cents:8,clarity:0.98},
    {midi:60,cents:10,clarity:1},
    {midi:72,cents:9,clarity:1},
    {midi:84,cents:12,clarity:0.97},
    {midi:105,cents:130,clarity:0.95}, // 全体から40セントより大きくはなれている
  ];
  assert.equal(L.tuning(list),10);
  assert.equal(list[0].sure,false);assert.equal(list[0].fixCents,8);
  assert.equal(list[2].sure,true);assert.equal(list[2].fixCents,10);
  assert.equal(list[5].sure,false);assert.equal(list[5].fixCents,12);
});
