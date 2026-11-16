import io,json,time,hashlib,warnings,sys
from datetime import datetime,timezone,timedelta
from pathlib import Path
import requests,pandas as pd
start,end=sys.argv[1:3];out=Path('build/raw');out.mkdir(parents=True,exist_ok=True)
jobs=[('directory','https://fund.szse.cn/api/report/ShowReport',{'SHOWTYPE':'xlsx','CATALOGID':'1000_lf','TABKEY':'tab1'})]
d=datetime.fromisoformat(start);stop=datetime.fromisoformat(end)
while d<=stop:
    last=min(d+timedelta(days=30),stop)
    jobs.append(('shares_'+d.strftime('%Y%m%d'),'https://www.szse.cn/api/report/ShowReport',{'SHOWTYPE':'xlsx','CATALOGID':'scsj_fund_jjgm','TABKEY':'tab1','txtStart':d.strftime('%Y-%m-%d'),'txtEnd':last.strftime('%Y-%m-%d'),'jjlb':'ETF'}))
    d=last+timedelta(days=1)
results={};evidence=[]
for name,url,params in jobs:
    for attempt in range(3):
        try:
            try:
                r=requests.get(url,params=params,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.szse.cn/market/fund/volume/etf/index.html'},timeout=60)
            except requests.exceptions.ConnectionError:
                if name!='directory':raise
                r=requests.get('https://www.szse.cn/api/report/ShowReport',params=params,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.szse.cn/'},timeout=60)
            if r.status_code in [401,403,429,514]:raise PermissionError('Access/rate response; no bypass')
            r.raise_for_status()
            with warnings.catch_warnings():
                warnings.simplefilter('ignore');df=pd.read_excel(io.BytesIO(r.content),dtype={'基金代码':str})
            assert len(df)<65535,'Workbook may be truncated'
            rows=[]
            if name=='directory':
                assert '基金类别' in df.columns
                df=df[df['基金类别'].eq('ETF')]
                for row in df.to_dict(orient='records'):
                    x={str(k):(None if pd.isna(v) else v.strftime('%Y-%m-%d') if isinstance(v,(pd.Timestamp,datetime)) else v.item() if hasattr(v,'item') else v) for k,v in row.items()}
                    x['基金代码']=str(x['基金代码']).strip().zfill(6);rows.append(x)
            else:
                assert {'日期','基金代码','基金规模(份)'}.issubset(set(df.columns))
                for _,row in df.dropna(subset=['日期','基金代码','基金规模(份)']).iterrows():
                    date=pd.Timestamp(row['日期']).strftime('%Y-%m-%d');code=str(row['基金代码']).strip().zfill(6);shares=float(str(row['基金规模(份)']).replace(',',''))
                    assert start<=date<=end and len(code)==6 and code.isdigit() and shares>=0
                    rows.append([date,code,shares])
            results[name]={'rows':rows,'source':r.url,'fetchedAt':datetime.now(timezone.utc).isoformat(),'rawSha256':hashlib.sha256(r.content).hexdigest()}
            (out/(name+'.xlsx')).write_bytes(r.content)
            evidence.append({k:v for k,v in results[name].items() if k!='rows'});break
        except PermissionError:raise
        except Exception:
            if attempt==2:raise
            time.sleep(2*(attempt+1))
    print(name,len(rows),flush=True)
    time.sleep(.25)
(out/'szse.json').write_text(json.dumps(results,ensure_ascii=False),encoding='utf8')
(out/'szse_audit.json').write_text(json.dumps(evidence,ensure_ascii=False),encoding='utf8')
