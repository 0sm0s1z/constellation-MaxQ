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

# Keep the #48 stage/trajectory lock.
# Laptop body center on stage ~254x; keep launch seated on keyboard/screen axis (not right spill).
PAD = np.float32([245.0, 312.0])
ROCKET_START = np.float32([252.0, 212.0])
ROCKET_END = np.float32([430.0, 22.0])
ROCKET_W = 62
NOZZLE_OVERLAP = 22.0
FLAME_CANONICAL_HEIGHT = 250
FLAME_CHANNEL_WIDTH = 34

# Original puffs only. Tighter/flatter so mass stays over laptop center, not past the right bezel.
PAD_PUFF_SPECS = (
    (0, 58, (-18, -14), 0.68),
    (1, 66, (-2, -24), 0.74),
    (2, 60, (14, -16), 0.68),
    (3, 52, (4, -34), 0.58),
)


def alpha_scale(im: Image.Image, factor: float) -> Image.Image:
    out = im.copy()
    a = np.asarray(out.getchannel("A"), dtype=np.float32) * factor
    out.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))
    return out


def glow_layer(im: Image.Image, radius: float, opacity: float) -> Image.Image:
    """Soft glow from the sprite's own RGB — never a flat peach fill (avoids rectangular halo)."""
    blurred = im.filter(ImageFilter.GaussianBlur(radius))
    rgb = np.asarray(blurred.convert("RGB"), dtype=np.float32)
    a = np.asarray(blurred.getchannel("A"), dtype=np.float32) * opacity
    a = np.clip(a, 0, 255)
    # crush near-zero alpha so rotated canvas edges cannot show a box
    a[a < 4] = 0
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    out.putalpha(Image.fromarray(a.astype(np.uint8), "L"))
    return out


def ease(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def progress(t: float) -> float:
    # Seamless loop: short hold -> rise -> hold -> return -> hold.
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
    radius: int,
    alpha: int,
    rgb: tuple[int, int, int],
) -> None:
    size = radius * 4
    yy, xx = np.ogrid[:size, :size]
    c = size / 2.0
    d = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    a = (np.clip(1.0 - d / (radius * 1.6), 0.0, 1.0) ** 2 * alpha).astype(np.uint8)
    blob = Image.new("RGBA", (size, size), (*rgb, 0))
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

    # PIL/image coordinates make rotation sign easy to get wrong. Try both vertical
    # alignments and keep the one with the strongest vertical aspect ratio.
    candidates: list[Image.Image] = []
    for angle in (90.0 - axis_angle, axis_angle - 90.0, -90.0 - axis_angle, axis_angle + 90.0):
        q = trim_alpha(src.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True), 8)
        candidates.append(q)
    flame = max(candidates, key=lambda q: q.height / max(1, q.width))

    # The authored trail tapers toward the nozzle. Make the broader end the pad end.
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

    # Keep the authored length and profile, but center-crop its visible channel once.
    # Per-frame reveal below only crops this fixed-width strip; it never stretches it.
    channel_width = min(FLAME_CHANNEL_WIDTH, flame.width)
    left = max(0, (flame.width - channel_width) // 2)
    return flame.crop((left, 0, left + channel_width, flame.height))


def load_assets() -> tuple[Image.Image, Image.Image, list[Image.Image], Image.Image]:
    # Original layered art only. No generated plume/shaft substitutes.
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
    """Dense original-style pad cloud, fixed in stage coordinates from frame one."""
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
    """AE-style reveal: crop authored flame length, then rotate; never warp or resize per frame."""
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

    end = nozzle + unit * NOZZLE_OVERLAP
    midpoint = (pad + end) * 0.5
    xy = (
        round(float(midpoint[0]) - rotated.width / 2),
        round(float(midpoint[1]) - rotated.height / 2),
    )
    return rotated, xy


def render() -> None:
    plate, rocket, puffs, flame = load_assets()
    static_pad = build_static_pad(puffs)
    rocket_h = rocket.height
    nozzle_rel = np.float32([ROCKET_W * 0.49, rocket_h * 0.82])

    FRAMES.mkdir(exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()

    for index in range(FRAME_COUNT):
        t = index / (FRAME_COUNT - 1)
        p = progress(t)
        rocket_xy = ROCKET_START + (ROCKET_END - ROCKET_START) * p
        nozzle = rocket_xy + nozzle_rel

        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.alpha_composite(plate, (PLATE_X, PLATE_Y))

        # Only the original flame-trail reveal changes length with ascent.
        trail, trail_xy = oriented_flame(flame, PAD, nozzle)
        frame.alpha_composite(glow_layer(trail, 5, 0.10), trail_xy)
        frame.alpha_composite(alpha_scale(trail, 0.94), trail_xy)

        # Original smoke puffs sit over the flame base and never move/change.
        frame.alpha_composite(static_pad)

        # Small continuity stitch only; not a replacement exhaust effect.
        stitch = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        radial_blob(stitch, tuple(nozzle), 3, 26, (250, 179, 135))
        radial_blob(stitch, tuple(nozzle), 2, 72, (255, 247, 220))
        frame.alpha_composite(stitch)

        frame.alpha_composite(
            glow_layer(rocket, 5, 0.18),
            (round(rocket_xy[0]), round(rocket_xy[1])),
        )
        frame.alpha_composite(rocket, (round(rocket_xy[0]), round(rocket_xy[1])))
        frame.save(FRAMES / f"f{index:04d}.png")

    # Reduced-motion poster is exactly the first composited frame.
    Image.open(FRAMES / "f0000.png").save(
        OUT / "hero-launch-poster.webp",
        "WEBP",
        quality=92,
        method=6,
    )


if __name__ == "__main__":
    render()
