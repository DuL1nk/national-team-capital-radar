import {fs,dateCN} from './lib.mjs';
import {refreshDecision} from './freshness.mjs';
import {reportWindow} from './readiness.mjs';
const automatic=process.env.GITHUB_EVENT_NAME==='schedule'||process.env.RECOVERY_REQUEST==='true';
const result=automatic&&!reportWindow()?{run:false,reason:'outside-report-window-09-to-24-Beijing'}:await refreshDecision({eventName:automatic?'schedule':process.env.GITHUB_EVENT_NAME,reportDate:dateCN()});
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'run='+result.run+'\n');
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n## Publication freshness\n\n'+JSON.stringify(result)+'\n');
console.log(JSON.stringify(result));
console.log(result.run?'Run full current collection.':'Skip: '+result.reason);
