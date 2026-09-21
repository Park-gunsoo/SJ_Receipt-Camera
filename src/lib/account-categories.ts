export const accountCategories = [
  { name: "旅費交通費", ko: "여비교통비", en: "Travel & transport" },
  { name: "車両費", ko: "차량비", en: "Vehicle expenses" },
  { name: "通信費", ko: "통신비", en: "Communications" },
  { name: "荷造運賃", ko: "포장·운송비", en: "Packing & shipping" },
  { name: "消耗品費", ko: "소모품비", en: "Supplies" },
  { name: "新聞図書費", ko: "신문·도서비", en: "Books & publications" },
  { name: "会議費", ko: "회의비", en: "Meeting expenses" },
  { name: "接待交際費", ko: "접대교제비", en: "Business entertainment" },
  { name: "福利厚生費", ko: "복리후생비", en: "Employee welfare" },
  { name: "広告宣伝費", ko: "광고선전비", en: "Advertising" },
  { name: "支払手数料", ko: "지급수수료", en: "Service fees" },
  { name: "地代家賃", ko: "임차료", en: "Rent" },
  { name: "水道光熱費", ko: "수도광열비", en: "Utilities" },
  { name: "修繕費", ko: "수선비", en: "Repairs" },
  { name: "保険料", ko: "보험료", en: "Insurance" },
  { name: "租税公課", ko: "세금·공과금", en: "Taxes & public dues" },
  { name: "外注費", ko: "외주비", en: "Subcontracting" },
  { name: "研修費", ko: "교육훈련비", en: "Training" },
  { name: "諸会費", ko: "제회비", en: "Membership dues" },
  { name: "仕入高", ko: "매입액", en: "Purchases for resale" },
  { name: "工具器具備品", ko: "공구·기구·비품 자산", en: "Equipment assets" },
  { name: "雑費", ko: "잡비", en: "Miscellaneous expenses" },
] as const;
export const accountCategoryNames: string[] = accountCategories.map(category => category.name);
export function categoryLabel(name: string, locale: "ja" | "ko" | "en") {
  const category = accountCategories.find(category => category.name === name);
  return category && locale !== "ja" ? category[locale] : name;
}
export function categoryOption(name: string, locale: "ja" | "ko" | "en") {
  const label = categoryLabel(name, locale);
  return label === name ? name : `${label} · ${name}`;
}
