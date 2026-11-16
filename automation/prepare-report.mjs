import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Generate a public-only artifact. Never copy the surrounding research workspace.
const args = process.argv.slice(2);
const argument = (name) => args[args.indexOf(name) + 1];
if (args.length !== 4 || !args.includes('--input') || !args.includes('--date')) {
  throw new Error('Usage: node prepare-public.mjs --input <report.html> --date YYYY-MM-DD');
}
const reportDate = argument('--date');
if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || new Date(reportDate).toISOString().slice(0, 10) !== reportDate) throw new Error('Invalid report date');
const input = resolve(argument('--input'));
let html = readFileSync(input, 'utf8');
if (!html.includes(reportDate) || !/<meta[^>]+charset=["']?utf-8/i.test(html)) throw new Error('Report date or UTF-8 declaration missing');
html = html.replace(/<main class="legacy">[\s\S]*?<\/main>\s*/, '');
const obsoleteStart = html.indexOf('  document.querySelectorAll(".flow-svg")');
const newChartsStart = html.indexOf('  const SVG_NS=');
if (obsoleteStart >= 0) {
  if (newChartsStart < obsoleteStart) throw new Error('Unexpected legacy chart structure; preserve the previous live version');
  html = html.slice(0, obsoleteStart) + html.slice(newChartsStart);
}
// Historical corrections apply only to this one archived source revision.
if (reportDate === '2026-11-04') {
  html = html.replace('母体中国神华20.29亿股不变', '国新投资持中国能建20.29亿股不变');
  html = html.replace('<b>华能水电：</b>', '<b>华能蒙电：</b>');
  html = html.replace('<td>9/7公告</td><td><span class="badge a">A</span>', '<td>9/7公告摘要</td><td><span class="badge b">B</span>');
}
if (!/<meta[^>]+name=["']description["']/i.test(html)) html = html.replace('</title>', '</title>\n  <meta name="description" content="国家队资金雷达：ETF市场申赎、机构可见持仓和交互式长中短期资金趋势。公开来源，区分事实与估算。">');
html = html.replace(/<span class="pill">当前为\d{4}-\d{2}-\d{2}快照 · 非实时行情<\/span>/g, '');
html = html.replace('公开来源 · 非投资建议</span>', '公开来源 · 非投资建议</span><span class="pill">当前为' + reportDate + '快照 · 非实时行情</span>');

const forbidden = [/\/Users\//, /file:\/\//i, /<script[^>]+src\s*=/i, /<link[^>]+stylesheet/i, /\b(?:10|192\.168|127)\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b/, /(?:api[_-]?key|bearer|password)\s*[:=]\s*["'][^"']{8,}/i];
for (const re of forbidden) if (re.test(html)) throw new Error('Public artifact safety check failed: ' + re);
if ((html.match(/<main/g) || []).length !== 1) throw new Error('Expected one public main');
const js = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!js) throw new Error('Missing inline charts');
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/type=["']application\/(?:ld\+)?json["']/i.test(match[1])) JSON.parse(match[2]);
  else new Function(match[2]);
}
for (const label of ['无法按账户归因', 'ETF', '机构']) if (!html.includes(label)) throw new Error('Required attribution boundary missing: ' + label);
if (/原23|旧23|原池|旧池|"legacy"|oldPool|oldCoverage|revisionOldPool/.test(html)) throw new Error('Removed historical comparison pool must not be published');
for (const range of ['2y','3y','5y']) if (!html.includes('data-bar-range="'+range+'"') || !html.includes('data-cum-range="'+range+'"')) throw new Error('Long history range missing: '+range);
const reviewedMatch=html.match(/<script id="reviewedData" type="application\/json">([\s\S]*?)<\/script>/);
if (!reviewedMatch) throw new Error('Reviewed data missing');
const reviewed=JSON.parse(reviewedMatch[1]);
if (reviewed.reportDate!==reportDate || reviewed.asOf>reportDate || Object.keys(reviewed.indices||{}).join(',')!=='sh,cy,star50,hs300,zz500,zz1000') throw new Error('Report date or six-index order mismatch');
if (!html.includes('id="showCumulative" checked') || !html.includes('id="barCumLines"') || !html.includes('id="targetSelect"') || reviewed.productHistory?.dates.at(-1)!==reviewed.asOf) throw new Error('Cumulative overlay/ETF scope/history missing');
if(reportDate>='2026-11-10'&&(!html.includes('id="barTip" class="chart-tooltip"')||!html.includes('background:rgba(255,255,255,.68)')||!html.includes('id="showRatioOverlay"')||!html.includes('id="ratioOverlaySeries"')||!html.includes('id="ratioOverlayLines"')||!html.includes('独立0–100%')||!html.includes('较区间起点')))throw new Error('Compact translucent tooltip or optional rank overlay missing');
if (reportDate >= '2026-11-10') {
  const r=reviewed.ratio252,last=r?.rows?.findLast(x=>Number.isFinite(x.percentile));
  if (!r || r.asOf!==reviewed.asOf || r.lookback!==252 || r.lookbackIncludesCurrent!==false || r.tieMethod!=='midrank' || r.rows.at(-1)?.date!==reviewed.asOf || r.rows.some(x=>x.date>reviewed.asOf) || !last || last.date!==r.ratioAsOf || r.latest?.date!==last.date || last.lookbackCount!==252) throw new Error('HS300 ratio history/definition/cutoff missing');
  if (r.denominatorAsOf>reviewed.asOf || r.numeratorAsOf!==reviewed.asOf || Math.abs(last.ratioPct-last.netAssetsYi/last.circulatingMarketCapYi*100)>1e-10 || r.rows.some(x=>x.date>r.denominatorAsOf&&(x.ratioPct!==null||x.percentile!==null))) throw new Error('HS300 same-day ratio or missing-data boundary mismatch');
  for(const id of['showRatioOverlay','ratioOverlaySeries','ratioFreshness','ratioScopeNote','chartSettings','trendMethod'])if(!html.includes('id="'+id+'"'))throw new Error('HS300 main-chart control/freshness/method missing '+id);
  if(/id="(?:ratioSvg|ratioPanel|showRatio252|showFourRatio252)"/.test(html))throw new Error('Removed independent percentile subplot must not return');
  if(!html.includes('与资金范围筛选独立')||!html.includes('四只规模'))throw new Error('Fixed-index scope or scale switch missing');
  const f=reviewed.fourEtfStudy;
  if(!f||f.asOf!==reviewed.asOf||f.ratioAsOf>f.asOf||f.rows.at(-1)?.date!==f.asOf||f.codes.join(',')!=='510300,510310,510330,159919'||f.status!=='engine_aligned_source_fingerprints_not_exact')throw new Error('Reviewed fixed-four comparison missing or dates invalid');
  if(!f.definitions.rank.includeCurrent||!html.includes('id="fourRatioBasis"')||!html.includes('hs300_four_etf_backtest.html'))throw new Error('Fixed-four original-rank controls/report link missing');
  for(const x of f.rows){if(x.date>f.ratioAsOf&&(x.marketRank!==null||x.marketRatioPct!==null))throw new Error('Fixed-four denominator gap filled');if(Number.isFinite(x.marketRatioPct)&&Math.abs(x.marketRatioPct-x.marketAssetsYi/x.circulatingMarketCapYi*100)>1e-10)throw new Error('Fixed-four same-day formula mismatch');}
}
for (const index of Object.values(reviewed.indices)) if (!index.rows?.length || index.rows.some(r=>r[0]>reviewed.asOf)) throw new Error('Invalid index dates');
if (Buffer.byteLength(html) < 10000) throw new Error('Report appears incomplete');
const artifactSha256 = createHash('sha256').update(html).digest('hex');
mkdirSync('public', { recursive: true });
writeFileSync('public/index.html', html, 'utf8');
writeFileSync('public/national_team_capital_monitor_' + reportDate + '.html', html, 'utf8');
writeFileSync('public/site-status.json', JSON.stringify({ report_date: reportDate, prepared_at: new Date().toISOString(), artifact_sha256: artifactSha256, realtime: false }) + '\n', 'utf8');
console.log(JSON.stringify({ report_date: reportDate, artifact_sha256: artifactSha256, bytes: Buffer.byteLength(html), checks: 'passed' }));
