/**
 * Verify Firebase Storage bucket access (read + test upload/delete).
 *
 * Usage:
 *   npx tsx scripts/verify-firebase-storage.ts
 */
import "../src/load-env";

import { getAdminStorage } from "@/server/auth/firebase-admin";
import {
  projectIdForStorage,
  resolveStorageBucketName,
  storageBucketCandidates,
} from "@/lib/firebase-storage-bucket";

async function main() {
  const projectId = projectIdForStorage();
  console.log(`Project: ${projectId}`);

  const configured = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "(not set)";
  console.log(`Configured bucket: ${configured}`);
  console.log(`Candidates: ${storageBucketCandidates(projectId, configured).join(", ")}`);

  const bucketName = await resolveStorageBucketName();
  console.log(`\n✓ Using bucket: ${bucketName}`);

  const bucket = getAdminStorage().bucket(bucketName);
  const testPath = `admin/_verify-${Date.now()}.txt`;
  const file = bucket.file(testPath);

  await file.save(Buffer.from("stranabdullah storage verify"), {
    contentType: "text/plain",
    metadata: { metadata: { firebaseStorageDownloadTokens: "verify" } },
  });
  console.log("✓ Test upload OK");

  await file.delete();
  console.log("✓ Test delete OK");
  console.log("\nStorage is ready for admin image/PDF uploads.");
}

main().catch((error) => {
  console.error("\nStorage verification failed:");
  console.error(error instanceof Error ? error.message : error);
  console.error(
    "\nFix: Firebase Console → Build → Storage → Get started (choose a region, then copy the bucket name to Render as NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).",
  );
  process.exit(1);
});
