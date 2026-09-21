import ExcelJS from "exceljs";
import { z } from "zod";
import type { ExportReceipt } from "./receipt-ledger";
import { categoryOption } from "./account-categories";
import { displayText, translate, type Locale } from "./i18n";
import { AppError } from "./http";

export const receiptExportSchema = z.strictObject({ locale: z.enum(["ja", "ko", "en"]), scope: z.enum(["filtered", "all"]), query: z.string().max(4096) });
export const MAX_XLSX_BYTES = 4 * 1024 * 1024;
function safeText(value: string | null | undefined) {
  if (!value) return null;
  if (value.length > 32767) throw new AppError("EXPORT_TEXT_LIMIT", 422);
  // XML 1.0 cannot encode these controls. Formula-looking receipt text remains a string cell.
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "\ufffd");
}
const purchaseDate = (value: string | null) => value ? new Date(`${value}T00:00:00Z`) : null;
const jstDate = (value: Date) => new Date(value.getTime() + 9 * 60 * 60 * 1000);

export async function createReceiptWorkbook(receipts: ExportReceipt[], locale: Locale, scope: "filtered" | "all", exportedAt = new Date()) {
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(locale, key, params);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SJ Receipt Camera"; workbook.created = exportedAt; workbook.modified = exportedAt;
  const main = workbook.addWorksheet(t("レシート帳簿"));
  const taxes = workbook.addWorksheet(t("税率別明細"));
  const mainHeaders = [t("利用日"), t("店舗名"), t("摘要"), t("勘定科目"), `${t("合計金額")} (JPY)`, t("支払方法"), t("登録番号"), t("読み取り状況"), t("PDF保存状況"), t("Driveバックアップ"), t("修正状況"), `${t("受付日時")} (JST)`, t("レシートID")];
  const taxHeaders = [t("レシートID"), t("利用日"), t("店舗名"), t("税率"), `${t("対象額（原本表記）")} (JPY)`, `${t("税額")} (JPY)`];
  const scopeLabel = t(scope === "all" ? "すべてのレシート" : "現在の検索結果すべて");
  const stamp = jstDate(exportedAt).toISOString().slice(0, 19).replace("T", " ");
  function setup(sheet: ExcelJS.Worksheet, headers: string[], widths: number[]) {
    sheet.columns = widths.map(width => ({ width }));
    sheet.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
    sheet.mergeCells(1, 1, 1, headers.length); sheet.getCell(1, 1).value = `SJ ${sheet.name}`;
    sheet.getCell(1, 1).font = { name: "Yu Gothic", size: 18, bold: true, color: { argb: "FF163E52" } }; sheet.getRow(1).height = 32;
    sheet.mergeCells(2, 1, 2, headers.length); sheet.getCell(2, 1).value = `${scopeLabel}  /  ${t("レシート {count}件", { count: receipts.length })}  /  ${stamp} JST`;
    sheet.getCell(2, 1).font = { name: "Yu Gothic", size: 10, color: { argb: "FF526C7A" } }; sheet.getRow(2).height = 24;
    sheet.mergeCells(3, 1, 3, headers.length); sheet.getCell(3, 1).value = t("空欄は未確認です。税額は原本の認識・修正値で、科目は候補です。");
    sheet.getCell(3, 1).font = { name: "Yu Gothic", size: 10, color: { argb: "FF526C7A" } }; sheet.getRow(3).height = 28;
    const header = sheet.getRow(4); header.values = headers; header.height = 34;
    header.eachCell(cell => { cell.font = { name: "Yu Gothic", size: 11, bold: true, color: { argb: "FF163E52" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEDF7" } }; cell.alignment = { vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FFB5D3E3" } } }; });
  }
  setup(main, mainHeaders, [15, 30, 48, 34, 20, 20, 20, 20, 22, 24, 16, 24, 39]);
  setup(taxes, taxHeaders, [39, 15, 30, 14, 27, 20]);
  const add = (sheet: ExcelJS.Worksheet, values: ExcelJS.CellValue[], dateColumns: number[], amountColumns: number[]) => {
    const row = sheet.addRow(values);
    const lines = Math.max(1, ...values.map((value, index) => typeof value !== "string" ? 1 : value.split(/\r?\n/).reduce((sum, line) => {
      const visualWidth = [...line].reduce((width, character) => width + (character.codePointAt(0)! > 255 ? 2 : 1), 0);
      return sum + Math.max(1, Math.ceil(visualWidth / Math.max(8, (sheet.getColumn(index + 1).width ?? 12) - 2)));
    }, 0)));
    row.height = Math.min(409, Math.max(30, lines * 16));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: "Yu Gothic", size: 11, color: { argb: "FF243D4B" } };
      cell.alignment = { vertical: "top", wrapText: true, horizontal: amountColumns.includes(col) ? "right" : "left" };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2EAF0" } } };
      if (row.number % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F9FC" } };
      if (dateColumns.includes(col)) cell.numFmt = "yyyy-mm-dd";
      if (amountColumns.includes(col)) cell.numFmt = "#,##0";
    });
    return row;
  };
  for (const receipt of receipts) {
    const v = receipt.values;
    const category = v?.category ? categoryOption(v.category, locale) : null;
    const row = add(main, [purchaseDate(receipt.transactionDate), safeText(receipt.merchant), safeText(v?.summary), safeText(category), receipt.totalYen, v?.paymentMethod ? safeText(displayText(v.paymentMethod, locale)) : null, safeText(v?.registrationNumber), t(receipt.ocrState === "DONE" ? "読み取り済み" : receipt.ocrState === "FAILED" ? "読み取り失敗" : receipt.ocrState === "LIMIT_REACHED" ? "読み取り待ち" : "読み取り中"), t(receipt.pdfState === "SAVED" ? "PDF保存済み" : receipt.pdfState === "FAILED" ? "PDF保存の確認が必要" : "PDFを作成中"), t(receipt.archiveState === "SAVED" ? "Drive保存済み" : receipt.archiveState === "NOT_REQUESTED" ? "Driveバックアップなし" : ["FAILED", "BLOCKED"].includes(receipt.archiveState) ? "保存の確認が必要" : "Driveバックアップ待ち"), t(receipt.userEdited ? "修正済み" : "未修正"), jstDate(receipt.createdAt), receipt.id], [1, 12], [5]);
    row.getCell(12).numFmt = "yyyy-mm-dd hh:mm:ss";
    for (const tax of v?.taxes ?? []) {
      const detail = add(taxes, [receipt.id, purchaseDate(receipt.transactionDate), safeText(receipt.merchant), tax.rate === null ? null : tax.rate / 100, tax.taxableYen, tax.taxYen], [2], [5, 6]);
      detail.getCell(4).numFmt = "0.##%";
    }
  }
  for (const sheet of [main, taxes]) sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, sheet.rowCount), column: sheet.columnCount } };
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  if (bytes.byteLength > MAX_XLSX_BYTES) throw new AppError("EXPORT_FILE_LIMIT", 422);
  return bytes;
}
