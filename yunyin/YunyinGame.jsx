import React, { useEffect, useRef, useState } from "react";
import { TILE, parseMap, drawMap, drawTree } from "./engine/tilemap";
import { astar, nearestWalkable } from "./engine/pathfind";
import { createInput } from "./engine/input";
import gateDef from "./data/maps/gate";
import farmDef from "./data/maps/farm";
import { loadSave, persistSave } from "./systems/save";
import { settleExp } from "./systems/cultivation";
import { plotStage, plotUnlocked, harvestPlot, plantCrop, remainMin, ripenedDuring, cropById } from "./systems/farm";
import { CROPS } from "./data/crops";
import { settleShelves, refreshOrders, furnaceDone } from "./systems/shop";
import { resetDungeonDaily } from "./systems/dungeon";
import { drawActor, randomAppearance } from "./engine/sprite";
import { spawnNpcs, updateNpcs, talkToNpc, npcAtTile } from "./systems/npc";
import { companionReact, activePackLines, PACK_POOLS, addPackVersion } from "./systems/ai";
import { getImage, isReady } from "./engine/assets";
import { BUILDING_IMAGES, TILE_IMAGES, CROP_IMAGES } from "./data/assetUrls";
import CultivationPanel from "./ui/CultivationPanel";
import ShopPanel from "./ui/ShopPanel";
import DungeonPanel from "./ui/DungeonPanel";
import CharacterPanel from "./ui/CharacterPanel";
import GameSettingsPanel from "./ui/GameSettingsPanel";
import { useGacha } from "../contexts/GachaContext";

const MAPS = { gate: gateDef, farm: farmDef };

const SCALE = 2;            // 邏輯 32px tile、顯示 64px
const STEP_MS = 200;        // 走一格的時間

const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? `${h} 小時 ${m} 分` : `${m} 分鐘`;
};

// characters / onAiGenerate 由 MaliPhone 注入（唯讀角色清單 + 句庫生成能力）；不傳也能完整遊玩
function YunyinRuntime({ onBack, characters = [], onAiGenerate = null, initialSave }) {
  const { crystals, changeCrystals } = useGacha();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [panel, setPanel] = useState(null); // { type, title, ... }
  const addCrystals = (amount) => changeCrystals(amount);
  const [toast, setToast] = useState(null);
  const [companionNotice, setCompanionNotice] = useState(null);
  const toastTimerRef = useRef(null);
  const companionTimerRef = useRef(null);
  const showToast = (msg) => {
    clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };
  const showCompanionNotice = (line) => {
    clearTimeout(companionTimerRef.current);
    const character = characters.find((character) => character.id === line?.charId);
    setCompanionNotice({ ...line, avatar: line?.avatar || character?.avatar || character?.avatarUrl || "" });
    companionTimerRef.current = setTimeout(() => setCompanionNotice(null), 5200);
  };
  const panelRef = useRef(null);
  panelRef.current = setPanel;
  const toastRef = useRef(null);
  toastRef.current = showToast;

  // 存檔載入 + 離線結算（只跑一次）
  const [gameSave] = useState(() => initialSave);
  const [summary, setSummary] = useState(() => {
    const now = Date.now();
    const offlineMin = Math.max(0, (now - gameSave.lastSeenAt) / 60000);
    const expGained = settleExp(gameSave.cultivation);
    const ripened = ripenedDuring(gameSave, gameSave.lastSeenAt, now);
    const shopRes = settleShelves(gameSave, now);      // 貨架離線照賣
    const crafted = furnaceDone(gameSave.shop.furnace, now); // 已煉好待收數（不自動收）
    refreshOrders(gameSave, now);                      // 跨日刷新行商訂單
    resetDungeonDaily(gameSave, now);                  // 跨日重置秘境次數
    if (offlineMin >= 1 && (expGained >= 1 || ripened > 0 || shopRes.sold > 0 || crafted > 0)) {
      return { mins: offlineMin, expGained: Math.floor(expGained), ripened, ...shopRes, crafted };
    }
    return null;
  });
  const [coins, setCoins] = useState(gameSave.coins);
  const [mapTitle, setMapTitle] = useState("");
  const markDirty = () => { setCoins(gameSave.coins); persistSave(gameSave); };
  const markDirtyRef = useRef(null);
  markDirtyRef.current = markDirty;

  // 同伴台詞：面板與農務觸發點共用（從個人句庫/通用句庫抽，零 token）。回傳 { name, text } 或 null。
  const onCompanion = (opts) => companionReact({ save: gameSave, characters, ...opts });
  // 效果層提供的「讓綁定角色的 NPC 冒泡泡」能力（角色不在場回傳 false）
  const npcBubbleRef = useRef(() => false);
  // 效果層提供的「即時更新在場 NPC 外觀」能力（設定面板編輯後立刻反映在地圖上）
  const npcAppearanceRef = useRef(() => {});

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    const savedPos = gameSave.player.pos;
    let map = parseMap(MAPS[savedPos.map] || gateDef);
    setMapTitle(map.name);

    // ---- 遊戲狀態（不進 React state，rAF 直接讀寫）----
    const spawn = savedPos.map === map.id && !map.isBlocked(savedPos.x, savedPos.y)
      ? [savedPos.x, savedPos.y] : map.spawn;
    const player = {
      x: spawn[0], y: spawn[1],                   // 目前所在格
      px: spawn[0] * TILE, py: spawn[1] * TILE,   // 世界像素座標
      path: [], stepT: 0, from: null, facing: "down", moving: false,
    };
    const cam = { x: 0, y: 0, follow: true };
    let npcs = spawnNpcs(gameSave, map, characters);          // 漫遊 NPC（山門／靈田協助角色）
    // 綁定角色的顯示名（角色入駐後 NPC 掛角色名）
    const npcDisplayName = (npc) => {
      const charId = gameSave.settings.bindings[npc.seed];
      return charId ? (characters.find((c) => c.id === charId)?.name || npc.name) : null;
    };
    npcBubbleRef.current = (charId, text) => {
      const npc = npcs.find((n) => gameSave.settings.bindings[n.seed] === charId);
      if (!npc) return false;
      const length = String(text || "").length;
      npc.bubble = { text, until: performance.now() + Math.min(6500, 3500 + Math.max(0, length - 24) * 55) };
      npc.path = [];
      return true;
    };
    npcAppearanceRef.current = (seed, appearance) => {
      const npc = npcs.find((n) => n.seed === seed);
      if (npc) npc.appearance = appearance;
    };
    let pendingAction = null;                     // 抵達路徑終點後要做的事
    if (import.meta.env.DEV) window.__yy = { player, map, cam, save: gameSave, npcs, open: (type, title) => panelRef.current({ type, title }) }; // 開發用
    let ripple = null;                            // 點擊漣漪 { wx, wy, t0 }
    let viewW = 0, viewH = 0, dpr = 1, raf = 0, lastT = 0;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      viewW = wrap.clientWidth; viewH = wrap.clientHeight;
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
      canvas.style.width = `${viewW}px`;
      canvas.style.height = `${viewH}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const clampCam = () => {
      const worldW = map.w * TILE, worldH = map.h * TILE;
      const vw = viewW / SCALE, vh = viewH / SCALE;
      cam.x = worldW <= vw ? (worldW - vw) / 2 : Math.max(0, Math.min(worldW - vw, cam.x));
      cam.y = worldH <= vh ? (worldH - vh) / 2 : Math.max(0, Math.min(worldH - vh, cam.y));
    };

    const walkTo = (tx, ty, action) => {
      const target = nearestWalkable(tx, ty, map.w, map.h, map.isBlocked);
      if (!target) return;
      const path = astar(player.x, player.y, target.x, target.y, map.w, map.h, map.isBlocked);
      if (!path) return;
      player.path = path;
      player.stepT = 0;
      pendingAction = action || null;
      cam.follow = true;
      if (!path.length && pendingAction) { const a = pendingAction; pendingAction = null; a(); }
    };

    // 切換地圖：玩家瞬移到目標出生點，鏡頭直接對準
    const switchMap = (toId, spawnTile) => {
      map = parseMap(MAPS[toId]);
      npcs = spawnNpcs(gameSave, map, characters);
      if (import.meta.env.DEV && window.__yy) { window.__yy.map = map; window.__yy.npcs = npcs; }
      setMapTitle(map.name);
      player.path = []; player.from = null; player.stepT = 0;
      pendingAction = null;
      player.x = spawnTile[0]; player.y = spawnTile[1];
      player.px = player.x * TILE; player.py = player.y * TILE;
      cam.follow = true;
      cam.x = player.px + TILE / 2 - viewW / SCALE / 2;
      cam.y = player.py + TILE / 2 - viewH / SCALE / 2;
      clampCam();
      persistSave(gameSave);
    };

    // 靈田地塊：抵達後依狀態種植/收成/查看
    const onPlotArrive = (plotIdx) => {
      const plot = gameSave.farm.plots[plotIdx];
      const stage = plotStage(plot);
      if (stage === null) {
        panelRef.current({ type: "plant", title: "選擇要種的作物", plotIdx });
      } else if (stage === 3) {
        const r = harvestPlot(gameSave, plotIdx);
        if (r) {
          toastRef.current(`${r.crop.icon} ${r.crop.name} ×${r.count} 入袋`);
          markDirtyRef.current();
          // 同伴搭話：稀有收成必觸發，一般收成走 10 分鐘冷卻
          const rare = r.crop.id === "xinglu";
          onCompanion({
            poolKey: rare ? "rareHarvest" : "harvest", force: rare,
            prompt: `玩家剛在靈田收成了 ${r.crop.name} ×${r.count}${rare ? "（非常稀有的作物）" : ""}。`,
          }).then((line) => {
            if (!line) return;
            if (!npcBubbleRef.current(line.charId, line.text)) showCompanionNotice(line);
          });
        }
      } else {
        const plotCrop = cropById(plot.cropId);
        toastRef.current(`${plotCrop.icon} ${plotCrop.name} 還要 ${remainMin(plot)} 分鐘成熟`);
      }
    };

    const detachInput = createInput(canvas, {
      onDrag: (dx, dy) => {
        cam.follow = false;
        cam.x -= dx / SCALE; cam.y -= dy / SCALE;
        clampCam();
      },
      onTap: (sx, sy) => {
        const wx = cam.x + sx / SCALE, wy = cam.y + sy / SCALE;
        const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
        ripple = { wx, wy, t0: performance.now() };
        // 點到 NPC → 冒一句話（入駐角色開著角色回覆時用個人句庫的閒聊池）
        const npc = npcAtTile(npcs, tx, ty);
        if (npc) {
          if (npc.helper) {
            panelRef.current({ type: "farmAssist", title: `${npc.name}的靈田協助`, npc });
            return;
          }
          const charId = gameSave.settings.bindings[npc.seed];
          const chatLines = charId ? activePackLines(gameSave, charId)?.chat : null;
          talkToNpc(npc, performance.now(), chatLines);
          return;
        }
        // 點到自己 → 捏角
        if (tx === player.x && ty === player.y && !player.moving) {
          panelRef.current({ type: "character", title: "外觀" });
          return;
        }
        // 點到建築 → 走到門口開面板
        const b = map.buildings.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
        if (b) {
          walkTo(b.door[0], b.door[1], () => panelRef.current({ type: b.opens, title: b.label }));
          return;
        }
        const p = map.portals.find((p) => p.x === tx && p.y === ty);
        if (p) {
          walkTo(p.x, p.y, () => {
            if (MAPS[p.to]) switchMap(p.to, p.spawn);
            else if (p.to === "dungeon") panelRef.current({ type: "dungeon", title: "🌫️ 秘境" });
            else panelRef.current({ type: "portal", title: `${p.icon} ${p.label}` });
          });
          return;
        }
        // 靈田地塊
        const plotIdx = (map.plots || []).findIndex((pl) => pl.x === tx && pl.y === ty);
        if (plotIdx >= 0) {
          if (!plotUnlocked(plotIdx, gameSave.cultivation)) {
            toastRef.current("🔒 境界不足，尚未開墾");
            return;
          }
          walkTo(tx, ty, () => onPlotArrive(plotIdx));
          return;
        }
        walkTo(tx, ty, null);
      },
    });

    const updatePlayer = (dt) => {
      if (!player.path.length) { player.moving = false; return; }
      player.moving = true;
      player.stepT += dt;
      // 一幀可跨多格：分頁被節流（rAF 一秒一幀）或卡頓時，用大 dt 一次補完該走的格數
      while (player.path.length && player.stepT >= STEP_MS) {
        const next = player.path.shift();
        player.x = next.x; player.y = next.y;
        player.stepT -= STEP_MS;
        if (!player.path.length && pendingAction) { const a = pendingAction; pendingAction = null; a(); }
      }
      if (player.path.length) {
        const next = player.path[0];
        player.facing = next.x > player.x ? "right" : next.x < player.x ? "left" : next.y > player.y ? "down" : "up";
        const t = player.stepT / STEP_MS;
        player.px = (player.x + (next.x - player.x) * t) * TILE;
        player.py = (player.y + (next.y - player.y) * t) * TILE;
      } else {
        player.px = player.x * TILE; player.py = player.y * TILE;
        player.stepT = 0;
      }
    };

    const drawBuilding = (b) => {
      const sx = (b.x * TILE - cam.x) * SCALE, sy = (b.y * TILE - cam.y) * SCALE;
      const w = b.w * TILE * SCALE, h = b.h * TILE * SCALE;
      const img = b.img && getImage(BUILDING_IMAGES[b.img]);
      if (img && isReady(img)) {
        // 素材圖通常比地面「占地」footprint 高很多（有屋頂/樓層），寬度對齊 footprint、
        // 高度依圖片原生比例延伸，錨點對齊 footprint 底部（門口那一排）往上長
        const drawW = w, drawH = w * (img.naturalHeight / img.naturalWidth);
        ctx.drawImage(img, sx, sy + h - drawH, drawW, drawH);
      } else {
        // 素材載入前 / 沒有素材：色塊占位
        ctx.fillStyle = b.color;
        ctx.fillRect(sx, sy + h * 0.3, w, h * 0.7);
        ctx.fillStyle = b.roof;
        ctx.beginPath();
        ctx.moveTo(sx - w * 0.06, sy + h * 0.34);
        ctx.lineTo(sx + w / 2, sy - h * 0.08);
        ctx.lineTo(sx + w + w * 0.06, sy + h * 0.34);
        ctx.closePath();
        ctx.fill();
        const doorSx = (b.door[0] * TILE - cam.x) * SCALE, doorW = TILE * SCALE * 0.5;
        ctx.fillStyle = "#3a2c22";
        ctx.fillRect(doorSx + TILE * SCALE * 0.25, sy + h - TILE * SCALE * 0.7, doorW, TILE * SCALE * 0.7);
      }
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = `${12 * SCALE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 4;
      ctx.fillText(b.label, sx + w / 2, sy + h * 0.98);
      ctx.shadowBlur = 0;
    };

    const drawPortal = (p, now) => {
      const sx = (p.x * TILE + TILE / 2 - cam.x) * SCALE, sy = (p.y * TILE + TILE / 2 - cam.y) * SCALE;
      const pulse = 1 + Math.sin(now / 400) * 0.08;
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.beginPath();
      ctx.arc(sx, sy, TILE * SCALE * 0.42 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${16 * SCALE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.icon, sx, sy - 2);
      ctx.textBaseline = "alphabetic";
      ctx.font = `${9 * SCALE}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillText(p.label, sx, sy + TILE * SCALE * 0.62);
    };

    // 靈田地塊：土壤素材 + 作物階段圖（無素材時退回色塊/emoji）
    const soilImg = getImage(TILE_IMAGES.soil);
    const drawPlot = (pl, idx, now) => {
      const ts = TILE * SCALE;
      const sx = (pl.x * TILE - cam.x) * SCALE, sy = (pl.y * TILE - cam.y) * SCALE;
      const unlocked = plotUnlocked(idx, gameSave.cultivation);
      if (isReady(soilImg)) {
        ctx.drawImage(soilImg, sx, sy, ts, ts);
        if (!unlocked) { ctx.fillStyle = "rgba(20,18,15,.55)"; ctx.fillRect(sx, sy, ts, ts); }
      } else {
        ctx.fillStyle = unlocked ? "#6e5137" : "#5a5248";
        ctx.fillRect(sx + ts * 0.06, sy + ts * 0.06, ts * 0.88, ts * 0.88);
        ctx.fillStyle = unlocked ? "#83644a" : "#6b6357";
        ctx.fillRect(sx + ts * 0.14, sy + ts * 0.14, ts * 0.72, ts * 0.72);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!unlocked) {
        ctx.font = `${11 * SCALE}px sans-serif`;
        ctx.fillText("🔒", sx + ts / 2, sy + ts / 2);
      } else {
        const plot = gameSave.farm.plots[idx];
        const stage = plotStage(plot, Date.now());
        if (stage !== null) {
          const crop = cropById(plot.cropId);
          const cropImg = CROP_IMAGES[crop.id] && getImage(CROP_IMAGES[crop.id][stage]);
          if (stage === 3) {
            // 熟成：金色呼吸圈提示可收（圖片和 emoji 版都疊這個）
            const pulse = 1 + Math.sin(now / 300) * 0.1;
            ctx.strokeStyle = "rgba(255, 205, 90, .9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx + ts / 2, sy + ts / 2, ts * 0.4 * pulse, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (cropImg && isReady(cropImg)) {
            ctx.drawImage(cropImg, sx + ts * 0.05, sy + ts * 0.05, ts * 0.9, ts * 0.9);
          } else if (stage === 0) {
            ctx.fillStyle = "#4a3826";
            ctx.fillRect(sx + ts * 0.34, sy + ts * 0.46, ts * 0.08, ts * 0.08);
            ctx.fillRect(sx + ts * 0.58, sy + ts * 0.46, ts * 0.08, ts * 0.08);
          } else {
            ctx.font = `${(stage === 1 ? 9 : stage === 2 ? 11 : 14) * SCALE}px sans-serif`;
            ctx.fillText(stage === 1 ? "🌱" : crop.icon, sx + ts / 2, sy + ts * 0.5);
          }
        }
      }
      ctx.textBaseline = "alphabetic";
    };

    // 玩家與 NPC 都走同一顆 drawActor（紙娃娃入口，素材接入時只換它的內部）
    const drawCharacter = (actor, appearance, now) => {
      drawActor(ctx, appearance, {
        sx: (actor.px - cam.x) * SCALE, sy: (actor.py - cam.y) * SCALE,
        ts: TILE * SCALE, facing: actor.facing, moving: actor.moving, now,
      });
    };

    // NPC 頭上對話泡泡（畫在最上層）
    const drawBubble = (npc) => {
      const ts = TILE * SCALE;
      const cx = (npc.px - cam.x) * SCALE + ts / 2;
      const topY = (npc.py - cam.y) * SCALE - ts * 1.4; // 長句氣泡抬高，避免壓住附近角色名牌
      ctx.font = `${10 * SCALE}px sans-serif`;
      const maxW = Math.min(220, viewW - 24);
      const paddingX = 12;
      const lineH = 13 * SCALE;
      const source = String(npc.bubble.text || "").replace(/[\r\n]+/g, " ").trim();
      const lines = [];
      let line = "";
      for (const char of source) {
        const candidate = line + char;
        if (line && ctx.measureText(candidate).width > maxW - paddingX * 2) { lines.push(line); line = char; }
        else line = candidate;
      }
      if (line) lines.push(line);
      const visibleLines = lines.slice(0, 3);
      if (lines.length > 3) {
        let last = visibleLines[visibleLines.length - 1] || "";
        while (last && ctx.measureText(`${last}…`).width > maxW - paddingX * 2) last = last.slice(0, -1);
        visibleLines[visibleLines.length - 1] = `${last}…`;
      }
      const w = Math.min(maxW, Math.max(72, ...visibleLines.map((value) => ctx.measureText(value).width + paddingX * 2)));
      const h = visibleLines.length * lineH + 10;
      const bx = Math.max(4, Math.min(viewW - w - 4, cx - w / 2));
      ctx.fillStyle = "rgba(255,255,255,.94)";
      ctx.beginPath();
      ctx.roundRect(bx, topY - h, w, h, 8);
      ctx.fill();
      ctx.fillStyle = "#4a4038";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      visibleLines.forEach((value, index) => ctx.fillText(value, bx + w / 2, topY - h / 2 + lineH * (index - (visibleLines.length - 1) / 2)));
      ctx.textBaseline = "alphabetic";
    };

    // 先排下一幀再畫：畫的過程就算丟出例外，迴圈也不會斷（凍住 = 必須退出重進的元兇）
    let lastFrameAt = 0, frameErrLogged = false;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      lastFrameAt = now;
      try {
        drawFrame(now);
      } catch (err) {
        if (!frameErrLogged) { frameErrLogged = true; console.error("yunyin frame error", err); }
      }
    };
    const drawFrame = (now) => {
      const dt = lastT ? Math.min(2000, now - lastT) : 16;
      lastT = now;
      updatePlayer(dt);
      updateNpcs(npcs, map, dt, now);
      if (cam.follow) {
        const targetX = player.px + TILE / 2 - viewW / SCALE / 2;
        const targetY = player.py + TILE / 2 - viewH / SCALE / 2;
        cam.x += (targetX - cam.x) * 0.12;
        cam.y += (targetY - cam.y) * 0.12;
        clampCam();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#1c2733";
      ctx.fillRect(0, 0, viewW, viewH);
      drawMap(ctx, map, cam, SCALE, viewW, viewH);
      map.plots.forEach((pl, idx) => drawPlot(pl, idx, now));
      for (const p of map.portals) drawPortal(p, now);
      // 2.5D 遮擋：建築與所有角色按 y 排序後一起畫
      const drawables = [
        ...map.buildings.map((b) => ({ y: (b.y + b.h) * TILE, draw: () => drawBuilding(b) })),
        ...map.trees.map((t) => ({ y: (t.y + 1) * TILE, draw: () => drawTree(ctx, t, cam, SCALE) })),
        ...npcs.map((n) => ({ y: n.py + TILE, draw: () => {
          drawCharacter(n, n.appearance, now);
          const boundName = npcDisplayName(n);
          if (boundName) {
            const ts = TILE * SCALE;
            ctx.font = `${8 * SCALE}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(255,255,255,.95)";
            ctx.strokeStyle = "rgba(0,0,0,.5)";
            ctx.lineWidth = 3;
            const nx = (n.px - cam.x) * SCALE + ts / 2, ny = (n.py - cam.y) * SCALE - ts * 0.9; // 名牌微降，貼近角色頭頂
            ctx.strokeText(boundName, nx, ny);
            ctx.fillText(boundName, nx, ny);
            if (n.helper) {
              ctx.font = `${6.5 * SCALE}px sans-serif`;
              ctx.fillStyle = "rgba(255,239,180,.98)";
              ctx.strokeStyle = "rgba(70,45,35,.72)";
              ctx.lineWidth = 2;
              ctx.fillText("照料中", nx, ny + 8 * SCALE);
            }
          }
        } })),
        { y: player.py + TILE, draw: () => drawCharacter(player, gameSave.player.appearance, now) },
      ].sort((a, b) => a.y - b.y);
      for (const d of drawables) d.draw();
      // 對話泡泡永遠在最上層
      for (const n of npcs) if (n.bubble) drawBubble(n);
      // 點擊漣漪（age 夾 0：rAF 的 now 是幀起始時間戳，可能比剛記下的 t0 早一點點，
      // 負值會讓 arc() 收到負半徑直接丟例外）
      if (ripple) {
        const age = Math.max(0, now - ripple.t0);
        if (age > 450) ripple = null;
        else {
          const r = (age / 450) * TILE * SCALE * 0.6;
          ctx.strokeStyle = `rgba(255, 224, 130, ${1 - age / 450})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc((ripple.wx - cam.x) * SCALE, (ripple.wy - cam.y) * SCALE, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };
    // 首幀就對準玩家，避免鏡頭從 (0,0) 滑過去
    cam.x = player.px + TILE / 2 - viewW / SCALE / 2;
    cam.y = player.py + TILE / 2 - viewH / SCALE / 2;
    clampCam();
    raf = requestAnimationFrame(frame);

    // 位置寫進存檔；離開頁面/切背景時也存一次
    const persistPos = () => {
      gameSave.player.pos = { map: map.id, x: player.x, y: player.y };
      persistSave(gameSave);
    };
    const onHide = () => { if (document.visibilityState === "hidden") persistPos(); };
    document.addEventListener("visibilitychange", onHide);
    const persistTimer = setInterval(persistPos, 30000);

    // 看門狗：頁面可見卻超過 1.5 秒沒有新幀（rAF 鏈因任何原因斷掉）就重啟迴圈
    const watchdog = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (performance.now() - lastFrameAt > 1500) {
        cancelAnimationFrame(raf);
        lastT = 0; // dt 重新起算，避免補一大步
        raf = requestAnimationFrame(frame);
      }
    }, 1500);

    return () => {
      cancelAnimationFrame(raf);
      detachInput();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      clearInterval(persistTimer);
      clearInterval(watchdog);
      persistPos();
    };
  }, []);

  return (
    <div ref={wrapRef} className="mp-page yunyin-game-page" data-yunyin-root="1" style={{ background: "#1c2733", overflow: "hidden", touchAction: "none" }}>
      {/* touchAction 要直接放在 canvas 上（不會繼承）：否則手機瀏覽器會把拖曳當成捲動手勢
          搶走 pointer 事件（pointercancel），玩起來就是「點了沒反應、卡住」 */}
      <canvas ref={canvasRef} style={{ display: "block", imageRendering: "pixelated", touchAction: "none" }} />
      {/* HUD：HTML 疊在 canvas 上 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", pointerEvents: "none" }}>
        <button onClick={onBack} style={{ pointerEvents: "auto", border: 0, borderRadius: 12, padding: "6px 12px", background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 15, cursor: "pointer" }}>←</button>
        <div style={{ color: "#fff", fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>雲隱山莊 · {mapTitle}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, color: "#fff", fontSize: 13, background: "rgba(0,0,0,.45)", borderRadius: 12, padding: "5px 10px" }}>
          <span>🪙 {coins}</span>
          <span>💎 {crystals}</span>
        </div>
      </div>
      {/* 右側按鈕欄（仿手遊：之後加背包/任務就是往下疊按鈕） */}
      <div style={{ position: "absolute", top: 56, right: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {[["settings", "⚙️", "遊戲設定"]].map(([type, icon, title]) => (
          <button key={type} onClick={() => setPanel({ type, title })} style={{
            width: 40, height: 40, borderRadius: 14, border: 0, cursor: "pointer",
            background: "rgba(0,0,0,.45)", fontSize: 18, display: "grid", placeItems: "center",
          }}>{icon}</button>
        ))}
      </div>
      {panel && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 5 }} onClick={() => setPanel(null)}>
          <div data-yunyin-panel="1" onClick={(e) => e.stopPropagation()} style={{ background: "#fffaf3", borderRadius: 18, padding: "20px 22px", width: "min(84%, 330px)", maxHeight: "84%", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, textAlign: "center" }}>{panel.title}</div>
            {panel.type === "cultivation" ? (
              <CultivationPanel save={gameSave} onDirty={markDirty} onCompanion={onCompanion} onClose={() => setPanel(null)} />
            ) : panel.type === "shop" ? (
              <ShopPanel save={gameSave} onDirty={markDirty} onToast={showToast} onCrystals={addCrystals} onClose={() => setPanel(null)} />
            ) : panel.type === "dungeon" ? (
              <DungeonPanel save={gameSave} onDirty={markDirty} onToast={showToast} onCompanion={onCompanion} onCrystals={addCrystals} onClose={() => setPanel(null)} />
            ) : panel.type === "farmAssist" ? (
              <div style={{ textAlign: "center", color: "#5d5147" }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>🌱</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>「讓我來幫你照料植物吧。靈田的靈氣今天很溫柔，應該能讓它們長得更快。」</div>
                <div style={{ display: "flex", gap: 8 }}><button style={{ flex: 1, border: 0, borderRadius: 12, padding: "10px 8px", background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff", fontWeight: 700 }} onClick={() => { const helper = panel.npc; helper.helper = false; helper.waitUntil = performance.now() + 120; helper.path = []; const planted = gameSave.farm.plots.filter((plot) => plot.cropId); if (!planted.length) { showToast("目前沒有正在生長的作物"); setPanel(null); return; } const target = planted[Math.floor(Math.random() * planted.length)]; const crop = cropById(target.cropId); const remain = Math.max(0, (target.plantedAt + crop.growMin * 60000 * 0.9) - Date.now()); target.plantedAt -= Math.floor(remain * 0.25); gameSave.farmAssist = { day: new Date().toISOString().slice(0, 10), used: true }; markDirty(); showToast(`${helper.name}照料了${crop.name}，剩餘時間縮短 25%`); setPanel(null); }}>接受協助</button><button style={{ flex: 1, border: 0, borderRadius: 12, padding: "10px 8px", background: "#e8ddd0", color: "#6b5d4f", fontWeight: 700 }} onClick={() => { panel.npc.helper = false; panel.npc.waitUntil = performance.now() + 120; panel.npc.path = []; setPanel(null); }}>先不用</button></div>
              </div>
            ) : panel.type === "settings" ? (
              <GameSettingsPanel
                save={gameSave} characters={characters} onDirty={markDirty}
                onGenerateLines={onAiGenerate ? async (charId) => {
                  const lines = await onAiGenerate(charId, PACK_POOLS);
                  if (!lines) return "生成失敗（檢查 API 設定）";
                  addPackVersion(gameSave, charId, lines);
                  markDirty();
                  return null;
                } : null}
                onEditAppearance={(npcIdx) => setPanel({
                  type: "character", npcIdx,
                  title: `${gameSave.npcs[npcIdx]?.name || "居民"}的外觀`,
                  returnTo: { type: "settings", title: "遊戲設定" },
                })}
                onClose={() => setPanel(null)}
              />
            ) : panel.type === "character" ? (
              <CharacterPanel
                key={panel.npcIdx ?? "player"}
                value={panel.npcIdx != null
                  ? (gameSave.npcs[panel.npcIdx].appearance || randomAppearance(gameSave.npcs[panel.npcIdx].seed))
                  : gameSave.player.appearance}
                onSave={(appearance) => {
                  if (panel.npcIdx != null) {
                    gameSave.npcs[panel.npcIdx].appearance = appearance;
                    npcAppearanceRef.current(gameSave.npcs[panel.npcIdx].seed, appearance);
                  } else {
                    gameSave.player.appearance = appearance;
                  }
                  markDirty();
                }}
                onClose={() => setPanel(panel.returnTo || null)}
              />
            ) : panel.type === "plant" ? (
              <div>
                {CROPS.map((c) => {
                  const seedKey = `${c.id}_seed`;
                  const affordable = c.source === "shop" ? coins >= c.seedCost : (gameSave.inventory[seedKey] || 0) > 0;
                  return (
                    <button
                      key={c.id}
                      disabled={!affordable}
                      onClick={() => {
                        const err = plantCrop(gameSave, panel.plotIdx, c.id);
                        if (err) { showToast(err); return; }
                        markDirty();
                        setPanel(null);
                        showToast(`${c.icon} ${c.name} 已下種`);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 8,
                        border: "1px solid #e2d6c6", borderRadius: 12, padding: "10px 12px", textAlign: "left",
                        background: affordable ? "#fff" : "#f1ebe2", cursor: affordable ? "pointer" : "default", opacity: affordable ? 1 : 0.6,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{c.icon}</span>
                      <span style={{ flex: 1 }}>
                        <b style={{ fontSize: 14 }}>{c.name}</b>
                        <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>約 {c.growMin} 分鐘 · 賣 🪙{c.sellPrice}</span>
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5d4f" }}>
                        {c.source === "shop" ? `🪙 ${c.seedCost}` : `種子 ×${gameSave.inventory[seedKey] || 0}`}
                      </span>
                    </button>
                  );
                })}
                <button onClick={() => setPanel(null)} style={{ width: "100%", border: 0, borderRadius: 12, padding: "9px 0", background: "#e8ddd0", color: "#6b5d4f", fontSize: 14, cursor: "pointer" }}>取消</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#8a7a6a", lineHeight: 1.6, textAlign: "center" }}>（此區域尚未開放，接下來的步驟會實作）</div>
                <button onClick={() => setPanel(null)} style={{ marginTop: 14, border: 0, borderRadius: 12, padding: "8px 22px", background: "#7d5a6e", color: "#fff", fontSize: 14, cursor: "pointer", display: "block", margin: "14px auto 0" }}>關閉</button>
              </>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.72)", color: "#fff", fontSize: 13, borderRadius: 14, padding: "8px 16px", whiteSpace: "nowrap", zIndex: 7, pointerEvents: "none" }}>
          {toast}
        </div>
      )}
      {companionNotice && (
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 72, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: "min(92%, 360px)", padding: "9px 13px 9px 9px", border: "1px solid rgba(241,143,157,.45)", borderRadius: 18, background: "rgba(255,250,243,.96)", color: "#4a4038", boxShadow: "0 4px 14px rgba(0,0,0,.22)" }}>
            {companionNotice.avatar ? (
              <img src={companionNotice.avatar} alt="" style={{ width: 42, height: 42, flex: "0 0 42px", borderRadius: "50%", objectFit: "cover", border: "2px solid #f5b7c1", background: "#f5e7df" }} />
            ) : (
              <div style={{ width: 42, height: 42, flex: "0 0 42px", display: "grid", placeItems: "center", borderRadius: "50%", background: "#f5e7df", color: "#a86b7c", fontSize: 20 }}>✿</div>
            )}
            <div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ marginBottom: 2, color: "#8b5c70", fontSize: 11, fontWeight: 800 }}>{companionNotice.name}</div>
              <div style={{ overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>{companionNotice.text}</div>
            </div>
          </div>
        </div>
      )}
      {summary && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(20,14,26,.6)", display: "grid", placeItems: "center", zIndex: 6 }}>
          <div data-yunyin-panel="1" style={{ background: "#fffaf3", borderRadius: 18, padding: "22px 24px", width: "min(80%, 300px)", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
            <div style={{ fontSize: 28 }}>⛰️</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6 }}>閉關歸來</div>
            <div style={{ fontSize: 13, color: "#6b5d4f", marginTop: 10, lineHeight: 1.8 }}>
              你潛修了 <b>{fmtDuration(summary.mins)}</b><br />
              修為 <b style={{ color: "#3d7a5c" }}>+{summary.expGained}</b>
              {summary.ripened > 0 && <><br />靈田熟了 <b style={{ color: "#3d7a5c" }}>{summary.ripened}</b> 格</>}
              {summary.sold > 0 && <><br />貨架賣出 <b>{summary.sold}</b> 件，進帳 <b style={{ color: "#b8860b" }}>🪙{summary.earned}</b></>}
              {summary.crafted > 0 && <><br />丹爐煉好 <b style={{ color: "#3d7a5c" }}>{summary.crafted}</b> 爐待收</>}
            </div>
            <button onClick={() => { setSummary(null); markDirty(); }} style={{ marginTop: 16, border: 0, borderRadius: 12, padding: "9px 30px", background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>收取</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function YunyinGame(props) {
  const [initialSave, setInitialSave] = useState(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let mounted = true;
    loadSave().then((save) => { if (mounted) setInitialSave(save); }).catch((error) => {
      if (!mounted) return;
      setLoadError(error?.message || "存檔載入失敗");
    });
    return () => { mounted = false; };
  }, []);
  if (loadError) return <div className="mp-page" style={{ display: "grid", placeItems: "center", background: "#1c2733", color: "#fff", padding: 24, textAlign: "center" }}><div><div>雲隱山莊存檔載入失敗</div><small>{loadError}</small><br/><button onClick={props.onBack} style={{ marginTop: 15 }}>返回</button></div></div>;
  if (!initialSave) return <div className="mp-page" style={{ display: "grid", placeItems: "center", background: "#1c2733", color: "#fff" }}>正在讀取山莊存檔⋯</div>;
  return <YunyinRuntime {...props} initialSave={initialSave} />;
}
