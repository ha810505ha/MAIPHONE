import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { upsertNoteDraft } from "../utils/notesPersistence.js";

const original = [{ id: "note-1", title: "舊標題", content: "舊內容", updatedAt: 1 }];
const replaced = upsertNoteDraft(
  original,
  { ...original[0], title: "  新標題  " },
  "<b>最後一段內容</b>",
  10,
);
assert.equal(replaced.notes.length, 1);
assert.equal(replaced.item.title, "新標題");
assert.equal(replaced.item.content, "<b>最後一段內容</b>");
assert.equal(replaced.item.updatedAt, 10);

const inserted = upsertNoteDraft([], { id: "note-2", title: "   ", content: "" }, "新內容", 20);
assert.equal(inserted.notes[0].title, "未命名筆記");
assert.equal(inserted.notes[0].content, "新內容");

const notesApp = await readFile(new URL("../components/apps/NotesApp.jsx", import.meta.url), "utf8");
assert(
  /void persistCurrentDraft\(\)[\s\S]{0,300}draftRef\.current = null;[\s\S]{0,120}setDraft\(null\)/.test(notesApp),
  "leaving the note editor must persist before clearing the active draft",
);
assert(
  /persistCurrentDraft\(\{ updateState: false \}\)/.test(notesApp),
  "unmounting NotesApp must flush the active draft",
);
assert(
  !/if \(draft\) saveDraft\(\);\s*return \(\) => clearTimeout\(timerRef\.current\)/.test(notesApp),
  "draft dependency cleanup must not cancel the newly scheduled save",
);

console.log("ok: note drafts flush on editor exit and app unmount");
