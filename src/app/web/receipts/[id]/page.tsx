import { WebReceiptEditor } from "@/components/web-receipt-editor";
import { ledgerQueryString, parseLedgerQuery } from "@/lib/ledger-query";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string | string[] }> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const back = typeof search.back === "string" ? parseLedgerQuery(new URLSearchParams(search.back)) : null;
  const query = back?.success ? ledgerQueryString(back.data) : "";
  return <WebReceiptEditor key={id} id={id} returnHref={`/web/receipts${query ? `?${query}` : ""}`} />;
}
