import { useCallback, useState } from "react";
import {
  createEmptyPersonaData,
  createPersonaId,
  MAX_PERSONAS,
  normalizePersonaCollection,
} from "../../services/persona/personaModel.js";
import { setActivePersonaStorageId } from "../../services/persona/personaStorageScope.js";
import { dispatchFeatureDataChanged } from "../../services/featureDataLifecycle";

const PERSONA_FEATURE_KEYS = ["ent_coupleDaily", "ent_dating"];

export default function usePersonaController({ defaults, onApplyPersona, onBeforeSwitch }) {
  const [personas, setPersonas] = useState({});
  const [activePersonaId, setActivePersonaId] = useState(null);

  const hydratePersonas = useCallback((state) => {
    const normalized = normalizePersonaCollection(state, defaults);
    setPersonas(normalized.personas);
    setActivePersonaId(normalized.activePersonaId);
    setActivePersonaStorageId(normalized.activePersonaId);
    return normalized;
  }, [defaults]);

  const switchPersona = useCallback(async (personaId, captureCurrent, options = {}) => {
    const targetId = String(personaId || "");
    if (!targetId || targetId === activePersonaId || !personas[targetId]) return false;
    await onBeforeSwitch?.();
    const currentData = captureCurrent();
    const currentName = String(currentData?.playerProfile?.name || "").trim();
    const nextPersonas = {
      ...personas,
      ...(activePersonaId && personas[activePersonaId]
        ? {
            [activePersonaId]: {
              ...personas[activePersonaId],
              label: currentName || personas[activePersonaId].label,
              data: currentData,
            },
          }
        : {}),
    };
    setPersonas(nextPersonas);
    setActivePersonaStorageId(targetId);
    setActivePersonaId(targetId);
    onApplyPersona(nextPersonas[targetId].data, options);
    dispatchFeatureDataChanged(PERSONA_FEATURE_KEYS, "persona-switch");
    return true;
  }, [activePersonaId, onApplyPersona, onBeforeSwitch, personas]);

  const createPersona = useCallback((label, profile = {}) => {
    if (Object.keys(personas).length >= MAX_PERSONAS) return null;
    const id = createPersonaId();
    const data = createEmptyPersonaData(defaults, profile);
    const item = {
      id,
      label: String(label || profile.name || "新人格").trim() || "新人格",
      createdAt: Date.now(),
      data,
    };
    setPersonas((current) => (
      Object.keys(current).length >= MAX_PERSONAS
        ? current
        : { ...current, [id]: item }
    ));
    return id;
  }, [defaults, personas]);

  const deletePersona = useCallback(async (personaId) => {
    if (!personas[personaId] || Object.keys(personas).length <= 1) return false;
    if (personaId === activePersonaId) {
      await onBeforeSwitch?.();
      const nextPersona = Object.values(personas).find((item) => item.id !== personaId);
      if (!nextPersona) return false;
      setActivePersonaStorageId(nextPersona.id);
      setActivePersonaId(nextPersona.id);
      onApplyPersona(nextPersona.data);
      dispatchFeatureDataChanged(PERSONA_FEATURE_KEYS, "persona-delete");
    }
    setPersonas((current) => {
      const next = { ...current };
      delete next[personaId];
      return next;
    });
    return true;
  }, [activePersonaId, onApplyPersona, onBeforeSwitch, personas]);

  const resetPersonas = useCallback((state = {}) => {
    const normalized = normalizePersonaCollection(state, defaults);
    setPersonas(normalized.personas);
    setActivePersonaId(normalized.activePersonaId);
    setActivePersonaStorageId(normalized.activePersonaId);
    dispatchFeatureDataChanged(PERSONA_FEATURE_KEYS, "persona-reset");
    return normalized;
  }, [defaults]);

  return {
    activePersonaId,
    createPersona,
    deletePersona,
    hydratePersonas,
    maxPersonas: MAX_PERSONAS,
    personas,
    resetPersonas,
    setActivePersonaId,
    switchPersona,
  };
}
