"use client";
import { useLanguage } from "./language-provider";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, Camera, Check, Cloud, FileText, LogIn, LockKeyhole } from "lucide-react";
import { useApp } from "./app-provider";
import { Shiba } from "./shiba";
export function StartScreen() {
  const { t } = useLanguage();
  const { account, accountError } = useApp();
  return <section className="start-page">
    <span className="intro-tag">{t("毎日のレシートに、小さなお手伝い。")}</span>
    <div className="intro-illustration"><Shiba className="hero-shiba" sizes="240px" preload /></div>
    <h1>{t("撮るだけ。")}<br />{t("保存も整理も、自動で。")}</h1><p className="intro-description">{t("レシートを撮ったら、あとはおまかせ。")}<br />{t("写真とPDFは、このアプリの非公開ストレージに保存します。")}</p>
    <div className="intro-steps"><span><Camera size={20} />{t("撮る")}</span><ArrowRight size={16} /><span><FileText size={20} />{t("読み取る")}</span><ArrowRight size={16} /><span><Cloud size={20} />{t("保存する")}</span></div>
    <div className="card connection-card"><h2>{t("はじめに、Googleと接続")}</h2><p>{t("Googleにログインするだけで、撮影・保存・閲覧ができます。")}</p><div className="connection-step"><span className="step-number">{account?.user ? <Check size={16} /> : "1"}</span><div><strong>{t("Googleでログイン")}</strong><small>{account?.user?.email ?? t("あなたのアカウントで安全に利用")}</small></div></div>
      {!account?.user && <button className="button primary full" disabled={!account?.loginReady || accountError} onClick={() => signIn("google", { callbackUrl: "/m/start" })}><LogIn size={18} />{t("Googleでログイン")}<ArrowRight size={17} /></button>}
      {account?.user && account.configured && <Link className="button primary full" href="/m/capture">{t("撮影をはじめる")}<ArrowRight size={18} /></Link>}
      <div className="connection-step"><span className="step-number"><Cloud size={16} /></span><div><strong>{t("Driveバックアップ（任意）")}</strong><small>{t("Driveを接続しなくても、撮影・分析・PDFの閲覧を利用できます。")}</small></div></div>
      {account?.user && <Link className="text-link" href="/m/account">{t("Driveのバックアップ設定")}<ArrowRight size={15} /></Link>}
      {account && !account.configured && <p className="notice setup-notice">{t("ただいま接続の準備中です。画面は確認できますが、写真の送信・保存はまだ利用できません。")}</p>}
    </div><p className="privacy-hint"><LockKeyhole size={13} />{t("写真は非公開で保存されます。")}<Link href="/m/account#privacy">{t("データの取り扱い")}</Link></p><Link className="text-link preview-link" href="/m/capture">{t("撮影画面を見る")}<ArrowRight size={15} /></Link>
  </section>;
}
