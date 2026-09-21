# Status

2026-09-21: Private-test mobile app and web receipt editor deployed to Vercel Production. Physical Android capture, screen-lock and offline-retry validation remain separate follow-up checks.

## Implemented

- Optional Drive / app PDF change approved and released 2026-09-21: independent private app PDFs, PDF job/state, optional per-account automatic Drive backup for new receipts, and capture/retry without Drive. Additive migration `202609210004_app_pdf` is applied. All four existing receipts now have valid private app PDFs; original checksums, values, versions, manual-edit flags and Drive IDs matched the pre-migration baseline.

- Released (2026-09-21): OCR layout reconstruction, short-year/era/date-weekday checks, mixed-rate tax extraction, automatic capture-to-result navigation, and `/web/receipts` plus version-checked web editing. Uses the existing ReceiptRevision table without an authentication-role change. The subsequent approved storage release makes Drive backup optional.

- Japanese/Korean/English capture/start/history/detail/account pages on mobile and desktop browsers; sky-blue design. Browser language is detected initially, and a shared header selector remembers manual choices per device/browser. The original vector Shiba was replaced with the user's approved illustrated mascot on 2026-09-21; matching history and app-icon variants were generated and saved with provenance/prompts under public/mascot/.
- Google login and separate encrypted Drive offline consent; server-owned intake and private read APIs.
- GCS image/PDF archive, Vision OCR, rule extraction, durable database jobs/leases/outbox and Cloud Tasks/Scheduler adapters.
- Per-user IndexedDB retry; receipt/image/PDF ownership; origin validation and bounded image intake.
- Prisma schema plus initial and server-only/RLS migrations. New dedicated Supabase DB chosen; Auth/Storage stay unchanged.
- Dockerfile, environment template, configuration checks and setup/operations docs.
- Test-phase originals are retained without automatic deletion. Android is the first physical-device target.

## Verified

- App PDF release: 59 automated tests, TypeScript, ESLint and the local production build passed. Added coverage includes Drive-free acceptance, backup-choice idempotence, independent Drive/PDF failures, private PDF ownership, legacy backfill preservation and immutable PDF provenance. Production browser checks confirmed backup OFF survives reload, capture stays enabled, and an existing app PDF opens in Chrome's PDF viewer with backup OFF. The existing user's backup setting was restored to ON after verification. Actual new Android capture with backup OFF remains a physical-device check.

- Review-flow local checks: 47 tests passed, including layout/date/tax regressions, editor validation, ownership, stale-version refusal, revision writes and metadata rescheduling during edits. Four private receipt originals and their cached OCR were reviewed locally: date matches improved from 3/4 to 4/4, printed tax amounts from 0/3 to 3/3, and totals from 2/4 to 3/4. One receipt prints only the tax rate, so its tax amount remains null; one total and one taxable amount remain uncertain. These are a small local comparison, not a general accuracy guarantee. No new paid OCR call was used for this comparison, and private receipt files are excluded from Git.
- Review-flow live checks: all four existing receipts were reanalyzed from cached OCR and completed with `jp-receipt-2`; OCR, archive and metadata jobs settled successfully. The web list and side-by-side editor displayed real owned data. One remaining total/taxable-amount omission was corrected through the web form against the original image: one revision was recorded, raw OCR stayed unchanged, and a stale second-tab save was rejected without another revision. This manual correction is separate from the automatic extraction comparison above.

- Mascot update (2026-09-21): source PNG hash preserved; two matching variants generated with the built-in image tool. New header, start/capture, empty-history and offline images load correctly in the browser. App icons checked at 32/180/192/512px. Latest lint and production build passed. These checks do not claim physical Android launcher-icon or offline-network validation.

- 59 automated tests passed across extraction, crypto/access, offline ownership, image/PDF, direct storage upload, real-SQL durability, optional Drive backup, web editing and language selection/date/currency/error boundaries. Cloud call boundaries in these tests are stubbed.
- Multilingual UI (2026-09-21): local production build, TypeScript and scoped ESLint checks passed. Browser checks covered Japanese/Korean/English switching, browser-language detection, reload persistence, same-origin tab synchronization, search-state preservation, 360px mobile and 1920px desktop layouts, localized titles, and translated offline-page content. No horizontal overflow or console errors were observed. Actual offline network interruption and physical-phone localization have not been tested. Original OCR text, merchant names, JPY values, DB schema, permissions and real Drive folder names are unchanged.
- TypeScript production build passed, including standalone artifact tracing. Sharp and Drive module loading from the standalone output checked.
- ESLint passed at the last code check; runtime dependency audit reached zero known vulnerabilities after updates.
- Browser: actual 390px capture/start/history/account screens, navigation and 360px no-horizontal-overflow check. No Next.js error overlay. An initial missing favicon was fixed.
- Local unauthenticated receipt list, image, PDF and worker endpoints return 401; private responses are no-store.
- Live Google sign-in, Drive connection, real receipt views and web-save feedback were checked in the browser. Actual camera capture and scanning-to-result navigation on the user's phone still require a physical-device check.

## External state / blockers

- Supabase organization SJ Receipt Camera is on Pro. The dedicated sj-receipt-camera project is healthy in Tokyo. Strict TLS connectivity and all four migrations were verified. No other service's database is used or deleted.
- GitHub: https://github.com/Park-gunsoo/SJ_Receipt-Camera, default branch `codex/initial-mvp`. Secrets, local tooling and deployment credentials are excluded from Git.
- Vercel Production: https://sj-receipt-camera.vercel.app. Google login with the allowed tester succeeded. Drive consent completed and the app created its real private destination folders. The 390px production capture/history screens and empty DB-backed history were checked; no browser console errors were observed.
- Dedicated Google Cloud project `sj-receipt-camera`: private storage bucket, bounded task queue, Secret Manager, Workload Identity Federation and private Cloud Run worker provisioned. A one-minute Scheduler invokes reconciliation. The original retention policy remains unchanged.
- Vercel development identity successfully exchanged a short-lived token, read private-object metadata and signed an upload policy. A temporary non-receipt payload uploaded directly to GCS with HTTP 201, exact byte count and the production CORS origin; the probe object was removed and no receipt row was created. Production identity is scoped to this Vercel team/project; preview identities are excluded.
- Linux Node 22 clean install and Vercel builds passed after restoring missing optional dependencies in the lockfile. Runtime checks caught dynamic Google descriptor files omitted by Next.js tracing; explicit trace includes and a Docker runtime import/CA check were added. The worker image at code commit `46978ff` passed these checks and was deployed as revision `sj-receipt-worker-00005-xgp` before releasing optional Drive backup. Vercel Production deployment `dpl_Gv44q2WWa5tuJ8oTqkPxj2RRyVfH` is READY at the same code commit.
- Live Cloud Run IAM remains private. A task queued using Vercel federation reached `/api/jobs/run` with HTTP 200 and was consumed. Scheduler reached `/api/jobs/reconcile` with HTTP 200. The smoke task used an absent job ID, so it did not insert a receipt or trigger paid OCR.
- The live DB now contains four real receipts with OCR DONE, app PDF SAVED and existing Drive archive SAVED. All four app PDFs were decoded successfully with one page each and matching original-checksum metadata. PDF, OCR, archive and metadata jobs are DONE. This storage migration made no new OCR calls and preserved the existing manual edit and Drive files. Physical Android capture/close/offline behavior still needs separate validation.
- No Android/iPhone camera, slow-network, screen-lock or installed-PWA test on a physical phone yet.

## Follow-up

Verify real Android capture with Drive backup OFF, scan animation → automatic result navigation, app PDF viewing, close/reopen and offline retry. Expand the receipt evaluation set before claiming general accuracy. Later: export, optional dedicated document-AI comparison, perspective correction, image-similarity duplicates and public-service operations.
