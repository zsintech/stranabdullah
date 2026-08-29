import "../src/load-env";

import { Storage } from "@google-cloud/storage";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { projectIdForStorage, storageBucketCandidates } from "@/lib/firebase-storage-bucket";
import { resolveStorageBucketName } from "@/lib/firebase-storage-bucket";

function gcsClient(): Storage {
  const serverEnv = getServerEnv();
  const projectId = projectIdForStorage();

  if (serverEnv.FIREBASE_ADMIN_CLIENT_EMAIL && serverEnv.FIREBASE_ADMIN_PRIVATE_KEY) {
    return new Storage({
      projectId,
      credentials: {
        client_email: serverEnv.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: serverEnv.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
    });
  }

  if (serverEnv.GOOGLE_APPLICATION_CREDENTIALS) {
    return new Storage({ projectId });
  }

  throw new Error("Firebase Admin credentials missing for bucket setup.");
}

async function main() {
  const projectId = projectIdForStorage();
  const configured = getPublicEnv().NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const storage = gcsClient();

  for (const name of storageBucketCandidates(projectId, configured)) {
    const [exists] = await storage.bucket(name).exists();
    console.log(`${name}: ${exists ? "exists" : "missing"}`);
    if (exists) continue;

    try {
      await storage.createBucket(name, {
        location: "US",
        storageClass: "STANDARD",
        uniformBucketLevelAccess: { enabled: true },
      });
      console.log(`Created bucket: ${name}`);
    } catch (error) {
      console.error(`Could not create ${name}:`, error instanceof Error ? error.message : error);
    }
  }

  const resolved = await resolveStorageBucketName().catch((error) => {
    if (error instanceof Error && error.message.includes("bucket not found")) {
      console.error(
        "\nNo Storage bucket found. If you see 'billing account disabled', upgrade Firebase to Blaze first, then open Firebase Console → Storage → Get started.",
      );
    }
    throw error;
  });
  console.log(`\nResolved upload bucket: ${resolved}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
