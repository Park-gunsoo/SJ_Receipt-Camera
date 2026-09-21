import { describe, expect, it } from "vitest";
import { accountCategoryNames, categoryOption } from "../src/lib/account-categories";
import { rulesClassifier } from "../src/lib/classifier";
import { extractReceipt } from "../src/lib/extraction";
const classify = (text: string) => rulesClassifier.classify({ merchant: null, text, items: [], totalYen: 1100, availableCategories: accountCategoryNames });
describe("common bookkeeping suggestions", () => {
  it.each([
    ["タクシー 乗車料金 1100円", "旅費交通費"], ["ENEOS\nハイオク 30.0L", "車両費"], ["ゆうパック 運賃 700円", "荷造運賃"],
    ["切手 110円", "通信費"], ["ボールペン 100円", "消耗品費"], ["書籍 ISBN 123", "新聞図書費"], ["会議室利用料 5000円", "会議費"],
    ["振込手数料 330円", "支払手数料"], ["事務所使用料 100000円", "地代家賃"], ["セミナー受講 6000円", "研修費"],
  ])("suggests a common category from explicit evidence: %s", (text, category) => { expect(classify(text).category).toBe(category); });
  it("offers purpose-dependent food alternatives without inferring deductible entertainment", () => {
    const result = classify("レストラン お食事代 1100円");
    expect(result.category).toBeNull(); expect(result.candidates).toEqual(["会議費", "接待交際費", "福利厚生費"]);
  });
  it("does not read the fare label as rent, or payment stamps as purchased postage", () => {
    expect(classify("タクシー\n運賃料金計 3400円").category).toBe("旅費交通費");
    expect(classify("ゆうパック 運賃 700円\n支払 現金0円\n切手700円").category).toBe("荷造運賃");
  });
  it("does not infer vehicle expense from an ambiguous regular-size product", () => {
    expect(classify("レギュラー 350円").category).toBeNull();
  });
  it("does not classify convenience stores, medicine or unreadable receipts as miscellaneous", () => {
    for (const text of ["コンビニ 合計 400円", "welcia 医薬品 500円", "読めない文字"]) expect(classify(text).category).toBeNull();
  });
  it("ignores promotional/footer words and does not merge conflicting purchase purposes", () => {
    expect(classify("コピー用紙 500円\n次回コーヒークーポン").category).toBe("消耗品費");
    const result = classify("ボールペン 100円\n切手 110円"); expect(result.category).toBeNull(); expect(result.candidates).toHaveLength(2);
  });
  it("requires equipment review regardless of a simplistic total threshold", () => {
    const result = classify("MacBook 本体 99000円"); expect(result.category).toBeNull(); expect(result.candidates).toContain("工具器具備品");
  });
  it("retains canonical Japanese names and extraction evidence with localized choices", () => {
    expect(categoryOption("車両費", "ko")).toBe("차량비 · 車両費");
    expect(extractReceipt("2026/09/21\n給油 ハイオク\n合計 1100円").classification.version).toBe("rules-2");
    expect(extractReceipt("2026/09/21\n給油 ハイオク\n合計 1100円").values.totalYen).toBe(1100);
  });
});
