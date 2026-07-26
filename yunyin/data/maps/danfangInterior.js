// 丹房坊市內部：商店風格佈局。
// 最上方多留一排牆做「頭部空間」，高的貨架/櫃子貼圖才不會被畫布頂端裁斷。
// 互動站用 building 形式：點擊 → 走到 door 格 → 開對應面板。
const ground = [
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WffffffffffffffW",
  "WWWWWWWffWWWWWWW",
];

export default {
  id: "danfang_interior",
  name: "丹房坊市",
  kind: "interior",
  layers: { ground },
  spawn: [7, 8],
  buildings: [
    // collisionPadding：貼圖因 renderScale 會比 w×h 占地畫得更高/更寬，這裡把可點擊(＝可走碰撞)範圍
    // 放大到跟實際畫出來的圖一樣大，玩家點視覺上看到的櫃台任何位置都能命中，不會覺得「點不到」。
    { id: "danfang_furnace", label: "丹爐", x: 2, y: 2, w: 1, h: 1, door: [2, 3], opens: "shop", panelTab: "furnace", img: "stationFurnace", renderScale: 1.15, color: "#5d6570", roof: "#3f454d", showLabel: true },
    { id: "danfang_counter", label: "櫃台・家具行", x: 5, y: 4, w: 2, h: 1, door: [5, 5], opens: "furnitureShop", img: "stationCounter", renderScale: 1.3, color: "#b98b5f", roof: "#8a6a4f", showLabel: true, collisionPadding: { top: 2, left: 1, right: 1 } },
    // 貨架＝左右蓋板拼成的完整櫃（96px = 3 格）
    { id: "danfang_shelf", label: "貨架", x: 11, y: 3, w: 3, h: 1, door: [12, 4], opens: "shop", panelTab: "shelf", img: "stationShelf", renderScale: 1, color: "#c07f45", roof: "#8a5c34", showLabel: true, collisionPadding: { top: 2 } },
    { id: "danfang_stall", label: "行商訂單", x: 11, y: 6, w: 2, h: 1, door: [11, 7], opens: "shop", panelTab: "order", img: "stationStall", renderScale: 1, color: "#a98a60", roof: "#7a5c3e", showLabel: true, collisionPadding: { top: 1 } },
  ],
  decorations: [
    // 上牆商品木架：堆滿貨物的單格貨架（32x96，1 格寬向上延伸 3 格高，跟高櫃同一套處理）
    { id: "wall_shelf_1", img: "shopShelfTall", x: 3, y: 2, w: 1, h: 1, blocking: true },
    { id: "wall_shelf_2", img: "shopShelfTall", x: 5, y: 2, w: 1, h: 1, blocking: true },
    { id: "wall_shelf_3", img: "shopShelfTall", x: 8, y: 2, w: 1, h: 1, blocking: true },
    { id: "wall_shelf_4", img: "shopShelfTall", x: 10, y: 2, w: 1, h: 1, blocking: true },
    // 中央地墊（flat：畫在地面層，不參與遮擋排序）與盆景
    { id: "shop_mat", img: "decorMat", x: 7, y: 5, w: 2, h: 2, blocking: false, flat: true },
    { id: "shop_bonsai_left", img: "decorBonsaiA", x: 1, y: 7, w: 1, h: 1, blocking: true },
    { id: "shop_bonsai_right", img: "decorBonsaiB", x: 14, y: 7, w: 1, h: 1, blocking: true },
    { id: "shop_flower", img: "decorBonsaiA", x: 14, y: 2, w: 1, h: 1, blocking: true },
  ],
  plots: [],
  portals: [
    { x: 7, y: 9, to: "gate", spawn: [27, 9], label: "離開丹房", icon: "🚪" },
    { x: 8, y: 9, to: "gate", spawn: [27, 9], label: "離開丹房", icon: "🚪" },
  ],
};
