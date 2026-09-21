"use client";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import type { ReceiptView } from "@/lib/contracts";
import { ReceiptTrashButton } from "./receipt-trash-button";
import { useLanguage } from "./language-provider";

export function ReceiptRowActions({ receipt, href, disabled, onDeleted }: { receipt: ReceiptView; href: string; disabled: boolean; onDeleted: () => void }) {
  const { t } = useLanguage();
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setPosition(null); };
    const close = () => setPosition(null);
    document.addEventListener("pointerdown", outside); window.addEventListener("resize", close); window.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [position]);
  return <ReceiptTrashButton receipt={receipt} disabled={disabled} onDeleted={onDeleted} onDismiss={() => trigger.current?.focus()} renderTrigger={(openTrash, unavailable) => <>
    <button ref={trigger} type="button" className="ledger-row-trigger" aria-label={t("レシートの操作")} aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? id : undefined} disabled={disabled} onClick={() => {
      const rect = trigger.current!.getBoundingClientRect();
      setPosition(old => old ? null : { top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 172)), right: Math.max(8, innerWidth - rect.right) });
    }}><MoreHorizontal size={20} /></button>
    {position && createPortal(<div ref={menu} id={id} role="menu" className="ledger-row-menu" style={position} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); setPosition(null); trigger.current?.focus(); }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault(); const items = [...menu.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(item => !item.hasAttribute("disabled"));
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
      if (event.key === "Tab") setPosition(null);
    }}><Link role="menuitem" href={href}><ExternalLink size={16} />{t("内容を確認・修正")}</Link>{(receipt.pdfState === "SAVED" || receipt.driveUrl) && <a role="menuitem" href={`/api/receipts/${receipt.id}/pdf`} target="_blank" rel="noopener noreferrer" onClick={() => setPosition(null)}><FileText size={16} />{t("PDFを見る")}</a>}<div className="menu-divider" /><button role="menuitem" className="menu-danger" type="button" disabled={unavailable} onClick={() => { setPosition(null); openTrash(); }}><Trash2 size={16} />{t("ゴミ箱に移動")}</button></div>, document.body)}
  </>} />;
}
