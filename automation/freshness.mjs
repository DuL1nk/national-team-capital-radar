import {createHash} from 'node:crypto';

// Failure to prove a current publication is never success. The full pipeline
// retains the separate source, date, corporate-action and calculation gates.
export async function refreshDecision({eventName,reportDate,fetchImpl=fetch,base='https://dul1nk.github.io/national-team-capital-radar/',checkDisclosures=false,now=new Date()}){
 if(eventName!=='schedule')return {run:true,reason:'manual-current-collection'};
 try{
  const suffix='?check='+Date.now(),r=await fetchImpl(base+'site-status.json'+suffix,{signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Status HTTP '+r.status);
  const s=await r.json();
  if(s.mode!=='model_free_cloud'||s.report_date!==reportDate)return {run:true,reason:'public-report-stale-or-other-mode'};
  if(!/^[a-f0-9]{64}$/.test(s.artifact_sha256||''))throw Error('Missing valid public SHA-256');
  const page=await fetchImpl(base+suffix,{signal:AbortSignal.timeout(30000)});
  if(!page.ok)throw Error('Homepage HTTP '+page.status);
  const hash=createHash('sha256').update(Buffer.from(await page.arrayBuffer())).digest('hex');
  if(hash!==s.artifact_sha256)return {run:true,reason:'public-homepage-hash-mismatch'};
  if(checkDisclosures){
   const checked=Date.parse(s.disclosure_checked_at||''),age=now.getTime()-checked;
   if(!Number.isFinite(checked)||age>=3600000||age< -300000)return {run:true,mode:'disclosures',reason:'disclosure-check-due',reportDate:s.report_date,disclosureStatus:s.disclosure_status||'not_checked'};
   if(s.disclosure_status==='partial')return {run:false,reason:'disclosure-check-partial-waiting-retry',reportDate:s.report_date,disclosureStatus:'partial'};
  }
  return {run:false,reason:'today-anonymously-verified',reportDate:s.report_date,sha256:hash};
 }catch{return {run:true,reason:'public-freshness-unverified'};}
}
