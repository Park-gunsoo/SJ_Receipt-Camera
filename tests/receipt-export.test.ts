import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createReceiptWorkbook } from "../src/lib/receipt-export";
import type { ExportReceipt } from "../src/lib/receipt-ledger";
import { categoryOption } from "../src/lib/account-categories";
import { translate } from "../src/lib/i18n";
const records: ExportReceipt[] = [{ id: "test-receipt-1", merchant: '=HYPERLINK("https://example.invalid","test")', transactionDate: "2026-09-21", totalYen: 0, createdAt: new Date("2026-09-20T15:01:00Z"), ocrState: "DONE", pdfState: "SAVED", archiveState: "NOT_REQUESTED", userEdited: true, values: { merchant: "source", transactionDate: "2026-09-21", totalYen: 0, category: "車両費", summary: "元の日本語メモ", taxes: [{ rate: 8, taxableYen: 0, taxYen: 0 }, { rate: 10, taxableYen: null, taxYen: null }], paymentMethod: "現金", registrationNumber: null, items: [] } }, { id: "test-receipt-2", merchant: null, transactionDate: null, totalYen: null, createdAt: new Date("2026-09-21T01:00:00Z"), ocrState: "LIMIT_REACHED", pdfState: "PENDING", archiveState: "BLOCKED", userEdited: false, values: null }];
describe("localized XLSX export", () => {
  it.each(["ja", "ko", "en"] as const)("creates a real %s workbook with typed values and all tax rows", async locale => {
    const bytes = await createReceiptWorkbook(records, locale, "filtered", new Date("2026-09-21T02:03:04Z"));
    expect(Buffer.from(bytes).subarray(0, 2).toString()).toBe("PK");
    const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(bytes).buffer);
    const main = book.getWorksheet(translate(locale, "レシート帳簿"))!, tax = book.getWorksheet(translate(locale, "税率別明細"))!;
    expect(book.worksheets).toHaveLength(2); expect(main.rowCount).toBe(6); expect(tax.rowCount).toBe(6);
    expect(main.getCell("A5").value).toEqual(new Date("2026-09-21T00:00:00Z")); expect(main.getCell("A6").value).toBeNull();
    expect(main.getCell("E5").value).toBe(0); expect(main.getCell("E6").value).toBeNull(); expect(main.getCell("E5").numFmt).toBe("#,##0");
    expect(main.getCell("B5").value).toBe(records[0].merchant); expect(main.getCell("B5").type).toBe(ExcelJS.ValueType.String); expect(main.getCell("B5").formula).toBeUndefined();
    expect(main.getCell("C5").value).toBe("元の日本語メモ"); expect(main.getCell("D5").value).toBe(categoryOption("車両費", locale));
    expect(main.getCell("L5").value).toEqual(new Date("2026-09-21T00:01:00Z"));
    expect(main.getCell("H6").value).toBe(translate(locale, "読み取り待ち")); expect(main.getCell("J6").value).toBe(translate(locale, "保存の確認が必要"));
    expect(tax.getCell("D5").value).toBe(0.08); expect(tax.getCell("F5").value).toBe(0); expect(tax.getCell("F6").value).toBeNull();
    expect(main.views[0]).toMatchObject({ state: "frozen", ySplit: 4 }); expect(main.autoFilter).toBe("A4:M6"); expect(tax.autoFilter).toBe("A4:F6");
  });
  it("exports an empty result with headers and never inserts a fake receipt or zero", async () => {
    const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(await createReceiptWorkbook([], "en", "all")).buffer);
    expect(book.worksheets[0].rowCount).toBe(4); expect(book.worksheets[0].getCell("E5").value).toBeNull();
  });
  it("fails rather than silently truncating a cell beyond Excel's native text limit", async () => {
    await expect(createReceiptWorkbook([{ ...records[0], merchant: "x".repeat(32768) }], "en", "all")).rejects.toThrow("EXPORT_TEXT_LIMIT");
  });
});
