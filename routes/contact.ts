import { Router } from "express";
import { asyncHandler } from "@/lib/async-handler";
import { consumeFlash, setFlash } from "@/lib/cookies";
import { SITE_EMAIL } from "@/lib/constants";
import { renderPage } from "@/lib/render-page";
import { saveContactMessage } from "@/repositories/messages-repository";

const router = Router();

type ContactFields = { name: string; email: string; message: string };

function readFields(body: Record<string, unknown>): ContactFields {
  const text = (key: keyof ContactFields) => {
    const value = body[key];
    return typeof value === "string" ? value.trim() : "";
  };
  return { name: text("name"), email: text("email"), message: text("message") };
}

function validate(fields: ContactFields): Partial<Record<keyof ContactFields, string>> {
  const errors: Partial<Record<keyof ContactFields, string>> = {};
  if (!fields.name) errors.name = "ناو پێویستە.";
  if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "ئیمەیڵێکی دروست بنووسە.";
  }
  if (!fields.message) errors.message = "پەیام پێویستە.";
  return errors;
}

router.get(
  "/contact",
  asyncHandler(async (req, res) => {
    const flash = consumeFlash(req, res);
    await renderPage(res, "contact", {
      pageTitle: "پەیوەندی",
      pageDescription: "پەیوەندی لەگەڵ نووسینگەی تایبەتی ستران عەبدوڵڵا.",
      email: SITE_EMAIL,
      flash,
      errors: {},
      values: { name: "", email: "", message: "" },
    });
  }),
);

router.post(
  "/contact",
  asyncHandler(async (req, res) => {
    const values = readFields(req.body as Record<string, unknown>);
    const errors = validate(values);

    if (Object.keys(errors).length > 0) {
      await renderPage(res, "contact", {
        pageTitle: "پەیوەندی",
        pageDescription: "پەیوەندی لەگەڵ نووسینگەی تایبەتی ستران عەبدوڵڵا.",
        email: SITE_EMAIL,
        flash: undefined,
        errors,
        values,
      });
      return;
    }

    const { persisted } = await saveContactMessage(values);
    setFlash(res, persisted ? "sent" : "demo");
    res.redirect("/contact");
  }),
);

export default router;
