import {spawnSync} from 'node:child_process';
import {fs,get,audit,put,read,sha,sleep,mergeRows,addDay} from './lib.mjs';
import {cnDate,parseInstitutionDocument,compareHoldings,relevantTitle,discoveryWords,parserVersion} from './institution-rules.mjs';
const seeds=[
 {id:'1225677282',code:'002039',issuer:'黔源电力',title:'关于持股5%以上股东权益变动触及1%整数倍暨增持计划实施进展的公告',disclosureDate:'2026-11-19',url:'https://static.cninfo.com.cn/finalpage/2026-11-19/1225677282.PDF'},
 {id:'1225677175',code:'600176',issuer:'中国巨石',title:'关于回购股份事项前十大股东及前十大无限售条件股东持股情况的公告',disclosureDate:'2026-11-19',url:'https://static.cninfo.com.cn/finalpage/2026-11-19/1225677175.PDF'},
 {id:'1225610207',code:'600176',issuer:'中国巨石',title:'2026年第三季度报告',disclosureDate:'2026-10-20',url:'https://static.cninfo.com.cn/finalpage/2026-10-20/1225610207.PDF'}
];
export async function refreshDisclosures(S,{reportDate,maxDocuments=300}={}){
 const end=S.fundAsOf,startedAt=new Date().toISOString(),auditStart=audit.length;
 const before=new Date(end+'T00:00:00Z');before.setUTCDate(1);before.setUTCMonth(before.getUTCMonth()-1);
 const months=new Set([reportDate.slice(0,7).replace('-',''),end.slice(0,7).replace('-',''),before.toISOString().slice(0,7).replace('-',''),...(S.denominator.missingMonths||[])]),monthly=[];
 for(const month of [...months].sort()){
  const raw=await get('https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({sqlId:'COMMON_SSE_ZQZS_M_CSI300_INDEX_C',isPagination:'false',MDATE:month})),j=JSON.parse(raw);if(!Array.isArray(j.result))throw Error('Official denominator schema');
  const rs=j.result.map(r=>({date:r.MDATE.slice(0,4)+'-'+r.MDATE.slice(4,6)+'-'+r.MDATE.slice(6,8),circulatingMarketCapYi:Number(r.CPT_NGT),circulatingSharesYi:Number(r.NGT_VOL),close:Number(r.CLS),sourceType:'official_monthly_json',source:audit.at(-1).url,sourceMonth:month})).filter(r=>r.date<=end);
  if(!rs.every(r=>r.circulatingMarketCapYi>0&&r.close>0))throw Error('Invalid official denominator');
  S.denominator.rows=mergeRows(S.denominator.rows,rs,r=>r.date,(a,b)=>a.circulatingMarketCapYi===b.circulatingMarketCapYi,'Official monthly denominator');
  monthly.push({month,count:j.result.length,acceptedRows:rs.length,source:audit.at(-1).url,sha256:sha(raw),checkedAt:new Date().toISOString()});await sleep(250);
 }
 S.denominator.missingMonths=monthly.filter(x=>x.count===0).map(x=>x.month);S.denominator.asOf=S.denominator.rows.at(-1).date;S.denominator.requestedAsOf=end;S.denominator.retrievedAt=new Date().toISOString();S.monthlyChecks=monthly;
 const previous=S.institutionRefresh||{},from=addDay(previous.catalogThrough||S.institutionConfirmedAt||reportDate,-2),queries=[],candidates=new Map(),errors=[];
 function accept(x){if(!/\.pdf$/i.test(x.adjunctUrl||''))return;const u='https://static.cninfo.com.cn/'+x.adjunctUrl,publication=u.match(/finalpage\/(\d{4}-\d\d-\d\d)\//)?.[1],d={id:String(x.announcementId||u.match(/(\d+)\.pdf/i)?.[1]),code:x.secCode,issuer:x.secName,title:String(x.announcementTitle||'').replace(/<[^>]*>/g,''),metadataDate:cnDate(x.announcementTime),disclosureDate:publication||cnDate(x.announcementTime),url:u};candidates.set(u,d);}
 let catalogDenied=false,pdfDenied=false;
 async function query(keyword,allMarket=false,day=null){let count=0,total=0,complete=false,pages=0,lastPage='';const seen=new Set(),qFrom=day||from,qThrough=day||reportDate;
  if(catalogDenied){queries.push({keyword,allMarket,from:qFrom,through:qThrough,pages:0,total:null,received:0,unique:0,complete:false,error:'Earlier access/rate response; stopped this provider'});return;}
  try{for(let page=1;page<=(allMarket?80:10);page++){
   const raw=await get('https://www.cninfo.com.cn/new/hisAnnouncement/query',{referer:'https://www.cninfo.com.cn/',method:'POST',timeoutMs:20000,retries:2,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({pageNum:String(page),pageSize:'30',column:'szse',tabName:'fulltext',stock:'',searchkey:keyword,seDate:qFrom+'~'+qThrough,sortName:'time',sortType:'desc',isHLtitle:'true'})});
   const j=JSON.parse(raw),rows=j.announcements||[];if(!Array.isArray(rows)||!Number.isFinite(Number(j.totalAnnouncement)))throw Error('Announcement schema');pages++;total=Number(j.totalAnnouncement);const pageKey=rows.map(x=>x.announcementId+'|'+x.secCode).join(',');
   for(const x of rows){const key=String(x.announcementId||x.adjunctUrl);seen.add(key);const title=String(x.announcementTitle).replace(/<[^>]*>/g,'');if(relevantTitle.test(title)||!allMarket&&/中央汇金|汇金资产|中国证券金融|国新投资|国新宏盛|国新产业资本|中国诚通|诚通金控|社保基金|养老保险基金|梧桐树|国家集成电路/.test(title))accept(x);}
   count+=rows.length;if(!j.hasMore||count>=total){if(count<total)throw Error('Pagination incomplete '+count+'/'+total);complete=true;break;}if(!rows.length||pageKey===lastPage)throw Error('Empty/repeated page before total');lastPage=pageKey;await sleep(250);
  }}catch(e){if(/Access\/rate response/.test(e.message))catalogDenied=true;errors.push({source:allMarket?'全市场权益目录':keyword,error:e.message});}
  queries.push({keyword:allMarket?'全市场目录→权益/持股/定期报告标题筛选':keyword,allMarket,from:qFrom,through:qThrough,pages,total,received:count,unique:seen.size,complete});console.log(JSON.stringify({source:'institution_catalog',keyword:keyword||'all',from:qFrom,through:qThrough,pages,received:count,unique:seen.size,total,complete}));
 }
 for(let day=from;day<=reportDate;day=addDay(day,1))await query('',true,day);
 for(const word of discoveryWords){await query(word);await sleep(250);}
 for(const s of seeds)candidates.set(s.url,s);
 const ledger={...(previous.documents||{})},fresh=[...candidates.values()].sort((a,b)=>b.disclosureDate.localeCompare(a.disclosureDate));let fetched=0,cached=0;
 // Retain backlog across attempts. Revisions are not silently accepted.
 for(const d of previous.backlog||[])if(!candidates.has(d.url))fresh.push(d);
 const backlog=[];
 for(const d of fresh){
  const old=ledger[d.url],oldDate=old?.lastFetchedAt?.slice(0,10),due=!old||old.parserVersion!==parserVersion||old.error||oldDate<addDay(reportDate,-6)||seeds.some(s=>s.url===d.url)&&oldDate!==reportDate;
  if(!due){cached++;continue;}if(fetched>=maxDocuments||pdfDenied){backlog.push(d);continue;}fetched++;
  try{
   if(!/^https:\/\/static\.cninfo\.com\.cn\/finalpage\/\d{4}-\d\d-\d\d\/\d+\.PDF$/i.test(d.url))throw Error('Noncanonical official PDF URL');
   const raw=await get(d.url,{referer:'https://www.cninfo.com.cn/',timeoutMs:30000,retries:2});if(raw.subarray(0,4).toString()!=='%PDF')throw Error('Not a PDF');const hash=sha(raw);
   if(old?.sha256&&old.sha256!==hash)throw Error('Official PDF content revised: human review required');
   const pdf='build/raw/institutions/'+d.id+'.pdf',txt=pdf+'.txt';put(pdf,raw);
   const r=spawnSync(process.env.PDFTOTEXT_BIN||'pdftotext',['-layout',pdf,txt],{encoding:'utf8',maxBuffer:1024*1024});if(r.status!==0)throw Error('PDF text extraction unavailable');
   const text=fs.readFileSync(txt,'utf8');
   const doc={...d,sha256:hash,fetchedAt:new Date().toISOString()},parsed=text.trim().length<80?{records:[],hits:[],pending:true,reason:'扫描/无文本PDF，已取原件但须人工复核，未自动填数'}:parseInstitutionDocument(doc,text);
   ledger[d.url]={...doc,...parsed,parserVersion,lastFetchedAt:doc.fetchedAt,status:parsed.pending?'pending_review':parsed.records.length?'confirmed':'no_matching_quantity'};
  }catch(e){if(/Access\/rate response/.test(e.message))pdfDenied=true;ledger[d.url]={...old,...d,error:e.message,lastAttemptAt:new Date().toISOString(),status:'failed'};errors.push({source:d.url,error:e.message});}
  await sleep(180);
 }
 const records=Object.values(ledger).flatMap(x=>(x.records||[]).map(r=>({...r,currentness:x.error?'复核失败，保留旧证据':'已核原件'}))),netChanges=compareHoldings(records),pending=Object.values(ledger).filter(x=>x.pending||x.error),checkedAt=new Date().toISOString(),complete=queries.every(q=>q.complete)&&errors.length===0&&backlog.length===0;
 S.institutionRefresh={version:1,checkedAt,from,through:reportDate,lastSuccessfulCheckAt:complete?checkedAt:previous.lastSuccessfulCheckAt||null,catalogThrough:queries.filter(q=>q.allMarket).every(q=>q.complete)?reportDate:previous.catalogThrough||null,queries,documents:ledger,backlog,records,netChanges,pending:pending.map(x=>({id:x.id,code:x.code,title:x.title,source:x.url,status:x.status,reason:x.reason||x.error})),errors,coverage:{catalogPages:queries.filter(q=>q.allMarket).reduce((n,q)=>n+q.pages,0),candidateDocuments:candidates.size,fetched,cached,backlog:backlog.length,pending:pending.length},status:complete?(pending.length?'checked_with_pending':'checked'):'partial',latestDisclosure:records.map(r=>r.disclosureDate).sort().at(-1)||null};
 S.disclosureCheckedAt=checkedAt;S.disclosureAudit={startedAt,checkedAt,monthly,institution:{...S.institutionRefresh,documents:undefined},requests:audit.slice(auditStart)};
 put('build/disclosure_audit.json',S.disclosureAudit);return S;
}
export async function refreshOnly(){const {load}=await import('./lib.mjs'),S=load(),reportDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());S.reportDate=reportDate;S.newDates=S.D.productHistory.dates.slice(-2);await refreshDisclosures(S,{reportDate});put('build/collected.json',S);
 const prior=read('public-source-audit.json');put('build/source_audit.json',{...prior,mode:'disclosures_only',fundAsOf:S.fundAsOf,disclosureCheckedAt:S.disclosureCheckedAt,monthly:S.monthlyChecks,institution:S.disclosureAudit.institution,disclosureRequests:S.disclosureAudit.requests});
 console.log(JSON.stringify({mode:'disclosures_only',fundAsOf:S.fundAsOf,ratioAsOf:S.denominator.asOf,checkedAt:S.disclosureCheckedAt,institution:S.institutionRefresh.coverage}));}
if(process.argv.includes('--run'))await refreshOnly();
