/* Single-file chart engine: reviewed fund flows and independently scaled index overlays. */
const CapitalTrendCharts=(()=>{
 'use strict';
 const NS='http://www.w3.org/2000/svg',dayMs=86400000;
 const fmt=(v,n=2)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
 const sign=v=>Number.isFinite(v)?(v>0?'+':v<0?'−':'')+fmt(Math.abs(v)):'—';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function windowRows(series,key,asOf){
  let start,rows;const end=asOf||series.at(-1)[0];
  if(key.endsWith('y')){const t=new Date(end+'T00:00:00Z'),year=t.getUTCFullYear()-parseInt(key),month=t.getUTCMonth(),day=Math.min(t.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());const bound=new Date(Date.UTC(year,month,day+1));start=bound.toISOString().slice(0,10);rows=series.filter(r=>r[0]>=start&&r[0]<=end);}
  else{rows=series.filter(r=>r[0]<=end).slice(-parseInt(key));start=rows[0]?.[0];}
  return {rows,start,end,truncated:!!start&&series[0][0]>start};
 }
 function bucketRows(rows,grain){
  const groups=new Map();for(const r of rows){let key=r[0];if(grain==='m')key=key.slice(0,7);if(grain==='w'){const t=new Date(key+'T00:00:00Z'),dow=(t.getUTCDay()+6)%7;t.setTime(t.getTime()-dow*dayMs);key=t.toISOString().slice(0,10);}if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  let cumulative=0;
  return [...groups.values()].map(rs=>{const usable=rs.filter(r=>r[2]>0||r[3]===0),flow=usable.reduce((s,r)=>s+(Number.isFinite(r[1])?r[1]:0),0),valid=rs.every(r=>r[2]===r[3]),active=rs.some(r=>r[7]>0);cumulative+=flow;return{start:rs[0][0],end:rs.at(-1)[0],rows:rs,f:flow,cumulative,valid,active,n:rs.reduce((s,r)=>s+r[2],0),e:rs.reduce((s,r)=>s+r[3],0),missingDays:rs.filter(r=>r[2]!==r[3]).length};});
 }
 function overlaySeries(indices,ids,rows,bins){return ids.map(id=>{
  const d=indices[id],map=new Map(d.rows),first=rows.find(r=>map.has(r[0])),base=first?{date:first[0],close:map.get(first[0])}:null;
  return{...d,base,values:bins.map(b=>{const close=map.get(b.end);return base&&Number.isFinite(close)?{date:b.end,close,value:close/base.close*100,returnPct:(close/base.close-1)*100,backcast:!!d.launchDate&&b.end<d.launchDate}:null;})};
 });}
 function flowTotals(history,codes,start,end){let inflow=0,outflow=0,missing=0;const a=history.dates.findIndex(d=>d>=start),last=history.dates.findLastIndex(d=>d<=end);for(const code of codes){const p=history.products[code];if(!p)throw Error('Missing reviewed ETF history '+code);for(let i=Math.max(a,p.start);i<=last;i++){const v=p.flows[i-p.start];if(Number.isFinite(v)){if(v>0)inflow+=v;else outflow+=v;}else if(history.dates[i]>p.effectiveDate&&(!p.inactiveFrom||history.dates[i]<p.inactiveFrom))missing++;}}return{inflow,outflow,net:inflow+outflow,missing};}
 function node(tag,a={},text){const e=document.createElementNS(NS,tag);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;return e;}
 function path(points){let d='',open=false;points.forEach(p=>{if(!p){open=false;return;}d+=(open?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2);open=true;});return d;}
 function engine({data:D,getScope}){
  const $=id=>document.getElementById(id),indices=D.indices||{},selected=new Set(D.fourEtfStudy&&indices.hs300?['hs300']:indices.sh?['sh']:[]);
  let ranges={bar:'1y',cum:'60d'},grain='auto',showCum=true,states={},resizeFrame=null;
  const ratio=D.ratio252&&typeof CapitalRatioPanel==='function'?CapitalRatioPanel({data:D.ratio252,four:D.fourEtfStudy,format:fmt,escape:esc,onChange:()=>{if(states.bar)render('bar');}}):null;
  const ratioChoice=()=>$('ratioOverlaySeries')?.value||'all',ratioOverlayOn=()=>!!ratio&&!!$('showRatioOverlay')?.checked;
  const indexIds=['sh','cy','star50','hs300','zz500','zz1000'].filter(id=>indices[id]);
  $('indexChoices').innerHTML=indexIds.map(id=>{const x=indices[id];return '<label class="index-chip" style="--series-color:'+x.color+'"><input type="checkbox" value="'+id+'" '+(selected.has(id)?'checked':'')+'><span class="index-chip-line"></span>'+esc(x.name)+(x.kind.includes('全收益')?'<small>含分红</small>':'')+'</label>';}).join('');
  function render(kind,scope=getScope()){
   const previousDate=states[kind]?.bins[states[kind].current]?.end;
   const isBar=kind==='bar',svg=$(isBar?'dailyBarSvg':'cumSvg'),range=ranges[kind],win=windowRows(scope.series,range,D.asOf),rows=win.rows;
   if(!rows.length)return;
   const g=isBar?(grain==='auto'?(range==='5y'?'m':range==='2y'||range==='3y'?'w':'d'):grain):'d';
   const bins=bucketRows(rows,g),overlays=isBar?overlaySeries(indices,indexIds.filter(id=>selected.has(id)),rows,bins):[],hasOverlay=overlays.some(x=>x.base);
   const rankOverlays=isBar&&ratioOverlayOn()?ratio.overlaySeries(bins,ratioChoice()):[];
   const hasCum=isBar&&showCum,W=Math.max(320,svg.getBoundingClientRect().width||1080),small=W<600,H=small?350:390,L=small?56:72,axisWidth=small?57:76,R=(hasCum?axisWidth:0)+(hasOverlay?axisWidth:0)+12,T=32,B=H-42,PW=W-L-R,axisSteps=small?2:4;
   svg.setAttribute('viewBox','0 0 '+W+' '+H);
   const fundValues=isBar?bins.filter(b=>b.active).map(b=>b.f):[0,...bins.filter(b=>b.active).map(b=>b.cumulative)];
   let lo=Math.min(0,...fundValues),hi=Math.max(0,...fundValues);if(lo===hi){lo=-1;hi=1;}const pad=(hi-lo)*.1;lo-=pad;hi+=pad;
   const x=i=>L+(bins.length>1?i/(bins.length-1):.5)*PW,y=v=>B-(v-lo)/(hi-lo)*(B-T);
   const iv=overlays.flatMap(o=>o.values.filter(Boolean).map(v=>v.value));let ilo=Math.min(100,...iv),ihi=Math.max(100,...iv);if(ilo===ihi){ilo-=2;ihi+=2;}const ip=(ihi-ilo)*.1;ilo-=ip;ihi+=ip;const iy=v=>B-(v-ilo)/(ihi-ilo)*(B-T);
   const cv=[0,...bins.filter(b=>b.active).map(b=>b.cumulative)];let clo=Math.min(...cv),chi=Math.max(...cv);if(clo===chi){clo=-1;chi=1;}const cp=(chi-clo)*.1;clo-=cp;chi+=cp;const cy=v=>B-(v-clo)/(chi-clo)*(B-T);
   const ry=v=>B-v/100*(B-T);
   const grid=$(isBar?'barGrid':'cumGrid');grid.replaceChildren();
   for(let i=0;i<=axisSteps;i++){const v=lo+(hi-lo)*i/axisSteps,py=y(v);grid.append(node('line',{x1:L,x2:W-R,y1:py,y2:py,class:'axis-line'}),node('text',{x:L-8,y:py+4,'text-anchor':'end',fill:'#53616e','font-size':11},fmt(v,0)));}
   grid.append(node('line',{x1:L,x2:W-R,y1:y(0),y2:y(0),class:'zero-line'}),node('text',{x:L,y:15,fill:'#53616e','font-size':11},isBar?'单期 · 亿元':'累计 · 亿元'));
   if(hasCum){const ax=W-R+8;grid.append(node('text',{x:ax,y:15,fill:'#12304a','font-size':11},'累计(亿)'));for(let i=0;i<=axisSteps;i++){const v=clo+(chi-clo)*i/axisSteps;grid.append(node('text',{x:ax,y:cy(v)+4,fill:'#12304a','font-size':11},fmt(v,0)));}grid.append(node('line',{x1:L,x2:W-R,y1:cy(0),y2:cy(0),stroke:'#12304a','stroke-width':1,'stroke-dasharray':'7 5',opacity:.35}));}
   if(hasOverlay){const ax=W-R+(hasCum?axisWidth:0)+8;grid.append(node('text',{x:ax,y:15,fill:'#53616e','font-size':11},'指数100'));for(let i=0;i<=axisSteps;i++){const v=ilo+(ihi-ilo)*i/axisSteps;grid.append(node('text',{x:ax,y:iy(v)+4,fill:'#53616e','font-size':11},fmt(v,0)));}}
   const nTicks=W<600?3:5,marks=[...new Set(Array.from({length:nTicks},(_,i)=>Math.round(i*(bins.length-1)/(nTicks-1))))];
   for(const i of marks){const date=bins[i].end,label=(g==='m'?date.slice(0,7):date).replaceAll('-','/');grid.append(node('text',{x:x(i),y:B+23,'text-anchor':i===0?'start':i===bins.length-1?'end':'middle',fill:'#53616e','font-size':W<600?10:11},label));}
   if(isBar){
    const bars=$('bars');bars.replaceChildren();const bw=Math.max(.35,PW/bins.length*.76);
    bins.forEach((b,i)=>{if(!b.active)return;bars.append(node('rect',{x:x(i)-bw/2,y:Math.min(y(0),y(b.f)),width:bw,height:Math.max(.45,Math.abs(y(b.f)-y(0))),class:b.f>=0?'bar-pos':'bar-neg',opacity:hasOverlay ? .85 : .95,...(!b.valid?{stroke:'#946500','stroke-width':1,'stroke-dasharray':'2 2'}:{})}));});
    const layer=$('indexLines');layer.replaceChildren();for(const o of overlays)layer.append(node('path',{d:path(o.values.map((v,i)=>v?[x(i),iy(v.value)]:null)),fill:'none',stroke:o.color,'stroke-width':2.1,'stroke-dasharray':o.dash||'','stroke-linejoin':'round','stroke-linecap':'round','vector-effect':'non-scaling-stroke'}));
    const cumLayer=$('barCumLines');cumLayer.replaceChildren();if(hasCum){const d=path(bins.map((b,i)=>b.active?[x(i),cy(b.cumulative)]:null));cumLayer.append(node('path',{d,fill:'none',stroke:'#fff','stroke-width':5,'stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}),node('path',{d,fill:'none',stroke:'#12304a','stroke-width':2.8,'stroke-linejoin':'round','stroke-linecap':'round','vector-effect':'non-scaling-stroke'}));}
    const ranks=$('ratioOverlayLines');if(ranks){ranks.replaceChildren();for(const o of rankOverlays)ranks.append(node('path',{'data-ratio-series':o.id,d:path(o.values.map((v,i)=>v?[x(i),ry(v.percentile)]:null)),fill:'none',stroke:o.color,'stroke-width':2,'stroke-dasharray':o.dash,'stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}));}
    if(rankOverlays.length){for(const v of[0,50,100])grid.append(node('text',{x:W-R-5,y:v===100?T+12:ry(v)-5,'text-anchor':'end',fill:'#4c568f','font-size':10,stroke:'#fff','stroke-width':3,'paint-order':'stroke'},v===100?'分位100%':v+'%'));}
    $('barLegend').innerHTML='<span class="fund-key"><i class="key-square" style="background:#df4e35"></i>净申购 <i class="key-square" style="background:#15916d"></i>净赎回</span>'+(hasCum?'<span class="index-legend-item cumulative-key"><svg width="24" height="9" aria-hidden="true"><line x1="0" x2="24" y1="4" y2="4" stroke="#12304a" stroke-width="3"/></svg>累计资金</span>':'')+overlays.map(o=>{const v=o.values.findLast(Boolean);return'<span class="index-legend-item" style="color:'+o.color+'"><svg width="24" height="9" aria-hidden="true"><line x1="0" x2="24" y1="4" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="'+(o.dash||'')+'"/></svg>'+esc(o.name)+' <b>'+(v?sign(v.returnPct)+'%':'无该区间数据')+'</b></span>';}).join('');
    $('indexOverlayNote').textContent='左轴：单期净申赎（亿元）。'+(hasCum?'右侧'+(hasOverlay?'内轴':'轴')+'：所选区间累计资金（亿元），从区间起点重新累计；关闭不改变统计。':'累计曲线已关闭。')+(hasOverlay?'右侧'+(hasCum?'外轴':'轴')+'：指数窗口首个有效收盘=100，悬停看实际点位。':'指数已关闭。')+'各轴独立缩放，不能用曲线交叉位置比较大小或证明因果。';
    if(rankOverlays.length){$('barLegend').innerHTML+=rankOverlays.map(o=>'<span class="index-legend-item" style="color:'+o.color+'"><svg width="24" height="9" aria-hidden="true"><line x1="0" x2="24" y1="4" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="'+o.dash+'"/></svg>'+o.name+'</span>').join('');$('indexOverlayNote').textContent+=' 分位线固定对应沪深300，使用独立0–100%图内标尺，不与金额或指数轴共用；周/月取期末，缺失断线。';}
    if($('displaySummary')){$('displaySummary').textContent=(overlays.length===1?overlays[0].name:overlays.length?overlays.length+'个指数':'无指数')+(rankOverlays.length?' · '+(ratioChoice()==='all'?'全方向分位':ratioChoice()==='both'?'双分位':'四只·'+($('fourRatioBasis')?.value==='nav'?'NAV':'市价')):'')+' · '+(g==='d'?'日频':g==='w'?'周合计':'月合计');$('displaySummary').title=$('displaySummary').textContent;}
    if($('ratioOverlaySeries'))$('ratioOverlaySeries').disabled=!ratioOverlayOn();if($('fourRatioBasis'))$('fourRatioBasis').disabled=!ratioOverlayOn()||ratioChoice()==='all';
    const totals=flowTotals(D.productHistory,scope.codes,rows[0][0],rows.at(-1)[0]);$('flowTotals').innerHTML='<span>净申购方向合计 <b class="pos">'+sign(totals.inflow)+'亿</b></span><span>净赎回方向合计 <b class="neg">'+sign(totals.outflow)+'亿</b></span><span>相抵净额 <b>'+sign(totals.net)+'亿</b></span>';
    $('flowTotalScope').textContent=scope.label+' · 与上方区间一致；逐只ETF每日净申赎正、负值分别加总，非逐笔总申购/总赎回。'+(totals.missing?'有'+totals.missing+'个产品日缺失，仅合计已知数据。':'');
   }else{const pts=bins.map((b,i)=>b.active?[x(i),y(b.cumulative)]:null);$('cumLine').setAttribute('points','');$('cumArea').setAttribute('points','');const layer=$('cumPath');layer.setAttribute('d',path(pts));}
   const gaps=rows.filter(r=>r[2]!==r[3]).length,total=bins.at(-1).cumulative,active=rows.find(r=>r[7]>0),unit=g==='w'?'周':g==='m'?'月':'日';
   $(isBar?'barWindow':'cumWindow').textContent=rows[0][0]+' — '+rows.at(-1)[0]+' · '+rows.length+'交易日'+(isBar?' · '+(g==='w'?'周合计':g==='m'?'月合计':'日频'):'')+(gaps?' · 缺口'+gaps+'日':'');
   const coverage=$(isBar?'barCoverage':'cumCoverage');coverage.dataset.incomplete=String(win.truncated||gaps>0);
   coverage.textContent=(win.truncated?'请求自'+win.start+'起，资金资料实际自'+rows[0][0]+'起，前段缺失不补零。':'')+(gaps?'存在份额/NAV或折算缺口；虚线边框柱为部分覆盖，累计仅含已知金额，不能视为完整总额。':'')+(active&&active[0]>rows[0][0]?'该方向首个有效上市样本自'+active[0]+'起，之前无资金样本，不表示真实交易为零。':'')+(active&&active[7]!==rows.at(-1)[7]?'区间有效样本'+active[7]+'→'+rows.at(-1)[7]+'只，按上市时点纳入。':'')+(isBar&&g!=='d'?'按'+unit+'合计资金，指数取对应期末收盘；首尾期可为不足整'+unit+'。':'');
   if(!isBar)$('trendInterpretation').textContent='所选窗口累计'+(gaps?'已知':'')+'净申赎'+sign(total)+'亿元。'+(total<0&&scope.flow10>0?'近期回流尚未抵销本窗口累计流出。':'单一窗口不代表未来走势。')+' 当前存续产品回溯有幸存者偏差，不能按账户归因。';
   const hover=$(isBar?'barHover':'cumHover');hover.replaceChildren(node('line',{class:'hover-line',y1:T,y2:B}));hover.setAttribute('visibility','hidden');
   const retained=bins.findIndex(b=>previousDate&&b.start<=previousDate&&previousDate<=b.end),current=retained>=0?retained:bins.length-1;
   states[kind]={svg,bins,overlays,rankOverlays,hasOverlay,hasCum,x,y,iy,cy,ry,W,L,R,T,B,PW,current,grain:g,scope};
   if(isBar&&ratio)ratio.render(states[kind]);
   $(isBar?'barReadout':'cumReadout').textContent=readout(kind,bins.length-1);
   show(kind,current,undefined,false);
  }
  function readout(kind,i){const s=states[kind],b=s.bins[i],date=b.start===b.end?b.end:b.start+' — '+b.end;return date+'｜'+(s.grain==='d'?'当日':'该期')+(b.valid?'':'已知')+'净申赎 '+sign(b.f)+'亿元｜窗口累计 '+sign(b.cumulative)+'亿元';}
  function show(kind,i,event,reveal=true){const s=states[kind];if(!s)return;i=Math.max(0,Math.min(s.bins.length-1,i));s.current=i;const b=s.bins[i],isBar=kind==='bar',h=$(isBar?'barHover':'cumHover'),tip=$(isBar?'barTip':'cumTip');h.setAttribute('visibility',reveal?'visible':'hidden');h.replaceChildren(node('line',{class:'hover-line',x1:s.x(i),x2:s.x(i),y1:s.T,y2:s.B}));
   if(isBar&&s.hasCum&&b.active)h.append(node('circle',{cx:s.x(i),cy:s.cy(b.cumulative),r:4,fill:'#fff',stroke:'#12304a','stroke-width':2}));
   let details='';if(isBar)for(const o of s.overlays){const v=o.values[i];if(v){h.append(node('circle',{cx:s.x(i),cy:s.iy(v.value),r:3.5,fill:'white',stroke:o.color,'stroke-width':1.8}));details+='<div class="tooltip-series"><i style="background:'+o.color+'"></i>'+esc(o.name)+' <b>'+fmt(v.close)+'点</b> <small>区间'+sign(v.returnPct)+'%</small></div>';}else details+='<div>'+esc(o.name)+'：无数据</div>';}
   else if(b.active)h.append(node('circle',{cx:s.x(i),cy:s.y(b.cumulative),r:4,class:'hover-dot'}));
   let ranks='';if(isBar&&ratioOverlayOn()){for(const o of s.rankOverlays){const v=o.values[i];if(v)h.append(node('circle',{cx:s.x(i),cy:s.ry(v.percentile),r:3.5,fill:'#fff',stroke:o.color,'stroke-width':1.8}));}for(const o of ratio.readings(i,ratioChoice())){const v=o.value;ranks+='<div class="tooltip-series"><i style="background:'+o.color+'"></i>'+o.name+' <b>'+(v?fmt(v.percentile)+'%':'—')+'</b>'+(v?'<small>占比'+fmt(v.ratioPct,4)+'%</small>':'<small>缺少已核数据</small>')+'</div>';}}
   tip.innerHTML='<strong class="tooltip-date">'+(b.start===b.end?b.end:b.start+' — '+b.end)+'</strong><div class="tooltip-funds"><span>净申赎 <b>'+sign(b.f)+'亿</b></span><span>累计 <b>'+sign(b.cumulative)+'亿</b></span></div>'+(!b.valid?'<small>部分覆盖，仅合计已知数据</small>':'')+details+ranks+(s.overlays.length?'<small class="tooltip-note">指数为较区间起点涨跌，非当日</small>':'');
   $(isBar?'barReadout':'cumReadout').textContent=readout(kind,i);
   tip.style.display=reveal?'block':'none';if(reveal)positionTip(s,tip,i,event,isBar);
  }
  function positionTip(s,tip,i,event,isBar){const box=s.svg.getBoundingClientRect(),parent=s.svg.parentElement,pb=parent.getBoundingClientRect(),anchor=box,px=Number.isFinite(event?.clientX)?event.clientX:anchor.left+s.x(i)/s.W*anchor.width,py=Number.isFinite(event?.clientY)?event.clientY:anchor.top+anchor.height*.35,w=tip.offsetWidth,h=tip.offsetHeight,loX=Math.max(8,8-pb.left),hiX=Math.max(loX,Math.min(parent.clientWidth-w-8,innerWidth-pb.left-w-8)),loY=Math.max(8,8-pb.top),hiY=Math.max(loY,Math.min(parent.clientHeight-h-8,innerHeight-pb.top-h-8));let x=px-pb.left+14;if(x>hiX)x=px-pb.left-w-14;const above=py-pb.top-h-14,y=above>=loY?above:py-pb.top+14,plotLo=Math.max(loY,anchor.top-pb.top+8),plotHi=Math.min(hiY,anchor.bottom-pb.top-h-8);tip.style.left=Math.max(loX,Math.min(hiX,x))+'px';tip.style.top=(plotHi>=plotLo?Math.max(plotLo,Math.min(plotHi,y)):Math.max(loY,Math.min(hiY,y)))+'px';}
  function hide(kind){$(kind==='bar'?'barTip':'cumTip').style.display='none';$(kind==='bar'?'barHover':'cumHover').setAttribute('visibility','hidden');}
  for(const kind of['bar','cum']){const svg=$(kind==='bar'?'dailyBarSvg':'cumSvg'),move=e=>{const s=states[kind];if(!s)return;const r=svg.getBoundingClientRect(),vx=(e.clientX-r.left)/r.width*s.W;show(kind,Math.round((vx-s.L)/s.PW*(s.bins.length-1)),e);};svg.addEventListener('pointermove',move);svg.addEventListener('pointerdown',e=>{e.preventDefault();svg.focus({preventScroll:true});move(e);});svg.addEventListener('keydown',e=>{const s=states[kind];if(!s)return;let i=s.current;if(e.key==='ArrowLeft')i--;else if(e.key==='ArrowRight')i++;else if(e.key==='Home')i=0;else if(e.key==='End')i=s.bins.length-1;else return;e.preventDefault();show(kind,i,e);});}
  for(const kind of['bar','cum']){const svg=$(kind==='bar'?'dailyBarSvg':'cumSvg');svg.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hide(kind);});svg.addEventListener('keydown',e=>{if(e.key==='Escape')hide(kind);});}
  for(const id of['showRatioOverlay','ratioOverlaySeries'])$(id)?.addEventListener('change',()=>{if($('ratioOverlaySeries'))$('ratioOverlaySeries').disabled=!ratioOverlayOn();render('bar');});
  $('resetTrendDisplay')?.addEventListener('click',()=>{selected.clear();if(indices.hs300)selected.add('hs300');else if(indices.sh)selected.add('sh');$('indexChoices').querySelectorAll('input').forEach(x=>{x.checked=selected.has(x.value);});showCum=true;$('showCumulative').checked=true;if($('showRatioOverlay'))$('showRatioOverlay').checked=true;if($('ratioOverlaySeries'))$('ratioOverlaySeries').value=D.fourEtfStudy?'four':'all';if($('fourRatioBasis'))$('fourRatioBasis').value='market';grain='auto';$('barGrain').value='auto';render('bar');});
  window.addEventListener('scroll',()=>{hide('bar');hide('cum');},{passive:true});
  for(const kind of['bar','cum'])document.querySelectorAll('[data-'+kind+'-range]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset[kind+'Range']===ranges[kind]));b.addEventListener('click',()=>{ranges[kind]=b.dataset[kind+'Range'];document.querySelectorAll('[data-'+kind+'-range]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});render(kind);});});
  $('barGrain').addEventListener('change',e=>{grain=e.target.value;render('bar');});$('showCumulative').addEventListener('change',e=>{showCum=e.target.checked;render('bar');});$('cumPanel').addEventListener('toggle',()=>{if($('cumPanel').open)render('cum');});$('indexChoices').addEventListener('change',e=>{if(!e.target.matches('input[type="checkbox"]'))return;if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);render('bar');});$('clearOverlays').addEventListener('click',()=>{selected.clear();$('indexChoices').querySelectorAll('input').forEach(x=>{x.checked=false;});render('bar');});
  window.addEventListener('resize',()=>{if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{for(const kind of['bar','cum'])if(states[kind])render(kind);});});
  return {render};
 }
 engine.model={windowRows,bucketRows,overlaySeries,flowTotals};return engine;
})();
