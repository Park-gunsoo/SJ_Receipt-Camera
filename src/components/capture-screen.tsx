"use client";
import { useLanguage } from "./language-provider";
/* Camera/video and private Blob URLs deliberately use native media elements. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, ScanLine, ShieldCheck, ArrowRight, Check, CloudUpload, Zap, ZapOff, RotateCcw } from "lucide-react";
import { useApp } from "./app-provider";
import { Shiba } from "./shiba";
import { Status, yen } from "./status";
import { errorMessage } from "@/lib/messages";
import type { ReceiptView } from "@/lib/contracts";

export function CaptureScreen() {
  const { t, locale } = useLanguage();
  const { account, online, pendingCount, latest, capture, retry } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; captureId: string } | null>(null);
  const [polled, setPolled] = useState<ReceiptView | null>(null);
  const previewRef = useRef<string | null>(null);
  const ready = !!(account?.configured && account.user && account.drive?.status === "CONNECTED");
  const receipt = polled?.id === latest?.receipt?.id ? polled : latest?.receipt;
  const active = !!preview && latest?.captureId === preview.captureId;
  const terminal = receipt && ["DONE", "FAILED", "LIMIT_REACHED"].includes(receipt.ocrState) && ["SAVED", "FAILED", "BLOCKED"].includes(receipt.archiveState);
  const scanning = active && (latest?.phase === "sending" || (latest?.phase === "accepted" && !!receipt && ["PENDING", "PROCESSING"].includes(receipt.ocrState)));
  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    setCameraOpen(false); setTorch(false); setCanTorch(false);
  }, []);
  useEffect(() => {
    const stopHidden = () => { if (document.visibilityState === "hidden") stopCamera(); };
    document.addEventListener("visibilitychange", stopHidden);
    return () => { document.removeEventListener("visibilitychange", stopHidden); stream.current?.getTracks().forEach(track => track.stop()); if (previewRef.current) URL.revokeObjectURL(previewRef.current); };
  }, [stopCamera]);
  useEffect(() => {
    const id = latest?.receipt?.id;
    if (!id) return;
    let disposed = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/receipts/${id}`, { cache: "no-store" });
        if (response.ok && !disposed) setPolled((await response.json()).receipt);
      } catch { /* Keep the last verified server state. */ }
    };
    void poll(); const interval = setInterval(poll, 4000);
    return () => { disposed = true; clearInterval(interval); };
  }, [latest?.receipt?.id]);
  const openCamera = async () => {
    setError(null); setOpening(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("UNAVAILABLE");
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } } });
      stream.current?.getTracks().forEach(track => track.stop()); stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      const capabilities = media.getVideoTracks()[0].getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      setCanTorch(!!capabilities.torch); setCameraOpen(true);
    } catch { setError("CAMERA_UNAVAILABLE"); }
    finally { setOpening(false); }
  };
  const receiveImage = (blob: Blob) => {
    setError(null);
    if (!ready) { setError("CONNECTION_REQUIRED"); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type)) { setError("UNSUPPORTED_IMAGE"); return; }
    if (blob.size > 12 * 1024 * 1024) { setError("FILE_TOO_LARGE"); return; }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(blob); previewRef.current = url;
    setPreview({ url, captureId: capture(blob) }); setPolled(null);
  };
  const shoot = () => {
    if (!video.current?.videoWidth) return;
    const canvas = document.createElement("canvas"); canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    canvas.toBlob(blob => { if (blob) receiveImage(blob); else setError("CAPTURE_FAILED"); }, "image/jpeg", 0.94);
  };
  const nextShot = () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = null; setPreview(null); setError(null); };
  const toggleTorch = async () => {
    try { await stream.current?.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { setError("TORCH_UNAVAILABLE"); }
  };
  return <section className="capture-page">
    <div className="page-heading"><div><p className="eyebrow">{t("SCAN & SAVE")}</p><h1>{t("レシートを撮影")}</h1></div><span className={`connection-pill ${ready ? "connected" : ""}`}><span />{ready ? t("Drive 接続済み") : t("未接続")}</span></div>
    <p className="page-lead">{t("レシートを枠に合わせて、パシャッ。")}</p>
    <div className={`camera-window ${cameraOpen || preview ? "has-media" : ""}`}>
      <video ref={video} playsInline muted className={cameraOpen && !preview ? "camera-video" : "camera-video hidden"} aria-label={t("カメラのプレビュー")} />
      {!cameraOpen && !preview && <div className="camera-placeholder"><span className="camera-orbit"><ScanLine size={38} strokeWidth={1.2} /></span><strong>{t("ここにレシートを")}</strong><span>{t("全体が入るように撮影してください")}</span>{ready ? <button className="camera-open-button" onClick={openCamera} disabled={opening}><Camera size={18} />{opening ? t("カメラを起動中…") : t("カメラを開く")}</button> : <Link href="/m/start" className="camera-open-button"><Camera size={18} />{t("接続してはじめる")}</Link>}</div>}
      {!preview && <div className="receipt-guide" aria-hidden="true"><i /><i /><i /><i /></div>}
      {preview && <><img className="captured-image" src={preview.url} alt={t("今撮影したレシート")} />{scanning && <div className="scan-line" aria-hidden="true" />}<div className="scan-label" role="status">{active && latest?.phase === "sending" ? <><CloudUpload size={16} />{t("送信中…")}</> : active && latest?.phase === "pending" ? t("未送信") : terminal ? <><Check size={16} />{t("処理状況を更新しました")}</> : receipt && ["DONE", "FAILED", "LIMIT_REACHED"].includes(receipt.ocrState) ? t("PDFを保存中…") : t("読み取り中…")}</div></>}
      <span className="camera-corner-label">{preview ? t("撮影した写真") : t("1枚ずつ・全体を枠の中に")}</span>
      {canTorch && !preview && <button className="torch-button" onClick={toggleTorch} aria-label={torch ? t("ライトを消す") : t("ライトをつける")}>{torch ? <Zap size={20} /> : <ZapOff size={20} />}</button>}
    </div>
    {error && <div className="notice caution" role="alert">{errorMessage(error, locale)}</div>}
    {preview ? <div className="capture-result" aria-live="polite">
      {active && latest?.phase === "accepted" && <><div className="accepted-title"><Check size={18} />{t("受付完了")}</div><p>{t("画面を閉じても処理は続きます。")}</p>{receipt && <><Status receipt={receipt} />{receipt.ocrState === "DONE" && <p>{receipt.merchant ?? t("店舗名 未確認")} · {yen(receipt.totalYen, locale)}</p>}</>}</>}
      {active && latest?.phase === "sending" && <><strong>{t("写真を送信しています…")}</strong><p>{t("受付完了まで、この画面を開いたままお待ちください。")}</p></>}
      {active && latest?.phase === "pending" && <><strong>{t("まだ送信されていません")}</strong><p>{latest.localSaved ? errorMessage(latest.error ?? "OFFLINE", locale) : t("端末にも保存できていません。画面を閉じる前に下の写真を保存してください。")}</p>{!latest.localSaved && <a className="text-link" href={preview.url} download="receipt.jpg">{t("この写真を端末に保存")}</a>}</>}
      {active && latest?.phase === "sending" && latest.localSaved === false && <p className="notice caution">{errorMessage("LOCAL_STORAGE", locale)}</p>}
      <div className="two-actions"><button className="button primary" onClick={nextShot}><Camera size={18} />{t("次を撮る")}</button><Link className="button secondary" href={receipt ? `/m/receipts/${receipt.id}` : "/m/receipts"}>{t("履歴を見る")}<ArrowRight size={16} /></Link></div>
    </div> : <div className="capture-controls"><button className="album-button" onClick={() => fileInput.current?.click()} disabled={!ready}><ImagePlus size={23} /><span>{t("写真から")}</span></button><button className="shutter-button" onClick={cameraOpen ? shoot : openCamera} disabled={!ready || opening} aria-label={cameraOpen ? t("レシートを撮影する") : t("カメラを開く")}><span><Camera size={27} strokeWidth={1.7} /></span></button><div className="shutter-caption">{t("撮影すると")}<br />{t("自動で送信")}</div></div>}
    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" aria-label={t("レシート画像を選択")} onChange={event => { const file = event.target.files?.[0]; if (file) receiveImage(file); event.target.value = ""; }} />
    <div className="helper-card"><Shiba className="helper-shiba" /><div><strong>{t("あとは、おまかせ。")}</strong><p>{t("撮ったレシートはPDFにして")}<br />{t("あなたのGoogle Driveへ。")}</p><span><ShieldCheck size={13} />{t("あなただけの非公開フォルダに保存")}</span></div></div>
    <div className="queue-row"><span className={`tiny-dot ${online ? "green" : ""}`} /><span>{pendingCount ? t("未送信 {count}件", { count: pendingCount }) : online ? t("未送信の写真はありません") : t("インターネット接続を待っています")}</span>{pendingCount > 0 && <button onClick={retry} className="text-link"><RotateCcw size={14} />{t("再送")}</button>}</div>
  </section>;
}
