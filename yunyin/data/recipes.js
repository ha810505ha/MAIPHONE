// 丹方表：in 是每爐消耗的材料，craftMin 每爐分鐘數。加工品利潤是生貨 3~4 倍。
export const RECIPES = [
  { id: "huiqi",    name: "回氣丹", icon: "💊", in: { qingling: 2 }, outCount: 1, craftMin: 25, sellPrice: 25 },
  { id: "ningshen", name: "凝神丹", icon: "🔮", in: { yuehua: 3 },   outCount: 1, craftMin: 90, sellPrice: 120, needUnlock: "recipe_ningshen" },
];
