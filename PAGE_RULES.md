# Mobile pages

- `/m/start`: localized introduction, Google login, separate Drive connection, honest unavailable/configuration state.
- `/m/capture`: primary route; rear camera, receipt guide, shutter, album alternative; actual captured image overlay, true send/accepted/OCR/archive states, next-shot link.
- `/m/receipts`: real records, merchant/date filters, thumbnail, amount and processing states; empty/error/offline are distinct.
- `/m/receipts/[id]`: zoomable image, private PDF, extracted fields, evidence/review reasons, Drive link. No edit/delete/confirmation controls.
- `/m/account`: identity, Drive status/folder, reconnect, logout with pending count, install and privacy information.

Bottom navigation has 撮影 and 履歴 only. Account in header. PC functionality is not yet available: show `内容の編集機能は準備中です。` rather than advertising a working PC screen. Configuration preview may show the actual empty UI but must disable intake and never invent records or successful integration.

## Display languages (approved 2026-09-21)

All existing responsive pages support Japanese, Korean and English through one language selector in the shared header. Choose the first supported browser language on initial use (Japanese fallback); remember a manual choice per browser/device, without a database migration or new locale routes. UI labels, accessible names, errors, status messages, dates and the offline screen follow the selected language. Switching language must preserve active captures, queued photos, login and search state. Original receipt text, merchant names, amounts/currency, OCR logic and actual Drive folder/file names remain authoritative and unchanged; known system review messages and category/payment labels may be translated only for display.
