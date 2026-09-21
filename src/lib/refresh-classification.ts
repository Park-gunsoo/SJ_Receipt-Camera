import { db } from "./db";
import type { Extraction, ReceiptValues } from "./contracts";
import { Prisma } from "@/generated/prisma/client";
import { extractReceipt } from "./extraction";
import { isDeepStrictEqual } from "node:util";

/** Operational backfill of suggestions from cached OCR; never re-read the image or alter human values. */
export async function refreshReceiptClassification(userId: string, id: string) {
  return db().$transaction(async tx => {
    const receipt = await tx.receipt.findFirst({ where: { id, userId, deletedAt: null, intakeState: "ACCEPTED", ocrState: "DONE" } });
    if (!receipt) return "skipped" as const;
    const raw = receipt.rawOcr as { text?: string; pages?: unknown[] } | null;
    if (!raw?.text) return "skipped" as const;
    const previous = receipt.extraction as Extraction | null;
    const classification = extractReceipt(raw.text, raw.pages).classification;
    if (isDeepStrictEqual(previous?.classification, classification)) return "unchanged" as const;
    const values = receipt.values as ReceiptValues | null;
    const oldReasons = new Set(previous?.classification?.reasons ?? []);
    const changed = await tx.receipt.updateMany({ where: { id, userId, version: receipt.version, deletedAt: null, ocrState: "DONE" }, data: {
      extraction: { ...(previous as unknown as Record<string, Prisma.InputJsonValue> ?? {}), ...(previous?.values ? { values: { ...previous.values, category: classification.category } } : {}), classification } as unknown as Prisma.InputJsonValue,
      ...(!receipt.userEdited && values ? { values: { ...values, category: classification.category } as Prisma.InputJsonValue } : {}),
      reviewReasons: [...new Set([...receipt.reviewReasons.filter(reason => !oldReasons.has(reason)), ...classification.reasons])],
      version: { increment: 1 },
    } });
    return changed.count ? "updated" as const : "conflict" as const;
  });
}
