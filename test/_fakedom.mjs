// VexFlow（SVG）を node で描くための、小さな DOM のかわり（テスト用）
//   fakeDocument() → {createElement, createElementNS}。要素は setAttribute・appendChild・removeChild・textContent・innerHTML（読むだけ）・outerHTML
//   style は書きこめるが、文字にはしない（ブラウザでも score.js が style をけす）
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
class El{
  constructor(tag,ns){this.tagName=tag;this.nodeName=tag.toUpperCase();this.namespaceURI=ns||null;this.attrs=new Map();this.childNodes=[];this.parentNode=null;this.style={};this._text='';}
  setAttribute(k,v){this.attrs.set(k,String(v));}
  setAttributeNS(ns,k,v){this.setAttribute(k,v);}
  getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}
  removeAttribute(k){this.attrs.delete(k);}
  hasAttribute(k){return this.attrs.has(k);}
  appendChild(c){if(c.parentNode) c.parentNode.removeChild(c);c.parentNode=this;this.childNodes.push(c);return c;}
  insertBefore(c,ref){if(!ref) return this.appendChild(c);if(c.parentNode) c.parentNode.removeChild(c);c.parentNode=this;this.childNodes.splice(this.childNodes.indexOf(ref),0,c);return c;}
  removeChild(c){const i=this.childNodes.indexOf(c);if(i>=0) this.childNodes.splice(i,1);c.parentNode=null;return c;}
  get children(){return this.childNodes;}
  get firstChild(){return this.childNodes[0]||null;}
  get lastChild(){return this.childNodes[this.childNodes.length-1]||null;}
  get textContent(){return this._text+this.childNodes.map(c=>c.textContent).join('');}
  set textContent(v){this.childNodes=[];this._text=String(v);}
  get classList(){const el=this;return {add(c){const s=new Set((el.getAttribute('class')||'').split(/\s+/).filter(Boolean));s.add(c);el.setAttribute('class',[...s].join(' '));}};}
  get innerHTML(){return esc(this._text).replace(/&quot;/g,'"')+this.childNodes.map(c=>c.outerHTML).join('');}
  get outerHTML(){
    const a=[...this.attrs].map(([k,v])=>` ${k}="${esc(v)}"`).join('');
    return `<${this.tagName}${a}>${this.innerHTML}</${this.tagName}>`;
  }
  getBBox(){return {x:0,y:0,width:6*this._text.length,height:10};}
}
export function fakeDocument(){
  return {
    createElement:t=>new El(String(t).toLowerCase()),
    createElementNS:(ns,t)=>new El(t,ns),
    getElementById:()=>null,
  };
}
