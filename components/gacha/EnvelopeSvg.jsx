import React from "react";

// 揭曉演出的封蠟信封，以 SVG 繪製紙張紋理、摺痕與蠟滴。
// 信封拆成背面／正面口袋／信封蓋／蠟封數層，交由 GachaRevealSequence 與卡片交錯堆疊。
// 所有圖層共用 viewBox 0 0 290 200（長寬比 1.45）；蠟封為 0 0 100 100。

const ENVELOPE_VIEWBOX = "0 0 290 200";
const ENVELOPE_RADIUS = 9;

// 以固定參數產生不規則的蠟滴輪廓，避免每次渲染形狀跳動。
function waxBlobPath(cx, cy, radius, seed) {
  const count = 30;
  const points = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const wobble = 1 + 0.045 * Math.sin(index * 3.1 + seed) + 0.03 * Math.sin(index * 7.7 + seed * 2.3) + 0.02 * Math.cos(index * 5.3 + seed);
    return [cx + Math.cos(angle) * radius * wobble, cy + Math.sin(angle) * radius * wobble];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[count - 1], points[0]);
  let path = `M${start[0].toFixed(2)},${start[1].toFixed(2)}`;
  points.forEach((point, index) => {
    const end = mid(point, points[(index + 1) % count]);
    path += ` Q${point[0].toFixed(2)},${point[1].toFixed(2)} ${end[0].toFixed(2)},${end[1].toFixed(2)}`;
  });
  return `${path} Z`;
}

const WAX_OUTLINE = waxBlobPath(50, 50, 43, 1.7);
const WAX_DRIPS = [waxBlobPath(84, 71, 7.5, 4.2), waxBlobPath(19, 80, 5.5, 2.6), waxBlobPath(71, 12, 4.5, 3.4)];
const SAKURA_PETAL = "M0,-3 C-7.5,-8 -7,-18 -2.4,-20.5 L0,-17.2 L2.4,-20.5 C7,-18 7.5,-8 0,-3 Z";

function Sakura({ fill, dx = 0, dy = 0, opacity = 1 }) {
  return <g transform={`translate(${50 + dx} ${50 + dy})`} fill={fill} opacity={opacity}>
    {[0, 72, 144, 216, 288].map((angle) => <path key={angle} d={SAKURA_PETAL} transform={`rotate(${angle})`} />)}
    <circle r="3.2" />
  </g>;
}

// 共用的漸層、紋理與圖樣；id 需要在同一頁唯一，所以帶入元件前綴。
export function EnvelopeDefs({ prefix }) {
  return <svg className="sgr-svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${prefix}-paper-back`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f3e6e1" /><stop offset="1" stopColor="#dcc5c5" />
      </linearGradient>
      <linearGradient id={`${prefix}-paper-side`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ecdcd8" /><stop offset="1" stopColor="#f6ebe7" />
      </linearGradient>
      <linearGradient id={`${prefix}-paper-bottom`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fcf5f2" /><stop offset="1" stopColor="#ecdcd9" />
      </linearGradient>
      <linearGradient id={`${prefix}-paper-flap`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f8eeea" /><stop offset="1" stopColor="#e8d5d2" />
      </linearGradient>
      <pattern id={`${prefix}-lining`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
        <rect width="22" height="22" fill="#4a3150" />
        <circle cx="5" cy="5" r="1.6" fill="#f1b9d0" opacity=".75" />
        <circle cx="16" cy="15" r="1.1" fill="#ffe3a8" opacity=".6" />
      </pattern>
      <radialGradient id={`${prefix}-wax`} cx=".36" cy=".3" r=".75">
        <stop offset="0" style={{ stopColor: "var(--sgr-seal2)" }} />
        <stop offset=".55" style={{ stopColor: "var(--sgr-seal)" }} />
        <stop offset="1" style={{ stopColor: "color-mix(in srgb,var(--sgr-seal) 68%,#000)" }} />
      </radialGradient>
      <radialGradient id={`${prefix}-gloss`} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff" stopOpacity=".75" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      {/* 紙張纖維：細碎雜訊只疊在圖形範圍內，以 multiply 融入底色 */}
      <filter id={`${prefix}-grain`} x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 .5  0 0 0 0 .38  0 0 0 0 .4  0 0 0 .13 0" result="tint" />
        <feComposite in="tint" in2="SourceGraphic" operator="in" result="grain" />
        <feBlend in="grain" in2="SourceGraphic" mode="multiply" />
      </filter>
      {/* 所有信封圖層共用同一個圓角外框，避免摺片尖角從圓角外露出 */}
      <clipPath id={`${prefix}-env-clip`} clipPathUnits="userSpaceOnUse">
        <rect width="290" height="200" rx={ENVELOPE_RADIUS} />
      </clipPath>
      <filter id={`${prefix}-soft`} x="-10%" y="-10%" width="120%" height="130%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
    </defs>
  </svg>;
}

export function EnvelopeBack({ prefix }) {
  return <svg className="sgr-svg" viewBox={ENVELOPE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <g clipPath={`url(#${prefix}-env-clip)`}>
      <rect width="290" height="200" rx={ENVELOPE_RADIUS} fill={`url(#${prefix}-paper-back)`} filter={`url(#${prefix}-grain)`} />
      {/* 信封內襯：信封蓋掀開後，從 V 形開口看得到的夜色花紋紙 */}
      <rect x="7" y="6" width="276" height="150" rx="5" fill={`url(#${prefix}-lining)`} />
      <rect x="7" y="6" width="276" height="150" rx="5" fill="none" stroke="#f4d9e3" strokeOpacity=".35" />
    </g>
  </svg>;
}

export function EnvelopeFront({ prefix }) {
  return <svg className="sgr-svg" viewBox={ENVELOPE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <g clipPath={`url(#${prefix}-env-clip)`}>
      {/* 左右側摺片 */}
      <path d="M0,2 L140,112 Q145,116 150,112 L290,2 V191 Q290,200 281,200 H9 Q0,200 0,191 Z" fill={`url(#${prefix}-paper-side)`} filter={`url(#${prefix}-grain)`} />
      <path d="M0,2 L140,112 Q145,116 150,112 L290,2" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" />
      {/* 下摺片：邊緣帶一道柔和陰影，看起來疊在側摺片上 */}
      <path d="M2,200 L128,104 Q145,91 162,104 L288,200 Z" fill="#7a5560" opacity=".22" filter={`url(#${prefix}-soft)`} transform="translate(0 -2)" />
      <path d="M0,200 L128,106 Q145,93 162,106 L290,200 Z" fill={`url(#${prefix}-paper-bottom)`} filter={`url(#${prefix}-grain)`} />
      <path d="M0,200 L128,106 Q145,93 162,106 L290,200" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1" />
    </g>
  </svg>;
}

export function EnvelopeFlap({ prefix }) {
  return <>
    <svg className="sgr-svg sgr-flap-face" viewBox={ENVELOPE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g clipPath={`url(#${prefix}-env-clip)`}>
        <path d="M2,8 L143,132 Q145,134 147,132 L288,8 Z" fill="#6d4b56" opacity=".28" filter={`url(#${prefix}-soft)`} />
        <path d="M0,6 Q0,0 7,0 H283 Q290,0 290,6 L155,120 Q145,129 135,120 Z" fill={`url(#${prefix}-paper-flap)`} filter={`url(#${prefix}-grain)`} />
        <path d="M0,6 L135,120 Q145,129 155,120 L290,6" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
      </g>
    </svg>
    {/* 信封蓋內側：翻開後朝向玩家的一面，底邊貼齊信封上緣、尖端朝上 */}
    <svg className="sgr-svg sgr-flap-inner" viewBox={ENVELOPE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g clipPath={`url(#${prefix}-env-clip)`}>
        <path d="M0,194 Q0,200 7,200 H283 Q290,200 290,194 L155,80 Q145,71 135,80 Z" fill={`url(#${prefix}-paper-back)`} filter={`url(#${prefix}-grain)`} />
        <path d="M12,196 L145,84 L278,196 Z" fill={`url(#${prefix}-lining)`} opacity=".9" />
      </g>
    </svg>
  </>;
}

export function WaxSeal({ prefix }) {
  return <svg className="sgr-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    {WAX_DRIPS.map((path) => <path key={path} d={path} fill={`url(#${prefix}-wax)`} />)}
    <path d={WAX_OUTLINE} fill={`url(#${prefix}-wax)`} />
    {/* 壓印凹槽：內圈深色、外側一圈亮邊，做出蠟被印章壓下去的厚度 */}
    <circle cx="50" cy="50" r="31" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="2.4" transform="translate(.8 1)" />
    <circle cx="50" cy="50" r="31" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="2.4" />
    <circle cx="50" cy="50" r="29.5" style={{ fill: "color-mix(in srgb,var(--sgr-seal) 88%,#000)" }} opacity=".55" />
    <Sakura fill="#fff" dx={.7} dy={.9} opacity={.32} />
    <Sakura fill="#000" dx={-.6} dy={-.7} opacity={.3} />
    <Sakura fill={`url(#${prefix}-wax)`} />
    <ellipse cx="36" cy="30" rx="15" ry="8" fill={`url(#${prefix}-gloss)`} transform="rotate(-28 36 30)" />
  </svg>;
}
