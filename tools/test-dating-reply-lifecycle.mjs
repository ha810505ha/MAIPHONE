import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createDatingReplyLifecycle,
  waitForDatingReplyDelay,
} from "../services/dating/datingReplyLifecycle.js";
import { availableProfiles, createDatingState, dailyDeckRank, nextRefreshAt, swipeReturnAt } from "../services/dating/datingMatching.js";
import { LIKE_RETRY_COOLDOWN_MS, PASS_COOLDOWN_MS } from "../constants/dating.js";
import { DATING_PROFILES } from "../data/dating/profiles.js";
import { presenceLabel } from "../services/dating/datingPresence.js";

const lifecycle = createDatingReplyLifecycle();
const first = lifecycle.start("profile-a");
const second = lifecycle.start("profile-b");
assert(first);
assert(second);
assert.equal(lifecycle.start("profile-a"), null);
assert.deepEqual([...lifecycle.activeProfileIds()].sort(), ["profile-a", "profile-b"]);

assert.equal(lifecycle.finish(first), true);
assert.deepEqual([...lifecycle.activeProfileIds()], ["profile-b"]);
assert.equal(second.controller.signal.aborted, false);

assert.equal(lifecycle.cancel("profile-b", "blocked"), true);
assert.equal(second.controller.signal.aborted, true);
assert.equal(lifecycle.activeProfileIds().size, 0);

const stale = lifecycle.start("profile-a");
assert.equal(lifecycle.cancel("profile-a"), true);
const current = lifecycle.start("profile-a");
assert.equal(lifecycle.finish(stale), false);
assert.equal(lifecycle.isActive(current), true);

const delayController = new AbortController();
const delay = waitForDatingReplyDelay(100, delayController.signal);
delayController.abort();
await assert.rejects(delay, (error) => error?.name === "AbortError");

lifecycle.cancelAll();
assert.equal(lifecycle.activeProfileIds().size, 0);

const [hookSource, chatSource, appSource] = await Promise.all([
  readFile(new URL("../hooks/dating/useDatingApp.js", import.meta.url), "utf8"),
  readFile(new URL("../services/dating/datingChat.js", import.meta.url), "utf8"),
  readFile(new URL("../components/apps/DatingApp.jsx", import.meta.url), "utf8"),
]);
assert.match(chatSource, /callAI\([^;]+signal[^;]+app:\s*"dating"/s);
assert.match(hookSource, /cancelReply\(profileId, "Profile blocked"\)/);
assert.match(hookSource, /cancelReply\(profileId, "Profile reported"\)/);
assert.match(hookSource, /waitForDatingReplyDelay\(remaining, request\.controller\.signal\)/);
assert.match(hookSource, /typingProfiles/);
assert.match(appSource, /cancelAllReplies\("Dating app left"\)/);
assert.match(appSource, /typingProfiles\.has\(openChatId\)/);

// 回覆失敗改由玩家手動重試：sweep 跳過失敗標記，成功或再傳訊息會清掉標記。
assert.match(hookSource, /relation\.replyFailedAt \|\|/);
assert.match(hookSource, /patchRelation\(profileId, \(\) => \(\{ replyFailedAt: Date\.now\(\) \}\)\)/);
assert.match(hookSource, /const retryReply = useCallback/);
assert.match(appSource, /onRetry=\{\(\) => retryReply\(openChatId\)\}/);
// 正開著的聊天室補回訊息不算未讀；離開 App 時清掉正在看的聊天室。
assert.match(hookSource, /openChatIdRef\.current !== profileId/);
assert.match(appSource, /clearOpenChat\(\)/);
// 回上一張只能退回「跳過」，不能重骰喜歡／Super Like。
assert.match(hookSource, /current\.swiped\[profileId\]\?\.action !== "pass"/);
assert.match(appSource, /canRewind = lastSwiped\?\.\[1\]\?\.action === "pass"/);

// 沒配到的喜歡／Super Like 冷卻後回到牌堆；跳過的照舊隔天回來。
assert.equal(swipeReturnAt({ action: "pass", at: 1000 }), 1000 + PASS_COOLDOWN_MS);
assert.equal(swipeReturnAt({ action: "like", at: 1000 }), 1000 + LIKE_RETRY_COOLDOWN_MS);
assert.equal(swipeReturnAt({ action: "super", at: 1000 }), 1000 + LIKE_RETRY_COOLDOWN_MS);
assert(LIKE_RETRY_COOLDOWN_MS > 24 * 60 * 60 * 1000, "retry cooldown must outlast the slowest match delay");

const sample = DATING_PROFILES[0];
if (sample) {
  const now = 10 * LIKE_RETRY_COOLDOWN_MS;
  const ids = (state) => availableProfiles(state, now).map((entry) => entry.id);
  const liked = { ...createDatingState(), swiped: { [sample.id]: { action: "like", at: now - 1000 } } };
  assert(!ids(liked).includes(sample.id), "failed like stays hidden during cooldown");
  assert.equal(nextRefreshAt(liked, now), now - 1000 + LIKE_RETRY_COOLDOWN_MS);
  const cooled = { ...liked, swiped: { [sample.id]: { action: "like", at: now - LIKE_RETRY_COOLDOWN_MS } } };
  assert(ids(cooled).includes(sample.id), "failed like returns after cooldown");
  assert(!ids({ ...cooled, blocked: { [sample.id]: now } }).includes(sample.id), "blocked never returns");
  assert(!ids({ ...cooled, pending: [{ profileId: sample.id, matchAt: now + 1 }] }).includes(sample.id), "pending match stays hidden");
  assert(!ids({ ...cooled, matches: [{ profileId: sample.id }] }).includes(sample.id), "matched stays hidden");
}

// 牌堆每天洗一次：同一天內順序固定，換日會變。
assert.equal(dailyDeckRank("a", "2026-10-08"), dailyDeckRank("a", "2026-10-08"));
if (DATING_PROFILES.length >= 5) {
  const day = Date.UTC(2026, 9, 8, 4);
  const order = (at) => availableProfiles(createDatingState(), at).map((entry) => entry.id);
  assert.deepEqual(order(day), order(day + 60 * 60 * 1000), "deck order is stable within a day");
  assert.notDeepEqual(order(day), DATING_PROFILES.map((entry) => entry.id), "deck is shuffled, not registry order");
  assert.notDeepEqual(order(day), order(day + 24 * 60 * 60 * 1000), "deck reshuffles on a new day");
}
// 配對列表依最後動態排序，未讀顯示數字。
assert.match(appSource, /\[\.\.\.matches\]\.sort\(\(a, b\) => lastActivity\(b\) - lastActivity\(a\)\)/);
assert.match(appSource, /relation\.unread > 99 \? "99\+" : relation\.unread/);

// 信風介面文字一律走翻譯：toast、aria-label、placeholder 與 JSX 文字節點不可直接寫中文。
const datingUiFiles = [
  "../components/apps/DatingApp.jsx",
  "../components/dating/DatingChat.jsx",
  "../components/dating/DatingProfileEditor.jsx",
  "../components/dating/DatingSystemPanel.jsx",
  "../components/dating/ProfileCard.jsx",
  "../components/dating/ProfileDetail.jsx",
  "../components/dating/SwipeDeck.jsx",
];
const CJK = "[\\u3400-\\u9fff]";
for (const file of datingUiFiles) {
  const source = (await readFile(new URL(file, import.meta.url), "utf8"))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, new RegExp(`(aria-label|placeholder|title)="[^"]*${CJK}`), `${file}: untranslated attribute`);
  assert.doesNotMatch(source, new RegExp(`showToast\\?\\.\\(\\s*["\`][^"\`]*${CJK}`), `${file}: untranslated toast`);
  assert.doesNotMatch(source, new RegExp(`>[^<>{}]*${CJK}[^<>{}]*<`), `${file}: untranslated JSX text`);
}
const englishTr = (_zh, en) => en;
assert.equal(presenceLabel({ onlineHours: { start: "00:00", end: "24:00" } }, Date.now(), 0, englishTr).text, "Online");
assert.equal(presenceLabel({ onlineHours: { start: "00:00", end: "24:00" } }).text, "線上");

console.log("dating reply lifecycle: ok");
