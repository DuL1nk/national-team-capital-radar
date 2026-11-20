// Exact legal identities only; similar names (CICC/HKSCC/etc.) are not aliases.
export const parserVersion='2026-11-20.3';
export const entities=[
 {id:'huijin',group:'中央汇金',type:'稳市/国有金融资本',names:['中央汇金投资有限责任公司']},
 {id:'huijin_am',group:'汇金资管',type:'稳市',names:['中央汇金资产管理有限责任公司']},
 {id:'csf',group:'中国证金',type:'稳市',names:['中国证券金融股份有限公司']},
 {id:'crhc',group:'中国国新',type:'长期配置/资本运营',names:['中国国新控股有限责任公司','国新投资有限公司','国新宏盛投资（北京）有限公司','国新产业资本管理有限公司']},
 {id:'cct',group:'中国诚通',type:'长期配置/资本运营',names:['中国诚通控股集团有限公司','诚通金控投资有限公司']},
 {id:'ssf',group:'全国社保基金',type:'长期配置',names:['全国社会保障基金理事会'],pattern:'全国社保基金[一二三四五六七八九〇零0-9]+组合'},
 {id:'pension',group:'基本养老保险基金',type:'长期配置',names:[],pattern:'基本养老保险基金[一二三四五六七八九〇零0-9]+组合'},
 {id:'safe',group:'外管局公开平台',type:'长期配置',names:['梧桐树投资平台有限责任公司']},
 {id:'icf',group:'国家大基金',type:'产业政策资金',names:['国家集成电路产业投资基金股份有限公司','国家集成电路产业投资基金二期股份有限公司','国家集成电路产业投资基金三期股份有限公司']}
];
export const discoveryWords=['中央汇金','汇金资产','中国证券金融','国新投资','国新宏盛','国新产业资本','诚通','全国社保','基本养老','梧桐树','国家集成电路'];
export const relevantTitle=/权益变动|增持|减持|持股|股东.{0,12}(?:名册|情况|变动)|前十(?:大|名)|前10|配售|超额|发行结果|股份登记|(?:年度|半年度|季度)报告(?!摘要)/;
export const normalize=s=>String(s).replace(/[\s\u3000]+/g,'').replaceAll('(','（').replaceAll(')','）');
export const relationships={
 '国新产业资本管理有限公司':{label:'中国国新全资主体（报告第5页）',source:'https://static.cninfo.com.cn/finalpage/2026-10-28/1225628730.PDF',disclosureDate:'2026-10-28'},
 '国新宏盛投资（北京）有限公司':{label:'实际控制人：中国国新（中国神华半年报第71页，非直接全资断言）',source:'https://static.cninfo.com.cn/finalpage/2026-08-29/1225531759.PDF',disclosureDate:'2026-08-29'}
};
const n=x=>Number(String(x).replaceAll(',','')),date=(y,m,d)=>`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
export function cnDate(timestamp){return new Date(Number(timestamp)+8*3600000).toISOString().slice(0,10);}
export function parseInstitutionDocument(doc,text){
 const t=normalize(text),rows=[],seen=new Set(),hits=[];
 const identity=t.match(/证券代码[：:]?(\d{6}).{0,50}?证券简称[：:]?([^：:，,。;；]{1,18}?)(?:公告编号|公告|股票代码|编号)/);
 const code=identity?.[1]||doc.code,issuer=(doc.issuer||identity?.[2]||code).replace(/[：:]$/,'');
 if(identity&&doc.code&&identity[1]!==doc.code)return {records:[],hits:[],pending:true,reason:'公告正文证券代码与目录不一致，待核'};
 const put=r=>{const key=[r.entity,r.entityName,r.code,r.kind,r.asOf,r.shares,r.from,r.to].join('|');if(!seen.has(key)){seen.add(key);rows.push({...r,id:doc.id+'|'+key,code,issuer,source:doc.url,disclosureDate:doc.disclosureDate,grade:'A',sha256:doc.sha256,verifiedAt:doc.fetchedAt});}};
 for(const e of entities){
  const names=[...e.names,...(e.pattern?[...t.matchAll(new RegExp(e.pattern,'g'))].map(x=>x[0]):[])];
  for(const full of new Set(names)){const name=normalize(full);if(!t.includes(name))continue;hits.push({entity:e.id,name:full});
   // Only a completed dated, explicit transaction sentence + matching holding
   // sentence can be automatically confirmed. Plans elsewhere are not summed.
   const short=name==='国新产业资本管理有限公司'?'国新产业资本':name;
   const escaped=short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const trade=new RegExp(escaped+'于(20\\d{2})年(\\d{1,2})月(\\d{1,2})日至(?:(20\\d{2})年)?(?:(\\d{1,2})月)?(\\d{1,2})日[^。]{0,110}?(增持|减持)(?:公司|本公司)?股份([\\d,]+)股','g');
   for(const m of t.matchAll(trade)){
    const from=date(m[1],m[2],m[3]),to=date(m[4]||m[1],m[5]||m[2],m[6]),qty=n(m[8]);
    if(/拟|预计|计划|不少于|不低于|不超过/.test(m[0])||!Number.isSafeInteger(qty)||qty<=0||from>to||to>doc.disclosureDate)continue;
    const holding=new RegExp('截至'+(m[4]||m[1])+'年'+Number(m[5]||m[2])+'月'+Number(m[6])+'日[，,]?'+escaped+'持有(?:公司|本公司)股份([\\d,]+)股');
    const h=t.match(holding);if(!h)continue;const holdingShares=n(h[1]);if(!Number.isSafeInteger(holdingShares))continue;
    const pct=t.slice(h.index+h[0].length,h.index+h[0].length+55).match(/占公司总股本的([\d.]+)%/);
    put({entity:e.id,entityName:full,group:e.group,type:e.type,code,kind:m[7]==='增持'?'actual_buy':'actual_sell',shares:qty,holdingShares,percentage:pct?Number(pct[1]):null,asOf:to,from,to,scope:'官方披露该区间实际交易；非全账户总买卖；未披露金额不估算',rule:'dated_explicit_transaction_and_matching_holding_v1'});
   }
   // A directly dated shareholder register, not a purchase. Require explicit
   // shares-unit headers and a fixed quantity→percentage table order.
   const block=text.split(/(?:^|\n)\s*二[、．.]\s*(?:公司)?前十/)[0];
   const b=normalize(block),dated=b.match(/即(20\d{2})年(\d{1,2})月(\d{1,2})日/)||b.match(/股权登记日（(20\d{2})年(\d{1,2})月(\d{1,2})日）登记在册/),q=t.slice(0,350).match(/(20\d{2})年(?:第([一三])季度|半年度|年度)报告/),quarter=q?q[1]+(q[2]==='一'?'-03-31':q[2]==='三'?'-09-30':q[0].includes('半年度')?'-06-30':'-12-31'):null;
   const qdate=dated?date(dated[1],dated[2],dated[3]):quarter;
   const registerHeader=/(?:前十[大名]股东持股情况|前10名股东持股情况)/.test(b)||/回购/.test(doc.title||'')&&/前十[大名]股东/.test(doc.title||'')&&/登记在册的前十[大名]股东/.test(b)&&/(?:持有人名称|股东名称)/.test(b)&&/(?:占(?:公司)?总股本比例.{0,35}（%）|占(?:公司)?总股本比.{0,35}例（%）)/.test(b);
   // PDF columns may interleave the ratio header between 数量 and its 股 unit.
   // The bounded header bridge still requires 股, never 万股/市值/金额.
   if(qdate&&qdate<=doc.disclosureDate&&registerHeader&&/持股数量.{0,35}（股）|单位[：:]股/.test(b)){
    // Whitespace-preserving row extraction prevents ambiguous concatenated digits.
    const line=text.split('\n').find(x=>normalize(x).includes(name));
    const lineNorm=line?.replaceAll('(','（').replaceAll(')','）');
    const pos=lineNorm?.indexOf(name),rest=pos>=0?lineNorm.slice(pos+name.length):'';
    const cells=rest.trim().split(/\s+/).filter(Boolean);if(['未知','国有法人','境内非国有法人','境内自然人','其他'].includes(cells[0]))cells.shift();
    if(cells.length>=2&&/^[\d,]+$/.test(cells[0])&&/^\d{1,2}(?:\.\d+)?%?$/.test(cells[1])){
     const shares=n(cells[0]),pct=Number(cells[1].replace('%',''));if(Number.isSafeInteger(shares)&&shares>0&&pct>0&&pct<=100)put({entity:e.id,entityName:full,group:e.group,type:e.type,code,kind:'holding',shares,asOf:qdate,percentage:pct,scope:'前十大股东可见样本；期末持股不是区间买入；未进入名单不等于清仓',rule:'dated_register_shares_then_percentage_v1'});
    }
   }
  }
 }
 const unresolved=hits.filter(h=>!rows.some(r=>normalize(r.entityName)===normalize(h.name)));
 return {records:rows,hits,unresolved,pending:unresolved.length>0,reason:unresolved.length?'部分/全部命中主体未满足严格数量规则，待复核：'+unresolved.map(h=>h.name).join('、'):null};
}
export function compareHoldings(records){
 const grouped=new Map();for(const r of records.filter(r=>r.kind==='holding')){const k=r.entityName+'|'+r.code;(grouped.get(k)||grouped.set(k,[]).get(k)).push(r);}
 return [...grouped.values()].flatMap(rs=>{const unique=[...new Map(rs.sort((a,b)=>a.asOf.localeCompare(b.asOf)).map(r=>[r.asOf,r])).values()];return unique.slice(1).map((r,i)=>({...r,id:r.id+'|net',kind:'holding_net_change',previousShares:unique[i].shares,previousAsOf:unique[i].asOf,previousSource:unique[i].source,netShares:r.shares-unique[i].shares,scope:'两次可见持仓净变化，不等于期间总买入/卖出；未外推样本外账户'}));});
}
