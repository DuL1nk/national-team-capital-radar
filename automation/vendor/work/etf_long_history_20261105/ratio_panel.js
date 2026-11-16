/* Same reviewed percentile data; main-chart overlays and freshness only. */
const CapitalRatioPanel=(()=>{
 'use strict';
 const endpointValues=(rows,bins)=>{const m=new Map(rows.map(x=>[x.date,x]));return bins.map(b=>m.get(b.end)||null);};
 function overlaySeries(D,F,bins,choice='both',basis='market'){
  const definitions=[{id:'all',name:'全方向分位',color:'#4c568f',dash:'2 4',rows:D.rows,rank:r=>r?.percentile,ratio:r=>r?.ratioPct}];
  if(F)definitions.push({id:'four',name:basis==='nav'?'四只分位·NAV':'四只分位·市价',color:'#147d7a',dash:'8 3',rows:F.rows,rank:r=>{const v=r?.[basis==='nav'?'navRank':'marketRank'];return Number.isFinite(v)?v*100:null;},ratio:r=>r?.[basis==='nav'?'navRatioPct':'marketRatioPct']});
  return definitions.filter(d=>choice==='both'||d.id===choice).map(d=>({id:d.id,name:d.name,color:d.color,dash:d.dash,values:endpointValues(d.rows,bins).map(r=>{const percentile=d.rank(r);return Number.isFinite(percentile)?{date:r.date,percentile,ratioPct:d.ratio(r)}:null;})}));
 }
 function create({data:D,four:F,format:fmt,onChange}){
  const $=id=>document.getElementById(id),mode=()=>$('fourRatioBasis')?.value||'market';let state=null;
  function render(s){
   state=s;const end=s.bins.at(-1).end,choice=$('ratioOverlaySeries')?.value||'all',cutoff=choice==='four'&&F?F.ratioAsOf:D.ratioAsOf,lag=D.rows.filter(r=>r.date>cutoff&&r.date<=end).length;
   if($('ratioFreshness')){$('ratioFreshness').textContent='资金截至 '+end+' · 分位截至 '+cutoff+(lag?'（滞后'+lag+'交易日，后段留空）':'');$('ratioFreshness').classList.toggle('late',lag>0);}
   if($('ratioLatestSnapshot')){const a=D.rows.findLast(r=>r.date<=end&&Number.isFinite(r.percentile)),b=F?.rows.findLast(r=>r.date<=end&&Number.isFinite(r[mode()==='nav'?'navRank':'marketRank']));$('ratioLatestSnapshot').textContent='最近已核：'+(a?'全方向 '+fmt(a.percentile)+'%（'+a.date+'）':'全方向尚无完整分位')+(b?'；四只 '+fmt(b[mode()==='nav'?'navRank':'marketRank']*100)+'%（'+b.date+'，'+(mode()==='nav'?'NAV':'市价')+'）':'')+'。最新缺口不沿用该值。';}
  }
  $('fourRatioBasis')?.addEventListener('change',()=>onChange?.());
  return{render,overlaySeries(bins,choice){return overlaySeries(D,F,bins,choice,mode());},readings(i,choice){if(!state||!choice)return[];return overlaySeries(D,F,state.bins,choice,mode()).map(s=>({...s,value:s.values[i]}));}};
 }
 create.model={endpointValues,overlaySeries};return create;
})();
