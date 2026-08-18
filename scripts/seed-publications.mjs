/**
 * Seed publicly catalogued books / publications into demo-content.json.
 * Sources: Zheen Library OPAC, Hewalname, KurdCollect, KirkukTV, PUKmedia notices.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../src/data/demo-content.json");

/** @type {Array<{title:string,year:number,language:'ku'|'ar',publisher?:string,summary?:string,sourceUrl?:string,slug:string}>} */
const BOOKS = [
  {
    slug: "book-hendek-hizr-1995",
    title: "هەندێک هزر بۆ قۆنازی پەڕینەوە",
    year: 1995,
    language: "ku",
    publisher: "وەزارەتی ڕۆشنبیری — هەولێر",
    summary: "گەشە و گەشەپێدانی ئابووری؛ ئەزمونەکانی رابردوو و ئاسۆکانی داهاتوو لەمەڕ کەرتی پیشەسازی لە ئابووری کوردستاندا.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=55476",
  },
  {
    slug: "book-ba-tanisht-siyaset-1999",
    title: "بە تەنیشت سیاسەتەوە",
    year: 1999,
    language: "ku",
    publisher: "دەزگای چاپ و پەخشی سەردەم — سلێمانی",
    summary: "کۆمەڵە وتارێکی ڕۆژنامەوانی.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=53123",
  },
  {
    slug: "book-razakani-taarib-1999",
    title: "رازەکانی تەعریب و راگواستن",
    year: 1999,
    language: "ku",
    publisher: "روون — سلێمانی",
    summary: "لەسەر تەعریب و راگواستن.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=49412",
  },
  {
    slug: "book-gul-u-gullee-2004",
    title: "گوڵ و گوللە و مارینز",
    year: 2004,
    language: "ku",
    publisher: "شارەوانی سلێمانی",
    summary: "کۆمەڵە وتارێکی ڕۆژنامەوانی.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=27867",
  },
  {
    slug: "book-bawer-ba-meseley-kerkuk-2007",
    title: "باوەڕ بە مەسەلەی کەرکوک بهێنینەوە",
    year: 2007,
    language: "ku",
    publisher: "خەندان بۆ پەخش و وەشاندن",
    summary: "چاوپێکەوتن / دیداری تایبەت.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=53031",
  },
  {
    slug: "book-meseley-tutineke-2011",
    title: "مەسەلەی توتنەکە",
    year: 2011,
    language: "ku",
    publisher: "شەهید ئازاد هەورامی — کەرکووک",
    summary: "زنجیرە کتێبی سیاسی–ڕۆژنامەوانی (چەند بەرگ).",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=52991",
  },
  {
    slug: "book-mikhak-2013",
    title: "مێخەک کەمێک دوور لە سیاسەت",
    year: 2013,
    language: "ku",
    publisher: "یەکێتی نووسەرانی کورد — لقی کەرکوک",
    summary: "کۆمەڵێک بابەتی جۆراوجۆر.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=52997",
  },
  {
    slug: "book-le-roma-2013",
    title: "لە ڕۆما کەوتە بەر چاوم — کوردستانی عوسمانی و تورکیا",
    year: 2013,
    language: "ku",
    publisher: "شڤان — سلێمانی",
    summary: "لەسەر کوردستانی عوسمانی و تورکیا.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=53006",
  },
  {
    slug: "book-tebinyekani-huzeyran-2017",
    title: "تێبینییەکانی حوزەیران — خەم لە یەکێتی … خەم لە یەکێتییەکان",
    year: 2017,
    language: "ku",
    publisher: "چاپخانەی کارۆ — سلێمانی",
    sourceUrl: "https://www.hewalname.com/ku/?cat=109",
  },
  {
    slug: "book-manshetakan-2018",
    title: "مانشێتە مەزنەکان — ئەلبوومی رۆژگاری مانشێتی کاغەزی",
    year: 2018,
    language: "ku",
    publisher: "لقی سلێمانی سەندیکای رۆژنامەنووسانی کوردستان",
    sourceUrl: "https://www.hewalname.com/ku/?cat=109",
  },
  {
    slug: "book-le-ghazetewe-2019",
    title: "لە غەزەتەوە بۆ غەزای سۆشیال میدیا",
    year: 2019,
    language: "ku",
    publisher: "سلێمانی",
    summary: "سێ بەرگ: رۆژنامەی رۆژانە، سۆشیال میدیا، گەڕان بەدوای حەبی ئەسپریندا.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=23459",
  },
  {
    slug: "book-meseley-tutineke-5-2019",
    title: "مەسەلەی توتنەکە ٥ — کۆتایی ناوی قۆناغەکان بنێن",
    year: 2019,
    language: "ku",
    publisher: "کارۆ — سلێمانی",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=28358",
  },
  {
    slug: "book-tiri-rojgar-2020",
    title: "تیری رۆژگار",
    year: 2020,
    language: "ku",
    publisher: "چاپخانەی کارۆ — سلێمانی",
    sourceUrl: "https://www.hewalname.com/ku/?cat=109",
  },
  {
    slug: "book-chetri-bizutnewe-2020",
    title: "چەتری بزووتنەوەی رزگاریخوازی گەلی کوردستان",
    year: 2020,
    language: "ku",
    publisher: "چاپخانەی کارۆ — سلێمانی",
    sourceUrl: "https://www.hewalname.com/ku/?cat=109",
  },
  {
    slug: "book-bo-away-nebet-2023",
    title: "بۆ ئەوەی نەبێتە زەمی پاشەملە",
    year: 2023,
    language: "ku",
    publisher: "حەمدی / کوردستانی نوێ — سلێمانی",
    summary: "کۆمەڵە وتارێکی ڕۆژنامەوانی.",
    sourceUrl: "http://zheenlibrary.com/opac/index.php?lvl=record_display&id=47102",
  },
  {
    slug: "book-rastkirdinewey-rerrew-2023",
    title: "راستکردنەوەی رێڕەو — ژانی ژیاندنەوەی حزبایەتی",
    year: 2023,
    language: "ku",
    publisher: "مەکتەبی راگەیاندنی ی.ن.ک. / حەمدی — سلێمانی",
    sourceUrl: "https://www.hewalname.com/ku/?cat=109",
  },
  {
    slug: "book-jadal-kurdistani-2023",
    title: "جدل کردستاني على ضفاف دجلة",
    year: 2023,
    language: "ar",
    publisher: "مطبعة کارو — السلیمانیة (برعاية مؤسسة المسرى)",
    summary: "کتێبێکی عەرەبی لەسەر گفتوگۆی کوردستانی و چوارچێوەی نیشتمانی عێراقی.",
    sourceUrl: "https://www.hewalname.com/ku/?cat=109",
  },
  {
    slug: "book-be-bianuy-bele-2026",
    title: "بە بیانووی (بلە)وە",
    year: 2026,
    language: "ku",
    publisher: "دیجیتاڵ دەگمەن",
    sourceUrl: "https://www.hewalname.com/ku/?cat=109",
  },
  {
    slug: "book-peshini-zerin-mivani-hefte-2026",
    title: "پێشینی زێڕین، گەپی دوور لەقین — میوانی هەفتە",
    year: 2026,
    language: "ku",
    publisher: "دەزگای بژاردەی دەگمەن",
    summary: "بەرگی یەکەمی زنجیرەی ئەلیکترۆنی (پێشینی زێڕین، گەپی دوور لەقین).",
    sourceUrl: "https://pukmedia.com/KS/Details/213370",
  },
  {
    slug: "book-peshini-zerin-manolog-2026",
    title: "پێشینی زێڕین، گەپی دوور لەقین — مەنەلۆج",
    year: 2026,
    language: "ku",
    publisher: "دەزگای بژاردەی دەگمەن",
    summary: "بەرگی دووەمی زنجیرەی ئەلیکترۆنی.",
    sourceUrl: "https://pukmedia.com/KS/Details/213370",
  },
  {
    slug: "book-peshini-zerin-xebardar-2026",
    title: "پێشینی زێڕین، گەپی دوور لەقین — خەبەردار",
    year: 2026,
    language: "ku",
    publisher: "دەزگای بژاردەی دەگمەن",
    summary: "بەرگی سێیەمی زنجیرەی ئەلیکترۆنی.",
    sourceUrl: "https://pukmedia.com/KS/Details/213370",
  },
];

const ABOUT_NOTES = [
  {
    slug: "about-kurdcollect-profile",
    title: "پرۆفایلی گشتی — KurdCollect",
    summary:
      "تۆماری گشتی: نووسەر و ڕۆژنامەنووس؛ لە کەرکوک لەدایکبوو؛ کاری میدیایی لە ١٩٩٣ەوە؛ سەرنووسەری کوردستانی نوێ و ئاسۆ؛ ئەندامی سەرکردایەتی و مەکتەبی سیاسی یەکێتی.",
    body: `ئەم تۆمارە لە سەرچاوەی گشتی KurdCollect وەرگیراوە و بۆ پەڕەی ژیاننامە وەک «دەربارە» بەکاردێت — نەک وەک وتاری سەرەکی ئەرشیف.

ساڵح عەبدوڵڵا محەمەد ناسراو بە ستران عەبدوڵڵا.
لە ١٣ی کانوونی دووەمی ١٩٦٩ لە شاری کەرکوک لەدایکبووە.
لە ساڵی ١٩٩٣ەوە لە بواری ڕۆژنامەوانی حزبی و میدیای کوردستانی کار دەکات و دەنووسێت.
سەرنووسەری ڕۆژنامەی کوردستانی نوێ و ڕۆژنامەی ئاسۆ و گۆڤاری هەفتانە بووە.
دەرچووی کۆلێژی ئابووری زانکۆی سەڵاحەدین — هەولێر.
لە ساڵی ٢٠١٩ بووەتە ئەندامی سەرکردایەتی و مەکتەبی سیاسی یەکێتیی نیشتمانیی کوردستان.
خاوەنی کۆمەڵێک کتێبە بە کوردی و عەرەبی لەسەر مەسەلەی کورد، عێراق و تورکیا.`,
    year: 2024,
    language: "ku",
    contentType: "document",
    outlet: "KurdCollect",
    platform: "kurdcollect",
    url: "https://kurdcollect.com/index.php/ستران_عەبدوڵڵا",
  },
];

const now = new Date().toISOString();
const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const byId = new Set(existing.map((i) => i.id));
let added = 0;

for (const book of BOOKS) {
  const id = book.slug;
  if (byId.has(id)) continue;
  existing.push({
    id,
    slug: book.slug,
    title: book.title,
    summary: book.summary || "",
    body: book.summary || "",
    bodyFormat: "plain",
    contentType: "book",
    language: book.language,
    status: "published",
    publishedAt: `${book.year}-01-01T12:00:00.000Z`,
    year: book.year,
    topics: ["کتێب"],
    tags: ["publication"],
    people: [],
    featured: false,
    source: {
      platform: "catalogue",
      externalUrl: book.sourceUrl,
      imported: true,
      importedAt: now,
    },
    media: { images: [] },
    audit: { createdAt: now, updatedAt: now },
    extras: {
      author: "هەڤاڵ ستران عەبدوڵڵا",
      publicationYear: book.year,
      publisher: book.publisher,
      outlet: book.publisher ? "کتێبخانە / کەتەلۆگ" : "کتێب",
      isDemo: true,
    },
  });
  byId.add(id);
  added++;
  console.log("+ book", book.title);
}

for (const note of ABOUT_NOTES) {
  if (byId.has(note.slug)) continue;
  existing.push({
    id: note.slug,
    slug: note.slug,
    title: note.title,
    summary: note.summary,
    body: note.body,
    bodyFormat: "plain",
    contentType: note.contentType,
    language: note.language,
    status: "published",
    publishedAt: `${note.year}-01-01T12:00:00.000Z`,
    year: note.year,
    topics: ["ژیاننامە"],
    tags: ["about"],
    people: [],
    featured: false,
    source: {
      platform: note.platform,
      externalUrl: note.url,
      imported: true,
      importedAt: now,
    },
    media: { images: [] },
    audit: { createdAt: now, updatedAt: now },
    extras: {
      author: "سەرچاوەی گشتی",
      outlet: note.outlet,
      historicalNotes: "Used for biography/about; public tertiary profile.",
      isDemo: true,
    },
  });
  byId.add(note.slug);
  added++;
  console.log("+ about", note.title);
}

existing.sort((a, b) => {
  const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  return db - da || String(b.id).localeCompare(String(a.id));
});

fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
const jsPath = path.join(__dirname, "../src/data/demo-content.js");
if (fs.existsSync(jsPath)) {
  fs.writeFileSync(jsPath, `export default ${JSON.stringify(existing, null, 2)};\n`, "utf8");
}

console.log(`Done. added=${added} total=${existing.length}`);
