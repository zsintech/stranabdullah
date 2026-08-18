import "../src/load-env";

import { getAdminAuth } from "../src/server/auth/firebase-admin";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin-user.ts <email> <password>");
    process.exit(1);
  }

  const auth = getAdminAuth();
  try {
    const user = await auth.createUser({
      email,
      password,
      emailVerified: true,
    });
    console.log(`Created admin user ${user.uid} <${user.email}>`);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/email-already-exists") {
      console.log(`User already exists: ${email}`);
      return;
    }
    console.error(error);
    process.exit(1);
  }
}

main();
