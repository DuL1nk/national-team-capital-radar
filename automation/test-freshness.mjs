import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {refreshDecision} from './freshness.mjs';
const body='<html>verified fixture</html>',hash=createHash('sha256').update(body).digest('hex'),date='2026-11-17',current={mode:'model_free_cloud',report_date:date,artifact_sha256:hash};
let checks=0;
async function test(name,{status=current,statusCode=200,page=body,pageCode=200,eventName='schedule',reject=false,badJson=false},expected,reason){
 let calls=0;const fetchImpl=async()=>{calls++;if(reject)throw Error('Network');return calls===1?new Response(badJson?'invalid':JSON.stringify(status),{status:statusCode}):new Response(page,{status:pageCode});};
 const result=await refreshDecision({eventName,reportDate:date,fetchImpl});
 assert.equal(result.run,expected,name);assert.equal(result.reason,reason,name);if(eventName!=='schedule')assert.equal(calls,0);checks++;
}
await test('verified current report skips',{},false,'today-anonymously-verified');
await test('stale date refreshes',{status:{...current,report_date:'2026-11-16'}},true,'public-report-stale-or-other-mode');
await test('unexpected future date refreshes',{status:{...current,report_date:'2026-11-18'}},true,'public-report-stale-or-other-mode');
await test('other mode refreshes',{status:{...current,mode:'local'}},true,'public-report-stale-or-other-mode');
await test('missing hash is not success',{status:{...current,artifact_sha256:null}},true,'public-freshness-unverified');
await test('mismatching homepage refreshes',{page:'old cached bytes'},true,'public-homepage-hash-mismatch');
await test('status error refreshes',{statusCode:503},true,'public-freshness-unverified');
await test('homepage error refreshes',{pageCode:404},true,'public-freshness-unverified');
await test('network failure refreshes',{reject:true},true,'public-freshness-unverified');
await test('malformed status refreshes',{badJson:true},true,'public-freshness-unverified');
await test('manual always performs actual collection',{eventName:'workflow_dispatch'},true,'manual-current-collection');
console.log(JSON.stringify({status:'passed',checks,networkUsed:false}));
