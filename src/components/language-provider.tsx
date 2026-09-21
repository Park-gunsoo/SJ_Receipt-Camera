"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isLocale, LANGUAGE_KEY, resolveLocale, translate, type Locale, type MessageKey, type MessageParams } from "@/lib/i18n";

let current: Locale | undefined;
const changeEvent = "sj-language-change";
function browserLanguage() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(LANGUAGE_KEY); } catch { /* Restricted storage still allows an in-memory choice. */ }
  return resolveLocale(saved, navigator.languages?.length ? navigator.languages : [navigator.language]);
}
function snapshot() { return current ??= browserLanguage(); }
function serverSnapshot(): Locale { return "ja"; }
function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === LANGUAGE_KEY || event.key === null) { current = browserLanguage(); notify(); } };
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(changeEvent, notify); window.removeEventListener("storage", onStorage); };
}
function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  current = locale;
  try { localStorage.setItem(LANGUAGE_KEY, locale); } catch { /* Keep the selection for this session. */ }
  window.dispatchEvent(new Event(changeEvent));
}
type LanguageContext = { locale: Locale; setLocale: typeof setLocale; t: (key: MessageKey, params?: MessageParams) => string };
const Context = createContext<LanguageContext | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const pathname = usePathname();
  const t = useCallback((key: MessageKey, params?: MessageParams) => translate(locale, key, params), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.querySelector('link[rel="manifest"]')?.setAttribute("href", locale === "ja" ? "/manifest.webmanifest" : `/manifest-${locale}.webmanifest`);
  }, [locale, pathname]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <Context.Provider value={value}>
    <title>{t("SJ レシートカメラ")}</title>
    <meta name="description" content={t("撮るだけ。保存も整理も自動で。")} />
    <meta name="apple-mobile-web-app-title" content={t("SJ レシート")} />
    {children}
  </Context.Provider>;
}
export function useLanguage() {
  const value = useContext(Context);
  if (!value) throw new Error("LanguageProvider missing");
  return value;
}
