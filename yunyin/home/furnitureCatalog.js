export const FURNITURE_PLACEMENT = Object.freeze({ FLOOR: "floor", RUG: "rug", WALL: "wall" });

// Catalog definitions stay immutable. Saves only contain furniture instances.
// price: { coins } 或 { crystals }；沒有 price = 初始免費件。
// requiresBlueprint: true 的要先取得圖紙（save.blueprints）才能購買。
// maxCount: 同一款在單一住宅可擺放的上限（之後房間升級再放寬）。
// 家具方向固定（以素材原方向為準，不做旋轉）；有坐類互動的只出朝左/朝右素材。
export const FURNITURE_CATALOG = Object.freeze({
  starter_bed: Object.freeze({
    id: "starter_bed", name: "簡單單人床", icon: "🛏️", category: "bed",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 2 }, collision: [[0, 0], [0, 1]],
    maxCount: 2,
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [{ id: "bed", approach: [0, 2], facing: "up", renderOffset: [0, -1] }] }],
    fallback: { color: "#d8b7a5", accent: "#fff2dc" },
  }),
  starter_table: Object.freeze({
    id: "starter_table", name: "木製矮桌", icon: "▣", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    maxCount: 3,
    interactions: [{ id: "eat", action: "eat", label: "用餐", minDurationMs: 4500, maxDurationMs: 8000, slots: [
      { id: "left", approach: [0, 1], facing: "up", renderOffset: [0, 0] },
      { id: "right", approach: [1, 1], facing: "up", renderOffset: [0, 0] },
    ] }],
    fallback: { color: "#865c3d", accent: "#b98254" },
  }),
  starter_chair: Object.freeze({
    id: "starter_chair", name: "木椅・朝右", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#8f6545", accent: "#c28a5b" },
  }),
  starter_cabinet: Object.freeze({
    id: "starter_cabinet", name: "收納櫃", icon: "▤", category: "storage",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    maxCount: 4,
    fallback: { color: "#6f5949", accent: "#ad9178" },
  }),
  starter_rug: Object.freeze({
    id: "starter_rug", name: "暖色小地毯", icon: "▦", category: "rug",
    placement: FURNITURE_PLACEMENT.RUG, footprint: { w: 2, h: 2 }, collision: [],
    maxCount: 3,
    fallback: { color: "#b9685f", accent: "#e6a782" },
  }),

  // ---- 第一批商店貨（🪙）----
  double_bed: Object.freeze({
    id: "double_bed", name: "雙人床", icon: "🛏️", category: "bed", doubleBed: true,
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 2 }, collision: [[0, 0], [1, 0], [0, 1], [1, 1]],
    price: { coins: 500 }, maxCount: 2,
    // 兩個枕頭 = 兩個席位：玩家躺下時可邀住客同床（見 homeResidents.coSleepBonus）
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [
      { id: "left", approach: [0, 2], facing: "up", renderOffset: [0, -1] },
      { id: "right", approach: [1, 2], facing: "up", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#c9d4e8", accent: "#f0f4ff" },
  }),
  study_desk: Object.freeze({
    id: "study_desk", name: "書桌", icon: "📚", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 300 }, maxCount: 3,
    interactions: [
      { id: "read", action: "read", label: "閱讀", minDurationMs: 5000, maxDurationMs: 10000, slots: [{ id: "left", approach: [0, 1], facing: "right", renderOffset: [0, 0] }] },
      { id: "phone", action: "phone", label: "滑手機", minDurationMs: 4000, maxDurationMs: 8000, slots: [
        { id: "right", approach: [2, 1], facing: "left", renderOffset: [0, 0] },
        { id: "left", approach: [-1, 1], facing: "right", renderOffset: [0, 0] },
      ] },
    ],
    fallback: { color: "#9b7448", accent: "#d3a86d" },
  }),
  chair_wood_left: Object.freeze({
    id: "chair_wood_left", name: "木椅・朝左", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 80 }, maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "left", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#8f6545", accent: "#c28a5b" },
  }),
  long_sofa: Object.freeze({
    id: "long_sofa", name: "長沙發", icon: "🛋️", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 400 }, maxCount: 3,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "left", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
      { id: "right", approach: [1, 1], facing: "left", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#6d6a9e", accent: "#c8b96a" },
  }),
  tall_wardrobe: Object.freeze({
    id: "tall_wardrobe", name: "衣櫃", icon: "🚪", category: "storage",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 200 }, maxCount: 4,
    fallback: { color: "#7a5c3e", accent: "#a98a60" },
  }),
  bookshelf: Object.freeze({
    id: "bookshelf", name: "書櫃", icon: "📖", category: "storage",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 250 }, maxCount: 4,
    interactions: [{ id: "read", action: "read", label: "取書閱讀", minDurationMs: 5000, maxDurationMs: 9000, slots: [
      { id: "front", approach: [0, 1], facing: "up", renderOffset: [0, 0] },
    ] }],
    fallback: { color: "#6f5136", accent: "#caa06a" },
  }),
  plant_small: Object.freeze({
    id: "plant_small", name: "小盆栽", icon: "🌱", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 60 }, maxCount: 8,
    fallback: { color: "#5d7a4d", accent: "#8fae72" },
  }),
  plant_big: Object.freeze({
    id: "plant_big", name: "大盆栽", icon: "🪴", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 120 }, maxCount: 8,
    fallback: { color: "#4c6b3f", accent: "#7ba05e" },
  }),
  floor_lamp: Object.freeze({
    id: "floor_lamp", name: "落地燈", icon: "💡", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 100 }, maxCount: 8,
    fallback: { color: "#c9c2ae", accent: "#f4ecd2" },
  }),
  woven_rug: Object.freeze({
    id: "woven_rug", name: "織花地毯", icon: "▦", category: "rug",
    placement: FURNITURE_PLACEMENT.RUG, footprint: { w: 2, h: 2 }, collision: [],
    price: { coins: 150 }, maxCount: 3,
    fallback: { color: "#b09a4e", accent: "#d9c67a" },
  }),

  guest_bed: Object.freeze({
    id: "guest_bed", name: "客床", icon: "🛌", category: "bed", guestBed: true, capFixed: true,
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 2 }, collision: [[0, 0], [0, 1]],
    price: { coins: 600 }, maxCount: 2,
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [{ id: "bed", approach: [0, 2], facing: "up", renderOffset: [0, -1] }] }],
    fallback: { color: "#a9c4b8", accent: "#e2f0e8" },
  }),

  // ---- 床鋪擴充（全部正視直向，配合無方向的 sleep 動畫）----
  bed_wood_warm: Object.freeze({
    id: "bed_wood_warm", name: "暖木單人床", icon: "🛏️", category: "bed",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 2 }, collision: [[0, 0], [0, 1]],
    price: { coins: 380 }, maxCount: 2,
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [{ id: "bed", approach: [0, 2], facing: "up", renderOffset: [0, -1] }] }],
    fallback: { color: "#d8b878", accent: "#f0e4c8" },
  }),
  bed_green: Object.freeze({
    id: "bed_green", name: "青綠單人床", icon: "🛏️", category: "bed",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 2 }, collision: [[0, 0], [0, 1]],
    price: { coins: 380 }, maxCount: 2,
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [{ id: "bed", approach: [0, 2], facing: "up", renderOffset: [0, -1] }] }],
    fallback: { color: "#8ab890", accent: "#dcecdc" },
  }),
  bed_double_green: Object.freeze({
    id: "bed_double_green", name: "青綠雙人床", icon: "🛏️", category: "bed", doubleBed: true,
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 2 }, collision: [[0, 0], [1, 0], [0, 1], [1, 1]],
    price: { coins: 620 }, maxCount: 2,
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [
      { id: "left", approach: [0, 2], facing: "up", renderOffset: [0, -1] },
      { id: "right", approach: [1, 2], facing: "up", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#8ab890", accent: "#dcecdc" },
  }),
  bed_double_purple: Object.freeze({
    id: "bed_double_purple", name: "紫韻雙人床", icon: "🛏️", category: "bed", doubleBed: true,
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 2 }, collision: [[0, 0], [1, 0], [0, 1], [1, 1]],
    price: { coins: 620 }, maxCount: 2,
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [
      { id: "left", approach: [0, 2], facing: "up", renderOffset: [0, -1] },
      { id: "right", approach: [1, 2], facing: "up", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#9a86c8", accent: "#e0d8f0" },
  }),
  futon_jp: Object.freeze({
    id: "futon_jp", name: "和式床墊", icon: "🛌", category: "bed",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 260 }, maxCount: 3,
    interactions: [{ id: "sleep", action: "sleep", label: "睡覺", minDurationMs: 7000, maxDurationMs: 12000, slots: [{ id: "bed", approach: [0, 1], facing: "up", renderOffset: [0, 0] }] }],
    fallback: { color: "#e8e4ee", accent: "#b8c8dc" },
  }),

  // ---- 桌案擴充 ----
  table_dining_long: Object.freeze({
    id: "table_dining_long", name: "長餐桌", icon: "🍽️", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 420 }, maxCount: 3,
    interactions: [{ id: "eat", action: "eat", label: "用餐", minDurationMs: 4500, maxDurationMs: 8000, slots: [
      { id: "left", approach: [0, 1], facing: "right", renderOffset: [0, 0] },
      { id: "right", approach: [1, 1], facing: "left", renderOffset: [0, 0] },
    ] }],
    fallback: { color: "#d8c8a8", accent: "#8a6a48" },
  }),
  table_low_jp: Object.freeze({
    id: "table_low_jp", name: "和式矮几", icon: "🍵", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 340 }, maxCount: 3,
    interactions: [{ id: "eat", action: "eat", label: "用餐", minDurationMs: 4500, maxDurationMs: 8000, slots: [
      { id: "left", approach: [0, 1], facing: "right", renderOffset: [0, 0] },
      { id: "right", approach: [1, 1], facing: "left", renderOffset: [0, 0] },
    ] }],
    fallback: { color: "#c89858", accent: "#e8c890" },
  }),
  table_console: Object.freeze({
    id: "table_console", name: "玄關長桌", icon: "▤", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 300 }, maxCount: 3,
    fallback: { color: "#c8a868", accent: "#8a6a40" },
  }),
  table_coffee: Object.freeze({
    id: "table_coffee", name: "矮茶几", icon: "☕", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 240 }, maxCount: 3,
    fallback: { color: "#d8c090", accent: "#a08050" },
  }),
  table_conference: Object.freeze({
    id: "table_conference", name: "抽屜邊櫃", icon: "🗄️", category: "storage",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 200 }, maxCount: 4,
    fallback: { color: "#c8823c", accent: "#8a8a9a" },
  }),

  // ---- 椅凳擴充（H 系列椅背在左＝坐著朝右）----
  chair_yellow: Object.freeze({
    id: "chair_yellow", name: "鵝黃靠背椅", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 110 }, maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#e8c848", accent: "#f4e090" },
  }),
  chair_green: Object.freeze({
    id: "chair_green", name: "草綠靠背椅", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 110 }, maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#78b858", accent: "#b8e098" },
  }),
  chair_blue: Object.freeze({
    id: "chair_blue", name: "湖藍靠背椅", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 110 }, maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#4a90d8", accent: "#98c8ee" },
  }),
  chair_red: Object.freeze({
    id: "chair_red", name: "丹紅靠背椅", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 110 }, maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#d05858", accent: "#eea8a8" },
  }),
  stool_bar_blue: Object.freeze({
    id: "stool_bar_blue", name: "藍皮吧檯凳", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 130 }, maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#3a78c8", accent: "#8ab8e8" },
  }),
  stool_bar_red: Object.freeze({
    id: "stool_bar_red", name: "紅皮吧檯凳", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 130 }, maxCount: 6,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#c84848", accent: "#e89898" },
  }),
  stool_wood: Object.freeze({
    id: "stool_wood", name: "木圓凳", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 70 }, maxCount: 8,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#c8a068", accent: "#e0c090" },
  }),

  // ---- 廚具（純裝飾；cook 動作之後要做「在家做菜」再接）----
  kitchen_stove: Object.freeze({
    id: "kitchen_stove", name: "電爐台", icon: "🍳", category: "kitchen",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 350 }, maxCount: 2,
    fallback: { color: "#8f959c", accent: "#d8dde2" },
  }),
  kitchen_stove_gas: Object.freeze({
    id: "kitchen_stove_gas", name: "瓦斯爐台", icon: "🔥", category: "kitchen",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 400 }, maxCount: 2,
    fallback: { color: "#8f959c", accent: "#5aa8d8" },
  }),
  kitchen_oven: Object.freeze({
    id: "kitchen_oven", name: "烤箱", icon: "🥧", category: "kitchen",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 450 }, maxCount: 2,
    fallback: { color: "#7c828a", accent: "#c2c8ce" },
  }),
  kitchen_sink: Object.freeze({
    id: "kitchen_sink", name: "流理臺水槽", icon: "🚰", category: "kitchen",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 280 }, maxCount: 2,
    fallback: { color: "#d6dce2", accent: "#9fb4c4" },
  }),
  kitchen_fridge: Object.freeze({
    id: "kitchen_fridge", name: "冰箱", icon: "🧊", category: "kitchen",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 600 }, maxCount: 2,
    fallback: { color: "#cdd3da", accent: "#8fa4b8" },
  }),

  // ---- 衛浴 ----
  bath_washstand: Object.freeze({
    id: "bath_washstand", name: "洗手臺", icon: "🪥", category: "bath",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 300 }, maxCount: 2,
    fallback: { color: "#c8a878", accent: "#eef2f5" },
  }),
  bath_toilet: Object.freeze({
    id: "bath_toilet", name: "馬桶", icon: "🚽", category: "bath",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 250 }, maxCount: 2,
    fallback: { color: "#e8dcc4", accent: "#f5f7f9" },
  }),
  bath_mirror: Object.freeze({
    id: "bath_mirror", name: "浴室鏡", icon: "🪞", category: "bath",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 150 }, maxCount: 4,
    fallback: { color: "#9c7a4e", accent: "#cfe2ee" },
  }),
  bath_tub: Object.freeze({
    id: "bath_tub", name: "浴缸", icon: "🛁", category: "bath",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 2 }, collision: [[0, 0], [1, 0], [0, 1], [1, 1]],
    price: { coins: 700 }, maxCount: 1,
    fallback: { color: "#eef2f5", accent: "#a8c8dc" },
  }),
  bath_washer: Object.freeze({
    id: "bath_washer", name: "洗衣機", icon: "🧺", category: "bath",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 550 }, maxCount: 1,
    fallback: { color: "#d2d8de", accent: "#8a949e" },
  }),

  // ---- 健身 ----
  gym_treadmill: Object.freeze({
    id: "gym_treadmill", name: "跑步機", icon: "🏃", category: "fitness",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 2 }, collision: [[0, 0], [1, 0], [0, 1], [1, 1]],
    price: { coins: 800 }, maxCount: 1,
    fallback: { color: "#6a6f78", accent: "#4a7ad8" },
  }),
  gym_ball: Object.freeze({
    id: "gym_ball", name: "瑜珈球", icon: "🔵", category: "fitness",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 90 }, maxCount: 4,
    fallback: { color: "#4a9cd8", accent: "#a8d4ee" },
  }),
  gym_rack: Object.freeze({
    id: "gym_rack", name: "重訓架", icon: "🏋️", category: "fitness",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 650 }, maxCount: 1,
    fallback: { color: "#6a6f78", accent: "#9aa0a8" },
  }),
  gym_plates: Object.freeze({
    id: "gym_plates", name: "槓片架", icon: "⚫", category: "fitness",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 200 }, maxCount: 3,
    fallback: { color: "#4e5258", accent: "#7c828a" },
  }),

  // ---- 休閒／生活雜項 ----
  aquarium: Object.freeze({
    id: "aquarium", name: "水族箱", icon: "🐠", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 500 }, maxCount: 2,
    fallback: { color: "#4a6478", accent: "#7cc48a" },
  }),
  parasol: Object.freeze({
    id: "parasol", name: "遮陽傘", icon: "⛱️", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 2 }, collision: [[0, 0], [1, 0], [0, 1], [1, 1]],
    price: { coins: 220 }, maxCount: 3,
    fallback: { color: "#4e8a6e", accent: "#d8d2c4" },
  }),
  bench_wood: Object.freeze({
    id: "bench_wood", name: "木長椅", icon: "🪑", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 180 }, maxCount: 4,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "left", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
      { id: "right", approach: [1, 1], facing: "left", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#b07840", accent: "#d8a468" },
  }),
  arcade_machine: Object.freeze({
    id: "arcade_machine", name: "街機臺", icon: "🕹️", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 900 }, maxCount: 2,
    fallback: { color: "#c8a038", accent: "#6a4ea8" },
  }),
  shelf_rack: Object.freeze({
    id: "shelf_rack", name: "層架", icon: "🗄️", category: "storage",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 240 }, maxCount: 4,
    fallback: { color: "#a8763c", accent: "#d0a068" },
  }),
  pool_table: Object.freeze({
    id: "pool_table", name: "撞球臺", icon: "🎱", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 3, h: 2 }, collision: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
    price: { coins: 1100 }, maxCount: 1,
    fallback: { color: "#3e7a52", accent: "#8a949e" },
  }),
  tv_flat: Object.freeze({
    id: "tv_flat", name: "液晶電視", icon: "📺", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 750 }, maxCount: 2,
    fallback: { color: "#4e5258", accent: "#b8bec4" },
  }),
  armchair: Object.freeze({
    id: "armchair", name: "單人沙發", icon: "🛋️", category: "chair",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 350 }, maxCount: 4,
    interactions: [{ id: "sit", action: "sit", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "seat", approach: [0, 1], facing: "right", renderOffset: [0, -1] },
    ] }],
    fallback: { color: "#e8b840", accent: "#f4d888" },
  }),
  mirror_full: Object.freeze({
    id: "mirror_full", name: "穿衣鏡", icon: "🪞", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 200 }, maxCount: 3,
    fallback: { color: "#b8bec4", accent: "#dceaf2" },
  }),
  coat_rack: Object.freeze({
    id: "coat_rack", name: "衣帽架", icon: "🧥", category: "storage",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 160 }, maxCount: 3,
    fallback: { color: "#a8763c", accent: "#d0a068" },
  }),
  plant_pot: Object.freeze({
    id: "plant_pot", name: "陶盆綠植", icon: "🪴", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 80 }, maxCount: 8,
    fallback: { color: "#c08050", accent: "#5c9a4a" },
  }),

  // ---- 圖紙稀有件（秘境/稀有訂單取得圖紙後，才能用 🪙 購買）----
  grand_piano: Object.freeze({
    id: "grand_piano", name: "平臺鋼琴", icon: "🎹", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { crystals: 70 }, requiresBlueprint: true, maxCount: 1,
    fallback: { color: "#d8c9a8", accent: "#f2e8cf" },
  }),
  kotatsu: Object.freeze({
    id: "kotatsu", name: "和風暖桌", icon: "🍵", category: "table",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 2 }, collision: [[0, 0], [1, 0], [0, 1], [1, 1]],
    price: { coins: 600 }, requiresBlueprint: true, maxCount: 2,
    interactions: [{ id: "eat", action: "eat", label: "圍桌用餐", minDurationMs: 4500, maxDurationMs: 9000, slots: [
      { id: "left", approach: [-1, 1], facing: "right", renderOffset: [0, 0] },
      { id: "right", approach: [2, 1], facing: "left", renderOffset: [0, 0] },
    ] }],
    fallback: { color: "#a5713f", accent: "#d9b184" },
  }),

  art_painting: Object.freeze({
    id: "art_painting", name: "山水名畫", icon: "🖼️", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 700 }, requiresBlueprint: true, maxCount: 2,
    fallback: { color: "#c9b27a", accent: "#8fb7d9" },
  }),
  antique_vase: Object.freeze({
    id: "antique_vase", name: "古董瓷瓶", icon: "🏺", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { coins: 900 }, requiresBlueprint: true, maxCount: 2,
    fallback: { color: "#d98fa8", accent: "#f2d6b8" },
  }),
  fireplace: Object.freeze({
    id: "fireplace", name: "石砌壁爐", icon: "🔥", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 2, h: 1 }, collision: [[0, 0], [1, 0]],
    price: { crystals: 100 }, requiresBlueprint: true, maxCount: 1,
    fallback: { color: "#8f8a84", accent: "#e08a3c" },
  }),
  grandfather_clock: Object.freeze({
    id: "grandfather_clock", name: "古典落地鐘", icon: "🕰️", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { crystals: 85 }, requiresBlueprint: true, maxCount: 1,
    fallback: { color: "#9c6b3f", accent: "#e0c078" },
  }),
  art_easel: Object.freeze({
    id: "art_easel", name: "畫架", icon: "🎨", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { coins: 550 }, requiresBlueprint: true, maxCount: 2,
    fallback: { color: "#b09a72", accent: "#efe6dc" },
  }),

  // ---- 鑽石裝飾件（純觀賞奢侈品）----
  gold_harp: Object.freeze({
    id: "gold_harp", name: "黃金豎琴", icon: "🎼", category: "decor",
    placement: FURNITURE_PLACEMENT.FLOOR, footprint: { w: 1, h: 1 }, collision: [[0, 0]],
    price: { crystals: 60 }, maxCount: 2,
    fallback: { color: "#c9a53c", accent: "#f0d97a" },
  }),
});

export const STARTER_FURNITURE_IDS = Object.freeze(
  Object.values(FURNITURE_CATALOG).filter((item) => !item.price).map((item) => item.id),
);

export const furnitureById = (id) => FURNITURE_CATALOG[id] || null;

// 擺放上限：基礎值 + 每開通一間擴建房 +1（capFixed 的除外，例如客床仍由客房容量管制）。
// EXPANSION_ROOM_IDS 直接列 id，避免 import roomCatalog 造成循環相依。
const EXPANSION_ROOM_IDS = ["study", "kitchen", "guest", "bath", "yard"];
export const furnitureMaxCount = (definition, home = null) => {
  const base = Math.max(1, definition?.maxCount || 99);
  if (!home || definition?.capFixed) return base;
  const bonus = (home.unlockedRooms || []).filter((id) => EXPANSION_ROOM_IDS.includes(id)).length;
  return base + bonus;
};

export const blueprintItemId = (furnitureId) => `blueprint_${furnitureId}`;

// 圖紙稀有件清單（掉落池用）
export const BLUEPRINT_FURNITURE_IDS = Object.freeze(
  Object.values(FURNITURE_CATALOG).filter((item) => item.requiresBlueprint).map((item) => item.id),
);
