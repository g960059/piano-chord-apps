/* オフラインでもひらけるように（サービスワーカー）
   ・ページ（HTML）はネットがさき。3びょうまってもこなければ保存してあるページを出す
     → 古いページにとじこめない。?key=… つきのしゅくだいリンクも同じページとして出す
   ・js・css もネットがさき（3びょうで保存ぶん）。新しいページと古い core.js がまざって
     うごかなくなるのをふせぐ
   ・画像などは保存してあるものをすぐ出して、うらで新しくしておく
   ・インストールでとれなかったファイルは前の保存ぶんからうつす（オフラインでこわれないように）
   ・VERSION と PRECACHE は tools/build-meta.mjs が書きかえる（手でなおさない） */
const VERSION='664a33730b';
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
const CODE_RE=/\.(?:js|css|json|webmanifest)$/i; // ページといっしょに新しくならないとこまるもの

/* リダイレクトされたレスポンスはそのままページにつかえないので、中身だけうつす */
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

/* とれなかったときは前のバージョンの保存ぶん（まだけしていない）をあたらしい保存場所へうつす */
function copyOld(c,url){
  return caches.match(url,{ignoreSearch:true}).then(old=>old?c.put(url,old):undefined).catch(()=>{});
}

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(PRECACHE.map(p=>{
    const url=new URL(p,self.registration.scope).href;
    // 1つだめでもほかは保存する
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

/* ページの保存ぶんをさがす。/chord-build ⇔ /chord-build.html、/ ⇔ /index.html のどちらでも見つける */
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

/* waitUntil はその場でよぶ（あとからよぶとうごかないブラウザがある） */
function fetchAndKeep(e,key){
  let saving=null;
  const net=fetch(e.request).then(res=>{
    if(okToKeep(res)) saving=put(key,res.clone());
    return res;
  });
  e.waitUntil(net.then(()=>saving).catch(()=>{})); // まにあわなくても、とどいたら保存しておく
  return net;
}

function onPage(e){
  const req=e.request;
  const net=fetchAndKeep(e,noSearch(req.url));
  const timer=new Promise(resolve=>setTimeout(()=>resolve('late'),NAV_TIMEOUT));
  return Promise.race([net.catch(()=>null),timer]).then(r=>{
    if(r&&r!=='late') return r;
    return matchPage(req.url).then(hit=>hit||net); // 保存もないときはネットをまつ（だめならブラウザのエラー）
  });
}

/* js・css：ネットがさき。おそい・つながらないときだけ保存ぶん */
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
  if(url.origin!==self.location.origin) return; // よそ（ランキングのアプリなど）はさわらない
  if(url.pathname===new URL(self.registration.scope).pathname+'sw.js') return;
  const accept=req.headers.get('accept')||'';
  if(req.mode==='navigate'||req.destination==='document'||/\.html$/.test(url.pathname)||accept.indexOf('text/html')>=0){
    e.respondWith(onPage(e));
    return;
  }
  if(CODE_RE.test(url.pathname)) e.respondWith(onCode(e));
  else if(ASSET_RE.test(url.pathname)) e.respondWith(onAsset(e));
});
