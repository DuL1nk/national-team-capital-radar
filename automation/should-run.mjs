import {fs,dateCN} from './lib.mjs';
import {refreshDecision} from './freshness.mjs';
const result=await refreshDecision({eventName:process.env.GITHUB_EVENT_NAME,reportDate:dateCN()});
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'run='+result.run+'\n');
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n## Publication freshness\n\n'+JSON.stringify(result)+'\n');
console.log(JSON.stringify(result));
console.log(result.run?'Run full current collection.':'Today already published with matching anonymous SHA; no duplicate refresh.');
