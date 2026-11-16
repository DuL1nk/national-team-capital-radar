import {fs,read,assert,sha,sleep,put} from './lib.mjs';
const base='https://dul1nk.github.io/national-team-capital-radar/',local=read('site-status.json'),study=read('four-study-status.json'),names=fs.readdirSync('.').filter(n=>n==='index.html'||/^(?:national_team_capital_monitor_\d{4}-\d\d-\d\d|hs300_four_etf_backtest(?:_\d{4}-\d\d-\d\d)?)\.html$/.test(n));
let lastError;for(let attempt=0;attempt<12;attempt++)try{
 const nonce='?verify='+Date.now(),status=await(await fetch(base+'site-status.json'+nonce,{signal:AbortSignal.timeout(30000)})).json();assert.equal(status.report_date,local.report_date);assert.equal(status.artifact_sha256,local.artifact_sha256);assert.equal(status.fund_as_of,local.fund_as_of);assert.equal(status.ratio_as_of,local.ratio_as_of);
 const result=[];for(const name of names){const r=await fetch(base+(name==='index.html'?'':name)+nonce,{signal:AbortSignal.timeout(45000)});assert(r.ok);const b=Buffer.from(await r.arrayBuffer());assert.equal(sha(b),sha(fs.readFileSync(name)),'Anonymous artifact mismatch '+name);result.push({path:name,sha256:sha(b)});}
 const sr=await(await fetch(base+'four-study-status.json'+nonce,{signal:AbortSignal.timeout(30000)})).json();assert.equal(sr.artifact_sha256,study.artifact_sha256);
 put('build/public-verification.json',{status:'passed',url:base,checkedAt:new Date().toISOString(),reportDate:local.report_date,fundAsOf:local.fund_as_of,ratioAsOf:local.ratio_as_of,files:result});console.log('Anonymous date and SHA-256 verification passed: '+base);process.exit(0);
 }catch(e){lastError=e;console.log('Awaiting deployed bytes ('+(attempt+1)+'): '+e.message);await sleep(15000);}
throw lastError;
