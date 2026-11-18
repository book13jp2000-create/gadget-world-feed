// 11/19 本人「codex案がすっきりしていていいですね。これでいきましょう」→ チラシの見た目「週刊 売れ筋ノート」（Codex 案）。
// ワールド（雨の夜のブックカフェ）に合わせ、生成りの紙・濃茶・銅色、明朝の見出し。量販店らしさは大きな価格と順位だけに残す。
// flyer.js の html() から呼ぶ（前の赤と黄色のチラシは flyer.js に残してあり、FLYER_STYLE=loud で戻せる）。
// 元の案：gadget-new-world の codex-trial/flyer-design-1119/codex/（表紙とオーディオのページだけだった物を、全ジャンル・準備中・見本・前号比に広げた）
const W = 1448, H = 2048;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = (v) => Number(v).toLocaleString('ja-JP');
// ジャンルの色：前のチラシの原色を、紙に合う落ち着いた色に（id が無いときはデータの色）
const PALETTE = { pc: '#a64d3d', sp: '#45677a', pcs: '#536d58', audio: '#6b5680', camera: '#8b663f', game: '#8a5953', home: '#4e7274', kitchen: '#8b6454' };
const accent = (g) => PALETTE[g && g.id] || (g && g.c) || '#81644c';
const name = (it) => String(it.n || '').replace(/…$/, '');
const two = (i) => String(i + 1).padStart(2, '0');

const CSS = `
*{box-sizing:border-box}html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}body{font-family:"Noto Sans CJK JP","Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans",sans-serif;color:#27231f;background:#f3eee4}
.page{width:${W}px;height:${H}px;padding:32px 38px 28px;display:flex;flex-direction:column;position:relative;background:repeating-linear-gradient(0deg,rgba(112,83,49,.025) 0,rgba(112,83,49,.025) 1px,transparent 1px,transparent 6px),#f3eee4}
.masthead{height:162px;flex:none;display:flex;align-items:flex-end;justify-content:space-between;border-bottom:5px solid #393026;padding:0 3px 23px}
.overline{font-size:22px;letter-spacing:.18em;color:#705c48;font-weight:800}
.title{font-family:"Noto Serif CJK JP","Noto Serif JP","Hiragino Mincho ProN",serif;font-size:66px;font-weight:900;letter-spacing:.04em;line-height:1.18;white-space:nowrap}
.title .muted{font-size:44px;color:#766249;margin-left:15px}
.issue-box{text-align:right;padding-bottom:4px}.issue-box .issue{font-size:29px;font-weight:850}.issue-box .frequency{font-size:21px;color:#655b50;margin-top:4px}
.bar{height:58px;flex:none;display:flex;align-items:center;justify-content:space-between;margin-top:18px;border-bottom:2px solid #a39786}
.bar h2{font-size:29px;margin:0;font-weight:900;letter-spacing:.05em}.bar span{font-size:20px;color:#6d6255;font-weight:700}
.hero-grid{height:305px;flex:none;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:15px}
.hero-card{background:#fffdf8;border:2px solid #d6cbbb;border-top:9px solid var(--accent);display:grid;grid-template-columns:170px 1fr;grid-template-rows:42px 1fr;min-width:0;padding:12px 15px 15px;position:relative}
.hero-top{grid-column:1/3;display:flex;align-items:center;gap:10px;min-width:0}
.rank{font-family:Georgia,serif;font-size:32px;font-weight:700;color:var(--accent)}
.hero-category{font-size:20px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.photo{display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;border:1px solid #ece7de}
.photo img{display:block;width:100%;height:100%;object-fit:contain}.photo svg{display:block;width:86%;height:86%}
.hero-photo{width:164px;height:202px;align-self:center}
.hero-detail{min-width:0;display:flex;flex-direction:column;justify-content:center;padding-left:9px}
.product-name{font-size:24px;font-weight:850;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:94px}
.hero-price{font-family:Arial,sans-serif;color:#a74025;font-size:41px;font-weight:900;white-space:nowrap;line-height:1.1;margin:10px 0 6px}
.hero-price.long{font-size:35px}.hero-price .yen{font-size:27px}.hero-price small{font-family:"Noto Sans CJK JP","Hiragino Sans",sans-serif;color:#51493f;font-size:16px;margin-left:4px}
.store{font-size:17px;color:#62594f;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.stamp{font-size:15px;font-weight:900;color:#a74025;border:2px solid #a74025;padding:2px 5px;white-space:nowrap;margin-left:auto}
.stamp.up{color:#45677a;border-color:#45677a}
.hero-empty{grid-column:1/4;background:#fffdf8;border:2px dashed #c9bca8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-size:30px;font-weight:850;color:#5b5045}.hero-empty small{font-size:21px;font-weight:600;color:#756b5f}
.section-intro{height:59px;flex:none;display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:8px}
.section-intro h2{font-size:29px;margin:0}.section-intro span{font-size:18px;color:#756b5f}
.cover-grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:13px}
.category{background:#fffdf8;border:2px solid #d5cbbb;min-width:0;overflow:hidden}
.category-head{height:62px;display:flex;align-items:center;gap:9px;padding:0 13px;border-top:8px solid var(--accent);border-bottom:2px solid #e5ddd1}
.category-number{font-family:Georgia,serif;font-size:30px;color:var(--accent);font-weight:700}
.category-head h2{font-size:23px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;letter-spacing:-.03em}
.category-items{padding:0 10px}
.mini-item{height:94px;display:flex;gap:9px;align-items:center;border-bottom:1px solid #e1d9ce}.mini-item:last-child{border-bottom:0}
.mini-item .photo{width:80px;height:78px;flex:none}.mini-detail{min-width:0;flex:1}
.mini-name{font-size:18px;font-weight:780;line-height:1.23;height:44px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mini-bottom{display:flex;align-items:baseline;justify-content:space-between;gap:4px}
.mini-price{font-family:Arial,sans-serif;font-size:28px;letter-spacing:-.03em;color:#a74025;font-weight:900;white-space:nowrap}.mini-price.long{font-size:24px}.mini-price span{font-size:18px}
.mini-rank{font-size:16px;font-weight:850;color:var(--accent);white-space:nowrap}
.miss{height:94px;display:flex;align-items:center;justify-content:center;font-size:17px;color:#807264}
.wait{color:#8a7f72 !important}
.genre-list{flex:1;min-height:0;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(6,1fr);gap:11px}
.genre-item{background:#fffdf8;border:2px solid #d6cbbb;border-left:8px solid var(--accent);display:flex;align-items:center;position:relative;min-width:0;padding:11px 14px;gap:14px}
.genre-rank{align-self:flex-start;color:var(--accent);font:700 29px Georgia,serif;width:55px;flex:none;white-space:nowrap}.genre-rank small{font:800 14px "Noto Sans CJK JP","Hiragino Sans",sans-serif}
.genre-item .photo{width:150px;height:150px;flex:none}
.genre-detail{min-width:0;align-self:center;flex:1}
.genre-name{font-size:25px;font-weight:850;line-height:1.32;min-height:67px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.genre-price{font:900 42px Arial,sans-serif;color:#a74025;white-space:nowrap;margin:7px 0 2px}.genre-price span{font-size:26px}
.genre-price small{font:700 17px "Noto Sans CJK JP","Hiragino Sans",sans-serif;color:#51493f;margin-left:5px}
.genre-shop{font-size:18px;color:#62594f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.genre-item .stamp{position:absolute;right:9px;top:8px}
.footer{height:91px;flex:none;margin-top:16px;border-top:3px solid #393026;padding-top:12px;display:flex;justify-content:space-between;gap:25px;color:#51493f;font-size:17px;line-height:1.35}
.footer .caution{max-width:820px}.footer .credit{text-align:right;max-width:510px;overflow-wrap:anywhere}.footer .credit strong{font-weight:800}
.demo{position:absolute;right:60px;top:200px;transform:rotate(-8deg);border:5px solid #a74025;color:#a74025;font-size:46px;font-weight:900;padding:6px 22px;background:rgba(255,253,248,.85)}
`;

// o: { ready, gp（ジャンルのページのときそのジャンル）, issue（'YYYY-MM-DD'）, compared, demo, icons, usePhotos, mode, rakuten }
function html(data, o) {
  const { ready, gp } = o;
  const [y, m, d] = String(o.issue).split('-').map(Number);
  const issue = `${y}年${m}月${d}日（土）`;
  const pic = (it, cls) => `<span class="photo ${cls || ''}">${o.usePhotos && it.img ? `<img src="${esc(it.img)}" alt="">` : (o.icons[it.icon] || o.icons.gpu || '')}</span>`;
  const long = (p) => yen(p).length >= 7 ? ' long' : '';
  // 順位か前号比（前号と比べられる週は前号比、売れ筋で前号が無い週は順位）
  const tag = (it) => !ready ? '価格は準備中' : it.wow != null ? `前号比 ${it.wow > 0 ? '▲' : it.wow < 0 ? '▼' : '±'}${Math.abs(it.wow).toFixed(1)}%` : it.rank ? `${it.rank}位` : '';
  const stamp = (it) => !ready ? '' : it.bottom ? '<span class="stamp">最安更新</span>' : it.wow != null && it.wow <= -5 ? '<span class="stamp">値下がり</span>' : it.wow != null && it.wow >= 3 ? '<span class="stamp up">値上がり</span>' : '';
  const heroCard = (it, i) => {
    const g = gp || { id: (data.genres.find((x) => x.n === it.g) || {}).id, c: it.c };
    const sub = it.rank && it.wow == null ? `売れ筋 ${it.rank}位` : tag(it);
    return `<article class="hero-card" style="--accent:${esc(accent(g))}"><div class="hero-top"><span class="rank">${two(i)}</span><span class="hero-category">${esc(it.g || (gp && gp.n) || '')}</span>${stamp(it)}</div>${pic(it, 'hero-photo')}<div class="hero-detail"><div class="product-name">${esc(name(it))}</div>${ready ? `<div class="hero-price${long(it.p)}"><span class="yen">¥</span>${yen(it.p)}<small>税込</small></div>` : '<div class="hero-price wait">¥ ― ―</div>'}<div class="store">${esc(sub)}${o.mode === 'ranking' && it.shop ? ` · ${esc(it.shop)}` : ''}</div></div></article>`;
  };
  const heroEmpty = ready
    ? `<div class="hero-empty">${o.compared ? '今週は前号より下がった品がありませんでした' : '目玉は次の号から'}</div>`
    : '<div class="hero-empty">準備中<small>価格の取得の設定が済みしだい、毎週土曜に更新します</small></div>';
  const heroes = data.hero.length ? data.hero.map(heroCard).join('') : heroEmpty;
  const price = (it, cls) => ready ? `<span class="${cls}${long(it.p)}"><span>¥</span>${yen(it.p)}</span>` : `<span class="${cls} wait">¥ ― ―</span>`;
  const mini = (it) => `<article class="mini-item">${pic(it)}<div class="mini-detail"><div class="mini-name">${esc(name(it))}</div><div class="mini-bottom">${price(it, 'mini-price')}<span class="mini-rank">${esc(tag(it))}</span></div></div></article>`;
  const category = (g, i) => `<section class="category" style="--accent:${esc(accent(g))}"><header class="category-head"><span class="category-number">${two(i)}</span><h2>${esc(g.n)}</h2></header><div class="category-items">${g.items.map(mini).join('')}${g.items.length < 6 ? `<div class="miss">${g.items.length ? 'ほかの品は今週は取れませんでした' : '今週は取れませんでした'}</div>` : ''}</div></section>`;
  const listItem = (it) => `<article class="genre-item">${it.rank ? `<span class="genre-rank">${esc(it.rank)}<small>位</small></span>` : ''}${pic(it)}<div class="genre-detail"><div class="genre-name">${esc(name(it))}</div>${ready ? `<div class="genre-price"><span>¥</span>${yen(it.p)}<small>税込</small></div>` : '<div class="genre-price wait">¥ ― ―</div>'}<div class="genre-shop">${it.wow != null ? esc(tag(it)) + (it.shop ? ' · ' : '') : ''}${esc(o.mode === 'ranking' ? it.shop || '' : '')}</div></div>${stamp(it)}</article>`;
  const list = gp ? data.genres[0].items : null;
  const ranks = (list || []).filter((it) => it.rank).map((it) => it.rank);
  const listNote = !ready ? '価格は準備中' : o.mode === 'ranking' ? `${ranks.length ? `売れ筋 ${Math.min(...ranks)}〜${Math.max(...ranks)}位` : '売れ筋順'} · 店の税込価格` : '値下がり順 · 検索時点の税込価格';
  const credit = '<strong>Web Services by Yahoo! JAPAN</strong><br>（https://developer.yahoo.co.jp/sitemap/）' + (o.rakuten ? '<br>Supported by Rakuten Developers' : '');
  const caution = ready
    ? `${o.mode === 'ranking' ? '売れ筋の上位の品・その店の税込価格（送料別）・画像は各店の物。' : '検索した条件の中の最安（税込・送料別）。'}店頭とは違います。価格は変わることがあります。${o.compared ? `前号比は ${esc(o.compared)} 号と比べて。` : ''}`
    : '絵はイメージです。価格はまだ入っていません。';
  const heroTitle = gp ? `${esc(gp.n)}の今週の3品` : '今週、話題にしたい3品';
  const heroNote = !ready ? '' : data.hero.some((h) => h.wow != null) ? '値下がりの大きい順' : '売れ筋上位から';
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>週刊 売れ筋ノート</title><style>${CSS}</style></head><body><main class="page ${gp ? 'genre' : 'cover'}"${gp ? ` style="--accent:${esc(accent(gp))}"` : ''}>
<header class="masthead"><div><div class="overline">GADGET READING ROOM · WEEKLY</div><div class="title">週刊 売れ筋ノート<span class="muted">${gp ? esc(gp.n) : '総合版'}</span></div></div><div class="issue-box"><div class="issue">${issue} 号</div><div class="frequency">毎週土曜更新</div></div></header>
<div class="bar"><h2>${heroTitle}</h2><span>${heroNote}</span></div>
<div class="hero-grid">${heroes}</div>
${gp
    ? `<div class="section-intro"><h2>続きの${list.length}品</h2><span>${listNote}</span></div><div class="genre-list">${list.map(listItem).join('')}</div>`
    : `<div class="section-intro"><h2>ジャンル別の売れ筋</h2><span>${!ready ? '価格は準備中' : o.mode === 'ranking' ? '各ジャンル 6品ずつ · 順位順' : '各ジャンル 6品ずつ · 値下がり順'}</span></div><div class="cover-grid">${data.genres.map(category).join('')}</div>`}
<footer class="footer"><div class="caution">${caution}</div><div class="credit">${credit}</div></footer>
${o.demo ? '<div class="demo">見本・架空価格</div>' : ''}
</main></body></html>`;
}

module.exports = { html };
