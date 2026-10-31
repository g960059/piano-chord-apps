#!/usr/bin/env node
// 名曲で楽曲分析のデータ（assets/pieces/<id>.json）を、楽譜の音とならべて見る道具（開発のときだけ。アプリには入らない）
//   node tools/piece-check.mjs k545-1                 … 楽譜の音のデータをネットからとってきてならべる
//   node tools/piece-check.mjs k545-1 --notes <file>  … 手もとの notes.tsv をつかう
// ・楽譜の音は DCML の notes.tsv（CC BY-NC-SA。答え合わせに見るだけ。アプリにも git にも入れない）。
//   音の高さ（name）と、いつ鳴るか（quarterbeats・duration_qb）だけをつかい、DCML の和音記号は読まない
// ・和音ごとに、はじめに鳴っている音（いちばん下・上）と、和音のあいだに出てくる音をならべる。
//   bass・sop がちがえば「!!」、アルベルティ・バスのように1拍前までの左手の音がいちばん下なら「~」
//   和音の外の音（音階・トリルなど）は「外：」に出す（まちがいではない。人が目で見てたしかめる）
// ・本物の楽譜（pc.score）の音も、楽譜の音のデータと1音ずつくらべる（高さ・はじまり・長さ・右手か左手か）
// ・さいごに PA.piece.validate（和音の音・転回形・骨組み）のけっか
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPA} from '../test/_load.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const id=args.find(a=>!a.startsWith('--'))||'k545-1';
const ni=args.indexOf('--notes');
// 曲ごとの、答え合わせにつかう楽譜の音のデータ
const SOURCES={'k545-1':'https://raw.githubusercontent.com/DCMLab/mozart_piano_sonatas/HEAD/notes/K545-1.notes.tsv'};

const PA=loadPA(fs.readFileSync(path.join(ROOT,'assets','core.js'),'utf8')+'\n'+fs.readFileSync(path.join(ROOT,'assets','piece.js'),'utf8'));
const pc=JSON.parse(fs.readFileSync(path.join(ROOT,'assets','pieces',id+'.json'),'utf8'));
const tsv=ni>=0?fs.readFileSync(args[ni+1],'utf8'):await (async()=>{
  const u=SOURCES[id]; if(!u) throw new Error(id+'：楽譜の音のデータがない（--notes でわたす）');
  const r=await fetch(u); if(!r.ok) throw new Error('とってこられなかった：'+r.status); return r.text();
})();

// '3/2'・'0.5'・'12' → 数
const frac=s=>{const m=/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?$/.exec(String(s).trim());return m?+m[1]/(m[2]?+m[2]:1):NaN;};
const rows=tsv.trim().split('\n'), head=rows.shift().split('\t'), col=n=>head.indexOf(n);
const C={mn:col('mn'),qb:col('quarterbeats'),dur:col('duration_qb'),name:col('name'),staff:col('staff'),grace:col('gracenote')};
const notes=rows.map(r=>r.split('\t')).filter(c=>!(C.grace>=0&&c[C.grace])).map(c=>{
  const n=PA.piece.note(c[C.name].replace('♯','#'));
  return {mn:+c[C.mn],t:frac(c[C.qb]),d:frac(c[C.dur]),name:c[C.name],n,lh:c[C.staff]==='2'};
}).filter(x=>x.n&&isFinite(x.t)&&isFinite(x.d));

const beats=pc.meter[0]*4/pc.meter[1];
const nm=n=>PA.LET_EN[n.letter]+({'-2':'bb','-1':'b','0':'','1':'#','2':'##'})[n.acc]+(Math.floor((n.midi-n.acc)/12)-1);
const lo=a=>a.reduce((x,y)=>y.n.midi<x.n.midi?y:x), hi=a=>a.reduce((x,y)=>y.n.midi>x.n.midi?y:x);
let bad=0;
console.log(`${pc.composer}「${pc.title}」${pc.movement}（${pc.key}）`);
for(const ev of pc.events){
  // 弱起のない曲：小節 m の1拍め＝(m-1)×拍。弱起のある曲は quarterbeats がずれるので、ここをなおす
  const t0=(ev.m-1)*beats+ev.beat-1, t1=t0+ev.dur;
  const at=notes.filter(x=>x.t<=t0+1e-9&&x.t+x.d>t0+1e-9);
  const inside=notes.filter(x=>x.t<t1-1e-9&&x.t+x.d>t0+1e-9);
  const k=PA.piece.key(ev.key), T=PA.piece.tones(k,ev.rn);
  const bass=PA.piece.note(ev.bass), sop=PA.piece.note(ev.sop);
  let mark=' ';
  const L=at.length?lo(at):null, H=at.length?hi(at):null;
  let bOk=L&&L.n.midi===bass.midi;
  if(!bOk){ // アルベルティ・バス：1拍前からの左手のいちばん下
    const back=notes.filter(x=>x.lh&&x.t>=t0-1-1e-9&&x.t<=t0+1e-9);
    if(back.length&&lo(back).n.midi===bass.midi){bOk=true;mark='~';}
  }
  const sOk=H&&H.n.midi===sop.midi;
  if(!bOk||!sOk){mark='!!';bad++;}
  const out=[...new Set(inside.filter(x=>!T.some(t=>PA.piece.same(t,x.n))).map(x=>nm(x.n)))];
  console.log(`${mark.padEnd(2)} ${String(ev.m).padStart(2)}小節${String(ev.beat).padEnd(3)} ${PA.rnText(ev.rn).padEnd(10)} bass ${ev.bass.padEnd(4)}（楽譜 ${L?nm(L.n):'-'}） sop ${ev.sop.padEnd(4)}（楽譜 ${H?nm(H.n):'-'}）`
    +`  楽譜の音：${[...new Set(inside.map(x=>nm(x.n)))].join(' ')}${out.length?'  外：'+out.join(' '):''}`);
}
// 本物の楽譜（pc.score）の音を、楽譜の音のデータと1音ずつくらべる（高さ・はじまり・長さ。つづりも）
const ex=pc.excerpts[0], key3=x=>`${x.at}|${x.len}|${x.name}`;
const ours=[];
PA.piece.score(pc).forEach(x=>[['rh',x.rh],['lh',x.lh]].forEach(([h,st])=>st.notes.forEach(n=>n.keys.forEach(k=>
  ours.push({m:x.m,at:(x.m-1)*beats+n.t-1,len:n.len,name:k.name,h})))));
const theirs=notes.filter(x=>x.mn>=ex.from&&x.mn<=ex.to).map(x=>({m:x.mn,at:x.t,len:x.d,name:x.name.replace('♯','#').replace('♭','b'),h:x.lh?'lh':'rh'}));
const cnt=a=>{const m=new Map();a.forEach(x=>{const k=key3(x)+'|'+x.h;m.set(k,(m.get(k)||0)+1);});return m;};
const A=cnt(ours), B=cnt(theirs), diff=[];
new Set([...A.keys(),...B.keys()]).forEach(k=>{if((A.get(k)||0)!==(B.get(k)||0)) diff.push(`${k}：アプリ ${A.get(k)||0}・楽譜 ${B.get(k)||0}`);});
console.log(`本物の楽譜：アプリ ${ours.length}音・楽譜のデータ ${theirs.length}音（${ex.from}〜${ex.to}小節）`+(diff.length?'\n!! ちがう所：\n  '+diff.sort().join('\n  '):'。高さ・はじまり・長さ・右手か左手か、ぜんぶおなじ'));
if(diff.length) bad++;
const err=PA.piece.validate(pc);
console.log(err.length?'validate：\n  '+err.join('\n  '):'validate：OK');
console.log(bad?`!! ${bad}か所、bass・sop が楽譜とちがう`:'bass・sop：ぜんぶ楽譜とおなじ');
process.exit(bad||err.length?1:0);
