/* ピアノ和音アプリ共通のしくみ（すべてのページで使う）
 *
 * つかいかた（各ページ）
 *   <link rel="stylesheet" href="assets/app.css">
 *   <script src="assets/core.js"></script>
 *   <header class="appbar" id="appbar"></header><main class="page" id="view"></main>
 *   PA.mountBar({title:'和音のしくみ', app:'chord-build'})   … もどる・設定（音名・基準の音・音）
 *   PA.paint(document.getElementById('view'), html, sig)    … 描きかえ（横スクロール位置とフォーカスをたもつ）
 *   PA.onSettings = ()=>render()                            … 設定がかわったら描きなおす
 *   PA.onKey = m=>{...}                                     … 鍵盤をタップしたとき（音は core が鳴らす）
 *   PA.onStopDown = ()=>{...}                               … data-act="stop" をおした瞬間（描きなおさずに音を止める）
 *   PA.onStopCancel = ()=>render()                          … ⏹ をおしたのに click が来なかった（指がずれた・スクロール）とき画面をもどす
 *   PA.paint(document.getElementById('actions'), html, 'bar') … 下のボタンバーもこれで描くとフォーカスがのこる
 *   PA.onPageShow = ()=>render()                            … 「もどる」で bfcache からもどってきたとき
 *
 * 音楽：PA.majorKey(i) / PA.minorKey(i)、PA.at(scale,k)、PA.nm(note)、PA.nmH(note)、PA.namesH(notes)
 *   PA.nm＝ただの文字（aria-label・title・data-*・SVG の中はこちら）。
 *   PA.nmH／PA.namesH＝HTML（<span class="nw">ファ♯</span>：♯・♭の前で行がかわらない）。HTML の文の中だけでつかう
 * 音  ：PA.playNote(midi,when,dur,vel)、PA.chord(midis,{when,dur,arp,vel})、PA.stopSound()
 *       PA.voice()＝いまの音色（'piano'｜'synth'）、PA.lockVoice(v)、PA.loadPiano()、PA.pianoReady()
 * 図  ：PA.kbSVG(lo,hi,marks,opts)、PA.staffSVG(key,cols,opts)
 *   kbSVG の marks の1つに sr:'えらんだ・まちがい' を入れると、読み上げで「ミ、えらんだ・まちがい」になる
 * UI  ：PA.keyChip(key)、PA.openKeySheet({minor,idx,onPick,both})、PA.seg(act,opts,cur)
 *   PA.esc(s) … HTML の文字（& < > " '）をにがす。PA.announce(text) … 読み上げソフトに知らせる（画面には出ない）
 * 平均律・A4＝基準ピッチ（設定で440〜443Hz）。生徒は絶対音感があるので、音の高さと表示はかならずそろえる。
 *
 * きろく：PA.store.get(k,d) / PA.store.set(k,v)（'pianoapps.'+k に JSON）、PA.store.keys() → 'pianoapps.' をとった名前の一覧
 *   PA.onStore（きろくがかわった）・PA.flushStore（ひかえを書きおわるまでまつ Promise）は native.js がおく
 *
 * ----- iOS アプリ（Capacitor） -----
 *   PA.native … アプリの中（capacitor://localhost）なら true。アプリだけのしくみは assets/native.js（tools/build-app.mjs が足す）
 *   PA.SITE … 公開しているサイトのアドレス（アプリの中の PA.absUrl・PA.shareHTML はこちらのアドレスになる）
 *   アプリではランキングを出さない（ear.html の NO_RANK）。ホーム画面に追加・ブラウザの設定などのことばもかえる
 *
 * ----- 🎹 電子ピアノ（MIDI）：PA.midi（くわしくは「===== 🎹 電子ピアノ」のところ） -----
 *   鍵盤をおす → PA.onKey(m)（画面のけんばんとおなじ）。和音でこたえるページは PA.onMidiChord=midis=>{…}
 *   PA.midi.active() … 機器がつながっている。PA.onMidiChange … つながりがかわった
 *   PA.midiIn … PA.onKey・PA.onMidiChord の中で true なら電子ピアノから（画面のけんばんにない高さのことがある。ふるえない）
 *
 * ----- アプリの目次（ホーム・つぎへのリンク・もどるにつかう） -----
 *   PA.APP_TYPES … {learn,quiz,play,ref,ear}：{label, c(色), l(うすい色), dk(白い字をのせられるこい色)}
 *   PA.UNITS … [{id, kind, title, sub, tasks:[{app, href, title}], apps:[app の id]}]（ホームにならべるじゅん）
 *     kind：'basic'＝基本の地図（①〜⑥）、'daily'＝毎日たのしむところ（耳のひろば）、'pieces'＝名曲で楽曲分析（基本の地図のあと）、'extra'＝レベルアップしたい人へ
 *     soon＝'pieces' のこれから足す曲のメモ（1行の文。リンクにしない。ホームでうすく出すだけ。iOS アプリ（PA.native）では出さない）
 *     tasks＝島の中の課題。おなじアプリを、べつの設定（href の ?keyset=… など）でいくつかの単元に出せる（和音クイズは①長調・②短調）
 *     apps＝tasks のアプリの id（おなじものは1つ）。PA.unit(id) → その単元（なければ null）
 *   PA.APPS  … [{id, ic, title, d, type:'learn'|'quiz'|'play'|'ref'|'ear', unit, practice?(れんしゅうのページの id), href?(外のページ)}]
 *     unit＝そのアプリがさいしょに出てくる単元（アプリ1つに1つ）
 *     title はただの文字。d は HTML（<span class="ds">…</span>などが入る）なので PA.esc をとおさずにそのまま入れる
 *   PA.app(id) → そのアプリ（なければ null）
 *
 * ----- 上のバー・ページのいどう -----
 *   PA.mountBar({title, app, back})
 *     ・ほかのアプリから PA.go やふつうのリンクで来たときは、左上が「‹ 和音クイズへ」のボタン（data-pa="back"）。
 *       おすと、そのページから来たばかりなら history.back()（れきしがふえない）、ちがえばそのページへ。
 *       ホームへもどるときはまるい ‹（aria-label「ホームにもどる」）
 *     ・PA.store の 'last'＝{app,title,t}（これまでどおり）、'last-practice'（type が quiz・play・ear）、'last-learn'（learn・ref）
 *       'visited'＝{アプリの id: さいごにひらいた時刻}（ホームの ✓・「3 / 4ひらいた」）
 *     ・音がオフのときはバーの下に「🔇 音がオフになっているよ［🔊 音を出す］」（おすと音をオンにして PA.onSettings）
 *   PA.go(page, params?) … ‹ でいまのアプリにもどれるようにして page へ（params は PA.url とおなじ）
 *   PA.updateSoundBar() … 音のオン・オフをかえたあと、バーの下の「🔇 音がオフ」を出す／けす（設定シートでは core がよぶ）
 *
 * ----- リンクのパラメータ（先生が宿題のリンクをつくる。サーバーはつかわない） -----
 *   PA.url(page, {k:v,…}) → 'page.html?k=v&…'（page に .html がなければつける。null・undefined・''・false の値はのせない）
 *   PA.absUrl(rel) → https://… のながいアドレス（いまのページの場所から）
 *   PA.params() → location.search の {名前:文字}（名前は /^[a-z][a-z0-9-]{0,20}$/、値は40文字まで。ちがうものはすてる）
 *   PA.parseParams(search) … PA.params とおなじ（'?a=1&b=2' の文字をわたす）
 *   PA.PARAM_KEYS＝['key','chord','mode','level','tier','n','step']（下のことば）。PA.fromLink() → このどれかがリンクにあれば true
 *   PA.paramInt(name, lo, hi) → 整数（lo〜hi の外・ないときは null）
 *   ことば（どのページもおなじ意味。その1回だけつかい、ほぞんした設定はかえない）：
 *     key＝調（keyDeck の id：M0〜M12長調、m0〜m12短調）、chord＝そのページの和音の id、mode＝そのページのこたえかた、
 *     level＝レベル（1から）、tier＝easy｜normal｜hard｜all、n＝れんしゅうのもんだいの数（1〜20）、
 *     step＝ステップ（1から。学ぶじゅんの段階：変化和音クイズ・ならびの聴きわけ）
 *   PA.shareHTML(page, params, label?) → リンクをおくるボタン（data-pa="share" data-url="https://…"）。
 *     おすと navigator.share、なければコピー（navigator.clipboard、だめなら prompt）して「コピーしたよ」。クリックは core があつかう
 *
 * ----- れんしゅうの回（n もん）とけっかのカード -----
 *   const s=PA.session(quiz, {n, sig?})  … PA.store('session-'+quiz)＝{n, done:[{ok, hint, label, key?}], startedAt, sig, endedAt?}
 *     12時間より前にはじめた回は、n がなくてもすてる。
 *     n（1〜20。文字でもよい）があるとき：ほぞんした回と n・sig がおなじで、とちゅう（またはおわって10分いない＝「もどる」の読みなおし）
 *     ならつづき。ちがえば新しくはじめる（おわった回をおなじリンクであけなおすと、はじめから）。
 *     sig＝リンクのしるし。わたさなければ PA.sessionSig(PA.params())（n いがいの key・chord・mode・level・tier をならべた文字）
 *     n をわたさないときは、のこっている回をそのままよむだけ（12時間たっていれば null とおなじ）
 *     とちゅうの回がちがう sig で上がきされる（宿題・ふくしゅうのリンク）ときは PA.store('sessionpause-'+quiz) に1つとっておき、
 *     いまの回をけした／おわって10分たったあとの PA.session(quiz) でもどす（そのリンクをまたひらいてももどる）
 *     s.active() … n>0でまだおわっていない。s.finished() … n もんこたえた。s.count() … こたえた数。s.n() … もんだいの数
 *     s.record({ok, hint, label, key}) … 1もんきろく（label はただの文字。PA.nm でつくる）。active でなければ null。
 *       かえす：{count, n, finished}
 *     s.progressHTML() … 「📝 きょうの5もん　3 / 5」の小さなチップ（active・finished でないときは ''）
 *     s.summaryHTML({title, page, params, settings}) … けっかのカード：「5もん中4もん」とほし、じぶんでできた・ヒントを見てできた・
 *       まちがえたの数、まちがえた／ヒントを見たもんだい、ひとこと、「👩‍🏫 先生に見せる」（日づけ・ページ・せってい・けっか）、
 *       おなじれんしゅうの PA.shareHTML（params に n をたす）、ボタン data-act="session-again"（もういちど）・data-act="session-free"（じゆうにれんしゅう）。
 *       settings（ただの文字）がなければ params からつくる（key・tier・level・n）。2つのボタンはページであつかう
 *       extra（HTML）はひとことの下に入れる（耳のひろばの PA.earDays.cheerHTML）
 *     s.start(n) / s.clear() / s.tally() → {n, done, self, hint, wrong, ok, stars(1〜3), msg}
 *   PA.sessionTally(done, n) … tally とおなじ（ページの外でつかうとき）。PA.sessionSig(params) … 上の sig
 *   PA.paramsText(params) … 「調：ト長調・むずかしさ：…・レベル2」（先生に見せる「せってい」の文。ただの文字）
 *   PA.HINT_NOTE … 「こたえるまえに見ても ×にはならないよ。…」（ヒントのボタンの近くに出す）
 *
 * ----- 学ぶページの「ためしてみる」カード -----
 *   PA.tryHTML({to, params, title, sub, btn, links:[{to, params, label}]}) … 大きいボタン1つ（to のページへ。色は to の type）と小さなリンク
 *
 * ----- 2回おすボタン・キーボード -----
 *   data-confirm="ほんとうにけす？" のボタンは2回おす：1回めは文字がかわって赤いわく（.armed）、4秒以内にもういちどおすとふつうの click。
 *     PA.paint で描きなおしても（data-act＋data-v がおなじボタン）つづく
 *   キーボード・ページめくりペダル（入力らん・ひらいたシートの中、ctrl・alt・⌘・shift つきではうごかない）：
 *     スペース → 見えている data-hot~="listen"、Enter → data-hot~="check"（どちらもフォーカスがボタン・リンクのときはそのボタン）、
 *     → ／ PageDown → data-hot~="next"、← ／ PageUp → data-hot~="prev"（けんばんの鍵にフォーカスがあるときは鍵のいどう）。
 *     例：<button data-act="qplay" data-hot="listen">、<button data-act="qnext" data-hot="next">
 *
 * ----- 広い画面 -----
 *   <main class="page duo">…<div class="duo-grid"><div>…</div><div class="duo-side">…</div></div>（1000px 以上で2れつ、右はついてくる）
 *
 * きろくのひかえ：⚙️ のシートで 'pianoapps.' のきろくをファイルに書きだす／よみこむ。
 *   PA.backupData() → {'pianoapps.…': JSON の文字}（書きだす中身）、PA.checkBackup(obj) → よみこめる中身ならその obj、ちがえば null
 *   書きだすボタンをおしたとき（またはホーム画面のアプリのとき）だけ navigator.storage.persist() で「消さないで」とおねがい。
 * https では sw.js を登録する。
 */
(function(){
'use strict';
const PA=window.PA={};
document.documentElement.lang='ja';
// iOS アプリ（Capacitor）の中：ページは capacitor://localhost/…（アプリの中のファイル）。アプリだけのしくみは assets/native.js
PA.native=(()=>{try{return location.protocol==='capacitor:';}catch(e){return false;}})();
if(PA.native){try{document.documentElement.classList.add('pa-native');}catch(e){}} // app.css：リンクの長おしメニューを出さない
// 公開しているサイト（アプリの中から先生におくるリンクは、こちらのアドレスにする）
PA.SITE='https://piano-chord-apps.g960059.workers.dev/';
// ふるえ（ハプティクス）：kind＝'success'（正解）・'light'（まちがい・軽い合図）・'selection'（えらぶ）・'medium'（2回おすボタンの1回め）。
// ウェブではなにもしない（iPhone の Safari にはない）。アプリでは native.js がおきかえる（iPhone だけ。マイク・電子ピアノのときはふるえない）
PA.haptic=()=>{};
// こたえたとき（ok＝正解）。音・見た目といっしょに、ページがよぶ
PA.answerFx=ok=>{try{PA.haptic(ok?'success':'light');}catch(e){}};

/* ===== ボタンのアイコン（SVG） =====
 * PA.icon(name) → <svg class="ic">（線のアイコン。色はボタンの文字の色、大きさは文字の大きさにあわせる。読み上げはしない）
 * 操作のボタン（きく・とめる・次へ など）につかう。気もちやキャラクター（🐸・🎉・聴きわけの顔）は絵文字のまま。
 * 絵は Lucide 0.548（https://lucide.dev 、ISC ライセンス、© Lucide Contributors・Cole Bemis）の線をそのまま使っている。
 * ライセンスの全文：assets/icons/LUCIDE-LICENSE.txt（アイコンをふやすときは lucide-static の icons/*.svg の中身をここにうつす） */
const ICONS={
  check:'<path d="M20 6 9 17l-5-5"/>',
  erase:'<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>',
  hint:'<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  next:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  listen:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  retry:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  mic:'<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  piano:'<path d="M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 9v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.5C22 9.6 20.4 8 18.5 8"/><path d="M2 14h20"/><path d="M6 14v4"/><path d="M10 14v4"/><path d="M14 14v4"/><path d="M18 14v4"/>',
  play:'<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  dice:'<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>',
  eye:'<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  model:'<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  send:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  settings:'<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  session:'<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
  book:'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  checkOn:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
  checkOff:'<rect width="18" height="18" x="3" y="3" rx="2"/>',
  copy:'<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  flag:'<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  mute:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  save:'<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  open:'<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  bluetooth:'<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
  trash:'<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  close:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  eyeOff:'<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  shuffle:'<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  search:'<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  trophy:'<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
  calendar:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  wait:'<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  ear:'<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  hand:'<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
};
PA.icon=name=>ICONS[name]?`<svg class="ic ic-${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`:'';

/* ===== 保存（使えないブラウザでもこわれないように） =====
 * PA.onStore … きろくがかわったとき（アプリでは native.js が、消されないところにもひかえる）
 * PA.flushStore … ひかえを書きおわるまでまつ Promise（ページを読みなおす前に。なければ null） */
const stored=()=>{try{if(PA.onStore) PA.onStore();}catch(e){}};
PA.store={
  get(k,d){try{const v=localStorage.getItem('pianoapps.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('pianoapps.'+k,JSON.stringify(v));}catch(e){}stored();},
  // 'pianoapps.' のきろくの名前（'pianoapps.' をとったもの）
  keys(){const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf('pianoapps.')===0) out.push(k.slice(10));}}catch(e){}return out;}
};
PA.esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const S=PA.settings={naming:'solfa',sound:true,pitchA:440,voice:'piano',midiEcho:false};
const loadSettings=()=>{
  const d=PA.store.get('settings',{})||{};
  if(['solfa','en','ja'].includes(d.naming)) S.naming=d.naming;
  if(typeof d.sound==='boolean') S.sound=d.sound;
  if([440,441,442,443].includes(d.pitchA)) S.pitchA=d.pitchA;
  if(d.voice==='piano'||d.voice==='synth') S.voice=d.voice;
  if(typeof d.midiEcho==='boolean') S.midiEcho=d.midiEcho;
};
loadSettings();
PA.saveSettings=()=>PA.store.set('settings',S);

/* ===== 音楽の基本 ===== */
PA.LET_SOLFA=['ド','レ','ミ','ファ','ソ','ラ','シ'];
PA.LET_EN='CDEFGAB';
PA.LET_JA='ハニホヘトイロ';
PA.NAT=[0,2,4,5,7,9,11];
PA.ACC={'-2':'𝄫','-1':'♭','0':'','1':'♯','2':'𝄪'};
PA.MAJ=[0,2,4,5,7,9,11]; PA.NMIN=[0,2,3,5,7,8,10]; PA.HMIN=[0,2,3,5,7,8,11];
// [主音の文字, 変化記号]。♯系 → ♭系の順
PA.MAJOR_KEYS=[[0,0],[4,0],[1,0],[5,0],[2,0],[6,0],[3,1],[3,0],[6,-1],[2,-1],[5,-1],[1,-1],[4,-1]];
PA.MINOR_KEYS=[[5,0],[2,0],[6,0],[3,1],[0,1],[4,1],[1,1],[1,0],[4,0],[0,0],[3,0],[6,-1],[2,-1]];
PA.MAJOR_FLAT_FROM=7; PA.MINOR_FLAT_FROM=7;
PA.SHARP_ORDER=[3,0,4,1,5,2,6];
PA.BLACK=new Set([1,3,6,8,10]);
PA.COL={I:'#e8553d',IV:'#22a06b',V:'#2f7ee8',V7:'#8a4fe0'};
PA.LCOL={I:'#fde5df',IV:'#daf3e6',V:'#dfeafd',V7:'#ece2fb'};
const mod=PA.mod=(a,n)=>((a%n)+n)%n;
PA.spell=(L,pc)=>{let a=mod(pc-PA.NAT[L],12);if(a>6)a-=12;return a;};
PA.buildScale=(l,tpc,tonicMidi,ints)=>ints.map((iv,i)=>{const L=(l+i)%7;return {letter:L,acc:PA.spell(L,tpc+iv),midi:tonicMidi+iv,deg:i+1};});
const placeTonic=(tpc,base)=>base+mod(tpc-base,12);
// 長調：主音は base〜base+11（ふだんはド4〜シ4）
PA.majorKey=(idx,base=60)=>{
  const [l,a]=PA.MAJOR_KEYS[idx], tpc=mod(PA.NAT[l]+a,12), tonicMidi=placeTonic(tpc,base);
  const scale=PA.buildScale(l,tpc,tonicMidi,PA.MAJ), sig={};
  scale.forEach(n=>sig[n.letter]=n.acc);
  return {idx,l,a,tpc,tonicMidi,minor:false,scale,sig};
};
// 短調：nat＝自然的短音階（調号のまま）、harm＝和声的短音階（7ばんめを上げる。harm[6].raised）
PA.minorKey=(idx,base=57)=>{
  const [l,a]=PA.MINOR_KEYS[idx], tpc=mod(PA.NAT[l]+a,12), tonicMidi=placeTonic(tpc,base);
  const nat=PA.buildScale(l,tpc,tonicMidi,PA.NMIN), harm=PA.buildScale(l,tpc,tonicMidi,PA.HMIN);
  harm[6].raised=true;
  const sig={}; nat.forEach(n=>sig[n.letter]=n.acc);
  const rl=(l+2)%7, rpc=mod(tpc+3,12);
  const rel={l:rl,a:PA.spell(rl,rpc),minor:false,tpc:rpc,tonicMidi:60+rpc}; rel.scale=PA.buildScale(rl,rpc,60+rpc,PA.MAJ);
  const par={l,a,minor:false,tpc,tonicMidi,scale:PA.buildScale(l,tpc,tonicMidi,PA.MAJ)};
  return {idx,l,a,tpc,tonicMidi,minor:true,nat,harm,scale:harm,sig,rel,par,lt:harm[6],natLT:nat[6],ltType:harm[6].acc};
};
PA.keyOf=(minor,idx,base)=>minor?PA.minorKey(idx,base):PA.majorKey(idx,base);
PA.keyCount=minor=>(minor?PA.MINOR_KEYS:PA.MAJOR_KEYS).length;
PA.at=(scale,k)=>{const s=scale[mod(k,7)];return {...s,midi:s.midi+12*Math.floor(k/7),k};};
PA.sigInfo=key=>{
  const sh=PA.SHARP_ORDER.filter(L=>key.sig[L]>0), fl=[...PA.SHARP_ORDER].reverse().filter(L=>key.sig[L]<0);
  return sh.length?{type:1,letters:sh}:{type:-1,letters:fl};
};
// 音階にない音（まちがえて押した音など）の名前：♯の調・調号なしは♯、♭の調は♭で
PA.spellMidi=(m,key)=>{
  const pc=mod(m,12), sc=[...(key.scale||[]),...(key.nat||[])];
  const s=sc.find(x=>mod(x.midi,12)===pc); if(s) return {letter:s.letter,acc:s.acc,midi:m};
  const SH=[[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
  const FL=[[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];
  const si=PA.sigInfo(key), [L,a]=((si.type>0||!si.letters.length)?SH:FL)[pc];
  return {letter:L,acc:a,midi:m};
};

/* ===== 名前 ===== */
PA.nm=n=>{
  const a=n.acc||0;
  if(S.naming==='en') return PA.LET_EN[n.letter]+PA.ACC[a];
  if(S.naming==='ja') return (a===1?'嬰':a===-1?'変':a===2?'重嬰':a===-2?'重変':'')+PA.LET_JA[n.letter];
  return PA.LET_SOLFA[n.letter]+PA.ACC[a];
};
// 𝄪 は端末によって出ないので、楽譜と同じ「x」の形で出す。𝄫 も出ない端末があるので♭♭で出す
PA.H=s=>String(s).replace(/𝄪/g,'<span class="ds">x</span>').replace(/𝄫/g,'<span class="df" style="letter-spacing:-.12em">♭♭</span>');
PA.Svg=s=>String(s).replace(/𝄪/g,'<tspan font-family="Arial,Helvetica,sans-serif" font-weight="900">x</tspan>').replace(/𝄫/g,'<tspan letter-spacing="-1.5">♭♭</tspan>');
PA.nmH=n=>'<span class="nw">'+PA.H(PA.nm(n))+'</span>'; // ♯・♭の前で行がかわらない（HTML の文の中だけ）
PA.namesH=(ns,sep='・')=>ns.map(PA.nmH).join(sep);
PA.namesT=(ns,sep='・')=>ns.map(PA.nm).join(sep);
PA.keyName=k=>(k.a>0?'嬰':k.a<0?'変':'')+PA.LET_JA[k.l]+(k.minor?'短調':'長調');
PA.keyEn=k=>PA.H(PA.LET_EN[k.l]+PA.ACC[k.a]+(k.minor?'m':''));
PA.sigLabel=k=>{const s=PA.sigInfo(k);return s.letters.length?(s.type>0?'♯':'♭')+s.letters.length+'つ':'調号なし';};

/* ===== 音 =====
 * ピアノの録音（assets/piano/）を鳴らす。録音がまだ読めていない・読めないとき、
 * または せってい で「シンプルな音」をえらんだときは、合成の音（三角波＋サイン波）。
 * 録音：Salamander Grand Piano V3（Yamaha C5、Alexander Holm、CC BY 3.0）を Tone.js が公開している版（3半音おき・30こ）。
 *       tools/trim-piano.mjs で、はじめの6.3秒だけに切っている（音はもとのまま）。
 * 高さ：いちばん近い録音を再生速度でずらす。録音のピアノ全体のずれ（PIANO.cents）を直して、A4＝基準ピッチの平均律にそろえる。
 *       （高い音・低い音の少しのずれは、ほんとうのピアノと同じにのこす） */
let actx=null,master=null,soundGen=0;
const voices=new Set();
// PA.stopSound のたびにふえる。あとで鳴らす予定の音（録音を読みおわってから鳴らす音など）は、ふえていたら鳴らさない
PA.soundGen=()=>soundGen;
const PIANO=PA.PIANO={
  base:(()=>{try{return new URL('piano/',document.currentScript.src).href;}catch(e){return 'assets/piano/';}})(),
  keep:6,     // 鳴りはじめから何秒まで使うか（伴奏づけのおそいテンポの長い音＝約5.2秒まで。それより長い音は自然に小さくなる）
  cents:3.6,  // 録音のピアノ全体の高さのずれ（ド3〜ド6の、A4＝440Hz の平均律からのずれの中央値。聴き比べページではかった）
  gain:0.86,  // ド4の最初の1秒の大きさを、合成の音にそろえる
  wait:15,    // 読みこみをまつ時間（秒）。こえたら合成の音のまま
  notes:[]
};
{const N={9:'A',0:'C',3:'Ds',6:'Fs'};for(let m=21;m<=108;m+=3) PIANO.notes.push({midi:m,file:N[m%12]+(Math.floor(m/12)-1)+'.mp3'});}
// いちばん近い録音（同じ近さなら下の録音を上げて使う）。list は midi の小さいじゅん
PA.pianoNearest=(list,m)=>{let best=null,bd=1e9;for(const s of list){const d=Math.abs(s.midi-m);if(d<bd){best=s;bd=d;}}return best;};
// 再生速度：録音の midi から target へ。全体のずれを直して、a4（基準ピッチ）に合わせる
PA.pianoRate=(target,sampleMidi,a4)=>Math.pow(2,(target-sampleMidi)/12-PIANO.cents/1200)*((a4||440)/440);
let pianoBufs=null,pianoLoading=null,pianoFailAt=0;
PA.pianoReady=()=>!!pianoBufs;
// 頭の無音をとって、PIANO.keep 秒だけのモノラルにする（メモリを小さく。おわりは0.4秒でフェード）
const pianoTrim=(oc,b)=>{
  const sr=b.sampleRate,c=b.numberOfChannels,x=b.getChannelData(0),scan=Math.min(b.length,Math.round(sr*0.3));
  let pk=0;for(let i=0;i<scan;i++){const v=Math.abs(x[i]);if(v>pk)pk=v;}
  let on=0;while(on<scan&&Math.abs(x[on])<=pk*0.02) on++;
  on=Math.max(0,on-Math.round(sr*0.002));
  const n=Math.min(b.length-on,Math.round(sr*PIANO.keep)),out=oc.createBuffer(1,n,sr),d=out.getChannelData(0),fade=Math.round(sr*0.4);
  for(let ch=0;ch<c;ch++){const y=b.getChannelData(ch);for(let i=0;i<n;i++) d[i]+=y[on+i]/c;}
  for(let i=Math.max(0,n-fade);i<n;i++) d[i]*=(n-i)/fade;
  return out;
};
// 録音を読みこむ（音を出さない OfflineAudioContext でひらくので、さわる前でも読める）。読めたら true
PA.loadPiano=()=>{
  if(pianoBufs) return Promise.resolve(true);
  if(pianoLoading) return pianoLoading;
  if(Date.now()-pianoFailAt<30000||typeof fetch!=='function'||typeof OfflineAudioContext!=='function') return Promise.resolve(false);
  const oc=new OfflineAudioContext(1,1,44100);
  const all=Promise.all(PIANO.notes.map(n=>fetch(PIANO.base+n.file)
    // アプリの中のファイル：Capacitor は mp3 を HTTP でないこたえ（status 0）でかえす。中身はあるので読む
    .then(r=>{if(!r.ok&&!(PA.native&&r.status===0)) throw new Error(n.file+' '+r.status);return r.arrayBuffer();})
    .then(ab=>oc.decodeAudioData(ab)).then(b=>({midi:n.midi,buf:pianoTrim(oc,b)}))))
    .then(list=>{pianoBufs=list;return true;});
  // 1つでもとまったままのときは、PIANO.wait 秒で「読めなかった」にする（あとから読めたら、そのときから使う）
  const late=new Promise(r=>setTimeout(()=>r(false),PIANO.wait*1000));
  pianoLoading=Promise.race([all,late])
    .then(ok=>{pianoLoading=null;if(!ok) pianoFailAt=Date.now();return ok;},()=>{pianoLoading=null;pianoFailAt=Date.now();return false;});
  all.catch(()=>{});
  return pianoLoading;
};
// いま鳴らす音色：'piano'｜'synth'。lockVoice＝チャレンジの画面で、はじめた時の音色にとめる（null で とく）
let voiceLock=null;
PA.voice=()=>{const v=voiceLock||S.voice;return v==='piano'&&pianoBufs?'piano':'synth';};
PA.lockVoice=v=>{voiceLock=v==='piano'||v==='synth'?v:null;if(voiceLock==='piano') PA.loadPiano();return voiceLock;};
const wantPiano=()=>(voiceLock||S.voice)==='piano';
// 音を鳴らさないページ（<body data-nosound>＝ホーム）：さわっても録音は読まない（鳴らすときは合成の音。せっていのためしの音は読む）
const noSoundPage=()=>{try{return !!(document.body&&document.body.hasAttribute&&document.body.hasAttribute('data-nosound'));}catch(e){return false;}};
PA.audio=()=>{
  if(!actx){
    try{if(navigator.audioSession) navigator.audioSession.type='playback';}catch(e){}
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    actx=new AC();
    const comp=actx.createDynamicsCompressor();
    master=actx.createGain(); master.gain.value=0.7;
    master.connect(comp); comp.connect(actx.destination);
  }
  if(actx.state!=='running'&&actx.state!=='closed') actx.resume().catch(()=>{});
  if(wantPiano()&&!pianoBufs&&!noSoundPage()) PA.loadPiano();
  return actx;
};
PA.audioRunning=()=>!!(actx&&actx.state==='running');
// アプリにもどっても音のしくみがうごかない（着信のあとなど。iOS の WKWebView でおきる）：すてて、つぎにさわったときつくりなおす
// （読んだ録音はそのままつかえる）。native.js がアプリにもどったときによぶ
PA.audioStuck=()=>!!actx&&actx.state!=='running';
PA.audioReset=()=>{
  if(!actx) return;
  // ページの再生（伴奏づけの光る場所など）もとめて、画面も「とめる」から もとにもどす（どのページも onStopCancel＝描きなおし）
  try{if(PA.onStopDown) PA.onStopDown();if(PA.onStopCancel) PA.onStopCancel();}catch(e){}
  PA.stopSound();
  const old=actx; actx=null; master=null;
  try{old.close().catch(()=>{});}catch(e){}
};
['pointerup','touchend','click','keydown'].forEach(t=>document.addEventListener(t,()=>{if(S.sound)PA.audio();},{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&actx&&actx.state!=='running'&&actx.state!=='closed')actx.resume().catch(()=>{});});
// ページをひらいたら、さわる前に録音を読んでおく（さいしょの音からピアノになるように）。音を鳴らさないページ（<body data-nosound>）では読まない
if(typeof window.addEventListener==='function') window.addEventListener('load',()=>{if(S.sound&&wantPiano()&&!noSoundPage()) PA.loadPiano();});
const pianoNote=(ac,midi,t,dur,vel)=>{
  const s=PA.pianoNearest(pianoBufs,midi), src=ac.createBufferSource(), g=ac.createGain(), a=vel/0.22*PIANO.gain;
  src.buffer=s.buf; src.playbackRate.value=PA.pianoRate(midi,s.midi,S.pitchA);
  g.gain.setValueAtTime(a,t);
  // 鍵盤をはなす（ダンパー）。合成の音と同じく、dur でほぼ消えているようにする（つぎの和音とかさならない）
  const off=Math.max(t+0.05,t+dur-0.15);
  g.gain.setValueAtTime(a,off); g.gain.setTargetAtTime(0.0001,off,0.05);
  src.connect(g); g.connect(master); src.start(t); src.stop(t+dur+0.3);
  const voice={os:[src],g,t0:t}; voices.add(voice);
  src.onended=()=>{try{src.disconnect();g.disconnect();}catch(e){}voices.delete(voice);};
};
PA.playNote=(midi,when=0,dur=1.6,vel=0.22)=>{
  if(!S.sound) return; const ac=PA.audio(); if(!ac) return;
  const t=ac.currentTime+when+0.01;
  if(PA.voice()==='piano'){pianoNote(ac,midi,t,dur,vel);return;}
  const f=S.pitchA*Math.pow(2,(midi-69)/12); // 平均律・A4＝基準ピッチ
  const g=ac.createGain(), lp=ac.createBiquadFilter();
  lp.type='lowpass';
  lp.frequency.setValueAtTime(Math.min(9000,f*9),t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f*1.6,350),t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vel,t+0.008);
  g.gain.exponentialRampToValueAtTime(vel*0.35,t+0.28);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  g.connect(lp); lp.connect(master);
  const parts=[[1,1,'triangle'],[2,0.42,'sine'],[3,0.16,'sine'],[4,0.08,'sine']], voice={os:[],g,t0:t};
  voices.add(voice);
  parts.forEach(([h,a,type],i)=>{
    const o=ac.createOscillator(), og=ac.createGain();
    o.type=type; o.frequency.value=f*h; og.gain.value=a;
    o.connect(og); og.connect(g); o.start(t); o.stop(t+dur+0.05);
    o.onended=()=>{try{o.disconnect();og.disconnect();if(i===parts.length-1){g.disconnect();lp.disconnect();voices.delete(voice);}}catch(e){}};
    voice.os.push(o);
  });
};
PA.stopSound=()=>{
  soundGen++;
  if(actx){
    const t=actx.currentTime;
    voices.forEach(v=>{try{
      const p=v.g.gain;
      if(v.t0>t){p.cancelScheduledValues(0);p.setValueAtTime(0,t);} // まだ鳴りはじめていない音はすぐ消す
      else{
        if(p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else {p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);}
        p.setTargetAtTime(0.0001,t,0.015);
      }
      v.os.forEach(o=>o.stop(t+0.12));
    }catch(e){}});
  }
  voices.clear();
};
PA.chord=(ms,o={})=>{
  const when=o.when||0, arp=!!o.arp, dur=o.dur||(arp?1.6:2.2);
  const vel=o.vel||(arp?0.22:Math.min(0.17,0.5/Math.max(ms.length,1)+0.05));
  ms.forEach((m,i)=>PA.playNote(m,when+(arp?i*(o.gap||0.36):i*0.012),dur,vel));
};
PA.sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ===== 🎹 電子ピアノ（MIDI） =====
 * つないだ電子ピアノの鍵盤をおすと、画面のけんばんをおしたのとおなじ（PA.onKey(m)）。
 *   音は電子ピアノが鳴らすので、アプリは鳴らさない（せってい「アプリでも鳴らす」をオン＝音の出ない MIDI キーボード用）。
 * 和音でこたえるページは PA.onMidiChord=midis=>{…} をおく：ひいた音がそろったとき1回（midis＝おさえている音、低いじゅん）。
 *   あるときは PA.onKey のかわりにこちらをよぶ（鍵を1つずつおしたことにはしない）。
 * つなぎかた
 *   ・iOS アプリ：assets/native.js が PA.midi.useNative({start, pair}) で CoreMIDI（USB・Bluetooth）をつなぐ。ページをひらくとつなぐ
 *   ・ウェブ（Chrome・Edge・Android など）：Web MIDI。⚙️ の「🎹 電子ピアノをつなぐ」をおしたときだけ（ゆるしをきかれるので）
 *   ・iPhone・iPad の Safari には MIDI がない → ⚙️ にも出さない（マイクの 🎤 でこたえる）
 * PA.midi.available() … つなげる？  PA.midi.connect() → Promise<boolean>  PA.midi.pair() … Bluetooth の画面（アプリだけ）
 * PA.midi.devices() … つながっている機器の名前  PA.midi.held() … いまおさえている音（Set）  PA.midi.active() … 機器がある
 * PA.midi.onChange … つながりがかわったとき（⚙️ が書きなおす）。ページは PA.onMidiChange をおいてもよい
 * PA.midi.note(on, m, vel)・PA.midi.pedal(on)・PA.midi.setDevices(names) … 入力（native.js・Web MIDI・テストから）
 * PA.midi.CHORD_WAIT … 和音がそろったとみなす時間（さいごの鍵から ミリ秒） */
PA.midi=(()=>{
  const M={CHORD_WAIT:90};
  let nat=null, web=null, devs=[], timer=0, chordDone=false;
  const held=new Set();
  const changed=()=>{try{if(M.onChange) M.onChange();}catch(e){}try{if(PA.onMidiChange) PA.onMidiChange();}catch(e){}};
  const fire=()=>{
    timer=0; if(!held.size||chordDone) return;
    chordDone=true;
    const ms=[...held].sort((a,b)=>a-b);
    if(PA.onMidiChord){PA.midiIn=true;try{PA.onMidiChord(ms);}finally{PA.midiIn=false;}}
  };
  M.note=(on,m,vel)=>{
    m=Math.round(+m); if(!(m>=0&&m<=127)) return;
    if(on&&vel===0) on=false; // ベロシティ0のノートオン＝はなした
    if(!on){held.delete(m);if(!held.size) chordDone=false;PA.keyLight(m,false);return;}
    if(held.has(m)) return;
    held.add(m); chordDone=false; PA.keyLight(m,true);
    if(S.midiEcho) PA.playNote(m,0,1.4,Math.max(0.08,Math.min(0.3,(vel||64)/127*0.3)));
    if(PA.onMidiChord){clearTimeout(timer);timer=setTimeout(fire,M.CHORD_WAIT);return;}
    // PA.midiIn＝電子ピアノからの鍵（ページは、画面にない高さをけんばんの中へうつすのにつかう）
    if(PA.onKey){PA.midiIn=true;try{PA.onKey(m);}finally{PA.midiIn=false;}}
  };
  M.pedal=()=>{}; // いまはつかわない（おさえている音だけで和音をきめる）
  M.held=()=>new Set(held);
  // おさえていた鍵の画面のへこみも、もどしてからわすれる（機器がはずれたら、はなした知らせはもうこない）
  M.reset=()=>{held.forEach(m=>{try{PA.keyLight(m,false);}catch(e){}});held.clear();clearTimeout(timer);timer=0;chordDone=false;};
  M.devices=()=>devs.slice();
  M.active=()=>devs.length>0;
  M.setDevices=names=>{
    const next=(Array.isArray(names)?names:[]).filter(n=>typeof n==='string'&&n).map(n=>n.slice(0,60));
    if(next.join('\n')===devs.join('\n')) return;
    devs=next; M.reset(); changed(); // 機器がかわったら、おさえている音はわすれる（はずした機器のオフはもうこない）
  };
  M.native=()=>!!nat;
  M.useNative=o=>{nat=o||null;changed();};
  M.webAvailable=()=>!nat&&typeof navigator!=='undefined'&&typeof navigator.requestMIDIAccess==='function';
  M.available=()=>!!nat||M.webAvailable();
  M.canPair=()=>!!(nat&&nat.pair);
  M.pair=()=>nat&&nat.pair?Promise.resolve(nat.pair()).catch(()=>{}):Promise.resolve();
  const webList=()=>{const out=[];try{web.inputs.forEach(i=>{if(i.state!=='disconnected') out.push(i.name||'MIDI');});}catch(e){}return out;};
  const webHook=()=>{
    try{web.inputs.forEach(i=>{i.onmidimessage=ev=>{
      const d=ev.data; if(!d||d.length<2) return;
      const st=d[0]&0xf0;
      if(st===0x90) M.note(true,d[1],d[2]); else if(st===0x80) M.note(false,d[1],0);
      else if(st===0xb0&&d[1]===64) M.pedal(d[2]>=64);
    };});}catch(e){}
    M.setDevices(webList());
  };
  M.connect=()=>{
    if(nat) return Promise.resolve(nat.start()).then(()=>true,()=>false);
    if(web){webHook();return Promise.resolve(true);}
    if(!M.webAvailable()) return Promise.resolve(false);
    return navigator.requestMIDIAccess({sysex:false}).then(a=>{web=a;web.onstatechange=webHook;webHook();PA.store.set('midi-web',true);return true;},
      ()=>{PA.store.set('midi-web',false);return false;});
  };
  // ウェブで前につないだことがあるなら、ページをひらいたらつなぐ。ただしブラウザがもうゆるしているときだけ
  // （ゆるしがリセットされていると、さわってもいないのに「MIDI を使ってもいい？」が出てしまうので）
  if(typeof window!=='undefined'&&window.addEventListener) window.addEventListener('load',()=>{
    if(nat||!M.webAvailable()||!PA.store.get('midi-web',false)) return;
    const P=navigator.permissions; if(!P||!P.query) return; // わからないときは ⚙️ の「つなぐ」をまつ
    P.query({name:'midi',sysex:false}).then(s=>{
      if(s.state==='granted') M.connect();
      else if(s.state==='denied') PA.store.set('midi-web',false);
    },()=>{});
  });
  return M;
})();

/* ===== けんばん SVG =====
 * marks: Map midi -> {fill, label, tc(文字色), ring(わくの色), light(黒鍵をうすく), bubble(黒鍵ラベルのふきだしの色), sub(下の小さな字), subColor, focus(最初に見せたい鍵),
 *   sr(読み上げで鍵の名前のあとにつけることば。例 'えらんだ・まちがい' →「ミ、えらんだ・まちがい」)}
 * opts.mifa（ミファ・シドの目印。ふつうは表示）
 */
// 読み上げ用の鍵の名前（白鍵はそのまま、黒鍵は♯と♭の両方）
const WL=[0,null,1,null,2,3,null,4,null,5,null,6];
const keyLabel=m=>{
  const pc=mod(m,12), L=WL[pc];
  const n=L!=null?PA.nm({letter:L,acc:0}):PA.nm({letter:WL[pc-1],acc:1})+'／'+PA.nm({letter:WL[pc+1],acc:-1});
  return n+(m===60?'（まんなか）':'');
};
PA.kbSVG=(lo,hi,marks=new Map(),opts={})=>{
  const W=40,H=170,BW=25,BH=106,TOP=34, mifa=opts.mifa!==false;
  const wh=[];for(let m=lo;m<=hi;m++) if(!PA.BLACK.has(mod(m,12))) wh.push(m);
  const X={}; wh.forEach((m,i)=>X[m]=i*W);
  const TW=wh.length*W, TH=TOP+H+24;
  // キーボードでもひける：けんばん1つにつき Tab で1か所（←→ でとなりの鍵、Enter／スペースでひく）
  const drawn=[];for(let m=lo;m<=hi;m++) if(!PA.BLACK.has(mod(m,12))||X[m-1]!==undefined) drawn.push(m);
  let tabM=drawn.find(m=>{const k=marks.get(m);return k&&k.focus;});
  if(tabM===undefined) tabM=drawn.find(m=>marks.get(m));
  if(tabM===undefined) tabM=drawn.includes(60)?60:drawn[0];
  let s=`<svg viewBox="-2 0 ${TW+4} ${TH}" class="kb" style="min-width:${wh.length*36}px;max-width:${wh.length*56}px;margin-left:auto;margin-right:auto" role="group" aria-label="けんばん">`;
  const attrs=(m,mk)=>`data-m="${m}" ${mk?'data-mk="1"':''} ${mk&&mk.focus?'data-focus="1"':''} tabindex="${m===tabM?0:-1}" role="button" aria-label="${PA.esc(keyLabel(m)+(mk&&mk.sr?'、'+mk.sr:''))}"`;
  wh.forEach(m=>{
    const x=X[m], mk=marks.get(m);
    s+=`<rect ${attrs(m,mk)} class="key w${!mk||!mk.fill||/^#f(ff|fffff|4efe8)$/i.test(mk.fill)?' plain':''}" x="${x}" y="${TOP}" width="${W}" height="${H}" rx="5" fill="${mk&&mk.fill?mk.fill:'#fff'}" stroke="#8d8278" stroke-width="1.2"/>`;
    if(mk&&mk.ring) s+=`<rect x="${x+3}" y="${TOP+3}" width="${W-6}" height="${H-6}" rx="5" fill="none" stroke="${mk.ring}" stroke-width="4" pointer-events="none"/>`;
    if(mk&&mk.label) s+=`<text x="${x+W/2}" y="${TOP+H-40}" text-anchor="middle" font-size="${String(mk.label).length>3?12:15}" font-weight="800" fill="${mk.tc||'#fff'}">${PA.Svg(mk.label)}</text>`;
    if(mk&&mk.sub) s+=`<text x="${x+W/2}" y="${TOP+H+17}" text-anchor="middle" font-size="11" font-weight="700" fill="${mk.subColor||'#6f667a'}">${mk.sub}</text>`;
    else if(m===60) s+=`<text x="${m===lo?x+2:x+W/2}" y="${TOP+H+17}" text-anchor="${m===lo?'start':'middle'}" font-size="12" fill="#756c60">まんなかの${PA.nm({letter:0,acc:0})}</text>`;
  });
  if(mifa) wh.forEach(m=>{const pc=mod(m,12);if((pc===4||pc===11)&&X[m+1]!==undefined) s+=`<rect x="${X[m]+W-3}" y="${TOP+H-30}" width="6" height="24" rx="3" fill="#f4a100" pointer-events="none"/>`;});
  for(let m=lo;m<=hi;m++){
    if(!PA.BLACK.has(mod(m,12))||X[m-1]===undefined) continue;
    const x=X[m-1]+W-BW/2, mk=marks.get(m);
    s+=`<rect ${attrs(m,mk)} class="key b" x="${x}" y="${TOP}" width="${BW}" height="${BH}" rx="4" fill="${mk&&mk.fill?mk.fill:'#2b2630'}" stroke="#1e1a22" stroke-width="1"/>`;
    if(mk&&mk.light) s+=`<rect x="${x+3}" y="${TOP+3}" width="${BW-6}" height="${BH-6}" rx="3" fill="#fff" opacity=".45" pointer-events="none"/>`;
    if(mk&&mk.ring) s+=`<rect x="${x+2}" y="${TOP+2}" width="${BW-4}" height="${BH-4}" rx="4" fill="none" stroke="${mk.ring}" stroke-width="4" pointer-events="none"/>`;
    if(mk&&mk.label){
      const cx=x+BW/2, lc=mk.ring||mk.fill||'#3a3245';
      s+=`<line x1="${cx}" y1="27" x2="${cx}" y2="${TOP+4}" stroke="${lc}" stroke-width="2"/>`;
      s+=`<rect x="${cx-21}" y="3" width="42" height="24" rx="12" fill="${mk.bubble||mk.fill||'#fff'}" stroke="${lc}" stroke-width="2" pointer-events="none"/>`;
      s+=`<text x="${cx}" y="20" text-anchor="middle" font-size="${String(mk.label).length>3?10.5:13}" font-weight="800" fill="${mk.tc||'#fff'}">${PA.Svg(mk.label)}</text>`;
    }
    if(mk&&mk.sub) s+=`<text x="${x+BW/2}" y="${TOP+BH+14}" text-anchor="middle" font-size="11" font-weight="700" fill="${mk.subColor||'#6f667a'}">${mk.sub}</text>`;
  }
  return s+'</svg>';
};

/* ===== がくふ SVG ===== */
PA.stepOf=n=>n.letter+7*(Math.floor((n.midi-n.acc)/12)-1); // ド4＝28、ミ4＝30（ト音記号の第1線）
PA.accGlyph=(x,y,a,color='#3a3245')=>{
  if(a===1) return `<g stroke="${color}" fill="none"><line x1="${x-2}" x2="${x-2}" y1="${y-9}" y2="${y+8}" stroke-width="1.3"/><line x1="${x+2}" x2="${x+2}" y1="${y-8}" y2="${y+9}" stroke-width="1.3"/><line x1="${x-5}" x2="${x+5}" y1="${y-2}" y2="${y-4}" stroke-width="2.6"/><line x1="${x-5}" x2="${x+5}" y1="${y+4}" y2="${y+2}" stroke-width="2.6"/></g>`;
  if(a===-1) return `<g stroke="${color}" fill="none" stroke-width="1.5"><line x1="${x-3}" x2="${x-3}" y1="${y-13}" y2="${y+5}"/><path d="M${x-3} ${y+5} C${x+6} ${y} ${x+5} ${y-6} ${x-3} ${y-2}" stroke-width="2"/></g>`;
  if(a===0) return `<g stroke="${color}" fill="none"><line x1="${x-3}" x2="${x-3}" y1="${y-11}" y2="${y+4}" stroke-width="1.3"/><line x1="${x+3}" x2="${x+3}" y1="${y-4}" y2="${y+11}" stroke-width="1.3"/><line x1="${x-3}" x2="${x+3}" y1="${y-2}" y2="${y-4}" stroke-width="2.6"/><line x1="${x-3}" x2="${x+3}" y1="${y+4}" y2="${y+2}" stroke-width="2.6"/></g>`;
  if(a===2) return `<g stroke="${color}" stroke-width="2.6" stroke-linecap="round"><line x1="${x-4}" y1="${y-4}" x2="${x+4}" y2="${y+4}"/><line x1="${x-4}" y1="${y+4}" x2="${x+4}" y2="${y-4}"/></g>`;
  if(a===-2) return PA.accGlyph(x-4,y,-1,color)+PA.accGlyph(x+4,y,-1,color);
  return '';
};
// ト音記号（y0＝ソ4の線）／ヘ音記号（y0＝ファ3の線）。フォントに頼らない線画
// 全音符（先生の決め：和音の図は全音符）。まわりは横長でかたむけない、中の穴だけ左上へかたむける。
//   穴は evenodd でぬかない（透明）：線の上の音は、五線・加線が穴の中を通って見える
PA.wholeNote=(x,y,col,o={})=>{
  const a=o.rx||8, b=o.ry||5.3, ha=2.7, hb=4.3, t=-32*Math.PI/180, ct=Math.cos(t), st=Math.sin(t), f=v=>Math.round(v*100)/100;
  const ell=(rx,ry,deg,dx,dy)=>`M${f(x+dx)} ${f(y+dy)}A${rx} ${ry} ${deg} 1 0 ${f(x-dx)} ${f(y-dy)}A${rx} ${ry} ${deg} 1 0 ${f(x+dx)} ${f(y+dy)}Z`;
  return `<path d="${ell(a,b,0,a,0)}${ell(hb,ha,f(-32+90),-hb*st,hb*ct)}" fill="${col}" fill-rule="evenodd"/>`;
};
PA.gClef=(x,y0)=>`<g transform="translate(${x} ${y0})" fill="none" stroke="#3a3245" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3 C8 3 7 -5 13 -7 C21 -9 25 0 20 7 C14 14 2 10 2 0 C2 -10 12 -17 17 -27 C20 -34 19 -44 15 -44 C10 -44 8 -34 10 -24 L16 24 C17 31 11 33 8 29"/><circle cx="9.5" cy="27.5" r="3.2" fill="#3a3245" stroke="none"/></g>`;
PA.fClef=(x,y0)=>`<g transform="translate(${x} ${y0})"><circle cx="5" cy="0" r="4" fill="#3a3245"/><path d="M3 -2 C4 -10 14 -12 19 -7 C25 -1 22 10 14 17 C9 21 4 24 -1 26" fill="none" stroke="#3a3245" stroke-width="2.8" stroke-linecap="round"/><circle cx="27" cy="-5" r="2.2" fill="#3a3245"/><circle cx="27" cy="5" r="2.2" fill="#3a3245"/></g>`;
/* cols: [{notes:[...ト音記号], lh:[...ヘ音記号], color, ltColor(導音の色), accColor, accRing, label（文字か、PA.rn の部品）, sub(和音名の下の小さな字), labelColor, op, noAcc, carry:{文字:変化記号},
 *         hl(その列のうしろをぬる色), lhRing(ヘ音記号の音をかこむ色)}]
 * opts: {grand, colW, minW, arrows:[{c1,i1,c2,i2,color,text,dash,dy}], sigOverride:{letter,acc}, noSig, maxScale, autoCarry,
 *         measures:[{ci, n}]（小節：ci の列の前にたて線、上に小節の番号 n。さいごの右はしにもたて線）}
 * PA.staffGeom(key,ncols,o) → {nx（1つめの列の左はし）, cw（列のはば）, W（ぜんたいのはば）}。がくふの列の下に HTML をならべるとき（名曲で楽曲分析の「？」） 
 * autoCarry：ぜんぶの列を1つの小節とみて、前の臨時記号をもどす音に♮など（おなじ段・高さはきまりどおり、音名がおなじならねんのためも。c.carry はつかわない） */
// 調号のはばと列のはば（staffSVG とおなじ計算。列の下に HTML をならべるページはこれで位置をあわせる）
PA.staffGeom=(key,ncols,o={})=>{
  const sig=o.noSig?{letters:[]}:PA.sigInfo(key), ov=o.sigOverride;
  const ns=sig.letters.length+(ov&&sig.letters.indexOf(ov.letter)<0?1:0), cw=o.colW||70, nx=50+ns*10+(ns?24:14);
  return {nx,cw,W:Math.max(nx+ncols*cw+8,o.minW||0)};
};
const RNPX=16; // がくふの和音名の記号の数字の高さ（17px の太字よりすこし大きめ。2段の小さい数字も読めるように）
PA.staffSVG=(key,cols,o={})=>{
  const sig=o.noSig?{type:1,letters:[]}:PA.sigInfo(key), ov=o.sigOverride, grand=!!o.grand;
  const TSs=[38,35,39,36,33,37,34], TSf=[34,37,33,36,32,35,31];
  const TS=sig.type>0?TSs:TSf;
  const sigDraw=sig.letters.map((L,i)=>({L,st:TS[i],a:sig.type,red:false}));
  if(ov){
    const hit=sigDraw.find(d=>d.L===ov.letter);
    if(hit){hit.a=ov.acc;hit.red=true;}
    else sigDraw.push({L:ov.letter,st:TSs[PA.SHARP_ORDER.indexOf(ov.letter)],a:ov.acc,red:true});
  }
  const G=PA.staffGeom(key,cols.length,o), TB=grand?96:110, BT=TB+82, cw=G.cw, sx=50, nx=G.nx;
  const hasLabel=cols.some(c=>c.label);
  const ty=s=>TB-(s-30)*5, by=s=>BT-(s-26)*5;
  // いちばん低い音符の下に余白と和音名をおく（低いベースと名前が重ならないように）
  let lowY=grand?BT+40:TB;
  cols.forEach(c=>{
    (c.notes||[]).forEach(n=>{lowY=Math.max(lowY,ty(PA.stepOf(n)));});
    if(grand)(c.lh||[]).forEach(n=>{lowY=Math.max(lowY,by(PA.stepOf(n)));});
  });
  // 和音名：parts（オブジェクト）か、Ⅰ〜Ⅶ（＋7／9）だけの文字は藝大式の記号（PA.rn）で描く。2段の記号は上に高いので、名前を下げる
  const rnp=cols.map(c=>c.label?(typeof c.label==='object'?c.label:PA.rnOf(c.label)):null);
  const rise=Math.max(0,...rnp.map(p=>p?PA.rnRise(p,RNPX)-20:0));
  const baseH=grand?BT+48:TB+48, labelY=Math.max(baseH+16,lowY+30)+Math.ceil(rise);
  const hasSub=hasLabel&&cols.some(c=>c.sub); // c.sub＝和音名の下の小さな字（なければ前とおなじ図）
  const fdy=rnp.some(p=>p&&p.form)?7:0; // 記号の右下の7・9のぶん、下の小さな字とその下のあきをさげる
  const W=G.W, H=hasLabel?labelY+6+fdy+(hasSub?15:0):Math.max(baseH,lowY+16);
  // 読み上げ：role=img の子は読まれない（ARIA の Children Presentational）ので、和音名はここ（外の svg の aria-label）に入れる。
  //   中の記号・文字は aria-hidden。例「がくふ：Ⅰ。Ⅴ、7の和音、第2転回形。Ⅰ」
  const aria='がくふ'+(hasLabel?'：'+cols.filter(c=>c.label).map(c=>PA.rnA(c.label)+(c.sub?'（'+c.sub+'）':'')).join('。'):'');
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${PA.esc(aria)}" style="max-width:${Math.round(W*(o.maxScale||1.5))}px;margin:0 auto">`;
  // c.hl：列のうしろの色は、五線より先にぬる（五線が見えるように）。'none' でも rect は描く（あとで色だけかえるページのため）。
  //   c.hlAttr：その rect につける属性（piece.html の data-ev）
  cols.forEach((c,ci)=>{if(c.hl) svg+=`<rect data-hl="${ci}" ${c.hlAttr||''} x="${nx+ci*cw+3}" y="4" width="${cw-6}" height="${H-8}" rx="12" fill="${c.hl}"/>`;});
  // かわった調号のうしろの赤い丸も、五線より先に（線の上の記号か、間の記号かがわかるように）
  sigDraw.forEach((d,i)=>{if(d.red) svg+=`<circle cx="${sx+i*10}" cy="${ty(d.st)}" r="10" fill="#fde4e7"/>`;});
  for(let i=0;i<5;i++) svg+=`<line x1="6" x2="${W-4}" y1="${TB-i*10}" y2="${TB-i*10}" stroke="#6b6273" stroke-width="1.2"/>`;
  svg+=PA.gClef(10,TB-10);
  // 小節のたて線と番号（番号は上の線より上。音符より先に描く）
  if(o.measures&&o.measures.length){
    const y1=TB-40, y2=grand?BT+40:TB;
    o.measures.forEach(m=>{
      const x=nx+m.ci*cw;
      if(m.ci>0) svg+=`<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}" stroke="#6b6273" stroke-width="1.4"/>`;
      svg+=`<text x="${m.ci>0?x+3:x-2}" y="14" font-size="13" font-weight="700" fill="#5f5869">${PA.esc(m.n)}</text>`;
    });
    svg+=`<line x1="${W-4}" x2="${W-4}" y1="${y1}" y2="${y2}" stroke="#6b6273" stroke-width="1.4"/>`;
  }
  if(grand){
    for(let i=0;i<5;i++) svg+=`<line x1="6" x2="${W-4}" y1="${BT+i*10}" y2="${BT+i*10}" stroke="#6b6273" stroke-width="1.2"/>`;
    svg+=`<line x1="6" x2="6" y1="${TB-40}" y2="${BT+40}" stroke="#6b6273" stroke-width="2"/>`;
    svg+=PA.fClef(12,BT+10);
  }
  sigDraw.forEach((d,i)=>{
    svg+=PA.accGlyph(sx+i*10,ty(d.st),d.a,d.red?'#d1495b':'#3a3245');
    if(grand) svg+=PA.accGlyph(sx+i*10,by(d.st-14),d.a,d.red?'#d1495b':'#3a3245');
  });
  const pos=[];
  // autoCarry：列ごとに「その前までの臨時記号」をおぼえる。
  //   at＝おなじ段・おなじ高さ（きまり：この音にもどすならかならず書く）
  //   any＝音名だけ（べつの段・べつのオクターブでも、かわった音名にはねんのため書く。生徒がまよわないように）
  const auto=o.autoCarry?(()=>{
    const at={}, any={}, out=[];
    const put=(st,n)=>{const sa=o.noSig?0:(key.sig[n.letter]||0),k=st+PA.stepOf(n);
      if(n.acc!==sa||at[k]!==undefined) at[k]=n.acc;
      if(n.acc!==sa||any[n.letter]!==undefined) any[n.letter]=n.acc;};
    cols.forEach(c=>{out.push({at:{...at},any:{...any}});(c.notes||[]).forEach(n=>put('t',n));if(grand)(c.lh||[]).forEach(n=>put('b',n));});
    return out;
  })():null;
  const drawNotes=(ci,c,arr,yf,lo,hi)=>{
    const st=yf===ty?'t':'b', A=auto&&auto[ci];
    if(!arr||!arr.length) return '';
    const x=nx+ci*cw+cw/2;
    const P=arr.map((n,i)=>({n,i,s:PA.stepOf(n)})).sort((a,b)=>a.s-b.s);
    let ps=-99,po=false; P.forEach(p=>{p.off=(p.s-ps===1&&!po);po=p.off;ps=p.s;});
    const anyOff=P.some(p=>p.off), minS=P[0].s, maxS=P[P.length-1].s;
    let r='';
    for(let q=lo-2;q>=minS;q-=2) r+=`<line x1="${x-12}" x2="${x+12+(anyOff?16:0)}" y1="${yf(q)}" y2="${yf(q)}" stroke="#6b6273" stroke-width="1.4"/>`;
    for(let q=hi+2;q<=maxS;q+=2) r+=`<line x1="${x-12}" x2="${x+12+(anyOff?16:0)}" y1="${yf(q)}" y2="${yf(q)}" stroke="#6b6273" stroke-width="1.4"/>`;
    const accCols=[];
    [...P].reverse().forEach(p=>{
      const sigAcc=o.noSig?0:(key.sig[p.n.letter]||0);
      const was=A?[A.at[st+p.s],A.any[p.n.letter]]:[c.carry&&c.carry[p.n.letter]];
      const need=(p.n.acc!==sigAcc)||was.some(w=>w!==undefined&&w!==p.n.acc);
      const hx=x+(p.off?16:0), hy=yf(p.s);
      if(need&&!c.noAcc){
        let k=0; while(accCols.some(q=>q.k===k&&Math.abs(q.s-p.s)<6)) k++;
        accCols.push({k,s:p.s});
        const ac=p.n.raised?(c.accColor||'#d1495b'):(c.color||'#3a3245');
        r+=PA.accGlyph(x-18-k*11,hy,p.n.acc,ac);
        if(p.n.raised&&c.accRing) r+=`<circle cx="${x-18-k*11}" cy="${hy}" r="11" fill="none" stroke="${ac}" stroke-width="2" opacity=".6"/>`;
      }
      const col=p.n.raised&&c.ltColor?c.ltColor:(c.color||'#3a3245');
      // 全音符。穴はぬらない：線の上の音は、五線・加線が穴の中を通って見える（白でぬると間の音に見える）
      r+=PA.wholeNote(hx,hy,col);
      if(yf===by&&c.lhRing) r+=`<circle cx="${hx}" cy="${hy}" r="12" fill="none" stroke="${c.lhRing}" stroke-width="2.5"/>`;
      if(yf===ty){pos[ci]=pos[ci]||[];pos[ci][p.i]={x:hx,y:hy};}
    });
    return r;
  };
  cols.forEach((c,ci)=>{
    const x=nx+ci*cw+cw/2;
    svg+=`<g data-col="${ci}" opacity="${c.op==null?1:c.op}">`+drawNotes(ci,c,c.notes,ty,30,38)+(grand?drawNotes(ci,c,c.lh,by,18,26):'');
    if(rnp[ci]) svg+=PA.rnSvgAt(rnp[ci],x,labelY,RNPX,`color="${c.labelColor||'#3a3245'}" aria-hidden="true"`);
    else if(c.label) svg+=`<text aria-hidden="true" x="${x}" y="${labelY}" text-anchor="middle" font-size="17" font-weight="800" fill="${c.labelColor||'#3a3245'}">${PA.Svg(c.label)}</text>`;
    if(c.label&&c.sub) svg+=`<text aria-hidden="true" x="${x}" y="${labelY+15+fdy}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${c.labelColor||'#3a3245'}">${PA.Svg(c.sub)}</text>`;
    svg+=`</g>`;
  });
  (o.arrows||[]).forEach(a=>{
    const p=pos[a.c1]&&pos[a.c1][a.i1], q=pos[a.c2]&&pos[a.c2][a.i2]; if(!p||!q) return;
    svg+=`<path d="M${p.x+12} ${p.y} L${q.x-22} ${q.y}" stroke="${a.color}" stroke-width="2.2" fill="none" stroke-dasharray="${a.dash||''}" marker-end="url(#ar-${a.color.slice(1)})"/>`;
    if(a.text) svg+=`<text x="${q.x+14}" y="${q.y+5+(a.dy||0)}" font-size="14" font-weight="800" fill="${a.color}">${a.text}</text>`;
  });
  const cs=[...new Set((o.arrows||[]).map(a=>a.color))];
  if(cs.length) svg+=`<defs>${cs.map(c=>`<marker id="ar-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${c}"/></marker>`).join('')}</defs>`;
  return svg+'</svg>';
};

/* ===== 和音記号（藝大式）：PA.rn =====
 * 先生の決め（docs/TEACHER-FEEDBACK.md 2026-10-31）：アプリ全体を藝大式（島岡『和声 理論と実習』の書きかた）にそろえる。
 * 記号は文字から作らず、かならず部品（parts）から描く：
 *   {deg:1〜7（Ⅰ〜Ⅶ）, form:7|9（右下の小さい数字）, inv:1〜3（右上の小さい数字＝転回形。根音省略の和音は、はぶいた根音を入れて数える）,
 *    omit:true（根音省略＝斜線。大きい数字だけにかける）, borrowed:true（準固有＝前に小さい○）,
 *    of:1〜7（2段の上の小さい数字。「ⅤのⅤ」の上のⅤ。下の大きい数字が和音そのもので、7・9・転回・斜線・変位の印はぜんぶ下につける）,
 *    ofDown:true（上の小さい数字の根音下方変位。ナポリの調＝下げたⅡ度調）,
 *    alt5:'down'（第5音下方変位：下の大きい数字の、上の横棒の左はしに左むきのチョン。先生の写真のとおり）,
 *    rootDown:true（根音下方変位：ナポリの和音。印の形は先生に確認まち。いまは下の横棒の左はしにチョン）,
 *    alt3:'up'（第3音上方変位：ドリアのⅣ。島岡『和声 理論と実習』の書きかたを文字にすると「＋Ⅳ」。
 *      いまは大きい数字の左、たての まん中（根音＝下・第3音＝まん中・第5音＝上 のならび）に小さい「＋」。印の形・場所は先生に確認まち。
 *      かえるときは layout の「第3音上方変位」の1か所だけをなおす）,
 *    natural:true（短調のⅢ・Ⅶ＝自然的短音階の長三和音。記号のあとに「（自然）」）, name:'it6'|'fr6'|'ger6'|'n6'（読み上げで名前をそえるとき）}
 * PA.rn(parts,{key, name}) → HTML（<span class="rnum" role="img" aria-label="…"><svg>…</svg></span>）。字の大きさにあわせてのびちぢみする（em）。色は currentColor
 * PA.rnText(parts) → ただの文字（Ⅴ₇²（第5音下方変位・根音省略）など。title・きろく用）
 * PA.rnAria(parts) → 読み上げのことば（「ⅤのⅤ、7の和音、第2転回形、第5音下方変位、根音省略」）
 * PA.rnKey(key) → 調のしるし（C: c: Es: fis: …。大文字＝長調、小文字＝短調。ドイツ語の音名）
 * PA.rnSvgAt(parts,cx,baseY,px,attrs) → SVG の中にそのまま入れる（がくふの和音名。baseY＝数字の下のはし、px＝数字の高さ）
 * PA.staffSVG の列の label に parts（オブジェクト）をわたすと、この記号で描く。
 *   文字の label でも「Ⅰ〜Ⅶ」だけか「Ⅴ7・Ⅴ9」のような1文字＋7／9だけのときは、この記号（右下の小さい数字）で描く。
 * 副属和音（Ⅱ度調のⅤ7 など）は「ⅤのⅤ」とおなじ2段で書く（上の小さい数字＝何度調か、下の大きい数字＝その調での和音）。
 *   ネットでは藝大式の副属和音の記号の決まった説明が見つからなかった（2026-11-01 しらべ）。ⅤのⅤの書きかた（先生の写真）にそろえた。先生に確認まち。 */
PA.RN=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ'];
(function(){
  const CELLS=['I','II','III','IV','V','VI','VII'], SUP=['','¹','²','³'], SUB={7:'₇',9:'₉'};
  const r2=v=>Math.round(v*100)/100;
  const okDeg=d=>Number.isInteger(d)&&d>=1&&d<=7;
  // 部品をたしかめる（へんな値は描かない）
  const norm=p=>{
    p=p||{};
    const q={deg:okDeg(p.deg)?p.deg:1};
    if(p.form===7||p.form===9) q.form=p.form;
    if(Number.isInteger(p.inv)&&p.inv>=1&&p.inv<=3) q.inv=p.inv;
    if(p.omit) q.omit=true;
    if(p.borrowed) q.borrowed=true;
    if(okDeg(p.of)) q.of=p.of;
    if(q.of&&p.ofDown) q.ofDown=true;
    if(p.alt5==='down') q.alt5='down';
    if(p.rootDown) q.rootDown=true;
    if(p.alt3==='up') q.alt3='up';
    if(p.natural) q.natural=true;
    if(p.name) q.name=String(p.name);
    return q;
  };
  // ローマ数字を線で描く（高さ20）。たて棒（Ⅰ）は上下の横棒つき（Ⅱ・Ⅲはつながった横棒）、Ⅴは2本の腕の上に小さい横棒。x,y＝左上
  //   「上の横棒の左はし」＝いちばん左の上の横棒の左はし（x＝-1.2）。第5音下方変位のチョンはここにつける
  const glyph=(deg,x,y,s)=>{
    let cx=0; const stem=[], diag=[], runs=[], ser=[];
    CELLS[deg-1].split('').forEach(c=>{
      if(c==='I'){stem.push(`M${r2(cx+3.25)} 0V20`);const L=runs[runs.length-1];if(L&&L[1]===cx)L[1]=cx+6.5;else runs.push([cx,cx+6.5]);cx+=6.5;}
      else{diag.push(`M${r2(cx+1.6)} 0L${r2(cx+7.5)} 20L${r2(cx+13.4)} 0`);ser.push([cx-.6,cx+4.4],[cx+10.8,cx+15.2]);cx+=15;}
    });
    const bars=runs.map(([a,b])=>`M${r2(a-.6)} 0H${r2(b+.6)}M${r2(a-.6)} 20H${r2(b+.6)}`).join('')+ser.map(([a,b])=>`M${r2(a)} 0H${r2(b)}`).join('');
    const svg=`<g transform="translate(${r2(x)} ${r2(y)})${s!==1?` scale(${s})`:''}" fill="none" stroke="currentColor">${stem.length?`<path d="${stem.join('')}" stroke-width="2.7"/>`:''}${diag.length?`<path d="${diag.join('')}" stroke-width="2.5" stroke-linejoin="round"/>`:''}<path d="${bars}" stroke-width="1.9"/></g>`;
    return {w:cx*s,h:20*s,svg};
  };
  // 部品 → {svg（中身）, W, y0（上のはし）, H, base（大きい数字の下のはし）}
  const layout=p=>{
    const SM=.66, top=p.of?Math.round(20*SM+3.5):0, big=glyph(p.deg,0,0,1); // SM＝2段の上の小さい数字の大きさ
    let x=0, s='';
    if(p.borrowed){s+=`<circle cx="3.4" cy="${top+3.6}" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/>`;x+=8;}
    if(p.alt5||p.rootDown) x+=6.5;
    if(p.alt3) x=Math.max(x,(p.borrowed?8:0)+10); // 左の「＋」のぶん
    const W0=big.w, sw=p.of?glyph(p.of,0,0,SM).w:0;
    x=Math.max(x,(sw-W0)/2+1); // 上の小さい数字が下の数字より広いとき（Ⅶ など）も左がきれないように
    if(p.of&&p.ofDown) x=Math.max(x,(sw-W0)/2+5); // 上の小さい数字のチョン（左へ4）も左がきれないように
    const gx=x;
    if(p.of){
      const sx=gx+W0/2-sw/2;
      s+=glyph(p.of,sx,0,SM).svg;
      // 上の小さい数字の根音下方変位：下の横棒の左はしから左へ、ちょっと下がる（alt5・rootDown とおなじ向き）
      if(p.ofDown) s+=`<path d="M${r2(sx-.5)} ${r2(20*SM)}L${r2(sx-4)} ${r2(20*SM+1.2)}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    s+=glyph(p.deg,gx,top,1).svg;
    // 第5音下方変位：上の横棒の左はしから左へ、ちょっと下がる「チョン」
    if(p.alt5==='down') s+=`<path class="rn-alt5" d="M${r2(gx-1.2)} ${top+.3}L${r2(gx-6.2)} ${top+2.2}" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`;
    // 根音下方変位：下の横棒の左はしから左へ、ちょっと下がる（alt5 とおなじ「下方変位」の向き。形は先生に確認まち）
    if(p.rootDown) s+=`<path class="rn-root" d="M${r2(gx-1.2)} ${top+19.7}L${r2(gx-6.2)} ${top+21.6}" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`;
    // 第3音上方変位（ドリアのⅣ）：大きい数字の左、たてのまん中に小さい「＋」（先生に確認まち。ここだけで描く）
    if(p.alt3==='up') s+=`<path class="rn-alt3" d="M${r2(gx-9)} ${top+10}H${r2(gx-2.4)}M${r2(gx-5.7)} ${top+6.7}V${top+13.3}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>`;
    // 根音省略：大きい数字だけにかける斜線
    if(p.omit) s+=`<path class="rn-omit" d="M${r2(gx-2.5)} ${top+23}L${r2(gx+W0+2.5)} ${top-3}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`;
    let W=gx+W0+1;
    const dx=gx+W0+2.4;
    if(p.inv||p.form){
      const t=(y,v,c)=>`<text class="${c}" x="${r2(dx)}" y="${y}" font-size="14" font-weight="700" fill="currentColor" stroke="none" font-family="Arial,Helvetica,sans-serif">${v}</text>`;
      if(p.inv) s+=t(top+10,p.inv,'rn-inv');
      if(p.form) s+=t(top+27.5,p.form,'rn-form');
      W=dx+8.5;
    }
    W=Math.max(W,gx+W0/2+sw/2+1);
    const y0=p.of?-1:-4;
    return {svg:s,W:r2(W),y0,H:top+29-y0,base:top+20};
  };
  PA.rnKey=key=>{
    if(!key) return '';
    const L=['C','D','E','F','G','A','H'][key.l], a=key.a||0;
    let n=L;
    if(a===1) n=L+'is';
    else if(a===-1) n=L==='H'?'B':L==='E'?'Es':L==='A'?'As':L+'es';
    return (key.minor?n.toLowerCase():n)+':';
  };
  const base=p=>(p.of?(p.ofDown?'（下げた）':'')+PA.RN[p.of-1]+'の':'')+PA.RN[p.deg-1];
  PA.rnText=p=>{
    p=norm(p);
    const fl=[p.rootDown&&'根音下方変位',p.alt3&&'第3音上方変位',p.alt5&&'第5音下方変位',p.omit&&'根音省略'].filter(Boolean);
    return (p.borrowed?'○':'')+base(p)+(p.form?SUB[p.form]:'')+(p.inv?SUP[p.inv]:'')+(p.natural?'（自然）':'')+(fl.length?'（'+fl.join('・')+'）':'');
  };
  PA.rnAria=p=>{
    p=norm(p);
    return [(p.borrowed?'準固有の':'')+base(p)+(p.natural?'（自然）':''),p.form&&p.form+'の和音',p.inv&&'第'+p.inv+'転回形',
      p.rootDown&&'根音下方変位',p.alt3&&'第3音上方変位',p.alt5&&'第5音下方変位',p.omit&&'根音省略'].filter(Boolean).join('、');
  };
  const EM=22; // 22 単位＝1em（数字の高さ20＝0.9em。2段の小さい数字も読めるように、まわりの字より少し大きめ）
  PA.rnSvg=p=>{
    p=norm(p); const L=layout(p);
    return `<svg class="rnum-svg" viewBox="0 ${L.y0} ${L.W} ${L.H}" style="width:${r2(L.W/EM)}em;height:${r2(L.H/EM)}em;vertical-align:${r2(-(L.y0+L.H-L.base)/EM)}em" aria-hidden="true" focusable="false">${L.svg}</svg>`;
  };
  PA.rn=(p,o={})=>{
    p=norm(p);
    const k=o.key?PA.rnKey(o.key):'', nm=o.name||'';
    const aria=(o.key?PA.keyName(o.key)+'、':'')+(nm?nm+'、':'')+PA.rnAria(p);
    return `<span class="rnum" role="img" aria-label="${PA.esc(aria)}">${k?`<span class="rnum-k">${k}</span>`:''}${PA.rnSvg(p)}${p.natural?'<span class="rnum-nat">（自然）</span>':''}</span>`;
  };
  // SVG の中に置く（cx＝まんなか、baseY＝大きい数字の下のはし、px＝大きい数字の高さ）
  PA.rnSvgAt=(p,cx,baseY,px,attrs='')=>{
    p=norm(p); const L=layout(p), f=px/20, w=L.W*f, h=L.H*f;
    return `<svg x="${r2(cx-w/2)}" y="${r2(baseY-(L.base-L.y0)*f)}" width="${r2(w)}" height="${r2(h)}" viewBox="0 ${L.y0} ${L.W} ${L.H}" overflow="visible" ${attrs}>${L.svg}</svg>`;
  };
  // 大きい数字の上にどれだけ出るか（数字の高さ px のとき）。2段や右上の数字のぶん、がくふの名前を下げる
  PA.rnRise=(p,px)=>{p=norm(p);const L=layout(p);return (L.base-L.y0)*px/20;};
  // 文字の label のうち、Ⅰ〜Ⅶ・Ⅰ〜Ⅶ＋7／9 だけは記号の部品にする（それ以外の文字は null＝文字のまま描く）
  PA.rnOf=s=>{
    const m=/^([ⅠⅡⅢⅣⅤⅥⅦ])([79])?$/.exec(String(s==null?'':s));
    return m?{deg:PA.RN.indexOf(m[1])+1,...(m[2]?{form:+m[2]}:{})}:null;
  };
  PA.rnNorm=norm;
  // 和音名（文字か部品）→ HTML。部品と「Ⅴ7」のような文字は記号、ほかの文字（ドイツ・？など）はそのまま
  PA.rnH=l=>{if(l&&typeof l==='object') return PA.rn(l);const p=PA.rnOf(l);return p?PA.rn(p):PA.H(String(l==null?'':l));};
  // 和音名（文字か部品）→ 読み上げ・title 用のことば
  PA.rnA=l=>{if(l&&typeof l==='object') return PA.rnAria(l);const p=PA.rnOf(l);return p?PA.rnAria(p):String(l==null?'':l);};
  // 「記号のみかた」：記号をつかうページの下におく、とじた説明
  PA.rnHelp=(o={})=>{
    const ex=(p,t)=>`<li><span class="rnh-ex">${PA.rn(p)}</span><span>${t}</span></li>`;
    return `<details class="more rnhelp" data-d="rnhelp"${o.open?' open':''}><summary><span aria-hidden="true">🔤</span> 記号のみかた</summary>
      <p class="note" style="margin-top:0">和音の記号は、音楽大学（藝大）でつかう書きかたにそろえているよ。大きい数字が、何ばんめの音の上の和音か。</p>
      <ul class="rnh">
        ${ex({deg:1,inv:2},'<b>右上の小さい数字</b>＝転回形。1は第1転回形、2は第2転回形、3は第3転回形。数字がなければ基本形')}
        ${ex({deg:5,form:7},'<b>右下の小さい数字</b>＝7の和音・9の和音（Ⅴ7・Ⅴ9）')}
        ${ex({deg:5,form:9,omit:true,inv:1},'<b>ななめの線</b>＝根音省略（和音のもとになる音＝根音を、はぶいた形）。右上の数字は、はぶいた根音もあるつもりで数えるよ（いちばん下が第3音なら1）')}
        ${ex({deg:4,borrowed:true},'<b>前の小さい○</b>＝準固有和音（同じ主音の短調からかりた和音）')}
        ${ex({of:5,deg:5,form:7},'<b>2だん</b>＝ⅤのⅤ。上の小さい数字の調（Ⅴの調）で、下の大きい数字の和音。7などの数字や線は、下の大きい数字につける')}
        ${ex({of:5,deg:5,form:7,inv:2,alt5:'down'},'<b>左上のチョン</b>＝第5音下方変位（和音の第5音を半音下げた）。大きい数字の上の横棒の左はしにつける')}
        ${o.alt3?ex({deg:4,alt3:'up'},'<b>左の＋</b>＝第3音上方変位（和音の第3音を半音上げた）。ドリアのⅣで使うよ'):''}
      </ul>
      <p class="note">記号の前の <b>C:</b> や <b>c:</b> は調。大文字は長調、小文字は短調（C:＝ハ長調、c:＝ハ短調）。調はドイツ語の音名で書くよ（H:＝ロ長調、Es:＝変ホ長調、fis:＝嬰ヘ短調、B:＝変ロ長調）。</p></details>`;
  };
})();

/* ===== アプリの目次（ホーム・もどる・つぎへのリンク） ===== */
// c＝目じるしの色、l＝うすい色、dk＝白い字をのせても読めるこい色（4.5:1いじょう）
PA.APP_TYPES={
  learn:{label:'しくみ',c:'#3b4fa8',l:'#e6eafb',dk:'#3b4fa8'},
  quiz:{label:'クイズ',c:'#e8553d',l:'#fde5df',dk:'#c0392b'},
  play:{label:'れんしゅう',c:'#22a06b',l:'#daf3e6',dk:'#15804f'},
  ref:{label:'いちらん',c:'#8a4fe0',l:'#ece2fb',dk:'#7a3fd0'},
  ear:{label:'耳',c:'#c98500',l:'#fff1cc',dk:'#8a5a00'}
};
PA.UNITS=[
  // 基本の地図（①〜⑥）。①②③がいちばん手厚くする「基本」（先生のじゅん：docs/TEACHER-FEEDBACK.md）
  {id:'major',kind:'basic',title:'🎹 長調のⅠ・Ⅳ・Ⅴ・Ⅴ7',sub:'いちばん大事な4つの和音。まずはここから',tasks:[
    {app:'chord-build'},{app:'chord-quiz',href:'chord-quiz.html?keyset=major',title:'和音クイズ（長調）'},{app:'cadence'},{app:'chord-table'}]},
  {id:'minor',kind:'basic',title:'🌙 短調のⅠ・Ⅳ・Ⅴ・Ⅴ7',sub:'7ばんめを上げるので、Ⅴ・Ⅴ7にはかならず臨時記号',tasks:[
    {app:'minor-why'},{app:'minor-signature'},{app:'chord-quiz',href:'chord-quiz.html?keyset=minor',title:'和音クイズ（短調）'}]},
  {id:'minor9',kind:'basic',title:'🏠 短調のⅤ9と減七',sub:'短調では、Ⅴ9の根音を省略（はぶく）すると減七',tasks:[{app:'minor-family'},{app:'dim-halfdim'},{app:'minor-quiz'}]},
  {id:'more',kind:'basic',title:'🧩 和音をもっと知ろう',sub:'7つの和音・和音のかたち・音のへだたり',tasks:[{app:'diatonic'},{app:'inversion'},{app:'interval'}]},
  {id:'ending',kind:'basic',title:'🏁 おわりかた',sub:'曲のおわりの6つの形',tasks:[{app:'ending'},{app:'ending-quiz'}]},
  {id:'accomp',kind:'basic',title:'🎼 曲につけてみよう',sub:'知っている曲のメロディーに和音をつける',tasks:[{app:'accompaniment'}]},
  // 毎日たのしむところ（学ぶじゅんとはべつ。いつでもあそべる）
  {id:'ear',kind:'daily',title:'👂 耳のひろば',sub:'毎日すこしずつ。聴いてパッとわかる',tasks:[{app:'ear'},{app:'progression'}]},
  // 名曲で楽曲分析（先生の案：コンクールでひくような曲の和音を穴うめ。docs/REPERTOIRE-ANALYSIS.md）。基本の地図のあと、レベルアップの前
  //   曲は piece.html?id=…（データは assets/pieces/<id>.json）。soon＝これから足す曲のメモ（1行。まだリンクにしない）
  //   きまっているつぎの曲：ベートーヴェン Op.2-1（ヘ短調）・シューベルト（曲はこれから）・ショパン Op.10-8（ヘ長調）・ショパン スケルツォ第2番（いちばん最後）
  {id:'pieces',kind:'pieces',title:'🎼 名曲で楽曲分析',sub:'本物の曲の和音を、記号で穴うめ',tasks:[
    {app:'piece',href:'piece.html?id=k545-1',title:'モーツァルトのソナタ K.545 第1楽章'}],
   soon:'これから、ベートーヴェン・シューベルト・ショパンの曲もふえるよ'},
  // レベルアップしたい人へ（変化和音。先生のじゅん：準固有和音がナポリの六よりさき、異名同音の読みかえはいちばん最後）
  //   ドリアのⅣ（2026-11-01 先生が「入れてほしい」）は、準固有和音のあと・ナポリの六のまえ（短調の6ばんめの話をつづけて。島岡『和声 理論と実習』Ⅱも Ⅳ7・＋Ⅳ7 → ナポリのじゅん）
  {id:'extra',kind:'extra',title:'🌈 レベルアップしたい人へ',sub:'変化和音：調の音を半音動かす・よその調からかりる',tasks:[
    {app:'doppel'},{app:'secondary'},{app:'borrowed'},{app:'dorian'},{app:'neapolitan'},{app:'aug6'},{app:'enharmonic'},{app:'chroma-quiz'}]}
];
// ステップのあるクイズ：長調・短調のステップの数と、✓ になる数（5もん中）。ホームの★★★（ステップがぜんぶ ✓）でつかう。
//   chord-quiz.html の STEPS・STEP_PASS とおなじ数にする（test/chord-quiz-cats.test.mjs でたしかめる）
PA.STEP_INFO={'chord-quiz':{major:13,minor:15,pass:4}};
PA.APPS=[
  {id:'chord-build',ic:'🐸',title:'和音のしくみ',d:'音階のなんばんめから「ひとつとばし」で和音をつくる',type:'learn',practice:'chord-quiz'},
  {id:'chord-quiz',ic:'🎯',title:'和音クイズ',d:'Ⅰ・Ⅳ・Ⅴ・Ⅴ7を、いろいろな問題で。やさしいじゅんのステップつき',type:'quiz'},
  {id:'cadence',ic:'🎵',title:'カデンツ',d:'「おしまい」になる和音のならび（Ⅰ→Ⅳ→Ⅰ→Ⅴ7→Ⅰ）を聴いて、伴奏の形を見る',type:'play',practice:'chord-quiz'},
  {id:'chord-table',ic:'📋',title:'和音いちらん表',d:'ぜんぶの調のⅠ・Ⅳ・Ⅴ・Ⅴ7。かくして、れんしゅうもできる',type:'ref',practice:'chord-quiz'},
  {id:'accompaniment',ic:'🎼',title:'伴奏づけ',d:'知っている曲のメロディーにⅠ・Ⅳ・Ⅴ7をつける',type:'play'},
  {id:'diatonic',ic:'🎨',title:'7つの和音',d:'音階の7つの音から1つずつ。Ⅱ・Ⅲ・Ⅵ・Ⅶもなかまいり',type:'learn'},
  {id:'inversion',ic:'🔄',title:'和音のかたち',d:'ドミソ・ミソド・ソドミ。いちばん下の音で名前がかわる',type:'learn'},
  {id:'interval',ic:'📏',title:'音のへだたり',d:'ドからミは3度。文字をかぞえて、広い・せまいを知る',type:'learn'},
  {id:'minor-why',ic:'❓',title:'なぜ7ばんめを上げるの？',d:'長調と短調の「7ばんめ→主音」をくらべて聴く',type:'learn',practice:'minor-quiz'},
  {id:'minor-signature',ic:'♮',title:'調号と臨時記号',d:'調号に書けないわけ。♯・♮・<span class="ds">x</span>のいちらん',type:'learn',practice:'minor-quiz'},
  {id:'minor-family',ic:'🏠',title:'Ⅴの家族',d:'短調のⅤ→Ⅴ7→Ⅴ9→減七と、Ⅰへのすすみかた',type:'learn',practice:'minor-quiz'},
  {id:'dim-halfdim',ic:'⚖️',title:'Ⅴ9の根音省略',d:'短調では減七になる。長調ではならない。ちがうのは第9音だけ',type:'learn',practice:'minor-quiz'},
  {id:'minor-quiz',ic:'🎯',title:'短調クイズ',d:'短調のⅤの家族をおさえる／臨時記号を選ぶ',type:'quiz'},
  {id:'ending',ic:'🏁',title:'おわりかた',d:'完全終止・半終止・偽終止など6つのおわりかたを、聴いて・がくふで見る',type:'learn',practice:'ending-quiz'},
  {id:'ending-quiz',ic:'🎯',title:'おわりかたクイズ',d:'4つの和音を聴いて／がくふを見て、おわりかたの名前を当てる',type:'quiz'},
  {id:'doppel',ic:'🔺',title:'Ⅱ7とドッペルドミナント',d:'Ⅱ7の第3音を上げると「ⅤのためのⅤ7」になる',type:'learn',practice:'chroma-quiz'},
  {id:'secondary',ic:'🧭',title:'副属和音',d:'Ⅱ・Ⅲ・Ⅳ・Ⅵを、いっときⅠにみたてる「その和音のためのⅤ7」',type:'learn',practice:'chroma-quiz'},
  {id:'borrowed',ic:'🎁',title:'準固有和音（借用和音）',d:'長調で、同じ主音の短調からかりる○Ⅳ・○Ⅵなど',type:'learn',practice:'chroma-quiz'},
  {id:'dorian',ic:'🌗',title:'ドリアのⅣ',d:'短調のⅣの第3音（6ばんめ）を半音上げた、明るいⅣ。導音へなめらかに上がる',type:'learn',practice:'chroma-quiz'},
  {id:'neapolitan',ic:'🌋',title:'ナポリの六',d:'2ばんめを半音下げたナポリの和音。いちばん下の音とⅤへのすすみかた',type:'learn',practice:'chroma-quiz'},
  {id:'aug6',ic:'↔️',title:'増六の和音',d:'イタリア・フランス・ドイツの6。外へひらいてⅤへ',type:'learn',practice:'chroma-quiz'},
  {id:'enharmonic',ic:'🔀',title:'異名同音の読みかえ',d:'同じけんばんでも、書き方とすすむ先で役わりがかわる',type:'learn',practice:'chroma-quiz'},
  {id:'chroma-quiz',ic:'🎯',title:'変化和音クイズ',d:'Ⅱ7・ドッペルから順に、けんばんでおさえる／耳で聴きわける',type:'quiz'},
  {id:'piece',ic:'🎼',title:'名曲で楽曲分析',d:'本物の曲の和音を、記号で穴うめ。じぶんの楽譜もひらいて、いっしょに見よう',type:'quiz'},
  {id:'ear',ic:'👂',title:'和音の聴きわけ',d:'10しゅるいの和音を音で当てる。8レベルとチャレンジ',type:'ear'},
  {id:'progression',ic:'🧩',title:'ならびの聴きわけ',d:'Ⅰ→Ⅳ→Ⅴ7→Ⅰ などのならびを聴いて、「？」の和音を当てる。おちつく・もどりたい感じ、いちばん下と上の音の動きも',type:'ear'}
];
PA.app=id=>PA.APPS.find(a=>a.id===id)||null;
// 課題：href・title がなければアプリのページと名前。u.apps＝課題のアプリの id（おなじものは1つ）。
// a.unit＝そのアプリがさいしょに出てくる単元（1つのアプリに1つ。和音クイズは①）
PA.UNITS.forEach(u=>{
  u.tasks=u.tasks.filter(t=>PA.app(t.app)).map(t=>{const a=PA.app(t.app);return {app:a.id,href:t.href||a.href||a.id+'.html',title:t.title||a.title};});
  u.apps=u.tasks.map(t=>t.app).filter((id,i,arr)=>arr.indexOf(id)===i);
  u.apps.forEach(id=>{const a=PA.app(id);if(!a.unit) a.unit=u.id;});
});
PA.unit=id=>PA.UNITS.find(u=>u.id===id)||null;

/* ===== 画面のしくみ ===== */
PA.seg=(act,opts,cur,cls='')=>`<div class="seg ${cls}" role="group">`+opts.map(([v,l])=>`<button class="${String(v)===String(cur)?'on':''}" data-act="${act}" data-v="${v}" aria-pressed="${String(v)===String(cur)}">${l}</button>`).join('')+`</div>`;
PA.keyChip=key=>`<button class="keychip" data-pa="keysheet" aria-haspopup="dialog">${PA.keyName(key)}<small>${PA.sigLabel(key)}</small></button>`;
let sheetEl=null, sheetPrev=null;
// とじているとちゅう（すっと下がっているあいだ）は、もうとじたことにする（ためしの音などを鳴らさない）
const isOpen=el=>!!el&&!el.paClosing&&(el.open===true||(!!el.hasAttribute&&el.hasAttribute('open')));
let sheetSeq=0;
function sheet(html){
  sheetSeq++;
  if(!sheetEl){
    sheetEl=document.createElement('dialog');sheetEl.className='sheet';
    // <dialog>がない古いブラウザ（iOS 15.3までなど）：open の印だけで出し入れする（.pa-fb＝画面いっぱいのうすい幕）
    if(typeof sheetEl.showModal!=='function'){
      sheetEl.classList.add('pa-fb'); sheetEl.setAttribute('role','dialog'); sheetEl.setAttribute('aria-modal','true');
      sheetEl.close=function(){
        this.removeAttribute('open');
        if(sheetPrev&&document.contains(sheetPrev)&&sheetPrev.focus) sheetPrev.focus({preventScroll:true});
        sheetPrev=null;
      };
      sheetEl.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Esc'){e.preventDefault();sheetEl.close();}});
    }
    document.body.appendChild(sheetEl);
    sheetEl.addEventListener('click',e=>{if(e.target===sheetEl) sheetEl.close();});
    animateClose(sheetEl);
  }
  if(sheetEl.paCancelClose) sheetEl.paCancelClose(); // とじているとちゅうにまたひらく：とじるのをやめる
  sheetEl.innerHTML=`<div class="sheet-in">${html}</div>`;
  if(!isOpen(sheetEl)){
    if(!sheetEl.classList.contains('pa-fb')) sheetEl.showModal();
    else{
      sheetPrev=document.activeElement; sheetEl.setAttribute('open','');
      const f=sheetEl.querySelector('button,select,input:not([tabindex="-1"]),[tabindex="0"]'); if(f) f.focus({preventScroll:true});
    }
  }
  return sheetEl;
}
PA.closeSheet=()=>{if(isOpen(sheetEl)) sheetEl.close();};
// とじるとき、すっと下がってから close（app.css の .closing）。Esc もおなじ。動きをへらす設定・古いブラウザ（.pa-fb）はすぐ
function animateClose(el){
  const real=el.close.bind(el);
  let timer=0;
  const stop=()=>{clearTimeout(timer);timer=0;el.paClosing=false;el.removeEventListener('animationend',onEnd);el.classList.remove('closing');};
  const done=()=>{stop();if(isOpen(el)) real();};
  const onEnd=e=>{if(e.target===el) done();};
  el.paCancelClose=()=>{if(timer) stop();};
  el.close=function(){
    if(!isOpen(el)) return;
    if(el.classList.contains('pa-fb')||PA.reduceMotion()){real();return;}
    el.paClosing=true; el.classList.add('closing'); el.addEventListener('animationend',onEnd);
    timer=setTimeout(done,320); // animationend がこなくても、かならずとじる
  };
  el.addEventListener('cancel',e=>{e.preventDefault();el.close();});
  // とじているとちゅうのタップ・えらびなおしはうけつけない（2回えらぶ・またひらくのをふせぐ）
  el.addEventListener('click',e=>{if(el.paClosing){e.preventDefault();e.stopImmediatePropagation();}},true);
  el.addEventListener('change',e=>{if(el.paClosing) e.stopImmediatePropagation();},true);
}
// 調をえらぶシート：minor（短調か）, idx（いま）, both（長調・短調を切りかえられる）, onPick(minor,idx)
PA.openKeySheet=o=>{
  let minor=!!o.minor;
  const draw=()=>{
    const n=PA.keyCount(minor), flatFrom=minor?PA.MINOR_FLAT_FROM:PA.MAJOR_FLAT_FROM;
    let h=`<div class="sheet-head"><h2>調を選ぶ</h2><button class="iconbtn" data-sheet="close" aria-label="とじる">${PA.icon('close')}</button></div>`;
    if(o.both) h+=`<div style="margin-bottom:10px">${PA.seg('pa-mode',[['0','☀️ 長調'],['1','🌙 短調']],minor?'1':'0','full')}</div>`;
    h+=`<div class="keygrid"><div class="sep">調号なし・♯の調</div>`;
    for(let i=0;i<n;i++){
      if(i===flatFrom) h+=`<div class="sep">♭の調</div>`;
      const k=PA.keyOf(minor,i);
      h+=`<button class="kbtn ${minor===!!o.minor&&i===o.idx?'on':''}" data-sheet="key" data-v="${i}">${PA.keyName(k)}<small>${PA.sigLabel(k)}・${PA.keyEn(k)}</small></button>`;
    }
    const el=sheet(h+`</div>`);
    el.onclick=e=>{
      if(e.target===el){el.close();return;}
      const b=e.target.closest('[data-sheet],[data-act="pa-mode"]'); if(!b) return;
      if(b.dataset.act==='pa-mode'){minor=b.dataset.v==='1';draw();const n=el.querySelector(`[data-act="pa-mode"][data-v="${minor?1:0}"]`);if(n)n.focus({preventScroll:true});return;}
      if(b.dataset.sheet==='close'){el.close();return;}
      if(b.dataset.sheet==='key'){
        // 描きなおしで調のボタンが入れかわっても、キーボードのフォーカスを調のボタンにもどす
        // （すっと下がってからとじるときは、とじおわったあと＝close のあとにも）
        const refocus=()=>{const ae=document.activeElement;if(!ae||ae===document.body||!document.contains(ae)){const n=document.querySelector('[data-pa="keysheet"]');if(n)n.focus({preventScroll:true});}};
        el.addEventListener('close',refocus,{once:true});
        el.close();o.onPick(minor,+b.dataset.v);refocus();
      }
    };
  };
  draw();
};
PA.openSettings=()=>{
  const h=`<div class="sheet-head"><h2>⚙️ せってい</h2><button class="iconbtn" data-sheet="close" aria-label="とじる">${PA.icon('close')}</button></div>
    <div class="setrow"><label for="pa-naming">音の名前</label><select id="pa-naming"><option value="solfa">ドレミ</option><option value="en">CDE</option><option value="ja">ハニホ</option></select></div>
    <div class="setrow"><label for="pa-pitch">基準の音（ラ）</label><select id="pa-pitch"><option value="440">440Hz</option><option value="441">441Hz</option><option value="442">442Hz</option><option value="443">443Hz</option></select></div>
    <div class="setrow"><label for="pa-sound">音を鳴らす</label><select id="pa-sound"><option value="1">🔊 鳴らす</option><option value="0">🔇 鳴らさない</option></select></div>
    <div class="setrow"><label for="pa-voice">音色</label><select id="pa-voice"><option value="piano">🎹 ピアノ</option><option value="synth">🔔 シンプルな音</option></select></div>
    <p class="note">音の高さはふつうのピアノと同じです。ラ（A4）の高さを440〜443Hz から選べます。教室のピアノが442Hz なら、442Hz に。<br>iPhone・iPad で音が出ないときは、消音（マナーモード）を解除してください。<br>ピアノの音は、Yamaha C5 の録音（Salamander Grand Piano V3、Alexander Holm、CC BY 3.0）を短く切って使っています。読みこめないときは、シンプルな音で鳴ります。</p>
    <div id="pa-midi-box">${midiSecHTML()}</div>
    <div class="setsec"><h3>💾 きろくのひかえ</h3>
      <p class="note">${PA.native?'きろくは、この端末の中にあるよ。ときどきファイルに書きだしておくと、あんしんです。<br>ウェブ（Safari など）で使っていたきろくとはべつだよ。うつすときは、ウェブで書きだしたファイルを、ここで読みこんでね。'
        :'iPhone・iPad では、このサイトを1週間ほどひらかないと、きろくがきえることがあります。ホーム画面に追加するか、ときどきファイルに書きだしておくと、あんしんです。<br>LINE などのリンクは Safari でひらくので、ホーム画面のアプリとは、きろくがべつになるよ。うつすときは、書きだし・読みこみを使ってね。'}</p>
      <div class="row"><button class="btn small" data-sheet="export">${PA.icon('save')}きろくをファイルに書きだす</button><button class="btn small" data-sheet="import">${PA.icon('open')}ファイルからよみこむ</button></div>
      <input type="file" id="pa-import" accept=".json,application/json" class="pa-sr" tabindex="-1" aria-hidden="true">
      <p class="note" id="pa-backup-msg" role="status"></p>
      <div id="pa-backup-text" hidden></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn small" data-sheet="once-reset">${PA.icon('book')}はじめの説明をもういちど出す</button></div>
    <p class="note pa-links"><a href="support.html">🛟 こまったとき・おといあわせ</a>　<a href="privacy.html">🔒 プライバシーポリシー</a></p>`;
  const el=sheet(h);
  el.querySelector('#pa-naming').value=S.naming; el.querySelector('#pa-pitch').value=String(S.pitchA); el.querySelector('#pa-sound').value=S.sound?'1':'0'; el.querySelector('#pa-voice').value=S.voice;
  const midiBox=el.querySelector('#pa-midi-box'), midiEcho=()=>{const m=el.querySelector('#pa-midiecho');if(m) m.value=S.midiEcho?'1':'0';};
  midiEcho();
  // つながりがかわったら書きなおす（フォーカスがあったボタンは、書きなおしたあともおなじボタンに）
  PA.midi.onChange=()=>{
    if(!isOpen(el)||!midiBox) return;
    const f=document.activeElement, fs=f&&midiBox.contains(f)?f.dataset.sheet||f.id:null;
    midiBox.innerHTML=midiSecHTML(); midiEcho();
    if(fs){const n=midiBox.querySelector(`[data-sheet="${fs}"],#${fs}`)||midiBox.querySelector('button,select');if(n) n.focus({preventScroll:true});}
  };
  el.onclick=e=>{
    if(e.target===el||e.target.closest('[data-sheet="close"]')){el.close();return;}
    const b=e.target.closest('[data-sheet]'); if(!b) return;
    if(b.dataset.sheet==='export') exportRecords(el);
    if(b.dataset.sheet==='import') el.querySelector('#pa-import').click();
    if(b.dataset.sheet==='copy') copyBackupText(el);
    if(b.dataset.sheet==='midi-pair') PA.midi.pair();
    if(b.dataset.sheet==='once-reset'){PA.onceReset();b.innerHTML=PA.icon('check')+'出すようにしたよ';PA.announce('はじめの説明を、また出すようにしたよ');if(PA.onSettings) PA.onSettings();}
    if(b.dataset.sheet==='midi-connect'){
      const st=el.querySelector('#pa-midi-st');
      PA.midi.connect().then(ok=>{if(!ok&&st) st.textContent='つなげなかったよ。電子ピアノをつないでから、もういちどおしてね（「MIDI を使ってもいい？」ときかれたら「許可」）';});
    }
  };
  el.onchange=e=>{
    const t=e.target;
    if(t.id==='pa-import'){importRecords(t.files&&t.files[0],el);t.value='';return;}
    if(t.id==='pa-naming') S.naming=t.value;
    if(t.id==='pa-pitch'){S.pitchA=+t.value;PA.playNote(69,0,1.6,0.25);}
    if(t.id==='pa-sound'){S.sound=t.value==='1';if(!S.sound)PA.stopSound();}
    if(t.id==='pa-midiecho') S.midiEcho=t.value==='1';
    if(t.id==='pa-voice'){
      S.voice=t.value;
      if(PA.onStopDown) PA.onStopDown(); // ⏹ とおなじに、ページの再生（ならびの光る場所など）もとめる
      PA.stopSound();
      // ためしの音。録音を読むあいだに、とじた・音をとめた・音色をかえたときは鳴らさない
      const g=soundGen, sq=sheetSeq;
      const preview=()=>{const keep=voiceLock;voiceLock=null;PA.playNote(60,0,1.6,0.25);voiceLock=keep;}; // チャレンジでとめた音色ではなく、えらんだ音色で
      if(S.voice==='piano') PA.loadPiano().then(()=>{if(g===soundGen&&sq===sheetSeq&&isOpen(el)&&S.voice==='piano') preview();});
      else preview();
    }
    PA.saveSettings(); updateSoundBar(); if(PA.onSettings) PA.onSettings();
  };
};
// ⚙️ の「🎹 電子ピアノ」（つなげないブラウザ＝iPhone・iPad の Safari などでは出さない）
function midiSecHTML(){
  if(!PA.midi.available()) return '';
  const ds=PA.midi.devices();
  const st=ds.length?`✅ つながっているよ：${ds.map(PA.esc).join('、')}<br>電子ピアノでひくと、画面のけんばんをおしたのとおなじになるよ。`
    :PA.native?'USB のケーブルでつなぐか、下のボタンから Bluetooth でつないでね。':'電子ピアノを USB でつないでから、「つなぐ」をおしてね。';
  const btns=(PA.midi.canPair()?`<button class="btn small" data-sheet="midi-pair">${PA.icon('bluetooth')}Bluetooth でつなぐ</button>`:'')
    +(!PA.midi.native()&&!ds.length?`<button class="btn small" data-sheet="midi-connect">${PA.icon('piano')}電子ピアノをつなぐ</button>`:'');
  return `<div class="setsec"><h3>🎹 電子ピアノ（MIDI）</h3><p class="note" id="pa-midi-st" role="status">${st}</p>`
    +(btns?`<div class="row">${btns}</div>`:'')
    +`<div class="setrow"><label for="pa-midiecho">アプリでも音を鳴らす</label><select id="pa-midiecho"><option value="0">鳴らさない</option><option value="1">鳴らす（音の出ないキーボードのとき）</option></select></div></div>`;
}
/* ----- きろくのひかえ（'pianoapps.' のきろくを JSON ファイルに） ----- */
// ファイルの中身をたしかめる：{'pianoapps.…': JSON の文字, …}。ちがえば null
PA.checkBackup=o=>{
  if(!o||typeof o!=='object'||Array.isArray(o)) return null;
  const ks=Object.keys(o), out={};
  if(!ks.length||ks.length>500) return null;
  for(let i=0;i<ks.length;i++){
    const k=ks[i], v=o[k];
    if(k.indexOf('pianoapps.')!==0||k.length>80||typeof v!=='string'||v.length>200000) return null;
    try{JSON.parse(v);}catch(e){return null;}
    out[k]=v;
  }
  return out;
};
PA.backupData=()=>{const o={};PA.store.keys().forEach(k=>{try{const v=localStorage.getItem('pianoapps.'+k);if(v!=null)o['pianoapps.'+k]=v;}catch(e){}});return o;};
const pad2=n=>(n<10?'0':'')+n;
// ファイルにできないブラウザ（iOS 12の Safari など）：中身を文字で見せて、コピーできるようにする
function showBackupText(el,text){
  const box=el.querySelector('#pa-backup-text'); if(!box) return false;
  box.innerHTML=`<p class="note">${PA.native?'ファイルにできなかったので':'このブラウザではファイルにできないので'}、下の文字をぜんぶコピーして、メモなどにはりつけて、とっておいてね。</p>`
    +`<textarea id="pa-backup-ta" readonly rows="5" aria-label="きろくの中身" style="width:100%;font:16px/1.4 monospace;border:2px solid var(--line);border-radius:12px;padding:8px;background:var(--soft2);color:var(--ink)"></textarea>`
    +`<div class="row" style="margin-top:6px"><button type="button" class="btn small" data-sheet="copy">${PA.icon('copy')}コピーする</button></div>`;
  box.querySelector('#pa-backup-ta').value=text;
  box.hidden=false;
  return true;
}
function copyBackupText(el){
  const ta=el.querySelector('#pa-backup-ta'), msg=el.querySelector('#pa-backup-msg'), say=t=>{if(msg) msg.textContent=t;};
  if(!ta) return;
  const done=()=>say('コピーしたよ。メモなどにはりつけてね'), manual=()=>say('コピーできなかったよ。文字を長おしして「すべて選択」→「コピー」してね');
  const legacy=()=>{
    let ok=false;
    try{ta.removeAttribute('readonly');ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);ok=document.execCommand('copy');}catch(e){ok=false;}
    ta.setAttribute('readonly','');
    if(ok) done(); else manual();
  };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done,legacy);
  else legacy();
}
function exportRecords(el){
  askPersist(); // きろくをだいじにする人 → ブラウザに「消さないで」とおねがい
  const msg=el.querySelector('#pa-backup-msg'), say=t=>{if(msg) msg.textContent=t;};
  let text, name;
  try{
    const d=new Date(); name='piano-kiroku-'+d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+'.json';
    text=JSON.stringify(PA.backupData(),null,1);
  }catch(e){say('書きだせなかったよ');return;}
  const fallback=()=>{if(showBackupText(el,text)) say('');else say('書きだせなかったよ');};
  // ホーム画面のアプリ：ダウンロードするともどれないことがあるので、できれば「共有」でファイルをわたす
  // アプリの中もおなじ（ダウンロードのしくみがないので、ダウンロードにすると何も書きださずに「書きだしたよ」と出てしまう）
  let standalone=PA.native;
  try{standalone=standalone||navigator.standalone===true||(!!window.matchMedia&&matchMedia('(display-mode: standalone)').matches);}catch(e){}
  if(standalone&&typeof File==='function'&&navigator.share&&navigator.canShare){
    let file=null;
    try{file=new File([text],name,{type:'application/json'});}catch(e){}
    let can=false; try{can=!!file&&navigator.canShare({files:[file]});}catch(e){}
    if(can){
      navigator.share({files:[file]}).then(()=>say('「'+name+'」を書きだしたよ（「ファイルに保存」を選んだら、「ファイル」アプリにあるよ）'),
        err=>{if(err&&err.name==='AbortError') say('');else fallback();});
      return;
    }
  }
  if(PA.native){fallback();return;}
  const a=document.createElement('a');
  if(!('download' in a)||typeof Blob!=='function'||!window.URL||!URL.createObjectURL){fallback();return;}
  try{
    const blob=new Blob([text],{type:'application/json'}), url=URL.createObjectURL(blob);
    a.href=url; a.download=name; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    say('「'+name+'」を書きだしたよ（ダウンロード・「ファイル」アプリにあるよ）');
  }catch(e){fallback();}
}
function importRecords(file,el){
  const msg=el.querySelector('#pa-backup-msg'), say=t=>{if(msg) msg.textContent=t;};
  if(!file) return;
  if(file.size>5e6){say('このファイルはよみこめないよ（大きすぎる）');return;}
  const r=new FileReader();
  r.onload=()=>{
    let data=null; try{data=PA.checkBackup(JSON.parse(String(r.result)));}catch(e){}
    if(!data){say('このファイルはよみこめないよ（ピアノ和音アプリのきろくではないみたい）');return;}
    if(typeof confirm==='function'&&!confirm('いまのきろくを、ファイルのきろくに入れかえます。いまのきろくは、きえます。よろしいですか？')) return;
    try{
      PA.store.keys().forEach(k=>localStorage.removeItem('pianoapps.'+k));
      Object.keys(data).forEach(k=>localStorage.setItem(k,data[k]));
    }catch(e){say('ほぞんできなかったよ');return;}
    stored();
    // アプリ：ひかえを書きおわってから読みなおす（2びょうまでまつ）
    let go=false; const reload=()=>{if(!go){go=true;location.reload();}};
    let p=null; try{p=PA.flushStore?PA.flushStore():null;}catch(e){}
    if(p&&typeof p.then==='function'){p.then(reload,reload);setTimeout(reload,2000);}
    else reload();
  };
  r.onerror=()=>say('よみこめなかったよ');
  r.readAsText(file);
}
/* ----- 読み上げソフトに知らせる（画面には出ない） ----- */
let liveEl=null;
PA.announce=t=>{
  try{
    if(!liveEl){liveEl=document.createElement('div');liveEl.className='pa-sr';liveEl.setAttribute('aria-live','polite');document.body.appendChild(liveEl);}
    liveEl.textContent=''; setTimeout(()=>{liveEl.textContent=String(t);},60);
  }catch(e){}
};
/* ----- 音がオフのときのおしらせ（上のバーの下） ----- */
function updateSoundBar(){
  const bar=document.getElementById('appbar'); if(!bar||!bar.parentNode) return;
  let sb=document.getElementById('pa-soundoff');
  if(S.sound){if(sb) sb.hidden=true;return;}
  if(!sb){
    sb=document.createElement('div'); sb.id='pa-soundoff'; sb.className='soundoff';
    sb.innerHTML='<span role="status">🔇 音がオフになっているよ</span><button type="button" class="btn small" data-pa="sound-on">'+PA.icon('listen')+'音を出す</button>';
    bar.parentNode.insertBefore(sb,bar.nextSibling);
  }
  sb.hidden=false;
}
PA.updateSoundBar=updateSoundBar;
// 上のバー（もどる・題名・設定）。app はホームの「つづき」に使う名前
// ほかのアプリから PA.go() やページの中のリンクで来たときは、「‹ 和音クイズへ」でそのアプリにもどる（1時間以内・ホームをひらくとリセット）
PA.mountBar=o=>{
  const bar=document.getElementById('appbar');
  PA.currentApp=o.app||null;
  const r=PA.store.get('return-to',null);
  // data-pa="back"：ホームから来たばかりなら history.back()（アプリの左はしのスワイプでもどるのとおなじ れきしにする）
  let backEl=`<a class="iconbtn" href="${o.back||'index.html'}" data-pa="back" aria-label="ホームにもどる">${PA.icon('back')}</a>`;
  if(!o.back&&r&&typeof r.app==='string'&&/^[a-z0-9-]+$/.test(r.app)&&r.app!==o.app&&Date.now()-r.t<36e5){
    const prev=PA.app(r.app), name=prev?prev.title:'前のアプリ';
    backEl=`<a class="backpill" href="${r.app}.html" data-pa="back" aria-label="${PA.esc(name)}にもどる"><span class="bp-ar" aria-hidden="true">${PA.icon('back')}</span><span class="bp-tx">${PA.esc(name)}</span>へ</a>`;
  }
  bar.innerHTML=`${backEl}<h1>${o.title}</h1><button class="iconbtn" data-pa="settings" aria-label="せってい">${PA.icon('settings')}</button>`;
  document.title=o.title;
  if(o.app){
    const t=Date.now(), a=PA.app(o.app);
    PA.store.set('last',{app:o.app,title:o.title,t});
    if(a) PA.store.set(/^(quiz|play|ear)$/.test(a.type)?'last-practice':'last-learn',{app:a.id,title:a.title,t});
    // 'visited'＝{アプリの id: さいごにひらいた時刻}（ホームの ✓ と「3 / 4ひらいた」）
    if(a){const v=PA.store.get('visited',{}), vv=v&&typeof v==='object'&&!Array.isArray(v)?v:{};vv[a.id]=t;PA.store.set('visited',vv);}
  }
  updateSoundBar();
};
PA.go=(page,params)=>{if(PA.currentApp) PA.store.set('return-to',{app:PA.currentApp,t:Date.now()}); location.href=params?PA.url(page,params):page;};
/* ----- リンクのパラメータ ----- */
PA.url=(page,obj)=>{
  let p=String(page||'index.html');
  if(!/[?#\/.]/.test(p)) p+='.html';
  const q=[];
  if(obj&&typeof obj==='object') Object.keys(obj).forEach(k=>{const v=obj[k];if(v==null||v===''||v===false) return;q.push(encodeURIComponent(k)+'='+encodeURIComponent(String(v)));});
  return q.length?p+(p.indexOf('?')>=0?'&':'?')+q.join('&'):p;
};
const PARAM_RE=/^[a-z][a-z0-9-]{0,20}$/;
PA.PARAM_KEYS=['key','chord','mode','level','tier','n','step'];
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
PA.parseParams=search=>{
  const out={};
  String(search||'').replace(/^\?/,'').split('&').forEach(pair=>{
    if(!pair) return;
    const i=pair.indexOf('='); let k,v;
    try{k=decodeURIComponent((i<0?pair:pair.slice(0,i)).replace(/\+/g,' '));v=i<0?'':decodeURIComponent(pair.slice(i+1).replace(/\+/g,' '));}catch(e){return;}
    if(!PARAM_RE.test(k)||v.length>40||hasOwn(out,k)) return; // おなじ名前はさいしょの1つ
    out[k]=v;
  });
  return out;
};
PA.params=()=>PA.parseParams(location.search);
PA.fromLink=()=>{const p=PA.params();return PA.PARAM_KEYS.some(k=>hasOwn(p,k));};
PA.paramInt=(name,lo,hi)=>{const v=PA.params()[name];if(v==null||!/^-?\d{1,6}$/.test(v)) return null;const n=+v;return n>=lo&&n<=hi?n:null;};
// アプリの中では capacitor://localhost/… になるので、公開しているサイトのアドレスにする（先生・ウェブでひらけるように）
PA.absUrl=rel=>{try{return new URL(rel,PA.native?PA.SITE+location.pathname.replace(/^\/+/,''):location.href).href;}catch(e){return rel;}};
PA.shareHTML=(page,params,label)=>`<button type="button" class="btn small pa-share" data-pa="share" data-url="${PA.esc(PA.absUrl(PA.url(page,params)))}">${label||PA.icon('link')+'リンクをおくる'}</button>`;
const flash=(b,t)=>{
  if(b.dataset.orig==null) b.dataset.orig=b.innerHTML;
  b.textContent=t; PA.announce(t);
  clearTimeout(b._paFlash); b._paFlash=setTimeout(()=>{if(b.dataset.orig!=null){b.innerHTML=b.dataset.orig;delete b.dataset.orig;}},2200);
};
function shareLink(b){
  const url=b.dataset.url; if(!url) return;
  const ask=()=>{try{window.prompt('このリンクをコピーしてね',url);}catch(e){}};
  if(navigator.share){navigator.share({title:document.title,url}).catch(()=>{});return;}
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(()=>flash(b,'✅ コピーしたよ'),ask);
  else ask();
}
document.addEventListener('click',e=>{
  // ページの中のふつうのリンクでほかのアプリへ行くときも、‹ でここにもどれるように（?… つきのリンクも）
  const a=e.target.closest&&e.target.closest('#view a[href]');
  if(a&&PA.currentApp){
    const h=(a.getAttribute('href')||'').split(/[?#]/)[0];
    if(/\.html$/.test(h)&&!/^[a-z][a-z0-9+.-]*:/i.test(h)&&!/(^|\/)index\.html$/.test(h)) PA.store.set('return-to',{app:PA.currentApp,t:Date.now()});
  }
  const b=e.target.closest&&e.target.closest('[data-pa]'); if(!b) return;
  const p=b.dataset.pa;
  if(p==='settings') PA.openSettings();
  if(p==='keysheet'&&PA.onKeySheet) PA.onKeySheet();
  if(p==='share') shareLink(b);
  if(p==='sound-on'){
    const had=document.activeElement===b;
    S.sound=true; PA.saveSettings(); PA.audio(); PA.playNote(72,0,0.6,0.2); updateSoundBar(); PA.announce('音が出るようになったよ');
    if(had){const st=document.querySelector('[data-pa="settings"]');if(st) st.focus({preventScroll:true});}
    if(PA.onSettings) PA.onSettings();
  }
  if(p==='back'){
    // そのページから来たばかりなら history.back()（れきしがふえない・スクロールももどる）
    const h=(b.getAttribute('href')||'').split(/[?#]/)[0];
    let ref=null; try{ref=document.referrer?new URL(document.referrer):null;}catch(err){}
    // origin ではなく protocol と host でくらべる（アプリの capacitor:// は URL の origin が 'null' になる）
    // ホーム（index.html）は / でひらいていることもある（アプリのさいしょ・公開サイトのトップ）
    const same=ref&&(ref.pathname===h||ref.pathname.slice(-(h.length+1))==='/'+h||(h==='index.html'&&/\/$/.test(ref.pathname)));
    if(h&&ref&&ref.protocol===location.protocol&&ref.host===location.host&&same&&history.length>1){e.preventDefault();history.back();}
  }
});
// 「もどる」で前の画面からそのままもどってきたとき（bfcache）。ホームでは「まえのアプリ」をわすれる。ほかのページでかえた設定もよみなおす
window.addEventListener('pageshow',e=>{
  if(!e.persisted) return;
  loadSettings(); updateSoundBar();
  if(!PA.currentApp) PA.store.set('return-to',null);
  if(PA.onPageShow) PA.onPageShow();
});

/* ===== 2回おすボタン（data-confirm）：1回めは文字がかわって赤いわく、4秒以内にもういちどでふつうの click ===== */
let armed=null; // {sig, t, timer}
const confirmSig=b=>(b.dataset.act||b.dataset.pa||b.id||'')+'|'+(b.dataset.v||'');
const unArm=()=>{
  if(armed){clearTimeout(armed.timer);armed=null;}
  document.querySelectorAll('.armed').forEach(b=>{b.classList.remove('armed');if(b.dataset.armHtml!=null){b.innerHTML=b.dataset.armHtml;delete b.dataset.armHtml;}});
};
const showArm=b=>{if(b.classList.contains('armed')) return;b.dataset.armHtml=b.innerHTML;b.textContent=b.dataset.confirm;b.classList.add('armed');};
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-confirm]'); if(!b||b.disabled) return;
  const sig=confirmSig(b);
  if(armed&&armed.sig===sig&&Date.now()-armed.t<4000){unArm();return;} // 2回め：そのままページへ
  e.preventDefault(); e.stopImmediatePropagation();
  unArm();
  armed={sig,t:Date.now(),timer:setTimeout(unArm,4000)};
  showArm(b); PA.announce(b.dataset.confirm); PA.haptic('medium');
},true);
// ほかへフォーカスがうつったらもとにもどす（描きなおしでボタンが入れかわったときはそのまま）
document.addEventListener('focusout',e=>{
  const b=e.target; if(!armed||!b||!b.classList||!b.classList.contains('armed')) return;
  setTimeout(()=>{if(armed&&document.contains(b)&&document.activeElement!==b) unArm();},0);
},true);
const reArm=el=>{
  if(!armed) return;
  if(Date.now()-armed.t>=4000){unArm();return;}
  el.querySelectorAll('[data-confirm]').forEach(b=>{if(confirmSig(b)===armed.sig) showArm(b);});
};

/* ===== キーボード・ページめくりペダル（data-hot） ===== */
// マウス・指でおしたボタンにフォーカスがのこっていても、スペースは「聴く」につかう（Tab でえらんだときはそのボタン）
let kbNav=false;
document.addEventListener('pointerdown',()=>{kbNav=false;},true);
document.addEventListener('keydown',e=>{if(e.key==='Tab') kbNav=true;},true);
const shown=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)&&!el.closest('[hidden],[inert]');
const hotBtn=name=>{
  const els=document.querySelectorAll(`[data-hot~="${name}"]`);
  for(let i=0;i<els.length;i++){const b=els[i];if(!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&shown(b)) return b;}
  return null;
};
const HOT={' ':'listen',Spacebar:'listen',Enter:'check',ArrowRight:'next',PageDown:'next',ArrowLeft:'prev',PageUp:'prev'};
const ACTIVE_SEL='button,a[href],summary,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="option"]';
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.isComposing||e.repeat) return;
  const name=HOT[e.key]; if(!name) return;
  const t=e.target&&e.target.nodeType===1?e.target:null;
  if(document.querySelector('dialog[open]')) return;
  if(t){
    if(t.closest('input,select,textarea,[contenteditable=""],[contenteditable="true"],dialog,[role="dialog"]')) return;
    if(t.closest('.kb [data-m]')) return; // けんばんの鍵にフォーカス：スペース・Enter はその鍵をひく、←→ は鍵のいどう
    const act=t.closest(ACTIVE_SEL);
    if(name==='check'&&act) return;
    if(name==='listen'&&act&&kbNav) return;
    if((name==='next'||name==='prev')&&t.closest('[role="slider"],[role="tablist"],[role="radiogroup"],[role="listbox"],[role="menu"]')) return;
  }
  const b=hotBtn(name); if(!b) return;
  e.preventDefault();
  if(t&&t!==document.body&&t.blur&&name==='listen') t.blur(); // フォーカスのボタンがスペースでおされないように
  b.click();
});

/* ===== 学ぶページの「ためしてみる」カード ===== */
PA.tryHTML=(o={})=>{
  const app=PA.app(o.to), T=PA.APP_TYPES[app?app.type:'quiz']||PA.APP_TYPES.quiz;
  const title=o.title||(app?`「${app.title}」でためしてみよう`:'ためしてみよう');
  const more=(o.links||[]).filter(l=>l&&l.to).map(l=>`<a class="btn small" href="${PA.esc(PA.url(l.to,l.params))}">${l.label||PA.esc((PA.app(l.to)||{}).title||l.to)}</a>`).join('');
  return `<section class="card try-card" style="--tc:${T.dk};--tl:${T.l}"><h2>${title}</h2>${o.sub?`<p class="lead">${o.sub}</p>`:''}`
    +`<a class="btn try-go" href="${PA.esc(PA.url(o.to||'index',o.params))}">${o.btn||PA.icon('target')+'ためしてみる'}</a>`
    +(more?`<div class="row try-more">${more}</div>`:'')+`</section>`;
};

/* ===== 古い端末・ホーム画面のアプリ：sw.js（https だけ）と、きろくを消されにくくするおねがい ===== */
function askPersist(){try{if(navigator.storage&&navigator.storage.persist&&!PA.store.get('persist-asked',false)){PA.store.set('persist-asked',true);navigator.storage.persist().catch(()=>{});}}catch(e){}}
(function(){
  const go=()=>{
    try{if('serviceWorker' in navigator&&location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});}catch(e){}
    // ホーム画面のアプリのときだけここでおねがい（ブラウザでは書きだすボタンをおしたとき。Firefox はたずねる画面が出るので）
    let standalone=false; try{standalone=navigator.standalone===true||(!!window.matchMedia&&matchMedia('(display-mode: standalone)').matches);}catch(e){}
    if(standalone) askPersist();
  };
  if(document.readyState==='complete') setTimeout(go,0); else window.addEventListener('load',go);
})();

/* 描きかえ：横スクロール（data-sk の名前ごと）・ひらいた<details>・フォーカスをたもつ。sig がかわったら横スクロールは最初の位置に
 * 下のボタンバーも PA.paint(document.getElementById('actions'),html,'bar') で描くと、押したボタンが入れかわってもフォーカスがのこる */
const lastSigs=new WeakMap();
const FOCUS_NEXT={build:['stop'],stop:['build','cplay','wcad'],play:['stop'],cplay:['stop'],enew:['eplay'],eans:['enew'],qchoose:['qnext'],qmark:['qnext'],qcheck:['qnext'],qnext:['qcheck']};
const dKey=(d,i)=>d.id||(d.dataset&&d.dataset.d)||((d.className||'')+':'+((d.querySelector('summary')||{}).textContent||'').trim())||('#'+i);
const rove=k=>{const svg=k.closest('svg');if(svg) svg.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('tabindex',x===k?'0':'-1'));};
// こたえの「ぽん」「ゆれ」（app.css）：描きなおす前にも出ていたものには .still
const FX_SEL='.choice.right,.choice.wrong,.echoice.right,.echoice.wrong,.fb.good,.fb.bad';
const fxKey=n=>[n.dataset.act||'',n.dataset.v||'',n.classList.contains('right')?'r':n.classList.contains('wrong')?'w':n.classList.contains('good')?'g':'b',
  n.classList.contains('fb')?(n.textContent||'').slice(0,80):''].join('|');
PA.paint=(el,html,sig)=>{
  const ae=document.activeElement, ds=ae&&ae.dataset?ae.dataset:{}, inEl=!!ae&&ae!==el&&el.contains(ae);
  const fa=ds.act||null, fv=ds.v, fp=ds.pa||null, wasBtn=inEl&&ae.tagName==='BUTTON';
  const km=inEl&&ds.m!=null&&ae.closest('.kb')?ds.m:null, kIdx=km!=null?[...el.querySelectorAll(`[data-m="${km}"]`)].indexOf(ae):-1;
  const keep={}; if(sig===lastSigs.get(el)) el.querySelectorAll('[data-sk]').forEach(b=>keep[b.dataset.sk]=b.scrollLeft);
  const openD=new Set(); el.querySelectorAll('details').forEach((d,i)=>{if(d.open) openD.add(dKey(d,i));});
  const fxSeen=new Set(); el.querySelectorAll(FX_SEL).forEach(n=>fxSeen.add(fxKey(n)));
  el.innerHTML=html;
  // おなじこたえの描きなおし・ひらいたときにもうこたえてあった（読みなおし）：うごきはくりかえさない
  keyDowns.forEach((n,m)=>el.querySelectorAll(`.kb [data-m="${m}"]`).forEach(k=>k.classList.add('down')));
  const fxFirst=!lastSigs.has(el);
  if(fxFirst||fxSeen.size) el.querySelectorAll(FX_SEL).forEach(n=>{if(fxFirst||fxSeen.has(fxKey(n))) n.classList.add('still');});
  if(openD.size) el.querySelectorAll('details').forEach((d,i)=>{if(!d.open&&openD.has(dKey(d,i))) d.open=true;});
  el.querySelectorAll('[data-sk]').forEach(b=>{ if(keep[b.dataset.sk]!=null) b.scrollLeft=keep[b.dataset.sk]; else PA.placeScroll(b); });
  lastSigs.set(el,sig);
  reArm(el); // 2回おすボタンの1回めのあとに描きなおしても、赤いわくのまま
  if(!inEl||(document.activeElement!==document.body&&document.contains(ae))) return;
  const focus=n=>{if(n){n.focus({preventScroll:true});return true;}return false;};
  if(km!=null){ // けんばんの鍵（キーボードでひいた）
    const ks=el.querySelectorAll(`[data-m="${km}"]`), k=ks[kIdx]||ks[0];
    if(k){rove(k);k.focus({preventScroll:true});}
    return;
  }
  if(!wasBtn) return;
  if(fp&&focus(el.querySelector(`[data-pa="${CSS.escape(fp)}"]`))) return;
  if(!fa) return;
  const ok=':not([disabled])';
  const tryq=a=>{for(const r of [el,document]){const n=r.querySelector(`[data-act="${a}"][data-v="${CSS.escape(fv==null?'':fv)}"]${ok}`)||r.querySelector(`[data-act="${a}"]${ok}`);if(n) return n;}return null;};
  if(focus(tryq(fa))) return;
  for(const a of FOCUS_NEXT[fa]||[]) if(focus(tryq(a))) return;
  focus(document.querySelector(`#actions .btn.primary${ok}`)||document.querySelector(`#actions button${ok}`));
};
// はじめて出す横スクロールの位置：鍵盤は focus の鍵（なければ色つきの鍵、なければまんなかのド）をまん中に。data-start="end" は右はし
// アニメのとちゅうなどで、色のついた鍵が見えないところにあるときだけまん中へ（見えていれば動かさない）
PA.follow=el=>{
  (el||document).querySelectorAll('[data-sk]').forEach(b=>{
    if(b.scrollWidth<=b.clientWidth+1) return;
    let t=[...b.querySelectorAll('[data-focus]')]; if(!t.length) t=[...b.querySelectorAll('[data-mk]')];
    if(!t.length) return;
    const br=b.getBoundingClientRect(), L=Math.min(...t.map(r=>r.getBoundingClientRect().left)), R=Math.max(...t.map(r=>r.getBoundingClientRect().right));
    if(L>=br.left-1&&R<=br.right+1) return;
    PA.placeScroll(b);
  });
};
PA.placeScroll=b=>{
  if(b.scrollWidth<=b.clientWidth+1) return;
  if(b.dataset.start==='end'){b.scrollLeft=b.scrollWidth;return;}
  if(b.dataset.start&&b.dataset.start.endsWith('%')){b.scrollLeft=b.scrollWidth*parseFloat(b.dataset.start)/100;return;}
  let t=[...b.querySelectorAll('[data-focus]')];
  if(!t.length) t=[...b.querySelectorAll('[data-mk]')];
  if(!t.length) t=[b.querySelector('[data-m="60"]')].filter(Boolean);
  if(!t.length) return;
  const br=b.getBoundingClientRect();
  const L=Math.min(...t.map(r=>r.getBoundingClientRect().left)), R=Math.max(...t.map(r=>r.getBoundingClientRect().right));
  b.scrollLeft+=(L+R)/2-(br.left+br.right)/2;
};
// 鍵盤の入力：マウスは押した瞬間。タッチは指ごとにおぼえ、横スクロールなら鳴らさない
const downs=new Map();
// ⏹：押した瞬間に音を止める。click が来ないまま（指がずれた・スクロールした）おわったら PA.onStopCancel で画面をもどしてもらう
let stopPend=false;
const stopCancel=()=>{if(!stopPend)return;stopPend=false;if(PA.onStopCancel)PA.onStopCancel();};
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-act="stop"]')) stopPend=false;},true);
document.addEventListener('pointerdown',e=>{
  if(e.target.closest('[data-act="stop"]')){stopPend=true;if(PA.onStopDown)PA.onStopDown();else PA.stopSound();return;}
  const k=e.target.closest('[data-m]'); if(!k) return;
  const m=+k.dataset.m;
  if(e.pointerType==='mouse'){if(e.button!==0)return;keyFlash(k);PA.audio();PA.playNote(m,0,1.4,0.24);if(PA.onKey)PA.onKey(m);return;}
  const box=k.closest('.scroll'), scrollable=!!box&&box.scrollWidth>box.clientWidth+1;
  const d={m,k,x:e.clientX,y:e.clientY,played:false,t0:0,lit:0};
  if(PA.audioRunning()&&!scrollable){PA.playNote(m,0,1.4,0.24);d.played=true;}
  // 鍵をへこませる。横にスクロールできる鍵盤は、0.06びょう指がうごかなかったら（スワイプで鍵が光らないように）
  const lit=()=>{if(downs.get(e.pointerId)===d&&!d.on){setDown(m,true);d.on=true;d.t0=Date.now();}};
  if(scrollable) d.lit=setTimeout(lit,60);
  downs.set(e.pointerId,d);
  if(!scrollable) lit();
});
// へこんでいる鍵は高さ（m）でおぼえる：おした鍵で描きなおしても、PA.paint が新しい鍵にもつけなおす
const keyDowns=new Map(); // m → おしている数（指・マウス・電子ピアノ）
const setDown=(m,on)=>{
  const n=(keyDowns.get(m)||0)+(on?1:-1);
  if(n>0) keyDowns.set(m,n); else keyDowns.delete(m);
  const v=keyDowns.has(m);
  try{document.querySelectorAll(`.kb [data-m="${m}"]`).forEach(k=>k.classList.toggle('down',v));}catch(e){}
};
// 鍵のへこみをもどす（みじかいタップでも 0.12びょうは見せる。now＝すぐ）
const keyUp=(d,now)=>{clearTimeout(d.lit);if(!d.on) return;d.on=false;const m=d.m;setTimeout(()=>setDown(m,false),now?0:Math.max(0,120-(Date.now()-d.t0)));};
const keyFlash=k=>{const m=+k.dataset.m;setDown(m,true);setTimeout(()=>setDown(m,false),150);};
// 電子ピアノの鍵：おしているあいだ、画面の鍵盤もへこむ（その高さの鍵があるときだけ）
PA.keyLight=(m,on)=>setDown(m,!!on);
document.addEventListener('pointerup',e=>{
  if(stopPend&&!(e.target.closest&&e.target.closest('[data-act="stop"]'))) stopCancel();
  const d=downs.get(e.pointerId); if(!d) return;
  downs.delete(e.pointerId);
  const tap=Math.hypot(e.clientX-d.x,e.clientY-d.y)<10;
  if(tap&&!d.on){setDown(d.m,true);d.on=true;d.t0=Date.now();} // 0.06びょうより早くはなした（横スクロールの鍵盤）：いま見せる
  keyUp(d,false);
  if(!tap) return;
  if(!d.played){PA.audio();PA.playNote(d.m,0,1.4,0.24);}
  if(PA.onKey) PA.onKey(d.m);
});
document.addEventListener('pointercancel',e=>{const d=downs.get(e.pointerId);if(d) keyUp(d,true);downs.delete(e.pointerId);stopCancel();});
// キーボード・読み上げソフトでひく：Enter／スペース（読み上げソフトの「タップ」は detail=0の click）、←→ Home End でとなりの鍵へ
const hitKey=k=>{const m=+k.dataset.m;keyFlash(k);PA.audio();PA.playNote(m,0,1.4,0.24);if(PA.onKey)PA.onKey(m);};
document.addEventListener('keydown',e=>{
  const k=e.target&&e.target.closest&&e.target.closest('.kb [data-m]'); if(!k||e.ctrlKey||e.metaKey||e.altKey||e.isComposing) return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat) hitKey(k);return;}
  const dir={ArrowLeft:-1,ArrowRight:1,Home:-1e3,End:1e3}[e.key]; if(!dir) return;
  e.preventDefault();e.stopImmediatePropagation();
  const ks=[...k.closest('svg').querySelectorAll('[data-m]')].sort((a,b)=>a.dataset.m-b.dataset.m);
  const n=ks[Math.max(0,Math.min(ks.length-1,ks.indexOf(k)+dir))];
  rove(n); n.focus();
});
// Pointer Events のないブラウザ（iOS 12の Safari など）では、ふつうのタップ（click）でひく
document.addEventListener('click',e=>{if(e.detail===0||!window.PointerEvent){const k=e.target.closest&&e.target.closest('.kb [data-m]');if(k) hitKey(k);}});

/* ===== おしたときの手ごたえ（app.css の .is-pressed・.is-nav） =====
 * タッチ：指がふれたらすぐ .is-pressed（横いっぱいの行・横スクロールの中は 0.06びょうまってから＝スクロールでは光らない）。
 *   はなす・8px うごく・スクロールになる（pointercancel）でとる。みじかいタップでも 0.1びょうは見せる。マウス・キーボードは :active
 * おなじサイトのページへのリンクは、つぎのページが出るまで .is-nav（ページがかわるのを待つあいだに、もういちどおさない）
 * えらぶボタン（.seg・調のシート）と ⚙️ のえらぶらんは、アプリでは軽くふるえる（PA.haptic('selection')） */
const PRESS_SEL='.btn,.iconbtn,.backpill,.keychip,a.go,.try-go,.choice,.echoice,.kbtn,.cellbtn,.kd-cell,.namechip,.tool,.topbtn,.seg button,.arow,summary';
let press=null; // {el, t0, x, y, timer}
const pressOff=(late)=>{
  if(!press) return; const p=press; press=null; clearTimeout(p.timer);
  if(!late||!p.t0){p.el.classList.remove('is-pressed');return;}
  setTimeout(()=>p.el.classList.remove('is-pressed'),Math.max(0,100-(Date.now()-p.t0)));
};
document.addEventListener('touchstart',()=>{},{passive:true}); // iOS で :active がすぐ効くように
document.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse') return;
  pressOff(false);
  const el=e.target&&e.target.closest&&e.target.closest(PRESS_SEL);
  if(!el||el.disabled||el.getAttribute('aria-disabled')==='true') return;
  const p=press={el,t0:0,x:e.clientX,y:e.clientY,timer:0};
  const on=()=>{if(press===p){el.classList.add('is-pressed');p.t0=Date.now();}};
  if(el.matches('.arow,summary')||el.closest('.scroll')) p.timer=setTimeout(on,60); else on();
},{capture:true,passive:true});
document.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>8) pressOff(false);},{capture:true,passive:true});
document.addEventListener('pointerup',()=>{
  if(press&&!press.t0){const p=press;clearTimeout(p.timer);p.el.classList.add('is-pressed');p.t0=Date.now();} // 0.06びょうより早くはなした：いま見せる
  pressOff(true);
},{capture:true,passive:true});
document.addEventListener('pointercancel',()=>pressOff(false),{capture:true,passive:true});
document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button>0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
  const a=e.target&&e.target.closest&&e.target.closest('a[href]'); if(!a||a.target||a.hasAttribute('download')) return;
  let u; try{u=new URL(a.href,location.href);}catch(err){return;}
  if(u.protocol!==location.protocol||u.host!==location.host||(u.pathname===location.pathname&&u.search===location.search)) return;
  a.classList.add('is-nav'); setTimeout(()=>a.classList.remove('is-nav'),4000);
});
document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest&&e.target.closest('.seg button,.sheet .kbtn');
  if(b&&!b.disabled&&b.getAttribute('aria-pressed')!=='true'&&!b.classList.contains('on')) PA.haptic('selection');
},true);
document.addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest('.sheet select')) PA.haptic('selection');},true);
window.addEventListener('pageshow',()=>{pressOff(false);keyDowns.clear();document.querySelectorAll('.is-nav,.is-pressed,.kb .down').forEach(n=>n.classList.remove('is-nav','is-pressed','down'));});
/* ===== ドッペルドミナントと増六の和音（芸大和声の考え方） =====
 * 長調・短調どちらでも、key（PA.majorKey / PA.minorKey）をわたすと、正しいつづりと高さの音をかえす。
 * 音：{letter, acc, midi, role(日本語の役わり), tag('lt'＝Ⅴへの導音、'low'＝下げた音、'b9'＝短9度、'raised'＝上げた音)}
 *   Ⅱ7                 … 調の音だけでつくるⅡの七の和音（下属のなかま）
 *   ドッペルドミナント   … Ⅱ7の第3音を半音上げた「ⅤのためのⅤ7」。第3音がⅤの導音になる
 *   Ⅴ9/Ⅴ・減七/Ⅴ        … Ⅴの家族とおなじしくみ（短9度・根音省略）
 *   増六（イタリア・フランス・ドイツ）… ドッペルドミナントの第5音を半音下げ、その音をいちばん下においた形
 *     イタリア＝Ⅴ7/Ⅴの根音省略、フランス＝Ⅴ7/Ⅴ（根音あり）、ドイツ＝Ⅴ9/Ⅴ（短9）の根音省略
 *     下げた音（♭6）と上げた音（♯4）が「増6度」。外へひらいてⅤのオクターブに解決する
 */
(function(){
  const C=PA.chroma={};
  // 主音から letterOff 文字・semis 半音上の音（base＝主音の高さ）
  const tone=(key,letterOff,semis,base,role,tag)=>{
    const L=(key.l+letterOff)%7, pc=key.tpc+semis;
    return {letter:L,acc:PA.spell(L,pc),midi:base+semis,role,tag:tag||null};
  };
  // ベース（Ⅱ・Ⅴ/Ⅴの根音）をラ2〜ソ♯3におく
  const rootBase=key=>{const r=PA.mod(key.tpc+2,12);return 45+PA.mod(r-45,12)-2;}; // 主音の高さ（根音＝主音＋2が45〜56）
  C.TYPES={ii7:'Ⅱ7',dd:'ドッペルドミナント',dd9:'ⅤのⅤ9',ddim:'ⅤのⅤ9の根音省略',it:'イタリアの6',fr:'フランスの6',ger:'ドイツの6'};
  // ----- Ⅱ7とドッペルドミナント（根音をベースに、上に5音・7音・3音の形） -----
  C.ii7=key=>{
    const b=rootBase(key), fifth=key.minor?8:9;
    return [tone(key,1,2,b,'根音'),tone(key,5,fifth,b,'第5音'),tone(key,7,12,b,'第7音'),tone(key,3,17,b,'第3音')];
  };
  C.dd=key=>{
    const b=rootBase(key);
    return [tone(key,1,2,b,'根音'),tone(key,5,9,b,'第5音',key.minor?'raised':null),tone(key,7,12,b,'第7音'),tone(key,3,18,b,'第3音（Ⅴへの導音）','lt')];
  };
  // Ⅱ7・ドッペル → Ⅴ（ベースは5度下へ、第3音はⅤの根音へ、第7音は半音・全音下へ）
  C.toV=key=>{
    const b=rootBase(key);
    return [tone(key,4,-5,b,'Ⅴの根音'),tone(key,4,7,b,'Ⅴの根音'),tone(key,6,11,b,'Ⅴの第3音（導音）',key.minor?'raised':null),tone(key,4,19,b,'Ⅴの根音')];
  };
  // ----- ドッペルドミナントの家族（根音位置・よこにつみかさねた形。主音の高さは key.tonicMidi） -----
  C.ddStack=(key,kind='dd',major9=false)=>{
    const b=key.tonicMidi-12;
    const r=tone(key,1,2,b,'根音'), t3=tone(key,3,6,b,'第3音（Ⅴへの導音）','lt'), t5=tone(key,5,9,b,'第5音',key.minor?'raised':null), t7=tone(key,7,12,b,'第7音');
    const t9=major9&&!key.minor?tone(key,9,16,b,'第9音'):tone(key,9,15,b,'第9音（ひくいほう）','b9');
    if(kind==='dd') return [r,t3,t5,t7];
    if(kind==='dd9') return [r,t3,t5,t7,t9];
    if(kind==='ddim') return [t3,t5,t7,t9];
    return [];
  };
  // ----- 増六の和音（いちばん下＝下げた第5音♭6、いちばん上＝第3音♯4） -----
  const augBase=key=>{const p=PA.mod(key.tpc+8,12);return 52+PA.mod(p-52,12)-8;}; // ♭6が52〜63にくるように
  C.aug6=(key,type)=>{
    const b=augBase(key);
    const low=tone(key,5,8,b,'下げた第5音（いちばん下）','low'), c=tone(key,7,12,b,'第7音'), up=tone(key,3,18,b,'第3音（Ⅴへの導音）','lt');
    if(type==='it') return [low,c,up];
    if(type==='fr') return [low,c,tone(key,1,14,b,'根音'),up];
    if(type==='ger') return [low,c,tone(key,9,15,b,'第9音（ひくいほう）','b9'),up];
    return [];
  };
  // 増六 → Ⅴ（下の音は半音下、上の音は半音上：外へひらいてオクターブ）。aug6とおなじならびでかえす
  C.aug6ToV=(key,type)=>{
    const b=augBase(key);
    const V1=tone(key,4,7,b,'Ⅴの根音'), V3=tone(key,6,11,b,'Ⅴの第3音',key.minor?'raised':null), V5=tone(key,1,14,b,'Ⅴの第5音'), V8=tone(key,4,19,b,'Ⅴの根音');
    if(type==='it') return [V1,V3,V8];
    return [V1,V3,V5,V8];
  };
  // ドイツの6 → Ⅰの第2転回形（Ⅰ6/4）→ Ⅴ（Ⅴへ直接すすむと平行5度になるため）
  C.gerToI64=key=>{
    const b=augBase(key), third=key.minor?15:16;
    return [tone(key,4,7,b,'Ⅰの第5音（いちばん下）'),tone(key,0,12,b,'Ⅰの根音'),tone(key,2,third,b,'Ⅰの第3音'),tone(key,4,19,b,'Ⅰの第5音')];
  };
  // 長調のドイツの6は、Ⅰ6/4へすすむとき第9音を二重増4度（♯2）で書くこともある
  C.gerMajorAlt=key=>{
    if(key.minor) return null;
    const b=augBase(key), n=C.aug6(key,'ger');
    n[2]=tone(key,1,15,b,'♯で書きかえた第9音','b9');
    return n;
  };
  // コードネーム（めやす）
  const nameOf=n=>PA.LET_EN[n.letter]+PA.ACC[n.acc];
  C.symbol=(key,type)=>{
    const r=tone(key,1,2,0), t3=tone(key,3,6,0);
    if(type==='ii7') return PA.H(nameOf(r)+(key.minor?'m7(♭5)':'m7'));
    if(type==='dd') return PA.H(nameOf(r)+'7');
    if(type==='dd9') return PA.H(nameOf(r)+'7(♭9)');
    if(type==='ddim') return PA.H(nameOf(t3)+'dim7');
    return '';
  };
})();
/* ===== 変化和音（芸大和声の考え方）：ナポリの六・準固有和音・副属和音・Ⅴ9の根音省略（長調の形と減七）・異名同音の読み替え =====
 * key（PA.majorKey / PA.minorKey）をわたすと、正しいつづりと高さの音をかえす。
 * 音：{letter, acc, midi, role(日本語の役わり), tag}
 *   tag：'lt'＝導音（上へすすむ）、'seventh'＝第7音（下へすすむ）、'b9'／'ninth'＝短9度／長9度（下へ）、
 *        'low'＝下げた音、'borrowed'＝同主短調からかりた音、'raised'＝短調で上げた第6音・第7音、'chrom'＝そのほかの調にない音
 *   減七・長調の形（導音からつむ七の和音）は藝大式どおりⅤ9の根音省略として名前と tag をつける（導音＝第3音、4＝第7音 'seventh'、6＝第9音 'b9'／'ninth'、2＝第5音）。
 *   id の 'vii7'・'vii7h' はまえからの名前（かえない）。画面では「Ⅴ9の根音省略」とよび、「半減七」「Ⅶ7」とは書かない
 *   vii7・rootless9・borrowed('vii_dim7')・viiCompare・secondary(…,'vii7'|'vii7h')・dimReadings のどれでも、おなじ音にはおなじ tag。
 * 和音記号：藝大（島岡）の書きかた（PA.rn で部品から描く）。○＝準固有（同主短調からかりた）。転回形は右上の数字（Ⅱ¹、Ⅰ²）。
 *   短調の目標Ⅲ・Ⅶ（自然的短音階の長三和音）は「Ⅲ（自然）」「Ⅶ（自然）」と書いて、和声的短音階のⅢ（増）・Ⅶ（減）と区別する。
 *   コードネーム（dim7・m7(♭5) など）は H.symbol だけでつかう。
 * ならび：[ベース, 上の声（低い→高い）]。解決（すすみ先）はおなじならびで、それぞれの声がどこへ行くかをかえす。
 * 高さ：ベース40〜55、上の声55〜79（平均律・表示の音＝鳴らす音）。すべての和音がこの中（解決先は2まではみだすことがある）。
 * 声のすすみ：連続5度・連続8度、バスをふくむ減5度→完全5度、声の交差、調の導音の重複はつくらない（test/henka.test.mjs でたしかめる）。
 * 重変（𝄫）は正しいつづりでどうしても出るところだけ（♭の多い調のナポリ・準固有・副属の減七・Ⅴ7/♭Ⅱ）。PA.H／PA.Svg で♭♭と表示する。
 * 重嬰（x）は♯の多い調の副属和音と短調の導音で出る（PA.H／PA.Svg で太い x）。
 */
(function(){
  const H=PA.henka={}, mod=PA.mod;
  const ROMAN=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ'];
  H.ROMAN=ROMAN;
  // 調の音階（長調＝長音階、短調＝自然的短音階）で主音から d 番め（0＝主音、負・7以上も可）の半音の数
  const semi=(key,d)=>(key.minor?PA.NMIN:PA.MAJ)[mod(d,7)]+12*Math.floor(d/7);
  // 主音から lo 文字・so 半音上の音のつづり
  const sp=(key,lo,so)=>{const L=mod(key.l+lo,7);return {letter:L,acc:PA.spell(L,key.tpc+so)};};
  const pcOf=n=>mod(PA.NAT[n.letter]+n.acc,12);
  H.pcOf=pcOf;
  // 五線の位置（PA.stepOf とおなじ数えかた：ド4＝28）でつみかさねる。♭がついても♮でもおなじ位置になるように
  const stepAtOrAbove=(n,s0)=>s0+mod(n.letter-s0,7);
  const midiOfStep=(n,st)=>12*(Math.floor(st/7)+1)+PA.NAT[n.letter]+n.acc;
  // from の高さから、つづり n の音へ：up＝上へ、down＝下へ、leap＝上下近いほうではなく中心（center）に近いほう、near＝いちばん近い
  const move=(n,from,mv,center)=>{
    const p=pcOf(n), up=from+mod(p-from-1,12)+1, down=from-(mod(from-p-1,12)+1);
    if(mv==='up') return up;
    if(mv==='down') return down;
    if(mv==='leap') return Math.abs(up-center)<Math.abs(down-center)?up:down;
    return from+mod(p-from+6,12)-6;
  };
  const B_LO=40,B_HI=55,U_LO=55,U_HI=79,B_C=47,U_C=67;
  const mk=(key,v,midi)=>({...sp(key,v.lo,v.so),midi,role:v.role,tag:v.tag||null});
  /* 和音の列（chain）をつくる。chain[0]＝はじめの和音（v＝{lo,so,role,tag}）、chain[1..]＝つぎの和音（v に mv＝動きかた）
   * はじめの和音：ベースはファ2以上、上の声はラ3以上から、五線の位置で下からじゅんにつみかさねる（♭6と♮6がおなじ高さにくる）。
   * そのあと chains ぜんぶをおなじだけオクターブでうごかして音域におさめる（おなじ和音はどの関数から出してもおなじ高さ） */
  const chainOf=(key,chain)=>{
    const out=[];
    chain.forEach((ch,ci)=>{
      const prev=out[ci-1], notes=[];
      let st=0;
      ch.forEach((v,i)=>{
        const s=sp(key,v.lo,v.so);
        let m;
        if(!prev){st=i===0?17:i===1?26:st+1;st=stepAtOrAbove(s,st);m=midiOfStep(s,st);}
        else m=move(s,prev[i].midi,v.mv||'near',i===0?B_C:U_C);
        notes.push(mk(key,v,m));
      });
      out.push(notes);
    });
    return out;
  };
  const fam=(key,chains)=>{
    const outs=chains.map(c=>chainOf(key,c)), all=outs.flat();
    let best=null;
    for(const sb of [0,-12,12]) for(const su of [0,-12,12]){
      let pen=0,bs=0,us=0,nb=0,nu=0;
      all.forEach(ch=>{
        ch.forEach((n,i)=>{
          const m=n.midi+(i?su:sb), lo=i?U_LO:B_LO, hi=i?U_HI:B_HI;
          pen+=Math.max(0,lo-m,m-hi)*10;
          if(i){us+=m;nu++;}else{bs+=m;nb++;}
        });
        if(ch[0].midi+sb>=Math.min(...ch.slice(1).map(n=>n.midi+su))) pen+=1000;
      });
      pen+=Math.abs(bs/nb-B_C)+Math.abs(us/nu-U_C);
      if(!best||pen<best.pen) best={pen,sb,su};
    }
    return outs.map(o=>o.map(ch=>ch.map((n,i)=>({...n,midi:n.midi+(i?best.su:best.sb)}))));
  };
  const prog=(key,chain)=>fam(key,[chain])[0];
  // 調の音か（短調は自然的短音階。和声的・旋律的に上げた第7音・第6音は 'raised'）
  const inScale=(key,n)=>(key.minor?key.nat:key.scale).some(s=>s.letter===n.letter&&s.acc===n.acc);
  const isRaised=(key,n)=>key.minor&&[[6,11],[5,9]].some(([lo,so])=>{const s=sp(key,lo,so);return s.letter===n.letter&&s.acc===n.acc;});
  const tagChrom=(key,ns)=>ns.map(n=>n.tag||inScale(key,n)?n:{...n,tag:isRaised(key,n)?'raised':'chrom'});
  const V=(lo,so,role,tag,mv)=>({lo,so,role,tag,mv});

  /* ----- 1) ナポリの六（♭Ⅱの第1転回形）：♭2・4・♭6。ベース＝第3音（調の第4音）を重ねる。根音（♭2）はソプラノ ----- */
  const N6=key=>[
    V(3,5,'第3音（いちばん下）'),
    V(3,5,'第3音'),
    V(5,8,'第5音',key.minor?null:'borrowed'),
    V(1,1,'根音（下げた第2音）','low')
  ];
  const N6TOV=()=>[
    V(4,7,'Ⅴの根音',null,'up'),
    V(1,2,'Ⅴの第5音',null,'down'),
    V(4,7,'Ⅴの根音',null,'down'),
    V(6,11,'Ⅴの第3音（導音）','lt','down')
  ];
  const N6I64=key=>[
    V(4,7,'Ⅰの第5音（いちばん下）',null,'up'),
    V(2,semi(key,2),'Ⅰの第3音',null,'down'),
    V(4,7,'Ⅰの第5音',null,'down'),
    V(0,0,'Ⅰの根音',null,'down')
  ];
  const I64V=()=>[
    V(4,7,'Ⅴの根音',null,'near'),
    V(1,2,'Ⅴの第5音',null,'down'),
    V(4,7,'Ⅴの根音',null,'near'),
    V(6,11,'Ⅴの第3音（導音）','lt','down')
  ];
  const n6fam=key=>fam(key,[[N6(key),N6TOV()],[N6(key),N6I64(key),I64V()]]);
  H.neapolitan=key=>n6fam(key)[0][0];
  // N6 → Ⅴ：根音（♭2）は導音へ減3度下へ、第5音（♭6）はⅤの根音へ、ベースはⅤへ上へ。上の第3音はⅤの第5音へ（平行8度をさける）
  H.toV=key=>n6fam(key)[0][1];
  // N6 → Ⅰ6/4 → Ⅴ（[Ⅰ6/4, Ⅴ] をかえす）
  H.viaI64=key=>{const r=n6fam(key)[1];return [r[1],r[2]];};

  /* ----- 2) 準固有和音（長調で、同主短調からかりる和音。かりた音に tag 'borrowed'） ----- */
  H.BORROWED_IDS=['iv','ii_dim','ii_hdim7','bVI','V9_b9','vii_dim7'];
  // label：芸大の和音記号（○＝準固有）。ii_dim は第1転回形（ベース＝第3音）で鳴らすのでⅡ6
  H.JUN='○';
  // rn：記号の部品（藝大式。PA.rn）。ii_dim は第1転回形（ベース＝第3音）で鳴らすので inv:1。vii_dim7 はⅤ9の根音省略（斜線）
  //   label・diatonic：ただの文字（PA.rnText とおなじ。前のバージョンの呼び名のかわり）
  H.BORROWED={
    iv:{rn:{deg:4},next:'Ⅰ'},
    ii_dim:{rn:{deg:2,inv:1},next:'Ⅴ',inv:1},
    ii_hdim7:{rn:{deg:2,form:7},next:'Ⅴ7'},
    bVI:{rn:{deg:6},next:'Ⅴ'},
    V9_b9:{rn:{deg:5,form:9},next:'Ⅰ'},
    vii_dim7:{rn:{deg:5,form:9,omit:true},next:'Ⅰ'}
  };
  Object.values(H.BORROWED).forEach(B=>{B.label=PA.rnText({...B.rn,borrowed:true});B.diatonic=PA.rnText(B.rn);});
  // b＝true でかりた形、false で長調のふつうの形（6・3のほかはおなじならび・おなじ高さ）
  const BSPEC={
    iv:b=>[V(3,5,'根音'),V(0,0,'第5音'),V(3,5,'根音'),b?V(5,8,'第3音（下げた第6音）','borrowed'):V(5,9,'第3音')],
    ii_dim:b=>[V(3,5,'第3音（いちばん下）'),V(1,2,'根音'),V(3,5,'第3音'),b?V(5,8,'第5音（下げた第6音）','borrowed'):V(5,9,'第5音')],
    ii_hdim7:b=>[V(1,2,'根音'),b?V(5,8,'第5音（下げた第6音）','borrowed'):V(5,9,'第5音'),V(7,12,'第7音','seventh'),V(3,5,'第3音')],
    bVI:b=>b?[V(5,8,'根音（下げた第6音）','borrowed'),V(0,0,'第3音'),V(2,3,'第5音（下げた第3音）','borrowed'),V(0,0,'第3音')]
            :[V(5,9,'根音'),V(0,0,'第3音'),V(2,4,'第5音'),V(0,0,'第3音')],
    V9_b9:b=>[V(4,7,'根音'),V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),b?V(5,8,'第9音（下げた第6音）','borrowed'):V(5,9,'第9音','ninth')],
    // 導音からつむ形＝Ⅴ9の根音省略（名前・tag はⅤ9から見たもの。H.vii7とおなじ）
    vii_dim7:b=>[V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),b?V(5,8,'第9音（下げた第6音）','borrowed'):V(5,9,'第9音（たかいほう）','ninth'),V(1,2,'第5音')]
  };
  const NEXT={
    iv:()=>[V(0,0,'Ⅰの根音',null,'leap'),V(0,0,'Ⅰの根音',null,'near'),V(2,4,'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down')],
    ii_dim:()=>[V(4,7,'Ⅴの根音',null,'up'),V(6,11,'Ⅴの第3音（導音）','lt','down'),V(1,2,'Ⅴの第5音',null,'down'),V(4,7,'Ⅴの根音',null,'down')],
    ii_hdim7:()=>[V(4,7,'Ⅴの根音',null,'leap'),V(4,7,'Ⅴの根音',null,'down'),V(6,11,'Ⅴの第3音（導音）','lt','down'),V(3,5,'Ⅴの第7音','seventh','near')],
    bVI:()=>[V(4,7,'Ⅴの根音',null,'down'),V(6,11,'Ⅴの第3音（導音）','lt','down'),V(4,7,'Ⅴの根音',null,'up'),V(1,2,'Ⅴの第5音',null,'up')],
    V9_b9:()=>[V(0,0,'Ⅰの根音',null,'leap'),V(0,0,'Ⅰの根音',null,'up'),V(2,4,'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down')],
    vii_dim7:()=>[V(0,0,'Ⅰの根音',null,'up'),V(2,4,'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down'),V(0,0,'Ⅰの根音',null,'down')]
  };
  const bfam=(key,id)=>key.minor||!BSPEC[id]?null:fam(key,[[BSPEC[id](true),NEXT[id]()],[BSPEC[id](false),NEXT[id]()]]);
  H.borrowed=(key,id)=>{const f=bfam(key,id);return f&&f[0][0];};
  H.diatonic=(key,id)=>{const f=bfam(key,id);return f&&f[1][0];};
  // つぎの和音（かりた形・ふつうの形のどちらからすすんでもおなじ音。b＝false はふつうの形からすすんだばあい）
  H.nextOf=(key,id,b=true)=>{const f=bfam(key,id);return f&&f[b?0:1][1];};

  /* ----- 2b) ドリアのⅣ（短調だけ）：Ⅳの第3音（音階の6ばんめ）を半音上げた長三和音（第3音上方変位。島岡の書きかたで「＋Ⅳ」） -----
   * 上げた第6音は導音へ2度上がる（旋律的短音階ののぼる形：6→7）。ふつうのⅣのままだと、6→導音が増2度になる。
   * カデンツ Ⅰ → Ⅳ（ドリア／ふつう）→ Ⅴ → Ⅰ。ならび [ベース | 主音, 第4音, 第6音]（第3音＝6ばんめをソプラノに）
   *   Ⅰ [1 | 1, 3, 5] → Ⅳ [4 | 1, 4, 6]（主音はそのまま、3→4、5→6）→ Ⅴ [5 | 5, 2, 7]（主音→5へ下、4→2へ下、6→7へ上）→ Ⅰ [1 | 5, 3, 1]
   *   （Ⅳ→Ⅴで主音→2へ上がると、ベースと連続5度。主音→7は導音が2つになる）
   * 長調ではつかわない（長調のⅣはもともと長三和音）：長調の key では null */
  const DOR_I=()=>[V(0,0,'Ⅰの根音（いちばん下）'),V(0,0,'Ⅰの根音'),V(2,3,'Ⅰの第3音'),V(4,7,'Ⅰの第5音')];
  const DOR_IV=(raised,bmv)=>[V(3,5,'根音（いちばん下）',null,bmv),V(0,0,'第5音',null,'near'),V(3,5,'根音',null,'up'),
    raised?V(5,9,'第3音（上げた6ばんめ）','raised','up'):V(5,8,'第3音',null,'up')];
  const DOR_V=()=>[V(4,7,'Ⅴの根音',null,'up'),V(4,7,'Ⅴの根音',null,'down'),V(1,2,'Ⅴの第5音',null,'down'),V(6,11,'Ⅴの第3音（導音）','lt','up')];
  const DOR_I2=()=>[V(0,0,'Ⅰの根音',null,'leap'),V(4,7,'Ⅰの第5音',null,'near'),V(2,3,'Ⅰの第3音',null,'up'),V(0,0,'Ⅰの根音',null,'up')];
  // Ⅰ→Ⅳのベースは4度上か5度下。音域（ベース40〜55・上の声55〜79）からのはみだしがすくないほう
  //   （Ⅳ→Ⅴで上の声の主音が5へ4度下がるので、ベースが高いとⅤのベースと上の声がぶつかる）
  const dfam=key=>{
    if(!key.minor) return null;
    let best=null;
    ['up','down'].forEach(bmv=>{
      const f=fam(key,[[DOR_I(),DOR_IV(true,bmv),DOR_V(),DOR_I2()],[DOR_I(),DOR_IV(false,bmv),DOR_V(),DOR_I2()]]);
      let pen=0;
      f.flat().forEach(ch=>{
        ch.forEach((n,i)=>{const lo=i?U_LO:B_LO, hi=i?U_HI:B_HI;pen+=Math.max(0,lo-n.midi)+2*Math.max(0,n.midi-hi);}); // 高すぎる音（加線の多い音）をより重く
        if(ch[0].midi>=ch[1].midi) pen+=100;
      });
      if(!best||pen<best.pen) best={pen,f};
    });
    return best.f;
  };
  // ドリアのⅣ（[4 | 1, 4, ♮6]）。raised＝false でふつうのⅣ（[4 | 1, 4, 6]。おなじならび・おなじ高さ）
  H.dorian=(key,raised=true)=>{const f=dfam(key);return f&&f[raised?0:1][1];};
  // ドリアのⅣ（ふつうのⅣ）→ Ⅴ（どちらからでもおなじ音）
  H.dorianToV=key=>{const f=dfam(key);return f&&f[0][2];};
  // カデンツ [Ⅰ, Ⅳ（ドリア／ふつう）, Ⅴ, Ⅰ]
  H.dorianCad=(key,raised=true)=>{const f=dfam(key);return f&&f[raised?0:1];};

  /* ----- 3) 副属和音（x度調のⅤ7と、x度調のⅤ9の根音省略。記号は2段） -----
   * target：目標の和音の度数（2〜7）。長調ⅡⅢⅣⅤⅥ、短調ⅢⅣⅤⅥⅦ（Ⅶ＝自然的短音階の長三和音）
   * kind：'V7'＝目標のⅤ7（4つの音がそろった形 [根音 | 5, 7, 3]。PA.chroma.dd とおなじならび → 第5音をはぶいた目標の和音）、'vii7'＝目標の導音の七の和音＝Ⅴ9の根音省略で短9度の減七（目標が長・短どちらでも。
   *        PA.chroma の減七/Ⅴとおなじきまり）、'vii7h'＝長9度の根音省略＝半減七（目標が長三和音で、長9度が調の音のときだけ。
   *        短調のⅤ度調のⅤ9の根音省略は短9度だけ：PA.chroma.ddStack(key,'dd9',true) とおなじきまりで null）
   * x度調のⅤ9の根音省略 → x：ならび [導音 | 7, 9, 5] → [根音 | 3, 5, 根音]（根音を重ねる）。9は5の完全4度下にあるので、
   *   5 → 根音と9 → 5は平行4度（よい）。連続5度になるのは9が5より上にあるときだけ。
   *   目標の第3音へ上げると、目標がⅤのとき調の導音が2つになるのでしない */
  H.targets=key=>key.minor?[3,4,5,6,7]:[2,3,4,5,6];
  const tgt=(key,t)=>{
    if(!H.targets(key).includes(t)) return null;
    const TL=t-1, rs=semi(key,TL);
    let q3=mod(semi(key,TL+2)-rs,12);
    const q5=mod(semi(key,TL+4)-rs,12);
    if(key.minor&&t===5) q3=4; // 短調のⅤは和声的短音階（導音）で長三和音
    const T={TL,rs,q3,q5,minor:q3===3,t};
    // 長9度（目標の第6音＝rs+9）・短9度（rs+8）が調の音か（長調＝長音階、短調＝自然的短音階）
    T.maj9InKey=mod(semi(key,TL+5)-rs,12)===9;
    T.min9InKey=mod(semi(key,TL+5)-rs,12)===8;
    // 短調のⅢ・Ⅶは自然的短音階の長三和音（和声的短音階のⅢ＝増三和音、Ⅶ＝減三和音とはちがう）
    T.natural=key.minor&&(t===3||t===7);
    return T;
  };
  const tSpec=(T,mv)=>[V(T.TL,T.rs,'目標の根音',null,mv[0]),V(T.TL,T.rs,'目標の根音',null,mv[1]),V(T.TL+2,T.rs+T.q3,'目標の第3音',null,mv[2]),V(T.TL+4,T.rs+T.q5,'目標の第5音',null,mv[3])];
  const secSpec=(T,kind)=>{
    const {TL,rs}=T;
    if(kind==='V7') return {
      ch:[V(TL+4,rs+7,'根音'),V(TL+1,rs+2,'第5音'),V(TL+3,rs+5,'第7音','seventh'),V(TL+6,rs+11,'第3音（導音）','lt')],
      res:[V(TL,rs,'目標の根音',null,'leap'),V(TL,rs,'目標の根音',null,'down'),V(TL+2,rs+T.q3,'目標の第3音',null,'down'),V(TL,rs,'目標の根音',null,'up')]
    };
    if(kind==='vii7'||(kind==='vii7h'&&!T.minor&&T.maj9InKey)){
      const n9=kind==='vii7'?V(TL+5,rs+8,'第9音（ひくいほう）','b9'):V(TL+5,rs+9,'第9音（たかいほう）','ninth');
      return {
        ch:[V(TL+6,rs+11,'第3音（導音）','lt'),V(TL+3,rs+5,'第7音','seventh'),n9,V(TL+1,rs+2,'第5音')],
        res:[V(TL,rs,'目標の根音',null,'up'),V(TL+2,rs+T.q3,'目標の第3音',null,'down'),V(TL+4,rs+T.q5,'目標の第5音',null,'down'),V(TL,rs,'目標の根音',null,'down')]
      };
    }
    return null;
  };
  H.secondary=(key,target,kind='V7')=>{
    const T=tgt(key,target), s=T&&secSpec(T,kind); if(!s) return null;
    return tagChrom(key,prog(key,[s.ch,s.res])[0]);
  };
  H.resolveSecondary=(key,target,kind='V7')=>{
    const T=tgt(key,target), s=T&&secSpec(T,kind); if(!s) return null;
    return prog(key,[s.ch,s.res])[1];
  };
  // 目標の三和音だけ（根音位置・根音を重ねる）
  H.targetTriad=(key,target)=>{
    const T=tgt(key,target); if(!T) return null;
    return prog(key,[tSpec(T,[])])[0];
  };
  H.targetIsMinor=(key,target)=>{const T=tgt(key,target);return T?T.minor:null;};
  // 短調のⅢ・Ⅶ（自然的短音階の長三和音）か
  H.targetIsNatural=(key,target)=>{const T=tgt(key,target);return T?T.natural:null;};

  /* ----- 4) Ⅴ9の根音省略（短調＝減七、長調＝長調の形）。id は 'vii7'（まえからの名前） -----
   * 長調：半減七（7・2・4・6）、短調：減七（♯7・2・4・♭6）。ならび [導音 | 4, 6, 2]
   * 名前と tag はⅤ9から見たもの（導音＝第3音 'lt'、4＝第7音 'seventh'、6＝第9音 'ninth'／'b9'、2＝第5音）。
   *   H.vii7(key,'vii') だけ、名前を導音を根音として見た名前（導音＝根音、2＝第3音、4＝第5音、6＝第7音）にする（tag はかわらない）。
   *   藝大式では使わない見かたなので、画面ではつかわない（テストでくらべるためにのこす）。
   * Ⅰへ：導音 → 主音（上へ）、4 → 3（下へ）、6 → 5（下へ）、2 → 主音（下へ）＝根音を重ねたⅠ。
   *   このならびでは6が2の完全4度（短調は増4度）下にあるので、6→5と2→1は平行4度（よい）。
   *   2が6の下にあって5度になるならびなら、2→1は連続5度（長調）になる */
  const VII_VIEW=['根音（導音）','第5音','第7音','第3音'];
  const viiSpec=(key,six,sixRole,sixTag)=>[
    V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),V(5,six,sixRole,sixTag),V(1,2,'第5音')
  ];
  const IRES=key=>[V(0,0,'Ⅰの根音',null,'up'),V(2,semi(key,2),'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down'),V(0,0,'Ⅰの根音',null,'down')];
  const sixOf=key=>semi(key,5); // 長調♮6、短調♭6
  // 調のⅤ9の根音省略・長調の形・減七をいっしょにつくって、おなじ高さにそろえる
  const vfam=key=>fam(key,[
    [viiSpec(key,sixOf(key),key.minor?'第9音（ひくいほう）':'第9音（たかいほう）',key.minor?'b9':'ninth'),IRES(key)],
    [viiSpec(key,9,key.minor?'第9音（上げた第6音）':'第9音（たかいほう）',key.minor?'raised':'ninth'),IRES(key)],
    [viiSpec(key,8,key.minor?'第9音（ひくいほう）':'第9音（下げた第6音）',key.minor?'b9':'borrowed'),IRES(key)]
  ]);
  H.vii7=(key,view)=>{const v=vfam(key)[0][0];return view==='vii'?v.map((n,i)=>({...n,role:VII_VIEW[i]})):v;};
  H.vii7ToI=key=>vfam(key)[0][1];
  // 根音省略のⅤ9（H.vii7とおなじ音・おなじ名前。名前をわけて見せたいときは H.vii7(key,'vii')）
  H.rootless9=key=>vfam(key)[0][0];
  // Ⅴ9（根音あり・第5音をはぶく）：[5 | 7, 4, 9]（9は長調♮6、短調♭6）
  const v9Spec=key=>[V(4,7,'根音'),V(6,11,'第3音（導音）','lt'),V(3,5,'第7音','seventh'),V(5,sixOf(key),key.minor?'第9音（ひくいほう）':'第9音（たかいほう）',key.minor?'b9':'ninth')];
  const v9fam=key=>prog(key,[v9Spec(key),[V(0,0,'Ⅰの根音',null,'leap'),V(0,0,'Ⅰの根音',null,'up'),V(2,semi(key,2),'Ⅰの第3音',null,'down'),V(4,7,'Ⅰの第5音',null,'down')]]);
  H.v9=key=>v9fam(key)[0];
  H.v9ToI=key=>v9fam(key)[1];
  // 半減七と減七のくらべ：ちがうのは第9音（♮6と♭6）だけ。diff＝その音のならびの番号
  // halfInKey／dimInKey＝その調の和音か。短調の half（♮6＝旋律的短音階の上げた第6音）は音のくらべだけで、
  //   短調の和音（和音記号）としてはつかわない。長調の dim は準固有（○Ⅴ9の根音省略）
  H.viiCompare=key=>{const f=vfam(key);return {half:f[1][0],dim:f[2][0],diff:2,toI:f[0][1],halfInKey:!key.minor,dimInKey:key.minor};};

  /* ----- 5) 異名同音の読み替え ----- */
  const dblCount=ns=>ns.filter(n=>Math.abs(n.acc)>1).length;
  // 短調（PA.minorKey とおなじ形）を主音の文字と変化記号からつくる。PA.MINOR_KEYS にないつづり（変イ短調・変ニ短調・
  // 変ト短調・嬰イ短調）もつくれる。そのときは enh:true、idx＝おなじ主音の高さの PA.MINOR_KEYS の番号
  const minorOf=(l,a)=>{
    const i=PA.MINOR_KEYS.findIndex(([L,A])=>L===l&&A===a);
    if(i>=0) return PA.minorKey(i);
    const tpc=mod(PA.NAT[l]+a,12), idx=PA.MINOR_KEYS.findIndex(([L,A])=>mod(PA.NAT[L]+A,12)===tpc), tonicMidi=57+mod(tpc-57,12);
    const nat=PA.buildScale(l,tpc,tonicMidi,PA.NMIN), harm=PA.buildScale(l,tpc,tonicMidi,PA.HMIN);
    harm[6].raised=true;
    const sig={}; nat.forEach(n=>sig[n.letter]=n.acc);
    const rl=(l+2)%7, rpc=mod(tpc+3,12);
    const rel={l:rl,a:PA.spell(rl,rpc),minor:false,tpc:rpc,tonicMidi:60+rpc}; rel.scale=PA.buildScale(rl,rpc,60+rpc,PA.MAJ);
    const par={l,a,minor:false,tpc,tonicMidi,scale:PA.buildScale(l,tpc,tonicMidi,PA.MAJ)};
    return {idx,l,a,tpc,tonicMidi,minor:true,nat,harm,scale:harm,sig,rel,par,lt:harm[6],natLT:nat[6],ltType:harm[6].acc,enh:true};
  };
  H.minorOf=minorOf;
  /* 減七の4つの読みかた：おなじけんばん（おなじ高さ）を、4つの短調のⅤ9の根音省略として書く
   * input：ピッチクラス4つの配列／減七の音（{letter,acc,midi}）の配列／key（長調なら同主短調の減七＝準固有の ○Ⅴ9の根音省略、短調ならその調のⅤ9の根音省略）
   * かえす：[{keyIdx, key, lt, spelling, resolution, given, resInv, ninthInBass, next}]
   *   given（わたしたつづり・調）の読みがさいしょ、あとは主音が短3度ずつ上へ。
   *   given の読みはわたしたつづりのまま（必要なら PA.MINOR_KEYS にない調：key.enh＝true、keyIdx＝おなじ高さの調の番号）。
   *   そのほかの読みは重嬰・重変のすくない調（嬰ニ短調より変ホ短調。嬰ト短調は変イ短調のかわりにそのまま）。
   * 名前・tag はⅤ9の根音省略として：導音＝第3音 'lt'、2＝第5音、4＝第7音 'seventh'、♭6＝第9音（短9度） 'b9'
   * resolution（Ⅰ）：導音→主音、4→♭3、♭6→5。2は上の声なら主音へ（下へ）。ベースの2は♭3へ上がる（Ⅰ6。
   *   主音へ下りると♭6→5とバスをふくむ減5度→完全5度になる）。
   *   resInv：解決のⅠの形（0＝基本形、1＝Ⅰ6、2＝Ⅰ6/4）。
   *   ninthInBass：ベースが第9音（♭6）＝Ⅴ9の第4転回形にあたる形（芸大ではふつうつかわない）。解決はⅠ6/4になるので、
   *   next にそのあとのⅤ（おなじならび）を入れる（それ以外は next＝null）。ふつうのⅤ9の根音省略→Ⅰとして見せないこと。
   *   密集（短3度でとなりあう声がある）のときは、その2つの声が同度になることがある（ほかによいすすみかたがない） */
  const DIM_REL={11:[6,'第3音（導音）','lt'],2:[1,'第5音',null],5:[3,'第7音','seventh'],8:[5,'第9音（ひくいほう）','b9']};
  H.dimReadings=input=>{
    let pcs, midis=null, givenKey=null, givenSp=null;
    if(input&&typeof input==='object'&&!Array.isArray(input)&&input.tpc!=null&&input.l!=null){
      givenKey=input; pcs=[11,2,5,8].map(x=>mod(input.tpc+x,12));
    }else if(Array.isArray(input)&&input.length===4&&input.every(n=>n&&typeof n==='object')){
      midis=input.map(n=>n.midi).sort((a,b)=>a-b); pcs=midis.map(m=>mod(m,12));
      givenSp=input;
    }else if(Array.isArray(input)&&input.length===4&&input.every(Number.isFinite)) pcs=input.map(x=>mod(x,12));
    else return null;
    const set=[...new Set(pcs)].sort((a,b)=>a-b);
    if(set.length!==4||set.some((p,i)=>i&&p-set[i-1]!==3)) return null;
    if(!midis){
      const a=58+mod(set.find(p=>p===10||p===11||p===0)-10,12);
      midis=[a-6,a,a+3,a+9];
    }
    const reading=key=>({keyIdx:key.idx,key,given:false,spelling:midis.map(m=>{
      const r=mod(m-key.tpc,12), [lo,role,tag]=DIM_REL[r];
      return {...sp(key,lo,r),midi:m,role,tag};
    })});
    const same=r=>givenSp.every(g=>r.spelling.some(n=>n.midi===g.midi&&n.letter===g.letter&&n.acc===g.acc));
    const out=set.map(p=>{
      const t=mod(p+1,12);
      // わたした調・つづりの読み
      if(givenKey&&givenKey.tpc===t){const r=reading(minorOf(givenKey.l,givenKey.a));r.given=true;return r;}
      if(givenSp){
        const g=givenSp.find(n=>pcOf(n)===p), L=(g.letter+1)%7, a=PA.spell(L,t);
        if(Math.abs(a)<=1){const r=reading(minorOf(L,a));if(same(r)){r.given=true;return r;}}
      }
      // そのほか：PA.MINOR_KEYS の中で重嬰・重変のすくない調
      let best=null;
      PA.MINOR_KEYS.forEach(([L,A],i)=>{
        if(mod(PA.NAT[L]+A,12)!==t) return;
        const r=reading(PA.minorKey(i)), sc=dblCount(r.spelling);
        if(!best||sc<best.sc) best={r,sc};
      });
      return best.r;
    });
    out.forEach(r=>{
      const key=r.key, t=key.tpc, sv=r.spelling;
      const I=(lo,so,midi,role)=>({...sp(key,lo,so),midi,role,tag:null});
      const tgt=sv.map(n=>{
        const rel=mod(n.midi-t,12);
        if(rel===11) return [I(7,12,n.midi+1,'主音（根音）')];
        if(rel===5) return [I(2,3,n.midi-2,'第3音')];
        if(rel===8) return [I(4,7,n.midi-1,'第5音')];
        return [I(0,0,n.midi-2,'主音（根音）'),I(2,3,n.midi+1,'第3音')];
      });
      const res=tgt.map(c=>c[0]);
      tgt.forEach((c,i)=>{
        if(c.length<2) return;
        if(i===0){res[0]=c[1];return;} // ベースの2は♭3へ（Ⅰ6）
        // 上の声の2は主音へ（下へ）。となりの声と交差するときだけ♭3へ
        const lo=res[i-1].midi, hi=i<res.length-1?res[i+1].midi:Infinity;
        res[i]=c.find(x=>x.midi>lo&&x.midi<hi)||c.find(x=>x.midi>=lo&&x.midi<=hi)||c[0];
      });
      r.resolution=res;
      r.lt=sv.find(n=>n.tag==='lt');
      const bassRel=mod(sv[0].midi-t,12);
      r.resInv=bassRel===11?0:bassRel===8?2:1;
      r.ninthInBass=bassRel===8;
      r.next=r.ninthInBass?i64ToV(key,res):null;
    });
    const g=out.find(r=>r.given)||out.find(r=>r.lt.midi===midis[0]), t0=g.key.tpc;
    out.sort((a,b)=>mod(a.key.tpc-t0,12)-mod(b.key.tpc-t0,12));
    return out;
  };
  // Ⅰ6/4（ベース＝第5音）→ Ⅴ：ベースはそのまま、主音 → 導音（下へ）か2（上へ）か5（下へ）、♭3 → 2（下へ）、5 → そのまま。
  // 導音は1つだけ、声の交差・連続5度／8度なし、動きの合計がいちばん小さいものをえらぶ（同度は密集でさけられないときだけ）
  const i64ToV=(key,ch)=>{
    const t=key.tpc;
    const O=(lo,so,midi,role,tag)=>({...sp(key,lo,so),midi,role,tag:tag||null});
    const opts=ch.map((n,i)=>{
      const rel=mod(n.midi-t,12);
      if(i===0||rel===7) return [O(4,7,n.midi,'Ⅴの根音')];
      if(rel===0) return [O(6,11,n.midi-1,'Ⅴの第3音（導音）','lt'),O(1,2,n.midi+2,'Ⅴの第5音'),O(4,7,n.midi-5,'Ⅴの根音')];
      return [O(1,2,n.midi-1,'Ⅴの第5音')];
    });
    let best=null, strict=true;
    const walk=(i,acc)=>{
      if(i===opts.length){
        if(acc.filter(n=>n.tag==='lt').length!==1) return;
        for(let j=1;j<acc.length;j++) if(strict?acc[j].midi<=acc[j-1].midi:acc[j].midi<acc[j-1].midi) return;
        for(let a=0;a<acc.length;a++) for(let b=a+1;b<acc.length;b++){
          const x=mod(ch[b].midi-ch[a].midi,12), y=mod(acc[b].midi-acc[a].midi,12);
          if(x===y&&(x===0||x===7)&&ch[a].midi!==acc[a].midi&&ch[b].midi!==acc[b].midi) return;
        }
        const cost=acc.reduce((s,n,j)=>s+Math.abs(n.midi-ch[j].midi),0);
        if(!best||cost<best.cost) best={cost,acc:[...acc]};
        return;
      }
      opts[i].forEach(o=>{acc.push(o);walk(i+1,acc);acc.pop();});
    };
    walk(0,[]);
    if(!best){strict=false;walk(0,[]);} // 密集で同度がさけられないときだけ
    return best?best.acc:null;
  };
  // ドイツの6と、おなじけんばんのⅤ7/♭Ⅱ（♯4を♭5と読みかえる）。PA.chroma の増六（aug6・gerToI64・aug6ToV）の音をつかう
  // かえす：{ger, gerRes:[Ⅰ6/4, Ⅴ], v7, v7Res(♭Ⅱ。第3音と第5音がどちらも根音へすすむので2つの声がおなじ音), diff:3, bassShift}
  // ベースが55より上になる調では、ベース（ならびの0番）だけを ger・gerRes・v7・v7Res ぜんぶいっしょに1オクターブ下げる
  //   （bassShift＝-12。増6度は複音程になる。上の声は PA.chroma とおなじ高さ。PA.chroma の結果はかえない）
  H.ger6Vs7=key=>{
    const C=PA.chroma, raw=C.aug6(key,'ger'), sh=raw[0].midi>B_HI?-12:0;
    const low=ns=>ns.map((n,i)=>({...n,midi:n.midi+(i?0:sh)}));
    const ger=low(raw);
    const v7=[
      {...sp(key,5,8),midi:ger[0].midi,role:'根音',tag:null},
      {...sp(key,0,0),midi:ger[1].midi,role:'第3音（ナポリの和音への導音）',tag:'lt'},
      {...sp(key,2,3),midi:ger[2].midi,role:'第5音',tag:null},
      {...sp(key,4,6),midi:ger[3].midi,role:'第7音','tag':'seventh'}
    ];
    const tn=(lo,so,from,mv,role)=>{const s=sp(key,lo,so);return {...s,midi:move(s,from,mv,B_C),role,tag:null};};
    const v7Res=[
      tn(1,1,v7[0].midi,'leap','ナポリの和音の根音'),
      tn(1,1,v7[1].midi,'up','ナポリの和音の根音'),
      tn(1,1,v7[2].midi,'down','ナポリの和音の根音'),
      tn(3,5,v7[3].midi,'down','ナポリの和音の第3音')
    ];
    return {ger,gerRes:[low(C.gerToI64(key)),low(C.aug6ToV(key,'ger'))],v7,v7Res,diff:3,bassShift:sh};
  };

  /* ----- コードネームと和音記号（めやす） ----- */
  const nameOf=n=>PA.LET_EN[n.letter]+PA.ACC[n.acc];
  const cs=(root,suf,bass)=>PA.H(nameOf(root)+suf+(bass?'/'+nameOf(bass):''));
  H.chordName=cs;
  const d=(key,lo,so)=>sp(key,lo,so);
  const BSYM={
    iv:[k=>cs(d(k,3,5),'m'),k=>cs(d(k,3,5),'')],
    ii_dim:[k=>cs(d(k,1,2),'dim',d(k,3,5)),k=>cs(d(k,1,2),'m',d(k,3,5))],
    ii_hdim7:[k=>cs(d(k,1,2),'m7(♭5)'),k=>cs(d(k,1,2),'m7')],
    bVI:[k=>cs(d(k,5,8),''),k=>cs(d(k,5,9),'m')],
    V9_b9:[k=>cs(d(k,4,7),'7(♭9)'),k=>cs(d(k,4,7),'9')],
    vii_dim7:[k=>cs(d(k,6,11),'dim7'),k=>cs(d(k,6,11),'m7(♭5)')]
  };
  // what：'N6'｜'borrowed'(a＝id)｜'diatonic'(a＝id)｜'secondary'(a＝target, b＝kind)｜'target'(a＝target)｜'vii7'｜'v9'｜'v7bII'｜'bII'
  //   ｜'dorian'（ドリアのⅣ。短調だけ）｜'minorIV'（短調のふつうのⅣ）
  H.symbol=(key,what,a,b)=>{
    if(what==='dorian') return key.minor?cs(d(key,3,5),''):'';
    if(what==='minorIV') return key.minor?cs(d(key,3,5),'m'):'';
    if(what==='N6') return cs(d(key,1,1),'',d(key,3,5));
    if(what==='bII') return cs(d(key,1,1),'');
    if(what==='borrowed'||what==='diatonic') return key.minor||!BSYM[a]?'':BSYM[a][what==='borrowed'?0:1](key);
    if(what==='target'){const T=tgt(key,a);return T?cs(d(key,T.TL,T.rs),T.minor?'m':''):'';}
    if(what==='secondary'){
      const T=tgt(key,a), k=b||'V7'; if(!T||!secSpec(T,k)) return '';
      if(k==='V7') return cs(d(key,T.TL+4,T.rs+7),'7');
      return cs(d(key,T.TL+6,T.rs+11),k==='vii7'?'dim7':'m7(♭5)');
    }
    if(what==='vii7') return cs(d(key,6,11),key.minor?'dim7':'m7(♭5)');
    if(what==='v9') return cs(d(key,4,7),key.minor?'7(♭9)':'9');
    if(what==='v7bII') return cs(d(key,5,8),'7');
    return '';
  };
  // 和音記号（藝大式・PA.rn の部品。○＝準固有、和音の種類（減・半減）は書かない）
  //   N6：ナポリの六＝Ⅱの根音下方変位・第1転回形（長調では下げた第6音をかりるので ○ もつける。先生に確認まち）。bII：その基本形
  //   target：短調のⅢ・Ⅶは natural（「（自然）」。自然的短音階の長三和音）
  //   secondary：'V7'＝○度調のⅤ7（2段：上の小さい数字＝目標、下の大きい数字＝Ⅴ）、'vii7'・'vii7h'＝○度調のⅤ9の根音省略
  //     （'vii7' は短9度。目標が長三和音で短9度が調にない音なら、目標の同主短調からかりた形なので ○）
  //   vii7：その調のⅤ9の根音省略（減七・長調の形）。v9：Ⅴ9。v7bII：ナポリの調（下げたⅡ度調）のⅤ7
  //   o.voiced：このアプリのならび（いちばん下が導音）で鳴らす和音の記号。根音省略のⅤ9は第3音がいちばん下なので第1転回形（¹）をつける
  //   dorian：ドリアのⅣ＝Ⅳの第3音上方変位（短調だけ。印の形は先生に確認まち：PA.rn の alt3）
  H.rnParts=(key,what,a,b,o={})=>{
    const v1=o.voiced?{inv:1}:{};
    if(what==='dorian') return key.minor?{deg:4,alt3:'up',name:'ivd'}:null;
    if(what==='N6') return {deg:2,rootDown:true,inv:1,...(key.minor?{}:{borrowed:true}),name:'n6'};
    if(what==='bII') return {deg:2,rootDown:true,...(key.minor?{}:{borrowed:true})};
    if(what==='borrowed'||what==='diatonic'){
      const B=!key.minor&&H.BORROWED[a]; if(!B) return null;
      const p={...B.rn,...(B.rn.omit?v1:{})};
      return what==='borrowed'?{...p,borrowed:true}:p;
    }
    if(what==='target'){const T=tgt(key,a);return T?{deg:a,...(T.natural?{natural:true}:{})}:null;}
    if(what==='secondary'){
      const T=tgt(key,a), k=b||'V7'; if(!T||!secSpec(T,k)) return null;
      const nat=T.natural?{natural:true}:{};
      if(k==='V7') return {of:a,deg:5,form:7,...nat};
      return {of:a,deg:5,form:9,omit:true,...v1,...(k==='vii7'&&!T.minor&&!T.min9InKey?{borrowed:true}:{}),...nat};
    }
    if(what==='vii7') return {deg:5,form:9,omit:true,...v1};
    if(what==='v9') return {deg:5,form:9};
    if(what==='v7bII') return {of:2,ofDown:true,deg:5,form:7};
    return null;
  };
  // ただの文字（○Ⅳ、ⅡのⅤ₇ など）。画面の記号は H.rn（PA.rn）で描く
  H.label=(key,what,a,b,o)=>{const p=H.rnParts(key,what,a,b,o);return p?PA.rnText(p):'';};
  H.rn=(key,what,a,b,o)=>{const p=H.rnParts(key,what,a,b,o);return p?PA.rn(p):'';};
  H.aria=(key,what,a,b,o)=>{const p=H.rnParts(key,what,a,b,o);return p?PA.rnAria(p):'';};
})();
/* ===== 調の出しかた（クイズ用の調のふくろ）と24調チェック表 =====
 * 調の id：'M0'〜'M12'＝PA.MAJOR_KEYS の番号、'm0'〜'm12'＝PA.MINOR_KEYS の番号（26こ。嬰ヘ長調／変ト長調・嬰ニ短調／変ホ短調は
 *   おなじ音の調の2つの書きかたなので、26こで「24調」）
 * TIERS：調号の数でわける。easy 0〜1、normal 2〜3、hard 4〜5、all ぜんぶ（6も）
 * const deck=PA.keyDeck.create({quiz:'minor-quiz', tier:'easy', modes:['major','minor'], weak:true, rng, now})
 *   deck.draw(filter?) → {minor, idx, id}（えらべる調がないときは null）
 *     ふくろ：えらべる調をぜんぶ1つずつ入れてまぜ、ふくろがからになるまでおなじ調は出ない。
 *     新しいふくろの1つめは、いま出した調にしない。filter({minor,idx,id})＝true の調だけほしいときは、
 *     ふくろの中からつぎに合う調をとる（合わない調はふくろにのこる）。
 *     weak：まちがいの多い調は、新しいふくろに1〜2こよぶんに入れる（となりどうしにならないように）
 *   deck.record(id, ok, {hint}) … 答えをきろく（PA.store('keystats-<quiz>') に
 *     {id:{right, wrong, hint, last(さいごに答えた時刻 ms), recent(さいごの8回：'o'＝じぶんでできた、'x'＝まちがい、'h'＝ヒントを見てできた)}}）
 *     ok＝true で hint＝true（こたえるまえに「つくりかた」を見た）は ×にしない：right も wrong もふえず、hint と recent の 'h' だけ。
 *     recent のない古いきろくにはじめてきろくするときは、それまでのようすから recent をつくる（できた→'ooo'、にがて→'xx'、ほか→''）
 *   deck.stats() / deck.reset()（きろくをけす）/ deck.setOptions({tier, modes, weak})（えらべる調がかわればふくろをつくりなおす。かわらなければのこりはそのまま）
 *   deck.state() → {bag, last}（ほぞん用）/ deck.restore(state) → true（ふくろをそのままもどす。形がちがえば false）
 * PA.keyDeck.mastery(s)：'none'（まだ）・'good'（right≧3で recent のさいご3つがぜんぶ 'o'）・'weak'（さいご3つのうち 'x' が2ついじょう）・'learning'
 *   （recent がない古いきろくはまえのきまり：right≧3で wrong×4≦right なら good、wrong≧right なら weak）
 * PA.keyDeck.extraCopies(s)：にがて用にふくろへよぶんに入れる数（さいご3つの 'x' の数、2まで。古いきろくはまえのきまり）
 * PA.keyDeck.weakList(quiz) → にがてなじゅんの id（weak → 'x' のある learning）
 * PA.keyDeck.tally(quiz, {modes, merge=true}) → {total, good, learning, weak, none}（チェック表とおなじ数えかた。「できた調3／24」につかう）
 * PA.keyDeck.mergeStats([s1, s2]) → 2つのきろくをあわせたもの（recent は1回ごとの時刻がないので、last の古い調からつなぐだいたいのじゅん）
 * PA.weakSummary(limit=5) → ぜんぶのクイズのにがてな調 [{quiz, title(アプリの名前), id, name(PA.keyName), mastery}]（ホーム用）
 * PA.keyDeck.tierSeg(act, cur) … 4つのむずかしさのボタン（PA.seg）
 * PA.keyDeck.checkTableHTML(quiz, {modes, title, note, merge=true, pickable, confirm}) … チェック表
 *   merge：おなじ音の調（嬰ヘ長調・変ト長調、嬰ニ短調・変ホ短調）を1つのますに（きろくは2つをあわせる）→ 長調12・短調12・ぜんぶで24。
 *     ますの<li>は data-key＝さいしょの id、data-ids＝"M6 M12"（まとめたとき）、data-mastery
 *   title：なければ長調・短調両方は「📋 24調チェック表」、1つなら「📋 長調チェック表」「📋 短調チェック表」
 *   pickable：ますがボタン（data-act="kd-pick" data-v=id、aria-label「ト長調を3もんれんしゅう …」）。ページでその調の3もんをはじめる
 *   けすボタン data-act="keystats-reset" data-v=quiz（data-confirm つき＝2回おす。confirm:false でなし）はページであつかう。
 *     core の2回おすしくみがあるので、ページでもういちどたずねない（Q.kdArm・window.confirm はいらない）
 */
(function(){
  const D=PA.keyDeck={};
  D.TIERS=[
    {id:'easy',emoji:'🌱',name:'やさしい',min:0,max:1,label:'🌱 やさしい（調号0〜1）'},
    {id:'normal',emoji:'🌿',name:'ふつう',min:2,max:3,label:'🌿 ふつう（調号2〜3）'},
    {id:'hard',emoji:'🌳',name:'むずかしい',min:4,max:5,label:'🌳 むずかしい（調号4〜5）'},
    {id:'all',emoji:'🌏',name:'ぜんぶ',min:0,max:6,label:'🌏 ぜんぶ（調号0〜6）'}
  ];
  const tierOf=t=>D.TIERS.find(x=>x.id===t)||D.TIERS[3];
  const ID_RE=/^([Mm])(\d{1,2})$/;
  D.id=(minor,idx)=>(minor?'m':'M')+idx;
  D.parse=id=>{
    const r=ID_RE.exec(String(id)); if(!r) return null;
    const minor=r[1]==='m', idx=+r[2];
    if(String(idx)!==r[2]||idx>=PA.keyCount(minor)) return null;
    return {minor,idx,id:D.id(minor,idx)};
  };
  // 調号の数（0〜6）と種類（1＝♯、-1＝♭、0＝なし）
  D.sigOf=(minor,idx)=>{const s=PA.sigInfo(PA.keyOf(minor,idx));return {n:s.letters.length,type:s.letters.length?s.type:0};};
  const ALL=[false,true].flatMap(minor=>[...Array(PA.keyCount(minor)).keys()].map(idx=>({minor,idx,id:D.id(minor,idx),...D.sigOf(minor,idx)})));
  // 調号のじゅん：0、♯1、♭1、♯2、♭2 … ♯6、♭6
  const bySig=(a,b)=>a.n-b.n||b.type-a.type;
  const normModes=m=>{
    const ok=(Array.isArray(m)?m:[]).filter(x=>x==='major'||x==='minor');
    return ok.length?[...new Set(ok)]:['major','minor'];
  };
  // えらべる調の id（長調 → 短調、それぞれ調号のじゅん）
  D.ids=(o={})=>{
    const t=tierOf(o.tier), modes=normModes(o.modes);
    return ALL.filter(k=>modes.includes(k.minor?'minor':'major')&&k.n>=t.min&&k.n<=t.max).sort((a,b)=>(a.minor-b.minor)||bySig(a,b)).map(k=>k.id);
  };
  // ----- きろく -----
  const QUIZ_RE=/^[a-z0-9][a-z0-9-]{0,40}$/;
  const qkey=quiz=>{if(typeof quiz!=='string'||!QUIZ_RE.test(quiz)) throw new TypeError('PA.keyDeck: quiz は英小文字・数字・- の名前に');return 'keystats-'+quiz;};
  const cnt=v=>Number.isFinite(v)&&v>=0?Math.min(1e6,Math.floor(v)):0;
  const clean=raw=>{
    const out={};
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) return out;
    Object.keys(raw).forEach(k=>{
      const p=D.parse(k), v=raw[k];
      if(!p||p.id!==k||!v||typeof v!=='object'||Array.isArray(v)) return;
      const s={right:cnt(v.right),wrong:cnt(v.wrong),hint:cnt(v.hint),last:Number.isFinite(v.last)&&v.last>0?v.last:0};
      const rc=recOf(v); if(rc) s.recent=rc;
      if(s.right||s.wrong||s.hint) out[k]=s;
    });
    return out;
  };
  // recent：さいごの8回（'o' じぶんでできた・'x' まちがい・'h' ヒントでできた）。ないときは ''
  const recOf=s=>s&&typeof s.recent==='string'?s.recent.replace(/[^oxh]/g,'').slice(-8):'';
  const xIn3=rc=>(rc.slice(-3).match(/x/g)||[]).length;
  D.stats=quiz=>clean(PA.store.get(qkey(quiz),null));
  D.reset=quiz=>PA.store.set(qkey(quiz),{});
  // recent のない古いきろくのきまり
  const oldMastery=(r,w)=>r>=3&&w*4<=r?'good':w>0&&w>=r?'weak':'learning';
  // ようす：'none'（まだ）、'weak'（にがて）、'learning'（れんしゅう中）、'good'（できた）。さいごの3回できめる
  D.mastery=s=>{
    const r=s?cnt(s.right):0, w=s?cnt(s.wrong):0, h=s?cnt(s.hint):0, rc=recOf(s);
    if(!r&&!w&&!h) return 'none';
    if(!rc) return oldMastery(r,w);
    if(r>=3&&rc.slice(-3)==='ooo') return 'good';
    if(xIn3(rc)>=2) return 'weak';
    return 'learning';
  };
  // よぶんに入れる数（0〜2）：さいご3回のまちがいの数。古いきろくはまちがい − せいかい÷3
  D.extraCopies=s=>{
    if(!s) return 0;
    const rc=recOf(s);
    if(rc) return Math.min(2,xIn3(rc));
    return Math.max(0,Math.min(2,cnt(s.wrong)-Math.floor(cnt(s.right)/3)));
  };
  // 2つのきろくをあわせる（おなじ音の調を1つのますにするとき）。
  // recent は1回ごとの時刻がないので、さいごにこたえた時刻（last）が古い調からじゅんにつなぐ（だいたいのじゅん）
  const merge=list=>{
    const ss=list.filter(Boolean); if(!ss.length) return undefined;
    const out={right:0,wrong:0,hint:0,last:0}; let oldData=false;
    ss.forEach(s=>{out.right+=cnt(s.right);out.wrong+=cnt(s.wrong);out.hint+=cnt(s.hint);out.last=Math.max(out.last,s.last||0);if(!recOf(s)&&(cnt(s.right)||cnt(s.wrong))) oldData=true;});
    if(!oldData){const rc=ss.slice().sort((a,b)=>(a.last||0)-(b.last||0)).map(recOf).join('').slice(-8);if(rc) out.recent=rc;}
    return out;
  };
  D.mergeStats=merge;
  // にがてなじゅん：weak → 'x' のある learning（さいご3回の 'x' が多い → まちがいが多い → 時刻が古い）
  const weakOf=st=>Object.keys(st).map(id=>{const s=st[id], rc=recOf(s);return {id,s,m:D.mastery(s),x3:rc?xIn3(rc):0,hasX:rc?rc.indexOf('x')>=0:cnt(s.wrong)>0};})
    .filter(o=>o.m==='weak'||(o.m==='learning'&&o.hasX))
    .sort((a,b)=>(a.m==='weak'?0:1)-(b.m==='weak'?0:1)||b.x3-a.x3||cnt(b.s.wrong)-cnt(a.s.wrong)||(a.s.last||0)-(b.s.last||0)||(a.id<b.id?-1:1));
  D.weakList=quiz=>weakOf(D.stats(quiz)).map(o=>o.id);
  PA.weakSummary=(limit=5)=>{
    const all=[];
    (typeof PA.store.keys==='function'?PA.store.keys():[]).forEach(k=>{
      const r=/^keystats-(.+)$/.exec(k); if(!r||!QUIZ_RE.test(r[1])) return;
      const quiz=r[1], app=PA.app?PA.app(quiz):null;
      weakOf(D.stats(quiz)).forEach(o=>{const p=D.parse(o.id);all.push({quiz,title:app?app.title:quiz,id:o.id,name:PA.keyName(PA.keyOf(p.minor,p.idx)),mastery:o.m,_o:o});});
    });
    all.sort((a,b)=>(a.mastery==='weak'?0:1)-(b.mastery==='weak'?0:1)||b._o.x3-a._o.x3||(b._o.s.last||0)-(a._o.s.last||0));
    return all.slice(0,Math.max(0,limit)).map(x=>({quiz:x.quiz,title:x.title,id:x.id,name:x.name,mastery:x.mastery}));
  };

  D.create=(o={})=>{
    const sk=qkey(o.quiz), rng=typeof o.rng==='function'?o.rng:Math.random, now=typeof o.now==='function'?o.now:Date.now;
    let opt, eligible, bag=[], last=null;
    const setOpt=p=>{
      opt={tier:tierOf(p.tier).id,modes:normModes(p.modes),weak:p.weak!==false};
      eligible=D.ids(opt); bag=[];
    };
    setOpt(o);
    const rand=n=>{const r=+rng();return Math.min(n-1,Math.max(0,Math.floor((Number.isFinite(r)?r:0)*n)));};
    const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
    // となりどうしがおなじ調にならないように入れかえる（prev＝その前に出た調）
    const spread=(a,prev)=>{
      for(let i=0;i<a.length;i++){
        const x=a[i];
        if(x!==(i?a[i-1]:prev)) continue;
        // うしろのちがう調と入れかえる（うごいた先でまたとなりになれば、そこに来たときなおす）
        const j=a.findIndex((y,q)=>q>i&&y!==x);
        if(j>0){[a[i],a[j]]=[a[j],a[i]];continue;}
        // うしろにちがう調がない（さいご）：前のすきまで、両どなりがちがうところへうつす
        for(let k=0;k<i;k++){
          if((k?a[k-1]:prev)!==x&&a[k]!==x){a.splice(i,1);a.splice(k,0,x);break;}
        }
      }
      return a;
    };
    const fresh=()=>{
      const st=opt.weak?D.stats(o.quiz):{}, a=[];
      eligible.forEach(id=>{a.push(id);for(let k=D.extraCopies(st[id]);k>0;k--) a.push(id);});
      return shuffle(a);
    };
    // ふくろをたす。のこっている調（filter に合わなかった調）はそのまま先に、新しいふくろからはその調をのぞく
    const refill=()=>{
      const left=new Set(bag), add=fresh().filter(id=>!left.has(id));
      spread(add,bag.length?bag[bag.length-1]:last);
      bag=bag.concat(add);
    };
    const take=i=>{const id=bag.splice(i,1)[0];last=id;const p=D.parse(id);return {minor:p.minor,idx:p.idx,id};};
    const deck={
      get quiz(){return o.quiz;},
      get options(){return {...opt,modes:[...opt.modes]};},
      get ids(){return [...eligible];},
      get size(){return eligible.length;},
      get bag(){return [...bag];},
      get last(){return last;},
      // ほぞん用：ふくろののこりと、さいごに出した調。restore はそのままもどす（えらべない調はのぞく。重みはつけなおさない）
      state(){return {bag:[...bag],last};},
      restore(s){
        if(!s||typeof s!=='object'||!Array.isArray(s.bag)) return false;
        const ok=id=>typeof id==='string'&&eligible.includes(id);
        bag=s.bag.slice(0,200).filter(ok); last=ok(s.last)?s.last:null;
        return true;
      },
      draw(filter){
        const ok=typeof filter==='function'?id=>{const p=D.parse(id);return !!filter({minor:p.minor,idx:p.idx,id});}:()=>true;
        const match=eligible.filter(ok);
        if(!match.length) return null;
        const find=()=>bag.findIndex(id=>id!==last&&ok(id));
        let i=find();
        if(i<0){refill();i=find();}
        if(i<0){i=bag.findIndex(ok);if(i<0){refill();i=bag.findIndex(ok);}} // 合う調が1つだけ（いま出した調）のとき
        return i<0?null:take(i);
      },
      // opt.hint＝true（こたえるまえに見た）で ok なら「ヒントでできた」（×にしない・せいかいにもかぞえない）
      record(id,ok,opt){
        const p=D.parse(id); if(!p||p.id!==id) return null;
        const st=D.stats(o.quiz), s=st[id]||{right:0,wrong:0,hint:0,last:0};
        let rc=recOf(s);
        if(!rc&&(s.right||s.wrong)) rc={good:'ooo',weak:'xx'}[oldMastery(s.right,s.wrong)]||''; // 古いきろくのようすをひきつぐ
        if(ok&&opt&&opt.hint){s.hint=Math.min(1e6,cnt(s.hint)+1);rc+='h';}
        else if(ok){s.right=Math.min(1e6,s.right+1);rc+='o';}
        else{s.wrong=Math.min(1e6,s.wrong+1);rc+='x';}
        s.recent=rc.slice(-8);
        const t=+now(); s.last=Number.isFinite(t)&&t>0?t:0;
        st[id]=s; PA.store.set(sk,st);
        return {...s};
      },
      stats(){return D.stats(o.quiz);},
      reset(){D.reset(o.quiz);bag=[];},
      // えらべる調がかわらないとき（にがてな調を多めにだけなど）は、ふくろののこりをそのまま（新しい重みはつぎのふくろから）
      setOptions(p){const was=eligible.join(), keep={bag:[...bag],last};setOpt({...opt,...p});if(eligible.join()===was){bag=keep.bag;last=keep.last;}}
    };
    return deck;
  };

  // ----- 画面 -----
  // 4つのむずかしさ（スマホは2×2、広い画面は4つならべる）
  D.tierSeg=(act,cur)=>PA.seg(act,D.TIERS.map(t=>[t.id,`${t.emoji} ${t.name}<span style="display:block;font-size:12px;font-weight:400;color:var(--sub);line-height:1.2">調号${t.min}〜${t.max}</span>`]),tierOf(cur).id,'kd-tiers')
    .replace('class="seg kd-tiers"','class="seg kd-tiers" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,128px),1fr));border-radius:18px"');
  const LOOK={
    none:{mark:'',text:'まだ',bg:'var(--soft2)',bd:'transparent',fg:'var(--sub)'},
    weak:{mark:'△',text:'にがて',bg:'#fde4e7',bd:'#e79aa5',fg:'#8f2233'},
    learning:{mark:'○',text:'れんしゅう中',bg:'#fff4d6',bd:'#ecc967',fg:'#6e4c00'},
    good:{mark:'◎',text:'できた',bg:'#dcf5e8',bd:'#7fcfa6',fg:'#0f6b44'}
  };
  D.LOOK=LOOK;
  const SR='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';
  const shortName=k=>(k.a>0?'嬰':k.a<0?'変':'')+PA.LET_JA[k.l];
  const sigShort=k=>!k.n?'なし':(k.type>0?'♯':'♭')+k.n;
  const num=n=>n>999?'999+':String(n);
  // おなじ音の調（主音の高さがおなじ）をまとめたます：[[k], [k], …, [嬰ヘ, 変ト]]（調号のじゅん）
  const cellsOf=(minor,mg)=>{
    const ks=ALL.filter(k=>k.minor===minor).sort(bySig);
    if(!mg) return ks.map(k=>[k]);
    const by=new Map(), out=[];
    ks.forEach(k=>{const t=PA.keyOf(k.minor,k.idx).tpc;if(by.has(t)) by.get(t).push(k);else{const g=[k];by.set(t,g);out.push(g);}});
    return out;
  };
  // チェック表とおなじ数えかた（merge：おなじ音の調は1つ）→ {total, good, learning, weak, none}
  D.tally=(quiz,o={})=>{
    const st=D.stats(quiz), modes=normModes(o.modes), mg=o.merge!==false, out={total:0,good:0,learning:0,weak:0,none:0};
    [false,true].forEach(minor=>{
      if(!modes.includes(minor?'minor':'major')) return;
      cellsOf(minor,mg).forEach(g=>{const s=g.length>1?merge(g.map(x=>st[x.id])):st[g[0].id];out.total++;out[D.mastery(s)]++;});
    });
    return out;
  };
  D.checkTableHTML=(quiz,o={})=>{
    const st=D.stats(quiz), modes=normModes(o.modes), mg=o.merge!==false, pick=!!o.pickable;
    let good=0,total=0;
    const cell=g=>{
      const k=g[0], s=g.length>1?merge(g.map(x=>st[x.id])):st[k.id], z=s||{right:0,wrong:0,hint:0}, m=D.mastery(s), L=LOOK[m];
      const keys=g.map(x=>PA.keyOf(x.minor,x.idx)), hn=cnt(z.hint);
      total++; if(m==='good') good++;
      const sr=`${keys.map(PA.keyName).join('・')}（${keys.map(PA.sigLabel).join('・')}）：${L.text}。じぶんでできた${cnt(z.right)}、まちがい${cnt(z.wrong)}${hn?`、ヒントでできた${hn}`:''}`;
      const name=g.length>1
        ?`<b style="display:block;font-size:13px;line-height:1.15;color:var(--ink);white-space:nowrap">${keys.map(shortName).join('<br>')}</b>`
        :`<b style="display:block;font-size:15px;color:var(--ink);white-space:nowrap">${shortName(keys[0])}</b>`;
      const look=`<span aria-hidden="true" style="display:block">`
        +(L.mark?`<span style="position:absolute;top:1px;right:4px;font-size:10px;font-weight:800">${L.mark}</span>`:'')
        +name
        +`<span style="display:block;font-size:11px;color:var(--sub)">${g.map(sigShort).join('/')}</span>`
        +`<span style="display:flex;flex-wrap:wrap;justify-content:center;gap:0 4px;font-size:12px;font-weight:700"><span style="color:${z.right?'#0f6b44':'var(--sub)'}">✓${num(cnt(z.right))}</span><span style="color:${z.wrong?'#a3273a':'var(--sub)'}">✗${num(cnt(z.wrong))}</span>${hn?`<span style="color:#6e4c00">💡${num(hn)}</span>`:''}</span>`
        +`</span>`;
      const box=`position:relative;min-width:0;border-radius:12px;border:2px solid ${L.bd};background:${L.bg};color:${L.fg};text-align:center;line-height:1.25`;
      const ids=g.length>1?` data-ids="${g.map(x=>x.id).join(' ')}"`:'';
      if(pick) return `<li data-key="${k.id}" data-mastery="${m}"${ids} style="min-width:0;display:flex">`
        +`<button type="button" class="kd-cell" data-act="kd-pick" data-v="${k.id}" aria-label="${PA.esc(keys.map(PA.keyName).join('・'))}を3もんれんしゅう（${PA.esc(sr.slice(sr.indexOf('：')+1))}）" style="${box};width:100%;min-height:56px;padding:5px 2px 4px;font:inherit">${look}</button></li>`;
      return `<li data-key="${k.id}" data-mastery="${m}"${ids} style="${box};padding:5px 2px 4px">`
        +`<span style="${SR}">${sr}</span>`+look+`</li>`;
    };
    const group=(minor,title)=>`<h3 style="margin:10px 0 6px;font-size:15px">${title}</h3>`
      +`<ul role="list" aria-label="${minor?'短調':'長調'}" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:4px">${cellsOf(minor,mg).map(cell).join('')}</ul>`;
    const both=modes.length>1;
    let body='';
    if(modes.includes('major')) body+=group(false,'☀️ 長調');
    if(modes.includes('minor')) body+=group(true,'🌙 短調');
    const legend=['good','learning','weak','none'].map(m=>`<span class="chip" style="background:${LOOK[m].bg};color:${LOOK[m].fg};border:1px solid ${LOOK[m].bd}">${LOOK[m].mark?LOOK[m].mark+' ':''}${LOOK[m].text}</span>`).join('');
    const title=o.title||(both?'📋 24調チェック表':modes[0]==='major'?'📋 長調チェック表':'📋 短調チェック表');
    const pairs=[modes.includes('major')?'嬰ヘ長調と変ト長調':'',modes.includes('minor')?'嬰ニ短調と変ホ短調':''].filter(Boolean).join('、');
    const note=o.note!=null?o.note
      :`◎は、さいごの3回つづけて、じぶんでできた調です。こたえる前にヒントを見たときは 💡（×にはならない）。`
        +`${pairs}は同じ音の調で、書きかただけがちがいます${mg?'。1つのマスにまとめています':''}。`
        +(pick?'マスをおすと、その調を3もん、れんしゅうできます。':'');
    const conf=o.confirm===false?'':' data-confirm="ほんとうにけす？（もういちどおす）"';
    return `<section class="card kd-check" data-quiz="${quiz}"><h2>${title}<small>できた調：${good}／${total}　（左から調号の少ないじゅん）</small></h2>`
      +`<div class="chips" style="margin-bottom:2px">${legend}</div>`
      +body
      +`<p class="note">${note}</p>`
      +`<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn small" data-act="keystats-reset" data-v="${quiz}"${conf}>${PA.icon('trash')}きろくをけす</button></div></section>`;
  };
})();
/* ===== れんしゅうの回（n もん）とけっかのカード（つかいかたはいちばん上） =====
 * きろく：PA.store('session-<quiz>')＝{n, done:[{ok, hint, label, key?}], startedAt}
 *   ちがう sig の start で上がきされたとちゅうの回は PA.store('sessionpause-<quiz>') にとっておき、あとでもどす
 * じぶんでできた＝ok で hint でない、ヒントでできた＝ok で hint、まちがえた＝ok でない
 */
PA.HINT_NOTE='こたえる前に見ても、×にはならないよ。「ヒントでできた」になるよ';
/* はじめの数回だけ出す説明：PA.once(id, html, n=3) → ひらいた回が n 回までは html、そのあとは ''
 * 1回ひらいたページの中では、なんど描きなおしても出しつづける（きゅうに消えない）。PA.store 'once'＝{id: 見た回数}
 * ⚙️ の「はじめの説明をもういちど出す」で、ぜんぶ数えなおす（PA.onceReset） */
const onceSeen=new Set();
PA.once=(id,html,n)=>{
  const max=n==null?3:n, all=PA.store.get('once',{}), o=all&&typeof all==='object'&&!Array.isArray(all)?all:{};
  const c=typeof o[id]==='number'?o[id]:0;
  if(onceSeen.has(id)) return c<=max?html:'';
  if(c>=max) return '';
  onceSeen.add(id); o[id]=c+1; PA.store.set('once',o);
  return html;
};
PA.onceReset=()=>{PA.store.set('once',{});onceSeen.clear();};
(function(){
  const QUIZ_RE=/^[a-z0-9][a-z0-9-]{0,40}$/, HOURS12=12*36e5;
  const clampN=v=>{const n=parseInt(v,10);return n>=1?Math.min(20,n):0;};
  const cleanEntry=e=>{
    if(!e||typeof e!=='object') return null;
    const out={ok:e.ok===true,hint:e.hint===true&&e.ok===true,label:typeof e.label==='string'?e.label.slice(0,80):''};
    if(typeof e.key==='string'&&e.key.length<=20) out.key=e.key;
    return out;
  };
  const cleanSession=r=>{
    if(!r||typeof r!=='object'||Array.isArray(r)) return null;
    const n=clampN(r.n); if(!n||!Array.isArray(r.done)) return null;
    const out={n,done:r.done.slice(0,100).map(cleanEntry).filter(Boolean).slice(0,n),startedAt:Number.isFinite(r.startedAt)?r.startedAt:0,sig:typeof r.sig==='string'?r.sig.slice(0,300):''};
    if(Number.isFinite(r.endedAt)) out.endedAt=r.endedAt;
    return out;
  };
  // リンクのしるし：n いがいの PARAM_KEYS（key・chord・mode・level・tier・step）をならべた文字。ちがう宿題のリンクなら新しい回
  const sigOf=p=>(PA.PARAM_KEYS||[]).filter(k=>k!=='n'&&p&&p[k]!=null&&p[k]!=='').map(k=>k+'='+p[k]).join('&');
  PA.sessionSig=sigOf;
  const AFTER_END=10*6e4; // おわってから10分まではけっかのカードをまた出す（「もどる」で読みなおしたとき）
  // けっかの数・ほし・ひとこと
  PA.sessionTally=(done,n)=>{
    const d=Array.isArray(done)?done:[], N=clampN(n)||d.length;
    const self=d.filter(e=>e.ok&&!e.hint).length, hint=d.filter(e=>e.ok&&e.hint).length, wrong=d.filter(e=>!e.ok).length;
    const pt=N?(self+hint*0.5)/N:0, stars=pt>=0.9?3:pt>=0.6?2:1;
    let msg;
    if(N&&self===N) msg='ぜんぶ、じぶんでできたね！すごい！';
    else if(N&&wrong===0) msg='ぜんぶできたね！次は、ヒントを見ないでやってみよう';
    else if(pt>=0.6) msg='よくできたね。まちがえたところを、もういちど見てみよう';
    else msg='さいごまで、がんばったね。まちがえた問題を、もういちどやってみよう';
    return {n:N,done:d.length,self,hint,wrong,ok:self+hint,stars,msg};
  };
  const WD='日月火水木金土';
  const dateText=t=>{const d=new Date(t);return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）${d.getHours()}:${(d.getMinutes()<10?'0':'')+d.getMinutes()}`;};
  // params から「せってい」のことば（key・tier・level・n）
  PA.paramsText=p=>{
    const out=[]; p=p||{};
    const D=PA.keyDeck, k=p.key&&D?D.parse(p.key):null;
    if(k) out.push('調：'+PA.keyName(PA.keyOf(k.minor,k.idx)));
    const t=p.tier&&D?D.TIERS.find(x=>x.id===p.tier):null;
    if(t) out.push('むずかしさ：'+t.name+'（調号'+t.min+'〜'+t.max+'）');
    if(/^\d{1,2}$/.test(String(p.level||''))) out.push('レベル'+p.level);
    return out.join('・');
  };
  PA.session=(quiz,o={})=>{
    if(typeof quiz!=='string'||!QUIZ_RE.test(quiz)) throw new TypeError('PA.session: quiz は英小文字・数字・- の名前に');
    const sk='session-'+quiz, now=typeof o.now==='function'?o.now:Date.now;
    const sig=typeof o.sig==='string'?o.sig.slice(0,300):sigOf(PA.params?PA.params():{});
    let d=cleanSession(PA.store.get(sk,null));
    const save=()=>PA.store.set(sk,d);
    if(d&&!(+now()-d.startedAt<HOURS12)){d=null;PA.store.set(sk,null);} // 12時間たった回はすてる（n がなくても）
    // とちゅうの回をちがうリンク（宿題・ふくしゅう）で上がきしたときは、'sessionpause-'+quiz にとっておく。
    // いまの回がない（けした）か、おわって10分たったら、とっておいた回にもどす（12時間たったらすてる）
    const pk='sessionpause-'+quiz;
    let paused=cleanSession(PA.store.get(pk,null));
    if(paused&&!(paused.done.length<paused.n&&+now()-paused.startedAt<HOURS12)){paused=null;PA.store.set(pk,null);}
    if(paused&&(!d||(d.done.length>=d.n&&!(d.endedAt!=null&&+now()-d.endedAt<AFTER_END)))){d=paused;paused=null;save();PA.store.set(pk,null);}
    const s={
      start(n){
        const N=clampN(n);if(!N){s.clear();return s;}
        const curActive=!!d&&d.done.length<d.n;
        if(!curActive&&paused&&paused.n===N&&paused.sig===sig){d=paused;paused=null;save();PA.store.set(pk,null);return s;} // おなじ回をまたはじめる：とっておいたつづきから
        if(curActive&&d.sig!==sig&&!paused){paused=d;PA.store.set(pk,paused);} // とちゅうの回はきえない
        d={n:N,done:[],startedAt:+now(),sig};save();return s;
      },
      clear(){d=null;PA.store.set(sk,null);return s;},
      n(){return d?d.n:0;},
      count(){return d?d.done.length:0;},
      active(){return !!d&&d.done.length<d.n;},
      finished(){return !!d&&d.done.length>=d.n;},
      state(){return d?{n:d.n,done:d.done.map(e=>Object.assign({},e)),startedAt:d.startedAt,sig:d.sig,endedAt:d.endedAt}:null;},
      record(e){
        if(!s.active()) return null;
        const x=cleanEntry(e||{}); if(!x) return null;
        d.done.push(x); if(d.done.length>=d.n) d.endedAt=+now(); save();
        return {count:d.done.length,n:d.n,finished:d.done.length>=d.n};
      },
      tally(){return PA.sessionTally(d?d.done:[],d?d.n:0);},
      progressHTML(){
        if(!d) return '';
        return `<span class="chip pa-sess" aria-label="きょうの${d.n}もんのうち${d.done.length}もんおわり">📝 きょうの${d.n}もん　${d.done.length} / ${d.n}</span>`;
      },
      summaryHTML(p={}){
        if(!d) return '';
        const T=s.tally(), app=PA.app?PA.app(quiz):null, title=p.title||(app?app.title:quiz), page=p.page||(app?app.id:quiz);
        const params=Object.assign({},p.params||{},{n:d.n});
        const stars='★★★'.slice(0,T.stars)+'☆☆☆'.slice(0,3-T.stars);
        const nm=t=>PA.H(PA.esc(t));
        const miss=d.done.filter(e=>!e.ok||e.hint);
        const list=miss.length?`<div class="sess-miss"><h3>もういちど見ておきたい問題</h3><ul>`
          +miss.map(e=>`<li><span class="sess-tag ${e.ok?'h':'x'}">${e.ok?'💡 ヒント':'✗ まちがい'}</span> ${nm(e.label||'（問題）')}</li>`).join('')+`</ul></div>`:'';
        const set=p.settings!=null?PA.esc(p.settings):PA.esc(PA.paramsText(p.params||{}));
        return `<section class="card sess-card" aria-labelledby="sess-h">`
          +`<h2 id="sess-h">🎉 ${d.n}もんおわり！</h2>`
          +`<p class="sess-big"><b>${d.n}もん中${T.ok}もん</b> <span class="sess-stars" role="img" aria-label="ほし3つのうち${T.stars}つ">${stars}</span></p>`
          +`<p class="sess-msg">${T.msg}</p>`
          +(p.extra||'') // ページがつくる HTML（耳のひろばの「きょうの5もん、できたね！」）
          +`<div class="sess-counts">`
          +`<div class="sc-self"><b>${T.self}</b><span>じぶんでできた</span></div>`
          +`<div class="sc-hint"><b>${T.hint}</b><span>ヒントを見てできた</span></div>`
          +`<div class="sc-wrong"><b>${T.wrong}</b><span>まちがえた</span></div></div>`
          +list
          // 先生に見せる：日づけ・せってい・リンク（けっかは上の大きな字を見せる）。ふだんはたたんでおく
          +`<details class="sess-teacher" data-d="sess-teacher"><summary>👩‍🏫 先生に見せる</summary><dl>`
          +`<dt>日づけ</dt><dd>${dateText(+now())}</dd>`
          +`<dt>れんしゅう</dt><dd>${PA.esc(title)}</dd>`
          +(set?`<dt>せってい</dt><dd>${set}</dd>`:'')
          +`</dl>`
          +`<div class="row">${PA.shareHTML(page,params,PA.icon('link')+'同じれんしゅうのリンク')}</div></details>`
          +`<div class="row sess-btns"><button type="button" class="btn primary" data-act="session-again">${PA.icon('retry')}もういちど</button><button type="button" class="btn" data-act="session-free">🎈 じゆうにれんしゅう</button></div>`
          +`</section>`;
      }
    };
    // n があるとき：n・リンクがおなじで、とちゅう（またはおわって10分いない）ならつづき。ちがえば新しくはじめる
    const want=clampN(o.n);
    if(want){
      const same=!!d&&d.n===want&&d.sig===sig;
      const fresh=!!d&&(d.done.length<d.n||(d.endedAt!=null&&+now()-d.endedAt<AFTER_END));
      if(!(same&&fresh)){
        if(paused&&paused.n===want&&paused.sig===sig){ // とっておいた回のリンクをまたひらいた：その回にもどし、いまのとちゅうの回をとっておく
          const cur=d; d=paused; save();
          paused=cur&&cur.done.length<cur.n?cur:null; PA.store.set(pk,paused);
        }else s.start(want);
      }
    }
    return s;
  };
})();
/* ===== 耳のひろば：つづけた日（毎日のやる気） =====
 * 耳のひろばの「きょうの5もん」（和音の聴きわけ・ならびの聴きわけの PA.session の回。どのレベル・ステップでも、リンクの n でも）を
 * さいごまでやった日に、しるしをつける。ページは s.record(…) が finished をかえしたときに PA.earDays.mark() をよぶ。
 * PA.store 'ear-days'＝['2026-11-01', …]（その端末の日づけ＝ローカル時刻。古いじゅん・おなじ日は1つ・さいごの KEEP 日ぶんまで）
 * 休んでも、しるしは消さない。「とぎれた」とは言わない（つづけた日数は、2日いじょうつづいているときだけ出す）。ランキングはない。
 * 日のけいさんは、年・月・日からつくる（new Date(年, 月, 日＋n)）。24時間をたさないので、月・年のさかいめや夏時間でもずれない。
 *   PA.earDays.key(t?) → 'YYYY-MM-DD'（t＝ミリ秒か Date。なければ Date.now()）
 *   PA.earDays.list() → しるしの日（きれいにした配列。ほんとうにある日だけ・古いじゅん・おなじ日は1つ）
 *   PA.earDays.mark(t?) → {first：その日はじめてのしるし, info}
 *   PA.earDays.info(t?) → {key：きょう, today：きょうできた, week:[{key, wd:'月'…, on, now：きょう, future}×7（月曜〜日曜）], weekCount, run, total}
 *     run：きょうまで（きょうまだなら、きのうまで）毎日つづけた日数。つづいていなければ 0。total：のこっているしるしの数
 *   PA.earDays.weekHTML(info?, {dark}) → 「今週」と7つの丸（月〜日）・「3日」（0日なら「これから」）・「つづけて4日」（読み上げは1つの文）。dark＝耳のひろばの夜空の上
 *   PA.earDays.cheerHTML({fx, n, info}) → 5もんのけっかに入れる「きょうの5もん、できたね！」と今週の丸（きょうのしるしがなければ今週の丸だけ）。
 *     fx＝その日はじめてできた：紙ふぶきと「ぽん」のうごき（うごきをへらす設定では出さない。app.css） */
(function(){
  const SK='ear-days', KEEP=400, WD='月火水木金土日';
  const pad=n=>(n<10?'0':'')+n;
  const keyOfDate=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const dayOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const shift=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  const dateOf=t=>{
    const d=t instanceof Date?new Date(t.getTime()):new Date(t==null?Date.now():+t);
    return isNaN(d.getTime())?new Date(Date.now()):d;
  };
  // ほんとうにある日だけ（2月30日などはすてる）
  const valid=k=>{
    const m=typeof k==='string'&&/^(\d{4})-(\d{2})-(\d{2})$/.exec(k); if(!m) return false;
    const y=+m[1], mo=+m[2]-1, da=+m[3]; if(y<2000) return false;
    const d=new Date(y,mo,da); return d.getFullYear()===y&&d.getMonth()===mo&&d.getDate()===da;
  };
  const list=()=>{
    const v=PA.store.get(SK,[]); if(!Array.isArray(v)) return [];
    const out=[]; v.slice(-2*KEEP).forEach(k=>{if(valid(k)&&out.indexOf(k)<0) out.push(k);});
    return out.sort().slice(-KEEP);
  };
  const info=t=>{
    const today=dayOf(dateOf(t)), tk=keyOfDate(today), all=list(), set={};
    all.forEach(k=>{set[k]=true;});
    const wi=(today.getDay()+6)%7, mon=shift(today,-wi); // 月曜はじまり（ランキングの「今週」とおなじ）
    const week=[0,1,2,3,4,5,6].map(i=>{const k=keyOfDate(shift(mon,i));return {key:k,wd:WD[i],on:!!set[k],now:i===wi,future:i>wi};});
    let run=0, d=set[tk]?today:shift(today,-1);
    while(run<KEEP&&set[keyOfDate(d)]){run++;d=shift(d,-1);}
    return {key:tk,today:!!set[tk],week,weekCount:week.filter(x=>x.on).length,run,total:all.length};
  };
  const mark=t=>{
    const k=keyOfDate(dateOf(t)), all=list(), first=all.indexOf(k)<0;
    if(first){all.push(k);PA.store.set(SK,all.sort().slice(-KEEP));}
    return {first,info:info(t)};
  };
  const weekHTML=(I,o)=>{
    I=I||info(); o=o||{};
    const on=I.week.filter(x=>x.on).map(x=>x.wd);
    // 今週まだ0日（週がかわった月曜など）は数を出さない：「0日できた」はがっかりするので「これから」（先生：休んでも責めない）
    const al=(I.weekCount?`今週は${I.weekCount}日できたよ（${on.join('・')}）`:'今週はまだこれから')+(I.run>=2?`。つづけて${I.run}日`:'');
    return `<div class="pa-week${o.dark?' dark':''}" role="img" aria-label="${al}"><span class="pw-l">今週</span><span class="pw-dots">`
      +I.week.map(x=>`<span class="pw-d${x.on?' on':''}${x.now?' now':''}${x.future?' fut':''}"><i></i><small>${x.wd}</small></span>`).join('')
      +`</span><span class="pw-n">${I.weekCount?`<b>${I.weekCount}</b>日できた`:'これから'}</span>${I.run>=2?`<span class="pw-run"><span aria-hidden="true">🔥</span>つづけて<b>${I.run}</b>日</span>`:''}</div>`;
  };
  const CONF=['#ff6b6b','#ffd166','#06d6a0','#4cc9f0','#b388ff','#ff8fab'];
  const cheerHTML=(o={})=>{
    const I=o.info||info(), n=Number.isInteger(o.n)&&o.n>0?o.n:5;
    if(!I.today) return `<div class="pa-cheer still">${weekHTML(I)}</div>`;
    const fx=!!o.fx;
    const conf=fx?`<span class="pa-confetti" aria-hidden="true">`+Array.from({length:14},(_,i)=>`<i style="--x:${4+i*7}%;--d:${(i%5)*0.12}s;--c:${CONF[i%CONF.length]};--r:${i%2?'':'-'}${200+i*20}deg"></i>`).join('')+`</span>`:'';
    const sub=I.run>=2?'毎日つづいているね！':'またあしたも、まってるよ';
    return `<div class="pa-cheer${fx?'':' still'}">${conf}<p class="pc-t"><span aria-hidden="true">🎉 </span>きょうの${n}もん、できたね！</p>${weekHTML(I)}<p class="pc-s">${sub}</p></div>`;
  };
  PA.earDays={key:t=>keyOfDate(dateOf(t)),list,info,mark,weekHTML,cheerHTML,KEEP};
})();
/* ===== おわりかた（終止形）：6つの終止の和音のならび =====
 * key は PA.keyOf(minor, idx, 60)（主音はド4〜シ4）。短調の key.scale は和声的短音階なので、Ⅴ・Ⅴ7の7ばんめは上げた音（raised）。
 *   Ⅳ・Ⅵ・Ⅰは7ばんめをつかわないので、調号どおり（自然的短音階）の音になる（短調のⅥ＝長三和音、Ⅳ＝短三和音）。
 * PA.ending.TYPES  … [{id, name, yomi, nick, emoji, color, light, short, family('full'＝全終止のなかま), minorOnly}]
 * PA.ending.FULL   … 全終止（完全＋不完全）をひとつにまとめたときの名前
 * PA.ending.PATTERNS … クイズでつかうならび [{id, type, variant}]（不完全終止は A・B の2つ）
 * PA.ending.build(key, typeId, variant) → [{ch:'I'|'IV'|'V'|'V7'|'VI', label:'Ⅰ'…, inv:0|1|2, rh:[音×3], lh:[音], bassDeg}]（inv：0＝基本形、1＝第1転回形、2＝第2転回形）
 *   どれも4つの和音（長さで答えがわからないように）。フリギア終止は短調だけ（長調では null）。
 *   右手＝音階のなんばんめ k（PA.at(key.scale,k)。0＝主音、負＝主音より下）。左手＝根音（または bass に書いた度数）1つ：
 *   1つめは主音の音でド3〜シ3（48〜59）、そのあとはミ2〜シ3（40〜59）で右手のいちばん下より下。
 *   4つの左手の高さはまとめてえらぶ（ありうる高さをぜんぶためす）。よいじゅん：
 *   ① 右手のどれかと5度・8度のままうごく（おなじ向きでも反対むきでも）ことがない
 *   ② 左手が短7度より大きくとばない ③ いちばん上と左手がおなじ向きに5度・8度へ入り、いちばん上がとぶことがない
 *   ④ 左手のうごきが小さい ⑤ 低い。
 *   音：PA.at とおなじ {letter, acc, midi, deg, k, raised?}。表示の音＝鳴らす音。
 * PA.ending.why(key, typeId, variant) … 「さいごがⅤ7 → Ⅰで …」のやさしい説明（HTML。音名はいまの設定で）
 * test/ending.test.mjs で24調すべてをたしかめる（和音の音・平行の5度と8度・左手がいちばん下・右手のはばなど）
 */
(function(){
  const E=PA.ending={}, mod=PA.mod;
  PA.COL.VI='#0e8a8a'; PA.LCOL.VI='#d3f1ef'; // Ⅵ（ほかのページの和音の色とかさならない青緑）
  E.LABEL={I:'Ⅰ',II:'Ⅱ',IV:'Ⅳ',V:'Ⅴ',V7:'Ⅴ7',VI:'Ⅵ'};
  E.ROOT={I:0,II:1,IV:3,V:4,V7:4,VI:5};
  E.TYPES=[
    {id:'perfect',name:'完全終止',yomi:'かんぜんしゅうし',nick:'おしまい！',emoji:'🏁',color:'#e8553d',light:'#fde5df',family:'full',minorOnly:false,
      short:'Ⅴ7 → Ⅰ。どちらもいちばん下が根音で、さいごのいちばん上が主音。いちばんしっかりと、おわる。'},
    {id:'imperfect',name:'不完全終止',yomi:'ふかんぜんしゅうし',nick:'おわり…かな？',emoji:'🌤',color:'#c96a00',light:'#fdebd3',family:'full',minorOnly:false,
      short:'Ⅴ7 → Ⅰだけど、さいごのいちばん上が主音ではない（またはⅤ7のいちばん下が根音ではない）。おわるけど、すこしかるい。'},
    {id:'half',name:'半終止',yomi:'はんしゅうし',nick:'つづく…',emoji:'⏸',color:'#2f7ee8',light:'#dfeafd',family:null,minorOnly:false,
      short:'Ⅴでとまる。まだつづく感じ。'},
    {id:'plagal',name:'変格終止',yomi:'へんかくしゅうし',nick:'アーメン',emoji:'🙏',color:'#22a06b',light:'#daf3e6',family:null,minorOnly:false,
      short:'Ⅳ → Ⅰ。やわらかくおわる。'},
    {id:'deceptive',name:'偽終止',yomi:'ぎしゅうし',nick:'あれっ？',emoji:'😮',color:'#b0307a',light:'#f8e0ee',family:null,minorOnly:false,
      short:'Ⅴ7のあと、ⅠのかわりにⅥへ。おわると思ったら、ちがう和音へすすむ。'},
    {id:'phrygian',name:'フリギア終止',yomi:'ふりぎあしゅうし',nick:'くらいひと休み',emoji:'🌙',color:'#3b4fa8',light:'#e6eafb',family:null,minorOnly:true,
      short:'短調だけ。Ⅳ（いちばん下が6ばんめの音）から、いちばん下が半音下がってⅤでとまる。'}
  ];
  E.IDS=E.TYPES.map(t=>t.id);
  E.FULL={id:'full',name:'全終止',yomi:'ぜんしゅうし',nick:'Ⅰでおわる',emoji:'🏁',color:'#e8553d',light:'#fde5df',
    short:'Ⅴ（Ⅴ7）→ Ⅰでおわる。完全終止と不完全終止をあわせたよびかた。'};
  E.type=id=>id==='full'?E.FULL:E.TYPES.find(t=>t.id===id)||null;
  // [和音, 右手の k, 左手の度数（なければ根音）]
  const SPEC={
    perfect:   [['I',[2,4,7]],['IV',[3,5,7]],['V7',[3,4,6]],['I',[2,4,7]]], // 上の音主音→主音→7ばんめ→主音（Ⅴ7の上が5ばんめだと、上と左手が反対むきに動いて8度になってしまう）
    imperfectA:[['I',[0,2,4]],['IV',[0,3,5]],['V7',[-1,3,4]],['I',[0,2,4]]],
    imperfectB:[['I',[2,4,7]],['IV',[3,5,7]],['V7',[3,4,6],1],['I',[2,4,7]]], // 完全終止とおなじで、Ⅴ7の左手だけ2ばんめ（第2転回形）
    half:      [['I',[0,2,4]],['IV',[0,3,5]],['I',[0,2,4]],['V',[-1,1,4]]],
    plagal:    [['I',[0,2,4]],['VI',[0,2,5]],['IV',[0,3,5]],['I',[0,2,4]]],
    deceptive: [['I',[0,2,4]],['IV',[0,3,5]],['V7',[-1,3,4]],['VI',[0,2,7]]],
    phrygian:  [['I',[0,2,4]],['VI',[0,2,5]],['IV',[0,3,7],5],['V',[1,4,6]]] // さいごは左手が半音下がり、まん中の4ばんめ→5ばんめが反対むきに上がる（いちばん上は左手といっしょに半音下がる）
  };
  E.PATTERNS=[
    {id:'perfect',type:'perfect',variant:null},{id:'imperfectA',type:'imperfect',variant:'A'},{id:'imperfectB',type:'imperfect',variant:'B'},
    {id:'half',type:'half',variant:null},{id:'plagal',type:'plagal',variant:null},{id:'deceptive',type:'deceptive',variant:null},
    {id:'phrygian',type:'phrygian',variant:null}
  ];
  E.pattern=id=>E.PATTERNS.find(p=>p.id===id)||null;
  E.patternOf=(typeId,variant)=>typeId==='imperfect'?(variant==='B'?'imperfectB':'imperfectA'):SPEC[typeId]&&typeId!=='imperfectA'&&typeId!=='imperfectB'?typeId:null;
  E.allowed=(key,typeId)=>{const t=E.type(typeId);return !!t&&(!t.minorOnly||!!key.minor);};
  /* voiceSpec(key, rows, more) … rows＝[[和音, 右手の k, 左手の度数（なければ根音）], …]（いくつでも）→ build とおなじ形の列
   *   more＝[rows, …]（なくてもよい）：おなじ左手をつかうほかのならび。左手はどれにもあうようにえらぶ
   *   左手の高さは上の ①〜⑤ のじゅんで、まとめてえらぶ（1つめはド3〜シ3、そのあとはミ2〜シ3。どれも右手のいちばん下より下）。
   *   PA.prog（ならびの聴きわけ）もこれをつかう */
  const voiceSpec=E.voiceSpec=(key,rows,more)=>{
    // 左手 a→b と右手 A→B が5度・8度のままうごくか（どちらもうごくとき。おなじ向きでも反対むきでも）
    const par=(a,b,A,B)=>A.some((x,i)=>{const y=B[i].midi, iv=mod(x.midi-a,12);
      return (iv===0||iv===7)&&iv===mod(y-b,12)&&a!==b&&x.midi!==y;});
    // いちばん上と左手がおなじ向きに5度・8度へ入り、いちばん上がとぶ（2つより大きくうごく）
    const hid=(a,b,A,B)=>{const s1=A[A.length-1].midi, s2=B[B.length-1].midi, iv=mod(s2-b,12);
      return (iv===0||iv===7)&&a!==b&&s1!==s2&&Math.sign(b-a)===Math.sign(s2-s1)&&Math.abs(s2-s1)>2;};
    // more＝おなじ左手をつかうほかのならび（和音と左手の度数はおなじで、右手だけちがう）。左手はどのならびの右手よりも下で、点はたしあわせる
    const sets=[rows].concat(more||[]);
    const lo0=Math.min(...sets.map(rs=>Math.min(...rs[0][1].map(k=>PA.at(key.scale,k).midi))));
    const csOf=rs=>rs.map(([ch,ks,bd],i)=>{
      const rh=ks.map(k=>PA.at(key.scale,k)), d=bd==null?E.ROOT[ch]:bd, b=PA.at(key.scale,d), pc=mod(b.midi,12);
      const lo=Math.min(...rh.map(n=>n.midi)), c=[];
      if(i===0){let m=48+mod(pc-48,12);while(m>=lo0)m-=12;c.push(m);} // 1つめは主音でド3〜シ3（どのならびの右手よりも下）
      else for(let x=40+mod(pc-40,12);x<=59;x+=12) if(x<lo) c.push(x); // ミ2〜シ3、右手より下
      return {ch,rh,d,b,c};
    });
    const all=sets.map(csOf), cs=all[0];
    const cands=cs.map((x,i)=>x.c.filter(m=>all.every(o=>o[i].c.indexOf(m)>=0)));
    // 左手をまとめてえらぶ（上の ①〜⑤ のじゅんにくらべる）
    const score=ms=>{let pp=0,big=0,hd=0,sum=0;
      for(let j=1;j<ms.length;j++){const dl=Math.abs(ms[j]-ms[j-1]);
        all.forEach(o=>{const a=o[j-1].rh, B=o[j].rh; if(par(ms[j-1],ms[j],a,B))pp++; if(hid(ms[j-1],ms[j],a,B))hd++;});
        if(dl>=10)big++; sum+=dl;}
      return [pp,big,hd,sum,ms.reduce((x,y)=>x+y,0)];};
    const less=(x,y)=>{for(let k=0;k<x.length;k++) if(x[k]!==y[k]) return x[k]<y[k]; return false;};
    let best=null;
    const go=(i,ms)=>{
      if(i===cs.length){const sc=score(ms);if(!best||less(sc,best.sc))best={sc,ms};return;}
      for(const m of cands[i]) go(i+1,[...ms,m]);
    };
    go(0,[]);
    if(!best) return null; // 右手が低すぎて左手をおけない
    return cs.map(({ch,rh,d,b},i)=>{
      const m=best.ms[i], r=mod(d-E.ROOT[ch],7), inv=r===0?0:r===2?1:r===4?2:3;
      return {ch,label:E.LABEL[ch],inv,rh,lh:[{...b,midi:m,k:d+(m-b.midi)/12*7}],bassDeg:d};
    });
  };
  E.build=(key,typeId,variant)=>{
    const pid=E.patternOf(typeId,variant); if(!pid||!E.allowed(key,typeId)) return null;
    return voiceSpec(key,SPEC[pid]);
  };
  // 和音の名前（てんかい＝いちばん下が根音ではない形）
  E.labelText=c=>c.label+(c.inv?'（てんかい）':'');
  // がくふの和音記号（藝大式・PA.rn の部品）：右上に転回形の数字（Ⅴ₇¹ など）
  E.rnOf=c=>{const p=PA.rnOf(c.label);return p?{...p,...(c.inv?{inv:c.inv}:{})}:c.label;};
  // さいごの2つの和音で名前がきまるわけ（だから ○○終止、のまえのところ）
  E.why=(key,typeId,variant)=>{
    const d=E.build(key,typeId,variant); if(!d) return '';
    // q：「音名」をまるごと行がかわらないように（♯・♭の前でも）
    const a=d[2], b=d[3], arrow=`<b>${E.labelText(a)} → ${E.labelText(b)}</b>`, top=b.rh[b.rh.length-1], q=n=>`<span class="nw">「${PA.H(PA.nm(n))}」</span>`;
    if(typeId==='perfect') return `さいごが${arrow}で、いちばん上が主音${q(top)}`;
    if(typeId==='imperfect') return variant==='B'
      ?`さいごが${arrow}。でもⅤ7のいちばん下が根音ではなく${q(a.lh[0])}`
      :`さいごが${arrow}。でもいちばん上が主音ではなく${q(top)}`;
    if(typeId==='half') return `さいごが${arrow}。Ⅴでとまる`;
    if(typeId==='plagal') return `さいごが${arrow}`;
    if(typeId==='deceptive') return `さいごが${arrow}。ⅠのかわりにⅥ`;
    if(typeId==='phrygian') return `短調で、さいごが${arrow}。いちばん下が${q(a.lh[0])}から${q(b.lh[0])}へ半音下がる`;
    return '';
  };
})();
/* ===== ならびの聴きわけ（progression.html）：Ⅰからはじまる和音のならびを聴いて、「？」の1つについて答える =====
 * 和音の高さは PA.ending.voiceSpec（おわりかたとおなじ左手のえらびかた）。test/progression.test.mjs で26調すべてをたしかめる。
 * PA.prog.TPL[id] … {rows:[[和音, 右手の k, 左手の度数（なければ根音）], …], chord:[和音を当てる「？」の場所], bass:[いちばん下を当てる「？」の場所]}
 *   k は音階のなんばんめ（PA.at(key.scale,k)。0＝主音、7＝1オクターブ上、-1＝主音の1つ下）。「？」は0（さいしょのⅠ）にはならない。
 * PA.prog.FAMS … いちばん上の音を当てるなかま [{id, tpls:[おなじ和音のならびで、右手だけちがう3つ]}]
 * PA.prog.STEPS … [{n, name, desc}]（ステップ1〜5）
 * PA.prog.RH＝[55,84]（右手の高さ：ソ3〜ド6）、PA.prog.BASS＝[40,59]（左手：ミ2〜シ3）
 * q（1もん）＝{step:1〜5, type:'chord'|'bass'|'top', t:TPL の id, i:「？」の場所（top は -1）, minor, keyIdx}
 * PA.prog.key(q) → 調（主音の高さは、右手がおさまるように TPL・なかまごとにきめる）
 * PA.prog.build(q) → [{ch, label, inv, rh:[音×3], lh:[音], bassDeg}]（PA.ending.build とおなじ形）。PA.prog.buildT(key, t)＝調と TPL から
 *   （なかまの TPL は左手の高さがそろう。いちばん上の音のもんだいで、ちがうのは右手だけ）
 * PA.prog.choices(q) → こたえの id の列（chord：'I'…、bass：'root'|'third'|'fifth'|'seventh'、top：TPL の id）。PA.prog.answer(q) → せいかい
 * PA.prog.subst(q, c) → 「？」に c を入れたならび（ためしに入れて聴く・くらべてきく）。c がせいかいなら build(q) とおなじ
 *   chord：c の基本の形、bass：「？」の和音のいちばん下を c の音に。どちらも右手は1つ1つ近い音へ（和音の音がそろう・導音と第7音は1つだけ）、
 *   左手は P.BASS のなか。となりの和音と5度・8度のままうごかない形をえらぶ。top：なかまのならび
 * PA.prog.make(step, {rand, bags, prev}) → あたらしい q。bags＝こたえのふくろ（ページがほぞんする。中身はかえられる）
 * PA.prog.validQ(q) → ほぞんしたもんだいがつかえるか。PA.prog.why(q) → やさしい説明（HTML。音名はいまの設定で）
 * PA.prog.topLine(data) → いちばん上の音の列。PA.prog.choiceLabel(q, c) → こたえの名前（ただの文字）
 * PA.prog.readLink(PA.params()) → {step:1〜5|null, n:1〜20|null, slow:true|false}
 */
(function(){
  const P=PA.prog={}, E=PA.ending, mod=PA.mod;
  PA.COL.II='#b8641a'; PA.LCOL.II='#fbe8d6'; // Ⅱ（ステップ3だけ）
  P.RH=[55,84]; P.BASS=[40,59];
  const R=(ch,ks,b)=>b==null?[ch,ks]:[ch,ks,b];
  const T=P.TPL={
    // ステップ1：Ⅰ・Ⅳ・Ⅴ（Ⅰ→Ⅳ→Ⅴ→Ⅰ・Ⅰ→Ⅳ→Ⅰ→Ⅴ・Ⅰ→Ⅴ→Ⅰ→Ⅳ。「？」の場所だけでこたえがきまらないように）
    s1a:{rows:[R('I',[0,2,4]),R('IV',[0,3,5]),R('V',[-1,1,4]),R('I',[0,2,4])],chord:[1,2,3]},
    s1b:{rows:[R('I',[2,4,7]),R('IV',[3,5,7]),R('V',[1,4,6]),R('I',[2,4,7])],chord:[1,2,3]},
    s1c:{rows:[R('I',[4,7,9]),R('IV',[5,7,10]),R('V',[4,6,8]),R('I',[4,7,9])],chord:[1,2,3]},
    s1d:{rows:[R('I',[0,2,4]),R('IV',[0,3,5]),R('I',[0,2,4]),R('V',[-1,1,4])],chord:[1,2,3],bass:[1]},
    s1e:{rows:[R('I',[2,4,7]),R('IV',[3,5,7]),R('I',[2,4,7]),R('V',[1,4,6])],chord:[1,2,3]},
    s1f:{rows:[R('I',[4,7,9]),R('IV',[5,7,10]),R('I',[4,7,9]),R('V',[4,6,8])],chord:[1,2,3]},
    s1g:{rows:[R('I',[2,4,7]),R('V',[1,4,6]),R('I',[2,4,7]),R('IV',[3,5,7])],chord:[1,2,3],bass:[1,2,3]},
    s1h:{rows:[R('I',[0,2,4]),R('V',[-1,1,4]),R('I',[0,2,4]),R('IV',[0,3,5])],chord:[1,2,3]},
    s1i:{rows:[R('I',[4,7,9]),R('V',[4,6,8]),R('I',[4,7,9]),R('IV',[5,7,10])],chord:[1,2,3]},
    // ステップ2：Ⅴ7・Ⅵ
    s2a:{rows:[R('I',[0,2,4]),R('IV',[0,3,5]),R('V7',[-1,3,4]),R('I',[0,2,4])],chord:[1,2,3]},
    s2b:{rows:[R('I',[2,4,7]),R('IV',[3,5,7]),R('V7',[3,4,6]),R('I',[2,4,7])],chord:[2,3]},
    s2c:{rows:[R('I',[0,2,4]),R('IV',[0,3,5]),R('V7',[-1,3,4]),R('VI',[0,2,7])],chord:[2,3]}, // Ⅴ7 → Ⅵ（Ⅵは第3音が2つ）
    s2d:{rows:[R('I',[2,4,7]),R('VI',[2,5,7]),R('IV',[3,5,7]),R('V',[1,4,6])],chord:[1,2,3],bass:[2]}, // bass は短調だけ（フリギアの m4 とならべる）
    s2e:{rows:[R('I',[2,4,7]),R('V',[1,4,6]),R('VI',[0,2,7]),R('IV',[0,3,5])],chord:[1,2,3]}, // Ⅴ → Ⅵ：いちばん上の導音はドへ上がる（Ⅵは第3音が2つ）
    s2f:{rows:[R('I',[0,2,4]),R('VI',[0,2,5]),R('IV',[0,3,5]),R('V7',[-1,3,4])],chord:[1,3]},
    // さいごのⅠ：いちばん上をミにすると、導音（まん中）がドへ上がれば第5音のないⅠ、第5音へ下がればⅠの音がそろう。どちらも第3音は2つ。
    //   ここは音がそろうほう（まん中の導音は第5音へ下がる。説明では「導音が上がる」とはいわない）
    s2g:{rows:[R('I',[4,7,9]),R('IV',[5,7,10]),R('V7',[3,6,8]),R('I',[2,4,9])],chord:[2,3]},
    t3b:{rows:[R('I',[0,2,4]),R('VI',[0,2,5]),R('IV',[0,3,5]),R('V',[-1,1,4])],chord:[1,2,3]},
    t3c:{rows:[R('I',[4,7,9]),R('VI',[5,7,9]),R('IV',[5,7,10]),R('V',[4,6,8])],chord:[1,2,3]},
    // ステップ3：いちばん下の音（転回形）。見える「？」の和音の名前・場所・和音の数がおなじで、いちばん下がちがうもんだいが、かならず2ついじょうある
    s3a:{rows:[R('I',[2,4,7]),R('IV',[3,5,7]),R('I',[2,4,7],4),R('V',[1,4,6]),R('I',[2,4,7])],bass:[2]}, // Ⅰの第2転回形 → Ⅴ（いちばん下はそのまま）
    s3i:{rows:[R('I',[0,2,4]),R('V7',[-1,3,4],1),R('I',[0,2,4],2),R('V',[-1,1,4]),R('I',[0,2,4])],bass:[2]}, // Ⅴ7の第2転回形 → Ⅰの第1転回形（いちばん下がド→レ→ミ）
    s3b:{rows:[R('I',[2,4,7]),R('V',[1,4,8],-1),R('I',[2,4,7]),R('V',[1,4,6])],bass:[1]},
    s3c:{rows:[R('I',[0,2,4]),R('I',[0,4,7],2),R('IV',[0,3,5]),R('V',[-1,1,4]),R('I',[0,2,4])],bass:[3]},
    s3j:{rows:[R('I',[2,4,7]),R('IV',[3,5,7]),R('I',[2,4,7]),R('V',[1,4,8],-1),R('I',[2,4,7])],bass:[3]}, // Ⅴの第1転回形（いちばん下のシがドへ上がる）
    s3d:{rows:[R('I',[2,4,7]),R('V7',[1,3,4],-1),R('I',[0,2,4]),R('IV',[0,3,5])],bass:[1]},
    s3e:{rows:[R('I',[2,4,7]),R('V7',[1,4,6],3),R('I',[0,4,7],2),R('IV',[0,3,5])],bass:[1,2]},
    s3f:{rows:[R('I',[2,4,7]),R('IV',[3,5,7]),R('II',[1,5,8],3),R('V',[1,4,6])],bass:[2]}, // Ⅱの第1転回形（長調だけ）
    s3h:{rows:[R('I',[2,4,7]),R('IV',[3,5,7]),R('II',[3,5,8]),R('V',[4,6,8])],bass:[2]}, // Ⅱの基本の形（長調だけ。短調のⅡは基本の形にしない）
    s3g:{rows:[R('I',[2,4,7]),R('V',[1,4,6]),R('I',[2,4,7]),R('IV',[0,3,7],5)],bass:[3]}, // Ⅳの第1転回形
    s3k:{rows:[R('I',[0,2,4]),R('IV',[0,3,5],0),R('I',[0,2,4]),R('V',[-1,1,4])],bass:[1]}, // Ⅳの第2転回形（いちばん下はドのまま）
    // 短調だけ：フリギア（PA.ending とおなじ形）
    m4:{rows:[R('I',[0,2,4]),R('VI',[0,2,5]),R('IV',[0,3,7],5),R('V',[1,4,6])],chord:[3],bass:[2]}
  };
  P.IDS=Object.keys(T);
  // いちばん上の音を当てるなかま（おなじ和音のならび。右手だけちがう）
  P.FAMS=[
    {id:'f1',tpls:['s1a','s1b','s1c']}, // Ⅰ→Ⅳ→Ⅴ→Ⅰ
    {id:'f2',tpls:['s2a','s2b','s2g']}, // Ⅰ→Ⅳ→Ⅴ7→Ⅰ
    {id:'f3',tpls:['s2d','t3b','t3c']}, // Ⅰ→Ⅵ→Ⅳ→Ⅴ
    {id:'f4',tpls:['s1d','s1e','s1f']}  // Ⅰ→Ⅳ→Ⅰ→Ⅴ
  ];
  P.famOf=t=>P.FAMS.find(f=>f.tpls.indexOf(t)>=0)||null;
  P.STEPS=[
    {n:1,name:'Ⅰ・Ⅳ・Ⅴ',desc:'「？」の和音はⅠ・Ⅳ・Ⅴのどれ？（長調）'},
    {n:2,name:'Ⅴ7・Ⅵ',desc:'Ⅴ7とⅥもなかまいり。5つから当てる（長調）'},
    {n:3,name:'いちばん下の音',desc:'「？」の和音の、いちばん下の音はどれ？（転回形）'},
    {n:4,name:'いちばん上の音',desc:'いちばん上の音が、どう動いたかを当てる'},
    {n:5,name:'短調もまぜて',desc:'短調も出るよ。ステップ2〜4のもんだいがまざる'}
  ];
  P.FEEL={I:'おちつく',II:'Ⅴへすすむ',IV:'ひろがる',V:'もどりたい',V7:'もっともどりたい',VI:'Ⅰのかわり'};
  P.BASS_ROLES={root:{name:'根音',form:'基本の形',d:0},third:{name:'第3音',form:'第1転回形',d:2},fifth:{name:'第5音',form:'第2転回形',d:4},seventh:{name:'第7音',form:'第3転回形',d:6}};
  const ROLE_OF=['root',null,'third',null,'fifth',null,'seventh'];
  // ステップ・長調／短調・こたえかたごとの TPL
  const S1=['s1a','s1b','s1c','s1d','s1e','s1f','s1g','s1h','s1i'], S2=['s2a','s2b','s2c','s2d','s2e','s2f','s2g','t3b','t3c'];
  const S3=['s3a','s3i','s3b','s3c','s3j','s3d','s3e','s3f','s3h','s3g','s3k','s1g','s1d']; // 長調のいちばん下のもんだい
  const S3M=['s3a','s3i','s3b','s3c','s3j','s3d','s3e','s3g','s3k','s1g','s1d','m4','s2d']; // 短調（Ⅱはつかわない。かわりにフリギアのⅣ）
  const MCH=['s1a','s2b','s2c','m4','s2d']; // 短調の和音のもんだい（Ⅰ→Ⅳ→Ⅴ→Ⅰ・Ⅴ7→Ⅰ・Ⅴ7→Ⅵ・フリギア・Ⅰ→Ⅵ→Ⅳ→Ⅴ）
  const FAM_T=[].concat(...P.FAMS.map(f=>f.tpls));
  P.pool=(step,minor,type)=>{
    if(step===1) return !minor&&type==='chord'?S1:[];
    if(step===2) return !minor&&type==='chord'?S2.concat(S1):[];
    if(step===3) return !minor&&type==='bass'?S3:[];
    if(step===4) return !minor&&type==='top'?FAM_T:[];
    if(step!==5) return [];
    if(type==='chord') return minor?MCH:S2.concat(S1);
    if(type==='bass') return minor?S3M:S3;
    return type==='top'?FAM_T:[];
  };
  P.CHORDS1=['I','IV','V']; P.CHORDS2=['I','IV','V','V7','VI'];

  // 主音の高さ：TPL（なかまに入っていればなかまぜんぶ）の右手が P.RH におさまり、まん中がラ4ぐらいになる高さ
  const group=t=>{const f=P.famOf(t);return f?f.tpls:[t];};
  const kRange=t=>{let lo=99,hi=-99;group(t).forEach(id=>T[id].rows.forEach(r=>r[1].forEach(k=>{lo=Math.min(lo,k);hi=Math.max(hi,k);})));return [lo,hi];};
  const keyCache={};
  P.keyFor=(minor,idx,t)=>{
    const id=(minor?'m':'M')+idx+':'+group(t).join(','), c=keyCache[id]; if(c) return c;
    const [lo,hi]=kRange(t), tpc=PA.keyOf(minor,idx).tpc;
    let best=null,bd=1e9;
    for(let m=36+mod(tpc-36,12);m<=84;m+=12){
      const k=PA.keyOf(minor,idx,m), a=PA.at(k.scale,lo).midi, b=PA.at(k.scale,hi).midi;
      if(a<P.RH[0]||b>P.RH[1]) continue;
      // 左手が長6度より大きくとぶところ（右手が低くて左手が下へにげる）がすくないほう、つぎにまん中がラ4に近いほう
      let jumps=0;
      group(t).forEach(id=>{const d=P.buildT(k,id);if(!d){jumps+=99;return;}for(let j=1;j<d.length;j++) if(Math.abs(d[j].lh[0].midi-d[j-1].lh[0].midi)>9) jumps++;});
      const sc=jumps*100+Math.abs((a+b)/2-69.5); if(sc<bd){bd=sc;best=k;}
    }
    return keyCache[id]=best;
  };
  // なかまの TPL は左手の高さもそろえる（くらべて聴くとき、ちがうのは右手だけ）
  P.buildT=(key,t)=>{const f=P.famOf(t);return E.voiceSpec(key,T[t].rows,f?f.tpls.filter(x=>x!==t).map(x=>T[x].rows):null);};
  P.key=q=>P.keyFor(q.minor,q.keyIdx,q.t);
  P.build=q=>P.buildT(P.key(q),q.t);
  P.topLine=data=>data.map(c=>c.rh[c.rh.length-1]);
  P.roleOf=c=>ROLE_OF[mod(c.bassDeg-E.ROOT[c.ch],7)];
  P.choices=q=>{
    if(q.type==='top'){const f=P.famOf(q.t);return f?f.tpls.slice():[];}
    if(q.type==='bass') return T[q.t].rows[q.i][0]==='V7'?['root','third','fifth','seventh']:['root','third','fifth'];
    return q.step===1?P.CHORDS1.slice():P.CHORDS2.slice();
  };
  P.answer=q=>{
    if(q.type==='top') return q.t;
    const row=T[q.t].rows[q.i];
    if(q.type==='bass') return ROLE_OF[mod((row[2]==null?E.ROOT[row[0]]:row[2])-E.ROOT[row[0]],7)];
    return row[0];
  };
  const isInt=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
  P.validQ=q=>{
    if(!q||typeof q!=='object'||Array.isArray(q)) return false;
    if(!isInt(q.step,1,5)||['chord','bass','top'].indexOf(q.type)<0||typeof q.minor!=='boolean'||!isInt(q.keyIdx,0,PA.keyCount(q.minor)-1)) return false;
    if(typeof q.t!=='string'||!Object.prototype.hasOwnProperty.call(T,q.t)||P.pool(q.step,q.minor,q.type).indexOf(q.t)<0) return false;
    if(q.type==='top') return q.i===-1;
    return (T[q.t][q.type]||[]).indexOf(q.i)>=0;
  };
  // 和音の音（音階のなんばんめ）
  const degsOf=ch=>(ch==='V7'?[0,2,4,6]:[0,2,4]).map(x=>E.ROOT[ch]+x);
  const notesNear=(key,degs,m,w)=>{const out=[];degs.forEach(d=>{for(let o=-3;o<=3;o++){const n=PA.at(key.scale,d+7*o);if(Math.abs(n.midi-m)<=w) out.push(n);}});return out;};
  const rowOf=(ch,rh,b)=>{const r=mod(b.k-E.ROOT[ch],7);return {ch,label:E.LABEL[ch],inv:r===0?0:r===2?1:r===4?2:3,rh,lh:[b],bassDeg:b.k};};
  const less=(x,y)=>{for(let k=0;k<x.length;k++) if(x[k]!==y[k]) return x[k]<y[k]; return false;};
  const vox=c=>[c.lh[0]].concat(c.rh);
  // A→B で5度・8度のままうごく2つの声（どちらもうごく。おなじ向きも反対むきも）の数
  const parN=(A,B)=>{let n=0;
    for(let x=0;x<A.length;x++) for(let y=x+1;y<A.length;y++){
      const u=mod(A[y].midi-A[x].midi,12), v=mod(B[y].midi-B[x].midi,12);
      if(u===v&&(u===0||u===7)&&A[x].midi!==B[x].midi&&A[y].midi!==B[y].midi) n++;
    }
    return n;};
  // 右手の声がいれかわる・左手が長6度より大きくとぶ
  const roughN=(A,B)=>{let n=Math.abs(B[0].midi-A[0].midi)>9?1:0;
    for(let j=1;j<3;j++){if(B[j].midi>A[j+1].midi) n++; if(B[j+1].midi<A[j].midi) n++;}
    return n;};
  // 増2度（たとえば短調のファ→ソ♯）でとぶ声の数
  const aug2N=(A,B)=>{let n=0;for(let v=0;v<A.length;v++) if(Math.abs(B[v].midi-A[v].midi)===3&&Math.abs(B[v].k-A[v].k)===1) n++;return n;};
  // data の i ばんめを、和音 ch・左手の度数 bd にかえた形（ためしに入れて聴く・くらべてきく）。
  //   右手は1つ1つ近い音へ、左手は P.BASS のなかで右手より下。和音の音がそろう（Ⅴ7は根音・第3音・第7音）・導音と第7音は1つだけ。
  //   となりの和音と5度・8度のままうごかない・増2度でとばない形を先にえらぶ。
  //   つぎに、つぎがⅠ・Ⅵのとき Ⅴ7の第7音は1つ下へ・いちばん上の導音は主音へすすむ形（ルール4。左手はきまっているので右手だけ）。
  //   そのあとで右手の動きが小さい形
  const revoice=(key,data,i,ch,bd)=>{
    const row=data[i], prev=data[i-1], next=data[i+1];
    const degs=degsOf(ch), need=(ch==='V7'?[degs[0],degs[1],degs[3]]:degs).map(d=>mod(d,7));
    const lt=ch==='V'||ch==='V7'?mod(E.ROOT[ch]+2,7):null, sev=ch==='V7'?mod(E.ROOT[ch]+6,7):null;
    const bassC=[]; for(let o=-4;o<=3;o++){const n=PA.at(key.scale,bd+7*o); if(n.midi>=P.BASS[0]&&n.midi<=P.BASS[1]) bassC.push(n);}
    for(const w of [9,12]){
      const cand=row.rh.map(n=>notesNear(key,degs,n.midi,w).filter(x=>x.midi>=P.RH[0]&&x.midi<=P.RH[1]));
      let best=null;
      cand[0].forEach(a=>cand[1].forEach(b=>cand[2].forEach(c=>{
        if(!(a.midi<b.midi&&b.midi<c.midi)||b.midi-a.midi>12||c.midi-b.midi>12) return;
        bassC.forEach(bs=>{
          if(bs.midi>=a.midi) return;
          const vs=[bs,a,b,c], ks=vs.map(n=>mod(n.k,7));
          if(!need.every(d=>ks.indexOf(d)>=0)) return;
          if(lt!=null&&ks.filter(d=>d===lt).length>1) return;
          if(sev!=null&&ks.filter(d=>d===sev).length>1) return;
          const pp=(prev?parN(vox(prev),vs)+aug2N(vox(prev),vs):0)+(next?parN(vs,vox(next))+aug2N(vs,vox(next)):0), rough=(prev?roughN(vox(prev),vs):0)+(next?roughN(vs,vox(next)):0);
          let tend=0;
          if(next&&(next.ch==='I'||next.ch==='VI')){
            const B=vox(next);
            if(sev!=null) for(let j=1;j<4;j++) if(mod(vs[j].k,7)===sev&&B[j].k!==vs[j].k-1) tend++;
            if(lt!=null&&mod(c.k,7)===lt&&B[3].k!==c.k+1) tend++;
          }
          const mv=Math.abs(a.midi-row.rh[0].midi)+Math.abs(b.midi-row.rh[1].midi)+Math.abs(c.midi-row.rh[2].midi);
          const cost=[pp,tend,rough,mv,Math.abs(bs.midi-row.lh[0].midi),Math.abs(c.midi-row.rh[2].midi),c.midi,b.midi,a.midi,bs.midi];
          if(!best||less(cost,best.cost)) best={cost,rh:[a,b,c],bs};
        });
      })));
      if(best) return rowOf(ch,best.rh,best.bs);
    }
    return null;
  };
  // 和音を当てるもんだい：「？」に ch（基本の形）を入れる
  P.substChord=(key,data,i,ch)=>revoice(key,data,i,ch,E.ROOT[ch]);
  // いちばん下を当てるもんだい：「？」の和音のいちばん下を role の音にする（右手も、和音の音がそろうように近い音へ）
  P.substBass=(key,data,i,role)=>{
    const row=data[i], R0=P.BASS_ROLES[role]; if(!R0||(role==='seventh'&&row.ch!=='V7')) return null;
    return revoice(key,data,i,row.ch,E.ROOT[row.ch]+R0.d);
  };
  P.subst=(q,c)=>{
    if(P.choices(q).indexOf(c)<0) return null;
    const data=P.build(q); if(c===P.answer(q)) return data;
    if(q.type==='top') return P.buildT(P.key(q),c);
    const key=P.key(q), row=q.type==='bass'?P.substBass(key,data,q.i,c):P.substChord(key,data,q.i,c);
    if(!row) return null;
    return data.map((x,i)=>i===q.i?row:x);
  };
  P.choiceLabel=(q,c)=>{
    if(q.type==='bass') return 'いちばん下が'+P.BASS_ROLES[c].name+'（'+P.BASS_ROLES[c].form+'）';
    if(q.type==='top') return PA.namesT(P.topLine(P.buildT(P.key(q),c)),'→');
    return E.LABEL[c];
  };

  // リンクのパラメータ（先生がおくる）：step＝1〜5、n＝1〜20（れんしゅうの回）、slow＝1（ゆっくり）。ちがう値はすてる
  P.readLink=p=>{
    const o={step:null,n:null,slow:false}, s=k=>p&&typeof p[k]==='string'?p[k]:'';
    if(/^[1-5]$/.test(s('step'))) o.step=+s('step');
    if(/^\d{1,2}$/.test(s('n'))&&+s('n')>=1&&+s('n')<=20) o.n=+s('n');
    o.slow=s('slow')==='1';
    return o;
  };

  /* ----- もんだいをつくる ----- */
  const shuffle=(a,rnd)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const x=a[i];a[i]=a[j];a[j]=x;}return a;};
  const pick=(a,rnd)=>a[Math.floor(rnd()*a.length)];
  // ふくろ：items を1つずつ入れてまぜ、なくなったら入れなおす（items にないものはすてる）
  const draw=(bags,name,items,rnd)=>{
    let b=Array.isArray(bags[name])?bags[name].filter(x=>items.indexOf(x)>=0):[];
    if(!b.length) b=shuffle(items.slice(),rnd);
    const v=b.shift(); bags[name]=b; return v;
  };
  P.BAG_NAMES=['p5m','p5t','p5s','fam','chord1','chord2','chordm','bassg','bassgm'];
  // こたえる前にカードの名前が見えるか：chord＝さいしょのⅠだけ、bass＝さいしょのⅠと「？」の和音、top＝ぜんぶ（なかまはおなじ和音のならび）
  //   ほかの和音の名前が見えると、聴かなくてもならびからこたえがわかってしまうので
  P.shown=(q,i)=>q.type==='top'||i===0||(q.type==='bass'&&i===q.i);
  // こたえる前に見えるもの（長調・短調、和音の数、「？」の場所、bass は「？」の和音の名前）。おなじ look のなかに、こたえが2ついじょうあるようにする
  P.look=(t,i,type,minor)=>(minor?'m':'M')+T[t].rows.length+i+(type==='bass'?T[t].rows[i][0]:'');
  P.make=(step,o)=>{
    o=o||{}; const rnd=o.rand||Math.random, bags=o.bags||{}, prev=o.prev&&typeof o.prev==='object'?o.prev:null;
    let minor=false, type=step===3?'bass':step===4?'top':'chord';
    if(step===5){
      minor=draw(bags,'p5m',['major','minor'],rnd)==='minor';
      type=minor?draw(bags,'p5t',['chord','bass','top','chord'],rnd):({2:'chord',3:'bass',4:'top'})[draw(bags,'p5s',['2','3','4'],rnd)];
    }
    const pool=P.pool(step,minor,type), notPrev=t=>!prev||t!==prev.t;
    let t,i;
    if(type==='top'){
      const fams=P.FAMS.filter(f=>f.tpls.some(x=>pool.indexOf(x)>=0)), fid=draw(bags,'fam',fams.map(x=>x.id),rnd), f=P.FAMS.find(x=>x.id===fid);
      const ts=f.tpls.filter(notPrev);
      t=pick(ts.length?ts:f.tpls,rnd); i=-1;
    }else{
      const slots=[];
      pool.forEach(id=>(T[id][type]||[]).forEach(j=>slots.push({t:id,i:j,a:P.answer({t:id,i:j,type}),lk:P.look(id,j,type,minor)})));
      const uniq=a=>a.filter((x,k)=>a.indexOf(x)===k);
      let ss;
      if(type==='bass'){
        // いちばん下：さきに look をえらび（第5音・第7音があるものは2ばい）、そのなかでこたえを半分ずつ。どの look でも、こたえは見ただけではわからない
        const lks=uniq(slots.map(s=>s.lk)), w=[];
        lks.forEach(l=>{const rare=slots.some(s=>s.lk===l&&(s.a==='fifth'||s.a==='seventh'));w.push(l);if(rare) w.push(l);});
        const lk=draw(bags,minor?'bassgm':'bassg',w,rnd), as=uniq(slots.filter(s=>s.lk===lk).map(s=>s.a)), want=pick(as,rnd);
        ss=slots.filter(s=>s.lk===lk&&s.a===want);
      }else{
        // 和音：こたえはふくろで同じくらいずつ。そのこたえがある「？」の場所を同じくらいずつ（場所だけでこたえがわからないように）
        const choices=step===1?P.CHORDS1:P.CHORDS2;
        const have=choices.filter(c=>slots.some(s=>s.a===c));
        const want=draw(bags,step===1?'chord1':minor?'chordm':'chord2',have,rnd);
        const lk=pick(uniq(slots.filter(s=>s.a===want).map(s=>s.lk)),rnd);
        ss=slots.filter(s=>s.a===want&&s.lk===lk);
        // ステップ2（と5の長調）：4もんに1もんぐらいは、ステップ1のならび（Ⅴ と Ⅴ7 をくらべられるように）
        if(!minor&&step!==1){
          const s1=ss.filter(s=>S1.indexOf(s.t)>=0), s2=ss.filter(s=>S1.indexOf(s.t)<0);
          ss=s1.length&&(!s2.length||rnd()<0.4)?s1:s2;
        }
      }
      const np=ss.filter(s=>notPrev(s.t)), s=pick(np.length?np:ss,rnd);
      t=s.t; i=s.i;
    }
    const n=PA.keyCount(minor), keys=[];
    for(let k=0;k<n;k++) if(!prev||prev.minor!==minor||prev.keyIdx!==k) keys.push(k);
    return {step,type,t,i,minor,keyIdx:pick(keys,rnd)};
  };

  /* ----- やさしい説明 ----- */
  const N=n=>PA.nmH(n);
  const deg=n=>mod(n.k,7);
  // 右手で、a の音階の dg ばんめの音が、つぎの和音 b でどこへ動いたか
  const moveOf=(a,b,dg)=>{const j=a.rh.findIndex(n=>deg(n)===dg);return j<0?null:{from:a.rh[j],to:b.rh[j]};};
  const joinMoves=parts=>parts.map((p,j)=>p+(j<parts.length-1?'り、':'って、')).join('');
  P.why=q=>{
    const data=P.build(q), key=P.key(q), last=data.length-1;
    if(q.type==='top'){
      const tl=P.topLine(data), leaps=[];
      for(let j=1;j<tl.length;j++) if(Math.abs(tl[j].k-tl[j-1].k)>=2) leaps.push(`${N(tl[j-1])}→${N(tl[j])}`);
      return `いちばん上の音は${tl.map(N).join('→')}。`+(leaps.length?`${leaps.join('、')}のところでとぶ。ほかは、おなじ音かとなりの音へ動く`:'おなじ音か、となりの音へなめらかに動く');
    }
    const i=q.i, c=data[i], prev=data[i-1], next=data[i+1];
    if(q.type==='bass'){
      const role=P.roleOf(c), Rr=P.BASS_ROLES[role], b=c.lh[0], nb=next&&next.lh[0];
      let h=`${c.label}のいちばん下が${Rr.name}の${N(b)}（${Rr.form}）。`;
      if(next&&role==='fifth'&&nb.midi===b.midi){
        const mv=c.rh.map((n,j)=>({a:n,b:next.rh[j]})).filter(m=>m.a.midi!==m.b.midi).reverse(); // 上の声から
        h+=`いちばん下が${N(b)}のままで、上が${mv.map(m=>`${N(m.a)}→${N(m.b)}`).join('、')}と動く（${c.label}の${Rr.form}→${next.label}）`;
      }else if(next&&role==='seventh'&&nb.midi<b.midi) h+=`そのあと、いちばん下の${N(b)}が${N(nb)}へ下がる`;
      else if(next&&(c.ch==='V'||c.ch==='V7')&&role==='third'&&nb.midi>b.midi&&nb.midi-b.midi<=2) h+=`そのあと、いちばん下の${N(b)}が${N(nb)}へ上がる`;
      else h+=`いちばん下の音は${data.slice(Math.max(0,i-1),i+2).map(x=>N(x.lh[0])).join('→')}と動く`;
      return h;
    }
    const minor=!!key.minor;
    if(c.ch==='V7'||c.ch==='V'){
      const v=c.label, seven=PA.at(key.scale,3);
      const h=c.ch==='V7'?`Ⅴに${N(seven)}がくわわったⅤ7。だから「もっともどりたい」。`:(q.step===1?'':`Ⅴ7とくらべると、${N(seven)}が入っていないぶん、すっきりしたひびき。`);
      if(!next) return h+`${v}でとまったので、まだつづく感じ（Ⅰへもどりたい）`;
      if(next.ch==='I'){
        const parts=[], lt=moveOf(c,next,6), sv=c.ch==='V7'?moveOf(c,next,3):null;
        if(lt&&lt.to.midi>lt.from.midi) parts.push(`${N(lt.from)}が${N(lt.to)}へ上が`);
        if(sv&&sv.to.midi<sv.from.midi) parts.push(`${N(sv.from)}が${N(sv.to)}へ下が`);
        return h+(parts.length?`${v}の${joinMoves(parts)}Ⅰでおちついた`:`${v}からⅠへすすんで、おちついた`);
      }
      if(next.ch==='VI') return h+(i+1===last
        ?`${v}のあと、ⅠのかわりにⅥへ。おわると思ったら、${minor?'ちがう':'すこしくらい'}和音へ（あれっ？）`
        :`${v}のあと、Ⅰへもどると思ったら、かわりに${minor?'':'すこしくらい'}Ⅵへ（あれっ？）`);
      return h+`${v}から${next.label}へすすむ`;
    }
    if(c.ch==='I') return i===last?'さいごがⅠなので、おちついておわった':`${prev.label}からⅠにもどって、ひと休み`;
    if(c.ch==='IV'){
      const same=c.rh.filter(n=>prev.rh.some(x=>x.midi===n.midi));
      return 'Ⅳは「ひろがる」感じ。'+(same.length?`${prev.label}の${PA.namesH(same)}がそのままのこって、ほかの音が動く`:`${prev.label}からⅣへ、ぜんぶの音が動く`);
    }
    if(c.ch==='VI') return `ⅥはⅠのかわりになる和音。Ⅰと音が2つおなじなので、にているけど、${minor?'すこし明るい':'すこしくらい'}ひびき`;
    return '';
  };
})();
PA.reduceMotion=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
PA.scrollTop=()=>window.scrollTo({top:0,behavior:PA.reduceMotion()?'auto':'smooth'});
})();
