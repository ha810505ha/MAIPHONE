const ACTOR_TILE_SIZE = 32;

// Runtime-only actor actions. The semantic action id is kept separate from the
// spritesheet coordinates so furniture/NPC logic does not need to change when
// a better animation is added later.
export const ACTOR_ACTIONS = Object.freeze({
  sit: Object.freeze({ id: "sit", label: "坐下", animation: { row: 4, frames: 6, frameMs: 260, directions: "horizontal" } }),
  // 正面視角的座位（單人沙發/長沙發/長椅/圓凳）專用。素材包的 sit 那一列只畫了
  // 朝左與朝右的側坐，套到正面家具上會變成人側著身子浮在椅面上。這裡刻意不給
  // animation，drawActor 就會退回正面待機姿勢——角色安靜地「放」在椅面上，
  // 配上正面椅子看起來就像端坐著，比硬套側坐自然得多。
  //
  // seatLift：椅面比地磚高，腳貼著格子底線的話角色會像站在椅子前面。往上抬
  // 1/4 格身體才會落在椅面上。這是「純畫面」的偏移（只有繪製與點擊判定吃它），
  // 不進 renderOffset——renderOffset 要維持整數格，NPC 的格子點擊判定靠它。
  // 個別家具想微調，在該家具的 interaction 上寫 seatLift 就會覆蓋這個預設。
  sit_front: Object.freeze({ id: "sit_front", label: "坐下", seatLift: 0.25 }),
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

// 角色在畫面上的實際落點（世界像素）。renderOffset 是整數格的席位偏移（NPC 的
// 格子點擊判定也吃它，所以必須維持整數）；seatLift 是純畫面的微調，讓人坐進
// 椅面而不是站在椅子前。繪製與點擊範圍都走這裡，兩者才不會對不上。
export function actorRenderPos(actor) {
  const offset = actor?.action?.renderOffset || { x: 0, y: 0 };
  return {
    x: actor.px + (offset.x || 0) * ACTOR_TILE_SIZE,
    y: actor.py + ((offset.y || 0) - (actor?.action?.seatLift || 0)) * ACTOR_TILE_SIZE,
  };
}

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
    seatLift: plan.seatLift ?? definition.seatLift ?? 0,
  };
  return true;
}

export function stopActorAction(actor) {
  if (!actor?.action) return false;
  actor.action = null;
  return true;
}

export const actorReservedSlot = (actor) => actor?.action?.slotKey || actor?.interactionPlan?.slotKey || null;
