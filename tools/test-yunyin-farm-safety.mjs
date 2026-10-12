import assert from "node:assert/strict";
import fs from "node:fs";
import { createInput } from "../yunyin/engine/input.js";
import { npcAtWorldPoint } from "../yunyin/world/npcHitTest.js";
import { plotIndexNearPoint } from "../yunyin/world/spatialQueries.js";
import { canDismissPanelFromBackdrop } from "../yunyin/ui/panelInteraction.js";
import { mergedPortalVisuals } from "../yunyin/world/portalVisuals.js";
import farmMap from "../yunyin/data/maps/farm.js";
import { REALMS } from "../yunyin/data/realms.js";
import {
  NPC_FIELD_COIN_CAP,
  NPC_FIELD_GROW_MUL,
  NPC_FIELD_RIPE_HOLD_MS,
  assignNpcFields,
  helpNpcField,
  normalizeNpcField,
  npcFieldReadyAt,
  npcFieldStage,
  inCharacterField,
  npcFieldEdgeAt,
  npcFieldPlotAt,
  npcFieldPlotNear,
  npcFieldZoneAt,
  rollFieldReward,
  settleNpcFields,
  stealCatchChance,
  stealNpcField,
  claimNpcFieldReward,
} from "../yunyin/systems/npcFields.js";
import {
  AURA_MUL,
  HARVEST_REPLANT_GUARD_MS,
  growMs,
  harvestPlot,
  plantCrop,
  plotStage,
  plotUnlocked,
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


{
  // 丹房互動站：以畫出來的圖判定點擊，並保證最小觸控尺寸（玩家回報櫃台、貨架、訂單、丹爐要點好幾次）
  const { buildingAtPoint } = await import("../yunyin/world/spatialQueries.js");
  const furnace = { id: "furnace", x: 2, y: 2, w: 1, h: 1, door: [2, 3], opens: "shop", renderScale: 1.15 };
  const stall = { id: "stall", x: 11, y: 6, w: 2, h: 1, door: [11, 7], opens: "shop", renderScale: 1 };
  const map = { buildings: [furnace, stall] };
  const aspectOf = (building) => (building.id === "furnace" ? 34 / 32 : 1);
  assert.equal(buildingAtPoint(map, 2.5, 1.85, { aspectOf, minHitSizePx: 0 })?.id, "furnace", "點丹爐圖片上半部（占地格之外）也要命中");
  assert.equal(buildingAtPoint(map, 12, 5.2, { aspectOf, minHitSizePx: 0 })?.id, "stall", "點訂單攤圖片上半部也要命中");
  assert.equal(buildingAtPoint(map, 2.5, 1.2, { aspectOf, minHitSizePx: 0 }), null, "嚴格模式不得命中圖外");
  assert.equal(buildingAtPoint(map, 2.5, 1.2, { aspectOf, scale: 0.5 })?.id, "furnace", "0.5× 鏡頭時要保證最小觸控尺寸");
  assert.equal(buildingAtPoint(map, 7, 5, { aspectOf, scale: 2, slackTiles: 0.35 }), null, "遠離互動站的點擊不得被吃掉");
  const routerSource = fs.readFileSync(new URL("../yunyin/world/interactionRouter.js", import.meta.url), "utf8");
  assert(routerSource.indexOf("stationOnImage") < routerSource.indexOf("npcAtWorldPoint(npcs"), "點在互動站圖片上要優先於路過的 NPC");
}

// ---- 住客角色田（MP-030）----
{
  const zones = farmMap.fieldZones.filter((zone) => zone.type === "character");
  assert.equal(zones.length, 2, "靈田要有兩塊角色田（住客上限 = 客床 2 張）");
  const blocked = new Set();
  farmMap.tiles.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "T" || ch === "~") blocked.add(`${x},${y}`); }));
  for (const d of farmMap.decorations) if (d.blocking) for (let dx = 0; dx < (d.w || 1); dx += 1) for (let dy = 0; dy < (d.h || 1); dy += 1) blocked.add(`${d.x + dx},${d.y + dy}`);
  const reach = new Set([`${farmMap.spawn[0]},${farmMap.spawn[1]}`]);
  const queue = [farmMap.spawn];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (reach.has(key) || blocked.has(key) || !farmMap.tiles[y + dy]?.[x + dx]) continue;
      reach.add(key); queue.push([x + dx, y + dy]);
    }
  }
  for (const zone of zones) {
    const inside = (x, y) => x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h;
    assert(reach.has(zone.stand.join(",")), `${zone.id} 柵門外的站位要走得到`);
    assert(!inside(...zone.sign), `${zone.id} 木牌要在圍欄外（2026-10-12）`);
    assert(!blocked.has(zone.sign.join(",")), `${zone.id} 木牌不能擋路`);
    assert(!blocked.has(zone.gateTile.join(",")), `${zone.id} 柵門要留空`);
    for (let x = zone.crop.x; x < zone.crop.x + zone.crop.w; x += 1) for (let y = zone.crop.y; y < zone.crop.y + zone.crop.h; y += 1) {
      assert.equal(farmMap.tiles[y][x], ":", `${zone.id} 作物格要是耕地`);
    }
    assert.equal(zone.plots.length, 9, `${zone.id} 要有 9 個作物格`);
    for (const [x, y] of zone.plots) {
      assert(x > zone.x && x < zone.x + zone.w - 1 && y > zone.y && y < zone.y + zone.h - 1, `${zone.id} 作物格要在圍欄內`);
      assert(reach.has(`${x},${y}`), `${zone.id} 作物格要走得到（從柵門走進田裡）`);
      assert.equal(npcFieldPlotAt(farmMap.fieldZones, x, y)?.zone.id, zone.id, "點作物格要找到那塊田");
    }
    assert.equal(npcFieldPlotAt(farmMap.fieldZones, zone.crop.x, zone.crop.y), null, "田裡不是作物格的空地只是走路");
    const [px, py] = zone.plots[4];
    assert.equal(npcFieldPlotNear(farmMap.fieldZones, px + 0.5, py - 0.3)?.index, 4, "點在作物往上長的部分也算點到");
    assert.equal(npcFieldPlotNear(farmMap.fieldZones, px + 0.5, py + 1.5), null, "作物格之間的走道不算點到作物");
    assert.equal(npcFieldEdgeAt(farmMap.fieldZones, zone.crop.x, zone.crop.y), null, "田裡空地不打開面板");
    assert.equal(npcFieldEdgeAt(farmMap.fieldZones, zone.x, zone.y)?.id, zone.id, "點圍欄看田的資訊");
    assert.equal(npcFieldEdgeAt(farmMap.fieldZones, zone.sign[0], zone.sign[1])?.id, zone.id, "點木牌看田的資訊");
    for (const [x, y] of [...zone.plots, zone.gateTile, [zone.crop.x, zone.crop.y]]) {
      assert(inCharacterField(farmMap, x, y), `${zone.id} 田裡與柵門不讓閒逛的住客走進去`);
    }
    assert(!inCharacterField(farmMap, ...zone.stand), `${zone.id} 柵門外站位不算田裡`);
    assert(zone.w >= 11 && zone.h >= 9, `${zone.id} 要接近玩家田大小（2026-10-12）`);
    assert.equal(npcFieldZoneAt(farmMap.fieldZones, zone.crop.x, zone.crop.y)?.id, zone.id, "點田要找到那塊田");
    assert.equal(npcFieldZoneAt(farmMap.fieldZones, zone.sign[0], zone.sign[1])?.id, zone.id, "點木牌也要找到那塊田");
  }
  for (let i = 0; i < zones.length; i += 1) for (let j = i + 1; j < zones.length; j += 1) {
    const a = zones[i], b = zones[j];
    assert(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, "角色田不能重疊");
  }

  // 玩家第二塊田（MP-045）：原第三塊角色田位置，第 10～18 格，依境界分三段開
  assert.equal(farmMap.plots.length, 18, "玩家田共 18 格");
  const routerText = fs.readFileSync(new URL("../yunyin/world/interactionRouter.js", import.meta.url), "utf8");
  assert(/nearPlotIndex >= 0 && plotUnlocked\(nearPlotIndex/.test(routerText), "上鎖田格只在剛好點到時提示，點旁邊要能走進田裡");
  const field2 = farmMap.fieldZones.find((zone) => zone.id === "player_field_2");
  const field2Fence = new Set(farmMap.decorations.filter((d) => d.id.startsWith("player_field_2_fence_")).map((d) => `${d.x},${d.y}`));
  // fieldZones 裡第二塊田是耕地範圍，圍欄在外面一圈；上緣沒有圍欄的格子就是入口
  const openTop = [];
  for (let x = field2.x - 1; x <= field2.x + field2.w; x += 1) if (!field2Fence.has(`${x},${field2.y - 1}`)) openTop.push(x);
  assert(openTop.length >= 3, "第二塊田入口至少 3 格寬（2026-10-12）");
  assert(openTop.length < field2.w, "第二塊田上緣仍要有圍欄");
  assert(field2 && field2.type === "player", "要有玩家第二塊田");
  for (const plot of farmMap.plots.slice(9)) {
    assert(plot.x >= field2.x && plot.x < field2.x + field2.w && plot.y >= field2.y && plot.y < field2.y + field2.h, "第 10～18 格在第二塊田裡");
    assert.equal(farmMap.tiles[plot.y][plot.x], ":", "第二塊田作物格要是耕地");
    assert(reach.has(`${plot.x},${plot.y}`), "第二塊田作物格要走得到");
    assert(!inCharacterField(farmMap, plot.x, plot.y), "第二塊田不算角色田");
  }
  for (const zone of zones) assert(field2.x + field2.w <= zone.x || zone.x + zone.w <= field2.x || field2.y + field2.h <= zone.y || zone.y + zone.h <= field2.y, "第二塊田不能跟角色田重疊");
  const realmIdxOf = (name) => REALMS.findIndex((realm) => realm.name === name);
  const cultivationAt = (name) => ({ realmIdx: realmIdxOf(name) });
  assert.equal(plotUnlocked(9, cultivationAt("金丹期")), false, "金丹期還不能用第 10 格");
  assert.deepEqual([9, 10, 11, 12].map((i) => plotUnlocked(i, cultivationAt("元嬰期"))), [true, true, true, false], "元嬰期開第 10～12 格");
  assert.deepEqual([12, 14, 15].map((i) => plotUnlocked(i, cultivationAt("化神期"))), [true, true, false], "化神期開第 13～15 格");
  assert(farmMap.plots.every((_, i) => plotUnlocked(i, cultivationAt("煉虛期"))), "煉虛期 18 格全開");

  let seq = 0;
  const fixed = (values) => () => values[seq++ % values.length];
  const villaSave = (residents = ["a", "b", "c", "d"]) => ({
    coins: 0, inventory: {}, farm: { plots: [], npcFields: {} },
    home: { homes: { player_home: { residents: [...residents] } }, relationships: { a: { affinity: 0, dailyGain: 0, lastInteractionDay: "" } } },
  });

  // 分田：一人一塊、田不夠時後來的沒有；退租後回來沿用原本那塊
  const villa = villaSave();
  const owners = assignNpcFields(villa, zones);
  assert.deepEqual(Object.values(owners).sort(), ["a", "b"], "兩塊田給前兩位住客，後面的沒有");
  const zoneOfB = villa.farm.npcFields.b.zoneId;
  villa.home.homes.player_home.residents = ["d", "b"];
  const owners2 = assignNpcFields(villa, zones);
  assert.equal(owners2[zoneOfB], "b", "住客保留自己原本的田");
  assert(Object.values(owners2).includes("d"), "空出來的田分給沒田的住客");

  // 播種與 1.5 倍生長
  const s = villaSave(["a"]);
  settleNpcFields(s, zones, NOW, () => 0);
  const field = s.farm.npcFields.a;
  assert.equal(field.cropId, "yuehua", "空田會自動播種");
  assert.equal(npcFieldReadyAt(field) - NOW, 120 * 60000 * AURA_MUL * NPC_FIELD_GROW_MUL, "住客作物生長時間是玩家的 1.5 倍");
  assert.equal(stealNpcField(s, "a", NOW).error, "fieldNotRipe", "未成熟不能偷");

  // 幫忙：縮短剩餘時間、好感 +1、一天一次、當天不能再偷
  const before = npcFieldReadyAt(field);
  const help = helpNpcField(s, "a", NOW);
  assert.equal(help.affinityGain, 1, "幫忙好感 +1");
  assert(npcFieldReadyAt(field) < before, "幫忙讓作物長快一點");
  assert.equal(helpNpcField(s, "a", NOW + 1000).error, "fieldActedToday", "同一天同一塊田只能幫一次");
  const ripeAt = npcFieldReadyAt(field);
  assert.equal(npcFieldStage(field, ripeAt), 3, "到時間就成熟");
  assert.equal(stealNpcField(s, "a", ripeAt).error, "fieldActedToday", "當天幫過忙就不能偷");

  // 收成：成熟放滿 6 小時才收；有幫忙才有回禮，然後重種
  settleNpcFields(s, zones, ripeAt + NPC_FIELD_RIPE_HOLD_MS - 1, () => 0);
  assert.equal(field.pendingReward, null, "成熟未滿 6 小時住客還沒收成");
  seq = 0;
  settleNpcFields(s, zones, ripeAt + NPC_FIELD_RIPE_HOLD_MS, fixed([0, 0, 0.99, 0]));
  assert(s.farm.npcFields.a.pendingReward, "有幫過忙，收成時有回禮");
  assert.equal(s.farm.npcFields.a.helped, 0, "收成後重種，幫忙次數歸零");
  assert.equal(s.farm.npcFields.a.plantedAt, ripeAt + NPC_FIELD_RIPE_HOLD_MS, "收成當下立刻重種");
  const reward = claimNpcFieldReward(s, "a");
  assert.equal(reward.crops, 1, "作物固定一份");
  assert(reward.coins > 0 && reward.coins <= NPC_FIELD_COIN_CAP, "金幣回禮最多 500");
  assert.equal(s.inventory.yuehua, 1, "領取後作物入背包");
  assert.equal(s.farm.npcFields.a.pendingReward, null, "領過就清掉");

  // 沒幫忙的一輪（含離線多輪）沒有回禮
  const idle = villaSave(["a"]);
  settleNpcFields(idle, zones, NOW, () => 0);
  settleNpcFields(idle, zones, NOW + 7 * 24 * 3600000, () => 0);
  assert.equal(idle.farm.npcFields.a.pendingReward, null, "沒幫忙收成時什麼都沒有");

  // 偷菜：成熟才行、1～2 份、被抓不扣好感、沒被抓之後會透露
  const thief = villaSave(["a"]);
  settleNpcFields(thief, zones, NOW, () => 0);
  const ripe = npcFieldReadyAt(thief.farm.npcFields.a);
  seq = 0;
  const caught = stealNpcField(thief, "a", ripe, fixed([0.9, 0]));
  assert.equal(caught.amount, 2, "偷到 1～2 份");
  assert.equal(caught.caught, true, "機率內會被抓");
  assert.equal(thief.home.relationships.a.affinity, 0, "被抓不扣好感");
  assert.equal(thief.farm.npcFields.a.stealHint, false, "被抓就不用再透露");
  assert.equal(stealNpcField(thief, "a", ripe + 1000).error, "fieldActedToday", "一天只能偷一次");
  assert.equal(helpNpcField(thief, "a", ripe + 1000).error, "fieldActedToday", "當天偷過就不能幫忙");
  const sneaky = villaSave(["a"]);
  settleNpcFields(sneaky, zones, NOW, () => 0);
  seq = 0;
  const away = stealNpcField(sneaky, "a", npcFieldReadyAt(sneaky.farm.npcFields.a), fixed([0, 0.99]));
  assert.equal(away.caught, false, "沒被抓");
  assert.equal(sneaky.farm.npcFields.a.stealHint, true, "沒被抓之後住客會隱約透露");
  assert(stealCatchChance(100) < stealCatchChance(0), "越熟越常假裝沒看到");
  assert(stealCatchChance(0) <= 0.65 && stealCatchChance(100) >= 0.15, "被抓機率在 15%～65%");

  // 回禮機率與上限
  for (let i = 0; i < 200; i += 1) {
    const r = rollFieldReward({ cropId: "yuehua", helped: 3 });
    assert(r.coins <= NPC_FIELD_COIN_CAP && r.crystals <= 2 && r.crops === 1, "回禮不超過上限");
  }

  // 存檔正規化：壞資料不炸、作物不存在就清空
  const broken = normalizeNpcField({ cropId: "nope", plantedAt: "x", helped: -3, actedKind: "dance", pendingReward: { cropId: "yuehua", coins: 9999 } });
  assert.equal(broken.cropId, null);
  assert.equal(broken.helped, 0);
  assert.equal(broken.actedKind, null);
  assert.equal(broken.pendingReward.coins, NPC_FIELD_COIN_CAP, "存檔裡的金幣回禮也夾在上限內");
}

console.log("Yunyin farm safety checks passed");
