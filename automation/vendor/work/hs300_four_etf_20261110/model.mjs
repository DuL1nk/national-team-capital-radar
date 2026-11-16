// Pure research calculations. No network, file access or trading operations.
export const finite=Number.isFinite;
export function rankOriginal(values,n=252){
 n=Math.max(1,Math.round(Number(n)||1));return values.map((value,i)=>{
  if(!finite(value))return null;const w=values.slice(Math.max(0,i-n+1),i+1).filter(finite);
  if(w.length<=1)return 1;const lo=w.filter(x=>x<value).length,eq=w.filter(x=>x===value).length;
  return(lo+(eq-1)/2)/(w.length-1);
 });
}
export function rankPrior(values,n=252){return values.map((v,i)=>{const w=values.slice(Math.max(0,i-n),i);if(!finite(v)||w.length!==n||!w.every(finite))return null;return(w.filter(x=>x<v).length+.5*w.filter(x=>x===v).length)/n;});}
export function occurrences(rows,key='marketRank',start='0000-00-00'){
 let previous=false;const out=[];for(const r of rows){if(r.date<start||!finite(r[key]))continue;const high=r[key]>=1;if(high&&!previous)out.push({eventDate:r.date,observationDate:r.date,rank:r[key]});previous=high;}return out;
}
export function firstAfter(points,date){let a=0,b=points.length;while(a<b){const m=(a+b)>>1;if(points[m].date<=date)a=m+1;else b=m;}return a<points.length?a:-1;}
export const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function baseline(points,h){const a=[];for(let i=0;i+h<points.length;i++)if(points[i].close!==0)a.push((points[i+h].close/points[i].close-1)*100);return avg(a);}
export function study(events,points,h=250,baselineOverride=undefined){
 const base=baselineOverride===undefined?baseline(points,h):baselineOverride,seen=new Set(),observations=[];for(const e of events){const i=firstAfter(points,e.eventDate);if(i<0||seen.has(points[i].date))continue;seen.add(points[i].date);const j=i+h,complete=j<points.length;observations.push({...e,entryDate:points[i].date,entryIndex:i,entryValue:points[i].close,complete,exitDate:complete?points[j].date:null,exitValue:complete?points[j].close:null,returnPct:complete?(points[j].close/points[i].close-1)*100:null});}
 const complete=observations.filter(x=>x.complete),values=complete.map(x=>x.returnPct),mean=avg(values),sorted=[...values].sort((a,b)=>a-b),excess=mean===null||base===null?null:mean-base;
 return{horizon:h,eventCount:events.length,uniqueEntryCount:observations.length,completedCount:values.length,pendingCount:observations.length-values.length,meanReturn:mean,medianReturn:values.length?sorted[Math.floor(values.length/2)]:null,baselineReturn:base,excessReturn:excess,positiveReturnRate:values.length?values.filter(x=>x>0).length/values.length:null,winRate:values.length?values.filter(x=>x>base).length/values.length:null,directionWinRate:values.length&&excess!==0?values.filter(x=>excess>0?x>base:x<base).length/values.length:null,std:values.length>1?Math.sqrt(values.reduce((s,x)=>s+(x-mean)**2,0)/(values.length-1)):null,observations};
}
export function shiftEvents(events,calendar,delay=0){return events.flatMap(e=>{const i=calendar.indexOf(e.observationDate||e.eventDate);return i>=0&&i+delay<calendar.length?[{...e,eventDate:calendar[i+delay],availabilityModel:delay+' trading-day delay'}]:[];});}
export function monthRelease(observationDate,day){const y=Number(observationDate.slice(0,4)),m=Number(observationDate.slice(5,7));return new Date(Date.UTC(y,m,day==='month_end'?new Date(Date.UTC(y,m+1,0)).getUTCDate():Number(day))).toISOString().slice(0,10);}
export function delayedMonthly(events,day){return events.map(e=>({...e,eventDate:monthRelease(e.observationDate||e.eventDate,day),availabilityModel:'assumed_next_month_'+day}));}
export function monthlyStateEvents(rows,key,start,day){
 const ends=new Map();for(const r of rows)if(r.date>=start&&finite(r[key]))ends.set(r.date.slice(0,7),r);
 const events=[];let previous=false;for(const r of ends.values()){const high=r[key]>=1;if(high&&!previous)events.push({eventDate:monthRelease(r.date,day),observationDate:r.date,rank:r[key],availabilityModel:'assumed_latest_month_end_state_'+day});previous=high;}return events;
}
export function nonoverlap(events,points,h=250){const out=[];let nextAllowed=-1;for(const e of events){const i=firstAfter(points,e.eventDate);if(i<0||i<=nextAllowed)continue;out.push(e);nextAllowed=i+h;}return out;}
export function portfolio(events,points,h=250,costBps=10){
 const uniq=new Map();for(const e of events){const i=firstAfter(points,e.eventDate);if(i>=0&&!uniq.has(i))uniq.set(i,e);}
 const signals=new Map([...uniq].sort((a,b)=>a[0]-b[0])),cost=costBps/10000/2;let equity=1,cash=1,position=null,peak=1,maxDD=0,held=0;const rows=[],trades=[];let ignored=0;
 for(let i=0;i<points.length;i++){
  const p=points[i];if(position){equity=position.capital*p.close/position.entryPrice;held++;if(signals.has(i))ignored++;if(i===position.exitIndex){equity*=1-cost;cash=equity;trades.push({...position,exitDate:p.date,exitPrice:p.close,completed:true,netReturnPct:(cash/position.beforeCapital-1)*100});position=null;}}
  else if(signals.has(i)){const beforeCapital=cash;position={eventDate:signals.get(i).eventDate,observationDate:signals.get(i).observationDate,entryDate:p.date,entryIndex:i,entryPrice:p.close,exitIndex:i+h,beforeCapital,capital:cash*(1-cost)};equity=position.capital;held++;}
  else equity=cash;
  peak=Math.max(peak,equity);maxDD=Math.min(maxDD,equity/peak-1);rows.push([p.date,equity]);
 }
 if(position)trades.push({...position,completed:false,markDate:points.at(-1).date,markPrice:points.at(-1).close,markReturnPct:(equity/position.beforeCapital-1)*100});
 let bhPeak=points[0].close,bhDD=0;for(const p of points){bhPeak=Math.max(bhPeak,p.close);bhDD=Math.min(bhDD,p.close/bhPeak-1);}
 const years=(Date.parse(points.at(-1).date)-Date.parse(points[0].date))/86400000/365.25,bh=points.at(-1).close/points[0].close-1;return{horizon:h,roundTripCostBps:costBps,firstDate:points[0].date,lastDate:points.at(-1).date,totalReturnPct:(equity-1)*100,cagrPct:(equity**(1/years)-1)*100,maxDrawdownPct:maxDD*100,exposurePct:held/points.length*100,completedTrades:trades.filter(t=>t.completed).length,openTrades:trades.filter(t=>!t.completed).length,ignoredSignals:ignored,buyHoldReturnPct:bh*100,buyHoldCagrPct:((bh+1)**(1/years)-1)*100,buyHoldDrawdownPct:bhDD*100,rows,trades};
}
