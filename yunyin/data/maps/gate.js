import { drawRoadPath } from "./mapLayout.js";

const WIDTH = 36;
const HEIGHT = 28;
const grid = Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => (
  x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ? "~" : "."
)));

for (let x = 1; x < WIDTH - 1; x += 1) {
  grid[1][x] = "T";
  grid[HEIGHT - 2][x] = "T";
}
for (let y = 1; y < HEIGHT - 1; y += 1) {
  grid[y][1] = "T";
  grid[y][WIDTH - 2] = "T";
}

const pave = (x, y) => {
  if (x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1) grid[y][x] = "=";
};
const plaza = (x, y, w, h) => {
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) pave(x + dx, y + dy);
};

// Winding main avenue, civic street, central square, and branching map exits.
drawRoadPath(pave, [[17, 1], [16, 5], [18, 10], [17, 15], [19, 20], [17, 26]]);
drawRoadPath(pave, [[5, 9], [9, 8], [14, 9], [18, 10], [22, 9], [27, 8], [30, 9]]);
plaza(12, 10, 12, 8);
drawRoadPath(pave, [[1, 20], [6, 19], [11, 21], [17, 20], [23, 19], [29, 21], [34, 20]]);
drawRoadPath(pave, [[22, 13], [25, 12], [29, 13], [32, 11], [34, 11]]);

export default {
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
  portals: [
    { x: 34, y: 20, to: "farm", spawn: [17, 2], label: "靈田", icon: "🌿" },
    { x: 1, y: 20, to: "residence", spawn: [17, 2], label: "住宅區", icon: "🏡" },
    { x: 34, y: 11, to: "dungeon", label: "秘境", icon: "🌫️" },
  ],
  plots: [],
};
