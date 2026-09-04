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

# Screen-face seat (lower glass / hinge-upper), then near-vertical lift.
PAD = np.float32([295.0, 205.0])
ROCKET_START = np.float32([298.0, 158.0])
ROCKET_END = np.float32([310.0, 14.0])
ROCKET_W = 61
ROCKET_REST_ANGLE_DEG = -38.0
EXHAUST_HALF_WIDTH = 5.5  # thin vent channel (px)
EXHAUST_CORE_HALF = 2.2

# Puffs stacked UP the screen face (negative Y), slight left for perspective — not keyboard deck.
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


def load_assets() -> tuple[Image.Image, Image.Image, list[Image.Image]]:
    plate = Image.open(ART / "plate.webp").convert("RGBA").resize((540, 376), Image.Resampling.LANCZOS)
    rocket = Image.open(ART / "rocket-trim.webp").convert("RGBA")
    rocket_h = round(rocket.height * ROCKET_W / rocket.width)
    rocket = rocket.resize((ROCKET_W, rocket_h), Image.Resampling.LANCZOS)
    puffs = [
        Image.open(ART / f"smoke-puff-{i:02d}.webp").convert("RGBA")
        for i in range(1, 5)
    ]
    return plate, rocket, puffs


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


def thin_exhaust(pad: np.ndarray, nozzle: np.ndarray) -> Image.Image:
    """Thin soft channel from vent→pad along flight path — never a broad square bar."""
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vector = nozzle - pad
    distance = float(np.hypot(vector[0], vector[1]))
    if distance < 2:
        return out

    unit = vector / distance
    perp = np.float32([-unit[1], unit[0]])

    # Sample a tight bbox around the segment.
    xs = [pad[0], nozzle[0]]
    ys = [pad[1], nozzle[1]]
    pad_m = 14
    x0 = max(0, int(min(xs) - pad_m))
    y0 = max(0, int(min(ys) - pad_m))
    x1 = min(W, int(max(xs) + pad_m + 1))
    y1 = min(H, int(max(ys) + pad_m + 1))
    if x1 <= x0 or y1 <= y0:
        return out

    yy, xx = np.mgrid[y0:y1, x0:x1]
    # Project onto path axis from pad.
    relx = xx.astype(np.float32) - float(pad[0])
    rely = yy.astype(np.float32) - float(pad[1])
    along = relx * float(unit[0]) + rely * float(unit[1])
    across = relx * float(perp[0]) + rely * float(perp[1])

    # Only between pad and nozzle (with small overshoot into vent).
    mask_along = (along >= -2.0) & (along <= distance + 6.0)
    # Taper: wider near pad, thinner at nozzle.
    t = np.clip(along / max(distance, 1.0), 0.0, 1.0)
    half = EXHAUST_HALF_WIDTH * (1.15 - 0.55 * t)
    core = EXHAUST_CORE_HALF * (1.10 - 0.45 * t)

    glow = np.exp(-0.5 * (across / np.maximum(half, 0.8)) ** 2)
    core_a = np.exp(-0.5 * (across / np.maximum(core, 0.4)) ** 2)
    glow = glow * mask_along.astype(np.float32)
    core_a = core_a * mask_along.astype(np.float32)

    # Soft ends
    end_fade = np.clip(along / 10.0, 0, 1) * np.clip((distance + 4 - along) / 8.0, 0, 1)
    glow *= end_fade
    core_a *= end_fade

    rgb = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.float32)
    # warm outer
    rgb[:, :, 0] = 255
    rgb[:, :, 1] = 170
    rgb[:, :, 2] = 110
    rgb[:, :, 3] = np.clip(glow * 150.0, 0, 255)
    layer = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGBA")
    out.alpha_composite(layer, (x0, y0))

    rgb2 = np.zeros_like(rgb)
    rgb2[:, :, 0] = 255
    rgb2[:, :, 1] = 240
    rgb2[:, :, 2] = 210
    rgb2[:, :, 3] = np.clip(core_a * 210.0, 0, 255)
    layer2 = Image.fromarray(np.clip(rgb2, 0, 255).astype(np.uint8), "RGBA")
    out.alpha_composite(layer2, (x0, y0))
    return out


def render() -> None:
    plate, rocket_rest, puffs = load_assets()
    static_pad = build_static_pad(puffs)
    path = ROCKET_END - ROCKET_START
    path_len = float(np.hypot(path[0], path[1]))
    unit = path / max(1e-3, path_len)
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
        tt = index / (FRAME_COUNT - 1)
        pr = progress(tt)
        nozzle = ROCKET_START + path * pr
        place = nozzle - tail

        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.alpha_composite(plate, (PLATE_X, PLATE_Y))

        exhaust = thin_exhaust(PAD, nozzle)
        frame.alpha_composite(glow_layer(exhaust, 3, 0.35), (0, 0))
        frame.alpha_composite(exhaust)
        frame.alpha_composite(static_pad)

        stitch = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        radial_blob(stitch, tuple(nozzle), 3, 50, (255, 200, 150))
        radial_blob(stitch, tuple(nozzle), 2, 140, (255, 250, 230))
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
