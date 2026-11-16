import {spawnSync} from 'node:child_process';
import {load,read,put,get,audit,assert,sleep,mergeRows,dateCN,addDay,sha} from './lib.mjs';
const S=load(),args=process.argv.slice(2),date=args.includes('--date')?args[args.indexOf('--date')+1]:dateCN();
process.on('uncaughtException',e=>{put('build/source_failure.json',{reportDate:date,failedAt:new Date().toISOString(),error:e.message,requestsCompleted:audit});console.error(e.stack);process.exit(1);});
assert(/^\d{4}-\d\d-\d\d$/.test(date)&&date<=dateCN(),'Invalid report date');
const D=S.D,previous=S.fundAsOf,defs=[['sh','sh000001'],['cy','sz399006'],['star50','sh000688'],['hs300','sh000300'],['zz500','sh000905'],['zz1000','sh000852']];
const quote=async(symbol,n=100,unadjusted=false)=>{
 const url=`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,${n},${unadjusted?'':'qfq'}`,raw=await get(url,{referer:'https://gu.qq.com/'}),j=JSON.parse(raw).data?.[symbol],rows=unadjusted?j?.day:(j?.qfqday||j?.day);assert(rows?.length,'No quote '+symbol);return{rows,source:url,fetchedAt:new Date().toISOString(),rawSha256:sha(raw)};
};
for(const [id,symbol]of defs){const q=await quote(symbol);const rows=q.rows.filter(x=>x[0]<date).map(x=>[x[0],Number(x[2])]);assert(rows.length>=60&&rows.every(r=>r[1]>0));D.indices[id]={...D.indices[id],rows:mergeRows(D.indices[id].rows,rows,x=>x[0],(a,b)=>Math.abs(a[1]-b[1])<.015,'Index '+id),source:q.source,retrievedAt:q.fetchedAt,refreshMode:'100 latest public daily observations merged with previously audited long history'};}
const end=D.indices.sh.rows.at(-1)[0];assert(end>=previous&&end<date);assert(Date.parse(date)-Date.parse(end)<12*86400000,'Stale index; check market calendar');
for(const x of Object.values(D.indices)){x.rows=x.rows.filter(r=>r[0]<=end);assert.equal(x.rows.at(-1)[0],end,'Six indices must share complete cutoff');x.dataDate=end;}
const oldDates=D.productHistory.dates,buffer=oldDates.at(-2),newDates=D.indices.sh.rows.map(x=>x[0]).filter(d=>d>=buffer&&d<=end);assert(newDates.length<=60,'Long collection gap: controlled backfill required');
const sse=JSON.parse(await get('https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({isPagination:'true','pageHelp.pageSize':'10000','pageHelp.pageNo':'1',sqlId:'COMMON_JJZWZ_JJLB_L'}),{referer:'https://etf.sse.com.cn/'}));assert.equal(sse.result.length,Number(sse.pageHelp.total),'SSE catalog truncation');
const py=spawnSync('python3',['automation/szse.py',buffer,end],{stdio:'inherit'});assert.equal(py.status,0,'Official SZSE collection failed');
const sz=read('build/raw/szse.json'),directory={sse:{rows:sse.result},szse:sz.directory};
const products=D.snapshots[previous].products,codes=new Set(products.map(p=>p.code)),directoryChanges=[];
// Current validated pool is never silently replaced by a fund-name guess.
for(const [exchange,key,fields]of [['sse','FUND_CODE',['INDEX_NAME','LISTING_DATE','FUND_ABBR','CATEGORY']],['szse','基金代码',['基金简称','上市日期','投资类别']]]){
 const old=new Map(S.directories[exchange].rows.map(r=>[r[key],r])),fresh=new Map(directory[exchange].rows.map(r=>[r[key],r]));
 for(const [code,row]of old){if(!fresh.has(code)){directoryChanges.push({exchange,code,type:'removed'});assert(!codes.has(code),'Tracked fund removed: effective-date review required '+code);}else if(codes.has(code)){for(const f of fields)assert.equal(fresh.get(code)[f],row[f],'Tracked metadata changed: audit '+code+' '+f);}else if(fields.some(f=>fresh.get(code)[f]!==row[f])){
  const current=fresh.get(code),text=exchange==='sse'?String(current.INDEX_NAME||'')+' '+current.FUND_ABBR:String(current['基金简称']||'');
  directoryChanges.push({exchange,code,type:'untracked_metadata_changed',name:text});
  assert(!/沪深300|中证(?:500|1000|2000|A500|A50|A100|全指|800)|上证(?:50|180|380|580|综指)|科创(?:50|100|200|综指)|创业板|深证(?:100|300|50|综指)|深成|国证2000|央企|国企|国新|诚通|中央企业|MSCI/.test(text),'Existing excluded product may have transformed into scope: audit '+code+' '+text);
 }}
 for(const [code,row]of fresh)if(!old.has(code)){
  const text=exchange==='sse'?String(row.INDEX_NAME||'')+' '+row.FUND_ABBR:String(row['基金简称']||'');
  const broad=/沪深300|中证(?:500|1000|2000|A500|A50|A100|全指|800)|上证(?:50|180|380|580|综指)|科创(?:50|100|200|综指)|创业板|深证(?:100|300|50|综指)|深成|国证2000|央企|国企|国新|诚通|中央企业|MSCI|自由现金流/.test(text);
  directoryChanges.push({exchange,code,type:'added',name:text,review:broad?'requires_mapping_review':'excluded_nonmatching_product'});
  assert(!broad,'New broad/policy candidate needs index/effective-date classification '+code+' '+text);
 }
}
put('build/directory_audit.json',{reportDate:date,changes:directoryChanges,tracked:products.length});
const share=(d,c,n)=>{if(!codes.has(c))return;const old=S.shares[c][d];assert(old===undefined||Math.abs(old-n)<.11,'Official share historical revision '+c+' '+d);S.shares[c][d]=n;};
for(const d of newDates){const raw=await get('https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({isPagination:'true','pageHelp.pageSize':'10000','pageHelp.pageNo':'1',sqlId:'COMMON_SSE_ZQPZ_ETFZL_XXPL_ETFGM_SEARCH_L',STAT_DATE:d})),j=JSON.parse(raw);assert.equal(j.result.length,Number(j.pageHelp.total));assert(j.result.length>500,'Empty/stale SSE date '+d);const seen=new Set();for(const r of j.result){assert.equal(r.STAT_DATE,d);assert(!seen.has(r.SEC_CODE));seen.add(r.SEC_CODE);const n=Number(r.TOT_VOL)*10000;assert(Number.isFinite(n)&&n>=0);share(d,r.SEC_CODE,n);}put('build/raw/sse_'+d+'.json',j);await sleep(250);}
for(const [key,j]of Object.entries(sz))if(key.startsWith('shares_'))for(const[d,c,n]of j.rows)share(d,c,n);
const missingMarket=[],fourCodes=['510300','510310','510330','159919'];let done=0;
for(const p of products){const code=p.code,raw=await get('https://fund.eastmoney.com/pingzhongdata/'+code+'.js',{referer:'https://fund.eastmoney.com/'}),m=raw.toString().match(/var Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);assert(m,'NAV missing '+code);
 const rows=JSON.parse(m[1]).map(x=>({date:new Date(Number(x.x)+28800000).toISOString().slice(0,10),nav:Number(x.y),returnPct:Number(x.equityReturn),event:String(x.unitMoney||'')})).filter(x=>x.date<=end&&x.date>=(S.nav[code][0]?.date||p.listingDate));assert(rows.length&&rows.every(x=>x.nav>0)&&new Set(rows.map(x=>x.date)).size===rows.length,'Invalid NAV '+code);
 S.nav[code]=mergeRows(S.nav[code],rows,x=>x.date,(a,b)=>a.nav===b.nav,'NAV '+code);
 try{
  const url='https://push2his.eastmoney.com/api/qt/stock/kline/get?'+new URLSearchParams({secid:(p.exchange==='SSE'?'1.':'0.')+code,klt:'101',fqt:'0',beg:newDates[0].replaceAll('-',''),end:end.replaceAll('-',''),lmt:'1000',fields1:'f1,f2,f3,f4,f5,f6',fields2:'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61'}),q=JSON.parse(await get(url,{referer:'https://quote.eastmoney.com/',timeoutMs:12000,retries:1}));assert(q.data?.klines?.length,'No market');
  const rs=q.data.klines.map(x=>x.split(',')).map(x=>[x[0],...x.slice(1).map(v=>v==='-'||v===''?null:Number(v))]).filter(r=>r[0]<=end);assert(rs.every(r=>r[2]>0));
  S.market[code]=mergeRows(S.market[code]||[],rs,r=>r[0],(a,b)=>Math.abs(a[2]-b[2])<.00001,'Unadjusted price '+code).slice(-150);
 }catch(e){if(/Access\/rate response/.test(e.message))throw e;missingMarket.push({code,error:e.message});}
 if(fourCodes.includes(code)&&!S.market[code].some(r=>r[0]===end)){
  const q=await quote((p.exchange==='SSE'?'sh':'sz')+code,100,true),rs=q.rows.filter(r=>r[0]<=end).map(r=>[r[0],Number(r[1]),Number(r[2]),Number(r[3]),Number(r[4]),null,null,null,null]);
  S.market[code]=mergeRows(S.market[code]||[],rs,r=>r[0],(a,b)=>Math.abs(a[2]-b[2])<.00001,'Four unadjusted price '+code).slice(-150);
 }
 if(++done%40===0)console.log('NAV/market '+done+'/'+products.length);await sleep(220);
}
// Monthly observations may legitimately be absent. An HTTP failure is not absence.
const before=new Date(end+'T00:00:00Z');before.setUTCDate(1);before.setUTCMonth(before.getUTCMonth()-1);
const months=new Set([end.slice(0,7).replace('-',''),before.toISOString().slice(0,7).replace('-',''),...(S.denominator.missingMonths||[])]),monthly=[];
for(const month of [...months].sort()){
 const raw=await get('https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({sqlId:'COMMON_SSE_ZQZS_M_CSI300_INDEX_C',isPagination:'false',MDATE:month})),j=JSON.parse(raw);assert(Array.isArray(j.result),'Monthly schema');monthly.push({month,count:j.result.length});
 const rs=j.result.map(r=>({date:r.MDATE.slice(0,4)+'-'+r.MDATE.slice(4,6)+'-'+r.MDATE.slice(6,8),circulatingMarketCapYi:Number(r.CPT_NGT),circulatingSharesYi:Number(r.NGT_VOL),close:Number(r.CLS),sourceType:'official_monthly_json',source:audit.at(-1).url,sourceMonth:month})).filter(r=>r.date<=end);assert(rs.every(r=>r.circulatingMarketCapYi>0&&r.close>0));
 S.denominator.rows=mergeRows(S.denominator.rows,rs,r=>r.date,(a,b)=>a.circulatingMarketCapYi===b.circulatingMarketCapYi,'Official monthly denominator');await sleep(220);
}
S.denominator.missingMonths=monthly.filter(x=>x.count===0).map(x=>x.month);S.denominator.asOf=S.denominator.rows.at(-1).date;S.denominator.requestedAsOf=end;S.denominator.retrievedAt=new Date().toISOString();
S.directories=directory;S.fundAsOf=end;S.reportDate=date;S.collectedAt=new Date().toISOString();S.newDates=newDates;S.marketGaps=missingMarket;S.monthlyChecks=monthly;
// Only announcement metadata candidates: never auto-promote into confirmed trades.
const institution={checkedAt:new Date().toISOString(),from:addDay(date,-2),through:date,queries:[],status:'metadata_candidates_only_no_quantity_confirmation'};
for(const keyword of ['中央汇金','汇金资产','中国证券金融','国新投资','诚通','全国社保','基本养老','梧桐树','国家集成电路','国新宏盛','国新产业资本']){
 try{const raw=await get('https://www.cninfo.com.cn/new/hisAnnouncement/query',{referer:'https://www.cninfo.com.cn/',timeoutMs:15000,retries:1,method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({pageNum:'1',pageSize:'30',column:'szse',tabName:'fulltext',stock:'',searchkey:keyword,seDate:institution.from+'~'+date,sortName:'',sortType:'',isHLtitle:'true'})}),j=JSON.parse(raw);assert(Array.isArray(j.announcements)||j.announcements===null,'Announcement schema');institution.queries.push({keyword,total:j.totalAnnouncement,hasMore:j.hasMore,rows:(j.announcements||[]).map(x=>({code:x.secCode,title:String(x.announcementTitle).replace(/<[^>]*>/g,''),date:new Date(x.announcementTime).toISOString().slice(0,10),url:'https://static.cninfo.com.cn/'+x.adjunctUrl}))});}
 catch(e){institution.queries.push({keyword,error:e.message});}await sleep(300);
}
S.institutionCandidates=institution;
put('build/source_audit.json',{reportDate:date,fundAsOf:end,previousFundAsOf:previous,executedAt:S.collectedAt,runner:process.env.GITHUB_ACTIONS==='true'?'github-hosted':'local',requests:audit,szse:read('build/raw/szse_audit.json'),monthly,marketGaps:missingMarket,institution});
put('build/collected.json',S);console.log(JSON.stringify({reportDate:date,fundAsOf:end,products:products.length,requests:audit.length,marketGaps:missingMarket.length,denominatorAsOf:S.denominator.asOf}));
