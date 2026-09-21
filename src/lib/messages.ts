export function errorMessage(code: string) {
  const messages: Record<string, string> = {
    UNAUTHORIZED: "ログインし直してください。未送信の写真は、このアカウントで再開できます。",
    ACCOUNT_CHANGED: "アカウントが切り替わりました。元のアカウントで再開してください。",
    DRIVE_RECONNECT: "Google Driveを再接続してください。写真は未送信のまま保持します。",
    DRIVE_PERMISSION: "Google Driveのアクセス権を確認してください。",
    DRIVE_FULL: "Google Driveの空き容量を確認してください。",
    DRIVE_FILE_TRASHED: "保存先のファイルまたはフォルダをGoogle Driveで確認してください。",
    FILE_TOO_LARGE: "写真が大きすぎます。12MB以下の画像を選択してください。",
    UNSUPPORTED_IMAGE: "JPEG・PNG・WebPの画像を選択してください。HEICはJPEGに変換してください。",
    INVALID_IMAGE: "この画像を読み込めません。別の写真を選択してください。",
    CAPTURE_ID_CONFLICT: "撮影データを確認する必要があります。写真を保持しています。",
    UPLOAD_PENDING: "写真の到着を確認しています。受付完了まで、端末の写真を保持します。",
    UPLOAD_CHECKSUM_MISMATCH: "写真を正しく受信できませんでした。元の写真を再送します。",
    INTAKE_LIMIT: "本日の受付上限に達しました。未送信の写真は次回再送します。",
    OCR_LIMIT: "本日の読み取り上限に達しました。保存を続け、翌日以降に読み取ります。",
    OCR_EMPTY: "文字を読み取れませんでした。PDFの保存は続行します。",
    OCR_ERROR: "読み取りを再試行しています。保存状況は別に確認できます。",
    WORKER_INTERRUPTED: "処理の再開が必要です。運営者にお知らせください。",
    NOT_CONFIGURED: "現在、接続の準備中です。まだ写真を送信できません。",
    LOCAL_STORAGE: "端末への一時保存ができません。受付完了まで画面を閉じないでください。",
    OFFLINE: "未送信。接続後、または次回この画面を開くと再送します。",
  };
  return messages[code] ?? "処理できませんでした。写真を保持して再試行します。";
}
