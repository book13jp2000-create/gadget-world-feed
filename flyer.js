// 週刊チラシ「ガジェット愛好会 週刊 ガジェット特価まつり」を作る（1448×2048 の PNG）。毎週土曜の朝に Actions が動かす（flyer.yml）。
// 11/10 本人：量販店のチラシ風に、PCパーツだけでなく家電も含めたガジェット全般をジャンル別に、にぎやかに、絵入りで。
//  ・8 ジャンル × 5 品。ジャンルごとに候補の品目（下の GENRES）の今週の最安値を取り、先週より下がった割合の大きい順に 5 品。1 つ目が目玉
//  ・価格は Yahoo!ショッピングの商品検索（v3）。RAKUTEN_APP_ID があれば楽天市場も見て安い方（どちらで見たかを小さく出す）
//  ・商品写真は使わない（両 API の規約で、取得した画像を画像に焼き込んで別の場所で見せてよいとはっきり書かれていないため）。絵は自作のイラスト（flyer-icons.js、Codex が作った SVG）
//  ・YAHOO_APPID が無いうちは、価格を出さない「準備中」のチラシを作る（作り物の値段は出さない）
//  ・ワールドの板（Assets/Proto/Udon/FlyerBoard.cs）は、ジャンルの枠の位置（LAYOUT）を使って1ジャンルを大きく出す。枠を動かしたら板の数字も直す
// 使い方: [YAHOO_APPID=…] [RAKUTEN_APP_ID=…] [PREV_FILE=前回の flyer-history.json] node flyer.js [出力先]
//   出力：flyer.png（チラシ）・flyer.html（元の HTML）・flyer.json（中身）・flyer-history.json（品目ごとの週の最安値。次の週の比較に使う）
//   Chrome：環境変数 CHROME、無ければ Mac の Google Chrome、Linux の google-chrome
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ICONS = require('./flyer-icons.js');

const W = 1448, H = 2048;
// ワールドの板が使う枠（px）。ヘッダー 330、下の帯 90、その間に 4列×2段
const LAYOUT = { head: 330, foot: 90, pad: 12, gap: 10, cols: 4, rows: 2 };

const NOT = /中古|ジャンク|訳あり|修理|部品|交換用|互換|ケース|カバー|フィルム|保護|ストラップ|スタンド単体|レンタル|シール|ステッカー|説明書|空箱|整備済|リファービッシュ|アクセサリ|対応(?!.*本体)/;
// ジャンル：名前・色・候補の品目（id、出す名前、絵、検索語、名前に必ず含む語（正規表現）、価格の下限・上限）
const GENRES = [
  { id: 'pc', n: 'PCパーツ', c: '#e60012', items: [
    ['gpu5080', 'RTX 5080 グラボ', 'gpu', 'RTX 5080 グラフィックボード', /RTX\s*5080(?![0-9A-Z])/i, 120000, 600000],
    ['gpu5070', 'RTX 5070 グラボ', 'gpu', 'RTX 5070 グラフィックボード', /RTX\s*5070(?!\s*Ti)(?![0-9A-Z])/i, 60000, 300000],
    ['gpu9070xt', 'RX 9070 XT グラボ', 'gpu', 'Radeon RX 9070 XT', /RX\s*9070\s*XT/i, 70000, 300000],
    ['cpu9800', 'Ryzen 7 9800X3D', 'cpu', 'Ryzen 7 9800X3D BOX', /9800X3D/i, 50000, 200000],
    ['cpu265k', 'Core Ultra 7 265K', 'cpu', 'Core Ultra 7 265K BOX', /265K(?!F)/i, 35000, 150000],
    ['ddr5', 'DDR5 32GB メモリ', 'memory', 'DDR5 32GB 16GB 2枚組 デスクトップ', /DDR5(?=[\s\S]*(16GB\s*[x×*]\s*2|16GB\s*2枚|2\s*[x×]\s*16GB))(?![\s\S]*(SO-?DIMM|ノート))/i, 8000, 120000],
    ['ssd2tb', 'NVMe SSD 2TB', 'ssd', 'NVMe SSD 2TB M.2 Gen4', /(?<![0-9])2\s*TB(?=[\s\S]*(NVMe|M\.2))(?![\s\S]*(外付け|ポータブル|USB|SATA))/i, 10000, 120000],
    ['psu850', '850W 電源 GOLD', 'psu', '電源ユニット 850W 80PLUS GOLD ATX', /850\s*W[\s\S]*GOLD|GOLD[\s\S]*850\s*W/i, 8000, 60000],
    ['aio360', '360mm 簡易水冷', 'cooler', '簡易水冷 CPUクーラー 360mm', /360\s*mm[\s\S]*(水冷|AIO)|(水冷|AIO)[\s\S]*360\s*mm/i, 8000, 60000],
  ] },
  { id: 'sp', n: 'スマホ・タブレット', c: '#0050b4', items: [
    ['iphone', 'iPhone 17 256GB', 'phone', 'iPhone 17 256GB SIMフリー 本体', /iPhone\s*17(?!\s*(Pro|Air|e))[\s\S]*256\s*GB/i, 80000, 300000],
    ['pixel', 'Google Pixel 10 128GB', 'phone', 'Google Pixel 10 本体 SIMフリー 128GB', /Pixel\s*10(?!\s*(Pro|a))[\s\S]*128\s*GB/i, 60000, 250000],
    ['ipad', 'iPad（第11世代）128GB', 'tablet', 'iPad 第11世代 Wi-Fi 128GB', /iPad(?!\s*(Pro|Air|mini))[\s\S]*(第11世代|A16)[\s\S]*128\s*GB|128\s*GB[\s\S]*iPad(?!\s*(Pro|Air|mini))[\s\S]*(第11世代|A16)/i, 40000, 150000],
    ['androidtab', 'Android タブレット 11型', 'tablet', 'Androidタブレット 11インチ', /(Android|アンドロイド)[\s\S]*11(\.\d)?\s*(インチ|型)|11(\.\d)?\s*(インチ|型)[\s\S]*(Android|アンドロイド)/i, 15000, 120000],
    ['watch', 'Apple Watch Series 11 GPS', 'watch', 'Apple Watch Series 11 GPS', /Apple\s*Watch\s*Series\s*11(?![\s\S]*Cellular)[\s\S]*GPS/i, 40000, 150000],
    ['battery', 'モバイルバッテリー 10000mAh', 'battery', 'モバイルバッテリー 10000mAh PD', /10000\s*mAh/i, 1500, 15000],
    ['charger', 'USB 充電器 65W', 'charger', 'USB-C 充電器 65W GaN', /65\s*W/i, 2000, 15000],
  ] },
  { id: 'pcs', n: 'パソコン・周辺', c: '#008a3a', items: [
    ['macbook', 'MacBook Air 13型 M4 256GB', 'laptop', 'MacBook Air 13インチ M4 256GB', /MacBook\s*Air(?=[\s\S]*13)(?=[\s\S]*M4)(?=[\s\S]*256\s*GB)/i, 100000, 400000],
    ['note14', 'ノートPC 14型 16GB', 'laptop', 'ノートパソコン 14インチ Core Ultra 16GB', /14(\.\d)?\s*(インチ|型)[\s\S]*16\s*GB|16\s*GB[\s\S]*14(\.\d)?\s*(インチ|型)/i, 60000, 300000],
    ['mon4k', '27型 4K モニター', 'monitor', '4K モニター 27インチ', /27(\.\d)?\s*(インチ|型)[\s\S]*(4K|3840)|(4K|3840)[\s\S]*27(\.\d)?\s*(インチ|型)/i, 25000, 150000],
    ['mechkb', 'メカニカルキーボード', 'keyboard', 'メカニカルキーボード', /キーボード/, 5000, 50000],
    ['gmouse', 'ゲーミングマウス 無線', 'mouse', 'ゲーミングマウス ワイヤレス', /マウス/, 3000, 30000],
    ['webcam', 'Webカメラ', 'webcam', 'Webカメラ フルHD', /Web\s*カメラ|ウェブカメラ/i, 2000, 40000],
    ['printer', 'インクジェット複合機', 'printer', 'インクジェット複合機 A4', /複合機/, 8000, 80000],
  ] },
  { id: 'audio', n: 'オーディオ', c: '#7a2bbf', items: [
    ['nchp', 'ノイキャン ヘッドホン', 'headphones', 'ノイズキャンセリング ワイヤレスヘッドホン', /ヘッドホン|ヘッドフォン/, 10000, 80000],
    ['tws', '完全ワイヤレスイヤホン', 'earbuds', '完全ワイヤレスイヤホン ノイズキャンセリング', /イヤホン/, 5000, 50000],
    ['airpods', 'AirPods Pro', 'earbuds', 'AirPods Pro 3', /AirPods\s*Pro/i, 25000, 60000],
    ['soundbar', 'サウンドバー', 'soundbar', 'サウンドバー Dolby Atmos', /サウンドバー/, 10000, 150000],
    ['btspk', 'Bluetooth スピーカー', 'speaker', 'Bluetoothスピーカー 防水', /スピーカー/, 3000, 50000],
    ['usbmic', 'USB マイク', 'mic', 'USBマイク 配信', /マイク/, 3000, 40000],
  ] },
  { id: 'camera', n: 'カメラ', c: '#222222', items: [
    ['mirrorless', 'ミラーレス一眼', 'camera', 'ミラーレス一眼 ボディ フルサイズ', /ミラーレス/, 100000, 600000],
    ['actioncam', 'アクションカメラ', 'actioncam', 'アクションカメラ 4K', /アクションカメラ|GoPro|Osmo/i, 20000, 100000],
    ['drone', '小型ドローン', 'drone', 'DJI Mini ドローン', /DJI\s*Mini/i, 40000, 250000],
    ['lens', '望遠ズームレンズ', 'lens', '望遠ズームレンズ 70-200mm', /70-?200/, 50000, 400000],
    ['sd256', 'SDカード 256GB', 'sdcard', 'SDXCカード 256GB UHS-I', /256\s*GB/i, 2000, 20000],
    ['instax', 'チェキ', 'camera', 'instax mini 12 チェキ', /instax|チェキ/i, 8000, 30000],
  ] },
  { id: 'game', n: 'ゲーム・VR', c: '#ff7a00', items: [
    ['quest3', 'Meta Quest 3', 'vr', 'Meta Quest 3 512GB', /Quest\s*3(?!S)/i, 50000, 120000],
    ['quest3s', 'Meta Quest 3S', 'vr', 'Meta Quest 3S 128GB', /Quest\s*3S/i, 30000, 80000],
    ['switch2', 'Nintendo Switch 2', 'handheld', 'Nintendo Switch 2 本体', /Switch\s*2/i, 40000, 100000],
    ['ps5', 'PlayStation 5', 'controller', 'PlayStation 5 本体', /PlayStation\s*5|PS5/i, 50000, 150000],
    ['pad', 'ゲームコントローラー', 'controller', 'ワイヤレスコントローラー PC', /コントローラー/, 3000, 30000],
    ['ghs', 'ゲーミングヘッドセット', 'headset', 'ゲーミングヘッドセット', /ヘッドセット/, 3000, 40000],
    ['gchair', 'ゲーミングチェア', 'gamechair', 'ゲーミングチェア', /チェア/, 10000, 80000],
  ] },
  { id: 'home', n: '生活家電', c: '#00a0c8', items: [
    ['robovac', 'ロボット掃除機', 'robotvac', 'ロボット掃除機 水拭き', /ロボット掃除機/, 20000, 200000],
    ['stickvac', 'コードレス掃除機', 'vacuum', 'コードレス掃除機 スティック', /掃除機/, 10000, 100000],
    ['purifier', '空気清浄機', 'purifier', '空気清浄機 加湿', /空気清浄機/, 10000, 100000],
    ['washer', 'ドラム式洗濯機', 'washer', 'ドラム式洗濯乾燥機', /ドラム/, 100000, 400000],
    ['bulb', 'スマート電球', 'bulb', 'スマート電球 E26', /電球/, 1000, 10000],
    ['remote', 'スマートリモコン', 'remote', 'スマートリモコン', /リモコン/, 2000, 20000],
  ] },
  { id: 'kitchen', n: 'キッチン家電', c: '#c4000f', items: [
    ['oven', 'オーブンレンジ', 'microwave', 'オーブンレンジ 30L', /オーブンレンジ/, 20000, 150000],
    ['coffee', '全自動コーヒーメーカー', 'coffee', '全自動コーヒーメーカー ミル付き', /コーヒーメーカー/, 8000, 100000],
    ['rice', 'IH 炊飯器 5.5合', 'ricecooker', 'IH炊飯器 5.5合', /炊飯器/, 10000, 120000],
    ['kettle', '電気ケトル', 'kettle', '電気ケトル 温度調節', /ケトル/, 2000, 20000],
    ['blender', 'ブレンダー', 'blender', 'ハンドブレンダー', /ブレンダー/, 2000, 30000],
    ['toaster', 'トースター', 'toaster', 'オーブントースター 4枚', /トースター/, 3000, 40000],
  ] },
];

const args = process.argv.slice(2);
const DEMO = args.includes('--demo'); // 手元で並びを確かめるだけ（作り物の価格。「見本」の判を押す。Actions では使わない）
const outDir = args.filter((a) => !a.startsWith('--'))[0] || path.join(__dirname, 'out');
const APPID = process.env.YAHOO_APPID;
const RAKUTEN = process.env.RAKUTEN_APP_ID;
const PREV_FILE = process.env.PREV_FILE || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jstNow = () => new Date(Date.now() + 9 * 3600e3);
const ymd = (d) => d.toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const yen = (v) => v.toLocaleString('ja-JP');

async function getJson(u) {
  for (let t = 0; t < 3; t++) {
    const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (res.status === 429) { await sleep(5000 * (t + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('HTTP 429 が続いた');
}

// Yahoo!ショッピング：安い順に最大2ページ（100件）見て、条件に合う最初の物
async function yahoo(spec) {
  const [, , , q, re, min, max] = spec;
  for (let page = 0; page < 2; page++) {
    const u = new URL('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch');
    u.search = new URLSearchParams({ appid: APPID, query: q, sort: '+price', in_stock: 'true', condition: 'new', results: '50', start: String(1 + page * 50), price_from: String(min), price_to: String(max) }).toString();
    const j = await getJson(u);
    const list = j.hits || [];
    const h = list.find((x) => { const nm = String(x.name || '').normalize('NFKC'); return re.test(nm) && !NOT.test(nm) && x.price >= min && x.price <= max; });
    if (h) return { p: h.price, src: 'Yahoo!', name: String(h.name || '').slice(0, 120), url: h.url || '', shop: (h.seller && h.seller.name) || '' };
    if (list.length < 50) break;
    await sleep(1100);
  }
  return null;
}

// 楽天市場（RAKUTEN_APP_ID があるときだけ。まだ試していない：ID が無いため）
async function rakuten(spec) {
  const [, , , q, re, min, max] = spec;
  const u = new URL('https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601');
  u.search = new URLSearchParams({ applicationId: RAKUTEN, keyword: q, sort: '+itemPrice', availability: '1', minPrice: String(min), maxPrice: String(max), hits: '30', format: 'json' }).toString();
  const j = await getJson(u);
  const h = (j.Items || []).map((x) => x.Item || x).find((x) => { const nm = String(x.itemName || '').normalize('NFKC'); return re.test(nm) && !NOT.test(nm); });
  return h ? { p: h.itemPrice, src: '楽天', name: String(h.itemName || '').slice(0, 120), url: h.itemUrl || '', shop: h.shopName || '' } : null;
}

function loadPrev() {
  if (!PREV_FILE || !fs.existsSync(PREV_FILE)) return { v: 1, weeks: [] };
  const j = JSON.parse(fs.readFileSync(PREV_FILE, 'utf8'));
  if (!(j && j.v === 1 && Array.isArray(j.weeks))) throw new Error('前回の flyer-history.json の形が違う');
  return j;
}

async function collect() {
  const hist = loadPrev();
  const today = ymd(jstNow());
  // 比べる週：前号（5〜9日前の記録。手で動かした回など、それ以外の日の記録とは比べない）
  const daysAgo = (d) => Math.round((new Date(today) - new Date(d)) / 86400e3);
  const base = [...hist.weeks].reverse().find((w) => daysAgo(w.date) >= 5 && daysAgo(w.date) <= 9);
  const prices = {};
  const genres = [];
  for (const g of GENRES) {
    const rows = [];
    for (const spec of g.items) {
      let best = null;
      try { best = await yahoo(spec); } catch (e) { console.error('Yahoo 失敗', spec[0], e.message); }
      await sleep(1100); // 1秒に1回まで
      if (RAKUTEN) {
        try { const r = await rakuten(spec); if (r && (!best || r.p < best.p)) best = r; } catch (e) { console.error('楽天 失敗', spec[0], e.message); }
        await sleep(1100);
      }
      if (!best) continue;
      prices[spec[0]] = best.p;
      const before = base && base.p[spec[0]];
      const wow = before ? Math.round((best.p / before - 1) * 1000) / 10 : null;
      const lows = hist.weeks.map((w) => w.p[spec[0]]).filter((v) => v > 0);
      const bottom = lows.length >= 4 && best.p <= Math.min(...lows);
      rows.push({ id: spec[0], n: spec[1], icon: spec[2], p: best.p, src: best.src, wow, bottom, name: best.name, url: best.url, shop: best.shop }); // name・url・shop は確かめ用（チラシには出さない）
    }
    // 先週より下がった割合の大きい順（比べる記録が無い品目は後ろ）。5品
    rows.sort((a, b) => (a.wow == null) - (b.wow == null) || (a.wow ?? 0) - (b.wow ?? 0));
    genres.push({ id: g.id, n: g.n, c: g.c, items: rows.slice(0, 5) }); // 取れた数が 5 より少なければ、その枠に「今週は取れませんでした」を出す
  }
  hist.weeks = hist.weeks.filter((w) => w.date !== today).concat([{ date: today, p: prices }]).slice(-12);
  return { genres, hist, compared: base ? base.date : null };
}

function demo() {
  let k = 0;
  return { genres: GENRES.map((g) => ({ id: g.id, n: g.n, c: g.c, items: g.items.slice(0, 5).map((s) => { k++; return { id: s[0], n: s[1], icon: s[2], p: Math.round((s[5] + (s[6] - s[5]) * 0.15) / 10) * 10, src: 'Yahoo!', wow: k % 6 === 0 ? 2.1 : k % 7 === 0 ? null : -((k * 37) % 120) / 10, bottom: k % 9 === 0 }; }).sort((a, b) => (a.wow == null) - (b.wow == null) || (a.wow ?? 0) - (b.wow ?? 0)) })), hist: null, compared: '2026-11-07' };
}

// 準備中：品目と絵だけ（価格は出さない）
function placeholder() {
  return { genres: GENRES.map((g) => ({ id: g.id, n: g.n, c: g.c, items: g.items.slice(0, 5).map((s) => ({ id: s[0], n: s[1], icon: s[2], p: null })) })), hist: null, compared: null };
}

function html(data, ready) {
  const d = jstNow();
  const wd = '日月火水木金土'[d.getUTCDay()];
  const L = LAYOUT;
  const drops = data.genres.flatMap((g) => g.items.map((it) => it.wow)).filter((v) => v != null && v < 0);
  const maxDrop = drops.length ? Math.min(...drops) : null;
  const icon = (k) => ICONS[k] || ICONS.gpu;
  const item = (it, i) => {
    const big = i === 0;
    const badge = !ready ? '' : big ? '目玉' : it.bottom ? '底値?' : it.wow != null && it.wow <= -5 ? '値下がり' : it.wow != null && it.wow >= 3 ? '値上がり' : '';
    const srcTag = RAKUTEN && it.src ? `<span class="src">${esc(it.src)}</span>` : '';
    const ch = !ready ? '<div class="ch wait">価格は準備中</div>' : it.wow == null ? '<div class="ch new">前号の価格なし</div>' : `<div class="ch${it.wow > 0 ? ' up' : ''}">${it.wow > 0 ? '▲' : it.wow < 0 ? '▼' : '±'}${Math.abs(it.wow).toFixed(1)}% 先週比</div>`;
    const pr = ready ? `<div class="pr">¥${yen(it.p)}<small>〜</small></div>` : '<div class="pr wait">¥ ― ―</div>';
    return `<div class="it${big ? ' big' : ''}"><div class="pic">${icon(it.icon)}</div><div class="tx"><div class="nm">${esc(it.n)}</div>${pr}${ch}${srcTag}</div>${badge ? `<span class="st">${badge}</span>` : ''}</div>`;
  };
  const tiles = data.genres.map((g) => `<div class="g" style="border-color:${g.c}"><h2 style="background:${g.c}">${esc(g.n)}</h2>${g.items.map(item).join('')}${g.items.length < 5 ? `<div class="it miss">${g.items.length === 0 ? '今週は価格を取れませんでした' : 'ほかの品目は今週は取れませんでした'}</div>` : ''}</div>`).join('');
  const count = data.genres.reduce((a, g) => a + g.items.length, 0);
  const burst = ready && maxDrop != null ? `<b>先週比</b><span>最大<br>${Math.abs(maxDrop).toFixed(0)}%</span><b>値下がり</b>` : `<b>${data.genres.length}ジャンル</b><span>${count}品</span><b>まとめて</b>`;
  const credit = 'Web Services by Yahoo! JAPAN' + (RAKUTEN ? ' ／ Supported by Rakuten Developers' : '');
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK JP","Noto Sans JP","IPAGothic",sans-serif;background:#fff200;color:#111;overflow:hidden;position:relative}
.top{height:${L.head}px;background:repeating-conic-gradient(from 0deg at 50% 120%,#e60012 0 6deg,#ff2a2a 6deg 12deg);color:#fff;position:relative;padding:14px 36px 0;border-bottom:10px solid #111}
.top .sub{font-size:36px;font-weight:900;background:#111;color:#fff200;display:inline-block;padding:4px 18px;transform:rotate(-3deg)}
.top h1{font-size:94px;font-weight:900;line-height:1;margin-top:6px;letter-spacing:2px;-webkit-text-stroke:4px #111;paint-order:stroke;text-shadow:8px 8px 0 #111}
.top h1 em{color:#fff200;font-style:normal}
.top .date{font-size:30px;font-weight:900;margin-top:10px;background:#fff;color:#e60012;display:inline-block;padding:2px 14px;border:4px solid #111}
.burst{position:absolute;right:30px;top:20px;width:250px;height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;text-align:center;background:#fff200;color:#e60012;transform:rotate(10deg);clip-path:polygon(50% 0,61% 13%,77% 6%,79% 22%,95% 24%,88% 39%,100% 50%,88% 61%,95% 76%,79% 78%,77% 94%,61% 87%,50% 100%,39% 87%,23% 94%,21% 78%,5% 76%,12% 61%,0 50%,12% 39%,5% 24%,21% 22%,23% 6%,39% 13%)}
.burst b{font-size:36px}.burst span{font-size:66px;line-height:1}
.grid{position:absolute;left:${L.pad}px;right:${L.pad}px;top:${L.head + L.pad}px;bottom:${L.foot + L.pad}px;display:grid;grid-template-columns:repeat(${L.cols},1fr);grid-template-rows:repeat(${L.rows},1fr);gap:${L.gap}px}
.g{background:#fff;border:5px solid #111;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.g h2{font-size:32px;font-weight:900;white-space:nowrap;color:#fff;padding:4px 12px;letter-spacing:1px}
.it{display:flex;align-items:center;gap:10px;padding:6px 10px;border-top:3px dashed #bbb;flex:1;position:relative;min-height:0;overflow:hidden}
.it .pic{width:76px;height:76px;flex:none;background:#f4f4f4;border-radius:10px;padding:5px}
.it .pic svg{width:100%;height:100%;display:block}
.it .tx{min-width:0;flex:1}
.it .nm{font-size:23px;font-weight:800;line-height:1.12;max-height:2.24em;overflow:hidden}
.it .pr{font-size:37px;font-weight:900;color:#e60012;line-height:1.02;letter-spacing:-1px;white-space:nowrap}
.it .pr small{font-size:20px}
.it .pr.wait{color:#aaa}
.it .ch{font-size:21px;font-weight:800;color:#0a8a2a;white-space:nowrap}
.it .ch.up{color:#c4000f}.it .ch.new{color:#555}.it .ch.wait{color:#777}
.it .src{font-size:16px;color:#666;margin-left:4px}
.it.miss{justify-content:center;color:#777;font-size:22px;font-weight:800;flex:0.6}
.st{position:absolute;left:2px;top:4px;background:#e60012;color:#fff200;font-size:19px;font-weight:900;padding:0 8px;border-radius:30px;transform:rotate(-10deg);border:3px solid #111;z-index:2}
.big{background:#fff8c0;flex:2.1;display:grid;grid-template-columns:96px 1fr;grid-template-rows:auto auto;column-gap:10px;align-content:center}
.big .pic{width:96px;height:96px;background:#fff;grid-row:1}
.big .tx{display:contents}
.big .nm{font-size:28px;grid-column:2;grid-row:1;align-self:center;max-height:3.4em}
.big .pr{font-size:54px;grid-column:1 / 3;grid-row:2;margin-top:4px}
.big .ch{font-size:24px;grid-column:1 / 3;grid-row:3}
.foot{position:absolute;bottom:0;left:0;right:0;height:${L.foot}px;background:#111;color:#fff;font-size:22px;white-space:nowrap;padding:10px 30px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.stamp{position:absolute;right:300px;top:40px;transform:rotate(-6deg);background:#fff;border:10px solid #e60012;color:#e60012;font-weight:900;text-align:center;padding:10px 26px;border-radius:20px;z-index:3}
.stamp b{display:block;font-size:88px;line-height:1.05}.stamp span{display:block;font-size:22px;color:#111;margin-top:4px;white-space:nowrap}
</style></head><body>
<div class="top"><div class="sub">ガジェット愛好会 週刊</div><h1>今週の<em>ガジェット</em><br>特価まつり！</h1><div class="date">${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${wd}）号　毎週土曜に自動で更新</div>
<div class="burst">${burst}</div></div>
<div class="grid">${tiles}</div>
${ready ? (DEMO ? '<div class="stamp"><b>見本</b><span>価格は作り物です（並びの確認用）</span></div>' : '') : '<div class="stamp"><b>準備中</b><span>価格の取得の設定が済みしだい<br>毎週土曜に更新します</span></div>'}
<div class="foot"><span>${ready ? `検索した条件の中の最安（税込・送料別）。店頭とは違います${data.compared ? `／先週比は ${data.compared} と比べて` : ''}` : '絵はイメージです。価格はまだ入っていません'}</span><span>${ready ? credit : 'ガジェット愛好会'}</span></div>
</body></html>`;
}

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return fs.existsSync(mac) ? mac : 'google-chrome';
}

(async () => {
  const ready = !!APPID || DEMO;
  const data = DEMO ? demo() : ready ? await collect() : placeholder();
  const count = data.genres.reduce((a, g) => a + g.items.length, 0);
  // ジャンルごとに 3 品は取れないと出さない（前の週のチラシが残る）
  const thin = data.genres.filter((g) => g.items.length < 3).map((g) => `${g.n}:${g.items.length}`);
  if (ready && !DEMO && thin.length) { console.error(`取れた品目が少ないジャンルがあるので書き出さない（${thin.join(' ')}）`); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.resolve(outDir, 'flyer.html');
  fs.writeFileSync(htmlPath, html(data, ready));
  const png = path.resolve(outDir, 'flyer.png');
  execFileSync(chrome(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--force-device-scale-factor=1', `--window-size=${W},${H}`, `--screenshot=${png}`, 'file://' + htmlPath], { stdio: 'inherit', timeout: 120000 });
  const buf = fs.readFileSync(png); // PNG の IHDR で大きさを確かめる（撮り損ねを公開しない）
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(16) !== W || buf.readUInt32BE(20) !== H) { console.error(`flyer.png の大きさが違う（${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}）`); process.exit(1); }
  fs.writeFileSync(path.join(outDir, 'flyer.json'), JSON.stringify({ v: 1, ready, updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), date: ymd(jstNow()), compared: data.compared, layout: { w: W, h: H, ...LAYOUT }, genres: data.genres }));
  if (data.hist) fs.writeFileSync(path.join(outDir, 'flyer-history.json'), JSON.stringify(data.hist));
  console.log(`${ready ? count + ' 品' : '準備中'} → ${png}`);
})();
