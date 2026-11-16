import fs from 'node:fs';
import {createHash} from 'node:crypto';
const results=[];
const sources=[
 ['sse_directory','https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({isPagination:'true','pageHelp.pageSize':'10000','pageHelp.pageNo':'1',sqlId:'COMMON_JJZWZ_JJLB_L'})],
 ['sse_shares','https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({isPagination:'true','pageHelp.pageSize':'10000','pageHelp.pageNo':'1',sqlId:'COMMON_SSE_ZQPZ_ETFZL_XXPL_ETFGM_SEARCH_L',STAT_DATE:'2026-11-13'})],
 ['sse_monthly','https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({sqlId:'COMMON_SSE_ZQZS_M_CSI300_INDEX_C',isPagination:'false',MDATE:'202610'})],
 ['szse_directory','https://fund.szse.cn/api/report/ShowReport?SHOWTYPE=xlsx&CATALOGID=1000_lf&TABKEY=tab1'],
 ['szse_shares','https://www.szse.cn/api/report/ShowReport?'+new URLSearchParams({SHOWTYPE:'xlsx',CATALOGID:'scsj_fund_jjgm',TABKEY:'tab1',txtStart:'2026-11-12',txtEnd:'2026-11-13',jjlb:'ETF'})],
 ['nav','https://fund.eastmoney.com/pingzhongdata/510300.js'],
 ['index','https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000300,day,,,100,qfq'],
 ['market','https://push2his.eastmoney.com/api/qt/stock/kline/get?'+new URLSearchParams({secid:'1.510300',klt:'101',fqt:'0',beg:'20261001',end:'20261113',lmt:'100',fields1:'f1,f2,f3,f4,f5,f6',fields2:'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61'})]
];
for(const [name,url] of sources){
 const start=Date.now();try{
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',Referer:name.startsWith('szse')?'https://www.szse.cn/':'https://www.sse.com.cn/'},signal:AbortSignal.timeout(35000)});
  const bytes=Buffer.from(await r.arrayBuffer());let count=null,last=null;
  if(name.startsWith('sse')){const j=JSON.parse(bytes);count=j.result?.length;last=j.result?.at(-1)?.STAT_DATE||j.result?.at(-1)?.MDATE;}
  if(name==='nav'){const m=bytes.toString().match(/var Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);if(!m)throw Error('No NAV array');const rows=JSON.parse(m[1]);count=rows.length;last=new Date(rows.at(-1).x+28800000).toISOString().slice(0,10);}
  if(name==='index'){const j=JSON.parse(bytes).data.sh000300;const rows=j.qfqday||j.day;count=rows.length;last=rows.at(-1)[0];}
  if(name==='market'){const j=JSON.parse(bytes);count=j.data?.klines?.length;last=j.data?.klines?.at(-1)?.slice(0,10);}
  const ok=r.ok&&(name.startsWith('szse')?bytes[0]===0x50&&bytes[1]===0x4b:count>0);
  results.push({name,status:r.status,ok,count,last,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),milliseconds:Date.now()-start});
 }catch(e){results.push({name,ok:false,error:e.message,milliseconds:Date.now()-start});}
 console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync('probe-results.json',JSON.stringify({at:new Date().toISOString(),runner:process.platform,results},null,2));
if(results.some(r=>!r.ok&&r.name!=='market'))process.exitCode=1;
