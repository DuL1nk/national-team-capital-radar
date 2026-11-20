import {reportWindow} from './readiness.mjs';
export function recoveryDecision({now=new Date(),reportDate,publicDecision,runs}){
 if(!reportWindow(now))return {dispatch:false,reason:'outside-report-window'};
 if(!publicDecision.run)return {dispatch:false,reason:'public-current-verified'};
 const live=runs.filter(r=>['queued','in_progress','waiting','requested','pending'].includes(r.status));
 if(live.length)return {dispatch:false,reason:'publisher-already-active',run:live[0].id};
 const today=runs.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(r.created_at))===reportDate);
 // A strict cap also bounds workflow_run chains. Scheduled primary runs retain
 // their own hourly recovery; this workflow never becomes a second publisher.
 const recoveries=today.filter(r=>r.event==='workflow_dispatch'&&String(r.display_title).includes('watchdog'));
 if(recoveries.length>=3)return {dispatch:false,reason:'watchdog-daily-dispatch-limit'};
 return {dispatch:true,reason:'stale-site-no-active-publisher'};
}
