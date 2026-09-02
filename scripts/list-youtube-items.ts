import "../src/load-env";
process.env.CONTENT_SOURCE = "firestore";

import { getAdminFirestore } from "@/server/auth/firebase-admin";

async function main() {
  const snap = await getAdminFirestore().collection("contentItems").get();
  const yt = snap.docs.filter((doc) => {
    const data = doc.data();
    return String(data.slug || "").startsWith("yt-") || data.source?.platform === "youtube";
  });
  console.log(`youtube docs: ${yt.length}`);
  yt.forEach((doc) => console.log(doc.data().contentType, doc.data().slug));
}

main().catch(console.error);
