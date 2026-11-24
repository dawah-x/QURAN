# DAWAH X — আল-কুরআন ও হাদিস

একটি **সম্পূর্ণ স্ট্যাটিক, নির্ভরতাহীন, অফলাইন-প্রথম** পাঠক — KFGQPC হাফস উসমানী লিপিতে পুরো কুরআন, ড. আবূ বকর মুহাম্মাদ যাকারিয়ার **সম্পূর্ণ বাংলা অনুবাদ ও ৩,৬০৮টি টীকা**, **বাংলা তাফসীর ইবনে কাসীর** (QUL), আর **৯টি গ্রন্থে ৪২,৪৬৯টি হাদিস** (আরবি মূল প্রথমে, তার নিচে বাংলা), এবং **ব্ল্যাক অ্যান্ড গোল্ডেন / আইভরি · সোনালি** থিম।

> 🌐 লাইভ: https://dawah-x.github.io/QURAN/ (GitHub Pages, `main` থেকে স্বয়ংক্রিয়) · `netlify.toml`-ও included।

## উৎস ও ক্রেডিট

| উৎস | কী নেওয়া হয়েছে | লাইসেন্স / শর্ত |
|---|---|---|
| [`Hafs_20.zip`](Hafs_20.zip) — [QuranEnc.com](https://quranenc.com/en/home/api) | **KFGQPC HAFS Uthmanic Script** ফন্ট + `Quran_text.csv` (১১৪ সূরা / ৬,২৩৬ আয়াত) | মূল প্রকাশকের নীতিমালা |
| [quranenc.com/bn/browse/bengali_zakaria](https://quranenc.com/bn/browse/bengali_zakaria) | **Bengali Translation - Abu Bakr Zakaria** `bengali_zakaria` **v1.1.1** — ৬,২৩৬ অনুবাদ + **৩,৬০৮** টীকা (~৪৩ লক্ষ অক্ষর), **হুবহু** | [QuranEnc-এর ৭টি পুনঃপ্রকাশের শর্ত](https://quranenc.com/en/home/api) |
| [quran-meta v7.0.0](https://github.com/quran-center/quran-meta) + [Noto Sans Bengali](https://github.com/notofonts/bengali) | ৩০ পারা / ৬০৪ পৃষ্ঠা / ২৪০ হিযব-চতুর্থাংশ / ১৫ সিজদা / মাক্কী-মাদানী · বাংলা UI ফন্ট | **MIT** · **SIL OFL 1.1** |
| [fawazahmed0/hadith-api@1](https://github.com/fawazahmed0/hadith-api) · [hadithbd.com](https://www.hadithbd.com/hadith/) | **আট গ্রন্থে ৩৬,৪৩২ হাদিস** — সবগুলোতে বাংলা/আরবি/ইংরেজি; আন্তর্জাতিক নাম্বারিং, **হুবহু** | **Unlicense (public domain)**; বাংলা অনুবাদের মূল উৎস হিসেবে hadithbd.com ক্রেডিটেড |
| [Ebrahim-ead/ead](https://github.com/Ebrahim-ead/ead) · [muslimbangla.com](https://muslimbangla.com/) | **মিশকাতুল মাসাবীহ** ৬,০৩৭ হাদিস — বাংলা + আরবি, ৩১ অধ্যায় | প্রোভেন্যান্স নোট: [`LICENSES/mishkat-source-note.txt`](LICENSES/mishkat-source-note.txt) (কোনো স্পষ্ট লাইসেন্স ঘোষণা নেই) |
| [QUL resource 31](https://qul.tarteel.ai/resources/tafsir/31) · [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api) · তাওহীদ পাবলিকেশন | **বাংলা তাফসীর ইবনে কাসীর** — ১১৪ সূরা / ৬,২৩৬ আয়াত-এন্ট্রি / ১,৯১৪ অনুচ্ছেদ, **হুবহু** | কোড MIT; তাফসীর পাঠের মূল অধিকার সংরক্ষিত — [`LICENSES/qul-ibn-kathir-source-note.txt`](LICENSES/qul-ibn-kathir-source-note.txt) |

পূর্ণ বিবরণ, SHA-256, শর্তাবলি ও লাইসেন্স ফাইল: **[CREDITS.md](CREDITS.md)** · **[ROADMAP.md](ROADMAP.md)**।

## ফিচার

| | |
|---|---|
| 📖 **কুরআন** | ১১৪ সূরা / ৬,২৩৬ আয়াত, KFGQPC হাফস উসমানী লিপি, যাকারিয়া বাংলা অনুবাদ ও ৩,৬০৮ টীকা; সূরা/পারা/পৃষ্ঠা/হিযব নেভিগেশন, «মুসহাফ» মোড |
| 📚 **দুই তাফসীর** | রিডারে «যাকারিয়া ↔ ইবনে কাসীর» সিলেক্টর, মডালে ট্যাব, QUL/তাওহীদ পাবলিকেশন অ্যাট্রিবিউশন |
| 📕 **হাদিস সেকশন** | **«হাদিস»** ন্যাভ: ৯ গ্রন্থে **৪২,৪৬৯টি** হাদিস — বুখারী/মুসলিম/চার সুনান/মিশকাত/মুয়াত্তা/নববী ৪০; ব্যাজ-সারি → **আরবি মূল → বাংলা**, মান-ফিল্টার, যঈফ/জাল তালিকা, অধ্যায়-ভিত্তিক পাঠ, ডিপ-লিংক, গ্রন্থ-স্কোপড সার্চ — সব lazy/offline |
| ★ **বুকমার্ক** | কুরআন ও হাদিস বুকমার্ক, ব্যাকআপ/আমদানি, «সংরক্ষিত» পাতা |
| 🔎 **সার্চ** | কুরআন ও হাদিসে সম্পূর্ণ অফলাইন ফুল-টেক্সট সার্চ; কোনো সার্ভার/API নেই |
| 🌗 **থিম** | ডিফল্ট «ব্ল্যাক অ্যান্ড গোল্ডেন», টগলে «আইভরি · সোনালি»; `theme-color` ও PWA manifest সিঙ্ক |
| 📲 **PWA** | `manifest.json`, `sw.js`, ইনস্টল বাটন, «সব অফলাইনে সংরক্ষণ», ১৯২/৫১২/maskable আইকন |

`/assets/*`-এ `?v=13` cache-busting, `index.html`/`sw.js` `must-revalidate` — নতুন ডিপ্লয়ে পুরনো ক্যাশ আটকে থাকে না। তবুও প্রয়োজনে **hard refresh** (Ctrl/Cmd+Shift+R)।

## গঠন

```
index.html  assets/app.js  assets/style.css  sw.js  manifest.json
assets/
  quran-data.js  quran-meta.js  surahs.js       আরবি/মেটাডেটা/সূরা-তালিকা
  bn-index.js  bn/*.js  bn-translation.js       বাংলা অনুবাদ + টীকা (lazy + সার্চ বান্ডেল)
  tafsir/*.js  tafsir-ibn-kathir/*.js           দুই তাফসীরের lazy shard
  hadith-index.js  hadith/*/*.js                ৯ গ্রন্থ / ৪২৮ lazy shard
  Hafs_20.woff2  NotoSansBengali.woff2         বান্ডেল করা ফন্ট
  icons/                                       PWA আইকন + OG কার্ড
data/
  Quran_text.csv                               মূল আরবি উৎস
  quranenc_bengali_zakaria.json.gz             QuranEnc স্ন্যাপশট (অপরিবর্তিত, gzip)
  hadith_fawazahmed0_editions.json.gz          প্রথম ৬টি edition-এর verbatim স্ন্যাপশট
  hadith_v10_sources.json.gz                   বাকি ১২টি edition + ৩১টি মিশকাত অধ্যায়
  hadith_v13_sources.json.gz                   v13-তে শিপড ৬টি edition-এর sanitized স্ন্যাপশট
  hadith_v13_sources.meta.json                 raw/gzip SHA-256 ও edition তালিকা
  tafsir_ibn_kathir_bn.json.gz                 QUL ৩১ · ১১৪ সূরা / ৬,২৩৬ এন্ট্রি
  quran-meta-hafs.json                         quran-meta HafsLists (হুবহু)
  fonts/NotoSansBengali-VF.ttf                 আপস্ট্রিম ফন্ট
tools/                                         build-data / build-bangla / build-meta /
                                               build-hadith / build-tafsir-ibn-kathir /
                                               build-font / build-icons / verify
tests/smoke.test.js                            jsdom স্মোক-টেস্ট, আসল lazy ফাইল লোড করে
.github/workflows/verify.yml                   CI: verify + determinism + jsdom
LICENSES/                                      MIT · OFL · Unlicense · Mishkat · QUL · spa5k নোট
CREDITS.md  ROADMAP.md  netlify.toml  Hafs_20.zip
```

## পুনর্নির্মাণ ও যাচাই

```bash
python3 tools/build-data.py      # আরবি CSV → quran-data.js
python3 tools/build-bangla.py    # SHA-256 যাচাই → bn-index, bn/*, bn-translation, tafsir/*
python3 tools/build-meta.py      # HafsLists → quran-meta.js
python3 tools/build-hadith.py    # ২৪টি verbatim উৎস → hadith-index + ৪২৮টি lazy shard
python3 tools/build-tafsir-ibn-kathir.py  # QUL → ১১৪টি dedup shard
python3 tools/build-font.py      # → NotoSansBengali.woff2   (fonttools + brotli)
python3 tools/build-icons.py     # → icons/*                (pillow)
python3 tools/verify.py          # ১৩৮টি চেক: প্রতিটি আয়াত/হাদিস/তাফসীর, ৭৭৯টি JS syntax, লাইসেন্স, PWA
cd tests && npm install && npm test   # jsdom স্মোক-টেস্ট
```

`build-font.py` / `build-icons.py` শুধু **বিল্ড-টাইম** ডিপেন্ডেন্সি; তাদের আউটপুট কমিট করা আছে, তাই সাইট চালাতে কিছু ইনস্টল করতে হয় না। CI-তে ডেটা-জেনারেটরগুলো পুনরায় চালিয়ে `git diff --exit-code` দিয়ে নির্ধারণযোগ্যতা (determinism) যাচাই করা হয়।

## নির্ভুলতা ও শর্ত

- আরবি পাঠ `Quran_text.csv`-এর `uthmani` কলাম থেকে **হুবহু**; ১ নং সূরার ১ নং আয়াত থেকেই বিসমিল্লাহ, ৯ নং সূরা ছাড়া বাকি সূরার শুরুতে আলাদা বিসমিল্লাহ।
- বাংলা অনুবাদ ও টীকা **অপরিবর্তিত** (`bengali_zakaria` v1.1.1)। শুধু `<b>` ও নতুন লাইন নিরাপদ HTML-এ, আর `[১]` নম্বরগুলো ক্লিকযোগ্য `<button>`-এ রূপান্তরিত — **একটি শব্দও বদলানো হয়নি**। স্ন্যাপশট SHA-256: `dc09d6ed6fbcc943d25599b55685b3d536618accfff9f0ef731895a837d10936`।
- হাদিসের ফাঁকা আরবি/বাংলা/ইংরেজি ঘর উৎসেই ফাঁকা; **বানিয়ে ভরাট করা হয়নি**, কার্ডে «উৎসে নেই» নোট আছে।
- ফুটারের ছোট **«ক্রেডিট»** লিংক, রিডারের `source-note`, মডাল, কপি-টেক্সট ও `CREDITS.md`-তে প্রকাশক + উৎস + **v1.1.1**; কোনো বিজ্ঞাপন/ট্র্যাকিং নেই। [৭টি শর্ত](https://quranenc.com/en/home/api) মেনে চলা হয়েছে।
- `verify.py` শুধু **হুবহু ও কাঠামোগত** নির্ভুলতা যাচাই করে; কোনো মুদ্রিত সংস্করণের সাথে ইলমি/তাহকীকি তুলনা বা «কোনো ভুল নেই»-র ধর্মীয় নিশ্চয়তা দেয় না।

---

সমস্যা হলে: ফুটারে **«সংস্করণ v13»** দেখুন (পুরনো ক্যাশ শনাক্ত করতে) ও hard refresh দিন। বর্তমান ক্যাশ `?v=13` / `dawahx-v13`।

> **বড় হালনাগাদ (v13):** পূর্বের অতিরিক্ত আরবি-মূল গ্রন্থ, তার সংশ্লিষ্ট স্ন্যাপশট/টুলচেইন/ওয়ার্কফ্লো/লাইসেন্স-নোট ও সব প্রাপ্ত ডেটা সম্পূর্ণ সরানো হয়েছে। **নববী ৪০-সহ ৯ গ্রন্থ / ৪২,৪৬৯ হাদিস / ৪২৮ shard** রাখা হয়েছে; **৩,৪২৩ যঈফ / ৬৭ জাল** ফিল্টার, দুই তাফসীর, থিম, বুকমার্ক ও সব অফলাইন/PWA ফিচার অপরিবর্তিত। `tools/verify.py` ৬,২৩৬ আয়াত, ৪২,৪৬৯ হাদিস ও ৬,২৩৬ তাফসীর-এন্ট্রি একে একে স্ন্যাপশটের সাথে মেলায়; সেমান্টিক/আলেম-তাহকীকের নিশ্চয়তা নয়, শুধু হুবহু ও কাঠামোগত নির্ভুলতা।

> **ইতিহাস:** v5-এ PWA/lazy-loading, v6-এ হোম পরিচ্ছন্নতা, v7-এ ন্যাভ, v8-এ থিম, v9-এ হাদিস সেকশন, v10-এ আরবি-ফার্স্ট কার্ড ও ৫ গ্রন্থ, v11-এ দ্বিতীয় তাফসীর/গ্রেড-ফিল্টার, v12-এ ক্যাটালগ হালনাগাদ — সব ধাপেই স্ট্যাটিক/অফলাইন নীতি বহাল ছিল।
