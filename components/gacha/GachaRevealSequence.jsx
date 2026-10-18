import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GachaMuteButton from "./GachaMuteButton";
import { playGachaCardReveal } from "../../services/gacha/gachaAudio";
import { withGachaCardArt } from "../../data/gacha/cardArt.js";
import { resolveSummonVideo } from "../../data/gacha/summonFx.js";
import GachaCardVisual, { GachaPoolBadge } from "./GachaCardVisual";
import { translate } from "../../utils/i18n";

const uiLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";

const palettes = { SSR: ["#2c2039", "#eebcd2"], SR: ["#925d79", "#f4c8dc"], R: ["#656886", "#d8daed"] };
const RANK = { R: 0, SR: 1, SSR: 2 };
// MP-053 第二輪：前置召喚演出（依最高稀有度，不做假升級）→ 單抽／十連都逐張大卡翻開 → 十連 5×2 長條總覽。
// 比較頁：tmp/gacha-reveal-preview/（第一輪）、總覽方案 A（柔光圓角）。
const SUMMON_MS = { R: 1750, SR: 1750, SSR: 1950 };
// 影片版保險上限：影片最長 4.5 秒，若 ended 事件沒來（例如被暫停）也在此時間進翻卡。
const SUMMON_VIDEO_MAX_MS = 6500;
const SUMMON_VIDEO_START_MS = 1500;
const TEASE_MS = { SR: 450, SSR: 800 };
const CARD_ENTER_MS = 420;
const SUMMARY_PETALS = [0, 1, 2, 3];
const PETALS = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2 + (index % 3) * 0.4;
  const radius = 260 + (index * 37) % 120;
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius), rotate: (index * 47) % 360, delay: (index * 71) % 260 };
});

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const topRarity = (items) => items.reduce((top, item) => (RANK[item.rarity] > RANK[top] ? item.rarity : top), "R");
const faceBackground = (rarity) => `linear-gradient(145deg,${palettes[rarity][0]},${palettes[rarity][1]})`;

function RevealCard({ item, tr }) {
  return <div key={item.uid} className={`sg-reveal-card sg-reveal-${item.rarity.toLowerCase()}`}>
    <div className="sg-reveal-rainbow" /><div className="sg-reveal-rays" />
    <div className="sg-reveal-ring" />
    <div className={`sg-reveal-face sg-rarity-frame-${item.rarity.toLowerCase()} ${item.art ? "has-art" : ""}`} style={{ background: faceBackground(item.rarity) }}>
      <GachaPoolBadge poolId={item.poolId} tr={tr} />
      {!item.art && <><span className="sg-reveal-spark">✦</span><span className="sg-reveal-icon">{item.icon}</span><span className="sg-reveal-label">SAKURA VOW</span></>}{item.art && <GachaCardVisual item={item} />}
    </div>
    <div className="sg-reveal-rarity">{item.rarity}</div><h2>{item.name}</h2><p>{item.quote}</p>
  </div>;
}

// MP-069：有影片（dev 或 APK／設定了 VITE_GACHA_FX_BASE_URL）時先播影片；載入失敗或無法自動播放就退回 CSS 演出。
// Android WebView 在影片開始播放前會畫灰底＋播放鈕，所以影片真正播放（playing）前先隱藏、只露深色底。
function SummonVideo({ src, onEnded, onFail, tr }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    video.muted = true;
    const played = video.play?.();
    if (played?.catch) played.catch(() => onFail());
    // 網路慢或瀏覽器卡住不播時不讓玩家盯黑畫面：時間內沒開始播就改 CSS 演出。
    const timer = window.setTimeout(() => { if (video.paused || video.currentTime === 0) onFail(); }, SUMMON_VIDEO_START_MS);
    return () => window.clearTimeout(timer);
  }, [src, onFail]);
  return <div className="sg-b-summon sg-b-summon-video">
    <video ref={ref} className={`sg-b-video ${playing ? "show" : ""}`} src={src} muted playsInline preload="auto" disablePictureInPicture onPlaying={() => setPlaying(true)} onEnded={onEnded} onError={onFail} />
    <div className="sg-b-skip-hint">{tr("點擊畫面跳過", "Tap to skip", "タップでスキップ", "눌러서 건너뛰기")}</div>
  </div>;
}

function SummonIntro({ top, tr }) {
  const rarity = top.toLowerCase();
  return <div className="sg-b-summon">
    {PETALS.map((petal, index) => <span key={index} className="sg-b-petal" style={{ "--sx": `${petal.x}px`, "--sy": `${petal.y}px`, "--rot": `${petal.rotate}deg`, animationDelay: `${petal.delay}ms` }} />)}
    <div className={`sg-b-core ${rarity}`} />
    <div className={`sg-b-pillar ${rarity}`} />
    {top === "SSR" && <div className="sg-b-rays" />}
    <div className="sg-b-skip-hint">{tr("點擊畫面跳過", "Tap to skip", "タップでスキップ", "눌러서 건너뛰기")}</div>
  </div>;
}

function FlipCard({ item, open, tease, tr, size }) {
  const rarity = item.rarity.toLowerCase();
  return <div className={`sg-b-flip ${open ? "open" : ""} ${tease ? `tease-${rarity}` : ""}`}>
    <div className="sg-b-back" />
    <div className={`sg-b-front ${rarity} ${item.art ? "has-art" : ""}`} style={{ background: faceBackground(item.rarity) }}>
      <GachaPoolBadge poolId={item.poolId} tr={tr} size={size} />
      {item.art ? <GachaCardVisual item={item} /> : <span className="sg-b-icon">{item.icon}</span>}
    </div>
  </div>;
}

export default function GachaRevealSequence({ items: sourceItems, onClose, tr: trProp }) {
  const items = useMemo(() => sourceItems.map(withGachaCardArt), [sourceItems]);
  const tr = typeof trProp === "function" ? trProp : (...translations) => translate(uiLocale(), ...translations);
  const reducedMotion = useRef(prefersReducedMotion()).current;
  const single = items.length === 1;
  // 減少動態效果：單抽直接顯示翻開的大卡，十連直接到總覽。
  const [phase, setPhase] = useState(reducedMotion ? (single ? "cards" : "summary") : "summon");
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(reducedMotion);
  const [teasing, setTeasing] = useState(false);
  const [detail, setDetail] = useState(null);
  // 目前這張卡的「立刻翻開」：點畫面時跳過預告直接翻。
  const revealNowRef = useRef(null);
  const detailCloseRef = useRef(null);
  const detailOpenerRef = useRef(null);
  const item = items[current];
  // MP-072：每張卡翻開時播翻卡音效（SSR 多一串星光音）。
  useEffect(() => { if (phase === "cards" && open && item) playGachaCardReveal(item.rarity); }, [phase, open, current]); // eslint-disable-line react-hooks/exhaustive-deps
  // 召喚影片：null＝用 CSS 演出。影片結束（或超過保險時間）才進翻卡。
  const [summonVideo, setSummonVideo] = useState(() => (reducedMotion ? null : resolveSummonVideo(topRarity(items))));
  const dropVideo = useCallback(() => setSummonVideo(null), []);
  const finishSummon = useCallback(() => setPhase((current) => (current === "summon" ? "cards" : current)), []);

  useEffect(() => {
    if (phase !== "summon") return undefined;
    const timer = window.setTimeout(finishSummon, summonVideo ? SUMMON_VIDEO_MAX_MS : SUMMON_MS[topRarity(items)]);
    return () => window.clearTimeout(timer);
  }, [phase, items, summonVideo, finishSummon]);

  // 每張大卡：卡背進場 → SR／SSR 卡背預告 → 翻開。
  useEffect(() => {
    if (phase !== "cards" || reducedMotion) return undefined;
    const timers = [];
    const revealNow = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      revealNowRef.current = null;
      setTeasing(false);
      setOpen(true);
    };
    setOpen(false);
    setTeasing(false);
    revealNowRef.current = revealNow;
    timers.push(window.setTimeout(() => {
      const teaseMs = TEASE_MS[items[current].rarity];
      if (!teaseMs) { revealNow(); return; }
      setTeasing(true);
      timers.push(window.setTimeout(revealNow, teaseMs));
    }, CARD_ENTER_MS));
    return () => { timers.forEach((timer) => window.clearTimeout(timer)); revealNowRef.current = null; };
  }, [phase, current, items, reducedMotion]);

  useEffect(() => {
    if (!detail) return undefined;
    detailCloseRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      detailOpenerRef.current?.focus?.();
    };
  }, [detail]);

  // 點畫面（也是 Android 返回鍵的行為）：演出中＝跳過演出直接翻牌；卡未翻開＝立刻翻；已翻開＝下一張（十連最後一張後到總覽）。
  // 單抽翻開後與總覽畫面不動作，須按收進珍藏。
  const advance = () => {
    if (phase === "summon") { setPhase("cards"); return; }
    if (phase !== "cards") return;
    if (!open) { revealNowRef.current?.(); return; }
    if (single) return;
    if (current < items.length - 1) setCurrent(current + 1);
    else setPhase("summary");
  };
  const skipToSummary = (event) => { event.stopPropagation(); setPhase("summary"); };

  const openDetail = (event, card) => {
    event.stopPropagation();
    detailOpenerRef.current = event.currentTarget;
    setDetail(card);
  };
  const closeDetail = (event) => { event.stopPropagation(); setDetail(null); };
  const collectLabel = single ? tr("收進我的珍藏", "Add to my collection", "コレクションへ", "컬렉션에 담기") : tr("全部收進我的珍藏", "Add all to my collection", "すべてコレクションへ", "모두 컬렉션에 담기");

  return <div className="mp-overlay sg-reveal-overlay sg-b-overlay" onClick={advance}>
    <style>{`
      .sg-reveal-overlay{z-index:110;background:#1c1422;color:#fff;overflow:hidden;cursor:pointer}.sg-reveal-card{position:relative;animation:sgCardIn .52s cubic-bezier(.16,.9,.25,1)}.sg-reveal-face{position:relative;width:210px;aspect-ratio:2/3;margin:auto;border-radius:20px;overflow:hidden;display:grid;place-items:center;box-shadow:0 18px 50px #0008}.sg-reveal-face.has-art{border:0!important}.sg-reveal-icon{font-size:64px;filter:drop-shadow(0 8px 9px #0005)}.sg-reveal-spark{position:absolute;right:16px;top:13px;font-size:25px}.sg-reveal-label{position:absolute;bottom:12px;font:8px monospace;letter-spacing:.25em}.sg-reveal-rarity{display:inline-block;margin:16px 0 5px;padding:4px 13px;border-radius:20px;background:#ffffff1a;font:700 12px monospace;letter-spacing:.18em}.sg-reveal-card h2{margin:4px 0;font:800 24px serif}.sg-reveal-card p{margin:6px 0 14px;opacity:.72}.sg-reveal-hint{font-size:12px;letter-spacing:.12em;opacity:.7;animation:sgHint 1.2s ease-in-out infinite}.sg-reveal-ring,.sg-reveal-rays,.sg-reveal-rainbow{display:none;position:absolute;left:50%;top:39%;pointer-events:none}.sg-reveal-sr .sg-reveal-ring{display:block;width:min(230px,66vw);height:min(230px,66vw);transform:translate(-50%,-50%);border:2px solid #ffd0e5;border-radius:50%;box-shadow:0 0 18px #ff8fc5, inset 0 0 15px #ffb6d855;animation:sgRipple 2.1s ease-out infinite}.sg-reveal-ssr .sg-reveal-ring{display:block;width:min(275px,78vw);height:min(275px,78vw);transform:translate(-50%,-50%);border:3px double #ffe29a;border-radius:50%;box-shadow:0 0 25px #ffd66f,0 0 65px #f7a9d4;animation:sgRing .9s ease-out infinite}.sg-reveal-ssr .sg-reveal-rays{display:block;width:min(370px,88vw);height:min(370px,88vw);transform:translate(-50%,-50%);background:repeating-conic-gradient(#ffe8a666 0 5deg,transparent 5deg 18deg);-webkit-mask-image:radial-gradient(circle,#000 0 55%,transparent 78%);mask-image:radial-gradient(circle,#000 0 55%,transparent 78%);animation:sgSpinCentered 8s linear infinite;will-change:transform}.sg-reveal-ssr .sg-reveal-rainbow{display:block;width:min(315px,80vw);height:min(315px,80vw);transform:translate(-50%,-50%);border-radius:50%;background:conic-gradient(#ff638855,#ffd65c88,#65ed9c77,#62cfff88,#9b77ff88,#ff72ca88,#ff638855);-webkit-mask-image:radial-gradient(circle,#000 0 52%,transparent 76%);mask-image:radial-gradient(circle,#000 0 52%,transparent 76%);filter:saturate(1.6);mix-blend-mode:screen;animation:sgSpinCentered 2.8s linear infinite;will-change:transform}.sg-reveal-ssr .sg-reveal-face:after,.sg-b-front.ssr:after{content:"";position:absolute;inset:-35%;background:linear-gradient(115deg,transparent 25%,#ff8fc966 38%,#fff8adbb 47%,#6de9ff88 56%,transparent 68%);mix-blend-mode:screen;pointer-events:none;animation:sgShimmer 1.8s ease-in-out infinite}.sg-reveal-face.sg-rarity-frame-ssr{border:3px solid #f4d574;box-shadow:0 0 0 2px #fff3bd55,0 0 26px #ffd86daa,0 18px 50px #0008}.sg-reveal-face.sg-rarity-frame-sr{border:3px solid #e9a1ca;box-shadow:0 0 0 2px #ffd9ee44,0 0 20px #ef9ac288,0 18px 50px #0008}.sg-reveal-face.sg-rarity-frame-r{border:2px solid #aeb9ea;box-shadow:0 0 0 2px #dce2ff33,0 0 16px #8999d466,0 18px 50px #0008}
      .sg-b-summon{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 46%,#2e1c30,#120c16 75%)}.sg-b-petal{position:absolute;left:50%;top:46%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:0 100% 0 100%;background:linear-gradient(135deg,#ffe1ee,#f49cc4);box-shadow:0 0 6px #ffb6d8aa;opacity:0;animation:sgPetal .82s cubic-bezier(.55,0,.8,.3) forwards;will-change:transform,opacity}.sg-b-core{position:absolute;left:50%;top:46%;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;opacity:0;transform:scale(0);animation:sgCore .65s .62s ease-out forwards}.sg-b-core.r{background:radial-gradient(circle,#fff,#8fb0ff 45%,transparent 72%)}.sg-b-core.sr{background:radial-gradient(circle,#fff,#ff9cc8 45%,transparent 72%)}.sg-b-core.ssr{background:radial-gradient(circle,#fff,#ffd66f 45%,transparent 72%)}.sg-b-pillar{position:absolute;left:50%;bottom:0;width:80px;height:100%;margin-left:-40px;transform:scaleY(0);transform-origin:50% 100%;filter:blur(2px);animation:sgPillar .52s 1s cubic-bezier(.2,.9,.3,1) forwards}.sg-b-pillar.r{background:linear-gradient(90deg,transparent,#8fb0ff99 25%,#eef3ff 50%,#8fb0ff99 75%,transparent)}.sg-b-pillar.sr{background:linear-gradient(90deg,transparent,#ff9cc899 25%,#fff0f7 50%,#ff9cc899 75%,transparent)}.sg-b-pillar.ssr{background:linear-gradient(90deg,transparent,#ffd66faa 22%,#fffbe6 50%,#ffd66faa 78%,transparent)}.sg-b-rays{position:absolute;left:50%;top:46%;width:700px;height:700px;margin:-350px 0 0 -350px;border-radius:50%;background:repeating-conic-gradient(#ffe8a655 0 5deg,transparent 5deg 16deg);-webkit-mask-image:radial-gradient(circle,#000 0 30%,transparent 65%);mask-image:radial-gradient(circle,#000 0 30%,transparent 65%);opacity:0;animation:sgFadeIn .25s 1.33s forwards,sgSpin 6s linear infinite}.sg-b-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4}.sg-b-flash.out{animation:sgFlashOut .42s ease-out forwards}.sg-b-skip-hint{position:absolute;bottom:26px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:.1em;opacity:.45}.sg-b-summon-video{background:#120c16}.sg-b-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;background:#120c16;opacity:0;transition:opacity .25s}.sg-b-video.show{opacity:1}.sg-b-video::-webkit-media-controls,.sg-b-video::-webkit-media-controls-start-playback-button{display:none!important;-webkit-appearance:none}.sg-b-summon-video .sg-b-skip-hint{z-index:1;color:#fff;text-shadow:0 1px 4px #0009}
      .sg-b-deal{position:absolute;inset:0;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:9% 16px 6%;background:radial-gradient(circle at 50% 40%,#3a2340,#1c1422 75%)}.sg-b-title{text-align:center;font:11px monospace;letter-spacing:.25em;opacity:.6}.sg-b-slot{position:relative;z-index:1;display:block;min-width:0;perspective:600px}.sg-b-flip{position:relative;width:100%;aspect-ratio:2/3;transform-style:preserve-3d;transition:transform .42s cubic-bezier(.3,1.3,.5,1)}.sg-b-flip.open{transform:rotateY(180deg)}.sg-b-back,.sg-b-front{position:absolute;inset:0;border-radius:9px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:grid;place-items:center;overflow:hidden}.sg-b-back{background:linear-gradient(150deg,#4b2c4f,#2a1a2e);border:1.5px solid #e9a1ca66;box-shadow:0 6px 14px #0006}.sg-b-back:before{content:"✿";font-size:20px;color:#f6b5d3aa}.sg-b-back:after{content:"";position:absolute;inset:4px;border:1px solid #f6b5d333;border-radius:6px}.sg-b-front{transform:rotateY(180deg)}.sg-b-front.ssr{border:2px solid #f4d574;box-shadow:0 0 16px #ffd670}.sg-b-front.sr{border:2px solid #e9a1ca;box-shadow:0 0 12px #ef9ac2aa}.sg-b-front.r{border:1px solid #aeb9ea}.sg-b-front.has-art{border:0}.sg-b-icon{font-size:24px}.sg-b-flip.tease-sr .sg-b-back{animation:sgTeaseSr .35s ease-in-out}.sg-b-flip.tease-ssr .sg-b-back{animation:sgTeaseSsr .7s ease-in-out}.sg-b-burst{position:absolute;left:50%;top:40%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;pointer-events:none;z-index:3;opacity:0;animation:sgBurst .5s .18s ease-out}.sg-b-burst.sr{border:2px solid #ffb6d8;box-shadow:0 0 18px #ff8fc5}.sg-b-burst.ssr{background:radial-gradient(circle,#fff6c8cc,#ffd66f55 45%,transparent 70%);animation-duration:.7s;--burst:2.4}.sg-b-foot{flex:none;text-align:center}.sg-b-foot .sg-reveal-hint{margin-bottom:10px}.sg-b-foot .sg-reveal-hint.still{animation:none;opacity:.6}.sg-b-collect{width:100%}
      .sg-b-single{position:absolute;inset:0;display:flex;overflow-y:auto;overflow-x:hidden;padding:24px 0;text-align:center;background:radial-gradient(circle at 50% 40%,#3a2340,#1c1422 75%)}.sg-b-single-inner{width:min(92%,390px);margin:auto}.sg-b-single .sg-b-slot{width:min(260px,68vw,40vh);margin:auto;animation:sgCardIn .52s cubic-bezier(.16,.9,.25,1)}.sg-b-single .sg-b-back,.sg-b-single .sg-b-front{border-radius:20px}.sg-b-single .sg-b-icon{font-size:64px}.sg-b-single .sg-b-back:before{font-size:48px}.sg-b-single-info{opacity:0;transition:opacity .4s .2s}.sg-b-single-info.show{opacity:1}.sg-b-single-info h2{margin:16px 0 4px;font:800 24px serif}.sg-b-single-info p{opacity:.72;margin:6px 0 14px}.sg-b-single-info .sg-button{margin-inline:auto;min-width:180px;justify-content:center}
      .sg-b-stage{position:relative}.sg-b-stage .sg-reveal-ring,.sg-b-stage .sg-reveal-rays,.sg-b-stage .sg-reveal-rainbow{top:50%}.sg-b-mute{position:absolute;z-index:7;top:calc(env(safe-area-inset-top,0px) + 6px);left:8px}.sg-b-skip{position:absolute;z-index:6;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;padding:6px 14px;border:1px solid #ffffff40;border-radius:16px;background:#ffffff1a;color:#fff;font-size:12px;letter-spacing:.08em;cursor:pointer}.sg-b-count{font:11px monospace;letter-spacing:.2em;opacity:.55;margin-top:14px}.sg-b-count+.sg-reveal-rarity{margin-top:6px}
      .sg-b-sum-grid{margin:auto 0;padding:20px 0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px 8px}.sg-b-sum-card{position:relative;display:block;width:100%;min-width:0;aspect-ratio:1/2.3;padding:0;border:0;border-radius:14px;overflow:hidden;background:#17121c;color:#fff;cursor:pointer;opacity:0;animation:sgSumPop .45s cubic-bezier(.2,.9,.3,1.25) forwards;animation-delay:calc(var(--i) * 60ms)}.sg-b-sum-card .sg-v3-card-art{object-position:center 22%}.sg-b-sum-card.r{box-shadow:0 0 0 1.5px #aeb9ea,0 0 10px #8999d466}.sg-b-sum-card.sr{box-shadow:0 0 0 2px #e9a1ca,0 0 14px #ef9ac2aa}.sg-b-sum-card.ssr{box-shadow:0 0 0 2px #f4d574,0 0 18px #ffd86dcc,0 0 34px #f7a9d466}.sg-b-sum-card.ssr:after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 30%,#fff8adaa 47%,#6de9ff66 55%,transparent 66%);mix-blend-mode:screen;pointer-events:none;animation:sgSumShim 2.2s ease-in-out infinite}.sg-b-sum-icon{position:absolute;inset:0;display:grid;place-items:center;font-size:24px}.sg-b-sum-band{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:14px 0 6px;text-align:center;font:700 10px monospace;letter-spacing:.12em;background:linear-gradient(transparent,#0009)}.sg-b-sum-card.ssr .sg-b-sum-band{color:#ffe29a}.sg-b-sum-card.sr .sg-b-sum-band{color:#ffd0e5}.sg-b-sum-card.r .sg-b-sum-band{color:#dce2ff}.sg-b-sum-petal{position:absolute;top:-10px;z-index:3;width:7px;height:7px;border-radius:0 100% 0 100%;background:linear-gradient(135deg,#fff3c4,#f49cc4);opacity:0;pointer-events:none;animation:sgSumFall 3.2s linear infinite}
      @keyframes sgSumPop{from{opacity:0;transform:translateY(18px) scale(.85)}to{opacity:1;transform:none}}@keyframes sgSumShim{from{transform:translateX(-60%) rotate(8deg)}to{transform:translateX(60%) rotate(8deg)}}@keyframes sgSumFall{0%{opacity:0;transform:translate(0,0) rotate(0)}15%{opacity:1}100%{opacity:0;transform:translate(14px,160px) rotate(400deg)}}
      .sg-b-detail{position:absolute;inset:0;z-index:20;display:grid;place-items:center;text-align:center;background:rgba(18,12,22,.92);cursor:pointer}.sg-b-detail-inner{width:min(92%,390px);max-height:100%;overflow-y:auto;overflow-x:hidden}.sg-b-detail-close{min-width:140px;margin:4px auto 0;justify-content:center}
      @keyframes sgCardIn{from{opacity:0;transform:scale(.65) rotateY(65deg)}70%{transform:scale(1.04)}to{opacity:1;transform:scale(1)}}@keyframes sgRing{from{opacity:1;transform:translate(-50%,-50%) scale(.72)}to{opacity:0;transform:translate(-50%,-50%) scale(1.22)}}@keyframes sgRipple{0%{opacity:.8;transform:translate(-50%,-50%) scale(.72)}70%,100%{opacity:0;transform:translate(-50%,-50%) scale(1.48)}}@keyframes sgSpinCentered{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes sgShimmer{from{transform:translateX(-55%) rotate(8deg)}to{transform:translateX(55%) rotate(8deg)}}@keyframes sgHint{50%{opacity:.35}}
      @keyframes sgPetal{0%{opacity:0;transform:translate(var(--sx),var(--sy)) rotate(var(--rot)) scale(1)}25%{opacity:1}100%{opacity:.9;transform:translate(0,0) rotate(calc(var(--rot) + 540deg)) scale(.3)}}@keyframes sgCore{0%{opacity:0;transform:scale(0)}40%{opacity:1;transform:scale(.6)}100%{opacity:1;transform:scale(1.5)}}@keyframes sgPillar{0%{opacity:.6;transform:scaleY(0) scaleX(.4)}50%{opacity:1;transform:scaleY(1) scaleX(.6)}100%{opacity:1;transform:scaleY(1) scaleX(1)}}@keyframes sgFadeIn{to{opacity:1}}@keyframes sgSpin{to{transform:rotate(360deg)}}@keyframes sgFlashOut{from{opacity:.95}to{opacity:0}}@keyframes sgTeaseSr{50%{box-shadow:0 0 18px #ff9cc8,0 6px 14px #0006;border-color:#ffb6d8}}@keyframes sgTeaseSsr{15%{transform:translateX(-2px) rotate(-2deg)}30%{transform:translateX(2px) rotate(2deg)}45%{transform:translateX(-2px) rotate(-1deg)}60%{box-shadow:0 0 28px #ffd66f,0 0 50px #ffd66f88;border-color:#ffe29a;transform:scale(1.08)}}@keyframes sgBurst{from{opacity:1;transform:scale(.3)}to{opacity:0;transform:scale(var(--burst,1.5))}}
      @media(prefers-reduced-motion:reduce){.sg-reveal-card,.sg-b-slot,.sg-b-single .sg-b-slot,.sg-b-sum-card{animation:none;opacity:1}.sg-b-sum-card.ssr:after{animation:none}.sg-b-flip{transition:none}.sg-reveal-ring,.sg-reveal-rays,.sg-reveal-rainbow,.sg-reveal-ssr .sg-reveal-face:after,.sg-b-front.ssr:after,.sg-reveal-hint,.sg-b-burst{animation:none}}
    `}</style>
    <GachaMuteButton tr={tr} tone="light" className="sg-b-mute" />
    {phase === "summon" && (summonVideo
      ? <SummonVideo src={summonVideo} onEnded={finishSummon} onFail={dropVideo} tr={tr} />
      : <SummonIntro top={topRarity(items)} tr={tr} />)}
    {phase === "cards" && <div className="sg-b-single">
      {!single && <button type="button" className="sg-b-skip" onClick={skipToSummary}>{tr("略過", "Skip", "スキップ", "건너뛰기")}</button>}
      <div className="sg-b-single-inner" key={current}>
        <div className={`sg-b-stage ${open ? `sg-reveal-${item.rarity.toLowerCase()}` : ""}`}>
          <div className="sg-reveal-rainbow" /><div className="sg-reveal-rays" /><div className="sg-reveal-ring" />
          <div className="sg-b-slot"><FlipCard item={item} open={open} tease={teasing} tr={tr} /></div>
          {open && item.rarity !== "R" && !reducedMotion && <span className={`sg-b-burst ${item.rarity.toLowerCase()}`} />}
        </div>
        <div className={`sg-b-single-info ${open ? "show" : ""}`}>
          {!single && <div className="sg-b-count">{current + 1} / {items.length}</div>}
          <div className="sg-reveal-rarity">{item.rarity}</div><h2>{item.name}</h2><p>{item.quote}</p>
          {single
            ? open && <button className="sg-button sg-button-primary" onClick={(event) => { event.stopPropagation(); onClose(); }}>{collectLabel}</button>
            : <div className="sg-reveal-hint">{current < items.length - 1
              ? tr("點擊畫面看下一張", "Tap for the next card", "タップで次のカード", "눌러서 다음 카드")
              : tr("點擊畫面看結果", "Tap to see the results", "タップで結果を見る", "눌러서 결과 보기")}</div>}
        </div>
      </div>
      {open && item.rarity === "SSR" && !reducedMotion && <div key={`ssr-${current}`} className="sg-b-flash out" />}
    </div>}
    {phase === "summary" && <div className="sg-b-deal" inert={detail ? "" : undefined}>
      <div className="sg-b-title">SAKURA VOW</div>
      <div className="sg-b-sum-grid">
        {items.map((card, index) => <button
          type="button"
          key={card.uid ?? index}
          className={`sg-b-sum-card ${card.rarity.toLowerCase()}`}
          style={{ "--i": index }}
          aria-label={card.name}
          onClick={(event) => openDetail(event, card)}
        >
          {card.art ? <GachaCardVisual item={card} /> : <span className="sg-b-sum-icon" style={{ background: faceBackground(card.rarity) }}>{card.icon}</span>}
          <GachaPoolBadge poolId={card.poolId} tr={tr} size="sm" />
          <span className="sg-b-sum-band" aria-hidden="true">{card.rarity}</span>
          {card.rarity === "SSR" && !reducedMotion && SUMMARY_PETALS.map((petal) => <span key={petal} className="sg-b-sum-petal" style={{ left: `${10 + petal * 22}%`, animationDelay: `${petal * 0.8}s` }} />)}
        </button>)}
      </div>
      <div className="sg-b-foot">
        <div className="sg-reveal-hint still">{tr("點卡片看大圖", "Tap a card to view it", "カードをタップで拡大", "카드를 눌러 크게 보기")}</div>
        <button className="sg-button sg-button-primary sg-b-collect" onClick={(event) => { event.stopPropagation(); onClose(); }}>{collectLabel}</button>
      </div>
    </div>}
    {phase === "cards" && !reducedMotion && <div key="flash" className="sg-b-flash out" />}
    {detail && <div className="sg-b-detail" data-back-dismiss role="dialog" aria-modal="true" aria-label={detail.name} onClick={closeDetail}>
      <div className="sg-b-detail-inner"><RevealCard item={detail} tr={tr} /><button ref={detailCloseRef} type="button" className="sg-button sg-b-detail-close" onClick={closeDetail}>{tr("關閉", "Close", "閉じる", "닫기")}</button></div>
    </div>}
  </div>;
}
