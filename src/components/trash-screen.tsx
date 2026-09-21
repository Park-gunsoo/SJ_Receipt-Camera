"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, RotateCcw } from "lucide-react";
import type { TrashedReceiptView } from "@/lib/contracts";
import { formatPurchaseDate, formatYen, localeTags } from "@/lib/i18n";
import { errorMessage } from "@/lib/messages";
import { useApp } from "./app-provider";
import { useLanguage } from "./language-provider";
import { Shiba } from "./shiba";

export function TrashScreen() {
  const { t, locale } = useLanguage();
  const { account, online } = useApp();
  const ownerId = account?.user?.id;
  const [receipts, setReceipts] = useState<TrashedReceiptView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const loadRequest = useRef<AbortController | null>(null);
  const restoreRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (next?: string) => {
    if (!ownerId) return;
    loadRequest.current?.abort();
    const controller = new AbortController(); loadRequest.current = controller;
    const current = ++generation.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/receipts/trash${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (controller.signal.aborted || current !== generation.current) return;
      setReceipts(old => next ? [...old, ...data.receipts] : data.receipts); setCursor(data.nextCursor); setLoadError(false);
    } catch { if (!controller.signal.aborted) setLoadError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [ownerId]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    // A focus refresh keeps cross-tab changes visible without resetting pagination periodically.
    const focus = () => { if (!restoreRequest.current) void load(); };
    window.addEventListener("focus", focus);
    return () => { active = false; window.removeEventListener("focus", focus); loadRequest.current?.abort(); restoreRequest.current?.abort(); };
  }, [load]);
  const restore = async (receipt: TrashedReceiptView) => {
    if (!ownerId || restoreRequest.current) return;
    loadRequest.current?.abort(); generation.current++;
    const controller = new AbortController(); restoreRequest.current = controller;
    setRestoring(receipt.id); setRestoreError(null); setRestored(null);
    try {
      const response = await fetch(`/api/receipts/${receipt.id}/restore`, { method: "POST", headers: { "Content-Type": "application/json", "X-SJ-Owner": ownerId }, body: JSON.stringify({ version: receipt.version }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "RESTORE_FAILED");
      if (!controller.signal.aborted) { setReceipts(old => old.filter(row => row.id !== receipt.id)); setRestored(receipt.id); }
    } catch (cause) {
      if (!controller.signal.aborted) setRestoreError(cause instanceof Error && ["RECEIPT_CHANGED", "NOT_FOUND", "ACCOUNT_CHANGED", "UNAUTHORIZED"].includes(cause.message) ? cause.message : "RESTORE_FAILED");
    } finally {
      restoreRequest.current = null;
      if (!controller.signal.aborted) { setRestoring(null); void load(); }
    }
  };
  if (!account) return <p className="loading-state">{t("読み込んでいます…")}</p>;
  if (!account.user) return <section className="card"><h1>{t("ゴミ箱")}</h1><p>{t("まだログインしていません。")}</p><button className="button primary" disabled={!account.loginReady} onClick={() => signIn("google", { callbackUrl: "/web/trash" })}>{t("Googleでログイン")}</button></section>;
  return <section className="web-receipt-list"><div className="page-heading"><div><p className="eyebrow">{t("YOUR RECEIPTS")}</p><h1>{t("ゴミ箱")}</h1></div><button className="icon-button" aria-label={t("ゴミ箱を更新")} disabled={loading || Boolean(restoring)} onClick={() => load()}><RefreshCw size={20} /></button></div>
    <p className="page-lead">{t("削除したレシートを復元できます。原本写真・PDF・Driveファイルはそのまま保管しています。")}</p>
    <p className="notice">{t("ゴミ箱のレシートは自動削除されません。内容を見るには先に復元してください。")}</p>
    {restored && <div className="notice" role="status">{t("復元しました")} <Link className="text-link" href={`/web/receipts/${restored}`}>{t("復元したレシートを開く")}</Link></div>}
    {restoreError && <p className="notice caution" role="alert">{errorMessage(restoreError, locale)}</p>}
    {loadError ? <div className="empty-state"><h2>{t("履歴を取得できませんでした")}</h2><button className="button secondary" onClick={() => load()}>{t("再読み込み")}</button></div> : loading && !receipts.length ? <p className="loading-state" role="status">{t("読み込んでいます…")}</p> : !receipts.length ? <div className="empty-state"><Shiba variant="history" className="empty-shiba" sizes="172px" /><h2>{t("ゴミ箱は空です")}</h2><Link className="button secondary" href="/web/receipts">{t("履歴に戻る")}</Link></div> : <div className="receipt-list">{receipts.map(receipt => <article className="trash-row" key={receipt.id}><FileText size={24} aria-hidden="true" /><div className="receipt-row-body"><div className="receipt-row-title"><strong>{receipt.merchant ?? t("店舗名 未確認")}</strong><b>{formatYen(receipt.totalYen, locale)}</b></div><p>{receipt.transactionDate ? t("利用日 {date}", { date: formatPurchaseDate(receipt.transactionDate, locale) }) : t("利用日 未確認")}</p><small>{t("削除日時 {date}", { date: new Date(receipt.deletedAt).toLocaleString(localeTags[locale], { timeZone: "Asia/Tokyo" }) })} (JST)</small></div><button className="button secondary" disabled={!online || Boolean(restoring)} onClick={() => restore(receipt)}><RotateCcw size={16} />{t(restoring === receipt.id ? "復元中…" : "復元")}</button></article>)}{cursor && <button className="button secondary full" disabled={loading || Boolean(restoring)} onClick={() => load(cursor)}>{t("もっと見る")}</button>}</div>}
  </section>;
}
