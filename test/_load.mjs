// core.js を ブラウザなしで 読みこむ（node --test 用の 最小の スタブ）
// loadPA(source?, {search:'?n=5', storage:Map}) … search＝location.search、storage＝localStorage の かわり（Map）
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function loadPA(source,opts={}){
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const src=source??fs.readFileSync(path.join(dir,'..','assets','core.js'),'utf8');
  const noop=()=>{};
  const mem=opts.storage||new Map();
  const ctx={
    console,
    document:{documentElement:{},addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,hidden:false,body:{}},
    localStorage:{
      getItem:k=>mem.has(k)?mem.get(k):null,
      setItem:(k,v)=>{mem.set(k,String(v));},
      removeItem:k=>{mem.delete(k);},
      key:i=>[...mem.keys()][i]??null,
      get length(){return mem.size;}
    },
    navigator:{},
    matchMedia:()=>({matches:false}),
    CSS:{escape:s=>String(s)},
    location:{href:opts.href||'https://example.test/apps/chord-quiz.html'+(opts.search||''),search:opts.search||'',protocol:'https:',origin:'https://example.test'},
    URL,
    setTimeout,
    clearTimeout,
  };
  ctx.window=ctx;
  ctx.addEventListener=noop;
  vm.createContext(ctx);
  vm.runInContext(src,ctx,{filename:'core.js'});
  return ctx.PA;
}
