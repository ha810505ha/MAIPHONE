export const RELATIONSHIP_STAGES = Object.freeze([
  { id: "stranger", min: 0, permissions: [] },
  { id: "familiar", min: 20, permissions: ["gift_furniture"] },
  { id: "friend", min: 40, permissions: ["gift_furniture", "move_gifted_furniture"] },
  { id: "close", min: 60, permissions: ["gift_furniture", "move_gifted_furniture", "decorate_zones"] },
  { id: "intimate", min: 80, permissions: ["gift_furniture", "move_gifted_furniture", "decorate_zones", "replace_general_furniture"] },
]);

export function relationshipStageOf(affinity) {
  return [...RELATIONSHIP_STAGES].reverse().find((stage) => affinity >= stage.min) || RELATIONSHIP_STAGES[0];
}

export function syncRelationshipPermissions(relationship) {
  const stage = relationshipStageOf(relationship.affinity);
  relationship.stage = stage.id;
  relationship.unlockedPermissions = [...stage.permissions];
  return relationship;
}

export function addHomeAffinity(relationship, amount, { dailyCap = 10, dayKey = new Date().toISOString().slice(0, 10) } = {}) {
  if (relationship.lastInteractionDay !== dayKey) { relationship.lastInteractionDay = dayKey; relationship.dailyGain = 0; }
  const allowed = Math.max(0, dailyCap - relationship.dailyGain);
  const applied = Math.max(0, Math.min(allowed, Number(amount) || 0));
  relationship.affinity = Math.max(0, Math.min(100, relationship.affinity + applied));
  relationship.dailyGain += applied;
  syncRelationshipPermissions(relationship);
  return applied;
}

