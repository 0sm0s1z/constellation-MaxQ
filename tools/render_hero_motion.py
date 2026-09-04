#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "web/public/art/rocket-layers"
OUT = ROOT / "web/public/art"
FRAMES = ROOT / ".hero-motion-frames"

W, H = 660, 460
FPS = 24
FRAME_COUNT = 145
PLATE_X, PLATE_Y = 60, 68

# Tester PASS cloud seating (screen face) — keep.
PAD = np.float32([295.0, 205.0])
ROCKET_START = np.float32([298.0, 158.0])
ROCKET_END = np.float32([310.0, 14.0])
ROCKET_W = 61
ROCKET_REST_ANGLE_DEG = -38.0
NOZZLE_OVERLAP = 16.0
FLAME_CANONICAL_HEIGHT = 250
FLAME_WIDTH_SCALE = 0.22

PAD_PUFF_SPECS = (
    (0, 78, (-10, -18), 0.72),
    (1, 92, (2, -34), 0.80),
    (2, 80, (14, -22), 0.74),
    (3, 70, (-2, -48), 0.64),
)


def alpha_scale(im: Image.Image, factor: float) -> Image.Image:
    out = im.copy()
    a = np.asarray(out.getchannel("A"), dtype=np.float32) * factor
    out.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))
    return out


def glow_layer(im: Image.Image, radius: float, opacity: float) -> Image.Image:
    blurred = im.filter(ImageFilter.GaussianBlur(radius))
    rgb = np.asarray(blurred.convert("RGB"), dtype=np.float32)
    a = np.asarray(blurred.getchannel("A"), dtype=np.float32) * opacity
    a = np.clip(a, 0, 255)
    a[a < 4] = 0
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    out.putalpha(Image.fromarray(a.astype(np.uint8), "L"))
    return out


def ease(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def progress(t: float) -> float:
    if t < 0.08:
        return 0.0
    if t < 0.50:
        return ease((t - 0.08) / 0.42)
    if t < 0.60:
        return 1.0
    if t < 0.94:
        return 1.0 - ease((t - 0.60) / 0.34)
    return 0.0


def radial_blob(canvas, center, radius, alpha, color):
    size = int(radius * 4)
    blob = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2)
    a = (np.clip(1.0 - d / (radius * 1.6), 0.0, 1.0) ** 2 * alpha).astype(np.uint8)
    blob.paste(Image.new("RGB", (size, size), color), (0, 0))
    blob.putalpha(Image.fromarray(a, "L"))
    canvas.alpha_composite(blob, (round(center[0] - size / 2), round(center[1] - size / 2)))


def trim_alpha(im, threshold=6):
    alpha = np.asarray(im.getchannel("A"))
    ys, xs = np.nonzero(alpha > threshold)
    if len(xs) == 0:
        raise RuntimeError("asset has no visible alpha")
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fit_max_dimension(im, target):
    scale = target / max(im.width, im.height)
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    return im.resize(size, Image.Resampling.LANCZOS)


def canonicalize_flame(im):
    src = trim_alpha(im, 10)
    alpha = np.asarray(src.getchannel("A"), dtype=np.float32)
    ys, xs = np.nonzero(alpha > 36)
    if len(xs) < 16:
        raise RuntimeError("flame-trail alpha is too sparse")
    weights = alpha[ys, xs]
    coords = np.column_stack((xs.astype(np.float64), ys.astype(np.float64)))
    center = np.average(coords, axis=0, weights=weights)
    centered = coords - center
    cov = (centered * weights[:, None]).T @ centered / weights.sum()
    _, vecs = np.linalg.eigh(cov)
    axis = vecs[:, -1]
    axis_angle = math.degrees(math.atan2(float(axis[1]), float(axis[0])))
    candidates = []
    for angle in (90.0 - axis_angle, axis_angle - 90.0, -90.0 - axis_angle, axis_angle + 90.0):
        candidates.append(trim_alpha(src.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True), 8))
    flame = max(candidates, key=lambda q: q.height / max(1, q.width))
    a = np.asarray(flame.getchannel("A"))
    band = max(1, flame.height // 5)
    top_width = np.count_nonzero(a[:band] > 24, axis=1).mean()
    bottom_width = np.count_nonzero(a[-band:] > 24, axis=1).mean()
    if top_width > bottom_width:
        flame = flame.rotate(180, resample=Image.Resampling.BICUBIC, expand=False)
    flame = trim_alpha(flame, 6)
    scale = FLAME_CANONICAL_HEIGHT / flame.height
    size = (max(1, round(flame.width * scale)), FLAME_CANONICAL_HEIGHT)
    flame = flame.resize(size, Image.Resampling.LANCZOS)
    thin_w = max(12, round(flame.width * FLAME_WIDTH_SCALE))
    flame = trim_alpha(flame.resize((thin_w, flame.height), Image.Resampling.LANCZOS), 4)
    a = np.asarray(flame.getchannel("A"), dtype=np.float32)
    xs = np.linspace(-1.0, 1.0, a.shape[1], dtype=np.float32)
    falloff = np.clip(1.0 - np.abs(xs) ** 1.15, 0.0, 1.0)[None, :]
    a *= falloff
    a[a < 6] = 0
    out = flame.copy()
    out.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))
    return trim_alpha(out, 4)


def load_assets():
    plate = Image.open(ART / "plate.webp").convert("RGBA").resize((540, 376), Image.Resampling.LANCZOS)
    rocket = Image.open(ART / "rocket-trim.webp").convert("RGBA")
    rocket_h = round(rocket.height * ROCKET_W / rocket.width)
    rocket = rocket.resize((ROCKET_W, rocket_h), Image.Resampling.LANCZOS)
    puffs = [Image.open(ART / f"smoke-puff-{i:02d}.webp").convert("RGBA") for i in range(1, 5)]
    flame = canonicalize_flame(Image.open(ART / "flame-trail.webp").convert("RGBA"))
    return plate, rocket, puffs, flame


def build_static_pad(puffs):
    pad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for puff_index, target, offset, opacity in PAD_PUFF_SPECS:
        puff = alpha_scale(fit_max_dimension(trim_alpha(puffs[puff_index], 6), target), opacity)
        x = round(float(PAD[0]) + offset[0] - puff.width / 2)
        y = round(float(PAD[1]) + offset[1] - puff.height / 2)
        pad.alpha_composite(puff, (x, y))
    return pad


def oriented_flame(flame, pad, nozzle):
    vector = nozzle - pad
    distance = float(np.hypot(vector[0], vector[1]))
    if distance <= 1.0:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0)), (round(pad[0]), round(pad[1]))
    unit = vector / distance
    visible = min(flame.height, max(1, round(distance + NOZZLE_OVERLAP)))
    segment = flame.crop((0, flame.height - visible, flame.width, flame.height))
    angle = -math.degrees(math.atan2(float(vector[0]), float(-vector[1])))
    rotated = segment.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    a = np.asarray(rotated.getchannel("A"))
    ys, xs = np.nonzero(a > 20)
    if len(xs) == 0:
        return rotated, (round(float(nozzle[0]) - rotated.width / 2), round(float(nozzle[1]) - rotated.height / 2))
    pts = np.column_stack((xs.astype(np.float64), ys.astype(np.float64)))
    tip = pts[int(np.argmax(pts @ unit))]
    return rotated, (round(float(nozzle[0]) - tip[0]), round(float(nozzle[1]) - tip[1]))


def render():
    plate, rocket_rest, puffs, flame = load_assets()
    static_pad = build_static_pad(puffs)
    path = ROCKET_END - ROCKET_START
    unit = path / max(1e-3, float(np.hypot(path[0], path[1])))
    path_angle = -math.degrees(math.atan2(float(path[0]), float(-path[1])))
    spin = path_angle - ROCKET_REST_ANGLE_DEG
    rocket_i = rocket_rest.rotate(spin, resample=Image.Resampling.BICUBIC, expand=True)
    a = np.asarray(rocket_i.getchannel("A"))
    ys, xs = np.nonzero(a > 20)
    pts = np.column_stack((xs.astype(np.float64), ys.astype(np.float64)))
    tail = pts[int(np.argmin(pts @ unit))]
    FRAMES.mkdir(exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()
    for index in range(FRAME_COUNT):
        pr = progress(index / (FRAME_COUNT - 1))
        nozzle = ROCKET_START + path * pr
        place = nozzle - tail
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.alpha_composite(plate, (PLATE_X, PLATE_Y))
        trail, trail_xy = oriented_flame(flame, PAD, nozzle)
        frame.alpha_composite(glow_layer(trail, 3, 0.06), trail_xy)
        frame.alpha_composite(alpha_scale(trail, 0.92), trail_xy)
        frame.alpha_composite(static_pad)
        stitch = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        radial_blob(stitch, tuple(nozzle), 3, 36, (255, 190, 140))
        radial_blob(stitch, tuple(nozzle), 2, 100, (255, 248, 230))
        frame.alpha_composite(stitch)
        xy = (round(float(place[0])), round(float(place[1])))
        frame.alpha_composite(glow_layer(rocket_i, 5, 0.20), xy)
        frame.alpha_composite(rocket_i, xy)
        frame.save(FRAMES / f"f{index:04d}.png")
    Image.open(FRAMES / "f0000.png").save(OUT / "hero-launch-poster.webp", "WEBP", quality=92, method=6)


if __name__ == "__main__":
    render()
