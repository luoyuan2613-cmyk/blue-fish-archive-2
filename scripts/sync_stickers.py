"""Generate or validate the static sticker manifests (one per theme/partition).

两种存储模式（切换只改环境变量，不动代码）：

- ``local``（默认）：扫描 ``data/<主题>/<分区>/`` 得到文件列表。当前的用法。
- ``remote``：不再扫描本地目录，改为从外部 API 拉文件列表——为"图片搬到对象存储
  （R2 / OSS / COS）+ 前端直传"做准备。现在只是预埋接口，等真正迁移时再用。

环境变量（**不要**把任何密钥写进仓库或本文档）：

===============  ==================================================
GALLERY_STORAGE_MODE   ``local`` | ``remote``，默认 ``local``
GALLERY_BASE_URL       图片根地址，写进清单的 storage.baseUrl（留空 = 相对路径）
GALLERY_PREVIEW_BASE_URL  可选，单独给缩略图用（留空则回退到 GALLERY_BASE_URL）
GALLERY_LARGE_BASE_URL    可选，单独给灯箱大图用（同上）
GALLERY_REMOTE_API     remote 模式下的文件列表接口地址
===============  ==================================================

``remote`` 模式下 API 的约定（返回 JSON）：

.. code-block:: json

    {
      "storage": { "baseUrl": "https://img.example.com/", "previewBaseUrl": "", "largeBaseUrl": "" },
      "files": [
        { "path": "data/manga/default/01.jpg", "filename": "01.jpg",
          "preview": "previews/manga-default-01.webp",
          "large":   "large/manga-default-01.webp",
          "width": 1200, "height": 1600, "alt": "..." }
      ]
    }

请求时会带上 ``?theme=<主题>&partition=<分区>`` 两个查询参数。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
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

# ---- 存储模式与地址（全部可用环境变量覆盖，代码里不出现任何密钥）----

def _env(name: str, default: str = "") -> str:
    """读取环境变量；**空字符串按未设置处理**。

    为什么必须这样：GitHub Actions 里 `${{ vars.XXX }}` 在变量未定义时会传成空字符串，
    而 os.environ.get(name, default) 只在"键不存在"时才用默认值——
    于是 CI 里 mode 会变成 ''，与本地生成的 'local' 不一致，
    CI 每次都会多提交一次"清单不同步"（实测踩过）。
    """
    return os.environ.get(name, "").strip() or default


STORAGE_MODE = _env("GALLERY_STORAGE_MODE", "local").lower()
if STORAGE_MODE not in {"local", "remote"}:
    raise SystemExit(
        f"GALLERY_STORAGE_MODE 只能是 local 或 remote，当前为 {STORAGE_MODE!r}"
    )
STORAGE_BASE_URL = _env("GALLERY_BASE_URL")
STORAGE_PREVIEW_BASE_URL = _env("GALLERY_PREVIEW_BASE_URL")
STORAGE_LARGE_BASE_URL = _env("GALLERY_LARGE_BASE_URL")
REMOTE_API = _env("GALLERY_REMOTE_API")

# ↓↓↓ 想要改图片说明，只改这一行（会被写进 manifest 的 alt，灯箱与无障碍朗读用）↓↓↓
DEFAULT_ALT = "动画贺图收藏"


def _image_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        with Image.open(path) as image:
            return image.size
    except OSError:
        return None


# ---- 文件名防呆：URL 不安全字符 -------------------------------------------------
#
# 素材多是从推特存下来的，文件名里会带 `#`（话题标签）之类的内容。真踩过（坑 26）：
#   27 张 `... #白聖女と黒牧師 ...` 的图**一直没在墙上显示过**，而且更隐蔽的是——
#   `#` 在 URL 里是**锚点**，浏览器请求时会把它之后整段丢掉 → 请求到不存在的短路径 → 404
#   → 卡片被判为加载失败 → 当时从 DOM 里删掉卡片 → CSS 多列整墙重排
#   → 表现为"滚动时已经显示的图片概率性闪一下换成另一张图"（所以前端也做了转义兜底）。
#
# 这里在**入库时**就把文件名洗干净（重命名磁盘上的文件，清单与缩略图产物名随之更新），
# 从源头避免二次编码问题：CDN / 对象存储 / 本地预览都不必再特判。
#
# 只替换"真的会破坏 URL"的字符；**空格、中文、`!` 一律保留**——
# 它们是合法字符（浏览器会自动编码），改名会把 390 个文件名全冲一遍，得不偿失。
UNSAFE_NAME_CHARS = "#?%"

# 关掉这个行为（例如想先人工确认）：--no-sanitize 或 GALLERY_SANITIZE_NAMES=0
SANITIZE_NAMES = _env("GALLERY_SANITIZE_NAMES", "1").strip().lower() not in {"0", "false", "no", "off"}


def sanitize_filename(name: str) -> str:
    """把文件名里会破坏 URL 的字符换成 `_`（只处理文件名，不动目录）。"""
    cleaned = name
    for char in UNSAFE_NAME_CHARS:
        cleaned = cleaned.replace(char, "_")
    return cleaned


def sanitize_source_names(source_dir: Path) -> list[tuple[str, str]]:
    """重命名分区内 URL 不安全的源文件名，返回 [(旧名, 新名), ...]。撞名自动编号，绝不覆盖。"""
    renames: list[tuple[str, str]] = []
    for path in sorted(source_dir.iterdir(), key=lambda item: item.name.casefold()):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        safe = sanitize_filename(path.name)
        if safe == path.name:
            continue
        target = source_dir / safe
        index = 2
        while target.exists():
            target = source_dir / f"{Path(safe).stem}-{index}{Path(safe).suffix}"
            index += 1
        path.rename(target)
        renames.append((path.name, target.name))
    return renames


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


def storage_block() -> dict[str, str]:
    """写进清单的存储配置；baseUrl 留空表示沿用相对路径（当前行为）。"""
    return {
        "mode": STORAGE_MODE,
        "baseUrl": STORAGE_BASE_URL,
        "previewBaseUrl": STORAGE_PREVIEW_BASE_URL,
        "largeBaseUrl": STORAGE_LARGE_BASE_URL,
    }


def fetch_remote_manifest(theme: str, partition: str) -> tuple[dict[str, str], list[dict[str, str]]]:
    """remote 模式：从外部 API 取文件列表（预埋接口，尚未接入真实服务）。

    真实迁移时把 GALLERY_REMOTE_API 指向自己的服务（或 Cloudflare Worker）即可；
    接口形状见模块 docstring。这里只做最朴素的 HTTP GET，不携带任何密钥。
    """
    if not REMOTE_API:
        raise RuntimeError(
            "STORAGE_MODE=remote 需要设置 GALLERY_REMOTE_API 环境变量（图片列表接口地址）"
        )
    query = urllib.parse.urlencode({"theme": theme, "partition": partition})
    url = f"{REMOTE_API}{'&' if '?' in REMOTE_API else '?'}{query}"
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))

    storage = payload.get("storage") or storage_block()
    files = payload.get("files") or []
    entries: list[dict[str, str]] = []
    for item in files:
        entry = {
            "original": item.get("path") or item.get("url") or "",
            "filename": item.get("filename") or Path(entry_path(item)).name,
            "alt": item.get("alt") or DEFAULT_ALT,
        }
        for key in ("preview", "large"):
            if item.get(key):
                entry[key] = item[key]
        if item.get("width") and item.get("height"):
            entry["width"], entry["height"] = item["width"], item["height"]
        entries.append({k: v for k, v in entry.items() if v not in ("", None)})
    return storage, entries


def entry_path(item: dict) -> str:
    return item.get("path") or item.get("url") or ""


def manifest_text(storage: dict[str, str], items: list[dict[str, str]]) -> str:
    """清单结构：{ storage: {...}, items: [...] }。

    注意：**不要**在这里加时间戳之类的易变字段——CI 用 --check 逐字节比对，
    有任何每次生成都不同的内容都会让校验永远失败。
    """
    payload = {"storage": storage, "items": items}
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when any partition manifest is not synchronized with its source folder.",
    )
    parser.add_argument(
        "--no-sanitize",
        action="store_true",
        # ⚠️ help 里的 `%` 必须写成 `%%`：argparse 会拿 help 做 printf 格式化，
        # 单独的 `%` 会直接抛 ValueError: badly formed help string（脚本连启动都进不去，坑 27）。
        help="Do not rename source files that contain URL-unsafe characters (#, ?, %%).",
    )
    args = parser.parse_args()

    try:
        partitions = discover_partitions()
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 1

    # 文件名防呆：先洗名字，再建清单（顺序不能反，否则清单里还是旧文件名）。
    # --check 是只读校验（PR 里跑），绝不能改名，所以跳过。
    if not args.check and not args.no_sanitize and SANITIZE_NAMES and STORAGE_MODE == "local":
        for partition in partitions:
            for old_name, new_name in sanitize_source_names(Path(partition["source"])):
                print(f"[{partition['id']}] 文件名防呆: {old_name}  →  {new_name}")

    print(f"storage mode: {STORAGE_MODE}" + (f"  baseUrl: {STORAGE_BASE_URL}" if STORAGE_BASE_URL else "  (相对路径)"))
    for partition in partitions:
        source_dir = Path(partition["source"])
        manifest_path = Path(partition["manifest"])
        theme = str(partition["theme"])
        part = str(partition["partition"])
        try:
            if STORAGE_MODE == "remote":
                storage, entries = fetch_remote_manifest(theme, part)
            else:
                storage, entries = storage_block(), build_manifest(source_dir, theme, part)
            expected = manifest_text(storage, entries)
        except (FileNotFoundError, ValueError, RuntimeError) as error:
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
