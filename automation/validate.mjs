import vm from 'node:vm';
import {fs,read,assert,sha,put} from './lib.mjs';
import {compileRatio} from './vendor/work/hs300_ratio_20261110/metric.mjs';
const offline=process.argv.includes('--offline'),D=read('build/reviewed_with_both.json'),S=read('build/compiled_state.json'),end=S.fundAsOf,p=D.snapshots[end],H=D.productHistory;let checks=0;
const check=(b,m)=>{assert(b,m);checks++;};
for(let i=0;i<H.dates.length;i++)for(const[k,pool]of Object.entries(p.pools)){
 let value=0,valid=0,expected=0;for(const code of pool.codes){const h=H.products[code],d=H.dates[i],v=i>=h.start?h.flows[i-h.start]:null;if(d>h.effectiveDate)expected++;if(Number.isFinite(v)){valid++;value+=v;}}
 const r=pool.series[i];check(Math.abs(value-r[1])<.00001,'Product/pool reconciliation');check(valid===r[2]&&expected===r[3],'Coverage reconciliation');
}
check(Object.keys(D.indices).join(',')==='sh,cy,star50,hs300,zz500,zz1000','Six index order');for(const x of Object.values(D.indices)){check(x.rows.at(-1)[0]===end,'Index cutoff');check(x.rows.every(r=>r[0]<=end&&r[1]>0),'Index observations');}
const r=D.ratio252;check(r.lookback===252&&!r.lookbackIncludesCurrent&&r.tieMethod==='midrank','Original full rank definition');for(let i=0;i<r.rows.length;i++){const x=r.rows[i];if(x.date>r.denominatorAsOf)check(x.ratioPct===null&&x.percentile===null,'Unpublished denominator gap');if(Number.isFinite(x.percentile)){check(x.lookbackCount===252,'Full warmup');const prev=r.rows.slice(i-252,i);let lower=0,equal=0;for(const v of prev){check(Number.isFinite(v.ratioPct),'No compressed missing dates');if(Math.abs(v.ratioPct-x.ratioPct)<=1e-12)equal++;else if(v.ratioPct<x.ratioPct)lower++;}check(Math.abs(x.percentile-(lower+.5*equal)/252*100)<1e-10,'Full-direction rank recomputation');}}
const html=fs.readFileSync('build/national_team_capital_monitor_'+S.reportDate+'.html','utf8');
for(const re of [/\/Users\//,/file:\/\//,/<script[^>]+src\s*=/i,/<link[^>]+stylesheet/i,/id="(?:ratioSvg|ratioPanel|showRatio252|showFourRatio252)"/,/oldPool|oldCoverage|revisionOldPool/])check(!re.test(html),'No obsolete/private/external code '+re);
for(const id of ['poolSelect','groupSelect','targetSelect','showCumulative','showRatioOverlay','chartSettings','ratioFreshness','institution-title','reviewedData'])check(html.includes('id="'+id+'"'),'Required UI '+id);
check(!/id="chartSettings"[^>]*\bopen\b/.test(html),'Default collapsed settings');
for(const code of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(code[1].includes('application/json'))JSON.parse(code[2]);else new vm.Script(code[2]);
for(const y of ['2y','3y','5y'])check(html.includes('data-bar-range="'+y+'"'),'Natural-year window');
check(html.includes('机构数量已核快照')&&html.includes('新闻分析未启用'),'No stale narrative masquerading as update');
const study=read('automation/vendor/work/hs300_four_etf_20261110/validation.json');check(study.status==='passed','Original event/rank oracle verification');
if(!offline){const status=read('build/stage/public/site-status.json');check(status.report_date===S.reportDate&&status.fund_as_of===end,'Status dates');check(status.artifact_sha256===sha(fs.readFileSync('build/stage/public/index.html')),'Status artifact hash');const audit=read('build/source_audit.json');check(audit.requests.length>=D.quality.products,'Real collection, not date-only update');check(audit.fundAsOf===end,'Fresh collection cutoff');const files=fs.readdirSync('build/stage/public');let total=0;for(const n of files){const st=fs.lstatSync('build/stage/public/'+n);check(st.isFile()&&!st.isSymbolicLink(),'Static artifact only');total+=st.size;}check(total<900*1024*1024,'Pages capacity threshold reached; preserve history and request archive plan');}
put('build/validation.json',{status:'passed',checks,studyChecks:study.checks,reportDate:S.reportDate,fundAsOf:end,ratioAsOf:r.ratioAsOf,offline,checkedAt:new Date().toISOString()});console.log(JSON.stringify({status:'passed',checks,studyChecks:study.checks,offline}));
