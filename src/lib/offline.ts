import { openDB, type DBSchema } from "idb";

export type PendingCapture = { key: string; ownerId: string; captureId: string; capturedAt: string; blob: Blob; error?: string };
interface PendingDatabase extends DBSchema {
  captures: { key: string; value: PendingCapture; indexes: { owner: string } };
}
const database = () => openDB<PendingDatabase>("sj-receipt-pending-v1", 1, {
  upgrade(db) { const store = db.createObjectStore("captures", { keyPath: "key" }); store.createIndex("owner", "ownerId"); },
});
export const captureKey = (ownerId: string, captureId: string) => `${ownerId}:${captureId}`;
export async function putPending(capture: PendingCapture) { return (await database()).put("captures", capture); }
export async function listPending(ownerId: string) { return (await database()).getAllFromIndex("captures", "owner", ownerId); }
export async function deletePending(ownerId: string, captureId: string) { return (await database()).delete("captures", captureKey(ownerId, captureId)); }
