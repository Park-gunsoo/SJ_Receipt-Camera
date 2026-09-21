"use client";
import { useLanguage } from "./language-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, History, UserRound, WifiOff, ArrowUpRight } from "lucide-react";
import { useApp } from "./app-provider";
import { Shiba } from "./shiba";
import { LanguagePicker } from "./language-picker";

export function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const path = usePathname();
  const { online, account, accountError } = useApp();
  return <div className="app-frame">
    <aside className="desktop-note"><span className="desktop-dot" />{t("毎日のレシートを、もっとかんたんに。")}</aside>
    <header className="app-header"><Link href="/m/capture" className="brand" aria-label={t("SJ レシートカメラ 撮影へ")}><span className="brand-mark"><Shiba variant="icon" sizes="44px" decorative /></span><span><strong>SJ <span>{t("レシートカメラ")}</span></strong><small>{t("撮るだけ。保存も整理も自動で。")}</small></span></Link><div className="header-actions"><LanguagePicker /><Link className={`icon-button ${path === "/m/account" ? "active" : ""}`} href="/m/account" aria-label={t("アカウントと接続")}><UserRound size={21} /></Link></div></header>
    {!online && <div className="connection-banner" role="status"><WifiOff size={16} />{t("オフライン・未送信の写真は接続後に再送します")}</div>}
    {accountError && <div className="connection-banner warning" role="alert">{t("接続状態を確認できません。もう一度開いてください。")}</div>}
    {account && !account.configured && path !== "/m/start" && <Link href="/m/start" className="setup-banner">{t("接続前プレビュー・写真の送信はまだできません")}<ArrowUpRight size={15} /></Link>}
    <main className="main-content" key={account?.user?.id ?? "guest"}>{children}</main>
    <nav className="bottom-nav" aria-label={t("メインメニュー")}><Link href="/m/capture" aria-current={path === "/m/capture" ? "page" : undefined}><Camera size={23} /><span>{t("撮影")}</span></Link><Link href="/m/receipts" aria-current={path.startsWith("/m/receipts") ? "page" : undefined}><History size={23} /><span>{t("履歴")}</span></Link></nav>
  </div>;
}
