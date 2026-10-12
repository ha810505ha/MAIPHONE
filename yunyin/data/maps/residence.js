import { drawRoadPath, frameOutdoorMap } from "./mapLayout.js";

const WIDTH = 36;
const HEIGHT = 28;
// 內圈只放內容；四周樹林、河與出口路口由 frameOutdoorMap 包上去（見 mapLayout.js）
const grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => "."));


const carve = (x, y, value = "=") => {
  if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) grid[y][x] = value;
};

// Curved neighborhood roads route around the player home and branch to each front door.
// 北邊路口往主城，東邊路口往靈田（y=18 那條街一路通到東緣）
drawRoadPath(carve, [[17, 0], [18, 4], [17, 7], [20, 9], [22, 11], [21, 14], [19, 17], [18, 21]]);
drawRoadPath(carve, [[5, 7], [7, 6], [11, 7], [15, 8], [19, 7], [23, 8], [28, 6], [30, 7]]);
drawRoadPath(carve, [[3, 19], [6, 17], [10, 18], [14, 17], [17, 16], [19, 17], [23, 18], [28, 19], [33, 18], [35, 18]]);
drawRoadPath(carve, [[13, 10], [16, 9], [20, 10], [23, 11]], 3);

export default frameOutdoorMap({
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
  // 2026-10-11：住宅區有好幾棟房子，玩家一開始分不出哪棟是自己的 → 門口右前方立「我的家」木牌（不擋路）
  decorations: [
    { id: "player_home_sign", img: "signWood", x: 19, y: 16, w: 1, h: 1, renderScale: 1, blocking: false, label: "我的家" },
  ],
  homeLots: [
    { id: "reserved_lot_1", x: 10, y: 3, w: 4, h: 3, unlocked: false },
    { id: "reserved_lot_2", x: 23, y: 13, w: 5, h: 4, unlocked: false },
    { id: "reserved_lot_3", x: 24, y: 21, w: 5, h: 4, unlocked: false },
    { id: "reserved_lot_4", x: 4, y: 21, w: 5, h: 4, unlocked: false },
    { id: "reserved_lot_5", x: 10, y: 21, w: 4, h: 4, unlocked: false },
  ],
  plots: [],
}, {
  exits: [
    { side: "north", at: 17, to: "gate", label: "主城", icon: "🏘️" },
    { side: "east", at: 18, to: "farm", label: "靈田", icon: "🌿" },
  ],
});
