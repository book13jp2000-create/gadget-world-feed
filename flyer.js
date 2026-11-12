// 週刊チラシ「ガジェット愛好会 週刊 ガジェット特価まつり」を作る（1448×2048 の PNG）。毎週土曜の朝に Actions が動かす（flyer.yml）。
// 11/10 本人：量販店のチラシ風に、PCパーツだけでなく家電も含めたガジェット全般をジャンル別に、にぎやかに、絵入りで。
// 11/10 夕 本人「2を作りましょう」（店のチラシは使わず、自作のチラシをもっと本物の家電量販店のチラシらしく）：
//  ・上に「今週の目玉」の帯（全ジャンルから先週比の下げが大きい 3 品を大きく）と、ガジェ愛会員限定の「おふざけクーポン」（本物の割引ではない）
//  ・8 ジャンル × 6 品（1 つ目がジャンルの目玉）。候補（下の GENRES）の今週の最安値を取り、先週より下がった割合の大きい順
//  ・チラシの言葉と飾り：「お一人様1点限り」「数量限定」「先週比 ▼◯%」のギザギザ、「底値?」「値下がり」のシール、赤い大きな価格と小さな「〜」「税込」、斜めの帯
//  ・価格は Yahoo!ショッピングの商品検索（v3）。RAKUTEN_APP_ID があれば楽天市場も見て安い方（出典を小さく出す）
//  ・商品写真は使わない（両 API の規約で、取得した画像を画像に焼き込んで別の場所で見せてよいとはっきり書かれていないため）。絵は Codex が描いた商品写真風のイラスト（flyer-icons.js。実在のメーカー・ロゴに似せない）
//  ・YAHOO_APPID が無いうちは、価格を出さない「準備中」のチラシを作る。作り物の価格は「見本」の判を押した --demo だけ（公開しない）
//  ・ワールドの板（Assets/Proto/Udon/FlyerBoard.cs）は、ジャンルの枠の位置（LAYOUT）を使って1ジャンルを大きく出す。枠を動かしたら板の数字も直す
// 使い方: [YAHOO_APPID=…] [RAKUTEN_APP_ID=…] [PREV_FILE=前回の flyer-history.json] node flyer.js [出力先] [--demo]
//   出力：flyer.png（チラシ）・flyer.html（元の HTML）・flyer.json（中身）・flyer-history.json（品目ごとの週の最安値。次の週の比較に使う）
//   Chrome：環境変数 CHROME、無ければ Mac の Google Chrome、Linux の google-chrome
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ICONS = require('./flyer-icons.js');

const W = 1448, H = 2048;
// ワールドの板が使う枠（px）。見出しと目玉の帯 560、下の帯 88、その間に 4列×2段（板の FlyerBoard.cs の HEAD・FOOT と同じ）
const LAYOUT = { head: 560, foot: 88, pad: 12, gap: 10, cols: 4, rows: 2 };
const PER = 6;      // 1 ジャンルの品数（目玉1＋5）
const MIN_PER = 5;  // これより取れないジャンルがある週は書き出さない（表紙の欄）
const MIN_GP = 8;   // ジャンルのページに要る品数
const HERO = 3;     // 目玉の帯の品数

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
    ['gpu5070ti', 'RTX 5070 Ti グラボ', 'gpu', 'RTX 5070 Ti グラフィックボード', /RTX\s*5070\s*Ti(?![A-Z])/i, 90000, 400000],
    ['b850', 'B850 マザーボード', 'motherboard', 'B850 マザーボード AM5 ATX', /B850(?![0-9])/i, 15000, 80000],
    ['gpu5090', 'RTX 5090 グラボ', 'gpu', 'RTX 5090 グラフィックボード', /RTX\s*5090(?!\s*D)(?![0-9A-Z])/i, 250000, 1200000],
    ['gpu5060ti', 'RTX 5060 Ti グラボ', 'gpu', 'RTX 5060 Ti グラフィックボード', /RTX\s*5060\s*Ti(?![A-Z])/i, 50000, 200000],
    ['cpu9700x', 'Ryzen 7 9700X', 'cpu', 'Ryzen 7 9700X BOX', /9700X(?!3D)(?![0-9A-Z])/i, 35000, 150000],
    ['ddr5-64', 'DDR5 64GB メモリ', 'memory', 'DDR5 64GB 32GB 2枚組 デスクトップ', /DDR5(?=[\s\S]*(32GB\s*[x×*]\s*2|32GB\s*2枚|2\s*[x×]\s*32GB))(?![\s\S]*(SO-?DIMM|ノート))/i, 15000, 200000],
    ['ssd1tb', 'NVMe SSD 1TB', 'ssd', 'NVMe SSD 1TB M.2 Gen4', /(?<![0-9])1\s*TB(?=[\s\S]*(NVMe|M\.2))(?![\s\S]*(外付け|ポータブル|USB|SATA))/i, 6000, 60000],
  ] },
  { id: 'sp', n: 'スマホ・タブレット', c: '#0050b4', items: [
    ['iphone', 'iPhone 17 256GB', 'phone', 'iPhone 17 256GB SIMフリー 本体', /iPhone\s*17(?!\s*(Pro|Air|e))[\s\S]*256\s*GB/i, 80000, 300000],
    ['pixel', 'Google Pixel 10 128GB', 'phone', 'Google Pixel 10 本体 SIMフリー 128GB', /Pixel\s*10(?!\s*(Pro|a))[\s\S]*128\s*GB/i, 60000, 250000],
    ['ipad', 'iPad（第11世代）128GB', 'tablet', 'iPad 第11世代 Wi-Fi 128GB', /iPad(?!\s*(Pro|Air|mini))[\s\S]*(第11世代|A16)[\s\S]*128\s*GB|128\s*GB[\s\S]*iPad(?!\s*(Pro|Air|mini))[\s\S]*(第11世代|A16)/i, 40000, 150000],
    ['androidtab', 'Android タブレット 11型', 'tablet', 'Androidタブレット 11インチ', /(Android|アンドロイド)[\s\S]*11(\.\d)?\s*(インチ|型)|11(\.\d)?\s*(インチ|型)[\s\S]*(Android|アンドロイド)/i, 15000, 120000],
    ['watch', 'Apple Watch Series 11 GPS', 'watch', 'Apple Watch Series 11 GPS', /Apple\s*Watch\s*Series\s*11(?![\s\S]*Cellular)[\s\S]*GPS/i, 40000, 150000],
    ['battery', 'モバイルバッテリー 10000mAh', 'battery', 'モバイルバッテリー 10000mAh PD', /10000\s*mAh/i, 1500, 15000],
    ['charger', 'USB 充電器 65W', 'charger', 'USB-C 充電器 65W GaN', /65\s*W/i, 2000, 15000],
    ['cable', 'USB-C ケーブル 2m', 'cable', 'USB-C to USB-C ケーブル 2m 100W', /USB[-\s]?C[\s\S]*2\s*m|2\s*m[\s\S]*USB[-\s]?C/i, 500, 5000],
    ['galaxy', 'Galaxy S25 256GB', 'phone', 'Galaxy S25 256GB SIMフリー', /Galaxy\s*S25(?!\s*(Ultra|\+|Edge|FE))[\s\S]*256\s*GB/i, 80000, 250000],
    ['ipadair', 'iPad Air 11型 128GB', 'tablet', 'iPad Air 11インチ M3 128GB Wi-Fi', /iPad\s*Air(?=[\s\S]*11)(?=[\s\S]*128\s*GB)/i, 70000, 200000],
    ['pixel9a', 'Google Pixel 9a', 'phone', 'Google Pixel 9a 128GB SIMフリー', /Pixel\s*9a/i, 40000, 120000],
    ['battery20k', 'モバイルバッテリー 20000mAh', 'battery', 'モバイルバッテリー 20000mAh PD', /20000\s*mAh/i, 2500, 20000],
    ['band', 'スマートバンド', 'watch', 'スマートバンド 活動量計', /スマートバンド|活動量計/, 3000, 20000],
    ['earsp', 'スマホ用 完全ワイヤレス', 'earbuds', '完全ワイヤレスイヤホン 低遅延', /完全ワイヤレス/, 3000, 30000],
    ['stand', 'MagSafe 充電器', 'charger', 'MagSafe 対応 ワイヤレス充電器 15W', /(MagSafe|Qi2)[\s\S]*充電器/i, 2000, 15000],
  ] },
  { id: 'pcs', n: 'パソコン・周辺', c: '#008a3a', items: [
    ['macbook', 'MacBook Air 13型 M4 256GB', 'laptop', 'MacBook Air 13インチ M4 256GB', /MacBook\s*Air(?=[\s\S]*13)(?=[\s\S]*M4)(?=[\s\S]*256\s*GB)/i, 100000, 400000],
    ['note14', 'ノートPC 14型 16GB', 'laptop', 'ノートパソコン 14インチ Core Ultra 16GB', /14(\.\d)?\s*(インチ|型)[\s\S]*16\s*GB|16\s*GB[\s\S]*14(\.\d)?\s*(インチ|型)/i, 60000, 300000],
    ['mon4k', '27型 4K モニター', 'monitor', '4K モニター 27インチ', /27(\.\d)?\s*(インチ|型)[\s\S]*(4K|3840)|(4K|3840)[\s\S]*27(\.\d)?\s*(インチ|型)/i, 25000, 150000],
    ['mechkb', 'メカニカルキーボード', 'keyboard', 'メカニカルキーボード', /キーボード/, 5000, 50000],
    ['gmouse', 'ゲーミングマウス 無線', 'mouse', 'ゲーミングマウス ワイヤレス', /マウス/, 3000, 30000],
    ['webcam', 'Webカメラ', 'webcam', 'Webカメラ フルHD', /Web\s*カメラ|ウェブカメラ/i, 2000, 40000],
    ['printer', 'インクジェット複合機', 'printer', 'インクジェット複合機 A4', /複合機/, 8000, 80000],
    ['router', 'Wi-Fi 7 ルーター', 'router', 'Wi-Fi 7 無線LANルーター', /Wi-?Fi\s*7[\s\S]*ルーター|ルーター[\s\S]*Wi-?Fi\s*7/i, 8000, 80000],
    ['nas', 'NAS 2ベイ', 'nas', 'NAS 2ベイ HDDなし', /NAS[\s\S]*2\s*ベイ|2\s*ベイ[\s\S]*NAS/i, 20000, 120000],
    ['mon27q', '27型 WQHD モニター', 'monitor', 'モニター 27インチ WQHD IPS', /27(\.\d)?\s*(インチ|型)[\s\S]*(WQHD|2560)|(WQHD|2560)[\s\S]*27(\.\d)?\s*(インチ|型)/i, 20000, 120000],
    ['hub', 'USB-C ドッキングハブ', 'cable', 'USB-C ハブ ドッキングステーション HDMI', /(ハブ|ドッキング)[\s\S]*HDMI|HDMI[\s\S]*(ハブ|ドッキング)/i, 3000, 40000],
    ['ssdext', 'ポータブル SSD 1TB', 'ssd', 'ポータブルSSD 1TB USB-C', /(ポータブル|外付け)[\s\S]*SSD[\s\S]*1\s*TB|1\s*TB[\s\S]*(ポータブル|外付け)[\s\S]*SSD/i, 8000, 50000],
    ['tenkey', 'テンキー', 'keyboard', 'テンキー Bluetooth', /テンキー/, 1500, 15000],
    ['trackball', 'トラックボール', 'mouse', 'トラックボール ワイヤレス', /トラックボール/, 3000, 20000],
    ['ups', '無停電電源装置（UPS）', 'battery', '無停電電源装置 UPS', /無停電電源|UPS/, 8000, 60000],
  ] },
  { id: 'audio', n: 'オーディオ', c: '#7a2bbf', items: [
    ['nchp', 'ノイキャン ヘッドホン', 'headphones', 'ノイズキャンセリング ワイヤレスヘッドホン', /ヘッドホン|ヘッドフォン/, 10000, 80000],
    ['tws', '完全ワイヤレスイヤホン', 'earbuds', '完全ワイヤレスイヤホン ノイズキャンセリング', /イヤホン/, 5000, 50000],
    ['airpods', 'AirPods Pro 3', 'earbuds', 'AirPods Pro 3', /AirPods\s*Pro\s*3/i, 25000, 60000],
    ['soundbar', 'サウンドバー', 'soundbar', 'サウンドバー Dolby Atmos', /サウンドバー/, 10000, 150000],
    ['btspk', 'Bluetooth スピーカー', 'speaker', 'Bluetoothスピーカー 防水', /スピーカー/, 3000, 50000],
    ['usbmic', 'USB マイク', 'mic', 'USBマイク 配信', /マイク/, 3000, 40000],
    ['dap', 'デジタルオーディオプレーヤー', 'dap', 'デジタルオーディオプレーヤー ハイレゾ', /オーディオプレーヤー|ポータブルプレーヤー/, 10000, 150000],
    ['dap2', 'ポータブルアンプ DAC', 'dap', 'ポータブル USB DAC アンプ', /DAC/i, 3000, 60000],
    ['tws2', 'オープンイヤーイヤホン', 'earbuds', 'オープンイヤー ワイヤレスイヤホン', /オープンイヤー/, 5000, 40000],
    ['hpwired', '有線ヘッドホン モニター用', 'headphones', 'モニターヘッドホン 有線', /モニターヘッドホン|モニター用ヘッドホン/, 5000, 60000],
    ['neckspk', 'ネックスピーカー', 'speaker', 'ネックスピーカー ワイヤレス', /ネックスピーカー/, 5000, 40000],
    ['audioif', 'オーディオインターフェース', 'dap', 'オーディオインターフェース USB', /オーディオインターフェ/, 8000, 60000],
    ['bthp', 'ワイヤレスヘッドホン', 'headphones', 'ワイヤレスヘッドホン Bluetooth', /ワイヤレスヘッドホン|Bluetoothヘッドホン/, 4000, 40000],
    ['smartspk', 'スマートスピーカー', 'speaker', 'スマートスピーカー', /スマートスピーカー/, 3000, 30000],
    ['turn', 'レコードプレーヤー', 'soundbar', 'レコードプレーヤー Bluetooth', /レコードプレーヤー/, 8000, 60000],
  ] },
  { id: 'camera', n: 'カメラ', c: '#222222', items: [
    ['mirrorless', 'ミラーレス一眼', 'camera', 'ミラーレス一眼 ボディ フルサイズ', /ミラーレス/, 100000, 600000],
    ['actioncam', 'アクションカメラ', 'actioncam', 'アクションカメラ 4K', /アクションカメラ|GoPro|Osmo/i, 20000, 100000],
    ['drone', '小型ドローン', 'drone', 'DJI Mini ドローン', /DJI\s*Mini/i, 40000, 250000],
    ['lens', '望遠ズームレンズ', 'lens', '望遠ズームレンズ 70-200mm', /70-?200/, 50000, 400000],
    ['sd256', 'SDカード 256GB', 'sdcard', 'SDXCカード 256GB UHS-I', /256\s*GB/i, 2000, 20000],
    ['instax', 'チェキ', 'camera', 'instax mini 12 チェキ', /instax|チェキ/i, 8000, 30000],
    ['tripod', 'トラベル三脚', 'tripod', 'トラベル三脚 カーボン', /三脚/, 5000, 60000],
    ['gimbal', 'スマホ用ジンバル', 'gimbal', 'スマートフォン ジンバル 3軸', /ジンバル/, 8000, 40000],
    ['sd512', 'microSD 512GB', 'sdcard', 'microSDXC 512GB UHS-I', /micro\s*SD[\s\S]*512\s*GB/i, 3000, 30000],
    ['compact', 'コンパクトデジカメ', 'camera', 'コンパクトデジタルカメラ', /コンパクト[\s\S]*(デジカメ|デジタルカメラ)/, 20000, 200000],
    ['vlogcam', 'Vlog カメラ', 'actioncam', 'Vlogカメラ ジンバル', /Vlog/i, 30000, 150000],
    ['ndfilter', 'カメラ用 LED ライト', 'bulb', 'カメラ用 LEDライト 撮影', /LED[\s\S]*ライト[\s\S]*(撮影|カメラ)|(撮影|カメラ)[\s\S]*LED[\s\S]*ライト/, 2000, 30000],
    ['camera2', 'APS-C ミラーレス', 'camera', 'ミラーレス一眼 APS-C レンズキット', /ミラーレス[\s\S]*(APS-C|レンズキット)/, 60000, 300000],
    ['lens2', '単焦点レンズ 50mm', 'lens', '単焦点レンズ 50mm F1.8', /50\s*mm[\s\S]*F1\.?[48]/i, 15000, 150000],
    ['bag', 'カメラバッグ', 'camera', 'カメラバッグ リュック', /カメラバッグ|カメラリュック/, 3000, 30000],
  ] },
  { id: 'game', n: 'ゲーム・VR', c: '#ff7a00', items: [
    ['quest3', 'Meta Quest 3 512GB', 'vr', 'Meta Quest 3 512GB', /Quest\s*3(?!S)[\s\S]*512\s*GB/i, 50000, 120000],
    ['quest3s', 'Meta Quest 3S 128GB', 'vr', 'Meta Quest 3S 128GB', /Quest\s*3S[\s\S]*128\s*GB/i, 30000, 80000],
    ['switch2', 'Nintendo Switch 2 本体', 'handheld', 'Nintendo Switch 2 本体', /Switch\s*2(?=[\s\S]*本体)(?![\s\S]*(ソフト|コントローラ|ケース|ドック単体|カバー))/i, 40000, 100000],
    ['ps5', 'PlayStation 5 本体', 'controller', 'PlayStation 5 本体', /(PlayStation\s*5|PS5)(?=[\s\S]*本体)(?![\s\S]*(ソフト|コントローラ|ケース|スタンド|カバー|充電))/i, 50000, 150000],
    ['pad', 'ゲームコントローラー', 'controller', 'ワイヤレスコントローラー PC', /コントローラー/, 3000, 30000],
    ['ghs', 'ゲーミングヘッドセット', 'headset', 'ゲーミングヘッドセット', /ヘッドセット/, 3000, 40000],
    ['gchair', 'ゲーミングチェア', 'gamechair', 'ゲーミングチェア', /チェア/, 10000, 80000],
    ['gmon', '27型 ゲーミングモニター 240Hz', 'monitor', 'ゲーミングモニター 27インチ 240Hz', /27[\s\S]*240\s*Hz|240\s*Hz[\s\S]*27/i, 30000, 150000],
    ['ghandheld', '携帯ゲーミングPC', 'handheld', '携帯ゲーミングPC Ryzen', /携帯ゲーミング|ポータブルゲーミング/, 60000, 200000],
    ['gkb', 'ゲーミングキーボード', 'keyboard', 'ゲーミングキーボード', /ゲーミング[\s\S]*キーボード/, 5000, 40000],
    ['gmouse2', 'ゲーミングマウス 有線', 'mouse', 'ゲーミングマウス 有線 軽量', /ゲーミング[\s\S]*マウス/, 3000, 30000],
    ['capture', 'キャプチャーボード', 'nas', 'キャプチャーボード 4K', /キャプチャー/, 8000, 60000],
    ['psvr', 'VR 用 フェイスクッション', 'vr', 'VR フェイスクッション Quest 3', /フェイス(クッション|カバー)[\s\S]*Quest/i, 1500, 10000],
    ['tracker', 'フルトラ用 トラッカー', 'vr', 'フルボディトラッキング トラッカー', /トラッカー/, 10000, 80000],
    ['switchpad', 'Switch 2 用 コントローラー', 'controller', 'Switch 2 Proコントローラー', /Switch\s*2[\s\S]*コントローラー/i, 5000, 15000],
  ] },
  { id: 'home', n: '生活家電', c: '#00a0c8', items: [
    ['robovac', 'ロボット掃除機', 'robotvac', 'ロボット掃除機 水拭き', /ロボット掃除機/, 20000, 200000],
    ['stickvac', 'コードレス掃除機', 'vacuum', 'コードレス掃除機 スティック', /掃除機/, 10000, 100000],
    ['purifier', '空気清浄機', 'purifier', '空気清浄機 加湿', /空気清浄機/, 10000, 100000],
    ['washer', 'ドラム式洗濯機', 'washer', 'ドラム式洗濯乾燥機', /ドラム/, 100000, 400000],
    ['bulb', 'スマート電球', 'bulb', 'スマート電球 E26', /電球/, 1000, 10000],
    ['remote', 'スマートリモコン', 'remote', 'スマートリモコン', /リモコン/, 2000, 20000],
    ['fan', 'サーキュレーター', 'fan', 'サーキュレーター DCモーター', /サーキュレーター/, 3000, 30000],
    ['heater', 'セラミックヒーター', 'heater', 'セラミックファンヒーター 人感センサー', /セラミック/, 3000, 30000],
    ['dryer', 'ドライヤー 大風量', 'hairdryer', 'ヘアドライヤー 大風量 速乾', /ドライヤー/, 3000, 50000],
    ['humid', '加湿器', 'purifier', '加湿器 スチーム式', /加湿器/, 4000, 40000],
    ['shaver', '電気シェーバー', 'hairdryer', '電気シェーバー', /シェーバー/, 5000, 60000],
    ['ceiling', 'LED シーリングライト', 'bulb', 'LEDシーリングライト 8畳 調光調色', /シーリングライト/, 5000, 40000],
    ['iron', '衣類スチーマー', 'kettle', '衣類スチーマー', /衣類スチーマー/, 3000, 30000],
    ['vacuumh', 'ハンディクリーナー', 'vacuum', 'ハンディクリーナー コードレス', /ハンディクリーナー/, 3000, 30000],
    ['fan2', '扇風機 DC', 'fan', '扇風機 DCモーター リモコン', /扇風機/, 5000, 50000],
  ] },
  { id: 'kitchen', n: 'キッチン家電', c: '#c4000f', items: [
    ['oven', 'オーブンレンジ', 'microwave', 'オーブンレンジ 30L', /オーブンレンジ/, 20000, 150000],
    ['coffee', '全自動コーヒーメーカー', 'coffee', '全自動コーヒーメーカー ミル付き', /コーヒーメーカー/, 8000, 100000],
    ['rice', 'IH 炊飯器 5.5合', 'ricecooker', 'IH炊飯器 5.5合', /炊飯器/, 10000, 120000],
    ['kettle', '電気ケトル', 'kettle', '電気ケトル 温度調節', /ケトル/, 2000, 20000],
    ['blender', 'ブレンダー', 'blender', 'ハンドブレンダー', /ブレンダー/, 2000, 30000],
    ['toaster', 'トースター', 'toaster', 'オーブントースター 4枚', /トースター/, 3000, 40000],
    ['airfryer', 'ノンフライヤー', 'airfryer', 'ノンフライヤー 4L', /ノンフライヤー|エアフライヤー/, 5000, 40000],
    ['dish', '食器洗い乾燥機', 'dishwasher', '食器洗い乾燥機 工事不要', /食器洗/, 30000, 150000],
    ['hotcook', '電気圧力鍋', 'ricecooker', '電気圧力鍋', /電気圧力鍋/, 8000, 60000],
    ['grill', 'ホットプレート', 'toaster', 'ホットプレート', /ホットプレート/, 4000, 40000],
    ['kettle2', '電動コーヒーミル', 'coffee', '電動コーヒーミル', /コーヒーミル/, 3000, 30000],
    ['rice3', 'IH 炊飯器 3合', 'ricecooker', 'IH炊飯器 3合', /炊飯器[\s\S]*3\s*合|3\s*合[\s\S]*炊飯器/, 6000, 60000],
    ['mw', '単機能 電子レンジ', 'microwave', '電子レンジ 単機能 フラット', /電子レンジ(?![\s\S]*オーブン)/, 8000, 40000],
    ['soy', '豆乳メーカー・スープメーカー', 'blender', 'スープメーカー', /スープメーカー|豆乳メーカー/, 5000, 30000],
    ['sodaa', '炭酸水メーカー', 'kettle', '炭酸水メーカー', /炭酸水メーカー/, 5000, 30000],
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
    if (res.status === 429) { await sleep(8000 * (t + 1)); continue; } // 混んでいるときは長めに待って取り直す
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
      await sleep(1600); // 1秒に1回までの決まり。11/13 の初回で 429 が出たので間を広げた
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
    genres.push({ id: g.id, n: g.n, c: g.c, items: rows });
  }
  hist.weeks = hist.weeks.filter((w) => w.date !== today).concat([{ date: today, p: prices }]).slice(-12);
  return { ...pick(genres), hist, compared: base ? base.date : null };
}

// 先週より下がった割合の大きい順（比べる記録が無い品目は後ろ）。全体の上位 HERO 品を目玉の帯へ（ジャンルの欄からは外す）、各ジャンル PER 品
const byDrop = (a, b) => (a.wow == null) - (b.wow == null) || (a.wow ?? 0) - (b.wow ?? 0);
function pick(genres) {
  const all = genres.flatMap((g) => g.items.map((it) => ({ ...it, g: g.n, c: g.c }))).filter((it) => it.wow != null && it.wow < 0).sort(byDrop);
  const hero = []; const used = new Set();
  const roomy = new Set(genres.filter((g) => g.items.length > MIN_PER).map((g) => g.n)); // 目玉に1品出しても MIN_PER 品残るジャンルだけ
  for (const it of all) { if (hero.length >= HERO) break; if (!roomy.has(it.g) || hero.some((h) => h.g === it.g)) continue; hero.push(it); used.add(it.id); } // 同じジャンルからは1品
  return { hero, full: genres.map((g) => ({ ...g, items: [...g.items].sort(byDrop) })), genres: genres.map((g) => ({ ...g, items: g.items.filter((it) => !used.has(it.id)).sort(byDrop).slice(0, PER) })) };
}

function demo() {
  let k = 0;
  const genres = GENRES.map((g) => ({ id: g.id, n: g.n, c: g.c, items: g.items.map((s) => { k++; return { id: s[0], n: s[1], icon: s[2], p: Math.round((s[5] + (s[6] - s[5]) * 0.15) / 10) * 10 - 20, src: 'Yahoo!', wow: k % 6 === 0 ? 2.1 : k % 7 === 0 ? null : -((k * 37) % 150) / 10, bottom: k % 9 === 0 }; }) }));
  return { ...pick(genres), hist: null, compared: '2026-11-07' };
}

// 準備中：品目と絵だけ（価格は出さない）
function placeholder() {
  const all = GENRES.map((g) => ({ id: g.id, n: g.n, c: g.c, items: g.items.map((s) => ({ id: s[0], n: s[1], icon: s[2], p: null })) }));
  return { hero: [], full: all, genres: all.map((g) => ({ ...g, items: g.items.slice(0, PER) })), hist: null, compared: null };
}

// 号の日付（直近の土曜。土曜以外に作り直しても号は変わらない）
function issueDate() { const now = jstNow(); return new Date(now.getTime() - ((now.getUTCDay() + 1) % 7) * 86400e3); }

// gp を渡すと、そのジャンルだけの A4 のページ（目玉 GP_HERO 品＋ GP_LIST 品）
const GP_HERO = 3, GP_LIST = 12;
function html(data, ready, gp) {
  const now = jstNow();
  const d = issueDate(); // 号の日付：直近の土曜（土曜の朝に作る）
  const wd = '日月火水木金土'[d.getUTCDay()];
  const L = LAYOUT;
  if (gp) { const its = gp.items; const hero = ready ? its.filter((it) => it.wow != null && it.wow < 0).slice(0, GP_HERO).map((it) => ({ ...it, g: gp.n, c: gp.c })) : []; const hid = new Set(hero.map((h) => h.id)); data = { ...data, hero, genres: [{ ...gp, items: its.filter((it) => !hid.has(it.id)).slice(0, GP_LIST) }] }; }
  const all = data.hero.concat(data.genres.flatMap((g) => g.items));
  const drops = all.map((it) => it.wow).filter((v) => v != null && v < 0);
  const maxDrop = drops.length ? Math.min(...drops) : null;
  const count = all.length;
  const icon = (k) => ICONS[k] || ICONS.gpu;
  const src = (it) => (RAKUTEN && it.src ? `<span class="src">${esc(it.src)}調べ</span>` : '');
  const chg = (it) => it.wow == null ? '<span class="ch new">前号の価格なし</span>' : `<span class="ch${it.wow > 0 ? ' up' : ''}">前号比 ${it.wow > 0 ? '▲' : it.wow < 0 ? '▼' : '±'}${Math.abs(it.wow).toFixed(1)}%</span>`;
  const price = (it, cls) => ready ? `<div class="pr ${cls || ''}${yen(it.p).length >= 7 ? ' long' : ''}"><span class="yen">¥</span>${yen(it.p)}<small>〜<br><i>税込</i></small></div>` : `<div class="pr wait ${cls || ''}">¥ ― ―</div>`;
  // シールは決まった言葉だけ（品目の条件で数量を約束しているわけではないので「数量限定」などは飾りの帯にだけ使う）
  const sticker = (it) => !ready ? '' : it.bottom ? '<span class="st st-b">最安更新</span>' : it.wow != null && it.wow <= -5 ? '<span class="st">値下がり</span>' : it.wow != null && it.wow >= 3 ? '<span class="st st-u">値上がり</span>' : '';
  const heroCard = (it, i) => `<div class="hc" style="--gc:${it.c}"><div class="hg">${esc(it.g)}</div><div class="hpic">${icon(it.icon)}</div><div class="htx"><div class="hn">${esc(it.n)}</div>${price(it, 'big')}<div class="hbelow">${chg(it)}${src(it)}</div></div><div class="burst hb"><b>前号比</b><span>▼${Math.abs(it.wow) < 1 ? Math.abs(it.wow).toFixed(1) : Math.abs(it.wow).toFixed(0)}<small>%</small></span></div><div class="limit">${['今週いちばんの値下がり', '集会の話のネタにどうぞ', '気になったら島で語ろう'][i] || ''}</div></div>`;
  const heroEmpty = ready ? `<div class="hc empty"><div class="hn">${data.compared ? '今週は前号より下がった品がありませんでした' : '前号の価格がまだ無いので、目玉は次の号から'}</div></div>` : '<div class="hc empty wait"><div class="wb">準備中</div><div class="ws">価格の取得の設定が済みしだい<br>毎週土曜に更新します</div></div>';
  const item = (it, i) => `<div class="it${i === 0 ? ' top' : ''}${ready && (i === 0 || sticker(it)) ? ' stk' : ''}"><div class="pic">${icon(it.icon)}</div><div class="tx"><div class="nm">${esc(it.n)}</div>${price(it)}${ready ? chg(it) : '<span class="ch wait">価格は準備中</span>'}${src(it)}</div>${i === 0 && ready ? '<span class="st st-top">目玉</span>' : sticker(it)}</div>`;
  const tileNote = ready ? '検索時点の税込価格・送料別／前号比は同じ検索条件の最安どうし' : '価格は準備中です';
  const tiles = data.genres.map((g, gi) => `<div class="g" style="--gc:${g.c}"><h2>${gi + 1}. ${esc(g.n)}<span class="h2s">${DEMO ? '<b class="gm">見本・架空価格</b>' : ready ? '値下がり順' : ''}</span></h2>${g.items.map(item).join('')}${g.items.length < PER ? `<div class="it miss">${g.items.length === 0 ? '今週は価格を取れませんでした' : 'ほかの品目は今週は取れませんでした'}</div>` : ''}<div class="gn">${tileNote}</div></div>`).join('');
  const heroes = ready && data.hero.length ? data.hero.map(heroCard).join('') : heroEmpty;
  const credit = 'Web Services by Yahoo! JAPAN' + (RAKUTEN ? ' ／ Supported by Rakuten Developers' : '');
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK JP","Noto Sans JP","IPAGothic",sans-serif;color:#111;overflow:hidden;position:relative;
 background:radial-gradient(circle,#ffd400 2.2px,transparent 2.6px) 0 0/18px 18px,#fff200}
/* 見出し：放射線と水玉 */
.hd{position:absolute;left:0;top:0;width:${W}px;height:258px;color:#fff;padding:12px 30px 0;border-bottom:8px solid #111;overflow:hidden;
 background:radial-gradient(circle,rgba(255,255,255,.18) 3px,transparent 3.5px) 0 0/22px 22px,repeating-conic-gradient(from 0deg at 50% 130%,#e60012 0 5deg,#ff3030 5deg 10deg)}
.hd{padding-left:110px}.hd .sub{font-size:30px;font-weight:900;background:#111;color:#fff200;display:inline-block;padding:2px 16px;transform:rotate(-3deg)}
.hd h1{font-size:72px;font-weight:900;line-height:1;margin-top:6px;letter-spacing:1px;-webkit-text-stroke:4px #111;paint-order:stroke;text-shadow:7px 7px 0 #111;white-space:nowrap}
.hd h1 em{color:#fff200;font-style:normal}
.hd .date{font-size:28px;font-weight:900;margin-top:8px;background:#fff;color:#e60012;display:inline-block;padding:2px 14px;border:4px solid #111}
.hd .date b{color:#111}
.ribbon{position:absolute;left:-62px;top:28px;transform:rotate(-38deg);background:#111;color:#fff200;font-size:20px;font-weight:900;padding:4px 70px;letter-spacing:2px;border-top:3px solid #fff200;border-bottom:3px solid #fff200}
.burst{display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;text-align:center;clip-path:polygon(50% 0,61% 13%,77% 6%,79% 22%,95% 24%,88% 39%,100% 50%,88% 61%,95% 76%,79% 78%,77% 94%,61% 87%,50% 100%,39% 87%,23% 94%,21% 78%,5% 76%,12% 61%,0 50%,12% 39%,5% 24%,21% 22%,23% 6%,39% 13%)}
.b1{position:absolute;right:40px;top:18px;width:200px;height:200px;background:#fff200;color:#e60012;transform:rotate(10deg)}.b1 b{font-size:30px}.b1 span{font-size:62px;line-height:1}
/* 今週の目玉の帯 */
.hero{position:absolute;left:0;top:258px;width:${W}px;height:${L.head - 258}px;padding:8px 12px 10px;display:flex;gap:10px;
 background:repeating-linear-gradient(-45deg,#111 0 14px,#2a2a2a 14px 28px)}
.hero .hl{position:absolute;left:12px;top:0;background:#e60012;color:#fff200;font-size:30px;font-weight:900;padding:2px 18px 4px;border:4px solid #fff200;border-top:none;z-index:4;letter-spacing:2px}
.hc{flex:1;min-width:0;background:#fff;border:6px solid var(--gc);border-radius:10px;position:relative;display:flex;align-items:center;gap:6px;padding:30px 8px 26px;overflow:hidden}
.hc.empty{display:flex;align-items:center;justify-content:center}.hc.empty .hn{font-size:34px;color:#777;padding:0}
.hc.wait{gap:30px;border-color:#e60012}.hc.wait .wb{font-size:120px;font-weight:900;color:#e60012;transform:rotate(-4deg)}.hc.wait .ws{font-size:30px;font-weight:900;line-height:1.4}
.hc .hg{position:absolute;left:0;top:0;background:var(--gc);color:#fff;font-size:20px;font-weight:900;padding:1px 10px}
.hpic{width:96px;height:96px;flex:none}.hpic svg,.pic svg{width:100%;height:100%;display:block}
.htx{min-width:0;flex:1}
.hn{padding-right:88px;font-size:22px;font-weight:900;line-height:1.12;max-height:3.5em;overflow:hidden}
.hbelow{margin-top:2px}
.hb{position:absolute;right:4px;top:4px;width:100px;height:100px;background:#e60012;color:#fff200;transform:rotate(-12deg)}.hb b{font-size:15px}.hb span{font-size:34px;line-height:1}.hb small{font-size:16px}
.limit{position:absolute;left:0;right:0;bottom:0;z-index:3;background:#111;color:#fff;font-size:17px;font-weight:800;padding:1px 10px;text-align:left}
.coupon{width:262px;flex:none;background:#fff8d6;border:4px dashed #e60012;border-radius:10px;position:relative;padding:28px 12px 10px;text-align:center;color:#e60012;font-weight:900}
.coupon:before,.coupon:after{content:"";position:absolute;top:50%;width:28px;height:28px;border-radius:50%;background:#1d1d1d;transform:translateY(-50%)}.coupon:before{left:-18px}.coupon:after{right:-18px}
.coupon.hide{display:none}.coupon.mbig{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;border:8px solid #e60012;transform:rotate(-4deg)}.coupon.mbig b{font-size:110px;line-height:1}.coupon.mbig span{font-size:26px;color:#111}
.coupon .ct{position:absolute;left:0;right:0;top:0;background:#e60012;color:#fff;font-size:19px;padding:2px}
.coupon .cn{font-size:62px;line-height:1;margin-top:6px}.coupon .cn small{font-size:26px}
.coupon .cs{font-size:20px;color:#111;margin-top:6px;line-height:1.3}
.coupon .cj{position:absolute;left:6px;right:6px;bottom:6px;font-size:15px;line-height:1.25;color:#111;font-weight:900}
/* ジャンルの欄 */
.grid{position:absolute;left:${L.pad}px;right:${L.pad}px;top:${L.head + L.pad}px;bottom:${L.foot + L.pad}px;display:grid;grid-template-columns:repeat(${L.cols},1fr);grid-template-rows:repeat(${L.rows},1fr);gap:${L.gap}px}
.g{background:#fff;border:5px solid var(--gc);display:flex;flex-direction:column;overflow:hidden;min-height:0;box-shadow:4px 4px 0 #111}
.g h2{font-size:27px;font-weight:900;white-space:nowrap;color:#fff;padding:2px 10px;letter-spacing:1px;background:var(--gc);display:flex;justify-content:space-between;align-items:center}
.g h2 .h2s{font-size:14px;flex:none;background:#fff200;color:#111;padding:0 6px;transform:rotate(-4deg)}
.it{display:flex;align-items:center;gap:8px;padding:3px 8px;border-top:3px dashed #c8c8c8;flex:1;position:relative;min-height:0;overflow:hidden}
.it .pic{width:72px;height:72px;flex:none;background:#fff;border-radius:8px}
.it .tx{min-width:0;flex:1}
.it .nm{font-size:20px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.it.stk .nm{padding-right:66px}
.pr{font-size:34px;font-weight:900;color:#e60012;line-height:1;letter-spacing:-1px;white-space:nowrap;display:flex;align-items:flex-end;-webkit-text-stroke:1px #fff;paint-order:stroke}
.pr .yen{font-size:.6em;margin-right:1px}
.pr small{font-size:15px;line-height:1;margin-left:2px;letter-spacing:0;color:#e60012}.pr small i{font-style:normal;font-size:12px;color:#555}
.pr.big{font-size:44px}.pr.big small{font-size:20px}.pr.big small i{font-size:14px}
.pr.wait{color:#aaa}
.pr.long{font-size:29px}.it.top .pr.long{font-size:33px}.pr.big.long{font-size:38px}
.ch{font-size:18px;font-weight:800;color:#0a8a2a;white-space:nowrap}
.ch.up{color:#c4000f}.ch.new{color:#666}.ch.wait{color:#777}
.src{font-size:13px;color:#666;margin-left:4px}
.st{position:absolute;right:4px;top:3px;background:#e60012;color:#fff200;font-size:16px;font-weight:900;padding:0 7px;border-radius:30px;transform:rotate(8deg);border:2px solid #111;z-index:2}
.st-b{background:#111;color:#fff200}.st-u{background:#fff;color:#c4000f}.st-top{background:#fff200;color:#e60012;font-size:20px;border-width:3px;transform:rotate(-8deg)}
.it.top{flex:1.8;background:#fffbe0}.it.top .pic{width:88px;height:88px}.it.top .nm{font-size:22px}.it.top.stk .nm{padding-right:56px}.it.top .pr{font-size:40px}.it.top .pr small{font-size:17px}
.g{position:relative}.gn{font-size:13px;color:#555;padding:1px 6px;border-top:2px solid #ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.g h2 .gm{display:inline-block;background:#e60012;color:#fff;border:2px solid #fff;font-size:17px;padding:0 6px}
.gpl{position:absolute;left:${L.pad}px;right:${L.pad}px;top:${L.head + L.pad}px;bottom:${L.foot + L.pad}px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(6,1fr) 30px;gap:10px}
.gpl .it{border:5px solid var(--gc);border-radius:12px;background:#fff;padding:8px 14px;gap:14px;box-shadow:4px 4px 0 #111}
.gpl .it .pic{width:150px;height:150px}
.gpl .it .nm{font-size:30px;white-space:normal;max-height:2.3em;line-height:1.15}.gpl .it.stk .nm{padding-right:110px}
.gpl .pr{font-size:62px}.gpl .pr.long{font-size:52px}.gpl .pr small{font-size:24px}.gpl .pr small i{font-size:18px}
.gpl .ch{font-size:26px}.gpl .src{font-size:18px}
.gpl .st{font-size:24px;padding:2px 12px;top:8px;right:8px;border-width:3px}
.gpn{grid-column:1 / 3;grid-row:-2;font-size:20px;color:#333;background:#fff;border:3px solid #111;padding:1px 10px;white-space:nowrap;overflow:hidden}
.gpm{position:absolute;left:12px;top:-30px;transform:rotate(4deg);background:#e60012;border:4px solid #fff;color:#fff;font-size:34px;font-weight:900;padding:2px 18px;z-index:6;white-space:nowrap}
.it.miss{justify-content:center;color:#777;font-size:20px;font-weight:800;flex:.5}
/* 下の帯 */
.foot{position:absolute;bottom:0;left:0;right:0;height:${L.foot}px;background:#111;color:#fff;font-size:20px;padding:6px 24px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.foot .fl{line-height:1.35}.foot .fl b{color:#fff200}
.foot .tape{position:absolute;left:560px;top:8px;background:#fff200;color:#111;font-weight:900;font-size:20px;padding:2px 22px;transform:rotate(-2deg);border:3px solid #111}
.mihon.m2{top:520px;font-size:200px;letter-spacing:20px}
.mtape{position:absolute;left:0;right:0;top:0;background:#e60012;color:#fff;font-size:34px;font-weight:900;text-align:center;z-index:9;padding:4px}
.stamp{position:absolute;right:300px;top:30px;transform:rotate(-7deg);background:#fff;border:9px solid #e60012;color:#e60012;font-weight:900;text-align:center;padding:6px 22px;border-radius:18px;z-index:5}
.stamp b{display:block;font-size:76px;line-height:1.05}.stamp span{display:block;font-size:20px;color:#111;margin-top:2px;white-space:nowrap}
.mihon{position:absolute;left:50%;top:1250px;transform:translate(-50%,-50%) rotate(-12deg);font-size:380px;font-weight:900;color:rgba(230,0,18,.07);-webkit-text-stroke:5px rgba(230,0,18,.28);letter-spacing:40px;z-index:9;pointer-events:none;white-space:nowrap}
</style></head><body>
<div class="hd"><div class="sub">ガジェット愛好会 週刊${gp ? `　ジャンル別 ${GENRES.findIndex((g) => g.id === gp.id) + 1}/${GENRES.length}` : ''}</div><h1>${gp ? `<em>${esc(gp.n)}</em>${ready ? ' 特価！' : '（準備中）'}` : ready ? '今週の<em>ガジェット</em>特価まつり！' : '<em>ガジェット</em>一覧（準備中）'}</h1><div class="date">${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${wd}）号　<b>毎週土曜</b>に自動で更新</div>
<div class="burst b1">${ready && maxDrop != null ? `<b>前号比</b><span>最大<br>${Math.abs(maxDrop) < 1 ? Math.abs(maxDrop).toFixed(1) : Math.abs(maxDrop).toFixed(0)}%</span><b>値下がり</b>` : gp ? `<b>${esc(gp.n.length > 6 ? 'このジャンル' : gp.n)}</b><span>${count}品</span><b>${ready ? 'ぎっしり' : '掲載予定'}</b>` : `<b>${data.genres.length}ジャンル</b><span>${count}品</span><b>${ready ? 'ぎっしり' : '掲載予定'}</b>`}</div>
<div class="ribbon">毎週土曜更新</div></div>
<div class="hero"><div class="hl">${gp ? 'このジャンルの目玉' : '今週の目玉'}</div>${heroes}
${DEMO ? '<div class="coupon mbig"><b>見本</b><span>価格は作り物</span></div>' : ''}<div class="coupon${DEMO ? ' hide' : ''}"><div class="ct">✂ おふざけ券（割引なし）</div><div class="cn">100<small>%</small></div><div class="cs">集会に来ると<br>楽しさ <b>100%</b> 増量</div><div class="cj">ガジェ愛の冗談の券。お店では使えません</div></div></div>
${gp ? `<div class="gpl" style="--gc:${gp.c};grid-template-rows:repeat(${Math.max(4, Math.ceil(data.genres[0].items.length / 2))},1fr) 30px">${data.genres[0].items.map((it, i) => item(it, i + 1)).join('')}${DEMO ? '<b class="gpm">見本・架空価格</b>' : ''}<div class="gpn">${tileNote}</div></div>` : `<div class="grid">${tiles}</div>`}
${ready ? (DEMO ? '<div class="mtape">見本：価格は作り物です（並びの確認用）。公開しません</div>' : '') : ''}
<div class="foot"><div class="tape">${ready ? '価格は変わることがあります' : '価格は取得の設定のあとに載ります'}</div><div class="fl">${ready ? `検索した条件の中の最安（税込・送料別）。店頭とは違います${data.compared ? `<br>前号比は <b>${data.compared}</b> 号と比べて` : ''}` : '絵はイメージです。価格はまだ入っていません'}</div><div>${ready ? credit : 'ガジェット愛好会'}</div></div>
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
  const count = data.hero.length + data.genres.reduce((a, g) => a + g.items.length, 0);
  // ジャンルごとに MIN_PER 品は取れないと出さない（前の週のチラシが残る）
  const thin = data.genres.filter((g) => g.items.length < MIN_PER).map((g) => `${g.n}:${g.items.length}`)
    .concat(data.full.filter((g) => g.items.length < MIN_GP).map((g) => `${g.n}（ジャンルのページ）:${g.items.length}`));
  if (ready && !DEMO && thin.length) { console.error(`取れた品目が少ないジャンルがあるので書き出さない（${thin.join(' ')}）`); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const base = DEMO ? 'flyer-demo' : 'flyer'; // 見本は別の名前（公開する flyer.png・flyer.json を上書きしない）
  // 11/12 本人「ジャンルごとに分けるのであれば、それぞれ A4 で出力して欲しい」→ 表紙（flyer.png：全ジャンルの目玉と各6品）と、ジャンルごとの A4（flyer-<id>.png：目玉最大3＋最大12品）
  // 全部を一時フォルダで作り、9 枚そろって大きさも正しいときだけ出力先へ移す（途中で失敗して新旧が混ざらないように）
  const tmp = fs.mkdtempSync(path.join(outDir, '.flyer-tmp-'));
  const pageInfo = [{ id: 'cover', file: base + '.png' }];
  const pages = [{ name: base, html: html(data, ready) }].concat(data.full.map((g) => {
    const its = g.items, hero = ready ? its.filter((it) => it.wow != null && it.wow < 0).slice(0, GP_HERO) : [];
    const hid = new Set(hero.map((h) => h.id));
    pageInfo.push({ id: g.id, n: g.n, file: `${base}-${g.id}.png`, hero: hero.map((h) => h.id), list: its.filter((it) => !hid.has(it.id)).slice(0, GP_LIST).map((it) => it.id) });
    return { name: `${base}-${g.id}`, html: html(data, ready, g) };
  }));
  try {
    for (const pg of pages) {
      const htmlPath = path.resolve(tmp, pg.name + '.html');
      fs.writeFileSync(htmlPath, pg.html);
      const png = path.resolve(tmp, pg.name + '.png');
      execFileSync(chrome(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--force-device-scale-factor=1', `--window-size=${W},${H}`, `--screenshot=${png}`, 'file://' + htmlPath], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 120000 });
      const buf = fs.readFileSync(png); // PNG の IHDR で大きさを確かめる（撮り損ねを公開しない）
      if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(16) !== W || buf.readUInt32BE(20) !== H) throw new Error(`${pg.name}.png の大きさが違う（${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}）`);
    }
    fs.writeFileSync(path.join(tmp, base + '.json'), JSON.stringify({ v: 2, ready, demo: DEMO, issue: ymd(issueDate()), updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), date: ymd(jstNow()), compared: data.compared, pages: pageInfo, hero: data.hero, cover: data.genres, items: data.full }));
    // ここで移す。公開は Actions が data ブランチへ1回のコミットで入れ、Pages をまとめて作り直すので、見る人に新旧が混ざって見えることはない
    for (const f of fs.readdirSync(tmp)) fs.renameSync(path.join(tmp, f), path.join(outDir, f));
  } catch (e) { console.error(String(e.message || e)); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
  fs.rmSync(tmp, { recursive: true, force: true });
  const png = path.join(outDir, base + '.png');
  if (data.hist && !DEMO) fs.writeFileSync(path.join(outDir, 'flyer-history.json'), JSON.stringify(data.hist));
  console.log(`${ready ? count + ' 品' : '準備中'} → ${pages.length} 枚（${outDir}/${base}*.png）`);
})();
