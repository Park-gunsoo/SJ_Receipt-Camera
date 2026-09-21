import { describe, expect, it } from "vitest";
import { receiptEditSchema } from "../src/lib/receipt-editor";
import { boundedJson } from "../src/lib/http";
const values = { merchant: "Store", transactionDate: "2026-04-05", totalYen: 0, taxes: [{ rate: 10, taxableYen: 0, taxYen: 0 }], paymentMethod: null, registrationNumber: null, category: null, summary: null };
describe("editor input boundary", () => {
  it("keeps zeros while rejecting impossible dates, negative/fractional yen and hidden fields", () => {
    expect(receiptEditSchema.parse({ version: 1, values }).values.totalYen).toBe(0);
    for (const patch of [{ transactionDate: "2026-02-30" }, { totalYen: -1 }, { totalYen: 12.5 }, { ownerId: "other" }, { registrationNumber: "T123" }]) expect(receiptEditSchema.safeParse({ version: 1, values: { ...values, ...patch } }).success).toBe(false);
    expect(receiptEditSchema.safeParse({ version: 1, userId: "other", values }).success).toBe(false);
  });
  it("bounds actual JSON bytes even when Content-Length is absent or misleading", async () => {
    const request = (body: string) => new Request("https://example.test", { method: "PATCH", headers: { "Content-Type": "application/json", "Content-Length": "1" }, body });
    await expect(boundedJson(request('{"text":"too long"}'), 5)).rejects.toThrow("INVALID_INPUT");
    await expect(boundedJson(request('not json'))).rejects.toThrow("INVALID_INPUT");
    await expect(boundedJson(request('{"version":1}'))).resolves.toEqual({ version: 1 });
  });
});
