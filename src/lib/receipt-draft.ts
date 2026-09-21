import type { ReceiptView } from "./contracts";
import type { ReceiptEdit } from "./receipt-editor";

export type TaxDraft = { rate: string; taxableYen: string; taxYen: string };
export type Draft = { merchant: string; transactionDate: string; totalYen: string; paymentMethod: string; registrationNumber: string; category: string; summary: string; taxes: TaxDraft[] };
const numberText = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);
export function toDraft(receipt: ReceiptView): Draft {
  const v = receipt.values;
  return { merchant: v?.merchant ?? receipt.merchant ?? "", transactionDate: v?.transactionDate ?? receipt.transactionDate ?? "", totalYen: numberText(v?.totalYen ?? receipt.totalYen), paymentMethod: v?.paymentMethod ?? "", registrationNumber: v?.registrationNumber ?? "", category: v?.category ?? "", summary: v?.summary ?? "", taxes: (v?.taxes ?? []).map(tax => ({ rate: numberText(tax.rate), taxableYen: numberText(tax.taxableYen), taxYen: numberText(tax.taxYen) })) };
}
function numberValue(value: string, rate = false) {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > (rate ? 100 : 999999999) || !rate && !Number.isInteger(number)) throw new Error("INVALID_INPUT");
  return number;
}
export function editValues(draft: Draft): ReceiptEdit["values"] {
  const text = (value: string) => value.trim() || null;
  return { merchant: text(draft.merchant), transactionDate: text(draft.transactionDate), totalYen: numberValue(draft.totalYen), paymentMethod: text(draft.paymentMethod), registrationNumber: text(draft.registrationNumber)?.toUpperCase() ?? null, category: text(draft.category), summary: text(draft.summary), taxes: draft.taxes.map(tax => ({ rate: numberValue(tax.rate, true), taxableYen: numberValue(tax.taxableYen), taxYen: numberValue(tax.taxYen) })).filter(tax => Object.values(tax).some(value => value !== null)) };
}
