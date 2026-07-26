export const HOME_PERSONALITY_KEYS = Object.freeze([
  "sociability", "tidiness", "energy", "independence",
  "kindness", "curiosity", "emotionality", "playfulness",
]);

export function effectivePersonality(profile) {
  const generated = profile?.generated?.personality || {};
  const overrides = profile?.overrides?.personality || {};
  return Object.fromEntries(HOME_PERSONALITY_KEYS.map((key) => [key, overrides[key] ?? generated[key] ?? 50]));
}

