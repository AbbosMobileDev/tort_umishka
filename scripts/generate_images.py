#!/usr/bin/env python3
"""
Katalog uchun namunaviy mahsulot rasmlarini chizadi (SVG -> PNG).

Bu rasmlar vaqtinchalik: do'kon o'z suratlarini qo'yganda almashtiriladi.
Internetdan olingan surat ishlatilmaydi — mualliflik huquqi masalasi.

Ishlatish:  python3 scripts/generate_images.py
Natija:     assets/products/*.png
"""
import os
import cairosvg

W = H = 900
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "products")

FONT = "DejaVu Sans"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def plate(y=690):
    return f"""
  <ellipse cx="450" cy="{y + 18}" rx="330" ry="34" fill="#000" opacity="0.07"/>
  <ellipse cx="450" cy="{y}" rx="310" ry="30" fill="#ffffff"/>
  <ellipse cx="450" cy="{y - 6}" rx="310" ry="30" fill="#f3f0ec"/>
"""


def drips(x, w, y, color, n=9, depth=46):
    """Frosting oqishi — yuqori qatlam ostidagi tomchilar."""
    step = w / n
    out = [f'<path d="M{x},{y - 30} h{w} v20 ']
    for i in range(n):
        cx = x + w - (i + 0.5) * step
        d = depth if i % 2 == 0 else depth * 0.6
        out.append(f"Q{cx + step*0.25:.1f},{y + d:.1f} {cx - step*0.5:.1f},{y:.1f} ")
    out.append(f'Z" fill="{color}"/>')
    return "".join(out)


def layered_cake(sponge, cream, frost, layers=4, x=230, w=440, top=330, bottom=690):
    """Yon ko'rinishdagi qatlamli tort."""
    h = bottom - top
    band = h / layers
    parts = [f'<rect x="{x}" y="{top}" width="{w}" height="{h}" rx="18" fill="{sponge}"/>']
    for i in range(layers):
        y = top + band * i + band * 0.62
        parts.append(
            f'<rect x="{x}" y="{y:.1f}" width="{w}" height="{band*0.34:.1f}" fill="{cream}"/>'
        )
    parts.append(f'<rect x="{x}" y="{top}" width="{w}" height="{h}" rx="18" fill="none" stroke="{frost}" stroke-width="0" />')
    parts.append(drips(x, w, top + 34, frost))
    parts.append(f'<ellipse cx="{x + w/2}" cy="{top - 8}" rx="{w/2}" ry="30" fill="{frost}"/>')
    # yumshoq soya
    parts.append(
        f'<rect x="{x}" y="{top}" width="{w*0.18}" height="{h}" fill="#000" opacity="0.05"/>'
    )
    return "".join(parts)


def cherry(cx, cy, r=22, color="#c62828"):
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}"/>'
        f'<circle cx="{cx - r*0.3:.1f}" cy="{cy - r*0.35:.1f}" r="{r*0.22:.1f}" fill="#fff" opacity="0.5"/>'
        f'<path d="M{cx},{cy - r} q10,-26 26,-30" stroke="#2e7d32" stroke-width="6" fill="none" stroke-linecap="round"/>'
    )


def candle(cx, base, color="#ef6c9a"):
    return (
        f'<rect x="{cx - 9}" y="{base - 86}" width="18" height="86" rx="6" fill="{color}"/>'
        f'<rect x="{cx - 9}" y="{base - 86}" width="18" height="86" rx="6" fill="#fff" opacity="0.25"/>'
        f'<path d="M{cx},{base - 132} q18,22 0,40 q-18,-18 0,-40" fill="#ffb300"/>'
    )


def sprinkles(seed=0):
    import random

    rnd = random.Random(seed)
    out = []
    colors = ["#ff7043", "#42a5f5", "#66bb6a", "#ffca28", "#ab47bc", "#ec407a"]
    for _ in range(38):
        x = rnd.uniform(250, 650)
        y = rnd.uniform(345, 470)
        a = rnd.uniform(-60, 60)
        out.append(
            f'<rect x="{x:.0f}" y="{y:.0f}" width="20" height="7" rx="3.5" '
            f'fill="{rnd.choice(colors)}" transform="rotate({a:.0f} {x:.0f} {y:.0f})"/>'
        )
    return "".join(out)


def berries(y=345):
    out = []
    for i, cx in enumerate(range(300, 640, 56)):
        col = "#c2185b" if i % 2 == 0 else "#5c2a6b"
        out.append(f'<circle cx="{cx}" cy="{y}" r="19" fill="{col}"/>')
        out.append(f'<circle cx="{cx-6}" cy="{y-6}" r="5" fill="#fff" opacity="0.45"/>')
    return "".join(out)


def fruit_slices(y=340):
    out = []
    cols = ["#ff8f00", "#e53935", "#43a047", "#fb8c00"]
    for i, cx in enumerate(range(300, 650, 58)):
        c = cols[i % len(cols)]
        out.append(f'<circle cx="{cx}" cy="{y}" r="26" fill="{c}"/>')
        out.append(f'<circle cx="{cx}" cy="{y}" r="17" fill="#fff" opacity="0.35"/>')
        out.append(f'<circle cx="{cx}" cy="{y}" r="8" fill="#fff" opacity="0.5"/>')
    return "".join(out)


def tiers_cake(frost, accent):
    """Uch qavatli nikoh torti."""
    p = []
    specs = [(225, 520, 450, 690), (280, 390, 340, 525), (330, 290, 240, 395)]
    for x, y, w, bottom in specs:
        h = bottom - y
        p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{frost}"/>')
        p.append(f'<rect x="{x}" y="{y}" width="{w*0.16:.0f}" height="{h}" fill="#000" opacity="0.04"/>')
        p.append(f'<ellipse cx="{x + w/2}" cy="{y}" rx="{w/2}" ry="20" fill="#ffffff"/>')
        p.append(drips(x, w, y + 26, "#ffffff", n=7, depth=30))
    for cx in (320, 450, 580):
        p.append(f'<circle cx="{cx}" cy="610" r="15" fill="{accent}"/>')
    for cx in (355, 450, 545):
        p.append(f'<circle cx="{cx}" cy="465" r="13" fill="{accent}"/>')
    for cx in (395, 450, 505):
        p.append(f'<circle cx="{cx}" cy="345" r="11" fill="{accent}"/>')
    p.append(f'<path d="M450,222 l17,36 39,6 -28,28 7,39 -35,-19 -35,19 7,-39 -28,-28 39,-6 Z" fill="{accent}"/>')
    return "".join(p)


def number_cake(digit, base, cream):
    """Raqam shaklidagi tort — pastda soya, ustida krem rang."""
    return (
        f'<text x="450" y="648" font-family="{FONT}" font-size="430" font-weight="bold" '
        f'text-anchor="middle" fill="{base}">{digit}</text>'
        f'<text x="450" y="636" font-family="{FONT}" font-size="430" font-weight="bold" '
        f'text-anchor="middle" fill="{cream}" stroke="{base}" stroke-width="6">{digit}</text>'
        + berries(300)
    )


def eclairs():
    p = []
    for i, (x, y) in enumerate([(230, 480), (350, 560), (470, 480), (300, 400), (430, 620)]):
        p.append(f'<rect x="{x}" y="{y}" width="230" height="76" rx="38" fill="#f0d3a8"/>')
        p.append(f'<rect x="{x+16}" y="{y+8}" width="198" height="34" rx="17" fill="#5d3a1a"/>')
        p.append(f'<rect x="{x+40}" y="{y+14}" width="60" height="10" rx="5" fill="#fff" opacity="0.3"/>')
    return "".join(p)


def macarons():
    p = []
    cols = ["#f48fb1", "#ffe082", "#a5d6a7", "#b39ddb", "#ffab91"]
    spots = [(300, 620), (450, 640), (600, 620), (375, 500), (525, 500), (450, 380)]
    for i, (cx, cy) in enumerate(spots):
        c = cols[i % len(cols)]
        p.append(f'<ellipse cx="{cx}" cy="{cy-34}" rx="82" ry="42" fill="{c}"/>')
        p.append(f'<rect x="{cx-78}" y="{cy-26}" width="156" height="26" fill="#fff8e1"/>')
        p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="82" ry="42" fill="{c}"/>')
        p.append(f'<ellipse cx="{cx-26}" cy="{cy-44}" rx="22" ry="9" fill="#fff" opacity="0.35"/>')
    return "".join(p)


def cupcake():
    p = [
        '<path d="M300,520 L340,700 h220 l40,-180 Z" fill="#e8a33d"/>',
        '<path d="M300,520 L340,700 h30 l-20,-180 Z" fill="#000" opacity="0.06"/>',
    ]
    for i in range(5):
        p.append(f'<rect x="{318 + i*54}" y="530" width="18" height="160" rx="9" fill="#fff" opacity="0.25"/>')
    p.append('<path d="M290,520 q0,-120 160,-120 q160,0 160,120 Z" fill="#f5f0ea"/>')
    p.append('<ellipse cx="450" cy="430" rx="150" ry="60" fill="#f7c6d9"/>')
    p.append('<ellipse cx="450" cy="380" rx="112" ry="48" fill="#f2a9c4"/>')
    p.append('<ellipse cx="450" cy="336" rx="74" ry="38" fill="#ec8fb2"/>')
    p.append(cherry(450, 282, 26))
    p.append(sprinkles(7))
    return "".join(p)


def chakchak():
    import random

    rnd = random.Random(3)
    p = ['<path d="M250,690 q200,-300 400,0 Z" fill="#e8a33d"/>']
    for _ in range(150):
        x = rnd.uniform(275, 625)
        # gumbaz shakli ichida qolsin
        limit = 690 - (1 - abs((x - 450) / 190) ** 2) * 250
        y = rnd.uniform(limit + 10, 675)
        a = rnd.uniform(-40, 40)
        p.append(
            f'<rect x="{x:.0f}" y="{y:.0f}" width="34" height="11" rx="5.5" '
            f'fill="{rnd.choice(["#e8a33d", "#d98d2b", "#f3b654", "#c97c22"])}" '
            f'transform="rotate({a:.0f} {x:.0f} {y:.0f})"/>'
        )
    for _ in range(26):
        x = rnd.uniform(285, 615)
        limit = 690 - (1 - abs((x - 450) / 190) ** 2) * 250
        y = rnd.uniform(limit + 20, 665)
        p.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="6" fill="#e53935"/>')
    return "".join(p)


PRODUCTS = {
    # tortlar
    "napoleon": dict(bg="#fdf6ec", accent="#e8d5b5", body=lambda: layered_cake("#f6e3c5", "#fffaf0", "#fff6e6", layers=7) + berries(322)),
    "medovik": dict(bg="#fbf1df", accent="#e6c48a", body=lambda: layered_cake("#d9a25a", "#fff6e3", "#f7e5c4", layers=6) + cherry(450, 318)),
    "shokoladli": dict(bg="#f5eee9", accent="#c8a07e", body=lambda: layered_cake("#4e342e", "#8d6e63", "#3e2723", layers=4) + berries(320)),
    "chizkeyk": dict(bg="#fdf3f6", accent="#f0c8d8", body=lambda: layered_cake("#f7e6bf", "#fffdf7", "#fbf7ee", layers=2) + berries(324)),
    "bolalar": dict(bg="#eef7ff", accent="#8fc7ff", body=lambda: layered_cake("#ffd166", "#fff3cd", "#7ec8e3", layers=3) + sprinkles(1) + candle(390, 322, "#ef6c9a") + candle(450, 322, "#7ec8e3") + candle(510, 322, "#ffd166")),
    "qizil-barxat": dict(bg="#fbeef0", accent="#d98a9a", body=lambda: layered_cake("#a8202f", "#fffaf5", "#fdf4ee", layers=5) + berries(322)),
    "praga": dict(bg="#f3eeea", accent="#b08968", body=lambda: layered_cake("#3b2417", "#6d4c41", "#2c1810", layers=5) + cherry(450, 318)),
    "yogurtli": dict(bg="#f2fbf4", accent="#9ed7ae", body=lambda: layered_cake("#fffdf8", "#f4fbf5", "#ffffff", layers=3) + fruit_slices(322)),
    # bayram
    "nikoh": dict(bg="#f7f4fb", accent="#c8b6e2", body=lambda: tiers_cake("#fffdfa", "#c8a2d8")),
    "tugilgan-kun": dict(bg="#fff6f2", accent="#ffb59b", body=lambda: layered_cake("#f5c6a5", "#fff4ea", "#ff8a65", layers=4) + sprinkles(4) + candle(380, 322, "#ffca28") + candle(450, 322, "#ef6c9a") + candle(520, 322, "#66bb6a")),
    "raqamli": dict(bg="#fdf7ff", accent="#d9b8f0", body=lambda: number_cake("5", "#a978c9", "#f0dcfa")),
    # shirinliklar
    "eklerlar": dict(bg="#fbf6ef", accent="#dcc09a", body=eclairs),
    "makaron": dict(bg="#fdf4f7", accent="#f0bcd0", body=macarons),
    "kapkeyk": dict(bg="#fff5f8", accent="#f7bcd2", body=cupcake),
    "chak-chak": dict(bg="#fdf5e6", accent="#e2b46a", body=chakchak),
}


def build_svg(key, spec, title):
    body = spec["body"]() if callable(spec["body"]) else spec["body"]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" fill="{spec['bg']}"/>
  <circle cx="450" cy="420" r="330" fill="{spec['accent']}" opacity="0.28"/>
  <circle cx="450" cy="420" r="262" fill="#ffffff" opacity="0.35"/>
  {plate()}
  {body}
  <rect x="0" y="770" width="{W}" height="130" fill="#ffffff" opacity="0.82"/>
  <text x="450" y="838" font-family="{FONT}" font-size="54" font-weight="bold"
        text-anchor="middle" fill="#4a3728">{esc(title)}</text>
  <text x="450" y="878" font-family="{FONT}" font-size="26"
        text-anchor="middle" fill="#9c8878" opacity="0.9">namunaviy rasm</text>
</svg>"""


TITLES = {
    "napoleon": "Napoleon",
    "medovik": "Medovik",
    "shokoladli": "Shokoladli tort",
    "chizkeyk": "Chizkeyk",
    "bolalar": "Bolalar torti",
    "qizil-barxat": "Qizil barxat",
    "praga": "Praga",
    "yogurtli": "Yogurtli mevali",
    "nikoh": "Nikoh torti",
    "tugilgan-kun": "Tug'ilgan kun torti",
    "raqamli": "Raqamli tort",
    "eklerlar": "Eklerlar",
    "makaron": "Makaron",
    "kapkeyk": "Kapkeyk",
    "chak-chak": "Chak-chak",
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for key, spec in PRODUCTS.items():
        svg = build_svg(key, spec, TITLES[key])
        path = os.path.join(OUT, f"{key}.png")
        cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=path,
                         output_width=W, output_height=H)
        print(f"  {os.path.relpath(path)}")
    print(f"{len(PRODUCTS)} ta rasm tayyor")


if __name__ == "__main__":
    main()
