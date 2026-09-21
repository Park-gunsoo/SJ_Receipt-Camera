# Mobile pages

- `/m/start`: localized introduction and Google login; capture is available without Drive. Drive backup is clearly optional and configured on the account page.
- `/m/capture`: primary route; rear camera, receipt guide, shutter, album alternative; actual captured image overlay, true send/accepted/OCR/archive states, next-shot link.
- `/m/receipts`: real records, merchant/date filters, thumbnail, amount and processing states; empty/error/offline are distinct.
- `/m/receipts/[id]`: zoomable image, private PDF, extracted fields, evidence/review reasons, Drive link. No edit/delete/confirmation controls.
- `/m/account`: identity, private app storage information, optional Drive connection/automatic-backup toggle, actual backup folder, reconnect, logout with pending count, install and privacy information. The toggle applies to newly accepted receipts; existing files and accepted work remain intact.

Bottom navigation has 撮影 and 履歴 only. Account in header. Configuration preview may show the actual empty UI but must disable intake and never invent records or successful integration.

App PDF, optional Drive backup and OCR have separate real status badges. Failed/disconnected Drive cannot disable capture, local retries, app PDF viewing or the editor. Existing connected users keep their previous automatic backup choice; unconnected users need only Google sign-in. All related text supports the same three display languages.

## Capture results and web editing (requested 2026-09-21)

- Show the moving scan line only on the actual captured image while uploading/reading; do not invent progress or delay completion. Once that capture's OCR succeeds, automatically replace the capture route with its mobile detail page. PDF/Drive completion is independent. Failed/limited OCR must stop the animation and offer the result page and retry guidance.
- `/web/receipts`: real owned receipt list, search/date filters and links to each editor. Keep the existing sky-blue Shiba identity and all three display languages. No unrelated dashboard or fabricated statistics.
- `/web/receipts/[id]`: desktop-first original image on the left, editable extracted fields on the right; responsive single-column layout on smaller screens. Show actual processing status, clear save feedback, server validation and stale-version conflicts. Original OCR evidence remains unchanged. Do not replace a dirty form when polling returns.
- Mobile detail includes an actual link to the matching web editor and explains that corrections can be made on the web. Navigation must preserve the login destination. Saving edits is an explicit action; simply viewing the page never confirms a receipt.

## Display languages (approved 2026-09-21)

All existing responsive pages support Japanese, Korean and English through one language selector in the shared header. Choose the first supported browser language on initial use (Japanese fallback); remember a manual choice per browser/device, without a database migration or new locale routes. UI labels, accessible names, errors, status messages, dates and the offline screen follow the selected language. Switching language must preserve active captures, queued photos, login and search state. Original receipt text, merchant names, amounts/currency, OCR logic and actual Drive folder/file names remain authoritative and unchanged; known system review messages and category/payment labels may be translated only for display.
