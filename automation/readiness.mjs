// A successful HTTP workbook is not proof that the target trading day exists.
export function missingSzseShares({products,shares,lifecycle={},batches,end}){
 const fresh=new Map();
 for(const [key,batch] of Object.entries(batches))if(key.startsWith('shares_')){
  if(!Array.isArray(batch.rows))throw Error('Invalid SZSE share batch');
  for(const [date,code,value] of batch.rows)if(date===end&&Number.isFinite(value))fresh.set(code,value);
 }
 return products.filter(p=>p.exchange==='SZSE'&&p.listingDate<=end&&!(lifecycle[p.code]?.inactiveFrom<=end))
  .filter(p=>!fresh.has(p.code)&&!Number.isFinite(shares[p.code]?.[end])).map(p=>p.code);
}
export function reportWindow(now=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));
 return hour>=9&&hour<24;
}
export async function awaitSzseShares({products,shares,lifecycle,batches,end,refetch,wait,onAttempt=()=>{},delays=[120000,240000,480000]}){
 const attempts=[];
 for(let attempt=0;attempt<=delays.length;attempt++){
  const codes=missingSzseShares({products,shares,lifecycle,batches,end});
  attempts.push({attempt:attempt+1,checkedAt:new Date().toISOString(),fundAsOf:end,missing:codes.length,codes});
  onAttempt({status:codes.length?'waiting_for_official_shares':'ready',attempts});
  if(!codes.length)return batches;
  if(attempt===delays.length)throw Error('DATA_NOT_READY: SZSE '+end+' shares missing for '+codes.length+' products after '+attempts.length+' official fetches; retained previous publication');
  await wait(delays[attempt]);batches=await refetch();
 }
}
