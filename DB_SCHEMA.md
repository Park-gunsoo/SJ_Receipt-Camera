# Database contract

PostgreSQL + Prisma, hosted in a new dedicated Supabase project (approved 2026-09-21). Supabase Auth/Storage are not used. The authoritative machine schema is `prisma/schema.prisma`. UTC instants; receipt transaction dates are Japanese calendar dates (`YYYY-MM-DD`) rather than capture timestamps. JPY values are integer yen and nullable (zero is a valid amount).

- User: Google subject identity and verified email. Test access is controlled by a server-side email allowlist.
- DriveConnection: encrypted refresh token, folder ID, connection status and backupEnabled (default true preserves existing connected users). Never send credentials to the browser. The backup setting applies at receipt acceptance; it never deletes existing files.
- Receipt: owner, unique capture ID per owner, image checksum/object key, accepted time, independent archive/OCR/review states, Drive PDF ID, extracted JSON, current values JSON, user-edited flag/version, review reasons, duplicate group placeholder and deletion marker.
- Receipt.pdfState/pdfError describe the independent private app PDF. ArchiveState describes optional Drive backup; NOT_REQUESTED means no backup was selected for that receipt. Original keys/checksums, existing Drive IDs and user edits are preserved.
- Job: unique receipt + kind (PDF, ARCHIVE, OCR, METADATA), persisted state, attempt count, next run, lease token/expiry, sanitized error code. Claim and completion use lease fencing. ARCHIVE is dispatchable/claimable only after pdfState=SAVED.
- DriveFolder: unique owner + logical folder path and preallocated file ID. Concurrent captures share folders safely.
- UsageDay: per-user JST day intake and OCR counters, reserved atomically; configurable caps.
- ReceiptRevision: PC edits' values, version, actor and time. The existing table is used for explicit web saves; optimistic version checks prevent a stale browser from overwriting a newer edit. Analysis must never overwrite user-edited values.

All receipt access filters by server-authenticated user ID and non-deleted status. No client-supplied owner is trusted. Sensitive receipt bodies are not written to application logs.

Data API is disabled during Supabase setup. All app tables have RLS enabled and no anon/authenticated grants or policies. Prisma uses a trusted table-owner server connection; user ownership is enforced in the API, not through Supabase Auth claims. Never expose the DB connection string to the client.
