"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Cloud, ExternalLink, LogOut, Smartphone, ShieldCheck, UserRound, ArrowRight } from "lucide-react";
import { useApp } from "./app-provider";
export function AccountScreen() {
  const { account, pendingCount } = useApp();
  const logout = () => { if (!pendingCount || window.confirm(`未送信の写真が${pendingCount}件あります。この端末に保持し、同じアカウントでログインすると再送します。ログアウトしますか？`)) void signOut({ callbackUrl: "/m/start" }); };
  return <section><div className="page-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>アカウントと接続</h1></div></div><p className="page-lead">保存先と、データの取り扱い。</p>
    <div className="card"><div className="card-title"><UserRound size={20} /><h2>Googleアカウント</h2></div>{account?.user ? <><strong>{account.user.name}</strong><p className="account-email">{account.user.email}</p></> : <><p>まだログインしていません。</p><Link className="button primary full" href="/m/start">接続をはじめる<ArrowRight size={17} /></Link></>}</div>
    <div className="card"><div className="card-title"><Cloud size={21} /><h2>Google Drive</h2><span className={`status-badge ${account?.drive?.status === "CONNECTED" ? "success" : ""}`}>{account?.drive?.status === "CONNECTED" ? "接続済み" : account?.drive ? "確認が必要" : "未接続"}</span></div><p>保存先</p><div className="folder-path">SJ レシートカメラ / 領収書 / 年 / 月</div><small className="muted">利用日が未確認のレシートは「日付未確認」に保存します。</small>{account?.drive?.folderUrl && <a className="text-link" href={account.drive.folderUrl} target="_blank" rel="noopener noreferrer">保存フォルダを開く<ExternalLink size={14} /></a>}{account?.user && <a className="button secondary full" href="/api/drive/connect">{account.drive ? "Google Driveを再接続" : "Google Driveを接続"}</a>}</div>
    <div className="card"><div className="card-title"><Smartphone size={20} /><h2>ホーム画面に追加</h2></div><p>Android Chromeのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。</p><small className="muted">iPhoneはSafariの共有メニューから追加できます。カメラの使用にはブラウザの許可が必要です。</small></div>
    <div className="card" id="privacy"><div className="card-title"><ShieldCheck size={20} /><h2>データの取り扱い</h2></div><p>写真は非公開のサーバーに送信し、Google Cloud Visionで文字を読み取ります。PDFはあなたのGoogle Driveに保存します。</p><p>テスト期間中、原本写真・読み取り結果は自動削除しません。未送信の写真はこの端末内に、アカウント別に一時保存します。</p><p>ブラウザのデータを削除すると、未送信の写真が失われる場合があります。受付完了を確認するまでは、画面を開いたままお待ちください。</p><p>編集・削除機能は準備中です。テストデータの削除は運営者に依頼してください。</p><small className="muted">このバージョンは招待されたテスト利用者向けです。</small></div>
    {account?.user && <button className="button secondary full logout-button" onClick={logout}><LogOut size={17} />ログアウト</button>}
    <p className="footnote">SJ レシートカメラ · テスト版 0.1</p>
  </section>;
}
