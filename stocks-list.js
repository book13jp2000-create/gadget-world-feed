// 株価ボードの銘柄の一覧（stocks.js と history.js で共有。11/16 に stocks.js から分けた）
const GROUPS = [
  // 11/16 本人「主要な指数（日経225・TOPIX・S&P500・NASDAQ・SOX・KOSPI・台湾加権など）、Arm・サムスン・TSMC など米国・日本以外も。関連する物をどんどん増やしてよい。スクロールしてもよい」
  // → 指数（IDX）と海外株（INTL）を足し、米国株・日本株・ETF を増やした。前のワールドの板は先頭の3面・各10行だけを出すので、US・JP・ETF を先頭のまま、各面の先頭10行は前と同じ銘柄にしてある。
  { id: 'US', title: 'US TECH STOCKS', jt: '米国テック株', cur: '$', dec: 2, list: [
    ['NVDA', 'NVIDIA', 'エヌビディア'], ['AAPL', 'Apple', 'アップル'], ['MSFT', 'Microsoft', 'マイクロソフト'], ['INTC', 'Intel', 'インテル'],
    ['AMD', 'AMD', 'AMD'], ['TSM', 'TSMC', 'TSMC（台湾積体電路）'], ['GOOGL', 'Alphabet', 'アルファベット（Google）'], ['META', 'Meta', 'メタ'],
    ['AMZN', 'Amazon', 'アマゾン'], ['TSLA', 'Tesla', 'テスラ'],
    ['AVGO', 'Broadcom', 'ブロードコム'], ['QCOM', 'Qualcomm', 'クアルコム'], ['MU', 'Micron', 'マイクロン'], ['ARM', 'Arm', 'アーム（英国）'],
    ['ASML', 'ASML', 'ASML（オランダ）'], ['DELL', 'Dell', 'デル'], ['ORCL', 'Oracle', 'オラクル'], ['ADBE', 'Adobe', 'アドビ'],
    ['NFLX', 'Netflix', 'ネットフリックス'], ['SONY', 'Sony (ADR)', 'ソニー（米国上場）'],
  ] },
  { id: 'JP', title: 'JAPAN TECH & CHIPS', jt: '日本のテック・半導体株', cur: 'JPY', dec: 0, list: [
    ['8035.T', 'Tokyo Electron', '東京エレクトロン'], ['6857.T', 'Advantest', 'アドバンテスト'], ['6920.T', 'Lasertec', 'レーザーテック'], ['6146.T', 'Disco', 'ディスコ'],
    ['285A.T', 'Kioxia', 'キオクシア'], ['6723.T', 'Renesas', 'ルネサス'], ['4063.T', 'Shin-Etsu Chem', '信越化学'], ['6758.T', 'Sony Group', 'ソニーグループ'],
    ['9984.T', 'SoftBank Group', 'ソフトバンクグループ'], ['7974.T', 'Nintendo', '任天堂'],
    ['7735.T', 'SCREEN', 'SCREEN'], ['6526.T', 'Socionext', 'ソシオネクスト'], ['6501.T', 'Hitachi', '日立製作所'], ['6981.T', 'Murata', '村田製作所'],
    ['6762.T', 'TDK', 'TDK'], ['6752.T', 'Panasonic', 'パナソニック'], ['7751.T', 'Canon', 'キヤノン'], ['6702.T', 'Fujitsu', '富士通'],
    ['6701.T', 'NEC', 'NEC'], ['9433.T', 'KDDI', 'KDDI'],
  ] },
  // 11/10 本人「半導体や VR 関連の ETF も入れていいんじゃない？」→ ガジェットに関係する ETF を米国・日本から。
  // 価格は通貨が混ざるので小数なし・通貨なし（記号が英字なら米ドル、数字なら円）。VR 関連の米国 ETF「VR」は上場廃止で取れないので、メタバースの METV
  { id: 'ETF', title: 'GADGET ETF', jt: 'ガジェット関連 ETF', cur: '', dec: 0, list: [
    ['SOXX', 'Semis (US)', '半導体（米国）'], ['SMH', 'Semis VanEck (US)', '半導体 ヴァンエック（米国）'], ['2644.T', 'Semis (JP)', '半導体（日本）'], ['METV', 'Metaverse/VR (US)', 'メタバース・VR（米国）'],
    ['VGT', 'Info Tech (US)', '情報技術（米国）'], ['2854.T', 'Tech Top20 (JP)', 'テック上位20（日本）'], ['HERO', 'Games/eSports (US)', 'ゲーム・eスポーツ（米国）'], ['2640.T', 'Games/Anime (JP)', 'ゲーム・アニメ（日本）'],
    ['BOTZ', 'Robotics/AI (US)', 'ロボット・AI（米国）'], ['1625.T', 'Electronics (JP)', '電機・精密（日本）'],
    ['QQQ', 'NASDAQ100 (US)', 'ナスダック100（米国）'], ['XLK', 'Tech Select (US)', 'テクノロジー（米国）'], ['ARKK', 'ARK Innovation (US)', 'ARK イノベーション（米国）'], ['200A.T', 'Nikkei Semis (JP)', '日経半導体株（日本）'],
  ] },
  // 指数・為替。通貨も桁もまちまちなので、価格の列は小数2桁・通貨なし（名前に国や中身を書く）
  // TOPIX そのものは Yahoo Finance で取れないので、TOPIX に連動する ETF（1306）で代わりに見せる（名前に書く）
  { id: 'IDX', mixed: true, title: 'MARKET INDEXES', jt: '主要な指数・為替', cur: '', dec: 2, list: [
    ['^N225', 'Nikkei 225', '日経平均（日経225）'], ['1306.T', 'TOPIX ETF', 'TOPIX（連動ETF 1306）'], ['^GSPC', 'S&P 500', 'S&P500（米国）'], ['^IXIC', 'NASDAQ', 'ナスダック総合（米国）'],
    ['^DJI', 'Dow Jones', 'ダウ平均（米国）'], ['^SOX', 'PHLX Semis', 'SOX 半導体指数（米国）'], ['^KS11', 'KOSPI', 'KOSPI（韓国）'], ['^TWII', 'TAIEX', '台湾加権指数（台湾）'],
    ['^HSI', 'Hang Seng', 'ハンセン指数（香港）'], ['^STOXX50E', 'Euro Stoxx 50', 'ユーロ・ストックス50（欧州）'], ['JPY=X', 'USD/JPY', 'ドル円（1ドル＝円）'],
  ] },
  // 米国・日本以外の会社（現地の市場の値。通貨は名前に書く）
  { id: 'INTL', mixed: true, title: 'WORLD TECH', jt: '海外のテック・半導体株', cur: '', dec: 0, list: [
    ['2330.TW', 'TSMC (TW)', 'TSMC（台湾・台湾ドル）'], ['005930.KS', 'Samsung (KR)', 'サムスン電子（韓国・ウォン）'], ['000660.KS', 'SK hynix (KR)', 'SKハイニックス（韓国・ウォン）'], ['2454.TW', 'MediaTek (TW)', 'メディアテック（台湾・台湾ドル）'],
    ['2317.TW', 'Foxconn (TW)', '鴻海（台湾・台湾ドル）'], ['1810.HK', 'Xiaomi (HK)', 'シャオミ（香港・香港ドル）'], ['0700.HK', 'Tencent (HK)', 'テンセント（香港・香港ドル）'], ['9988.HK', 'Alibaba (HK)', 'アリババ（香港・香港ドル）'],
    ['1211.HK', 'BYD (HK)', 'BYD（香港・香港ドル）'], ['IFX.DE', 'Infineon (DE)', 'インフィニオン（ドイツ・ユーロ）'],
  ] },
];

module.exports = { GROUPS };
