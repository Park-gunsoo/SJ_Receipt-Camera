"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Search, Camera, ChevronRight, RefreshCw, CalendarDays } from "lucide-react";
import { useApp } from "./app-provider";
import { Shiba } from "./shiba";
import { Status, yen } from "./status";
import type { ReceiptView } from "@/lib/contracts";
export function HistoryScreen() {
  const { account, pendingCount } = useApp();
  const [receipts, setReceipts] = useState<ReceiptView[]>([]);
  const [q, setQ] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState(false); const [loading, setLoading] = useState(true);
  const load = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    if (!account?.user) { setLoading(false); setReceipts([]); return; }
    const params = new URLSearchParams({ q, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(cursor ? { cursor } : {}) });
    try {
      const response = await fetch(`/api/receipts?${params}`, { cache: "no-store", signal }); if (!response.ok) throw new Error();
      const data = await response.json(); if (signal?.aborted) return;
      setReceipts(old => cursor ? [...old, ...data.receipts] : data.receipts); setNextCursor(data.nextCursor); setError(false);
    } catch { if (!signal?.aborted) setError(true); } finally { if (!signal?.aborted) setLoading(false); }
  }, [account?.user, q, from, to]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { setLoading(true); void load(undefined, controller.signal); }, 250);
    const interval = setInterval(() => { if (document.visibilityState === "visible") void load(undefined, controller.signal); }, 10000);
    return () => { controller.abort(); clearTimeout(timeout); clearInterval(interval); };
  }, [load]);
  return <section><div className="page-heading"><div><p className="eyebrow">YOUR RECEIPTS</p><h1>撮影履歴</h1></div><button className="icon-button" aria-label="履歴を更新" onClick={() => load()}><RefreshCw size={20} /></button></div><p className="page-lead">撮ったレシートを、いつでも確認。</p>
    <label className="search-field"><Search size={19} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="店舗名で検索" aria-label="店舗名で検索" /></label>
    <details className="date-filter"><summary><CalendarDays size={16} />期間を選択 <small>利用日</small></summary><div><label>開始日<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>終了日<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div><small>利用日が未確認のレシートは、期間指定を解除すると表示されます。</small></details>
    {pendingCount > 0 && <div className="notice">端末に未送信の写真が{pendingCount}件あります。接続後に再送します。</div>}
    {!account?.user && account ? <div className="empty-state"><Shiba variant="history" className="empty-shiba" sizes="172px" /><h2>レシートの保管場所</h2><p>Googleを接続すると、撮影したレシートが<br />ここに並びます。</p><Link className="button primary" href="/m/start">接続してはじめる<ArrowRight size={17} /></Link></div> : loading && !receipts.length ? <div className="loading-state" role="status">履歴を読み込んでいます…</div> : error ? <div className="empty-state"><h2>履歴を取得できませんでした</h2><p>接続を確認して、もう一度お試しください。</p><button className="button secondary" onClick={() => load()}>再読み込み</button></div> : !receipts.length ? <div className="empty-state"><Shiba variant="history" className="empty-shiba" sizes="172px" /><h2>{q || from || to ? "一致するレシートがありません" : "最初の1枚を撮ってみましょう"}</h2><p>{q || from || to ? "検索条件を変更してください。" : "撮影すると、自動でここに記録されます。"}</p><Link className="button primary" href="/m/capture"><Camera size={18} />撮影する</Link></div> : <div className="receipt-list">{receipts.map((receipt, index) => { const day = new Date(receipt.createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" }); const previous = index ? new Date(receipts[index - 1].createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" }) : null; return <div key={receipt.id}>{day !== previous && <h2 className="date-group">{day}<small>受付日</small></h2>}<Link className="receipt-row" href={`/m/receipts/${receipt.id}`}><img src={`/api/receipts/${receipt.id}/image?thumbnail=1`} alt="レシートのサムネイル" loading="lazy" width={54} height={72} /><div className="receipt-row-body"><div className="receipt-row-title"><strong>{receipt.merchant ?? "店舗名 未確認"}</strong><b>{yen(receipt.totalYen)}</b></div><p>{receipt.transactionDate ? `利用日 ${receipt.transactionDate}` : "利用日 未確認"}</p><Status receipt={receipt} /></div><ChevronRight size={17} /></Link></div>; })}{nextCursor && <button className="button secondary full" onClick={() => load(nextCursor)}>もっと見る</button>}</div>}
  </section>;
}
