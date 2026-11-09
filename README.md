# gadget-world-feed

VRChat のワールドで読む小さなデータを、GitHub Actions で定期的に作って GitHub Pages に出すリポジトリ。

| ファイル | 中身 | 更新 |
|---|---|---|
| `stocks.json` | 米国テック株10銘柄の現在値・前日比％・直近5日の終値（Yahoo Finance） | 米国市場の時間帯は15分ごと、ほかは3時間ごと |
| `parts.json` | PCパーツ9品目の最安値（Yahoo!ショッピングの商品検索API、新品・在庫あり）と直近30日の動き | 1日1回（日本時間 8:37、`parts.yml`）。履歴の原本は `data` ブランチの `parts.json`。Actions の秘密の値 `YAHOO_APPID`（Yahoo!デベロッパーネットワークの Client ID）が要る。無いあいだは parts.json を出さない |

Web Services by Yahoo! JAPAN（https://developer.yahoo.co.jp/sitemap/）

- 手元で試す：`node stocks.js`（Node 18 以上）→ `out/stocks.json`
- 形：`{ v, updated(UTC), jst(取りに行った時刻 "MM/DD hh:mm"), trade(最新の取引の時刻・日本時間), ok(取れた銘柄数), market(open/pre/post/closed), source, items:[{ s:記号, n:名前, p:価格, c:前日比%, h:[5日の終値] }] }`
- items は常に全銘柄・同じ順番。取れなかった銘柄は p・c が null、h が空。半分以上取れなかった回は書き出さない（前の回が残る）
- parts.json の形：`{ v, date, source, credit, ok, sample?, items:[{ id, n:名前, p:最安値(円), shop, d30:30日の変化%, hist:[[日付, 最安値], ...] }] }`。`YAHOO_APPID=... node parts.js` / 見本（値は作り物、`sample: true`。公開しない）は `node parts.js --sample`
- 投資の判断に使うためのものではありません。値は遅れたり欠けたりします。
