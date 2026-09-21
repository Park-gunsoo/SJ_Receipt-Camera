# Status

2026-09-21: Private-test implementation created. This is source/local verification, not a completed cloud release.

## Implemented locally

- Japanese capture/start/history/detail/account pages; sky-blue design. The original vector Shiba was replaced with the user's approved illustrated mascot on 2026-09-21; matching history and app-icon variants were generated and saved with provenance/prompts under public/mascot/.
- Google login and separate encrypted Drive offline consent; server-owned intake and private read APIs.
- GCS image/PDF archive, Vision OCR, rule extraction, durable database jobs/leases/outbox and Cloud Tasks/Scheduler adapters.
- Per-user IndexedDB retry; receipt/image/PDF ownership; origin validation and bounded image intake.
- Prisma schema plus initial and server-only/RLS migrations. New dedicated Supabase DB chosen; Auth/Storage stay unchanged.
- Dockerfile, environment template, configuration checks and setup/operations docs.
- Test-phase originals are retained without automatic deletion. Android is the first physical-device target.

## Verified

- Mascot update (2026-09-21): source PNG hash preserved; two matching variants generated with the built-in image tool. New header, start/capture, empty-history and offline images load correctly in the browser. App icons checked at 32/180/192/512px. Latest lint and production build passed. These checks do not claim physical Android launcher-icon or offline-network validation.

- 30 automated tests passed across extraction, crypto/access, offline ownership, image/PDF, direct storage upload and real-SQL durability. Cloud call boundaries are stubbed.
- TypeScript production build passed, including standalone artifact tracing. Sharp and Drive module loading from the standalone output checked.
- ESLint passed at the last code check; runtime dependency audit reached zero known vulnerabilities after updates.
- Browser: actual 390px capture/start/history/account screens, navigation and 360px no-horizontal-overflow check. No Next.js error overlay. An initial missing favicon was fixed.
- Local unauthenticated receipt list, image, PDF and worker endpoints return 401; private responses are no-store.
- Screenshots: output/playwright/. The configured-success/camera/OCR screens have not been validated using a live Google account.

## External state / blockers

- Supabase organization SJ Receipt Camera is on Pro. The dedicated sj-receipt-camera project is healthy in Tokyo. Strict TLS connectivity and all three migrations were verified. No other service's database is used or deleted.
- Local `.env` has generated secrets, the tester allowlist and the connected Supabase database URL, excluded from Git. Google project/OAuth/storage/task configuration is still in progress.
- Google Cloud resources, deployed HTTPS app and live Drive/OCR results are not yet verified. The Supabase Pro subscription was changed by the owner and verified in the dashboard.
- No Android/iPhone camera, slow-network, screen-lock or installed-PWA test on a physical phone yet.

## Follow-up

Publish to the specified GitHub repository and deploy the web app to Vercel; finish dedicated Supabase DB and Google service connections, then verify real Android acceptance/close/Drive/OCR/retry. A Vercel screen deployment alone does not prove that external receipt processing works. Later: PC editor/export, richer extraction, perspective correction, image-similarity duplicates and public-service operations.
