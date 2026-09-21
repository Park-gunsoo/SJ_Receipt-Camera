import type { Candidate, Extraction, ReceiptValues } from "./contracts";
import { rulesClassifier } from "./classifier";

export function validDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}
function amounts(text: string) {
  return [...text.matchAll(/(?:[¥￥]\s*)?(-?\d[\d,]*)(?:\s*円)?/g)].map(match => Number(match[1].replaceAll(",", ""))).filter(n => Number.isSafeInteger(n) && n >= 0 && n <= 999999999);
}
export function extractReceipt(rawText: string): Extraction {
  const lines = rawText.normalize("NFKC").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const dates: Candidate<string>[] = [], totals: Candidate<number>[] = [];
  const reasons: string[] = [];
  lines.forEach((text, line) => {
    for (const m of text.matchAll(/(20\d{2})[年/.-]\s*(\d{1,2})[月/.-]\s*(\d{1,2})日?/g)) {
      const value = validDate(+m[1], +m[2], +m[3]);
      if (value && !/有効|期限|発行期限/.test(text)) dates.push({ value, evidence: { line, text } });
    }
    if (/(?:合\s*計|総額|お買上計|お支払(?:い)?金額)/.test(text) && !/小計|税抜|税額|消費税|点数|数量|お預|お釣|釣銭|割引|値引/.test(text)) {
      const source = /\d/.test(text) ? text : lines[line + 1] ?? "";
      const values = amounts(source.replace(/(?:8|10)\s*%/g, ""));
      if (values.length === 1) totals.push({ value: values[0], evidence: { line, text: source === text ? text : `${text} ${source}` } });
      else if (values.length > 1) reasons.push("合計行に複数の金額があります");
    }
  });
  const dateValues = [...new Set(dates.map(c => c.value))], totalValues = [...new Set(totals.map(c => c.value))];
  if (dateValues.length !== 1) reasons.push(dateValues.length ? "利用日の候補が複数あります" : "利用日を確認してください");
  if (totalValues.length !== 1) reasons.push(totalValues.length ? "合計金額の候補が複数あります" : "合計金額を確認してください");
  const merchants: Candidate<string>[] = lines.slice(0, 5).flatMap((text, line) => {
    if (text.length < 2 || text.length > 60 || /領収|レシート|領収証|TEL|電話|登録番号|〒|\d{3}[-ー]\d|^T\d|\d{4}[年/.-]|^[\d\W]+$/i.test(text)) return [];
    return [{ value: text, evidence: { line, text } }];
  });
  // Conservative: don't decide between multiple plausible store-name lines.
  const merchant = merchants.length === 1 ? merchants[0].value : null;
  if (!merchant) reasons.push("店舗名を確認してください");
  const registration = lines.join(" ").match(/T\s*(\d(?:\s*\d){12})(?!\d)/i)?.[1]?.replaceAll(/\s/g, "") ?? null;
  const payment = lines.find(line => /クレジット|クレジットカード|PayPay|交通系IC|現金|電子マネー/i.test(line));
  const paymentMethod = payment?.match(/クレジットカード|クレジット|PayPay|交通系IC|現金|電子マネー/i)?.[0] ?? null;
  const items = lines.filter(line => /コピー用紙|ボールペン|プリンター用紙|タクシー|乗車料金|運賃/.test(line));
  const classification = rulesClassifier.classify({ merchant, totalYen: totalValues.length === 1 ? totalValues[0] : null, items, text: lines.join("\n"), availableCategories: ["消耗品費", "旅費交通費"] });
  const taxes: ReceiptValues["taxes"] = [];
  for (const line of lines) {
    const rate = line.match(/(8|10)\s*%/);
    if (!rate) continue;
    const nums = amounts(line.replace(/(8|10)\s*%/, ""));
    if (nums.length === 1 && /税額|消費税/.test(line)) taxes.push({ rate: +rate[1], taxYen: nums[0], taxableYen: null });
    else if (nums.length === 1 && /対象/.test(line)) taxes.push({ rate: +rate[1], taxableYen: nums[0], taxYen: null });
    else reasons.push("税率別の金額を確認してください");
  }
  return {
    version: "jp-receipt-1", candidates: { dates, totals, merchant: merchants }, classification,
    reasons: [...new Set([...reasons, ...classification.reasons])],
    values: { merchant, transactionDate: dateValues.length === 1 ? dateValues[0] : null, totalYen: totalValues.length === 1 ? totalValues[0] : null, taxes, paymentMethod, registrationNumber: registration ? `T${registration}` : null, items, summary: items.length ? items.join("、") : null, category: classification.category },
  };
}
