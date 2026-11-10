// 房間目錄：解鎖條件（境界 + 金幣 + 材料）。幾何版型在 data/maps/starterHome.js。
// base: true 的是初始房間（大廳、臥室），永遠開通。
export const ROOM_CATALOG = [
  { id: "main",    name: "大廳", icon: "🏠", base: true },
  { id: "bedroom", name: "臥室", icon: "🛏️", base: true },
  { id: "study",   name: "書房", icon: "📚", realmIdx: 1, realmName: "煉氣三層", coins: 800,
    materials: { lingmu_liang: 2, fuwen_zhuan: 2 } },
  { id: "kitchen", name: "廚房", icon: "🍳", realmIdx: 2, realmName: "煉氣五層", coins: 1500,
    materials: { lingmu_liang: 3, fuwen_zhuan: 4, qingshi: 5 } },
  { id: "guest",   name: "客房", icon: "🛌", realmIdx: 3, realmName: "築基期", coins: 2500,
    materials: { lingmu_liang: 5, fuwen_zhuan: 6, lingmu: 10 } },
  { id: "bath",    name: "浴室", icon: "🛁", realmIdx: 3, realmName: "築基期", coins: 3500,
    materials: { fuwen_zhuan: 10, qingshi: 15 } },
  { id: "yard",    name: "庭院", icon: "🌸", realmIdx: 4, realmName: "金丹期", coins: 6000,
    materials: { lingmu_liang: 8, fuwen_zhuan: 10, lingmu: 20, qingshi: 20 } },
];

export const roomById = (id) => ROOM_CATALOG.find((room) => room.id === id) || null;
