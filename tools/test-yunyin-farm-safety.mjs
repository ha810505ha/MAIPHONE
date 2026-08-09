import assert from "node:assert/strict";
import fs from "node:fs";
import { createInput } from "../yunyin/engine/input.js";
import { npcAtWorldPoint } from "../yunyin/world/npcHitTest.js";
import { plotIndexNearPoint } from "../yunyin/world/spatialQueries.js";
import { canDismissPanelFromBackdrop } from "../yunyin/ui/panelInteraction.js";
import { mergedPortalVisuals } from "../yunyin/world/portalVisuals.js";
import {
  AURA_MUL,
  HARVEST_REPLANT_GUARD_MS,
  growMs,
  harvestPlot,
  plantCrop,
  plotStage,
  readyAtOf,
  replantPromptBlocked,
  ripenedDuring,
} from "../yunyin/systems/farm.js";

const NOW = 1_800_000_000_000;
const npcSource = fs.readFileSync(new URL("../yunyin/systems/npc.js", import.meta.url), "utf8");
const interactionRouterSource = fs.readFileSync(new URL("../yunyin/world/interactionRouter.js", import.meta.url), "utf8");

const saveWith = ({ realmIdx = 0, coins = 100, plots, inventory = {} } = {}) => ({
  coins,
  cultivation: { realmIdx, exp: 0 },
  inventory: { ...inventory },
  farm: {
    plots: plots || Array.from({ length: 9 }, (_, id) => ({ id, cropId: null, plantedAt: null })),
  },
});

{
  const doorway = [
    { x: 12, y: 14, to: "residence", spawn: [17, 16], label: "離開小屋", icon: "🚪" },
    { x: 13, y: 14, to: "residence", spawn: [17, 16], label: "離開小屋", icon: "🚪" },
  ];
  const visuals = mergedPortalVisuals(doorway);
  assert.equal(visuals.length, 1, "相鄰且同目的地的雙格出口應只繪製一個傳送點");
  assert.equal(visuals[0].x, 12.5, "合併後的傳送點應置中在雙格門口");
  assert.equal(visuals[0].y, 14);
  assert.equal(doorway.length, 2, "合併顯示不得刪除原本兩格的點擊範圍");
  assert.equal(mergedPortalVisuals([{ ...doorway[0] }, { ...doorway[1], to: "gate" }]).length, 2, "不同目的地不得合併");
}

{
  const map = {
    plots: [
      { x: 5, y: 20 }, { x: 8, y: 20 }, { x: 11, y: 20 },
      { x: 5, y: 22 }, { x: 8, y: 22 }, { x: 11, y: 22 },
      { x: 5, y: 24 }, { x: 8, y: 24 }, { x: 11, y: 24 },
    ],
  };
  assert.equal(plotIndexNearPoint(map, 5.5, 24.5, 1.5), 6, "底排第一格中心應可命中");
  assert.equal(plotIndexNearPoint(map, 5.5, 23.7, 0.5), 6, "縮小鏡頭後仍應有足夠大的底排觸控區");
  assert.equal(plotIndexNearPoint(map, 8.5, 23.55, 0.5), 7, "重疊的放大觸控區應選最近地塊");
  assert.equal(plotIndexNearPoint(map, 1, 1, 0.5), -1, "遠離靈田的地面點擊不得誤觸");
}

{
  assert.match(npcSource, /firstPlot\.x - 1/, "靈田協助角色應站在田邊，而不是站在第一格田上");
  assert.doesNotMatch(npcSource, /helperSpot = map\.plots\?\.\[0\]/, "協助角色不得再直接占用第一格靈田");
}

{
  const helper = {
    helper: true,
    name: "測試助手",
    x: 4,
    y: 20,
    px: 4 * 32,
    py: 20 * 32,
    action: null,
  };
  const bodyPoint = { x: helper.px + 16, y: helper.py - 16 };
  assert.equal(npcAtWorldPoint([helper], bodyPoint.x, bodyPoint.y), helper, "NPC 身體上半部應可互動");
  assert.equal(npcAtWorldPoint([helper], helper.px - 1, bodyPoint.y), undefined, "角色圖外不得誤觸 NPC");
  assert.match(
    interactionRouterSource,
    /npcAtWorldPoint\(npcs,\s*worldX,\s*worldY\)\s*\|\|\s*npcAtTile/,
    "世界點擊應優先以完整角色圖判定 NPC",
  );

  for (const scale of [0.5, 1, 1.5, 2]) {
    const screenPoint = { x: bodyPoint.x * scale, y: bodyPoint.y * scale };
    const convertedWorldPoint = { x: screenPoint.x / scale, y: screenPoint.y / scale };
    assert.equal(
      npcAtWorldPoint([helper], convertedWorldPoint.x, convertedWorldPoint.y),
      helper,
      `${scale}× 應能命中靈田協助 NPC 的完整角色圖`,
    );
  }
}

{
  const save = saveWith();
  assert.equal(plantCrop(save, 0, "qingling", NOW), null);
  assert.equal(save.coins, 92, "種植商店作物只應扣除一次費用");
  assert.equal(plantCrop(save, 0, "qingling", NOW + 1), "無法種植");
  assert.equal(save.coins, 92, "重複種植失敗時不得再次扣款");

  const duration = growMs({ growMin: 30 });
  assert.equal(duration, 30 * 60_000 * AURA_MUL);
  assert.equal(plotStage(save.farm.plots[0], NOW), 0);
  assert.equal(plotStage(save.farm.plots[0], NOW + duration), 3);
  assert.equal(readyAtOf(save.farm.plots[0]), NOW + duration);

  assert.deepEqual(harvestPlot(save, 0, NOW + duration), {
    crop: {
      id: "qingling", name: "青靈草", icon: "🌿", growMin: 30,
      seedCost: 8, sellPrice: 8, yield: 2, source: "shop",
    },
    count: 2,
  });
  assert.equal(save.inventory.qingling, 2);
  assert.equal(harvestPlot(save, 0, NOW + duration), null, "同一格收成只能結算一次");
  assert.equal(save.inventory.qingling, 2, "重複收成不得重複給予作物");
}

{
  const save = saveWith();
  assert.equal(plantCrop(save, 3, "qingling", NOW), "🔒 境界不足，尚未開墾");
  assert.equal(save.coins, 100, "鎖定地塊不得扣款");
}

{
  const badPlots = [
    { id: 0, cropId: "removed_crop", plantedAt: NOW },
    { id: 1, cropId: "qingling", plantedAt: null },
  ];
  const save = saveWith({ plots: badPlots });
  assert.equal(plotStage(badPlots[0], NOW), null, "未知作物不得讓畫面崩潰");
  assert.equal(plotStage(badPlots[1], NOW), null, "缺少種植時間不得被判為成熟");
  assert.equal(readyAtOf(badPlots[0]), null);
  assert.equal(ripenedDuring(save, NOW - 1_000, NOW), 0);
}

{
  const lock = { plotIdx: 2, until: NOW + HARVEST_REPLANT_GUARD_MS };
  assert.equal(replantPromptBlocked(lock, 2, NOW), true, "剛收成的同一格應暫時阻止種植面板");
  assert.equal(replantPromptBlocked(lock, 1, NOW), false, "其他地塊不應受到影響");
  assert.equal(replantPromptBlocked(lock, 2, lock.until), false, "短暫防重入結束後仍可正常補種");
}

{
  const panel = { type: "plant", dismissReadyAt: NOW + 500 };
  assert.equal(canDismissPanelFromBackdrop(panel, NOW), false, "種植面板剛開啟時不得被背景幽靈點擊關閉");
  assert.equal(canDismissPanelFromBackdrop(panel, NOW + 499), false);
  assert.equal(
    canDismissPanelFromBackdrop(panel, NOW + 10_000),
    false,
    "種植面板只能透過選擇作物或取消按鈕關閉",
  );
  assert.equal(
    canDismissPanelFromBackdrop({ type: "inventory", dismissReadyAt: NOW + 500 }, NOW + 500),
    true,
    "其他延遲面板在保護時間結束後仍可點背景關閉",
  );
  assert.equal(canDismissPanelFromBackdrop({ type: "inventory" }, NOW), true, "一般面板維持原本的背景關閉行為");
}

{
  const listeners = new Map();
  let prevented = 0;
  const pointerEvent = (overrides = {}) => ({
    clientX: 10,
    clientY: 10,
    pointerId: 1,
    preventDefault: () => { prevented += 1; },
    ...overrides,
  });
  const element = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => {
      if (listeners.get(name) === fn) listeners.delete(name);
    },
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  let taps = 0;
  const detach = createInput(element, { onTap: () => { taps += 1; } });
  listeners.get("pointerdown")(pointerEvent());
  listeners.get("pointercancel")(pointerEvent());
  assert.equal(taps, 0, "pointercancel 不得被誤判為點擊");

  listeners.get("pointerdown")(pointerEvent({ pointerId: 2 }));
  listeners.get("pointerup")(pointerEvent({ pointerId: 2 }));
  assert.equal(taps, 1, "正常 pointerup 仍應觸發一次點擊");
  assert.equal(prevented, 4, "Canvas 觸控事件應阻止瀏覽器合成額外 click");
  detach();
  assert.equal(listeners.size, 0, "輸入監聽應完整移除");
}

console.log("Yunyin farm safety checks passed");
