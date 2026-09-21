"use client";
import { useLanguage } from "./language-provider";
import { Check, Clock3, AlertCircle, LoaderCircle } from "lucide-react";
import type { ReceiptView } from "@/lib/contracts";
export function Status({ receipt }: { receipt: ReceiptView }) {
  const { t } = useLanguage();
  const saved = receipt.archiveState === "SAVED";
  const error = ["FAILED", "BLOCKED"].includes(receipt.archiveState);
  return <div className="status-pair"><span className={`status-badge ${saved ? "success" : error ? "caution" : ""}`}>{saved ? <Check size={13} /> : error ? <AlertCircle size={13} /> : <Clock3 size={13} />}{saved ? t("Drive保存済み") : error ? t("保存の確認が必要") : t("受付済み")}</span><span className={`status-badge ${receipt.ocrState === "DONE" ? "" : ["FAILED", "LIMIT_REACHED"].includes(receipt.ocrState) ? "caution" : ""}`}>{receipt.ocrState === "DONE" ? t("読み取り済み") : receipt.ocrState === "FAILED" ? t("読み取り失敗") : receipt.ocrState === "LIMIT_REACHED" ? t("読み取り待ち") : <><LoaderCircle className="spin" size={12} />{t("読み取り中")}</>}</span></div>;
}
export { formatYen as yen } from "@/lib/i18n";
