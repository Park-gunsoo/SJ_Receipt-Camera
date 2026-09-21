import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), transition: vi.fn(), list: vi.fn(), owned: vi.fn(), signed: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/receipt-trash", async importOriginal => ({ ...await importOriginal<typeof import("../src/lib/receipt-trash")>(), setReceiptTrashed: mocks.transition, listTrashedReceipts: mocks.list }));
vi.mock("@/lib/receipts", () => ({ ownedReceipt: mocks.owned, receiptView: (r: unknown) => r }));
vi.mock("@/lib/storage", () => ({ signedReadUrl: mocks.signed, readImage: vi.fn(), pdfKey: (key: string) => `${key}.pdf` }));
vi.mock("@/lib/queue", () => ({ dispatchPending: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { AppError } from "../src/lib/http";
import { DELETE, GET as detail } from "../src/app/api/receipts/[id]/route";
import { POST as restore } from "../src/app/api/receipts/[id]/restore/route";
import { GET as trash } from "../src/app/api/receipts/trash/route";
import { GET as image } from "../src/app/api/receipts/[id]/image/route";
import { GET as pdf } from "../src/app/api/receipts/[id]/pdf/route";
const context = () => ({ params: Promise.resolve({ id: "receipt" }) });
const request = (method: string, body: unknown = { version: 2 }, owner = "owner", origin = "https://app.example.test") => new Request("https://app.example.test/api/receipts/receipt", { method, headers: { Origin: origin, "Content-Type": "application/json", "X-SJ-Owner": owner }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("APP_URL", "https://app.example.test");
  mocks.user.mockResolvedValue({ id: "owner" }); mocks.transition.mockResolvedValue({ id: "receipt", version: 3, trashed: true });
});
afterEach(() => vi.unstubAllEnvs());
describe("trash API boundaries", () => {
  it("requires same origin, signed-in owner and valid bounded input for both writes", async () => {
    for (const [method, action] of [["DELETE", DELETE], ["POST", restore]] as const) {
      expect((await action(request(method, { version: 2 }, "owner", "https://other.example.test"), context())).status).toBe(403);
      expect((await action(request(method, { version: 2 }, "wrong-owner"), context())).status).toBe(409);
      expect((await action(request(method, { version: -1 }), context())).status).toBe(422);
      expect((await action(request(method, { version: 2, permanent: true }), context())).status).toBe(422);
      expect((await action(request(method, { padding: "x".repeat(1100) }), context())).status).toBe(400);
    }
    expect(mocks.transition).not.toHaveBeenCalled();
    mocks.user.mockRejectedValue(new AppError("UNAUTHORIZED", 401));
    expect((await DELETE(request("DELETE"), context())).status).toBe(401);
    expect((await restore(request("POST"), context())).status).toBe(401);
    expect((await trash(new Request("https://app.example.test/api/receipts/trash"))).status).toBe(401);
  });
  it("passes only the authenticated owner and expected version into each transition", async () => {
    const deleted = await DELETE(request("DELETE"), context());
    expect(deleted.status).toBe(200); expect(deleted.headers.get("cache-control")).toContain("no-store");
    expect(mocks.transition).toHaveBeenLastCalledWith("owner", "receipt", 2, true);
    expect((await restore(request("POST"), context())).status).toBe(200);
    expect(mocks.transition).toHaveBeenLastCalledWith("owner", "receipt", 2, false);
    mocks.transition.mockRejectedValue(new AppError("RECEIPT_CHANGED", 409));
    expect((await restore(request("POST"), context())).status).toBe(409);
  });
  it("uses the session owner for the private trash list", async () => {
    mocks.list.mockResolvedValue({ receipts: [], nextCursor: null });
    const response = await trash(new Request("https://app.example.test/api/receipts/trash?userId=other&cursor=last"));
    expect(response.status).toBe(200); expect(mocks.list).toHaveBeenCalledWith("owner", "last");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("never signs or serves files after ownedReceipt rejects a trashed receipt", async () => {
    mocks.owned.mockRejectedValue(new AppError("NOT_FOUND", 404));
    for (const action of [detail, image, pdf]) expect((await action(new Request("https://app.example.test/api/receipts/receipt"), context())).status).toBe(404);
    expect(mocks.signed).not.toHaveBeenCalled();
  });
});
