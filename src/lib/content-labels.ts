import type { ContentItem, ContentType } from "@/types/content";

export const contentTypeLabels: Record<ContentType, string> = {
  speech: "وتار",
  article: "وتار",
  opinion: "بۆچوون",
  interview: "چاوپێکەوتن",
  book: "کتێب",
  audiobook: "کتێبی دەنگی",
  photo: "وێنە",
  video: "ڤیدیۆ",
  statement: "بەیاننامە",
  announcement: "ئاگاداری",
  socialPost: "پۆستی کۆمەڵایەتی",
  document: "بەڵگەنامە",
  other: "هیتر",
};

/** Technical platform slugs → Sorani display names for the public UI. */
const platformLabels: Record<string, string> = {
  facebook: "فەیسبووک",
  fb: "فەیسبووک",
  twitter: "تویتەر",
  x: "ئێکس",
  youtube: "یوتیوب",
  instagram: "ئینستاگرام",
  telegram: "تێلێگرام",
  website: "ماڵپەڕ",
  web: "ماڵپەڕ",
  zhyan: "ژیان",
  marsad: "المرصد",
  pukmedia: "PUKmedia",
  kurdcollect: "KurdCollect",
  catalogue: "کتێبخانە / کەتەلۆگ",
  almasra: "المسرى",
};

function normalizePlatform(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/** Prefer curated outlet; else localize known platform slugs. */
export function sourceOutletLabel(item: ContentItem): string | undefined {
  const curated = item.extras?.outlet?.trim();
  if (curated) return curated;

  const platform = item.source?.platform?.trim();
  if (!platform) return undefined;

  return platformLabels[normalizePlatform(platform)] ?? platform;
}

/** Compact meta phrase, e.g. «لە فەیسبووک». */
export function sourceAttribution(item: ContentItem): string | undefined {
  const outlet = sourceOutletLabel(item);
  return outlet ? `لە ${outlet}` : undefined;
}

export { formatKuDate, formatKuDayMonth } from "@/lib/format";
