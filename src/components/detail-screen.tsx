"use client";
import { useLanguage } from "./language-provider";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, ZoomIn, X, Info } from "lucide-react";
import { Status, yen } from "./status";
import { displayText, formatPurchaseDate } from "@/lib/i18n";
import type { ReceiptView } from "@/lib/contracts";
import { errorMessage } from "@/lib/messages";
export function DetailScreen({ id }: { id: string }) {
  const { t, locale } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null); const [error, setError] = useState(false); const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => { try { const response = await fetch(`/api/receipts/${id}`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(); const data = await response.json(); if (!controller.signal.aborted) { setReceipt(data.receipt); setError(false); } } catch { if (!controller.signal.aborted) setError(true); } };
    void load(); const interval = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000); return () => { controller.abort(); clearInterval(interval); };
  }, [id]);
  if (error) return <div className="empty-state"><h1>{t("表示できませんでした")}</h1><p>{t("ログインと接続を確認してください。")}</p><Link className="button secondary" href="/m/receipts">{t("履歴に戻る")}</Link></div>;
  if (!receipt) return <p className="loading-state">{t("読み込んでいます…")}</p>;
  const values = receipt.values;
  const fields = [[t("店舗名"), values?.merchant], [t("利用日"), values?.transactionDate ? formatPurchaseDate(values.transactionDate, locale) : null], [t("合計金額"), yen(values?.totalYen ?? null, locale)], [t("税額・税率"), values?.taxes?.length ? values.taxes.map(tax => `${tax.rate ?? "?"}% · ${t("税額 {amount}", { amount: yen(tax.taxYen, locale) })}${tax.taxableYen !== null ? ` · ${t("対象 {amount}", { amount: yen(tax.taxableYen, locale) })}` : ""}`).join(" / ") : null], [t("支払方法"), values?.paymentMethod ? displayText(values.paymentMethod, locale) : null], [t("登録番号"), values?.registrationNumber], [t("勘定科目（候補）"), values?.category ? displayText(values.category, locale) : t("未分類")], [t("摘要"), values?.summary]];
  return <section><Link className="back-link" href="/m/receipts"><ArrowLeft size={18} />{t("履歴に戻る")}</Link><div className="page-heading"><div><p className="eyebrow">{t("RECEIPT DETAILS")}</p><h1>{t("レシート詳細")}</h1></div></div><Status receipt={receipt} />
    <button className="detail-image" onClick={() => setZoom(true)} aria-label={t("レシート画像を拡大")}><img src={`/api/receipts/${id}/image`} alt={t("撮影したレシートの原本")} /><span><ZoomIn size={16} />{t("タップして拡大")}</span></button>
    {receipt.pdfError && <p className="notice caution">{errorMessage(receipt.pdfError, locale)}</p>}
    {receipt.archiveError && <p className="notice caution">{errorMessage(receipt.archiveError, locale)}</p>}{receipt.ocrError && <p className="notice caution">{errorMessage(receipt.ocrError, locale)}</p>}
    <div className="card"><h2>{t("読み取り内容")}<span className="small-tag">{t(receipt.userEdited ? "修正済み" : "未確定")}</span></h2><dl className="detail-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={!value ? "unconfirmed" : ""}>{value || t("未確認")}</dd></div>)}</dl>{receipt.reviewReasons.length > 0 && <div className="review-reasons"><strong><Info size={15} />{t(receipt.userEdited ? "読み取り時に確認が必要だった項目" : "確認が必要な項目")}</strong><ul>{receipt.reviewReasons.map(reason => <li key={reason}>{displayText(reason, locale)}</li>)}</ul></div>}</div>
    <div className="two-actions">{(receipt.pdfState === "SAVED" || receipt.driveUrl) && <a className="button secondary" href={`/api/receipts/${id}/pdf`} target="_blank" rel="noopener noreferrer"><FileText size={17} />{t("PDFを見る")}</a>}{receipt.driveUrl && <a className="button secondary" href={receipt.driveUrl} target="_blank" rel="noopener noreferrer">{t("Driveで開く")}<ExternalLink size={16} /></a>}</div><div className="card web-edit-link"><p>{t("PCのウェブ画面で内容を修正できます。")}</p><Link className="button primary full" href={`/web/receipts/${id}`}>{t("ウェブで修正する")}<ExternalLink size={16} /></Link><button className="text-link" onClick={async () => { try { await navigator.clipboard.writeText(new URL(`/web/receipts/${id}`, location.origin).href); setCopied(true); setCopyError(false); } catch { setCopied(false); setCopyError(true); } }}>{t(copied ? "リンクをコピーしました" : "リンクをコピー")}</button>{copyError && <p role="alert">{t("リンクをコピーできませんでした。リンクを長押ししてコピーしてください。")}</p>}</div><p className="footnote">{t("この画面を見るだけでは、確認完了にはなりません。")}</p>
    {zoom && <div className="image-modal" role="dialog" aria-modal="true" aria-label={t("レシート画像の拡大")} onKeyDown={e => { if (e.key === "Escape") setZoom(false); }}><button className="icon-button" onClick={() => setZoom(false)} aria-label={t("拡大画像を閉じる")} autoFocus><X /></button><img src={`/api/receipts/${id}/image`} alt={t("レシート原本・ブラウザの拡大操作で確認できます")} /></div>}
  </section>;
}
