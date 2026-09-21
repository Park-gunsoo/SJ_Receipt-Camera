import { afterEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "../src/lib/crypto";
import { allowedEmail } from "../src/lib/config";
import { boundedFormData, sameOrigin } from "../src/lib/http";
describe("credential and access boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("encrypts tokens with an authenticated random nonce", () => { vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")); const token = encrypt("private-refresh-token"); expect(token).not.toContain("private-refresh-token"); expect(decrypt(token)).toBe("private-refresh-token"); expect(encrypt("private-refresh-token")).not.toBe(token); const parts = token.split("."); parts[2] = Buffer.from("tampered").toString("base64url"); expect(() => decrypt(parts.join("."))).toThrow(); });
  it("rejects missing allowlist and uninvited users", () => { vi.stubEnv("TESTER_EMAILS", ""); expect(allowedEmail("a@example.test")).toBe(false); vi.stubEnv("TESTER_EMAILS", "a@example.test"); expect(allowedEmail("A@example.test")).toBe(true); expect(allowedEmail("b@example.test")).toBe(false); });
  it("rejects cross-site mutations", () => { vi.stubEnv("APP_URL", "https://receipt.example.test"); expect(() => sameOrigin(new Request("https://receipt.example.test/api/receipts", { headers: { origin: "https://evil.example.test" } }))).toThrow("INVALID_ORIGIN"); expect(() => sameOrigin(new Request("https://receipt.example.test/api/receipts", { headers: { origin: "https://receipt.example.test" } }))).not.toThrow(); });
  it("bounds uploads even without a trusted Content-Length header", async () => {
    const form = new FormData(); form.set("image", new Blob(["12345"], { type: "image/jpeg" }), "receipt.jpg");
    const request = new Request("http://localhost/api/receipts", { method: "POST", body: form });
    await expect(boundedFormData(request, 4)).rejects.toThrow("FILE_TOO_LARGE");
    const valid = new Request("http://localhost/api/receipts", { method: "POST", body: form });
    expect((await boundedFormData(valid, 4096)).get("image")).toBeInstanceOf(File);
  });
});
