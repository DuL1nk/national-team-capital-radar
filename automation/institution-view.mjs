import {fs,esc} from './lib.mjs';
import {relationships} from './institution-rules.mjs';
const day=x=>x?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(x)):'尚未核查',qty=x=>(x/10000).toLocaleString('zh-CN',{minimumFractionDigits:4,maximumFractionDigits:4})+'万股';
export function institutionView(S,{offline=false}={}){
 const I=S.institutionRefresh,records=I?.records||[],latest=new Map();for(const r of records){const k=r.entityName+'|'+r.code,old=latest.get(k);if(!old||r.asOf>old.asOf||r.asOf===old.asOf&&r.kind.startsWith('actual'))latest.set(k,r);}
 const net=new Map((I?.netChanges||[]).map(r=>[r.entityName+'|'+r.code,r]));
 const rows=[...latest.values()].sort((a,b)=>b.disclosureDate.localeCompare(a.disclosureDate)).map(r=>{
  const peers=records.filter(x=>x.entityName===r.entityName&&x.code===r.code&&x.asOf===r.asOf),change=net.get(r.entityName+'|'+r.code),delta=change&&change.asOf===r.asOf?change:null,hold=r.holdingShares??r.shares,negative='未披露（不等于零）',relation=relationships[r.entityName];
  const trades=kind=>[...new Map(peers.filter(x=>x.kind===kind).map(x=>[[x.from,x.to,x.shares].join('|'),x])).values()];
  const buys=trades('actual_buy'),sells=trades('actual_sell'),tradeCell=(rs,label)=>rs.map(x=>`${label} ${qty(x.shares)}<br>${esc(x.from)}—${esc(x.to)}`).join('<br>');
  const buy=buys.length?tradeCell(buys,'实际增持'):delta&&delta.netShares>0?`可见净增 ${qty(delta.netShares)}<br>非期间总买入`:negative;
  const sell=sells.length?tradeCell(sells,'实际减持'):delta&&delta.netShares<0?`可见净减 ${qty(-delta.netShares)}<br>非期间总卖出`:negative;
  const sources=[...new Map(peers.map(x=>[x.source,x])).values()].map(x=>`<a href="${esc(x.source)}" target="_blank" rel="noopener">A · 官方原件 ${esc(x.disclosureDate)}</a>`).join('<br>');
  return `<tr><td>${esc(r.group)}｜${esc(r.entityName)}<br><small>${esc(r.type)} · ${esc(r.issuer)} ${esc(r.code)}</small>${relation?`<br><a href="${esc(relation.source)}" target="_blank" rel="noopener"><small>${esc(relation.label)} · ${relation.disclosureDate}</small></a>`:''}</td><td>${buy}</td><td>${sell}</td><td>${qty(hold)}${r.percentage!=null?' / '+r.percentage+'%':''}</td><td>数据 ${esc(r.asOf)}<br>披露 ${esc(r.disclosureDate)}</td><td>${sources}${delta?`<br><a href="${esc(delta.previousSource)}" target="_blank" rel="noopener">对照 ${esc(delta.previousAsOf)}：${qty(delta.previousShares)}</a>`:''}<br>${esc(r.scope)}；金额未披露不估算。<small>${esc(r.currentness||'已核原件')}</small></td></tr>`;
 }).join('');
 let html=fs.readFileSync('automation/templates/institution.html','utf8').replace(/<p class="chart-note">11\/16复核公开披露：[\s\S]*?<\/p>/,'');
 html=html.replaceAll('本次核查 11/16','人工基线 11/16').replaceAll('本次未核到新增原始披露','原人工基线未取得数量（非今日无交易）');
 const oldHeading='<p class="chart-note"><strong>原已核样本：</strong>以下保留原数据日/披露日；不是当前完整仓位，不与上方更新重复相加。黔源旧11/11数量已被上方11/17新披露更新。</p>';
 const status=I?`机构披露核查 ${day(I.checkedAt)} · 最新已核披露 ${I.latestDisclosure||'未取得'} · 待复核 ${I.pending.length}项 · 排队正文 ${I.backlog.length}项 · 取源失败 ${I.errors.length}项`:'机构正文核查尚未执行，不能把旧快照当作今日核查';
 const intro=`<p class="chart-note" id="institutionFreshness"><strong>${esc(status)}</strong>。核查时间、披露日与持仓数据日不同；未知格式不自动填数。${offline?'离线验收没有执行新的取源。':''}</p>`;
 const table=rows?`<h3>最新已核数量披露</h3><div class="compact-table"><table><thead><tr><th>机构 / 可见标的</th><th>买入 / 净增</th><th>卖出 / 净减</th><th>可见持仓</th><th>数据日 / 披露日</th><th>证据 / 边界</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="chart-note">本轮没有满足严格格式的新增数量，不表示机构没有交易。</p>';
 const pos=html.indexOf('<div class="compact-table"');if(pos>=0)html=html.slice(0,pos)+intro+table+oldHeading+html.slice(pos);else html=html.replace('<table',intro+table+oldHeading+'<table');
 const pending=I?.pending||[],queries=I?.queries||[];
 html=html.replace('</section>',`<details class="institution-notes"><summary>本轮覆盖、待复核与未完成项</summary><p>目录 ${esc(I?.from||'未知')}—${esc(I?.through||'未知')}；分页检查${I?.coverage.catalogPages||0}页；候选${I?.coverage.candidateDocuments||0}份，本轮取回${I?.coverage.fetched||0}份、已核缓存${I?.coverage.cached||0}份。全市场权益类标题+机构关键词，不保证穷尽所有历史基金持有人或未点名公告。${I?.status==='partial'?'本轮覆盖未完成，不能称已完整核查。':''}</p><ul>${pending.slice(0,40).map(x=>`<li><a href="${esc(x.source)}" target="_blank" rel="noopener">${esc(x.title)}</a>：${esc(x.reason||x.status)}</li>`).join('')}${(I?.errors||[]).slice(0,20).map(x=>`<li>取源失败：${esc(x.source)} · ${esc(x.error)}</li>`).join('')}</ul><p>机构数量仅在日期、单位、主体与原件格式明确时自动确认；计划不作实买，股东名册净变不作买卖总量。扫描PDF或未知表格留待核；不从ETF申赎拆账户。旧人工基线最后核于${esc(S.institutionConfirmedAt)}。</p></details></section>`);
 const summary=`<strong>披露核查 ${esc(day(I?.checkedAt))}</strong>；新证据披露至${esc(I?.latestDisclosure||'未知')}。${I?.pending.length||0}项待核、${I?.backlog.length||0}项排队。ETF流量仍无法按账户归因。`;
 return {html,summary,status};
}
