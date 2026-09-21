"use client";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { type Locale, languageNames } from "@/lib/i18n";
import { errorMessage } from "@/lib/messages";
import { useApp } from "./app-provider";
import { useLanguage } from "./language-provider";

export function ExcelDownload({ query, count, disabled, onDownloaded }: { query: string; count: number; disabled: boolean; onDownloaded: (count: number) => void }) {
  const { t, locale } = useLanguage();
  const { account, online } = useApp();
  const [open, setOpen] = useState(false);
  const [exportLocale, setExportLocale] = useState<Locale>(locale);
  const [scope, setScope] = useState<"filtered" | "all">("filtered");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const heading = useId();
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  useEffect(() => () => request.current?.abort(), []);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const download = async () => {
    if (!account?.user || request.current || !online) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/receipts/export", { method: "POST", headers: { "Content-Type": "application/json", "X-SJ-Owner": account.user.id }, body: JSON.stringify({ locale: exportLocale, scope, query }), signal: controller.signal });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? "EXPORT_FAILED"); }
      const blob = await response.blob(); if (controller.signal.aborted) return;
      const filename = response.headers.get("content-disposition")?.match(/filename="([A-Za-z0-9_.-]+)"/)?.[1] ?? `SJ_receipts_${exportLocale}.xlsx`;
      const actualCount = Number(response.headers.get("x-sj-receipt-count"));
      if (!blob.size || !Number.isSafeInteger(actualCount) || actualCount < 0) throw new Error("EXPORT_FAILED");
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      close(); onDownloaded(actualCount);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error && ["EXPORT_LIMIT", "EXPORT_FILE_LIMIT", "EXPORT_TEXT_LIMIT", "ACCOUNT_CHANGED", "UNAUTHORIZED"].includes(cause.message) ? cause.message : "EXPORT_FAILED"); }
    finally { request.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  return <><button ref={trigger} className="button ledger-export" disabled={disabled || !online || !account?.user} onClick={() => { setExportLocale(locale); setScope("filtered"); setError(null); setOpen(true); }}><Download size={16} />{t("Excelダウンロード")}</button>
    {open && createPortal(<dialog ref={dialog} className="trash-dialog export-dialog" aria-labelledby={heading} onCancel={event => { if (busy) event.preventDefault(); else close(); }}><div className="export-heading"><FileSpreadsheet size={24} /><h2 id={heading}>{t("Excelダウンロード")}</h2></div>
      <label>{t("ダウンロード言語")}<select value={exportLocale} disabled={busy} onChange={event => setExportLocale(event.target.value as Locale)}>{(["ja", "ko", "en"] as const).map(language => <option key={language} value={language}>{languageNames[language]}</option>)}</select></label>
      <fieldset disabled={busy}><legend>{t("ダウンロード範囲")}</legend><label className="export-scope"><input type="radio" name={heading} checked={scope === "filtered"} onChange={() => setScope("filtered")} /><span>{t("現在の検索結果すべて")}<small>{t("{count}件", { count })} · {t("全ページが対象です")}</small></span></label><label className="export-scope"><input type="radio" name={heading} checked={scope === "all"} onChange={() => setScope("all")} /><span>{t("すべてのレシート")}<small>{t("ゴミ箱のレシートは含みません")}</small></span></label></fieldset>
      <p className="export-help">{t("保存済みの内容を出力します。店舗名・摘要の原文は翻訳しません。")}</p><p className="export-help">{t("帳簿と税率別明細の2シートを作成します。")}</p>
      {error && <p className="notice caution" role="alert">{errorMessage(error, locale)}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={close}>{t("キャンセル")}</button><button type="button" className="button primary" disabled={busy || !online} onClick={download}><Download size={16} />{t(busy ? "ダウンロードを準備中…" : "ダウンロード")}</button></div>
    </dialog>, document.body)}</>;
}
