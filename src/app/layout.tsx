import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";
export const metadata: Metadata = { icons: { icon: [{ url: "/icon-sj-32.png", sizes: "32x32" }, { url: "/icon-sj-192.png", sizes: "192x192" }], apple: "/icon-sj-180.png" }, appleWebApp: { capable: true, statusBarStyle: "default" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F4FAFD" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body><LanguageProvider><AppProvider><Shell>{children}</Shell></AppProvider></LanguageProvider></body></html>; }
