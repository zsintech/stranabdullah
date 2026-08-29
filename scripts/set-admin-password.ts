import "../src/load-env";

import { getAdminAuth } from "@/server/auth/firebase-admin";

const email = process.argv[2] || "nusingastranabdullah@gmail.com";
const password = process.argv[3];

if (!password) {
  console.error("Usage: npx tsx scripts/set-admin-password.ts <email> <password>");
  process.exit(1);
}

const auth = getAdminAuth();
const user = await auth.getUserByEmail(email);
await auth.updateUser(user.uid, { password });
console.log(`Password updated for ${email}`);
