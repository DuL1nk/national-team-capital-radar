export function statusBanner(reportDate){
 if(!/^\d{4}-\d\d-\d\d$/.test(reportDate))throw Error('Invalid report date');
 return `<aside id="updateHealth" class="chart-note" role="status" data-report-date="${reportDate}" style="padding:12px 16px;border:1px solid #d8e3e9;border-radius:12px;background:#f4f8fa">自动更新状态检查中；当前报告 ${reportDate}。<a href="https://github.com/DuL1nk/national-team-capital-radar/actions/workflows/daily-data.yml" target="_blank" rel="noopener">查看云端任务</a></aside><script>(function(){
const el=document.getElementById('updateHealth'),date=el.dataset.reportDate,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),stale=date<today;
function show(text,bad){el.firstChild.textContent=text+' ';el.style.borderColor=bad?'#d69e4b':'#d8e3e9';el.style.background=bad?'#fff7e8':'#f4f8fa';}
show(stale?'今日更新待完成；当前仍为'+date+'报告，勿当作今日数据。':'当前报告 '+date+'；数据截止日以图表标注为准。',stale);
fetch('https://api.github.com/repos/DuL1nk/national-team-capital-radar/actions/workflows/daily-data.yml/runs?per_page=5',{signal:AbortSignal.timeout(10000)}).then(function(r){if(!r.ok)throw Error('API');return r.json();}).then(function(j){const r=j.workflow_runs&&j.workflow_runs[0];if(!r)return;if(r.status!=='completed')show('云端正在更新或排队；当前仍展示'+date+'已核报告。',stale);else if(r.conclusion==='failure')show('最近更新失败，已保留'+date+'已核报告；云端将按重试/兜底规则恢复。',true);else if(stale)show('今日尚未完成发布；当前仍为'+date+'，请查看任务状态。',true);}).catch(function(){if(stale)show('今日更新待完成；任务接口暂不可用，当前报告仍为'+date+'。',true);});
})();</script>`;
}
