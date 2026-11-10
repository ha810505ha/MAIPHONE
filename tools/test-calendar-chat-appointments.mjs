import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildCalendarStoryStartPrompt,
  extractCalendarEventDirective,
  findDuplicateChatCalendarEvent,
  isCalendarEventVisibleToCharacter,
  selectDueCalendarEvent,
} from "../services/calendar/calendarChatAppointments.js";
import {
  buildCalendarPromptContext,
  takeCalendarChatReminder,
} from "../services/calendar/calendarPromptContext.js";

const extracted = extractCalendarEventDirective(
  "好，那我們明天見。\n[[CALENDAR_EVENT:title=一起看電影;date=2026-08-01;time=19:30]]",
);
assert.equal(extracted.text, "好，那我們明天見。");
assert.deepEqual(extracted.proposal, {
  title: "一起看電影",
  date: "2026-08-01",
  time: "19:30",
});
assert.equal(
  extractCalendarEventDirective("[[CALENDAR_EVENT:title=無效日期;date=2026-02-30;time=19:30]]").proposal,
  null,
);
assert.deepEqual(
  extractCalendarEventDirective("[[CALENDAR_EVENT:title=只約日期;date=2026-08-02;time=]]").proposal,
  { title: "只約日期", date: "2026-08-02", time: "" },
);

const events = [
  {
    id: "shared",
    title: "公開行程",
    date: "2026-08-01",
    time: "10:00",
    visibleToChar: true,
  },
  {
    id: "private-a",
    title: "只和 A 的約定",
    date: "2026-08-01",
    time: "12:00",
    visibleToChar: true,
    characterReminderEnabled: true,
    characterId: "a",
    source: "chat",
    storyStatus: "scheduled",
  },
];

const duplicateEvents = [
  {
    id: "dinner",
    title: "一起吃晚餐",
    date: "2026-08-02",
    time: "19:00",
    characterId: "a",
    sourceMessageId: "assistant-1",
    source: "chat",
  },
  {
    id: "no-time",
    title: "週末去水族館約會",
    date: "2026-08-03",
    time: "",
    characterId: "a",
    source: "chat",
  },
];
assert.equal(
  findDuplicateChatCalendarEvent(duplicateEvents, { title: "晚餐約會", date: "2026-08-02", time: "19:00" }, "a")?.id,
  "dinner",
);
assert.equal(
  findDuplicateChatCalendarEvent(duplicateEvents, { title: "去水族館約會", date: "2026-08-03", time: "" }, "a")?.id,
  "no-time",
);
assert.equal(
  findDuplicateChatCalendarEvent(duplicateEvents, { title: "一起吃晚餐", date: "2026-08-02", time: "20:00" }, "a"),
  null,
);
assert.equal(
  findDuplicateChatCalendarEvent(duplicateEvents, { title: "晚餐約會", date: "2026-08-02", time: "19:00" }, "b"),
  null,
);
assert.equal(isCalendarEventVisibleToCharacter(events[1], "a"), true);
assert.equal(isCalendarEventVisibleToCharacter(events[1], "b"), false);
assert.match(
  buildCalendarPromptContext(events, "明天做什麼", new Date("2026-07-31T12:00:00"), "a"),
  /只和 A 的約定/,
);
assert.doesNotMatch(
  buildCalendarPromptContext(events, "明天做什麼", new Date("2026-07-31T12:00:00"), "b"),
  /只和 A 的約定/,
);
assert.match(
  buildCalendarPromptContext(events, "嗨", new Date("2026-08-02T12:00:00"), "a"),
  /已過期｜昨天（2026-08-01） 12:00｜只和 A 的約定/,
);
assert.doesNotMatch(
  buildCalendarPromptContext([{ ...events[1], storyStatus: "started" }], "嗨", new Date("2026-08-02T12:00:00"), "a"),
  /已過期/,
);

const storageValues = new Map();
const storage = {
  getItem: (key) => storageValues.get(key) || null,
  setItem: (key, value) => storageValues.set(key, value),
};
assert.equal(
  takeCalendarChatReminder(events, new Date("2026-08-01T11:50:00"), storage, "b"),
  "",
);
assert.match(
  takeCalendarChatReminder(events, new Date("2026-08-01T11:50:00"), storage, "a"),
  /只和 A 的約定/,
);

assert.equal(
  selectDueCalendarEvent(events, "a", new Date("2026-08-01T11:40:00"))?.id,
  "private-a",
);
assert.equal(
  selectDueCalendarEvent(events, "b", new Date("2026-08-01T11:40:00")),
  null,
);
assert.equal(
  selectDueCalendarEvent([{ ...events[1], storyStatus: "started" }], "a", new Date("2026-08-01T11:40:00")),
  null,
);
assert.match(buildCalendarStoryStartPrompt(events[1]), /玩家主動按下/);

const generatorSource = fs.readFileSync(new URL("../services/chat/directChatGenerator.js", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
const promptControllerSource = fs.readFileSync(new URL("../hooks/chat/useChatPromptController.js", import.meta.url), "utf8");
const renderControllerSource = fs.readFileSync(new URL("../hooks/chat/useChatRenderController.jsx", import.meta.url), "utf8");
const rendererSource = fs.readFileSync(new URL("../components/chat/ChatMessageRenderer.jsx", import.meta.url), "utf8");
assert.match(generatorSource, /CALENDAR_APPOINTMENT_RULE_CONTEXT/);
assert.match(generatorSource, /extractCalendarEventDirective/);
assert.match(generatorSource, /calendarProposal/);
assert.match(generatorSource, /calendarProposalIsDuplicate/);
assert.match(mainSource, /addChatCalendarEvent/);
assert.match(mainSource, /useChatSettingsController/);
assert.match(renderControllerSource, /selectDueCalendarEvent/);
assert.match(promptControllerSource, /calendar_story_start/);
assert.match(promptControllerSource, /buildCalendarStoryStartPrompt/);
assert.match(rendererSource, /CalendarAppointmentCard/);

console.log("calendar chat appointments: ok");
