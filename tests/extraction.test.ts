import { describe, expect, it } from "vitest";
import { extractReceipt, validDate } from "../src/lib/extraction";
import { rulesClassifier } from "../src/lib/classifier";

describe("Japanese receipt extraction", () => {
  it("separates totals from tender, change, discounts and subtotal", () => {
    const result = extractReceipt("サンプル商店\n2026年9月21日\n小計 3,000円\n合計 ￥3,300\nお預り 5,000円\nお釣り 1,700円\n値引 100円");
    expect(result.values.totalYen).toBe(3300); expect(result.values.transactionDate).toBe("2026-09-21");
  });
  it("never substitutes capture date or zero for missing values", () => {
    const empty = extractReceipt("領収書\n読めない文字"); expect(empty.values.transactionDate).toBeNull(); expect(empty.values.totalYen).toBeNull();
    expect(extractReceipt("合計 0円").values.totalYen).toBe(0);
  });
  it("leaves conflicting totals unresolved", () => { const result = extractReceipt("合計 3300円\n合計 3600円"); expect(result.values.totalYen).toBeNull(); expect(result.candidates.totals).toHaveLength(2); });
  it("does not mistake item counts or tax totals for a purchase total", () => { expect(extractReceipt("合計点数 3\n消費税合計 300円").values.totalYen).toBeNull(); });
  it("rejects impossible dates and normalizes fullwidth characters", () => { expect(validDate(2026, 2, 30)).toBeNull(); expect(extractReceipt("２０２６年９月２１日\n合計\n￥３，３００").values.totalYen).toBe(3300); });
  it("does not classify a convenience store by its name", () => { expect(rulesClassifier.classify({ merchant: "コンビニ", totalYen: 400, items: [], text: "コンビニ\n合計 400円", availableCategories: ["消耗品費"] }).category).toBeNull(); });
  it("retains evidence and explicit category rule as a suggestion", () => { const result = extractReceipt("コピー用紙 500円\n合計 500円"); expect(result.values.category).toBe("消耗品費"); expect(result.classification.rules).toContain("explicit-office-supplies-v1"); expect(result.candidates.totals[0].evidence.line).toBe(1); });
  it("preserves multiple tax rates without fabricating missing tax amounts", () => { const result = extractReceipt("8%対象 108円\n10%消費税 20円\n合計 328円"); expect(result.values.taxes).toEqual([{ rate: 8, taxableYen: 108, taxYen: null }, { rate: 10, taxYen: 20, taxableYen: null }]); });
});
