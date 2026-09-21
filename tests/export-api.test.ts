import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn(), workbook: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/receipt-ledger", () => ({ exportReceiptLedger: mocks.list }));
vi.mock("@/lib/receipt-export", async original => ({ ...await original<typeof import("../src/lib/receipt-export")>(), createReceiptWorkbook: mocks.workbook }));
import { POST } from "../src/app/api/receipts/export/route";
import { AppError } from "../src/lib/http";
const request = (body: unknown, owner = "owner", origin = "https://app.example.test") => new Request("https://app.example.test/api/receipts/export", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-SJ-Owner": owner }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("APP_URL", "https://app.example.test"); mocks.user.mockResolvedValue({ id: "owner" }); mocks.list.mockResolvedValue([{ id: "a" }, { id: "b" }]); mocks.workbook.mockResolvedValue(new Uint8Array([80, 75, 3, 4])); });
afterEach(() => vi.unstubAllEnvs());
describe("private export API", () => {
  it("enforces origin, owner, authentication and language input before selecting data", async () => {
    const input = { locale: "ko", scope: "filtered", query: "" };
    expect((await POST(request(input, "owner", "https://other.example"))).status).toBe(403);
    expect((await POST(request(input, "other"))).status).toBe(409);
    expect((await POST(request({ ...input, locale: "fr" }))).status).toBe(422);
    expect((await POST(request({ ...input, userId: "other" }))).status).toBe(422);
    expect((await POST(request({ ...input, query: "from=2026-02-30" }))).status).toBe(422);
    expect(mocks.list).not.toHaveBeenCalled();
    mocks.user.mockRejectedValue(new AppError("UNAUTHORIZED", 401)); expect((await POST(request(input))).status).toBe(401);
  });
  it("uses the requested language and filter scope and returns a private XLSX attachment", async () => {
    const response = await POST(request({ locale: "en", scope: "filtered", query: "category=%E8%BB%8A%E4%B8%A1%E8%B2%BB&page=2" }));
    expect(response.status).toBe(200); expect(mocks.list.mock.calls[0][0]).toBe("owner"); expect(mocks.list.mock.calls[0][1].category).toBe("車両費");
    expect(mocks.workbook.mock.calls[0][1]).toBe("en"); expect(response.headers.get("content-type")).toContain("spreadsheetml");
    expect(response.headers.get("content-disposition")).toMatch(/_en\.xlsx/); expect(response.headers.get("x-sj-receipt-count")).toBe("2"); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("clears filters for all-record exports and propagates an explicit size limit error", async () => {
    await POST(request({ locale: "ja", scope: "all", query: "q=limited&page=2" })); expect(mocks.list.mock.calls[0][1].q).toBe("");
    mocks.list.mockRejectedValue(new AppError("EXPORT_LIMIT", 422)); expect((await POST(request({ locale: "ja", scope: "all", query: "" }))).status).toBe(422);
  });
});
