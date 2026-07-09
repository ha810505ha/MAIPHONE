// Tilemap：地圖用「字元圖例字串」定義，這裡解析成地形/碰撞，並負責繪製。
// 素材到位前全部畫色塊；素材到位後這裡改畫圖片，資料格式（ASCII 地圖）完全不動。
import { getImage, isReady } from "./assets";
import { TERRAIN_SHEET, TERRAIN_RECTS, PATH_BLOB, TREE_IMAGES, GRASS_TUFTS } from "../data/assetUrls";

export const TILE = 32;

const TERRAIN = {
  ".": { base: "#79b25e", walk: true },   // 草地
  "=": { base: "#c9a86a", walk: true },   // 土路
  "~": { base: "#4f86b8", walk: false },  // 水
  "T": { base: "#79b25e", walk: false },  // 樹（草地底 + 樹冠）
  "#": { base: "#8a8f98", walk: false },  // 山石
};

export function parseMap(def) {
  const rows = def.tiles;
  const h = rows.length, w = rows[0].length;
  const cells = [];
  const collision = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? "~";
      cells.push(ch);
      if (!TERRAIN[ch]?.walk) collision[y * w + x] = 1;
    }
  }
  // 建築占地整塊不可走（door 是建築「前方」的走道格，不在占地內）
  for (const b of def.buildings || []) {
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        if (x >= 0 && y >= 0 && x < w && y < h) collision[y * w + x] = 1;
  }
  // 樹改成 y-排序層畫（跟建築/角色一起遮擋），不再烘進平面地形；這裡只收集位置。
  // 用座標 hash 挑一棵固定的樹（同一格重繪永遠同一棵，不會每幀跳圖）。
  const trees = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (cells[y * w + x] === "T") trees.push({ x, y, variant: (x * 31 + y * 17) % TREE_IMAGES.length });
    }
  }
  return {
    id: def.id, name: def.name, w, h, cells, collision,
    buildings: def.buildings || [], portals: def.portals || [], plots: def.plots || [], spawn: def.spawn,
    trees,
    isBlocked: (x, y) => x < 0 || y < 0 || x >= w || y >= h || collision[y * w + x] === 1,
  };
}

// 土路九宮格拼接：依上下左右鄰居是不是同為「=」，決定要不要在那個方向露出草地融合邊緣。
// 不是完整 47-blob（沒有處理凹角），但用九塊＋優先順序已經能讓一般走廊/十字路口的邊緣正確融合。
const pathOpenSides = (map, x, y) => {
  const isPath = (nx, ny) => nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && map.cells[ny * map.w + nx] === "=";
  return { N: !isPath(x, y - 1), S: !isPath(x, y + 1), W: !isPath(x - 1, y), E: !isPath(x + 1, y) };
};

function blobPieceKey({ N, S, W, E }) {
  const openCount = (N ? 1 : 0) + (S ? 1 : 0) + (W ? 1 : 0) + (E ? 1 : 0);
  if (openCount === 0) return "C";
  if (N && W) return "TL";
  if (N && E) return "TR";
  if (S && W) return "BL";
  if (S && E) return "BR";
  // 剩下的都是單邊或對邊開放（無相鄰角可配）：挑一邊露出融合邊即可，優先順序 上>下>左>右
  if (N) return "T";
  if (S) return "B";
  if (W) return "L";
  return "R";
}

// 樹的繪製：獨立函式給 YunyinGame.jsx 的 y-排序層呼叫（沿用建築的「footprint 對齊、往上長」手法）
export function drawTree(ctx, tree, cam, scale) {
  const img = getImage(TREE_IMAGES[tree.variant]);
  const ts = TILE * scale;
  const sx = (tree.x * TILE - cam.x) * scale, sy = (tree.y * TILE - cam.y) * scale;
  if (isReady(img)) {
    const drawW = ts * 1.8, drawH = drawW * (img.naturalHeight / img.naturalWidth);
    ctx.drawImage(img, sx + ts / 2 - drawW / 2, sy + ts - drawH, drawW, drawH);
  } else {
    ctx.fillStyle = "#5a4632";
    ctx.fillRect(sx + ts * 0.42, sy + ts * 0.55, ts * 0.16, ts * 0.35);
    ctx.fillStyle = "#3e7a44";
    ctx.beginPath();
    ctx.arc(sx + ts * 0.5, sy + ts * 0.38, ts * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 只畫相機可見範圍的 tile。"T" 不在這裡畫（樹改成 y-排序層，見 drawTree）。
export function drawMap(ctx, map, cam, scale, viewW, viewH) {
  const ts = TILE * scale;
  const sheet = getImage(TERRAIN_SHEET);
  const sheetReady = isReady(sheet);
  // 相機先整體取整成螢幕像素，再算每格位置 → 相鄰 tile 不會因各自 rounding 產生接縫
  const camSx = Math.round(cam.x * scale), camSy = Math.round(cam.y * scale);
  const x0 = Math.max(0, Math.floor(cam.x / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(map.w - 1, Math.ceil((cam.x + viewW / scale) / TILE));
  const y1 = Math.min(map.h - 1, Math.ceil((cam.y + viewH / scale) / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = map.cells[y * map.w + x];
      const t = TERRAIN[ch] || TERRAIN["~"];
      const sx = x * ts - camSx;
      const sy = y * ts - camSy;
      // "T" 底下也是草地，所以草地圖片同時服務 "." 和 "T"；"=" 依鄰居動態選九宮格拼接塊
      const rect = (ch === "." || ch === "T") ? TERRAIN_RECTS.grass
        : ch === "=" ? PATH_BLOB[blobPieceKey(pathOpenSides(map, x, y))]
        : null;
      let drewImage = false;
      if (rect && sheetReady) {
        ctx.drawImage(sheet, rect[0], rect[1], rect[2], rect[3], sx, sy, ts + 1, ts + 1);
        drewImage = true;
      } else {
        ctx.fillStyle = t.base;
        // +1px 重疊：dpr 為小數時 tile 邊界落在次像素上會露出底色縫，用下一格蓋掉
        ctx.fillRect(sx, sy, ts + 1, ts + 1);
      }
      // 草地本身是純平塗色，紋理感靠疏疏落落疊上草叢/小花裝飾（約 1/6 格機率，座標 hash 固定不閃爍）
      if (ch === "." && (x * 7 + y * 13) % 6 === 0) {
        const tuft = getImage(GRASS_TUFTS[(x * 13 + y * 7) % GRASS_TUFTS.length]);
        if (isReady(tuft)) ctx.drawImage(tuft, sx, sy, ts, ts);
        else if (!drewImage) { ctx.fillStyle = "#8cc46e"; ctx.fillRect(sx + ts * 0.3, sy + ts * 0.55, ts * 0.12, ts * 0.12); ctx.fillRect(sx + ts * 0.62, sy + ts * 0.3, ts * 0.12, ts * 0.12); }
      }
      if (drewImage) continue;
      if (ch === "~") {
        ctx.fillStyle = "#639bcc";
        if ((x + y) % 2 === 0) ctx.fillRect(sx + ts * 0.2, sy + ts * 0.45, ts * 0.35, ts * 0.08);
      } else if (ch === "#") {
        ctx.fillStyle = "#a2a7b0";
        ctx.fillRect(sx + ts * 0.15, sy + ts * 0.2, ts * 0.45, ts * 0.35);
      } else if (ch === "=") {
        ctx.fillStyle = "#bb9a5e";
        if ((x * 3 + y * 5) % 7 === 0) ctx.fillRect(sx + ts * 0.4, sy + ts * 0.4, ts * 0.2, ts * 0.14);
      }
    }
  }
}
