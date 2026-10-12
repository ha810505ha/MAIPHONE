import { drawRoadPath, frameOutdoorMap } from "./mapLayout.js";

const WIDTH = 36;
const HEIGHT = 28;
// 內圈只放內容；四周樹林、河與出口路口由 frameOutdoorMap 包上去（見 mapLayout.js）
const grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => "."));


const pave = (x, y) => {
  if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) grid[y][x] = "=";
};
const plaza = (x, y, w, h) => {
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) pave(x + dx, y + dy);
};

// 山莊方位（2026-10-10 定案，三角形）：北邊過河是秘境渡口；南邊兩個路口，左往住宅區、右往靈田。
// 主大道從北岸渡口往南穿過廣場，在 y≈20 接上東西向街道，再分兩路出南邊。
drawRoadPath(pave, [[17, 0], [16, 5], [18, 10], [17, 15], [19, 20]]);
drawRoadPath(pave, [[5, 9], [9, 8], [14, 9], [18, 10], [22, 9], [27, 8], [30, 9]]);
plaza(12, 10, 12, 8);
drawRoadPath(pave, [[5, 20], [8, 19], [12, 21], [17, 20], [23, 19], [28, 21], [31, 20]]);
drawRoadPath(pave, [[12, 21], [12, 27]]);
drawRoadPath(pave, [[23, 19], [23, 27]]);

export default frameOutdoorMap({
  id: "gate",
  name: "山門",
  kind: "town",
  viewScale: 1.5,
  tiles: grid.map((row) => row.join("")),
  spawn: [17, 14],
  buildings: [
    { id: "hall", label: "修煉堂", x: 7, y: 4, w: 5, h: 4, door: [9, 8], to: "hall_interior", spawn: [6, 7], color: "#7d5a6e", roof: "#5d3f52", img: "hall", renderScale: 1.2 },
    { id: "danfang", label: "丹房坊市", x: 25, y: 4, w: 4, h: 4, door: [27, 8], to: "danfang_interior", spawn: [6, 7], color: "#8a6a4f", roof: "#684d38", img: "danfang", renderScale: 1.2 },
  ],
  decorations: [
    // 山門入口：兩根石柱夾住上方進場大道（大道在 x15~18，石柱各留一格空隙），
    // 外側再各放一根斷柱當仙門遺跡。renderScale 讓圖以素材原始像素大小繪製
    // （drawWorldDecoration 會把圖拉成 w 格寬，所以 renderScale = 圖寬 /(w*32)）。
    { id: "gate_pillar_left", img: "gatePillar", x: 13, y: 4, w: 1, h: 1, renderScale: 1, blocking: true },
    { id: "gate_pillar_right", img: "gatePillar", x: 20, y: 4, w: 1, h: 1, renderScale: 1, blocking: true },
    { id: "gate_ruin_left", img: "gatePillarBroken", x: 4, y: 4, w: 1, h: 1, renderScale: 1.375, blocking: true },
    { id: "gate_ruin_right", img: "gatePillarBroken", x: 31, y: 4, w: 1, h: 1, renderScale: 1.375, blocking: true },
    { id: "plaza_fountain", img: "plazaFountain", x: 17, y: 12, w: 3, h: 2, renderScale: 1.1, blocking: true },
    // 長椅素材是正面視角 → sit_front（正面端坐，不套只有側面的 sit 動畫；見 actorActions）
    { id: "plaza_bench_left", img: "plazaBench", x: 13, y: 16, w: 2, h: 1, blocking: true, interactions: [{ id: "sit", action: "sit_front", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "left", approach: [0, 1], facing: "down", renderOffset: [0, -1] },
      { id: "right", approach: [1, 1], facing: "down", renderOffset: [0, -1] },
    ] }] },
    { id: "plaza_bench_right", img: "plazaBench", x: 21, y: 12, w: 2, h: 1, blocking: true, interactions: [{ id: "sit", action: "sit_front", label: "坐下", minDurationMs: 4000, maxDurationMs: 9000, slots: [
      { id: "left", approach: [0, 1], facing: "down", renderOffset: [0, -1] },
      { id: "right", approach: [1, 1], facing: "down", renderOffset: [0, -1] },
    ] }] },
  ],
  cityLots: [
    { id: "city_lot_1", x: 4, y: 12, w: 5, h: 5 },
    { id: "city_lot_2", x: 27, y: 14, w: 5, h: 4 },
    { id: "city_lot_3", x: 5, y: 22, w: 5, h: 4 },
    { id: "city_lot_4", x: 25, y: 22, w: 5, h: 4 },
  ],
  plots: [],
}, {
  riverRows: 2, // 北邊是河（山莊北界）＋一排樹（維持原本的樣子）；秘境渡口在河岸、兩側有樹
  exits: [
    // keepTrees：渡口兩側照樣種滿樹（維持原本的樣子），只空出光圈與木牌那幾格
    { side: "north", at: 17, to: "dungeon", label: "秘境渡口", icon: "🌫️", keepTrees: true },
    { side: "south", at: 12, to: "residence", label: "住宅區", icon: "🏡" },
    { side: "south", at: 23, to: "farm", label: "靈田", icon: "🌿" },
  ],
});
