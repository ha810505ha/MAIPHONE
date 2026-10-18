// 商店 App（MP-051 第一階段）商品表：資料驅動，只收靈魂結晶，不碰真錢。
// 新增商品時只改這裡；限購與週 key 邏輯在 services/store/storeService.js。
//
// 欄位：
// - id：購買紀錄用的穩定識別，不可改名。
// - name／description：{ "zh-TW", en, ja, ko }，簡中由翻譯管線自動轉。
// - icon：components/common/Icon 的名稱或 emoji（資料圖示允許 emoji）。
// - price：靈魂結晶（正整數）。
// - limit：{ per: "week" | "day" | null, count }；null 表示不限購。
// - grant：{ type, amount }；目前支援 "superLike"。
// - requiresFlag：需要哪個功能旗標開啟才顯示（"dating"、"gacha"），沒有就一律顯示。

export const STORE_PRODUCTS = Object.freeze([
  Object.freeze({
    id: "superLike1",
    name: Object.freeze({ "zh-TW": "Super Like ×1", en: "Super Like ×1", ja: "Super Like ×1", ko: "Super Like ×1" }),
    description: Object.freeze({
      "zh-TW": "信風用的 Super Like，大幅提高配對成功率。每週限購 3 個。",
      en: "A Tradewind Super Like that greatly boosts your match rate. Limited to 3 per week.",
      ja: "信風で使える Super Like。マッチ率が大きく上がります。週に 3 個まで。",
      ko: "신풍에서 쓰는 Super Like. 매칭 확률을 크게 높여 줘요. 주당 3개 한정.",
    }),
    icon: "heart",
    price: 300,
    limit: Object.freeze({ per: "week", count: 3 }),
    grant: Object.freeze({ type: "superLike", amount: 1 }),
    requiresFlag: "dating",
  }),
]);

export const STORE_PURCHASES_ENTITY_KEY = "ent_storePurchases";
export const STORE_PURCHASE_HISTORY_LIMIT = 200;
export const STORE_HISTORY_VISIBLE = 20;
