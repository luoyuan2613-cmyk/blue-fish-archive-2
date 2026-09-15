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

Orphan cleanup: previews/large files whose source image no longer exists are
deleted (default on) so that deleting an image doesn't leave stale artifacts
behind — pass --no-prune to keep them.
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


def prune_orphans(partitions: list[dict[str, object]]) -> int:
    """删除 previews/、large/ 里"已发现分区前缀"下、但源文件已不存在的产物。

    只处理前缀仍被发现的分区：分区被整体删除/改名时会跳过（那种情况需手动清理，
    以免因为目录暂时缺失误删整批产物）。
    """
    prefixes: set[str] = set()
    expected: set[str] = set()
    for entry in partitions:
        prefix = f"{entry['theme']}-{entry['partition']}"
        prefixes.add(prefix)
        source_dir = Path(entry["source"])
        if not source_dir.is_dir():
            continue
        for path in source_dir.iterdir():
            if path.is_file() and path.suffix.lower() in RASTER_EXTENSIONS:
                expected.add(f"{prefix}-{path.stem}.webp")

    removed = 0
    for directory in (PREVIEW_DIR, LARGE_DIR):
        for path in sorted(directory.glob("*.webp")):
            if path.name in expected:
                continue
            if not any(path.name.startswith(f"{prefix}-") for prefix in prefixes):
                continue
            path.unlink()
            removed += 1
            print(f"Pruned orphan {path.relative_to(ROOT).as_posix()}")
    return removed


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Generate WebP previews for all partitions.")
    parser.add_argument("--no-prune", action="store_true", help="Do not delete orphaned previews/large files.")
    parser.add_argument(
        "--no-sanitize",
        action="store_true",
        help="Do not rename source files that contain URL-unsafe characters (# ? %).",
    )
    args = parser.parse_args()

    partitions = discover_partitions()
    if not partitions:
        print(f"No partition with raster images found under {DATA_DIR}", file=sys.stderr)
        return 1

    # 文件名防呆（与 sync_stickers.py 共用同一份实现，避免两处规则走偏）。
    # 必须在**生成缩略图之前**洗名字：产物名取自文件名，
    # 否则会先按旧名生成一批 webp，清单却指向新名 → 前端拿不到缩略图。
    # 本脚本在 CI/日常流程里先于 sync_stickers.py 执行，所以两边都挂一遍。
    sanitized = 0
    if not args.no_sanitize:
        from sync_stickers import SANITIZE_NAMES, sanitize_source_names

        if SANITIZE_NAMES:
            for entry in partitions:
                for old_name, new_name in sanitize_source_names(Path(entry["source"])):
                    print(f"[{entry['theme']}/{entry['partition']}] 文件名防呆: {old_name}  →  {new_name}")
                    sanitized += 1

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

    pruned = prune_orphans(partitions)
    print(f"Done. {generated} generated, {skipped} up to date, {pruned} orphans pruned.")
    if sanitized:
        print(f"Renamed {sanitized} file(s) with URL-unsafe characters; re-run sync_stickers.py to refresh manifests.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
