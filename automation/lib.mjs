import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export {fs,assert};
export const read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
export const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v));};
export const load=()=>{const b=fs.readFileSync('automation/state/baseline.json.gz');assert.equal(sha(b),read('automation/state/manifest.json').baselineSha256,'Durable baseline SHA-256 mismatch');return JSON.parse(gunzipSync(b));};
export const save=s=>{const b=gzipSync(JSON.stringify(s),{level:9});put('automation/state/baseline.json.gz',b);const manifest=read('automation/state/manifest.json');put('automation/state/manifest.json',{...manifest,baselineSha256:sha(b),bytes:b.length,fundAsOf:s.fundAsOf,ratioAsOf:s.D.ratio252.ratioAsOf,updatedAt:new Date().toISOString()});};
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const audit=[];
export async function get(url,{referer='https://www.sse.com.cn/',...options}={}){
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{...options,headers:{'User-Agent':'Mozilla/5.0',Referer:referer,...options.headers},signal:AbortSignal.timeout(45000)});
   if([401,403,429,514].includes(r.status)){const e=Error('Access/rate response '+r.status+'; no bypass');e.noRetry=true;throw e;}
   if(!r.ok)throw Error('HTTP '+r.status);const raw=Buffer.from(await r.arrayBuffer());audit.push({url,retrievedAt:new Date().toISOString(),status:r.status,bytes:raw.length,sha256:sha(raw)});return raw;
  }catch(e){if(attempt===2||e.noRetry)throw Error(url.split('?')[0]+': '+e.message);await sleep(1200*(attempt+1));}
 }
}
export function mergeRows(old,rows,key,compare,label){const m=new Map(old.map(r=>[key(r),r]));for(const r of rows){const o=m.get(key(r));assert(!o||compare(o,r),label+' historical revision '+key(r)+'; manual evidence review required');m.set(key(r),r);}return[...m.values()].sort((a,b)=>key(a).localeCompare(key(b)));}
export const round=n=>Number.isFinite(n)?Number(n.toFixed(6)):null,sum=xs=>xs.reduce((s,v)=>s+(Number.isFinite(v)?v:0),0);
export const dateCN=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
export const addDay=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
