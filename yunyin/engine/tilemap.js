// Tilemap：地圖用「字元圖例字串」定義，這裡解析成地形/碰撞，並負責繪製。
// 素材到位前全部畫色塊；素材到位後這裡改畫圖片，資料格式（ASCII 地圖）完全不動。
import { getImage, isReady } from "./assets";
import { TERRAIN_SHEET, TERRAIN_RECTS, PATH_BLOB, TREE_IMAGES, GRASS_TUFTS, INTERIOR_SHEETS, INTERIOR_RECTS } from "../data/assetUrls";

export const TILE = 32;

const TERRAIN = {
  ".": { base: "#79b25e", walk: true },   // 草地
  "=": { base: "#c9a86a", walk: true },   // 土路
  "~": { base: "#4f86b8", walk: false },  // 水
  "T": { base: "#79b25e", walk: false },  // 樹（草地底 + 樹冠）
  "#": { base: "#8a8f98", walk: false },  // 山石
  ":": { base: "#92704d", walk: true },   // 田區預留地
  "f": { base: "#b98b5f", walk: true },   // 室內木地板
  "W": { base: "#d8c8ac", walk: false },  // 室內牆面
  "R": { base: "#6b6055", walk: false },  // 待擴建區（塵封的隔間，擴建後變地板）
  "_": { base: "#1c2733", walk: false },  // 室內畫布外圍留白（跟畫面底色同色，看起來是虛空）
};

export function parseMap(def) {
  const rows = def.layers?.ground || def.tiles;
  if (!rows?.length) throw new Error(`Map ${def.id || "unknown"} has no ground layer`);
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
  // 建築占地整塊不可走。放大的建築可以額外宣告視覺碰撞邊界，
  // 避免角色走進圖片延伸出的屋頂或側牆；門口格永遠保持可走。
  for (const b of def.buildings || []) {
    const padding = b.collisionPadding || {};
    const left = Math.max(0, padding.left || 0), right = Math.max(0, padding.right || 0);
    const top = Math.max(0, padding.top || 0), bottom = Math.max(0, padding.bottom || 0);
    for (let y = b.y - top; y < b.y + b.h + bottom; y++) {
      for (let x = b.x - left; x < b.x + b.w + right; x++) {
        if (b.door?.[0] === x && b.door?.[1] === y) continue;
        if (x >= 0 && y >= 0 && x < w && y < h) collision[y * w + x] = 1;
      }
    }
  }
  // 廣場與戶外裝飾可有獨立占地；純視覺裝飾可設 blocking: false。
  for (const decoration of def.decorations || []) {
    if (decoration.blocking === false) continue;
    for (let y = decoration.y; y < decoration.y + Math.max(1, decoration.h || 1); y++)
      for (let x = decoration.x; x < decoration.x + Math.max(1, decoration.w || 1); x++)
        if (x >= 0 && y >= 0 && x < w && y < h) collision[y * w + x] = 1;
  }
  // 樹改成 y-排序層畫（跟建築/角色一起遮擋），不再烘進平面地形；這裡只收集位置。
  // 用座標 hash 挑一棵固定的樹（同一格重繪永遠同一棵，不會每幀跳圖）。
  // 傳送點周圍一格不長樹：樹冠高兩格，會把入口整個遮死（玩家反映找不到傳送點）
  const nearPortal = (x, y) => (def.portals || []).some((p) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1);
  const trees = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (cells[y * w + x] === "T" && !nearPortal(x, y)) trees.push({ x, y, variant: (x * 31 + y * 17) % TREE_IMAGES.length });
    }
  }
  return {
    id: def.id, name: def.name, w, h, cells, collision,
    buildings: def.buildings || [], decorations: def.decorations || [], portals: def.portals || [], plots: def.plots || [], spawn: def.spawn,
    kind: def.kind || "outdoor", viewScale: Number(def.viewScale) || null,
    layers: def.layers || { ground: rows }, zones: def.zones || [], homeLots: def.homeLots || [],
    fieldZones: def.fieldZones || [], futureZones: def.futureZones || [], cityLots: def.cityLots || [],
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
  const wallsSheet = getImage(INTERIOR_SHEETS.walls);
  const floorsSheet = getImage(INTERIOR_SHEETS.floors);
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
      // 室內牆/地板走 Room_Builder 圖集："W" 依南鄰是否為室內地板選「牆面（帶踢腳）」或「上緣蓋沿」
      let interiorSheet = null, interiorRect = null;
      if (ch === "f") { interiorSheet = floorsSheet; interiorRect = INTERIOR_RECTS.floorWood; }
      else if (ch === "W") {
        interiorSheet = wallsSheet;
        const south = map.cells[(y + 1) * map.w + x];
        interiorRect = (south === "f" || south === "R") ? INTERIOR_RECTS.wallFace : INTERIOR_RECTS.wallTop;
      }
      let drewImage = false;
      if (interiorRect && isReady(interiorSheet)) {
        ctx.drawImage(interiorSheet, interiorRect[0], interiorRect[1], interiorRect[2], interiorRect[3], sx, sy, ts + 1, ts + 1);
        drewImage = true;
      } else if (rect && sheetReady) {
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
      } else if (ch === ":") {
        ctx.fillStyle = "rgba(72, 45, 28, .2)";
        ctx.fillRect(sx, sy + ts * 0.46, ts + 1, Math.max(1, scale));
        if ((x + y) % 2 === 0) ctx.fillRect(sx + ts * 0.18, sy + ts * 0.2, ts * 0.12, ts * 0.08);
      } else if (ch === "f") {
        ctx.fillStyle = (y % 2 === 0) ? "#c99b6c" : "#c39465";
        ctx.fillRect(sx, sy, ts + 1, ts + 1);
        ctx.fillStyle = "rgba(91, 57, 35, .16)";
        ctx.fillRect(sx, sy + ts * 0.48, ts + 1, Math.max(1, scale));
        const seam = ((x * 17 + y * 11) % 3) * 0.2;
        ctx.fillRect(sx + ts * seam, sy, Math.max(1, scale), ts * 0.48);
      } else if (ch === "W") {
        ctx.fillStyle = y === 0 ? "#8c6e58" : "#e2d5bd";
        ctx.fillRect(sx, sy, ts + 1, ts + 1);
        ctx.fillStyle = "rgba(91, 65, 49, .22)";
        ctx.fillRect(sx, sy + ts * 0.82, ts + 1, ts * 0.18);
      }
    }
  }
}
