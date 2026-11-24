# ক্রেডিট ও উৎস-স্বচ্ছতা / Credits & provenance

এই সাইটের সব কুরআন-সংক্রান্ত লেখা তৃতীয় পক্ষের প্রকাশনা থেকে নেওয়া; নিচে প্রতিটির উৎস, সংস্করণ ও ব্যবহারের শর্ত দেওয়া হলো। কোনো লেখা সম্পাদনা, সংযোজন বা বিয়োজন করা হয়নি।

---

## ১. বাংলা অনুবাদ ও তাফসীর/টীকা (প্রধান সংযোজন)

| | |
|---|---|
| **প্রকাশনা** | *Bengali Translation - Abu Bakr Zakaria* / «কুরআন কারীমের অর্থসমূহের অনুবাদ — বাংলা ভাষায় অনুবাদ- ড. আবূ বকর মুহাম্মাদ যাকারিয়া» |
| **অনুবাদক** | ড. আবূ বকর মুহাম্মাদ যাকারিয়া (Abu Bakr Zakaria) |
| **প্রকাশক / উৎস** | [QuranEnc.com](https://quranenc.com) — কুরআন কারীম বিশ্বকোষ |
| **resource key** | `bengali_zakaria` |
| **সংস্করণ** | **v1.1.1** |
| **মূল পাতা** | https://quranenc.com/bn/browse/bengali_zakaria |
| **API / শর্তাবলি** | https://quranenc.com/en/home/api |
| **পরিসর** | ১১৪ সূরা, **৬,২৩৬** আয়াতের অনুবাদ + **৩,৬০৮** তাফসীর/টীকা (~৪৩ লক্ষ অক্ষর) |
| **স্ন্যাপশট** | `data/quranenc_bengali_zakaria.json.gz` (gzip; অসংকুচিত JSON **অপরিবর্তিত**) |
| **SHA-256** (অসংকুচিত JSON) | `dc09d6ed6fbcc943d25599b55685b3d536618accfff9f0ef731895a837d10936` |
| **মিরর** | [github.com/risan/quran-json](https://github.com/risan/quran-json) → `data/quranenc/bengali_zakaria.json` (QuranEnc-এর SQLite ডাউনলোড থেকে তৈরি হুবহু স্ন্যাপশট) |

### «তাফসীর» বলতে কী বোঝানো হয়েছে

QuranEnc-এর এই সংস্করণে প্রতিটি আয়াতের অনুবাদের সাথে বিস্তারিত **টীকা/ভাষ্য** (`footnotes`) প্রকাশিত হয় — ব্রাউজ পাতায় «টিকা প্রদর্শন» নামে। এগুলোই এই সাইটে «তাফসীর / টীকা · যাকারিয়া» হিসেবে দেখানো হয়েছে। এটি কোনো আলাদা তাফসীর গ্রন্থ (যেমন *আল-মুখতাসার* বা *ইবন কাসীর*) নয়, বরং উল্লিখিত লিংকেরই অংশ।

### QuranEnc.com-এর পুনঃপ্রকাশের শর্তাবলি

> Contents of the translations can be downloaded and re-published, with the following terms and conditions:
> 1. No modification, addition, or deletion of the content.
> 2. Clearly referring to the publisher and the source (QuranEnc.com).
> 3. Mentioning the version number when re-publishing the translation.
> 4. Keeping the transcript information inside the document.
> 5. Notifying the source (QuranEnc.com) of any note on the translation.
> 6. Updating the translation according to the latest version issued from the source (QuranEnc.com).
> 7. Inappropriate advertisements must not be included when displaying translations of the meanings of the Noble Quran.

এই প্রকল্পে তা পালন করা হয়েছে:

- ✅ (১) অনুবাদের `text` ও টীকার `footnotes` হুবহু রাখা হয়েছে। শুধু প্রদর্শনের জন্য `<b>` মার্কআপ ও `\n` কে নিরাপদ HTML-এ রূপান্তর করা হয়েছে (`tools/build-bangla.py`) — বাক্য/শব্দ বদলানো হয়নি। ডেটা ফাইলে মূল স্ন্যাপশটও সংরক্ষিত আছে।
- ✅ (২, ৩, ৪) ফুটার, পাঠকের প্রতি পাতার `source-note`, তাফসীর মডাল, কপি করা লেখা ও এই নথিতে প্রকাশক, উৎস-লিংক ও **v1.1.1** উল্লেখ আছে।
- ✅ (৫) অনুবাদে কোনো মন্তব্য/সংশোধন যোগ করা হয়নি; ভবিষ্যতে কোনো নোট যোগ হলে QuranEnc.com-কে জানাতে হবে।
- ✅ (৬) `tools/build-bangla.py` স্ন্যাপশটের SHA-256 যাচাই করে; নতুন সংস্করণ প্রকাশিত হলে স্ন্যাপশট ও `META.version` হালনাগাদ করতে হবে।
- ✅ (৭) সাইটে কোনো বিজ্ঞাপন, ট্র্যাকিং বা বাণিজ্যিক উপাদান নেই।

`risan/quran-json` প্রকল্পটি নিজের ডেটাসেট **CC BY-SA 4.0** প্রদান করে, তবে প্রতিটি উৎসের নিজস্ব শর্ত বহাল থাকে — তাই উপরের QuranEnc শর্তাবলিই এখানে প্রযোজ্য। মিররটিকেও ক্রেডিট দেওয়া হয়েছে।

---

## ২. আরবি পাঠ ও ফন্ট

| | |
|---|---|
| **আরবি পাঠ** | `data/Quran_text.csv` — উসমানী হাফস লিপি, ৬,২৩৬ সারি (`id, sura, aya, uthmani`) |
| **ফন্ট** | `assets/Hafs_20.woff2`, `assets/Hafs_20.ttf` — **KFGQPC HAFS Uthmanic Script** (Uthmanic Hafs font v20), King Fahd Glorious Quran Printing Complex |
| **উৎস** | `Hafs_20.zip`, [QuranEnc.com API / downloads](https://quranenc.com/en/home/api) — ব্যবহারকারীর সরবরাহ করা মূল আর্কাইভ রেপোতে অক্ষত আছে |

QuranEnc-এর সুপারিশ অনুযায়ী ফন্ট ও পাঠ **একসাথে** ব্যবহার করা হয়েছে (ভিন্ন সংস্করণের ফন্টে এই উসমানী টেক্সট ঠিকমতো রেন্ডার নাও হতে পারে)। ফন্টের ব্যবহার-সংক্রান্ত শর্তাবলি মূল প্রকাশকের (KFGQPC) নীতিমালা অনুযায়ী প্রযোজ্য; এখানে কোনো লাইসেন্স দাবি করা হচ্ছে না।

---

## ৩. পারা / পৃষ্ঠা / হিযব / রুকু / সিজদা ও নযিল-ক্রমের মেটাডেটা

| | |
|---|---|
| **উৎস** | [quran-meta](https://github.com/quran-center/quran-meta) **v7.0.0** (`HafsLists`), লেখক Huseyn Guliyev / Quran-Center |
| **লাইসেন্স** | **MIT** — [`LICENSES/quran-meta-MIT.txt`](LICENSES/quran-meta-MIT.txt) (মূল `LICENSE` অপরিবর্তিত) |
| **মূল স্ন্যাপশট** | `data/quran-meta-hafs.json` (npm টারবল `quran-meta-7.0.0.tgz`-এর `HafsLists` এক্সপোর্টের হুবহু JSON) |
| **উৎপন্ন ফাইল** | `assets/quran-meta.js` (`window.QURAN_META`) — ~১১ KB |
| **ব্যবহার** | ৩০ পারার সীমানা, ৬০৪ মাদিনা-মুসহাফ পৃষ্ঠা, ২৪০ হিযব-চতুর্থাংশ, রুকু, ১৫টি সিজদার আয়াত, ১১৪ সূরার মাক্কী/মাদানী ও নযিলের ক্রম |

> ⚠️ **এটি কুরআনের পাঠ নয়, আলাদা মেটাডেটা** — QuranEnc-এর অনুবাদ/টীকার সাথে মেশানো হয়নি। রিডারের «সূরা-তথ্য» চিপ, পারা-সিলেক্ট, «পারা ও খতম» পাতা ও সিজদা-চিহ্নে উৎসটি পাশাপাশি ক্রেডিট করা আছে (`meta-credit`)। মেটাডেটা Hafs কিরাআত/মাদিনা মুসহাফের প্রচলিত বিভাজন অনুসরণ করে; অন্য কিরাআতে পারা-সীমানা ভিন্ন হতে পারে।

---

## ৪. বাংলা ইউআই ফন্ট

| | |
|---|---|
| **ফন্ট** | **Noto Sans Bengali** (variable: `wght 100–900`, `wdth 62.5–100`) |
| **উৎস** | [google/fonts → `ofl/notosansbengali`](https://github.com/google/fonts/tree/main/ofl/notosansbengali), আপস্ট্রিম [notofonts/bengali](https://github.com/notofonts/bengali) |
| **লাইসেন্স** | **SIL Open Font License 1.1** — [`LICENSES/NotoSansBengali-OFL.txt`](LICENSES/NotoSansBengali-OFL.txt) (মূল `OFL.txt` অপরিবর্তিত) |
| **মূল ফাইল** | `data/fonts/NotoSansBengali-VF.ttf` (৪৬৩,৬৬৮ বাইট, আপস্ট্রিম `NotoSansBengali[wdth,wght].ttf`) |
| **উৎপন্ন ফাইল** | `assets/NotoSansBengali.woff2` — বাংলা/ল্যাটিন/যতিচিহ্নের প্রয়োজনীয় গ্লিফে **সাবসেট** করা (~২১৫ KB), `tools/build-font.py` দিয়ে পুনর্নির্মাণযোগ্য |

ফন্টটি বান্ডেল করার কারণ: যে ডিভাইসে সিস্টেমে বাংলা ফন্ট নেই, সেখানেও **অফলাইনে** অনুবাদ ও টীকা ঠিকমতো রেন্ডার হবে। আরবি পাঠের জন্য আলাদা KFGQPC হাফস ফন্টই ব্যবহৃত হয়; এই সাবসেটে আরবি গ্লিফ রাখা হয়নি।

> OFL অনুযায়ী: ফন্টটি পরিবর্তন (সাবসেট) করা হয়েছে, তাই মূল নাম ব্যবহার করা হয়নি বলে CSS-এ `font-family` নামটি কেবল রেন্ডারিংয়ের জন্য; লাইসেন্স ও কপিরাইট নোটিশ উপরের ফাইলে সংরক্ষিত আছে। ফন্ট ফাইলটি নিজে আলাদাভাবে বিক্রি করা হয় না।

---

## ৫. কীভাবে যাচাই করবেন

```bash
python3 tools/build-bangla.py    # SHA-256 যাচাই + অনুবাদ/টীকা (index, ১১৪ split, search bundle)
python3 tools/build-data.py      # আরবি CSV → assets/quran-data.js
python3 tools/build-meta.py      # Hafs মেটাডেটা → assets/quran-meta.js
python3 tools/build-font.py      # Noto Sans Bengali → WOFF2 subset  (fonttools + brotli)
python3 tools/build-icons.py     # PWA আইকন / OG কার্ড            (pillow)
python3 tools/verify.py          # সব চেকসাম, গণনা, ফাইল ও JS syntax একসাথে
cd tests && npm install && npm test   # ৬০+ jsdom চেক (আসল lazy ফাইল লোড করে)
```

উৎপন্ন ফাইল:

- `assets/bn-index.js` — **প্রথম পাতায়** শুধু meta, টীকা-বিটম্যাপ ও আয়াত-সংখ্যা (~৩৫ KB)
- `assets/bn/1.js … 114.js` — সূরাভিত্তিক অনুবাদ, ওই সূরা খুললেই লোড
- `assets/bn-translation.js` — পুরো ৬,২৩৬ অনুবাদ; **প্রথম সার্চে একবার** লোড হয় (একটিই রিকোয়েস্ট)
- `assets/tafsir/1.js … 114.js` — সূরাভিত্তিক টীকা, প্রয়োজন হলেই লোড; «তাফসীরে খোঁজা» চালু করলে সবগুলো একবারে ইনডেক্স হয়
- `assets/quran-data.js`, `assets/quran-meta.js`, `assets/NotoSansBengali.woff2`, `assets/icons/*`

---

## ৬. অন্যান্য

- সূরার নাম (আরবি / ইংরেজি / বাংলা প্রতিবর্ণীকরণ) এই প্রকল্পের নিজস্ব তালিকা `assets/surahs.js`; এটি কোনো প্রকাশিত অনুবাদের অংশ নয়।
- PWA (`manifest.json`, `sw.js`), আইকন ও OG কার্ড `tools/build-icons.py` দিয়ে তৈরি; কোনো ট্র্যাকিং, অ্যানালিটিক্স বা থার্ড-পার্টি রিকোয়েস্ট নেই।
- সাইটের কোড (HTML/CSS/JS) ও নকশা এই রেপোজিটরির নিজস্ব কাজ; রানটাইমে কোনো বাহ্যিক লাইব্রেরি ব্যবহার করা হয়নি (jsdom শুধু টেস্ট-টাইম ডিপেন্ডেন্সি)।
