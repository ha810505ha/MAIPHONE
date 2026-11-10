const DEVICE_SECRETS_VERSION = 1;

const asSecretString = (value) => (typeof value === "string" ? value : "");
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const presetSecretKey = (preset, index) => {
  const id = typeof preset?.id === "string" ? preset.id.trim() : "";
  return id || `@index:${index}`;
};

const EMPTY_DEVICE_SECRETS = Object.freeze({
  version: DEVICE_SECRETS_VERSION,
  apiKey: "",
  openRouterManagementKey: "",
  apiPresetKeys: Object.freeze({}),
  ttsApiKeys: Object.freeze({
    elevenlabs: "",
    minimax: "",
  }),
});

function normalizeDeviceSecrets(value) {
  const presetKeys = {};
  if (value?.apiPresetKeys && typeof value.apiPresetKeys === "object") {
    for (const [key, secret] of Object.entries(value.apiPresetKeys)) {
      if (key) presetKeys[key] = asSecretString(secret);
    }
  }
  return {
    version: DEVICE_SECRETS_VERSION,
    apiKey: asSecretString(value?.apiKey),
    openRouterManagementKey: asSecretString(value?.openRouterManagementKey),
    apiPresetKeys: presetKeys,
    ttsApiKeys: {
      elevenlabs: asSecretString(value?.ttsApiKeys?.elevenlabs),
      minimax: asSecretString(value?.ttsApiKeys?.minimax),
    },
  };
}

function extractDeviceSecrets(state) {
  const apiPresetKeys = {};
  const presets = Array.isArray(state?.apiPresets) ? state.apiPresets : [];
  presets.forEach((preset, index) => {
    apiPresetKeys[presetSecretKey(preset, index)] = asSecretString(preset?.apiKey);
  });
  return normalizeDeviceSecrets({
    apiKey: state?.apiConfig?.apiKey,
    openRouterManagementKey: state?.apiConfig?.openRouterManagementKey,
    apiPresetKeys,
    ttsApiKeys: {
      elevenlabs: state?.ttsConfig?.elevenlabs?.apiKey,
      minimax: state?.ttsConfig?.minimax?.apiKey,
    },
  });
}

function stripDeviceSecrets(state) {
  if (!state || typeof state !== "object") return state;
  const next = { ...state };
  if (state.apiConfig && typeof state.apiConfig === "object") {
    next.apiConfig = { ...state.apiConfig, apiKey: "", openRouterManagementKey: "" };
  }
  if (Array.isArray(state.apiPresets)) {
    next.apiPresets = state.apiPresets.map((preset) => (
      preset && typeof preset === "object" ? { ...preset, apiKey: "" } : preset
    ));
  }
  if (state.ttsConfig && typeof state.ttsConfig === "object") {
    next.ttsConfig = { ...state.ttsConfig };
    for (const provider of ["elevenlabs", "minimax"]) {
      if (state.ttsConfig[provider] && typeof state.ttsConfig[provider] === "object") {
        next.ttsConfig[provider] = { ...state.ttsConfig[provider], apiKey: "" };
      }
    }
  }
  return next;
}

function hydrateDeviceSecrets(state, secrets) {
  const next = stripDeviceSecrets(state);
  if (!next || typeof next !== "object") return next;
  const normalized = normalizeDeviceSecrets(secrets);
  if (next.apiConfig && typeof next.apiConfig === "object") {
    next.apiConfig = {
      ...next.apiConfig,
      apiKey: normalized.apiKey,
      openRouterManagementKey: normalized.openRouterManagementKey,
    };
  }
  if (Array.isArray(next.apiPresets)) {
    next.apiPresets = next.apiPresets.map((preset, index) => {
      if (!preset || typeof preset !== "object") return preset;
      return {
        ...preset,
        apiKey: normalized.apiPresetKeys[presetSecretKey(preset, index)] || "",
      };
    });
  }
  if (next.ttsConfig && typeof next.ttsConfig === "object") {
    next.ttsConfig = { ...next.ttsConfig };
    for (const provider of ["elevenlabs", "minimax"]) {
      if (next.ttsConfig[provider] && typeof next.ttsConfig[provider] === "object") {
        next.ttsConfig[provider] = {
          ...next.ttsConfig[provider],
          apiKey: normalized.ttsApiKeys[provider] || "",
        };
      }
    }
  }
  return next;
}

function mergeDeviceSecrets(stored, legacy) {
  const fallback = normalizeDeviceSecrets(legacy);
  if (!stored || typeof stored !== "object") return fallback;
  const storedPresetKeys = stored.apiPresetKeys && typeof stored.apiPresetKeys === "object"
    ? stored.apiPresetKeys
    : {};
  const storedTtsKeys = stored.ttsApiKeys && typeof stored.ttsApiKeys === "object"
    ? stored.ttsApiKeys
    : {};
  const apiPresetKeys = { ...fallback.apiPresetKeys };
  for (const [key, value] of Object.entries(storedPresetKeys)) {
    if (!key) continue;
    const storedValue = asSecretString(value);
    // 1.2.7 初次啟動可能先建立一份空的裝置密鑰，再讀到仍含 Key 的
    // 舊資料。空白占位不可蓋掉可復原的舊 Key。
    if (storedValue || !apiPresetKeys[key]) apiPresetKeys[key] = storedValue;
  }
  const storedApiKey = asSecretString(stored.apiKey);
  const storedOpenRouterManagementKey = asSecretString(stored.openRouterManagementKey);
  const storedElevenlabsKey = asSecretString(storedTtsKeys.elevenlabs);
  const storedMinimaxKey = asSecretString(storedTtsKeys.minimax);
  return normalizeDeviceSecrets({
    apiKey: hasOwn(stored, "apiKey") && (storedApiKey || !fallback.apiKey)
      ? storedApiKey
      : fallback.apiKey,
    openRouterManagementKey: hasOwn(stored, "openRouterManagementKey") && (storedOpenRouterManagementKey || !fallback.openRouterManagementKey)
      ? storedOpenRouterManagementKey
      : fallback.openRouterManagementKey,
    apiPresetKeys,
    ttsApiKeys: {
      elevenlabs: hasOwn(storedTtsKeys, "elevenlabs") && (storedElevenlabsKey || !fallback.ttsApiKeys.elevenlabs)
        ? storedElevenlabsKey
        : fallback.ttsApiKeys.elevenlabs,
      minimax: hasOwn(storedTtsKeys, "minimax") && (storedMinimaxKey || !fallback.ttsApiKeys.minimax)
        ? storedMinimaxKey
        : fallback.ttsApiKeys.minimax,
    },
  });
}

function preserveMissingDeviceSecrets(state, fallbackState) {
  const secrets = mergeDeviceSecrets(
    extractDeviceSecrets(state),
    extractDeviceSecrets(fallbackState),
  );
  return hydrateDeviceSecrets(stripDeviceSecrets(state), secrets);
}

function deviceSecretsEqual(left, right) {
  const a = normalizeDeviceSecrets(left);
  const b = normalizeDeviceSecrets(right);
  const aPresetKeys = Object.keys(a.apiPresetKeys).sort();
  const bPresetKeys = Object.keys(b.apiPresetKeys).sort();
  return a.apiKey === b.apiKey
    && a.openRouterManagementKey === b.openRouterManagementKey
    && a.ttsApiKeys.elevenlabs === b.ttsApiKeys.elevenlabs
    && a.ttsApiKeys.minimax === b.ttsApiKeys.minimax
    && aPresetKeys.length === bPresetKeys.length
    && aPresetKeys.every((key, index) => (
      key === bPresetKeys[index] && a.apiPresetKeys[key] === b.apiPresetKeys[key]
    ));
}

export {
  EMPTY_DEVICE_SECRETS,
  DEVICE_SECRETS_VERSION,
  deviceSecretsEqual,
  extractDeviceSecrets,
  hydrateDeviceSecrets,
  mergeDeviceSecrets,
  normalizeDeviceSecrets,
  preserveMissingDeviceSecrets,
  stripDeviceSecrets,
};
