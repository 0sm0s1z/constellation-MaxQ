#!/usr/bin/env python3
from __future__ import annotations

import math
import random
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public" / "art"
LAYERS = ART / "rocket-layers"
FRAMES = ROOT / ".hero-render-frames"
OUT = ART / "hero-launch.webm"

W, H = 1503, 1047
FPS = 30
FORWARD_S = 5.5
TOTAL_S = FORWARD_S * 2.0
N = int(TOTAL_S * FPS)

PEACH = (250, 179, 135)
MAUVE = (203, 166, 247)
WARM_WHITE = (255, 248, 228)


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def smooth(v: float) -> float:
    v = clamp(v)
    return v * v * (3.0 - 2.0 * v)


def keyed(progress: float, points: list[tuple[float, float]]) -> float:
    if progress <= points[0][0]:
        return points[0][1]
    if progress >= points[-1][0]:
        return points[-1][1]
    for (a, av), (b, bv) in zip(points, points[1:]):
        if a <= progress <= b:
            t = smooth((progress - a) / (b - a))
            return av + (bv - av) * t
    return points[-1][1]


def rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def scale_to_width(img: Image.Image, width: int) -> Image.Image:
    height = max(1, round(img.height * width / img.width))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def alpha_scale(alpha: Image.Image, amount: float) -> Image.Image:
    return alpha.point(lambda p: round(p * clamp(amount)))


def alpha_over(dst: Image.Image, src: Image.Image, xy: tuple[int, int]) -> None:
    dst.alpha_composite(src, dest=xy)


def prepare_reveal_field(size: tuple[int, int]) -> np.ndarray:
    fw, fh = size
    x = np.linspace(0.0, 1.0, fw, dtype=np.float32)[None, :]
    y = np.linspace(0.0, 1.0, fh, dtype=np.float32)[:, None]
    return 0.54 * x + 0.46 * (1.0 - y)


def flame_reveal_mask(field: np.ndarray, reveal: float) -> Image.Image:
    r = 0.16 + 0.84 * clamp(reveal)
    edge = 0.105
    threshold = 1.0 - r
    d = np.clip((field - threshold) / edge, 0.0, 1.0)
    a = d * d * (3.0 - 2.0 * d)
    return Image.fromarray(np.rint(a * 255.0).astype(np.uint8), mode="L")


def prepare_flame() -> tuple[Image.Image, Image.Image, list[tuple[Image.Image, tuple[int, int, int], float]]]:
    flame = scale_to_width(rgba(LAYERS / "flame-trail.webp"), round(W * 0.46))
    flame = ImageEnhance.Color(flame).enhance(1.16)
    flame = ImageEnhance.Contrast(flame).enhance(1.04)
    flame = ImageEnhance.Brightness(flame).enhance(1.08)
    flame = flame.rotate(-9.5, resample=Image.Resampling.BICUBIC, expand=True)
    base_alpha = flame.getchannel("A")
    glow_specs = []
    for radius, color, base_op in [
        (28, PEACH, 0.22),
        (12, (255, 226, 188), 0.30),
        (5, WARM_WHITE, 0.24),
    ]:
        glow_specs.append((base_alpha.filter(ImageFilter.GaussianBlur(radius)), color, base_op))
    return flame, base_alpha, glow_specs


def compose_static_base() -> Image.Image:
    plate = rgba(LAYERS / "plate.webp")
    if plate.size != (W, H):
        plate = plate.resize((W, H), Image.Resampling.LANCZOS)

    puffs = [rgba(LAYERS / f"smoke-puff-0{i}.webp") for i in range(1, 5)]
    cx, cy = round(W * 0.445), round(H * 0.555)
    group = round(W * 0.30)
    specs = [
        (0, 1.00, 0.00, 0.00, 0.66, 1.6),
        (1, 0.78, 0.12, -0.06, 0.58, 1.2),
        (2, 0.92, -0.12, 0.08, 0.62, 1.8),
        (3, 0.68, 0.04, 0.12, 0.50, 2.1),
    ]
    for idx, scale, ox, oy, op, blur in specs:
        puff = scale_to_width(puffs[idx], max(1, round(group * scale)))
        alpha = puff.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
        puff.putalpha(alpha_scale(alpha, op))
        x = round(cx + ox * group - puff.width / 2)
        y = round(cy + oy * group - puff.height / 2)
        alpha_over(plate, puff, (x, y))
    return plate


def prepare_rocket() -> tuple[Image.Image, Image.Image, Image.Image]:
    rocket = scale_to_width(rgba(LAYERS / "rocket-trim.webp"), round(W * 0.10))
    a = rocket.getchannel("A")
    peach = Image.new("RGBA", rocket.size, PEACH + (0,))
    peach.putalpha(a.filter(ImageFilter.GaussianBlur(16)))
    mauve = Image.new("RGBA", rocket.size, MAUVE + (0,))
    mauve.putalpha(a.filter(ImageFilter.GaussianBlur(28)))
    return rocket, peach, mauve


def nozzle_tile(nozzle: tuple[float, float], progress: float) -> tuple[Image.Image, tuple[int, int]]:
    nx, ny = nozzle
    px, py = W * 0.445, H * 0.555
    vx, vy = px - nx, py - ny
    mag = max(1.0, math.hypot(vx, vy))
    ux, uy = vx / mag, vy / mag
    length = 58 + 34 * progress
    ex, ey = nx + ux * length, ny + uy * length

    margin = 64
    x0 = math.floor(min(nx, ex) - margin)
    y0 = math.floor(min(ny, ey) - margin)
    x1 = math.ceil(max(nx, ex) + margin)
    y1 = math.ceil(max(ny, ey) + margin)
    tw, th = max(1, x1 - x0), max(1, y1 - y0)
    sx, sy = nx - x0, ny - y0
    tx, ty = ex - x0, ey - y0

    tile = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    layers = [
        (52 + 20 * progress, PEACH, 88, 20),
        (30 + 12 * progress, (255, 208, 159), 150, 11),
        (14 + 6 * progress, WARM_WHITE, 230, 5),
        (5 + 2 * progress, (255, 255, 249), 255, 1.5),
    ]
    for width, color, alpha, blur in layers:
        layer = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        a = round(alpha * (0.72 + 0.28 * progress))
        d.line((sx, sy, tx, ty), fill=color + (a,), width=max(1, round(width)))
        d.ellipse((sx - width * 0.5, sy - width * 0.5, sx + width * 0.5, sy + width * 0.5), fill=color + (round(alpha * 0.82),))
        if blur:
            layer = layer.filter(ImageFilter.GaussianBlur(blur))
        tile.alpha_composite(layer)
    return tile, (x0, y0)


def draw_embers(frame: Image.Image, progress: float, phase: float) -> None:
    if progress < 0.18:
        return
    rng = random.Random(0x4D415851)
    d = ImageDraw.Draw(frame)
    pad = (W * 0.445, H * 0.555)
    for i in range(18):
        base_t = rng.uniform(0.08, 0.86) * progress
        angle = math.radians(-49 + rng.uniform(-18, 18))
        dist = 60 + 310 * base_t
        x = pad[0] + math.cos(angle) * dist + rng.uniform(-28, 28)
        y = pad[1] + math.sin(angle) * dist + rng.uniform(-20, 20)
        flicker = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(phase * 2 * math.pi + i * 1.77))
        a = round(175 * progress * flicker)
        r = 1.2 + 2.6 * rng.random()
        d.ellipse((x - r * 3.2, y - r * 3.2, x + r * 3.2, y + r * 3.2), fill=PEACH + (max(0, a // 7),))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 224, 184, a))


def render() -> None:
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)

    static_base = compose_static_base()
    rocket, rocket_peach, rocket_mauve = prepare_rocket()
    flame, flame_alpha, flame_glows = prepare_flame()
    reveal_field = prepare_reveal_field(flame.size)

    kx = [(0.0, 0.0), (0.10, 0.0), (0.24, 0.034), (0.36, 0.062), (0.56, 0.101), (0.72, 0.131), (1.0, 0.160)]
    ky = [(0.0, 0.0), (0.10, 0.0), (0.24, -0.074), (0.36, -0.144), (0.56, -0.242), (0.72, -0.311), (1.0, -0.380)]
    flame_x = round(W * 0.02)
    flame_y = round(H * 0.28)

    for i in range(N):
        t = i / FPS
        raw = t / FORWARD_S if t <= FORWARD_S else 1.0 - (t - FORWARD_S) / FORWARD_S
        progress = smooth(raw)

        frame = static_base.copy()
        reveal = keyed(progress, [(0.0, 0.02), (0.10, 0.02), (0.24, 0.30), (0.36, 0.58), (0.56, 0.82), (0.72, 0.97), (1.0, 1.0)])
        mask = flame_reveal_mask(reveal_field, reveal)
        masked_alpha = ImageChops.multiply(flame_alpha, mask)

        for glow_alpha, color, base_op in flame_glows:
            g = Image.new("RGBA", flame.size, color + (0,))
            ga = ImageChops.multiply(glow_alpha, mask)
            g.putalpha(alpha_scale(ga, base_op + 0.28 * progress))
            alpha_over(frame, g, (flame_x, flame_y))

        flame_frame = flame.copy()
        flame_frame.putalpha(alpha_scale(masked_alpha, 0.58 + 0.42 * progress))
        alpha_over(frame, flame_frame, (flame_x, flame_y))

        dx = keyed(progress, kx) * W
        dy = keyed(progress, ky) * H
        rx = round(W * 0.40 + dx)
        ry = round(H * 0.26 + dy)
        nozzle = (W * 0.445 + dx, H * 0.442 + dy)

        tile, xy = nozzle_tile(nozzle, progress)
        alpha_over(frame, tile, xy)
        draw_embers(frame, progress, i / N)

        mg = rocket_mauve.copy()
        mg.putalpha(alpha_scale(mg.getchannel("A"), 0.10 + 0.20 * progress))
        pg = rocket_peach.copy()
        pg.putalpha(alpha_scale(pg.getchannel("A"), 0.18 + 0.30 * progress))
        alpha_over(frame, mg, (rx, ry + 4))
        alpha_over(frame, pg, (rx, ry + 2))
        alpha_over(frame, rocket, (rx, ry))

        frame.save(FRAMES / f"frame-{i:04d}.png", optimize=False)

    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(FPS),
        "-i", str(FRAMES / "frame-%04d.png"),
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0", "-crf", "25", "-b:v", "0",
        "-row-mt", "1", "-deadline", "good", "-cpu-used", "3",
        "-metadata:s:v:0", "alpha_mode=1",
        str(OUT),
    ], check=True)
    print(f"rendered {OUT} ({OUT.stat().st_size / 1024:.1f} KiB), {N} frames @ {FPS} fps")


if __name__ == "__main__":
    render()
