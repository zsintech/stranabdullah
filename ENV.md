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
ADMIN_ALLOWED_EMAILS=nusingastranabdullah@gmail.com
SESSION_COOKIE_NAME=adminSession
SESSION_EXPIRES_DAYS=14
COOKIE_SIGNATURE_SECRET=
CSRF_SECRET=
PUBLIC_SITE_URL=https://stranabdullah.org
```

`COOKIE_SIGNATURE_SECRET` signs httpOnly cookies (session + CSRF cookie). `CSRF_SECRET` HMACs the CSRF token value itself. Generate long random strings for both in production (Render blueprint can auto-generate them).

Admin login is host-relative (`/admin/login`). After buying `stranabdullah.org`, add that host (and `www.stranabdullah.org`) under Firebase Authentication → Settings → Authorized domains, then attach the domain in Render and point Namecheap DNS at the records Render shows.

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
