"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, ExternalLink, FileText, Minus, Plus, Save, Trash2 } from "lucide-react";
import type { ReceiptView } from "@/lib/contracts";
import type { ReceiptEdit } from "@/lib/receipt-editor";
import { errorMessage } from "@/lib/messages";
import { displayText } from "@/lib/i18n";
import { useApp } from "./app-provider";
import { useLanguage } from "./language-provider";
import { Status } from "./status";
import { ReceiptTrashButton } from "./receipt-trash-button";
import { CategoryField } from "./category-field";

type TaxDraft = { rate: string; taxableYen: string; taxYen: string };
type Draft = { merchant: string; transactionDate: string; totalYen: string; paymentMethod: string; registrationNumber: string; category: string; summary: string; taxes: TaxDraft[] };
const numberText = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);
function toDraft(receipt: ReceiptView): Draft {
  const v = receipt.values;
  return { merchant: v?.merchant ?? receipt.merchant ?? "", transactionDate: v?.transactionDate ?? receipt.transactionDate ?? "", totalYen: numberText(v?.totalYen ?? receipt.totalYen), paymentMethod: v?.paymentMethod ?? "", registrationNumber: v?.registrationNumber ?? "", category: v?.category ?? "", summary: v?.summary ?? "", taxes: (v?.taxes ?? []).map(tax => ({ rate: numberText(tax.rate), taxableYen: numberText(tax.taxableYen), taxYen: numberText(tax.taxYen) })) };
}
function numberValue(value: string, rate = false) {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > (rate ? 100 : 999999999) || !rate && !Number.isInteger(number)) throw new Error("INVALID_INPUT");
  return number;
}
function editValues(draft: Draft): ReceiptEdit["values"] {
  const text = (value: string) => value.trim() || null;
  return { merchant: text(draft.merchant), transactionDate: text(draft.transactionDate), totalYen: numberValue(draft.totalYen), paymentMethod: text(draft.paymentMethod), registrationNumber: text(draft.registrationNumber)?.toUpperCase() ?? null, category: text(draft.category), summary: text(draft.summary), taxes: draft.taxes.map(tax => ({ rate: numberValue(tax.rate, true), taxableYen: numberValue(tax.taxableYen), taxYen: numberValue(tax.taxYen) })).filter(tax => Object.values(tax).some(value => value !== null)) };
}
export function WebReceiptEditor({ id, returnHref = "/web/receipts" }: { id: string; returnHref?: string }) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { account } = useApp();
  const ownerId = account?.user?.id;
  const latestVersion = useRef(-1);
  const loadGeneration = useRef(0);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(1);
  const saveRequest = useRef<AbortController | null>(null);
  const load = useCallback(async (force = false, signal?: AbortSignal) => {
    const generation = ++loadGeneration.current;
    try {
      const response = await fetch(`/api/receipts/${id}`, { cache: "no-store", signal });
      if (signal?.aborted || generation !== loadGeneration.current) return;
      if (response.status === 404) {
        if (!signal?.aborted) { setNotFound(true); setReceipt(null); setDraft(null); dirtyRef.current = false; setDirty(false); }
        return;
      }
      if (!response.ok) throw new Error();
      const value = (await response.json()).receipt as ReceiptView;
      if (signal?.aborted || generation !== loadGeneration.current) return;
      if (value.version < latestVersion.current) return;
      latestVersion.current = value.version;
      setReceipt(value); setLoadError(false); setNotFound(false);
      if (force || !dirtyRef.current) { setDraft(toDraft(value)); setVersion(value.version); setDirty(false); dirtyRef.current = false; }
    } catch { if (!signal?.aborted && generation === loadGeneration.current) setLoadError(true); }
  }, [id]);
  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(false, controller.signal); });
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(false, controller.signal); }, 5000);
    return () => { controller.abort(); clearInterval(timer); saveRequest.current?.abort(); };
  }, [ownerId, load]);
  useEffect(() => {
    if (!dirty) return;
    const leaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || new URL(anchor.href).pathname === location.pathname) return;
      if (!window.confirm(t("未保存の変更を破棄しますか？"))) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", leaving); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", leaving); document.removeEventListener("click", navigate, true); };
  }, [dirty, t]);
  const change = (update: Partial<Draft>) => { setDraft(old => old ? { ...old, ...update } : old); dirtyRef.current = true; setDirty(true); setSaved(false); setSaveError(null); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !account?.user || saving) return;
    setSaving(true); setSaveError(null); setSaved(false);
    const controller = new AbortController(); saveRequest.current = controller;
    try {
      const response = await fetch(`/api/receipts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-SJ-Owner": account.user.id }, body: JSON.stringify({ version, values: editValues(draft) }), signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "SAVE_FAILED");
      if (controller.signal.aborted) return;
      latestVersion.current = body.receipt.version;
      setReceipt(body.receipt); setDraft(toDraft(body.receipt)); setVersion(body.receipt.version); dirtyRef.current = false; setDirty(false); setSaved(true);
    } catch (error) { if (!controller.signal.aborted) setSaveError(error instanceof Error && ["EDIT_CONFLICT", "INVALID_INPUT", "ACCOUNT_CHANGED", "UNAUTHORIZED"].includes(error.message) ? error.message : "SAVE_FAILED"); }
    finally { if (!controller.signal.aborted) setSaving(false); }
  };
  const reload = () => { if (!dirtyRef.current || window.confirm(t("未保存の変更を破棄しますか？"))) { setSaveError(null); setSaved(false); void load(true); } };
  if (account && !account.user) return <section className="card"><h1>{t("レシート管理")}</h1><p>{t("まだログインしていません。")}</p><button className="button primary" disabled={!account.loginReady} onClick={() => signIn("google", { callbackUrl: `/web/receipts/${id}` })}>{t("Googleでログイン")}</button></section>;
  if (notFound) return <section className="empty-state"><h1>{t("レシートを表示できません")}</h1><p>{t("削除されたか、アクセスできないレシートです。")}</p><Link className="button secondary" href="/web/trash">{t("ゴミ箱を開く")}</Link><Link className="text-link" href="/web/receipts">{t("履歴に戻る")}</Link></section>;
  if (loadError && !receipt) return <section className="empty-state"><h1>{t("表示できませんでした")}</h1><p>{t("ログインと接続を確認してください。")}</p><button className="button secondary" onClick={reload}>{t("再読み込み")}</button></section>;
  if (!receipt || !draft) return <p className="loading-state">{t("読み込んでいます…")}</p>;
  const canEdit = ["DONE", "FAILED", "LIMIT_REACHED"].includes(receipt.ocrState);
  return <section className="web-editor">
    <div className="editor-topbar"><Link className="back-link" href={returnHref}><ArrowLeft size={18} />{t("帳簿に戻る")}</Link>
    <ReceiptTrashButton receipt={receipt} disabled={saving} unsaved={dirty} onDeleted={() => { loadGeneration.current++; dirtyRef.current = false; setDirty(false); router.replace("/web/trash"); }} /></div>
    <div className="web-page-heading"><div><p className="eyebrow">{t("RECEIPT DETAILS")}</p><h1>{t("レシート詳細")}</h1><p className="page-lead">{t("原本を見ながら、読み取り内容を修正します。")}</p></div><Status receipt={receipt} /></div>
    <div className="editor-grid">
      <section className="editor-original card"><div className="image-toolbar"><h2>{t("原本画像")}</h2><button className="icon-button" onClick={() => setZoom(value => Math.max(0.5, value - 0.25))} aria-label={t("画像を縮小")}><Minus size={17} /></button><button className="icon-button" onClick={() => setZoom(value => Math.min(3, value + 0.25))} aria-label={t("画像を拡大")}><Plus size={17} /></button></div><div className="editor-image-scroll"><img src={`/api/receipts/${id}/image`} alt={t("撮影したレシートの原本")} style={{ width: `${zoom * 100}%` }} /></div><a className="text-link" href={`/api/receipts/${id}/image`} target="_blank" rel="noopener noreferrer">{t("原本を別のタブで開く")}<ExternalLink size={14} /></a><div className="two-actions">{(receipt.pdfState === "SAVED" || receipt.driveUrl) && <a className="button secondary" href={`/api/receipts/${id}/pdf`} target="_blank" rel="noopener noreferrer"><FileText size={16} />{t("PDFを見る")}</a>}{receipt.driveUrl && <a className="button secondary" href={receipt.driveUrl} target="_blank" rel="noopener noreferrer">{t("Driveで開く")}<ExternalLink size={14} /></a>}</div></section>
      <form className="card editor-form" onSubmit={save}>
        <div className="card-title"><h2>{t("読み取り内容")}</h2>{receipt.userEdited && <span className="status-badge success">{t("修正済み")}</span>}</div>
        <p>{t("不明な項目は空欄のまま保存できます。原本画像は変更されません。")}</p>
        {!canEdit && <p className="notice" role="status">{t("読み取り中…")}</p>}
        <fieldset disabled={!canEdit || saving}>
          <div className="editor-fields"><label className="span-two">{t("店舗名")}<input value={draft.merchant} maxLength={100} onChange={e => change({ merchant: e.target.value })} /></label><label>{t("利用日")}<input type="date" value={draft.transactionDate} onChange={e => change({ transactionDate: e.target.value })} /></label><label>{t("合計金額")} (JPY)<input type="number" inputMode="numeric" min="0" max="999999999" step="1" value={draft.totalYen} onChange={e => change({ totalYen: e.target.value })} /></label></div>
          <section className="editor-taxes"><h3>{t("税額・税率")}</h3><p className="muted">{t("対象額は原本に記載された金額です。税込・税抜の表記も確認してください。")}</p>{draft.taxes.map((tax, index) => <div className="tax-edit-row" key={index}>{(["rate", "taxableYen", "taxYen"] as const).map(key => <label key={key}>{t(key === "rate" ? "税率" : key === "taxableYen" ? "対象額" : "税額")} {key === "rate" ? "(%)" : "(JPY)"}<input type="number" inputMode={key === "rate" ? "decimal" : "numeric"} min="0" max={key === "rate" ? "100" : "999999999"} step={key === "rate" ? "0.1" : "1"} value={tax[key]} onChange={e => change({ taxes: draft.taxes.map((row, i) => i === index ? { ...row, [key]: e.target.value } : row) })} /></label>)}<button className="icon-button" type="button" aria-label={t("この税区分を削除")} onClick={() => change({ taxes: draft.taxes.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></div>)}<button className="text-link" type="button" disabled={draft.taxes.length >= 8} onClick={() => change({ taxes: [...draft.taxes, { rate: "", taxableYen: "", taxYen: "" }] })}><Plus size={15} />{t("税区分を追加")}</button></section>
          <div className="editor-fields"><label>{t("支払方法")}<input value={draft.paymentMethod} maxLength={80} onChange={e => change({ paymentMethod: e.target.value })} /></label><label>{t("登録番号")}<input value={draft.registrationNumber} placeholder="T1234567890123" pattern="[Tt][0-9]{13}" maxLength={14} onChange={e => change({ registrationNumber: e.target.value })} /></label><CategoryField value={draft.category} onChange={category => change({ category })} classification={receipt.classification} /><label className="span-two">{t("摘要")}<textarea value={draft.summary} maxLength={2000} rows={3} onChange={e => change({ summary: e.target.value })} /></label></div>
        </fieldset>
        {loadError && <p className="notice caution">{t("接続を確認して、もう一度お試しください。")}</p>}
        {dirty && receipt.version !== version && !saveError && <p className="notice caution">{t("別の更新があります。入力内容は保持しています。最新の内容を確認してから保存してください。")}</p>}
        {saveError && <p className="notice caution" role="alert">{errorMessage(saveError, locale)}</p>}
        {(saveError === "EDIT_CONFLICT" || dirty && receipt.version !== version) && <button type="button" className="text-link" onClick={reload}>{t("最新の内容を読み込む")}</button>}
        <div className="editor-savebar"><span role="status">{saved ? <><Check size={17} />{t("保存しました")}</> : dirty ? t("未保存の変更があります") : t("金額は日本円（JPY）で入力してください。")}</span><button className="button primary" type="submit" disabled={!dirty || saving || !canEdit}><Save size={17} />{saving ? t("保存中…") : t("変更を保存")}</button></div>
        {receipt.reviewReasons.length > 0 && <details className="editor-review"><summary>{t("読み取り時に確認が必要だった項目")}</summary><ul>{receipt.reviewReasons.map(reason => <li key={reason}>{displayText(reason, locale)}</li>)}</ul></details>}
      </form>
    </div>
  </section>;
}
