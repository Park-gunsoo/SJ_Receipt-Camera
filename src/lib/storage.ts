import { Storage } from "@google-cloud/storage";
import { env } from "./config";
import { googleCloudOptions } from "./google-cloud";
let client: Storage | undefined;
function bucket() { client ??= new Storage(googleCloudOptions()); return client.bucket(env("GCS_BUCKET")); }
export const incomingKey = (key: string) => `${key}.incoming`;
export async function uploadPolicy(key: string, mimeType: string, checksum: string, byteLength: number) {
  // Browser may write only a bounded staging object, never the accepted original.
  const [policy] = await bucket().file(incomingKey(key)).generateSignedPostPolicyV4({
    expires: Date.now() + 5 * 60000,
    fields: { "Content-Type": mimeType, "x-goog-meta-sha256": checksum, success_action_status: "201" },
    conditions: [["content-length-range", byteLength, byteLength]],
  });
  return policy;
}
export async function signedReadUrl(key: string) {
  const [url] = await bucket().file(key).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 60000 });
  return url;
}
export async function saveImage(key: string, bytes: Buffer, mimeType: string, checksum: string) {
  try {
    await bucket().file(key).save(bytes, { resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: mimeType, cacheControl: "private, no-store", metadata: { sha256: checksum } } });
  } catch (error) {
    if ((error as { code?: number }).code !== 412) throw error;
    if (!await imageExists(key, checksum, bytes.length)) throw new Error("OBJECT_CONFLICT");
  }
}
export async function imageExists(key: string, checksum: string, size: number) {
  try {
    const [metadata] = await bucket().file(key).getMetadata();
    return metadata.metadata?.sha256 === checksum && Number(metadata.size) === size;
  } catch (error) { if ((error as { code?: number }).code === 404) return false; throw error; }
}
export async function readImage(key: string) { const [data] = await bucket().file(key).download(); return data; }
