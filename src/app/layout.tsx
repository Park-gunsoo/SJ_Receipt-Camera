import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = { title: "SJ レシートカメラ", description: "撮るだけ。保存も整理も自動で。", icons: { icon: [{ url: "/icon-sj-32.png", sizes: "32x32" }, { url: "/icon-sj-192.png", sizes: "192x192" }], apple: "/icon-sj-180.png" }, appleWebApp: { capable: true, statusBarStyle: "default", title: "SJ レシート" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F4FAFD" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body><AppProvider><Shell>{children}</Shell></AppProvider></body></html>; }
