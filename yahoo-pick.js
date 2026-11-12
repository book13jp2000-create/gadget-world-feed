// Yahoo!ショッピングの商品検索（v3）から「その品目のふつうの最安値」を選ぶ（parts.js と flyer.js で共通）。
// 11/13 の初回で、ただの最安値だと次のような物を拾った → 選び方を変えた：
//  ・並行輸入・訳あり・代引き不可の転売・【即納】の上乗せ店（RTX 5090 が 118 万円など）→ 名前にその言葉がある物は外す
//  ・容量違いをまとめた出品（「256GB 512GB 1TB」で、いちばん安い 256GB の値段）→ 決めた容量が名前にあり、ほかの容量が並んでいない物だけ
//  ・メモリの組（16GB×2 と 8GB×2 が混ざる）→ 決めた組だけ
//  ・とても安い・とても高いはずれ値 → 関連度順の上位で条件に合う物の値段の真ん中（中央値）を求め、その 0.6〜1.8 倍の中で最安を選ぶ
// spec：{ q:検索語, re:名前に必ず合う正規表現, not?:外す正規表現, min, max, cap?:'1TB' など, kit?:'16GBx2' など }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 転売・状態の悪い物・並行輸入など（名前にあれば外す）
const BAD = /並行輸入|輸入品|訳あり|わけあり|中古|ジャンク|代引き?不可|即納|アウトレット|開封品|展示品|B級|再生品|リファービッシュ|整備済|互換|未使用品|保証なし|海外版|国内未発売|プレミア|転売|メーカー保証無/;
const STORAGE = [128, 256, 500, 512, 1000, 2000, 4000, 8000]; // GB（1TB＝1000）

function capsIn(name) {
  const out = new Set();
  for (const m of name.matchAll(/(\d+(?:\.\d+)?)\s*(GB|TB)(?![a-z\/])/gi)) {
    const v = parseFloat(m[1]) * (m[2].toUpperCase() === 'TB' ? 1000 : 1);
    if (STORAGE.includes(Math.round(v))) out.add(Math.round(v));
  }
  return out;
}
const toGB = (s) => { const m = /^(\d+(?:\.\d+)?)\s*(GB|TB)$/i.exec(s); return m ? Math.round(parseFloat(m[1]) * (m[2].toUpperCase() === 'TB' ? 1000 : 1)) : 0; };

// 容量：決めた容量があり、ほかの（記憶装置の）容量が並んでいない
function capOk(name, cap) {
  if (!cap) return true;
  const want = toGB(cap), got = capsIn(name);
  return got.has(want) && [...got].every((v) => v === want);
}

// メモリの組：'16GBx2' → 16GB×2・16GB 2枚 などがあり、ほかの組（8GB×2 など）が無い
function kitOk(name, kit) {
  if (!kit) return true;
  const [, size, n] = /^(\d+)GBx(\d)$/.exec(kit);
  const kits = [...name.matchAll(/(\d+)\s*GB\s*(?:[x×*＊]\s*(\d)|(\d)\s*枚)/gi)].map((m) => `${m[1]}x${m[2] || m[3]}`);
  const rev = [...name.matchAll(/(\d)\s*[x×*＊]\s*(\d+)\s*GB/gi)].map((m) => `${m[2]}x${m[1]}`);
  const all = new Set(kits.concat(rev));
  return all.has(`${size}x${n}`) && [...all].every((k) => k === `${size}x${n}`);
}

async function getJson(u) {
  for (let t = 0; t < 4; t++) {
    const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (res.status === 429) { await sleep(8000 * (t + 1)); continue; } // 混んでいるときは長めに待って取り直す
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('HTTP 429 が続いた');
}

async function search(appid, spec, sort, start) {
  const u = new URL('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch');
  u.search = new URLSearchParams({ appid, query: spec.q, sort, in_stock: 'true', condition: 'new', results: '50', start: String(start), price_from: String(spec.min), price_to: String(spec.max) }).toString();
  const j = await getJson(u);
  return j.hits || [];
}

function fits(h, spec) {
  const nm = String(h.name || '').normalize('NFKC');
  const p = Number(h.price);
  return Number.isFinite(p) && p >= spec.min && p <= spec.max && spec.re.test(nm) && !(spec.not && spec.not.test(nm)) && !BAD.test(nm) && capOk(nm, spec.cap) && kitOk(nm, spec.kit);
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// 返す物：{ p, name, url, shop, n（条件に合った件数）, med（中央値） }。合う物が無ければ null
async function robustLowest(appid, spec, gap = 1600) {
  const byScore = await search(appid, spec, '-score', 1); await sleep(gap);
  const cheap1 = await search(appid, spec, '+price', 1); await sleep(gap);
  let cheap = cheap1;
  if (cheap1.length === 50) { cheap = cheap.concat(await search(appid, spec, '+price', 51)); await sleep(gap); }
  const seen = new Set(); const all = [];
  for (const h of byScore.concat(cheap)) { const k = h.code || h.url || h.name; if (seen.has(k)) continue; seen.add(k); if (fits(h, spec)) all.push(h); }
  if (all.length === 0) return null;
  const ref = byScore.filter((h) => fits(h, spec)).map((h) => Number(h.price));
  const med = median(ref.length >= 3 ? ref : all.map((h) => Number(h.price)));
  const band = all.filter((h) => Number(h.price) >= med * 0.6 && Number(h.price) <= med * 1.8);
  const pick = (band.length ? band : all).sort((a, b) => Number(a.price) - Number(b.price))[0];
  return { p: Number(pick.price), name: String(pick.name || '').slice(0, 120), url: pick.url || '', shop: (pick.seller && pick.seller.name) || '', n: all.length, med: Math.round(med) };
}

module.exports = { robustLowest, capOk, kitOk, BAD };
