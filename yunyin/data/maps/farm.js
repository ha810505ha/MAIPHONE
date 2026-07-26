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

const paint = (x, y, value) => {
  if (x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1) grid[y][x] = value;
};
const fill = (x, y, w, h, value) => {
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) paint(x + dx, y + dy, value);
};

// Winding routes connect both exits, the central clearing, and each field district.
// 先鋪路、後填田：道路用 3 格寬筆刷，直接畫在田地上會把田地矩形的邊角啃掉，
// 留下不規則的土色凸起。讓田地最後填色，道路自然停在田區邊緣，交界才乾淨。
const road = (x, y) => paint(x, y, "=");
drawRoadPath(road, [[17, 1], [16, 5], [18, 9], [17, 13], [19, 17], [17, 21], [17, 26]]);
drawRoadPath(road, [[2, 12], [7, 13], [12, 11], [17, 13], [22, 12], [27, 14], [33, 12]]);
drawRoadPath(road, [[17, 17], [14, 18], [12, 18], [11, 19]]);
fill(14, 10, 8, 5, "=");

// Reserved ground: the player field and three independent character-field lots.
// npc_field_1(x22 w6=22..27) 與 npc_field_2(x29 w5=29..33) 中間原本漏了 x=28 這一格，
// 兩塊土色保留地被切開一條窄草縫；補寬 field_1 到 x=28 讓兩塊地無縫相接。
fill(3, 19, 11, 7, ":");
fill(22, 3, 7, 7, ":");
fill(29, 3, 5, 7, ":");
fill(22, 19, 6, 7, ":");

export default {
  id: "farm",
  name: "靈田",
  kind: "farm",
  viewScale: 1.5,
  tiles: grid.map((row) => row.join("")),
  spawn: [17, 2],
  buildings: [],
  portals: [
    { x: 17, y: 1, to: "gate", spawn: [33, 20], label: "前往主城", icon: "⛩️" },
    { x: 17, y: 26, to: "residence", spawn: [17, 25], label: "前往玩家小屋", icon: "🏡" },
  ],
  fieldZones: [
    { id: "player_field", type: "player", x: 3, y: 19, w: 11, h: 7 },
    { id: "npc_field_1", type: "character", x: 22, y: 3, w: 7, h: 7, occupantId: null },
    { id: "npc_field_2", type: "character", x: 29, y: 3, w: 5, h: 7, occupantId: null },
    { id: "npc_field_3", type: "character", x: 22, y: 19, w: 6, h: 7, occupantId: null },
  ],
  futureZones: [
    { id: "orchard", x: 3, y: 3, w: 10, h: 7 },
    { id: "animal_area", x: 29, y: 19, w: 5, h: 7 },
  ],
  plots: [
    { x: 5, y: 20 }, { x: 8, y: 20 }, { x: 11, y: 20 },
    { x: 5, y: 22 }, { x: 8, y: 22 }, { x: 11, y: 22 },
    { x: 5, y: 24 }, { x: 8, y: 24 }, { x: 11, y: 24 },
  ],
};
