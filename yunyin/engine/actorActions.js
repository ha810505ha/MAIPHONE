// Runtime-only actor actions. The semantic action id is kept separate from the
// spritesheet coordinates so furniture/NPC logic does not need to change when
// a better animation is added later.
export const ACTOR_ACTIONS = Object.freeze({
  sit: Object.freeze({ id: "sit", label: "坐下", animation: { row: 4, frames: 6, frameMs: 260, directions: "horizontal" } }),
  sleep: Object.freeze({ id: "sleep", label: "睡覺", animation: { row: 3, frames: 6, frameMs: 420, directions: "none" } }),
  phone: Object.freeze({ id: "phone", label: "使用手機", animation: { row: 6, frames: 6, frameMs: 240, directions: "horizontal" } }),
  read: Object.freeze({ id: "read", label: "閱讀", animation: { row: 7, frames: 6, frameMs: 280, directions: "horizontal" } }),
  pickup: Object.freeze({ id: "pickup", label: "拿取", animation: { row: 9, frames: 6, frameMs: 150, directions: "four" } }),
  gift: Object.freeze({ id: "gift", label: "送禮", animation: { row: 10, frames: 6, frameMs: 180, directions: "four" } }),
  // The current pack has no dedicated eat row. Keep the actor standing and
  // facing the table instead of reusing the side-sit row, which looks like the
  // character is sitting on the floor when no chair is part of the interaction.
  eat: Object.freeze({ id: "eat", label: "用餐", animation: { row: 1, frames: 6, frameMs: 260, directions: "four" } }),
  cook: Object.freeze({ id: "cook", label: "料理", animation: { row: 9, frames: 6, frameMs: 190, directions: "four" } }),
});

export const actorActionById = (id) => ACTOR_ACTIONS[id] || null;

export function beginActorAction(actor, plan, now = performance.now(), durationMs = null) {
  const definition = actorActionById(plan?.action);
  if (!actor || !definition) return false;
  actor.path = [];
  actor.stepT = 0;
  actor.moving = false;
  actor.facing = plan.facing || actor.facing || "down";
  actor.action = {
    id: definition.id,
    label: definition.label,
    animation: definition.animation,
    startedAt: now,
    until: Number.isFinite(durationMs) ? now + durationMs : Infinity,
    slotKey: plan.slotKey || null,
    sourceId: plan.sourceId || null,
    renderOffset: plan.renderOffset || { x: 0, y: 0 },
  };
  return true;
}

export function stopActorAction(actor) {
  if (!actor?.action) return false;
  actor.action = null;
  return true;
}

export const actorReservedSlot = (actor) => actor?.action?.slotKey || actor?.interactionPlan?.slotKey || null;
