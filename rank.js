// 売れ筋で品目を選ぶ（11/13 本人「売れ筋から自動で選びたい」）。Yahoo!ショッピングの高評価トレンドランキング（v1）を
// ジャンルのカテゴリごとに取り、上から順に、状態の悪い物・付属品・同じ品の重複を外して並べる。
// 11/13 本人「全部使っていいやつをつまみ食いしよう」→ 下の STORES の店ごとにランキングを取り、合わせて選ぶ（SELLER_IDS で入れ替えられる）。
// 合わせ方：店ごとの順位 r から 1/r を足した点（いくつもの店で上位の品ほど上）。同じ品（JAN・名前の先頭）は1つにし、いちばん安い店の値段と画像を使う。
// RANK_FILE を入れると、API を呼ばずにその JSON（rank-probe.js が保存した形）を読む（手元で並びを確かめる用）。
const fs = require('fs');
const { throttle, BAD } = require('./yahoo-pick.js');

// ジャンル → カテゴリ ID（Yahoo!ショッピングのカテゴリ。ranking-test の結果を見て決める）
const CATS = {
  pc: [88],                 // PCパーツ
  sp: [38338, 21076],       // スマホ、タブレットPC
  pcs: [14242, 14241, 2519, 49351], // ノート・デスクトップ・周辺機器・モニター
  audio: [50654],           // オーディオ機器（660 と同じ中身だった）
  camera: [50665],          // カメラ（2443 と同じ中身だった）
  game: [2161],             // テレビゲーム
  home: [5300],             // 生活家電
  kitchen: [587],           // キッチン家電
};

// Yahoo!ショッピングの店（11/13 に店のページが開くのを確かめた。試しで何も返さない店は外す）
// 11/13 の試しで、どのジャンルも 0 件だった edioncom（エディオン）・nojimaonline（ノジマ）・pcones（PCワンズ）は外した
const STORES = ['joshin', 'yamada-denki', 'ksdenki', 'y-kojima', 'y-sofmap', 'best-denki', 'murauchi', // 家電量販店
  'dospara-y', 'tsukumo-y', 'pc-koubou', 'arkonline-store', 'akibaoo', // PC・パーツ
  'e-earphone', 'emedama', 'elecom', 'softbank-selection']; // 専門店

// ガジェットらしくない物を外す（11/13 の試しで、ふろ水ポンプ・カメラのバッテリー・ガスボンベ・LAN ケーブル・大きな冷蔵庫や洗濯機などが入った）
//  付属品・消耗品・電池・充電器・ケース・ケーブル・変換・取り付け具・大型の白物家電（設置が要る物）
const JUNK = /バッテリー|充電池|電池|充電器|チャージャー|ACアダプ|アダプター|アダプタ|変換|ケーブル|コード(?!レス|付)|プラグ|ジャック|(?<!PC)ケース(?!ファン)|カバー|ポーチ|バッグ|トランク|ボックス|フィルム|保護|ストラップ|マウント|ホルダー|専用スタンド|スタンド単体|グリップ|ブラケット|アーム|ボンベ|ふろ水ポンプ|バスポンプ|ホース|フィルター|紙パック(?!式)|替え|交換|部品|消耗品|インク|トナー|クリーニング|ウェット|ティッシュ|メディア|ブランクディスク|BD-R|DVD-R(?!W?\s*ドライブ)|SDカード|microSD|カードリーダー|延長|タップ|冷蔵庫|冷凍庫|洗濯機|洗濯乾燥機|衣類乾燥機|食器洗い乾燥機|エアコン|設置|ユニット台|ヘッドトラッカー|プロテクター|ジャケット|リュック|バックパック|スリング|ウェストバッ|接続セット|簡単接続|USBで.*接続/;
// ジャンルごとに、名前に必ずどれかがある（ほかのジャンルの物が混ざらないように。ゲームにキーボードが入った）
const MUST = {
  pc: /SSD|HDD|NVMe|M\.2|DDR\d|メモリ(?!カード)|CPU|Ryzen|Core\s*(Ultra|i\d)|GeForce|Radeon|RTX|グラフィック|電源ユニット|ATX電源|80PLUS|マザーボード|クーラー|水冷|ケースファン|キャプチャ/i,
  sp: /スマホ|スマートフォン|SIMフリー|iPhone|Pixel|Galaxy|AQUOS|Xperia|arrows|moto|タブレット|iPad|Kindle|Kobo|電子書籍|Surface|ウォッチ|Watch|モバイルバッテリー/i,
  pcs: /ノート(PC|パソコン)|パソコン|デスクトップ|モニター|ディスプレイ|キーボード|マウス|ルーター|中継機|メッシュ|Wi-?Fi|ドライブ|NAS|Webカメラ|ウェブカメラ|プリンター|複合機|スキャナ|ハブ|ドッキング|PCスピーカー|外付け(SSD|HDD)/i,
  audio: /イヤホン|イヤフォン|ヘッドホン|ヘッドフォン|スピーカー|サウンドバー|コンポ|アンプ|DAC|プレーヤー|プレイヤー|マイク|骨伝導|ヘッドセット|ターンテーブル|レコード/i,
  camera: /カメラ|一眼|ミラーレス|デジカメ|レンズ|Insta360|GoPro|Osmo|DJI|ビデオ|三脚|ジンバル|ドローン|マイク/i,
  game: /Switch|スイッチ|PS5|PS4|PlayStation|プレイステーション|Xbox|Quest|VR|ゲーム機|コントローラ|プロコン|Joy-?Con|ゲーミング|ROG\s*Ally|Steam/i,
  home: /掃除機|クリーナー|空気清浄|加湿|除湿|ドライヤー|アイロン|プレッサー|ふとん乾燥|布団乾燥|扇風機|サーキュレーター|ヒーター|ストーブ|電気毛布|ホットカーペット|照明|シーリングライト|高圧洗浄|シェーバー|電動歯ブラシ|美顔|マッサージ|体重計|体組成/i,
  kitchen: /コーヒー|エスプレッソ|ケトル|ポット|炊飯|レンジ|トースター|オーブン|ミキサー|ブレンダー|フードプロセッサー|ホットプレート|グリル|IH|コンロ|フライヤー|精米|サンドメーカー|スープメーカー|調理|ホームベーカリー|食洗機|ジューサー|製氷|ヨーグルト|低温調理/i,
};
const NOTG = { pc: /SO-?DIMM|ノート(PC|パソコン)?用|260\s*pin/i, camera: /[A-Za-z0-9]\s*用(?!品)/, game: /キーボード|マウス/, home: /洗濯|乾燥機(?!.*(ふとん|布団))/, kitchen: /スタンド/ };

// 名前から絵を選ぶ（上から順に最初に合った物）。合わなければジャンルの既定の絵
const ICON_RULES = [
  [/グラフィックボード|グラボ|GeForce|Radeon|RTX\s*\d|RX\s*\d/i, 'gpu'], [/Ryzen|Core\s*(Ultra|i\d)|CPU(?!クーラー)/i, 'cpu'],
  [/DDR\d|メモリ(?!カード)/i, 'memory'], [/SSD|NVMe|M\.2/i, 'ssd'], [/電源ユニット|80PLUS/i, 'psu'], [/クーラー|水冷|ファン/i, 'cooler'],
  [/マザーボード/i, 'motherboard'], [/iPad|タブレット/i, 'tablet'], [/iPhone|スマホ|スマートフォン|Pixel|Galaxy|Xperia|AQUOS/i, 'phone'],
  [/Watch|ウォッチ/i, 'watch'], [/モバイルバッテリー/i, 'battery'], [/充電器|ACアダプタ/i, 'charger'], [/ケーブル/i, 'cable'],
  [/ノート(PC|パソコン)|MacBook|ノートパソコン/i, 'laptop'], [/モニター|ディスプレイ/i, 'monitor'], [/キーボード/i, 'keyboard'], [/マウス/i, 'mouse'],
  [/Webカメラ|ウェブカメラ/i, 'webcam'], [/プリンター|複合機/i, 'printer'], [/ルーター|Wi-?Fi\s*\d/i, 'router'], [/NAS/i, 'nas'],
  [/イヤホン|イヤフォン|AirPods/i, 'earbuds'], [/ヘッドホン|ヘッドフォン/i, 'headphones'], [/サウンドバー/i, 'soundbar'], [/スピーカー/i, 'speaker'],
  [/マイク/i, 'mic'], [/プレーヤー|DAP/i, 'dap'], [/アクションカメラ|GoPro/i, 'actioncam'], [/ドローン/i, 'drone'], [/レンズ/i, 'lens'],
  [/SDカード|microSD/i, 'sdcard'], [/三脚/i, 'tripod'], [/ジンバル/i, 'gimbal'], [/カメラ/i, 'camera'],
  [/Quest|VR/i, 'vr'], [/コントローラー|プロコン/i, 'controller'], [/Switch|PlayStation|PS5|ゲーム機/i, 'handheld'], [/ヘッドセット/i, 'headset'],
  [/ロボット掃除機|ルンバ/i, 'robotvac'], [/掃除機|クリーナー/i, 'vacuum'], [/空気清浄機|加湿器|除湿機/i, 'purifier'], [/洗濯機/i, 'washer'],
  [/電球|照明|ライト/i, 'bulb'], [/リモコン/i, 'remote'], [/扇風機|サーキュレーター/i, 'fan'], [/ヒーター|ストーブ|暖房/i, 'heater'], [/ドライヤー/i, 'hairdryer'],
  [/電子レンジ|オーブンレンジ/i, 'microwave'], [/コーヒー/i, 'coffee'], [/炊飯器/i, 'ricecooker'], [/ケトル|ポット/i, 'kettle'], [/ミキサー|ブレンダー/i, 'blender'],
  [/トースター/i, 'toaster'], [/ノンフライヤー|エアフライヤー/i, 'airfryer'], [/食洗機|食器洗/i, 'dishwasher'],
];
const DEF_ICON = { pc: 'gpu', sp: 'phone', pcs: 'laptop', audio: 'headphones', camera: 'camera', game: 'controller', home: 'vacuum', kitchen: 'microwave' };
const iconOf = (name, g) => (ICON_RULES.find(([re]) => re.test(name)) || [, DEF_ICON[g] || 'gpu'])[1];

// チラシに出す短い名前：【】［］＜＞の宣伝文句、送料・ポイント・クーポンなどの言葉を除き、先頭から
function shortName(s, max = 26) {
  let t = String(s || '').normalize('NFKC')
    .replace(/[【\[［<＜(（「『][^】\]］>＞)）」』]{0,40}[】\]］>＞)）」』]/g, ' ')
    .replace(/(送料無料|ポイント\d*倍|P\d+倍|クーポン[^\s]*|あす楽|即納|翌日(配達|発送)|正規品|国内正規品|新品|メーカー保証\S*|最大\S*%OFF|\d+%OFF|ランキング\S*|楽天\S*|SALE|セール)/gi, ' ')
    .replace(/[★☆◆◇■□●○♪!！※]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S{0,3}$/, '') + '…';
  return t;
}
// 同じ品：JAN があれば JAN だけで（違う JAN は別の品）。無ければ短い名前の先頭 24 字（Codex の指摘：先頭14字では別の品をまとめることがあった）
const sameKey = (r) => r.jan ? 'j:' + r.jan : 'n:' + shortName(r.name, 80).replace(/\s/g, '').slice(0, 24).toLowerCase();

async function fetchRanking(appid, cats, sellers) {
  const u = new URL('https://shopping.yahooapis.jp/ShoppingWebService/V1/highRatingTrendRanking');
  const out = []; let fail = 0; const list = sellers.length ? sellers : [null];
  for (const seller of list) {
    await throttle();
    const q = { appid, genre_category_id: cats.join(','), limit: '100' };
    if (seller) q.seller_id = seller;
    u.search = new URLSearchParams(q).toString();
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`); // URL は出さない（ID が入っている）
      const got = rows(await res.json()).map((r) => ({ ...r, store: seller || '' }));
      console.error(`  ${cats.join(',')} ${seller || '全店'}: ${got.length} 件`);
      out.push(...got);
    } catch (e) { fail++; console.error(`  ${cats.join(',')} ${seller || '全店'}: 失敗 ${/^HTTP \d+$/.test(e.message) ? e.message : e.name}`); } // 1店の失敗でジャンル全体を落とさない（エラーは種類だけ出す）
  }
  // 半分を超える店で失敗したら、偏った順位を出さないようにそのジャンルを空にする（品数が足りずチラシは書き出されず、前の号が残る）
  if (fail * 2 > list.length) throw new Error(`${fail}/${list.length} 店で失敗`);
  return out;
}

// API の返事 → { rank, name, code, jan, url, p, shop, rate, reviews }
function rows(j) {
  const h = j.high_rating_trend_ranking || j; // 返事は high_rating_trend_ranking の下（11/13 の試しで確かめた）
  const list = h.ranking_data || [];
  return list.map((r) => {
    const it = r.item_information || {};
    const p = Number(it.bargain_price) > 0 ? Number(it.bargain_price) : Number(it.regular_price) || 0; // セール価格（bargain_price）があればそれ、無ければ通常価格（どちらも税込）
    const img = (r.image && (r.image.medium || r.image.small)) || (it.image && (it.image.medium || it.image.small)) || '';
    return { img, rank: Number(r.rank), name: String(it.name || ''), code: it.code || '', jan: it.jan_code || '', url: it.url || '', p, shop: (r.seller && r.seller.name) || '', rate: r.review && r.review.rate, reviews: r.review && r.review.count };
  });
}

// ジャンルごとに n 品
async function rankGenres(genres, { appid, n = 15, not, sellers = STORES, file = '' }) {
  const cached = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const out = []; const dump = {};
  for (const g of genres) {
    const cats = CATS[g.id] || [];
    let rs = [];
    try {
      if (cached) rs = Array.isArray(cached[g.id]) ? cached[g.id] : cats.flatMap((c) => rows(cached[c] || {})); // 店ごとの保存（RANK_DUMP の形）か、カテゴリごとの返事
      else rs = await fetchRanking(appid, cats, sellers);
    } catch (e) { console.error('ランキング 失敗', g.id, e.message); }
    dump[g.id] = rs;
    // 同じ品をまとめる（JAN、無ければ名前の先頭）。点＝店ごとの 1/順位 の合計。値段と画像はいちばん安い店の物
    const groups = []; const byKey = new Map();
    for (const r of rs) {
      const nm = r.name.normalize('NFKC');
      if (!(r.p > 0) || BAD.test(nm) || (not && not.test(nm)) || JUNK.test(nm) || (MUST[g.id] && !MUST[g.id].test(nm)) || (NOTG[g.id] && NOTG[g.id].test(nm))) continue;
      if (!(Number.isFinite(r.rank) && r.rank > 0)) continue;
      const k = sameKey(r);
      let gr = byKey.get(k);
      if (!gr) { gr = { score: 0, best: r, stores: new Set() }; groups.push(gr); byKey.set(k, gr); }
      if (!gr.stores.has(r.store)) { gr.stores.add(r.store); gr.score += 1 / r.rank; }
      if (r.p < gr.best.p) gr.best = r; // 値段・店・画像・URL は同じ出品の物をまとめて使う（画像が無ければ絵）
    }
    groups.sort((a, b) => b.score - a.score);
    const items = groups.slice(0, n).map((gr, i) => { const r = gr.best; const nm = r.name.normalize('NFKC');
      return { id: 'y:' + (r.jan || r.code), n: shortName(r.name), icon: iconOf(nm, g.id), img: r.img, p: r.p, src: 'Yahoo!', rank: i + 1, score: Math.round(gr.score * 1000) / 1000, stores: [...gr.stores], name: r.name.slice(0, 120), url: r.url, shop: r.shop, rate: r.rate, reviews: r.reviews }; });
    out.push({ id: g.id, n: g.n, c: g.c, items });
  }
  if (process.env.RANK_DUMP && !cached) fs.writeFileSync(process.env.RANK_DUMP, JSON.stringify(dump)); // 取った順位をそのまま保存（手元で選び方を確かめる用。ID は入らない）
  return out;
}

module.exports = { rankGenres, shortName, iconOf, CATS, STORES };
