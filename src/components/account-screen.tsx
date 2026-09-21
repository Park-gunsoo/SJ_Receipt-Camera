"use client";
import { useLanguage } from "./language-provider";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Cloud, ExternalLink, LogOut, Smartphone, ShieldCheck, UserRound, ArrowRight } from "lucide-react";
import { useApp } from "./app-provider";
export function AccountScreen() {
  const { t } = useLanguage();
  const { account, pendingCount } = useApp();
  const logout = () => { if (!pendingCount || window.confirm(t("未送信の写真が{count}件あります。この端末に保持し、同じアカウントでログインすると再送します。ログアウトしますか？", { count: pendingCount }))) void signOut({ callbackUrl: "/m/start" }); };
  return <section><div className="page-heading"><div><p className="eyebrow">{t("YOUR ACCOUNT")}</p><h1>{t("アカウントと接続")}</h1></div></div><p className="page-lead">{t("保存先と、データの取り扱い。")}</p>
    <div className="card"><div className="card-title"><UserRound size={20} /><h2>{t("Googleアカウント")}</h2></div>{account?.user ? <><strong>{account.user.name}</strong><p className="account-email">{account.user.email}</p></> : <><p>{t("まだログインしていません。")}</p><Link className="button primary full" href="/m/start">{t("接続をはじめる")}<ArrowRight size={17} /></Link></>}</div>
    <div className="card"><div className="card-title"><Cloud size={21} /><h2>Google Drive</h2><span className={`status-badge ${account?.drive?.status === "CONNECTED" ? "success" : ""}`}>{account?.drive?.status === "CONNECTED" ? t("接続済み") : account?.drive ? t("確認が必要") : t("未接続")}</span></div><p>{t("保存先")}</p><div className="folder-path">{t("SJ レシートカメラ / 領収書 / 年 / 月")}</div><small className="muted">{t("利用日が未確認のレシートは「日付未確認」に保存します。")}</small>{account?.drive?.folderUrl && <a className="text-link" href={account.drive.folderUrl} target="_blank" rel="noopener noreferrer">{t("保存フォルダを開く")}<ExternalLink size={14} /></a>}{account?.user && <a className="button secondary full" href="/api/drive/connect">{account.drive ? t("Google Driveを再接続") : t("Google Driveを接続")}</a>}</div>
    <div className="card"><div className="card-title"><Smartphone size={20} /><h2>{t("ホーム画面に追加")}</h2></div><p>{t("Android Chromeのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。")}</p><small className="muted">{t("iPhoneはSafariの共有メニューから追加できます。カメラの使用にはブラウザの許可が必要です。")}</small></div>
    <div className="card" id="privacy"><div className="card-title"><ShieldCheck size={20} /><h2>{t("データの取り扱い")}</h2></div><p>{t("写真は非公開のサーバーに送信し、Google Cloud Visionで文字を読み取ります。PDFはあなたのGoogle Driveに保存します。")}</p><p>{t("テスト期間中、原本写真・読み取り結果は自動削除しません。未送信の写真はこの端末内に、アカウント別に一時保存します。")}</p><p>{t("ブラウザのデータを削除すると、未送信の写真が失われる場合があります。受付完了を確認するまでは、画面を開いたままお待ちください。")}</p><p>{t("編集はウェブ管理画面で行えます。データの削除は運営者に依頼してください。")}</p><small className="muted">{t("このバージョンは招待されたテスト利用者向けです。")}</small></div>
    <Link className="button primary full" href="/web/receipts">{t("ウェブ管理画面")}<ArrowRight size={17} /></Link>
    {account?.user && <button className="button secondary full logout-button" onClick={logout}><LogOut size={17} />{t("ログアウト")}</button>}
    <p className="footnote">{t("SJ レシートカメラ · テスト版 0.1")}</p>
  </section>;
}
