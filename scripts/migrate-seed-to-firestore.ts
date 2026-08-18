import "../src/load-env";

import demoContent from "../src/data/demo-content.json";
import { ContentItemSchema } from "../src/types/content";
import { DEFAULT_BIOGRAPHY } from "../src/types/biography";
import { getAdminFirestore } from "../src/server/auth/firebase-admin";
import { stripUndefined } from "../src/lib/strip-undefined";

const force = process.argv.includes("--force");

async function main() {
  const db = getAdminFirestore();
  const col = db.collection("contentItems");
  const items = demoContent.map((raw) => ContentItemSchema.parse(raw));
  let written = 0;
  let skipped = 0;

  for (const item of items) {
    const ref = col.doc(item.id);
    if (!force) {
      const existing = await ref.get();
      if (existing.exists) {
        skipped += 1;
        continue;
      }
    }
    await ref.set(stripUndefined(item));
    written += 1;
  }

  const bioRef = db.collection("siteSettings").doc("biography");
  if (force || !(await bioRef.get()).exists) {
    await bioRef.set(stripUndefined(DEFAULT_BIOGRAPHY));
  }

  console.log(`Migration complete. wrote=${written} skipped=${skipped} force=${force}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
