import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadGachaEpisodes, deleteLegacyGachaDatabase } from "../services/gacha/gachaEpisodeStorage";
import { loadFeatureEntity, saveFeatureEntities, saveFeatureEntity } from "../utils/indexedDbStorage";
import { DEFAULT_GACHA_POOL_ID, getGachaPool, getGachaPoolCards } from "../data/gacha/cardPools";
import { compactGachaEpisodeImages } from "../utils/persistedMediaCleanup";
import { applyCrystalTransaction, createInitialCrystalLedger, normalizeCrystalLedger } from "../utils/crystalLedger";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "../services/featureDataLifecycle";
import { getActivePersonaStorageId } from "../services/persona/personaStorageScope.js";
import { DEFAULT_PERSONA_ID } from "../services/persona/personaModel.js";

export const GACHA_POOL = getGachaPoolCards(DEFAULT_GACHA_POOL_ID);
const KEYS = { inventory: "sakura-gacha-inventory-v1", crystals: "sakura-gacha-crystals-v1", episodes: "sakura-gacha-episodes-v1" };
const DB_KEYS = { inventory: "ent_gachaInventory", episodes: "ent_gachaEpisodes", crystals: "ent_gachaCurrency", crystalLedger: "ent_gachaCrystalLedger", progress: "ent_gachaProgress", specialMemories: "ent_gachaSpecialMemories" };
const GACHA_ENTITY_KEYS = Object.values(DB_KEYS);
const DEFAULT_CRYSTALS = 0;
const GachaContext = createContext(null);
const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; } };
const drawOne = (progress = { drawsSinceLastSSR: 0 }) => {
  const roll = Math.random() * 100;
  const rates = getGachaPool(DEFAULT_GACHA_POOL_ID)?.rates || { SSR: 4, SR: 26, R: 70 };
  const drawsSinceLastSSR = Math.max(0, Number(progress.drawsSinceLastSSR) || 0);
  const ssrRate = drawsSinceLastSSR >= 59 ? 100 : drawsSinceLastSSR >= 50 ? Math.min(100, rates.SSR + (drawsSinceLastSSR - 49) * 10) : rates.SSR;
  const rarity = roll < ssrRate ? "SSR" : roll < ssrRate + rates.SR ? "SR" : "R";
  const candidates = GACHA_POOL.filter((item) => item.rarity === rarity);
  return candidates[Math.floor(Math.random() * candidates.length)] || GACHA_POOL[0];
};

export function GachaProvider({ children }) {
  const [inventory, setInventory] = useState(() => read(KEYS.inventory, []));
  const [crystalAccount, setCrystalAccount] = useState(() => ({
    balance: Number(localStorage.getItem(KEYS.crystals)) || DEFAULT_CRYSTALS,
    ledger: [],
  }));
  const crystalAccountRef = useRef(crystalAccount);
  const crystals = crystalAccount.balance;
  const [episodes, setEpisodes] = useState(() => read(KEYS.episodes, []));
  const [specialMemories, setSpecialMemories] = useState([]);
  const [gachaProgress, setGachaProgress] = useState(() => ({ totalDrawCount: 0, drawsSinceLastSSR: 0 }));
  const [gachaHydrated, setGachaHydrated] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  const [activePersonaId, setActivePersonaId] = useState(getActivePersonaStorageId);
  useEffect(() => {
    const refreshPersona = (event) => {
      if (event?.detail?.reason?.startsWith("persona-")) {
        setActivePersonaId(getActivePersonaStorageId());
        setSelectedEpisodeId(null);
      }
    };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, refreshPersona);
    return () => window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, refreshPersona);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadFeatureEntity(DB_KEYS.inventory, null),
      loadFeatureEntity(DB_KEYS.episodes, null),
      loadFeatureEntity(DB_KEYS.crystals, null),
      loadFeatureEntity(DB_KEYS.crystalLedger, null),
      loadFeatureEntity(DB_KEYS.progress, null),
      loadFeatureEntity(DB_KEYS.specialMemories, null),
      loadGachaEpisodes().catch(() => null),
    ]).then(async ([dbInventory, dbEpisodes, dbCrystals, dbCrystalLedger, dbProgress, dbSpecialMemories, legacyDbEpisodes]) => {
      if (cancelled) return;
      const legacyInventory = read(KEYS.inventory, []);
      const legacyEpisodes = read(KEYS.episodes, []);
      const initialInventory = Array.isArray(dbInventory) ? dbInventory : legacyInventory;
      const initialEpisodes = Array.isArray(dbEpisodes) ? dbEpisodes : (Array.isArray(legacyDbEpisodes) ? legacyDbEpisodes : legacyEpisodes);
      const legacyCrystalRaw = localStorage.getItem(KEYS.crystals);
      const legacyCrystals = legacyCrystalRaw === null ? null : Number(legacyCrystalRaw);
      const hasDbCrystals = dbCrystals !== null && Number.isFinite(Number(dbCrystals));
      let initialCrystals = hasDbCrystals ? Number(dbCrystals) : (legacyCrystals !== null && Number.isFinite(legacyCrystals) && legacyCrystals >= 0 ? legacyCrystals : DEFAULT_CRYSTALS);
      const normalizedLedger = normalizeCrystalLedger(dbCrystalLedger);
      const hasDbCrystalLedger = normalizedLedger.length > 0;
      const initialCrystalLedger = hasDbCrystalLedger ? normalizedLedger : createInitialCrystalLedger(initialCrystals);
      const initialProgress = dbProgress && typeof dbProgress === "object" ? {
        totalDrawCount: Math.max(0, Number(dbProgress.totalDrawCount) || 0),
        drawsSinceLastSSR: Math.min(59, Math.max(0, Number(dbProgress.drawsSinceLastSSR) || 0)),
      } : { totalDrawCount: 0, drawsSinceLastSSR: 0 };
      // 測試結晶改由系統信箱單次發放；既有玩家餘額保持原值。
      setInventory(initialInventory);
      setEpisodes(initialEpisodes);
      setSpecialMemories(Array.isArray(dbSpecialMemories) ? dbSpecialMemories : []);
      const initialCrystalAccount = { balance: Math.max(0, Math.round(initialCrystals)), ledger: initialCrystalLedger };
      crystalAccountRef.current = initialCrystalAccount;
      setCrystalAccount(initialCrystalAccount);
      setGachaProgress(initialProgress);
      if (!Array.isArray(dbInventory)) await saveFeatureEntity(DB_KEYS.inventory, initialInventory);
      if (!Array.isArray(dbEpisodes)) await saveFeatureEntity(DB_KEYS.episodes, initialEpisodes);
      if (!hasDbCrystals) await saveFeatureEntity(DB_KEYS.crystals, initialCrystals);
      if (!hasDbCrystalLedger) await saveFeatureEntity(DB_KEYS.crystalLedger, initialCrystalLedger);
      if (!dbProgress || typeof dbProgress !== "object") await saveFeatureEntity(DB_KEYS.progress, initialProgress);
      try { localStorage.removeItem(KEYS.inventory); localStorage.removeItem(KEYS.episodes); localStorage.removeItem(KEYS.crystals); } catch (_) {}
      deleteLegacyGachaDatabase();
      if (!cancelled) setGachaHydrated(true);
    }).catch((error) => {
      console.warn("[gacha] 抽卡資料載入失敗，暫時使用舊資料", error);
      if (cancelled) return;
      const fallbackAccount = crystalAccountRef.current.ledger.length
        ? crystalAccountRef.current
        : { ...crystalAccountRef.current, ledger: createInitialCrystalLedger(crystalAccountRef.current.balance) };
      crystalAccountRef.current = fallbackAccount;
      setCrystalAccount(fallbackAccount);
      setGachaHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!gachaHydrated) return;
    saveFeatureEntity(DB_KEYS.inventory, inventory).catch((error) => console.error("[gacha] 珍藏保存失敗", error));
  }, [inventory, gachaHydrated]);
  useEffect(() => {
    if (!gachaHydrated) return;
    saveFeatureEntity(DB_KEYS.episodes, episodes).catch((error) => console.error("[gacha] 特別篇保存失敗", error));
  }, [episodes, gachaHydrated]);
  useEffect(() => {
    if (!gachaHydrated) return;
    saveFeatureEntities([
      [DB_KEYS.crystals, crystalAccount.balance],
      [DB_KEYS.crystalLedger, crystalAccount.ledger],
    ]).catch((error) => console.error("[gacha] 結晶帳本保存失敗", error));
  }, [crystalAccount, gachaHydrated]);
  useEffect(() => {
    if (!gachaHydrated) return;
    saveFeatureEntity(DB_KEYS.progress, gachaProgress).catch((error) => console.error("[gacha] 抽卡進度保存失敗", error));
  }, [gachaProgress, gachaHydrated]);
  useEffect(() => {
    if (!gachaHydrated) return;
    saveFeatureEntity(DB_KEYS.specialMemories, specialMemories).catch((error) => console.error("[gacha] 特別記憶保存失敗", error));
  }, [specialMemories, gachaHydrated]);
  useEffect(() => {
    const reload = () => Promise.all([
      loadFeatureEntity(DB_KEYS.inventory, []),
      loadFeatureEntity(DB_KEYS.episodes, []),
      loadFeatureEntity(DB_KEYS.crystals, 0),
      loadFeatureEntity(DB_KEYS.crystalLedger, null),
      loadFeatureEntity(DB_KEYS.progress, { totalDrawCount: 0, drawsSinceLastSSR: 0 }),
      loadFeatureEntity(DB_KEYS.specialMemories, []),
    ]).then(([nextInventory, nextEpisodes, nextCrystals, nextCrystalLedger, nextProgress, nextSpecialMemories]) => {
      setInventory(Array.isArray(nextInventory) ? nextInventory : []);
      setEpisodes(Array.isArray(nextEpisodes) ? nextEpisodes : []);
      setSpecialMemories(Array.isArray(nextSpecialMemories) ? nextSpecialMemories : []);
      const nextBalance = Math.max(0, Math.round(Number(nextCrystals) || 0));
      const normalizedLedger = normalizeCrystalLedger(nextCrystalLedger);
      const nextAccount = { balance: nextBalance, ledger: normalizedLedger.length ? normalizedLedger : createInitialCrystalLedger(nextBalance) };
      crystalAccountRef.current = nextAccount;
      setCrystalAccount(nextAccount);
      if (nextProgress && typeof nextProgress === "object") setGachaProgress({ totalDrawCount: Math.max(0, Number(nextProgress.totalDrawCount) || 0), drawsSinceLastSSR: Math.min(59, Math.max(0, Number(nextProgress.drawsSinceLastSSR) || 0)) });
    }).catch((error) => console.warn("[gacha] 重新載入資料失敗", error));
    const onFeatureDataChanged = (event) => {
      if (featureDataEventIncludes(event, GACHA_ENTITY_KEYS)) void reload();
    };
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    return () => window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
  }, []);
  const changeCrystals = useCallback((amount, details = {}) => {
    const result = applyCrystalTransaction(crystalAccountRef.current, amount, details);
    if (!result.transaction) return null;
    crystalAccountRef.current = result.account;
    setCrystalAccount(result.account);
    return result.transaction;
  }, []);
  const visibleForPersona = (item) => item?.personaId
    ? item.personaId === activePersonaId
    : activePersonaId === DEFAULT_PERSONA_ID;
  const personaEpisodes = episodes.filter(visibleForPersona);
  const personaSpecialMemories = specialMemories.filter(visibleForPersona);
  const value = useMemo(() => ({
    inventory, crystals, crystalLedger: crystalAccount.ledger, crystalLedgerReady: gachaHydrated, episodes: personaEpisodes, gachaProgress, specialMemories: personaSpecialMemories, selectedEpisodeId, setSelectedEpisodeId,
    changeCrystals,
    draw(count) {
      const cost = count === 10 ? 1800 : 180;
      if (crystalAccountRef.current.balance < cost) return null;
      const now = Date.now();
      let nextProgress = { ...gachaProgress };
      const results = Array.from({ length: count }, (_, index) => {
        const card = drawOne(nextProgress);
        const wasSSR = card.rarity === "SSR";
        nextProgress = { totalDrawCount: nextProgress.totalDrawCount + 1, drawsSinceLastSSR: wasSSR ? 0 : Math.min(59, nextProgress.drawsSinceLastSSR + 1) };
        return { ...card, uid: `${now}-${index}-${Math.random().toString(36).slice(2)}`, unlockedAt: now };
      });
      if (count === 10 && !results.some((item) => item.rarity === "SSR" || item.rarity === "SR")) {
        const srCandidates = GACHA_POOL.filter((item) => item.rarity === "SR");
        const promoted = srCandidates[Math.floor(Math.random() * srCandidates.length)];
        if (promoted) results[results.length - 1] = { ...promoted, uid: `${now}-sr-guarantee-${Math.random().toString(36).slice(2)}`, unlockedAt: now };
      }
      if (!changeCrystals(-cost, {
        source: "gacha",
        note: count === 10 ? "櫻色誓約・十連召喚" : "櫻色誓約・單次召喚",
      })) return null;
      setGachaProgress(nextProgress);
      setInventory((items) => [...results, ...items].slice(0, 120));
      return results;
    },
    compactEpisodeImages(characters) {
      setEpisodes((items) => compactGachaEpisodeImages(items, characters));
    },
    startEpisode({ itemUid, characterId, characterName, mode }) {
      const activeEpisode = personaEpisodes.find((episode) => String(episode.characterId) === String(characterId) && episode.status === "active");
      if (activeEpisode) {
        setSelectedEpisodeId(activeEpisode.id);
        window.alert(`與 ${characterName || activeEpisode.characterName} 的特別篇仍在進行中，將返回目前劇情。`);
        return activeEpisode;
      }
      const owned = inventory.find((item) => item.uid === itemUid);
      if (!owned) return null;
      const id = `episode-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const episode = { id, item: owned, characterId, characterName, personaId: activePersonaId, mode, replyTiming: "instant", status: "active", openingStatus: "pending", playerMessageCount: 0, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      setInventory((items) => items.filter((item) => item.uid !== itemUid));
      setEpisodes((items) => [episode, ...items]);
      setSelectedEpisodeId(id);
      return episode;
    },
    sendEpisodeMessage(episodeId, content) {
      const text = String(content || "").trim();
      if (!text) return;
      setEpisodes((items) => items.map((episode) => episode.id !== episodeId || episode.playerMessageCount >= 20 ? episode : { ...episode, playerMessageCount: episode.playerMessageCount + 1, updatedAt: Date.now(), messages: [...episode.messages, { id: `${episodeId}-${Date.now()}`, role: "user", content: text, time: Date.now() }] }));
    },
    queueEpisodeMessage(episodeId, content) {
      const text = String(content || "").trim();
      if (!text) return;
      const now = Date.now();
      setEpisodes((items) => items.map((episode) => episode.id !== episodeId || episode.playerMessageCount >= 20 ? episode : {
        ...episode,
        updatedAt: now,
        messages: [...episode.messages, { id: `${episodeId}-queued-${now}-${Math.random().toString(36).slice(2, 7)}`, role: "user", content: text, batchPending: true, time: now }],
      }));
    },
    commitEpisodeTurn(episodeId) {
      const now = Date.now();
      setEpisodes((items) => items.map((episode) => episode.id !== episodeId || episode.playerMessageCount >= 20 ? episode : {
        ...episode,
        playerMessageCount: episode.playerMessageCount + 1,
        updatedAt: now,
        messages: episode.messages.map((message) => message.batchPending ? { ...message, batchPending: false } : message),
      }));
    },
    setEpisodeReplyTiming(episodeId, timing) {
      if (!["instant", "batch"].includes(timing)) return;
      setEpisodes((items) => items.map((episode) => episode.id !== episodeId ? episode : { ...episode, replyTiming: timing, updatedAt: Date.now() }));
    },
    appendEpisodeAssistantMessage(episodeId, content) {
      const text = String(content || "").trim();
      if (!text) return;
      setEpisodes((items) => items.map((episode) => episode.id !== episodeId ? episode : { ...episode, updatedAt: Date.now(), messages: [...episode.messages, { id: `${episodeId}-ai-${Date.now()}`, role: "assistant", content: text, time: Date.now() }] }));
    },
    setEpisodeOpening(episodeId, opening) {
      const narrator = String(opening?.narration || "").trim();
      const characterOpening = String(opening?.characterOpening || "").trim();
      setEpisodes((items) => items.map((episode) => episode.id !== episodeId ? episode : {
        ...episode,
        openingStatus: "ready",
        updatedAt: Date.now(),
        messages: [
          ...(narrator ? [{ id: `${episodeId}-narrator`, role: "narrator", content: narrator, time: Date.now() }] : []),
          ...(characterOpening ? [{ id: `${episodeId}-opening`, role: "assistant", content: characterOpening, time: Date.now() + 1 }] : []),
          ...episode.messages.filter((message) => ![`${episodeId}-narrator`, `${episodeId}-opening`].includes(message.id)),
        ],
      }));
    },
    endEpisode(episodeId, endedEarly = false) {
      const now = Date.now();
      setEpisodes((items) => items.map((episode) => episode.id !== episodeId ? episode : { ...episode, status: "completed", endedEarly: !!endedEarly, completedAt: now, updatedAt: now }));
    },
    addSpecialMemory({ episodeId, title, text, summary, monologue }) {
      const episode = episodes.find((item) => item.id === episodeId);
      if (!episode || episode.status === "active") return null;
      const existing = specialMemories.find((memory) => memory.episodeId === episodeId);
      if (existing) return existing;
      const now = Date.now();
      const memory = {
        id: `special-memory-${now}-${Math.random().toString(36).slice(2, 7)}`,
        episodeId,
        characterId: episode.characterId,
        characterName: episode.characterName,
        personaId: episode.personaId || DEFAULT_PERSONA_ID,
        itemId: episode.item?.id || "",
        itemName: episode.item?.name || "心意",
        itemIcon: episode.item?.icon || "🌸",
        itemRarity: episode.item?.rarity || "R",
        mode: episode.mode,
        title: String(title || "").trim().slice(0, 20) || (episode.item?.name || "特別的回憶"),
        text: String(text || "").trim().slice(0, 300),
        summary: String(summary || "").trim().slice(0, 240),
        monologue: String(monologue || "").trim().slice(0, 200),
        pinned: false,
        createdAt: now,
      };
      if (!memory.text) return null;
      setSpecialMemories((items) => [memory, ...items]);
      setEpisodes((items) => items.map((item) => item.id !== episodeId ? item : { ...item, specialMemoryId: memory.id, updatedAt: now }));
      return memory;
    },
    toggleSpecialMemoryPin(memoryId) {
      const target = specialMemories.find((memory) => memory.id === memoryId);
      if (!target) return { ok: false, reason: "not-found" };
      if (!target.pinned) {
        const pinnedCount = specialMemories.filter((memory) => memory.pinned && String(memory.characterId) === String(target.characterId)).length;
        if (pinnedCount >= 3) return { ok: false, reason: "limit" };
      }
      setSpecialMemories((items) => items.map((memory) => memory.id !== memoryId ? memory : { ...memory, pinned: !memory.pinned }));
      return { ok: true, pinned: !target.pinned };
    },
    deleteSpecialMemory(memoryId) {
      const target = specialMemories.find((memory) => memory.id === memoryId);
      setSpecialMemories((items) => items.filter((memory) => memory.id !== memoryId));
      if (target) setEpisodes((items) => items.map((episode) => episode.specialMemoryId !== memoryId ? episode : { ...episode, specialMemoryId: null, updatedAt: Date.now() }));
    },
  }), [inventory, crystals, crystalAccount.ledger, gachaHydrated, episodes, personaEpisodes, gachaProgress, specialMemories, personaSpecialMemories, selectedEpisodeId, changeCrystals, activePersonaId]);
  return <GachaContext.Provider value={value}>{children}</GachaContext.Provider>;
}
export function useGacha() { const value = useContext(GachaContext); if (!value) throw new Error("useGacha must be used inside GachaProvider"); return value; }
