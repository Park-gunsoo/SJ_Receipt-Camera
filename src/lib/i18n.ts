import catalog from "../../public/translations.json";

export type Locale = "ja" | "ko" | "en";
export type MessageKey = keyof typeof catalog;
export type MessageParams = Record<string, string | number>;
export const LANGUAGE_KEY = "sj-language-v1";
export const languageNames = { ja: "日本語", ko: "한국어", en: "English" } as const;
export const localeTags = { ja: "ja-JP", ko: "ko-KR", en: "en-US" } as const;
export function isLocale(value: unknown): value is Locale { return value === "ja" || value === "ko" || value === "en"; }
export function resolveLocale(saved: unknown, languages: readonly string[]): Locale {
  if (isLocale(saved)) return saved;
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return "ja";
}
export function translate(locale: Locale, key: MessageKey, params: MessageParams = {}) {
  const entry: { ja?: string; ko: string; en: string } = catalog[key];
  const message = locale === "ja" ? entry.ja ?? key : entry[locale];
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : typeof value === "number" ? value.toLocaleString(localeTags[locale]) : value;
  });
}
/** Translate recognized system labels only; never rewrite stored receipt evidence. */
export function displayText(value: string, locale: Locale) {
  return Object.hasOwn(catalog, value) ? translate(locale, value as MessageKey) : value;
}
export function formatYen(value: number | null, locale: Locale) {
  return value === null ? translate(locale, "未確認") : new Intl.NumberFormat(localeTags[locale], { style: "currency", currency: "JPY", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(value);
}
export function formatPurchaseDate(value: string, locale: Locale) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(localeTags[locale], { timeZone: "Asia/Tokyo", year: "numeric", month: "short", day: "numeric" });
}
export function formatReceivedDay(value: string, locale: Locale) {
  return new Date(value).toLocaleDateString(localeTags[locale], { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" });
}
