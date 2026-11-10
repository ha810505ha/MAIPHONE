import assert from "node:assert/strict";
import fs from "node:fs";
import {
  STORY_VISIBILITY,
  STORY_VISIBILITY_FIELDS,
  STORY_VISIBILITY_ICONS,
  getStoryVisibility,
  nextStoryVisibility,
  normalizeStoryVisibility,
} from "../constants/storyStatus.js";

// 只有伏筆與備註帶知情度；其他欄位角色本來就身在其中。
assert.deepEqual(STORY_VISIBILITY_FIELDS, ["thread", "playerNote"]);
assert.deepEqual(STORY_VISIBILITY, ["known", "quiet", "hidden"]);
for (const level of STORY_VISIBILITY) assert.ok(STORY_VISIBILITY_ICONS[level], `${level} needs an icon`);

// 知情程度 UI 暫未開放：舊資料與新增欄位都預設讓角色知道。
assert.equal(getStoryVisibility({}, "thread"), "known");
assert.equal(getStoryVisibility({}, "playerNote"), "known");
assert.equal(getStoryVisibility({ visibility: { thread: "quiet" } }, "thread"), "quiet");
// 壞值要退回預設，不能讓未知字串漏進提示詞分流。
assert.equal(getStoryVisibility({ visibility: { playerNote: "public" } }, "playerNote"), "known");
assert.equal(normalizeStoryVisibility("nope", "known"), "known");

// 眼睛按鈕循環三態後回到原點。
assert.equal(nextStoryVisibility("known"), "quiet");
assert.equal(nextStoryVisibility("quiet"), "hidden");
assert.equal(nextStoryVisibility("hidden"), "known");
// 無效值先歸位到 known，下一次點擊才開始循環。
assert.equal(nextStoryVisibility(undefined), "known");

const promptSource = fs.readFileSync(new URL("../hooks/chat/useChatPromptController.js", import.meta.url), "utf8");
// 三段必須各自存在，且 quiet／hidden 不能混進角色可見的 status 區塊。
assert.match(promptSource, /\[Current story status — applies only to this chat route\]/);
assert.match(promptSource, /\[Unspoken context — \{\{char\}\} is aware of this but never brings it up\]/);
assert.match(promptSource, /\[Director-only context — \{\{char\}\} does NOT know this\]/);
assert.match(promptSource, /pickByVisibility\("known"\)/);
assert.match(promptSource, /const quietLines = pickByVisibility\("quiet"\)/);
assert.match(promptSource, /const hiddenLines = pickByVisibility\("hidden"\)/);
// 可見區塊只能直接列出這四欄，伏筆與備註一律走 pickByVisibility。
const statusBlock = promptSource.slice(promptSource.indexOf("const statusLines = ["), promptSource.indexOf("const quietLines"));
for (const key of ["status.thread", "status.playerNote"]) {
  assert.ok(!statusBlock.includes(key), `${key} must go through pickByVisibility, not the always-visible list`);
}

const roomsSource = fs.readFileSync(new URL("../hooks/chat/useCharacterChatRooms.js", import.meta.url), "utf8");
assert.match(roomsSource, /visibility:\s*\{/, "story status must persist visibility");

const uiSource = fs.readFileSync(new URL("../components/chat/ChatStoryStatus.jsx", import.meta.url), "utf8");
assert.doesNotMatch(uiSource, /cycleVisibility\(key\)/, "visibility controls stay hidden until their final UI is ready");
assert.doesNotMatch(uiSource, /鎖定此欄位/, "the unused lock control must not be shown");

console.log("ok: story status defaults to character-visible context while preserving future visibility routing");
