import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applySuperLikeRefill, createDatingState, getTaipeiWeekKey, grantSuperLikes, normalizeDatingState, resolveSuperLikeLog,
} from "../services/dating/datingMatching.js";
import {
  REPORT_REWARD_SUPER_LIKES, SUPER_LIKE_CONTACT_REWARD, SUPER_LIKE_LOGIN_STREAK_REWARD, SUPER_LIKE_MAX, SUPER_LIKE_WEEKLY_FLOOR,
} from "../constants/dating.js";

// 台北 = UTC+8，無夏令時間。2026-10-12 是週一。
const taipei = (y, m, d, hh = 0, mm = 0) => Date.UTC(y, m - 1, d, hh - 8, mm);

// 常數符合小舞核准的規則。
assert.equal(SUPER_LIKE_WEEKLY_FLOOR, 3);
assert.equal(SUPER_LIKE_MAX, 9);
assert.equal(SUPER_LIKE_CONTACT_REWARD, 1);
assert.equal(SUPER_LIKE_LOGIN_STREAK_REWARD, 1);
assert.equal(REPORT_REWARD_SUPER_LIKES, 2);

// 週 key：以台北時間週一為界，與機器時區無關。
assert.equal(getTaipeiWeekKey(taipei(2026, 10, 11, 23, 59)), "2026-10-05", "Sunday 23:59 Taipei belongs to the previous week");
assert.equal(getTaipeiWeekKey(taipei(2026, 10, 12, 0, 0)), "2026-10-12", "Monday 00:00 Taipei starts a new week");
assert.equal(getTaipeiWeekKey(taipei(2026, 10, 12, 0, 0) - 1), "2026-10-05", "one millisecond before Monday is still last week");
assert.equal(getTaipeiWeekKey(taipei(2026, 10, 18, 23, 59)), "2026-10-12", "Sunday night stays in the same week");
assert.equal(getTaipeiWeekKey(taipei(2026, 10, 13, 12)), "2026-10-12");
// UTC 週日 16:00 已是台北週一 00:00：純用 UTC 會算錯。
assert.equal(getTaipeiWeekKey(Date.UTC(2026, 9, 11, 16, 0)), "2026-10-12");
assert.equal(getTaipeiWeekKey(Date.UTC(2026, 9, 11, 15, 59)), "2026-10-05");

// 每週補滿到 3，不累積；同週不重複補。
const sundayNight = taipei(2026, 10, 11, 23, 59);
const mondayMorning = taipei(2026, 10, 12, 0, 0);
const empty = { ...createDatingState(), superLikes: 0 };
const refilledSunday = applySuperLikeRefill(empty, sundayNight);
assert.equal(refilledSunday.superLikes, 3);
assert.equal(refilledSunday.lastSuperLikeRefillWeek, "2026-10-05");
assert.equal(refilledSunday.superLikeLog[0].status, "granted");
assert.equal(refilledSunday.superLikeLog[0].source, "weekly");
assert.equal(refilledSunday.superLikeLog[0].count, 3);
assert.equal(refilledSunday.superLikeLog[0].profileId, null);
// 同週：用掉一個再進入也不補。
const spent = { ...refilledSunday, superLikes: 2 };
assert.equal(applySuperLikeRefill(spent, sundayNight), spent, "same week returns the same object");
assert.equal(applySuperLikeRefill(spent, sundayNight + 1000).superLikes, 2);
// 跨到週一 00:00 立刻補。
const refilledMonday = applySuperLikeRefill(spent, mondayMorning);
assert.equal(refilledMonday.superLikes, 3);
assert.equal(refilledMonday.lastSuperLikeRefillWeek, "2026-10-12");
assert.equal(refilledMonday.superLikeLog.length, 2);
// 有 5 個就不補，但記下本週已處理、不寫帳。
const rich = { ...createDatingState(), superLikes: 5, lastSuperLikeRefillWeek: "2026-10-05" };
const richAfter = applySuperLikeRefill(rich, mondayMorning);
assert.equal(richAfter.superLikes, 5);
assert.equal(richAfter.lastSuperLikeRefillWeek, "2026-10-12");
assert.equal(richAfter.superLikeLog.length, 0);
assert.equal(applySuperLikeRefill(richAfter, mondayMorning + 1), richAfter);
// 剛好 3 個也不補。
assert.equal(applySuperLikeRefill({ ...createDatingState(), superLikes: 3 }, mondayMorning).superLikeLog.length, 0);

// 加點：夾上限 9、寫帳；達上限時回原物件。
const base = { ...createDatingState(), superLikes: 3 };
const contact = grantSuperLikes(base, SUPER_LIKE_CONTACT_REWARD, { source: "contact", now: 1000 });
assert.equal(contact.superLikes, 4);
assert.deepEqual(contact.superLikeLog[0], { profileId: null, at: 1000, status: "granted", source: "contact", count: 1 });
const nearCap = grantSuperLikes({ ...base, superLikes: 8 }, 5, { source: "shop", now: 2000 });
assert.equal(nearCap.superLikes, SUPER_LIKE_MAX);
assert.equal(nearCap.superLikeLog[0].count, 1, "log records the amount actually granted");
const capped = { ...base, superLikes: SUPER_LIKE_MAX };
assert.equal(grantSuperLikes(capped, 2, { source: "shop" }), capped, "at cap returns the same object without a log entry");
assert.equal(grantSuperLikes(base, 0, { source: "shop" }), base);
assert.equal(grantSuperLikes(base, -3, { source: "shop" }), base);
assert.equal(grantSuperLikes(base, "2", { source: "shop" }).superLikes, 5);
// 週補不會因上限受影響（本來就 ≤ 3），且超出 9 的舊存檔會被 normalize 夾回。
assert.equal(normalizeDatingState({ superLikes: 42 }).superLikes, SUPER_LIKE_MAX);
assert.equal(normalizeDatingState({ superLikes: -2 }).superLikes, 0);
assert.equal(normalizeDatingState({ superLikes: 2.7 }).superLikes, 2);

// 舊存檔沒有新欄位：預設值正常、第一次進入就補。
const legacy = normalizeDatingState({ superLikes: 1, superLikeLog: [{ profileId: "p1", at: 5, status: "silent" }] });
assert.equal(legacy.lastSuperLikeRefillWeek, "");
assert.equal(normalizeDatingState({}).lastSuperLikeRefillWeek, "");
assert.equal(normalizeDatingState({ lastSuperLikeRefillWeek: 123 }).lastSuperLikeRefillWeek, "");
assert.equal(normalizeDatingState({ lastSuperLikeRefillWeek: "2026-10-05" }).lastSuperLikeRefillWeek, "2026-10-05");
const legacyRefilled = applySuperLikeRefill(legacy, mondayMorning);
assert.equal(legacyRefilled.superLikes, 3);
assert.equal(legacyRefilled.superLikeLog.length, 2);
assert.equal(legacyRefilled.superLikeLog[1].profileId, "p1", "existing entries are kept");

// granted 項目不會被 resolveSuperLikeLog 改壞（它只處理 waiting）。
const mixedLog = [
  { profileId: null, at: 10, status: "granted", source: "weekly", count: 3 },
  { profileId: "p-wait", at: 20, status: "waiting", resolveAt: 30 },
];
const resolved = resolveSuperLikeLog(mixedLog, { matches: [], pending: [] }, 100);
assert.notEqual(resolved, mixedLog);
assert.deepEqual(resolved[0], mixedLog[0]);
assert.equal(resolved[1].status, "silent");
const grantedOnly = [mixedLog[0]];
assert.equal(resolveSuperLikeLog(grantedOnly, { matches: [], pending: [] }, 100), grantedOnly, "no change returns the same array");

// hook 接線：sweep 套用週補、交換聯絡方式 +1、檢舉改走 grantSuperLikes、對外提供 grantSuperLikes(count, source)。
const hookSource = await readFile(new URL("../hooks/dating/useDatingApp.js", import.meta.url), "utf8");
assert.match(hookSource, /const current = applySuperLikeRefill\(previous, now\)/);
assert.match(hookSource, /grantSuperLikesToState\(current, SUPER_LIKE_CONTACT_REWARD, \{ source: "contact"/);
assert.match(hookSource, /REPORT_REWARD_SUPER_LIKES, \{ source: "report"/);
assert.match(hookSource, /const grantSuperLikes = useCallback\(\(count, source = "external"\)/);
assert.match(hookSource, /claimReportReward, grantSuperLikes, cancelAllReplies/);
assert.doesNotMatch(hookSource, /superLikes: current\.superLikes \+/, "no raw additions that bypass the cap");

console.log("dating super like refill: ok");
