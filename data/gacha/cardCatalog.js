export const GACHA_CARD_CATEGORIES = Object.freeze({
  ITEM: "item",
  SCENE: "scene",
  LOCATION: "location",
  EVENT: "event",
  CHARACTER: "character",
  MEMORY: "memory",
  DAILY: "daily",
  DREAM: "dream",
});

export const GACHA_CARD_CATEGORY_LABELS = Object.freeze({
  [GACHA_CARD_CATEGORIES.ITEM]: "道具",
  [GACHA_CARD_CATEGORIES.SCENE]: "場景",
  [GACHA_CARD_CATEGORIES.LOCATION]: "地點",
  [GACHA_CARD_CATEGORIES.EVENT]: "事件",
  [GACHA_CARD_CATEGORIES.CHARACTER]: "人物",
  [GACHA_CARD_CATEGORIES.MEMORY]: "回憶",
  [GACHA_CARD_CATEGORIES.DAILY]: "日常",
  [GACHA_CARD_CATEGORIES.DREAM]: "夢境",
});

/**
 * 卡片的唯一資料來源。
 *
 * category 是玩家可理解的大分類；tags 用於 AI 理解題材，不必顯示在 UI。
 * modeInterpretation 不限制使用模式，只說明同一張卡在現實／線上時如何轉譯。
 * openingPrompt 僅供具有必要劇情限制的特殊卡片使用，一般卡片可以省略。
 */
export const GACHA_CARD_CATALOG = Object.freeze([
  {
    id: "moonlit-promise",
    name: "月色下的約定",
    rarity: "SSR",
    category: GACHA_CARD_CATEGORIES.SCENE,
    icon: "🌙",
    quote: "只要閉上眼，我就在你身邊。",
    tags: ["約定", "月夜", "安靜", "親密"],
    modeInterpretation: {
      reality: "兩人在同一片月色下，讓約定成為當下互動的契機。",
      online: "兩人透過訊息、照片或通話分享月色，從遠方談起約定。",
    },
  },
  {
    id: "pearl-of-sakura",
    name: "櫻瓣珍珠項鍊",
    rarity: "SSR",
    category: GACHA_CARD_CATEGORIES.ITEM,
    icon: "📿",
    quote: "這個要一直戴著喔。",
    tags: ["飾品", "櫻花", "珍藏", "心意"],
    modeInterpretation: {
      reality: "玩家親手交付項鍊，聚焦角色接過或試戴時的反應。",
      online: "項鍊以包裹寄達，角色透過訊息分享拆封或試戴時的反應。",
    },
  },
  {
    id: "afternoon-latte",
    name: "午後的拿鐵",
    rarity: "SR",
    category: GACHA_CARD_CATEGORIES.DAILY,
    icon: "☕",
    quote: "陪我坐一下吧，只要一下下就好。",
    tags: ["午後", "咖啡", "陪伴", "日常", "溫暖"],
    modeInterpretation: {
      reality: "從共同喝一杯拿鐵的短暫休息開始。",
      online: "玩家寄送咖啡、分享飲品照片或發出線上陪伴邀請，讓角色主動回訊。",
    },
  },
  {
    id: "stardust-jar",
    name: "閃爍星塵",
    rarity: "R",
    category: GACHA_CARD_CATEGORIES.ITEM,
    icon: "✨",
    quote: "這裡裝著今天所有的心事。",
    tags: ["星塵", "心事", "秘密", "象徵"],
    modeInterpretation: {
      reality: "把星塵視為可交付的收藏或象徵心意，描寫角色接過時的反應。",
      online: "以寄送的小瓶、照片或數位心意呈現，讓角色從收到的內容主動回訊。",
    },
    openingPrompt: "不要擅自說明星塵真正收藏了哪些心事。",
  },
  {
    id: "unsent-letter",
    name: "未寄出的信",
    rarity: "R",
    category: GACHA_CARD_CATEGORIES.EVENT,
    icon: "✉️",
    quote: "有些話寫下來就夠了。",
    tags: ["信件", "未說出口", "遲疑", "等待回應"],
    modeInterpretation: {
      reality: "玩家親手交出一封遲遲未送出的信，從角色尚未讀信的瞬間開始。",
      online: "信件以郵寄、電子信件或訊息附件送達，角色在讀完前或剛收到時主動回訊。",
    },
    openingPrompt: "不得替玩家決定信件中的具體內容。",
  },
]);

const CARD_BY_ID = new Map(GACHA_CARD_CATALOG.map((card) => [card.id, card]));

export function getGachaCardById(cardId) {
  return CARD_BY_ID.get(String(cardId || "")) || null;
}

export function getGachaCardsByIds(cardIds = []) {
  return cardIds.map(getGachaCardById).filter(Boolean);
}
