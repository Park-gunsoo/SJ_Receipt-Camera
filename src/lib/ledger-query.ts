import { z } from "zod";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const money = z.string().regex(/^\d{1,9}$/).transform(Number);
const input = z.object({
  q: z.string().trim().max(100).default(""), from: date.optional(), to: date.optional(),
  category: z.string().max(80).default(""), min: money.optional(), max: money.optional(),
  status: z.enum(["all", "DONE", "processing", "failed"]).default("all"),
  edited: z.enum(["all", "yes", "no"]).default("all"),
  sort: z.enum(["date", "amount", "merchant", "received"]).default("date"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().refine(value => [25, 50, 100].includes(value)).default(25),
}).refine(value => !value.from || !value.to || value.from <= value.to)
  .refine(value => value.min === undefined || value.max === undefined || value.min <= value.max);
export type LedgerQuery = z.infer<typeof input>;
export function parseLedgerQuery(params: URLSearchParams) {
  return input.safeParse(Object.fromEntries([...params].filter(([, value]) => value !== "")));
}
export const defaultLedgerQuery: LedgerQuery = { q: "", category: "", status: "all", edited: "all", sort: "date", direction: "desc", page: 1, pageSize: 25 };
export function ledgerQueryString(query: LedgerQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "" && value !== defaultLedgerQuery[key as keyof LedgerQuery]) params.set(key, String(value));
  return params.toString();
}
