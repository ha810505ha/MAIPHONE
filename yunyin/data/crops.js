// 作物表：growMin 為基礎生長分鐘數；source: "shop" 可直接花錢種，"dungeon" 只能秘境帶回種子。
export const CROPS = [
  { id: "qingling", name: "青靈草", icon: "🌿", growMin: 30,  seedCost: 20,   sellPrice: 5,  yield: 2, source: "shop" },
  { id: "yuehua",   name: "月華菇", icon: "🍄", growMin: 120, seedCost: 65,   sellPrice: 18, yield: 2, source: "shop" },
  { id: "xinglu",   name: "星露籽", icon: "✨", growMin: 480, seedCost: null, sellPrice: 60, yield: 1, source: "dungeon" },
];
