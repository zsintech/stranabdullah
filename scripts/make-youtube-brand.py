"""Build YouTube channel assets from the office brand files."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
OUT = BRAND / "youtube"

FOREST = (4, 59, 43, 255)
GOLD = (220, 169, 39, 255)
CREAM = (248, 245, 238, 255)

BANNER_W, BANNER_H = 2560, 1440
SAFE_H = 423
AVATAR = 800
WATERMARK = 150


def cover(im: Image.Image, w: int, h: int) -> Image.Image:
    src = im.convert("RGBA")
    scale = max(w / src.width, h / src.height)
    resized = src.resize(
        (max(1, round(src.width * scale)), max(1, round(src.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = (resized.width - w) // 2
    y = (resized.height - h) // 2
    return resized.crop((x, y, x + w, y + h))


def contain(im: Image.Image, w: int, h: int) -> Image.Image:
    src = im.convert("RGBA")
    scale = min(w / src.width, h / src.height)
    resized = src.resize(
        (max(1, round(src.width * scale)), max(1, round(src.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(
        resized,
        ((w - resized.width) // 2, (h - resized.height) // 2),
        resized,
    )
    return canvas


def paste_centered(base: Image.Image, overlay: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    fitted = contain(overlay, x1 - x0, y1 - y0)
    base.alpha_composite(fitted, (x0, y0))


def make_banner() -> Image.Image:
    nav = Image.open(BRAND / "nav.png")
    official = Image.open(BRAND / "banner.png")
    leaves = Image.open(BRAND / "leaves.png")
    tulip = Image.open(BRAND / "tulipcorn.png")

    bg = cover(nav, BANNER_W, BANNER_H)
    bg = ImageEnhance.Brightness(bg).enhance(0.42)
    bg = ImageEnhance.Color(bg).enhance(0.85)
    wash = Image.new("RGBA", (BANNER_W, BANNER_H), FOREST)
    bg = Image.blend(bg, wash, 0.38)

    # Soft vignette so TV crop still reads as forest, not a bright photo.
    vignette = Image.new("L", (BANNER_W, BANNER_H), 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse((-180, -80, BANNER_W + 180, BANNER_H + 80), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(90))
    darkened = Image.new("RGBA", (BANNER_W, BANNER_H), (2, 28, 20, 255))
    bg = Image.composite(bg, darkened, vignette)

    # Official office banner sits in the YouTube safe strip (center 423px).
    safe_top = (BANNER_H - SAFE_H) // 2
    safe_bottom = safe_top + SAFE_H
    # Give the artwork a little extra height so desktop crop still feels full,
    # while keeping name + portrait inside the 423px band.
    art_h = 520
    art_top = (BANNER_H - art_h) // 2
    paste_centered(bg, official.convert("RGBA"), (0, art_top, BANNER_W, art_top + art_h))

    # Quiet botanical fillers in the TV-only zones.
    leaf_l = leaves.resize((520, 520), Image.Resampling.LANCZOS)
    leaf_l.putalpha(leaf_l.getchannel("A").point(lambda a: int(a * 0.28)))
    bg.alpha_composite(leaf_l, (-40, -40))
    leaf_r = leaf_l.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    bg.alpha_composite(leaf_r, (BANNER_W - 480, BANNER_H - 500))

    mark = tulip.resize((210, 210), Image.Resampling.LANCZOS)
    mark.putalpha(mark.getchannel("A").point(lambda a: int(a * 0.55)))
    bg.alpha_composite(mark, (72, BANNER_H - 268))

    # Hairline gold rule marking the safe band, very faint.
    rule = ImageDraw.Draw(bg)
    rule.rectangle(
        (0, safe_top, BANNER_W, safe_top + 1),
        fill=(220, 169, 39, 28),
    )
    rule.rectangle(
        (0, safe_bottom - 1, BANNER_W, safe_bottom),
        fill=(220, 169, 39, 28),
    )
    return bg.convert("RGB")


def make_avatar() -> Image.Image:
    cutout = Image.open(BRAND / "portrait-cutout.png").convert("RGBA")
    canvas = Image.new("RGBA", (AVATAR, AVATAR), FOREST)

    # Scale the bust so the face fills a circular crop.
    portrait = contain(cutout, 760, 760)
    canvas.alpha_composite(portrait, (20, 48))

    ring = Image.new("RGBA", (AVATAR, AVATAR), (0, 0, 0, 0))
    draw = ImageDraw.Draw(ring)
    inset = 10
    draw.ellipse(
        (inset, inset, AVATAR - 1 - inset, AVATAR - 1 - inset),
        outline=GOLD,
        width=7,
    )
    draw.ellipse(
        (inset + 10, inset + 10, AVATAR - 11 - inset, AVATAR - 11 - inset),
        outline=(*CREAM[:3], 70),
        width=2,
    )
    canvas.alpha_composite(ring)
    return canvas.convert("RGB")


def make_watermark() -> Image.Image:
    motif = Image.open(BRAND / "tulipcorn.png").convert("RGBA")
    canvas = Image.new("RGBA", (WATERMARK, WATERMARK), (0, 0, 0, 0))
    fitted = contain(motif, WATERMARK - 8, WATERMARK - 8)
    canvas.alpha_composite(fitted, (4, 4))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    banner = make_banner()
    avatar = make_avatar()
    watermark = make_watermark()
    banner.save(OUT / "banner.png", "PNG", optimize=True)
    avatar.save(OUT / "avatar.png", "PNG", optimize=True)
    watermark.save(OUT / "watermark.png", "PNG", optimize=True)
    print("wrote", OUT / "banner.png", banner.size)
    print("wrote", OUT / "avatar.png", avatar.size)
    print("wrote", OUT / "watermark.png", watermark.size)


if __name__ == "__main__":
    main()
