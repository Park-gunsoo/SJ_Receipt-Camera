"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ReceiptView } from "@/lib/contracts";
import { formatPurchaseDate, formatYen } from "@/lib/i18n";
import { errorMessage } from "@/lib/messages";
import { useApp } from "./app-provider";
import { useLanguage } from "./language-provider";

type ReceiptSummary = Pick<ReceiptView, "id" | "version" | "merchant" | "totalYen" | "transactionDate">;
export function ReceiptTrashButton({ receipt, disabled, unsaved = false, onDeleted }: { receipt: ReceiptSummary; disabled?: boolean; unsaved?: boolean; onDeleted: () => void }) {
  const { t, locale } = useLanguage();
  const { account, online } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const headingId = useId(), descriptionId = useId();
  const [selected, setSelected] = useState<ReceiptSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (selected) dialog.current?.showModal(); else dialog.current?.close(); }, [selected]);
  useEffect(() => () => request.current?.abort(), []);
  const remove = async () => {
    if (!selected || !account?.user || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/receipts/${selected.id}`, { method: "DELETE", headers: { "Content-Type": "application/json", "X-SJ-Owner": account.user.id }, body: JSON.stringify({ version: selected.version }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "TRASH_FAILED");
      if (!controller.signal.aborted) { setSelected(null); onDeleted(); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && ["RECEIPT_CHANGED", "NOT_FOUND", "ACCOUNT_CHANGED", "UNAUTHORIZED"].includes(cause.message) ? cause.message : "TRASH_FAILED");
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  return <>
    <button className="button trash-button" type="button" disabled={disabled || !online || !account?.user} onClick={() => { setError(null); setSelected({ ...receipt }); }}><Trash2 size={16} />{t("削除")}</button>
    <dialog ref={dialog} className="trash-dialog" aria-labelledby={headingId} aria-describedby={descriptionId} onCancel={event => { if (busy) event.preventDefault(); else setSelected(null); }}>
      <h2 id={headingId}>{t("ゴミ箱に移動しますか？")}</h2>
      {selected && <p className="trash-receipt-summary"><strong>{selected.merchant ?? t("店舗名 未確認")}</strong><span>{formatYen(selected.totalYen, locale)} · {selected.transactionDate ? formatPurchaseDate(selected.transactionDate, locale) : t("利用日 未確認")}</span></p>}
      <p id={descriptionId}>{t("通常の一覧から非表示になります。原本写真・PDF・Driveファイルは保管し、ゴミ箱から復元できます。")}</p>
      {unsaved && <p className="notice caution">{t("未保存の入力内容は破棄されます。")}</p>}
      {error && <p className="notice caution" role="alert">{errorMessage(error, locale)}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setSelected(null)} autoFocus>{t("キャンセル")}</button><button type="button" className="button danger" disabled={busy || !online} onClick={remove}>{t(busy ? "移動中…" : "ゴミ箱に移動")}</button></div>
    </dialog>
  </>;
}
