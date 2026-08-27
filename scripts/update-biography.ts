import "../src/load-env";

import { DEFAULT_BIOGRAPHY } from "../src/types/biography";
import { getAdminFirestore } from "../src/server/auth/firebase-admin";
import { stripUndefined } from "../src/lib/strip-undefined";

async function main() {
  const db = getAdminFirestore();
  const bioRef = db.collection("siteSettings").doc("biography");
  await bioRef.set(stripUndefined(DEFAULT_BIOGRAPHY), { merge: false });
  console.log("Biography updated in Firestore siteSettings/biography");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
