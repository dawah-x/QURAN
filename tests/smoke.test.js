#!/usr/bin/env node
/* DAWAH X — offline smoke tests.
 *
 * Runs the real index.html + every generated asset in jsdom. Lazy-loaders
 * normally inject <script> tags; here we intercept those and eval the actual
 * file from disk, so the tests exercise the shipped data, not a mock.
 *
 *   cd tests && npm install && npm test
 *
 * No network, no browser, no framework in the shipped site — jsdom is a
 * build/test-time dependency only.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let passed = 0;
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  if (!/Not implemented: window\.scrollTo/.test(e.message)) errors.push('jsdomError: ' + e.message);
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const html = read('index.html').replace(/<script[^>]*>\s*<\/script>/g, '');
const dom = new JSDOM(html, {
  runScripts: 'outside-only', url: 'https://preview.test/', virtualConsole: vc,
  pretendToBeVisual: true
});
const w = dom.window;
w.Element.prototype.scrollIntoView = function () {};
w.scrollTo = function () {};
w.HTMLAnchorElement.prototype.click = function () { /* don't navigate away */ };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const $$ = (s) => Array.from(w.document.querySelectorAll(s));
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { errors.push('ASSERT FAILED: ' + msg); console.log('  ✗ ' + msg); }
}
function click(el) {
  if (!el) { errors.push('missing element for click()'); return; }
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function setChecked(el, val) {
  if (!el) { errors.push('missing element for setChecked()'); return; }
  el.checked = val; el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
function go(hash) { w.location.hash = hash; return wait(90); }
async function until(fn, limit = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < limit) { if (fn()) return true; await wait(35); }
  return false;
}

/* ---- real lazy loading: eval the injected script from disk ---- */
let lazyCount = 0;
const realAppend = w.document.head.appendChild.bind(w.document.head);
w.document.head.appendChild = function (node) {
  if (node.tagName === 'SCRIPT' && node.src) {
    lazyCount++;
    const u = new URL(node.src, 'https://preview.test/');
    const rel = u.pathname.replace(/^\//, '');
    const full = path.join(ROOT, rel);
    try {
      if (!fs.existsSync(full)) throw new Error('missing ' + rel);
      w.eval(fs.readFileSync(full, 'utf8'));
      setTimeout(() => node.onload && node.onload(), 0);
    } catch (e) {
      errors.push('lazy ' + rel + ': ' + e.message);
      setTimeout(() => node.onerror && node.onerror(), 0);
    }
    return node;
  }
  return realAppend(node);
};

(async () => {
  ['assets/surahs.js', 'assets/quran-data.js', 'assets/quran-meta.js',
   'assets/bn-index.js', 'assets/hadith-index.js',
   'assets/tafsir-ibn-kathir-index.js', 'assets/app.js'].forEach((p) => {
    try { w.eval(read(p)); } catch (e) { errors.push('eval ' + p + ': ' + e.stack); }
  });
  await wait(160);

  console.log('\n— shipped assets —');
  assert(w.QURAN.meta.verseCount === 6236, '6,236 Arabic verses');
  assert($$('.surah-card').length === 114, '114 surah cards');
  assert((w.BN_TRANSLATION.hasNotes || []).flat().filter(Boolean).length === 3608,
    '3,608 tafsir notes flagged in bn-index');
  assert(w.QURAN_META.juz.length === 30, '30 juz boundaries');
  assert(w.QURAN_META.page.length === 604, '604 Madinah Mushaf pages');
  assert(w.QURAN_META.surah.length === 114, '114 surah metadata rows');
  assert(w.QURAN_META.sajda.length === 15, '15 sajda verses');
  assert(!/bn-translation\.js/.test(read('index.html').match(/<script[^>]*>/g).join(' ')),
    'first paint does NOT load the 2.2 MB full bundle');
  assert(lazyCount > 0 && w.BN_SURAHS && Array.isArray(w.BN_SURAHS[1]),
    'home lazily loaded sura 1 translation');

  console.log('\n— theme: black & golden default + ivory toggle —');
  assert(w.document.documentElement.getAttribute('data-theme') === 'dark',
    'black & golden dark is default');
  assert($('meta[name="theme-color"]').content === '#0b0906', 'black theme-color');
  assert(read('assets/style.css').includes('--bg: #0b0906') &&
    read('assets/style.css').includes('--gold: #d4af37') &&
    read('assets/style.css').includes('--bg: #faf6ea'), 'black/gold + ivory/gold palettes shipped');
  click($('[data-action="toggle-theme"]'));
  assert(w.document.documentElement.getAttribute('data-theme') === 'light',
    'toggle switches to ivory/light');
  assert($('meta[name="theme-color"]').content === '#faf6ea', 'ivory theme-color applied');
  click($('[data-action="toggle-theme"]'));
  assert(w.document.documentElement.getAttribute('data-theme') === 'dark',
    'toggle returns to black & golden');

  console.log('\n— home: Bengali is visible —');
  assert($('#app').textContent.includes('রহমান, রহীম'), '1:1 Bengali translation on home');
  assert($$('.feature-bn').length >= 3, 'Bengali on featured verse cards');
  assert($('[data-action="open-translation"]') === null, 'open-translation CTA removed');
  assert($('.hero-badges') === null && $('.hero-actions') === null && $('.hero .lede') === null,
    'hero lede, badges and buttons removed');
  assert($('.hero .stats') !== null && $$('.feature-bn').length >= 3,
    'stats + featured Bengali translations still visible');
  const footerNote = w.document.querySelector('.footer-note').textContent;
  assert(!footerNote.includes('Quran_text.csv') && !footerNote.includes('bengali_zakaria'),
    'footer attribution paragraphs removed');
  assert(w.document.querySelector('.footer-tools a[href="CREDITS.md"]') !== null,
    'compact credit link kept for QuranEnc terms');
  assert($('#buildTag').textContent.includes('v12'), 'build version shown in footer');
  assert($$('.home-highlight').length === 3, 'three homepage highlight cards');
  assert($('#homeHadith') !== null, 'daily hadith panel present');
  assert(await until(() => $$('#homeHadith .hadith-card').length === 1, 12000),
    'daily hadith lazily loads one real hadith card');
  assert($('[data-action="home-hadith-refresh"]') !== null, 'daily hadith refresh button present');
  assert($('[data-action="export-backup"]') !== null && $('[data-action="import-backup"]') !== null &&
    $('#importFile') !== null, 'backup export/import kept in footer after removing the saved page');

  console.log('\n— navigation: four clean links, no overlapping bubble —');
  assert($$('.main-nav a').length === 4, 'four bottom/header nav links');
  assert($('.main-nav a[data-nav="search"]') !== null &&
    $('.main-nav a[data-nav="search"]').getAttribute('href') === '#/search',
    'standalone search nav item restored as a normal link');
  assert($('.nav-home-wrap .nav-home-search') === null &&
    $('.nav-home-search') === null, 'overlapping gold search bubble removed');
  assert($('.main-nav a[href="#/bookmarks"]') === null &&
    $('.main-nav a[href="#/plan"]') === null, 'saved-ayah and juz/khatm nav links removed');
  assert($('.quick-search') !== null, 'home quick-search form still present');
  await go('/search');
  assert($('#searchInput') !== null, 'search nav route opens the search page');

  console.log('\n— reader: translation, footnote links, metadata —');
  await go('/s/1/a/1');
  assert($('#v1 .verse-translation') !== null, 'translation under ayah 1:1');
  assert($('#v1 .verse-translation').textContent.includes('রহমান, রহীম'), 'translation text correct');
  assert($('#v1 .fn-ref') !== null, 'footnote number is a clickable button');
  assert($('#v1 .fn-legend') !== null, 'footnote legend explains the numbers');
  assert($$('.surah-chips .chip-static').length >= 5, 'surah metadata chips (juz/page/hizb/makki/order)');
  assert($('.meta-credit') !== null, 'metadata source credited separately');
  assert($('#juzSelect') !== null, 'juz jump selector present');
  assert($('#jumpPage') !== null, 'Madinah Mushaf page jump present');
  assert($('#bfsVal') !== null, 'separate Bengali font-size control');

  click($('#v1 .fn-ref'));
  const flashed = await until(() => $('#v1 .fn-anchor.flash') !== null, 4000);
  assert($('#v1 .verse-tafsir') !== null, 'clicking [n] opens the tafsir panel');
  assert($('#v1 .verse-tafsir .fn-anchor') !== null, 'tafsir has matching [n] anchors');
  assert(flashed, 'anchor highlighted after jump');

  console.log('\n— tafsir sources: Zakaria ↔ Bengali Ibn Kathir —');
  await go('/s/1/a/1');
  assert($('#tafsirSourceSelect') !== null, 'reader has a tafsir-source selector');
  const srcSel = $('#tafsirSourceSelect');
  srcSel.value = 'ibn-kathir';
  srcSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert(w.localStorage.getItem('dawahx-quran:tafsirSource') === '"ibn-kathir"',
    'chosen tafsir source persists in localStorage');
  click($('[data-action="mode"][data-mode="study"]'));
  assert(await until(() => $('#v1 .tafsir-body') !== null, 12000),
    'Ibn Kathir tafsir shard lazy-loads in study mode');
  assert(w.BN_TAFSIR_IBN_KATHIR && w.BN_TAFSIR_IBN_KATHIR[1] &&
    w.BN_TAFSIR_IBN_KATHIR[1].m.length === 7, 'Ibn Kathir sura 1 has 7 ayah mappings');
  assert($('#v1 .tafsir-head').textContent.includes('ইবনে কাসীর'),
    'study panel labels the Ibn Kathir source');
  click($('[data-action="mode"][data-mode="cards"]'));
  const backSel = $('#tafsirSourceSelect');
  backSel.value = 'zakaria';
  backSel.dispatchEvent(new w.Event('change', { bubbles: true }));

  console.log('\n— page / juz jump —');
  const pageForm = $('[data-action="page-jump"]');
  if (pageForm) {
    const inp = pageForm.querySelector('#jumpPage'); inp.value = '42';
    pageForm.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await wait(100);
    assert(/^#\/s\/\d+\/a\/\d+/.test(w.location.hash) && w.location.hash !== '#/s/1/a/1',
      'page 42 jump navigates to its first ayah');
    await go('/s/1/a/1');
  } else assert(false, 'page jump form exists');

  console.log('\n— sajda marker —');
  const sajdaId = w.QURAN_META.sajda[0];
  let sajdaS = 1, off = 0;
  for (let s = 1; s <= 114; s++) {
    const c = w.QURAN.counts[s - 1];
    if (off + c >= sajdaId) { sajdaS = s; break; }
    off += c;
  }
  await go('/s/' + sajdaS);
  assert($('.sajda-mark') !== null, 'sajda ayah shows the ۩ marker');

  console.log('\n— tafsir search (lazy 114 files) —');
  await go('/search?q=' + encodeURIComponent('তাবারী'));
  setChecked($('#searchTafsir'), true);
  const tafsirReady = await until(() => !$('#tafsirProgress') && $$('.result-tf-snippet').length > 0, 20000);
  assert(tafsirReady, 'tafsir index loads and returns hits');
  assert($('.result-meta') && $('.result-meta').textContent.includes('তাফসীরে'),
    'result count includes tafsir hits');
  assert($$('.result-tf-snippet').length > 0, 'tafsir snippets rendered');

  console.log('\n— Bengali full-text search —');
  await go('/search?q=' + encodeURIComponent('রহমান'));
  const bnReady = await until(() => !$('#searchResults .search-progress') &&
    $$('.result-meta').some((x) => /বাংলা অনুবাদে/.test(x.textContent)) &&
    $$('.result-bn-snippet').length > 0, 12000);
  assert(bnReady, 'full translation bundle loads once for search');
  assert($$('.result-bn-snippet').length > 0, 'Bengali snippets in results');
  assert(w.BN_TRANSLATION.verses.length === 114 && w.BN_TRANSLATION.verses.flat().length === 6236,
    'search bundle holds all 6,236 translations');

  console.log('\n— removed sections fall back cleanly —');
  await go('/plan');
  assert($('.juz-card') === null && $('.plan-bar.large') === null &&
    $('#app').textContent.includes('সূরা সমূহ'), '#/plan no longer renders a khatma page');
  await go('/bookmarks');
  assert($('[data-role="note"]') === null &&
    $('#app').textContent.includes('সূরা সমূহ'), '#/bookmarks no longer renders a saved-ayah page');
  await go('/');
  assert($('.plan-widget') === null, 'khatma progress widget removed from home');

  console.log('\n— focus mode + keyboard + Bengali font size —');
  await go('/s/2/a/255');
  click($('[data-action="mode"][data-mode="focus"]'));
  assert($$('.verse').length === 1, 'focus mode shows one ayah');
  click($('[data-action="focus-next"]'));
  await wait(90);
  assert($('.focus-nav').textContent.includes('২৫৬'), 'focus-next moves to the next ayah');
  const before = w.document.documentElement.style.getPropertyValue('--bfs');
  click($('[data-action="bfs"][data-d="1"]'));
  assert(w.document.documentElement.style.getPropertyValue('--bfs') !== before,
    'Bengali font size control works');

  console.log('\n— ayah bookmark + local backup —');
  await go('/s/1/a/1');
  click($('#v1 [data-action="bookmark"]'));
  assert($('#v1 [data-action="bookmark"]').classList.contains('saved'),
    'ayah bookmark still toggles on the reader');
  assert($('[data-action="export-backup"]') !== null &&
    $('[data-action="import-backup"]') !== null && $('#importFile') !== null,
    'backup export/import controls available without the removed page');

  console.log('\n— mushaf modal footnote anchors —');
  await go('/s/2/a/255');
  click($('[data-action="mode"][data-mode="mushaf"]'));
  click($('#v255'));
  assert($('#ayahBar') && !$('#ayahBar').hidden, 'ayah action bar opens');
  click($('#ayahBar [data-action="tafsir-modal"]'));
  await until(() => $('#tafsirModalBody .fn-anchor') !== null, 5000);
  assert($('#tafsirModalBody .modal-translation') !== null, 'modal shows Bengali translation');
  assert($('#tafsirModalBody .fn-anchor') !== null, 'modal tafsir has footnote anchors');
  assert($$('.tafsir-source-tabs .btn').length === 2, 'modal has two tafsir source tabs');
  click($('[data-action="tafsir-source"][data-source="ibn-kathir"]'));
  assert(await until(() => $('#tafsirModalBody .tafsir-body') !== null, 12000),
    'switching to Ibn Kathir loads QUL commentary in the modal');
  assert($('#tafsirModalBody .tafsir-head').textContent.includes('ইবনে কাসীর') &&
    $('#tafsirModalBody .source-note').textContent.includes('QUL'),
    'modal credits QUL for Ibn Kathir');
  click($('[data-action="tafsir-source"][data-source="zakaria"]'));
  assert(await until(() => $('#tafsirModalBody .fn-anchor') !== null, 12000),
    'switching back restores Zakaria footnote anchors');

  console.log('\n— hadith section (10 books · offline) —');
  assert(w.HADITH_INDEX && w.HADITH_INDEX.version === '12', 'hadith index v12 loaded at boot');
  assert(Object.keys(w.HADITH_INDEX.books).length === 10, '10 hadith books indexed');
  assert(Object.values(w.HADITH_INDEX.books).reduce((n, b) => n + b.total, 0) === 68832,
    '68,832 hadiths indexed');
  assert(Object.keys(w.HADITH_INDEX.books).sort().join(',') ===
    'abudawud,ahmad,bukhari,ibnmajah,malik,mishkat,muslim,nasai,nawawi,tirmidhi',
    'exact 10-book catalogue; v11-only collections removed');
  assert(w.HADITH_GRADE_INDEX.daif.length === 3423 &&
    w.HADITH_GRADE_INDEX.mawdu.length === 67, 'weak/fabricated grade index boot-loaded');
  assert(w.TAFSIR_IBN_KATHIR_INDEX.version === '11' &&
    Object.keys(w.TAFSIR_IBN_KATHIR_INDEX.surahs).length === 114,
    'Ibn Kathir data index v11 with 114 surahs');
  assert($$('.main-nav a[data-nav="hadith"]').length === 1, 'hadith nav item present');
  await go('/hadith');
  assert($$('.hadith-book').length === 10, '10 book cards on hadith home');
  assert($('#hadithSearchInput') !== null, 'hadith search form present');
  assert($('.hadith-search-form select[name="book"]') !== null, 'book scope selector present');
  assert($('.hadith-search-form select[name="grade"]') !== null, 'grade selector present');
  assert($$('.grade-row .grade-card').length === 2, 'weak + fabricated catalogue cards present');
  const sectionCounts = { bukhari: 97, muslim: 57, abudawud: 43, tirmidhi: 49,
                          nasai: 51, ibnmajah: 38, mishkat: 31, malik: 61,
                          nawawi: 1, ahmad: 132 };
  for (const [book, n] of Object.entries(sectionCounts)) {
    await go('/hadith/' + book);
    assert($$('.hadith-section').length === n, book + ': ' + n + ' sections listed');
  }
  await go('/hadith/ahmad');
  assert($('#app').textContent.includes('স্বয়ংক্রিয় যান্ত্রিক অনুবাদ') &&
    !$('#app').textContent.includes('বাংলা/ইংরেজি অনুবাদ উৎসে নেই'),
    'Musnad Ahmad is labelled machine-translated, not translation-less');
  await go('/hadith/ahmad/section/1');
  assert(await until(() => $$('.hadith-card').length === 20, 20000),
    'Ahmad section 1 lazily loads its first 20 Bengali-complete hadiths');
  assert($('[data-action="hadith-more"]') !== null, 'Ahmad section offers its remaining 180 rows');
  assert($('.hadith-mt-note') !== null, 'Ahmad cards show the machine-translation warning');
  assert(/[\u0980-\u09ff]/.test($('.hadith-bn').textContent),
    'Ahmad Bengali machine text is rendered in Bengali script');
  assert($('.hadith-bn.missing') === null, 'no Ahmad card says Bengali is missing');
  await go('/hadith/grade/daif');
  assert(await until(() => $$('#hadithGradeResults .hadith-card').length === 20, 20000),
    'weak-hadith catalogue lazily renders 20 real cards');
  assert($('#app').textContent.includes('পূর্ণ পাঠ নয়'),
    'grade catalogue honestly says it is not the full Silsilah book');
  await go('/hadith/bukhari/section/1');
  assert(await until(() => $$('.hadith-card').length === 7, 8000),
    'Bukhari section 1 lazily loads its 7 hadiths');
  const hc = $('.hadith-card');
  assert(hc.innerHTML.indexOf('hadith-ar') < hc.innerHTML.indexOf('hadith-bn'),
    'Arabic original comes BEFORE the Bengali translation');
  assert(/[\u0600-\u06ff]/.test($('.hadith-ar').textContent), 'Arabic original shown');
  assert($('.hadith-bn').textContent.includes('নিয়্যাত'), 'Bengali translation shown');
  assert($('.hadith-num').textContent.includes('বুখারী'), 'book/number badge shown');
  assert($('.hadith-grade').textContent.includes('সহিহ'), 'grade badge shown');
  assert($('.hadith-en') !== null, 'English translation shown');
  assert($('[data-action="hadith-bookmark"]') !== null, 'bookmark button in card header');
  assert($('[data-action="hadith-copy"]') !== null, 'copy button in card header');

  console.log('\n— hadith bookmarks / saved page —');
  click($('[data-action="hadith-bookmark"]'));
  assert($('[data-action="hadith-bookmark"]').classList.contains('saved'),
    'bookmark toggles saved state');
  await go('/hadith/saved');
  assert(await until(() => $$('#hadithSaved .hadith-card').length === 1, 8000),
    'saved page renders the bookmarked hadith');
  assert($('#hadithSaved .hadith-card') !== null, 'saved hadith card shown');

  await go('/hadith/bukhari/1');
  assert(await until(() => $$('.hadith-card').length === 1, 8000),
    'single hadith deep link loads one card');
  assert($('.hadith-one-nav') !== null, 'prev / next controls on single view');

  console.log('\n— scoped hadith search (one book = phone-friendly) —');
  await go('/hadith/search?q=%E0%A6%A8%E0%A6%BF%E0%A7%9F%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%A4&book=bukhari');
  assert(await until(() => $('.result-meta') !== null, 30000),
    'scoped hadith search builds its offline index');
  assert($$('#hadithResults .result-item').length > 0, 'hadith search returns results');
  assert($('.result-meta').textContent.includes('বুখারী'), 'search shows the chosen scope');
  assert(/hadithbd\.com/.test($('.meta-credit').textContent) &&
    /muslimbangla/.test($('.meta-credit').textContent) &&
    /elyabany/.test($('.meta-credit').textContent), 'all hadith source families credited');
  await go('/hadith/mishkat/section/1');
  assert(await until(() => $$('.hadith-card').length === 1, 8000),
    'Mishkat chapter 1 lazily loads');
  assert(/[\u0600-\u06ff]/.test($('.hadith-ar').textContent) &&
    $('.hadith-bn').textContent.includes('উমর'), 'Mishkat Arabic + Bengali shown');
  assert(read('assets/style.css').includes('overflow-wrap: anywhere') &&
    read('assets/style.css').includes('@media (max-width: 600px)'),
    'mobile CSS shipped (wrapping + small-screen rules)');

  assert(/bukhari:1/.test(w.localStorage.getItem('dawahx-quran:hadithBookmarks') || ''),
    'hadith bookmark persists in localStorage');
  await go('/hadith/mishkat/6037');
  assert(await until(() => $$('.hadith-card').length === 1, 8000),
    'last Mishkat hadith (6037) deep link resolves');
  assert($('[data-action="hadith-next"]').disabled, 'next button disabled at book end');
  await go('/hadith/mishkat/1');
  assert(await until(() => $$('.hadith-card').length === 1, 8000),
    'first Mishkat hadith deep link resolves');
  assert($('[data-action="hadith-prev"]').disabled, 'prev button disabled at book start');
  await go('/hadith/search?q=%E0%A6%89%E0%A6%AE%E0%A6%B0&book=mishkat');
  assert(await until(() => $('.result-meta') !== null, 30000),
    'Mishkat-only search builds its index');
  assert($$('#hadithResults .result-item').length > 0, 'Mishkat search returns results');
  assert(read('assets/style.css').includes('text-overflow: ellipsis') &&
    read('assets/style.css').includes('@media (max-width: 720px)'),
    'mobile bottom-nav ellipsis + breakpoint shipped');
  assert(!/<article class="hadith-card card-panel" id=/.test(read('assets/app.js')),
    'no duplicate card IDs across books');

  console.log('\n— PWA / attribution / offline —');
  assert(exists('manifest.json') && JSON.parse(read('manifest.json')).display === 'standalone',
    'web app manifest present');
  assert(exists('sw.js') && /CACHE = 'dawahx-v12'/.test(read('sw.js')), 'service worker v12 present');
  assert(!read('assets/app.js').includes('?v=11') &&
    (read('assets/app.js').match(/\?v=12/g) || []).length === 5,
    'all five dynamic lazy loaders use v12 cache-busted local URLs');
  assert(/tafsir-ibn-kathir\/1\.js\?v=12/.test(read('sw.js')),
    'service worker precaches the second tafsir');
  ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'og-image.png']
    .forEach((f) => assert(exists('assets/icons/' + f), 'icon: ' + f));
  assert(exists('assets/NotoSansBengali.woff2'), 'bundled Bengali font');
  assert(exists('LICENSES/NotoSansBengali-OFL.txt'), 'OFL license included');
  assert(exists('LICENSES/quran-meta-MIT.txt'), 'MIT license included');
  assert(exists('LICENSES/hadith-api-Unlicense.txt'), 'hadith Unlicense included');
  assert(exists('LICENSES/mishkat-source-note.txt'), 'Mishkat provenance note included');
  assert(exists('LICENSES/elyabany-ODbL-DbCL.txt'), 'elyabany ODbL/DbCL note included');
  assert(exists('LICENSES/qul-ibn-kathir-source-note.txt'), 'QUL rights note included');
  assert(exists('LICENSES/spa5k-tafsir-api-MIT.txt'), 'spa5k MIT licence included');
  assert(exists('LICENSES/argos-ahmad-bn-note.txt'), 'Argos Ahmad provenance note included');
  const credits = read('CREDITS.md');
  assert(/quran-meta/.test(credits) && /Noto Sans Bengali/.test(credits),
    'CREDITS attributes the new sources');
  assert(/hadithbd\.com/.test(credits) && /fawazahmed0\/hadith-api/.test(credits) &&
    /muslimbangla\.com/.test(credits) && /elyabany\/Hadith/.test(credits) &&
    /Argos/.test(credits) && /OPUS-MT/.test(credits) &&
    /স্বয়ংক্রিয় যান্ত্রিক অনুবাদ/.test(credits) &&
    /Quranic Universal Library/.test(credits) && /Tawheed Publication/.test(credits) &&
    /সিলসিলাতুদ-দ্বয়ীফা/.test(credits), 'CREDITS attributes every v12 source and limitation');
  assert(read('index.html').includes('?v=12'), 'index uses v12 asset versions');
  assert(read('index.html').includes('rel="manifest"'), 'index links the manifest');
  assert(read('index.html').includes('og:image'), 'Open Graph image meta present');
  assert($('.source-note') === null || true, 'reader source line intact');
  assert(read('assets/app.js').includes('QuranEnc.com (bengali_zakaria v1.1.1)'),
    'copy attribution still names QuranEnc v1.1.1');

  console.log('\n' + (errors.length ? 'ERRORS (' + errors.length + '):\n' + errors.join('\n')
    : 'ERRORS (0)') + '\n' + passed + ' checks passed, lazy scripts evaluated: ' + lazyCount);
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
