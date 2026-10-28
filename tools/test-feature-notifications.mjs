import assert from "node:assert/strict";
import {
  collectNotifications, collectVillaReadyItems, nextFeatureNotificationDueAt, nextVillaDueAt, selectCatchUpNotifications, taiwanDayStart,
} from "../services/notifications/notificationSources.js";
import { DEFAULT_NOTIFICATION_SETTINGS, NOTIFICATION_TYPES } from "../constants/notifications.js";
import { taiwanDayKey } from "../utils/taiwanDayKey.js";
import { plantCrop, growMs, cropById } from "../yunyin/systems/farm.js";
import { startCraft } from "../yunyin/systems/shop.js";

// MP-091（小舞 2026-10-28）：山莊「田熟／丹好」與「今天的登入獎勵還沒領」走同一套通知；
// 錢包入帳／寵物／抽卡不跳；離開山莊時補跳期間錯過的通知。
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const base = { characters: [], chatHistory: {}, proactiveUnread: {}, posts: [], mailboxMails: [], featureLoaded: true };
const now = Date.UTC(2026, 9, 28, 6, 0, 0); // 台灣 14:00
const makeSave = () => ({
  coins: 500,
  inventory: { qingling: 10 },
  cultivation: { realmIdx: 0, unlocks: {} },
  farm: { plots: Array.from({ length: 3 }, (_, id) => ({ id, cropId: null, plantedAt: null })) },
  shop: { furnaces: [{ recipeId: null, startedAt: null, batch: 0 }] },
});

// --- 山莊：種植時寫 readyAt，通知層只讀欄位 ---
const save = makeSave();
assert.equal(plantCrop(save, 0, "qingling", now - MINUTE), null, "planting succeeds");
assert.equal(save.farm.plots[0].readyAt, now - MINUTE + growMs(cropById("qingling")), "planting records readyAt so the notifier never needs the crop table");
assert.equal(plantCrop(save, 1, "qingling", now), null);
assert.deepEqual(collectVillaReadyItems(save, now), { ripePlots: 0, cookedBatches: 0, earliestReadyAt: 0 }, "nothing is ripe right after planting");
assert.equal(nextVillaDueAt(save, now), save.farm.plots[0].readyAt, "the next due time is the first plot to ripen");
const ripeTime = save.farm.plots[1].readyAt + 1;
const ripe = collectVillaReadyItems(save, ripeTime);
assert.equal(ripe.ripePlots, 2);
assert.equal(ripe.earliestReadyAt, save.farm.plots[0].readyAt, "time is the earliest unharvested ripening, so later ripenings do not re-notify");

// 舊檔的田沒有 readyAt → 不報，不誤判。
const legacy = makeSave();
legacy.farm.plots[0] = { id: 0, cropId: "qingling", plantedAt: now - 10 * HOUR };
assert.equal(collectVillaReadyItems(legacy, now).ripePlots, 0, "legacy plots without readyAt are skipped");

// --- 丹爐：開爐時寫 unitMs；煉好幾份由 startedAt＋unitMs 算 ---
const alchemy = makeSave();
assert.equal(startCraft(alchemy, "huiqi", 3, now), null, "crafting starts (huiqi: 2 qingling each, 25 min)");
const furnace = alchemy.shop.furnaces[0];
assert.equal(furnace.unitMs, 25 * MINUTE, "starting a craft records the per-unit duration");
assert.equal(collectVillaReadyItems(alchemy, now + 24 * MINUTE).cookedBatches, 0);
assert.equal(collectVillaReadyItems(alchemy, now + 51 * MINUTE).cookedBatches, 2, "two units are done after two unit durations");
assert.equal(collectVillaReadyItems(alchemy, now + 9 * HOUR).cookedBatches, 3, "capped at the batch size");
assert.equal(collectVillaReadyItems(alchemy, now + 9 * HOUR).earliestReadyAt, now + 25 * MINUTE);
assert.equal(nextVillaDueAt(alchemy, now), now + 25 * MINUTE);
const legacyFurnace = makeSave();
legacyFurnace.shop.furnaces[0] = { recipeId: "huiqi", startedAt: now - 5 * HOUR, batch: 2 };
assert.equal(collectVillaReadyItems(legacyFurnace, now).cookedBatches, 0, "a furnace started by an older build (no unitMs) is skipped");

const villaList = collectNotifications({ ...base, yunyinSave: save, featureNow: ripeTime, loginReward: { lastClaimDate: taiwanDayKey(ripeTime) } });
assert.equal(villaList.length, 1);
assert.equal(villaList[0].type, NOTIFICATION_TYPES.VILLA);
assert.equal(villaList[0].appId, "yunyin");
assert.equal(villaList[0].count, 1, "details live in the body; count stays 1 so the banner title is not suffixed with a message count");
assert.match(villaList[0].body, /2 塊田可以收成/);
assert.equal(villaList[0].time, save.farm.plots[0].readyAt);
alchemy.farm = save.farm;
const both = collectNotifications({ ...base, yunyinSave: alchemy, featureNow: ripeTime, loginReward: { lastClaimDate: taiwanDayKey(ripeTime) } })[0];
assert.match(both.body, /2 塊田可以收成了、丹爐煉好了/);
assert.equal(collectNotifications({ ...base, yunyinSave: save, featureNow: ripeTime, featureLoaded: false, loginReward: null }).length, 0, "nothing is reported before the feature stores are loaded");
assert.equal(collectNotifications({ ...base, yunyinSave: null, featureNow: ripeTime, loginReward: { lastClaimDate: taiwanDayKey(ripeTime) } }).length, 0, "no villa save → no villa notification");

// --- 登入獎勵：台灣時間 05:00 換日 ---
const dayStart = taiwanDayStart(now);
assert.equal(taiwanDayKey(dayStart), taiwanDayKey(now), "the day start belongs to the same Taiwan day");
assert.notEqual(taiwanDayKey(dayStart - 1), taiwanDayKey(now), "one ms earlier is the previous day");
const unclaimed = collectNotifications({ ...base, yunyinSave: null, featureNow: now, loginReward: { day: 2, lastClaimDate: taiwanDayKey(now - 24 * HOUR) } });
assert.equal(unclaimed.length, 1);
assert.equal(unclaimed[0].type, NOTIFICATION_TYPES.LOGIN_REWARD);
assert.equal(unclaimed[0].appId, "game");
assert.deepEqual(unclaimed[0].payload, { gamePage: "loginReward" }, "tapping opens Game Center on the login reward page");
assert.match(unclaimed[0].body, /第 3 天/);
assert.equal(unclaimed[0].time, dayStart, "one event per day, timed at the day start");
assert.equal(collectNotifications({ ...base, yunyinSave: null, featureNow: now, loginReward: { day: 2, lastClaimDate: taiwanDayKey(now) } }).length, 0, "claimed today → quiet");
assert.equal(collectNotifications({ ...base, yunyinSave: null, featureNow: now, loginReward: null })[0]?.type, NOTIFICATION_TYPES.LOGIN_REWARD, "a player who never claimed is reminded of day 1");

// --- 時鐘：下一次換日或下一塊田熟，取最近的 ---
assert.equal(nextFeatureNotificationDueAt({ yunyinSave: null }, now), dayStart + 24 * HOUR);
assert.equal(nextFeatureNotificationDueAt({ yunyinSave: save }, now), save.farm.plots[0].readyAt);
assert.ok(nextFeatureNotificationDueAt({ yunyinSave: save }, ripeTime) > ripeTime, "after everything ripened only the day change remains");

// --- 設定：新類型預設開、錢包入帳已移除 ---
assert.deepEqual(Object.keys(DEFAULT_NOTIFICATION_SETTINGS.types), ["message", "match", "like", "social", "villa", "loginReward", "mailbox"]);

// --- 離開山莊補跳 ---
const live = [
  { id: "message:c1", appId: "chat", time: 5 },
  { id: "loginReward:today", appId: "game", time: 3 },
  { id: "villa:ready", appId: "yunyin", time: 9 },
];
const missed = [
  { id: "message:c1", appId: "chat", time: 4 }, { id: "message:c1", appId: "chat", time: 5 },
  { id: "message:gone", appId: "chat", time: 6 }, { id: "loginReward:today", appId: "game", time: 3 },
];
assert.deepEqual(selectCatchUpNotifications(missed, live, "home").map((item) => item.id), ["message:c1", "loginReward:today"], "deduped, only still-live items, newest first");
assert.deepEqual(selectCatchUpNotifications(missed, live, "chat").map((item) => item.id), ["loginReward:today"], "the app being entered does not announce itself");
assert.deepEqual(selectCatchUpNotifications([], live, "home"), []);

console.log("ok: villa ripe/furnace and unclaimed login reward notify through the shared center, and immersive catch-up replays missed ones (MP-091)");
