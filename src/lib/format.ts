const KU_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Renders Latin digits as Eastern Arabic numerals for display. */
export function kuDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => KU_DIGITS[Number(d)]);
}

function parse(iso?: string): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Full date, e.g. ١٧ی ئابی ٢٠٢٤ */
export function formatKuDate(iso?: string): string {
  const date = parse(iso);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("ckb", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString("en-GB");
  }
}

/** Day then month, for chronology rows, e.g. ١٧ ئاب */
export function formatKuDayMonth(iso?: string): string {
  const date = parse(iso);
  if (!date) return "";
  try {
    const parts = new Intl.DateTimeFormat("ckb", {
      month: "long",
      day: "numeric",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    return day && month ? `${day} ${month}` : "";
  } catch {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
}

/**
 * Compact editorial date for index grids.
 * e.g. ١٢ کانونی یەکەم ٢٠٢٣ — or Arabic locale when lang is ar.
 */
export function formatIndexDate(iso?: string, lang: "ku" | "ar" | "en" = "ku"): string {
  const date = parse(iso);
  if (!date) return "";

  const locale = lang === "ar" ? "ar" : lang === "en" ? "en-GB" : "ckb";

  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const year = parts.find((p) => p.type === "year")?.value;
    if (day && month && year) {
      const out = `${day} ${month} ${year}`;
      return lang === "en" ? out : kuDigits(out);
    }
    const fallback = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
    return lang === "en" ? fallback : kuDigits(fallback);
  } catch {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
}

/** Numeric date for compact indexes, e.g. ٠٩.٠٨.٢٠٢٦ */
export function formatKuNumeric(iso?: string): string {
  const date = parse(iso);
  if (!date) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return kuDigits(`${dd}.${mm}.${date.getUTCFullYear()}`);
}

export const languageLabels: Record<string, string> = {
  ku: "کوردی",
  ar: "عەرەبی",
  en: "ئینگلیزی",
};

/** Approximate reading time from body length, in Kurdish. */
export function readingTime(body: string): string {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return "";
  return `${kuDigits(Math.max(1, Math.round(words / 180)))} خولەک خوێندنەوە`;
}
