import io,json,hashlib
from datetime import datetime,timezone
import requests,pandas as pd
jobs=[('directory','https://fund.szse.cn/api/report/ShowReport',{'SHOWTYPE':'xlsx','CATALOGID':'1000_lf','TABKEY':'tab1'}),('shares','https://www.szse.cn/api/report/ShowReport',{'SHOWTYPE':'xlsx','CATALOGID':'scsj_fund_jjgm','TABKEY':'tab1','txtStart':'2026-11-12','txtEnd':'2026-11-13','jjlb':'ETF'})]
results=[]
for name,url,params in jobs:
    try:
        r=requests.get(url,params=params,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.szse.cn/market/fund/volume/etf/index.html'},timeout=45)
        r.raise_for_status()
        df=pd.read_excel(io.BytesIO(r.content))
        assert 0<len(df)<65535
        result={'name':name,'ok':True,'status':r.status_code,'rows':len(df),'columns':list(df.columns),'sha256':hashlib.sha256(r.content).hexdigest()}
    except Exception as e:result={'name':name,'ok':False,'error':str(e)}
    results.append(result);print(json.dumps(result))
with open('szse-probe-results.json','w') as f:json.dump({'at':datetime.now(timezone.utc).isoformat(),'results':results},f)
assert all(x['ok'] for x in results)
