"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, Camera, Check, Cloud, FileText, LogIn, LockKeyhole } from "lucide-react";
import { useApp } from "./app-provider";
import { Shiba } from "./shiba";
export function StartScreen() {
  const { account, accountError } = useApp();
  return <section className="start-page">
    <span className="intro-tag">毎日のレシートに、小さなお手伝い。</span>
    <div className="intro-illustration"><Shiba className="hero-shiba" sizes="240px" preload /></div>
    <h1>撮るだけ。<br />保存も整理も、自動で。</h1><p className="intro-description">レシートを撮ったら、あとはおまかせ。<br />あなたのGoogle Driveに、きちんと保存。</p>
    <div className="intro-steps"><span><Camera size={20} />撮る</span><ArrowRight size={16} /><span><FileText size={20} />読み取る</span><ArrowRight size={16} /><span><Cloud size={20} />保存する</span></div>
    <div className="card connection-card"><h2>はじめに、Googleと接続</h2><p>ログインの後に、保存先のDriveを接続します。</p><div className="connection-step"><span className="step-number">{account?.user ? <Check size={16} /> : "1"}</span><div><strong>Googleでログイン</strong><small>{account?.user?.email ?? "あなたのアカウントで安全に利用"}</small></div></div>
      {!account?.user && <button className="button primary full" disabled={!account?.loginReady || accountError} onClick={() => signIn("google", { callbackUrl: "/m/start" })}><LogIn size={18} />Googleでログイン<ArrowRight size={17} /></button>}
      <div className="connection-step"><span className="step-number">{account?.drive?.status === "CONNECTED" ? <Check size={16} /> : "2"}</span><div><strong>Google Driveを接続</strong><small>このアプリが作成するファイルだけにアクセス</small></div></div>
      {account?.user && (account.drive?.status === "CONNECTED" ? <Link className="button primary full" href="/m/capture">撮影をはじめる<ArrowRight size={18} /></Link> : <a className="button primary full" href="/api/drive/connect"><Cloud size={18} />Driveを接続する</a>)}
      {account && !account.configured && <p className="notice setup-notice">ただいま接続の準備中です。画面は確認できますが、写真の送信・保存はまだ利用できません。</p>}
    </div><p className="privacy-hint"><LockKeyhole size={13} />写真は非公開で保存されます。<Link href="/m/account#privacy">データの取り扱い</Link></p><Link className="text-link preview-link" href="/m/capture">撮影画面を見る<ArrowRight size={15} /></Link>
  </section>;
}
