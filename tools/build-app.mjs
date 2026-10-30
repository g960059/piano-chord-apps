#!/usr/bin/env node
// iOS アプリ（Capacitor）に入れるファイルを native/www/ にあつめる
//   node tools/build-app.mjs            … native/www/ をつくりなおす（そのあと cd native && npx cap sync ios）
//   --out <dir>                        … ちがう場所に（テスト用）
// ・入れるのは「許可リスト」のものだけ：いちばん上の *.html・assets/ の中（og.png はのぞく）・favicon.svg
//   （src/・test/・docs/・migrations/・native/ などは入らない。サーバーのコードやきろくをアプリに入れない）
// ・sw.js・manifest.webmanifest は入れない（アプリはファイルを中にもっているので、オフラインのしくみはいらない）
// ・各ページの <script src="assets/core.js"></script> のすぐあとに <script src="assets/native.js"></script> を足す
//   （アプリだけのしくみ：きろくのひかえ・MIDI のはしわたし。ウェブのページはかわらない）
// 何回うごかしても同じファイルになる
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const oi=args.indexOf('--out');
const OUT=path.resolve(oi>=0?args[oi+1]:path.join(ROOT,'native','www'));

const CORE_TAG='<script src="assets/core.js"></script>';
const NATIVE_TAG='<script src="assets/native.js"></script>';
const SKIP_ASSETS=new Set(['og.png']); // シェア用の画像（ウェブのリンクの見た目だけ）

const pages=fs.readdirSync(ROOT).filter(f=>/\.html$/.test(f)&&fs.statSync(path.join(ROOT,f)).isFile()).sort();
if(!pages.includes('index.html')) throw new Error('build-app: index.html がない');

fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});

for(const f of pages){
  const html=fs.readFileSync(path.join(ROOT,f),'utf8');
  const n=html.split(CORE_TAG).length-1;
  if(n!==1) throw new Error(`build-app: ${f} に ${CORE_TAG} が ${n} こある（1こだけのはず）`);
  fs.writeFileSync(path.join(OUT,f),html.replace(CORE_TAG,CORE_TAG+NATIVE_TAG));
}
const copyDir=(from,to)=>{
  fs.mkdirSync(to,{recursive:true});
  for(const e of fs.readdirSync(from,{withFileTypes:true})){
    if(e.name.startsWith('.')) continue;
    if(from===path.join(ROOT,'assets')&&SKIP_ASSETS.has(e.name)) continue;
    const s=path.join(from,e.name), d=path.join(to,e.name);
    if(e.isDirectory()) copyDir(s,d); else if(e.isFile()) fs.copyFileSync(s,d);
  }
};
copyDir(path.join(ROOT,'assets'),path.join(OUT,'assets'));
fs.copyFileSync(path.join(ROOT,'favicon.svg'),path.join(OUT,'favicon.svg'));
if(!fs.existsSync(path.join(OUT,'assets','native.js'))) throw new Error('build-app: assets/native.js がない');

const count=d=>fs.readdirSync(d,{withFileTypes:true}).reduce((a,e)=>a+(e.isDirectory()?count(path.join(d,e.name)):1),0);
console.log(`build-app: ${pages.length} ページ、ぜんぶで ${count(OUT)} ファイルを ${path.relative(ROOT,OUT)}/ に入れました`);
