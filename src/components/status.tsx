import { Check, Clock3, AlertCircle, LoaderCircle } from "lucide-react";
import type { ReceiptView } from "@/lib/contracts";
export function Status({ receipt }: { receipt: ReceiptView }) {
  const saved = receipt.archiveState === "SAVED";
  const error = ["FAILED", "BLOCKED"].includes(receipt.archiveState);
  return <div className="status-pair"><span className={`status-badge ${saved ? "success" : error ? "caution" : ""}`}>{saved ? <Check size={13} /> : error ? <AlertCircle size={13} /> : <Clock3 size={13} />}{saved ? "Drive保存済み" : error ? "保存の確認が必要" : "受付済み"}</span><span className={`status-badge ${receipt.ocrState === "DONE" ? "" : ["FAILED", "LIMIT_REACHED"].includes(receipt.ocrState) ? "caution" : ""}`}>{receipt.ocrState === "DONE" ? "読み取り済み" : receipt.ocrState === "FAILED" ? "読み取り失敗" : receipt.ocrState === "LIMIT_REACHED" ? "読み取り待ち" : <><LoaderCircle className="spin" size={12} />読み取り中</>}</span></div>;
}
export const yen = (value: number | null) => value === null ? "未確認" : `¥${value.toLocaleString("ja-JP")}`;
