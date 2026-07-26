// 丹方表：in 是每爐消耗的材料，craftMin 每爐分鐘數。加工品利潤是生貨 3~4 倍。
export const RECIPES = [
  { id: "huiqi",    name: "回氣丹", icon: "💊", in: { qingling: 2 }, outCount: 1, craftMin: 25, sellPrice: 25 },
  { id: "ningshen", name: "凝神丹", icon: "🔮", in: { yuehua: 3 },   outCount: 1, craftMin: 90, sellPrice: 120, needUnlock: "recipe_ningshen" },
  // 建材煉製：房屋擴建用（丹爐的第二用途）。材料本身就是門檻，不掛境界解鎖。
  { id: "fuwen_zhuan", name: "符文磚", icon: "🧱", in: { qingshi: 2, qingling: 1 }, outCount: 1, craftMin: 30, sellPrice: 60 },
  { id: "lingmu_liang", name: "靈木樑", icon: "🏗️", in: { lingmu: 2, yuehua: 1 },  outCount: 1, craftMin: 60, sellPrice: 90 },
];
