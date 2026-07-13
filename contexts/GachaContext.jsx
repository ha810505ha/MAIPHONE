import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadGachaEpisodes, deleteLegacyGachaDatabase } from "../services/gacha/gachaEpisodeStorage";
import { loadFeatureEntity, saveFeatureEntity } from "../utils/indexedDbStorage";
import { DEFAULT_GACHA_POOL_ID, getGachaPool, getGachaPoolCards } from "../data/gacha/cardPools";

export const GACHA_POOL = getGachaPoolCards(DEFAULT_GACHA_POOL_ID);
const KEYS = { inventory: "sakura-gacha-inventory-v1", crystals: "sakura-gacha-crystals-v1", episodes: "sakura-gacha-episodes-v1" };
const DB_KEYS = { inventory: "ent_gachaInventory", episodes: "ent_gachaEpisodes", crystals: "ent_gachaCurrency", progress: "ent_gachaProgress" };
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
  const [crystals, setCrystals] = useState(() => Number(localStorage.getItem(KEYS.crystals)) || 18000);
  const [episodes, setEpisodes] = useState(() => read(KEYS.episodes, []));
  const [gachaProgress, setGachaProgress] = useState(() => ({ totalDrawCount: 0, drawsSinceLastSSR: 0 }));
  const [gachaHydrated, setGachaHydrated] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadFeatureEntity(DB_KEYS.inventory, null),
      loadFeatureEntity(DB_KEYS.episodes, null),
      loadFeatureEntity(DB_KEYS.crystals, null),
      loadFeatureEntity(DB_KEYS.progress, null),
      loadGachaEpisodes().catch(() => null),
    ]).then(async ([dbInventory, dbEpisodes, dbCrystals, dbProgress, legacyDbEpisodes]) => {
      if (cancelled) return;
      const legacyInventory = read(KEYS.inventory, []);
      const legacyEpisodes = read(KEYS.episodes, []);
      const initialInventory = Array.isArray(dbInventory) ? dbInventory : legacyInventory;
      const initialEpisodes = Array.isArray(dbEpisodes) ? dbEpisodes : (Array.isArray(legacyDbEpisodes) ? legacyDbEpisodes : legacyEpisodes);
      const legacyCrystalRaw = localStorage.getItem(KEYS.crystals);
      const legacyCrystals = legacyCrystalRaw === null ? null : Number(legacyCrystalRaw);
      const hasDbCrystals = dbCrystals !== null && Number.isFinite(Number(dbCrystals));
      let initialCrystals = hasDbCrystals ? Number(dbCrystals) : (legacyCrystals !== null && Number.isFinite(legacyCrystals) && legacyCrystals >= 0 ? legacyCrystals : 18000);
      const initialProgress = dbProgress && typeof dbProgress === "object" ? {
        totalDrawCount: Math.max(0, Number(dbProgress.totalDrawCount) || 0),
        drawsSinceLastSSR: Math.min(59, Math.max(0, Number(dbProgress.drawsSinceLastSSR) || 0)),
      } : { totalDrawCount: 0, drawsSinceLastSSR: 0 };
      // 之前的 100,000 測試預設值只用於早期測試；目前改為送出 100 抽的 18,000。
      if (initialCrystals === 100000) initialCrystals = 18000;
      setInventory(initialInventory);
      setEpisodes(initialEpisodes);
      setCrystals(initialCrystals);
      setGachaProgress(initialProgress);
      if (!Array.isArray(dbInventory)) await saveFeatureEntity(DB_KEYS.inventory, initialInventory);
      if (!Array.isArray(dbEpisodes)) await saveFeatureEntity(DB_KEYS.episodes, initialEpisodes);
      if (!hasDbCrystals) await saveFeatureEntity(DB_KEYS.crystals, initialCrystals);
      if (!dbProgress || typeof dbProgress !== "object") await saveFeatureEntity(DB_KEYS.progress, initialProgress);
      try { localStorage.removeItem(KEYS.inventory); localStorage.removeItem(KEYS.episodes); localStorage.removeItem(KEYS.crystals); } catch (_) {}
      deleteLegacyGachaDatabase();
      if (!cancelled) setGachaHydrated(true);
    }).catch((error) => {
      console.warn("[gacha] 抽卡資料載入失敗，暫時使用舊資料", error);
      if (!cancelled) setGachaHydrated(true);
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
    saveFeatureEntity(DB_KEYS.crystals, crystals).catch((error) => console.error("[gacha] 結晶保存失敗", error));
  }, [crystals, gachaHydrated]);
  useEffect(() => {
    if (!gachaHydrated) return;
    saveFeatureEntity(DB_KEYS.progress, gachaProgress).catch((error) => console.error("[gacha] 抽卡進度保存失敗", error));
  }, [gachaProgress, gachaHydrated]);
  useEffect(() => {
    const reload = () => Promise.all([
      loadFeatureEntity(DB_KEYS.inventory, []),
      loadFeatureEntity(DB_KEYS.episodes, []),
      loadFeatureEntity(DB_KEYS.crystals, 0),
      loadFeatureEntity(DB_KEYS.progress, { totalDrawCount: 0, drawsSinceLastSSR: 0 }),
    ]).then(([nextInventory, nextEpisodes, nextCrystals, nextProgress]) => {
      setInventory(Array.isArray(nextInventory) ? nextInventory : []);
      setEpisodes(Array.isArray(nextEpisodes) ? nextEpisodes : []);
      setCrystals(Math.max(0, Number(nextCrystals) || 0));
      if (nextProgress && typeof nextProgress === "object") setGachaProgress({ totalDrawCount: Math.max(0, Number(nextProgress.totalDrawCount) || 0), drawsSinceLastSSR: Math.min(59, Math.max(0, Number(nextProgress.drawsSinceLastSSR) || 0)) });
    }).catch((error) => console.warn("[gacha] 重新載入資料失敗", error));
    window.addEventListener("gacha-storage-updated", reload);
    return () => window.removeEventListener("gacha-storage-updated", reload);
  }, []);
  const value = useMemo(() => ({
    inventory, crystals, episodes, gachaProgress, selectedEpisodeId, setSelectedEpisodeId,
    changeCrystals(amount) {
      const delta = Number(amount) || 0;
      setCrystals((current) => Math.max(0, current + delta));
    },
    draw(count) {
      const cost = count === 10 ? 1800 : 180;
      if (crystals < cost) return null;
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
      setCrystals((current) => current - cost);
      setGachaProgress(nextProgress);
      setInventory((items) => [...results, ...items].slice(0, 120));
      return results;
    },
    startEpisode({ itemUid, characterId, characterName, characterAvatar, mode }) {
      const activeEpisode = episodes.find((episode) => String(episode.characterId) === String(characterId) && episode.status === "active");
      if (activeEpisode) {
        setSelectedEpisodeId(activeEpisode.id);
        window.alert(`與 ${characterName || activeEpisode.characterName} 的特別篇仍在進行中，將返回目前劇情。`);
        return activeEpisode;
      }
      const owned = inventory.find((item) => item.uid === itemUid);
      if (!owned) return null;
      const id = `episode-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const episode = { id, item: owned, characterId, characterName, characterAvatar, mode, status: "active", openingStatus: "pending", playerMessageCount: 0, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
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
  }), [inventory, crystals, episodes, selectedEpisodeId]);
  return <GachaContext.Provider value={value}>{children}</GachaContext.Provider>;
}
export function useGacha() { const value = useContext(GachaContext); if (!value) throw new Error("useGacha must be used inside GachaProvider"); return value; }
