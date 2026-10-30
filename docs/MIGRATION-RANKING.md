# ランキングを「和音の 聴きわけ」に うつす 手順（和音ききわけ → ピアノ和音アプリ）

べつの アプリだった「和音ききわけ」（g960059/waon-kikiwake、https://waon-kikiwake.g960059.workers.dev/ ）の ランキングを、
このリポジトリの `ear.html`（和音の 聴きわけ）の 🏆 チャレンジに まとめました。
データベース（Cloudflare D1 の `waon-ranking`）は おなじ ものを つかうので、**いままでの ランキングは そのまま のこります**。

このリポジトリで かわった こと：

| ファイル | 中身 |
|---|---|
| `wrangler.jsonc` | Worker の 設定。名前 `piano-chord-apps`、`main: src/worker.js`、静的ファイルは リポジトリの いちばん上（`assets.directory: "."`）、`/api/*` だけ Worker、D1 `DB` → `waon-ranking`（もとと おなじ `database_id`）、毎日の cron、ログの 設定 |
| `.assetsignore` | 公開しない ファイル（`src/`・`test/`・`tools/`・`migrations/`・`docs/`・`*.md`・`package.json`・`wrangler.jsonc` など） |
| `src/worker.js` | ランキングの API（もとの waon-kikiwake と おなじ） |
| `assets/ear-game.js` | チャレンジの きまり・採点・名前の チェック（画面と Worker で 共通。もとの `public/js/game.js` と おなじ 採点） |
| `migrations/` | D1 の テーブル（もとと おなじ ファイル名。もう あててある ので 何も おきない） |
| `docs/RANKING-ADMIN.md` | 先生用：名前の けしかた |

## 1. 公開する 前に：Cloudflare の 画面で たしかめる（1回だけ）

いまは Cloudflare の Git 連携（Workers Builds）で、静的サイトとして 公開して います。
`wrangler.jsonc` が 入ると、その 設定で Worker ＋ 静的ファイル として 公開されます。

1. https://dash.cloudflare.com/ → **Workers & Pages** → **piano-chord-apps** を ひらく。
   - Worker の 名前が `piano-chord-apps` で ある ことを たしかめる（`wrangler.jsonc` の `name` と おなじで ないと ビルドが しっぱい します）。
2. **Settings → Build**（ビルドの 設定）で：
   - **Git repository**：g960059/piano-chord-apps、**Production branch**：`main`
   - **Build command**：`npm run check`（`<head>` や `sw.js` の 書きわすれ・テストの しっぱいが あれば 公開しない）
   - **Deploy command**：`npx wrangler deploy`
   - **Root directory**：`/`（からっぽ）
   - **Non-production branch deploy command**（ブランチの プレビュー）を つかう ときは `npx wrangler versions upload`。
     ⚠️ プレビューも おなじ D1（ほんとうの ランキング）に つながります。プレビューで チャレンジを 送ると ランキングに のります。
     気に なる ときは「Builds for non-production branches」を オフに してください。
   - Node.js の バージョン：テストは Node.js 22.13 いじょうが ひつよう（`node:sqlite` を つかう）。
     ふつうは もう 22 いじょう です。ちがう ときは ビルドの 環境変数で `NODE_VERSION` を `22`（または `24`）に します。
3. **Settings → Variables and Secrets** で **Add** → 種類 **Secret**、名前 `ADMIN_KEY`、値は 24文字 いじょうの ランダムな 文字
   （ターミナルなら `openssl rand -hex 24` で つくれます）。
   - もとの waon-kikiwake の キーは べつの Worker の もの なので、ここで あらためて 入れます（おなじ 値でも かまいません）。
   - キーは パスワード管理アプリに しまい、リポジトリ・チャットには 書かないで ください。ない・短い ときは 先生用 API は 404 に なります（ランキングは うごきます）。
   - ターミナルで 入れる ときは：`npx wrangler login` の あと、このリポジトリで `npx wrangler secret put ADMIN_KEY`。
4. D1 は 何も しなくて よい：`wrangler.jsonc` の `d1_databases` が `waon-ranking`（`database_id: 43b354cf-87c0-411f-b2f0-5fd06a1efdec`）を
   そのまま つなぎます。デプロイの あと **Workers & Pages → piano-chord-apps → Bindings** に `DB → waon-ranking` が 出ていれば OK。
   （テーブルは もう あります。もし なかったら `npx wrangler d1 migrations apply DB --remote`。）

## 2. 公開（main に マージ・push）

ブランチを `main` に マージして push すると、Workers Builds が `npm run check` → `npx wrangler deploy` を うごかします。
ビルドの ログに `env.DB (waon-ranking)` と `env.ASSETS` が 出れば つながりは OK です。
`src/` や `README.md` などが 公開されて いないことは、ログでは わかりません（`Ignoring asset:` の 行は `WRANGLER_LOG=debug` の ときだけ 出ます）。
つぎの 3. の `curl` で `/src/worker.js` と `/README.md` が 404 に なることで たしかめて ください。

## 3. 公開の あとに たしかめる

```sh
SITE=https://piano-chord-apps.g960059.workers.dev
curl -s "$SITE/api/ranking?period=all" | head -c 400; echo     # いままでの ランキング（JSON）が 出る
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/src/worker.js"   # 404（公開して いない）
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/README.md"       # 404
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$SITE/ear.html"   # 30x → /ear（いままでと おなじ）
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/"                # 200
```

スマホで `https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge` を ひらいて、
🚩 スタート → 「📴 いまは ランキングに のせられないよ（オフライン）」が **出ない** こと、
おわって なまえを えらんで 📮 → 「📊 ランキングに のったよ！」と 順位が 出る ことを たしかめます。
📊 ランキング に いままでの 人が ならんで いれば、データベースが つながって います。

## 4. あとで：和音ききわけ（waon-kikiwake）を こちらへ 転送する（こちらの 公開が うまく いってから）

waon-kikiwake の リポジトリで、ページを ぜんぶ `https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge` へ 転送します。
（この 作業は まだ して いません。手順だけ です。）

いちばん かんたんな 方法：waon-kikiwake の `src/worker.js` を 小さな 転送用の Worker に かえる

```js
const TO = 'https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge';
// 前に 入れた アプリ（PWA）の サービスワーカーを けすための 小さな sw.js。
// sw.js を 転送（301）に すると、ブラウザは 新しい sw.js を うけとらないので、古い アプリが ずっと のこって しまう。
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

- `/sw.js` だけは 転送しないで、「じぶんを けして 新しい サイトへ うつる」 小さな サービスワーカーを かえします。
  前に waon-kikiwake を ホーム画面に 入れた 人も、つぎに ネットに つながった とき 古い アプリが きえて、新しい ページに うつります。
- それ いがいの ページは ぜんぶ 301 で 転送します。

あわせて waon-kikiwake の `wrangler.jsonc` から つぎを けします：

- `assets`（のこすと 静的ファイルが さきに 出て しまう。のこす なら `"run_worker_first": true`）
- `d1_databases`（もう ランキングを 書かない。データベースは piano-chord-apps が つかいつづける ので **D1 そのものは けさない**）
- `triggers.crons`（そうじは piano-chord-apps の cron が する。両方 うごいても こわれは しません）

そのあと waon-kikiwake で `npx wrangler deploy`。
waon-kikiwake の サービスワーカーは「ネットが さき」なので、ネットに つながれば 転送され、上の `sw.js` で 古い サービスワーカーも きえます。
（`public/_redirects` で `/* https://piano-chord-apps.g960059.workers.dev/ear.html?mode=challenge 301` と 書く 方法も ありますが、
Worker（`main`）が ある 設定では Worker の ほうが かくじつ です。また `_redirects` では `/sw.js` まで 転送されて 古い サービスワーカーが のこるので、上の Worker を おすすめ します。）

## 5. いままで あそんでいた 人は どう なる？

- **ランキングの きろくは のこります。** おなじ データベースなので、「ぜんぶ」の ランキングに いままでの 名前と 点数が そのまま 出ます。
  「今週」も、今週 waon-kikiwake で のせた 分は 出ます。
- **新しい サイトでは 新しい 端末ID に なります。** 端末ID（ランダムな 番号）は ブラウザの その サイトの 中（localStorage）に あるので、
  サイトの アドレスが かわると 引きつげません。新しい サイトで のせると、べつの 人として もう 1行 ふえます
  （いままでの 行は 「ぜんぶ」に のこり、「今週」は 週が かわると きえます）。
- 名前・じぶんの きろく（📒）も 引きつげません。新しい サイトで ニックネームを えらびなおして ください。
- いまの 端末を かえる ときは、⚙️ → 💾 の「きろくを ファイルに 書きだす」で 端末ID（`ear-player`）も いっしょに 引きつげます。
- 先生が「もう のせない」に した 端末ID は 新しい ID には つきません。もし また こまった 名前が 出たら `docs/RANKING-ADMIN.md` の 手順で。

## 6. こまった とき

- ビルドで `npm run check` が しっぱい：ローカルで `npm run build:meta` を して push しなおす（`<head>` や `sw.js` の 書きわすれ）。
- 画面で いつも「オフライン」に なる：`/api/ranking` が 404 なら `wrangler.jsonc` が つかわれて いない（Deploy command を たしかめる）。
  500 なら D1 の binding（`DB`）を たしかめる。
- 先生用 API が 404：`ADMIN_KEY` が ない か 24文字 より 短い。
- もとに もどしたい：ひとつ 前の コミットに もどして push します。ランキングが ない ときも、チャレンジは「オフライン」と 出して あそべます。
