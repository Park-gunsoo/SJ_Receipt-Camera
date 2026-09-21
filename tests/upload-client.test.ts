import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadCapture } from "../src/lib/upload-client";
import type { PendingCapture } from "../src/lib/offline";

afterEach(() => vi.unstubAllGlobals());
const item = (): PendingCapture => ({ key: "owner:capture", ownerId: "owner", captureId: "00000000-0000-4000-8000-000000000001", capturedAt: "2026-09-21T00:00:00.000Z", blob: new Blob([new Uint8Array(5 * 1024 * 1024)], { type: "image/jpeg" }) });
describe("direct upload protocol", () => {
  it("sends a photo larger than Vercel's body limit only to storage and waits for server acceptance", async () => {
    const photo = item(); const accepted = { id: "receipt", intakeState: "ACCEPTED" };
    const network = vi.fn()
      .mockResolvedValueOnce(Response.json({ receiptId: "receipt", upload: { url: "https://storage.googleapis.com/test-bucket", fields: { key: "incoming", policy: "signed-policy" } } }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ receipt: accepted }));
    vi.stubGlobal("fetch", network);
    expect(await uploadCapture(photo)).toEqual(accepted);
    const [initUrl, init] = network.mock.calls[0]; expect(initUrl).toBe("/api/uploads"); expect((init.body as string).length).toBeLessThan(1024); expect(init.headers["X-SJ-Owner"]).toBe("owner");
    const [storageUrl, upload] = network.mock.calls[1]; expect(storageUrl).toBe("https://storage.googleapis.com/test-bucket"); expect(upload.credentials).toBe("omit"); expect(upload.body.get("file").size).toBe(photo.blob.size);
    expect(network.mock.calls[2][0]).toBe("/api/uploads/receipt/complete");
  });
  it("does not upload a duplicate whose earlier response was lost", async () => {
    const accepted = { id: "receipt", intakeState: "ACCEPTED" }; const network = vi.fn().mockResolvedValue(Response.json({ receipt: accepted })); vi.stubGlobal("fetch", network);
    expect(await uploadCapture(item())).toEqual(accepted); expect(network).toHaveBeenCalledTimes(1);
  });
  it("does not mistake an upload response for receipt acceptance", async () => {
    const network = vi.fn().mockResolvedValueOnce(Response.json({ receiptId: "receipt", upload: { url: "https://storage.googleapis.com/test-bucket", fields: {} } })).mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(Response.json({ receipt: { intakeState: "UPLOADING" } })); vi.stubGlobal("fetch", network);
    await expect(uploadCapture(item())).rejects.toThrow("UPLOAD_PENDING");
  });
});
