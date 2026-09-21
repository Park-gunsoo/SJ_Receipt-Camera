import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), metadata: vi.fn() }));
vi.mock("@google-cloud/storage", () => ({ Storage: class { bucket() { return { file: () => ({ save: mocks.save, getMetadata: mocks.metadata }) }; } } }));
vi.mock("@/lib/google-cloud", () => ({ googleCloudOptions: () => ({ projectId: "unit-test" }) }));
import { pdfExists, savePdf } from "../src/lib/storage";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("GCS_BUCKET", "unit-test-private"); });
afterEach(() => vi.unstubAllEnvs());
describe("immutable PDF storage", () => {
  it("accepts a concurrent write for the same original even if PDF timestamps differ", async () => {
    mocks.save.mockRejectedValue({ code: 412 });
    mocks.metadata.mockResolvedValue([{ contentType: "application/pdf", size: "100", metadata: { sourceSha256: "original-checksum" } }]);
    await expect(savePdf("private/original", Buffer.from("%PDF-another-timestamp"), "original-checksum")).resolves.toBeUndefined();
  });
  it("never acknowledges a PDF belonging to different original bytes", async () => {
    mocks.metadata.mockResolvedValue([{ contentType: "application/pdf", size: "100", metadata: { sourceSha256: "different-original" } }]);
    await expect(pdfExists("private/original", "expected-original")).rejects.toThrow("PDF_OBJECT_CONFLICT");
  });
});
