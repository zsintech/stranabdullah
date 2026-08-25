import { z } from "zod";

export const BiographySettingsSchema = z.object({
  name: z.string().min(1),
  intro: z.string().default(""),
  body: z.string().default(""),
  portraitUrl: z.string().default("/brand/portrait-cutout.png"),
  portraitAlt: z.string().default("وێنەی ناسنامەیی ستران عەبدوڵڵا"),
  note: z.string().default(""),
});

export type BiographySettings = z.infer<typeof BiographySettingsSchema>;

export const DEFAULT_BIOGRAPHY: BiographySettings = {
  name: "ستران عەبدوڵڵا",
  intro:
    "نووسەر و ڕۆژنامەنووس. لە کەرکوک لەدایکبوو (١٩٦٩)؛ لە ١٩٩٣ەوە لە میدیای کوردستانی دەنووسێت. سەرنووسەری کوردستانی نوێ و ئاسۆ بووە؛ لە ٢٠١٩ەوە ئەندامی سەرکردایەتی یەکێتیی نیشتمانیی کوردستانە.",
  body: "نووسینەکانی لە ژیان، المرصد، PUKmedia و کتێبخانە گشتییەکاندا بڵاوکراونەتەوە. ئەم پەڕەیە تۆماری ئەرشیف و کەتەلۆگی کتێبەکان کۆدەکاتەوە؛ وردەکاریی تەواوی پۆست و ژیاننامە دواتر لەلایەن نووسینگەوە دەسەلمێندرێت.",
  portraitUrl: "/brand/portrait-cutout.png",
  portraitAlt: "وێنەی ناسنامەیی ستران عەبدوڵڵا",
  note: "سەرچاوەکانی «دەربارە»: پرۆفایلی گشتی KurdCollect، کەتەلۆگی کتێبخانەی ژین، هەواڵنامە، و ئاگادارییەکانی PUKmedia. ژیاننامەی فەرمیی تەواو دواتر لەلایەن نووسینگەوە دادەنرێت.",
};
