#!/usr/bin/env python3
"""Images de la carte du monde de Dofus Touch, depuis le CDN officiel du jeu (mêmes fichiers que le client).

Usage : python3 tools/fetch_worldmap.py   (après tools/fetch_data.py ; Pillow requis)

- Tuiles de 250 px : <assets>/gfx/maps/<carte>-<échelle>-<n>.jpg, n = ligne × colonnes + colonne + 1
  (colonnes = ⌈échelle × largeur totale ÷ 250⌉), converties en WebP dans data/worldmap/<carte>/<échelle>/<n>.webp.
- Icônes des repères (zaaps, ateliers, HDV…) : atlas <assets>/gfx/icons/assets.png + .json, découpé en
  data/hints/<gfx>.webp pour les repères présents dans data/world.json.
Ne télécharge que ce qui manque (relancer après une mise à jour du jeu : supprimer data/worldmap pour tout refaire).
"""
import io, json, math, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "worldmap"
UA = {"User-Agent": "AtelierTouch/1.0 (outil de fans)"}
TILE = 250


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def tile(job):
    url, out = job
    if out.exists():
        return 0
    try:
        im = Image.open(io.BytesIO(get(url))).convert("RGB")
    except Exception as e:
        print("échec", url, e)
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=72, method=6)
    return 1


def main():
    assets = json.loads((ROOT / ".cache" / "config.json").read_text())["assetsUrl"]
    world = json.loads((ROOT / "data" / "world.json").read_text())
    jobs = []
    for wm, m in world["maps"].items():  # cartes et échelles choisies dans tools/build_data.py (MAPS)
        for s in m[7]:
            cols, rows = math.ceil(float(s) * m[5] / TILE), math.ceil(float(s) * m[6] / TILE)
            for n in range(1, cols * rows + 1):
                jobs.append((f"{assets}/gfx/maps/{wm}-{s}-{n}.jpg", OUT / str(wm) / s / f"{n}.webp"))
    with ThreadPoolExecutor(6) as ex:
        done = sum(ex.map(tile, jobs))
    print(f"tuiles : {done} nouvelles sur {len(jobs)}")

    # Icônes des repères
    atlas = json.loads(get(f"{assets}/gfx/icons/assets.json"))
    sheet = Image.open(io.BytesIO(get(f"{assets}/gfx/icons/assets.png"))).convert("RGBA")
    syms = {v.get("className"): v for v in atlas["symbols"].values()}
    out = ROOT / "data" / "hints"
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for g in sorted({h[5] for h in world["hints"]}):
        s = syms.get(f"icon_{g}")
        if not s:
            continue
        sheet.crop((s["sx"], s["sy"], s["sx"] + s["sw"], s["sy"] + s["sh"])).save(out / f"{g}.webp", "WEBP", quality=90, method=6)
        n += 1
    print(f"icônes de repères : {n}")


if __name__ == "__main__":
    sys.exit(main())
