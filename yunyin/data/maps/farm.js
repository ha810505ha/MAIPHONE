import { drawRoadPath, frameOutdoorMap } from "./mapLayout.js";

const WIDTH = 36;
const HEIGHT = 28;
// 內圈只放內容；四周樹林、河與出口路口由 frameOutdoorMap 包上去（見 mapLayout.js）
const grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => "."));


const paint = (x, y, value) => {
  if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) grid[y][x] = value;
};
const fill = (x, y, w, h, value) => {
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) paint(x + dx, y + dy, value);
};

// Winding routes connect both exits, the central clearing, and each field district.
// 先鋪路、後填田：道路用 3 格寬筆刷，直接畫在田地上會把田地矩形的邊角啃掉，
// 留下不規則的土色凸起。讓田地最後填色，道路自然停在田區邊緣，交界才乾淨。
const road = (x, y) => paint(x, y, "=");
// 北邊路口往主城，西邊路口往住宅區
drawRoadPath(road, [[17, 0], [16, 5], [18, 9], [17, 13], [19, 17]]);
drawRoadPath(road, [[0, 12], [7, 13], [12, 11], [17, 13], [22, 12], [27, 14], [33, 12]]);
drawRoadPath(road, [[17, 17], [14, 18], [12, 18], [11, 19]]);
fill(14, 10, 8, 5, "=");

// Reserved ground: the player fields and two independent character fields.
fill(3, 19, 11, 7, ":");

// 圍起來的田（MP-030／MP-045）：x/y/w/h 是含圍欄的外框（11×9，比玩家第一塊田 13×9 窄一點）；
// crop 是整片耕地；plots 是 9 個作物格（3×3 隔開排，中間留走道）；gateTile 是柵門；stand 是柵門外一格。
const fencedField = (field) => {
  const gateX = field.x + Math.floor(field.w / 2);
  const gateY = field.gate === "bottom" ? field.y + field.h - 1 : field.y;
  const standY = field.gate === "bottom" ? gateY + 1 : gateY - 1;
  const crop = { x: field.x + 1, y: field.y + 1, w: field.w - 2, h: field.h - 2 };
  const plots = [];
  for (const dy of [1, 3, 5]) for (const dx of [1, 4, 7]) plots.push([crop.x + dx, crop.y + dy]);
  // gateWidth：柵門寬幾格（以 gateX 為中心）；住客田 1 格，玩家第二塊田 3 格（2026-10-12：入口大一點）
  const half = Math.floor((field.gateWidth || 1) / 2);
  const gateTiles = [];
  for (let x = gateX - half; x <= gateX + half; x += 1) gateTiles.push([x, gateY]);
  return { ...field, crop, plots, gateTile: [gateX, gateY], gateTiles, stand: [gateX, standY] };
};

// 住客角色田：兩塊（住客上限 = 客床 2 張，2026-10-12），柵門朝路，木牌立在圍欄外的柵門旁
// （木牌放田裡會擋到）。住客田可以走進去，點作物才有幫忙／偷菜。
const CHARACTER_FIELDS = [
  { id: "npc_field_1", x: 1, y: 0, w: 11, h: 9, gate: "bottom" },
  { id: "npc_field_2", x: 22, y: 0, w: 11, h: 9, gate: "bottom" },
].map((field) => {
  const fenced = fencedField(field);
  const standY = fenced.stand[1];
  return {
    ...fenced,
    type: "character",
    // 柵門朝上的田：木牌再往上一格，木牌下方的狀態小標才不會壓到圍欄
    sign: [fenced.gateTile[0] + 1, field.gate === "top" ? standY - 1 : standY],
  };
});

// 玩家第二塊田（MP-045）：原本第三塊角色田的位置；9 格接在第一塊田後面（第 10～18 格），
// 元嬰期／化神期／煉虛期各開 3 格（見 realms.js 的 plot_10～plot_18）。
const PLAYER_FIELD_2 = { ...fencedField({ id: "player_field_2", x: 22, y: 18, w: 11, h: 9, gate: "top", gateWidth: 3 }), type: "player" };

for (const field of [...CHARACTER_FIELDS, PLAYER_FIELD_2]) fill(field.crop.x, field.crop.y, field.crop.w, field.crop.h, ":");

const FENCED_FIELD_DECOR = [...CHARACTER_FIELDS, PLAYER_FIELD_2].flatMap((field) => {
  const items = [];
  const fence = (img, x, y) => {
    if (field.gateTiles.some(([gateX, gateY]) => x === gateX && y === gateY)) return; // 柵門留空
    items.push({ id: `${field.id}_fence_${x}_${y}`, img, x, y, w: 1, h: 1, renderScale: 1, blocking: true });
  };
  for (let x = field.x; x < field.x + field.w; x += 1) {
    fence("fenceH", x, field.y);
    fence("fenceH", x, field.y + field.h - 1);
  }
  for (let y = field.y + 1; y < field.y + field.h - 1; y += 1) {
    fence("fenceV", field.x, y);
    fence("fenceV", field.x + field.w - 1, y);
  }
  // 木牌字由遊戲依主人名字即時畫（fieldSign），這裡不寫死 label；玩家田不立木牌
  if (field.sign) items.push({ id: `${field.id}_sign`, img: "signWood", x: field.sign[0], y: field.sign[1], w: 1, h: 1, renderScale: 1, blocking: false, fieldSign: field.id });
  return items;
});

// 玩家靈田圍欄：田區 x3~13、y19~25 外圍一圈；上緣 x10~13 是道路進田的缺口。
const FIELD_FENCE = [];
for (let x = 2; x <= 14; x += 1) {
  if (x < 10) FIELD_FENCE.push({ id: `farm_fence_top_${x}`, img: "fenceH", x, y: 18, w: 1, h: 1, renderScale: 1, blocking: true });
  FIELD_FENCE.push({ id: `farm_fence_bottom_${x}`, img: "fenceH", x, y: 26, w: 1, h: 1, renderScale: 1, blocking: true });
}
for (let y = 19; y <= 25; y += 1) {
  FIELD_FENCE.push({ id: `farm_fence_left_${y}`, img: "fenceV", x: 2, y, w: 1, h: 1, renderScale: 1, blocking: true });
  if (y >= 20) FIELD_FENCE.push({ id: `farm_fence_right_${y}`, img: "fenceV", x: 14, y, w: 1, h: 1, renderScale: 1, blocking: true });
}

export default frameOutdoorMap({
  id: "farm",
  name: "靈田",
  kind: "farm",
  viewScale: 1.5,
  tiles: grid.map((row) => row.join("")),
  spawn: [17, 2],
  buildings: [],
  // 玩家靈田（x3~13, y19~25）：外圍一圈木圍欄（上緣留出道路進田的缺口 x10~13），
  // 旁邊擺稻草人、水井、柴堆等農場小物。圍欄擋路（只能從缺口進田），其他小物不擋路。
  decorations: [
    ...FIELD_FENCE,
    ...FENCED_FIELD_DECOR,
    { id: "farm_scarecrow", img: "farmScarecrow", x: 15, y: 21, w: 3, h: 1, renderScale: 1, blocking: false },
    { id: "farm_well", img: "farmWell", x: 19, y: 23, w: 2, h: 1, renderScale: 1, blocking: true },
    { id: "farm_woodpile", img: "farmWoodpile", x: 16, y: 25, w: 1, h: 1, renderScale: 1, blocking: false },
    { id: "farm_stump_1", img: "farmStump", x: 34, y: 23, w: 2, h: 1, renderScale: 1, blocking: false },
    { id: "farm_stump_2", img: "farmStump", x: 13, y: 3, w: 2, h: 1, renderScale: 1, blocking: false },
    { id: "farm_rock_1", img: "farmRockMedium", x: 9, y: 10, w: 2, h: 1, renderScale: 1, blocking: false },
    { id: "farm_rock_2", img: "farmRockSmall", x: 31, y: 17, w: 2, h: 1, renderScale: 1, blocking: false },
    { id: "farm_lantern", img: "farmLantern", x: 21, y: 16, w: 1, h: 1, renderScale: 0.688, blocking: false },
  ],
  fieldZones: [
    { id: "player_field", type: "player", x: 3, y: 19, w: 11, h: 7 },
    { id: PLAYER_FIELD_2.id, type: "player", ...PLAYER_FIELD_2.crop },
    ...CHARACTER_FIELDS,
  ],
  futureZones: [
    { id: "orchard", x: 3, y: 3, w: 10, h: 7 },
  ],
  plots: [
    { x: 5, y: 20 }, { x: 8, y: 20 }, { x: 11, y: 20 },
    { x: 5, y: 22 }, { x: 8, y: 22 }, { x: 11, y: 22 },
    { x: 5, y: 24 }, { x: 8, y: 24 }, { x: 11, y: 24 },
    // 第二塊田（第 10～18 格）
    ...PLAYER_FIELD_2.plots.map(([x, y]) => ({ x, y })),
  ],
}, {
  exits: [
    { side: "north", at: 17, to: "gate", label: "主城", icon: "⛩️" },
    { side: "west", at: 12, to: "residence", label: "住宅區", icon: "🏡" },
  ],
});
