import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadFeatureEntity, saveFeatureEntity } from "../utils/indexedDbStorage";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "../services/featureDataLifecycle";
import * as yt from "../services/music/youtubeProvider";
import * as sp from "../services/music/spotifyProvider";

const MusicPlayerContext = createContext(null);
const FLOAT_KEY = "ent_musicPlayer";
const DEFAULT_FLOAT_STATE = { mode: "ball", side: "right", y: 420 };

export async function resolveTrackFromUrl(url) {
  const text = String(url || "").trim();
  if (/youtu\.?be/.test(text)) return yt.trackFromUrl(text);
  if (/open\.spotify\.com/.test(text)) return sp.trackFromUrl(text);
  return null;
}

export function MusicPlayerProvider({ children }) {
  const [track, setTrack] = useState(null); // {id,title,artist,source:'yt'|'sp',artworkUrl}
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [queue, setQueue] = useState([]);
  const [charPicks, setCharPicks] = useState([]); // [{title, artist, reason, characterName}]
  const [charReaction, setCharReaction] = useState(null); // {text, characterName, ts}
  const [floatState, setFloatState] = useState(DEFAULT_FLOAT_STATE);
  const [loopMode, setLoopMode] = useState("off"); // off → list → single
  const providerRef = useRef(null);
  const playGenerationRef = useRef(0);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const trackRef = useRef(track);
  trackRef.current = track;
  const loopModeRef = useRef(loopMode);
  loopModeRef.current = loopMode;
  const historyRef = useRef([]); // 本次會話播過的歌（去重），供列表循環回繞
  const floatRef = useRef(floatState);
  floatRef.current = floatState;

  useEffect(() => {
    let active = true;
    const reload = async (reason = "load") => {
      const saved = await loadFeatureEntity(FLOAT_KEY, null).catch(() => null);
      if (!active) return;
      const nextFloat = saved && typeof saved === "object"
        ? {
            ...DEFAULT_FLOAT_STATE,
            side: saved.side === "left" ? "left" : "right",
            y: Number.isFinite(Number(saved.y)) ? Number(saved.y) : DEFAULT_FLOAT_STATE.y,
          }
        : DEFAULT_FLOAT_STATE;
      setFloatState(nextFloat);
      setLoopMode(["off", "list", "single"].includes(saved?.loopMode) ? saved.loopMode : "off");
      if (reason === "reset") {
        playGenerationRef.current += 1;
        providerRef.current?.stop();
        providerRef.current = null;
        historyRef.current = [];
        setTrack(null);
        setIsPlaying(false);
        setProgress(0);
        setQueue([]);
        setCharPicks([]);
        setCharReaction(null);
      }
    };
    const onFeatureDataChanged = (event) => {
      if (featureDataEventIncludes(event, FLOAT_KEY)) void reload(event?.detail?.reason);
    };
    void reload();
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    return () => {
      active = false;
      window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    };
  }, []);

  const persist = (patch = {}) => {
    const base = { side: floatRef.current.side, y: floatRef.current.y, loopMode: loopModeRef.current, ...patch };
    saveFeatureEntity(FLOAT_KEY, base).catch(() => {});
  };

  const value = useMemo(() => {
    const callbacks = {
      onState: setIsPlaying,
      onProgress: setProgress,
      onError: () => setIsPlaying(false),
      onTrack: (nextTrack) => {
        if (!nextTrack) return;
        setTrack(nextTrack);
        trackRef.current = nextTrack;
      },
      onEnded: () => {
        // 單曲循環：重載同一首（YouTube/Spotify 重載都會從頭播，比 seek(0) 可靠）
        if (loopModeRef.current === "single" && trackRef.current) { void api.play({ ...trackRef.current }); return; }
        const [next, ...rest] = queueRef.current;
        if (next) { setQueue(rest); void api.play(next); return; }
        // 列表循環：佇列空了就從播過的歌回繞
        if (loopModeRef.current === "list") {
          const list = historyRef.current;
          if (list.length) {
            const index = list.findIndex((item) => item.id === trackRef.current?.id);
            const wrapped = list[(index + 1) % list.length];
            if (wrapped) { void api.play({ ...wrapped }); return; }
          }
        }
        setIsPlaying(false);
      },
    };
    const api = {
      track, isPlaying, progress, queue, charPicks, charReaction, floatState, loopMode,
      setCharPicks, setCharReaction, setQueue,
      async play(input) {
        const generation = ++playGenerationRef.current;
        const nextTrack = typeof input === "string" ? await resolveTrackFromUrl(input) : input;
        if (!nextTrack || generation !== playGenerationRef.current) return null;
        const provider = nextTrack.source === "yt" ? yt : sp;
        if (providerRef.current && providerRef.current !== provider) providerRef.current.stop();
        providerRef.current = provider;
        setProgress(0);
        setTrack(nextTrack);
        setIsPlaying(false);
        const guardedCallbacks = {
          onState: (playing) => {
            if (generation === playGenerationRef.current && providerRef.current === provider) callbacks.onState(playing);
          },
          onProgress: (nextProgress) => {
            if (generation === playGenerationRef.current && providerRef.current === provider) callbacks.onProgress(nextProgress);
          },
          onTrack: (providerTrack) => {
            if (generation === playGenerationRef.current && providerRef.current === provider) callbacks.onTrack(providerTrack);
          },
          onEnded: () => {
            if (generation === playGenerationRef.current && providerRef.current === provider) callbacks.onEnded();
          },
          onError: (error) => {
            if (generation === playGenerationRef.current && providerRef.current === provider) callbacks.onError(error);
          },
        };
        try {
          await provider.load(nextTrack, guardedCallbacks);
        } catch (error) {
          if (generation === playGenerationRef.current) {
            provider.stop();
            providerRef.current = null;
            setTrack(null);
            setProgress(0);
            setIsPlaying(false);
          }
          throw error;
        }
        if (generation !== playGenerationRef.current) return null;
        if (!historyRef.current.some((item) => item.id === nextTrack.id)) historyRef.current.push(nextTrack);
        return nextTrack;
      },
      cycleLoop() {
        const order = ["off", "list", "single"];
        const next = order[(order.indexOf(loopModeRef.current) + 1) % order.length];
        setLoopMode(next);
        persist({ loopMode: next });
      },
      pause() { providerRef.current?.pause(); setIsPlaying(false); },
      resume() { providerRef.current?.resume(); },
      toggle() { if (isPlaying) api.pause(); else api.resume(); },
      seek(pct) { providerRef.current?.seek(Math.max(0, Math.min(1, pct))); },
      next() {
        if (providerRef.current?.next?.()) return;
        const [nextTrack, ...rest] = queueRef.current;
        if (nextTrack) { setQueue(rest); void api.play(nextTrack); }
      },
      stop() {
        playGenerationRef.current += 1;
        providerRef.current?.stop();
        providerRef.current = null;
        setTrack(null);
        setIsPlaying(false);
        setProgress(0);
      },
      saveFloat(nextState) {
        setFloatState(nextState);
        persist({ side: nextState.side, y: nextState.y });
      },
    };
    return api;
  }, [track, isPlaying, progress, queue, charPicks, charReaction, floatState, loopMode]);

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

export function useMusicPlayer() {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error("useMusicPlayer must be used inside MusicPlayerProvider");
  return value;
}

// iframe 宿主：掛在手機殼層、永不卸載。
// 不能 display:none（YouTube iframe 會停播），用 1×1 px 移出視野。
export function PlayerHost() {
  return (
    <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", left: -9999, top: 0 }} aria-hidden="true">
      <div id="yt-player-host" />
      <div id="sp-embed-host" />
    </div>
  );
}
