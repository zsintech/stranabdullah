/**
 * Add the public site hosts to Firebase Auth authorized domains.
 * Run: npx tsx scripts/authorize-site-domains.ts
 */
import "../src/load-env";

process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "false";

import { getAdminApp } from "../src/server/auth/firebase-admin";
import { getPublicEnv } from "../src/lib/env";

const extra = ["stranabdullah.org", "www.stranabdullah.org", "stranabdullah.onrender.com"];

const app = getAdminApp();
const credential = app.options.credential;
if (!credential) {
  throw new Error("Firebase Admin credential is missing.");
}

const { access_token } = await credential.getAccessToken();
const projectId = getPublicEnv().NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
const headers = {
  Authorization: `Bearer ${access_token}`,
  "Content-Type": "application/json",
};

const currentRes = await fetch(url, { headers });
const current = (await currentRes.json()) as { authorizedDomains?: string[]; error?: { message?: string } };
if (!currentRes.ok) {
  throw new Error(current.error?.message || `GET config failed (${currentRes.status})`);
}

const next = [...new Set([...(current.authorizedDomains ?? []), ...extra])];
const patchRes = await fetch(`${url}?updateMask=authorizedDomains`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ authorizedDomains: next }),
});
const patched = (await patchRes.json()) as { authorizedDomains?: string[]; error?: { message?: string } };
if (!patchRes.ok) {
  throw new Error(patched.error?.message || `PATCH config failed (${patchRes.status})`);
}

console.log("Authorized domains:\n" + (patched.authorizedDomains ?? next).map((d) => `  ${d}`).join("\n"));
