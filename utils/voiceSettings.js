export const createDefaultVoiceSettings = () => ({
  enabled: false,
  elevenlabs: { voiceId: "", speed: 1, stability: 0.5, similarity: 0.75 },
  minimax: { voiceId: "", speed: 1, pitch: 0, volume: 1, emotion: "auto" },
});

export const normalizeCharacterVoiceSettings = (value) => {
  const defaults = createDefaultVoiceSettings();
  const source = value && typeof value === "object" ? value : {};
  return {
    ...defaults,
    ...source,
    enabled: !!source.enabled,
    elevenlabs: { ...defaults.elevenlabs, ...(source.elevenlabs || {}) },
    minimax: { ...defaults.minimax, ...(source.minimax || {}) },
  };
};
