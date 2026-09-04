#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "web/public/art/rocket-layers"
OUT = ROOT / "web/public/art"
FRAMES = ROOT / ".hero-motion-frames"

W, H = 660, 460
FPS = 24
FRAME_COUNT = 145  # 6.04 s including final loop frame
PLATE_X, PLATE_Y = 60, 68
PAD = np.float32([318.0, 319.0])
ROCKET_START = np.float32([325.0, 175.0])
ROCKET_END = np.float32([394.0, 56.0])
ROCKET_W = 61


def alpha_scale(im: Image.Image, factor: float) -> Image.Image:
    out = im.copy()
    a = np.asarray(out.getchannel("A"), dtype=np.float32) * factor
    out.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))
    return out


def glow_layer(im: Image.Image, radius: float, opacity: float) -> Image.Image:
    a = np.asarray(im.getchannel("A").filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)
    a = np.clip(a * opacity, 0, 255).astype(np.uint8)
    out = Image.new("RGBA", im.size, (255, 190, 145, 0))
    out.putalpha(Image.fromarray(a, "L"))
    return out


def ease(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def progress(t: float) -> float:
    # Seamless loop: hold -> rise -> hold -> return -> hold.
    if t < 0.08:
        return 0.0
    if t < 0.50:
        return ease((t - 0.08) / 0.42)
    if t < 0.60:
        return 1.0
    if t < 0.94:
        return 1.0 - ease((t - 0.60) / 0.34)
    return 0.0


def radial_blob(canvas: Image.Image, center: tuple[float, float], radius: int, alpha: int, rgb: tuple[int, int, int]) -> None:
    size = radius * 4
    yy, xx = np.ogrid[:size, :size]
    c = size / 2.0
    d = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    a = (np.clip(1.0 - d / (radius * 1.6), 0.0, 1.0) ** 2 * alpha).astype(np.uint8)
    blob = Image.new("RGBA", (size, size), (*rgb, 0))
    blob.putalpha(Image.fromarray(a, "L"))
    canvas.alpha_composite(blob, (round(center[0] - size / 2), round(center[1] - size / 2)))


def load_assets():
    plate = Image.open(ART / "plate.png").convert("RGBA").resize((540, 376), Image.Resampling.LANCZOS)
    # Keep the approved plate pixels intact. A broad feathered matte dissolves its dark field
    # into the site's crust without chroma-keying holes through the laptop screen.
    yy, xx = np.mgrid[0:376, 0:540]
    r = np.sqrt(((xx - 270) / 300) ** 2 + ((yy - 190) / 220) ** 2)
    matte = (np.clip((1.08 - r) / 0.22, 0.0, 1.0) * 255).astype(np.uint8)
    plate.putalpha(Image.fromarray(matte, "L"))

    rocket = Image.open(ART / "rocket-trim.png").convert("RGBA")
    rocket_h = round(rocket.height * ROCKET_W / rocket.width)
    rocket = rocket.resize((ROCKET_W, rocket_h), Image.Resampling.LANCZOS)

    flame = Image.open(ART / "flame-trail.webp").convert("RGBA")
    # This is the approved flame texture; remove only near-transparent generative residue
    # so offline glow cannot create the rectangular ghost seen in the DOM/CSS version.
    fa = np.asarray(flame.getchannel("A"), dtype=np.float32)
    fa = np.where(fa < 42, 0, np.clip((fa - 42) * 1.55, 0, 255)).astype(np.uint8)
    flame.putalpha(Image.fromarray(fa, "L"))
    flame = flame.crop((330, 180, flame.width, flame.height))

    puffs = [Image.open(ART / f"smoke-puff-{i:02d}.webp").convert("RGBA") for i in range(1, 5)]
    return plate, rocket, flame, puffs


def render() -> None:
    plate, rocket, flame, puffs = load_assets()
    rocket_h = rocket.height
    nozzle_rel = np.float32([ROCKET_W * 0.49, rocket_h * 0.82])

    # Flame source anchors measured once from the approved flame asset crop.
    src_base = np.float32([150, 835])
    src_tip = np.float32([1030, 92])
    sv = src_tip - src_base
    sl = float(np.hypot(sv[0], sv[1]))
    sp = np.float32([-sv[1] / sl, sv[0] / sl])
    src_side = src_base + sp * 290
    flame_rgba = np.asarray(flame)

    smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    smoke_specs = [
        (puffs[0], 78, (-30, -31), 0.38),
        (puffs[1], 90, (-8, -42), 0.31),
        (puffs[2], 82, (12, -29), 0.30),
        (puffs[3], 68, (19, -52), 0.22),
    ]
    for src, size, off, opacity in smoke_specs:
        q = src.copy()
        q.thumbnail((size, size), Image.Resampling.LANCZOS)
        q = alpha_scale(q, opacity)
        smoke.alpha_composite(q, (round(PAD[0] + off[0] - q.width / 2), round(PAD[1] + off[1] - q.height / 2)))

    pad_bloom = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    radial_blob(pad_bloom, tuple(PAD), 34, 75, (250, 179, 135))
    radial_blob(pad_bloom, tuple(PAD), 18, 115, (255, 215, 170))
    radial_blob(pad_bloom, tuple(PAD), 8, 165, (255, 250, 225))

    FRAMES.mkdir(exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()

    for index in range(FRAME_COUNT):
        t = index / (FRAME_COUNT - 1)
        p = progress(t)

        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.alpha_composite(plate, (PLATE_X, PLATE_Y))
        frame.alpha_composite(smoke)
        frame.alpha_composite(alpha_scale(pad_bloom, 0.45 + 0.55 * p))

        rocket_xy = ROCKET_START + (ROCKET_END - ROCKET_START) * p
        nozzle = rocket_xy + nozzle_rel

        # Keyframe the approved flame texture between the fixed keyboard origin and the
        # current nozzle. This guarantees continuity without a runtime mask edge or CSS cone.
        tv = nozzle - PAD
        tl = float(np.hypot(tv[0], tv[1]))
        unit = tv / tl
        tip = nozzle + unit * 12.0  # intentionally continues through the nozzle behind rocket
        perp = np.float32([-unit[1], unit[0]])
        width = 42.0 + 20.0 * p
        target_side = PAD + perp * width
        matrix = cv2.getAffineTransform(
            np.float32([src_base, src_tip, src_side]),
            np.float32([PAD, tip, target_side]),
        )
        warped = cv2.warpAffine(
            flame_rgba,
            matrix,
            (W, H),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0, 0, 0, 0),
        )
        trail = Image.fromarray(warped, "RGBA")
        density = 0.62 + 0.38 * p
        frame.alpha_composite(glow_layer(trail, 18, 0.16 * density))
        frame.alpha_composite(glow_layer(trail, 8, 0.40 * density))
        frame.alpha_composite(alpha_scale(trail, density))

        stitch = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        radial_blob(stitch, tuple(nozzle), 22, 90, (250, 179, 135))
        radial_blob(stitch, tuple(nozzle), 12, 150, (255, 205, 150))
        radial_blob(stitch, tuple(nozzle), 5, 235, (255, 252, 225))
        frame.alpha_composite(stitch)

        frame.alpha_composite(glow_layer(rocket, 8, 0.55), (round(rocket_xy[0]), round(rocket_xy[1])))
        frame.alpha_composite(rocket, (round(rocket_xy[0]), round(rocket_xy[1])))
        frame.save(FRAMES / f"f{index:04d}.png")

    # Reduced-motion poster = the exact first rendered frame, not a separate approximation.
    Image.open(FRAMES / "f0000.png").save(OUT / "hero-launch-poster.webp", "WEBP", quality=92, method=6)


if __name__ == "__main__":
    render()
