import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage.js";
import { findDuplicateChatCalendarEvent, normalizeCalendarProposal } from "./calendarChatAppointments.js";

export const CALENDAR_STORE_KEY = "ent_calendar";

const createEventId = () => `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function emitCalendarUpdate(store) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("calendar-storage-updated", { detail: store }));
  }
}

async function loadCalendarStore() {
  const saved = await loadFeatureEntity(CALENDAR_STORE_KEY, null);
  return saved && Array.isArray(saved.events) ? saved : { events: [] };
}

async function saveCalendarStore(store) {
  await saveFeatureEntity(CALENDAR_STORE_KEY, store);
  emitCalendarUpdate(store);
  return store;
}

export async function addChatCalendarEvent({ proposal, character, sourceMessageId, now = Date.now() }) {
  const normalized = normalizeCalendarProposal(proposal);
  if (!normalized || !character?.id || !sourceMessageId) throw new Error("Invalid chat calendar event");
  const store = await loadCalendarStore();
  const duplicate = findDuplicateChatCalendarEvent(store.events, normalized, character.id, sourceMessageId);
  if (duplicate) return { event: duplicate, duplicate: true };
  const event = {
    id: createEventId(),
    ...normalized,
    note: `與 ${String(character.name || "角色").trim().slice(0, 40)} 在聊天中約定`,
    visibleToChar: true,
    characterReminderEnabled: true,
    characterId: character.id,
    characterName: String(character.name || "").trim().slice(0, 40),
    sourceMessageId,
    source: "chat",
    storyStatus: "scheduled",
    createdAt: now,
  };
  await saveCalendarStore({ ...store, events: [...store.events, event] });
  return { event, duplicate: false };
}

export async function hasChatCalendarEvent({ proposal, characterId, sourceMessageId = "" }) {
  if (!characterId) return false;
  const store = await loadCalendarStore();
  return Boolean(findDuplicateChatCalendarEvent(store.events, proposal, characterId, sourceMessageId));
}

export async function updateCalendarEvent(eventId, patch, now = Date.now()) {
  if (!eventId) throw new Error("Calendar event id is required");
  const store = await loadCalendarStore();
  let updated = null;
  const events = store.events.map((event) => {
    if (event.id !== eventId) return event;
    updated = { ...event, ...patch, updatedAt: now };
    return updated;
  });
  if (!updated) return null;
  await saveCalendarStore({ ...store, events });
  return updated;
}
