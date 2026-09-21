"use client";
import { isLocale, languageNames } from "@/lib/i18n";
import { useLanguage } from "./language-provider";

export function LanguagePicker() {
  const { locale, setLocale, t } = useLanguage();
  return <label className="language-picker">
    <span className="visually-hidden">{t("表示言語")}</span>
    <select value={locale} title={t("表示言語")} onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>
      {Object.entries(languageNames).map(([value, label]) => <option key={value} value={value} lang={value}>{label}</option>)}
    </select>
  </label>;
}
