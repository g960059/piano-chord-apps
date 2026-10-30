# ピアノ和音アプリ

ピアノを習う人（小学生から高校生まで）向けに、和音を「見て・聴いて・さわって」おぼえる小さな Web アプリ集です。
スマホで使いやすいように、ひとつひとつのアプリをタブなしの1画面にしています。入口は `index.html`（ホーム）です。

## ホーム

- はじめての人には「はじめての 和音」カード（→ `chord-build.html`）だけを大きく出します。
- 2回目からは いちばん上の 1まいに「つづき」（さいごに 練習した クイズ・れんしゅう・耳。とちゅうの「きょうの 5もん」や さいごの 調も）と「🔁 にがてを 3もん」（まちがいの多い 調を 3つまで。おすと その クイズを `?key=<調>&n=3` で ひらく）を まとめます。
- 「いつでも」：伴奏づけ・和音の 聴きわけ・和音いちらん表（どの 単元と いっしょでも つかう ので、コースには ならべません）。
- コース：番号つきの 単元 ①〜⑤（「いつでも」の アプリを のぞく）。ひらくのは「つぎ」の 単元だけで、ひらく／とじるは おぼえます。中の アプリは 種類の ラベル（しくみ・クイズ・れんしゅう）と、ひらいた ✓・クイズは「できた 調 x／24」。

## アプリ（ホームに ならぶ じゅん）

目次は `assets/core.js` の `PA.UNITS`（単元）・`PA.APPS`（アプリ）・`PA.APP_TYPES`（種類と色）に 1か所だけ 書いています。
アプリを ふやすときは ここに 足すと、ホーム・「‹ もどる」・「ためしてみる」の リンクに 出ます。

| 単元 | アプリ | 種類 | ファイル |
|---|---|---|---|
| 🎹 はじめの 和音（Ⅰ・Ⅳ・Ⅴ・Ⅴ7） | 和音のしくみ | しくみ | `chord-build.html` |
| | 和音クイズ | クイズ | `chord-quiz.html` |
| | カデンツ | れんしゅう | `cadence.html` |
| | 和音いちらん表 | いちらん | `chord-table.html` |
| 🎼 曲に つけてみる | 伴奏づけ | れんしゅう | `accompaniment.html` |
| 🧩 和音を もっと 知る | 7つの 和音 | しくみ | `diatonic.html` |
| | 和音の かたち（ドミソ・ミソド・ソドミ） | しくみ | `inversion.html` |
| | 音の へだたり | しくみ | `interval.html` |
| 🌙 短調と 臨時記号 | なぜ 7ばんめを 上げるの？ | しくみ | `minor-why.html` |
| | 調号と 臨時記号 | しくみ | `minor-signature.html` |
| | Ⅴの家族（Ⅴ・Ⅴ7・Ⅴ9・減七） | しくみ | `minor-family.html` |
| | 短調クイズ | クイズ | `minor-quiz.html` |
| 🏁 おわりかた | おわりかた（完全・不完全・半・変格・偽・フリギア終止） | しくみ | `ending.html` |
| | おわりかたクイズ（聴いて／見て 当てる・4レベル） | クイズ | `ending-quiz.html` |
| 🌈 変化和音 | Ⅱ7と ドッペルドミナント | しくみ | `doppel.html` |
| | 副属和音 | しくみ | `secondary.html` |
| | 増六の和音（イタリア・フランス・ドイツの6） | しくみ | `aug6.html` |
| | ナポリの六 | しくみ | `neapolitan.html` |
| | 準固有和音（借用和音） | しくみ | `borrowed.html` |
| | 減七と 半減七 | しくみ | `dim-halfdim.html` |
| | 異名同音の 読みかえ | しくみ | `enharmonic.html` |
| | 変化和音クイズ | クイズ | `chroma-quiz.html` |
| 👂 耳を きたえる | 和音の 聴きわけ（10種類・8レベル・🏆 チャレンジと 📊 ランキング） | 耳 | `ear.html` |

## 🏆 ランキング（和音の 聴きわけ）

もとは べつの アプリ「和音ききわけ」（[g960059/waon-kikiwake](https://github.com/g960059/waon-kikiwake)）でした。いまは `ear.html` の 中に あります。
データベース（Cloudflare D1 の `waon-ranking`）も 採点の きまりも おなじ なので、いままでの ランキングが そのまま つづきます。

- `ear.html` の いちばん上で 📝 れんしゅう・🏆 チャレンジ・📊 ランキング を えらびます（`?mode=challenge` で チャレンジから）。
- 🏆 チャレンジ：ライフ 3つ。5もん つづけて 正解で つぎの レベル、まちがえると ライフが へって 1つ前の レベルへ。ライフ 0 で おわり。
  レベル5からは もういちど きける 回数が きまって います（れんしゅうは いつでも なんどでも）。
- おわったら なまえ（自動の ニックネームから えらぶ か、じぶんで 1〜12文字）を えらんで ランキングに のせます。
  「本名は 入れないでね」と 出し、よくない ことば・URL・電話番号・なりすまし（先生・公式 など）は 画面と サーバーの 両方で はじきます。
- 📊 ランキング：「今週」（日本時間の 月曜 0時から）と「ぜんぶ」。上位 50人と じぶんの 順位。1人（端末）1行、じぶんの いちばん いい きろく。
- 順位：とどいた レベル（マスター＝レベル8 クリアが いちばん 上）→ 正解数 → 先に きろく した 人。

しくみ：

1. 🚩 スタートで `POST /api/run` → サーバーが `{ runId, seed }` を かえす。
2. 問題の しゅるいの 順番は `seed` から きまる（`assets/ear-game.js` の `mulberry32(seed)`）。根音・転回形・高さは べつの 乱数（`seed ^ 0x9e3779b9`）で、
   音の つくりかたは れんしゅうと おなじ（`ear.html` の `makeQOf`）。
3. おわったら `POST /api/score` に `{ runId, playerId, name, answers, elapsedMs }`（答えの 列）を おくる。
   サーバーは おなじ `assets/ear-game.js` で 採点しなおして 登録する（画面で 点数を かえても かわらない）。1回の チャレンジは 1回だけ・2時間まで。
4. `GET /api/ranking?period=week|all&player=<端末ID>` で ランキング。
5. サーバーに つながらない とき（ネットが ない・`file://` で ひらいた・`python3 -m http.server` など API の ない サーバー）は、
   「📴 いまは ランキングに のせられないよ（オフライン）」と 出して、ランキングなしで あそべます（じぶんの きろくには のこる）。

サーバーに 保存するのは **ニックネーム・スコア（レベル・正解数・問題数・時刻）・端末の ランダムな ID・IP の ハッシュ**（回数制限用。日ごとに かわる 塩つき。IP そのものは 保存しない）だけです。
端末の 中（`PA.store`）には `ear-player`（端末の ランダムな ID）・`ear-name`（さいごの ニックネーム）・`ear-best`（じぶんの チャレンジの きろく）・
`ear`（れんしゅうの せってい と とちゅうの チャレンジ）が あります。

先生用（名前を けす・もう のせない）：[docs/RANKING-ADMIN.md](docs/RANKING-ADMIN.md)。うつしかえの 手順：[docs/MIGRATION-RANKING.md](docs/MIGRATION-RANKING.md)。

| ファイル | 中身 |
|---|---|
| `assets/ear-game.js` | チャレンジの きまり（レベル・ライフ・乱数・採点）・名前の チェック・ニックネーム・週。画面（ふつうの script → `window.EarGame`）と Worker（`import` → `globalThis.EarGame`）で 共通 |
| `src/worker.js` | Cloudflare Worker：`/api/*`（ランキングの API・先生用 API・毎日の そうじ）。ほかは 静的ファイル |
| `migrations/` | D1 の テーブル（`runs`・`scores`・`salts`・`ip_players`・`blocked_players`・`admin_fail`） |
| `wrangler.jsonc` | Worker の 設定（静的ファイル＝リポジトリの いちばん上、D1 `DB` → `waon-ranking`、cron） |
| `.assetsignore` | 公開しない ファイル（`src/`・`test/`・`tools/`・`migrations/`・`docs/`・`*.md`・設定） |
| `test/ear-game.test.mjs`・`test/worker.test.mjs` | きまりと API の テスト（D1 は `node:sqlite` で まねる。wrangler は いらない） |

## 先生用：リンクの パラメータ

リンクには サーバーは つかいません（サーバーを つかうのは 🏆 ランキング だけ）。先生は ページの「👩‍🏫 この れんしゅうを おくる」ボタン（または 下の 形の アドレス）で 宿題の リンクを おくります。

どの ページも おなじ ことばを つかいます（`PA.PARAM_KEYS`）。

| 名前 | 意味 | 値 |
|---|---|---|
| `key` | 調 | `M0`〜`M12`＝長調、`m0`〜`m12`＝短調（`PA.MAJOR_KEYS`・`PA.MINOR_KEYS` の 番号。例 `M1`＝ト長調、`m0`＝イ短調） |
| `chord` | その ページの 和音 | ページごとの 和音の id（`,` で いくつか ならべられる ページも ある） |
| `mode` | こたえかた | ページごと |
| `level` | レベル | 1から |
| `tier` | むずかしさ（調号の 数） | `easy`（0〜1）・`normal`（2〜3）・`hard`（4〜5）・`all` |
| `n` | れんしゅうの もんだいの 数 | 1〜20（「📝 きょうの 5もん」と おなじ しくみで はじまる） |

- アドレスの 値は 信用しません。ページごとに ゆるされた 値だけ つかい、ほかは すてます（HTML に そのまま 入れることも ありません）。
- リンクの 設定は その回に つかいます（いまの 設定として ほぞんする ページも あります）。
- 例：`chord-quiz.html?key=M1&n=3`（ト長調だけで 3もん）、`chord-quiz.html?tier=easy&chord=V,V7&n=5`（やさしい 調の Ⅴ と Ⅴ7 で 5もん）

ページごとの パラメータ（2026年10月 時点。くわしくは 各ページの さいしょの コメント）：

| ページ | パラメータ |
|---|---|
| `chord-quiz.html` | `key`（その 調だけ）・`chord`（`I`・`IV`・`V`・`V7` を `,` で）・`mode`（`keys`＝けんばんで おさえる／`choice`＝4つから えらぶ）・`tier`・`keyset`（`major`・`minor`・`both`。この ページだけ）・`n` |
| `minor-quiz.html` | `mode`（`chord`＝和音を おさえる／`mark`＝臨時記号を えらぶ）・`chord`（`V`・`V7`・`V9`・`DIM` を `,` で）・`tier`・`key`（短調 `m0`〜`m12`。`mark`（または `chord` が 1つ）の ときは さいしょの 1もんだけ、あとは `tier` の 調。`key` だけで `mode` が ない ときは `chord`）・`n` |
| `chroma-quiz.html` | `mode`（`keys`＝けんばんで おさえる／`ear`＝耳で 聴きわける）・`level`（おさえる 1〜5／耳 1〜3）・`chord`（和音の id を `,` で）・`tier`・`key`・`n`。`mode` が なくて `key`・`n`・`level`・`chord`・`tier` の どれかが あれば `keys`（ほぞんした こたえかたが `ear` でも けんばんに なる） |
| `ending-quiz.html` | `mode`（`ear`＝聴いて／`see`＝がくふを 見て）・`level`（1〜4）・`tier`・`key`・`n` |
| `ear.html` | `mode`（`practice`＝れんしゅう／`challenge`＝🏆 チャレンジ（ランキング））・`level`（1〜8）・`n`。`level`・`n` だけでも れんしゅうに なる。`challenge` の ときは `level`・`n` は つかわない（いつも レベル1から） |
| `accompaniment.html` | `song`（曲の id。例 `mary`）・`key`（長調 `M0`〜`M12` だけ） |
| `chord-build.html` | `key`・`chord`（`I`・`IV`・`V`・`V7`） |
| `chord-table.html` | `key`・`chord`（`I`・`IV`・`V`・`V7`） |
| `borrowed.html` | `key`（長調だけ）・`chord`（`iv`・`bVI`・`ii_dim`・`ii_hdim7`・`V9_b9`・`vii_dim7` の どれか 1つ） |
| `dim-halfdim.html` | `key` |
| `enharmonic.html` | `key`（短調だけ） |

## れんしゅうの 回（n もん）と けっかの カード

- クイズの「📝 きょうの 5もん」ボタン、または `n` つきの リンクで はじまります（`PA.session`）。とちゅうで とじても 12時間 いないなら つづきから。
- おわると けっかの カード：「5もん中 4もん」と ほし、じぶんで できた・ヒントを 見て できた・まちがえた の 数、もういちど 見たい もんだい、
  「👩‍🏫 先生に 見せる」（日づけ・ページ・せってい・けっか）と、おなじ れんしゅうの リンク。生徒は この 画面を 先生に 見せます。
- こたえる 前に「つくりかたを 見る」などを ひらいても ×には なりません（ヒントを 見て できた、と きろく）。

## きろくと ひかえ

- 設定（音名：ドレミ／CDE／ハニホ、基準の音 A4＝440〜443Hz、音の オン・オフ）・クイズの 調の きろく（`keystats-…`）・ひらいた アプリ（`visited`）などは、
  その 端末の ブラウザ（localStorage の `pianoapps.…`）に あります。
- ⚙️ → 💾「きろくを ファイルに 書きだす／ファイルから よみこむ」で ひかえを とれます（機種を かえる とき・ブラウザの データを けす 前に）。

## ホーム画面・オフライン（PWA）

- `manifest.webmanifest` と アイコン（`assets/icons/`・`favicon.svg`）で、スマホの ホーム画面に 追加できます。
- https では `sw.js`（サービスワーカー）を 登録します。ページは ネットが さき（3びょう まって こなければ 保存した ページ）、js・css・画像は 保存した ものを すぐ 出して うらで 新しく します。
  一度 ひらけば ネットが なくても つかえます。
- `sw.js` の `PRECACHE`・`VERSION` と 各ページの `<head>` の 説明・シェア用タグは `npm run build:meta` が 書きます（手で なおさない）。

## しくみ

- ビルド不要の静的サイトです（HTML・CSS・JavaScript だけ）。ファイルをそのまま開いても、静的ホスティングに置いても動きます。
  サーバー（Cloudflare Worker ＋ D1）を つかうのは 🏆 ランキング（`/api/*`）だけ。ない ところでは「オフライン」と 出して ランキングなしで うごきます。
- 共通部分は `assets/core.js`（音楽理論・音の再生・鍵盤と楽譜の描画・設定・目次・リンク・れんしゅうの 回・調の きろく）と `assets/app.css`。
  つかいかたは `assets/core.js` の さいしょの コメント「つかいかた」に まとめています。
- 音は Web Audio で、平均律・ラ（A4）＝440〜443Hz（設定で切りかえ）の正しい高さで鳴らします。表示する 音の 高さ＝鳴る 音の 高さ です。
- iOS Safari 12 でも うごくように、`?.`・`??`・クラスの フィールドは つかいません。

## ローカルで動かす・テスト

```bash
python3 -m http.server 8000      # http://localhost:8000/（ランキングは「オフライン」に なる）
npm run dev                      # wrangler で ランキングも（さいしょに ローカルの D1 を つくる。npx が wrangler を とってくる）
npm test                         # node --test test/*.test.mjs
npm run build:meta               # <head> の タグと sw.js の PRECACHE・VERSION を 書きなおす
npm run check                    # build:meta の 書きわすれ チェック ＋ テスト（CI 用）
```

## 公開先

https://piano-chord-apps.g960059.workers.dev/ （Cloudflare Workers。main に push すると自動で更新されます）

### 公開の しかたが かわる（ランキングを 入れたので）

- いままで：Git 連携で 静的サイト だけ。
- これから：`wrangler.jsonc` の 設定で、**静的ファイル ＋ Worker（`src/worker.js`）＋ D1**。Cloudflare の ビルドは
  Build command `npm run check`、Deploy command `npx wrangler deploy`。ページの 出かたは いままでと おなじ（`/ear.html` → `/ear` など）。
- 公開するのは リポジトリの いちばん上の ページ・`assets/`・`sw.js` など。`src/`・`test/`・`tools/`・`docs/`・`*.md`・設定は `.assetsignore` で 公開しない。
  ファイルを ふやした ときは、公開して よいか `.assetsignore` を 見なおす。
- 先生用キー `ADMIN_KEY` は Cloudflare の Secret（リポジトリには 書かない）。
- はじめての ときの 手順（Cloudflare の 画面で たしかめる こと・ADMIN_KEY・D1・和音ききわけからの 転送）は [docs/MIGRATION-RANKING.md](docs/MIGRATION-RANKING.md)。

Cloudflare の ビルドの 設定で、公開の 前に `npm run check` を うごかしてください（`<head>` や `sw.js` の 書きわすれ・テストの 失敗が あれば 公開されません）。
ページを ふやした・かえた ときは、push の 前に `npm run build:meta` を わすれずに。
テストは Node.js 22.13 いじょう（ランキングの テストが `node:sqlite` を つかう）。
