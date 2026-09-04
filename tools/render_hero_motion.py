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

# #50 cool aesthetic. Pad UP-LEFT onto SCREEN FACE. Near-vertical lift.
# Rocket sprite rotated onto path every frame so vent aligns with trail.
PAD = np.float32([278.0, 210.0])
ROCKET_START = np.float32([280.0, 160.0])
ROCKET_END = np.float32([292.0, 16.0])
ROCKET_W = 61
NOZZLE_OVERLAP = 18.0
FLAME_CANONICAL_HEIGHT = 260
FLAME_WIDTH_SCALE = 1.0  # #50 full authored flame — thinning made a square slab
ROCKET_REST_ANGLE_DEG = -38.0  # authored rocket-trim aiming (up-right)

PAD_PUFF_SPECS = (
    (0, 92, (-16, -40), 0.74),
    (1, 108, (0, -54), 0.82),
    (2, 96, (16, -44), 0.76),
    (3, 84, (2, -68), 0.66),
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


def radial_blob(
    canvas: Image.Image,
    center: tuple[float, float],
    radius: float,
    alpha: int,
    color: tuple[int, int, int],
) -> None:
    size = int(radius * 4)
    blob = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2)
    a = (np.clip(1.0 - d / (radius * 1.6), 0.0, 1.0) ** 2 * alpha).astype(np.uint8)
    blob.paste(Image.new("RGB", (size, size), color), (0, 0))
    blob.putalpha(Image.fromarray(a, "L"))
    canvas.alpha_composite(blob, (round(center[0] - size / 2), round(center[1] - size / 2)))


def trim_alpha(im: Image.Image, threshold: int = 6) -> Image.Image:
    alpha = np.asarray(im.getchannel("A"))
    ys, xs = np.nonzero(alpha > threshold)
    if len(xs) == 0:
        raise RuntimeError("asset has no visible alpha")
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fit_max_dimension(im: Image.Image, target: int) -> Image.Image:
    scale = target / max(im.width, im.height)
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    return im.resize(size, Image.Resampling.LANCZOS)


def canonicalize_flame(im: Image.Image) -> Image.Image:
    """Normalize the original flame-trail once; per-frame geometry is crop + rotation only."""
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

    candidates: list[Image.Image] = []
    for angle in (90.0 - axis_angle, axis_angle - 90.0, -90.0 - axis_angle, axis_angle + 90.0):
        q = trim_alpha(src.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True), 8)
        candidates.append(q)
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
    if FLAME_WIDTH_SCALE < 0.98:
        thin_w = max(8, round(flame.width * FLAME_WIDTH_SCALE))
        flame = trim_alpha(flame.resize((thin_w, flame.height), Image.Resampling.LANCZOS), 4)
        a = np.asarray(flame.getchannel("A"), dtype=np.float32)
        xs = np.linspace(-1.0, 1.0, a.shape[1], dtype=np.float32)
        falloff = np.clip(1.0 - np.abs(xs) ** 1.35, 0.0, 1.0)[None, :]
        a *= falloff
        out = flame.copy()
        out.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))
        return trim_alpha(out, 3)
    return trim_alpha(flame, 4)


def load_assets() -> tuple[Image.Image, Image.Image, list[Image.Image], Image.Image]:
    plate = Image.open(ART / "plate.webp").convert("RGBA").resize((540, 376), Image.Resampling.LANCZOS)
    rocket = Image.open(ART / "rocket-trim.webp").convert("RGBA")
    rocket_h = round(rocket.height * ROCKET_W / rocket.width)
    rocket = rocket.resize((ROCKET_W, rocket_h), Image.Resampling.LANCZOS)

    puffs = [
        Image.open(ART / f"smoke-puff-{i:02d}.webp").convert("RGBA")
        for i in range(1, 5)
    ]
    flame = canonicalize_flame(Image.open(ART / "flame-trail.webp").convert("RGBA"))
    return plate, rocket, puffs, flame


def build_static_pad(puffs: list[Image.Image]) -> Image.Image:
    pad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for puff_index, target, offset, opacity in PAD_PUFF_SPECS:
        puff = trim_alpha(puffs[puff_index], 6)
        puff = fit_max_dimension(puff, target)
        puff = alpha_scale(puff, opacity)
        x = round(float(PAD[0]) + offset[0] - puff.width / 2)
        y = round(float(PAD[1]) + offset[1] - puff.height / 2)
        pad.alpha_composite(puff, (x, y))
    return pad


def oriented_flame(
    flame: Image.Image,
    pad: np.ndarray,
    nozzle: np.ndarray,
) -> tuple[Image.Image, tuple[int, int]]:
    """Crop authored flame length, rotate onto pad→nozzle, snap vent tip to nozzle."""
    vector = nozzle - pad
    distance = float(np.hypot(vector[0], vector[1]))
    if distance <= 1.0:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0)), (round(pad[0]), round(pad[1]))

    unit = vector / distance
    visible = min(flame.height, max(1, round(distance + NOZZLE_OVERLAP)))
    segment = flame.crop((0, flame.height - visible, flame.width, flame.height))
    if segment.width != flame.width:
        raise RuntimeError("flame-trail width changed during reveal")

    angle = -math.degrees(math.atan2(float(vector[0]), float(-vector[1])))
    rotated = segment.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)

    a = np.asarray(rotated.getchannel("A"))
    ys, xs = np.nonzero(a > 24)
    if len(xs) == 0:
        return rotated, (round(float(nozzle[0]) - rotated.width / 2), round(float(nozzle[1]) - rotated.height / 2))
    pts = np.column_stack((xs.astype(np.float64), ys.astype(np.float64)))
    tip = pts[int(np.argmax(pts @ unit))]
    xy = (
        round(float(nozzle[0]) - tip[0]),
        round(float(nozzle[1]) - tip[1]),
    )
    return rotated, xy


def render() -> None:
    plate, rocket_rest, puffs, flame = load_assets()
    static_pad = build_static_pad(puffs)
    path = ROCKET_END - ROCKET_START
    path_len = float(np.hypot(path[0], path[1]))
    unit = path / max(1e-3, path_len)
    path_angle = -math.degrees(math.atan2(float(path[0]), float(-path[1])))
    spin = path_angle - ROCKET_REST_ANGLE_DEG

    FRAMES.mkdir(exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()

    # Pre-rotate rocket once (path angle is constant).
    rocket_i = rocket_rest.rotate(spin, resample=Image.Resampling.BICUBIC, expand=True)
    a = np.asarray(rocket_i.getchannel("A"))
    ys, xs = np.nonzero(a > 20)
    pts = np.column_stack((xs.astype(np.float64), ys.astype(np.float64)))
    tail = pts[int(np.argmin(pts @ unit))]

    for index in range(FRAME_COUNT):
        tt = index / (FRAME_COUNT - 1)
        pr = progress(tt)
        nozzle = ROCKET_START + path * pr
        place = nozzle - tail

        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.alpha_composite(plate, (PLATE_X, PLATE_Y))

        trail, trail_xy = oriented_flame(flame, PAD, nozzle)
        frame.alpha_composite(glow_layer(trail, 5, 0.12), trail_xy)
        frame.alpha_composite(alpha_scale(trail, 0.92), trail_xy)
        frame.alpha_composite(static_pad)

        stitch = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        radial_blob(stitch, tuple(nozzle), 4, 40, (250, 179, 135))
        radial_blob(stitch, tuple(nozzle), 2, 110, (255, 247, 220))
        frame.alpha_composite(stitch)

        xy = (round(float(place[0])), round(float(place[1])))
        frame.alpha_composite(glow_layer(rocket_i, 5, 0.22), xy)
        frame.alpha_composite(rocket_i, xy)
        frame.save(FRAMES / f"f{index:04d}.png")

    Image.open(FRAMES / "f0000.png").save(
        OUT / "hero-launch-poster.webp",
        "WEBP",
        quality=92,
        method=6,
    )


if __name__ == "__main__":
    render()
