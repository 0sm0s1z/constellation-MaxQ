#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import io
import math
from pathlib import Path

import cairosvg
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

PAD = np.float32([318.0, 319.0])
PAD_PLUME_XY = (213, 235)

ROCKET_START = np.float32([325.0, 175.0])
ROCKET_END = np.float32([394.0, 56.0])
ROCKET_W = 61

PAD_PLUME_SIZE = (210, 104)
SHAFT_SIZE = (56, 320)
PAD_PLUME_SHA256 = "e8b364ab96a450f548b6bac3bfb0367e26463b22be39bb3c3b70f214eb8c87d7"
SHAFT_SHA256 = "ff29907269ecd3132f51d3946928097bf0601b3f98f677dfac532ff0be6c87be"
NOZZLE_OVERLAP = 10.0


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


def rasterize_svg(path: Path, expected_size: tuple[int, int], expected_sha256: str) -> Image.Image:
    raw = path.read_bytes()
    actual_sha = hashlib.sha256(raw).hexdigest()
    if actual_sha != expected_sha256:
        raise RuntimeError(f"{path.name}: sha256 mismatch: {actual_sha}")

    png = cairosvg.svg2png(bytestring=raw)
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    if im.size != expected_size:
        raise RuntimeError(f"{path.name}: expected {expected_size}, got {im.size}")
    return im


def load_assets() -> tuple[Image.Image, Image.Image, Image.Image, Image.Image]:
    plate = Image.open(ART / "plate.png").convert("RGBA").resize((540, 376), Image.Resampling.LANCZOS)

    yy, xx = np.mgrid[0:376, 0:540]
    r = np.sqrt(((xx - 270) / 300) ** 2 + ((yy - 190) / 220) ** 2)
    matte = (np.clip((1.08 - r) / 0.22, 0.0, 1.0) * 255).astype(np.uint8)
    plate.putalpha(Image.fromarray(matte, "L"))

    rocket = Image.open(ART / "rocket-trim.png").convert("RGBA")
    rocket_h = round(rocket.height * ROCKET_W / rocket.width)
    rocket = rocket.resize((ROCKET_W, rocket_h), Image.Resampling.LANCZOS)

    pad_plume = rasterize_svg(OUT / "hero-pad-plume.svg", PAD_PLUME_SIZE, PAD_PLUME_SHA256)
    shaft = rasterize_svg(OUT / "hero-exhaust-shaft.svg", SHAFT_SIZE, SHAFT_SHA256)
    return plate, rocket, pad_plume, shaft


def oriented_shaft(
    shaft: Image.Image,
    pad: np.ndarray,
    nozzle: np.ndarray,
) -> tuple[Image.Image, tuple[int, int]]:
    """Reveal a constant-width shaft by cropping source pixels only."""
    vector = nozzle - pad
    distance = float(np.hypot(vector[0], vector[1]))
    if distance <= 1.0:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0)), (round(pad[0]), round(pad[1]))

    unit = vector / distance
    visible = min(shaft.height, max(1, round(distance + NOZZLE_OVERLAP)))
    segment = shaft.crop((0, shaft.height - visible, shaft.width, shaft.height))

    if segment.width != SHAFT_SIZE[0]:
        raise RuntimeError("exhaust shaft width changed during reveal")

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
    plate, rocket, pad_plume, shaft = load_assets()
    rocket_h = rocket.height
    nozzle_rel = np.float32([ROCKET_W * 0.49, rocket_h * 0.82])

    FRAMES.mkdir(exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()

    for index in range(FRAME_COUNT):
        t = index / (FRAME_COUNT - 1)
        p = progress(t)

        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.alpha_composite(plate, (PLATE_X, PLATE_Y))

        # John's correction: fixed keyboard plume, present from frame 1.
        # It never stretches, warps, scales, or grows.
        frame.alpha_composite(pad_plume, PAD_PLUME_XY)

        rocket_xy = ROCKET_START + (ROCKET_END - ROCKET_START) * p
        nozzle = rocket_xy + nozzle_rel

        # Only visible shaft length changes. The authored shaft is cropped and
        # rotated onto the path; it is never resized or warped.
        trail, trail_xy = oriented_shaft(shaft, PAD, nozzle)
        frame.alpha_composite(glow_layer(trail, 8, 0.22), trail_xy)
        frame.alpha_composite(trail, trail_xy)

        stitch = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        radial_blob(stitch, tuple(nozzle), 11, 96, (250, 179, 135))
        radial_blob(stitch, tuple(nozzle), 5, 205, (255, 247, 220))
        frame.alpha_composite(stitch)

        frame.alpha_composite(
            glow_layer(rocket, 8, 0.48),
            (round(rocket_xy[0]), round(rocket_xy[1])),
        )
        frame.alpha_composite(
            rocket,
            (round(rocket_xy[0]), round(rocket_xy[1])),
        )
        frame.save(FRAMES / f"f{index:04d}.png")

    Image.open(FRAMES / "f0000.png").save(
        OUT / "hero-launch-poster.webp",
        "WEBP",
        quality=92,
        method=6,
    )


if __name__ == "__main__":
    render()
