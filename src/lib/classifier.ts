import type { Classifier, ClassificationInput } from "./contracts";

// Provider boundary: add a future TypeSafe implementation here without changing intake/OCR/Drive.
export const rulesClassifier: Classifier = {
  classify(input: ClassificationInput) {
    const rules: string[] = [];
    const found = new Set<string>();
    if (/コピー用紙|ボールペン|プリンター用紙/.test(input.text)) { found.add("消耗品費"); rules.push("explicit-office-supplies-v1"); }
    if (/タクシー|運賃|乗車料金/.test(input.text)) { found.add("旅費交通費"); rules.push("explicit-transport-v1"); }
    const candidates = [...found].filter(value => input.availableCategories.includes(value));
    const category = candidates.length === 1 ? candidates[0] : null;
    return { category, rules, reasons: category ? ["用途と勘定科目の確認が必要です"] : [candidates.length > 1 ? "複数の勘定科目候補があります" : "用途を判断できる情報が不足しています"], method: "rules", version: "rules-1" };
  },
};
