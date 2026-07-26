/**
 * 交友 App 的共用興趣標籤。
 *
 * 玩家問卷跟角色的喜好／討厭都從這份清單選，配對比對才能是精確的集合運算。
 * 自由文字的自介只負責氣氛與給 AI 讀，不參與計算。
 *
 * 增刪標籤時注意兩件事：太少會讓所有人都撞在一起，太多則永遠對不上。
 * 同一個概念只留一個標籤（例如別同時有「貓派」跟「喜歡貓」）。
 */
export const INTEREST_CATEGORIES = Object.freeze([
  { id: "life", label: "生活步調" },
  { id: "hobby", label: "興趣嗜好" },
  { id: "sport", label: "運動" },
  { id: "food", label: "飲食" },
  { id: "travel", label: "旅行" },
  { id: "pet", label: "動物" },
  { id: "personality", label: "個性" },
  { id: "values", label: "價值觀" },
]);

export const INTEREST_TAGS = Object.freeze([
  { id: "morning", label: "早起", category: "life" },
  { id: "nightowl", label: "夜貓子", category: "life" },
  { id: "homebody", label: "宅在家", category: "life" },
  { id: "spontaneous", label: "說走就走", category: "life" },
  { id: "routine", label: "規律作息", category: "life" },
  { id: "workaholic", label: "工作狂", category: "life" },

  { id: "coffee", label: "手沖咖啡", category: "hobby" },
  { id: "movie", label: "看電影", category: "hobby" },
  { id: "drama", label: "追劇", category: "hobby" },
  { id: "reading", label: "閱讀", category: "hobby" },
  { id: "livemusic", label: "音樂現場", category: "hobby" },
  { id: "photography", label: "攝影", category: "hobby" },
  { id: "drawing", label: "畫畫", category: "hobby" },
  { id: "crafts", label: "手作", category: "hobby" },
  { id: "gaming", label: "電玩", category: "hobby" },
  { id: "boardgame", label: "桌遊", category: "hobby" },
  { id: "karaoke", label: "唱歌", category: "hobby" },
  { id: "gardening", label: "種植物", category: "hobby" },

  { id: "gym", label: "健身", category: "sport" },
  { id: "running", label: "跑步", category: "sport" },
  { id: "hiking", label: "登山", category: "sport" },
  { id: "swimming", label: "游泳", category: "sport" },
  { id: "yoga", label: "瑜伽", category: "sport" },
  { id: "ballsports", label: "球類運動", category: "sport" },
  { id: "extreme", label: "極限運動", category: "sport" },

  { id: "foodie", label: "美食探店", category: "food" },
  { id: "cooking", label: "下廚", category: "food" },
  { id: "dessert", label: "甜點", category: "food" },
  { id: "spicy", label: "吃辣", category: "food" },
  { id: "vegetarian", label: "吃素", category: "food" },
  { id: "drinking", label: "小酌", category: "food" },
  { id: "latenightsnack", label: "宵夜", category: "food" },

  { id: "travel", label: "出國旅行", category: "travel" },
  { id: "camping", label: "露營", category: "travel" },
  { id: "beach", label: "海邊", category: "travel" },
  { id: "solotravel", label: "一個人旅行", category: "travel" },
  { id: "roadtrip", label: "公路旅行", category: "travel" },

  { id: "cat", label: "貓派", category: "pet" },
  { id: "dog", label: "狗派", category: "pet" },
  { id: "haspet", label: "有養寵物", category: "pet" },

  { id: "slowwarm", label: "慢熱", category: "personality" },
  { id: "talkative", label: "健談", category: "personality" },
  { id: "humor", label: "幽默", category: "personality" },
  { id: "quiet", label: "安靜", category: "personality" },
  { id: "direct", label: "直球", category: "personality" },
  { id: "stable", label: "情緒穩定", category: "personality" },
  { id: "clingy", label: "黏人", category: "personality" },
  { id: "needsspace", label: "需要獨處", category: "personality" },

  { id: "settle", label: "想定下來", category: "values" },
  { id: "gowithflow", label: "順其自然", category: "values" },
  { id: "career", label: "事業優先", category: "values" },
  { id: "family", label: "重視家庭", category: "values" },
  { id: "nosmoke", label: "不抽菸", category: "values" },
  { id: "smoke", label: "抽菸", category: "values" },
]);

const TAG_MAP = new Map(INTEREST_TAGS.map((tag) => [tag.id, tag]));
export const tagLabel = (id) => TAG_MAP.get(id)?.label || id;
export const tagsByCategory = (categoryId) => INTEREST_TAGS.filter((tag) => tag.category === categoryId);
export const isValidTag = (id) => TAG_MAP.has(id);

/** 把一組標籤 id 依分類收攏，供資料頁分區顯示；空的分類會被濾掉。 */
export function groupTags(tagIds = []) {
  return INTEREST_CATEGORIES
    .map((category) => ({ ...category, tags: tagIds.filter((id) => TAG_MAP.get(id)?.category === category.id) }))
    .filter((group) => group.tags.length);
}
