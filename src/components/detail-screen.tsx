"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, ZoomIn, X, Info } from "lucide-react";
import { Status, yen } from "./status";
import type { ReceiptView } from "@/lib/contracts";
import { errorMessage } from "@/lib/messages";
export function DetailScreen({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<ReceiptView | null>(null); const [error, setError] = useState(false); const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => { try { const response = await fetch(`/api/receipts/${id}`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(); const data = await response.json(); if (!controller.signal.aborted) { setReceipt(data.receipt); setError(false); } } catch { if (!controller.signal.aborted) setError(true); } };
    void load(); const interval = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000); return () => { controller.abort(); clearInterval(interval); };
  }, [id]);
  if (error) return <div className="empty-state"><h1>表示できませんでした</h1><p>ログインと接続を確認してください。</p><Link className="button secondary" href="/m/receipts">履歴に戻る</Link></div>;
  if (!receipt) return <p className="loading-state">読み込んでいます…</p>;
  const values = receipt.values;
  const fields = [["店舗名", values?.merchant], ["利用日", values?.transactionDate], ["合計金額", yen(values?.totalYen ?? null)], ["税額・税率", values?.taxes?.length ? values.taxes.map(t => `${t.rate ?? "?"}%・税額 ${yen(t.taxYen)}${t.taxableYen !== null ? `・対象 ${yen(t.taxableYen)}` : ""}`).join(" / ") : null], ["支払方法", values?.paymentMethod], ["登録番号", values?.registrationNumber], ["勘定科目（候補）", values?.category ?? "未分類"], ["摘要", values?.summary]];
  return <section><Link className="back-link" href="/m/receipts"><ArrowLeft size={18} />履歴に戻る</Link><div className="page-heading"><div><p className="eyebrow">RECEIPT DETAILS</p><h1>レシート詳細</h1></div></div><Status receipt={receipt} />
    <button className="detail-image" onClick={() => setZoom(true)} aria-label="レシート画像を拡大"><img src={`/api/receipts/${id}/image`} alt="撮影したレシートの原本" /><span><ZoomIn size={16} />タップして拡大</span></button>
    {receipt.archiveError && <p className="notice caution">{errorMessage(receipt.archiveError)}</p>}{receipt.ocrError && <p className="notice caution">{errorMessage(receipt.ocrError)}</p>}
    <div className="card"><h2>読み取り内容<span className="small-tag">未確定</span></h2><dl className="detail-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={!value ? "unconfirmed" : ""}>{value || "未確認"}</dd></div>)}</dl>{receipt.reviewReasons.length > 0 && <div className="review-reasons"><strong><Info size={15} />確認が必要な項目</strong><ul>{receipt.reviewReasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}</div>
    <div className="two-actions">{receipt.archiveState === "SAVED" && <a className="button secondary" href={`/api/receipts/${id}/pdf`} target="_blank" rel="noopener noreferrer"><FileText size={17} />PDFを見る</a>}{receipt.driveUrl && <a className="button secondary" href={receipt.driveUrl} target="_blank" rel="noopener noreferrer">Driveで開く<ExternalLink size={16} /></a>}</div><p className="footnote">内容の編集機能は準備中です。<br />この画面を見るだけでは、確認完了にはなりません。</p>
    {zoom && <div className="image-modal" role="dialog" aria-modal="true" aria-label="レシート画像の拡大" onKeyDown={e => { if (e.key === "Escape") setZoom(false); }}><button className="icon-button" onClick={() => setZoom(false)} aria-label="拡大画像を閉じる" autoFocus><X /></button><img src={`/api/receipts/${id}/image`} alt="レシート原本・ブラウザの拡大操作で確認できます" /></div>}
  </section>;
}
