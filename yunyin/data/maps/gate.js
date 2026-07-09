// 山門地圖：字元圖例見 engine/tilemap.js（. 草 = 路 ~ 水 T 樹 # 石）
// 每列固定 20 字，16 列。建築占地會在解析時自動標成不可走。
export default {
  id: "gate",
  name: "山門",
  tiles: [
    "~~~~~~~~~~~~~~~~~~~~",
    "~TTT............TTT~",
    "~TT..............TT~",
    "~T................T~",
    "~T.......==.......T~",
    "~T....==.==.==....T~",
    "~...==========.....~",
    "~...==========.....~",
    "~...==========.....~",
    "~........===.......~",
    "~T.......===......T~",
    "~T........===.....T~",
    "~TT.......===....TT~",
    "~TTT.....===....TTT~",
    "~TTTT....===...TTTT~",
    "~~~~~~~~~~~~~~~~~~~~",
  ],
  spawn: [10, 9],
  buildings: [
    { id: "hall", label: "修煉堂", x: 4, y: 2, w: 4, h: 3, door: [6, 5], opens: "cultivation", color: "#7d5a6e", roof: "#5d3f52", img: "hall" },
    { id: "danfang", label: "丹房坊市", x: 12, y: 2, w: 3, h: 3, door: [13, 5], opens: "shop", color: "#8a6a4f", roof: "#684d38", img: "danfang" },
  ],
  portals: [
    { x: 2, y: 7, to: "farm", spawn: [3, 3], label: "靈田", icon: "🌿" },
    { x: 17, y: 7, to: "dungeon", label: "秘境", icon: "🌫️" },
  ],
};
