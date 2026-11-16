import {fs,dateCN,sha} from './lib.mjs';
let run=true;
if(process.env.GITHUB_EVENT_NAME==='schedule')try{
 const base='https://dul1nk.github.io/national-team-capital-radar/',suffix='?check='+Date.now(),r=await fetch(base+'site-status.json'+suffix,{signal:AbortSignal.timeout(20000)}),s=await r.json();
 if(s.mode==='model_free_cloud'&&s.report_date===dateCN()){
  const page=await fetch(base+suffix,{signal:AbortSignal.timeout(30000)}),bytes=Buffer.from(await page.arrayBuffer());
  if(page.ok&&sha(bytes)===s.artifact_sha256)run=false;
 }
}catch{console.log('Public freshness could not be verified; perform the full guarded run.');}
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'run='+run+'\n');
console.log(run?'Run full current collection.':'Today already published with matching anonymous SHA; no duplicate refresh.');
