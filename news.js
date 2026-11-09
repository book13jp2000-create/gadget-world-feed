// ニュースの見出しを RSS / Atom から取り、ジャンルごとにまとめて out/news.json に書き出す。
// 使い方: node news.js [出力先フォルダ]   （Node 18 以上。外部パッケージなし）
//         node news.js --preview [出力先]   … news-feeds.json がまだ本人の承認前（sample: true）でも、確認用に書き出す（公開には使わない）
// どのサイトを使うかは news-feeds.json（ジャンルと RSS の URL）で決める。サイトごとに、見出しを公開の場所に出してよいかを確かめてから入れる。
// VRChat の NewsTicker（Assets/Proto/Udon/NewsTicker.cs）が読み、島ごとにそのジャンルの見出しを流す。
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const outDir = args.filter((a) => !a.startsWith('--'))[0] || path.join(__dirname, 'out');
const conf = JSON.parse(fs.readFileSync(path.join(__dirname, 'news-feeds.json'), 'utf8'));
// サイトの一覧が本人の承認前（sample: true）なら、公開用には書き出さない
if (conf.sample && !preview) { console.error('news-feeds.json が承認前（sample: true）なので書き出さない（確認用は --preview）'); process.exit(1); }
const PER_GENRE = conf.perGenre || 5;
const MAX_AGE_DAYS = conf.maxAgeDays || 7;

// 文字参照を戻す（範囲外・サロゲートの番号は置換文字に）
const cp = (n) => (n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '�');
const unent = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => cp(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => cp(parseInt(n, 16)))
  .replace(/&amp;/g, '&');
// 見出しは書式のない文字にする（文字参照を戻してからタグを消す。<b> などが文字として残らないように）
const plain = (s) => unent(s).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

// CDATA の中身は先に預けておき、<item> の区切りを誤らないようにする
function parse(xml) {
  const cdata = [];
  const x = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c) => `\u0001${cdata.push(c) - 1}\u0001`);
  const restore = (s) => s.replace(/\u0001(\d+)\u0001/g, (_, i) => cdata[+i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  const tag = (block, names) => {
    for (const name of names) {
      const m = block.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'i'));
      if (m) return plain(restore(m[1]));
    }
    return '';
  };
  const link = (block) => {
    const a = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    if (a) return unent(a[1]);
    return tag(block, ['link']);
  };
  const blocks = [...(x.match(/<item[\s>][\s\S]*?<\/item>/gi) || []), ...(x.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [])];
  return blocks.map((b) => {
    const d = tag(b, ['pubDate', 'date', 'updated', 'published']);
    // 時差の書いていない日時は読み方が環境で変わるので使わない
    const time = d && /(Z|[+-]\d{2}:?\d{2}|GMT|UT|[A-Z]{3})\s*$/i.test(d) ? Date.parse(d) : NaN;
    return { t: tag(b, ['title']), u: link(b), time: isFinite(time) ? time : null };
  }).filter((x) => x.t);
}

async function fetchFeed(f) {
  const res = await fetch(f.url, { headers: { 'User-Agent': 'gadget-world-feed (VRChat world news ticker)' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${f.name}: HTTP ${res.status}`);
  return parse(await res.text());
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const jst = (ms) => { const d = new Date(ms + 9 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

(async () => {
  const now = Date.now();
  const genres = [];
  let ok = 0, total = 0;
  for (const g of conf.genres) {
    let all = [];
    for (const f of g.feeds) {
      total++;
      try {
        const list = await fetchFeed(f);
        if (list.length === 0) throw new Error(`${f.name}: 見出しが0件`);
        all.push(...list.map((x) => ({ ...x, s: f.name })));
        ok++;
      } catch (e) { console.error('失敗', e.message); }
    }
    // 新しい順、古すぎる物と同じ見出しは除く
    const seen = new Set();
    all = all
      .filter((x) => x.time != null && now - x.time < MAX_AGE_DAYS * 86400e3 && x.time < now + 3600e3) // 日時の無い物・古い物・未来の物は除く
      .sort((a, b) => b.time - a.time)
      .filter((x) => (seen.has(x.t) ? false : (seen.add(x.t), true)))
      .slice(0, PER_GENRE);
    genres.push({ g: g.id, label: g.label, items: all.map((x) => ({ t: clip(x.t, 70), s: x.s, d: jst(x.time), at: new Date(x.time).toISOString(), u: x.u })) });
  }
  // 見出しが1つも無いジャンルがあれば書き出さない（前の回の news.json が残る）
  const empty = genres.filter((g) => g.items.length === 0).map((g) => g.g);
  if (empty.length) { console.error(`見出しの無いジャンルがあるので書き出さない: ${empty.join(', ')}`); process.exit(1); }
  const d = new Date(now + 9 * 3600e3);
  const pad = (v) => String(v).padStart(2, '0');
  const out = { v: 1, updated: new Date(now).toISOString().replace(/\.\d+Z$/, 'Z'), jst: `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, ok, total, genres };
  if (conf.sample) out.sample = true;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'news.json'), JSON.stringify(out));
  console.log(`${ok}/${total} フィード → ${path.join(outDir, 'news.json')}（${genres.map((x) => x.g + ':' + x.items.length).join(' ')}）`);
})();
