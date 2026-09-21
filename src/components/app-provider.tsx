"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { captureKey, deletePending, listPending, putPending, type PendingCapture } from "@/lib/offline";
import type { ReceiptView } from "@/lib/contracts";
import { uploadCapture } from "@/lib/upload-client";

type Account = { configured: boolean; loginReady: boolean; user: { id: string; name: string | null; email: string } | null; drive: { status: string; backupEnabled: boolean; folderUrl: string | null } | null };
export type CaptureProgress = { captureId: string; phase: "sending" | "accepted" | "pending"; receipt?: ReceiptView; error?: string; localSaved?: boolean; elapsedMs?: number };
type AppContext = { account: Account | null; accountError: boolean; pendingCount: number; online: boolean; latest: CaptureProgress | null; refresh: () => Promise<void>; capture: (blob: Blob) => string; retry: () => Promise<void> };
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [latest, setLatest] = useState<CaptureProgress | null>(null);
  const current = useRef<Account | null>(null);
  const inflight = useRef(new Set<string>());
  const alive = useRef(true);
  const refreshCount = useCallback(async () => {
    const owner = current.current?.user?.id;
    if (!owner) { setPendingCount(0); return; }
    try { const list = await listPending(owner); if (current.current?.user?.id === owner && alive.current) setPendingCount(list.length); } catch { /* Capture surfaces storage failure itself. */ }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const value = await response.json() as Account;
      if (!alive.current) return;
      if (current.current?.user?.id !== value.user?.id) setLatest(null);
      current.current = value; setAccount(value); setAccountError(false);
      await refreshCount();
    } catch { if (alive.current) setAccountError(true); }
  }, [refreshCount]);
  const upload = useCallback(async (item: PendingCapture, localWrite: Promise<unknown> = Promise.resolve(true)) => {
    if (current.current?.user?.id !== item.ownerId || inflight.current.has(item.key)) return;
    inflight.current.add(item.key);
    const started = performance.now();
    let localSaved = true;
    const saved = localWrite.catch(() => { localSaved = false; if (current.current?.user?.id === item.ownerId) setLatest(previous => previous?.captureId === item.captureId ? { ...previous, localSaved: false, error: "LOCAL_STORAGE" } : previous); });
    try {
      if (!navigator.onLine) throw new Error("OFFLINE");
      const receipt = await uploadCapture(item);
      await saved; // Never let a late IndexedDB write resurrect an accepted item.
      await deletePending(item.ownerId, item.captureId).catch(() => {});
      if (current.current?.user?.id === item.ownerId && alive.current) setLatest(previous => !previous || previous.captureId === item.captureId ? { captureId: item.captureId, phase: "accepted", receipt, elapsedMs: Math.round(performance.now() - started) } : previous);
    } catch (error) {
      await saved;
      const code = error instanceof Error ? error.message : "OFFLINE";
      if (current.current?.user?.id === item.ownerId && alive.current) setLatest(previous => !previous || previous.captureId === item.captureId ? { captureId: item.captureId, phase: "pending", error: code, localSaved } : previous);
    } finally { inflight.current.delete(item.key); await refreshCount(); }
  }, [refreshCount]);
  const retry = useCallback(async () => {
    const owner = current.current?.user?.id;
    if (!owner || !navigator.onLine || !current.current?.configured) return;
    try { for (const item of await listPending(owner)) { if (current.current?.user?.id !== owner) break; await upload(item); } } catch { /* Local-storage errors are surfaced on capture. */ }
  }, [upload]);
  const capture = useCallback((blob: Blob) => {
    const ownerId = current.current?.user?.id;
    if (!ownerId) throw new Error("UNAUTHORIZED");
    const captureId = crypto.randomUUID();
    const item = { key: captureKey(ownerId, captureId), ownerId, captureId, capturedAt: new Date().toISOString(), blob };
    setLatest({ captureId, phase: "sending", localSaved: true });
    const saved = putPending(item).then(refreshCount);
    void upload(item, saved);
    return captureId;
  }, [refreshCount, upload]);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => { setOnline(navigator.onLine); void refresh().then(retry); });
    const update = () => { setOnline(navigator.onLine); void refresh().then(retry); };
    const visible = () => { if (document.visibilityState === "visible") update(); };
    window.addEventListener("online", update); window.addEventListener("offline", update); document.addEventListener("visibilitychange", visible);
    const interval = setInterval(() => { if (document.visibilityState === "visible") void retry(); }, 30000);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        // Development chunk URLs are stable; caching them mixes old CSS with new components.
        void (async () => {
          for (const registration of await navigator.serviceWorker.getRegistrations()) {
            const worker = registration.active ?? registration.waiting ?? registration.installing;
            if (worker?.scriptURL === `${location.origin}/sw.js`) await registration.unregister();
          }
          for (const key of await caches.keys()) if (key.startsWith("sj-shell-")) await caches.delete(key);
        })().catch(() => {});
      }
    }
    return () => { alive.current = false; clearInterval(interval); window.removeEventListener("online", update); window.removeEventListener("offline", update); document.removeEventListener("visibilitychange", visible); };
  }, [refresh, retry]);
  return <Context.Provider value={{ account, accountError, pendingCount, online, latest, refresh, capture, retry }}>{children}</Context.Provider>;
}
export function useApp() { const value = useContext(Context); if (!value) throw new Error("AppProvider missing"); return value; }
