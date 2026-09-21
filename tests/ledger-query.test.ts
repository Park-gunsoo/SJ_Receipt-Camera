import { describe, expect, it } from "vitest";
import { defaultLedgerQuery, ledgerQueryString, parseLedgerQuery } from "../src/lib/ledger-query";
describe("ledger filter contracts", () => {
  it("keeps zero yen, calendar dates and encoded Japanese categories on URL round trips", () => {
    const query = { ...defaultLedgerQuery, q: "ガソリン 100%", category: "車両費", min: 0, max: 5000, from: "2026-09-01", to: "2026-09-30", page: 2 };
    const parsed = parseLedgerQuery(new URLSearchParams(ledgerQueryString(query)));
    expect(parsed.success && parsed.data).toEqual(query);
  });
  it.each(["from=2026-02-30", "from=2026-10-01&to=2026-09-01", "min=300&max=100", "min=-1", "min=1.5", "sort=secret", "direction=DROP", "page=-1", "pageSize=10000", "status=confirmed"])("rejects malformed or unbounded filters: %s", value => {
    expect(parseLedgerQuery(new URLSearchParams(value)).success).toBe(false);
  });
});
