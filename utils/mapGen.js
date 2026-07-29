// 虛構城市地圖生成：固定演算法（不吃 AI token），同 seed 永遠產生同一張地圖。
import { rngOf } from "../yunyin/engine/rng.js";

export const MAP_W = 320;
export const MAP_H = 200;

const THEME_VISUALS = {
  ancient: { bg: "#2b2118", road: "#4a3a28", building: "#6b5136", buildingBorder: "#4a3a28", landmarkFill: "#8a5a3a", landmarkBorder: "#c98f4a", rx: 3, labels: ["城主府", "皇宮", "廟宇", "書院"] },
  modern: { bg: "#22262e", road: "#3a4250", building: "#4d5866", buildingBorder: "#3a4250", landmarkFill: "#5b7ea6", landmarkBorder: "#8fc0e8", rx: 2, labels: ["商辦", "百貨", "醫院", "車站"] },
  scifi: { bg: "#191634", road: "#332d5e", building: "#4a3f7a", buildingBorder: "#332d5e", landmarkFill: "#6d4fa8", landmarkBorder: "#b28fff", rx: 10, labels: ["母艦指揮中心", "太空站", "研究艙", "能源核心"] },
  fantasy: { bg: "#1c2b1e", road: "#3a4d34", building: "#4f6b47", buildingBorder: "#3a4d34", landmarkFill: "#8a6a2a", landmarkBorder: "#e0b84a", rx: 6, labels: ["城堡", "法師塔", "神殿", "精靈居所"] },
};

const THEME_KEYWORDS = [
  { theme: "scifi", words: ["星", "太空", "機甲", "科幻", "宇宙", "銀河"] },
  { theme: "ancient", words: ["古", "俠", "朝", "江湖", "武林", "宮"] },
  { theme: "fantasy", words: ["魔法", "精靈", "異世界", "奇幻", "龍", "勇者"] },
];

export function resolveTheme(rawTheme, hintText = "") {
  if (THEME_VISUALS[rawTheme]) return rawTheme;
  for (const { theme, words } of THEME_KEYWORDS) {
    if (words.some((w) => hintText.includes(w))) return theme;
  }
  return "modern";
}

const CATEGORY_LANDMARK_CHANCE = {
  "大型地標": 0.9,
  "獨處療癒": 0.55,
  "社交熱鬧": 0.4,
  "民生小店": 0.1,
  "隱密秘境": 0.2,
};

// 每個地點類型固定一個標記色，地圖上的點跟下方清單卡片共用同一色，方便對照。
export const CATEGORY_COLORS = {
  "大型地標": "#f2a13a",
  "獨處療癒": "#5ac8e0",
  "社交熱鬧": "#e0567a",
  "民生小店": "#8bc46a",
  "隱密秘境": "#a06adf",
};

export function resolveCategory(raw) {
  return CATEGORY_LANDMARK_CHANCE[raw] !== undefined ? raw : "民生小店";
}

export function categoryColor(category) {
  return CATEGORY_COLORS[resolveCategory(category)];
}

const overlaps = (a, b, margin = 6) =>
  a.x - margin < b.x + b.w && a.x + a.w + margin > b.x && a.y - margin < b.y + b.h && a.y + a.h + margin > b.y;

function buildRoads(rng) {
  const roads = [];
  const mainY = MAP_H / 2;
  const mainX = MAP_W / 2;
  roads.push({ x1: 0, y1: mainY, x2: MAP_W, y2: mainY, main: true });
  roads.push({ x1: mainX, y1: 0, x2: mainX, y2: MAP_H, main: true });

  const branchCount = 5 + Math.floor(rng() * 4); // 5~8
  for (let i = 0; i < branchCount; i++) {
    const fromVertical = rng() < 0.5;
    if (fromVertical) {
      const y0 = rng() * MAP_H;
      const dir = rng() < 0.5 ? -1 : 1;
      const len = 30 + rng() * 60;
      roads.push({ x1: mainX, y1: y0, x2: Math.max(4, Math.min(MAP_W - 4, mainX + dir * len)), y2: y0 });
    } else {
      const x0 = rng() * MAP_W;
      const dir = rng() < 0.5 ? -1 : 1;
      const len = 20 + rng() * 40;
      roads.push({ x1: x0, y1: mainY, x2: x0, y2: Math.max(4, Math.min(MAP_H - 4, mainY + dir * len)) });
    }
  }
  return roads;
}

function distToSegment(x, y, r) {
  const { x1, y1, x2, y2 } = r;
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((x - x1) * dx + (y - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

function nearRoad(x, y, roads, margin = 10) {
  return roads.some((r) => {
    if (r.y1 === r.y2) return Math.abs(y - r.y1) < margin && x >= Math.min(r.x1, r.x2) - margin && x <= Math.max(r.x1, r.x2) + margin;
    return Math.abs(x - r.x1) < margin && y >= Math.min(r.y1, r.y2) - margin && y <= Math.max(r.y1, r.y2) + margin;
  });
}

function buildGeneralBuildings(rng, roads) {
  const buildings = [];
  const step = 18;
  for (let gx = step / 2; gx < MAP_W; gx += step) {
    for (let gy = step / 2; gy < MAP_H; gy += step) {
      if (!nearRoad(gx, gy, roads, 12)) continue;
      if (rng() > 0.6) continue;
      const w = 8 + rng() * 8;
      const h = 8 + rng() * 8;
      buildings.push({ x: gx - w / 2, y: gy - h / 2, w, h });
    }
  }
  return buildings;
}

function buildLandmarks(rng, roads, theme) {
  const visuals = THEME_VISUALS[theme];
  const count = 2 + Math.floor(rng() * 3); // 2~4
  const landmarks = [];
  let attempts = 0;
  while (landmarks.length < count && attempts < 200) {
    attempts++;
    const w = 30 + rng() * 50;
    const h = 24 + rng() * 40;
    const x = rng() * (MAP_W - w);
    const y = rng() * (MAP_H - h);
    const candidate = { x, y, w, h };
    if (landmarks.some((l) => overlaps(candidate, l, 8))) continue;
    const label = visuals.labels[Math.floor(rng() * visuals.labels.length)];
    landmarks.push({ ...candidate, label });
  }
  return landmarks;
}

// 依 character_id(+map_version) 當 seed，產生固定城市佈局並把地點標記對應到建築/地標上。
export function generateCityMap(seed, places, rawTheme, hintText = "") {
  const theme = resolveTheme(rawTheme, hintText);
  const visuals = THEME_VISUALS[theme];
  const rng = rngOf(String(seed));

  const roads = buildRoads(rng);
  const buildings = buildGeneralBuildings(rng, roads);
  const landmarks = buildLandmarks(rng, roads, theme);

  const usedBuildingIdx = new Set();
  const usedLandmarkIdx = new Set();
  const markers = [];

  for (const place of places || []) {
    const category = resolveCategory(place.category);
    const chance = CATEGORY_LANDMARK_CHANCE[category];
    const wantLandmark = rng() < chance && landmarks.length > usedLandmarkIdx.size;
    let target = null;
    if (wantLandmark) {
      let idx;
      let tries = 0;
      do { idx = Math.floor(rng() * landmarks.length); tries++; } while (usedLandmarkIdx.has(idx) && tries < 20);
      usedLandmarkIdx.add(idx);
      target = landmarks[idx];
    } else if (buildings.length) {
      let idx;
      let tries = 0;
      do { idx = Math.floor(rng() * buildings.length); tries++; } while (usedBuildingIdx.has(idx) && tries < 20);
      usedBuildingIdx.add(idx);
      target = buildings[idx];
    }
    if (!target) continue;
    const mx = target.x + target.w / 2;
    const my = target.y + target.h / 2;
    const color = CATEGORY_COLORS[category];
    markers.push({ x: mx, y: my, name: place.name, category, color });

    // 找離這個地點最近的道路，把該路段染成同色，讓「路線配合點的顏色」
    let nearest = null;
    let nearestDist = Infinity;
    for (const r of roads) {
      const d = distToSegment(mx, my, r);
      if (d < nearestDist) { nearestDist = d; nearest = r; }
    }
    if (nearest && nearestDist < 40) nearest.tint = color;
  }

  return { theme, visuals, roads, buildings, landmarks, markers, w: MAP_W, h: MAP_H };
}
