import { describe, expect, it } from "vitest";
import { extractReceipt, validDate } from "../src/lib/extraction";
import { rulesClassifier } from "../src/lib/classifier";

describe("Japanese receipt extraction", () => {
  it("joins printed rows when OCR returns labels and amounts in separate columns", () => {
    const word = (text: string, x: number, y: number) => ({ symbols: [...text].map(text => ({ text })), boundingBox: { vertices: [{ x, y }, { x: x + 80, y }, { x: x + 80, y: y + 16 }, { x, y: y + 16 }] } });
    const pages = [{ blocks: [{ paragraphs: [{ words: [word("合計", 10, 10), word("10%税抜対象額", 10, 40), word("10%税額", 10, 70)] }, { words: [word("¥990", 250, 10), word("¥900", 250, 40), word("¥90", 250, 70)] }] }] }];
    const result = extractReceipt("合計\n10%税抜対象額\n10%税額\n¥990\n¥900\n¥90", pages);
    expect(result.values.totalYen).toBe(990); expect(result.values.taxes).toEqual([{ rate: 10, taxableYen: 900, taxYen: 90 }]);
  });
  it("supports a printed decimal rate without inventing an unprinted tax amount", () => {
    const result = extractReceipt("運賃料金計 2200円\n消費税率\n10.0%");
    expect(result.values.totalYen).toBe(2200); expect(result.values.taxes).toEqual([{ rate: 10, taxableYen: null, taxYen: null }]);
  });
  it("uses weekday consistency to reject a misread year without using the capture date", () => {
    const result = extractReceipt("2016年04月05日(日) 13:00\n交通系IC取扱日\n2026/04/05 13:00:00");
    expect(result.values.transactionDate).toBe("2026-04-05"); expect(result.reasons).toContain("日付と曜日が一致しません。原本を確認してください");
  });
  it("supports short years and Japanese eras but rejects impossible era dates", () => {
    expect(extractReceipt("26/04/05 13:00").values.transactionDate).toBe("2026-04-05");
    expect(extractReceipt("令和8年4月5日").values.transactionDate).toBe("2026-04-05");
    expect(extractReceipt("R08.4.5").values.transactionDate).toBe("2026-04-05");
    expect(extractReceipt("令和 8 年 4 月 5 日").values.transactionDate).toBe("2026-04-05");
    expect(extractReceipt("R 08 . 4 . 5").values.transactionDate).toBe("2026-04-05");
    expect(extractReceipt("令和元年1月1日").values.transactionDate).toBeNull();
  });
  it("associates a rate-free tax row with its adjacent tax group", () => {
    expect(extractReceipt("8%対象 1080円\n内消費税 80円\n10%対象 1100円\n内消費税 100円").values.taxes).toEqual([{ rate: 8, taxableYen: 1080, taxYen: 80 }, { rate: 10, taxableYen: 1100, taxYen: 100 }]);
  });
  it("does not turn a negative total or a discount percentage into positive tax data", () => {
    expect(extractReceipt("合計 -¥300").values.totalYen).toBeNull();
    expect(extractReceipt("8%対象 108円\n割引10%\n合計 108円").values.taxes.map(tax => tax.rate)).toEqual([8]);
  });
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
