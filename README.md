# gadget-world-feed

VRChat のワールドで読む小さなデータを、GitHub Actions で定期的に作って GitHub Pages に出すリポジトリ。

| ファイル | 中身 | 更新 |
|---|---|---|
| `stocks.json` | 米国テック株・日本のテック・半導体株・ガジェット関連 ETF 各10銘柄の現在値・前日比％・直近5日と約1か月の終値（Yahoo Finance） | 米国市場の時間帯は15分ごと、ほかは3時間ごと |
| `parts.json` | PCパーツ26品目の最安値（Yahoo!ショッピングの商品検索API、新品・在庫あり）と直近30日の動き | 1日1回（日本時間 8:37、`parts.yml`）。履歴の原本は `data` ブランチの `parts.json`。Actions の秘密の値 `YAHOO_APPID`（Yahoo!デベロッパーネットワークの Client ID）が要る。無いあいだは parts.json を出さない |

| `flyer.png` | 週刊チラシ「ガジェット特価まつり」（1448×2048。8ジャンル×5品、先週より下がった割合の大きい順。絵は自作のイラスト `flyer-icons.js`） | 毎週土曜 7:07（`flyer.yml`）。`data` ブランチに置いて Pages に載せる。`YAHOO_APPID` が無いうちは価格の無い「準備中」のチラシ。`RAKUTEN_APP_ID` があれば楽天市場も見る |

Web Services by Yahoo! JAPAN（https://developer.yahoo.co.jp/sitemap/）

- 手元で試す：`node stocks.js`（Node 18 以上）→ `out/stocks.json`
- stocks.json の形（v2）：`{ v:2, updated(UTC), jst(取りに行った時刻), source, groups:[{ id(US/JP/ETF), title, jt:日本語の見出し, mr:m の期間, cur, dec, market(open/pre/post/closed), trade(最新の取引の時刻・日本時間), ok, items:[{ s:記号, n:英字の名前, j:日本語の名前, p:価格, c:前日比%, h:[5日の終値], m:[約1か月の終値] }] }] }`
- items は常に全銘柄・同じ順番。取れなかった銘柄は p・c が null、h が空。半分以上取れなかった回は書き出さない（前の回が残る）
- parts.json の形：`{ v, date, source, credit, ok, sample?, items:[{ id, n:名前, p:最安値(円), shop, d30:30日の変化%, hist:[[日付, 最安値], ...] }] }`。`YAHOO_APPID=... node parts.js` / 見本（値は作り物、`sample: true`。公開しない）は `node parts.js --sample`
- チラシ：`node flyer.js`（Chrome が要る。`CHROME` で場所を指定できる）→ `out/flyer.png`。手元で並びを見るだけなら `--demo`（作り物の価格に「見本」の判。公開しない）。商品写真は使わない（Yahoo!・楽天の API の規約で、取得した画像を別の画像に焼き込んで見せてよいとはっきりしないため）
- 投資の判断に使うためのものではありません。値は遅れたり欠けたりします。
