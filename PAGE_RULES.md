# Mobile pages

- `/m/start`: Japanese introduction, Google login, separate Drive connection, honest unavailable/configuration state.
- `/m/capture`: primary route; rear camera, receipt guide, shutter, album alternative; actual captured image overlay, true send/accepted/OCR/archive states, next-shot link.
- `/m/receipts`: real records, merchant/date filters, thumbnail, amount and processing states; empty/error/offline are distinct.
- `/m/receipts/[id]`: zoomable image, private PDF, extracted fields, evidence/review reasons, Drive link. No edit/delete/confirmation controls.
- `/m/account`: identity, Drive status/folder, reconnect, logout with pending count, install and privacy information.

Bottom navigation has 撮影 and 履歴 only. Account in header. PC functionality is not yet available: show `内容の編集機能は準備中です。` rather than advertising a working PC screen. Configuration preview may show the actual empty UI but must disable intake and never invent records or successful integration.
