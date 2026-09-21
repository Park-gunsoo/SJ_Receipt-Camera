import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function databaseOptions(connectionString: string) {
  const url = new URL(connectionString);
  if (!url.hostname.endsWith(".supabase.com") && !url.hostname.endsWith(".supabase.co")) return { connectionString };
  // pg otherwise lets SSL parameters in the URL override an explicit CA configuration.
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslaccept"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca: readFileSync(resolve("certs/supabase-ca.crt"), "utf8"), rejectUnauthorized: true } };
}
