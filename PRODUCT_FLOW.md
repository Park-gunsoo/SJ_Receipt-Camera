# SJ レシートカメラ — MVP flow

Approved scope: private test for the owner and invited testers. Japanese receipt capture with Japanese/Korean/English display, automatic receipt intake, Google Drive PDF archive, real Vision OCR, mobile results and a desktop web review/editor. No export, public registration, image similarity search or perspective correction in this increment. The requested optional-Drive change requires a separate storage decision; the existing Drive requirement remains until that choice is confirmed.

1. Google sign-in identifies the user. A separate Drive consent grants `drive.file` and offline access to the same Google account.
2. One shutter press creates a UUID and saves a Blob in that user's IndexedDB. Upload starts without a second confirmation. Failed local storage is visible; server upload can still proceed.
3. The Vercel API records an upload intent and issues a short-lived, size-bound GCS form. The browser uploads directly to a private staging object. The server verifies the full bytes, checksum, type and size, saves an immutable original, then atomically records acceptance plus ARCHIVE/OCR jobs. Only that committed point permits `受付完了`.
4. Cloud Tasks invokes the separate Cloud Run worker, not the browser or Vercel page request. Archive and OCR have separate durable jobs; OCR failure cannot stop the PDF archive. A scheduled reconciler recovers full staging uploads even if the browser never calls completion, jobs not enqueued, and expired processing leases.
5. The client may close after acceptance. Before acceptance, only completed IndexedDB writes can be retried on a later visit. No guarantee of uploading while the browser is closed.
6. Archive uses a preallocated, DB-persisted Drive file ID, so lost responses do not create another PDF. OCR stores raw evidence, candidates and versioned results. A separate metadata job updates that same PDF after extraction.
7. Uncertain values remain null / 未確認. Categories are suggestions, not confirmed accounting decisions. Mobile reads do not mark records reviewed.
8. When the active capture finishes OCR, move straight to its result page; PDF/Drive status continues independently. A failed/limited read stops scanning and leaves a result link. The result page links to the exact web editor.
9. Web editing shows the original image alongside editable fields. Explicit saves use owner checks and an expected version, write a revision, and preserve original OCR evidence. Polling never replaces unsaved input. Saving an edit does not automatically mark the receipt as formally reviewed. Drive metadata is refreshed without creating a second PDF.

Test-phase default: no automatic server-image deletion; the account privacy page must say so. Drive PDFs are retained. No automatic deletion is introduced without a reviewed policy. Other accounts' offline items must never be uploaded or displayed in the current account.

First release gate: actual Google configuration and a physical-phone test of acceptance → close browser → PDF in Drive. Source-code completion alone is not this gate.
