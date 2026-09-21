import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), begin: vi.fn(), finish: vi.fn(), policy: vi.fn(), owned: vi.fn(), signed: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/config", () => ({ configuration: () => ({ ready: true }), setting: () => 12 }));
vi.mock("@/lib/receipts", () => ({ beginIntake: mocks.begin, finishUpload: mocks.finish, ownedReceipt: mocks.owned, receiptView: (r: unknown) => r }));
vi.mock("@/lib/storage", () => ({ uploadPolicy: mocks.policy, pdfKey: (key: string) => `${key}.pdf`, signedReadUrl: mocks.signed }));
vi.mock("@/lib/queue", () => ({ dispatchPending: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({ driveConnection: { update: mocks.update } }) }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { POST } from "../src/app/api/uploads/route";
import { GET as pdf } from "../src/app/api/receipts/[id]/pdf/route";
import { PATCH as settings } from "../src/app/api/drive/settings/route";
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("APP_URL", "https://app.example.test");
  mocks.user.mockResolvedValue({ id: "owner", drive: null });
  mocks.begin.mockResolvedValue({ id: "receipt", objectKey: "private/original", checksum: "a".repeat(64) });
  mocks.finish.mockResolvedValue(null); mocks.policy.mockResolvedValue({ url: "https://storage.example.test", fields: {} });
});
const request = (path: string, body: unknown, owner = "owner") => new Request(`https://app.example.test${path}`, { method: path.includes("settings") ? "PATCH" : "POST", headers: { Origin: "https://app.example.test", "Content-Type": "application/json", "X-SJ-Owner": owner }, body: JSON.stringify(body) });
afterEach(() => vi.unstubAllEnvs());
describe("optional Drive API boundary", () => {
  it("issues the direct upload form to a signed-in user with no Drive connection", async () => {
    const response = await POST(request("/api/uploads", { captureId: "0a75cbb2-bc26-4dfb-b614-12d4d81dba1f", capturedAt: "2026-09-21T00:00:00Z", checksum: "a".repeat(64), byteLength: 10, mimeType: "image/jpeg" }));
    expect(response.status).toBe(200); expect((await response.json()).upload.url).toBe("https://storage.example.test"); expect(mocks.policy).toHaveBeenCalledOnce();
  });
  it("opens an owned app PDF without any Drive file or connection", async () => {
    mocks.owned.mockResolvedValue({ pdfState: "SAVED", objectKey: "private/original", driveFileId: null, archiveState: "NOT_REQUESTED" });
    mocks.signed.mockResolvedValue("https://storage.example.test/private.pdf?temporary=unit-test");
    const response = await pdf(new Request("https://app.example.test/api/receipts/receipt/pdf"), { params: Promise.resolve({ id: "receipt" }) });
    expect(mocks.owned).toHaveBeenCalledWith("owner", "receipt"); expect(mocks.signed).toHaveBeenCalledWith("private/original.pdf");
    expect(response.status).toBe(307); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("changes only the authenticated owner's backup preference", async () => {
    mocks.user.mockResolvedValue({ id: "owner", drive: { status: "CONNECTED", backupEnabled: true } });
    mocks.update.mockResolvedValue({ backupEnabled: false });
    expect((await settings(request("/api/drive/settings", { backupEnabled: false }, "other-owner"))).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    const response = await settings(request("/api/drive/settings", { backupEnabled: false }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ backupEnabled: false });
    expect(mocks.update).toHaveBeenCalledWith({ where: { userId: "owner" }, data: { backupEnabled: false }, select: { backupEnabled: true } });
  });
  it("allows disabling a broken connection, but asks for reconnect before enabling it", async () => {
    mocks.user.mockResolvedValue({ id: "owner", drive: { status: "DRIVE_RECONNECT", backupEnabled: true } });
    mocks.update.mockResolvedValue({ backupEnabled: false });
    expect((await settings(request("/api/drive/settings", { backupEnabled: true }))).status).toBe(409);
    expect((await settings(request("/api/drive/settings", { backupEnabled: false }))).status).toBe(200);
  });
});
