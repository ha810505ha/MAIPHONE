// MP-072 抽卡音訊：翻卡與 SSR 音效以 Web Audio 即時合成；
// 背景音樂用小舞提供的音檔（data/gacha/summonFx.js 解析網址），在抽卡畫面循環播放。
import { resolveGachaBgm } from "../../data/gacha/summonFx.js";

const MUTE_KEY = "mali_gacha_muted";
const SFX_LEVEL = 0.85;
const BGM_VOLUME = 0.35;

const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } };

let ctx = null;
let master = null;
let sfxBus = null;
let muted = readMuted();
let bgm = null;
let bgmWanted = false;
let bgmSuppressed = false;
const listeners = new Set();

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function getContext() {
  if (ctx) return ctx;
  const AudioCtx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = SFX_LEVEL;
  sfxBus.connect(master);

  return ctx;
}

// 瀏覽器要求先有點擊才能出聲；翻卡是點擊觸發，這裡再補一次保險。
function resume() {
  const audio = getContext();
  if (audio?.state === "suspended" && !(typeof document !== "undefined" && document.hidden)) audio.resume().catch(() => {});
  return audio;
}

function bell(time, midi, { dur = 1.4, level = 0.16, out }) {
  const freq = midiToHz(midi);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.exponentialRampToValueAtTime(level, time + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  env.connect(out);
  [[1, 1], [2.01, 0.22], [3.98, 0.06]].forEach(([ratio, amount]) => {
    const osc = ctx.createOscillator();
    const partial = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    partial.gain.value = amount;
    osc.connect(partial);
    partial.connect(env);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  });
}

function noiseBuffer() {
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// 背景音樂：有音檔網址、玩家沒靜音、沒在聽音樂 App、畫面在前景時才播。
function syncBgm() {
  const shouldPlay = bgmWanted && !muted && !bgmSuppressed && !(typeof document !== "undefined" && document.hidden);
  if (!shouldPlay) { bgm?.pause(); return; }
  if (!bgm) {
    const src = resolveGachaBgm();
    if (!src || typeof Audio === "undefined") return;
    bgm = new Audio(src);
    bgm.loop = true;
    bgm.preload = "auto";
    bgm.volume = BGM_VOLUME;
  }
  // 瀏覽器擋自動播放時靜靜失敗，下一次點擊（翻卡、切換靜音）會再試。
  bgm.play?.()?.catch?.(() => {});
}

if (typeof document !== "undefined") document.addEventListener("visibilitychange", syncBgm);

export function playGachaBgm() { bgmWanted = true; syncBgm(); }

export function stopGachaBgm() {
  bgmWanted = false;
  if (bgm) { bgm.pause(); bgm.currentTime = 0; }
}

// 玩家正在用音樂 App 聽歌時不放抽卡音樂（音效照常）。
export function setGachaBgmSuppressed(value) { bgmSuppressed = !!value; syncBgm(); }

// 翻卡：一聲輕柔的翻頁氣音＋清亮鈴聲；SSR 另外加一串上行星光音。
export function playGachaCardReveal(rarity) {
  if (bgmWanted && bgm?.paused) syncBgm();
  if (muted || !resume()) return;
  const now = ctx.currentTime + 0.01;
  const swish = ctx.createBufferSource();
  swish.buffer = noiseBuffer();
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(700, now);
  band.frequency.exponentialRampToValueAtTime(3200, now + 0.2);
  const swishEnv = ctx.createGain();
  swishEnv.gain.setValueAtTime(0.0001, now);
  swishEnv.gain.exponentialRampToValueAtTime(0.32, now + 0.04);
  swishEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
  swish.connect(band);
  band.connect(swishEnv);
  swishEnv.connect(sfxBus);
  swish.start(now);
  swish.stop(now + 0.3);
  bell(now + 0.07, rarity === "R" ? 84 : 88, { dur: 0.9, level: 0.2, out: sfxBus });
  if (rarity === "SSR") {
    [84, 88, 91, 96, 100, 103].forEach((midi, index) => bell(now + 0.16 + index * 0.065, midi, { dur: 1.3, level: 0.13, out: sfxBus }));
  }
}

export function isGachaAudioMuted() { return muted; }

export function setGachaAudioMuted(value) {
  muted = !!value;
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch {}
  if (master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.2);
  }
  syncBgm();
  listeners.forEach((listener) => listener());
}

export function subscribeGachaAudioMuted(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
