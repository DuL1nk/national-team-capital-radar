import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fs,read,put,load,save,assert,esc,sha,dateCN} from './lib.mjs';
import {statusBanner} from './status-banner.mjs';
import {institutionView} from './institution-view.mjs';
const root=process.cwd(),offline=process.argv.includes('--offline'),disclosuresOnly=process.argv.includes('--disclosures-only'),preview=process.argv.includes('--preview'),vendor='automation/vendor',date=dateCN();
assert(!preview||!process.env.GITHUB_ACTIONS,'Local preview must never be used by the cloud publisher');
fs.mkdirSync('build',{recursive:true});
function run(args,{cwd=root,log}={}){const r=spawnSync(process.execPath,args,{cwd,...(log?{encoding:'utf8',maxBuffer:20*1024*1024}:{stdio:'inherit'})});if(log)put('build/'+log,(r.stdout||'')+'\n'+(r.stderr||''));if(r.status!==0)throw Error(args[0]+' failed: '+String(r.stderr||r.stdout||'see preceding step output').slice(-5000));}
run(['automation/test-increment.mjs']);
run(['automation/test-lifecycle.mjs']);
if(offline){const s=load();s.reportDate=date;s.newDates=s.D.productHistory.dates.slice(-2);put('build/collected.json',s);}else if(disclosuresOnly)run(['automation/disclosures.mjs','--run']);else run(['automation/collect.mjs']);
run(['automation/compile.mjs']);
const state=read('build/compiled_state.json'),D=read('build/reviewed.json'),end=state.fundAsOf,reportDate=state.reportDate;
assert.equal(reportDate,date,'Do not publish a backdated automatic run');
run(['work/hs300_four_etf_20261110/compile_study.mjs'],{cwd:path.resolve(vendor),log:'study_compile.log'});
run(['work/hs300_four_etf_20261110/validate_study.mjs'],{cwd:path.resolve(vendor),log:'study_validation.log'});
run(['work/hs300_four_etf_20261110/attach.mjs','--data',path.resolve('build/reviewed.json'),'--out',path.resolve('build/reviewed_with_both.json')],{cwd:path.resolve(vendor)});
run(['work/hs300_four_etf_20261110/render_study.mjs','--date',reportDate],{cwd:path.resolve(vendor)});
const studyModel=read(vendor+'/work/hs300_four_etf_20261110/study.json'),completed=studyModel.windows.find(x=>x.horizon===250).completedCount;
for(const n of ['hs300_four_etf_backtest.html',`hs300_four_etf_backtest_${reportDate}.html`]){const f=vendor+'/'+n;put(f,fs.readFileSync(f,'utf8').replace('事件研究48次',`事件研究${completed}次`).replace('不能当48笔',`不能当${completed}笔`));}
const iv=institutionView(state,{offline});put('build/institution.html',iv.html);put('build/institution_summary.html',iv.summary);
const p=D.snapshots[end].pools.broad,sg=n=>(n>=0?'+':'−')+Math.abs(n).toFixed(2),events=`<section aria-labelledby="focus-title"><div class="section-head"><h2 id="focus-title">规则摘要与下一验证</h2><span>无模型数据版 · 不生成新闻归因</span></div><div class="brief-list"><ul>${Object.entries(state.lifecycleReview||{}).filter(([,e])=>e.inactiveFrom<=end).map(([code,e])=>`<li><b>已核退出：</b><a href="${esc(e.source)}" target="_blank" rel="noopener">${code} ${esc(e.name)}</a>自${e.inactiveFrom}进入清算；当期不再计入申赎，退出前历史保留，未把清算计为赎回或前填净值。</li>`).join('')}<li><b>短期：</b>纯宽基当日${sg(p.flow)}亿元，近5日${sg(p.flow5)}亿元；连续${p.streak}日同号净流。仅描述市场申赎。</li><li><b>中长期：</b>近60日${sg(p.flow60)}亿元，近242日${sg(p.flow242)}亿元；更长区间请切换主图，不把当前存续样本当历史全市场。</li><li><b>下一验证：</b>下一交易日份额与同日NAV齐备后重算；持续性、方向广度、净申赎强度分别观察，不输出买卖指令。</li><li><b>数据失效条件：</b>官方份额或同日NAV缺失、未核拆合事件、目录变更待分类或历史数值修订时阻止发布并保留上一版。官方分母未披露时明确滞后、后段留空。</li><li><b>新闻分析已暂停：</b>本页不沿用旧财经评论冒充当日分析；已确认机构数量保留原数据日。后续接入模型再恢复新闻研究。</li></ul></div></section>`;put('build/events.html',events);
run(['work/etf_coverage_20261105/render.mjs','--date',reportDate,'--cutoff',end,'--data',path.resolve('build/reviewed_with_both.json'),'--input',path.resolve('automation/templates/shell.html'),'--institution',path.resolve('build/institution.html'),'--institution-summary',path.resolve('build/institution_summary.html'),'--events',path.resolve('build/events.html')],{cwd:path.resolve(vendor)});
const mainName=`national_team_capital_monitor_${reportDate}.html`,studyName=`hs300_four_etf_backtest_${reportDate}.html`;
let html=fs.readFileSync(vendor+'/'+mainName,'utf8');
html=html.replace('<span class="pill">公开来源 · 非投资建议</span>',`<span class="pill">公开来源 · 非投资建议</span><span class="pill">无模型云端数据版</span>`).replace('<main class="wrap dash">',`<main class="wrap dash"><p class="chart-note" id="cloudStatus">${offline?'离线自检，禁止发布':'GitHub Actions 云端数据更新'} · 资金 ${end} · 分位 ${D.ratio252.ratioAsOf}（来源核查 ${esc(state.denominator.retrievedAt)}） · 机构披露核查 ${esc(state.institutionRefresh?.checkedAt||'未执行')}，新数量证据披露至${esc(state.institutionRefresh?.latestDisclosure||'未知')}。新闻分析未启用。</p>`);
html=html.replace('<main class="wrap dash">','<main class="wrap dash">'+statusBanner(reportDate));
put('build/'+mainName,html);
const stage='build/stage/public';fs.mkdirSync(stage,{recursive:true});
const staticName=n=>['index.html','site-status.json','four-study-status.json','.nojekyll'].includes(n)||/^(?:national_team_capital_monitor_\d{4}-\d\d-\d\d|hs300_four_etf_backtest(?:_\d{4}-\d\d-\d\d)?)\.html$/.test(n);
for(const n of fs.readdirSync(root).filter(staticName))fs.copyFileSync(n,stage+'/'+n);
if(!offline){
 run([path.resolve('automation/prepare-report.mjs'),'--input',path.resolve('build/'+mainName),'--date',reportDate],{cwd:path.resolve('build/stage')});
 run([path.resolve('automation/prepare-study.mjs'),'--input',path.resolve(vendor+'/'+studyName),'--date',reportDate],{cwd:path.resolve('build/stage')});
 const st=read(stage+'/site-status.json');put(stage+'/site-status.json',{...st,fund_as_of:end,ratio_as_of:D.ratio252.ratioAsOf,data_collected_at:state.collectedAt,mode:'model_free_cloud',institution_baseline_confirmed_at:state.institutionConfirmedAt,disclosure_checked_at:state.disclosureCheckedAt,ratio_checked_at:state.denominator.retrievedAt,institution_checked_at:state.institutionRefresh?.checkedAt,institution_latest_disclosure:state.institutionRefresh?.latestDisclosure,disclosure_status:state.institutionRefresh?.status,institution_pending:(state.institutionRefresh?.pending.length||0)+(state.institutionRefresh?.backlog.length||0),refresh_scope:disclosuresOnly?'disclosures_only':'funds_and_disclosures',news_analysis:'not_enabled',cloud_run:process.env.GITHUB_RUN_ID||null});
 const sourceAudit=read('build/source_audit.json');put(stage+'/public-source-audit.json',sourceAudit);
}
run(['automation/validate.mjs',...(offline?['--offline']:[])]);
if(offline||preview){console.log((offline?'Offline calculation/algorithm checks':'Actual-source local preview')+' passed; no durable state or public artifact updated.');process.exit(0);}
state.D=read('build/reviewed_with_both.json');state.fundAsOf=end;state.lastCloudRun=process.env.GITHUB_RUN_ID||null;state.institutionConfirmedAt=state.institutionConfirmedAt;
const ledger=state.availability,now=new Date().toISOString();
for(const [month,rows]of Map.groupBy(state.denominator.rows,r=>r.date.slice(0,7))){const hash=sha(JSON.stringify(rows)),entry=ledger.months[month]??={firstConfirmedAt:now,revisions:[]};if(!entry.revisions.some(r=>r.sha256===hash))entry.revisions.push({sha256:hash,firstConfirmedAt:now,observationEnd:rows.at(-1).date,rows:rows.length});entry.lastCheckedAt=now;}
ledger.lastCheckedAt=now;ledger.fundAsOf=end;ledger.denominatorAsOf=state.denominator.asOf;
// Durable state is committed only after all validation gates. Artifacts/cache are not the sole database.
save(state);
const watch=`# 国家队资金数据监控（无模型云端版）\n\n报告日 ${reportDate}；资金 ${end}；分位数据 ${D.ratio252.ratioAsOf}（官方来源核查 ${state.denominator.retrievedAt}）；机构正文核查 ${state.institutionRefresh?.checkedAt}，最新已核披露 ${state.institutionRefresh?.latestDisclosure}。核查状态 ${state.institutionRefresh?.status}，待复核 ${state.institutionRefresh?.pending.length||0}、正文排队 ${state.institutionRefresh?.backlog.length||0}；旧人工基线 ${state.institutionConfirmedAt}不代表全部机构更新日。\n\n纯宽基${D.quality.broad}只、政策${D.quality.policy}只。宽基当日${sg(p.flow)}亿元、5日${sg(p.flow5)}亿元、60日${sg(p.flow60)}亿元。\n\n下一验证：下一完整交易日官方份额、同日NAV、六指数和目录；拆合/目录变更/历史冲突需证据复核。分母滞后不填值；无法按账户归因。每日主任务及发布后的每小时轻量检查复用同一串行发布流程，不重抓ETF五年历史。\n\n机构按官方PDF中主体、日期、单位严格确认；计划不是实买，持仓净变不是期间总买卖。未知格式、取源失败、扫描PDF及未披露账户不填零、不外推。新闻分析未启用。\n`;
put('automation/watchlist.md',watch);
for(const n of fs.readdirSync(stage)){assert(staticName(n)||n==='public-source-audit.json');fs.copyFileSync(stage+'/'+n,n);}
console.log(JSON.stringify({status:'ready_to_deploy',reportDate,fundAsOf:end,ratioAsOf:D.ratio252.ratioAsOf,sha256:sha(fs.readFileSync('index.html'))}));
