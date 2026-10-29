// core.js を ブラウザなしで 読みこむ（node --test 用の 最小の スタブ）
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function loadPA(source){
  const dir=path.dirname(fileURLToPath(import.meta.url));
  const src=source??fs.readFileSync(path.join(dir,'..','assets','core.js'),'utf8');
  const noop=()=>{};
  const ctx={
    console,
    document:{documentElement:{},addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,hidden:false,body:{}},
    localStorage:{getItem:()=>null,setItem:noop},
    navigator:{},
    matchMedia:()=>({matches:false}),
    CSS:{escape:s=>String(s)},
    location:{href:''},
    setTimeout,
  };
  ctx.window=ctx;
  ctx.addEventListener=noop;
  vm.createContext(ctx);
  vm.runInContext(src,ctx,{filename:'core.js'});
  return ctx.PA;
}
