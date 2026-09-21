"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { accountCategories, accountCategoryNames, categoryOption } from "@/lib/account-categories";
import { displayText } from "@/lib/i18n";
import type { Classification } from "@/lib/contracts";
import { useLanguage } from "./language-provider";

export function CategoryField({ value, onChange, classification, compact = false, form, disabled }: { value: string; onChange: (value: string) => void; classification?: Classification | null; compact?: boolean; form?: string; disabled?: boolean }) {
  const { t, locale } = useLanguage();
  const [custom, setCustom] = useState(false);
  const isCustom = custom || Boolean(value && !accountCategoryNames.includes(value));
  return <div className={`category-field span-two${compact ? " category-compact" : ""}`}><label><span>{t("勘定科目（候補）")}</span><select form={form} disabled={disabled} value={isCustom ? "__custom__" : value} onChange={event => {
    const next = event.target.value;
    setCustom(next === "__custom__"); onChange(next === "__custom__" ? "" : next);
  }}><option value="">{t("未分類")}</option>{accountCategories.map(category => <option key={category.name} value={category.name}>{categoryOption(category.name, locale)}</option>)}<option value="__custom__">{t("その他の科目を入力")}</option></select></label>
    {isCustom && <label className="custom-category">{t("任意の勘定科目")}<input form={form} disabled={disabled} value={value} maxLength={80} onChange={event => onChange(event.target.value)} /></label>}
    {!compact && classification && <div className="category-suggestion"><div><Sparkles size={15} /><strong>{t("原本からの科目候補")}</strong></div>
      <div className="category-options">{(classification.candidates ?? (classification.category ? [classification.category] : [])).map(category => <button type="button" key={category} onClick={() => { setCustom(!accountCategoryNames.includes(category)); onChange(category); }}>{categoryOption(category, locale)}</button>)}</div>
      <p>{classification.reasons.map(reason => displayText(reason, locale)).join(" ")}</p>
    </div>}
    {!compact && <small>{t("法人・個人共通の候補です。用途に合わせて修正できます。")}</small>}
  </div>;
}
