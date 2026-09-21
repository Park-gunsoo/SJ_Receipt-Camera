"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChevronDown, FileText, Plus, Save, Trash2, X } from "lucide-react";
import type { ReceiptView } from "@/lib/contracts";
import { editValues, toDraft, type Draft } from "@/lib/receipt-draft";
import { errorMessage } from "@/lib/messages";
import { formatYen } from "@/lib/i18n";
import { useApp } from "./app-provider";
import { useLanguage } from "./language-provider";
import { CategoryField } from "./category-field";

export function LedgerInlineEditor({ receipt, rowNumber, onDirty, onSaved, onCancel }: { receipt: ReceiptView; rowNumber: number; onDirty: (dirty: boolean) => void; onSaved: (receipt: ReceiptView) => void; onCancel: () => void }) {
  const { t, locale } = useLanguage();
  const { account, online } = useApp();
  const formId = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(receipt));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const request = useRef<AbortController | null>(null);
  const merchantInput = useRef<HTMLInputElement>(null);
  useEffect(() => { merchantInput.current?.focus(); return () => request.current?.abort(); }, []);
  const change = (update: Partial<Draft>) => { setDraft(old => ({ ...old, ...update })); setDirty(true); onDirty(true); setError(null); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || request.current || !account?.user || !online) return;
    const controller = new AbortController(); request.current = controller;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/receipts/${receipt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-SJ-Owner": account.user.id }, body: JSON.stringify({ version: receipt.version, values: editValues(draft) }), signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "SAVE_FAILED");
      if (!controller.signal.aborted) { onDirty(false); onSaved(body.receipt); }
    } catch (cause) { if (!controller.signal.aborted) { const code = cause instanceof Error && ["EDIT_CONFLICT", "INVALID_INPUT", "ACCOUNT_CHANGED", "UNAUTHORIZED", "NOT_FOUND", "ANALYSIS_PENDING"].includes(cause.message) ? cause.message : "SAVE_FAILED"; setError(code); if (code === "INVALID_INPUT") setDetails(true); } }
    finally { request.current = null; if (!controller.signal.aborted) setSaving(false); }
  };
  return <>
    <tr className="ledger-edit-row"><td className="ledger-row-number">{rowNumber}</td>
      <td><input form={formId} type="date" value={draft.transactionDate} disabled={saving} aria-label={t("利用日")} onChange={event => change({ transactionDate: event.target.value })} /></td>
      <td><input ref={merchantInput} form={formId} value={draft.merchant} maxLength={100} disabled={saving} aria-label={t("店舗名")} placeholder={t("店舗名")} onChange={event => change({ merchant: event.target.value })} /><textarea form={formId} value={draft.summary} maxLength={2000} rows={2} disabled={saving} aria-label={t("摘要")} placeholder={t("摘要")} onChange={event => change({ summary: event.target.value })} /></td>
      <td><CategoryField value={draft.category} onChange={category => change({ category })} compact form={formId} disabled={saving} /></td>
      <td className="amount-cell"><input form={formId} type="number" inputMode="numeric" min="0" max="999999999" step="1" value={draft.totalYen} disabled={saving} aria-label={`${t("合計金額")} (JPY)`} onChange={event => change({ totalYen: event.target.value })} /></td>
      <td className="amount-cell ledger-tax">{draft.taxes.map((tax, index) => <div key={index}><small>{tax.rate || "?"}%</small><span>{tax.taxYen.trim() && (!Number.isInteger(Number(tax.taxYen)) || Number(tax.taxYen) < 0 || Number(tax.taxYen) > 999999999) ? t("要確認") : formatYen(tax.taxYen.trim() ? Number(tax.taxYen) : null, locale)}</span></div>)}<button type="button" className="ledger-tax-edit" disabled={saving} aria-expanded={details} onClick={() => setDetails(value => !value)}>{t("税額を編集")}<ChevronDown size={13} /></button></td>
      <td><span className="ledger-state processing"><i />{t("編集中")}</span></td><td className="ledger-storage">{receipt.pdfState === "SAVED" || receipt.driveUrl ? <a href={`/api/receipts/${receipt.id}/pdf`} target="_blank" rel="noopener noreferrer" aria-label={t("PDFを見る")}><FileText size={15} />PDF</a> : <span className="ledger-inline-help">{t("保存すると一覧に反映されます")}</span>}</td>
      <td className="ledger-actions-cell"><div className="ledger-edit-actions"><button type="submit" form={formId} className="ledger-inline-save" disabled={!dirty || saving || !online}><Save size={15} />{t(saving ? "保存中…" : "保存")}</button><button type="button" className="ledger-inline-cancel" aria-label={t("編集をキャンセル")} disabled={saving} onClick={() => { onDirty(false); onCancel(); }}><X size={17} /></button></div></td>
    </tr>
    <tr className="ledger-edit-details"><td colSpan={9}><form id={formId} onSubmit={save} noValidate>
      {error && <div className="ledger-error" role="alert">{errorMessage(error, locale)}{["EDIT_CONFLICT", "NOT_FOUND"].includes(error) && <button type="button" disabled={saving} onClick={() => { onDirty(false); onCancel(); }}>{t("編集を取り消して最新の一覧へ")}</button>}</div>}
      <details open={details} onToggle={event => setDetails(event.currentTarget.open)}><summary>{t("税率・対象額・支払情報を編集")}</summary><fieldset disabled={saving}><div className="inline-extra-fields"><label>{t("支払方法")}<input value={draft.paymentMethod} maxLength={80} onChange={event => change({ paymentMethod: event.target.value })} /></label><label>{t("登録番号")}<input value={draft.registrationNumber} maxLength={14} placeholder="T1234567890123" pattern="[Tt][0-9]{13}" onChange={event => change({ registrationNumber: event.target.value })} /></label></div>
        <div className="inline-tax-editor">{draft.taxes.map((tax, index) => <div className="inline-tax-row" key={index}>{(["rate", "taxableYen", "taxYen"] as const).map(key => <label key={key}>{t(key === "rate" ? "税率" : key === "taxableYen" ? "対象額" : "税額")} {key === "rate" ? "(%)" : "(JPY)"}<input type="number" min="0" max={key === "rate" ? "100" : "999999999"} step={key === "rate" ? "0.1" : "1"} value={tax[key]} onChange={event => change({ taxes: draft.taxes.map((row, i) => i === index ? { ...row, [key]: event.target.value } : row) })} /></label>)}<button type="button" className="ledger-inline-cancel" aria-label={t("この税区分を削除")} onClick={() => change({ taxes: draft.taxes.filter((_, i) => i !== index) })}><Trash2 size={15} /></button></div>)}<button type="button" className="text-link" disabled={draft.taxes.length >= 8} onClick={() => change({ taxes: [...draft.taxes, { rate: "", taxableYen: "", taxYen: "" }] })}><Plus size={15} />{t("税区分を追加")}</button></div>
      </fieldset></details><p className="inline-save-note">{t("空欄は未確認として保存します。原本と読み取り結果は保持します。")}</p>
    </form></td></tr>
  </>;
}
