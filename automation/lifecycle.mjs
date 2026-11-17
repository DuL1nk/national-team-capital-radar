import fs from 'node:fs';import assert from 'node:assert/strict';
export const reviewedLifecycle=JSON.parse(fs.readFileSync(new URL('./lifecycle.json',import.meta.url),'utf8'));
for(const [code,e]of Object.entries(reviewedLifecycle)){assert(/^\d{6}$/.test(code));assert.equal(e.type,'liquidation');assert(/^\d{4}-\d\d-\d\d$/.test(e.inactiveFrom));assert(e.lastFlowDate<e.inactiveFrom);assert(e.source.startsWith('https://www.sse.com.cn/'));assert(/^[a-f0-9]{64}$/.test(e.sourceSha256));}
export const isActive=(product,date)=>date>=(product.mappingEffectiveDate||product.effectiveDate||product.listingDate)&&(!product.inactiveFrom||date<product.inactiveFrom);
export const attachLifecycle=p=>reviewedLifecycle[p.code]?{...p,inactiveFrom:reviewedLifecycle[p.code].inactiveFrom,lifecycle:reviewedLifecycle[p.code]}:p;
