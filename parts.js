// PCパーツの最安値を Yahoo!ショッピングの商品検索API（v3）で取り、out/parts.json に書き出す。1日1回の想定。
// 11/9 夜 本人「もっと選べていい。いっぱい出していい」→ 9 品目から 26 品目に（板はページをめくって全部出す）
// 使い方: YAHOO_APPID=<Client ID> node parts.js [出力先フォルダ]
//         node parts.js --sample [出力先]   … ID がないとき、形を確かめるための見本（値は作り物。sample: true が付く）
// 価格の動き（直近30日）は、前回の parts.json（PREV_FILE。Actions では data ブランチに置いた物）を読んで今日の値を足していく。
// 前回のファイルがあるのに読めない・形が違うときは止まる（履歴を黙って消さない）。
// 「最安値」＝Yahoo!ショッピング掲載の商品価格（hits.price）。新品・在庫あり・指定の価格帯・型番の条件に合う物の最安。送料・ポイントは含めない。
// 取得元の条件：Yahoo!デベロッパーネットワークの利用規約・クレジット表示ガイドラインに従う（板の下と Pages にクレジット）。
const fs = require('fs');
const path = require('path');

// 11/10 本人「日本語で」→ j（板に出す名前）を足した。型番だけの物は n と同じ
// 品目：検索語・名前に必ず含む語（付属品や別の型番を除く）・価格の下限と上限（円。中古・部品・誤登録を除く）
const PARTS = [
  // グラボ
  { id: 'rtx5090', n: 'RTX 5090', q: 'RTX 5090 グラフィックボード', re: /RTX\s*5090(?!\s*D)(?![0-9A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 250000, max: 1200000 },
  { id: 'rtx5080', n: 'RTX 5080', q: 'RTX 5080 グラフィックボード', re: /RTX\s*5080(?![0-9A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 120000, max: 600000 },
  { id: 'rtx5070ti', n: 'RTX 5070 Ti', q: 'RTX 5070 Ti グラフィックボード', re: /RTX\s*5070\s*Ti(?![A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 90000, max: 400000 },
  { id: 'rtx5070', n: 'RTX 5070', q: 'RTX 5070 グラフィックボード', re: /RTX\s*5070(?!\s*Ti(?![A-Z]))(?![0-9A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 60000, max: 300000 },
  { id: 'rtx5060ti', n: 'RTX 5060 Ti', q: 'RTX 5060 Ti グラフィックボード', re: /RTX\s*5060\s*Ti(?![A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 50000, max: 200000 },
  { id: 'rtx5060', n: 'RTX 5060', q: 'RTX 5060 グラフィックボード', re: /RTX\s*5060(?!\s*Ti(?![A-Z]))(?![0-9A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 35000, max: 150000 },
  { id: 'rx9070xt', n: 'RX 9070 XT', q: 'Radeon RX 9070 XT', re: /RX\s*9070\s*XT(?![A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 70000, max: 300000 },
  { id: 'rx9070', n: 'RX 9070', q: 'Radeon RX 9070 グラフィックボード', re: /RX\s*9070(?!\s*(XT|GRE))(?![0-9A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 60000, max: 250000 },
  { id: 'rx9060xt', n: 'RX 9060 XT', q: 'Radeon RX 9060 XT', re: /RX\s*9060\s*XT(?![A-Z])/i, not: /ノート|PC本体|デスクトップPC|ゲーミングPC|搭載PC|BTO/i, min: 35000, max: 150000 },
  // CPU
  { id: '9950x3d', n: 'Ryzen 9 9950X3D', q: 'Ryzen 9 9950X3D BOX', re: /9950X3D(?![0-9A-Z])/i, not: /PC本体|デスクトップPC|ゲーミングPC|搭載|BTO|セット|マザーボード/i, min: 80000, max: 300000 },
  { id: '9800x3d', n: 'Ryzen 7 9800X3D', q: 'Ryzen 7 9800X3D BOX', re: /9800X3D(?![0-9A-Z])/i, not: /PC本体|デスクトップPC|ゲーミングPC|搭載|BTO|セット|マザーボード/i, min: 50000, max: 200000 },
  { id: '9700x', n: 'Ryzen 7 9700X', q: 'Ryzen 7 9700X BOX', re: /9700X(?![0-9A-Z])/i, not: /PC本体|デスクトップPC|ゲーミングPC|搭載|BTO|セット|マザーボード|9700X3D/i, min: 35000, max: 150000 },
  { id: '9600x', n: 'Ryzen 5 9600X', q: 'Ryzen 5 9600X BOX', re: /9600X(?![0-9A-Z])/i, not: /PC本体|デスクトップPC|ゲーミングPC|搭載|BTO|セット|マザーボード/i, min: 25000, max: 100000 },
  { id: '285k', n: 'Core Ultra 9 285K', q: 'Core Ultra 9 285K BOX', re: /285K(?![0-9A-Z])/i, not: /285KF|PC本体|デスクトップPC|ゲーミングPC|搭載|BTO|セット|マザーボード/i, min: 70000, max: 250000 },
  { id: '265k', n: 'Core Ultra 7 265K', q: 'Core Ultra 7 265K BOX', re: /265K(?![0-9A-Z])/i, not: /265KF|PC本体|デスクトップPC|ゲーミングPC|搭載|BTO|セット|マザーボード/i, min: 35000, max: 150000 },
  { id: '245k', n: 'Core Ultra 5 245K', q: 'Core Ultra 5 245K BOX', re: /245K(?![0-9A-Z])/i, not: /245KF|PC本体|デスクトップPC|ゲーミングPC|搭載|BTO|セット|マザーボード/i, min: 25000, max: 100000 },
  // メモリ（デスクトップ用の2枚組）・SSD（M.2 NVMe）
  { id: 'ddr5', kit: '16GBx2', j: 'DDR5 メモリ 32GB（16GB×2）', n: 'DDR5 32GB (16GBx2)', q: 'DDR5 32GB 16GB 2枚組 デスクトップ', re: /DDR5[\s\S]*(16GB\s*[x×*]\s*2|16GB\s*2枚|2\s*[x×]\s*16GB)|(16GB\s*[x×*]\s*2|16GB\s*2枚|2\s*[x×]\s*16GB)[\s\S]*DDR5/i, not: /ノート|SO-?DIMM|PC本体|ECC|サーバー/i, min: 8000, max: 120000 },
  { id: 'ddr5-64', kit: '32GBx2', j: 'DDR5 メモリ 64GB（32GB×2）', n: 'DDR5 64GB (32GBx2)', q: 'DDR5 64GB 32GB 2枚組 デスクトップ', re: /DDR5[\s\S]*(32GB\s*[x×*]\s*2|32GB\s*2枚|2\s*[x×]\s*32GB)|(32GB\s*[x×*]\s*2|32GB\s*2枚|2\s*[x×]\s*32GB)[\s\S]*DDR5/i, not: /ノート|SO-?DIMM|PC本体|ECC|サーバー/i, min: 15000, max: 400000 },
  { id: 'ssd1tb', cap: '1TB', j: 'NVMe SSD 1TB', n: 'NVMe SSD 1TB', q: 'NVMe SSD 1TB M.2 Gen4', re: /(?<![0-9])1\s*TB[\s\S]*(NVMe|M\.2)|(NVMe|M\.2)[\s\S]*(?<![0-9])1\s*TB/i, not: /外付け|ポータブル|PC本体|ケース|SATA|USB|エンクロージャ/i, min: 6000, max: 60000 },
  { id: 'ssd2tb', cap: '2TB', j: 'NVMe SSD 2TB', n: 'NVMe SSD 2TB', q: 'NVMe SSD 2TB M.2 Gen4', re: /(?<![0-9])2\s*TB[\s\S]*(NVMe|M\.2)|(NVMe|M\.2)[\s\S]*(?<![0-9])2\s*TB/i, not: /外付け|ポータブル|PC本体|ケース|SATA|USB|エンクロージャ|ヒートシンクのみ/i, min: 10000, max: 120000 },
  { id: 'ssd4tb', cap: '4TB', j: 'NVMe SSD 4TB', n: 'NVMe SSD 4TB', q: 'NVMe SSD 4TB M.2 Gen4', re: /(?<![0-9])4\s*TB[\s\S]*(NVMe|M\.2)|(NVMe|M\.2)[\s\S]*(?<![0-9])4\s*TB/i, not: /外付け|ポータブル|PC本体|ケース|SATA|USB|エンクロージャ/i, min: 20000, max: 200000 },
  // 電源・マザーボード・CPU クーラー・モニター
  { id: 'psu850', j: '電源 850W GOLD', n: 'PSU 850W Gold', q: '電源ユニット 850W 80PLUS GOLD ATX', re: /850\s*W[\s\S]*GOLD|GOLD[\s\S]*850\s*W/i, not: /PC本体|中古|ケース付|SFX/i, min: 8000, max: 60000 },
  { id: 'b850', j: 'B850 マザーボード', n: 'B850 Motherboard', q: 'B850 マザーボード AM5 ATX', re: /B850(?![0-9])/i, not: /PC本体|CPUセット|セット品|中古/i, min: 15000, max: 80000 },
  { id: 'z890', j: 'Z890 マザーボード', n: 'Z890 Motherboard', q: 'Z890 マザーボード LGA1851 ATX', re: /Z890(?![0-9])/i, not: /PC本体|CPUセット|セット品|中古/i, min: 25000, max: 150000 },
  { id: 'aio360', j: '簡易水冷 360mm', n: 'AIO Cooler 360mm', q: '簡易水冷 CPUクーラー 360mm', re: /360\s*mm|360mm/i, not: /PC本体|ファン単体|ラジエーターのみ/i, min: 8000, max: 60000 },
  { id: 'mon27q', j: '27型 WQHD 165Hz以上', n: '27in WQHD 165Hz+', q: 'ゲーミングモニター 27インチ WQHD 165Hz', re: /27[\s\S]*(WQHD|2560)[\s\S]*(1[6-9][0-9]|2[0-9]{2})\s*Hz|(WQHD|2560)[\s\S]*27[\s\S]*(1[6-9][0-9]|2[0-9]{2})\s*Hz/i, not: /PC本体|中古|アーム単体/i, min: 20000, max: 150000 },
];
const PREV_FILE = process.env.PREV_FILE || '';
const DAYS = 30;
const args = process.argv.slice(2);
const sample = args.includes('--sample');
const outDir = args.filter((a) => !a.startsWith('--'))[0] || path.join(__dirname, 'out');
const APPID = process.env.YAHOO_APPID;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jstDate = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

async function getJson(u) {
  for (let t = 0; t < 3; t++) {
    const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (res.status === 429) { await sleep(5000 * (t + 1)); continue; } // 混んでいるときは待って取り直す
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('HTTP 429 が続いた');
}

// 11/13：ただの最安値をやめ、yahoo-pick.js の robustLowest（並行輸入・訳あり・容量違いの出品・はずれ値を外す）で選ぶ
const { robustLowest } = require('./yahoo-pick.js');
async function lowest(part) {
  const r = await robustLowest(APPID, part);
  if (!r) throw new Error(`${part.id}: 条件に合う商品なし`);
  return { p: r.p, shop: r.shop, pn: r.name.slice(0, 80), url: r.url, n: r.n, med: r.med };
}

function loadPrev() {
  if (!PREV_FILE || !fs.existsSync(PREV_FILE)) return null; // 初めての日
  const j = JSON.parse(fs.readFileSync(PREV_FILE, 'utf8')); // 壊れていたら止まる
  if (!(j && j.v === 1 && Array.isArray(j.items)) || j.sample) throw new Error('前回の parts.json の形が違う（見本か壊れている）');
  for (const it of j.items) {
    if (!Array.isArray(it.hist) || !it.hist.every((x) => Array.isArray(x) && x.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(x[0]) && x[1] > 0)) throw new Error(`前回の履歴が壊れている: ${it.id}`);
  }
  return j;
}

// 30日前（その日か、それより前でいちばん近い日）の値と比べる。30日前より前の記録が無いうちは出さない（最初の日と比べて 30D に見せない。Codex の指摘）
function change30(hist, today) {
  if (hist.length < 2) return null;
  const t = new Date(today + 'T00:00:00Z').getTime();
  const target = t - 30 * 86400e3;
  let base = null;
  for (const x of hist) { if (new Date(x[0] + 'T00:00:00Z').getTime() <= target) base = x; }
  if (!base) return null;
  const last = hist[hist.length - 1];
  return Math.round((last[1] / base[1] - 1) * 1000) / 10;
}

(async () => {
  if (!APPID && !sample) { console.error('YAHOO_APPID がない（見本は --sample）'); process.exit(1); }
  const today = jstDate(new Date());
  const prev = sample ? null : loadPrev();
  const items = [];
  let ok = 0;
  for (const part of PARTS) {
    const old = prev && prev.items.find((x) => x.id === part.id);
    let hist = old && Array.isArray(old.hist) ? old.hist.filter((x) => Array.isArray(x) && x.length === 2) : [];
    let cur = null;
    if (sample) {
      // 見本：それらしい値を作る（本物ではない）
      const base = (part.min + part.max) / 4;
      hist = [];
      for (let i = DAYS - 1; i >= 0; i--) {
        const d = jstDate(new Date(Date.now() - i * 86400e3));
        hist.push([d, Math.round(base * (1 + 0.08 * Math.sin(i / 4 + part.min % 7) + 0.004 * (DAYS - i)) / 10) * 10]);
      }
      cur = { p: hist[hist.length - 1][1], shop: 'sample', count: 0 };
    } else {
      try { cur = await lowest(part); ok++; } catch (e) { console.error('失敗', e.message); }
      // 間は yahoo-pick.js の throttle があける（ID ごとに 30 回/分まで）
      if (cur) { hist = hist.filter((x) => x[0] !== today); hist.push([today, cur.p]); }
      // 31日より前の記録は捨てる（30日前と比べるため 31日分残す）
      const keepFrom = jstDate(new Date(Date.now() - DAYS * 86400e3));
      hist = hist.filter((x) => x[0] >= keepFrom);
    }
    const last = cur ? cur.p : null;
    items.push({
      id: part.id, n: part.n, j: part.j || part.n, // j：板に出す日本語の名前（型番はそのまま）
      p: last, // 今日の最安値（円）。取れなかった日は null（前の日の値を今日の値として出さない）
      shop: cur ? cur.shop : '', pn: cur ? cur.pn || '' : '', url: cur ? cur.url || '' : '', cnt: cur ? cur.n : 0, med: cur ? cur.med : null, // 確かめ用（板には出さない）。cnt＝条件に合った件数、med＝基準の値段（中央値）
      d30: last ? change30(hist, today) : null, // 30日前と比べた変化％。履歴が7日分より短ければ null
      hist, // [日付, 最安値] の並び（古い順、最大31日）。取れなかった日は抜ける
    });
  }
  if (!sample && ok < Math.ceil(PARTS.length / 2)) { console.error(`${ok} 品目しか取れなかったので書き出さない`); process.exit(1); }
  const now = new Date();
  const out = { v: 1, updated: now.toISOString().replace(/\.\d+Z$/, 'Z'), date: today, source: 'Yahoo!ショッピング', credit: 'Web Services by Yahoo! JAPAN (https://developer.yahoo.co.jp/sitemap/)', ok: sample ? 0 : ok, items };
  if (sample) out.sample = true;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'parts.json'), JSON.stringify(out));
  console.log(`${sample ? '見本' : ok + '/' + PARTS.length + ' 品目'} → ${path.join(outDir, 'parts.json')}`);
})();
