import React, { useMemo } from "react";

// 主題粒子：分遠／中／近三層，遠層小而淡、移動慢，近層大而清楚、移動快，做出景深。
// 首頁上遠、中層在圖示後方，近層浮在圖示前方；打開 App 時只暫停不卸載，回首頁接續原位置。
const THEME_FX = {
  "莓果蘇打": { kind: "bubble", size: [10, 24], duration: [13, 19], counts: [6, 5, 3] },
  "夜色絨幕": { kind: "star", size: [8, 15], duration: [3.6, 6.4], counts: [9, 6, 1] },
  "抹茶檸檬": { kind: "leaf", size: [12, 19], duration: [14, 20], counts: [5, 4, 3] },
  "海鹽汽水": { kind: "fizz", size: [5, 11], duration: [6, 10], counts: [9, 7, 3] },
  "蜜桃慕斯": { kind: "petal", size: [9, 14], duration: [13, 19], counts: [5, 4, 3] },
};

const LAYERS = [
  { scale: 0.6, opacity: 0.38, speed: 1.45 },
  { scale: 1, opacity: 0.62, speed: 1 },
  { scale: 1.45, opacity: 0.85, speed: 0.78 },
];

// 固定種子的亂數，讓每次渲染位置一致，不會因重繪而跳動。
function seededRandom(seedText) {
  let seed = [...seedText].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(themeName, config) {
  const random = seededRandom(themeName);
  const between = ([min, max]) => min + random() * (max - min);
  return LAYERS.map((layer, depth) => Array.from({ length: config.counts[depth] }, (_, index) => {
    const duration = between(config.duration) * layer.speed;
    const shooting = config.kind === "star" && depth === 2;
    return {
      key: `${depth}-${index}`,
      depth,
      alt: index % 3 === 2,
      shooting,
      style: {
        "--x": `${(4 + random() * 92).toFixed(1)}%`,
        "--y": `${(6 + random() * 70).toFixed(1)}%`,
        "--s": `${(between(config.size) * layer.scale).toFixed(1)}px`,
        "--o": layer.opacity.toFixed(2),
        "--d": `${(shooting ? 11 : duration).toFixed(2)}s`,
        "--delay": `${(shooting ? -2 : -random() * duration).toFixed(2)}s`,
        "--sway": `${((random() - 0.5) * 46 * layer.scale).toFixed(1)}px`,
        "--spin": `${Math.round((random() > 0.5 ? 1 : -1) * (180 + random() * 360))}deg`,
        "--flutter": `${(1.8 + random() * 1.6).toFixed(2)}s`,
      },
    };
  })).flat();
}

export default function ThemeParticles({ themeName, layer = "all", paused = false }) {
  const config = THEME_FX[themeName] || THEME_FX["莓果蘇打"];
  const particles = useMemo(() => buildParticles(themeName || "莓果蘇打", config), [themeName, config]);
  const visible = particles.filter((particle) => (
    layer === "all" || (layer === "front" ? particle.depth === 2 : particle.depth < 2)
  ));
  if (!visible.length) return null;
  return (
    <div className={`mp-fx mp-fx-${layer} ${paused ? "is-paused" : ""}`} data-kind={config.kind} aria-hidden="true">
      {visible.map((particle) => (
        <i
          key={particle.key}
          className={`${particle.alt ? "alt" : ""} ${particle.shooting ? "shoot" : ""}`.trim() || undefined}
          data-depth={particle.depth}
          style={particle.style}
        />
      ))}
    </div>
  );
}
