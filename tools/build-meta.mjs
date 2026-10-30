#!/usr/bin/env node
// ページの<head>に説明・シェア用のタグ（og: など）・アイコンを入れ、sw.js の PRECACHE と VERSION を書きなおす
//   node tools/build-meta.mjs            … 書きかえる
//   node tools/build-meta.mjs --check    … 書きかえが要るなら一覧を出して exit 1（CI 用）
//   --root <dir>                        … ちがう場所（ためしのコピー）でうごかす
//   --sw-only                           … sw.js だけ（ページはさわらない）
// 何回うごかしても同じファイルになる（idempotent）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPA} from '../test/_load.mjs';

const TOOL_DIR=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const CHECK=args.includes('--check');
const SW_ONLY=args.includes('--sw-only');
const ri=args.indexOf('--root');
const ROOT=path.resolve(ri>=0?args[ri+1]:path.join(TOOL_DIR,'..'));

const SITE_URL='https://piano-chord-apps.g960059.workers.dev/';
const SITE_NAME='ピアノ和音アプリ';
const SITE_DESC='ピアノを習う人のための、和音を「見て・聴いて・さわって」おぼえる小さなアプリ集。Ⅰ・Ⅳ・Ⅴ7から短調・おわりかた・変化和音、伴奏づけ、聴きわけまで。';
const GENERIC_DESC='和音を見て・聴いて・さわっておぼえるピアノのアプリ。';
const OG_IMAGE=SITE_URL+'assets/og.png';
const START='<!-- meta:start -->', END='<!-- meta:end -->';

const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const unesc=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
const plain=s=>unesc(String(s||'').replace(/<span class="ds">x<\/span>/g,'ダブル♯').replace(/<[^>]*>/g,'')).replace(/\s+/g,' ').trim();

// ルートの *.html（名前のじゅん）
const pages=fs.readdirSync(ROOT).filter(f=>/\.html$/.test(f)&&fs.statSync(path.join(ROOT,f)).isFile()).sort();

// core.js の PA.APPS（なければ各ページの<title>から）
function loadApps(){
  try{
    const PA=loadPA(rd('assets/core.js'));
    let list=PA&&PA.APPS;
    if(!Array.isArray(list)||!list.length) return null;
    if(list.some(a=>a&&Array.isArray(a.apps))) list=list.flatMap(c=>(c&&c.apps)||[c]); // カテゴリの形でもよい
    const m=new Map();
    list.forEach(a=>{if(a&&a.id&&!a.href) m.set(a.id+'.html',a);});
    return m;
  }catch(err){
    console.warn('build-meta: core.js を読めなかったので<title>をつかいます:',err.message);
    return null;
  }
}
const APPS=SW_ONLY?null:loadApps();
if(!APPS&&!SW_ONLY) console.warn('build-meta: PA.APPS がないので<title>とふつうの説明をつかいます');

function metaFor(file,html){
  const tm=html.match(/<title>([\s\S]*?)<\/title>/i);
  const pageTitle=tm?plain(tm[1]):file.replace(/\.html$/,'');
  if(file==='index.html') return {title:SITE_NAME,desc:SITE_DESC,url:SITE_URL};
  const app=APPS&&APPS.get(file);
  const title=app&&app.title?plain(app.title):pageTitle;
  const desc=(app&&plain(app.d))||GENERIC_DESC;
  return {title:title+'｜'+SITE_NAME,desc,url:SITE_URL+file};
}

function block(m){
  return [START,
    `<meta name="description" content="${esc(m.desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.desc)}">`,
    `<meta property="og:url" content="${esc(m.url)}">`,
    `<meta property="og:image" content="${esc(OG_IMAGE)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(SITE_NAME)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="manifest" href="manifest.webmanifest">`,
    `<link rel="icon" href="favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="assets/icons/favicon-32.png" sizes="32x32">`,
    `<link rel="apple-touch-icon" href="assets/icons/icon-180.png">`,
    END].join('\n');
}

function withMeta(file,html){
  const b=block(metaFor(file,html));
  const s=html.indexOf(START), e=html.indexOf(END);
  if(s>=0&&e>s) return html.slice(0,s)+b+html.slice(e+END.length);
  const vm=html.match(/<meta\s+name=["']viewport["'][^>]*>[^\n]*\n?/i);
  if(!vm) throw new Error(file+': <meta name="viewport">がありません');
  const at=vm.index+vm[0].length, nl=vm[0].endsWith('\n')?'':'\n';
  return html.slice(0,at)+nl+b+'\n'+html.slice(at);
}

// ---- しごと ----
const out=new Map(); // file → 新しい中身
if(!SW_ONLY) pages.forEach(f=>{const h=rd(f), n=withMeta(f,h); if(n!==h) out.set(f,n);});
const now=f=>out.has(f)?out.get(f):fs.readFileSync(path.join(ROOT,f)); // 書きかえ後の中身でハッシュする

// sw.js：保存しておくファイルの一覧とバージョン
const iconDir='assets/icons';
const icons=fs.existsSync(path.join(ROOT,iconDir))?fs.readdirSync(path.join(ROOT,iconDir)).filter(f=>/\.(png|svg)$/.test(f)).sort().map(f=>iconDir+'/'+f):[];
const assets=fs.readdirSync(path.join(ROOT,'assets')).filter(f=>/\.(js|css)$/.test(f)).sort().map(f=>'assets/'+f); // core.js・app.css などぜんぶ
const files=[...pages,...assets,'manifest.webmanifest','favicon.svg',...icons].filter(f=>fs.existsSync(path.join(ROOT,f)));
const hash=crypto.createHash('sha256');
files.forEach(f=>{hash.update(f+'\0');hash.update(now(f));hash.update('\0');});
const VERSION=hash.digest('hex').slice(0,10);
const PRECACHE=['./',...files];
const swFile='sw.js';
if(fs.existsSync(path.join(ROOT,swFile))){
  const sw=rd(swFile);
  if(!/const VERSION='[^']*';/.test(sw)||!/const PRECACHE=\[[\s\S]*?\];/.test(sw)) throw new Error('sw.js に const VERSION / const PRECACHE が見つかりません');
  const n=sw.replace(/const VERSION='[^']*';/,()=>`const VERSION='${VERSION}';`)
    .replace(/const PRECACHE=\[[\s\S]*?\];/,()=>'const PRECACHE=[\n'+PRECACHE.map(f=>`  '${f}',`).join('\n')+'\n];');
  if(n!==sw) out.set(swFile,n);
}else console.warn('build-meta: sw.js がありません');

if(CHECK){
  if(out.size){
    console.error('build-meta: 書きかえが要るファイル（npm run build:meta をうごかしてコミット）:\n  '+[...out.keys()].join('\n  '));
    process.exit(1);
  }
  console.log(`build-meta: OK（${pages.length}ページ・sw ${VERSION}）`);
}else{
  out.forEach((c,f)=>fs.writeFileSync(path.join(ROOT,f),c));
  console.log(`build-meta: ${out.size}ファイルを書きかえ（${SW_ONLY?'sw.js だけ':pages.length+'ページ'}・sw ${VERSION}）`);
}
