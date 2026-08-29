/**
 * Unauthenticated smoke checks for admin routes and site health.
 * Full login/CRUD tests require credentials — run those manually.
 *
 * Usage:
 *   npx tsx scripts/admin-smoke.ts
 *   ADMIN_SMOKE_URL=https://stranabdullah.org npx tsx scripts/admin-smoke.ts
 */

const baseUrl = (process.env.ADMIN_SMOKE_URL || process.env.PUBLIC_SITE_URL || "http://localhost:3001").replace(
  /\/$/,
  "",
);

type Check = {
  name: string;
  run: () => Promise<void>;
};

async function fetchText(path: string, init?: RequestInit): Promise<{ status: number; text: string; headers: Headers }> {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
  });
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
}

const checks: Check[] = [
  {
    name: "GET /health returns 200",
    async run() {
      const { status, text } = await fetchText("/health");
      if (status !== 200) throw new Error(`expected 200, got ${status}`);
      if (!text.toLowerCase().includes("ok")) throw new Error("health body missing ok");
    },
  },
  {
    name: "GET /admin/login returns 200 with CSRF field",
    async run() {
      const { status, text } = await fetchText("/admin/login");
      if (status !== 200) throw new Error(`expected 200, got ${status}`);
      if (!text.includes('name="_csrf"')) throw new Error("CSRF hidden input not found");
    },
  },
  {
    name: "GET /admin redirects to login when unauthenticated",
    async run() {
      const { status, headers } = await fetchText("/admin");
      if (status !== 302 && status !== 303) throw new Error(`expected redirect, got ${status}`);
      const location = headers.get("location") || "";
      if (!location.includes("/admin/login")) throw new Error(`unexpected redirect: ${location}`);
    },
  },
  {
    name: "GET /admin/items redirects to login when unauthenticated",
    async run() {
      const { status, headers } = await fetchText("/admin/items");
      if (status !== 302 && status !== 303) throw new Error(`expected redirect, got ${status}`);
      const location = headers.get("location") || "";
      if (!location.includes("/admin/login")) throw new Error(`unexpected redirect: ${location}`);
    },
  },
  {
    name: "GET /biography returns 200",
    async run() {
      const { status } = await fetchText("/biography");
      if (status !== 200) throw new Error(`expected 200, got ${status}`);
    },
  },
];

async function main() {
  console.log(`Admin smoke tests → ${baseUrl}\n`);
  let failed = 0;

  for (const check of checks) {
    try {
      await check.run();
      console.log(`✓ ${check.name}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${check.name}: ${message}`);
    }
  }

  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
