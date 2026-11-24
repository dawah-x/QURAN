/* ==========================================================================
   DAWAH X — আল-কুরআন | static Quran reader, no dependencies
   Data: window.SURAHS (names), window.QURAN (Uthmani verses),
         window.BN_TRANSLATION (index: meta + has-notes bitmap; the full
           bundle is loaded lazily on the first search),
         window.BN_SURAHS (lazily loaded per-sura translations),
         window.BN_TAFSIR (lazily loaded tafsir/footnotes per sura),
         window.QURAN_META (Hafs juz/page/hizb/ruku/sajda/revelation data),
         window.HADITH_INDEX + lazy window.HADITH_DATA shards (Bukhari/Muslim).
   ========================================================================== */
(function () {
  'use strict';

  var S = window.SURAHS;
  var Q = window.QURAN;
  var BNT = window.BN_TRANSLATION || { meta: {}, hasNotes: [] };
  var META = window.QURAN_META;
  var BUILD = { v: '14', date: '২৪ নভেম্বর ২০২৬' };
  var app = document.getElementById('app');
  var BISMILLAH = Q.verses[0][0];
  var IBN_KATHIR_LINE = 'তাফসীর ইবনে কাসীর · বাংলা: তাওহীদ পাবলিকেশন · QUL (Tarteel) resource 31 · spa5k/tafsir_api — <a href="CREDITS.md">ক্রেডিট</a>';
  var SOURCE_LINE = 'অনুবাদ ও টীকা: ড. আবূ বকর মুহাম্মাদ যাকারিয়া · ' +
    '<a href="https://quranenc.com/bn/browse/bengali_zakaria" target="_blank" rel="noopener noreferrer">QuranEnc.com</a> ' +
    '(bengali_zakaria v1.1.1) · লেখা অপরিবর্তিত';

  /* FLAT[i] = verse #i+1 (global ayah id == i+1). Arabic normalization is
     precomputed at boot; the Bengali search index is built only after the
     full translation bundle has been loaded once (see loadFullBn). */
  var FLAT = [], BN_FLAT = [], bnFlatReady = false, bnFlatLoading = false;
  Q.verses.forEach(function (arr, i) {
    arr.forEach(function (t, j) {
      FLAT.push({ s: i + 1, a: j + 1, id: FLAT.length + 1, t: t, n: norm(t), r: asciiDigits(t) });
    });
  });
  var START = [0];
  for (var si = 0; si < 114; si++) START.push(START[si] + Q.counts[si]);
  var NOTE_COUNT = (BNT.hasNotes || []).reduce(function (n, arr) {
    return n + arr.filter(Boolean).length;
  }, 0);
  var SAJDA = {};
  if (META) META.sajda.forEach(function (id) { SAJDA[id] = true; });

  var ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.2"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.2"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h7M9 11h5"/></svg>'
  };

  /* ------------------------------ storage ------------------------------ */
  var KEY = 'dawahx-quran:';
  function load(k, fallback) {
    try {
      var v = localStorage.getItem(KEY + k);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(k, v) {
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }

  var state = {
    view: 'home',
    theme: load('theme', 'dark'),
    qfs: Math.min(56, Math.max(20, Number(load('qfs', 32)) || 32)),
    mode: ['cards', 'mushaf', 'study', 'focus'].indexOf(load('mode2', 'cards')) !== -1 ? load('mode2', 'cards') : 'cards',
    showTranslation: load('showTranslation2', true) !== false,
    bfs: clampLoad(load('bfs', 15), 12, 26),
    openTafsir: {},
    bookmarks: load('bookmarks', []),
    notes: load('notes', {}),
    plan: load('plan', null),
    last: load('last', null),
    filter: 'all',
    sort: 'number',
    ignore: true,
    searchTafsir: load('searchTafsir', false) === true,
    query: '',
    searchLimit: 40,
    searchSeq: 0,
    hadithQuery: '', hadithLimit: 20, hadithSearchLimit: 40, hadithSeq: 0,
    hadithBook: 'bukhari', hadithSec: 1, hadithScope: 'all',
    hadithGradeFilter: 'all', hadithGradeKey: 'daif', hadithGradeLimit: 20,
    hadithBookmarks: load('hadithBookmarks', []),
    tafsirSource: load('tafsirSource', 'zakaria') === 'ibn-kathir' ? 'ibn-kathir' : 'zakaria',
    current: { s: 1, a: 1 }
  };
  if (!Array.isArray(state.bookmarks)) state.bookmarks = [];
  if (!Array.isArray(state.hadithBookmarks)) state.hadithBookmarks = [];
  if (!state.notes || typeof state.notes !== 'object' || Array.isArray(state.notes)) state.notes = {};
  if (!state.plan || typeof state.plan !== 'object' || !Array.isArray(state.plan.done)) {
    state.plan = { done: [], start: new Date().toISOString().slice(0, 10) };
  }

  /* ------------------------------ helpers ------------------------------ */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function bn(n) { return String(n).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'[+d]; }); }
  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[+d]; }); }
  function asciiDigits(s) {
    return String(s)
      .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); })
      .replace(/[\u09E6-\u09EF]/g, function (c) { return String(c.charCodeAt(0) - 0x09E6); });
  }
  function norm(s) {
    return asciiDigits(String(s)).toLowerCase()
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
      .replace(/[\u0622\u0623\u0625\u0627]/g, '\u0627')
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0629/g, '\u0647')
      .replace(/\u0624/g, '\u0648')
      .replace(/\u0626/g, '\u064A')
      .replace(/\s+/g, ' ').trim();
  }
  function surah(n) { return S[n - 1]; }
  function verse(s, a) { return Q.verses[s - 1][a - 1]; }
  function label(s, a) { return 'সূরা ' + surah(s).bn + ' · ' + bn(a) + ' আয়াত'; }
  function refKey(s, a) { return s + ':' + a; }
  function isSaved(s, a) { return state.bookmarks.indexOf(refKey(s, a)) !== -1; }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function clampLoad(v, lo, hi) { v = Number(v); return clamp(isFinite(v) && v ? v : lo, lo, hi); }

  /* ---------- Bengali translation: per-sura lazy loading ----------
     First paint only downloads bn-index.js (35 KB). A sura's translations
     arrive as one tiny script when that sura is opened; the first search
     loads the full bundle once so searching 6,236 verses stays instant. */
  var bnPending = {}, bnFailed = {};
  function fullVerses() {
    var b = window.BN_TRANSLATION;
    return b && b.verses && b.verses.length === 114 && b.verses[0] ? b.verses : null;
  }
  function bnArr(s) {
    return (window.BN_SURAHS && window.BN_SURAHS[s]) ||
      (fullVerses() && fullVerses()[s - 1]) || null;
  }
  function bnReady(s) { return !!bnArr(s); }
  function bnText(s, a) { var arr = bnArr(s); return arr ? (arr[a - 1] || '') : ''; }
  function hasTafsir(s, a) {
    if (state.tafsirSource === 'ibn-kathir') return true; // 6,236 ayah entries
    return !!(BNT.hasNotes[s - 1] && BNT.hasNotes[s - 1][a - 1]);
  }
  function gid(s, a) { return START[s - 1] + a; }
  function fromGid(id) { var v = FLAT[id - 1]; return v ? { s: v.s, a: v.a } : { s: 1, a: 1 }; }

  function loadBn(s, cb) {
    if (bnReady(s) || bnFailed[s]) { cb(); return; }
    if (bnPending[s]) { bnPending[s].push(cb); return; }
    bnPending[s] = [cb];
    var tag = document.createElement('script');
    tag.src = 'assets/bn/' + s + '.js?v=14';
    tag.onload = finish;
    tag.onerror = function () { bnFailed[s] = true; toast('অনুবাদ লোড করা যায়নি'); finish(); };
    function finish() {
      var waiting = bnPending[s] || []; delete bnPending[s];
      waiting.forEach(function (fn) { fn(); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    }
    document.head.appendChild(tag);
  }
  function loadBnMany(list, cb) {
    var left = list.length;
    if (!left) { cb(); return; }
    list.forEach(function (s) { loadBn(s, function () { if (--left === 0) cb(); }); });
  }
  function loadFullBn(cb) {
    if (fullVerses() || bnFailed.full) { cb(); return; }
    if (bnPending.full) { bnPending.full.push(cb); return; }
    bnPending.full = [cb];
    var tag = document.createElement('script');
    tag.src = 'assets/bn-translation.js?v=14';
    tag.onload = finish;
    tag.onerror = function () { bnFailed.full = true; toast('অনুবাদ ইনডেক্স লোড করা যায়নি'); finish(); };
    function finish() {
      var waiting = bnPending.full || []; delete bnPending.full;
      waiting.forEach(function (fn) { fn(); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    }
    document.head.appendChild(tag);
  }
  function buildBnFlat() {
    BN_FLAT = [];
    for (var i = 0; i < FLAT.length; i++) {
      var v = FLAT[i], t = bnText(v.s, v.a);
      BN_FLAT.push({ t: t, n: norm(t), r: asciiDigits(t) });
    }
    bnFlatReady = true;
  }
  function ensureHomeBn() {
    if (bnReady(1) || bnFailed[1]) return;
    loadBnMany([1], function () {
      if (state.view === 'home') renderHome();
    });
  }
  function ensureReaderBn(s, a) {
    if (bnReady(s) || bnFailed[s]) return;
    loadBn(s, function () {
      if (state.view === 'reader' && state.current.s === s) renderReader(s, a, false);
    });
  }

  /* ---------- Hafs metadata (juz / page / hizb / ruku / sajda) ---------- */
  function partOf(list, id) {
    if (!list || !list.length) return 0;
    var k = 1;
    for (var i = 0; i < list.length; i++) { if (list[i] <= id) k = i + 1; else break; }
    return k;
  }
  function juzOf(s, a) { return META ? partOf(META.juz, gid(s, a)) : 0; }
  function pageOf(s, a) { return META ? partOf(META.page, gid(s, a)) : 0; }
  function quarterOf(s, a) { return META ? partOf(META.hizbQuarter, gid(s, a)) : 0; }
  function rukuOf(s, a) { return META ? partOf(META.ruku, gid(s, a)) : 0; }
  function isSajda(s, a) { return !!SAJDA[gid(s, a)]; }
  function surahInfo(s) { return META ? META.surah[s - 1] : null; }
  function juzStart(j) { return fromGid(META.juz[j - 1]); }
  function juzEnd(j) { return fromGid(j < 30 ? META.juz[j] - 1 : 6236); }

  /* Tafsir is split into 114 per-sura JS files, injected only when needed.
     The loader also works from file:// (no fetch / CORS involved). */
  var tafsirPending = {}, tafsirIbnPending = {};
  function tafsirData(s) { return (window.BN_TAFSIR || {})[s]; }
  function tafsirIbnRaw(s) { return (window.BN_TAFSIR_IBN_KATHIR || {})[s]; }
  function tafsirIbnArray(s) {
    var d = tafsirIbnRaw(s);
    if (!d || !d.t || !d.m) return null;
    return d.m.map(function (k) { return d.t[k] || ''; });
  }
  function currentTafsirArray(s) {
    return state.tafsirSource === 'ibn-kathir' ? tafsirIbnArray(s) : tafsirData(s);
  }
  function loadTafsirIbn(s, cb) {
    var cached = tafsirIbnRaw(s);
    if (cached) { cb(cached); return; }
    if (tafsirIbnPending[s]) { tafsirIbnPending[s].push(cb); return; }
    tafsirIbnPending[s] = [cb];
    var tag = document.createElement('script');
    tag.src = 'assets/tafsir-ibn-kathir/' + s + '.js?v=14';
    tag.onload = function () {
      var arr = tafsirIbnRaw(s) || { t: [], m: [] };
      var waiting = tafsirIbnPending[s] || [];
      delete tafsirIbnPending[s];
      waiting.forEach(function (fn) { fn(arr); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    };
    tag.onerror = function () {
      var waiting = tafsirIbnPending[s] || [];
      delete tafsirIbnPending[s];
      toast('ইবনে কাসীরের তাফসীর লোড করা যায়নি');
      waiting.forEach(function (fn) { fn({ t: [], m: [] }); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    };
    document.head.appendChild(tag);
  }
  function loadCurrentTafsir(s, cb) {
    if (state.tafsirSource === 'ibn-kathir') loadTafsirIbn(s, cb);
    else loadTafsir(s, cb);
  }
  function loadTafsir(s, cb) {
    var cached = tafsirData(s);
    if (cached) { cb(cached); return; }
    if (tafsirPending[s]) { tafsirPending[s].push(cb); return; }
    tafsirPending[s] = [cb];
    var tag = document.createElement('script');
    tag.src = 'assets/tafsir/' + s + '.js?v=14';
    tag.onload = function () {
      var arr = tafsirData(s) || [];
      var waiting = tafsirPending[s] || [];
      delete tafsirPending[s];
      waiting.forEach(function (fn) { fn(arr); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    };
    tag.onerror = function () {
      var waiting = tafsirPending[s] || [];
      delete tafsirPending[s];
      toast('তাফসীর লোড করা যায়নি');
      waiting.forEach(function (fn) { fn([]); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    };
    document.head.appendChild(tag);
  }

  /* Full-text tafsir search: load all 114 tafsir scripts in small batches on
     the first tafsir search, build a plain-text index, then keep it in memory.
     Reuses the exact same files the reader uses — no duplicate data. */
  var tafsirFlat = null, tafsirAllPending = null;
  function stripTags(h) {
    return String(h || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
  }
  function buildTafsirFlat() {
    tafsirFlat = [];
    for (var i = 0; i < FLAT.length; i++) {
      var v = FLAT[i], arr = tafsirData(v.s) || [];
      var t = stripTags(arr[v.a - 1]);
      tafsirFlat.push({ t: t, n: norm(t), r: asciiDigits(t) });
    }
  }
  function loadAllTafsir(progress, done) {
    if (tafsirFlat) { done(); return; }
    if (tafsirAllPending) { tafsirAllPending.push(done); return; }
    tafsirAllPending = [done];
    var queue = [], cached = 0;
    for (var i = 1; i <= 114; i++) {
      if (tafsirData(i)) cached++; else queue.push(i);
    }
    var seen = cached;
    function step() {
      if (!queue.length) {
        buildTafsirFlat();
        var waiting = tafsirAllPending || []; tafsirAllPending = null;
        waiting.forEach(function (fn) { fn(); });
        return;
      }
      var batch = queue.splice(0, 6), left = batch.length;
      batch.forEach(function (s) {
        loadTafsir(s, function () {
          seen++;
          if (progress) progress(seen, 114);
          if (--left === 0) setTimeout(step, 0);
        });
      });
    }
    step();
  }
  function ibnKathirHtml(text) {
    return '<div class="tafsir-body">' + esc(String(text || '')).replace(/\n+/g, '<br>') + '</div>';
  }
  function tafsirHtml(s, a, content) {
    if (!content) return '';
    return String(content).replace(/\[([০-৯]+)\]/g, function (m, n) {
      return '<span class="fn-anchor" data-fn="' + n + '">' + m + '</span>';
    });
  }
  function bnHtml(s, a) {
    var t = bnText(s, a);
    if (!t) return '<span class="tr-loading">বাংলা অনুবাদ লোড হচ্ছে…</span>';
    return esc(t).replace(/\[([০-৯]+)\]/g, function (m, n) {
      return '<button type="button" class="fn-ref" data-action="fn" data-s="' + s +
        '" data-a="' + a + '" data-n="' + n + '" title="' + n +
        ' নং টীকা দেখুন" aria-label="' + n + ' নং টীকা">' + m + '</button>';
    });
  }
  function fnLegend(s, a) {
    return /\[[০-৯]+\]/.test(bnText(s, a))
      ? '<p class="fn-legend">সংখ্যাগুলো টীকার নম্বর — চাপলে ঐ টীকায় যাবে।</p>' : '';
  }

  function go(hash) {
    if (location.hash === '#' + hash) { renderRoute(); return; }
    location.hash = hash;
  }
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    }
    legacyCopy(text);
    return Promise.resolve();
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'light' ? '#faf6ea' : '#0b0906');
  }
  function applyQfs() {
    document.documentElement.style.setProperty('--qfs', state.qfs + 'px');
    var out = document.getElementById('fsVal');
    if (out) out.textContent = bn(state.qfs);
  }
  function applyBfs() {
    document.documentElement.style.setProperty('--bfs', state.bfs + 'px');
    var out = document.getElementById('bfsVal');
    if (out) out.textContent = bn(state.bfs);
  }
  function updateBookmarkCount() {
    var el = document.getElementById('navBookmarkCount');
    if (!el) return;
    if (state.bookmarks.length) { el.textContent = bn(state.bookmarks.length); el.hidden = false; }
    else { el.hidden = true; }
  }
  function setNav(active) {
    document.querySelectorAll('.main-nav a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === active);
    });
  }
  function setTitle(t) { document.title = t + ' · DAWAH X'; }

  /* ------------------------------ routing ------------------------------ */
  function parseRoute() {
    var raw = location.hash.slice(1) || '/';
    var parts = raw.split('?');
    var seg = parts[0].split('/').filter(Boolean).map(decodeURIComponent);
    return { seg: seg, params: new URLSearchParams(parts[1] || '') };
  }
  function renderRoute() {
    closeTafsirModal();
    var r = parseRoute();
    var seg = r.seg;
    if (seg[0] === 's') {
      var s = clamp(parseInt(seg[1], 10) || 1, 1, 114);
      var a = seg[2] === 'a' ? clamp(parseInt(seg[3], 10) || 1, 1, Q.counts[s - 1]) : 1;
      renderReader(s, a, true);
    } else if (seg[0] === 'search') {
      var q = r.params.get('q') || '';
      if (q) renderSearch(q); else renderHome();
    } else if (seg[0] === 'hadith') {
      renderHadithRoute(r);
    } else if (seg[0] === 'surahs') {
      renderSurahs();
    } else {
      renderHome();
    }
  }

  /* ------------------------------ home ------------------------------ */
  function filteredSurahs() {
    var list = S.filter(function (x) {
      var c = Q.counts[x.n - 1];
      if (state.filter === 'short') return c <= 20;
      if (state.filter === 'medium') return c > 20 && c <= 100;
      if (state.filter === 'long') return c > 100;
      return true;
    });
    if (state.sort === 'verses') list.sort(function (a, b) { return Q.counts[b.n - 1] - Q.counts[a.n - 1]; });
    else if (state.sort === 'name') list.sort(function (a, b) { return a.bn.localeCompare(b.bn, 'bn'); });
    else list.sort(function (a, b) { return a.n - b.n; });
    return list;
  }
  function surahCard(x) {
    return '<button type="button" class="surah-card" data-action="open-surah" data-s="' + x.n + '" aria-label="সূরা ' + esc(x.bn) + '">' +
      '<span class="card-octagon">' + bn(x.n) + '</span>' +
      '<span class="card-ar" lang="ar" dir="rtl">' + esc(x.ar) + '</span>' +
      '<span class="card-bn">' + esc(x.bn) + '</span>' +
      '<span class="card-en">' + esc(x.en) + '</span>' +
      '<span class="card-meta">' + bn(Q.counts[x.n - 1]) + ' আয়াত <span class="card-arrow">↗</span></span>' +
    '</button>';
  }
  function renderHome() {
    state.view = 'home';
    setTitle('আল-কুরআন ও হাদিস');
    setNav('home');

    var html =
      '<section class="hero home-hero">' +
        '<form class="search-form home-search" data-action="search-submit">' +
          '<input class="input" type="search" name="q" placeholder="কুরআন, অনুবাদ বা তাফসীরে খুঁজুন…" aria-label="অনুসন্ধান"/>' +
          '<button class="btn btn-primary" type="submit">খুঁজুন</button>' +
        '</form>' +
        '<div class="home-hero-inner">' +
          '<div class="eyebrow">বিসমিল্লাহির রহমানির রাহিম</div>' +
          '<div class="basmalah-frame"><p class="basmalah" lang="ar" dir="rtl">' + esc(BISMILLAH) + '</p></div>' +
          '<h1>আল-কুরআন</h1>' +
          '<p class="hero-sub">পবিত্র কুরআন, দুটি বাংলা তাফসীর ও ' + bn(HBOOKS.length) + ' গ্রন্থে ' +
          bn(HTOTAL) + 'টি হাদিস — পরিচ্ছন্ন এক জায়গায়, সম্পূর্ণ অফলাইন।</p>' +
          '<div class="home-actions">' +
            '<a class="btn btn-primary" href="#/s/1/a/1">কুরআন পড়ুন ' + ICON.arrow + '</a>' +
            '<a class="btn" href="#/hadith">হাদিস পড়ুন ' + ICON.arrow + '</a>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="card-panel home-verse">' +
        '<div class="kicker">প্রথম পাঠ</div>' +
        '<h2>সূরা আল-ফাতিহা · ১ আয়াত</h2>' +
        '<p class="uthmani-line" lang="ar" dir="rtl">' + esc(verse(1, 1)) + '</p>' +
        '<p class="feature-bn"><span>বাংলা অনুবাদ</span>' + esc(bnText(1, 1)) + '</p>' +
        '<a class="btn" href="#/s/1/a/1">পড়া শুরু করুন ' + ICON.arrow + '</a>' +
      '</section>';

    app.innerHTML = html;
    updateBookmarkCount();
    ensureHomeBn();
    window.scrollTo(0, 0);
  }

  function renderSurahs() {
    state.view = 'surahs';
    setTitle('সূরা সমূহ');
    setNav('surahs');
    var filters = [
      ['all', 'সব সূরা'], ['short', 'ছোট (≤২০)'], ['medium', 'মাঝারি (২১–১০০)'], ['long', 'বড় (>১০০)']
    ].map(function (f) {
      return '<button type="button" class="chip' + (state.filter === f[0] ? ' active' : '') + '" data-action="filter" data-filter="' + f[0] + '">' + f[1] + '</button>';
    }).join('');

    app.innerHTML =
      '<section class="page-head"><div class="eyebrow">' + bn(114) + ' টি সূরা</div><h1>সূরা সমূহ</h1>' +
      '<p>যেকোনো সূরায় ক্লিক করে পড়া শুরু করুন।</p></section>' +
      '<section class="surah-section" id="surahList">' +
        '<div class="surah-controls">' +
          '<div class="chip-row">' + filters + '</div>' +
          '<select class="select" id="sortSelect" aria-label="সাজানো">' +
            '<option value="number"' + (state.sort === 'number' ? ' selected' : '') + '>ক্রমানুসারে</option>' +
            '<option value="name"' + (state.sort === 'name' ? ' selected' : '') + '>নাম অনুযায়ী</option>' +
            '<option value="verses"' + (state.sort === 'verses' ? ' selected' : '') + '>বড় সূরা আগে</option>' +
          '</select>' +
        '</div>' +
        '<div class="surah-grid">' + filteredSurahs().map(surahCard).join('') + '</div>' +
      '</section>';
    updateBookmarkCount();
    window.scrollTo(0, 0);
  }

  /* ------------------------------ reader ------------------------------ */
  function tafsirBlock(content, loading, s, a) {
    var isIbn = state.tafsirSource === 'ibn-kathir';
    var head = '<div class="tafsir-head">তাফসীর / টীকা · ' + (isIbn ? 'ইবনে কাসীর' : 'যাকারিয়া') + '</div>';
    if (loading) return '<div class="verse-tafsir" data-s="' + s + '" data-a="' + a + '">' + head + '<p class="tafsir-loading">তাফসীর লোড হচ্ছে…</p></div>';
    if (!content) return '<div class="verse-tafsir" data-s="' + s + '" data-a="' + a + '">' + head + '<p class="tafsir-empty">এই আয়াতের জন্য আলাদা টীকা নেই।</p></div>';
    return '<div class="verse-tafsir" data-s="' + s + '" data-a="' + a + '">' + head +
      (isIbn ? ibnKathirHtml(content) : tafsirHtml(s, a, content)) + '</div>';
  }
  function verseHtml(s, a, target, mode, tafsirArr) {
    var saved = isSaved(s, a);
    var mushaf = mode === 'mushaf', study = mode === 'study';
    var mark = '<span class="ayah-mark">' + ar(a) + '</span>';
    var notes = hasTafsir(s, a);
    var content = tafsirArr ? tafsirArr[a - 1] : null;
    var key = refKey(s, a);

    var translation = (!mushaf && state.showTranslation)
      ? '<div class="verse-translation"><span class="tr-label">বাংলা অনুবাদ</span><div class="tr-text">' +
          bnHtml(s, a) + '</div>' + fnLegend(s, a) + '</div>'
      : '';

    var panel = '';
    if (!mushaf && (study || state.openTafsir[key]) && notes) {
      panel = tafsirBlock(content, !tafsirArr, s, a);
    }

    var actions =
      '<div class="verse-actions">' +
        (notes && !mushaf && !study ? '<button type="button" class="act-btn has-tafsir" data-action="tafsir" data-s="' + s + '" data-a="' + a + '" aria-label="তাফসীর দেখুন" title="তাফসীর / টীকা">' + ICON.book + '</button>' : '') +
        '<button type="button" class="act-btn" data-action="copy" data-s="' + s + '" data-a="' + a + '" aria-label="আয়াত কপি" title="কপি">' + ICON.copy + '</button>' +
        '<button type="button" class="act-btn' + (saved ? ' saved' : '') + '" data-action="bookmark" data-s="' + s + '" data-a="' + a + '" aria-label="সংরক্ষণ" title="সংরক্ষণ">' + ICON.star + '</button>' +
        '<button type="button" class="act-btn" data-action="share" data-s="' + s + '" data-a="' + a + '" aria-label="লিংক কপি" title="লিংক কপি">' + ICON.link + '</button>' +
      '</div>';

    return '<article class="verse' + (a === target ? ' is-target' : '') + '" id="v' + a + '"' +
        (mushaf ? ' data-action="select-ayah" data-s="' + s + '" data-a="' + a + '"' : '') + '>' +
      '<div class="verse-badge"><span class="ayah-num">' + bn(a) + '</span></div>' +
      '<div class="verse-body">' +
        '<p class="uthmani" lang="ar" dir="rtl">' + esc(verse(s, a)) + ' ' + mark +
          (isSajda(s, a) ? '<span class="sajda-mark" title="সিজদার আয়াত" aria-label="সিজদার আয়াত">۩</span>' : '') + '</p>' +
        translation + panel +
      '</div>' +
      actions +
    '</article>';
  }
  function renderReader(s, a, scroll) {
    state.view = 'reader';
    state.current = { s: s, a: a };
    var x = surah(s);
    var count = Q.counts[s - 1];
    var mushaf = state.mode === 'mushaf';
    var study = state.mode === 'study';
    var focus = state.mode === 'focus';
    var tafsirArr = currentTafsirArray(s);
    setTitle(x.bn);
    setNav('surahs');
    if (study && !tafsirArr) {
      loadCurrentTafsir(s, function () {
        if (state.view === 'reader' && state.current.s === s && state.mode === 'study') {
          renderReader(s, a, false);
        }
      });
    }

    var options = S.map(function (o) {
      return '<option value="' + o.n + '"' + (o.n === s ? ' selected' : '') + '>' + bn(o.n) + ' · ' + esc(o.bn) + '</option>';
    }).join('');

    var verses = [];
    if (focus) verses.push(verseHtml(s, a, a, 'cards', tafsirArr));
    else for (var i = 1; i <= count; i++) verses.push(verseHtml(s, i, a, state.mode, tafsirArr));

    var html =
      '<div class="reader">' +
        '<div class="reader-top">' +
          '<a class="back-link" href="#/" data-action="home">← হোম</a>' +
          '<div class="reader-nav">' +
            '<button type="button" class="btn" data-action="prev-surah" ' + (s <= 1 ? 'disabled' : '') + '>← পূর্বের</button>' +
            '<select class="select" id="surahSelect" aria-label="সূরা বাছাই">' + options + '</select>' +
            '<button type="button" class="btn" data-action="next-surah" ' + (s >= 114 ? 'disabled' : '') + '>পরের →</button>' +
          '</div>' +
        '</div>' +

        '<div class="card-panel surah-head">' +
          '<div class="surah-number">সূরা নং ' + bn(s) + ' / ' + bn(114) + '</div>' +
          '<h1 class="surah-ar" lang="ar" dir="rtl">' + esc(x.ar) + '</h1>' +
          '<p class="surah-bn">' + esc(x.bn) + '</p>' +
          '<p class="surah-sub">' + esc(x.en) + ' · ' + bn(count) + ' টি আয়াত</p>' +
          '<div class="surah-chips">' +
            (function () {
              var info = surahInfo(s), j = juzOf(s, 1), p = pageOf(s, 1), q = quarterOf(s, 1);
              var out = '<span class="chip-static">পারা ' + bn(j) + '</span>' +
                '<span class="chip-static">মুসহাফ পৃষ্ঠা ' + bn(p) + '</span>' +
                '<span class="chip-static">হিযব ' + bn(Math.ceil(q / 4)) + ' · রুবু ' + bn(((q - 1) % 4) + 1) + '</span>';
              if (info) {
                out += '<span class="chip-static ' + (info.makki ? 'makki' : 'madani') + '">' +
                  (info.makki ? 'মাক্কী' : 'মাদানী') + '</span>' +
                  '<span class="chip-static">নযিলের ক্রম ' + bn(info.order) + '</span>' +
                  '<span class="chip-static">' + bn(info.rukus) + ' রুকু</span>';
              }
              return out;
            })() +
          '</div>' +
          '<p class="meta-credit">পারা/পৃষ্ঠা/হিযব/সিজদা ও নযিল-ক্রম: <a href="CREDITS.md">quran-meta v7.0.0 (MIT), Hafs</a> — কুরআনের পাঠ নয়, আলাদা মেটাডেটা।</p>' +
        '</div>' +

        '<div class="reader-toolbar">' +
          '<div class="tool-group"><span class="tool-label">পাঠের ধরন</span>' +
            '<div class="seg">' +
              '<button type="button" data-action="mode" data-mode="cards" class="' + (state.mode === 'cards' ? 'active' : '') + '">আয়াত ধরে</button>' +
              '<button type="button" data-action="mode" data-mode="mushaf" class="' + (mushaf ? 'active' : '') + '">মুসহাফ</button>' +
              '<button type="button" data-action="mode" data-mode="study" class="' + (study ? 'active' : '') + '">অধ্যয়ন · তাফসীর</button>' +
              '<button type="button" data-action="mode" data-mode="focus" class="' + (focus ? 'active' : '') + '">ফোকাস</button>' +
            '</div>' +
          '</div>' +
          '<div class="tool-group"><span class="tool-label">তাফসীর</span>' +
            '<select class="select" id="tafsirSourceSelect" aria-label="তাফসীরের উৎস">' +
              '<option value="zakaria"' + (state.tafsirSource === 'zakaria' ? ' selected' : '') + '>যাকারিয়া</option>' +
              '<option value="ibn-kathir"' + (state.tafsirSource === 'ibn-kathir' ? ' selected' : '') + '>ইবনে কাসীর</option>' +
            '</select></div>' +
          '<label class="switch-line tool-group"><input type="checkbox" id="showTranslation" ' + (state.showTranslation ? 'checked' : '') + '/> বাংলা অনুবাদ</label>' +
          '<div class="tool-group size-control"><span class="tool-label">আরবি</span>' +
            '<button type="button" data-action="fs" data-d="-2" aria-label="আরবি অক্ষর ছোট">−</button>' +
            '<output id="fsVal">' + bn(state.qfs) + '</output>' +
            '<button type="button" data-action="fs" data-d="2" aria-label="আরবি অক্ষর বড়">+</button>' +
          '</div>' +
          '<div class="tool-group size-control"><span class="tool-label">বাংলা</span>' +
            '<button type="button" data-action="bfs" data-d="-1" aria-label="বাংলা অক্ষর ছোট">−</button>' +
            '<output id="bfsVal">' + bn(state.bfs) + '</output>' +
            '<button type="button" data-action="bfs" data-d="1" aria-label="বাংলা অক্ষর বড়">+</button>' +
          '</div>' +
          (META ? '<div class="tool-group"><span class="tool-label">পারা</span>' +
            '<select class="select" id="juzSelect" aria-label="পারা বাছাই">' +
            META.juz.map(function (id, k) {
              var st = fromGid(id);
              return '<option value="' + (k + 1) + '"' + (k + 1 === juzOf(s, a) ? ' selected' : '') + '>পারা ' + bn(k + 1) + ' · ' + esc(surah(st.s).bn) + '</option>';
            }).join('') +
            '</select></div>' : '') +
          '<form class="tool-group jump-form" data-action="jump" data-s="' + s + '">' +
            '<span class="tool-label">আয়াত</span>' +
            '<input class="input" id="jumpAyah" type="number" min="1" max="' + count + '" value="' + a + '" aria-label="আয়াত নম্বর"/>' +
            '<button class="btn" type="submit">যান</button>' +
          '</form>' +
          (META ? '<form class="tool-group jump-form" data-action="page-jump">' +
            '<span class="tool-label">পৃষ্ঠা</span>' +
            '<input class="input" id="jumpPage" type="number" min="1" max="604" value="' + pageOf(s, a) + '" aria-label="মুসহাফ পৃষ্ঠা নম্বর"/>' +
            '<button class="btn" type="submit">যান</button>' +
          '</form>' : '') +
        '</div>' +

        (s !== 1 && s !== 9 ? '<div class="bismillah-band"><p lang="ar" dir="rtl">' + esc(BISMILLAH) + '</p></div>' : '') +
        (mushaf ? '<p class="mode-hint">এই মোডে শুধু আরবি পাঠ দেখানো হচ্ছে — <strong>বাংলা অনুবাদ ও তাফসীর</strong> দেখতে «আয়াত ধরে» বা «অধ্যয়ন» বাছুন, অথবা যেকোনো আয়াতে ক্লিক করে 📖 চাপুন।</p>' : '') +

        '<div class="verses' + (mushaf ? ' mushaf' : '') + (study ? ' study' : '') + (focus ? ' focus' : '') + '" id="verses">' + verses.join(' ') + '</div>' +
        (focus ? '<div class="focus-nav">' +
          '<button type="button" class="btn" data-action="focus-prev" ' + (a <= 1 ? 'disabled' : '') + '>← আগের আয়াত</button>' +
          '<span>আয়াত ' + bn(a) + ' / ' + bn(count) + ' · পারা ' + bn(juzOf(s, a)) + ' · পৃষ্ঠা ' + bn(pageOf(s, a)) + '</span>' +
          '<button type="button" class="btn" data-action="focus-next" ' + (a >= count ? 'disabled' : '') + '>পরের আয়াত →</button>' +
        '</div>' : '') +
        '<p class="source-note">' + (state.tafsirSource === 'ibn-kathir' ? IBN_KATHIR_LINE : SOURCE_LINE) +
        ' · <a href="CREDITS.md">ক্রেডিট</a></p>' +

        '<div class="reader-bottom">' +
          '<button type="button" class="btn" data-action="prev-surah" ' + (s <= 1 ? 'disabled' : '') + '>← ' + (s > 1 ? esc(surah(s - 1).bn) : 'প্রথম সূরা') + '</button>' +
          '<span class="reader-progress">' + bn(s) + ' / ' + bn(114) + ' · ' + bn(count) + ' আয়াত</span>' +
          '<button type="button" class="btn" data-action="next-surah" ' + (s >= 114 ? 'disabled' : '') + '>' + (s < 114 ? esc(surah(s + 1).bn) : 'শেষ সূরা') + ' →</button>' +
        '</div>' +
      '</div>' +
      '<div class="ayah-bar" id="ayahBar" hidden></div>';

    app.innerHTML = html;
    applyQfs();
    applyBfs();
    updateBookmarkCount();
    save('last', refKey(s, a));
    state.last = refKey(s, a);
    if (scroll) {
      setTimeout(function () {
        var el = document.getElementById('v' + a);
        if (el && a > 1) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        else window.scrollTo(0, 0);
      }, 50);
    }
    ensureReaderBn(s, a);
  }

  function showAyahBar(s, a) {
    document.querySelectorAll('.verse').forEach(function (v) { v.classList.remove('is-target'); });
    var el = document.getElementById('v' + a);
    if (el) el.classList.add('is-target');
    var bar = document.getElementById('ayahBar');
    if (!bar) return;
    bar.innerHTML =
      '<span class="ref">' + esc(label(s, a)) + '</span>' +
      '<span class="bar-actions">' +
        (hasTafsir(s, a) ? '<button type="button" class="act-btn has-tafsir" data-action="tafsir-modal" data-s="' + s + '" data-a="' + a + '" title="অনুবাদ ও তাফসীর" aria-label="অনুবাদ ও তাফসীর">' + ICON.book + '</button>' : '') +
        '<button type="button" class="act-btn" data-action="copy" data-s="' + s + '" data-a="' + a + '" title="কপি" aria-label="কপি">' + ICON.copy + '</button>' +
        '<button type="button" class="act-btn' + (isSaved(s, a) ? ' saved' : '') + '" data-action="bookmark" data-s="' + s + '" data-a="' + a + '" title="সংরক্ষণ" aria-label="সংরক্ষণ">' + ICON.star + '</button>' +
        '<button type="button" class="act-btn" data-action="share" data-s="' + s + '" data-a="' + a + '" title="লিংক" aria-label="লিংক">' + ICON.link + '</button>' +
        '<button type="button" class="act-btn" data-action="close-ayah-bar" title="বন্ধ" aria-label="বন্ধ">' + ICON.close + '</button>' +
      '</span>';
    bar.hidden = false;
    state.current.a = a;
    state.last = refKey(s, a);
    save('last', state.last);
  }

  /* ------------------------------ tafsir UI ------------------------------ */
  function tafsirSourceTabs(s, a) {
    var z = state.tafsirSource === 'zakaria', k = !z;
    return '<div class="tafsir-source-tabs">' +
      '<button type="button" class="btn btn-sm' + (z ? ' active' : '') + '" data-action="tafsir-source" data-source="zakaria" data-s="' + s + '" data-a="' + a + '">যাকারিয়া</button>' +
      '<button type="button" class="btn btn-sm' + (k ? ' active' : '') + '" data-action="tafsir-source" data-source="ibn-kathir" data-s="' + s + '" data-a="' + a + '">ইবনে কাসীর</button>' +
    '</div>';
  }
  function fillTafsirModal(s, a) {
    var body = document.getElementById('tafsirModalBody');
    var box = body && body.querySelector('.modal-tafsir');
    if (!box) return;
    var isIbn = state.tafsirSource === 'ibn-kathir';
    box.innerHTML = '<div class="tafsir-head">তাফসীর / টীকা · ' + (isIbn ? 'ইবনে কাসীর' : 'যাকারিয়া') + '</div>' +
      '<p class="tafsir-loading">তাফসীর লোড হচ্ছে…</p>';
    loadCurrentTafsir(s, function () {
      var arr = currentTafsirArray(s) || [];
      var content = arr[a - 1];
      var now = document.getElementById('tafsirModalBody');
      var nowBox = now && now.querySelector('.modal-tafsir');
      if (!nowBox) return;
      nowBox.innerHTML = '<div class="tafsir-head">তাফসীর / টীকা · ' + (isIbn ? 'ইবনে কাসীর' : 'যাকারিয়া') + '</div>' +
        (content ? (isIbn ? ibnKathirHtml(content) : tafsirHtml(s, a, content)) :
          '<p class="tafsir-empty">এই আয়াতের জন্য আলাদা টীকা নেই।</p>');
      var note = now.querySelector('.source-note');
      if (note) note.innerHTML = isIbn ? IBN_KATHIR_LINE : SOURCE_LINE;
    });
  }
  function openTafsirModal(s, a) {
    var modal = document.getElementById('tafsirModal');
    var body = document.getElementById('tafsirModalBody');
    if (!modal || !body) return;
    modal.hidden = false;
    body.innerHTML =
      '<div class="modal-ref">' + esc(label(s, a)) + '</div>' +
      '<p class="modal-arabic" lang="ar" dir="rtl">' + esc(verse(s, a)) + '</p>' +
      '<p class="modal-translation"><strong>বাংলা অনুবাদ:</strong> <span class="tr-text">' + bnHtml(s, a) + '</span></p>' +
      tafsirSourceTabs(s, a) +
      '<div class="modal-tafsir"></div>' +
      '<p class="source-note">' + (state.tafsirSource === 'ibn-kathir' ? IBN_KATHIR_LINE : SOURCE_LINE) + '</p>';
    fillTafsirModal(s, a);
  }
  function closeTafsirModal() {
    var m = document.getElementById('tafsirModal');
    if (m) m.hidden = true;
  }
  function toggleTafsirPanel(s, a) {
    var key = refKey(s, a);
    state.openTafsir[key] = !state.openTafsir[key];
    loadCurrentTafsir(s, function () {
      if (state.view !== 'reader' || state.current.s !== s) return;
      var arr = currentTafsirArray(s) || [];
      var body = document.querySelector('#v' + a + ' .verse-body');
      if (!body) return;
      var existing = body.querySelector('.verse-tafsir');
      if (existing) existing.parentNode.removeChild(existing);
      if (state.openTafsir[key]) {
        var wrap = document.createElement('div');
        wrap.innerHTML = tafsirBlock(arr[a - 1], false, s, a);
        body.appendChild(wrap.firstChild);
      }
    });
  }

  /* ------------------------------ search ------------------------------ */
  function parseRef(k) {
    var p = String(k).split(':');
    var s = parseInt(p[0], 10), a = parseInt(p[1], 10);
    if (!s || !a || s < 1 || s > 114 || a < 1 || a > Q.counts[s - 1]) return null;
    return { s: s, a: a };
  }
  function highlight(text, q) {
    var safe = esc(text), needle = esc(q);
    if (!needle || safe.indexOf(needle) === -1) return safe;
    return safe.split(needle).join('<mark>' + needle + '</mark>');
  }
  function snippetAround(text, q) {
    var t = String(text || '');
    var pos = t.indexOf(q);
    if (pos < 0) {
      var np = norm(t).indexOf(norm(q));
      pos = np < 0 ? 0 : Math.max(0, np - 20);
    }
    var from = Math.max(0, pos - 90), to = Math.min(t.length, from + 280);
    return (from > 0 ? '…' : '') + t.slice(from, to) + (to < t.length ? '…' : '');
  }

  /* Results are drawn immediately from the Arabic index, then redrawn as the
     lazy Bengali / tafsir indexes arrive. A sequence number discards stale
     redraws while the user keeps typing. */
  function runSearch(q) {
    var box = document.getElementById('searchResults');
    if (!box) return;
    state.query = q;
    var seq = ++state.searchSeq;
    if (!norm(asciiDigits(q).trim())) {
      box.innerHTML = '<div class="empty-state"><span class="empty-icon">⌕</span><h3>কী খুঁজতে চান?</h3><p>আরবি শব্দ, <strong>বাংলা অনুবাদের শব্দ</strong>, সূরার নাম, <strong>২:২৫৫</strong> রেফারেন্স — চাইলে «তাফসীরেও খোঁজা» চালু করে টীকার ভেতরেও।</p></div>';
      return;
    }
    if (!bnFlatReady && !bnFlatLoading) {
      bnFlatLoading = true;
      loadFullBn(function () {
        bnFlatLoading = false;
        buildBnFlat();
        if (seq === state.searchSeq && state.query === q) drawSearch(q, seq);
      });
    }
    if (state.searchTafsir && !tafsirFlat) {
      loadAllTafsir(function (done, total) {
        var pr = document.getElementById('tafsirProgress');
        if (pr) pr.textContent = 'তাফসীর লোড হচ্ছে… ' + bn(done) + ' / ' + bn(total);
      }, function () {
        if (seq === state.searchSeq && state.query === q) drawSearch(q, seq);
      });
    }
    drawSearch(q, seq);
  }

  function drawSearch(q, seq) {
    if (seq !== state.searchSeq) return;
    var box = document.getElementById('searchResults');
    if (!box) return;
    var raw = asciiDigits(q).trim(), nq = norm(raw);
    if (!nq) return;

    var ref = raw.match(/^(\d{1,3})\s*[:ঃ.\-]\s*(\d{1,3})$/);
    var direct = ref ? parseRef(ref[1] + ':' + ref[2]) : null;
    var surahHits = S.filter(function (x) {
      return norm(x.ar).indexOf(nq) !== -1 || norm(x.en).indexOf(nq) !== -1 || norm(x.bn).indexOf(nq) !== -1;
    }).slice(0, 12);

    var matches = [], totalHits = 0, bnHits = 0, tfHits = 0;
    var needle = state.ignore ? nq : raw;
    for (var i = 0; i < FLAT.length; i++) {
      var v = FLAT[i];
      var arHit = (state.ignore ? v.n : v.r).indexOf(needle) !== -1;
      var b = BN_FLAT[i] || null;
      var btext = b ? b.t : bnText(v.s, v.a);
      var bnHit = !!b && (state.ignore ? b.n : b.r).indexOf(needle) !== -1;
      var tf = tafsirFlat ? tafsirFlat[i] : null;
      var tfHit = !!(state.searchTafsir && tf && needle &&
        (state.ignore ? tf.n : tf.r).indexOf(needle) !== -1);
      if (arHit || bnHit || tfHit) {
        totalHits++;
        if (bnHit && !arHit) bnHits++;
        if (tfHit && !arHit && !bnHit) tfHits++;
        if (matches.length < 400) {
          matches.push({
            s: v.s, a: v.a, t: v.t, bn: btext,
            tf: tfHit ? snippetAround(tf.t, raw) : '',
            via: tfHit && !arHit && !bnHit ? 'tafsir' : (bnHit && !arHit ? 'bn' : 'ar')
          });
        }
      }
    }

    var pending = [];
    if (!bnFlatReady) pending.push('বাংলা অনুবাদের ইনডেক্স লোড হচ্ছে…');
    if (state.searchTafsir && !tafsirFlat) {
      pending.push('<span id="tafsirProgress">তাফসীরের ১১৪টি ফাইল লোড হচ্ছে… (প্রথমবারে একটু সময় লাগে, এরপর তাৎক্ষণিক)</span>');
    }
    var html = pending.length ? '<p class="search-progress" role="status">' + pending.join(' · ') + '</p>' : '';

    if (direct) {
      html += '<div class="result-item" data-action="goto-ayah" data-s="' + direct.s + '" data-a="' + direct.a + '" role="button" tabindex="0">' +
        '<div class="result-ref"><span class="dot"></span> সরাসরি রেফারেন্স · ' + esc(label(direct.s, direct.a)) + '</div>' +
        '<div class="result-text" lang="ar" dir="rtl">' + esc(verse(direct.s, direct.a)) + '</div></div>';
    }
    if (surahHits.length) {
      html += '<p class="result-meta">সূরার নামে মিল (' + bn(surahHits.length) + ')</p><div class="result-list">' +
        surahHits.map(function (x) {
          return '<button type="button" class="result-item" data-action="open-surah" data-s="' + x.n + '">' +
            '<div class="result-ref"><span class="dot"></span> সূরা ' + bn(x.n) + ' · ' + esc(x.en) + '</div>' +
            '<div style="display:flex;align-items:baseline;gap:10px;justify-content:space-between">' +
              '<strong style="font-size:17px;color:var(--gold-soft)">' + esc(x.bn) + '</strong>' +
              '<span class="card-ar" lang="ar" dir="rtl">' + esc(x.ar) + '</span>' +
            '</div>' +
            '<div class="result-snippet">' + bn(Q.counts[x.n - 1]) + ' টি আয়াত · পড়তে ক্লিক করুন</div></button>';
        }).join('') + '</div>';
    }
    if (matches.length) {
      var shown = matches.slice(0, state.searchLimit);
      html += '<p class="result-meta">আয়াতে মিল: ' + bn(totalHits) + ' টি (বাংলা অনুবাদে ' + bn(bnHits) +
        (state.searchTafsir ? ', তাফসীরে ' + bn(tfHits) : '') + ') · ' + bn(shown.length) + ' টি দেখানো হচ্ছে</p><div class="result-list">' +
        shown.map(function (v) {
          var snippet = v.bn
            ? '<div class="result-bn-snippet"><span class="via">' + (v.via === 'bn' ? 'অনুবাদে মিল' : 'বাংলা অনুবাদ') + '</span>' + highlight(v.bn, raw) + '</div>'
            : '';
          if (v.tf) snippet += '<div class="result-tf-snippet"><span class="via">তাফসীরে মিল</span>' + highlight(v.tf, raw) + '</div>';
          return '<button type="button" class="result-item" data-action="goto-ayah" data-s="' + v.s + '" data-a="' + v.a + '">' +
            '<div class="result-ref"><span class="dot"></span> ' + esc(label(v.s, v.a)) + ' <span style="color:var(--muted);font-weight:400">(' + v.s + ':' + v.a + ')</span></div>' +
            '<div class="result-text" lang="ar" dir="rtl">' + highlight(v.t, raw) + '</div>' + snippet + '</button>';
        }).join('') + '</div>';
      if (matches.length > state.searchLimit) {
        html += '<button type="button" class="btn more-btn" data-action="more-results">আরও দেখুন ' + ICON.arrow + '</button>';
      }
    }
    if (!direct && !surahHits.length && !matches.length && !pending.length) {
      html += '<div class="empty-state"><span class="empty-icon">⌕</span><h3>কিছু পাওয়া যায়নি</h3><p>বানান বদলে বা “হরকত উপেক্ষা” চালু করে আবার চেষ্টা করুন।</p></div>';
    }
    box.innerHTML = html;
  }

  function renderSearch(q) {
    state.view = 'search';
    state.query = q || '';
    state.searchLimit = 40;
    setTitle('খোঁজার ফলাফল');
    setNav('');
    app.innerHTML =
      '<section class="results-head">' +
        '<a class="back-link" href="#/">← হোম</a>' +
        '<h1>খোঁজার ফলাফল</h1>' +
        '<div class="card-panel search-panel">' +
          '<form class="search-form compact-search" data-action="search-submit">' +
            '<input class="input" id="searchInput" type="search" name="q" value="' + esc(state.query) + '" placeholder="যেমন: আল্লাহ, রহমান, কাহফ, ২:২৫৫" aria-label="অনুসন্ধান"/>' +
            '<button class="btn btn-primary" type="submit">খুঁজুন</button>' +
          '</form>' +
          '<label class="toggle-line"><input type="checkbox" id="ignoreHarakat" ' + (state.ignore ? 'checked' : '') + '/> হরকত / তাশকিল উপেক্ষা করুন</label>' +
          '<label class="toggle-line"><input type="checkbox" id="searchTafsir" ' + (state.searchTafsir ? 'checked' : '') + '/> তাফসীর / টীকার ভেতরেও খুঁজুন <small>(প্রথমবার ১১৪টি টীকা লোড হয়)</small></label>' +
        '</div>' +
      '</section>' +
      '<div id="searchResults"></div>';
    updateBookmarkCount();
    runSearch(state.query);
    window.scrollTo(0, 0);
    if (state.query) {
      var input = document.getElementById('searchInput');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
  }

  /* ------------------------------ juz / khatma plan ------------------------------ */
  function renderPlanWidget() {
    var el = document.getElementById('planWidget');
    if (!el) return;
    var done = state.plan.done.length;
    if (!done) { el.innerHTML = ''; return; }
    el.innerHTML = '<a class="plan-widget" href="#/plan">' +
      '<span class="plan-widget-label">খতম পরিকল্পনা</span>' +
      '<span class="plan-bar"><i style="width:' + Math.round(done / 30 * 100) + '%"></i></span>' +
      '<span>' + bn(done) + ' / ' + bn(30) + ' পারা সম্পন্ন · চালিয়ে যান →</span></a>';
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function suggestedJuz() {
    var start = Date.parse(state.plan.start || todayISO());
    var day = Math.floor((Date.parse(todayISO()) - start) / 86400000);
    return clamp((isFinite(day) ? day : 0) + 1, 1, 30);
  }
  function renderPlan() {
    state.view = 'plan';
    setTitle('পারা ও খতম পরিকল্পনা');
    setNav('plan');
    var done = state.plan.done.length, pct = Math.round(done / 30 * 100), sug = suggestedJuz();
    var cards = META.juz.map(function (id, k) {
      var j = k + 1, st = juzStart(j), en = juzEnd(j);
      var n = (j < 30 ? META.juz[j] : 6237) - id;
      var isDone = state.plan.done.indexOf(j) !== -1;
      return '<div class="juz-card' + (isDone ? ' done' : '') + '">' +
        '<div class="juz-head"><span class="juz-no">পারা ' + bn(j) + '</span>' +
        (isDone ? '<span class="juz-done">✓ সম্পন্ন</span>' : (j === sug ? '<span class="juz-today">আজ</span>' : '')) + '</div>' +
        '<p class="juz-range">' + esc(surah(st.s).bn) + ' ' + bn(st.a) + ' → ' + esc(surah(en.s).bn) + ' ' + bn(en.a) + ' · ' + bn(n) + ' আয়াত</p>' +
        '<div class="juz-actions">' +
          '<button type="button" class="btn" data-action="open-juz" data-j="' + j + '">পড়ুন ' + ICON.arrow + '</button>' +
          '<button type="button" class="btn btn-ghost" data-action="plan-toggle" data-j="' + j + '">' + (isDone ? 'সম্পন্ন সরান' : 'সম্পন্ন করুন') + '</button>' +
        '</div></div>';
    }).join('');
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow">পাঠ পরিকল্পনা</div><h1>পারা ও খতম</h1>' +
      '<p>৩০ পারায় ভাগ করে পড়ুন — প্রতিদিন এক পারা হিসেবে ৩০ দিনে খতম। অগ্রগতি শুধু এই ব্রাউজারে সংরক্ষিত হয়।</p></section>' +
      '<div class="card-panel plan-summary">' +
        '<div class="plan-summary-head"><strong>আপনার অগ্রগতি</strong><span>' + bn(done) + ' / ' + bn(30) + ' পারা · ' + bn(pct) + '%</span></div>' +
        '<div class="plan-bar large" role="progressbar" aria-label="খতমের অগ্রগতি" aria-valuenow="' + done + '" aria-valuemin="0" aria-valuemax="30"><i style="width:' + pct + '%"></i></div>' +
        '<p>শুরু: ' + esc(state.plan.start || todayISO()) + ' · আজকের জন্য প্রস্তাব: <strong>পারা ' + bn(sug) + '</strong></p>' +
        '<div class="plan-actions">' +
          '<button type="button" class="btn btn-primary" data-action="open-juz" data-j="' + sug + '">আজকের পারা পড়ুন ' + ICON.arrow + '</button>' +
          '<button type="button" class="btn btn-ghost" data-action="plan-reset">পরিকল্পনা রিসেট</button>' +
        '</div>' +
      '</div>' +
      '<div class="juz-grid">' + cards + '</div>' +
      '<p class="meta-credit">পারার সীমানা: <a href="CREDITS.md">quran-meta v7.0.0 (MIT), Hafs কিরাআত</a> — মাদিনা মুসহাফের প্রচলিত ৩০ পারা।</p>';
    updateBookmarkCount();
    window.scrollTo(0, 0);
  }


  /* ------------------------------ hadith (offline) ------------------------------ */
  /* 10 books from the committed verbatim snapshots. The small index is
     loaded at boot; each section is a lazy <script> shard. Full-text search
     loads shards in batches for the chosen scope, then keeps one compact
     normalised index in memory (no duplicated text). */
  var H = window.HADITH_INDEX;
  var hadithPending = {}, hadithFailed = {}, hadithFlat = {}, hadithAllPending = {};
  var HBOOKS = H ? Object.keys(H.books) : [];
  var HTOTAL = HBOOKS.reduce(function (n, id) { return n + H.books[id].total; }, 0);

  function hBook(id) { return (H && H.books && H.books[id]) || null; }
  function hSections(id) {
    var b = hBook(id);
    return b ? b.sections.filter(function (s) { return s.count; }) : [];
  }
  function hSectionOf(id, i) {
    var list = hSections(id);
    for (var k = 0; k < list.length; k++) {
      if (i >= list[k].first && i <= list[k].last) return list[k];
    }
    return list[0] || null;
  }
  function hData(id, sec) {
    return (window.HADITH_DATA && window.HADITH_DATA[id] && window.HADITH_DATA[id][sec]) || null;
  }
  function hFind(id, i) {
    var sec = hSectionOf(id, i);
    if (!sec) return null;
    var arr = hData(id, sec.id);
    if (!arr) return null;
    for (var k = 0; k < arr.length; k++) if (arr[k][0] === i) return arr[k];
    return null;
  }
  function loadHadith(id, sec, cb) {
    var cached = hData(id, sec);
    if (cached) { cb(cached); return; }
    var key = id + ':' + sec;
    if (hadithFailed[key]) { cb([]); return; }
    if (hadithPending[key]) { hadithPending[key].push(cb); return; }
    hadithPending[key] = [cb];
    var tag = document.createElement('script');
    tag.src = 'assets/hadith/' + id + '/' + sec + '.js?v=14';
    tag.onload = function () {
      var arr = hData(id, sec) || [];
      var waiting = hadithPending[key] || []; delete hadithPending[key];
      waiting.forEach(function (fn) { fn(arr); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    };
    tag.onerror = function () {
      hadithFailed[key] = true;
      var waiting = hadithPending[key] || []; delete hadithPending[key];
      toast('হাদিস লোড করা যায়নি');
      waiting.forEach(function (fn) { fn([]); });
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    };
    document.head.appendChild(tag);
  }
  function loadHadithMany(pairs, cb) {
    var seen = {}, list = [];
    pairs.forEach(function (p) {
      var k = p[0] + ':' + p[1];
      if (!seen[k]) { seen[k] = true; list.push(p); }
    });
    var left = list.length;
    if (!left) { cb(); return; }
    list.forEach(function (p) { loadHadith(p[0], p[1], function () { if (--left === 0) cb(); }); });
  }
  /* Scope = 'all' or a book id. Loading is batched so a phone never has to
     fetch 366 files at once; a chosen book only loads its own shards. */
  function loadAllHadith(scope, progress, done) {
    var key = scope && scope !== 'all' ? scope : 'all';
    if (hadithFlat[key]) { done(); return; }
    if (hadithAllPending[key]) { hadithAllPending[key].push(done); return; }
    hadithAllPending[key] = [done];
    var ids = key === 'all' ? HBOOKS.slice() : [key];
    var queue = [], total = 0, seen = 0;
    ids.forEach(function (id) {
      hSections(id).forEach(function (s) {
        total++;
        if (hData(id, s.id)) seen++; else queue.push([id, s.id]);
      });
    });
    function finish() {
      buildHadithFlat(key, ids);
      var waiting = hadithAllPending[key] || []; delete hadithAllPending[key];
      waiting.forEach(function (fn) { fn(); });
    }
    function step() {
      if (!queue.length) { finish(); return; }
      var batch = queue.splice(0, 8), left = batch.length;
      batch.forEach(function (pair) {
        loadHadith(pair[0], pair[1], function () {
          seen++;
          if (progress) progress(seen, total);
          if (--left === 0) setTimeout(step, 0);
        });
      });
    }
    step();
  }
  function buildHadithFlat(scope, ids) {
    var out = [];
    ids.forEach(function (id) {
      hSections(id).forEach(function (s) {
        (hData(id, s.id) || []).forEach(function (r) {
          var t = r[3] + ' ' + r[5] + ' ' + r[4];
          out.push({ b: id, i: r[0], n: r[1], an: hNum(r[2]), k: norm(t).slice(0, 2000), gc: gradeCategory(id, r[7]) });
        });
      });
    });
    hadithFlat[scope] = out;
  }
  function hNum(x) { return (x === '' || x === null || x === undefined) ? '' : String(x); }
  function gradeCategory(id, g) {
    var raw = String(g || ''), l = gradeLabel(id, g);
    if (/mawdu|maudu|মাওদু|জাল|fabricat/i.test(raw) || /জাল|মাওদু/.test(l)) return 'mawdu';
    if (/যঈফ|দুর্বল/.test(l)) return 'daif';
    if (/হাসান/.test(l)) return 'hasan';
    if (/সহিহ|সহীহ|বিশুদ্ধ/.test(l)) return 'sahih';
    return 'other';
  }
  function gradeLabel(id, g) {
    var s = String(g || '');
    if (/mawdu|maudu|মাওদু|জাল|fabricat/i.test(s)) return 'জাল হাদিস';
    if (/sahih/i.test(s) && /hasan/i.test(s)) return 'হাসান সহিহ হাদিস';
    if (/sahih|বিশুদ্ধ|সহীহ/i.test(s)) return 'সহিহ হাদিস';
    if (/hasan/i.test(s)) return 'হাসান হাদিস';
    if (/da'?if|দুর্বল|যঈফ/i.test(s)) return 'যঈফ হাদিস';
    if (/তাহকীক/.test(s)) return 'তাহকীক চলমান';
    if (!s) return (id === 'bukhari' || id === 'muslim') ? 'সহিহ হাদিস' : 'মান উল্লেখ নেই';
    return s;
  }
  function gradeClass(label) {
    if (/যঈফ|জাল/.test(label)) return 'warn';
    if (/তাহকীক|মান উল্লেখ/.test(label)) return 'muted';
    return 'ok';
  }
  function hadithCredit() {
    return '<p class="meta-credit hadith-credit">বাংলা অনুবাদের মূল উৎস ' +
      '<a href="https://www.hadithbd.com/hadith/" target="_blank" rel="noopener noreferrer">hadithbd.com</a> · ' +
      'আট গ্রন্থ <a href="https://github.com/fawazahmed0/hadith-api" target="_blank" rel="noopener noreferrer">fawazahmed0/hadith-api@1</a> (Unlicense) · ' +
      'মিশকাত <a href="https://muslimbangla.com/" target="_blank" rel="noopener noreferrer">muslimbangla.com</a> · ' +
      'আরবি অপরিবর্তিত · <a href="CREDITS.md">ক্রেডিট</a></p>';
  }
  function hadithSearchForm(q, scope, grade) {
    var opts = '<option value="all"' + (scope === 'all' ? ' selected' : '') + '>সব গ্রন্থ</option>' +
      HBOOKS.map(function (id) {
        return '<option value="' + id + '"' + (scope === id ? ' selected' : '') + '>' + esc(hBook(id).short) + '</option>';
      }).join('');
    var g = grade || 'all';
    var gopts = [['all', 'সব মান'], ['sahih', 'সহিহ'], ['hasan', 'হাসান'], ['daif', 'যঈফ'], ['mawdu', 'জাল']]
      .map(function (x) { return '<option value="' + x[0] + '"' + (g === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('');
    return '<div class="card-panel search-panel">' +
      '<form class="search-form hadith-search-form" data-action="hadith-search-submit">' +
        '<input class="input" id="hadithSearchInput" type="search" name="q" value="' + esc(q || '') +
        '" placeholder="বাংলা / আরবি / English — যেমন: নিয়্যাত, রাসূল, intention" aria-label="হাদিসে অনুসন্ধান"/>' +
        '<select class="select" name="book" aria-label="গ্রন্থ বাছুন">' + opts + '</select>' +
        '<select class="select" name="grade" aria-label="মান বাছুন">' + gopts + '</select>' +
        '<button class="btn btn-primary" type="submit">খুঁজুন</button>' +
      '</form><p class="search-hint">' + bn(HTOTAL) + ' টি হাদিসে খোঁজা যায়। ' +
      'আরবি মূল সবার আছে; ফাঁকা ঘর বানিয়ে ভরাট করা হয়নি।</p></div>';
  }
  function hadithCard(id, r) {
    var b = hBook(id), an = hNum(r[2]), sec = hSectionOf(id, r[0]);
    var gl = gradeLabel(id, r[7]), gcls = gradeClass(gl);
    var saved = isHadithSaved(id, r[0]);
    return '<article class="hadith-card card-panel">' +
      '<div class="hadith-head">' +
        '<div class="hadith-badges">' +
          '<span class="hadith-num">' + esc(b.short) + ' ' + bn(r[1]) + '</span>' +
          '<span class="hadith-grade ' + gcls + '">' + esc(gl) + '</span>' +
          (r[6] ? '<span class="hadith-narrator">' + esc(r[6]) + '</span>' : '') +
        '</div>' +
        '<div class="hadith-icons">' +
          '<button type="button" class="act-btn' + (saved ? ' saved' : '') + '" data-action="hadith-bookmark" data-book="' + id + '" data-i="' + r[0] + '" aria-label="সংরক্ষণ" title="সংরক্ষণ">' + ICON.star + '</button>' +
          '<button type="button" class="act-btn" data-action="hadith-copy" data-book="' + id + '" data-i="' + r[0] + '" aria-label="হাদিস কপি" title="কপি">' + ICON.copy + '</button>' +
        '</div>' +
      '</div>' +
      (r[4] ? '<p class="hadith-ar" lang="ar" dir="rtl">' + esc(r[4]) + '</p>' :
        '<p class="hadith-ar missing">এই হাদিসের আরবি মূল উৎসে নেই।</p>') +
      (r[3] ? '<p class="hadith-bn">' + esc(r[3]) + '</p>' :
        '<p class="hadith-bn missing">এই হাদিসের বাংলা অনুবাদ উৎসে নেই।</p>') +
      '<div class="hadith-foot">' +
        '<div class="hadith-ref">' +
          (an ? 'আন্তর্জাতিক নম্বর ' + esc(an) + ' · ' : '') +
          (sec ? 'অধ্যায় ' + bn(sec.id) + ' · ' + esc(sec.name) : '') +
        '</div>' +
        (r[5] ? '<details class="hadith-en"><summary>English translation</summary><p lang="en">' + esc(r[5]) + '</p></details>' : '') +
        '<div class="hadith-actions">' +
          '<button type="button" class="btn btn-sm" data-action="hadith-open" data-book="' + id + '" data-i="' + r[0] + '">একক পাতা ' + ICON.arrow + '</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-action="hadith-share" data-book="' + id + '" data-i="' + r[0] + '">লিংক কপি</button>' +
          '<a class="btn btn-sm btn-ghost" href="' + esc(b.site) + '" target="_blank" rel="noopener noreferrer">উৎস ↗</a>' +
        '</div>' +
      '</div>' +
    '</article>';
  }
  function hadithSourceNote(id) {
    var b = hBook(id), src = b && b.source;
    if (src === 'mishkat')
      return 'মিশকাত: muslimbangla.com-ভিত্তিক ডেটাসেট · বাংলা + আরবি';
    return 'বাংলা অনুবাদের মূল উৎস hadithbd.com · fawazahmed0/hadith-api@1 (Unlicense)';
  }
  function hadithCopyText(id, r) {
    var b = hBook(id), an = hNum(r[2]);
    return b.short + ' ' + r[1] + (an ? ' (আন্তর্জাতিক ' + an + ')' : '') + '\n\n' +
      (r[4] || '') + '\n\n' + (r[3] || '') + (r[5] ? '\n\n' + r[5] : '') +
      '\n\n— ' + hadithSourceNote(id) + ' · লেখা অপরিবর্তিত';
  }
  function hadithKey(id, i) { return id + ':' + i; }
  function isHadithSaved(id, i) { return state.hadithBookmarks.indexOf(hadithKey(id, i)) !== -1; }
  function toggleHadithBookmark(id, i) {
    var k = hadithKey(id, i), at = state.hadithBookmarks.indexOf(k);
    if (at === -1) { state.hadithBookmarks.push(k); toast('হাদিসটি সংরক্ষিত হয়েছে ★'); }
    else { state.hadithBookmarks.splice(at, 1); toast('হাদিসটি সরানো হয়েছে'); }
    save('hadithBookmarks', state.hadithBookmarks);
    document.querySelectorAll('[data-action="hadith-bookmark"][data-book="' + id + '"][data-i="' + i + '"]')
      .forEach(function (b) { b.classList.toggle('saved', isHadithSaved(id, i)); });
    if (state.view === 'hadith' && location.hash.indexOf('#/hadith/saved') === 0) renderHadithSaved();
  }

  function renderHadithRoute(r) {
    var seg = r.seg, sub = seg[1];
    if (sub === 'search') {
      renderHadithSearch(r.params.get('q') || '', r.params.get('book') || 'all', r.params.get('grade') || 'all');
      return;
    }
    if (sub === 'grade') { renderHadithGrade(seg[2] === 'mawdu' ? 'mawdu' : 'daif'); return; }
    if (sub === 'saved') { renderHadithSaved(); return; }
    if (!sub || !hBook(sub)) { renderHadithHome(); return; }
    if (seg.length === 2) { renderHadithBook(sub); return; }
    if (seg[2] === 'section') {
      var maxSec = 0;
      hSections(sub).forEach(function (s) { if (s.id > maxSec) maxSec = s.id; });
      renderHadithSection(sub, clamp(parseInt(seg[3], 10) || 0, 0, maxSec));
      return;
    }
    renderHadithOne(sub, clamp(parseInt(seg[2], 10) || 1, 1, hBook(sub).total));
  }
  function renderHadithHome() {
    state.view = 'hadith'; setTitle('হাদিস'); setNav('hadith');
    var cards = HBOOKS.map(function (id) {
      var b = H.books[id];
      return '<a class="card-panel hadith-book" href="#/hadith/' + id + '">' +
        '<span class="hadith-book-ar" lang="ar" dir="rtl">' + esc(b.ar) + '</span>' +
        '<h3>' + esc(b.bn) + '</h3>' +
        '<p class="hadith-book-en">' + esc(b.en) + ' · ' + esc(b.edition) + '</p>' +
        '<p class="hadith-book-count"><b>' + bn(b.total) + '</b> টি হাদিস · <b>' + bn(b.shards) + '</b> টি অধ্যায়</p>' +
        '<span class="card-arrow">পড়ুন →</span></a>';
    }).join('');
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow">' + bn(HBOOKS.length) + ' টি গ্রন্থ</div><h1>হাদিস</h1>' +
      '<p>বুখারী, মুসলিম, চার সুনান, মিশকাত, মুয়াত্তা ও নববী ৪০ — ' +
      bn(HTOTAL) + 'টি হাদিস: আরবি মূল প্রথমে, তার নিচে বাংলা। ' +
      'যে ঘরে উৎসে লেখা নেই সেখানে স্পষ্ট নোট; হাদিস-পাঠ বানানো হয়নি।</p></section>' +
      hadithSearchForm('', 'all', 'all') +
      '<div class="grade-row">' +
        '<a class="card-panel grade-card" href="#/hadith/grade/daif"><span class="grade-ic warn">⚠</span>' +
        '<div><b>আলবানীর তাহকীক · যঈফ</b><p>' + bn((window.HADITH_GRADE_INDEX || {}).daifCount || 0) +
        ' টি হাদিস · বিদ্যমান গ্রন্থের গ্রেড থেকে ফিল্টার</p></div><span class="card-arrow">→</span></a>' +
        '<a class="card-panel grade-card" href="#/hadith/grade/mawdu"><span class="grade-ic warn">⚠</span>' +
        '<div><b>আলবানীর তাহকীক · জাল</b><p>' + bn((window.HADITH_GRADE_INDEX || {}).mawduCount || 0) +
        ' টি হাদিস · পৃথক «সিলসিলা» গ্রন্থের পূর্ণ পাঠ নয়</p></div><span class="card-arrow">→</span></a>' +
      '</div>' +
      '<div class="hadith-grid">' + cards + '</div>' +
      '<div class="feature-actions"><button type="button" class="btn" data-action="hadith-random">' + ICON.shuffle + ' এলোমেলো হাদিস</button>' +
      '<a class="btn btn-ghost" href="#/hadith/saved">★ সংরক্ষিত হাদিস (' + bn(state.hadithBookmarks.length) + ')</a>' +
      '<a class="btn btn-ghost" href="#/hadith/search">সব হাদিসে খোঁজুন ' + ICON.arrow + '</a></div>' +
      hadithCredit();
    updateBookmarkCount(); window.scrollTo(0, 0);
  }
  function renderHadithBook(id) {
    state.view = 'hadith'; var b = hBook(id), list = hSections(id);
    setTitle(b.bn); setNav('hadith');
    var rows = list.map(function (s) {
      return '<a class="result-item hadith-section" href="#/hadith/' + id + '/section/' + s.id + '">' +
        '<div class="result-ref"><span class="dot"></span> অধ্যায় ' + bn(s.id) +
        ' <span style="color:var(--muted);font-weight:400">' + esc(s.name) + '</span></div>' +
        '<div class="result-snippet">' + bn(s.count) + ' টি হাদিস · হাদিস ' + bn(s.hadithFirst) + '–' + bn(s.hadithLast) + '</div></a>';
    }).join('');
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow"><a href="#/hadith" class="back-link">← হাদিস</a></div>' +
      '<h1>' + esc(b.bn) + '</h1><p>' + esc(b.en) + ' · ' + esc(b.edition) + ' · ' + bn(b.total) + ' টি হাদিস' +
      (b.langs && b.langs.bn ? '' : ' · <b>আরবি মূল; বাংলা/ইংরেজি অনুবাদ উৎসে নেই</b>') +
      (b.langs && b.langs.bn ? ' · যেখানে আছে আন্তর্জাতিক নম্বর' : '') + '</p></section>' +
      '<div class="card-panel search-panel">' +
        '<form class="search-form" data-action="hadith-goto" data-book="' + id + '">' +
          '<input class="input" type="number" name="n" min="1" max="' + b.total + '" placeholder="ক্রমিক নম্বর (১–' + bn(b.total) + ')" aria-label="হাদিস নম্বর"/>' +
          '<button class="btn btn-primary" type="submit">যান</button>' +
        '</form></div>' +
      hadithSearchForm('', id) +
      '<div class="section-head"><div><div class="eyebrow">' + bn(list.length) + ' টি অধ্যায়</div><h2>অধ্যায় সমূহ</h2></div>' +
      '<a class="btn btn-ghost btn-sm" href="#/hadith/saved">★ সংরক্ষিত</a></div>' +
      '<div class="result-list">' + rows + '</div>' + hadithCredit();
    updateBookmarkCount(); window.scrollTo(0, 0);
  }
  function renderHadithSection(id, secId) {
    state.view = 'hadith'; var b = hBook(id), sec = null;
    hSections(id).forEach(function (s) { if (s.id === secId) sec = s; });
    if (!sec) { renderHadithBook(id); return; }
    state.hadithBook = id; state.hadithSec = secId;
    state.hadithLimit = 20; state.hadithSeq++;
    setTitle(b.bn + ' · অধ্যায় ' + bn(secId)); setNav('hadith');
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow"><a class="back-link" href="#/hadith/' + id + '">← ' + esc(b.bn) + '</a></div>' +
      '<h1>অধ্যায় ' + bn(secId) + '</h1><p>' + esc(sec.name) + ' · ' + bn(sec.count) + ' টি হাদিস</p></section>' +
      '<div id="hadithList"><div class="search-progress">হাদিস লোড হচ্ছে…</div></div>' + hadithCredit();
    updateBookmarkCount(); window.scrollTo(0, 0);
    var seq = state.hadithSeq;
    loadHadith(id, secId, function () {
      if (state.view !== 'hadith' || seq !== state.hadithSeq) return;
      drawHadithSection(id, secId);
    });
  }
  function drawHadithSection(id, secId) {
    var box = document.getElementById('hadithList');
    if (!box) return;
    var arr = hData(id, secId) || [];
    var html = '<div class="hadith-list">' + arr.slice(0, state.hadithLimit).map(function (r) {
      return hadithCard(id, r);
    }).join('') + '</div>';
    if (arr.length > state.hadithLimit) {
      html += '<button type="button" class="btn more-btn" data-action="hadith-more">আরও দেখুন ' + ICON.arrow + '</button>';
    }
    if (!arr.length) html = '<div class="empty-state"><h3>লোড করা যায়নি</h3><p>অফলাইন ক্যাশে এই অধ্যায়টি নেই।</p></div>';
    box.innerHTML = html;
  }
  function renderHadithOne(id, i) {
    state.view = 'hadith'; var b = hBook(id), sec = hSectionOf(id, i);
    state.hadithBook = id; state.hadithSeq++;
    setTitle(b.bn + ' · হাদিস ' + bn(i)); setNav('hadith');
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow"><a class="back-link" href="#/hadith/' + id + '">← ' + esc(b.bn) + '</a></div>' +
      '<h1>হাদিস ' + bn(i) + '</h1><p>' + esc(b.en) + ' · আরবি মূল, তার নিচে বাংলা অনুবাদ</p></section>' +
      '<div class="hadith-one-nav">' +
        '<button type="button" class="btn btn-sm" data-action="hadith-prev" data-book="' + id + '" data-i="' + i + '"' + (i <= 1 ? ' disabled' : '') + '>← আগের</button>' +
        '<a class="btn btn-sm btn-ghost" href="#/hadith/' + id + '/section/' + (sec ? sec.id : 0) + '">অধ্যায়ে ফিরুন</a>' +
        '<button type="button" class="btn btn-sm" data-action="hadith-next" data-book="' + id + '" data-i="' + i + '"' + (i >= b.total ? ' disabled' : '') + '>পরের →</button>' +
      '</div>' +
      '<div id="hadithOne"><div class="search-progress">হাদিস লোড হচ্ছে…</div></div>' + hadithCredit();
    updateBookmarkCount(); window.scrollTo(0, 0);
    var seq = state.hadithSeq;
    loadHadith(id, sec ? sec.id : 0, function () {
      if (state.view !== 'hadith' || seq !== state.hadithSeq) return;
      var box = document.getElementById('hadithOne');
      var r = hFind(id, i);
      if (box) box.innerHTML = '<div class="hadith-list">' + (r ? hadithCard(id, r) :
        '<div class="empty-state"><h3>হাদিসটি পাওয়া যায়নি</h3></div>') + '</div>';
    });
  }
  function renderHadithGrade(key) {
    var gi = window.HADITH_GRADE_INDEX || { daif: [], mawdu: [] };
    var list = (key === 'mawdu' ? gi.mawdu : gi.daif) || [];
    state.view = 'hadith'; state.hadithGradeKey = key; state.hadithGradeLimit = 20;
    state.hadithSeq++;
    setTitle(key === 'mawdu' ? 'জাল হাদিস' : 'যঈফ হাদিস'); setNav('hadith');
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow"><a class="back-link" href="#/hadith">← হাদিস</a></div>' +
      '<h1>' + (key === 'mawdu' ? 'জাল (মাওদু) হাদিস' : 'যঈফ হাদিস') + '</h1>' +
      '<p>আলবানীসহ ডেটাসেটের গ্রেডারদের তাহকীক থেকে বিদ্যমান ' + bn(HBOOKS.length) +
      ' গ্রন্থের ' + bn(list.length) + ' টি হাদিস ফিল্টার করা হয়েছে। ' +
      'এটি শায়খ আলবানীর পৃথক «সিলসিলাতুদ-দ্বয়ীফা / জাল হাদীছ সিরিজ» গ্রন্থের পূর্ণ পাঠ নয়; ' +
      'সেই বইয়ের নিরাপদ/লাইসেন্স-সম্মত ডিজিটাল পাঠ পাওয়া যায়নি। আমলের আগে আলিমের পরামর্শ নিন।</p></section>' +
      '<div id="hadithGradeResults"></div>' + hadithCredit();
    updateBookmarkCount(); window.scrollTo(0, 0);
    drawHadithGrade();
  }
  function drawHadithGrade() {
    var box = document.getElementById('hadithGradeResults');
    var gi = window.HADITH_GRADE_INDEX || { daif: [], mawdu: [] };
    var list = (state.hadithGradeKey === 'mawdu' ? gi.mawdu : gi.daif) || [];
    if (!box) return;
    var seq = state.hadithSeq, slice = list.slice(0, state.hadithGradeLimit);
    box.innerHTML = '<div class="search-progress">হাদিস লোড হচ্ছে…</div>';
    var pairs = slice.map(function (x) { return [x[0], x[2]]; });
    loadHadithMany(pairs, function () {
      if (state.view !== 'hadith' || seq !== state.hadithSeq || !document.getElementById('hadithGradeResults')) return;
      var cards = slice.map(function (x) {
        var r = hFind(x[0], x[1]);
        return r ? hadithCard(x[0], r) : '';
      }).filter(Boolean).join('');
      box.innerHTML = '<p class="result-meta">' + bn(list.length) + ' টির মধ্যে ' + bn(slice.length) + ' টি দেখানো হচ্ছে</p>' +
        '<div class="hadith-list">' + (cards || '<div class="empty-state"><h3>কিছু পাওয়া যায়নি</h3></div>') + '</div>' +
        (list.length > slice.length ? '<button type="button" class="btn more-btn" data-action="hadith-grade-more">আরও দেখুন ' + ICON.arrow + '</button>' : '');
    });
  }
  function renderHadithSaved() {
    state.view = 'hadith'; setTitle('সংরক্ষিত হাদিস'); setNav('hadith');
    state.hadithSeq++;
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow"><a class="back-link" href="#/hadith">← হাদিস</a></div>' +
      '<h1>সংরক্ষিত হাদিস</h1><p>এই ব্রাউজারে সংরক্ষিত ' + bn(state.hadithBookmarks.length) + ' টি হাদিস।</p></section>' +
      '<div id="hadithSaved"><div class="search-progress">হাদিস লোড হচ্ছে…</div></div>' + hadithCredit();
    updateBookmarkCount(); window.scrollTo(0, 0);
    var keys = state.hadithBookmarks.slice(), box = document.getElementById('hadithSaved');
    if (!keys.length) {
      box.innerHTML = '<div class="empty-state"><span class="empty-icon">★</span><h3>এখনো কিছু সংরক্ষিত হয়নি</h3>' +
        '<p>যেকোনো হাদিসের ডানে ★ বাটনে চাপলে এখানে জমা হবে।</p>' +
        '<a class="btn" href="#/hadith">হাদিস পড়ুন ' + ICON.arrow + '</a></div>';
      return;
    }
    var seq = state.hadithSeq, pairs = [], refs = [];
    keys.forEach(function (k) {
      var p = k.split(':'), id = p[0], i = parseInt(p[1], 10);
      if (!hBook(id) || !i) return;
      var sec = hSectionOf(id, i);
      if (sec) { pairs.push([id, sec.id]); refs.push([id, i]); }
    });
    loadHadithMany(pairs, function () {
      if (state.view !== 'hadith' || seq !== state.hadithSeq || !box) return;
      var cards = refs.map(function (p) {
        var r = hFind(p[0], p[1]);
        return r ? hadithCard(p[0], r) : '';
      }).filter(Boolean).join('');
      box.innerHTML = '<div class="hadith-list">' + (cards ||
        '<div class="empty-state"><h3>কিছু পাওয়া যায়নি</h3></div>') + '</div>';
    });
  }
  function renderHadithSearch(q, scope, grade) {
    state.view = 'hadith'; setTitle('হাদিসে অনুসন্ধান'); setNav('hadith');
    state.hadithQuery = q || '';
    state.hadithScope = (scope && (scope === 'all' || hBook(scope))) ? scope : 'all';
    state.hadithGradeFilter = ['all','sahih','hasan','daif','mawdu'].indexOf(grade) !== -1 ? grade : 'all';
    state.hadithSearchLimit = 40; state.hadithSeq++;
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow"><a class="back-link" href="#/hadith">← হাদিস</a></div>' +
      '<h1>হাদিসে অনুসন্ধান</h1><p>' + bn(HBOOKS.length) + ' গ্রন্থের আরবি, যেখানে আছে বাংলা/ইংরেজি লেখায় খোঁজুন; গ্রন্থ ও মান বাছলে দ্রুত ফল পাবেন।</p></section>' +
      hadithSearchForm(state.hadithQuery, state.hadithScope, state.hadithGradeFilter) +
      '<div id="hadithResults"></div>' + hadithCredit();
    updateBookmarkCount(); window.scrollTo(0, 0);
    runHadithSearch(state.hadithQuery, state.hadithScope);
  }
  function runHadithSearch(q, scope) {
    var seq = state.hadithSeq, box = document.getElementById('hadithResults');
    if (!box) return;
    if (!q.trim()) {
      box.innerHTML = '<div class="empty-state"><span class="empty-icon">⌕</span><h3>কিছু লিখে খুঁজুন</h3>' +
        '<p>যেমন: নিয়্যাত, রাসূল, জান্নাত, intention, বা হাদিস নম্বর।</p></div>';
      return;
    }
    box.innerHTML = '<div class="search-progress" id="hadithProgress">হাদিসের ইনডেক্স তৈরি হচ্ছে…</div>';
    loadAllHadith(scope, function (seen, total) {
      var el = document.getElementById('hadithProgress');
      if (el) el.textContent = 'ইনডেক্স তৈরি হচ্ছে… ' + bn(seen) + ' / ' + bn(total) + ' অধ্যায়';
    }, function () {
      if (state.view !== 'hadith' || seq !== state.hadithSeq) return;
      drawHadithSearch(q, scope);
    });
  }
  function drawHadithSearch(q, scope) {
    var box = document.getElementById('hadithResults');
    var flat = hadithFlat[scope] || [];
    if (!box) return;
    var nq = norm(q), rawq = asciiDigits(q).trim();
    var numQ = /^[\d.]+$/.test(rawq) ? rawq : '';
    var gf = state.hadithGradeFilter;
    var matches = flat.filter(function (x) {
      if (gf !== 'all' && x.gc !== gf) return false;
      return x.k.indexOf(nq) !== -1 ||
        (numQ && (String(x.n) === numQ || x.an === numQ));
    });
    var html = '<p class="result-meta">' + bn(matches.length) + ' টি ফল · «' + esc(q) + '»' +
      ' · ' + (scope === 'all' ? 'সব গ্রন্থ' : esc(hBook(scope).short)) + '</p>';
    if (matches.length) {
      html += '<div class="result-list">' + matches.slice(0, state.hadithSearchLimit).map(function (x) {
        var b = hBook(x.b), snip = snippetAround(x.k, q);
        return '<button type="button" class="result-item" data-action="hadith-open" data-book="' + x.b + '" data-i="' + x.i + '">' +
          '<div class="result-ref"><span class="dot"></span> ' + esc(b.short) + ' ' + bn(x.n) +
          (x.an ? ' <span style="color:var(--muted);font-weight:400">(আন্তর্জাতিক ' + esc(x.an) + ')</span>' : '') + '</div>' +
          '<div class="result-snippet">' + esc(snip) + '</div></button>';
      }).join('') + '</div>';
      if (matches.length > state.hadithSearchLimit) {
        html += '<button type="button" class="btn more-btn" data-action="hadith-search-more">আরও দেখুন ' + ICON.arrow + '</button>';
      }
    } else {
      html += '<div class="empty-state"><span class="empty-icon">⌕</span><h3>কিছু পাওয়া যায়নি</h3><p>বানান বদলে বা অন্য গ্রন্থ বেছে আবার চেষ্টা করুন।</p></div>';
    }
    box.innerHTML = html;
  }

  /* ------------------------------ footnote links ------------------------------ */
  function openFootnote(s, a, n) {
    var key = refKey(s, a);
    function jump() {
      setTimeout(function () {
        var scope = state.mode === 'mushaf'
          ? document.getElementById('tafsirModalBody')
          : document.getElementById('v' + a);
        if (!scope) return;
        var t = scope.querySelector('.fn-anchor[data-fn="' + n + '"]');
        if (!t) return;
        document.querySelectorAll('.fn-anchor.flash').forEach(function (x) { x.classList.remove('flash'); });
        t.classList.add('flash');
        if (t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    }
    if (state.mode === 'mushaf') {
      openTafsirModal(s, a); loadCurrentTafsir(s, jump); return;
    }
    if (state.mode !== 'study' && !state.openTafsir[key]) {
      toggleTafsirPanel(s, a);   // opens it (state.openTafsir[key] -> true)
    }
    loadTafsir(s, jump);
  }

  /* ------------------------------ bookmarks ------------------------------ */
  function renderBookmarks() {
    state.view = 'bookmarks';
    setTitle('সংরক্ষিত আয়াত');
    setNav('bookmarks');
    var refs = state.bookmarks.map(parseRef).filter(Boolean).sort(function (a, b) {
      return a.s - b.s || a.a - b.a;
    });
    var html =
      '<section class="page-head"><div class="eyebrow">আপনার তালিকা</div><h1>সংরক্ষিত আয়াত</h1>' +
      '<p>এই ব্রাউজারে সংরক্ষিত ' + bn(refs.length) + ' টি আয়াত — সাথে ব্যক্তিগত নোট ও ট্যাগ।</p></section>' +
      '<div class="bookmark-tools">' +
        '<button type="button" class="btn" data-action="export-backup">⬇ ব্যাকআপ রপ্তানি</button>' +
        '<button type="button" class="btn btn-ghost" data-action="import-backup">⬆ ব্যাকআপ আমদানি</button>' +
        '<input type="file" id="importFile" accept="application/json,.json" hidden aria-label="ব্যাকআপ ফাইল"/>' +
        '<span class="backup-hint">বুকমার্ক, নোট, পরিকল্পনা ও পাঠ-সেটিংস এক ফাইলে — ক্যাশ মুছলেও ফিরে পাবেন।</span>' +
      '</div>';
    if (!refs.length) {
      html += '<div class="card-panel empty-state"><span class="empty-icon">☆</span><h3>এখনো কিছু সংরক্ষণ করেননি</h3>' +
        '<p>যেকোনো আয়াতের পাশের ★ বোতামে ক্লিক করে এখানে যোগ করুন।</p>' +
        '<button type="button" class="btn btn-primary" data-action="scroll-list">সূরা পড়তে যান ' + ICON.arrow + '</button></div>';
    } else {
      html += '<div class="result-list">' + refs.map(function (r) {
        var k = refKey(r.s, r.a), note = state.notes[k] || {};
        return '<div class="card-panel result-item bookmark-item" data-ref="' + k + '">' +
          '<div class="bookmark-head"><span class="ref">' + esc(label(r.s, r.a)) + ' <span style="color:var(--muted);font-weight:400">(' + r.s + ':' + r.a + ')</span></span>' +
            '<span class="tools">' +
              '<button type="button" class="act-btn" data-action="copy" data-s="' + r.s + '" data-a="' + r.a + '" title="কপি" aria-label="কপি">' + ICON.copy + '</button>' +
              '<button type="button" class="act-btn saved" data-action="bookmark" data-s="' + r.s + '" data-a="' + r.a + '" title="সরান" aria-label="সরান">' + ICON.star + '</button>' +
            '</span></div>' +
          '<div class="result-text" lang="ar" dir="rtl">' + esc(verse(r.s, r.a)) + '</div>' +
          '<div class="result-bn-snippet">' + esc(bnText(r.s, r.a)) + '</div>' +
          '<div class="bookmark-note">' +
            '<label>ট্যাগ <input class="input" type="text" data-role="tag" value="' + esc(note.tag || '') + '" placeholder="যেমন: নামাজ, হিফজ" aria-label="ট্যাগ"/></label>' +
            '<label>নোট <textarea class="input" data-role="note" rows="2" placeholder="এই আয়াত সম্পর্কে আপনার কথা…" aria-label="ব্যক্তিগত নোট">' + esc(note.text || '') + '</textarea></label>' +
            '<div class="bookmark-note-foot">' +
              (note.tag ? '<span class="note-tag">#' + esc(note.tag) + '</span>' : '') +
              '<button type="button" class="btn" data-action="save-note" data-s="' + r.s + '" data-a="' + r.a + '">নোট সংরক্ষণ</button>' +
              '<button type="button" class="btn btn-ghost" data-action="goto-ayah" data-s="' + r.s + '" data-a="' + r.a + '">সূরায় খুলুন ' + ICON.arrow + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
    app.innerHTML = html;
    updateBookmarkCount();
    window.scrollTo(0, 0);
    ensureBookmarksBn();
  }

  function ensureBookmarksBn() {
    var seen = {}, need = [];
    state.bookmarks.forEach(function (k) {
      var r = parseRef(k);
      if (r && !seen[r.s] && !bnReady(r.s) && !bnFailed[r.s]) { seen[r.s] = 1; need.push(r.s); }
    });
    if (!need.length) return;
    loadBnMany(need, function () { if (state.view === 'bookmarks') renderBookmarks(); });
  }

  function backupData() {
    return {
      app: 'DAWAH X — আল-কুরআন', format: 1, build: BUILD.v,
      exportedAt: new Date().toISOString(),
      bookmarks: state.bookmarks, hadithBookmarks: state.hadithBookmarks,
      notes: state.notes, plan: state.plan, tafsirSource: state.tafsirSource,
      settings: {
        theme: state.theme, qfs: state.qfs, bfs: state.bfs,
        mode: state.mode, showTranslation: state.showTranslation
      }
    };
  }
  function exportBackup() {
    try {
      var blob = new Blob([JSON.stringify(backupData(), null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'dawahx-backup-' + todayISO() + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('ব্যাকআপ ডাউনলোড হয়েছে');
    } catch (e) { toast('ব্যাকআপ তৈরি করা যায়নি'); }
  }
  function applyBackup(data) {
    if (!data || typeof data !== 'object') throw new Error('invalid');
    if (Array.isArray(data.bookmarks)) {
      data.bookmarks.forEach(function (k) {
        if (parseRef(k) && state.bookmarks.indexOf(k) === -1) state.bookmarks.push(k);
      });
    }
    if (Array.isArray(data.hadithBookmarks)) {
      data.hadithBookmarks.forEach(function (k) {
        if (typeof k === 'string' && hBook(k.split(':')[0]) &&
            state.hadithBookmarks.indexOf(k) === -1) state.hadithBookmarks.push(k);
      });
      save('hadithBookmarks', state.hadithBookmarks);
    }
    if (data.notes && typeof data.notes === 'object') {
      Object.keys(data.notes).forEach(function (k) {
        if (parseRef(k) && data.notes[k] && typeof data.notes[k] === 'object') {
          state.notes[k] = {
            text: String(data.notes[k].text || '').slice(0, 4000),
            tag: String(data.notes[k].tag || '').slice(0, 60)
          };
        }
      });
    }
    if (data.plan && Array.isArray(data.plan.done)) {
      state.plan = {
        done: data.plan.done.filter(function (j) { return j >= 1 && j <= 30; }),
        start: String(data.plan.start || todayISO()).slice(0, 10)
      };
    }
    if (data.settings) {
      if (data.settings.theme === 'light' || data.settings.theme === 'dark') state.theme = data.settings.theme;
      if (data.settings.qfs) state.qfs = clamp(Number(data.settings.qfs) || 32, 20, 56);
      if (data.settings.bfs) state.bfs = clamp(Number(data.settings.bfs) || 15, 12, 26);
      if (typeof data.settings.showTranslation === 'boolean') state.showTranslation = data.settings.showTranslation;
      if (['cards', 'mushaf', 'study', 'focus'].indexOf(data.settings.mode) !== -1) state.mode = data.settings.mode;
    }
    if (data.tafsirSource === 'ibn-kathir' || data.tafsirSource === 'zakaria') {
      state.tafsirSource = data.tafsirSource; save('tafsirSource', state.tafsirSource);
    }
    save('bookmarks', state.bookmarks); save('notes', state.notes);
    save('plan', state.plan); save('theme', state.theme);
    applyTheme(); applyQfs(); applyBfs();
  }

  /* ------------------------------ interactions ------------------------------ */
  function toggleBookmark(s, a) {
    var k = refKey(s, a), i = state.bookmarks.indexOf(k);
    if (i === -1) { state.bookmarks.push(k); toast('আয়াতটি সংরক্ষিত হয়েছে ★'); }
    else { state.bookmarks.splice(i, 1); toast('আয়াতটি সরানো হয়েছে'); }
    save('bookmarks', state.bookmarks);
    document.querySelectorAll('[data-action="bookmark"][data-s="' + s + '"][data-a="' + a + '"]').forEach(function (b) {
      b.classList.toggle('saved', isSaved(s, a));
    });
    updateBookmarkCount();
    if (state.view === 'bookmarks') renderBookmarks();
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'FORM' || el.tagName === 'LABEL') return;
    var act = el.dataset.action;
    var s = parseInt(el.dataset.s, 10), a = parseInt(el.dataset.a, 10);

    switch (act) {
      case 'home': e.preventDefault(); go('/'); break;
      case 'scroll-list': go('/surahs'); break;
      case 'open-surah': go('/s/' + s); break;
      case 'goto-ayah': go('/s/' + s + '/a/' + a); break;
      case 'continue': go('/s/' + s + '/a/' + a); break;
      case 'open-study':
        state.mode = 'study'; save('mode2', state.mode);
        go('/s/' + s + '/a/' + a);
        break;
      case 'prev-surah': if (state.current.s > 1) go('/s/' + (state.current.s - 1)); break;
      case 'next-surah': if (state.current.s < 114) go('/s/' + (state.current.s + 1)); break;
      case 'random-verse': {
        var v = FLAT[Math.floor(Math.random() * FLAT.length)];
        go('/s/' + v.s + '/a/' + v.a);
        break;
      }
      case 'toggle-theme':
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        save('theme', state.theme); applyTheme();
        break;
      case 'filter':
        state.filter = el.dataset.filter;
        if (state.view === 'surahs') renderSurahs(); else renderHome();
        break;
      case 'mode':
        state.mode = el.dataset.mode; save('mode2', state.mode);
        renderReader(state.current.s, state.current.a, true);
        break;
      case 'fs':
        state.qfs = clamp(state.qfs + parseInt(el.dataset.d, 10), 20, 56);
        save('qfs', state.qfs); applyQfs();
        break;
      case 'bfs':
        state.bfs = clamp(state.bfs + parseInt(el.dataset.d, 10), 12, 26);
        save('bfs', state.bfs); applyBfs();
        break;
      case 'focus-prev':
        go('/s/' + state.current.s + '/a/' + clamp(state.current.a - 1, 1, Q.counts[state.current.s - 1]));
        break;
      case 'focus-next':
        go('/s/' + state.current.s + '/a/' + clamp(state.current.a + 1, 1, Q.counts[state.current.s - 1]));
        break;
      case 'select-ayah': showAyahBar(s, a); break;
      case 'tafsir': toggleTafsirPanel(s, a); break;
      case 'fn': openFootnote(s, a, el.dataset.n); break;
      case 'tafsir-modal': openTafsirModal(s, a); break;
      case 'tafsir-source': {
        var src = el.dataset.source === 'ibn-kathir' ? 'ibn-kathir' : 'zakaria';
        state.tafsirSource = src; save('tafsirSource', src);
        var ss = parseInt(el.dataset.s, 10), aa = parseInt(el.dataset.a, 10);
        var body = document.getElementById('tafsirModalBody');
        if (body) body.querySelectorAll('.tafsir-source-tabs .btn').forEach(function (b) {
          b.classList.toggle('active', b.dataset.source === src);
        });
        fillTafsirModal(ss, aa);
        break;
      }
      case 'hadith-grade-more': state.hadithGradeLimit += 20; drawHadithGrade(); break;
      case 'open-juz':
      case 'plan-today': {
        var st = juzStart(clamp(parseInt(el.dataset.j, 10) || 1, 1, 30));
        go('/s/' + st.s + '/a/' + st.a);
        break;
      }
      case 'plan-toggle': {
        var j = clamp(parseInt(el.dataset.j, 10) || 1, 1, 30);
        var at = state.plan.done.indexOf(j);
        if (at === -1) { state.plan.done.push(j); toast('পারা ' + bn(j) + ' সম্পন্ন ✓'); }
        else { state.plan.done.splice(at, 1); toast('পারা ' + bn(j) + ' সরানো হয়েছে'); }
        save('plan', state.plan); renderPlan();
        break;
      }
      case 'plan-reset':
        state.plan = { done: [], start: todayISO() };
        save('plan', state.plan); renderPlan(); toast('পরিকল্পনা রিসেট হয়েছে');
        break;
      case 'save-note': {
        var k = refKey(s, a);
        var item = el.closest('.bookmark-item');
        var tagEl = item && item.querySelector('[data-role="tag"]');
        var noteEl = item && item.querySelector('[data-role="note"]');
        state.notes[k] = {
          tag: String(tagEl ? tagEl.value : '').trim().slice(0, 60),
          text: String(noteEl ? noteEl.value : '').slice(0, 4000)
        };
        save('notes', state.notes); toast('নোট সংরক্ষিত হয়েছে');
        renderBookmarks();
        break;
      }
      case 'export-backup': exportBackup(); break;
      case 'import-backup': {
        var fileInput = document.getElementById('importFile');
        if (fileInput) fileInput.click();
        break;
      }
      case 'install-app': {
        if (deferredInstall) {
          deferredInstall.prompt();
          deferredInstall.userChoice.then(function () { deferredInstall = null; });
          var ib = document.getElementById('installBtn'); if (ib) ib.hidden = true;
        } else toast('এই ব্রাউজারে ইনস্টল প্রম্পট পাওয়া যায়নি');
        break;
      }
      case 'offline-all': requestFullOffline(); break;
      case 'close-tafsir-modal': closeTafsirModal(); break;
      case 'close-ayah-bar': {
        var bar = document.getElementById('ayahBar');
        if (bar) bar.hidden = true;
        break;
      }
      case 'copy':
        copyText(verse(s, a) + '\n\n' + bnText(s, a) +
          '\n\n— অনুবাদ: ড. আবূ বকর মুহাম্মাদ যাকারিয়া, QuranEnc.com (bengali_zakaria v1.1.1)');
        toast('আয়াত ও বাংলা অনুবাদ কপি হয়েছে');
        break;
      case 'share':
        copyText(location.origin + location.pathname + '#/s/' + s + '/a/' + a);
        toast('আয়াতের লিংক কপি হয়েছে');
        break;
      case 'bookmark': toggleBookmark(s, a); break;
      case 'more-results':
        state.searchLimit += 40;
        drawSearch(state.query, state.searchSeq);
        break;
      case 'hadith-open': go('/hadith/' + el.dataset.book + '/' + el.dataset.i); break;
      case 'hadith-prev': go('/hadith/' + el.dataset.book + '/' + Math.max(1, (parseInt(el.dataset.i, 10) || 1) - 1)); break;
      case 'hadith-next': go('/hadith/' + el.dataset.book + '/' + Math.min(hBook(el.dataset.book).total, (parseInt(el.dataset.i, 10) || 1) + 1)); break;
      case 'hadith-random': {
        var hid = HBOOKS[Math.floor(Math.random() * HBOOKS.length)], hb = hBook(hid);
        go('/hadith/' + hid + '/' + (1 + Math.floor(Math.random() * hb.total)));
        break;
      }
      case 'hadith-bookmark': toggleHadithBookmark(el.dataset.book, parseInt(el.dataset.i, 10)); break;
      case 'hadith-copy': {
        var hc = hFind(el.dataset.book, parseInt(el.dataset.i, 10));
        if (hc) { copyText(hadithCopyText(el.dataset.book, hc)); toast('হাদিস কপি হয়েছে'); }
        break;
      }
      case 'hadith-share':
        copyText(location.origin + location.pathname + '#/hadith/' + el.dataset.book + '/' + el.dataset.i);
        toast('হাদিসের লিংক কপি হয়েছে');
        break;
      case 'hadith-more':
        state.hadithLimit += 20;
        drawHadithSection(state.hadithBook, state.hadithSec);
        break;
      case 'hadith-search-more':
        state.hadithSearchLimit += 40;
        drawHadithSearch(state.hadithQuery, state.hadithScope);
        break;
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-action]');
    if (!form) return;
    if (form.dataset.action === 'search-submit') {
      e.preventDefault();
      var input = form.querySelector('input[name="q"]');
      var q = input ? input.value.trim() : '';
      go(q ? '/search?q=' + encodeURIComponent(q) : '/');
    } else if (form.dataset.action === 'hadith-search-submit') {
      e.preventDefault();
      var hq = form.querySelector('input[name="q"]');
      var hb3 = form.querySelector('select[name="book"]');
      var hg = form.querySelector('select[name="grade"]');
      var hv = hq ? hq.value.trim() : '';
      var hs = hb3 ? hb3.value : 'all';
      var gv = hg ? hg.value : 'all';
      go('/hadith/search?q=' + encodeURIComponent(hv) + '&book=' + encodeURIComponent(hs) + '&grade=' + encodeURIComponent(gv));
    } else if (form.dataset.action === 'hadith-goto') {
      e.preventDefault();
      var hb2 = hBook(form.dataset.book);
      var hn = form.querySelector('input[name="n"]');
      var hi = clamp(parseInt(asciiDigits(hn && hn.value || ''), 10) || 1, 1, hb2.total);
      go('/hadith/' + form.dataset.book + '/' + hi);
    } else if (form.dataset.action === 'jump') {
      e.preventDefault();
      var s = clamp(parseInt(form.dataset.s, 10), 1, 114);
      var inputA = form.querySelector('#jumpAyah');
      var a = clamp(parseInt(inputA && inputA.value, 10) || 1, 1, Q.counts[s - 1]);
      go('/s/' + s + '/a/' + a);
    } else if (form.dataset.action === 'page-jump' && META) {
      e.preventDefault();
      var inputP = form.querySelector('#jumpPage');
      var pg = clamp(parseInt(inputP && inputP.value, 10) || 1, 1, 604);
      var st = fromGid(META.page[pg - 1]);
      go('/s/' + st.s + '/a/' + st.a);
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'searchInput') runSearch(e.target.value);
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'ignoreHarakat') { state.ignore = e.target.checked; runSearch(state.query); }
    else if (e.target.id === 'searchTafsir') {
      state.searchTafsir = e.target.checked;
      save('searchTafsir', state.searchTafsir);
      runSearch(state.query);
    }
    else if (e.target.id === 'importFile') { handleImport(e.target); }
    else if (e.target.id === 'juzSelect') {
      var st = juzStart(clamp(parseInt(e.target.value, 10) || 1, 1, 30));
      go('/s/' + st.s + '/a/' + st.a);
    }
    else if (e.target.id === 'showTranslation') {
      state.showTranslation = e.target.checked;
      save('showTranslation2', state.showTranslation);
      if (state.view === 'reader') renderReader(state.current.s, state.current.a, false);
    }
    else if (e.target.id === 'tafsirSourceSelect') {
      state.tafsirSource = e.target.value === 'ibn-kathir' ? 'ibn-kathir' : 'zakaria';
      save('tafsirSource', state.tafsirSource);
      if (state.view === 'reader') renderReader(state.current.s, state.current.a, false);
    }
    else if (e.target.id === 'sortSelect') {
      state.sort = e.target.value;
      if (state.view === 'surahs') renderSurahs(); else renderHome();
    } else if (e.target.id === 'surahSelect') {
      go('/s/' + clamp(parseInt(e.target.value, 10), 1, 114));
    }
  });
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') {
      var bar = document.getElementById('ayahBar');
      if (bar) bar.hidden = true;
      closeTafsirModal();
      if (typing) e.target.blur();
      return;
    }
    if (typing) return;
    if (e.key === '/') {
      e.preventDefault();
      var input = document.getElementById('searchInput') || document.getElementById('hadithSearchInput') ||
        document.querySelector('.home-search input');
      if (input) { input.focus(); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      else go('/');
    } else if (state.view === 'reader' && e.key === 'ArrowRight' && state.current.s > 1) {
      go('/s/' + (state.current.s - 1));
    } else if (state.view === 'reader' && e.key === 'ArrowLeft' && state.current.s < 114) {
      go('/s/' + (state.current.s + 1));
    } else if (state.view === 'reader' && (e.key === 'j' || (state.mode === 'focus' && e.key === 'ArrowDown'))) {
      e.preventDefault();
      go('/s/' + state.current.s + '/a/' + clamp(state.current.a + 1, 1, Q.counts[state.current.s - 1]));
    } else if (state.view === 'reader' && (e.key === 'k' || (state.mode === 'focus' && e.key === 'ArrowUp'))) {
      e.preventDefault();
      go('/s/' + state.current.s + '/a/' + clamp(state.current.a - 1, 1, Q.counts[state.current.s - 1]));
    }
  });
  window.addEventListener('hashchange', renderRoute);

  /* ------------------------------ backup import / PWA / touch ------------------------------ */
  function handleImport(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    function finish(txt) {
      try {
        applyBackup(JSON.parse(txt));
        toast('ব্যাকআপ আমদানি হয়েছে');
        renderRoute();
      } catch (err) { toast('ব্যাকআপ ফাইলটি পড়া যায়নি'); }
    }
    if (typeof FileReader !== 'undefined') {
      var rd = new FileReader();
      rd.onload = function () { finish(String(rd.result || '')); };
      rd.onerror = function () { toast('ফাইল পড়া যায়নি'); };
      rd.readAsText(file);
    } else if (file.text) {
      file.text().then(finish).catch(function () { toast('ফাইল পড়া যায়নি'); });
    } else toast('এই ব্রাউজারে ফাইল আমদানি সমর্থিত নয়');
    input.value = '';
  }

  var deferredInstall = null;
  function requestFullOffline() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker || typeof MessageChannel === 'undefined') {
      toast('এই ব্রাউজারে অফলাইন ডাউনলোড পাওয়া যায় না');
      return;
    }
    navigator.serviceWorker.ready.then(function (reg) {
      var target = navigator.serviceWorker.controller || (reg && reg.active);
      if (!target) { toast('সার্ভিস ওয়ার্কার এখনো সক্রিয় হয়নি — একটু পরে চেষ্টা করুন'); return; }
      var ch = new MessageChannel();
      ch.port1.onmessage = function (ev) {
        var d = ev.data || {};
        if (d.complete) toast(d.failed ? 'কিছু ফাইল সংরক্ষণ করা যায়নি' : 'সম্পূর্ণ কুরআন ও হাদিস অফলাইনে প্রস্তুত ✓');
        else toast('অফলাইন ডাউনলোড… ' + bn(d.done) + ' / ' + bn(d.total));
      };
      target.postMessage({ type: 'PRECACHE_ALL' }, [ch.port2]);
      toast('সব অনুবাদ, তাফসীর ও হাদিস অফলাইনে সংরক্ষণ হচ্ছে…');
    }).catch(function () { toast('অফলাইন ডাউনলোড শুরু করা যায়নি'); });
  }
  function setBuildTag() {
    var el = document.getElementById('buildTag');
    if (el) el.textContent = 'সংস্করণ v' + BUILD.v + ' · ' + BUILD.date;
    var off = document.getElementById('offlineStatus');
    if (off) off.textContent = navigator.onLine === false ? '● অফলাইন' : '● অনলাইন';
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        /* insecure origin or SW disabled — the static site still works */
      });
    });
  }
  function installPrompt() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferredInstall = e;
      var b = document.getElementById('installBtn'); if (b) b.hidden = false;
    });
  }
  function swipeNav() {
    var t0 = null;
    document.addEventListener('touchstart', function (e) {
      if (state.view !== 'reader' || !e.touches || e.touches.length !== 1) return;
      t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!t0 || state.view !== 'reader') return;
      var t = e.changedTouches && e.changedTouches[0];
      if (t) {
        var dx = t.clientX - t0.x, dy = t.clientY - t0.y;
        if (Math.abs(dx) > 90 && Math.abs(dy) < 70) {
          if (dx < 0 && state.current.s < 114) go('/s/' + (state.current.s + 1));
          else if (dx > 0 && state.current.s > 1) go('/s/' + (state.current.s - 1));
        }
      }
      t0 = null;
    }, { passive: true });
  }

  /* ------------------------------ clock ------------------------------ */
  function tick() {
    var el = document.getElementById('dhakaClock');
    if (!el) return;
    try {
      el.textContent = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date());
    } catch (err) { el.textContent = '—'; }
  }

  /* ------------------------------ boot ------------------------------ */
  applyTheme();
  applyQfs();
  applyBfs();
  setBuildTag();
  window.addEventListener('online', setBuildTag);
  window.addEventListener('offline', setBuildTag);
  installPrompt();
  registerSW();
  swipeNav();
  tick();
  setInterval(tick, 1000);
  renderRoute();
})();
