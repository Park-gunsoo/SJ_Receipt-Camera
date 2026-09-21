-- Server-only PostgreSQL access. No Supabase browser/Data API access is granted.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriveConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriveFolder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReceiptRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageDay" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON "User", "DriveConnection", "DriveFolder", "Receipt", "Job", "ReceiptRevision", "UsageDay" FROM PUBLIC;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON "User", "DriveConnection", "DriveFolder", "Receipt", "Job", "ReceiptRevision", "UsageDay" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

-- The trusted Prisma connection is the migration table owner (or a server role
-- with explicitly reviewed privileges). User ownership is checked by the API.
-- Do not add permissive RLS policies to make browser access work.
