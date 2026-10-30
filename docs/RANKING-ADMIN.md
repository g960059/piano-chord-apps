# 先生用：ランキングの名前を消す

「和音の聴きわけ」（`ear.html`）の 🏆 チャレンジのランキングで、よくない名前や本名を見つけたときの手順です。
もとの「和音ききわけ」（waon-kikiwake）とおなじしくみ・おなじデータベース（D1の `waon-ranking`）です。

先生用キー（`ADMIN_KEY`）はファイルに書かず、ターミナルの環境変数にだけ入れてつかいます。

## はじめに1回だけ

キーは Cloudflare の Worker **piano-chord-apps** に入れます（もとの waon-kikiwake のキーはつかえません。べつの Worker なので）。

- Cloudflare の画面で：Workers & Pages → **piano-chord-apps** → Settings → Variables and Secrets → Add → 種類 **Secret**、名前 `ADMIN_KEY`、値は24文字以上のランダムな文字。
- またはターミナルで（このリポジトリのいちばん上で）：

```sh
openssl rand -hex 24 | npx wrangler secret put ADMIN_KEY   # 24文字以上。短いと先生用 API は404のまま
```

キーはパスワード管理アプリなどにしまっておきます。リポジトリ・チャット・メモには書かないでください。
キーを10回まちがえると、その回線からは1時間つかえなくなります。

テーブル（`migrations/0001_init.sql`・`0002_moderation.sql`）はもとの和音ききわけでもう作ってあります。新しく作るときだけ：

```sh
npx wrangler d1 migrations apply DB --remote
```

## 名前を消す手順

```sh
export SITE=https://piano-chord-apps.g960059.workers.dev
read -s ADMIN_KEY && export ADMIN_KEY      # キーをはりつけて Enter（画面には出ません）

# 1. さがす（名前の一部で。「ぜんぶ」と「今週」の両方が出ます）
curl -s -G "$SITE/api/admin/scores" --data-urlencode "name=<名前の一部>" -H "Authorization: Bearer $ADMIN_KEY"
#    上位50人を端末ID つきで見る： ?period=all または ?period=week
curl -s "$SITE/api/admin/scores?period=week" -H "Authorization: Bearer $ADMIN_KEY"

# 2. 出てきた playerId の記録を消す（「ぜんぶ」「今週」の両方）
curl -s -X DELETE "$SITE/api/admin/scores/<playerId>" -H "Authorization: Bearer $ADMIN_KEY"

#    同じ端末からもうのせないときは ?block=1をつける（その子の結果は画面には出ますが、ランキングにはのりません）
curl -s -X DELETE "$SITE/api/admin/scores/<playerId>?block=1" -H "Authorization: Bearer $ADMIN_KEY"

# 3. 「もうのせない」をとりけす
curl -s -X DELETE "$SITE/api/admin/blocks/<playerId>" -H "Authorization: Bearer $ADMIN_KEY"

unset ADMIN_KEY
```

かえってくるもの：

- `GET /api/admin/scores` → `{ rows: [{ rank, period, playerId, name, level, mastered, correct, total, at, blocked }] }`
- `DELETE /api/admin/scores/<playerId>` → `{ deleted: 消した行の数, blocked: true|false }`
- `DELETE /api/admin/blocks/<playerId>` → `{ unblocked: 1か0 }`

## ずる（プログラムでこたえる）について

ランキングはずるをふせげるしくみではありません。チャレンジの問題の種（seed）はページにわたすので、プログラムを書けばぜんぶ正解してすぐに上位にのれます（40問マスターが30秒ほど。サーバーは1問0.8秒より速い結果だけことわります）。

- あやしい記録：マスターでまちがい0（`correct` と `total` がおなじ）、とくに知らない名前や同じ日にいくつもならぶもの。
  かかった時間は保存していないので、`GET /api/admin/scores` の結果とふだんの生徒のようすをくらべてきめます。
- 見つけたら上の手順で消す。くりかえすときは `?block=1` でその端末をもうのせない。
- サーバーで問題を出すしくみにつくりかえるのは、いまはしません。

## 自動でしていること

- 名前のチェック（よくないことば・なりすまし・電話番号・URL）は画面とサーバーの両方で、おなじきまり（`assets/ear-game.js` の `checkName`）でしています。
- 画面では「本名は入れないでね」と出し、漢字だけ3〜5文字の名前には「ニックネームがおすすめ」と出します。
- 1つの回線から：チャレンジは1時間に30回まで、ランキングにのせられる端末は1日8台まで、ランキングの書きかえは1日30回まで（こえても採点はします）。
- 毎日1:05（日本時間）に、古いチャレンジ・IP のハッシュ用の塩・先々週より前の週の記録を消します（`wrangler.jsonc` の cron）。
- Cloudflare のログは console のエラーだけのこし、リクエストごとの記録（URL・場所の情報）はのこしません。

## 保存しているもの

ニックネーム・スコア（とどいたレベル・マスター・正解数・問題数・時刻）・端末のランダムな ID・IP のハッシュ（回数制限用。日ごとにかわる塩つき。IP そのものは保存しない）だけです。
