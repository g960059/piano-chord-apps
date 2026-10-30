/* オフラインでもひらけるように（サービスワーカー）
   ・ページ（HTML）はネットがさき。3びょうまってもこなければ保存してあるページを出す
     → 古いページにとじこめない。?key=… つきのしゅくだいリンクも同じページとして出す
   ・js・css もネットがさき（3びょうで保存ぶん）。新しいページと古い core.js がまざって
     うごかなくなるのをふせぐ
   ・画像などは保存してあるものをすぐ出して、うらで新しくしておく
   ・インストールでとれなかったファイルは前の保存ぶんからうつす（オフラインでこわれないように）
   ・ピアノの録音（assets/piano/）は、べつの保存場所（AUDIO_CACHE）にしまう。サイトを新しくしても、
     録音がかわっていなければ読みなおさない（毎回 1MB をダウンロードしないように）
   ・VERSION・PRECACHE・AUDIO_VERSION・AUDIO は tools/build-meta.mjs が書きかえる（手でなおさない） */
const AUDIO_VERSION='3fa6563a47';
const AUDIO=[
  'assets/piano/A0.mp3',
  'assets/piano/A1.mp3',
  'assets/piano/A2.mp3',
  'assets/piano/A3.mp3',
  'assets/piano/A4.mp3',
  'assets/piano/A5.mp3',
  'assets/piano/A6.mp3',
  'assets/piano/A7.mp3',
  'assets/piano/C1.mp3',
  'assets/piano/C2.mp3',
  'assets/piano/C3.mp3',
  'assets/piano/C4.mp3',
  'assets/piano/C5.mp3',
  'assets/piano/C6.mp3',
  'assets/piano/C7.mp3',
  'assets/piano/C8.mp3',
  'assets/piano/Ds1.mp3',
  'assets/piano/Ds2.mp3',
  'assets/piano/Ds3.mp3',
  'assets/piano/Ds4.mp3',
  'assets/piano/Ds5.mp3',
  'assets/piano/Ds6.mp3',
  'assets/piano/Ds7.mp3',
  'assets/piano/Fs1.mp3',
  'assets/piano/Fs2.mp3',
  'assets/piano/Fs3.mp3',
  'assets/piano/Fs4.mp3',
  'assets/piano/Fs5.mp3',
  'assets/piano/Fs6.mp3',
  'assets/piano/Fs7.mp3',
];
const VERSION='252a6412b6';
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
  'privacy.html',
  'secondary.html',
  'support.html',
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
const AUDIO_CACHE=PREFIX+'audio-'+AUDIO_VERSION;
const AUDIO_RE=/\/assets\/piano\/[^/]+\.mp3$/;
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

/* 録音：まだ保存していないものだけとってくる（1つだめでもほかは保存する。だめなものは、ページが読むときにまたとる） */
function fillAudio(){
  return caches.open(AUDIO_CACHE).then(c=>Promise.all(AUDIO.map(p=>{
    const url=new URL(p,self.registration.scope).href;
    return c.match(url).then(hit=>hit||fetch(new Request(url,{cache:'reload'})).then(res=>okToKeep(res)?c.put(url,res):undefined)).catch(()=>{});
  })));
}

self.addEventListener('install',e=>{
  e.waitUntil(Promise.all([caches.open(CACHE).then(c=>Promise.all(PRECACHE.map(p=>{
    const url=new URL(p,self.registration.scope).href;
    // 1つだめでもほかは保存する
    return fetch(new Request(url,{cache:'reload'})).then(res=>{
      if(!okToKeep(res)) return copyOld(c,url);
      return clean(res).then(r=>c.put(url,r));
    }).catch(()=>copyOld(c,url));
  }))),fillAudio()]).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.indexOf(PREFIX)===0&&k!==CACHE&&k!==AUDIO_CACHE).map(k=>caches.delete(k))))
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

/* 録音：保存してあればそれ（中身はかわらない）。なければネットからとって、録音の保存場所にしまう */
function onAudio(e){
  const req=e.request;
  let done;
  e.waitUntil(new Promise(r=>{done=r;})); // waitUntil はその場でよぶ。保存がおわったら done
  return caches.open(AUDIO_CACHE).then(c=>c.match(req).then(hit=>{
    if(hit){done();return hit;}
    // 古いHTTPキャッシュの録音を保存しないように、サーバーにたしかめてからとる
    return fetch(new Request(req.url,{cache:'no-cache'})).then(res=>{
      if(okToKeep(res)) c.put(req,res.clone()).catch(()=>{}).then(done); else done();
      return res;
    });
  })).catch(err=>{done();throw err;});
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
  if(AUDIO_RE.test(url.pathname)) e.respondWith(onAudio(e));
  else if(CODE_RE.test(url.pathname)) e.respondWith(onCode(e));
  else if(ASSET_RE.test(url.pathname)) e.respondWith(onAsset(e));
});
