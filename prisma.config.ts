import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolve } from "node:path";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/sj_receipts";
const migrationUrl = new URL(databaseUrl);
if (migrationUrl.hostname.endsWith(".supabase.com") || migrationUrl.hostname.endsWith(".supabase.co")) {
  migrationUrl.searchParams.set("sslmode", "require");
  migrationUrl.searchParams.set("sslaccept", "strict");
  migrationUrl.searchParams.set("sslcert", resolve("certs/supabase-ca.crt").replaceAll("\\", "/"));
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: migrationUrl.toString() },
});
