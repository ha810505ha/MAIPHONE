// 玩家小屋：版型依已開通房間動態生成（mapRegistry 呼叫 build(home)）。
// 初始 = 大廳 + 臥室；書房/浴室/廚房/客房/庭院擴建後打通。
// 未開通的隔間畫成待擴建區（"R" 深色塵封格），庭院未開通時整片維持牆。
const W = 26, H = 20;

const ROOM_RECTS = {
  main:    { x: 9,  y: 8,  w: 8, h: 6 },
  bedroom: { x: 2,  y: 8,  w: 6, h: 6 },
  study:   { x: 2,  y: 2,  w: 6, h: 5 },
  bath:    { x: 9,  y: 2,  w: 4, h: 5 },
  kitchen: { x: 14, y: 2,  w: 6, h: 5 },
  guest:   { x: 18, y: 8,  w: 6, h: 6 },
  yard:    { x: 2,  y: 15, w: 22, h: 4 },
};

// 各房間通往大廳/走道的門洞（開通後鑿穿）
const DOORS = {
  bedroom: [8, 10],
  study: [4, 7],
  bath: [10, 7],
  kitchen: [16, 7],
  guest: [17, 10],
};

const EXIT_TILES = [[12, 14], [13, 14]]; // 大廳南側出口

function build(home) {
  const unlocked = new Set(["main", "bedroom", ...(home?.unlockedRooms || [])]);
  const grid = Array.from({ length: H }, () => Array(W).fill("W"));

  for (const [roomId, rect] of Object.entries(ROOM_RECTS)) {
    if (roomId === "yard") {
      if (!unlocked.has("yard")) continue; // 庭院未開通：維持牆，不顯示塵封格（那是室外）
      for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) grid[y][x] = ".";
      continue;
    }
    const ch = unlocked.has(roomId) ? "f" : "R";
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) grid[y][x] = ch;
  }
  for (const [roomId, [dx, dy]] of Object.entries(DOORS)) {
    if (unlocked.has(roomId)) grid[dy][dx] = "f";
  }

  // 出口：庭院開通後，大廳南門打通進院子、離開點移到院子南緣；否則出口就在大廳南門。
  const yardOpen = unlocked.has("yard");
  const portalSpec = { to: "residence", spawn: [17, 16], label: "離開小屋", icon: "🚪" };
  let portals;
  if (yardOpen) {
    for (const [x, y] of EXIT_TILES) grid[y][x] = "f";
    portals = [[12, 19], [13, 19]].map(([x, y]) => { grid[y][x] = "."; return { x, y, ...portalSpec }; });
  } else {
    portals = EXIT_TILES.map(([x, y]) => { grid[y][x] = "f"; return { x, y, ...portalSpec }; });
  }

  // 外圍修剪：不貼著任何房間（含待擴建區/院子）的牆改成留白，畫面不再是一大塊牆磚框
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== "W") continue;
      let touchesRoom = false;
      for (let dy = -1; dy <= 1 && !touchesRoom; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = grid[y + dy]?.[x + dx];
          if (cell && cell !== "W" && cell !== "_") { touchesRoom = true; break; }
        }
      }
      if (!touchesRoom) grid[y][x] = "_";
    }
  }

  const zones = [...unlocked].filter((roomId) => ROOM_RECTS[roomId]).map((roomId) => ({ id: roomId, ...ROOM_RECTS[roomId], editable: true }));

  return {
    id: "starter_home",
    name: "玩家小屋",
    kind: "interior",
    defaultInstanceId: "player_home",
    layers: { ground: grid.map((row) => row.join("")) },
    spawn: [12, 13], // 進門就站在大廳南側門口

    buildings: [],
    plots: [],
    portals,
    zones,
  };
}

export default {
  id: "starter_home",
  name: "玩家小屋",
  kind: "interior",
  defaultInstanceId: "player_home",
  build,
};
