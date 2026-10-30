/* オフラインでも ひらけるように（サービスワーカー）
   ・ページ（HTML）は ネットが さき。3びょう まっても こなければ 保存して ある ページを 出す
     → 古い ページに とじこめない。?key=… つきの しゅくだいリンクも 同じ ページとして 出す
   ・js・css も ネットが さき（3びょうで 保存ぶん）。新しい ページと 古い core.js が まざって
     うごかなく なるのを ふせぐ
   ・画像などは 保存して ある ものを すぐ 出して、うらで 新しく しておく
   ・インストールで とれなかった ファイルは 前の 保存ぶんから うつす（オフラインで こわれないように）
   ・VERSION と PRECACHE は tools/build-meta.mjs が 書きかえる（手で なおさない） */
const VERSION='b5160013b9';
const PRECACHE=[
  './',
  'accompaniment.html',
  'aug6.html',
  'borrowed.html',
  'cadence.html',
  'chord-build.html',
  'chord-quiz.html',
  'chord-table.html',
  'chroma-quiz.html',
  'diatonic.html',
  'dim-halfdim.html',
  'doppel.html',
  'ear.html',
  'ending-quiz.html',
  'ending.html',
  'enharmonic.html',
  'index.html',
  'interval.html',
  'inversion.html',
  'minor-family.html',
  'minor-quiz.html',
  'minor-signature.html',
  'minor-why.html',
  'neapolitan.html',
  'secondary.html',
  'assets/app.css',
  'assets/core.js',
  'assets/ear-game.js',
  'assets/mic.js',
  'manifest.webmanifest',
  'favicon.svg',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-180.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
];
const PREFIX='pca-';
const CACHE=PREFIX+VERSION;
const NAV_TIMEOUT=3000;
const CODE_TIMEOUT=3000;
const ASSET_RE=/\.(?:js|css|png|svg|webmanifest|json|jpe?g|webp|ico|woff2?)$/i;
const CODE_RE=/\.(?:js|css|json|webmanifest)$/i; // ページと いっしょに 新しく ならないと こまる もの

/* リダイレクトされた レスポンスは そのまま ページに つかえないので、中身だけ うつす */
function clean(res){
  if(!res||!res.redirected) return Promise.resolve(res);
  return res.blob().then(b=>new Response(b,{status:res.status,statusText:res.statusText,headers:res.headers}));
}
function okToKeep(res){return !!res&&res.ok&&res.type==='basic';}
function noSearch(url){const u=new URL(url);u.search='';u.hash='';return u.href;}
function put(req,res){
  if(!okToKeep(res)) return Promise.resolve();
  return clean(res).then(r=>caches.open(CACHE).then(c=>c.put(req,r))).catch(()=>{});
}

/* とれなかった ときは 前の バージョンの 保存ぶん（まだ けしていない）を あたらしい 保存場所へ うつす */
function copyOld(c,url){
  return caches.match(url,{ignoreSearch:true}).then(old=>old?c.put(url,old):undefined).catch(()=>{});
}

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(PRECACHE.map(p=>{
    const url=new URL(p,self.registration.scope).href;
    // 1つ だめでも ほかは 保存する
    return fetch(new Request(url,{cache:'reload'})).then(res=>{
      if(!okToKeep(res)) return copyOld(c,url);
      return clean(res).then(r=>c.put(url,r));
    }).catch(()=>copyOld(c,url));
  }))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.indexOf(PREFIX)===0&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

/* ページの 保存ぶんを さがす。/chord-build ⇔ /chord-build.html、/ ⇔ /index.html の どちらでも 見つける */
function matchPage(url){
  const u=new URL(noSearch(url)), p=u.pathname, keys=[u.href];
  if(/\/$/.test(p)) keys.push(u.origin+p+'index.html');
  else if(/\/index\.html$/.test(p)) keys.push(u.origin+p.replace(/index\.html$/,''));
  else if(/\.html$/.test(p)) keys.push(u.origin+p.replace(/\.html$/,''));
  else if(!/\.[a-z0-9]+$/i.test(p)) keys.push(u.origin+p+'.html');
  return caches.open(CACHE).then(c=>{
    let i=0;
    const next=()=>i>=keys.length?Promise.resolve(undefined):c.match(keys[i++],{ignoreSearch:true}).then(r=>r||next());
    return next();
  });
}

/* waitUntil は その場で よぶ（あとから よぶと うごかない ブラウザが ある） */
function fetchAndKeep(e,key){
  let saving=null;
  const net=fetch(e.request).then(res=>{
    if(okToKeep(res)) saving=put(key,res.clone());
    return res;
  });
  e.waitUntil(net.then(()=>saving).catch(()=>{})); // まにあわなくても、とどいたら 保存しておく
  return net;
}

function onPage(e){
  const req=e.request;
  const net=fetchAndKeep(e,noSearch(req.url));
  const timer=new Promise(resolve=>setTimeout(()=>resolve('late'),NAV_TIMEOUT));
  return Promise.race([net.catch(()=>null),timer]).then(r=>{
    if(r&&r!=='late') return r;
    return matchPage(req.url).then(hit=>hit||net); // 保存も ないときは ネットを まつ（だめなら ブラウザの エラー）
  });
}

/* js・css：ネットが さき。おそい・つながらない ときだけ 保存ぶん */
function onCode(e){
  const req=e.request;
  const net=fetchAndKeep(e,req);
  const timer=new Promise(resolve=>setTimeout(()=>resolve('late'),CODE_TIMEOUT));
  return Promise.race([net.catch(()=>null),timer]).then(r=>{
    if(r&&r!=='late'&&r.ok) return r;
    return caches.open(CACHE).then(c=>c.match(req)).catch(()=>null).then(hit=>hit||net);
  });
}

function onAsset(e){
  const req=e.request;
  const hit=caches.open(CACHE).then(c=>c.match(req)).catch(()=>null);
  const net=fetchAndKeep(e,req);
  return hit.then(h=>h||net);
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return; // よそ（ランキングの アプリ など）は さわらない
  if(url.pathname===new URL(self.registration.scope).pathname+'sw.js') return;
  const accept=req.headers.get('accept')||'';
  if(req.mode==='navigate'||req.destination==='document'||/\.html$/.test(url.pathname)||accept.indexOf('text/html')>=0){
    e.respondWith(onPage(e));
    return;
  }
  if(CODE_RE.test(url.pathname)) e.respondWith(onCode(e));
  else if(ASSET_RE.test(url.pathname)) e.respondWith(onAsset(e));
});
