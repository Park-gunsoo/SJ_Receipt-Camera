"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileCheck2, FileText, ListFilter, Pencil, RefreshCw, RotateCcw, Search, Table2 } from "lucide-react";
import type { ReceiptView } from "@/lib/contracts";
import { accountCategories, categoryLabel, categoryOption } from "@/lib/account-categories";
import { defaultLedgerQuery, ledgerQueryString, parseLedgerQuery, type LedgerQuery } from "@/lib/ledger-query";
import { formatPurchaseDate, formatYen } from "@/lib/i18n";
import { useApp } from "./app-provider";
import { useLanguage } from "./language-provider";
import { ReceiptRowActions } from "./receipt-row-actions";
import { LedgerInlineEditor } from "./ledger-inline-editor";
import { ExcelDownload } from "./excel-download";

type LedgerData = { receipts: ReceiptView[]; total: number; page: number; pageSize: number; categories?: string[] };
function LedgerFilters({ query, categories = [], locked = false, onApply }: { query: LedgerQuery; categories?: string[]; locked?: boolean; onApply: (query: LedgerQuery) => void }) {
  const { t, locale } = useLanguage();
  const [invalid, setInvalid] = useState(false);
  const customCategories = [...new Set([...categories, query.category])].filter(category => category && category !== "__unassigned__" && !accountCategories.some(item => item.name === category));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (typeof value === "string") params.set(key, value);
    params.set("sort", query.sort); params.set("direction", query.direction); params.set("pageSize", String(query.pageSize));
    const parsed = parseLedgerQuery(params); setInvalid(!parsed.success);
    if (parsed.success) onApply(parsed.data);
  };
  return <form className="ledger-filters" onSubmit={submit}><fieldset className="ledger-filter-lock" disabled={locked}>
    <div className="ledger-filter-heading"><ListFilter size={16} /><span>{t("絞り込み")}</span><small>{t("保存済みの全レシートから検索")}</small></div>
    <div className="ledger-filter-grid">
      <label className="ledger-search">{t("取引先・摘要")}<span><Search size={17} /><input name="q" defaultValue={query.q} maxLength={100} placeholder={t("店舗名や摘要を検索")} /></span></label>
      <fieldset className="ledger-date-range"><legend>{t("利用日")}</legend><div><input type="date" name="from" defaultValue={query.from ?? ""} aria-label={t("開始日")} /><span>—</span><input type="date" name="to" defaultValue={query.to ?? ""} aria-label={t("終了日")} /></div></fieldset>
      <label>{t("勘定科目")}<select name="category" defaultValue={query.category}><option value="">{t("すべての科目")}</option><option value="__unassigned__">{t("未分類")}</option>{accountCategories.map(category => <option key={category.name} value={category.name}>{categoryOption(category.name, locale)}</option>)}{customCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
      <label>{t("読み取り状況")}<select name="status" defaultValue={query.status}><option value="all">{t("すべての状態")}</option><option value="DONE">{t("読み取り済み")}</option><option value="processing">{t("読み取り中")}</option><option value="failed">{t("要確認")}</option></select></label>
    </div>
    <div className="ledger-filter-bottom"><fieldset className="ledger-amount-range"><legend>{t("金額範囲（JPY）")}</legend><div><input type="number" inputMode="numeric" name="min" min="0" max="999999999" step="1" defaultValue={query.min ?? ""} placeholder={t("下限なし")} aria-label={t("最低金額")} /><span>—</span><input type="number" inputMode="numeric" name="max" min="0" max="999999999" step="1" defaultValue={query.max ?? ""} placeholder={t("上限なし")} aria-label={t("最高金額")} /></div></fieldset>
      <label>{t("修正状況")}<select name="edited" defaultValue={query.edited}><option value="all">{t("すべて")}</option><option value="yes">{t("修正済み")}</option><option value="no">{t("未修正")}</option></select></label>
      <div className="ledger-filter-actions"><button type="reset" className="button ledger-reset" onClick={() => { setInvalid(false); onApply({ ...defaultLedgerQuery, pageSize: query.pageSize }); }}><RotateCcw size={15} />{t("条件をクリア")}</button><button type="submit" className="button primary"><Search size={16} />{t("検索する")}</button></div>
    </div>{invalid && <p className="ledger-error" role="alert">{t("日付・金額の範囲を確認してください。")}</p>}
  </fieldset></form>;
}

export function ReceiptLedger() {
  const { t, locale } = useLanguage();
  const { account } = useApp();
  const router = useRouter(), searchParams = useSearchParams();
  const rawQuery = searchParams.toString();
  const parsed = useMemo(() => parseLedgerQuery(new URLSearchParams(rawQuery)), [rawQuery]);
  const query = parsed.success ? parsed.data : defaultLedgerQuery;
  const queryString = ledgerQueryString(query);
  const ownerId = account?.user?.id;
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<"deleted" | "saved" | null>(null);
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useRef<string | null>(null), dirty = useRef(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const navigate = (next: LedgerQuery) => { const value = ledgerQueryString(next); router.replace(`/web/receipts${value ? `?${value}` : ""}`, { scroll: false }); };
  const load = useCallback(async (quiet = false) => {
    if (!ownerId || editing.current) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const current = ++generation.current;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/receipts/ledger?${queryString}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (controller.signal.aborted || current !== generation.current) return;
      setData(result); setError(false);
    } catch { if (!controller.signal.aborted && current === generation.current) setError(true); }
    finally { if (!controller.signal.aborted && current === generation.current) setLoading(false); }
  }, [ownerId, queryString]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const interval = setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 15000);
    return () => { active = false; clearInterval(interval); request.current?.abort(); };
  }, [load]);
  useEffect(() => {
    if (!editingId) return;
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    const leave = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!dirty.current || !anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || anchor.href === location.href) return;
      if (!window.confirm(t("未保存の変更を破棄しますか？"))) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", leave, true); };
  }, [editingId, t]);
  const startEditing = (receipt: ReceiptView) => { request.current?.abort(); generation.current++; editing.current = receipt.id; dirty.current = false; setEditingId(receipt.id); setNotice(null); setExportCount(null); };
  const finishEditing = (updated?: ReceiptView) => {
    editing.current = null; dirty.current = false; setEditingId(null);
    if (updated) { setData(old => old ? { ...old, receipts: old.receipts.map(row => row.id === updated.id ? updated : row) } : old); setNotice("saved"); }
    void load();
  };
  const sort = (field: LedgerQuery["sort"]) => navigate({ ...query, page: 1, sort: field, direction: query.sort === field && query.direction === "desc" ? "asc" : "desc" });
  const sortIcon = (field: LedgerQuery["sort"]) => query.sort === field ? query.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} />;
  const page = data?.page ?? query.page;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / query.pageSize));
  const disabled = loading || error || Boolean(editingId);
  if (!account) return <p className="loading-state">{t("読み込んでいます…")}</p>;
  if (!account.user) return <section className="ledger-login"><Table2 size={28} /><h1>{t("レシート帳簿")}</h1><p>{t("Googleにログインして、レシートを確認・修正します。")}</p><button className="button primary" disabled={!account.loginReady} onClick={() => signIn("google", { callbackUrl: `/web/receipts${queryString ? `?${queryString}` : ""}` })}>{t("Googleでログイン")}</button></section>;
  return <section className={`receipt-ledger${editingId ? " ledger-has-edit" : ""}`}><div className="ledger-page-heading"><div className="ledger-heading-title"><span className="ledger-heading-icon"><Table2 size={22} /></span><div><h1>{t("レシート帳簿")}</h1><p>{t("原本と読み取り内容を、ひとつの帳簿で。")}</p></div></div><div className="ledger-toolbar-actions"><button className="button ledger-refresh" disabled={loading || Boolean(editingId)} onClick={() => load()}><RefreshCw size={16} className={loading ? "spin" : undefined} />{t("更新")}</button><ExcelDownload query={queryString} count={data?.total ?? 0} disabled={disabled} onDownloaded={count => { setNotice(null); setExportCount(count); }} /></div></div>
    <LedgerFilters key={queryString} query={query} categories={data?.categories} locked={Boolean(editingId)} onApply={navigate} />
    {!parsed.success && <p className="ledger-error" role="alert">{t("検索条件が正しくありません。条件をクリアしてください。")}</p>}
    {notice && <div className="ledger-notice" role="status">{t(notice === "saved" ? "保存しました" : "ゴミ箱に移動しました")} {notice === "deleted" && <Link href="/web/trash">{t("ゴミ箱を開く")}</Link>}</div>}
    {exportCount !== null && <div className="ledger-notice" role="status">{t("Excelダウンロードを開始しました（{count}件）", { count: exportCount })}</div>}
    {editingId && <div className="ledger-edit-notice" role="status">{t("編集中です。保存またはキャンセル後に、検索・並び替え・ダウンロードを行えます。")}</div>}
    {error && <div className="ledger-error" role="alert">{t("履歴を取得できませんでした")} <button type="button" onClick={() => load()}>{t("再読み込み")}</button></div>}
    <div className="ledger-sheet" aria-busy={loading}><div className="ledger-sheet-toolbar"><div><strong>{t("検索結果")}</strong><span className="ledger-count">{loading ? "…" : t("{count}件", { count: data?.total ?? 0 })}</span></div><span>{t("取引先をクリックして詳細・修正")}</span></div>
      <div className="ledger-table-scroll" tabIndex={0} role="region" aria-label={t("レシート帳簿の表")}><table className="ledger-table"><caption className="visually-hidden">{t("レシート帳簿の表")}</caption><colgroup><col className="ledger-col-number" /><col className="ledger-col-date" /><col className="ledger-col-merchant" /><col className="ledger-col-category" /><col className="ledger-col-amount" /><col className="ledger-col-tax" /><col className="ledger-col-state" /><col className="ledger-col-storage" /><col className="ledger-col-actions" /></colgroup><thead><tr><th scope="col">No.</th><th scope="col" aria-sort={query.sort === "date" ? query.direction === "asc" ? "ascending" : "descending" : "none"}><button disabled={Boolean(editingId)} onClick={() => sort("date")}>{t("利用日")}{sortIcon("date")}</button></th><th scope="col" aria-sort={query.sort === "merchant" ? query.direction === "asc" ? "ascending" : "descending" : "none"}><button disabled={Boolean(editingId)} onClick={() => sort("merchant")}>{t("取引先・摘要")}{sortIcon("merchant")}</button></th><th scope="col">{t("勘定科目（候補）")}</th><th scope="col" className="amount-cell" aria-sort={query.sort === "amount" ? query.direction === "asc" ? "ascending" : "descending" : "none"}><button disabled={Boolean(editingId)} onClick={() => sort("amount")}>{t("合計金額")}{sortIcon("amount")}</button></th><th scope="col" className="amount-cell">{t("消費税の内訳")}</th><th scope="col">{t("読み取り状況")}</th><th scope="col">{t("ファイル")}</th><th scope="col">{t("操作")}</th></tr></thead>
      <tbody>{data?.receipts.map((receipt, index) => {
        if (editingId === receipt.id) return <LedgerInlineEditor key={receipt.id} receipt={receipt} rowNumber={(page - 1) * query.pageSize + index + 1} onDirty={value => { dirty.current = value; }} onSaved={finishEditing} onCancel={() => finishEditing()} />;
        const href = `/web/receipts/${receipt.id}${queryString ? `?back=${encodeURIComponent(queryString)}` : ""}`;
        const category = receipt.values?.category;
        return <tr key={receipt.id}><td className="ledger-row-number">{(page - 1) * query.pageSize + index + 1}</td><td className="ledger-date-cell">{receipt.transactionDate ? <time dateTime={receipt.transactionDate} title={formatPurchaseDate(receipt.transactionDate, locale)}>{receipt.transactionDate.replaceAll("-", ".")}</time> : <span className="ledger-unknown">{t("未確認")}</span>}</td><td className="ledger-merchant-cell"><Link href={href} title={receipt.merchant ?? t("店舗名 未確認")}>{receipt.merchant ?? t("店舗名 未確認")}</Link><p title={receipt.values?.summary ?? undefined}>{receipt.values?.summary || "—"}</p></td><td>{category ? <div className="ledger-category"><span>{categoryLabel(category, locale)}</span>{categoryLabel(category, locale) !== category && <small>{category}</small>}</div> : <span className="ledger-unclassified">{t("未分類")}</span>}</td><td className="amount-cell ledger-amount">{formatYen(receipt.totalYen, locale)}</td><td className="amount-cell ledger-tax">{receipt.values?.taxes?.length ? receipt.values.taxes.map((tax, index) => <div key={index}><small>{tax.rate === null ? "?%" : `${tax.rate}%`}</small><span>{formatYen(tax.taxYen, locale)}</span></div>) : <span className="ledger-unknown">—</span>}</td><td><span className={`ledger-state ${receipt.ocrState === "DONE" ? "done" : ["FAILED", "LIMIT_REACHED"].includes(receipt.ocrState) ? "attention" : "processing"}`}><i />{t(receipt.ocrState === "DONE" ? "読み取り済み" : ["FAILED", "LIMIT_REACHED"].includes(receipt.ocrState) ? "要確認" : "読み取り中")}</span>{receipt.userEdited && <small className="ledger-edited"><Pencil size={11} />{t("修正済み")}</small>}</td><td className="ledger-storage">{receipt.pdfState === "SAVED" ? <a href={`/api/receipts/${receipt.id}/pdf`} target="_blank" rel="noopener noreferrer"><FileCheck2 size={15} />PDF<ChevronRight size={12} /></a> : <span><FileText size={15} />{t(receipt.pdfState === "FAILED" ? "要確認" : "作成中")}</span>}{receipt.archiveState !== "NOT_REQUESTED" && <small className={["FAILED", "BLOCKED"].includes(receipt.archiveState) ? "attention" : undefined}>{receipt.archiveState === "SAVED" ? t("Drive保存済み") : ["FAILED", "BLOCKED"].includes(receipt.archiveState) ? t("保存の確認が必要") : t("Driveバックアップ待ち")}</small>}</td><td className="ledger-actions-cell"><div className="ledger-action-group"><button className="ledger-row-trigger ledger-edit-trigger" type="button" aria-label={t("行を編集")} title={t("行を編集")} disabled={disabled || !["DONE", "FAILED", "LIMIT_REACHED"].includes(receipt.ocrState)} onClick={() => startEditing(receipt)}><Pencil size={16} /></button><ReceiptRowActions receipt={receipt} href={href} disabled={disabled} onDeleted={() => { generation.current++; setData(old => old ? { ...old, receipts: old.receipts.filter(row => row.id !== receipt.id) } : old); setNotice("deleted"); setExportCount(null); void load(); }} /></div></td></tr>;
      })}{(!data || !data.receipts.length) && <tr><td colSpan={9} className="ledger-empty">{loading ? t("読み込んでいます…") : <><Search size={28} /><strong>{t("一致するレシートがありません")}</strong><span>{t("検索条件を変更するか、レシートを撮影してください。")}</span></>}</td></tr>}</tbody></table></div>
      <div className="ledger-pagination"><span>{loading ? t("読み込んでいます…") : t("{total}件中 {from}–{to}件を表示", { total: data?.total ?? 0, from: data?.total ? (page - 1) * query.pageSize + 1 : 0, to: Math.min(page * query.pageSize, data?.total ?? 0) })}</span><div><label>{t("表示件数")}<select disabled={Boolean(editingId)} value={query.pageSize} onChange={event => navigate({ ...query, pageSize: Number(event.target.value), page: 1 })}>{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label><button aria-label={t("前のページ")} disabled={loading || Boolean(editingId) || page <= 1} onClick={() => navigate({ ...query, page: page - 1 })}><ChevronLeft size={17} /></button><span>{page} / {pages}</span><button aria-label={t("次のページ")} disabled={loading || Boolean(editingId) || page >= pages} onClick={() => navigate({ ...query, page: page + 1 })}><ChevronRight size={17} /></button></div></div>
    </div><p className="ledger-footnote">{t("科目は候補です。内容と用途を確認してから帳簿にお使いください。")}</p>
  </section>;
}
