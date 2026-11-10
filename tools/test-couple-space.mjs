import assert from "node:assert/strict";
import fs from "node:fs";
import {
  addCoupleAnniversary,
  addCouplePromise,
  arePromisesSimilar,
  buildCoupleAnniversaries,
  buildCoupleTimeline,
  completeCouplePromise,
  daysTogether,
  describeOpenPromisesForChat,
  extractCouplePromiseDirective,
  getCouplePeakTemperature,
  isCoupleUnlocked,
  removeCouplePromise,
  splitCouplePromises,
  withCouplePeakTemperature,
} from "../utils/coupleSpace.js";

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const labels = {
  firstChat: () => "第一次聊天",
  spaceOpen: () => "開通情侶空間",
  day: (n) => `第 ${n} 天`,
  chatYears: (n) => `認識 ${n} 週年`,
  spaceYears: (n) => `情侶空間 ${n} 週年`,
};

// ---- 天數：第一天算第 1 天，跨過午夜 +1 ----
assert.equal(daysTogether(at(2026, 9, 4, 23), at(2026, 9, 4, 23, 30)), 1);
assert.equal(daysTogether(at(2026, 9, 4, 23), at(2026, 9, 5, 1)), 2);
assert.equal(daysTogether(0), 0);

// ---- 紀念日 ----
const now = at(2026, 10, 9);
const anniv = buildCoupleAnniversaries({
  firstChatAt: at(2026, 9, 4), acceptedAt: at(2026, 9, 12), now, labels,
  custom: [{ id: "c1", title: "第一次告白", date: "2025-10-11", yearly: true }, { id: "bad", title: "x", date: "2026-02-30" }],
});
assert.deepEqual(anniv.past.map((item) => item.title).slice(0, 3), ["開通情侶空間", "第一次聊天", "第一次告白"]);
assert.equal(anniv.next.title, "第一次告白", "自訂的每年紀念日：下一次是今年 10/11");
assert.equal(anniv.next.daysLeft, 2);
assert.equal(anniv.next.years, 1);
assert.ok(anniv.upcoming.some((item) => item.title === "第 50 天" && item.daysLeft === 14), "9/4 起算的第 50 天是 10/23");
assert.ok(!anniv.past.some((item) => item.key.startsWith("custom-bad")), "不合法日期要忽略");
assert.equal(anniv.today.length, 0);
const todayAnniv = buildCoupleAnniversaries({ firstChatAt: at(2026, 9, 4), now: at(2026, 10, 23, 9), labels });
assert.equal(todayAnniv.today[0]?.title, "第 50 天");
const sameDay = buildCoupleAnniversaries({ firstChatAt: at(2026, 9, 4, 8), acceptedAt: at(2026, 9, 4, 20), now, labels });
assert.equal(sameDay.past.filter((item) => item.origin).length, 1, "開通日和第一次聊天同一天只顯示一次");

// ---- 聊天中的約定標記 ----
const extracted = extractCouplePromiseDirective("好，說好了。\n[[COUPLE_PROMISE:text=下雨天一起去書店;date=2026-10-18]]");
assert.equal(extracted.text, "好，說好了。");
assert.deepEqual(extracted.proposal, { text: "下雨天一起去書店", date: "2026-10-18" });
assert.deepEqual(extractCouplePromiseDirective("嗯[[COUPLE_PROMISE:text=早點睡;晚安前說愛你;date=]]").proposal, { text: "早點睡;晚安前說愛你", date: "" });
assert.equal(extractCouplePromiseDirective("[[COUPLE_PROMISE:text=;date=2026-10-18]]").proposal, null);
assert.equal(extractCouplePromiseDirective("[[COUPLE_PROMISE:text=去海邊;date=明天]]").proposal.date, "", "不是日期格式就當作沒有日期");
assert.ok(arePromisesSimilar("下雨天一起去書店", "下雨天一起去書店躲雨"));
assert.ok(!arePromisesSimilar("一起去書店", "一起看電影"));

// ---- 約定的新增、重複、完成、上限 ----
let store = { _spaces: { a: { status: "accepted" } }, a: { day: "2026-10-09", task: { text: "x" } } };
let result = addCouplePromise(store, "a", { text: "下雨天一起去書店", date: "2026-10-18", source: "chat", sourceMessageId: "m1" }, { now });
assert.equal(result.status, "added");
store = result.store;
assert.equal(store.a.task.text, "x", "不能動到每日資料");
assert.equal(addCouplePromise(store, "a", { text: "下雨天一起去書店躲雨" }, { now }).status, "duplicate");
result = addCouplePromise(store, "a", { text: "這週每天早點睡" }, { now: now + 1 });
store = result.store;
const doneId = result.promise.id;
store = completeCouplePromise(store, "a", doneId, now + 5);
const split = splitCouplePromises(store._promises.a);
assert.equal(split.open.length, 1);
assert.equal(split.done[0].doneAt, now + 5);
assert.equal(addCouplePromise(store, "a", { text: "這週每天早點睡" }, { now }).status, "added", "已完成的約定可以再約一次");
assert.equal(removeCouplePromise(store, "a", doneId)._promises.a.length, 1);
let big = {};
for (let i = 0; i < 70; i++) {
  const added = addCouplePromise(big, "a", { text: `約定${i}號${"甲乙丙丁戊己庚辛壬癸"[i % 10]}${i * 7}` }, { now: now + i });
  big = completeCouplePromise(added.store, "a", added.promise.id, now + i);
}
assert.equal(big._promises.a.length, 50, "已完成只保留最近 50 個");
assert.ok(big._promises.a.some((item) => item.text.startsWith("約定69號")) && !big._promises.a.some((item) => item.text.startsWith("約定0號")), "刪掉的是最早完成的");
let full = {};
const WORDS = ["看海", "爬山", "煮飯", "看電影", "逛書店", "畫畫", "露營", "唱歌", "散步", "拍照", "賞花", "滑雪", "釣魚", "跳舞", "下棋", "烤餅乾", "騎車", "看星星", "泡溫泉", "寫信"];
for (const word of WORDS) full = addCouplePromise(full, "a", { text: word }, { now }).store;
assert.equal(full._promises.a.length, 20);
assert.equal(addCouplePromise(full, "a", { text: "第二十一個新的約定喔" }, { now }).status, "full", "進行中最多 20 個");
const lines = describeOpenPromisesForChat(store._promises.a, now);
assert.ok(lines[0].includes("9 天後"), lines[0]);

// ---- 自訂紀念日 ----
const addedAnniv = addCoupleAnniversary({}, "a", { title: "  第一次告白 ", date: "2025-10-11" }, { now });
assert.equal(addedAnniv.status, "added");
assert.equal(addedAnniv.item.title, "第一次告白");
assert.equal(addedAnniv.item.yearly, true);
assert.equal(addCoupleAnniversary({}, "a", { title: "x", date: "2025/10/11" }).status, "invalid");

// ---- 溫度解鎖：降溫不收回 ----
let peakStore = withCouplePeakTemperature({}, "a", 88);
peakStore = withCouplePeakTemperature(peakStore, "a", 60);
assert.equal(getCouplePeakTemperature(peakStore, "a", 60), 88);
assert.ok(isCoupleUnlocked(88, "nickname"));
assert.ok(!isCoupleUnlocked(88, "avatarFrame"));

// ---- 時間軸依月份分組 ----
const months = buildCoupleTimeline({
  anniversaries: anniv,
  promises: store._promises.a,
  specialMemories: [{ id: "s1", title: "雨夜的傘", createdAt: at(2026, 9, 28), itemRarity: "SR" }],
});
assert.deepEqual(months.map((group) => group.key), [...new Set(months.map((group) => group.key))], "同一個月只會有一組");
assert.equal(months[0].month, 10);
assert.ok(months.find((group) => group.month === 9).items.some((item) => item.type === "special"));

// ---- 接線檢查 ----
const service = fs.readFileSync(new URL("../services/couple/coupleDailyService.js", import.meta.url), "utf8");
const generator = fs.readFileSync(new URL("../services/chat/directChatGenerator.js", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../components/chat/ChatMessageRenderer.jsx", import.meta.url), "utf8");
const coupleApp = fs.readFileSync(new URL("../components/apps/CoupleApp.jsx", import.meta.url), "utf8");
assert.ok(service.includes("[[COUPLE_PROMISE:"), "情侶空間開通後要告訴角色怎麼標記約定");
assert.ok(generator.includes("extractCouplePromiseDirective"), "聊天回覆要剝除約定標記");
assert.ok(generator.includes("couplePromiseProposal"), "約定提示要掛在角色訊息上，讓玩家確認");
const promiseKeep = generator.match(/\{ text: couplePromiseContext, keep: (\d+) \}/);
assert.ok(promiseKeep && Number(promiseKeep[1]) >= 70, "約定規則要獨立成一塊且保留優先度夠高");
assert.ok(generator.includes("calendarDirective.proposal.title"), "只有日曆約定時也要提示收進約定");
const promiseFn = service.slice(service.indexOf("export async function buildCouplePromiseContext"), service.indexOf("export function extractCoupleDirectives"));
assert.ok(promiseFn.includes("[專屬暱稱") && promiseFn.includes("isCoupleUnlocked"), "解鎖後的專屬暱稱要放進優先度較高的約定區塊");
assert.ok(renderer.includes("CouplePromiseCard"), "聊天室要顯示約定確認卡");
assert.ok(coupleApp.includes("window.confirm") && coupleApp.includes("completeCouplePromise"), "手動完成約定前要確認");
assert.ok(!/changeCrystals\([^)]*promise/i.test(coupleApp), "完成約定不發結晶");

console.log("couple space tests passed");
