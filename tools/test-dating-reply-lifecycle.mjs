import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createDatingReplyLifecycle,
  waitForDatingReplyDelay,
} from "../services/dating/datingReplyLifecycle.js";

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

console.log("dating reply lifecycle: ok");
