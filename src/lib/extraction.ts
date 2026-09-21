import type { Candidate, Extraction, ReceiptValues } from "./contracts";
import { rulesClassifier } from "./classifier";
import { receiptLines } from "./ocr-layout";

export function validDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}
const compact = (value: string) => value.replace(/\s/g, "");
function amounts(text: string) {
  const source = text.replace(/\d{1,2}(?:\.\d+)?\s*%/g, "").replace(/\s*,\s*/g, ",").replaceAll("−", "-").replace(/-\s*([¥￥])\s*/g, "$1-");
  const values = [...source.matchAll(/(?<![\d.])(-?\d[\d,]*)(?![\d.])/g)].map(m => Number(m[1].replaceAll(",", "")));
  return values.filter(n => Number.isSafeInteger(n) && n >= 0 && n <= 999999999);
}
function rowAmounts(lines: string[], index: number) {
  const values = amounts(lines[index]);
  if (values.length) return { values, text: lines[index] };
  const next = lines[index + 1] ?? "";
  if (/^[\s¥￥\d,.円()（）-]+$/.test(next) && !/%/.test(next)) return { values: amounts(next), text: `${lines[index]} ${next}` };
  return { values: [], text: lines[index] };
}
function taxValues(lines: string[], reasons: string[]): ReceiptValues["taxes"] {
  const rates = lines.map((text, index) => {
    const context = compact(text) + (/^(?:8|10)(?:\.0+)?%$/.test(compact(text)) ? compact(lines[index - 1] ?? "") : "");
    if (!/税|対象|課税/.test(context)) return null;
    const found = [...text.matchAll(/(?<!\d)(8|10)(?:\.0+)?\s*%/g)].map(m => +m[1]);
    return found.length === 1 ? found[0] : null;
  });
  const uniqueRates = [...new Set(rates.filter((rate): rate is number => rate !== null))];
  const groups = new Map<number | null, { tax: Set<number>; target: Set<number> }>();
  lines.forEach((text, index) => {
    const label = compact(text);
    const target = /対象|課税/.test(label) && !/非課税/.test(label);
    const tax = /税額|消費税等|内消費税|外消費税|内税|外税/.test(label) || /消費税(?!率)/.test(label) && !target;
    if (!target && !tax && rates[index] === null) return;
    if (/消費税合計|税額合計/.test(label) && uniqueRates.length > 1) return;
    const nearby = [rates[index - 1], rates[index + 1], rates[index - 2]].find(rate => rate !== undefined && rate !== null);
    const rate = rates[index] ?? nearby ?? (uniqueRates.length === 1 ? uniqueRates[0] : null);
    const group = groups.get(rate) ?? { tax: new Set<number>(), target: new Set<number>() };
    groups.set(rate, group);
    if (!target && !tax) return;
    const { values } = rowAmounts(lines, index);
    if (values.length === 1) (target && !tax ? group.target : group.tax).add(values[0]);
    else if (values.length === 2 && target && tax) {
      const targetFirst = label.search(/対象|課税計/) < label.search(/税額|内税|外税|内消費税|外消費税/);
      group.target.add(values[targetFirst ? 0 : 1]); group.tax.add(values[targetFirst ? 1 : 0]);
    } else if (values.length > 1) reasons.push("税率別の金額を確認してください");
  });
  return [...groups].map(([rate, group]) => {
    if (group.tax.size !== 1) reasons.push("税額の記載を確認してください");
    if (group.tax.size > 1 || group.target.size > 1) reasons.push("税率別の金額を確認してください");
    return { rate, taxableYen: group.target.size === 1 ? [...group.target][0] : null, taxYen: group.tax.size === 1 ? [...group.tax][0] : null };
  });
}
export function extractReceipt(rawText: string, pages?: unknown[]): Extraction {
  const lines = receiptLines(rawText, pages);
  const dates: Candidate<string>[] = [], totals: Candidate<number>[] = [];
  const reasons: string[] = [];
  const usableDates = new Set<string>();
  lines.forEach((text, line) => {
    const normalized = compact(text);
    const dateText = text.replace(/[ \t]*([年月日/.-])[ \t]*/g, "$1");
    if (!/有効|期限|発行期限|生年月日/.test(normalized)) {
      const found: { value: string | null; end: number }[] = [];
      const eraPattern = /(?:令和|平成|[RH])\s*\.?\s*([元\d]{1,2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/gi;
      const westernText = dateText.replace(eraPattern, value => " ".repeat(value.length));
      for (const m of westernText.matchAll(/(?<!\d)(20\d{2}|\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?(?!\d)/g)) found.push({ value: validDate(m[1].length === 2 ? 2000 + +m[1] : +m[1], +m[2], +m[3]), end: m.index! + m[0].length });
      for (const m of dateText.matchAll(eraPattern)) {
        const reiwa = /令和|R/i.test(m[0]), year = (m[1] === "元" ? 1 : +m[1]) + (reiwa ? 2018 : 1988);
        const value = validDate(year, +m[2], +m[3]);
        if (value && (reiwa ? value >= "2019-05-01" : value <= "2019-04-30")) found.push({ value, end: m.index! + m[0].length });
      }
      for (const candidate of found) {
        if (!candidate.value) continue;
        dates.push({ value: candidate.value, evidence: { line, text } });
        const weekday = compact(dateText.slice(candidate.end)).match(/^[(（]([日月火水木金土])(?:曜(?:日)?)?[)）]/)?.[1];
        if (weekday && "日月火水木金土"[new Date(candidate.value + "T00:00:00Z").getUTCDay()] !== weekday) reasons.push("日付と曜日が一致しません。原本を確認してください");
        else usableDates.add(candidate.value);
      }
    }
    const totalLabel = /合計|総額|お買上計|お支払(?:い)?金額|ご利用金額|運賃料金計|料金合計|^計(?:[¥￥\d]|$)/.test(normalized);
    if (totalLabel && !/小計|税抜|税額|消費税|課税|点数|数量|通数|個数|件数|お預|お釣|釣銭|割引|値引/.test(normalized)) {
      const source = rowAmounts(lines, line);
      if (source.values.length === 1) totals.push({ value: source.values[0], evidence: { line, text: source.text } });
      else if (source.values.length > 1) reasons.push("合計行に複数の金額があります");
    }
  });
  const dateValues = [...usableDates], totalValues = [...new Set(totals.map(c => c.value))];
  if (dateValues.length !== 1) reasons.push(dateValues.length ? "利用日の候補が複数あります" : "利用日を確認してください");
  if (totalValues.length !== 1) reasons.push(totalValues.length ? "合計金額の候補が複数あります" : "合計金額を確認してください");
  const merchants: Candidate<string>[] = lines.slice(0, 5).flatMap((text, line) => {
    if (text.length < 2 || text.length > 60 || /領収|レシート|領収証|TEL|電話|登録番号|〒|\d{3}[-ー]\d|^T\d|\d{4}[年/.-]|^[\d\W]+$/i.test(text)) return [];
    return [{ value: text, evidence: { line, text } }];
  });
  const merchant = merchants.length === 1 ? merchants[0].value : null;
  if (!merchant) reasons.push("店舗名を確認してください");
  const normalizedText = lines.map(compact).join("\n");
  const registration = normalizedText.match(/T(\d{13})(?!\d)/i)?.[1] ?? null;
  const paymentLine = lines.find(line => /クレジット|PayPay|交通系IC|現金|電子マネー/i.test(compact(line)) && !/[、,].*(?:カード|現金|クーポン)/.test(line));
  const paymentMethod = paymentLine ? compact(paymentLine).match(/クレジットカード|クレジット|PayPay|交通系IC|現金|電子マネー/i)?.[0] ?? null : null;
  const items = lines.filter(line => /コピー用紙|ボールペン|プリンター用紙|タクシー|乗車料金|運賃/.test(compact(line)));
  const classification = rulesClassifier.classify({ merchant, totalYen: totalValues.length === 1 ? totalValues[0] : null, items, text: normalizedText, availableCategories: ["消耗品費", "旅費交通費"] });
  const taxes = taxValues(lines, reasons);
  return {
    version: "jp-receipt-2", candidates: { dates, totals, merchant: merchants }, classification,
    reasons: [...new Set([...reasons, ...classification.reasons])],
    values: { merchant, transactionDate: dateValues.length === 1 ? dateValues[0] : null, totalYen: totalValues.length === 1 ? totalValues[0] : null, taxes, paymentMethod, registrationNumber: registration ? `T${registration}` : null, items, summary: items.length ? items.join("、") : null, category: classification.category },
  };
}
