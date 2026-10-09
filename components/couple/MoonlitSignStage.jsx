import React, { useEffect, useId, useRef } from "react";

// 情侶空間「今日戀愛簽」抽籤動畫（月下浮籤）。
// Canvas 畫夜空、月亮倒影、水波、水中折射的籤紙、漣漪與水花；浮出後展開的籤紙與印章用 SVG。
// 等 AI 時循環播放（至少 minWait 毫秒），sign 傳進來後才播揭曉，播完呼叫 onDone。
const TAU = Math.PI * 2;
const HAND_FONT = "'LXGW WenKai TC','Noto Serif TC',serif";
const REVEAL_SECONDS = 2.55;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const easeInOut = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// slip／stamp 是取得元素的函式：籤紙要等籤抽好才會渲染，不能在動畫開始時就抓。
function runMoonlitScene({ canvas, getSlip, getStamp, statusEl, paperLabel, golden, minWait, isReady, onDone }) {
  const W = canvas.clientWidth || 260, H = canvas.clientHeight || 176;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) { onDone(); return () => {}; }
  ctx.scale(dpr, dpr);

  const cx = W / 2, WY = Math.round(H * .56);
  const moon = { x: cx, y: 34, r: 19 };
  const stars = Array.from({ length: 34 }, () => ({ x: rand(0, W), y: rand(0, WY - 8), r: rand(.4, 1.2), p: rand(0, TAU), s: rand(1.2, 3) }));
  const motes = Array.from({ length: 10 }, () => ({ x: rand(0, W), y: rand(WY - 30, WY + 10), p: rand(0, TAU), r: rand(.8, 1.8) }));
  const rings = [];
  const parts = [];

  // 籤紙先畫到離屏畫布；水下時一條條錯位貼上，做出折射晃動。
  const PW = 62, PH = 42;
  const paper = document.createElement("canvas");
  paper.width = Math.round(PW * dpr); paper.height = Math.round(PH * dpr);
  const pc = paper.getContext("2d");
  pc.scale(dpr, dpr);
  const pg = pc.createLinearGradient(0, 0, PW, PH);
  pg.addColorStop(0, "#fffbef"); pg.addColorStop(1, "#eadcc0");
  pc.fillStyle = pg; pc.fillRect(0, 0, PW, PH);
  pc.strokeStyle = "rgba(190,150,95,.6)"; pc.strokeRect(.5, .5, PW - 1, PH - 1);
  pc.strokeStyle = "rgba(170,130,85,.22)"; pc.beginPath(); pc.moveTo(PW / 2, 0); pc.lineTo(PW / 2, PH); pc.stroke();
  pc.fillStyle = "rgba(111,78,70,.75)"; pc.font = `11px ${HAND_FONT}`; pc.textAlign = "center"; pc.textBaseline = "middle";
  pc.fillText(paperLabel, PW / 2, PH / 2, PW - 8);
  pc.fillStyle = "rgba(181,128,123,.6)"; pc.font = "11px serif"; pc.fillText("☾", PW - 8, PH - 8);

  let phase = "waiting", raf = 0, revealAt = 0;
  const start = performance.now();
  let last = start;
  let paperY = WY + 30, paperRot = 0, paperVisible = true, calm = 0, glow = 0, moonBoost = 0, dim = 0, flash = 0, shake = 0;
  let surfaced = false, opened = false, stamped = false, lastRing = 0;

  const splash = (x) => {
    for (let i = 0; i < 18; i++) parts.push({ kind: "drop", x: x + rand(-PW / 2, PW / 2), y: WY, vx: rand(-60, 60), vy: rand(-120, -50), g: 260, life: 0, max: rand(.5, .9), size: rand(1, 2.2) });
    rings.push({ x, r: 6, v: 70, life: 0, max: 1.3, w: 1.6 }, { x, r: 2, v: 46, life: 0, max: 1.6, w: 1.1 });
  };
  const drawPaperAbove = () => {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -4, W, WY + 4); ctx.clip();
    ctx.translate(cx, paperY); ctx.rotate(paperRot);
    ctx.shadowColor = "rgba(20,40,70,.35)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.drawImage(paper, -PW / 2, -PH / 2, PW, PH);
    ctx.restore();
  };
  const drawPaperUnderwater = (t) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, WY, W, H - WY); ctx.clip();
    ctx.translate(cx, paperY); ctx.rotate(paperRot);
    const depth = clamp((paperY - WY) / 40, 0, 1);
    ctx.globalAlpha = Math.min(1, .5 + .3 * (1 - depth) + .3 * glow);
    for (let sy = 0; sy < PH; sy += 2) {
      const off = Math.sin(t * 3.2 + sy * .35) * (1.6 * (1 - calm) + .4);
      ctx.drawImage(paper, 0, sy * dpr, PW * dpr, 2 * dpr, -PW / 2 + off, -PH / 2 + sy, PW, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(70,110,150,${.35 * depth})`; ctx.fillRect(-PW / 2 - 2, -PH / 2, PW + 4, PH);
    if (glow) {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 48);
      g.addColorStop(0, `rgba(255,240,200,${.55 * glow})`); g.addColorStop(1, "rgba(255,240,200,0)");
      ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(-50, -50, 100, 100);
    }
    ctx.restore();
  };

  const frame = (now) => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = (now - start) / 1000;
    if (phase === "waiting" && now - start >= minWait && isReady()) {
      phase = "reveal"; revealAt = now;
      if (statusEl) statusEl.style.opacity = "0";
    }
    const rt = phase === "reveal" ? (now - revealAt) / 1000 : 0;

    if (phase === "waiting") {
      paperY = WY + 30 + Math.sin(t * 2.2) * 3;
      paperRot = Math.sin(t * 1.4) * .05;
      if (t - lastRing > 1.1) { lastRing = t; rings.push({ x: cx + rand(-6, 6), r: 4, v: 30, life: 0, max: 2.2, w: 1 }); }
    } else {
      glow = clamp(rt / .4, 0, 1) * (rt < 1 ? 1 : clamp(1 - (rt - 1) / .3, 0, 1));
      calm = clamp(rt / .35, 0, 1);
      moonBoost = clamp(rt / .5, 0, 1) * (1 - clamp((rt - 1.4) / .8, 0, 1));
      const p = clamp((rt - .4) / .6, 0, 1);
      paperY = WY + 30 - (WY + 30 - 58) * easeInOut(p);
      paperRot = (1 - p) * .05;
      if (!surfaced && paperY - PH / 2 < WY) { surfaced = true; splash(cx); }
      if (surfaced && p < 1 && Math.random() < .5) parts.push({ kind: "drop", x: cx + rand(-PW / 2, PW / 2), y: paperY + PH / 2, vx: 0, vy: 20, g: 300, life: 0, max: .6, size: rand(.8, 1.5) });
      dim = clamp((rt - .95) / .4, 0, 1) * .3;
      if (rt >= 1 && !opened) {
        opened = true; flash = .8; paperVisible = false;
        const slip = getSlip();
        for (let i = 0; i < 22; i++) parts.push({ kind: "spark", x: cx, y: 58, vx: rand(-1, 1) * 110, vy: rand(-1, .5) * 90, g: 30, life: 0, max: rand(.6, 1.1), size: rand(1.2, 2.4), color: Math.random() < .6 ? "255,236,190" : "210,230,255" });
        if (slip) {
          slip.style.opacity = "1";
          slip.animate?.([
            { transform: "translateX(-50%) perspective(320px) rotateX(82deg) scale(.5)", opacity: .2 },
            { transform: "translateX(-50%) perspective(320px) rotateX(-6deg) scale(1.02)", opacity: 1, offset: .75 },
            { transform: "translateX(-50%) perspective(320px) rotateX(0) scale(1)", opacity: 1 },
          ], { duration: 560, easing: "cubic-bezier(.2,.9,.3,1)", fill: "forwards" });
        }
      }
      if (rt >= 1.62 && !stamped) {
        stamped = true; shake = .7;
        getStamp()?.animate?.([
          { transform: "scale(2.1) rotate(-14deg)", opacity: 0 },
          { transform: "scale(.94) rotate(-3deg)", opacity: 1, offset: .7 },
          { transform: "scale(1) rotate(-3deg)", opacity: 1 },
        ], { duration: 300, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" });
        rings.push({ x: cx, r: 10, v: 90, life: 0, max: 1.4, w: 1.4 });
      }
      if (rt > REVEAL_SECONDS) { raf = 0; onDone(); return; }
    }
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 4);

    ctx.save();
    if (shake) ctx.translate(rand(-1, 1) * 2.5 * shake, rand(-1, 1) * 1.5 * shake);
    // 天空、星星、月亮
    const sky = ctx.createLinearGradient(0, 0, 0, WY);
    sky.addColorStop(0, "#a898d2"); sky.addColorStop(1, "#93a9c8");
    ctx.fillStyle = sky; ctx.fillRect(-4, -4, W + 8, WY + 4);
    stars.forEach((s) => { ctx.fillStyle = `rgba(255,255,255,${.25 + .6 * (.5 + .5 * Math.sin(t * s.s + s.p))})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); });
    const haloR = 52 + 5 * Math.sin(t * 1.5) + 34 * moonBoost;
    const halo = ctx.createRadialGradient(moon.x, moon.y, moon.r * .6, moon.x, moon.y, haloR);
    const haloTint = golden ? "255,214,120" : "255,243,200";
    halo.addColorStop(0, `rgba(${haloTint},${.5 + .35 * moonBoost + (golden ? .12 : 0)})`); halo.addColorStop(1, `rgba(${haloTint},0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(moon.x, moon.y, haloR, 0, TAU); ctx.fill();
    const disc = ctx.createRadialGradient(moon.x - 5, moon.y - 5, 2, moon.x, moon.y, moon.r);
    disc.addColorStop(0, "#fffdf0"); disc.addColorStop(.6, "#f9eec7"); disc.addColorStop(1, "#e7d3a3");
    ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(moon.x, moon.y, moon.r, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(90,100,150,.35)";
    ctx.beginPath(); ctx.moveTo(0, WY); ctx.quadraticCurveTo(W * .18, WY - 16, W * .36, WY - 4); ctx.quadraticCurveTo(W * .5, WY - 10, W * .62, WY - 3); ctx.quadraticCurveTo(W * .82, WY - 18, W, WY - 6); ctx.lineTo(W, WY); ctx.fill();
    // 水面
    const water = ctx.createLinearGradient(0, WY, 0, H);
    water.addColorStop(0, "#7d98b8"); water.addColorStop(1, "#45627f");
    ctx.fillStyle = water; ctx.fillRect(-4, WY, W + 8, H - WY + 4);
    for (let y = WY + 3; y < H; y += 3.2) {
      const d = (y - WY) / (H - WY);
      if (Math.sin(t * 3 + y * .45) < -.55 + calm * .5) continue;
      const w = (7 + d * 22) * (1 + .25 * Math.sin(t * 4.2 + y * .6)) * (1 + .6 * moonBoost);
      const x = moon.x + Math.sin(t * 2 + y * .2) * (2 + d * 3) * (1 - calm * .6);
      ctx.fillStyle = golden ? `rgba(255,214,130,${Math.min(1, (.68 - d * .45) * (1 + .5 * moonBoost))})` : `rgba(255,240,195,${Math.min(1, (.6 - d * .45) * (1 + .5 * moonBoost))})`;
      ctx.fillRect(x - w / 2, y, w, 1.6);
    }
    ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.lineWidth = 1;
    for (let k = 1; k <= 7; k++) {
      const y0 = WY + (H - WY) * Math.pow(k / 7.5, 1.6);
      const amp = (.6 + k * .35) * (1 - calm * .7);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y0 + Math.sin(x * .05 + t * (1.2 + k * .15) + k) * amp);
      ctx.stroke();
    }
    if (paperVisible) drawPaperUnderwater(t);
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life += dt; r.r += r.v * dt * (1 - (r.life / r.max) * .5);
      if (r.life >= r.max) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(246,238,211,${.6 * (1 - r.life / r.max)})`; ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.ellipse(r.x, WY + 4, r.r, r.r * .2, 0, 0, TAU); ctx.stroke();
    }
    const mist = ctx.createLinearGradient(0, WY - 14, 0, WY + 10);
    mist.addColorStop(0, "rgba(235,238,246,0)"); mist.addColorStop(.5, `rgba(235,238,246,${.22 + .08 * Math.sin(t * .8)})`); mist.addColorStop(1, "rgba(235,238,246,0)");
    ctx.fillStyle = mist; ctx.fillRect(0, WY - 14, W, 24);
    motes.forEach((m) => { ctx.fillStyle = `rgba(255,230,190,${.25 + .35 * Math.sin(t * 1.8 + m.p)})`; ctx.beginPath(); ctx.arc(m.x + Math.sin(t * .6 + m.p) * 8, m.y + Math.cos(t * .9 + m.p) * 3, m.r, 0, TAU); ctx.fill(); });
    if (paperVisible && paperY - PH / 2 < WY) drawPaperAbove();
    if (dim) { ctx.fillStyle = `rgba(28,24,52,${dim})`; ctx.fillRect(-4, -4, W + 8, H + 8); }
    if (flash) {
      const fl = ctx.createRadialGradient(cx, 58, 0, cx, 58, 130);
      fl.addColorStop(0, `rgba(255,248,225,${.8 * flash})`); fl.addColorStop(1, "rgba(255,248,225,0)");
      ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt;
      if (p.life >= p.max || (p.kind === "drop" && p.vy > 0 && p.y > WY + 2 && p.life > .1)) {
        if (p.kind === "drop" && p.y >= WY && Math.random() < .25) rings.push({ x: p.x, r: 1, v: 18, life: 0, max: .7, w: .8 });
        parts.splice(i, 1); continue;
      }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max;
      if (p.kind === "drop") { ctx.fillStyle = `rgba(225,240,255,${.85 * a})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * .7, p.size, 0, 0, TAU); ctx.fill(); }
      else { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(${p.color},${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
    }
    ctx.restore();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { if (raf) cancelAnimationFrame(raf); };
}

// golden：溫度到 70° 解鎖的「金色月光籤」，月暈偏金、籤紙加金框。
export default function MoonlitSignStage({ characterName, sign, tr, golden = false, minWait = 1400, onDone }) {
  const canvasRef = useRef(null);
  const slipRef = useRef(null);
  const stampRef = useRef(null);
  const statusRef = useRef(null);
  const signRef = useRef(sign);
  const onDoneRef = useRef(onDone);
  signRef.current = sign;
  onDoneRef.current = onDone;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduceMotion = prefersReducedMotion();

  useEffect(() => {
    if (reduceMotion || !canvasRef.current) return undefined;
    return runMoonlitScene({
      canvas: canvasRef.current,
      getSlip: () => slipRef.current,
      getStamp: () => stampRef.current,
      statusEl: statusRef.current,
      paperLabel: tr("戀愛籤", "Fortune", "恋みくじ", "연애 운세"),
      golden,
      minWait,
      isReady: () => !!signRef.current,
      onDone: () => onDoneRef.current?.(),
    });
  }, []);
  // 減少動態效果：不播動畫，籤一回來就直接顯示結果。
  useEffect(() => {
    if (reduceMotion && sign) onDoneRef.current?.();
  }, [reduceMotion, sign]);

  return (
    <div className="couple-moon-stage" role="status" aria-live="polite" aria-label={tr("正在抽取今日戀愛籤", "Drawing today's love fortune", "今日の恋みくじを引いています", "오늘의 연애 운세를 뽑는 중")}>
      {!reduceMotion && <canvas ref={canvasRef} aria-hidden="true" />}
      {sign && (
        <div ref={slipRef} className="couple-moon-slip" aria-hidden="true">
          <svg viewBox="0 0 150 100" width="150" height="100">
            <defs>
              <linearGradient id={`${uid}paper`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffbef" /><stop offset="1" stopColor="#eee0c6" /></linearGradient>
              <linearGradient id={`${uid}wet`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="rgba(120,160,200,.22)" /><stop offset=".35" stopColor="rgba(120,160,200,0)" /></linearGradient>
              <filter id={`${uid}ink`}><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="1.8" /></filter>
            </defs>
            <path d="M6 4 H144 V96 H6 Z" fill={`url(#${uid}paper)`} stroke={golden ? "#d9a441" : "rgba(190,150,95,.5)"} strokeWidth={golden ? 2.4 : 1} />
            {golden && <path d="M11 9 H139 V91 H11 Z" fill="none" stroke="rgba(217,164,65,.55)" strokeDasharray="3 2.5" />}
            <path d="M6 4 H144 V96 H6 Z" fill={`url(#${uid}wet)`} />
            <path d="M6 50 H144" stroke="rgba(170,130,85,.18)" />
            <circle cx="131" cy="17" r="7" fill="#f2dda8" /><circle cx="128" cy="15" r="6.4" fill="#fffbef" />
            <g ref={stampRef} className="couple-moon-stamp" filter={`url(#${uid}ink)`}>
              <rect x="30" y="26" width="90" height="34" rx="5" fill="rgba(201,67,61,.06)" stroke="#c9433d" strokeWidth="2.6" />
              <text x="75" y="50" textAnchor="middle" fontSize="17" fontWeight="900" letterSpacing="2" fill="#c9433d" fontFamily={HAND_FONT} textLength={String(sign.level || "").length > 5 ? 80 : undefined} lengthAdjust="spacingAndGlyphs">{sign.level}</text>
            </g>
            <text x="75" y="81" textAnchor="middle" fontSize="11.5" fill="#8f6a4a" fontFamily={HAND_FONT} textLength={String(sign.tip || "").length > 12 ? 128 : undefined} lengthAdjust="spacingAndGlyphs">{sign.tip}</text>
          </svg>
        </div>
      )}
      <span ref={statusRef} className="couple-moon-status">{tr(`月光正在映出${characterName}的心意…`, `Moonlight is revealing ${characterName}'s feelings…`, `月明かりが${characterName}の想いを映しています…`, `달빛이 ${characterName}의 마음을 비추는 중…`)}</span>
    </div>
  );
}
