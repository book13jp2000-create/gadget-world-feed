// 11/16 本人「株価など変動が見えるものも全部、過去を遡れるようにしたい」→ 株価ボードのグラフで期間（1年・5年・全期間）を選べるように、
// stocks.js と同じ銘柄の長い終値を Yahoo Finance の chart API から取り、期間ごとの JSON に分けて書き出す（ワールドは選んだ期間の1本だけを読む）。
//   out/stocks-1y.json（週ごと、約52点）・stocks-5y.json（月ごと、約60点）・stocks-max.json（月ごと、上場から。80点まで間引く）
// 形：{ v:1, range, updated, groups:[{ id, items:[{ s, d0:最初の日, d1:最後の日, m:[終値...] }] }] }（groups・items の順は stocks.json と同じ）
// 使い方: node history.js [出力先フォルダ]   1日1回（history.yml）。外部パッケージは使わない
const fs = require('fs');
const path = require('path');
const { GROUPS } = require('./stocks-list.js');
const outDir = process.argv[2] || path.join(__dirname, 'out');
const RANGES = [
  { id: '1y', range: '1y', interval: '1wk', max: 60 },
  { id: '5y', range: '5y', interval: '1mo', max: 62 },
  { id: 'max', range: 'max', interval: '1mo', max: 80 },
];
const ymd = (t) => { const d = new Date(t * 1000 + 9 * 3600e3); return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const round = (v) => (v == null || !isFinite(v) ? null : v >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

// 点を max 個に間引く（最初と最後は残す）
function thin(ts, vs, max) {
  if (vs.length <= max) return [ts, vs];
  const t2 = [], v2 = [];
  for (let i = 0; i < max; i++) { const k = Math.round((i * (vs.length - 1)) / (max - 1)); t2.push(ts[k]); v2.push(vs[k]); }
  return [t2, v2];
}

async function fetchOne(sym, r) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${r.range}&interval=${r.interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (gadget-world-feed)' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${sym} ${r.id}: HTTP ${res.status}`);
  const j = await res.json();
  const x = j.chart && j.chart.result && j.chart.result[0];
  if (!x) throw new Error(`${sym} ${r.id}: 結果なし`);
  const raw = (x.indicators.adjclose && x.indicators.adjclose[0] && x.indicators.adjclose[0].adjclose) || x.indicators.quote[0].close || [];
  const ts = [], vs = [];
  (x.timestamp || []).forEach((t, i) => { if (raw[i] != null && isFinite(raw[i])) { ts.push(t); vs.push(raw[i]); } });
  if (vs.length < 2) throw new Error(`${sym} ${r.id}: 点が足りない`);
  return thin(ts, vs, r.max);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const short = (sym) => sym.replace(/\.(T|TW|KS|HK|DE)$/, '').replace(/^\^/, '').replace(/=X$/, '');
  let bad = 0, total = 0;
  for (const r of RANGES) {
    const groups = [];
    for (const g of GROUPS) {
      const items = [];
      for (const [sym] of g.list) {
        total++;
        try { const [ts, vs] = await fetchOne(sym, r); items.push({ s: short(sym), d0: ymd(ts[0]), d1: ymd(ts[ts.length - 1]), m: vs.map(round) }); }
        catch (e) { bad++; console.error('失敗', e.message); items.push({ s: short(sym), d0: '', d1: '', m: [] }); }
        await new Promise((res) => setTimeout(res, 300));
      }
      groups.push({ id: g.id, items });
    }
    const out = { v: 1, range: r.id, updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), groups };
    fs.writeFileSync(path.join(outDir, `stocks-${r.id}.json`), JSON.stringify(out));
    console.log(`stocks-${r.id}.json`, (JSON.stringify(out).length / 1024).toFixed(1) + 'KB');
  }
  if (bad > total * 0.3) { console.error(`取れなかった銘柄が多い（${bad}/${total}）ので失敗にする`); process.exit(1); }
})();
