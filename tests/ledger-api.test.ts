import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/receipt-ledger", () => ({ listReceiptLedger: mocks.list }));
import { GET } from "../src/app/api/receipts/ledger/route";
import { AppError } from "../src/lib/http";
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); mocks.list.mockResolvedValue({ receipts: [], total: 0, page: 1, pageSize: 25, categories: [] }); });
describe("ledger API", () => {
  it("uses the authenticated owner even when a foreign owner is supplied", async () => {
    const response = await GET(new Request("https://app.example.test/api/receipts/ledger?userId=other&min=0"));
    expect(response.status).toBe(200); expect(mocks.list.mock.calls[0][0]).toBe("owner"); expect(mocks.list.mock.calls[0][1].min).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects unauthenticated reads before any query", async () => {
    mocks.user.mockRejectedValue(new AppError("UNAUTHORIZED", 401));
    expect((await GET(new Request("https://app.example.test/api/receipts/ledger"))).status).toBe(401); expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects unrecognized sort and invalid date/amount bounds before querying", async () => {
    for (const query of ["sort=rawOcr", "from=2026-02-30", "min=300&max=1"]) expect((await GET(new Request(`https://app.example.test/api/receipts/ledger?${query}`))).status).toBe(422);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
