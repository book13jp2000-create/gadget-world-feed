// 11/16 本人「PCパーツの過去の値段は私がデータを用意する。最新は Yahoo! でいい」→ 2つをつないで1本の履歴にし、
// 株価と同じく期間ごとの JSON（parts-1y.json・parts-5y.json・parts-max.json）を書き出す。1か月は今までどおり parts.json の hist。
//  ・本人のデータ：このリポジトリの parts-history/*.csv（列：id,品目,日付,価格（円・税込）,メモ）。書き方は parts-history/README.md
//  ・Yahoo! の毎日の記録：data ブランチの parts-archive.json（{ id: [[日付, 円], ...] }。parts.js が毎日足す。消さない）
//  ・同じ日に両方あれば Yahoo! を使う
// 使い方: node parts-history.js <parts-archive.json> <出力先>
const fs = require('fs');
const path = require('path');
const [archiveFile, outDir] = process.argv.slice(2);
const dir = path.join(__dirname, 'parts-history');

function readCsv() {
  const map = {}; let rows = 0; const bad = [];
  if (!fs.existsSync(dir)) return { map, rows, bad };
  for (const f of fs.readdirSync(dir).filter((f) => /\.csv$/i.test(f)).sort()) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (i === 0 || !line.trim() || line.startsWith('#')) return; // 1行目は見出し
      const c = line.split(',').map((s) => s.trim());
      const id = c[0], d = (c[2] || '').replace(/\//g, '-'), p = Number((c[3] || '').replace(/[円,\s]/g, ''));
      const dd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
      if (!id || !dd || !(p > 0)) { if (c[3]) bad.push(`${f}:${i + 1}`); return; }
      const day = `${dd[1]}-${dd[2].padStart(2, '0')}-${dd[3].padStart(2, '0')}`;
      (map[id] = map[id] || {})[day] = p; rows++;
    });
  }
  return { map, rows, bad };
}

const PERIODS = [
  { id: '1y', days: 366, step: 'week', max: 60 },
  { id: '5y', days: 5 * 366, step: 'month', max: 62 },
  { id: 'max', days: 0, step: 'month', max: 80 },
];
// 週・月ごとに、その区切りの最後の値を1つ
function bucket(series, step) {
  const out = [];
  for (const [d, p] of series) {
    const t = new Date(d + 'T00:00:00Z');
    const key = step === 'month' ? d.slice(0, 7) : (() => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); })();
    if (out.length && out[out.length - 1].k === key) out[out.length - 1] = { k: key, d, p }; else out.push({ k: key, d, p });
  }
  return out;
}
function thin(a, max) { if (a.length <= max) return a; const r = []; for (let i = 0; i < max; i++) r.push(a[Math.round((i * (a.length - 1)) / (max - 1))]); return r; }

const archive = archiveFile && fs.existsSync(archiveFile) ? JSON.parse(fs.readFileSync(archiveFile, 'utf8')) : {};
const { map: manual, rows, bad } = readCsv();
const ids = [...new Set([...Object.keys(archive), ...Object.keys(manual)])].sort();
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
fs.mkdirSync(outDir, { recursive: true });
for (const per of PERIODS) {
  const from = per.days ? new Date(Date.now() + 9 * 3600e3 - per.days * 86400e3).toISOString().slice(0, 10) : '0000-00-00';
  const items = [];
  for (const id of ids) {
    const days = Object.assign({}, manual[id] || {});
    for (const [d, p] of archive[id] || []) if (p > 0) days[d] = p; // 同じ日は Yahoo! を優先
    const series = Object.keys(days).sort().filter((d) => d >= from && d <= today).map((d) => [d, days[d]]);
    if (series.length < 2) continue;
    const b = thin(bucket(series, per.step), per.max);
    items.push({ id, d0: b[0].d.replace(/-/g, '/'), d1: b[b.length - 1].d.replace(/-/g, '/'), m: b.map((x) => x.p) });
  }
  const out = { v: 1, range: per.id, updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), source: '本人が用意した過去の値段＋Yahoo!ショッピングの毎日の記録', items };
  fs.writeFileSync(path.join(outDir, `parts-${per.id}.json`), JSON.stringify(out));
  console.log(`parts-${per.id}.json ${items.length} 品目`);
}
console.log(`本人の CSV ${rows} 行${bad.length ? `、読めなかった行 ${bad.length}（${bad.slice(0, 10).join(' ')}）` : ''}`);
