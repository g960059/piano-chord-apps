# ピアノ和音アプリ

ピアノを習う人（小学生から大学生まで）向けに、和音を「見て・聴いて・さわって」おぼえる小さな Web アプリ集です。
スマホで使いやすいように、ひとつひとつのアプリをタブなしの1画面にしています。入口は `index.html` です。

## アプリ

| カテゴリ | アプリ | ファイル |
|---|---|---|
| 長調・短調の Ⅰ・Ⅳ・Ⅴ・Ⅴ7 | 和音のしくみ | `chord-build.html` |
| | 和音クイズ | `chord-quiz.html` |
| | カデンツ | `cadence.html` |
| | 和音いちらん表 | `chord-table.html` |
| 短調と臨時記号 | なぜ 7ばんめを 上げるの？ | `minor-why.html` |
| | 調号と 臨時記号 | `minor-signature.html` |
| | Ⅴの家族（Ⅴ・Ⅴ7・Ⅴ9・減七） | `minor-family.html` |
| | 短調クイズ | `minor-quiz.html` |
| 変化和音 | Ⅱ7と ドッペルドミナント | `doppel.html` |
| | 副属和音 | `secondary.html` |
| | 増六の和音（イタリア・フランス・ドイツの6） | `aug6.html` |
| | ナポリの六 | `neapolitan.html` |
| | 準固有和音（借用和音） | `borrowed.html` |
| | 減七と 半減七 | `dim-halfdim.html` |
| | 異名同音の 読みかえ | `enharmonic.html` |
| | 変化和音クイズ | `chroma-quiz.html` |
| つかってみる | 伴奏づけ | `accompaniment.html` |
| 耳をきたえる | 和音の 聴きわけ（10種類・8レベル・チャレンジ） | `ear.html` |
| | 和音ききわけ（ランキングつきの単体アプリ） | https://waon-kikiwake.g960059.workers.dev/ （[g960059/waon-kikiwake](https://github.com/g960059/waon-kikiwake)） |

## 公開先

https://piano-chord-apps.g960059.workers.dev/ （Cloudflare。main に push すると自動で更新されます）

## しくみ

- ビルド不要の静的サイトです（HTML・CSS・JavaScript だけ）。ファイルをそのまま開いても、静的ホスティングに置いても動きます。
- 共通部分は `assets/core.js`（音楽理論・音の再生・鍵盤と楽譜の描画・設定）と `assets/app.css` にまとめています。
- 音は Web Audio で、平均律・ラ（A4）＝440〜443Hz（設定で切りかえ）の正しい高さで鳴らします。
- 設定（音名：ドレミ／CDE／ハニホ、基準の音、音のオン・オフ）と各アプリの状態は、その端末のブラウザ（localStorage）に保存します。

## ローカルで動かす

```bash
python3 -m http.server 8000
```

ブラウザで http://localhost:8000/ を開きます。
