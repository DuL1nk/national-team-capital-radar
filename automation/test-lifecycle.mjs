// Isolated synthetic control tests: never used as public observations.
import path from 'node:path';import{spawnSync}from'node:child_process';
import{fs,load,read,put,assert}from'./lib.mjs';import{attachLifecycle,isActive}from'./lifecycle.mjs';
const baseline=load(),old=structuredClone(baseline.D.productHistory),first='2026-11-16',second='2026-11-17';
function extend(S,d){const end=S.fundAsOf;S.syntheticTest=true;S.reportDate=d;S.fundAsOf=d;S.newDates=[...S.D.productHistory.dates.slice(-2),d];for(const p0 of S.D.snapshots[end].products){const p=attachLifecycle(p0);if(!isActive(p,d))continue;S.shares[p.code][d]=S.shares[p.code][end];const n=S.nav[p.code].find(x=>x.date===end);assert(n);S.nav[p.code].push({...n,date:d,event:''});const m=S.market[p.code].find(x=>x[0]===end);if(m)S.market[p.code].push([d,...m.slice(1)]);}for(const x of Object.values(S.D.indices))x.rows.push([d,x.rows.at(-1)[1]]);return S;}
function compile(S,success=true){const root=fs.mkdtempSync('build/lifecycle-fixture-');put(root+'/build/collected.json',S);const r=spawnSync(process.execPath,[path.resolve('automation/compile.mjs')],{cwd:path.resolve(root),encoding:'utf8',maxBuffer:1048576});if(success)assert.equal(r.status,0,r.stderr);else {assert.notEqual(r.status,0);assert(r.stderr.includes('Missing shares/same-day NAV'));return null;}return read(root+'/build/compiled_state.json');}
fs.mkdirSync('build',{recursive:true});
if(baseline.fundAsOf<first){const fixture=extend(structuredClone(baseline),first);fixture.shares['530080'][first]=0; // Hypothetical deletion must NOT create redemption.
 const good=compile(fixture),D=good.D,h=D.productHistory.products['530080'];assert.equal(h.inactiveFrom,first);assert.equal(h.flows.at(-1),null);assert.equal(D.snapshots[first].pools.broad.n,315);assert.equal(D.snapshots[first].pools.broad.e,315);assert.equal(D.snapshots[first].pools.broad.count,315);assert.equal(D.quality.broad,315);assert.equal(D.quality.products,370);assert.equal(D.quality.historyProducts,371);
 for(const [code,history]of Object.entries(old.products))assert.deepEqual(D.productHistory.products[code].flows.slice(0,history.flows.length),history.flows);
 const next=compile(extend(good,second));assert.equal(next.D.productHistory.products['530080'].flows.at(-1),null);assert.equal(next.D.snapshots[second].pools.broad.e,315);
 const bad=structuredClone(fixture);bad.nav['510300']=bad.nav['510300'].filter(x=>x.date!==first);compile(bad,false);
 console.log('Lifecycle regression passed: prior history preserved, liquidation stays null even if residual shares disappear, counts=315/370, next-day continuation works, unrelated NAV gap still blocks.');
}else{
 const h=baseline.D.productHistory.products['530080'];assert.equal(h.inactiveFrom,first);for(let i=0;i<baseline.D.productHistory.dates.length;i++)if(baseline.D.productHistory.dates[i]>=first)assert.equal(h.flows[i-h.start],null);assert(!isActive(attachLifecycle({code:'530080',effectiveDate:'2025-01-23'}),second));console.log('Persisted lifecycle boundary checked.');
}
