"use client";
import { useState } from "react";
import { useLanguage } from "./language-provider";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Cloud, ExternalLink, FileText, LogOut, Smartphone, ShieldCheck, UserRound, ArrowRight } from "lucide-react";
import { useApp } from "./app-provider";
import { errorMessage } from "@/lib/messages";
export function AccountScreen() {
  const { t, locale } = useLanguage();
  const { account, pendingCount, refresh } = useApp();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setBackup = async (backupEnabled: boolean) => {
    if (!account?.user || saving) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/drive/settings", { method: "PATCH", headers: { "Content-Type": "application/json", "X-SJ-Owner": account.user.id }, body: JSON.stringify({ backupEnabled }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "SAVE_FAILED");
      await refresh();
    } catch (e) { setError(e instanceof Error && ["UNAUTHORIZED", "ACCOUNT_CHANGED", "DRIVE_RECONNECT"].includes(e.message) ? e.message : "SETTINGS_FAILED"); }
    finally { setSaving(false); }
  };
  const logout = () => { if (!pendingCount || window.confirm(t("未送信の写真が{count}件あります。この端末に保持し、同じアカウントでログインすると再送します。ログアウトしますか？", { count: pendingCount }))) void signOut({ callbackUrl: "/m/start" }); };
  return <section><div className="page-heading"><div><p className="eyebrow">{t("YOUR ACCOUNT")}</p><h1>{t("アカウントと接続")}</h1></div></div><p className="page-lead">{t("保存先と、データの取り扱い。")}</p>
    <div className="card"><div className="card-title"><UserRound size={20} /><h2>{t("Googleアカウント")}</h2></div>{account?.user ? <><strong>{account.user.name}</strong><p className="account-email">{account.user.email}</p></> : <><p>{t("まだログインしていません。")}</p><Link className="button primary full" href="/m/start">{t("接続をはじめる")}<ArrowRight size={17} /></Link></>}</div>
    <div className="card"><div className="card-title"><FileText size={20} /><h2>{t("アプリ内保存")}</h2></div><p>{t("写真とPDFは、このアプリの非公開ストレージに保存します。")}</p><small className="muted">{t("Driveを接続しなくても、撮影・分析・PDFの閲覧を利用できます。")}</small></div>
    <div className="card"><div className="card-title"><Cloud size={21} /><h2>{t("Driveバックアップ（任意）")}</h2><span className={`status-badge ${account?.drive?.status === "CONNECTED" ? "success" : ""}`}>{account?.drive?.status === "CONNECTED" ? t("接続済み") : account?.drive ? t("確認が必要") : t("未接続")}</span></div>
      {account?.drive && <><label className="backup-toggle"><input type="checkbox" role="switch" checked={account.drive.backupEnabled} disabled={saving} onChange={e => void setBackup(e.target.checked)} /><span>{t("新しいレシートをDriveに自動バックアップ")}<small>{t(account.drive.backupEnabled ? "自動バックアップ ON" : "自動バックアップ OFF")}</small></span></label>{saving && <p role="status">{t("保存中…")}</p>}</>}
      <p>{t("設定はこれから受け付けるレシートに適用します。既存のDriveファイルはそのまま残ります。")}</p>
      {error && <p className="notice caution" role="alert">{errorMessage(error, locale)}</p>}
      {account?.drive?.folderUrl && <><div className="folder-path">{t("SJ レシートカメラ / 領収書 / 年 / 月")}</div><small className="muted">{t("利用日が未確認のレシートは「日付未確認」に保存します。")}</small><a className="text-link" href={account.drive.folderUrl} target="_blank" rel="noopener noreferrer">{t("保存フォルダを開く")}<ExternalLink size={14} /></a></>}
      {account?.user && <a className="button secondary full" href="/api/drive/connect">{account.drive ? t("Google Driveを再接続") : t("Google Driveを接続")}</a>}
    </div>
    <div className="card"><div className="card-title"><Smartphone size={20} /><h2>{t("ホーム画面に追加")}</h2></div><p>{t("Android Chromeのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。")}</p><small className="muted">{t("iPhoneはSafariの共有メニューから追加できます。カメラの使用にはブラウザの許可が必要です。")}</small></div>
    <div className="card" id="privacy"><div className="card-title"><ShieldCheck size={20} /><h2>{t("データの取り扱い")}</h2></div><p>{t("写真とPDFは非公開で保管し、文字の読み取りにGoogle Cloud Visionを使用します。Driveへのコピーは、バックアップを選んだ場合だけ行います。")}</p><p>{t("テスト期間中、原本写真・PDF・読み取り結果は自動削除しません。未送信の写真はこの端末内に、アカウント別に一時保存します。")}</p><p>{t("ブラウザのデータを削除すると、未送信の写真が失われる場合があります。受付完了を確認するまでは、画面を開いたままお待ちください。")}</p><p>{t("編集はウェブ管理画面で行えます。データの削除は運営者に依頼してください。")}</p><small className="muted">{t("このバージョンは招待されたテスト利用者向けです。")}</small></div>
    <Link className="button primary full" href="/web/receipts">{t("ウェブ管理画面")}<ArrowRight size={17} /></Link>
    {account?.user && <button className="button secondary full logout-button" onClick={logout}><LogOut size={17} />{t("ログアウト")}</button>}
    <p className="footnote">{t("SJ レシートカメラ · テスト版 0.1")}</p>
  </section>;
}
