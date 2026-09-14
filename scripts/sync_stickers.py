"""Generate or validate the static sticker manifests (one per theme/partition)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PREVIEW_DIR = ROOT / "previews"
LARGE_DIR = ROOT / "large"
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".apng"}

# 素材目录约定：data/<主题>/<分区>/  →  stickers/manifest_<主题>-<分区>.json
#   例：data/manga/cos/  →  stickers/manifest_manga-cos.json
# 主题与分区都由目录结构自动发现（有图才生成清单），加分区只要建目录 + 放图，
# 前端 app.js 的 THEMES 里补一条同名分区即可。
DATA_DIR = ROOT / "data"

# ↓↓↓ 想要改图片说明，只改这一行（会被写进 manifest 的 alt，灯箱与无障碍朗读用）↓↓↓
DEFAULT_ALT = "动画贺图收藏"


def _image_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        with Image.open(path) as image:
            return image.size
    except OSError:
        return None


def build_manifest(source_dir: Path, theme: str, partition: str) -> list[dict[str, str]]:
    if not source_dir.is_dir():
        raise FileNotFoundError(f"Sticker source directory not found: {source_dir}")

    files = sorted(
        (
            path
            for path in source_dir.iterdir()
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
        ),
        key=lambda path: path.name.casefold(),
    )

    manifest: list[dict[str, str]] = []
    seen_paths: set[str] = set()
    # preview/large 的产物名必须带"主题-分区"前缀：
    # 不同主题的分区常含同名文件（例如两个主题各有一个 01.jpg），
    # 只用文件名做键会互相覆盖，导致 A 主题显示 B 主题的缩略图。
    prefix = f"{theme}-{partition}"
    for path in files:
        original = path.relative_to(ROOT).as_posix()
        normalized = original.casefold()
        if normalized in seen_paths:
            raise ValueError(f"Duplicate sticker path detected: {original}")
        seen_paths.add(normalized)
        entry = {
            "original": original,
            "filename": path.name,
            "alt": DEFAULT_ALT,
        }
        preview = PREVIEW_DIR / f"{prefix}-{path.stem}.webp"
        if preview.is_file():
            entry["preview"] = preview.relative_to(ROOT).as_posix()
        large = LARGE_DIR / f"{prefix}-{path.stem}.webp"
        if large.is_file():
            entry["large"] = large.relative_to(ROOT).as_posix()
        # 网格里实际显示的是 preview(与原图同比例)或原图本体,尺寸必须取自它,
        # 前端据此在图片加载前预留正确宽高,避免瀑布流整墙重排抖动。
        dimensions = _image_dimensions(preview if preview.is_file() else path)
        if dimensions:
            entry["width"], entry["height"] = dimensions
        manifest.append(entry)

    return manifest


def discover_partitions() -> list[dict[str, object]]:
    """扫描 data/<主题>/<分区>/，返回有图片的分区列表（按主题、分区名排序）。"""
    if not DATA_DIR.is_dir():
        raise FileNotFoundError(f"Data directory not found: {DATA_DIR}")

    partitions: list[dict[str, object]] = []
    for theme_dir in sorted(p for p in DATA_DIR.iterdir() if p.is_dir()):
        for part_dir in sorted(p for p in theme_dir.iterdir() if p.is_dir()):
            has_image = any(
                child.is_file() and child.suffix.lower() in SUPPORTED_EXTENSIONS
                for child in part_dir.iterdir()
            )
            if not has_image:
                continue
            partitions.append(
                {
                    "theme": theme_dir.name,
                    "partition": part_dir.name,
                    "id": f"{theme_dir.name}-{part_dir.name}",
                    "source": part_dir,
                    "manifest": ROOT / "stickers" / f"manifest_{theme_dir.name}-{part_dir.name}.json",
                }
            )
    if not partitions:
        raise FileNotFoundError(f"No partition with images found under {DATA_DIR}")
    return partitions


def manifest_text(manifest: list[dict[str, str]]) -> str:
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when any partition manifest is not synchronized with its source folder.",
    )
    args = parser.parse_args()

    try:
        partitions = discover_partitions()
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 1

    for partition in partitions:
        source_dir = Path(partition["source"])
        manifest_path = Path(partition["manifest"])
        try:
            entries = build_manifest(source_dir, str(partition["theme"]), str(partition["partition"]))
            expected = manifest_text(entries)
        except (FileNotFoundError, ValueError) as error:
            print(f"[{partition['id']}] {error}", file=sys.stderr)
            return 1

        label = manifest_path.relative_to(ROOT).as_posix()
        if args.check:
            actual = manifest_path.read_text(encoding="utf-8") if manifest_path.is_file() else ""
            if actual != expected:
                print(
                    f"{label} is out of date; run python scripts/sync_stickers.py",
                    file=sys.stderr,
                )
                return 1
            print(f"[{partition['id']}] {label} is synchronized ({len(entries)} entries).")
        else:
            # newline="\n" 保证 Windows 上生成的也是 LF, 否则提交的 blob 在 Linux CI 的 --check 里对不上
            manifest_path.write_text(expected, encoding="utf-8", newline="\n")
            print(f"[{partition['id']}] generated {label} with {len(entries)} entries.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
