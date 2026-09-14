"""Generate WebP previews for every partition's originals, in two tiers.

Partitions are discovered from the data/ layout (same convention as sync_stickers.py):
- data/<theme>/<partition>/  →  previews|large/<theme>-<partition>-<filename>.webp

- Grid tier (previews/, 480px max, q80): the masonry wall shows cards at
  ~210px wide, so 480px comfortably covers 2x displays at a fraction of
  the bytes of a larger tier.
- Large tier (large/, full size, q85): used by the lightbox, so viewing an
  image no longer downloads the multi-hundred-KB original.
  Download/copy keep using the untouched original file.

Only previews that are missing or older than their source are regenerated,
so this is safe to run on every sync. Animated GIF/APNG originals are skipped
so the in-page animation keeps playing from the original file.

Generated names carry the theme/partition prefix so identical filenames in
different themes never overwrite each other.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PREVIEW_DIR = ROOT / "previews"
LARGE_DIR = ROOT / "large"
DATA_DIR = ROOT / "data"
RASTER_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
GRID_MAX_DIMENSION = 480
GRID_QUALITY = 80
LARGE_QUALITY = 85


def discover_partitions() -> list[dict[str, object]]:
    """扫描 data/<主题>/<分区>/，返回含位图的分区（与 sync_stickers.py 保持同一约定）。"""
    partitions: list[dict[str, object]] = []
    if not DATA_DIR.is_dir():
        return partitions
    for theme_dir in sorted(p for p in DATA_DIR.iterdir() if p.is_dir()):
        for part_dir in sorted(p for p in theme_dir.iterdir() if p.is_dir()):
            has_raster = any(
                child.is_file() and child.suffix.lower() in RASTER_EXTENSIONS
                for child in part_dir.iterdir()
            )
            if has_raster:
                partitions.append(
                    {"theme": theme_dir.name, "partition": part_dir.name, "source": part_dir}
                )
    return partitions


def _needs_update(target: Path, source: Path) -> bool:
    return not target.is_file() or target.stat().st_mtime < source.stat().st_mtime


def _to_webp(path: Path, target: Path, quality: int, max_dimension: int | None) -> None:
    with Image.open(path) as image:
        if max_dimension is not None:
            image.thumbnail((max_dimension, max_dimension), Image.LANCZOS)
        has_alpha = image.mode in ("RGBA", "LA") or (
            image.mode == "P" and "transparency" in image.info
        )
        image = image.convert("RGBA" if has_alpha else "RGB")
        image.save(target, "WEBP", quality=quality)
    print(f"Generated {target.relative_to(ROOT).as_posix()}")


def main() -> int:
    partitions = discover_partitions()
    if not partitions:
        print(f"No partition with raster images found under {DATA_DIR}", file=sys.stderr)
        return 1

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    LARGE_DIR.mkdir(parents=True, exist_ok=True)

    generated = 0
    skipped = 0
    seen_targets: set[str] = set()
    for entry in partitions:
        source_dir = Path(entry["source"])
        prefix = f"{entry['theme']}-{entry['partition']}"
        for path in sorted(source_dir.iterdir()):
            if not path.is_file() or path.suffix.lower() not in RASTER_EXTENSIONS:
                continue

            # 产物名带主题-分区前缀：不同主题的同名文件不会互相覆盖
            preview = PREVIEW_DIR / f"{prefix}-{path.stem}.webp"
            large = LARGE_DIR / f"{prefix}-{path.stem}.webp"

            if preview.name in seen_targets:
                print(f"WARNING duplicate target: {path.relative_to(ROOT).as_posix()} skipped")
                continue
            seen_targets.add(preview.name)

            if not _needs_update(preview, path) and not _needs_update(large, path):
                skipped += 1
                continue

            if _needs_update(preview, path):
                _to_webp(path, preview, GRID_QUALITY, GRID_MAX_DIMENSION)
                generated += 1
            if _needs_update(large, path):
                _to_webp(path, large, LARGE_QUALITY, None)
                generated += 1

    print(f"Done. {generated} generated, {skipped} up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
