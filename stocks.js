// 米国テック株と日本のテック・半導体株の価格を Yahoo Finance の chart API から取り、out/stocks.json に書き出す。
// 11/9 夜 本人「US だけじゃなくて日本のテック企業や半導体関連企業もしっかり出してほしい」→ v2：groups に US と JP
// 使い方: node stocks.js [出力先フォルダ]   （Node 18 以上。外部パッケージは使わない）
// VRChat の StockBoard（Assets/Proto/Udon/StockBoard.cs）がこの JSON を VRCStringDownloader で読む。
const fs = require('fs');
const path = require('path');

// 名前は板の字体（英数字だけ）に合わせて英字。記号は板に出す短い呼び名（日本株は証券コード）
const GROUPS = [
  { id: 'US', title: 'US TECH STOCKS', cur: '$', dec: 2, list: [
    ['NVDA', 'NVIDIA'], ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['INTC', 'Intel'],
    ['AMD', 'AMD'], ['TSM', 'TSMC'], ['GOOGL', 'Alphabet'], ['META', 'Meta'],
    ['AMZN', 'Amazon'], ['TSLA', 'Tesla'],
  ] },
  { id: 'JP', title: 'JAPAN TECH & CHIPS', cur: 'JPY', dec: 0, list: [
    ['8035.T', 'Tokyo Electron'], ['6857.T', 'Advantest'], ['6920.T', 'Lasertec'], ['6146.T', 'Disco'],
    ['285A.T', 'Kioxia'], ['6723.T', 'Renesas'], ['4063.T', 'Shin-Etsu Chem'], ['6758.T', 'Sony Group'],
    ['9984.T', 'SoftBank Group'], ['7974.T', 'Nintendo'],
  ] },
  // 11/10 本人「半導体や VR 関連の ETF も入れていいんじゃない？」→ ガジェットに関係する ETF を米国・日本から10本。
  // 板の字体は英数字だけなので名前は英字（(US)・(JP) で上場先を示す）。価格は通貨が混ざるので小数なし・通貨なし（記号が英字なら米ドル、数字なら円）
  // VR 関連の米国 ETF「VR」は上場廃止で取れないので、メタバースの METV
  { id: 'ETF', title: 'GADGET ETF', cur: '', dec: 0, list: [
    ['SOXX', 'Semis (US)'], ['SMH', 'Semis VanEck (US)'], ['2644.T', 'Semis (JP)'], ['METV', 'Metaverse/VR (US)'],
    ['VGT', 'Info Tech (US)'], ['2854.T', 'Tech Top20 (JP)'], ['HERO', 'Games/eSports (US)'], ['2640.T', 'Games/Anime (JP)'],
    ['BOTZ', 'Robotics/AI (US)'], ['1625.T', 'Electronics (JP)'],
  ] },
];
const outDir = process.argv[2] || path.join(__dirname, 'out');

const round = (v, d) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

async function fetchOne(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=10d&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (gadget-world-feed)' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${sym}: HTTP ${res.status}`);
  const j = await res.json();
  const r = j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error(`${sym}: 結果なし`);
  const m = r.meta;
  const closes = (r.indicators.quote[0].close || []).filter((v) => v != null);
  const price = m.regularMarketPrice ?? closes[closes.length - 1];
  let pct = m.regularMarketChangePercent;
  if (pct == null && closes.length >= 2) pct = (price / closes[closes.length - 2] - 1) * 100;
  if (price == null || !isFinite(price)) throw new Error(`${sym}: 価格なし`);
  return { m, price, pct, closes: closes.slice(-5) };
}

function marketState(m, nowSec) {
  const p = m.currentTradingPeriod;
  if (!p || !p.regular || !p.pre || !p.post) return 'unknown';
  if (nowSec >= p.regular.start && nowSec < p.regular.end) return 'open';
  if (nowSec >= p.pre.start && nowSec < p.pre.end) return 'pre';
  if (nowSec >= p.post.start && nowSec < p.post.end) return 'post';
  return 'closed';
}

async function fetchGroup(g, nowSec) {
  const items = [];
  let state = 'unknown', ok = 0, lastTrade = 0;
  for (const [sym, name] of g.list) {
    const short = sym.replace(/\.T$/, '');
    try {
      const { m, price, pct, closes } = await fetchOne(sym);
      if (state === 'unknown') state = marketState(m, nowSec);
      if (m.regularMarketTime > lastTrade) lastTrade = m.regularMarketTime;
      items.push({ s: short, n: name, p: round(price, g.dec), c: round(pct, 2), h: closes.map((v) => round(v, g.dec)) });
      ok++;
    } catch (e) {
      console.error('失敗', e.message);
      items.push({ s: short, n: name, p: null, c: null, h: [] });
    }
    await new Promise((r) => setTimeout(r, 300)); // 相手に負担をかけない
  }
  return { items, state, ok, lastTrade };
}

(async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  const fmt = (d) => `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const groups = [];
  let okAll = 0, total = 0;
  for (const g of GROUPS) {
    const r = await fetchGroup(g, nowSec);
    okAll += r.ok; total += g.list.length;
    groups.push({ id: g.id, title: g.title, cur: g.cur, dec: g.dec, market: r.state, trade: r.lastTrade ? fmt(new Date(r.lastTrade * 1000 + 9 * 3600e3)) : '', ok: r.ok, items: r.items });
  }
  // 半分以上取れなかった回は書き出さない（Actions は失敗になり、Pages には前の回の JSON が残る）
  // どちらかの市場で 7 割取れなかった回は書き出さない（前の回の JSON が残る。片方の面が全部 -- にならないように）
  const bad = groups.filter((g) => g.ok < Math.ceil(g.items.length * 0.7)).map((g) => `${g.id}:${g.ok}/${g.items.length}`);
  if (bad.length) { console.error(`取れた銘柄が少ないので書き出さない（${bad.join(' ')}）`); process.exit(1); }
  const out = {
    v: 2,
    updated: now.toISOString().replace(/\.\d+Z$/, 'Z'),
    jst: fmt(new Date(now.getTime() + 9 * 3600e3)), // 取りに行った時刻（日本時間）
    source: 'Yahoo Finance',
    groups, // 各 group：{ id, title, cur, dec(小数の桁), market(open/pre/post/closed), trade(最新の取引の時刻・日本時間), ok, items:[{ s, n, p, c, h }] }
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'stocks.json'), JSON.stringify(out));
  console.log(`${okAll}/${total} 銘柄 → ${path.join(outDir, 'stocks.json')}（${groups.map((g) => g.id + ':' + g.market).join(' ')}）`);
})();
