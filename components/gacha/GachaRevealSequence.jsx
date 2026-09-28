import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import GachaCardVisual from "./GachaCardVisual";
import { EnvelopeBack, EnvelopeDefs, EnvelopeFlap, EnvelopeFront, WaxSeal } from "./EnvelopeSvg";
import { RevealAudio, RevealParticleField } from "./revealFx";
import { normalizeUiLanguage, translate } from "../../utils/i18n";

const palettes = { SSR: ["#2c2039", "#eebcd2"], SR: ["#925d79", "#f4c8dc"], R: ["#656886", "#d8daed"] };

// 演出強度可調參數：粒子倍率、閃光強度、R 卡在多抽時的加速、打字速度、SSR「假裝普通」機率。
const REVEAL_TUNING = { particleScale: 1, flashScale: 1, typeSpeedMs: 42, fakeOutChance: 0.1 };

// 各稀有度的色彩與節奏（毫秒）。openMs：拆封；revealMs：卡片抽出到定位；crackAt：蠟封裂開的時間點比例。
const RARITY_FX = {
  R: { accent: "#aeb9ea", glow: "#8999d4", seal: "#7f8bbf", seal2: "#a9b3de", petals: ["#dfe3f7", "#c3cbef"], burst: 10, inhale: 0, flash: 0.22, openMs: 700, revealMs: 850, quickOpenMs: 380, quickRevealMs: 620, crackAt: 0.2 },
  SR: { accent: "#e9a1ca", glow: "#ef9ac2", seal: "#c9678f", seal2: "#f0a6c6", petals: ["#ffd6e7", "#f4a7cb", "#fff0f6"], burst: 26, inhale: 14, flash: 0.42, openMs: 1000, revealMs: 950, crackAt: 0.35 },
  SSR: { accent: "#f4d574", glow: "#ffd86d", seal: "#c2922c", seal2: "#f6dc8a", petals: ["#ffe9b0", "#ffd6e7", "#fff6dc"], burst: 50, inhale: 42, flash: 0.6, openMs: 1800, revealMs: 1300, crackAt: 0.62 },
};

const CATEGORY_STAMPS = { item: "🎁", scene: "🌙", location: "📍", event: "✉️", character: "💞", memory: "📷", daily: "☕", dream: "⭐" };
const BRAND_LABEL = "SAKURA VOW";
const MUTE_STORAGE_KEY = "mp_gacha_reveal_muted";

const TEXT = {
  dialog: { "zh-TW": "櫻色誓約・召喚揭曉", en: "Sakura Vow reveal", ja: "桜色の誓い・召喚結果", ko: "벚꽃빛 맹세 · 소환 공개" },
  skip: { "zh-TW": "略過", en: "Skip", ja: "スキップ", ko: "건너뛰기" },
  soundOn: { "zh-TW": "開啟聲音", en: "Turn sound on", ja: "サウンドをオン", ko: "소리 켜기" },
  soundOff: { "zh-TW": "關閉聲音", en: "Turn sound off", ja: "サウンドをオフ", ko: "소리 끄기" },
  tapOpen: { "zh-TW": "輕觸拆開這封心意", en: "Tap to open this letter", ja: "タップして想いを開封", ko: "탭해서 마음이 담긴 편지 열기" },
  glowing: { "zh-TW": "信封裡有什麼正在發光……", en: "Something inside is glowing…", ja: "封筒の中で何かが光っている……", ko: "봉투 안에서 무언가 빛나고 있어요……" },
  tapNext: { "zh-TW": "輕觸拆開下一封", en: "Tap for the next letter", ja: "タップで次の手紙へ", ko: "탭해서 다음 편지 열기" },
  tapSummary: { "zh-TW": "輕觸查看這次收到的心意", en: "Tap to see everything you received", ja: "タップで今回届いた想いを見る", ko: "탭해서 이번에 받은 마음 모두 보기" },
  summaryTitle: { "zh-TW": "這次收到的心意", en: "Letters you received", ja: "今回届いた想い", ko: "이번에 받은 마음" },
  firstCollect: { "zh-TW": "初次收藏", en: "New", ja: "初入手", ko: "첫 소장" },
  keepAll: { "zh-TW": "全部收進我的珍藏", en: "Keep all in my collection", ja: "すべてコレクションにしまう", ko: "모두 내 컬렉션에 담기" },
};

function scaled(count) {
  return Math.round(count * REVEAL_TUNING.particleScale);
}

function readInitialMuted() {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function CardFront({ item }) {
  const palette = palettes[item.rarity] || palettes.R;
  const rarity = String(item.rarity || "R").toLowerCase();
  return <div className={`sgr-face sgr-front sgr-frame-${rarity} ${item.art ? "has-art" : ""}`} style={{ background: `linear-gradient(145deg,${palette[0]},${palette[1]})` }}>
    {item.art ? <GachaCardVisual item={item} /> : <><span className="sgr-front-spark" aria-hidden="true">✦</span><span className="sgr-front-icon" aria-hidden="true">{item.icon}</span><span className="sgr-front-label">{BRAND_LABEL}</span></>}
    {item.rarity === "SSR" && <span className="sgr-front-sheen" aria-hidden="true" />}
  </div>;
}

export default function GachaRevealSequence({ items, knownIds, onClose }) {
  const locale = useMemo(() => normalizeUiLanguage(typeof document === "undefined" ? "" : document.documentElement.lang), []);
  const tr = useCallback((key) => translate(locale, TEXT[key]), [locale]);
  const reduced = useMemo(prefersReducedMotion, []);
  const svgPrefix = `sgr${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [index, setIndex] = useState(0);
  const [phase, setPhaseState] = useState("sealed");
  const [cracked, setCracked] = useState(false);
  const [summary, setSummary] = useState(false);
  const [typed, setTyped] = useState(0);
  const [muted, setMuted] = useState(readInitialMuted);
  const phaseRef = useRef("sealed");
  const timersRef = useRef(new Set());
  const lastTapRef = useRef(0);
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const audioRef = useRef(null);
  const overlayRef = useRef(null);

  const current = items[index] || items[0];
  const fx = RARITY_FX[current?.rarity] || RARITY_FX.R;
  const isMulti = items.length > 1;
  const quick = isMulti && current?.rarity === "R";
  const quote = current?.quote || "";

  // 每張 SSR 在開場時決定是否「假裝普通」：蠟封先是櫻粉，裂開瞬間轉金。
  const fakeOuts = useMemo(() => new Set(items.filter((item) => item.rarity === "SSR" && Math.random() < REVEAL_TUNING.fakeOutChance).map((item) => item.uid)), [items]);
  const firstCollected = useMemo(() => {
    const seen = new Set(knownIds || []);
    const result = new Set();
    items.forEach((item) => {
      if (!knownIds || seen.has(item.id)) return;
      seen.add(item.id);
      result.add(item.uid);
    });
    return result;
  }, [items, knownIds]);
  const shownRarity = fakeOuts.has(current?.uid) && phase === "sealed" ? "SR" : fakeOuts.has(current?.uid) && phase === "opening" && !cracked ? "SR" : current?.rarity;
  const sealFx = RARITY_FX[shownRarity] || RARITY_FX.R;

  const later = useCallback((callback, delay) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      callback();
    }, delay);
    timersRef.current.add(id);
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current.clear();
  }, []);
  const setPhase = useCallback((next) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const particles = useCallback((run) => {
    if (!reduced && fieldRef.current) run(fieldRef.current);
  }, [reduced]);
  const sound = useCallback((name) => audioRef.current?.play(name), []);
  
  useEffect(() => {
    const audio = new RevealAudio();
    audio.muted = readInitialMuted();
    audioRef.current = audio;
    if (canvasRef.current) fieldRef.current = new RevealParticleField(canvasRef.current);
    overlayRef.current?.focus?.({ preventScroll: true });
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      fieldRef.current?.destroy();
      fieldRef.current = null;
      audio.destroy();
      audioRef.current = null;
    };
  }, []);

  const show = useCallback(() => {
    if (phaseRef.current !== "revealing") return;
    clearTimers();
    setPhase("shown");
  }, [clearTimers, setPhase]);

  const reveal = useCallback(() => {
    if (phaseRef.current !== "opening") return;
    clearTimers();
    setCracked(true);
    setPhase("revealing");
    sound(current.rarity === "SSR" ? "harp" : current.rarity === "SR" ? "shimmer" : "chime");
    particles((field) => {
      field.burst(scaled(fx.burst), fx.accent, current.rarity === "SSR" ? 1.3 : 1);
      if (current.rarity !== "R") field.petals(scaled(current.rarity === "SSR" ? 30 : 14), fx.petals);
      if (current.rarity === "SSR") {
        const rect = canvasRef.current?.getBoundingClientRect();
        const cardWidth = Math.min((rect?.width || 360) * 0.6, (rect?.height || 700) * 0.38);
        // 軌道完整在卡片外側（半徑大於卡片半寬／半高，畫布也在卡片後方）；卡片下緣以下淡出，避免掃過卡名與台詞。
        field.orbit(scaled(18), "#fff1c4", cardWidth * 0.78, cardWidth * 1.02, cardWidth * 0.72);
        field.setAmbient({ rate: 2.2 * REVEAL_TUNING.particleScale, colors: fx.petals });
      }
    });
    later(show, reduced ? 260 : quick ? fx.quickRevealMs : fx.revealMs);
  }, [clearTimers, current, fx, later, particles, quick, reduced, setPhase, show, sound]);

  const open = useCallback(() => {
    if (phaseRef.current !== "sealed") return;
    clearTimers();
    setPhase("opening");
    sound("paper");
    const openMs = reduced ? 220 : quick ? fx.quickOpenMs : fx.openMs;
    // 假裝普通的 SSR 在裂開前沿用櫻粉色，避免粒子顏色提前暴露結果。
    if (fx.inhale) particles((field) => field.inhale(scaled(fx.inhale), fakeOuts.has(current.uid) ? RARITY_FX.SR.accent : fx.accent));
    later(() => {
      setCracked(true);
      sound("crack");
    }, openMs * fx.crackAt);
    later(reveal, openMs);
  }, [clearTimers, current, fakeOuts, fx, later, particles, quick, reduced, reveal, setPhase, sound]);

  const finish = useCallback(() => {
    clearTimers();
    fieldRef.current?.clear();
    setPhase("summary");
    setSummary(true);
  }, [clearTimers, setPhase]);

  const next = useCallback(() => {
    clearTimers();
    fieldRef.current?.setAmbient(null);
    fieldRef.current?.clearOrbits();
    if (index >= items.length - 1) {
      finish();
      return;
    }
    setIndex((value) => value + 1);
    setTyped(0);
    setCracked(false);
    setPhase("sealed");
  }, [clearTimers, finish, index, items.length, setPhase]);

  // 多抽中的 R 卡自動拆封，只保留 SR 以上的期待感。
  useEffect(() => {
    if (phase !== "sealed" || summary || !quick) return undefined;
    const id = window.setTimeout(open, reduced ? 120 : 260);
    return () => window.clearTimeout(id);
  }, [index, open, phase, quick, reduced, summary]);

  // 台詞打字機效果；已完整顯示（快轉）時不重新開始。
  useEffect(() => {
    if (phase !== "shown") return undefined;
    if (reduced) {
      setTyped(quote.length);
      return undefined;
    }
    const id = window.setInterval(() => {
      setTyped((value) => {
        if (value >= quote.length) {
          window.clearInterval(id);
          return value;
        }
        return value + 1;
      });
    }, REVEAL_TUNING.typeSpeedMs);
    return () => window.clearInterval(id);
  }, [phase, quote, reduced]);

  const handleTap = () => {
    const now = performance.now();
    if (now - lastTapRef.current < 150) return;
    lastTapRef.current = now;
    const state = phaseRef.current;
    if (state === "sealed") open();
    else if (state === "opening") {
      if (current.rarity !== "SSR") reveal();
    } else if (state === "revealing") {
      if (current.rarity === "SSR") return;
      setTyped(quote.length);
      show();
    } else if (state === "shown") {
      if (typed < quote.length) setTyped(quote.length);
      else next();
    }
  };

  const toggleMute = (event) => {
    event.stopPropagation();
    const nextMuted = !muted;
    setMuted(nextMuted);
    audioRef.current?.setMuted(nextMuted);
    if (!nextMuted) audioRef.current?.play("tick");
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, nextMuted ? "1" : "0");
    } catch {
      // 靜音偏好只是個人便利設定，儲存失敗時維持本次狀態即可。
    }
  };

  const onKeyDown = (event) => {
    if (summary) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTap();
    } else if (event.key === "Escape") finish();
  };

  const revealed = phase === "revealing" || phase === "shown";
  const ssrStage = revealed && current?.rarity === "SSR";
  const hint = phase === "sealed" ? tr("tapOpen")
    : phase === "opening" && shownRarity === "SSR" ? tr("glowing")
      : phase === "shown" ? (index < items.length - 1 ? tr("tapNext") : tr("tapSummary")) : "";
  const style = {
    "--sgr-accent": (revealed ? fx : sealFx).accent,
    "--sgr-glow": (revealed ? fx : sealFx).glow,
    "--sgr-seal": sealFx.seal,
    "--sgr-seal2": sealFx.seal2,
    "--sgr-open-ms": `${reduced ? 220 : quick ? fx.quickOpenMs : fx.openMs}ms`,
    "--sgr-reveal-ms": `${reduced ? 260 : quick ? fx.quickRevealMs : fx.revealMs}ms`,
    "--sgr-flash-peak": Math.min(0.8, fx.flash * REVEAL_TUNING.flashScale),
  };

  return <div
    className={`mp-overlay sgr-overlay is-${phase} ${ssrStage ? "is-ssr-stage" : ""} ${cracked ? "is-cracked" : ""}`}
    data-rarity={shownRarity}
    style={style}
    role="dialog"
    aria-modal="true"
    aria-label={tr("dialog")}
    tabIndex={-1}
    ref={overlayRef}
    onKeyDown={onKeyDown}
    onClick={() => { if (!summary) handleTap(); }}
  >
    <style>{REVEAL_CSS}</style>
    <EnvelopeDefs prefix={svgPrefix} />
    <div className="sgr-sky" aria-hidden="true" />
    <div className="sgr-curtain" aria-hidden="true"><span className="sgr-halo" /></div>
    <div className="sgr-rays" aria-hidden="true"><span /><span /></div>
    <canvas ref={canvasRef} className="sgr-canvas" aria-hidden="true" />
    {!summary && current && <>
      <div key={current.uid} className="sgr-stage">
        <span className="sgr-glow" aria-hidden="true" />
        <div className="sgr-env sgr-env-back" aria-hidden="true"><EnvelopeBack prefix={svgPrefix} /><span className="sgr-env-slit" /></div>
        <div className="sgr-card">
          <div className="sgr-face sgr-back" aria-hidden="true"><span className="sgr-back-mark">✿</span><span className="sgr-back-label">{BRAND_LABEL}</span></div>
          <CardFront item={current} />
        </div>
        <div className="sgr-env sgr-env-front" aria-hidden="true"><EnvelopeFront prefix={svgPrefix} /><span className="sgr-env-stamp">{CATEGORY_STAMPS[current.category] || "🌸"}</span></div>
        <div className="sgr-env sgr-env-flap" aria-hidden="true"><EnvelopeFlap prefix={svgPrefix} /></div>
        <div className="sgr-seal" aria-hidden="true"><span className="sgr-seal-half left"><WaxSeal prefix={svgPrefix} /></span><span className="sgr-seal-half right"><WaxSeal prefix={svgPrefix} /></span></div>
      </div>
      <div className="sgr-flash" aria-hidden="true" />
      <div className="sgr-caption" aria-live="polite">
        {phase === "shown" && <>
          <div className="sgr-caption-meta"><span className="sgr-rarity">{current.rarity}</span>{firstCollected.has(current.uid) && <span className="sgr-new">{tr("firstCollect")}</span>}</div>
          <h2>{current.name}</h2>
          <p><span className="sgr-sr-only">「{quote}」</span><span aria-hidden="true">「{quote.slice(0, typed)}<span className="sgr-quote-rest">{quote.slice(typed)}</span>」</span></p>
        </>}
      </div>
      <div className="sgr-hint" aria-live="polite">{hint}</div>
    </>}
    <div className="sgr-topbar" onClick={(event) => event.stopPropagation()}>
      <span className="sgr-count">{!summary && isMulti ? `${index + 1} / ${items.length}` : ""}</span>
      <button type="button" className="sgr-icon-button" aria-label={muted ? tr("soundOn") : tr("soundOff")} aria-pressed={!muted} onClick={toggleMute}>{muted ? "🔇" : "🔈"}</button>
      {!summary && <button type="button" className="sgr-skip" onClick={(event) => { event.stopPropagation(); finish(); }}>{tr("skip")} »</button>}
    </div>
    {summary && <div className={`sgr-summary ${items.length === 1 ? "single" : ""}`} onClick={(event) => event.stopPropagation()}>
      <h2>{tr("summaryTitle")}</h2>
      <div className="sgr-summary-grid">
        {items.map((item) => {
          const palette = palettes[item.rarity] || palettes.R;
          const rarity = String(item.rarity || "R").toLowerCase();
          return <div key={item.uid} className={`sgr-summary-item ${rarity}`}>
            <div className="sgr-summary-frame">
              <div className={`sgr-summary-art ${item.art ? "has-art" : ""}`} style={{ background: `linear-gradient(145deg,${palette[0]},${palette[1]})` }}>{item.art ? <GachaCardVisual item={item} /> : <span aria-hidden="true">{item.icon}</span>}</div>
              {firstCollected.has(item.uid) && <span className="sgr-summary-new">{tr("firstCollect")}</span>}
            </div>
            <b>{item.name}</b><small>{item.rarity}</small>
          </div>;
        })}
      </div>
      <button type="button" className="sgr-keep" onClick={onClose}>{tr("keepAll")}</button>
    </div>}
  </div>;
}

const REVEAL_CSS = `
.sgr-overlay{z-index:110;background:#1c1422;color:#fff;overflow:hidden;cursor:pointer;backdrop-filter:none;container-type:size;--sgr-card-w:210px;outline:none;-webkit-tap-highlight-color:transparent;user-select:none}
@supports (width:1cqw){.sgr-overlay{--sgr-card-w:min(60cqw,38cqh)}}
.sgr-sky,.sgr-curtain,.sgr-canvas{position:absolute;inset:0;pointer-events:none}
.sgr-sky{background:radial-gradient(1.5px 1.5px at 18% 22%,#fff9 50%,transparent 51%),radial-gradient(1px 1px at 72% 14%,#fff8 50%,transparent 51%),radial-gradient(1.2px 1.2px at 84% 38%,#ffe9f499 50%,transparent 51%),radial-gradient(1px 1px at 30% 64%,#fff6 50%,transparent 51%),radial-gradient(1.4px 1.4px at 62% 78%,#fff7 50%,transparent 51%),radial-gradient(ellipse at 50% -10%,#4a3552 0,#2c2039 38%,#1c1422 72%);transition:filter .6s}
.is-revealing .sgr-sky,.is-shown .sgr-sky{filter:saturate(1.15)}
.sgr-curtain{opacity:0;background:radial-gradient(circle at 50% 46%,#7a5566 0,#3f2c48 34%,#231829 70%,#150e1a 100%);transition:opacity .7s ease}
.sgr-halo{position:absolute;left:50%;top:46%;width:760px;aspect-ratio:1;translate:-50% -50%;border-radius:50%;background:conic-gradient(from 0deg,#fff4d000,#fff4d055 12%,#fff4d000 25%,#ffd6e744 37%,#ffd6e700 50%,#fff4d055 62%,#fff4d000 75%,#ffd6e744 87%,#fff4d000);-webkit-mask-image:radial-gradient(circle,#000 0 26%,transparent 62%);mask-image:radial-gradient(circle,#000 0 26%,transparent 62%);animation:sgrSpin 36s linear infinite;animation-play-state:paused}
.is-ssr-stage .sgr-curtain{opacity:1}.is-ssr-stage .sgr-halo{animation-play-state:running}
.sgr-rays{position:absolute;left:50%;top:46%;width:720px;aspect-ratio:1;translate:-50% -50%;pointer-events:none;opacity:0;transition:opacity .6s ease}
.sgr-rays span{position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--sgr-accent) 42%,transparent) 0deg,transparent 7deg,transparent 15deg,color-mix(in srgb,var(--sgr-accent) 42%,transparent) 22deg);-webkit-mask-image:radial-gradient(circle,#000 0 14%,transparent 58%);mask-image:radial-gradient(circle,#000 0 14%,transparent 58%);filter:blur(3px);animation:sgrSpin 48s linear infinite}
.sgr-rays span+span{background:repeating-conic-gradient(from 9deg,color-mix(in srgb,#fff 30%,transparent) 0deg,transparent 4deg,transparent 26deg,color-mix(in srgb,#fff 30%,transparent) 30deg);animation-duration:70s;animation-direction:reverse;opacity:.6}
@supports (width:1cqw){.sgr-halo{width:max(190cqw,120cqh)}.sgr-rays{width:max(170cqw,110cqh)}}
[data-rarity="SR"].is-revealing .sgr-rays,[data-rarity="SR"].is-shown .sgr-rays{opacity:.5}
[data-rarity="SSR"].is-revealing .sgr-rays,[data-rarity="SSR"].is-shown .sgr-rays{opacity:.85}
.sgr-canvas{width:100%;height:100%;z-index:1}
.sgr-stage{position:absolute;z-index:2;left:50%;top:46%;width:var(--sgr-card-w);height:calc(var(--sgr-card-w)*1.5);translate:-50% -50%;perspective:900px}
.is-sealed .sgr-stage{animation:sgrFloat 3.2s ease-in-out infinite}
.sgr-glow{position:absolute;inset:-4%;border-radius:28px;background:radial-gradient(closest-side,var(--sgr-glow),transparent);filter:blur(22px);opacity:0;transition:opacity .5s ease}
.is-revealing .sgr-glow,.is-shown .sgr-glow{opacity:.55}.is-ssr-stage .sgr-glow{opacity:.85;inset:-9%}
.sgr-env{position:absolute;left:4%;width:92%;top:calc(50% - var(--sgr-card-w)*.317);height:calc(var(--sgr-card-w)*.634);border-radius:10px}
.sgr-env-back{box-shadow:0 22px 40px #0007;overflow:hidden}
.sgr-svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible}.sgr-svg-defs{position:absolute;width:0;height:0;overflow:hidden}
.sgr-env-slit{position:absolute;left:10%;right:10%;top:-30%;height:80%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--sgr-accent) 85%,#fff),transparent);opacity:0;filter:blur(6px)}
.sgr-env-stamp{position:absolute;right:7%;bottom:9%;width:17%;aspect-ratio:1;display:grid;place-items:center;border:1.5px dashed #b8969b;border-radius:4px;font-size:calc(var(--sgr-card-w)*.075);background:#fff8;filter:saturate(.8)}
.sgr-env-flap{transform-origin:50% 0;z-index:4;transform-style:preserve-3d}
.sgr-flap-face,.sgr-flap-inner{backface-visibility:hidden;-webkit-backface-visibility:hidden}.sgr-flap-inner{transform:rotateX(180deg)}
.sgr-env-front{z-index:3}.sgr-env-back{z-index:1}
.sgr-seal{position:absolute;z-index:5;left:50%;top:calc(50% - var(--sgr-card-w)*.317 + var(--sgr-card-w)*.634*.62);width:calc(var(--sgr-card-w)*.24);aspect-ratio:1;translate:-50% -50%}
.sgr-seal-half{position:absolute;inset:0;transition:transform .45s cubic-bezier(.3,1.4,.5,1),opacity .45s ease}
.sgr-seal-half.left{clip-path:polygon(0 0,52% 0,44% 40%,56% 62%,46% 100%,0 100%)}.sgr-seal-half.right{clip-path:polygon(52% 0,100% 0,100% 100%,46% 100%,56% 62%,44% 40%)}
[data-rarity="SSR"].is-sealed .sgr-seal{animation:sgrHeartbeat 1.4s ease-in-out infinite}
.sgr-seal{filter:drop-shadow(0 3px 5px #0005)}[data-rarity="SSR"] .sgr-seal{filter:drop-shadow(0 0 8px #ffd86dbb) drop-shadow(0 3px 5px #0005)}
.is-opening .sgr-seal{animation:sgrTremble .12s linear infinite}
.is-opening[data-rarity="SSR"] .sgr-seal{animation:sgrTremble .09s linear infinite}
.is-cracked .sgr-seal{animation:none}
.is-cracked .sgr-seal-half.left{transform:translate(-45%,30%) rotate(-38deg);opacity:0}.is-cracked .sgr-seal-half.right{transform:translate(45%,34%) rotate(34deg);opacity:0}
.is-cracked .sgr-env-flap{animation:sgrFlap calc(var(--sgr-open-ms)*.45) cubic-bezier(.3,.7,.3,1) forwards}
.is-revealing .sgr-env-flap,.is-shown .sgr-env-flap{transform:rotateX(180deg);z-index:1}
[data-rarity="SR"].is-opening .sgr-env-slit,[data-rarity="SSR"].is-opening .sgr-env-slit{animation:sgrSlit var(--sgr-open-ms) ease-in forwards}
.is-revealing .sgr-env{animation:sgrEnvAway var(--sgr-reveal-ms) ease-in forwards}
.is-shown .sgr-env,.is-shown .sgr-seal,.is-revealing .sgr-seal{opacity:0;visibility:hidden}
.sgr-card{position:absolute;inset:0;z-index:2;transform-style:preserve-3d;transform:translateY(-1%) scale(.4) rotateY(180deg);transition:transform .35s ease}
.is-cracked.is-opening .sgr-card{transform:translateY(-5%) scale(.4) rotateY(180deg)}
.is-revealing .sgr-card{animation:sgrRise var(--sgr-reveal-ms) cubic-bezier(.25,.8,.3,1) forwards}
.is-shown .sgr-card{transform:none;transition:none}
.sgr-face{position:absolute;inset:0;border-radius:18px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:grid;place-items:center}
.sgr-back{transform:rotateY(180deg);background:radial-gradient(circle at 50% 40%,#5a3f5f,#2c2039 70%);border:2px solid #d9b9c9;box-shadow:inset 0 0 0 5px #2c2039,inset 0 0 0 6px #d9b9c966}
.sgr-back:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,#ffffff08 0 6px,transparent 6px 12px)}
.sgr-back-mark{font-size:calc(var(--sgr-card-w)*.3);color:#f4c8dc}
.sgr-back-label{position:absolute;bottom:9%;font:700 calc(var(--sgr-card-w)*.045) monospace;letter-spacing:.25em;color:#f4c8dccc}
.sgr-front{box-shadow:0 18px 50px #0008}
.sgr-front.has-art{border:0!important}
.sgr-frame-ssr{border:3px solid #f4d574;box-shadow:0 0 0 2px #fff3bd55,0 18px 50px #0008}
.sgr-frame-sr{border:3px solid #e9a1ca;box-shadow:0 0 0 2px #ffd9ee44,0 18px 50px #0008}
.sgr-frame-r{border:2px solid #aeb9ea;box-shadow:0 0 0 2px #dce2ff33,0 18px 50px #0008}
.sgr-front-icon{font-size:calc(var(--sgr-card-w)*.3);filter:drop-shadow(0 8px 9px #0005)}
.sgr-front-spark{position:absolute;right:8%;top:6%;font-size:calc(var(--sgr-card-w)*.12)}
.sgr-front-label{position:absolute;bottom:6%;font:calc(var(--sgr-card-w)*.04) monospace;letter-spacing:.25em}
.sgr-front-sheen{position:absolute;inset:-35%;z-index:2;pointer-events:none;background:linear-gradient(115deg,transparent 30%,#ff8fc955 40%,#fff8ad99 48%,#6de9ff66 56%,transparent 66%);mix-blend-mode:screen;animation:sgrSheen 3.2s ease-in-out infinite}
.sgr-flash{position:absolute;z-index:3;left:50%;top:46%;width:900px;aspect-ratio:1;translate:-50% -50%;pointer-events:none;background:radial-gradient(circle,#fff 0,color-mix(in srgb,var(--sgr-accent) 55%,#fff) 10%,color-mix(in srgb,var(--sgr-accent) 30%,transparent) 26%,transparent 55%);mix-blend-mode:screen;opacity:0}
@supports (width:1cqw){.sgr-flash{width:max(160cqw,100cqh)}}
.is-revealing .sgr-flash{animation:sgrFlash calc(var(--sgr-reveal-ms)*.8) ease-out}
.sgr-caption{position:absolute;z-index:3;left:18px;right:18px;top:calc(46% + var(--sgr-card-w)*.75 + 12px);text-align:center;cursor:pointer}
.sgr-caption-meta{display:flex;justify-content:center;gap:6px;animation:sgrRiseIn .45s ease-out both}
.sgr-rarity{padding:3px 12px;border-radius:20px;background:color-mix(in srgb,var(--sgr-accent) 26%,#ffffff10);border:1px solid color-mix(in srgb,var(--sgr-accent) 70%,transparent);font:700 12px monospace;letter-spacing:.18em;color:#fff}
.sgr-new,.sgr-summary-new{padding:3px 9px;border-radius:20px;background:linear-gradient(135deg,#ff9ec4,#ffcf7d);color:#3a2130;font-size:11px;font-weight:900;letter-spacing:.04em}
.sgr-caption h2{margin:6px 0 4px;font:800 22px serif;text-shadow:0 2px 12px #000a;animation:sgrRiseIn .5s .05s ease-out both}
.sgr-caption p{margin:0 auto;max-width:300px;font-size:14px;line-height:1.55;color:#fff;opacity:.9;text-shadow:0 1px 8px #000c}
.sgr-quote-rest{visibility:hidden}
.sgr-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.sgr-hint{position:absolute;z-index:3;left:0;right:0;bottom:calc(18px + env(safe-area-inset-bottom));text-align:center;font-size:12px;letter-spacing:.12em;color:#fff;opacity:.72;animation:sgrHint 1.6s ease-in-out infinite;pointer-events:none}
.sgr-hint:empty{display:none}
.sgr-topbar{position:absolute;z-index:4;top:calc(12px + env(safe-area-inset-top));left:14px;right:14px;display:flex;align-items:center;gap:8px;cursor:default;transition:opacity .5s}
.is-ssr-stage .sgr-topbar{opacity:.45}
.sgr-count{margin-right:auto;font:12px monospace;opacity:.75}
.sgr-icon-button,.sgr-skip{min-height:34px;border:1px solid #ffffff55;border-radius:20px;background:#ffffff14;color:#fff;font:inherit;font-size:13px;cursor:pointer}
.sgr-icon-button{width:36px;padding:0}.sgr-skip{padding:6px 13px}
.sgr-summary{position:relative;z-index:3;width:calc(100% - 28px);max-width:420px;max-height:84%;overflow-y:auto;box-sizing:border-box;padding:20px 16px 16px;border-radius:24px;background:#2a1d31e6;border:1px solid #ffffff22;box-shadow:0 24px 60px #0009;text-align:center;cursor:default;animation:sgrRiseIn .45s ease-out both}
.sgr-summary h2{margin:0 0 14px;font:800 20px serif}
.sgr-summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px 6px;margin-bottom:16px}
.sgr-summary.single .sgr-summary-grid{grid-template-columns:minmax(0,150px);justify-content:center}
.sgr-summary-item{min-width:0;animation:sgrRiseIn .4s ease-out both}
.sgr-summary-item:nth-child(2){animation-delay:.04s}.sgr-summary-item:nth-child(3){animation-delay:.08s}.sgr-summary-item:nth-child(4){animation-delay:.12s}.sgr-summary-item:nth-child(5){animation-delay:.16s}.sgr-summary-item:nth-child(6){animation-delay:.2s}.sgr-summary-item:nth-child(7){animation-delay:.24s}.sgr-summary-item:nth-child(8){animation-delay:.28s}.sgr-summary-item:nth-child(9){animation-delay:.32s}.sgr-summary-item:nth-child(10){animation-delay:.36s}
.sgr-summary-frame{position:relative;border-radius:10px;padding:2px;overflow:hidden;background:#aeb9ea88}
.sgr-summary-item.sr .sgr-summary-frame{background:#e9a1ca}
.sgr-summary-item.ssr .sgr-summary-frame{background:#f4d574;box-shadow:0 0 14px #ffd67077}
.sgr-summary-item.ssr .sgr-summary-frame:before{content:"";position:absolute;inset:-60%;background:conic-gradient(#ff8fc9,#ffe29a,#8ff0c4,#8fd8ff,#c6a2ff,#ff8fc9);animation:sgrSpin 3.2s linear infinite}
.sgr-summary-art{position:relative;z-index:1;aspect-ratio:2/3;border-radius:8px;overflow:hidden;display:grid;place-items:center;font-size:24px}
.sgr-summary-new{position:absolute;z-index:2;left:50%;bottom:4px;translate:-50% 0;padding:2px 6px;font-size:9px;white-space:nowrap}
.sgr-summary-item b{display:block;margin-top:5px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sgr-summary-item small{font-size:10px;opacity:.7}
.sgr-keep{width:100%;min-height:46px;border:0;border-radius:15px;background:linear-gradient(135deg,#ef8db0,#c8537b);color:#fff;font:inherit;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 10px 24px #a0325a66}
@keyframes sgrFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-8px) rotate(1deg)}}
@keyframes sgrHeartbeat{0%,100%{scale:1}14%{scale:1.1}28%{scale:1}42%{scale:1.07}}
@keyframes sgrTremble{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(-1.5px,1px) rotate(-3deg)}50%{transform:translate(1.5px,-1px) rotate(2deg)}75%{transform:translate(-1px,-1px) rotate(3deg)}100%{transform:translate(0,0) rotate(0)}}
@keyframes sgrFlap{0%{transform:rotateX(0);z-index:4}49%{z-index:4}50%{z-index:1}100%{transform:rotateX(180deg);z-index:1}}
@keyframes sgrSlit{0%{opacity:0}60%{opacity:.5}100%{opacity:1}}
@keyframes sgrEnvAway{0%,32%{opacity:1;translate:0 0}68%,100%{opacity:0;translate:0 34%}}
@keyframes sgrRise{0%{transform:translateY(-5%) scale(.4) rotateY(180deg)}36%{transform:translateY(-36%) scale(.44) rotateY(180deg)}72%{transform:translateY(-3%) scale(1.05) rotateY(-10deg)}86%{transform:translateY(0) scale(.985) rotateY(4deg)}100%{transform:none}}
@keyframes sgrFlash{0%{opacity:0}18%{opacity:var(--sgr-flash-peak)}100%{opacity:0}}
@keyframes sgrRiseIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes sgrSpin{to{rotate:360deg}}
@keyframes sgrSheen{0%,20%{transform:translateX(-60%) rotate(8deg)}80%,100%{transform:translateX(60%) rotate(8deg)}}
@keyframes sgrHint{50%{opacity:.35}}
@keyframes sgrFade{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){
.is-sealed .sgr-stage,.sgr-seal,.is-opening .sgr-seal,[data-rarity="SSR"].is-sealed .sgr-seal,.sgr-hint,.sgr-front-sheen,.sgr-rays span,.sgr-halo,.sgr-summary-item.ssr .sgr-summary-frame:before{animation:none!important}
.is-cracked .sgr-env-flap{animation:none;transform:rotateX(180deg);z-index:1}
.is-revealing .sgr-card{animation:sgrFade var(--sgr-reveal-ms) ease-out both;transform:none}
.is-revealing .sgr-env{animation:none;opacity:0}
.is-revealing .sgr-flash{animation:none}
.sgr-caption-meta,.sgr-caption h2,.sgr-summary,.sgr-summary-item{animation:none}
}
`;
