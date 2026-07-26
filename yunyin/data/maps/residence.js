import { drawRoadPath } from "./mapLayout.js";

const WIDTH = 36;
const HEIGHT = 28;
const grid = Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => (
  x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ? "~" : "."
)));

// A tree belt defines the district boundary while leaving room for later expansion.
for (let x = 1; x < WIDTH - 1; x += 1) {
  grid[1][x] = "T";
  grid[HEIGHT - 2][x] = "T";
}
for (let y = 1; y < HEIGHT - 1; y += 1) {
  grid[y][1] = "T";
  grid[y][WIDTH - 2] = "T";
}

const carve = (x, y, value = "=") => {
  if (x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1) grid[y][x] = value;
};

// Curved neighborhood roads route around the player home and branch to each front door.
drawRoadPath(carve, [[17, 1], [18, 4], [17, 7], [20, 9], [22, 11], [21, 14], [19, 17], [18, 21], [17, 26]]);
drawRoadPath(carve, [[5, 7], [7, 6], [11, 7], [15, 8], [19, 7], [23, 8], [28, 6], [30, 7]]);
drawRoadPath(carve, [[3, 19], [6, 17], [10, 18], [14, 17], [17, 16], [19, 17], [23, 18], [28, 19], [33, 18]]);
drawRoadPath(carve, [[13, 10], [16, 9], [20, 10], [23, 11]], 3);

export default {
  id: "residence",
  name: "住宅區",
  kind: "residential",
  viewScale: 1.5,
  tiles: grid.map((row) => row.join("")),
  spawn: [17, 2],
  buildings: [
    { id: "npc_home_1", slotId: "npc_home_1", label: "居民小屋①", x: 4, y: 4, w: 4, h: 3, door: [7, 7], opens: "residentHome", showLabel: false, color: "#8f765f", roof: "#62504a", img: "residentModernHome", renderScale: 1.75, collisionPadding: { left: 2, right: 2, top: 2 } },
    { id: "npc_home_2", slotId: "npc_home_2", label: "居民小屋②", x: 27, y: 4, w: 4, h: 3, door: [28, 7], opens: "residentHome", showLabel: false, color: "#7d8065", roof: "#505745", img: "residentJapaneseHome", renderScale: 1.75, collisionPadding: { left: 2, right: 2, top: 4 } },
    { id: "npc_home_3", slotId: "npc_home_3", label: "居民小屋③", x: 4, y: 14, w: 4, h: 3, door: [6, 17], opens: "residentHome", showLabel: false, color: "#847080", roof: "#574754", img: "residentOneStoryHome", renderScale: 1.75, collisionPadding: { left: 2, right: 2, top: 4 } },
    { id: "player_home", label: "玩家小屋", x: 15, y: 12, w: 5, h: 4, door: [17, 16], to: "starter_home", spawn: [12, 13], instanceId: "player_home", showLabel: false, color: "#a87858", roof: "#6f4d3f", img: "playerCountryHome", renderScale: 1.6, collisionPadding: { left: 2, right: 2, top: 4 } },
  ],
  homeLots: [
    { id: "reserved_lot_1", x: 10, y: 3, w: 4, h: 3, unlocked: false },
    { id: "reserved_lot_2", x: 23, y: 13, w: 5, h: 4, unlocked: false },
    { id: "reserved_lot_3", x: 24, y: 21, w: 5, h: 4, unlocked: false },
    { id: "reserved_lot_4", x: 4, y: 21, w: 5, h: 4, unlocked: false },
    { id: "reserved_lot_5", x: 10, y: 21, w: 4, h: 4, unlocked: false },
  ],
  portals: [
    { x: 17, y: 1, to: "gate", spawn: [2, 20], label: "前往主城", icon: "🏘️" },
    { x: 17, y: 26, to: "farm", spawn: [17, 25], label: "前往農田", icon: "🌿" },
  ],
  plots: [],
};
