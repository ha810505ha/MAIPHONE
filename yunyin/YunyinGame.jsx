import React, { useEffect, useRef, useState } from "react";
import { TILE, drawMap, drawTree } from "./engine/tilemap";
import { astar, nearestWalkable } from "./engine/pathfind";
import { createPlayerRuntime, placeActor, updateActorMovement } from "./engine/actorRuntime";
import { centerCameraOnActor, clampCamera, createCamera, followActor } from "./engine/camera";
import { createInput } from "./engine/input";
import { actorReservedSlot, beginActorAction, stopActorAction } from "./engine/actorActions";
import { createMapRuntime, hasMap } from "./world/mapRegistry";
import { routeWorldTap } from "./world/interactionRouter";
import { findInteractionPlan } from "./world/worldInteractions";
import { loadSave, persistSave } from "./systems/save";
import { settleExp, meditateDaily } from "./systems/cultivation";
import { HARVEST_REPLANT_GUARD_MS, plotStage, harvestPlot, remainMin, replantPromptBlocked, ripenedDuring, cropById } from "./systems/farm";
import { settleShelves, refreshOrders, furnaceDone, itemMeta, recipeById } from "./systems/shop";
import { resetDungeonDaily } from "./systems/dungeon";
import { spawnNpcs, updateNpcs } from "./systems/npc";
import { companionReact } from "./systems/ai";
import {
  drawBuilding as renderBuilding,
  drawCharacter as renderCharacter,
  drawFarmPlot,
  drawFurniture,
  drawNpcLabel,
  drawPortal as renderPortal,
  drawSpeechBubble,
  drawWorldDecoration,
} from "./engine/worldRenderer";
import { useGacha } from "../contexts/GachaContext";
import YunyinPanelHost from "./ui/YunyinPanelHost";
import { CameraZoomControl, CompanionNotice, HomeEditorOverlay, OfflineSummary, YunyinHud, YunyinToast, yunyinCameraControlTop } from "./ui/YunyinOverlays";
import { FURNITURE_CATALOG, furnitureById, furnitureMaxCount } from "./home/furnitureCatalog";
import { canAddFurnitureInstance } from "./home/furnitureOwnership";
import { coSleepBonus, choreWorker, markChoreDone, choreBoost, dailyGift } from "./home/homeResidents";
import { markCompanyAction } from "./home/residentRequests";
import { createFurnitureInstance } from "./home/homeState";
import { canPlaceHomeFurniture, furnitureInstanceAt } from "./home/homeEditorRuntime";
import { furnitureTiles } from "./home/furniturePlacement";

const SCALE = 2;            // 邏輯 32px tile、顯示 64px
const STEP_MS = 150;        // 玩家在大型地圖上的逐格移動速度；NPC 維持各自原有設定
const CAMERA_SCALES = [0.5, 1, 1.5, 2];

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
  const addCrystals = (amount, details = {}) => changeCrystals(amount, { source: "yunyin", ...details });
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
    const crafted = gameSave.shop.furnaces.reduce((sum, f) => sum + furnaceDone(f, now), 0); // 兩爐已煉好待收數（不自動收）
    refreshOrders(gameSave, now);                      // 跨日更新行商訂單
    resetDungeonDaily(gameSave, now);                  // 跨日重置秘境次數
    if (offlineMin >= 1 && (expGained >= 1 || ripened > 0 || shopRes.sold > 0 || crafted > 0)) {
      return { mins: offlineMin, expGained: Math.floor(expGained), ripened, ...shopRes, crafted };
    }
    return null;
  });
  const [coins, setCoins] = useState(gameSave.coins);
  const [mapTitle, setMapTitle] = useState("");
  const [homeContext, setHomeContext] = useState(null);
  const [cameraScale, setCameraScale] = useState(SCALE);
  const [homeEditor, setHomeEditor] = useState({ active: false, furnitureId: null, selectedUid: null, preview: null });
  const homeEditorRef = useRef(homeEditor);
  const homeEditorActionsRef = useRef({});
  const homePreviewControlsRef = useRef(null);
  const cameraZoomActionsRef = useRef({});
  const farmAssistActionsRef = useRef({});
  const playerActionRef = useRef(() => {});
  homeEditorRef.current = homeEditor;
  const markDirty = () => { setCoins(gameSave.coins); persistSave(gameSave); };
  const markDirtyRef = useRef(null);
  markDirtyRef.current = markDirty;

  // 同伴台詞：面板與農務觸發點共用（從個人句庫/通用句庫抽，零 token）。
  // 顯示邏輯（NPC 冒泡泡優先，不在場才用畫面提示框）直接包在這裡，所有呼叫點
  // （包含 React 面板內，碰不到 npcBubbleRef 的地方）都自動顯示，不用各自重複。
  const onCompanion = (opts) => companionReact({ save: gameSave, characters, ...opts }).then((line) => {
    if (line && !npcBubbleRef.current(line.charId, line.text)) showCompanionNotice(line);
    return line;
  });
  // 效果層提供的「讓綁定角色的 NPC 冒泡泡」能力（角色不在場回傳 false）
  const npcBubbleRef = useRef(() => false);
  // 效果層提供的「即時更新在場 NPC 外觀」能力（設定面板編輯後立刻反映在地圖上）
  const npcAppearanceRef = useRef(() => {});

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    const savedPos = gameSave.player.pos;
    let map = createMapRuntime(savedPos.map, { instanceId: savedPos.instanceId, homeState: gameSave.home });
    const scaleForMap = (targetMap) => {
      const savedScale = Number(gameSave.settings.cameraScale);
      return CAMERA_SCALES.includes(savedScale) ? savedScale : (targetMap.viewScale || SCALE);
    };
    let viewScale = scaleForMap(map);
    setMapTitle(map.name);
    setHomeContext(map.instanceId || null);
    setCameraScale(viewScale);

    const updateHomeEditor = (patch) => {
      const next = { ...homeEditorRef.current, ...patch };
      homeEditorRef.current = next;
      setHomeEditor(next);
    };

    const cloneFurniture = (items) => (items || []).map((item) => ({
      ...item,
      ownership: item.ownership ? { ...item.ownership } : item.ownership,
    }));
    let homeEditorSession = null;

    const homeStateForRuntime = () => {
      if (!homeEditorSession || homeEditorSession.homeId !== map.instanceId) return gameSave.home;
      const sourceHome = gameSave.home.homes[homeEditorSession.homeId];
      return {
        ...gameSave.home,
        homes: {
          ...gameSave.home.homes,
          [homeEditorSession.homeId]: { ...sourceHome, furniture: homeEditorSession.furniture },
        },
      };
    };

    const beginHomeEditorSession = () => {
      if (!map.instanceId || !gameSave.home.homes[map.instanceId]) return false;
      if (!homeEditorSession || homeEditorSession.homeId !== map.instanceId) {
        homeEditorSession = {
          homeId: map.instanceId,
          furniture: cloneFurniture(gameSave.home.homes[map.instanceId].furniture),
        };
      }
      return true;
    };

    // ---- 遊戲狀態（不進 React state，rAF 直接讀寫）----
    const spawn = savedPos.map === map.id && !map.isBlocked(savedPos.x, savedPos.y)
      ? [savedPos.x, savedPos.y] : map.spawn;
    const player = createPlayerRuntime(spawn);
    const cam = createCamera();
    let npcs = spawnNpcs(gameSave, map, characters);          // 漫遊 NPC（山門／靈田協助角色）
    // 綁定角色的顯示名（角色入駐後 NPC 掛角色名）
    const npcDisplayName = (npc) => {
      if (npc.charId) return characters.find((c) => c.id === npc.charId)?.name || npc.name; // 住客直接掛名
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
    let pendingInteraction = null;                // 行走中的家具席位預約
    let lastHarvest = null;                       // 防止站在田上時連續事件讓收成後立刻進入種植
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

    const clampCam = () => clampCamera(cam, map, { width: viewW, height: viewH }, viewScale);

    cameraZoomActionsRef.current = {
      set: (nextScale) => {
        if (!CAMERA_SCALES.includes(nextScale)) return;
        viewScale = nextScale;
        gameSave.settings.cameraScale = nextScale;
        setCameraScale(nextScale);
        centerCameraOnActor(cam, player, { width: viewW, height: viewH }, viewScale);
        clampCam();
        persistSave(gameSave);
      },
    };

    const walkTo = (tx, ty, action) => {
      stopActorAction(player);
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

    // 種植/收成沒有專屬動畫素材，借 pickup（蹲下拿取）當示意動作——面板（React）碰不到
    // canvas 裡的活動角色，所以跟 farmAssistActionsRef 一樣開一個 ref 讓面板呼叫進來。
    playerActionRef.current = (durationMs = 900) => {
      beginActorAction(player, { action: "pickup", facing: player.facing, slotKey: null, renderOffset: { x: 0, y: 0 } }, performance.now(), durationMs);
    };

    farmAssistActionsRef.current = {
      finish: (helper) => {
        if (!helper) return;
        helper.helper = false;
        helper.path = [];
        helper.interactionPlan = null;
        stopActorAction(helper);
        helper.waitUntil = performance.now() + 600;
      },
    };

    const reservedInteractionSlots = () => {
      const reserved = new Set();
      const playerSlot = actorReservedSlot(player);
      if (playerSlot) reserved.add(playerSlot);
      if (pendingInteraction?.slotKey) reserved.add(pendingInteraction.slotKey);
      for (const npc of npcs) {
        const slotKey = actorReservedSlot(npc);
        if (slotKey) reserved.add(slotKey);
      }
      return reserved;
    };

    const onWorldInteraction = (target) => {
      const plan = findInteractionPlan(player, map, target, reservedInteractionSlots());
      if (!plan) {
        toastRef.current("目前沒有可使用的位置");
        return;
      }
      pendingInteraction = plan;
      walkTo(plan.x, plan.y, () => {
        if (pendingInteraction?.slotKey !== plan.slotKey) return;
        pendingInteraction = null;
        beginActorAction(player, plan, performance.now());
        // 陪伴請求：玩家與住客在同一件家具上做同一件事（用餐/閱讀等）即達成
        for (const npc of npcs) {
          if (!npc.charId || npc.action?.sourceId !== plan.sourceId || npc.action?.id !== plan.action) continue;
          if (markCompanyAction(gameSave.home, npc.charId, plan.action)) {
            markDirtyRef.current();
            toastRef.current(`${npc.name} 的請求達成了，去入住面板領取`);
          }
        }
        // 雙人床：玩家躺下時，邀在場住客睡另一側（每日首次同床 +2 好感）
        if (plan.action === "sleep" && furnitureById(target?.source?.furnitureId)?.doubleBed) {
          const partner = npcs.find((npc) => npc.charId && !npc.action && !npc.interactionPlan);
          if (partner) {
            const partnerPlan = findInteractionPlan(partner, map, target, reservedInteractionSlots());
            if (partnerPlan) {
              partner.path = partnerPlan.path;
              partner.stepT = 0;
              partner.interactionPlan = partnerPlan;
              partner.waitUntil = performance.now() + 8000;
              if (!partner.path.length) {
                partner.interactionPlan = null;
                beginActorAction(partner, partnerPlan, performance.now(), plan.maxDurationMs);
              }
              if (markCompanyAction(gameSave.home, partner.charId, "sleep")) {
                markDirtyRef.current();
                toastRef.current(`${partner.name} 的請求達成了，去入住面板領取`);
              }
              const bonus = coSleepBonus(gameSave.home, partner.charId);
              if (bonus?.gain > 0) {
                markDirtyRef.current();
                toastRef.current(`與 ${partner.name} 同床共枕，好感 +${bonus.gain}`);
                return;
              }
            }
          }
        }
        // 修煉堂蒲團：每日首次打坐送隨機修為（順路看等級的小獎勵）
        if (plan.sourceId.includes("hall_cushion")) {
          const meditation = meditateDaily(gameSave);
          if (meditation) {
            markDirtyRef.current();
            toastRef.current(meditation.gain > 0 ? `打坐入定，修為 +${meditation.gain}` : "修為已滿，前往祭壇突破吧");
            return;
          }
        }
        toastRef.current(`${plan.label}中，再點地面即可停止`);
      });
    };

    // 切換地圖：玩家瞬移到目標出生點，鏡頭直接對準
    const switchMap = (toId, spawnTile, options = {}) => {
      homeEditorSession = null;
      map = createMapRuntime(toId, { instanceId: options.instanceId, homeState: gameSave.home });
      viewScale = scaleForMap(map);
      npcs = spawnNpcs(gameSave, map, characters);
      if (import.meta.env.DEV && window.__yy) { window.__yy.map = map; window.__yy.npcs = npcs; }
      setMapTitle(map.name);
      setHomeContext(map.instanceId || null);
      setCameraScale(viewScale);
      updateHomeEditor({ active: false, furnitureId: null, selectedUid: null, preview: null });
      pendingAction = null;
      pendingInteraction = null;
      stopActorAction(player);
      placeActor(player, spawnTile || map.spawn);
      cam.follow = true;
      centerCameraOnActor(cam, player, { width: viewW, height: viewH }, viewScale);
      clampCam();
      gameSave.player.pos = {
        map: map.id, x: player.x, y: player.y,
        ...(map.instanceId ? { instanceId: map.instanceId } : {}),
      };
      persistSave(gameSave);
      runResidentChores(map);
    };

    // 住客雜務：進到對應地圖時結算，三項各自獨立每日額度。
    const characterName = (charId) => characters.find((item) => item.id === charId)?.name || "住客";
    const runResidentChores = (currentMap) => {
      const homeState = gameSave.home;
      const notes = [];

      if (currentMap.instanceId === "player_home") {
        const cleaner = choreWorker(homeState, "clean");
        if (cleaner) {
          const coins = Math.round((30 + Math.floor(Math.random() * 31)) * choreBoost(homeState, cleaner));
          gameSave.coins += coins;
          markChoreDone(homeState, "clean");
          notes.push(`${characterName(cleaner)} 打掃了小屋，撿到 🪙+${coins}`);
        }
        for (const charId of currentMap.home?.residents || []) {
          const gift = dailyGift(gameSave, charId);
          if (gift?.material) notes.push(`${characterName(charId)} 留了 ${itemMeta(gift.material.id).icon}${itemMeta(gift.material.id).name}×${gift.material.n} 給你`);
          else if (gift?.blueprint) notes.push(`${characterName(charId)} 送了 📜${gift.blueprint.name}圖紙！`);
        }
      }

      if (currentMap.id === "farm") {
        const waterer = choreWorker(homeState, "water");
        const planted = gameSave.farm.plots.filter((plot) => plot.cropId);
        if (waterer && planted.length) {
          const target = planted[Math.floor(Math.random() * planted.length)];
          const crop = cropById(target.cropId);
          const remain = Math.max(0, (target.plantedAt + crop.growMin * 60000 * 0.9) - Date.now());
          target.plantedAt -= Math.floor(remain * 0.25 * choreBoost(homeState, waterer));
          markChoreDone(homeState, "water");
          notes.push(`${characterName(waterer)} 幫忙澆了 ${crop.name}`);
        }
      }

      if (currentMap.id === "danfang_interior") {
        const keeper = choreWorker(homeState, "furnace");
        const busy = gameSave.shop.furnaces.filter((f) => f.recipeId);
        if (keeper && busy.length) {
          for (const f of busy) {
            const recipe = recipeById(f.recipeId);
            f.startedAt -= Math.floor(recipe.craftMin * 60000 * 0.2 * choreBoost(homeState, keeper));
          }
          markChoreDone(homeState, "furnace");
          notes.push(`${characterName(keeper)} 顧了丹爐，煉製進度推進`);
        }
      }

      if (notes.length) {
        markDirtyRef.current();
        toastRef.current(notes.join("　"));
      }
    };

    const refreshHomeMap = () => {
      map = createMapRuntime(map.id, { instanceId: map.instanceId, homeState: homeStateForRuntime() });
      player.path = [];
      pendingAction = null;
      pendingInteraction = null;
      stopActorAction(player);
      if (import.meta.env.DEV && window.__yy) window.__yy.map = map;
    };

    // 家具先進入半透明預覽；位置可以反覆點選，直到使用旁邊的 ✓/✕。
    const handleFurnitureTap = (screenX, screenY) => {
      const home = map.home;
      if (!home) return;
      const tileX = Math.floor((cam.x + screenX / viewScale) / TILE);
      const tileY = Math.floor((cam.y + screenY / viewScale) / TILE);
      const editor = homeEditorRef.current;
      const selected = editor.selectedUid ? home.furniture.find((item) => item.uid === editor.selectedUid) : null;

      // 沒在放置/移動流程中：點到家具 = 選取準備移動
      if (!editor.furnitureId && !selected) {
        const tapped = furnitureInstanceAt(home.furniture, tileX, tileY);
        if (tapped) {
          updateHomeEditor({
            selectedUid: tapped.uid,
            furnitureId: null,
            preview: { x: tapped.x, y: tapped.y, valid: true, mode: "existing" },
          });
          return;
        }
      }

      const furnitureId = selected?.furnitureId || editor.furnitureId;
      const definition = furnitureById(furnitureId);
      if (!definition) {
        toastRef.current("請先選擇家具，或點一下屋內家具");
        return;
      }

      const onPlayer = furnitureTiles(definition, tileX, tileY).some((tile) => tile.x === player.x && tile.y === player.y);
      const placeable = !onPlayer && canPlaceHomeFurniture({ map, home, definition, x: tileX, y: tileY, excludeUid: selected?.uid || null });
      const capOk = selected || canAddFurnitureInstance(home, furnitureId);
      const valid = placeable && capOk;

      updateHomeEditor({ preview: { x: tileX, y: tileY, valid, mode: selected ? "existing" : "new" } });
      if (!valid) {
        toastRef.current(onPlayer ? "不能把家具放在角色所在的位置"
          : !capOk ? `${definition.name} 已達擺放上限（${furnitureMaxCount(definition, home)} 件，擴建房間可提高）`
          : "這裡不能放置，請換一個位置");
      }
    };

    homeEditorActionsRef.current = {
      refreshHome: refreshHomeMap,
      toggle: () => {
        if (homeEditorRef.current.active) {
          toastRef.current("請按右下角「完成」儲存並離開佈置模式");
          return;
        }
        if (!beginHomeEditorSession()) return;
        refreshHomeMap();
        updateHomeEditor({ active: true, furnitureId: null, selectedUid: null, preview: null });
      },
      select: (furnitureId) => updateHomeEditor({ active: true, furnitureId, selectedUid: null, preview: null }),
      confirmPreview: () => {
        const home = map.home;
        const editor = homeEditorRef.current;
        const preview = editor.preview;
        if (!home || !preview) return;
        if (!preview.valid) {
          toastRef.current("紅色位置不能放置，請先移到其他位置");
          return;
        }
        const selected = editor.selectedUid ? home.furniture.find((item) => item.uid === editor.selectedUid) : null;
        const furnitureId = selected?.furnitureId || editor.furnitureId;
        if (selected) {
          selected.x = preview.x;
          selected.y = preview.y;
        } else if (furnitureId) {
          const uid = globalThis.crypto?.randomUUID?.() || `furniture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          home.furniture.push(createFurnitureInstance({ uid, furnitureId, x: preview.x, y: preview.y }));
        }
        // 一次只放置一件；確認後取消底部品項選取，要再放同款需重新點選。
        updateHomeEditor({ furnitureId: null, selectedUid: null, preview: null });
        refreshHomeMap();
      },
      cancelPreview: () => {
        const home = map.home;
        const editor = homeEditorRef.current;
        if (!home || !editor.preview) return;
        if (editor.selectedUid) {
          const index = home.furniture.findIndex((item) => item.uid === editor.selectedUid);
          if (index >= 0) {
            const instance = home.furniture[index];
            if (instance.locked || instance.ownership?.type === "character") {
              toastRef.current("這件家具受到保護，不能由玩家收起");
              return;
            }
            home.furniture.splice(index, 1);
          }
        }
        // 取消預覽同樣結束本次放置，避免下一次點地板又自動生成同款家具。
        updateHomeEditor({ furnitureId: null, selectedUid: null, preview: null });
        refreshHomeMap();
      },
      close: () => {
        if (homeEditorRef.current.preview) {
          toastRef.current("請先按 ✓ 確認，或按 ✕ 取消目前的家具預覽");
          return;
        }
        if (homeEditorSession) {
          const targetHome = gameSave.home.homes[homeEditorSession.homeId];
          if (targetHome) targetHome.furniture = cloneFurniture(homeEditorSession.furniture);
        }
        homeEditorSession = null;
        updateHomeEditor({ active: false, furnitureId: null, selectedUid: null, preview: null });
        refreshHomeMap();
        markDirtyRef.current();
        toastRef.current("佈置已儲存");
      },
    };

    // 靈田地塊：抵達後依狀態種植/收成/查看
    const onPlotArrive = (plotIdx) => {
      const plot = gameSave.farm.plots[plotIdx];
      const stage = plotStage(plot);
      if (stage === null) {
        if (replantPromptBlocked(lastHarvest, plotIdx)) return;
        const openedAt = Date.now();
        panelRef.current({
          type: "plant",
          title: "選擇要種的作物",
          plotIdx,
          // 即使瀏覽器送出極快的重複點擊，也不讓開啟面板的手勢穿透到作物按鈕。
          interactionReadyAt: openedAt + 180,
          // 手機瀏覽器偶爾會在 Canvas 的 pointerup 後補送 click。
          // 短暫禁止背景關閉，避免種植面板剛出現就閃退。
          dismissReadyAt: openedAt + 500,
        });
      } else if (stage === 3) {
        const r = harvestPlot(gameSave, plotIdx);
        if (r) {
          lastHarvest = { plotIdx, until: Date.now() + HARVEST_REPLANT_GUARD_MS };
          playerActionRef.current(900); // 借 pickup 當收成的示意動作
          toastRef.current(`${r.crop.icon} ${r.crop.name} ×${r.count} 入袋`);
          markDirtyRef.current();
          // 同伴搭話：稀有收成必觸發，一般收成走 10 分鐘冷卻（顯示邏輯已包在 onCompanion 裡）
          const rare = r.crop.id === "xinglu";
          onCompanion({
            poolKey: rare ? "rareHarvest" : "harvest", force: rare,
            prompt: `玩家剛在靈田收成了 ${r.crop.name} ×${r.count}${rare ? "（非常稀有的作物）" : ""}。`,
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
        cam.x -= dx / viewScale; cam.y -= dy / viewScale;
        clampCam();
      },
      onTap: (sx, sy) => {
        if (homeEditorRef.current.active && map.home) {
          handleFurnitureTap(sx, sy);
          return;
        }
        // Any new world tap cancels the current/pending action before routing
        // the tap to another chair, NPC, portal, or walking destination.
        player.path = [];
        player.moving = false;
        pendingAction = null;
        pendingInteraction = null;
        stopActorAction(player);
        const point = routeWorldTap({
          screenX: sx, screenY: sy, camera: cam, scale: viewScale, map, player, npcs,
          save: gameSave, hasMap, walkTo, switchMap, openPanel: panelRef.current,
          showToast: toastRef.current, onPlotArrive, onWorldInteraction,
        });
        ripple = { wx: point.worldX, wy: point.worldY, t0: performance.now() };
      },
    });

    // 貨架站上疊畫玩家實際上架的商品：有貨顯示 icon+庫存，空的顯示淡淡「空」提示
    const drawShelfStock = (ctx2, building, camera, scale) => {
      const shelves = gameSave.shop.shelves;
      const ts = TILE * scale;
      const topY = (building.y - 0.15) * TILE - camera.y;
      const slotW = (building.w * TILE) / shelves.length;
      ctx2.font = `${11 * scale}px sans-serif`;
      ctx2.textAlign = "center";
      shelves.forEach((sh, i) => {
        const cx = (building.x * TILE + slotW * (i + 0.5) - camera.x) * scale;
        const cy = topY * scale;
        if (sh.itemId && sh.stock > 0) {
          const meta = itemMeta(sh.itemId);
          ctx2.fillStyle = "rgba(0,0,0,.5)";
          ctx2.beginPath(); ctx2.roundRect(cx - 14 * scale, cy - 12 * scale, 28 * scale, 16 * scale, 5 * scale); ctx2.fill();
          ctx2.fillStyle = "#fff";
          ctx2.fillText(`${meta.icon}${sh.stock}`, cx, cy);
        } else {
          ctx2.fillStyle = "rgba(255,255,255,.35)";
          ctx2.fillText("空", cx, cy);
        }
      });
      ctx2.textAlign = "left";
    };

    const updatePlayer = (dt) => updateActorMovement(player, dt, STEP_MS, () => {
      if (!pendingAction) return;
      const action = pendingAction;
      pendingAction = null;
      action();
    });

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
      const playerReserved = actorReservedSlot(player) || pendingInteraction?.slotKey;
      updateNpcs(npcs, map, dt, now, { reservedSlots: playerReserved ? [playerReserved] : [] });
      if (cam.follow) {
        followActor(cam, player, { width: viewW, height: viewH }, viewScale);
        clampCam();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#1c2733";
      ctx.fillRect(0, 0, viewW, viewH);
      drawMap(ctx, map, cam, viewScale, viewW, viewH);
      map.plots.forEach((pl, idx) => drawFarmPlot(ctx, pl, idx, now, { camera: cam, scale: viewScale, save: gameSave }));
      const editorState = homeEditorRef.current;
      const previewedUid = editorState.active && editorState.preview ? editorState.selectedUid : null;
      for (const item of map.home?.furniture || []) {
        if (item.uid === previewedUid) continue;
        const definition = furnitureById(item.furnitureId);
        if (definition?.placement === "rug") drawFurniture(ctx, item, cam, viewScale, homeEditorRef.current.selectedUid === item.uid);
      }
      // 平面裝飾（地墊/榻榻米）畫在地面層：跟角色一起排序會在人物走上去時蓋住人
      for (const d of map.decorations) if (d.flat) drawWorldDecoration(ctx, d, cam, viewScale);
      // 2.5D 遮擋：建築與所有角色按 y 排序後一起畫
      const drawables = [
        ...map.buildings.map((b) => ({ y: (b.y + b.h) * TILE, draw: () => {
          renderBuilding(ctx, b, cam, viewScale);
          // 丹房貨架：畫出玩家實際上架的商品，遠遠一看就知道還有沒有貨、賣完了沒
          if (b.id === "danfang_shelf") drawShelfStock(ctx, b, cam, viewScale);
        } })),
        ...map.decorations.filter((d) => !d.flat).map((d) => ({ y: (d.y + (d.h || 1)) * TILE, draw: () => drawWorldDecoration(ctx, d, cam, viewScale) })),
        ...map.trees.map((t) => ({ y: (t.y + 1) * TILE, draw: () => drawTree(ctx, t, cam, viewScale) })),
        ...(map.home?.furniture || []).filter((item) => item.uid !== previewedUid && furnitureById(item.furnitureId)?.placement !== "rug").map((item) => ({ y: (item.y + (furnitureById(item.furnitureId)?.footprint?.h || 1)) * TILE, draw: () => drawFurniture(ctx, item, cam, viewScale, homeEditorRef.current.selectedUid === item.uid) })),
        ...npcs.map((n) => ({ y: n.py + (n.action?.renderOffset?.y || 0) * TILE + TILE, draw: () => {
          renderCharacter(ctx, n, n.appearance, cam, viewScale, now);
          const boundName = npcDisplayName(n);
          if (boundName) {
            drawNpcLabel(ctx, n, boundName, cam, viewScale);
          }
        } })),
        { y: player.py + (player.action?.renderOffset?.y || 0) * TILE + TILE, draw: () => renderCharacter(ctx, player, gameSave.player.appearance, cam, viewScale, now) },
      ].sort((a, b) => a.y - b.y);
      for (const d of drawables) d.draw();
      // 傳送點畫在遮擋層之上：被樹冠/建築蓋住就等於找不到路（玩家反映過）
      for (const p of map.portals) renderPortal(ctx, p, cam, viewScale, now);
      // 放置預覽：綠/紅占地標示 + 半透明家具影像（永遠畫在最上層）
      if (editorState.active && editorState.preview && map.home) {
        const previewId = (editorState.selectedUid ? map.home.furniture.find((item) => item.uid === editorState.selectedUid)?.furnitureId : null) || editorState.furnitureId;
        const previewDef = furnitureById(previewId);
        if (previewDef) {
          const ts = TILE * viewScale;
          ctx.fillStyle = editorState.preview.valid ? "rgba(120, 220, 130, .32)" : "rgba(230, 90, 80, .38)";
          for (const tile of furnitureTiles(previewDef, editorState.preview.x, editorState.preview.y)) {
            ctx.fillRect((tile.x * TILE - cam.x) * viewScale, (tile.y * TILE - cam.y) * viewScale, ts, ts);
          }
          ctx.globalAlpha = 0.65;
          drawFurniture(ctx, { furnitureId: previewId, x: editorState.preview.x, y: editorState.preview.y }, cam, viewScale, false);
          ctx.globalAlpha = 1;

          const controls = homePreviewControlsRef.current;
          if (controls) {
            const footprintW = Math.max(1, previewDef.footprint?.w || 1);
            const anchorX = ((editorState.preview.x + footprintW / 2) * TILE - cam.x) * viewScale;
            const anchorY = (editorState.preview.y * TILE - cam.y) * viewScale;
            controls.style.display = "flex";
            controls.style.left = `${Math.max(50, Math.min(viewW - 50, anchorX))}px`;
            controls.style.top = `${Math.max(72, Math.min(viewH - 118, anchorY - 6))}px`;
          }
        }
      } else if (homePreviewControlsRef.current) {
        homePreviewControlsRef.current.style.display = "none";
      }
      // 對話泡泡永遠在最上層
      for (const n of npcs) if (n.bubble) drawSpeechBubble(ctx, n, cam, viewScale, viewW);
      // 點擊漣漪（age 夾 0：rAF 的 now 是幀起始時間戳，可能比剛記下的 t0 早一點點，
      // 負值會讓 arc() 收到負半徑直接丟例外）
      if (ripple) {
        const age = Math.max(0, now - ripple.t0);
        if (age > 450) ripple = null;
        else {
          const r = (age / 450) * TILE * viewScale * 0.6;
          ctx.strokeStyle = `rgba(255, 224, 130, ${1 - age / 450})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc((ripple.wx - cam.x) * viewScale, (ripple.wy - cam.y) * viewScale, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };
    // 首幀就對準玩家，避免鏡頭從 (0,0) 滑過去
    centerCameraOnActor(cam, player, { width: viewW, height: viewH }, viewScale);
    clampCam();
    raf = requestAnimationFrame(frame);
    runResidentChores(map); // 直接讀檔進場（非切地圖）也結算一次住客雜務

    // 位置寫進存檔；離開頁面/切背景時也存一次
    const persistPos = () => {
      gameSave.player.pos = {
        map: map.id, x: player.x, y: player.y,
        ...(map.instanceId ? { instanceId: map.instanceId } : {}),
      };
      persistSave(gameSave);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistPos();
        cancelAnimationFrame(raf);
        raf = 0;
        lastT = 0;
        return;
      }
      if (!raf) {
        lastFrameAt = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
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
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
      <YunyinHud onBack={onBack} mapTitle={mapTitle} coins={coins} crystals={crystals} onOpenSettings={() => setPanel({ type: "settings", title: "遊戲設定" })} onOpenInventory={() => setPanel({ type: "inventory", title: "🎒 背包" })} canDecorate={!!homeContext} decorating={homeEditor.active} onToggleDecorating={() => homeEditorActionsRef.current.toggle?.()} />
      <CameraZoomControl value={cameraScale} top={yunyinCameraControlTop(!!homeContext)} onChange={(scale) => cameraZoomActionsRef.current.set?.(scale)} />
      <YunyinPanelHost
        panel={panel} setPanel={setPanel} gameSave={gameSave} markDirty={markDirty}
        onCompanion={onCompanion} showToast={showToast} addCrystals={addCrystals} crystals={crystals}
        characters={characters} onAiGenerate={onAiGenerate} npcAppearanceRef={npcAppearanceRef}
        onHomeRefresh={() => homeEditorActionsRef.current.refreshHome?.()}
        onFarmAssist={(helper) => farmAssistActionsRef.current.finish?.(helper)}
        onPlayerAction={(durationMs) => playerActionRef.current?.(durationMs)}
      />
      <YunyinToast message={toast} />
      <HomeEditorOverlay editor={homeEditor} catalog={Object.values(FURNITURE_CATALOG).filter((item) => gameSave.home.furnitureUnlocks[item.id])} previewControlsRef={homePreviewControlsRef} onSelect={(id) => homeEditorActionsRef.current.select?.(id)} onConfirmPreview={() => homeEditorActionsRef.current.confirmPreview?.()} onCancelPreview={() => homeEditorActionsRef.current.cancelPreview?.()} onClose={() => homeEditorActionsRef.current.close?.()} onExpand={() => setPanel({ type: "homeExpand", title: "擴建居所" })} onResidents={() => setPanel({ type: "homeResidents", title: "入住管理" })} />
      <CompanionNotice notice={companionNotice} />
      <OfflineSummary summary={summary} formatDuration={fmtDuration} onCollect={() => { setSummary(null); markDirty(); }} />
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
