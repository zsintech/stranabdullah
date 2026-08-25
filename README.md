# stranabdullah

Express + EJS archive site for ستران عەبدوڵڵا.

## Local

```bash
npm install
npm run dev
```

Default: [http://localhost:3000](http://localhost:3000) (or `PORT=3001`).

Uses seed content from `src/data/demo-content.json` when `CONTENT_SOURCE=seed`.

## Admin CMS

Login: `/admin/login` (email + password, allowlisted in `ADMIN_ALLOWED_EMAILS`).

You can create, edit, publish, unpublish (draft), hide (archive), feature items, edit the biography page, and upload covers.

Production stores content in Firestore so edits survive Render restarts. See [ENV.md](ENV.md) for Firebase env vars, creating the admin user, and migrating seed data:

```bash
npx tsx scripts/create-admin-user.ts you@example.com 'password'
npx tsx scripts/migrate-seed-to-firestore.ts
```

Deploy Firestore indexes once:

```bash
npx firebase deploy --only firestore:indexes
```

## Render

Blueprint: `render.yaml` (free web service). Set Firebase credentials and `ADMIN_ALLOWED_EMAILS` in the Render dashboard, then run the migration once against that project. Until Firebase is configured the public site still falls back to seed content.
