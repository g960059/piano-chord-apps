# ランキングを「和音の聴きわけ」にうつす手順（和音ききわけ → ピアノ和音アプリ）

べつのアプリだった「和音ききわけ」（g960059/waon-kikiwake、https://waon-kikiwake.g960059.workers.dev/ ）のランキングを、
このリポジトリの `ear.html`（和音の聴きわけ）の 🏆 チャレンジにまとめました。
データベース（Cloudflare D1の `waon-ranking`）はおなじものをつかうので、**いままでのランキングはそのままのこります**。

このリポジトリでかわったこと：

| ファイル | 中身 |
|---|---|
| `wrangler.jsonc` | Worker の設定。名前 `piano-chord-apps`、`main: src/worker.js`、静的ファイルはリポジトリのいちばん上（`assets.directory: "."`）、`/api/*` だけ Worker、D1 `DB` → `waon-ranking`（もととおなじ `database_id`）、毎日の cron、ログの設定 |
| `.assetsignore` | 公開しないファイル（`src/`・`test/`・`tools/`・`migrations/`・`docs/`・`*.md`・`package.json`・`wrangler.jsonc` など） |
| `src/worker.js` | ランキングの API（もとの waon-kikiwake とおなじ） |
| `assets/ear-game.js` | チャレンジのきまり・採点・名前のチェック（画面と Worker で共通。もとの `public/js/game.js` とおなじ採点） |
| `migrations/` | D1のテーブル（もととおなじファイル名。もうあててあるので何もおきない） |
| `docs/RANKING-ADMIN.md` | 先生用：名前のけしかた |

## 1. 公開する前に：Cloudflare の画面でたしかめる（1回だけ）

いまは Cloudflare の Git 連携（Workers Builds）で、静的サイトとして公開しています。
`wrangler.jsonc` が入ると、その設定で Worker ＋静的ファイルとして公開されます。

1. https://dash.cloudflare.com/ → **Workers & Pages** → **piano-chord-apps** をひらく。
   - Worker の名前が `piano-chord-apps` であることをたしかめる（`wrangler.jsonc` の `name` とおなじでないとビルドがしっぱいします）。
2. **Settings → Build**（ビルドの設定）で：
   - **Git repository**：g960059/piano-chord-apps、**Production branch**：`main`
   - **Build command**：`npm run check`（`<head>` や `sw.js` の書きわすれ・テストのしっぱいがあれば公開しない）
   - **Deploy command**：`npx wrangler deploy`
   - **Root directory**：`/`（からっぽ）
   - **Non-production branch deploy command**（ブランチのプレビュー）をつかうときは `npx wrangler versions upload`。
     プレビューは `wrangler.jsonc` の `"previews": {}` の設定でうごき、D1にはつながりません。
     プレビューのチャレンジは「オフライン」（ランキングなし）であそべて、ほんとうのランキングにはのりません。
     プレビューでもランキングをためしたいときは、べつの D1をつくって `previews.d1_databases` に書きます（本番の D1は書かない）。
   - Node.js のバージョン：テストは Node.js 22.13いじょうがひつよう（`node:sqlite` をつかう）。
     ふつうはもう22いじょうです。ちがうときはビルドの環境変数で `NODE_VERSION` を `22`（または `24`）にします。
3. **Settings → Variables and Secrets** で **Add** → 種類 **Secret**、名前 `ADMIN_KEY`、値は24文字いじょうのランダムな文字
   （ターミナルなら `openssl rand -hex 24` でつくれます）。
   - もとの waon-kikiwake のキーはべつの Worker のものなので、ここであらためて入れます（おなじ値でもかまいません）。
   - キーはパスワード管理アプリにしまい、リポジトリ・チャットには書かないでください。ない・短いときは先生用 API は404になります（ランキングはうごきます）。
   - ターミナルで入れるときは：`npx wrangler login` のあと、このリポジトリで `npx wrangler secret put ADMIN_KEY`。
4. D1は何もしなくてよい：`wrangler.jsonc` の `d1_databases` が `waon-ranking`（`database_id: 43b354cf-87c0-411f-b2f0-5fd06a1efdec`）を
   そのままつなぎます。デプロイのあと **Workers & Pages → piano-chord-apps → Bindings** に `DB → waon-ranking` が出ていれば OK。
   （テーブルはもうあります。もしなかったら `npx wrangler d1 migrations apply DB --remote`。）

## 2. 公開（main にマージ・push）

ブランチを `main` にマージして push すると、Workers Builds が `npm run check` → `npx wrangler deploy` をうごかします。
ビルドのログに `env.DB (waon-ranking)` と `env.ASSETS` が出ればつながりは OK です。
`src/` や `README.md` などが公開されていないことは、ログではわかりません（`Ignoring asset:` の行は `WRANGLER_LOG=debug` のときだけ出ます）。
つぎの3. の `curl` で `/src/worker.js` と `/README.md` が404になることでたしかめてください。

## 3. 公開のあとにたしかめる

```sh
SITE=https://piano-chord-apps.g960059.workers.dev
curl -s "$SITE/api/ranking?period=all" | head -c 400; echo     # いままでのランキング（JSON）が出る
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/src/worker.js"   # 404（公開していない）
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/README.md"       # 404
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$SITE/ear.html"   # 30x → /ear（いままでとおなじ）
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/"                # 200
```

スマホで `https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge` をひらいて、
🚩 スタート → 「📴 いまはランキングにのせられないよ（オフライン）」が **出ない** こと、
おわってなまえをえらんで 📮 → 「📊 ランキングにのったよ！」と順位が出ることをたしかめます。
📊 ランキングにいままでの人がならんでいれば、データベースがつながっています。

## 4. あとで：和音ききわけ（waon-kikiwake）をこちらへ転送する（こちらの公開がうまくいってから）

waon-kikiwake のリポジトリで、ページをぜんぶ `https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge` へ転送します。
（この作業はまだしていません。手順だけです。）

いちばんかんたんな方法：waon-kikiwake の `src/worker.js` を小さな転送用の Worker にかえる

```js
const TO = 'https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge';
// 前に入れたアプリ（PWA）のサービスワーカーをけすための小さな sw.js。
// sw.js を転送（301）にすると、ブラウザは新しい sw.js をうけとらないので、古いアプリがずっとのこってしまう。
const KILL_SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  self.registration.unregister()
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then((cs) => Promise.all(cs.map((c) => c.navigate(${JSON.stringify(TO)}).catch(() => {}))))
));`;
export default {
  fetch(req) {
    if (new URL(req.url).pathname === '/sw.js') {
      return new Response(KILL_SW, { headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      } });
    }
    return Response.redirect(TO, 301);
  },
};
```

- `/sw.js` だけは転送しないで、「じぶんをけして新しいサイトへうつる」小さなサービスワーカーをかえします。
  前に waon-kikiwake をホーム画面に入れた人も、つぎにネットにつながったとき古いアプリがきえて、新しいページにうつります。
- それいがいのページはぜんぶ301で転送します。

あわせて waon-kikiwake の `wrangler.jsonc` からつぎをけします：

- `assets`（のこすと静的ファイルがさきに出てしまう。のこすなら `"run_worker_first": true`）
- `d1_databases`（もうランキングを書かない。データベースは piano-chord-apps がつかいつづけるので **D1そのものはけさない**）
- `triggers.crons`（そうじは piano-chord-apps の cron がする。両方うごいてもこわれはしません）

そのあと waon-kikiwake で `npx wrangler deploy`。
waon-kikiwake のサービスワーカーは「ネットがさき」なので、ネットにつながれば転送され、上の `sw.js` で古いサービスワーカーもきえます。
（`public/_redirects` で `/* https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge 301` と書く方法もありますが、
Worker（`main`）がある設定では Worker のほうがかくじつです。また `_redirects` では `/sw.js` まで転送されて古いサービスワーカーがのこるので、上の Worker をおすすめします。）

## 5. いままであそんでいた人はどうなる？

- **ランキングのきろくはのこります。** おなじデータベースなので、「ぜんぶ」のランキングにいままでの名前と点数がそのまま出ます。
  「今週」も、今週 waon-kikiwake でのせた分は出ます。
- **新しいサイトでは新しい端末ID になります。** 端末ID（ランダムな番号）はブラウザのそのサイトの中（localStorage）にあるので、
  サイトのアドレスがかわると引きつげません。新しいサイトでのせると、べつの人としてもう1行ふえます
  （いままでの行は「ぜんぶ」にのこり、「今週」は週がかわるときえます）。
- 名前・じぶんのきろく（📒）も引きつげません。新しいサイトでニックネームをえらびなおしてください。
- いまの端末をかえるときは、⚙️ → 💾 の「きろくをファイルに書きだす」で端末ID（`ear-player`）もいっしょに引きつげます。
- 先生が「もうのせない」にした端末ID は新しい ID にはつきません。もしまたこまった名前が出たら `docs/RANKING-ADMIN.md` の手順で。

## 6. こまったとき

- ビルドで `npm run check` がしっぱい：ローカルで `npm run build:meta` をして push しなおす（`<head>` や `sw.js` の書きわすれ）。
- 画面でいつも「オフライン」になる：`/api/ranking` が404なら `wrangler.jsonc` がつかわれていない（Deploy command をたしかめる）。
  500なら D1の binding（`DB`）をたしかめる。
- 先生用 API が404：`ADMIN_KEY` がないか24文字より短い。
- もとにもどしたい：ひとつ前のコミットにもどして push します。ランキングがないときも、チャレンジは「オフライン」と出してあそべます。
