// Explicit synthetic fixture only. Never a public observation or deploy input.
import path from 'node:path';
import {attachLifecycle,isActive} from './lifecycle.mjs';
import {spawnSync} from 'node:child_process';
import {fs,load,put,read,assert,addDay} from './lib.mjs';
const S=load(),oldEnd=S.fundAsOf,prior=structuredClone(S.D.productHistory);let next=addDay(oldEnd,1);
while([0,6].includes(new Date(next+'T00:00:00Z').getUTCDay()))next=addDay(next,1);
S.syntheticTest=true;S.fundAsOf=next;S.reportDate=addDay(next,1);S.newDates=[...prior.dates.slice(-2),next];
for(const p0 of S.D.snapshots[oldEnd].products){const p=attachLifecycle(p0);if(!isActive(p,next))continue;S.shares[p.code][next]=S.shares[p.code][oldEnd];const n=S.nav[p.code].find(x=>x.date===oldEnd);assert(n);S.nav[p.code].push({...n,date:next,event:''});const m=S.market[p.code].find(x=>x[0]===oldEnd);if(m)S.market[p.code].push([next,...m.slice(1)]);}
for(const x of Object.values(S.D.indices))x.rows.push([next,x.rows.at(-1)[1]]);
fs.mkdirSync('build',{recursive:true});const temp=fs.mkdtempSync('build/synthetic-increment-');put(temp+'/build/collected.json',S);
const r=spawnSync(process.execPath,[path.resolve('automation/compile.mjs')],{cwd:path.resolve(temp),encoding:'utf8'});assert.equal(r.status,0,r.stderr);
const out=read(temp+'/build/reviewed.json');assert.equal(out.quality.calendar[1],next);assert.equal(out.productHistory.dates.length,prior.dates.length+1);for(const [code,h]of Object.entries(prior.products)){assert.deepEqual(out.productHistory.products[code].flows.slice(0,h.flows.length),h.flows);assert.equal(out.productHistory.products[code].flows.at(-1),isActive({...h,...attachLifecycle({code,...h})},next)?0:null);}
for(const p of Object.values(out.snapshots[next].pools)){assert.equal(p.flow,0);assert.equal(p.n,p.e);}
assert.equal(out.ratio252.rows.at(-1).ratioPct,null);assert.equal(out.ratio252.ratioAsOf,S.D.ratio252.ratioAsOf);
console.log('Synthetic next-trade-day increment passed: preserved all real history, active flat-share flows=0, reviewed inactive flows=null, unpublished denominator=null. No fixture is published.');
