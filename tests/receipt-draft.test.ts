import { describe, expect, it } from "vitest";
import { editValues, toDraft } from "../src/lib/receipt-draft";
import type { ReceiptView } from "../src/lib/contracts";
describe("shared detail and inline draft handling", () => {
  it("preserves zero, unknowns, custom categories and non-list payment details", () => {
    const receipt = { merchant: "Store", transactionDate: null, totalYen: 0, values: { merchant: "Store", transactionDate: null, totalYen: 0, category: "Custom", summary: "memo", paymentMethod: "現金", registrationNumber: "T1234567890123", taxes: [{ rate: 0, taxableYen: 0, taxYen: 0 }] } } as ReceiptView;
    const draft = toDraft(receipt); expect(draft.totalYen).toBe("0"); expect(draft.transactionDate).toBe("");
    expect(editValues(draft)).toEqual(receipt.values);
  });
  it("rejects fractional/negative yen and preserves a blank tax amount as unknown", () => {
    const draft = toDraft({ merchant: null, totalYen: null, transactionDate: null, values: null } as ReceiptView);
    expect(() => editValues({ ...draft, totalYen: "1.5" })).toThrow("INVALID_INPUT");
    expect(() => editValues({ ...draft, totalYen: "-1" })).toThrow("INVALID_INPUT");
    expect(editValues({ ...draft, taxes: [{ rate: "10", taxableYen: "", taxYen: "" }] }).taxes).toEqual([{ rate: 10, taxableYen: null, taxYen: null }]);
  });
});
