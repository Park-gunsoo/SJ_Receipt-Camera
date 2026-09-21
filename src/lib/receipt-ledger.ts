import { Prisma, type Receipt } from "@/generated/prisma/client";
import { db } from "./db";
import type { LedgerQuery } from "./ledger-query";
import { receiptView } from "./receipts";

export async function listReceiptLedger(userId: string, query: LedgerQuery) {
  const clauses = [Prisma.sql`r."userId" = ${userId}`, Prisma.sql`r."deletedAt" IS NULL`, Prisma.sql`r."intakeState" = 'ACCEPTED'`];
  if (query.q) {
    const literal = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
    clauses.push(Prisma.sql`(COALESCE(r.merchant, '') ILIKE ${literal} OR COALESCE(r.values->>'summary', '') ILIKE ${literal})`);
  }
  if (query.from) clauses.push(Prisma.sql`r."transactionDate" >= ${query.from}`);
  if (query.to) clauses.push(Prisma.sql`r."transactionDate" <= ${query.to}`);
  if (query.category === "__unassigned__") clauses.push(Prisma.sql`COALESCE(r.values->>'category', '') = ''`);
  else if (query.category) clauses.push(Prisma.sql`r.values->>'category' = ${query.category}`);
  if (query.min !== undefined) clauses.push(Prisma.sql`r."totalYen" >= ${query.min}`);
  if (query.max !== undefined) clauses.push(Prisma.sql`r."totalYen" <= ${query.max}`);
  if (query.status === "DONE") clauses.push(Prisma.sql`r."ocrState" = 'DONE'`);
  if (query.status === "processing") clauses.push(Prisma.sql`r."ocrState" IN ('PENDING', 'PROCESSING')`);
  if (query.status === "failed") clauses.push(Prisma.sql`r."ocrState" IN ('FAILED', 'LIMIT_REACHED')`);
  if (query.edited !== "all") clauses.push(Prisma.sql`r."userEdited" = ${query.edited === "yes"}`);
  const column = { date: 'r."transactionDate"', amount: 'r."totalYen"', merchant: 'r.merchant', received: 'r."createdAt"' }[query.sort];
  const order = Prisma.sql`${Prisma.raw(column)} ${Prisma.raw(query.direction === "asc" ? "ASC" : "DESC")} NULLS LAST, r.id DESC`;
  const where = Prisma.join(clauses, " AND ");
  return db().$transaction(async tx => {
    const count = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM "Receipt" r WHERE ${where}`);
    const total = Number(count[0].total);
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
    const rows = await tx.$queryRaw<Receipt[]>(Prisma.sql`SELECT r.* FROM "Receipt" r WHERE ${where} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}`);
    const categories = await tx.$queryRaw<{ category: string }[]>(Prisma.sql`SELECT DISTINCT r.values->>'category' AS category FROM "Receipt" r WHERE r."userId" = ${userId} AND r."deletedAt" IS NULL AND r."intakeState" = 'ACCEPTED' AND COALESCE(r.values->>'category', '') <> '' ORDER BY category LIMIT 200`);
    return { receipts: rows.map(receiptView), total, page, pageSize: query.pageSize, categories: categories.map(row => row.category) };
  }, { isolationLevel: "RepeatableRead" });
}
