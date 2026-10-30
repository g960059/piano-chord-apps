/* 和音の聴きわけ：🏆 チャレンジ（ランキング）のきまり ── ear.html とサーバー（src/worker.js）で共通
 *
 * もとは和音ききわけ（waon-kikiwake）の public/js/game.js。採点のきまりはそのままなので、
 * いままでのランキングのきろくとくらべられる（かえるときは両方のランキングがくるうので注意）。
 *
 * つかいかた
 *   ブラウザ：<script src="assets/core.js"></script><script src="assets/ear-game.js"></script>
 *             → window.EarGame（PA があれば PA.earGame もおなじもの）
 *   Worker・node：import '../assets/ear-game.js'; const EG = globalThis.EarGame;
 *   （export は書かない。ふつうの script と ES モジュールのどちらで読んでも、globalThis に1つおくだけ）
 *
 * きまり
 * - 和音のしゅるい（TYPE_IDS 10こ）とレベル（LEVELS[1]〜[8]：しゅるい・もういちどきける回数 replays・wide・arp）
 * - チャレンジ：ライフ3つ。5もんつづけて正解でレベルアップ（L8クリアでマスター、L8のまま）。
 *   まちがえるとライフが1つへり、1つ前のレベルへ（L1より下にはならない）。ライフ0でおわり。
 * - 問題のしゅるいは typeRng = mulberry32(seed) だけできめる（1もんに1回だけよぶ）。
 *   音のつくりかた（根音・転回形・高さ）はべつの乱数 mulberry32(voiceSeed(seed))。サーバーはつかわない。
 * - 名前のチェック（checkName）・自動ニックネーム・週の名前（weekId）もここ（画面とサーバーでおなじ）。
 * - DOM・PA・Math.random はつかわない（makeNickname は rng をわたす）。
 * - iOS Safari 12でもうごく書きかた：オプショナルチェーン・null 合体演算子・Object.fromEntries・クラスのフィールドはつかわない
 *   （globalThis はあるときだけ。なければ self・window）。
 */
(function (root) {
  'use strict';

  /* ===== 和音のしゅるい（ear.html の ORDER とおなじならび） ===== */
  const TYPE_IDS = Object.freeze(['maj', 'min', 'dim', 'aug', 'sus4', 'dom7', 'maj7', 'min7', 'hdim7', 'dim7']);
  const isTypeId = v => typeof v === 'string' && TYPE_IDS.indexOf(v) >= 0;

  /* ===== レベル =====
   * replays：🏆 チャレンジでこたえる前にもういちどきける回数（null＝なんどでも）、wide：ひろい高さとひらいた形、arp：さいしょはばらばらに鳴らす */
  const L_DEF = [
    ['はじめて', ['maj', 'dim7'], null, false, false],
    ['3しゅるい', ['maj', 'min', 'dim7'], null, false, false],
    ['4しゅるい', ['maj', 'min', 'dom7', 'dim7'], null, false, false],
    ['三和音4つ', ['maj', 'min', 'dim', 'aug'], null, false, false],
    ['5しゅるい', ['maj', 'min', 'sus4', 'dom7', 'dim7'], 3, false, false],
    ['七の和音', ['dom7', 'maj7', 'min7', 'dim7'], 3, true, false],
    ['8しゅるい', ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'hdim7'], 2, true, false],
    ['ぜんぶ', TYPE_IDS.slice(), 2, true, true],
  ];
  // LEVELS[0] は null（LEVELS[1]〜LEVELS[8] をつかう）
  const LEVELS = Object.freeze([null].concat(L_DEF.map((d, i) => Object.freeze({
    n: i + 1, name: d[0], types: Object.freeze(d[1].slice()), replays: d[2], wide: d[3], arp: d[4],
  }))));
  const MAX_LEVEL = 8;

  /* ===== チャレンジのきまり ===== */
  const CHALLENGE = Object.freeze({
    lives: 3,            // ライフ
    clear: 5,            // このかずつづけて正解でレベルアップ
    startLevel: 1,
    maxLevel: MAX_LEVEL,
    maxAnswers: 600,     // 1回でおくれる答えのかず
    minMsPerAnswer: 800, // 1もんあたりのいちばんみじかい時間（サーバーがみる）
    runTtlMs: 2 * 60 * 60 * 1000, // サーバーが1回のチャレンジをうけつける時間（2時間）
  });

  /* ===== 乱数 ===== */
  // mulberry32：32bit のたねから [0,1) をかえす。整数の計算だけなのでブラウザと Worker でおなじ列になる
  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const voiceSeed = seed => (seed ^ 0x9e3779b9) | 0;

  /* ===== 問題のしゅるい =====
   * れんしゅう（ear.html の makeQ）は「前とおなじしゅるいなら60% でえらびなおす」。ここではそれとおなじかくりつを
   * 1回の乱数で出す（n しゅるいならおなじ：ほか＝ (2n+3)：(5n+3)）。
   * 「3回つづけない」きまりはつけない（2しゅるいしかない L1で、つぎが聴かなくてもわかってしまうから）。
   * state.recent：これまでのしゅるい（さいごがいちばん新しい）。state.level：いまのレベル。 */
  function nextType(state, typeRng) {
    const types = LEVELS[state.level].types, n = types.length;
    const rec = state.recent || [], p1 = rec[rec.length - 1];
    const ws = types.map(t => (t === p1 ? 2 * n + 3 : 5 * n + 3));
    const sum = ws.reduce((s, w) => s + w, 0);
    let x = Math.floor(typeRng() * sum); // ちょうど1回
    for (let i = 0; i < n; i++) { if (x < ws[i]) return types[i]; x -= ws[i]; }
    return types[n - 1];
  }
  // しゅるいをおぼえる（つかうのはさいごの1つ）
  function remember(state, type) {
    const rec = (state.recent || []).slice(-1);
    rec.push(type);
    state.recent = rec;
  }

  /* ===== チャレンジのすすみかた ===== */
  function newChallenge() {
    return {
      level: CHALLENGE.startLevel, // いまのレベル
      best: CHALLENGE.startLevel,  // とどいたいちばん上のレベル
      streak: 0,                   // れんぞく正解（0..clear-1）
      lives: CHALLENGE.lives,
      mastered: false,
      correct: 0,
      total: 0,
      over: false,
      recent: [],
      history: [],
    };
  }
  /* 1もん答える。かえす event：'ok'（正解）、'up'（レベルアップ）、'master'（L8クリア）、'down'（まちがい・1つ下へ）、'over'（ライフ0）。
   * おわったあとは何もしないで null をかえす。 */
  function applyAnswer(state, type, answer) {
    if (state.over) return null;
    const lv = state.level, ok = isTypeId(answer) && answer === type;
    let event;
    state.total++;
    remember(state, type);
    if (ok) {
      state.correct++;
      state.streak++;
      if (state.streak >= CHALLENGE.clear) {
        state.streak = 0;
        if (lv >= MAX_LEVEL) { state.mastered = true; state.level = MAX_LEVEL; event = 'master'; }
        else { state.level = lv + 1; event = 'up'; }
      } else event = 'ok';
    } else {
      state.streak = 0;
      state.lives--;
      state.level = Math.max(1, lv - 1);
      if (state.lives <= 0) { state.lives = 0; state.over = true; event = 'over'; }
      else event = 'down';
    }
    if (state.level > state.best) state.best = state.level;
    state.history.push({ level: lv, type: type, answer: answer, ok: ok, event: event, lives: state.lives });
    return event;
  }
  function resultOf(state) {
    return {
      level: state.best,      // とどいたレベル（ランキングにつかう）
      current: state.level,   // いまのレベル
      mastered: state.mastered,
      correct: state.correct,
      total: state.total,
      lives: state.lives,
      over: state.over,
      history: state.history,
    };
  }
  /* サーバーの採点：seed と答えの列からさいごまでやりなおす。ライフ0のあとの答えはむしする。 */
  function simulate(seed, answers) {
    const rng = mulberry32(seed), st = newChallenge(), list = answers || [];
    for (let i = 0; i < list.length; i++) {
      if (st.over) break;
      applyAnswer(st, nextType(st, rng), list[i]);
    }
    return resultOf(st);
  }
  /* 画面用：seed からしゅるいの列を1もんずつ。answer(id) のあと question() でつぎ。
   * const run = createRun(seed); run.type() → いまのしゅるい（こたえるまでおなじ）、run.answer('maj') → event
   * simulate(seed, run.answers) とかならずおなじ結果になる。 */
  function createRun(seed) {
    const typeRng = mulberry32(seed), state = newChallenge(), answers = [];
    let cur = null;
    return {
      seed: seed, state: state, answers: answers,
      type() {
        if (state.over) return null;
        if (cur == null) cur = nextType(state, typeRng);
        return cur;
      },
      answer(id) {
        const t = this.type(); if (t == null) return null;
        answers.push(id);
        const event = applyAnswer(state, t, id);
        cur = null;
        return { ok: id === t, event: event, type: t };
      },
      result() { return resultOf(state); },
    };
  }
  /* ランキングのならび：レベル（マスターは9）→ 正解数。大きいほうが上。
   * （正解数は CHALLENGE.maxAnswers 以下なので1000でわければかさならない） */
  const rankLevel = r => (r.mastered ? 9 : r.level);
  const scoreKey = r => rankLevel(r) * 1000 + Math.min(999, r.correct | 0);
  // 並べかえ用（上の人が先）。同じなら at（記録した時刻）がはやいほうが先
  const compareResults = (a, b) => scoreKey(b) - scoreKey(a) || (a.at == null ? 0 : a.at) - (b.at == null ? 0 : b.at);

  /* ===== 週の名前（日本時間の ISO 週・月曜はじまり。例 '2026-W44'）と日にち ===== */
  const JST_MS = 9 * 60 * 60 * 1000;
  const pad2 = n => (n < 10 ? '0' : '') + n;
  function weekId(now) {
    const d = new Date((now == null ? Date.now() : now) + JST_MS); // UTC の関数で日本時間の暦をよむ
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dow = (d.getUTCDay() + 6) % 7;                 // 月=0 … 日=6
    const thu = new Date(day + (3 - dow) * 86400000);    // その週の木曜日の年が ISO 年
    const year = thu.getUTCFullYear();
    const week = 1 + Math.floor((thu.getTime() - Date.UTC(year, 0, 1)) / (7 * 86400000));
    return year + '-W' + pad2(week);
  }
  function jstDay(now) {
    return new Date((now == null ? Date.now() : now) + JST_MS).toISOString().slice(0, 10);
  }

  /* ===== 名前のチェック（画面とサーバーでおなじきまり） =====
   * NFKC でそろえる（全角英数→半角、半角カナ→全角、全角空白→半角）→ 空白をまとめる →
   * 1〜12文字（コードポイント）、ひらがな・カタカナ・漢字・英数字・「ー」「・」・空白だけ。
   * URL・メールアドレス・長い数字（電話番号など）・よくないことば・なりすましはだめ。 */
  const NAME_MAX = 12;
  // ひらがな・カタカナはふつうの文字だけ（小さいカタカナ拡張 ㇱ などや変体がなはだめ）
  const NAME_CHAR_RE = /^[ぁ-ゖゝゞァ-ヺヽヾ\p{Script=Han}A-Za-z0-9ー・ 々〆ヶ]+$/u;
  // 文字の中に入っていたらだめ（くらべる前に「ー」を消すので、ここの「ー」も消してくらべる）
  const NG_CONTAINS = [
    // 日本語（ひらがなに直してくらべる）
    'ころすぞ', 'ころして', 'きえろ', 'ばかやろ', 'くそやろ', 'くそがき', 'きちがい', 'しねしね', 'しねよ', 'くたばれ', 'しんじまえ', 'ぶっころ',
    'ちんこ', 'ちんぽ', 'ちんちん', 'まんこ', 'きんたま', 'せっくす', 'おなに', 'れいぷ', 'やりまん', 'やりちん', 'ちくび', 'おっぱい', 'うんこ',
    'ひとらー',
    '死ね', '死んで', '殺', '杀', '糞', '氏ね', '障害者', '障碍', '基地外', '気違', '池沼', '強姦', '売春', '自殺',
    '馬鹿', '阿呆', '阿保', '消えろ', '変態', '気持ち悪', '不細工',
    // なりすまし
    'せんせい', '先生', 'うんえい', '運営', 'かんりしゃ', '管理者', 'こうしき', '公式', 'admin', 'official', 'teacher',
    // 英語・ローマ字（小文字にして、数字を文字に直したものともくらべる）
    'fuck', 'shit', 'bitch', 'cunt', 'dickhead', 'pussy', 'penis', 'vagina', 'porn', 'sex', 'nigg', 'asshole', 'bastard',
    'whore', 'slut', 'retard', 'nazi', 'hitler', 'killyou',
    'unko', 'unchi', 'chinko', 'manko', 'korosu', 'kimoi',
  ];
  // 名前・1語（空白か「・」でわけたもの）がこれとおなじ、またはこれだけをつなげたものならだめ
  const NG_EXACT = [
    'しね', 'しんで', 'ころす', 'ころせ', 'ばか', 'あほ', 'くず', 'かす', 'くそ', 'ぶす', 'でぶ', 'はげ', 'きもい', 'きも', 'うざい', 'うざ', 'ごみ',
    'えろ', 'えっち', 'ちび', 'へんたい', 'うんち', 'ざこ', '雑魚', 'がいじ', 'なちす',
    'ass', 'fat', 'ugly', 'idiot', 'stupid', 'dumb', 'loser', 'kill', 'rape', 'cock', 'fag', 'damn', 'sucks', 'dick', 'die', 'kys', 'fuk',
    'baka', 'aho', 'kuso', 'busu', 'shine',
  ];
  // 「おまえしね」のように、よびかけ＋だめなことばもだめ
  const NG_ADDRESS = ['おまえ', 'おめえ', 'てめえ', 'てめ', 'きさま', 'omae', 'temee'];
  // ふつうのことばや名前の中にたまたま入ってしまうもの（くらべる前にとりのぞく）
  const NG_ALLOW = ['うんちく', 'まんこう', '殺陣', 'dickson', 'dickens', 'dickinson', 'badminton', 'essex', 'sussex'];
  const NG_URLISH = /(https?|www|\bcom\b|\bnet\b|\borg\b|\bco\s*jp\b|\bne\s*jp\b|\bline\s*me\b|mailto)/i;

  const kataToHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // 1語をそろえる：「ー」を消して、おわりの小さいかな（しねぇ・うざっ・ばかぁ）を消す
  const canonWord = t => t.replace(/ー/g, '').replace(/[ぁぃぅぇぉっゃゅょゎ]+$/, '');
  const NG_C = NG_CONTAINS.map(w => w.replace(/ー/g, ''));
  const NG_PIECES = [];
  NG_EXACT.map(canonWord).forEach(w => { if (NG_PIECES.indexOf(w) < 0) NG_PIECES.push(w); });
  const isNgExact = t => NG_PIECES.indexOf(t) >= 0;
  // s がだめなことば（とよびかけ）だけでできていて、だめなことばが1つ以上あるか
  function onlyNgWords(s) {
    const n = s.length, st = new Uint8Array(n + 1); // 1 = ここまでよびかけだけ、2 = だめなことばがあった
    st[0] = 1;
    for (let i = 0; i < n; i++) {
      if (!st[i]) continue;
      for (let j = 0; j < NG_PIECES.length; j++) { const w = NG_PIECES[j]; if (s.startsWith(w, i)) st[i + w.length] |= 2; }
      for (let j = 0; j < NG_ADDRESS.length; j++) { const w = NG_ADDRESS[j]; if (s.startsWith(w, i)) st[i + w.length] |= st[i]; }
    }
    return (st[n] & 2) !== 0;
  }
  // 数字の見かた（l33t）：0→o 1→i/l 3→e 4→a 5→s 7→t、fv→fu
  const LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 7: 't' };
  const leet = (s, one) => s.replace(/fv/g, 'fu').replace(/[013457]/g, c => (c === '1' ? one : LEET[c]));
  function ngWordIn(lower) {
    const variants = /[013457]|fv/.test(lower) ? [lower, leet(lower, 'i'), leet(lower, 'l')] : [lower];
    const clean = s => NG_ALLOW.reduce((a, w) => a.split(w).join(' '), s);
    return variants.some(v => {
      const words = v.split(/[ ・]+/).map(canonWord).filter(Boolean);
      const squashed = canonWord(v.replace(/[ ・]/g, ''));
      // 「含む」は1語ずつ。ふたつの名前のさかいめ（こころせな → ころせ）は見ない。
      // ただし1語だけ、または1文字ずつばらした（f u c k・ばか）ときはぜんぶつなげても見る
      const cTargets = words.length <= 1 || words.some(w => Array.from(w).length === 1) ? words.concat([squashed]) : words;
      if (cTargets.some(t => { const c = clean(t); return NG_C.some(w => c.indexOf(w) >= 0); })) return true;
      // せんせ・せんせー（〜せんせも）
      return [squashed].concat(words).some(t => isNgExact(t) || onlyNgWords(t) || /せんせ$/.test(t));
    });
  }
  // 電話番号など：空白・ー・・を消してから、数字が5けた以上つづくか7こ以上（漢数字〇一二… だけでも同じ）
  function tooManyDigits(lower) {
    const s = lower.replace(/[ ー・]/g, '');
    return [/[0-9]/, /[〇一二三四五六七八九]/].some(d =>
      new RegExp(d.source + '{5,}').test(s) || s.split('').filter(c => d.test(c)).length >= 7);
  }
  function normalizeName(raw) {
    if (typeof raw !== 'string') return '';
    return raw.normalize('NFKC').replace(/[\s　]+/g, ' ').trim();
  }
  /* → { ok: true, name }または { ok: false, error }（name はそろえたあとの名前。おくるのはこれ） */
  function checkName(raw) {
    if (typeof raw !== 'string') return { ok: false, error: '名前を入れてね' };
    if (raw.length > 100) return { ok: false, error: '名前が長すぎるよ（12文字まで）' };
    const name = normalizeName(raw);
    if (/@/.test(name) || /[a-z0-9-]+\s*\.\s*[a-z]{2,}/i.test(name) || /:\/\//.test(name)) {
      return { ok: false, error: 'URL やメールアドレスは入れられないよ' };
    }
    const len = Array.from(name).length;
    if (len < 1) return { ok: false, error: '名前を入れてね' };
    if (len > NAME_MAX) return { ok: false, error: '名前が長すぎるよ（12文字まで）' };
    if (!NAME_CHAR_RE.test(name)) return { ok: false, error: 'ひらがな・カタカナ・漢字・英数字・「ー」「・」だけ使えるよ' };
    if (/^[ ー・]+$/.test(name)) return { ok: false, error: '名前を入れてね' };
    const lower = kataToHira(name).toLowerCase();
    if (NG_URLISH.test(lower)) return { ok: false, error: 'URL やメールアドレスは入れられないよ' };
    if (tooManyDigits(lower)) return { ok: false, error: '長い数字は入れられないよ' };
    if (ngWordIn(lower)) return { ok: false, error: 'その名前は使えないよ。ちがう名前にしてね' };
    return { ok: true, name: name };
  }

  /* ===== 自動ニックネーム（ひらがなのことば＋カタカナのどうぶつ） ===== */
  const NICK_ADJ = ['おどる', 'うたう', 'わらう', 'はしる', 'ねむい', 'ひかる', 'げんきな', 'やさしい', 'かしこい', 'すばやい', 'のんびり', 'ふわふわ',
    'きらきら', 'にこにこ', 'ぴかぴか', 'もぐもぐ', 'てくてく', 'ころころ', 'ちいさな', 'おおきな', 'まあるい', 'ゆかいな', 'しずかな', 'あかるい', 'つよい', 'はずむ'];
  const NICK_ANIMAL = ['ペンギン', 'ウサギ', 'パンダ', 'コアラ', 'ラッコ', 'イルカ', 'クジラ', 'リス', 'ネコ', 'イヌ', 'キツネ', 'タヌキ', 'フクロウ', 'ヒヨコ',
    'カメ', 'ゾウ', 'キリン', 'ライオン', 'トラ', 'アザラシ', 'カワウソ', 'インコ', 'カピバラ', 'モモンガ', 'ヒツジ', 'アルパカ', 'ハムスター', 'シマリス', 'オウム', 'ペリカン'];
  function makeNickname(rng) {
    return NICK_ADJ[Math.floor(rng() * NICK_ADJ.length)] + ' ' + NICK_ANIMAL[Math.floor(rng() * NICK_ANIMAL.length)];
  }

  const EarGame = Object.freeze({
    TYPE_IDS: TYPE_IDS, isTypeId: isTypeId, LEVELS: LEVELS, MAX_LEVEL: MAX_LEVEL, CHALLENGE: CHALLENGE,
    mulberry32: mulberry32, voiceSeed: voiceSeed, nextType: nextType, remember: remember,
    newChallenge: newChallenge, applyAnswer: applyAnswer, resultOf: resultOf, simulate: simulate, createRun: createRun,
    rankLevel: rankLevel, scoreKey: scoreKey, compareResults: compareResults,
    weekId: weekId, jstDay: jstDay,
    NAME_MAX: NAME_MAX, normalizeName: normalizeName, checkName: checkName,
    NICK_ADJ: Object.freeze(NICK_ADJ.slice()), NICK_ANIMAL: Object.freeze(NICK_ANIMAL.slice()), makeNickname: makeNickname,
  });
  root.EarGame = EarGame;
  if (root.PA && typeof root.PA === 'object') root.PA.earGame = EarGame;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : window);
