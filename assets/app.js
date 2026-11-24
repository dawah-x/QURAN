/* ==========================================================================
   DAWAH X — আল-কুরআন | static Quran reader, no dependencies
   Data: window.SURAHS (names), window.QURAN (Uthmani verses)
   ========================================================================== */
(function () {
  'use strict';

  var S = window.SURAHS;
  var Q = window.QURAN;
  var app = document.getElementById('app');
  var BISMILLAH = Q.verses[0][0];

  var FLAT = [];
  Q.verses.forEach(function (arr, i) {
    arr.forEach(function (t, j) { FLAT.push({ s: i + 1, a: j + 1, t: t }); });
  });

  var ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.2"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.2"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
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
    mode: load('mode', 'cards') === 'mushaf' ? 'mushaf' : 'cards',
    bookmarks: load('bookmarks', []),
    last: load('last', null),
    filter: 'all',
    sort: 'number',
    ignore: true,
    query: '',
    searchLimit: 40,
    current: { s: 1, a: 1 }
  };
  if (!Array.isArray(state.bookmarks)) state.bookmarks = [];

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
    if (meta) meta.setAttribute('content', state.theme === 'light' ? '#f7f3ea' : '#07151a');
  }
  function applyQfs() {
    document.documentElement.style.setProperty('--qfs', state.qfs + 'px');
    var out = document.getElementById('fsVal');
    if (out) out.textContent = bn(state.qfs);
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
    var r = parseRoute();
    var seg = r.seg;
    if (seg[0] === 's') {
      var s = clamp(parseInt(seg[1], 10) || 1, 1, 114);
      var a = seg[2] === 'a' ? clamp(parseInt(seg[3], 10) || 1, 1, Q.counts[s - 1]) : 1;
      renderReader(s, a, true);
    } else if (seg[0] === 'search') {
      renderSearch(r.params.get('q') || '');
    } else if (seg[0] === 'bookmarks') {
      renderBookmarks();
    } else if (seg[0] === 'surahs') {
      renderHome(true);
    } else {
      renderHome(false);
    }
  }

  /* ------------------------------ home ------------------------------ */
  function dayVerse() {
    var day = Math.floor(Date.now() / 86400000);
    return FLAT[(day * 7919 + 13) % FLAT.length];
  }
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
  function renderHome(scrollToList) {
    state.view = 'home';
    setTitle('আল-কুরআন');
    setNav(scrollToList ? 'surahs' : 'home');

    var last = state.last ? parseRef(state.last) : null;
    var daily = dayVerse();
    var filters = [
      ['all', 'সব সূরা'], ['short', 'ছোট (≤২০)'], ['medium', 'মাঝারি (২১–১০০)'], ['long', 'বড় (>১০০)']
    ].map(function (f) {
      return '<button type="button" class="chip' + (state.filter === f[0] ? ' active' : '') + '" data-action="filter" data-filter="' + f[0] + '">' + f[1] + '</button>';
    }).join('');

    var html =
      '<section class="hero">' +
        '<div class="eyebrow">বিসমিল্লাহির রহমানির রাহিম</div>' +
        '<div class="basmalah-frame"><p class="basmalah" lang="ar" dir="rtl">' + esc(BISMILLAH) + '</p></div>' +
        '<h1>আল-কুরআন</h1>' +
        '<p class="lede">হাফস (আসিম) কিরাআতের <strong>উসমানী লিপিতে</strong> পবিত্র কুরআন পাঠ করুন — মূল KFGQPC হাফস ফন্টে, অনুসন্ধান ও বুকমার্কসহ, সম্পূর্ণ অফলাইন।</p>' +
        '<div class="hero-actions">' +
          '<button type="button" class="btn btn-primary" data-action="scroll-list">সূরা তালিকা ' + ICON.arrow + '</button>' +
          '<button type="button" class="btn btn-ghost" data-action="random-verse">' + ICON.shuffle + ' এলোমেলো আয়াত</button>' +
        '</div>' +
        '<div class="stats">' +
          '<div class="stat"><b>' + bn(114) + '</b><span>সূরা</span></div>' +
          '<div class="stat"><b>' + bn(FLAT.length) + '</b><span>আয়াত</span></div>' +
          '<div class="stat"><b>' + bn(30) + '</b><span>পারা / জুজ</span></div>' +
          '<div class="stat"><b>হাফস</b><span>কিরাআত</span></div>' +
        '</div>' +
        '<form class="search-form quick-search" data-action="search-submit">' +
          '<input class="input" type="search" name="q" placeholder="আয়াত, সূরা বা রেফারেন্স খুঁজুন — যেমন: الرحمٰن, ২:২৫৫, ইয়াসিন" aria-label="অনুসন্ধান"/>' +
          '<button class="btn btn-primary" type="submit">খুঁজুন</button>' +
        '</form>' +
        '<p class="search-hint">ইঙ্গিত: <code>/</code> চাপলেও সার্চে যাওয়া যায় · আরবি হরকত বাদ দিয়েও খোঁজা যায়</p>' +
      '</section>' +

      '<div class="feature-row">' +
        (last ?
          '<div class="card-panel feature-card link" data-action="continue" data-s="' + last.s + '" data-a="' + last.a + '">' +
            '<div class="kicker">পড়া চালিয়ে যান</div>' +
            '<h3>' + esc(label(last.s, last.a)) + '</h3>' +
            '<p class="uthmani-line" lang="ar" dir="rtl">' + esc(verse(last.s, last.a)) + '</p>' +
            '<p>আপনি সর্বশেষ যেখানে ছিলেন সেখানে ফিরে যান</p>' +
          '</div>' :
          '<div class="card-panel feature-card">' +
            '<div class="kicker">শুরু করুন</div>' +
            '<h3>সূরা আল-ফাতিহা</h3>' +
            '<p class="uthmani-line" lang="ar" dir="rtl">' + esc(verse(1, 1)) + '</p>' +
            '<div class="feature-actions"><button type="button" class="btn" data-action="open-surah" data-s="1">উম্মুল কিতাব পড়ুন ' + ICON.arrow + '</button></div>' +
          '</div>') +
        '<div class="card-panel feature-card">' +
          '<div class="kicker">আজকের আয়াত</div>' +
          '<h3>' + esc(label(daily.s, daily.a)) + '</h3>' +
          '<p class="uthmani-line" lang="ar" dir="rtl">' + esc(daily.t) + '</p>' +
          '<div class="feature-actions"><button type="button" class="btn" data-action="goto-ayah" data-s="' + daily.s + '" data-a="' + daily.a + '">আয়াতটি পড়ুন ' + ICON.arrow + '</button></div>' +
        '</div>' +
        '<div class="card-panel feature-card">' +
          '<div class="kicker">পাঠের সুবিধা</div>' +
          '<h3>আপনার মতো করে পড়ুন</h3>' +
          '<p>আয়াত-ধরে বা একটানা <strong>মুসহাফ</strong> মোড, অক্ষরের আকার, আলো/অন্ধকার রঙ, প্রতিটি আয়াত কপি ও সংরক্ষণ — সবকিছু ব্রাউজারেই।</p>' +
          '<div class="feature-actions"><button type="button" class="btn" data-action="goto-ayah" data-s="2" data-a="255">আয়াতুল কুরসি ' + ICON.arrow + '</button></div>' +
        '</div>' +
      '</div>' +

      '<section class="surah-section" id="surahList">' +
        '<div class="section-head">' +
          '<div><div class="eyebrow">' + bn(filteredSurahs().length) + ' টি সূরা</div><h2>সূরা সমূহ</h2><p>যেকোনো সূরায় ক্লিক করে পড়া শুরু করুন</p></div>' +
          '<div class="surah-controls">' +
            '<div class="chip-row">' + filters + '</div>' +
            '<select class="select" id="sortSelect" aria-label="সাজানো">' +
              '<option value="number"' + (state.sort === 'number' ? ' selected' : '') + '>ক্রমানুসারে</option>' +
              '<option value="name"' + (state.sort === 'name' ? ' selected' : '') + '>নাম অনুযায়ী</option>' +
              '<option value="verses"' + (state.sort === 'verses' ? ' selected' : '') + '>বড় সূরা আগে</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="surah-grid">' + filteredSurahs().map(surahCard).join('') + '</div>' +
      '</section>';

    app.innerHTML = html;
    updateBookmarkCount();
    if (scrollToList) {
      var target = document.getElementById('surahList');
      if (target) setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
    } else {
      window.scrollTo(0, 0);
    }
  }

  /* ------------------------------ reader ------------------------------ */
  function verseHtml(s, a, target, mushaf) {
    var saved = isSaved(s, a);
    var t = esc(verse(s, a));
    var mark = '<span class="ayah-mark">' + ar(a) + '</span>';
    var actions =
      '<div class="verse-actions">' +
        '<button type="button" class="act-btn" data-action="copy" data-s="' + s + '" data-a="' + a + '" aria-label="আয়াত কপি" title="কপি">' + ICON.copy + '</button>' +
        '<button type="button" class="act-btn' + (saved ? ' saved' : '') + '" data-action="bookmark" data-s="' + s + '" data-a="' + a + '" aria-label="সংরক্ষণ" title="সংরক্ষণ">' + ICON.star + '</button>' +
        '<button type="button" class="act-btn" data-action="share" data-s="' + s + '" data-a="' + a + '" aria-label="লিংক কপি" title="লিংক কপি">' + ICON.link + '</button>' +
      '</div>';
    return '<article class="verse' + (a === target ? ' is-target' : '') + '" id="v' + a + '"' +
        (mushaf ? ' data-action="select-ayah" data-s="' + s + '" data-a="' + a + '"' : '') + '>' +
      '<div class="verse-badge"><span class="ayah-num">' + bn(a) + '</span></div>' +
      '<p class="uthmani" lang="ar" dir="rtl">' + t + ' ' + mark + '</p>' +
      actions +
    '</article>';
  }
  function renderReader(s, a, scroll) {
    state.view = 'reader';
    state.current = { s: s, a: a };
    var x = surah(s);
    var count = Q.counts[s - 1];
    var mushaf = state.mode === 'mushaf';
    setTitle(x.bn);
    setNav('surahs');

    var options = S.map(function (o) {
      return '<option value="' + o.n + '"' + (o.n === s ? ' selected' : '') + '>' + bn(o.n) + ' · ' + esc(o.bn) + '</option>';
    }).join('');

    var verses = [];
    for (var i = 1; i <= count; i++) verses.push(verseHtml(s, i, a, mushaf));

    var html =
      '<div class="reader">' +
        '<div class="reader-top">' +
          '<a class="back-link" href="#/" data-action="home">← সূরা তালিকায় ফিরুন</a>' +
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
        '</div>' +

        '<div class="reader-toolbar">' +
          '<div class="tool-group"><span class="tool-label">পাঠের ধরন</span>' +
            '<div class="seg">' +
              '<button type="button" data-action="mode" data-mode="cards" class="' + (!mushaf ? 'active' : '') + '">আয়াত ধরে</button>' +
              '<button type="button" data-action="mode" data-mode="mushaf" class="' + (mushaf ? 'active' : '') + '">মুসহাফ</button>' +
            '</div>' +
          '</div>' +
          '<div class="tool-group size-control"><span class="tool-label">অক্ষর</span>' +
            '<button type="button" data-action="fs" data-d="-2" aria-label="অক্ষর ছোট">−</button>' +
            '<output id="fsVal">' + bn(state.qfs) + '</output>' +
            '<button type="button" data-action="fs" data-d="2" aria-label="অক্ষর বড়">+</button>' +
          '</div>' +
          '<form class="tool-group jump-form" data-action="jump" data-s="' + s + '">' +
            '<span class="tool-label">আয়াত</span>' +
            '<input class="input" id="jumpAyah" type="number" min="1" max="' + count + '" value="' + a + '" aria-label="আয়াত নম্বর"/>' +
            '<button class="btn" type="submit">যান</button>' +
          '</form>' +
        '</div>' +

        (s !== 1 && s !== 9 ? '<div class="bismillah-band"><p lang="ar" dir="rtl">' + esc(BISMILLAH) + '</p></div>' : '') +

        '<div class="verses' + (mushaf ? ' mushaf' : '') + '" id="verses">' + verses.join(' ') + '</div>' +

        '<div class="reader-bottom">' +
          '<button type="button" class="btn" data-action="prev-surah" ' + (s <= 1 ? 'disabled' : '') + '>← ' + (s > 1 ? esc(surah(s - 1).bn) : 'প্রথম সূরা') + '</button>' +
          '<span class="reader-progress">' + bn(s) + ' / ' + bn(114) + ' · ' + bn(count) + ' আয়াত</span>' +
          '<button type="button" class="btn" data-action="next-surah" ' + (s >= 114 ? 'disabled' : '') + '>' + (s < 114 ? esc(surah(s + 1).bn) : 'শেষ সূরা') + ' →</button>' +
        '</div>' +
      '</div>' +
      '<div class="ayah-bar" id="ayahBar" hidden></div>';

    app.innerHTML = html;
    applyQfs();
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
  function runSearch(q) {
    var box = document.getElementById('searchResults');
    if (!box) return;
    state.query = q;
    var raw = asciiDigits(q).trim();
    var nq = norm(raw);
    if (!nq) {
      box.innerHTML = '<div class="empty-state"><span class="empty-icon">⌕</span><h3>কী খুঁজতে চান?</h3><p>আরবি শব্দ, সূরার নাম বা <strong>২:২৫৫</strong> ধরনের রেফারেন্স লিখুন।</p></div>';
      return;
    }

    var ref = raw.match(/^(\d{1,3})\s*[:ঃ.\-]\s*(\d{1,3})$/);
    var direct = ref ? parseRef(ref[1] + ':' + ref[2]) : null;
    var surahHits = S.filter(function (x) {
      return norm(x.ar).indexOf(nq) !== -1 || norm(x.en).indexOf(nq) !== -1 || norm(x.bn).indexOf(nq) !== -1;
    }).slice(0, 12);

    var matches = [], totalHits = 0;
    for (var i = 0; i < FLAT.length; i++) {
      var v = FLAT[i];
      var hay = state.ignore ? norm(v.t) : asciiDigits(v.t);
      if (hay.indexOf(state.ignore ? nq : raw) !== -1) {
        totalHits++;
        if (matches.length < 400) matches.push(v);
      }
    }

    var html = '';
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
      html += '<p class="result-meta">আয়াতে মিল: ' + bn(totalHits) + ' টি · ' + bn(shown.length) + ' টি দেখানো হচ্ছে</p><div class="result-list">' +
        shown.map(function (v) {
          return '<button type="button" class="result-item" data-action="goto-ayah" data-s="' + v.s + '" data-a="' + v.a + '">' +
            '<div class="result-ref"><span class="dot"></span> ' + esc(label(v.s, v.a)) + ' <span style="color:var(--muted);font-weight:400">(' + v.s + ':' + v.a + ')</span></div>' +
            '<div class="result-text" lang="ar" dir="rtl">' + highlight(v.t, raw) + '</div></button>';
        }).join('') + '</div>';
      if (matches.length > state.searchLimit) {
        html += '<button type="button" class="btn more-btn" data-action="more-results">আরও দেখুন ' + ICON.arrow + '</button>';
      }
    }
    if (!direct && !surahHits.length && !matches.length) {
      html += '<div class="empty-state"><span class="empty-icon">⌕</span><h3>কিছু পাওয়া যায়নি</h3><p>বানান বদলে বা “হরকত উপেক্ষা” চালু করে আবার চেষ্টা করুন।</p></div>';
    }
    box.innerHTML = html;
  }
  function renderSearch(q) {
    state.view = 'search';
    state.query = q || '';
    state.searchLimit = 40;
    setTitle('অনুসন্ধান');
    setNav('search');
    app.innerHTML =
      '<section class="page-head"><div class="eyebrow">খোঁজ</div><h1>অনুসন্ধান</h1>' +
      '<p>সমগ্র ' + bn(FLAT.length) + ' টি আয়াত ও ' + bn(114) + ' টি সূরার নামে একসাথে খুঁজুন।</p></section>' +
      '<div class="card-panel search-panel">' +
        '<form class="search-form" data-action="search-submit">' +
          '<input class="input" id="searchInput" type="search" name="q" value="' + esc(state.query) + '" placeholder="যেমন: ٱلرَّحۡمَٰنِ, কাহফ, ২:২৫৫" aria-label="অনুসন্ধান"/>' +
          '<button class="btn btn-primary" type="submit">খুঁজুন</button>' +
        '</form>' +
        '<label class="toggle-line"><input type="checkbox" id="ignoreHarakat" ' + (state.ignore ? 'checked' : '') + '/> হরকত / তাশকিল উপেক্ষা করুন (বানান সহজ করে খোঁজে)</label>' +
      '</div>' +
      '<div id="searchResults"></div>';
    updateBookmarkCount();
    runSearch(state.query);
    window.scrollTo(0, 0);
    if (state.query) {
      var input = document.getElementById('searchInput');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
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
      '<p>এই ব্রাউজারে সংরক্ষিত ' + bn(refs.length) + ' টি আয়াত।</p></section>';
    if (!refs.length) {
      html += '<div class="card-panel empty-state"><span class="empty-icon">☆</span><h3>এখনো কিছু সংরক্ষণ করেননি</h3>' +
        '<p>যেকোনো আয়াতের পাশের ★ বোতামে ক্লিক করে এখানে যোগ করুন।</p>' +
        '<button type="button" class="btn btn-primary" data-action="scroll-list">সূরা পড়তে যান ' + ICON.arrow + '</button></div>';
    } else {
      html += '<div class="result-list">' + refs.map(function (r) {
        return '<div class="card-panel result-item bookmark-item" style="display:block">' +
          '<div class="bookmark-head"><span class="ref">' + esc(label(r.s, r.a)) + ' <span style="color:var(--muted);font-weight:400">(' + r.s + ':' + r.a + ')</span></span>' +
            '<span class="tools">' +
              '<button type="button" class="act-btn" data-action="copy" data-s="' + r.s + '" data-a="' + r.a + '" title="কপি" aria-label="কপি">' + ICON.copy + '</button>' +
              '<button type="button" class="act-btn saved" data-action="bookmark" data-s="' + r.s + '" data-a="' + r.a + '" title="সরান" aria-label="সরান">' + ICON.star + '</button>' +
            '</span></div>' +
          '<div class="result-text" lang="ar" dir="rtl">' + esc(verse(r.s, r.a)) + '</div>' +
          '<div style="margin-top:10px"><button type="button" class="btn" data-action="goto-ayah" data-s="' + r.s + '" data-a="' + r.a + '">সূরায় খুলুন ' + ICON.arrow + '</button></div>' +
        '</div>';
      }).join('') + '</div>';
    }
    app.innerHTML = html;
    updateBookmarkCount();
    window.scrollTo(0, 0);
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
        renderHome(location.hash === '#/surahs');
        break;
      case 'mode':
        state.mode = el.dataset.mode; save('mode', state.mode);
        renderReader(state.current.s, state.current.a, true);
        break;
      case 'fs':
        state.qfs = clamp(state.qfs + parseInt(el.dataset.d, 10), 20, 56);
        save('qfs', state.qfs); applyQfs();
        break;
      case 'select-ayah': showAyahBar(s, a); break;
      case 'close-ayah-bar': {
        var bar = document.getElementById('ayahBar');
        if (bar) bar.hidden = true;
        break;
      }
      case 'copy':
        copyText(verse(s, a)); toast('আয়াতটি কপি হয়েছে');
        break;
      case 'share':
        copyText(location.origin + location.pathname + '#/s/' + s + '/a/' + a);
        toast('আয়াতের লিংক কপি হয়েছে');
        break;
      case 'bookmark': toggleBookmark(s, a); break;
      case 'more-results':
        state.searchLimit += 40;
        runSearch(state.query);
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
      go('/search' + (q ? '?q=' + encodeURIComponent(q) : ''));
    } else if (form.dataset.action === 'jump') {
      e.preventDefault();
      var s = clamp(parseInt(form.dataset.s, 10), 1, 114);
      var inputA = form.querySelector('#jumpAyah');
      var a = clamp(parseInt(inputA && inputA.value, 10) || 1, 1, Q.counts[s - 1]);
      go('/s/' + s + '/a/' + a);
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'searchInput') runSearch(e.target.value);
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'ignoreHarakat') { state.ignore = e.target.checked; runSearch(state.query); }
    else if (e.target.id === 'sortSelect') {
      state.sort = e.target.value;
      renderHome(location.hash === '#/surahs');
    } else if (e.target.id === 'surahSelect') {
      go('/s/' + clamp(parseInt(e.target.value, 10), 1, 114));
    }
  });
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') {
      var bar = document.getElementById('ayahBar');
      if (bar) bar.hidden = true;
      if (typing) e.target.blur();
      return;
    }
    if (typing) return;
    if (e.key === '/') {
      e.preventDefault();
      var input = document.getElementById('searchInput') || document.querySelector('.quick-search input');
      if (input) { input.focus(); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      else go('/search');
    } else if (state.view === 'reader' && e.key === 'ArrowRight' && state.current.s > 1) {
      go('/s/' + (state.current.s - 1));
    } else if (state.view === 'reader' && e.key === 'ArrowLeft' && state.current.s < 114) {
      go('/s/' + (state.current.s + 1));
    }
  });
  window.addEventListener('hashchange', renderRoute);

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
  tick();
  setInterval(tick, 1000);
  renderRoute();
})();
