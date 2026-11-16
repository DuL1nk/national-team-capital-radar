// Pure metric contract. Historical display windows must never change these ranks.
export const LOOKBACK=252;
export function percentile(current,previous){
 if(!Number.isFinite(current)||previous.length!==LOOKBACK||previous.some(x=>!Number.isFinite(x)))return null;
 let lower=0,equal=0;for(const x of previous){if(Math.abs(x-current)<=1e-12)equal++;else if(x<current)lower++;}
 return (lower+.5*equal)/LOOKBACK*100;
}
export function compileRatio(calendar,numerator,denominator){
 const ns=new Map(numerator.map(x=>[x[0],x])),ds=new Map(denominator.map(x=>[x.date,x]));
 const out=[];for(const date of calendar){const n=ns.get(date),d=ds.get(date),complete=!!n&&n[2]===n[3]&&n[3]>0&&Number.isFinite(n[1]),cap=d?.circulatingMarketCapYi;
  const ratioPct=complete&&Number.isFinite(cap)&&cap>0?n[1]/cap*100:null;
  const previous=out.slice(-LOOKBACK),rank=percentile(ratioPct,previous.map(x=>x.ratioPct));
  out.push({date,netAssetsYi:complete?n[1]:null,circulatingMarketCapYi:Number.isFinite(cap)?cap:null,ratioPct,percentile:rank,validCount:n?.[2]??0,expectedCount:n?.[3]??0,lookbackCount:previous.filter(x=>Number.isFinite(x.ratioPct)).length,lookbackStart:previous[0]?.date??null,lookbackEnd:previous.at(-1)?.date??null,status:!complete?'numerator_missing':!Number.isFinite(cap)?'denominator_unavailable':rank===null?'insufficient_252_history':'ok'});
 }return out;
}
