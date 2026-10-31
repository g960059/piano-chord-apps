# ピアノ和音アプリ

ピアノを習う人（小学生から高校生まで）向けに、和音を「見て・聴いて・さわって」おぼえる小さな Web アプリ集です。
スマホで使いやすいように、ひとつひとつのアプリをタブなしの1画面にしています。入口は `index.html`（ホーム）です。

## ホーム

「ぼうけんの地図」（先生にえらんでもらった B すごろく案）です。上から次のじゅんにならべます。

- はじめての人には「長調の4つの和音から始めよう」カード（→ `chord-build.html`）。2回目からは「つづきから」（さいごにひらいたページ。とちゅうの「きょうの5もん」やさいごの調も）と、すすめを1つ（しくみのページならその練習クイズ、ちがえば「🔁 にがてを3もん」＝そのクイズを `?key=<調>&n=3` で）。
- **耳のひろば**（`kind:'daily'`）：夜空のきらきらのカード。「きょうの5もん」（`ear.html?n=5`）・和音の聴きわけ・ならびの聴きわけ・チャレンジ（`ear.html?mode=challenge`。ウェブだけ「ランキングにものせられるよ」）と、じぶんのきろく（チャレンジでクリアしたレベル・正解の数・ならびのれんぞく正解のさいこう）。
- **ぼうけんの地図**（`kind:'basic'`＝①〜⑥の島）：島の中に課題（`tasks` の `href`・名前。和音クイズは①が長調・②が短調）。🐸＝いまやっている島（さいごにやったページの島。もうクリアなら、そのつぎのまだクリアしていない島）。島のひらく／とじるは `home-units` におぼえます。
  - ★：見た。★★：そこで問題をやった（クイズはその課題の調で1もんでも。しくみなどのページは練習クイズで。伴奏づけは曲に和音をつけた）。★★★：クイズで、その調の半分いじょうが「できた」。練習の問題がないページは ★ まで。島のクリア＝どの課題も ★★（★ までのページは ★）。
- **レベルアップしたい人へ**（`kind:'extra'`）：もう1つの地図。しずかな色で、はじめはとじています（さいごにやったページがここにあればひらく）。
- 使いかたのメモ（設定・ホーム画面・きろくのひかえ・サポート・プライバシー）。iOS アプリではホーム画面とランキングのことばを出しません。

## アプリ（学ぶ地図のじゅん）

目次は `assets/core.js` の `PA.UNITS`（単元＝地図の島）・`PA.APPS`（アプリ）・`PA.APP_TYPES`（種類と色）に1か所だけ書いています。
アプリをふやすときはここに足すと、ホーム・「‹ もどる」・「ためしてみる」のリンクに出ます。
ならびは先生の考える地図（[docs/TEACHER-FEEDBACK.md](docs/TEACHER-FEEDBACK.md)・[docs/IMPROVEMENT-PLAN.md](docs/IMPROVEMENT-PLAN.md)）のとおりです。

- 単元の `kind`：`basic`＝基本の地図（①〜⑥）、`daily`＝毎日たのしむところ（耳のひろば）、`extra`＝レベルアップしたい人へ。
- 単元の `tasks`＝島の中の課題（`{app, href, title}`）。おなじアプリを、べつの設定でいくつかの島に出せます（和音クイズは①で `?keyset=major`、②で `?keyset=minor`）。
  `PA.APPS` の `unit` は、そのアプリがさいしょに出てくる島（アプリ1つに1つ）。

| 島 | アプリ | 種類 | ファイル |
|---|---|---|---|
| 🎹 ① 長調のⅠ・Ⅳ・Ⅴ・Ⅴ7 | 和音のしくみ | しくみ | `chord-build.html` |
| | 和音クイズ（長調） | クイズ | `chord-quiz.html?keyset=major` |
| | カデンツ | れんしゅう | `cadence.html` |
| | 和音いちらん表 | いちらん | `chord-table.html` |
| 🌙 ② 短調のⅠ・Ⅳ・Ⅴ・Ⅴ7 | なぜ7ばんめを上げるの？ | しくみ | `minor-why.html` |
| | 調号と臨時記号 | しくみ | `minor-signature.html` |
| | 和音クイズ（短調） | クイズ | `chord-quiz.html?keyset=minor` |
| 🏠 ③ 短調のⅤ9と減七 | Ⅴの家族（Ⅴ・Ⅴ7・Ⅴ9・減七） | しくみ | `minor-family.html` |
| | Ⅴ9の根音省略（根音と省略の意味から。短調では減七、長調ではならない。まえの「減七と半減七」） | しくみ | `dim-halfdim.html` |
| | 短調クイズ | クイズ | `minor-quiz.html` |
| 🧩 ④ 和音をもっと知ろう | 7つの和音 | しくみ | `diatonic.html` |
| | 和音のかたち（ドミソ・ミソド・ソドミ） | しくみ | `inversion.html` |
| | 音のへだたり | しくみ | `interval.html` |
| 🏁 ⑤ おわりかた | おわりかた（完全・不完全・半・変格・偽・フリギア終止） | しくみ | `ending.html` |
| | おわりかたクイズ（聴いて／見て当てる・4レベル） | クイズ | `ending-quiz.html` |
| 🎼 ⑥ 曲につけてみよう | 伴奏づけ | れんしゅう | `accompaniment.html` |
| 👂 耳のひろば（毎日） | 和音の聴きわけ（10種類・8レベル・🏆 チャレンジと 📊 ランキング） | 耳 | `ear.html` |
| | ならびの聴きわけ（Ⅰ→Ⅳ→Ⅴ7→Ⅰ などのならびの「？」を当てる・いちばん下と上の音・5ステップ） | 耳 | `progression.html` |
| 🌈 レベルアップしたい人へ | Ⅱ7とドッペルドミナント | しくみ | `doppel.html` |
| | 副属和音 | しくみ | `secondary.html` |
| | 準固有和音（借用和音） | しくみ | `borrowed.html` |
| | ナポリの六 | しくみ | `neapolitan.html` |
| | 増六の和音（イタリア・フランス・ドイツの6） | しくみ | `aug6.html` |
| | 異名同音の読みかえ（いちばん最後） | しくみ | `enharmonic.html` |
| | 変化和音クイズ（上とおなじじゅんのステップ1〜6） | クイズ | `chroma-quiz.html` |

「半減七」ということばは、どのページの画面にも出しません（先生の意見。長調のⅤ9から根音をはぶいた形は「長調の形（減七にならない）」とよびます。`test/lesson-map.test.mjs`）。

## 🏆 ランキング（和音の聴きわけ）

もとはべつのアプリ「和音ききわけ」（[g960059/waon-kikiwake](https://github.com/g960059/waon-kikiwake)）でした。いまは `ear.html` の中にあります。
データベース（Cloudflare D1の `waon-ranking`）も採点のきまりもおなじなので、いままでのランキングがそのままつづきます。

- `ear.html` のいちばん上で 📝 れんしゅう・🏆 チャレンジ・📊 ランキングをえらびます（`?mode=challenge` でチャレンジから）。
- 🏆 チャレンジ：ライフ3つ。5もんつづけて正解でつぎのレベル、まちがえるとライフがへって1つ前のレベルへ。ライフ0でおわり。
  レベル5からはもういちどきける回数がきまっています（れんしゅうはいつでもなんどでも）。
- おわったらなまえ（自動のニックネームからえらぶか、じぶんで1〜12文字）をえらんでランキングにのせます。
  「本名は入れないでね」と出し、よくないことば・URL・電話番号・なりすまし（先生・公式など）は画面とサーバーの両方ではじきます。
- 📊 ランキング：「今週」（日本時間の月曜0時から）と「ぜんぶ」。上位50人とじぶんの順位。1人（端末）1行、じぶんのいちばんいいきろく。
- 順位：とどいたレベル（マスター＝レベル8クリアがいちばん上）→ 正解数 → 先にきろくした人。

しくみ：

1. 🚩 スタートで `POST /api/run` → サーバーが `{ runId, seed }` をかえす。
2. 問題のしゅるいの順番は `seed` からきまる（`assets/ear-game.js` の `mulberry32(seed)`）。根音・転回形・高さはべつの乱数（`seed ^ 0x9e3779b9`）で、
   音のつくりかたはれんしゅうとおなじ（`ear.html` の `makeQOf`）。
3. おわったら `POST /api/score` に `{ runId, playerId, name, answers, elapsedMs }`（答えの列）をおくる。
   サーバーはおなじ `assets/ear-game.js` で採点しなおして登録する（画面で点数をかえてもかわらない）。1回のチャレンジは1回だけ・2時間まで。
4. `GET /api/ranking?period=week|all&player=<端末ID>` でランキング。
5. サーバーにつながらないとき（ネットがない・`file://` でひらいた・`python3 -m http.server` など API のないサーバー）は、
   「📴 いまはランキングにのせられないよ（オフライン）」と出して、ランキングなしであそべます（じぶんのきろくにはのこる）。

サーバーに保存するのは **ニックネーム・スコア（レベル・正解数・問題数・時刻）・端末のランダムな ID・IP のハッシュ**（回数制限用。日ごとにかわる塩つき。IP そのものは保存しない）だけです。
端末の中（`PA.store`）には `ear-player`（端末のランダムな ID）・`ear-name`（さいごのニックネーム）・`ear-best`（じぶんのチャレンジのきろく）・
`ear`（れんしゅうのせっていととちゅうのチャレンジ）があります。

先生用（名前をけす・もうのせない）：[docs/RANKING-ADMIN.md](docs/RANKING-ADMIN.md)。うつしかえの手順：[docs/MIGRATION-RANKING.md](docs/MIGRATION-RANKING.md)。

| ファイル | 中身 |
|---|---|
| `assets/ear-game.js` | チャレンジのきまり（レベル・ライフ・乱数・採点）・名前のチェック・ニックネーム・週。画面（ふつうの script → `window.EarGame`）と Worker（`import` → `globalThis.EarGame`）で共通 |
| `src/worker.js` | Cloudflare Worker：`/api/*`（ランキングの API・先生用 API・毎日のそうじ）。ほかは静的ファイル |
| `migrations/` | D1のテーブル（`runs`・`scores`・`salts`・`ip_players`・`blocked_players`・`admin_fail`） |
| `wrangler.jsonc` | Worker の設定（静的ファイル＝リポジトリのいちばん上、D1 `DB` → `waon-ranking`、cron） |
| `.assetsignore` | 公開しないファイル（`src/`・`test/`・`tools/`・`migrations/`・`docs/`・`*.md`・設定） |
| `test/ear-game.test.mjs`・`test/worker.test.mjs` | きまりと API のテスト（D1は `node:sqlite` でまねる。wrangler はいらない） |

## 先生用：リンクのパラメータ

リンクにはサーバーはつかいません（サーバーをつかうのは 🏆 ランキングだけ）。先生はページの「👩‍🏫 このれんしゅうをおくる」ボタン（または下の形のアドレス）で宿題のリンクをおくります。

どのページもおなじことばをつかいます（`PA.PARAM_KEYS`）。

| 名前 | 意味 | 値 |
|---|---|---|
| `key` | 調 | `M0`〜`M12`＝長調、`m0`〜`m12`＝短調（`PA.MAJOR_KEYS`・`PA.MINOR_KEYS` の番号。例 `M1`＝ト長調、`m0`＝イ短調） |
| `chord` | そのページの和音 | ページごとの和音の id（`,` でいくつかならべられるページもある） |
| `mode` | こたえかた | ページごと |
| `level` | レベル | 1から |
| `step` | ステップ（学ぶじゅんの段階） | 1から（和音クイズ・変化和音クイズ・ならびの聴きわけ） |
| `tier` | むずかしさ（調号の数） | `easy`（0〜1）・`normal`（2〜3）・`hard`（4〜5）・`all` |
| `n` | れんしゅうのもんだいの数 | 1〜20（「📝 きょうの5もん」とおなじしくみではじまる） |

- アドレスの値は信用しません。ページごとにゆるされた値だけつかい、ほかはすてます（HTML にそのまま入れることもありません）。
- リンクの設定はその回につかいます（いまの設定としてほぞんするページもあります）。
- 例：`chord-quiz.html?key=M1&n=3`（ト長調だけで3もん）、`chord-quiz.html?tier=easy&chord=V,V7&n=5`（やさしい調のⅤとⅤ7で5もん）

ページごとのパラメータ（2026年10月時点。くわしくは各ページのさいしょのコメント）：

| ページ | パラメータ |
|---|---|
| `chord-quiz.html` | `key`（その調だけ）・`chord`（`I`・`IV`・`V`・`V7` を `,` で）・`mode`（`keys`＝けんばんでおさえる／`choice`＝4つからえらぶ）・`cat`（もんだいのしゅるい：`root` はじまりの音・`fill` たりない音・`add7` Ⅴ7にするには・`choice`・`keys`・`staff` がくふを見て・`fix` まちがいさがし・`prog` ならびの「？」・短調だけ `lt` 7ばんめの音・`mark` どの記号？。`mode` よりさき）・`tier`・`keyset`（`major`・`minor`・`both`。このページだけ）・`n`・`step`（`keyset` の長調／短調のステップの番号。そのステップの5もん）。`keyset` だけのリンクは、その調のステップのいちらんをひらく。きろくは `keys`・`choice` が `chord-quiz`、ほかは `chord-quiz-<しゅるい>`、ステップの ✓ は `chord-quiz-steps` |
| `minor-quiz.html` | `mode`（`chord`＝和音をおさえる／`mark`＝臨時記号をえらぶ）・`chord`（`V`・`V7`・`V9`・`DIM` を `,` で）・`tier`・`key`（短調 `m0`〜`m12`。`mark`（または `chord` が1つ）のときはさいしょの1もんだけ、あとは `tier` の調。`key` だけで `mode` がないときは `chord`）・`n` |
| `chroma-quiz.html` | `mode`（`keys`＝けんばんでおさえる／`ear`＝耳で聴きわける）・`step`（おさえる1〜6：1＝Ⅱ7・ドッペル、2＝副属和音、3＝準固有、4＝ナポリの六、5＝増六、6＝ぜんぶ）・`level`（耳1〜3。おさえるの `level` 1〜5はまえのリンクで、そのときとおなじ和音でひらく）・`chord`（和音の id を `,` で。`chord` が減七/Ⅴ・Ⅶ7・ドイツの6だけのときは、ドイツの6の問題に「🔥 チャレンジ（増六に読みかえる）」のしるし。異名同音の読みかえのチャレンジは `chord=ger`）・`tier`・`key`・`n`。`mode` がなくて `key`・`n`・`step`・`level`・`chord`・`tier` のどれかがあれば `keys`（ほぞんしたこたえかたが `ear` でもけんばんになる） |
| `ending-quiz.html` | `mode`（`ear`＝聴いて／`see`＝がくふを見て）・`level`（1〜4）・`tier`・`key`・`n` |
| `ear.html` | `mode`（`practice`＝れんしゅう／`challenge`＝🏆 チャレンジ（ランキング））・`level`（1〜8）・`n`。`level`・`n` だけでもれんしゅうになる。`challenge` のときは `level`・`n` はつかわない（いつもレベル1から） |
| `progression.html` | `step`（1〜5。1＝Ⅰ・Ⅳ・Ⅴ、2＝Ⅴ7・Ⅵ、3＝いちばん下の音、4＝いちばん上の音、5＝短調もまぜて）・`n`・`slow`（`1`＝🐢 ゆっくり鳴らす） |
| `accompaniment.html` | `song`（曲の id。例 `mary`）・`key`（長調 `M0`〜`M12` だけ） |
| `chord-build.html` | `key`・`chord`（`I`・`IV`・`V`・`V7`） |
| `chord-table.html` | `key`・`chord`（`I`・`IV`・`V`・`V7`） |
| `borrowed.html` | `key`（長調だけ）・`chord`（`iv`・`bVI`・`ii_dim`・`ii_hdim7`・`V9_b9`・`vii_dim7` のどれか1つ） |
| `dim-halfdim.html`（Ⅴ9の根音省略） | `key`（長調でも短調でも。同じ主音の短調でつくって、長調とくらべる） |
| `enharmonic.html` | `key`（短調だけ） |

## れんしゅうの回（n もん）とけっかのカード

- クイズの「📝 きょうの5もん」ボタン、または `n` つきのリンクではじまります（`PA.session`）。とちゅうでとじても12時間いないならつづきから。
- おわるとけっかのカード：「5もん中4もん」とほし、じぶんでできた・ヒントを見てできた・まちがえたの数、もういちど見たいもんだい、
  「👩‍🏫 先生に見せる」（日づけ・ページ・せってい・けっか）と、おなじれんしゅうのリンク。生徒はこの画面を先生に見せます。
- こたえる前に「つくりかたを見る」などをひらいても ×にはなりません（ヒントを見てできた、ときろく）。

## きろくとひかえ

- 設定（音名：ドレミ／CDE／ハニホ、基準の音 A4＝440〜443Hz、音のオン・オフ）・クイズの調のきろく（`keystats-…`）・ひらいたアプリ（`visited`）などは、
  その端末のブラウザ（localStorage の `pianoapps.…`）にあります。
- ⚙️ → 💾「きろくをファイルに書きだす／ファイルからよみこむ」でひかえをとれます（機種をかえるとき・ブラウザのデータをけす前に）。

## ホーム画面・オフライン（PWA）

- `manifest.webmanifest` とアイコン（`assets/icons/`・`favicon.svg`）で、スマホのホーム画面に追加できます。
- https では `sw.js`（サービスワーカー）を登録します。ページはネットがさき（3びょうまってこなければ保存したページ）、js・css・画像は保存したものをすぐ出してうらで新しくします。
  一度ひらけばネットがなくてもつかえます。
- ピアノの録音（`assets/piano/`、30こ・約1MB）は、べつの保存場所にしまいます。サイトを新しくしても、録音がかわっていなければダウンロードしなおしません。
- `sw.js` の `PRECACHE`・`VERSION`・`AUDIO`・`AUDIO_VERSION` と各ページの `<head>` の説明・シェア用タグは `npm run build:meta` が書きます（手でなおさない）。

## 📱 iOS アプリ（Capacitor）

ウェブとおなじページを、iPhone・iPad のアプリにも入れています（ページを書きなおさない）。アプリのものはぜんぶ `native/` にあり、公開するサイトには入りません（`.assetsignore`）。

- `tools/build-app.mjs` が、いちばん上の `*.html`・`assets/`・`favicon.svg` を `native/www/` にあつめ、各ページの `core.js` のすぐあとに `assets/native.js` を足します。
  `sw.js`・`manifest.webmanifest`・サーバーのコードは入れません（ページは中にもっているので、ネットがなくてもうごきます）。
- ページは `capacitor://localhost/…` でひらきます。`PA.native` が true になり、つぎのところがウェブとかわります。
  - 🏆 ランキングは出しません（`ear.html` の `NO_RANK`）。チャレンジはサーバーにつながずに、じぶんのきろくだけ。
  - 先生におくるリンクは、公開サイトのアドレス（`PA.SITE`）でつくります。
  - きろくの書きだしは「共有」でファイルをわたします。「ホーム画面に追加」「ブラウザの設定」などのことばはアプリむけにします。
- `assets/native.js`（アプリだけ）
  - きろくのひかえ：`'pianoapps.'` のきろくを Preferences（UserDefaults）にもひかえます。localStorage が iOS に消されたら、ひらいたときにもどします。
  - 🎹 電子ピアノ（MIDI）：`native/ios/App/App/PianoMidiPlugin.swift`（CoreMIDI）で、USB と Bluetooth の電子ピアノをうけとります。⚙️ の「📶 Bluetooth でつなぐ」で、iOS の Bluetooth MIDI の画面をひらきます。
    鍵盤をおすと、画面のけんばんをおしたのとおなじです（`PA.onKey`）。和音クイズは、和音をひくとそのままこたえあわせします（`PA.onMidiChord`）。
    ウェブでも、Web MIDI のあるブラウザ（Chrome・Edge・Android など）なら ⚙️ からつなげます。
  - アプリにもどったとき、音のしくみがうごかなければつくりなおします（着信のあとなど）。

つくりかた（Mac・Xcode 26 いじょう・Node 22 いじょう）：

```bash
cd native && npm install && npm run sync && npm run open
```

`npm run sync` は `native/www/` をつくりなおして `npx cap sync ios` をします。ページをなおしたら、もういちど `npm run sync`。
アプリの ID は `dev.g960059.pianochord`（App Store Connect に出す前にきめなおしてよい）。

## しくみ

- ビルド不要の静的サイトです（HTML・CSS・JavaScript だけ）。ファイルをそのまま開いても、静的ホスティングに置いても動きます。
  サーバー（Cloudflare Worker ＋ D1）をつかうのは 🏆 ランキング（`/api/*`）だけ。ないところでは「オフライン」と出してランキングなしでうごきます。
- 共通部分は `assets/core.js`（音楽理論・音の再生・鍵盤と楽譜の描画・設定・目次・リンク・れんしゅうの回・調のきろく）と `assets/app.css`。
  つかいかたは `assets/core.js` のさいしょのコメント「つかいかた」にまとめています。
- 音は Web Audio で、平均律・ラ（A4）＝440〜443Hz（設定で切りかえ）の正しい高さで鳴らします。表示する音の高さ＝鳴る音の高さです。
  ふだんはピアノの録音（Yamaha C5）を鳴らします。いちばん近い録音を再生速度で高さ合わせし、録音のピアノ全体のずれ（＋3.6セント）を直しています。
  録音が読めないとき・古いブラウザ・設定で「シンプルな音」のときは、合成の音で鳴ります。🏆 チャレンジは、はじめた時の音色でさいごまで鳴らします。
- iOS Safari 12でもうごくように、`?.`・`??`・クラスのフィールドはつかいません。

## アイコンのクレジット

ボタンの線のアイコン（`PA.icon`）は [Lucide](https://lucide.dev)（ISC ライセンス、© Lucide Contributors・Cole Bemis）です。ライセンスの全文は `assets/icons/LUCIDE-LICENSE.txt`。

## 音のクレジット

- ピアノの音：[Salamander Grand Piano V3](https://sfzinstruments.github.io/pianos/salamander/)（Yamaha C5、Alexander Holm、[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)）。
  [Tone.js が公開している版](https://tonejs.github.io/audio/salamander/)（3半音おき）を、`tools/trim-piano.mjs` ではじめの6.3秒だけに切って使っています（音のつくりなおしはしていません）。
  アプリの中では、頭の無音をとってモノラルにし、高さを上のように直して鳴らします。

## ローカルで動かす・テスト

```bash
python3 -m http.server 8000      # http://localhost:8000/（ランキングは「オフライン」になる）
npm run dev                      # wrangler でランキングも（さいしょにローカルの D1をつくる。npx が wrangler をとってくる）
npm test                         # node --test test/*.test.mjs
npm run build:meta               # <head>のタグと sw.js の PRECACHE・VERSION を書きなおす
npm run check                    # build:meta の書きわすれチェック＋テスト（CI 用）
```

## 公開先

https://piano-chord-apps.g960059.workers.dev/ （Cloudflare Workers。main に push すると自動で更新されます）

### 公開のしかたがかわる（ランキングを入れたので）

- いままで：Git 連携で静的サイトだけ。
- これから：`wrangler.jsonc` の設定で、**静的ファイル＋ Worker（`src/worker.js`）＋ D1**。Cloudflare のビルドは
  Build command `npm run check`、Deploy command `npx wrangler deploy`。ページの出かたはいままでとおなじ（`/ear.html` → `/ear` など）。
- 公開するのはリポジトリのいちばん上のページ・`assets/`・`sw.js` など。`src/`・`test/`・`tools/`・`docs/`・`*.md`・設定は `.assetsignore` で公開しない。
  ファイルをふやしたときは、公開してよいか `.assetsignore` を見なおす。
- 先生用キー `ADMIN_KEY` は Cloudflare の Secret（リポジトリには書かない）。
- はじめてのときの手順（Cloudflare の画面でたしかめること・ADMIN_KEY・D1・和音ききわけからの転送）は [docs/MIGRATION-RANKING.md](docs/MIGRATION-RANKING.md)。

Cloudflare のビルドの設定で、公開の前に `npm run check` をうごかしてください（`<head>` や `sw.js` の書きわすれ・テストの失敗があれば公開されません）。
ページをふやした・かえたときは、push の前に `npm run build:meta` をわすれずに。
テストは Node.js 22.13いじょう（ランキングのテストが `node:sqlite` をつかう）。
