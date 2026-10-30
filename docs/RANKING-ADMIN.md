# 先生用：ランキングの 名前を 消す

「和音の 聴きわけ」（`ear.html`）の 🏆 チャレンジの ランキングで、よくない 名前や 本名を 見つけた ときの 手順です。
もとの「和音ききわけ」（waon-kikiwake）と おなじ しくみ・おなじ データベース（D1 の `waon-ranking`）です。

先生用キー（`ADMIN_KEY`）は ファイルに 書かず、ターミナルの 環境変数に だけ 入れて つかいます。

## はじめに 1回だけ

キーは Cloudflare の Worker **piano-chord-apps** に 入れます（もとの waon-kikiwake の キーは つかえません。べつの Worker なので）。

- Cloudflare の 画面で：Workers & Pages → **piano-chord-apps** → Settings → Variables and Secrets → Add → 種類 **Secret**、名前 `ADMIN_KEY`、値は 24文字 以上の ランダムな 文字。
- または ターミナルで（このリポジトリの いちばん上で）：

```sh
openssl rand -hex 24 | npx wrangler secret put ADMIN_KEY   # 24文字 以上。短いと 先生用 API は 404 のまま
```

キーは パスワード管理アプリなどに しまって おきます。リポジトリ・チャット・メモには 書かないでください。
キーを 10回 まちがえると、その 回線からは 1時間 つかえなく なります。

テーブル（`migrations/0001_init.sql`・`0002_moderation.sql`）は もとの 和音ききわけで もう 作って あります。新しく 作るときだけ：

```sh
npx wrangler d1 migrations apply DB --remote
```

## 名前を 消す 手順

```sh
export SITE=https://piano-chord-apps.g960059.workers.dev
read -s ADMIN_KEY && export ADMIN_KEY      # キーを はりつけて Enter（画面には 出ません）

# 1. さがす（名前の 一部で。「ぜんぶ」と「今週」の 両方が 出ます）
curl -s -G "$SITE/api/admin/scores" --data-urlencode "name=<名前の一部>" -H "Authorization: Bearer $ADMIN_KEY"
#    上位 50 人を 端末ID つきで 見る： ?period=all または ?period=week
curl -s "$SITE/api/admin/scores?period=week" -H "Authorization: Bearer $ADMIN_KEY"

# 2. 出てきた playerId の 記録を 消す（「ぜんぶ」「今週」の 両方）
curl -s -X DELETE "$SITE/api/admin/scores/<playerId>" -H "Authorization: Bearer $ADMIN_KEY"

#    同じ 端末から もう のせない ときは ?block=1 を つける（その子の 結果は 画面には 出ますが、ランキングには のりません）
curl -s -X DELETE "$SITE/api/admin/scores/<playerId>?block=1" -H "Authorization: Bearer $ADMIN_KEY"

# 3. 「もう のせない」を とりけす
curl -s -X DELETE "$SITE/api/admin/blocks/<playerId>" -H "Authorization: Bearer $ADMIN_KEY"

unset ADMIN_KEY
```

かえってくる もの：

- `GET /api/admin/scores` → `{ rows: [{ rank, period, playerId, name, level, mastered, correct, total, at, blocked }] }`
- `DELETE /api/admin/scores/<playerId>` → `{ deleted: 消した 行の 数, blocked: true|false }`
- `DELETE /api/admin/blocks/<playerId>` → `{ unblocked: 1 か 0 }`

## 自動で していること

- 名前の チェック（よくない ことば・なりすまし・電話番号・URL）は 画面と サーバーの 両方で、おなじ きまり（`assets/ear-game.js` の `checkName`）で しています。
- 画面では「本名は 入れないでね」と 出し、漢字だけ 3〜5文字の 名前には「ニックネームが おすすめ」と 出します。
- 1つの 回線から：チャレンジは 1時間に 30回まで、ランキングに のせられる 端末は 1日 8台まで、ランキングの 書きかえは 1日 30回まで（こえても 採点は します）。
- 毎日 1:05（日本時間）に、古い チャレンジ・IP のハッシュ用の 塩・先々週より 前の 週の 記録を 消します（`wrangler.jsonc` の cron）。
- Cloudflare の ログは console の エラーだけ のこし、リクエストごとの 記録（URL・場所の 情報）は のこしません。

## 保存して いる もの

ニックネーム・スコア（とどいた レベル・マスター・正解数・問題数・時刻）・端末の ランダムな ID・IP の ハッシュ（回数制限用。日ごとに かわる 塩つき。IP そのものは 保存しない）だけです。
