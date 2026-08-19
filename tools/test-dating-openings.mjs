import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createDatingOpeningMessageRecords,
  DATING_OPENING_MESSAGE_MAX,
  normalizeDatingOpeningMessages,
} from "../services/dating/datingOpenings.js";

assert.deepEqual(normalizeDatingOpeningMessages("  舊版單一開場  "), ["舊版單一開場"]);
assert.deepEqual(normalizeDatingOpeningMessages(["第一則", "", null, " 第二則 "]), ["第一則", "第二則"]);
assert.deepEqual(
  normalizeDatingOpeningMessages(["1", "2", "3", "4", "5", "6"]),
  ["1", "2", "3", "4", "5"],
);

let nextId = 0;
const records = createDatingOpeningMessageRecords(["第一則", "第二則", "第三則"], {
  now: 1000,
  createId: () => `opening-${++nextId}`,
});
assert.deepEqual(records, [
  { id: "opening-1", role: "assistant", content: "第一則", time: 1000 },
  { id: "opening-2", role: "assistant", content: "第二則", time: 1001 },
  { id: "opening-3", role: "assistant", content: "第三則", time: 1002 },
]);
assert.throws(() => createDatingOpeningMessageRecords(["缺少 ID 產生器"]), /requires createId/);
assert.equal(DATING_OPENING_MESSAGE_MAX, 5);

const hookSource = await readFile(new URL("../hooks/dating/useDatingApp.js", import.meta.url), "utf8");
assert.match(hookSource, /createDatingOpeningMessageRecords\(openingSource, \{ now, createId: newId \}\)/);
assert.match(hookSource, /messages:\s*\[\.\.\.relation\.messages, \.\.\.openingMessages\]/);
assert.match(hookSource, /unread:\s*\(Number\(relation\.unread\) \|\| 0\) \+ openingMessages\.length/);

console.log("dating multi-bubble openings: ok");
