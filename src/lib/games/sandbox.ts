export const HOSTED_GAME_SANDBOX = "allow-scripts allow-pointer-lock";
export const EXTERNAL_GAME_SANDBOX = "allow-scripts allow-same-origin allow-pointer-lock allow-forms";

export const HOSTED_GAME_CSP = [
  `sandbox ${HOSTED_GAME_SANDBOX}`,
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' data: blob:",
  "form-action 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

const STORAGE_SHIM = `<script>(function(){function S(){var m=new Map();return{get length(){return m.size},key:function(i){return Array.from(m.keys())[i]??null},getItem:function(k){return m.has(String(k))?m.get(String(k)):null},setItem:function(k,v){m.set(String(k),String(v))},removeItem:function(k){m.delete(String(k))},clear:function(){m.clear()}}}["localStorage","sessionStorage"].forEach(function(n){try{Object.defineProperty(window,n,{value:S()})}catch(e){}})})();</script>`;

export function injectStorageShim(html: string): string {
  const head = html.match(/<head[^>]*>/i);
  if (head?.index !== undefined) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + STORAGE_SHIM + html.slice(at);
  }
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  const at = doctype ? doctype[0].length : 0;
  return html.slice(0, at) + STORAGE_SHIM + html.slice(at);
}
