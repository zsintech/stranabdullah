import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

const publicSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

const serverSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.preprocess(
    emptyToUndefined,
    z.string().email().optional(),
  ),
  FIREBASE_ADMIN_PRIVATE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  GOOGLE_APPLICATION_CREDENTIALS: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  FIRESTORE_EMULATOR_HOST: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  FIREBASE_AUTH_EMULATOR_HOST: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  FIREBASE_STORAGE_EMULATOR_HOST: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  ADMIN_ALLOWED_EMAILS: z.preprocess(emptyToUndefined, z.string().optional()),
  SESSION_COOKIE_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
  SESSION_EXPIRES_DAYS: z.preprocess(emptyToUndefined, z.string().optional()),
  CSRF_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  COOKIE_SIGNATURE_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  PORT: z.preprocess(emptyToUndefined, z.string().optional()),
  META_GRAPH_API_VERSION: z.preprocess(emptyToUndefined, z.string().optional()),
  META_APP_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  META_APP_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  META_VERIFY_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  META_MAIN_PAGE_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  META_OFFICE_PAGE_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  META_MAIN_PAGE_ACCESS_TOKEN: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  META_OFFICE_PAGE_ACCESS_TOKEN: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function getPublicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS:
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS ?? "true",
  });
}

export function getServerEnv(): ServerEnv {
  return serverSchema.parse({
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    GOOGLE_APPLICATION_CREDENTIALS:
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    ADMIN_ALLOWED_EMAILS: process.env.ADMIN_ALLOWED_EMAILS,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
    SESSION_EXPIRES_DAYS: process.env.SESSION_EXPIRES_DAYS,
    CSRF_SECRET: process.env.CSRF_SECRET,
    COOKIE_SIGNATURE_SECRET: process.env.COOKIE_SIGNATURE_SECRET,
    PORT: process.env.PORT,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    META_MAIN_PAGE_ID: process.env.META_MAIN_PAGE_ID,
    META_OFFICE_PAGE_ID: process.env.META_OFFICE_PAGE_ID,
    META_MAIN_PAGE_ACCESS_TOKEN: process.env.META_MAIN_PAGE_ACCESS_TOKEN,
    META_OFFICE_PAGE_ACCESS_TOKEN: process.env.META_OFFICE_PAGE_ACCESS_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  });
}

export function isUsingEmulators(): boolean {
  try {
    return getPublicEnv().NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
  } catch {
    return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "false";
  }
}
