// Tilemap：地圖用「字元圖例字串」定義，這裡解析成地形/碰撞，並負責繪製。
// 素材到位前全部畫色塊；素材到位後這裡改畫圖片，資料格式（ASCII 地圖）完全不動。
import { getImage, isReady } from "./assets";
import { TERRAIN_SHEET, TERRAIN_RECTS, PATH_BLOB, WATER_BLOB, ARABLE_PIECES, FOREST_TREES, FLORA_BUSHES, FLORA_FLOWERS, GRASS_TUFTS, INTERIOR_SHEETS, INTERIOR_RECTS } from "../data/assetUrls";

// 座標雜湊：同一格永遠得到同一個值（重繪不閃），但相鄰格之間沒有規律，
// 取代原本 (x*7+y*13)%6 這類線性公式——線性公式會排成整齊的斜線，一看就很假。
export const tileHash = (x, y, salt = 0) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

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
  // 樹以原尺寸畫（約 3～5 格寬），每格都種會疊成一團糊；隔格交錯種，樹冠自然連成樹林。
  // 沒種樹的 "T" 格仍然是碰撞（樹林擋路）。大小依位置：上緣用大樹（往畫面外長），
  // 下緣與兩側用中小樹，免得樹冠蓋住太多活動區。
  const frame = Number(def.frameMargin) || 0;
  // 樹冠往上長：樹上方兩格必須也是樹林（或河、地圖外），樹冠才不會蓋住活動區（玩家反映下緣的樹蓋到田）
  const coverAbove = (x, y) => y < 0 || ["T", "~"].includes(cells[y * w + x]);
  // 出口（路口＋地名）周圍不種樹，免得樹冠擋住出口（玩家反映側邊出口被下方的樹蓋住）
  // 只清出「光圈＋木牌＋地名標籤」那一塊：路兩側更遠的樹照種（渡口左右維持有樹）
  const exitRects = (def.portals || []).filter((portal) => portal.edge).map((portal) => {
    const [signX, signY] = portal.sign || [portal.x, portal.y];
    return { x0: Math.min(portal.x, signX) - 1, x1: Math.max(portal.x, signX) + 1, y0: Math.min(portal.y, signY) - 1, y1: Math.max(portal.y, signY) + 1, keepTrees: portal.keepTrees };
  });
  const CANOPY = { big: { half: 2.5, height: 6 }, medium: { half: 2, height: 5 }, small: { half: 2, height: 4 } };
  const blocksExit = (x, y, size) => exitRects.some((rect) => (rect.keepTrees
    // 只避開樹幹落在光圈／木牌那幾格（光圈與木牌畫在樹冠上層，不會被蓋住）
    ? x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1
    : x + CANOPY[size].half >= rect.x0 && x - CANOPY[size].half <= rect.x1
      && y >= rect.y0 && y - CANOPY[size].height + 1 <= rect.y1
  ));
  const trees = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (cells[y * w + x] !== "T" || nearPortal(x, y)) continue;
      if ((x + y) % 2 !== 0) continue;
      let size;
      if (frame) {
        if (!coverAbove(x, y - 1) || !coverAbove(x, y - 2)) continue;
        size = y < frame ? "big" : y >= h - frame ? "small" : (tileHash(x, y, 5) % 3 === 0 ? "big" : "medium");
        if (blocksExit(x, y, size)) continue;
      } else {
        size = y <= 2 ? "big" : y >= h - 3 ? "small" : "medium";
      }
      const pool = FOREST_TREES[size];
      trees.push({ x, y, size, variant: tileHash(x, y, 7) % pool.length, offsetX: (tileHash(x, y, 11) % 13) - 6 });
    }
  }
  const flora = frame ? scatterFlora(def, cells, w, h) : [];
  return {
    id: def.id, name: def.name, w, h, cells, collision,
    buildings: def.buildings || [], decorations: [...(def.decorations || []), ...flora], portals: def.portals || [], plots: def.plots || [], spawn: def.spawn,
    kind: def.kind || "outdoor", viewScale: Number(def.viewScale) || null,
    layers: def.layers || { ground: rows }, zones: def.zones || [], homeLots: def.homeLots || [],
    fieldZones: def.fieldZones || [], futureZones: def.futureZones || [], cityLots: def.cityLots || [],
    trees, frameMargin: frame,
    isBlocked: (x, y) => x < 0 || y < 0 || x >= w || y >= h || collision[y * w + x] === 1,
  };
}

// 花草點綴：樹林邊最密、路邊次之、草地中間偶爾一株。位置用座標雜湊決定（每次進來長在同一處），
// 避開房子、田、地塊、裝飾、出口與出生點。全部不擋路（blocking: false）。
function scatterFlora(def, cells, w, h) {
  const reserved = new Set();
  const reserve = (x0, y0, rw, rh, pad = 0) => {
    for (let y = y0 - pad; y < y0 + rh + pad; y++) for (let x = x0 - pad; x < x0 + rw + pad; x++) reserved.add(`${x},${y}`);
  };
  for (const b of def.buildings || []) {
    const p = b.collisionPadding || {};
    reserve(b.x - (p.left || 0), b.y - (p.top || 0), b.w + (p.left || 0) + (p.right || 0), b.h + (p.top || 0) + (p.bottom || 0), 1);
    if (b.door) reserve(b.door[0], b.door[1], 1, 1, 1);
  }
  for (const item of [...(def.decorations || []), ...(def.cityLots || []), ...(def.homeLots || []), ...(def.fieldZones || [])]) reserve(item.x, item.y, item.w || 1, item.h || 1, 1);
  for (const plot of def.plots || []) reserve(plot.x, plot.y, 1, 1, 1);
  for (const portal of def.portals || []) reserve(portal.x, portal.y, 1, 1, 3);
  if (def.spawn) reserve(def.spawn[0], def.spawn[1], 1, 1, 1);
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? cells[y * w + x] : "T");
  const flora = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (cells[y * w + x] !== "." || reserved.has(`${x},${y}`)) continue;
      let nearForest = false;
      for (let dy = -1; dy <= 1 && !nearForest; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === "T") { nearForest = true; break; }
      const nearRoad = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes("=");
      const roll = tileHash(x, y, 21) % 100;
      const chance = nearForest ? 32 : nearRoad ? 9 : 2;
      if (roll >= chance) continue;
      const pick = tileHash(x, y, 23);
      const pool = nearForest && pick % 5 < 3 ? FLORA_BUSHES : FLORA_FLOWERS;
      flora.push({ id: `flora_${x}_${y}`, img: pool[(pick >>> 4) % pool.length], x, y, w: 1, h: 1, renderScale: 1, blocking: false, flora: true });
    }
  }
  return flora;
}

// 土路九宮格拼接：依上下左右鄰居是不是同為「=」，決定要不要在那個方向露出草地融合邊緣。
// 不是完整 47-blob（沒有處理凹角），但用九塊＋優先順序已經能讓一般走廊/十字路口的邊緣正確融合。
const pathOpenSides = (map, x, y) => {
  // 地圖上方（y<0）沿用第一排：通往北邊的路要一路延伸出畫面，不能每格都畫成路的上緣
  const isPath = (nx, ny) => nx >= 0 && nx < map.w && ny < map.h && map.cells[Math.max(0, ny) * map.w + nx] === "=";
  return { N: !isPath(x, y - 1), S: !isPath(x, y + 1), W: !isPath(x - 1, y), E: !isPath(x + 1, y) };
};

// 水與耕地用同一套九宮格：鄰居不是同一種地形的那一側露出岸邊／田埂。
// 水在地圖外（含往上延伸的那段）一律當成水，河才會一路接出畫面。
const sameTerrainOpenSides = (map, x, y, ch, outsideCounts) => {
  const same = (nx, ny) => {
    if (nx < 0 || nx >= map.w || ny >= map.h) return outsideCounts;
    return map.cells[Math.max(0, ny) * map.w + nx] === ch;
  };
  return { N: !same(x, y - 1), S: !same(x, y + 1), W: !same(x - 1, y), E: !same(x + 1, y) };
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
  const pool = FOREST_TREES[tree.size] || FOREST_TREES.medium;
  const img = getImage(pool[tree.variant % pool.length]);
  const ts = TILE * scale;
  const sx = (tree.x * TILE + (tree.offsetX || 0) - cam.x) * scale, sy = (tree.y * TILE - cam.y) * scale;
  if (isReady(img)) {
    // 原尺寸：素材是 32px/格畫的，直接照像素比例放大，不再壓縮成 1.8 格
    const drawW = img.naturalWidth * scale, drawH = img.naturalHeight * scale;
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
  // 鏡頭可往上多捲到地圖外（讓出 HUD 高度，見 clampCamera 的 topInset）：
  // 地圖上方用第一排地形往上延伸補滿——戶外地圖第一排是河，接起來就是一條河；室內則接成牆。
  // 只有戶外外框地圖才往上延伸；室內地圖比畫面小，上方維持深色背景（不然木牆會一路往上長）
  const y0 = map.frameMargin ? Math.floor(cam.y / TILE) : Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(map.w - 1, Math.ceil((cam.x + viewW / scale) / TILE));
  const y1 = Math.min(map.h - 1, Math.ceil((cam.y + viewH / scale) / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const row = Math.max(0, y);
      const ch = map.cells[row * map.w + x];
      const t = TERRAIN[ch] || TERRAIN["~"];
      const sx = x * ts - camSx;
      const sy = y * ts - camSy;
      // "T" 底下也是草地，所以草地圖片同時服務 "." 和 "T"；"=" 依鄰居動態選九宮格拼接塊
      const rect = (ch === "." || ch === "T") ? TERRAIN_RECTS.grass
        : ch === "=" ? PATH_BLOB[blobPieceKey(pathOpenSides(map, x, y))]
        : ch === "~" ? WATER_BLOB[blobPieceKey(sameTerrainOpenSides(map, x, y, "~", true))]
        : null;
      const arable = ch === ":" ? getImage(ARABLE_PIECES[blobPieceKey(sameTerrainOpenSides(map, x, y, ":", false))]) : null;
      // 室內牆/地板走 Room_Builder 圖集："W" 依南鄰是否為室內地板選「牆面（帶踢腳）」或「上緣蓋沿」
      let interiorSheet = null, interiorRect = null;
      if (ch === "f") { interiorSheet = floorsSheet; interiorRect = INTERIOR_RECTS.floorWood; }
      else if (ch === "W") {
        interiorSheet = wallsSheet;
        const south = map.cells[(row + 1) * map.w + x];
        interiorRect = (south === "f" || south === "R") ? INTERIOR_RECTS.wallFace : INTERIOR_RECTS.wallTop;
      }
      let drewImage = false;
      if (arable && isReady(arable)) {
        // 耕地九宮格的邊緣是透明的草地融合，先鋪草地底再疊
        if (sheetReady) ctx.drawImage(sheet, TERRAIN_RECTS.grass[0], TERRAIN_RECTS.grass[1], 32, 32, sx, sy, ts + 1, ts + 1);
        ctx.drawImage(arable, sx, sy, ts + 1, ts + 1);
        drewImage = true;
      } else if (interiorRect && isReady(interiorSheet)) {
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
      const grassHash = ch === "." ? tileHash(x, y, 3) : 0;
      if (ch === "." && grassHash % 5 === 0) {
        const tuft = getImage(GRASS_TUFTS[(grassHash >>> 8) % GRASS_TUFTS.length]);
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
        ctx.fillStyle = y <= 0 ? "#8c6e58" : "#e2d5bd";
        ctx.fillRect(sx, sy, ts + 1, ts + 1);
        ctx.fillStyle = "rgba(91, 65, 49, .22)";
        ctx.fillRect(sx, sy + ts * 0.82, ts + 1, ts * 0.18);
      }
    }
  }
}
