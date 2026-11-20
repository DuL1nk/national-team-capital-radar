import fs from 'node:fs';
import {refreshDecision} from './freshness.mjs';
import {recoveryDecision} from './recovery.mjs';
const repo='DuL1nk/national-team-capital-radar',base='https://api.github.com/repos/'+repo,now=new Date(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(now);
if(process.env.GITHUB_REPOSITORY!==repo)throw Error('Unexpected repository');
async function api(path,{method='GET',body}={}){
 const r=await fetch(base+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('GitHub API '+method+' '+path.split('?')[0]+' HTTP '+r.status);
 return r.status===204?null:await r.json();
}
const publicDecision=await refreshDecision({eventName:'schedule',reportDate:date}),{workflow_runs:runs}=await api('/actions/workflows/daily-data.yml/runs?per_page=50'),decision=recoveryDecision({now,reportDate:date,publicDecision,runs});
if(decision.dispatch)await api('/actions/workflows/daily-data.yml/dispatches',{method:'POST',body:{ref:'main',inputs:{publish:true,recovery:true}}});
const title='[自动更新告警] 国家队资金雷达',issues=await api('/issues?state=open&creator=github-actions%5Bbot%5D&per_page=100'),issue=issues.find(x=>!x.pull_request&&x.title===title);
const summary={checkedAt:now.toISOString(),reportDate:date,publicDecision,decision};
if(publicDecision.reason==='today-anonymously-verified'&&issue)await api('/issues/'+issue.number,{method:'PATCH',body:{state:'closed',state_reason:'completed'}});
else if(publicDecision.run&&decision.reason!=='outside-report-window'&&['failure','cancelled','timed_out'].includes(runs[0]?.conclusion)){
 const body='固定网址尚未通过今日日期及首页 SHA-256 校验。\n\n最近发布任务：'+runs[0].html_url+'\n\n看门狗结果：`'+decision.reason+'`；'+(decision.dispatch?'已自动请求补跑，尚不等于发布成功。':'保留上一已核版本，禁止补零或只改日期。')+'\n\n本告警由云端自动维护，成功匿名验收后自动关闭。\n\n检查时间：'+now.toISOString();
 if(issue)await api('/issues/'+issue.number,{method:'PATCH',body:{body}});else await api('/issues',{method:'POST',body:{title,body}});
}
fs.mkdirSync('build',{recursive:true});fs.writeFileSync('build/watchdog.json',JSON.stringify(summary,null,2));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Independent-workflow recovery (same GitHub platform)\n\n```json\n'+JSON.stringify(summary,null,2)+'\n```\n');
console.log(JSON.stringify(summary));
