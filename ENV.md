# Environment variables

Copy to `.env.local` for local development. Never commit secrets.

## Public site (seed, no Firebase)

```
CONTENT_SOURCE=seed
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
COOKIE_SIGNATURE_SECRET=dev-only-cookie-secret
CSRF_SECRET=dev-only-csrf-secret
PORT=3001
```

## Admin CMS + production content (Firestore)

Enable Email/Password in Firebase Authentication. Create Firestore and Storage.

```
CONTENT_SOURCE=firestore
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
ADMIN_ALLOWED_EMAILS=you@example.com
SESSION_COOKIE_NAME=adminSession
SESSION_EXPIRES_DAYS=14
COOKIE_SIGNATURE_SECRET=
CSRF_SECRET=
```

`FIREBASE_ADMIN_PRIVATE_KEY` should keep `\n` as the two-character sequence `\\n` in env files.

Create the first admin user in the Firebase console, or:

```
npx tsx scripts/create-admin-user.ts you@example.com 'your-password'
```

Then migrate seed content once:

```
npx tsx scripts/migrate-seed-to-firestore.ts
```

Admin UI: `/admin/login`.
