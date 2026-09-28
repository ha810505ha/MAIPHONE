// 櫻色誓約揭曉演出用的輕量特效：Canvas 2D 粒子與 Web Audio 合成音效。
// 不依賴外部套件，粒子只在有存活粒子或環境發射器時才跑 rAF。

const TAU = Math.PI * 2;
const rand = (min, max) => min + Math.random() * (max - min);

export class RevealParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.ambient = null;
    this.frame = 0;
    this.last = 0;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.tick = this.tick.bind(this);
    this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
  }

  // 舞台中心（卡片中心）以畫布比例表示，與 CSS 的 .sgr-stage 位置對齊。
  center() {
    return { x: this.width / 2, y: this.height * 0.46 };
  }

  add(particle) {
    if (this.particles.length > 220) return;
    this.particles.push({ age: 0, rotation: rand(0, TAU), spin: rand(-2, 2), ...particle });
    this.start();
  }

  inhale(count, color) {
    const { x, y } = this.center();
    const radius = Math.max(this.width, this.height) * 0.55;
    for (let index = 0; index < count; index += 1) {
      const angle = rand(0, TAU);
      const distance = radius * rand(0.55, 1);
      this.add({ kind: "inhale", x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, tx: x, ty: y, life: rand(0.7, 1.2), delay: rand(0, 0.45), size: rand(1.2, 2.6), color });
    }
  }

  burst(count, color, force = 1) {
    const { x, y } = this.center();
    for (let index = 0; index < count; index += 1) {
      const angle = rand(0, TAU);
      const speed = rand(60, 260) * force;
      this.add({ kind: "mote", x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 2.4, gravity: 18, life: rand(0.8, 1.6), size: rand(1.2, 3), color });
    }
  }

  petals(count, colors, fromTop = true) {
    for (let index = 0; index < count; index += 1) {
      this.add(this.makePetal(colors, fromTop));
    }
  }

  makePetal(colors, fromTop = true) {
    return {
      kind: "petal",
      x: rand(-10, this.width + 10),
      y: fromTop ? rand(-40, -8) : rand(0, this.height * 0.6),
      vx: rand(-12, 18),
      vy: rand(26, 58),
      sway: rand(0.8, 2.2),
      phase: rand(0, TAU),
      life: rand(5, 8),
      size: rand(4, 7.5),
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }

  orbit(count, color, radiusX, radiusY, fadeBelow = Infinity) {
    for (let index = 0; index < count; index += 1) {
      this.add({ kind: "orbit", angle: (index / count) * TAU, speed: rand(0.35, 0.6), rx: radiusX * rand(1, 1.08), ry: radiusY * rand(1, 1.06), life: Infinity, size: rand(1, 2.2), color, fadeBelow });
    }
  }

  // 環境發射器：揭曉後持續少量飄落花瓣；切換狀態時務必 setAmbient(null)。
  setAmbient(ambient) {
    this.ambient = ambient;
    if (ambient) this.start();
  }

  clearOrbits() {
    this.particles = this.particles.filter((particle) => particle.kind !== "orbit");
  }

  clear() {
    this.ambient = null;
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    if (this.frame) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx } = this;
    if (this.ambient && Math.random() < this.ambient.rate * dt) this.add(this.makePetal(this.ambient.colors));
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const { x: cx, y: cy } = this.center();
    this.particles = this.particles.filter((particle) => {
      particle.age += dt;
      if (particle.delay > 0) {
        particle.delay -= dt;
        return true;
      }
      if (particle.age > particle.life) return false;
      const fade = Number.isFinite(particle.life) ? Math.min(1, particle.age * 4, (particle.life - particle.age) * 2.5) : Math.min(1, particle.age * 1.5);
      if (particle.kind === "inhale") {
        const progress = Math.min(1, particle.age / particle.life);
        const eased = progress * progress * progress;
        const x = particle.x + (particle.tx - particle.x) * eased;
        const y = particle.y + (particle.ty - particle.y) * eased;
        drawMote(ctx, x, y, particle.size, particle.color, fade);
        return progress < 1;
      }
      if (particle.kind === "orbit") {
        particle.angle += particle.speed * dt;
        for (let trail = 5; trail >= 0; trail -= 1) {
          const back = particle.angle - trail * 0.05;
          const trailY = cy + Math.sin(back) * particle.ry;
          const visibility = Math.max(0, Math.min(1, (cy + particle.fadeBelow - trailY) / 24));
          if (visibility > 0) drawMote(ctx, cx + Math.cos(back) * particle.rx, trailY, particle.size * (1 - trail * 0.12), particle.color, fade * visibility * (1 - trail * 0.16));
        }
        return true;
      }
      if (particle.kind === "petal") {
        particle.phase += particle.sway * dt;
        particle.x += (particle.vx + Math.sin(particle.phase) * 22) * dt;
        particle.y += particle.vy * dt;
        particle.rotation += particle.spin * dt;
        drawPetal(ctx, particle, fade * 0.85);
        return particle.y < this.height + 20;
      }
      const drag = Math.exp(-particle.drag * dt);
      particle.vx *= drag;
      particle.vy = particle.vy * drag + particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      drawMote(ctx, particle.x, particle.y, particle.size, particle.color, fade);
      return true;
    });
    if (this.particles.length || this.ambient) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.frame = 0;
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.particles = [];
    this.ambient = null;
    this.resizeObserver?.disconnect();
  }
}

function drawMote(ctx, x, y, size, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size * 3.2, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPetal(ctx, petal, alpha) {
  ctx.save();
  ctx.translate(petal.x, petal.y);
  ctx.rotate(petal.rotation);
  ctx.scale(1, 0.55 + Math.abs(Math.sin(petal.phase)) * 0.45);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = petal.color;
  ctx.beginPath();
  ctx.moveTo(0, -petal.size);
  ctx.quadraticCurveTo(petal.size * 0.95, -petal.size * 0.2, 0, petal.size);
  ctx.quadraticCurveTo(-petal.size * 0.95, -petal.size * 0.2, 0, -petal.size);
  ctx.fill();
  ctx.restore();
}

// 音效全部即時合成，預設靜音；只有在使用者開啟聲音並互動後才建立 AudioContext。
export class RevealAudio {
  constructor() {
    this.context = null;
    this.muted = true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (!muted) this.ensure();
  }

  ensure() {
    if (this.context || typeof window === "undefined") return this.context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
    }
    return this.context;
  }

  play(name) {
    if (this.muted) return;
    const context = this.ensure();
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => {});
    const now = context.currentTime + 0.01;
    if (name === "paper") this.noise(now, 0.22, 2600, 0.18, "bandpass");
    if (name === "crack") this.noise(now, 0.07, 4200, 0.3, "highpass");
    if (name === "chime") [1318.5, 1975.5].forEach((frequency, index) => this.tone(now + index * 0.07, frequency, 0.9, 0.12, "sine"));
    if (name === "shimmer") [1568, 2093, 2637].forEach((frequency, index) => this.tone(now + index * 0.05, frequency, 1.2, 0.06, "sine"));
    if (name === "harp") [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98].forEach((frequency, index) => this.tone(now + index * 0.09, frequency, 1.6, 0.11, "triangle"));
    if (name === "tick") this.tone(now, 2200, 0.05, 0.03, "sine");
  }

  tone(start, frequency, duration, volume, type) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  noise(start, duration, frequency, volume, filterType) {
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
  }

  destroy() {
    this.context?.close?.().catch(() => {});
    this.context = null;
  }
}
