import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getPublicEnv, getServerEnv, isUsingEmulators } from "@/lib/env";

function ensureEmulatorEnv() {
  if (!isUsingEmulators()) return;
  process.env.FIRESTORE_EMULATOR_HOST ??=
    getServerEnv().FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??=
    getServerEnv().FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??=
    getServerEnv().FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
}

export function getAdminApp(): App {
  ensureEmulatorEnv();

  if (getApps().length) {
    return getApps()[0]!;
  }

  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  const projectId =
    serverEnv.FIREBASE_ADMIN_PROJECT_ID ??
    publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (isUsingEmulators()) {
    return initializeApp({ projectId });
  }

  if (
    serverEnv.FIREBASE_ADMIN_CLIENT_EMAIL &&
    serverEnv.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail: serverEnv.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: serverEnv.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      projectId,
      storageBucket: publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  if (serverEnv.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
      storageBucket: publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  throw new Error(
    "Firebase Admin is not configured. Set emulator mode or provide service account credentials. See ENV.md.",
  );
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}
