import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { captureKey, putPending, listPending, deletePending } from "../src/lib/offline";
it("keeps each account's pending photos separate across reopens and cleanup", async () => {
  const id = "same-capture-id";
  for (const ownerId of ["owner-a", "owner-b"]) await putPending({ key: captureKey(ownerId, id), ownerId, captureId: id, capturedAt: new Date().toISOString(), blob: new Blob([ownerId], { type: "image/jpeg" }) });
  expect((await listPending("owner-a")).map(v => v.ownerId)).toEqual(["owner-a"]);
  expect(await listPending("owner-c")).toEqual([]);
  await deletePending("owner-a", id);
  expect(await listPending("owner-a")).toEqual([]); expect(await listPending("owner-b")).toHaveLength(1);
});
