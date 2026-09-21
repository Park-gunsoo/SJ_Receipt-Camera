import type { Classifier, ClassificationInput } from "./contracts";

// Provisional bookkeeping labels; business purpose and tax treatment remain reviewable.
export const rulesClassifier: Classifier = {
  classify(input: ClassificationInput) {
    const text = [input.text, ...input.items].join("\n").normalize("NFKC").split(/\r?\n/)
      .filter(line => !/キャンペーン|次回|クーポン|ポイント|募集中|スタッフ募集|おトク|ご案内|会員登録|公式アプリ|取扱商品/.test(line))
      .map(line => line.replace(/\s+/g, "")).join("\n");
    const found = new Set<string>(), rules: string[] = [], reasons: string[] = [];
    const add = (category: string, rule: string, reason: string) => {
      if (!input.availableCategories.includes(category)) return;
      found.add(category); rules.push(rule); reasons.push(reason);
    };
    const shipping = /ゆうパック|宅急便|宅配便|発送(?:料金|代)|配送料|送料|荷造|梱包料/.test(text);
    if (shipping) add("荷造運賃", "explicit-shipping-v2", "配送・梱包の記載から候補を提案しています");
    if (/電話料金|通話料|通信料|インターネット利用料|モバイル通信|携帯電話利用料|切手代|切手購入|郵便切手|はがき代/.test(text) || !shipping && /切手|はがき|郵便料金|郵送料/.test(text)) add("通信費", "explicit-communications-v2", "郵便・通信サービスの記載から候補を提案しています");
    if (/タクシー|乗車料金|乗車券|新幹線|航空券|宿泊(?:料金|料|代)|ホテル宿泊|駐車(?:料金|料|代)|高速(?:料金|道路)|通行料/.test(text) || !shipping && /運賃/.test(text)) add("旅費交通費", "explicit-transport-v1", "移動・宿泊サービスの記載から候補を提案しています");
    if (/ガソリン|ハイオク|軽油|給油|洗車|車検|エンジンオイル/.test(text) || /レギュラー/.test(text) && /\d+(?:\.\d+)?[Llℓ]|ENEOS|apollostation|出光|COSMO|コスモ/i.test(text + (input.merchant ?? ""))) add("車両費", "explicit-vehicle-v2", "給油・車両サービスの記載から候補を提案しています");
    if (/コピー用紙|ボールペン|プリンター用紙|コピー代|印刷代|文房具|事務用品|インクカートリッジ|トナーカートリッジ|クリアファイル|ノート代|封筒|乾電池|清掃用品|洗剤|ティッシュ|トイレットペーパー/.test(text)) add("消耗品費", "explicit-office-supplies-v1", "消耗品の品目から候補を提案しています");
    const explicit: [RegExp, string, string][] = [
      [/書籍|書籍代|雑誌代|新聞購読|図書代|ISBN/, "新聞図書費", "books"],
      [/広告掲載|広告料|広告費|広告配信|チラシ制作|パンフレット制作/, "広告宣伝費", "advertising"],
      [/振込手数料|送金手数料|決済手数料|仲介手数料|販売手数料/, "支払手数料", "fees"],
      [/(?<!運)賃料|家賃|地代|事務所使用料|月極駐車場/, "地代家賃", "rent"],
      [/電気料金|電気代|ガス料金|水道料金|水道代|灯油/, "水道光熱費", "utilities"],
      [/修理代|修繕料|修繕費|修理料金/, "修繕費", "repair"],
      [/火災保険料|自動車保険料|損害保険料|賠償責任保険/, "保険料", "insurance"],
      [/印紙代|収入印紙|証明書交付手数料|登記事項証明書|固定資産税|自動車税/, "租税公課", "public-dues"],
      [/業務委託料|外注費|委託作業料|制作委託/, "外注費", "subcontract"],
      [/研修受講|セミナー受講|講習(?:会費|料)|受講料/, "研修費", "training"],
      [/商工会(?:議所)?会費|協会会費|組合費|年会費/, "諸会費", "membership"],
      [/貸会議室|会議室利用料|会議室使用料/, "会議費", "meeting"],
      [/商品仕入|仕入代金|仕入高/, "仕入高", "resale"],
    ];
    for (const [pattern, category, rule] of explicit) if (pattern.test(text)) add(category, `explicit-${rule}-v2`, "原本の品目・サービスの記載に基づく候補です");
    const food = /お食事代|飲食代|飲食料|レストラン|居酒屋|喫茶|コーヒー|ランチ|弁当|ラーメン|ハンバーガー|生ビール|寿司/.test(text);
    const asset = /ノートパソコン|パソコン本体|PC本体|MacBook|iPhone|iPad|タブレット本体/.test(text);
    if (food) for (const category of ["会議費", "接待交際費", "福利厚生費"]) add(category, "purpose-required-food-v2", "飲食の目的・同席者を確認して科目を選んでください");
    if (asset) for (const category of ["消耗品費", "工具器具備品"]) add(category, "asset-review-v2", "備品は使用目的・取得単位を確認して費用または資産を選んでください");
    const candidates = [...found];
    const category = candidates.length === 1 && !food && !asset ? candidates[0] : null;
    reasons.push(category ? "用途と勘定科目の確認が必要です" : candidates.length ? "複数の勘定科目候補があります" : "用途を判断できる情報が不足しています");
    return { category, candidates, rules: [...new Set(rules)], reasons: [...new Set(reasons)], method: "rules", version: "rules-2" };
  },
};
