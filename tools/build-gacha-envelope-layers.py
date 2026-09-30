"""從「關著／打開」兩張白底信封插畫拆出櫻色誓約揭曉動畫的圖層。

用法：python3 tools/build-gacha-envelope-layers.py <打開.webp> <關著.webp> [輸出資料夾]
需要：pip install pillow numpy
輸出：envelope-lining / envelope-pocket / envelope-flap-outer / envelope-flap-inner、
      三種稀有度蠟封 seal-r / seal-sr / seal-ssr（WebP），以及 geometry.json。
geometry.json 的比例需同步到 GachaRevealSequence.jsx 的 .sgr-env／.sgr-seal 等 CSS。
部分閾值（信封本體上緣 HINGE、蠟封取樣點）是依目前這組素材量出來的，換圖時要重新確認。
"""
import sys, json
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
OPEN, CLOSED = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else "components/gacha/assets/envelope"
o = np.asarray(Image.open(OPEN).convert("RGB")).astype(int)
c = np.asarray(Image.open(CLOSED).convert("RGB")).astype(int)
H, W = o.shape[:2]

def flood_bg(a, thr=28):
    white = (255 * 3 - a.sum(2)) < thr * 3
    reach = np.zeros_like(white)
    reach[0], reach[-1], reach[:, 0], reach[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
    while True:
        n = reach.copy(); n[1:] |= reach[:-1]; n[:-1] |= reach[1:]; n[:, 1:] |= reach[:, :-1]; n[:, :-1] |= reach[:, 1:]; n &= white
        if (n == reach).all(): return ~reach
        reach = n

def rgba(a, mask, blur=0.8):
    im = Image.fromarray(a.astype(np.uint8)).convert("RGBA")
    im.putalpha(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur)))
    return im

# ---- 打開的信封：內襯／口袋／信封蓋內側
HINGE = 398
env = flood_bg(o)
yy = np.arange(H)[:, None] * np.ones((1, W), bool)
light = o.max(2) >= 165
cand = Image.fromarray(((light & env & (yy >= HINGE)) * 255).astype(np.uint8))
pocket = (np.asarray(cand.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(11))) > 127) & env & light
lining = env & (yy >= HINGE) & ~pocket
flap_in = env & (yy < HINGE)

# ---- 關著的信封：蠟封
Rc, Gc, Bc = c[:, :, 0], c[:, :, 1], c[:, :, 2]
sat = (c.max(2) - c.min(2)) / np.maximum(c.max(2), 1)
sealish = (sat > 0.22) & (Bc >= Gc - 8) & (Rc > Bc)
reach = np.zeros_like(sealish); reach[540, 740] = True
while True:
    n = reach.copy(); n[1:] |= reach[:-1]; n[:-1] |= reach[1:]; n[:, 1:] |= reach[:, :-1]; n[:, :-1] |= reach[:, 1:]; n &= sealish
    if (n == reach).all(): break
    reach = n
m = np.asarray(Image.fromarray((reach * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))) > 127
ys, xs = np.where(m)
sb = (xs.min() - 8, ys.min() - 8, xs.max() + 9, ys.max() + 9)
sub = m[sb[1]:sb[3], sb[0]:sb[2]]
out = np.zeros_like(sub); out[0], out[-1], out[:, 0], out[:, -1] = ~sub[0], ~sub[-1], ~sub[:, 0], ~sub[:, -1]
while True:
    n = out.copy(); n[1:] |= out[:-1]; n[:-1] |= out[1:]; n[:, 1:] |= out[:, :-1]; n[:, :-1] |= out[:, 1:]; n &= ~sub
    if (n == out).all(): break
    out = n
seal_mask_local = ~out
seal_mask = np.zeros(c.shape[:2], bool); seal_mask[sb[1]:sb[3], sb[0]:sb[2]] = seal_mask_local
seal_center = ((sb[0] + sb[2]) / 2, (sb[1] + sb[3]) / 2)

# ---- 關著的信封蓋：以金邊擬合兩條邊線
gold = (Rc - Bc > 70) & (Gc - Bc > 35) & (Rc > 170) & (Rc - Gc < 80)
def fit(side):
    pts = []
    for y in range(100, 440, 5):
        xr = 1.32 * (y - 90) + 45 if side == "L" else 1465 - 1.31 * (y - 90)
        lo, hi = int(xr - 30), int(xr + 30)
        xg = np.where(gold[y, lo:hi])[0] + lo
        if len(xg): pts.append((y, xg.mean()))
    p = np.array(pts); k, b = np.polyfit(p[:, 0], p[:, 1], 1)
    p = p[np.abs(p[:, 1] - (k * p[:, 0] + b)) < 6]; return np.polyfit(p[:, 0], p[:, 1], 1)
kl, bl = fit("L"); kr, br = fit("R")
tip_y = (br - bl) / (kl - kr); tip = (kl * tip_y + bl, tip_y)
cenv = flood_bg(c); cy, cx = np.where(cenv)
TOP, LEFT, RIGHT = cy.min(), cx.min(), cx.max()
EDGE = 5  # 往外多留金邊與毛邊
poly = [(LEFT, TOP), (RIGHT, TOP), (RIGHT, (br - RIGHT) / -kr + EDGE), (tip[0], tip[1] + EDGE * 1.6), (LEFT, (LEFT - bl) / kl + EDGE)]
pm = Image.new("L", (c.shape[1], c.shape[0]), 0); ImageDraw.Draw(pm).polygon(poly, fill=255)
flap_mask = (np.asarray(pm) > 127) & cenv

# 蠟封底下的信封蓋尖端：沿兩條邊線方向複製紙張與金邊補回
hole = np.asarray(Image.fromarray((seal_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(31))) > 127
patched = c.copy()
uL = np.array([kl, 1.0]); uL /= np.linalg.norm(uL)
uR = np.array([kr, 1.0]); uR /= np.linalg.norm(uR)
hy, hx = np.where(hole & (np.arange(c.shape[0])[:, None] < tip[1] + 40))
for u, sel in ((uL, hx < tip[0]), (uR, hx >= tip[0])):
    px, py = hx[sel].astype(float), hy[sel].astype(float)
    done = np.zeros(len(px), bool)
    for k in range(1, 400):
        sx = np.round(px - u[0] * k).astype(int); sy = np.round(py - u[1] * k).astype(int)
        ok = (~done) & (sy >= 0) & (sx >= 0) & (sx < c.shape[1]) & ~hole[np.clip(sy, 0, c.shape[0] - 1), np.clip(sx, 0, c.shape[1] - 1)]
        patched[py[ok].astype(int), px[ok].astype(int)] = c[sy[ok], sx[ok]]
        done |= ok
        if done.all(): break

# ---- 以打開的信封為基準座標：等比例縮放關著的信封蓋，鉸鏈對齊信封本體上緣
oy, ox = np.where(env & (yy >= HINGE)); OL, OR = ox.min(), ox.max()
scale = (OR - OL) / (RIGHT - LEFT)
fx0, fy0 = LEFT, TOP
fw, fh = RIGHT - LEFT + 1, int(tip[1] + 12 - TOP)
flap_front = rgba(patched, flap_mask)
flap_front = flap_front.crop((fx0, fy0, fx0 + fw, fy0 + fh)).resize((int(fw * scale), int(fh * scale)), Image.LANCZOS)
seal_img = rgba(c, seal_mask, 0.9).crop(sb)
seal_img = seal_img.resize((int(seal_img.width * scale), int(seal_img.height * scale)), Image.LANCZOS)
seal_pos = (OL + (seal_center[0] - LEFT) * scale, HINGE + (seal_center[1] - TOP) * scale)

# ---- 共同畫布：裁切打開的信封範圍，並容納關著的信封蓋長度
CX0, CX1 = OL - 12, OR + 13
CY0 = 0
CY1 = max(H, int(HINGE + flap_front.height + 20))
CW, CH = CX1 - CX0, CY1 - CY0
def canvas_layer(mask):
    full = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    full.alpha_composite(rgba(o, mask).crop((CX0, CY0, CX1, min(CY1, H))), (0, 0))
    return full
TARGET_W = 900
k = TARGET_W / CW
def export(im, name, q=84):
    im.save(f"{OUT}/{name}.webp", "WEBP", quality=q, method=6)
def scaled(im): return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
export(scaled(canvas_layer(lining)), "envelope-lining")
export(scaled(canvas_layer(pocket)), "envelope-pocket")
inner = rgba(o, flap_in).crop((CX0, HINGE - (HINGE - env.nonzero()[0].min()) - 2, CX1, HINGE))
export(scaled(inner), "envelope-flap-inner")
front = Image.new("RGBA", (CW, flap_front.height), (0, 0, 0, 0)); front.alpha_composite(flap_front, (OL - CX0, 0))
export(scaled(front), "envelope-flap-outer")

# ---- 蠟封三種稀有度（以 HSV 調色，保留光澤與壓紋）
def recolor(im, hue, sat_mul, val_mul):
    a = np.asarray(im).astype(float) / 255
    rgb = a[:, :, :3]; mx = rgb.max(2); mn = rgb.min(2); d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    s2 = np.clip(s * sat_mul, 0, 1); v2 = np.clip(mx * val_mul, 0, 1)
    h = np.full_like(mx, hue / 360)
    i = np.floor(h * 6); f = h * 6 - i; p = v2 * (1 - s2); q_ = v2 * (1 - f * s2); t = v2 * (1 - (1 - f) * s2)
    i = i.astype(int) % 6
    r = np.choose(i, [v2, q_, p, p, t, v2]); g = np.choose(i, [t, v2, v2, q_, p, p]); b = np.choose(i, [p, p, t, v2, v2, q_])
    return Image.fromarray((np.dstack([r, g, b, a[:, :, 3]]) * 255).astype(np.uint8), "RGBA")
seal_small = seal_img.resize((max(1, round(seal_img.width * k * 1.6)), max(1, round(seal_img.height * k * 1.6))), Image.LANCZOS)
export(seal_small, "seal-sr", 88)
export(recolor(seal_small, 38, 1.35, 1.02), "seal-ssr", 88)
export(recolor(seal_small, 228, 0.62, 0.9), "seal-r", 88)

geo = {
    "canvas": [CW, CH], "hinge": HINGE / CH,
    "flapOuter": front.height / CH, "flapInner": inner.height / CH,
    "bodyTop": HINGE / CH, "bodyBottom": (oy.max()) / CH,
    "bodyLeft": (OL - CX0) / CW, "bodyRight": (OR - CX0) / CW,
    "seal": [(seal_pos[0] - CX0) / CW, seal_pos[1] / CH, seal_img.width / CW],
}
geo = json.loads(json.dumps(geo, default=float)); json.dump(geo, open(f"{OUT}/geometry.json", "w"), indent=1)
print(json.dumps(geo, indent=1, default=float)); print("tip", tip, "scale", scale)
