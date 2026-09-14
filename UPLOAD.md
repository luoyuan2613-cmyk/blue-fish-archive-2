# 怎么加图（速查卡）

网站仓库：https://github.com/luoyuan2613-cmyk/blue-fish-archive-2
线上地址：https://blue-fish-archive-2.luoyuan2613.workers.dev/

**只需记住一件事：只往素材目录里放图，其余全部自动。**

- `data/manga/default/` → 「漫画主题 / 默认区」
- `data/manga/cos/`     → 「漫画主题 / Cos区」
- `data/whale/default/` → 「蓝鲸主题 / 默认区」
- `data/whale/cos/`     → 「蓝鲸主题 / Cos区」

新增主题或分区：**建目录 + 放图**即可（脚本自动发现）。前端 `app.js` 的 `THEMES` 里补一条同名分区即可显示标签。

---

## 方式一：网页上传（推荐，不用装任何东西）

1. 打开对应目录，例如 `/tree/main/data/manga/cos`（主题/分区各一层）
2. 右上角 **Add file → Upload files**
3. 把图片拖进去 → 底部写一句说明（可留默认）→ **Commit changes**
4. 等 1–2 分钟：GitHub Actions 自动生成缩略图、更新清单，Cloudflare 自动重新部署
5. 刷新网站就能看到（强制刷新 Ctrl+F5 更快）

## 方式二：本机批量（图多时用，秒级完成，不用等 Actions）

```
把图拷进：D:\【杂物间】\fish-gallery\media\
```
然后跟我说一句「加图了」，我会跑脚本并推送。或者你自己在终端跑：

```bash
cd "/mnt/d/【杂物间】/fish-gallery"
python scripts/make_previews.py     # 生成缩略图
python scripts/sync_stickers.py     # 更新清单
git add -A && git commit -m "add images" && git push
```

---

## 删图：千万不要只删一个地方

删除有坑，**两种做法二选一**：

| 做法 | 操作 | 说明 |
|---|---|---|
| **A. 找我（最省事）** | 告诉我删哪张 | 我会把 `media/`、`previews/`、`large/`、清单四处一起清干净 |
| **B. 自己删** | 在网页上删掉 `media/`（或 `cos/`）里的图，然后去 https://github.com/luoyuan2613-cmyk/blue-fish-archive-2/actions → 选 **Sync sticker manifest** → 右侧 **Run workflow** | 手动触发会重建两个分区的清单；**只删图不触发，页面不会变**（删图不在自动触发路径里） |

---

## 几条注意事项

- **支持格式**：PNG / JPG / JPEG / GIF / WebP / APNG。GIF、APNG 不生成缩略图，直接播原图（会比较大）。
- **单张别超 25MB**（Cloudflare 单文件上限）。你现在最大的一张是 5MB，安全。
- **换图请改文件名**：`media/`、`previews/`、`large/` 里的文件是**永久缓存**，同名换内容老访客会一直看到旧图。
  而 `assets/`（立绘）、`logo/`、`memes/`（看板娘）是 10 分钟缓存，换了素材稍等即可生效。
  万一你看到的是空白/破图，先按 `Ctrl+Shift+R` 强刷一次（旧缓存可能还留着 404 结果）。
- **文件名可以用中文**（现在就有「【动画贺图】第7話.jpg」这类），空格也能用，无需改名。
- **图注（alt 文字）**：所有图的说明统一取自 `scripts/sync_stickers.py` 里的 `DEFAULT_ALT`，改那一行即可（当前是「动画贺图收藏」）。
- **失败排查**：Actions 页面出现红叉，多半是清单不同步或某张图损坏。把报错发我，或点进那次运行看 `Generate manifest` / `Validate` 那一步的日志。

---

## 网站还在用占位内容（未完成项）

上线前还需替换的 7 处品牌文案（都在 `index.html`，用 `【】` 标出）：
站名、副标题、主标题、一句话简介、来源区（原作者/平台/授权协议）、页脚署名、社交链接。
来源区与页脚声明在收录他人作品时**不可删除**。

设计风格（配色/字体）目前沿用原作，已出过三版预览图存于
`D:\【杂物间】\design-preview\`，日后想改再说。

---

## 新增 / 重命名 主题与分区（操作手册）

### 概念
```
data/<主题>/<分区>/   →   stickers/manifest_<主题>-<分区>.json
```
主题（如 `manga`、`whale`）各自拥有一套分区；前端 `app.js` 里有两份清单必须**同 id**：
- `THEMES`（第 37 行附近）：管**分区**（每个主题有哪些分区、各自读哪份清单）
- `themeConfig`（第 796 行附近）：管**外观**（配色 `vars`、立绘 `art`、文案 `copy`）

> 目前这两份需要手动同步，是唯一容易漏改的地方（日后可合并成一份）。

### 新增一个主题（例：`sakura`）
1. 建目录 `data/sakura/default/`（需要就再加 `data/sakura/cos/`），把图放进去
2. `app.js` → `THEMES` 追加：
   ```js
   { id: 'sakura', name: '樱花主题', label: '樱花', partitions: [
       { id: 'default', label: '默认区', manifest: 'stickers/manifest_sakura-default.json' } ] },
   ```
3. `app.js` → `themeConfig` 追加**同 id** 的一项（`vars` 配色、`art` 立绘、`copy` 文案）
4. 准备该主题的立绘 `assets/theme-sakura.png` + `.webp`（让 `art` 指向它）
5. 本地跑 `python scripts/make_previews.py && python scripts/sync_stickers.py` → 强刷验证
6. 提交推送：CI 自动生成清单与缩略图，Cloudflare 自动部署
7. 顶部导航与作品墙顶部的分区入口会在切换主题时**自动换成该主题的分区**，无需额外配置

### 新增一个分区（例：给漫画主题加 `fanart`）
1. 建目录 `data/manga/fanart/` 放图
2. `app.js` → `THEMES` 的 `manga.partitions` 追加：
   `{ id: 'fanart', label: '同人区', manifest: 'stickers/manifest_manga-fanart.json' }`
3. 分区是"每个主题各自拥有"的，所以想让鲸鱼主题也有，就重复第 1–2 步
4. 跑脚本 → 验证 → 推送

### 重命名一个分区（`cos` → `cosplay`）
1. `git mv data/manga/cos data/manga/cosplay`（每个主题都要改）
2. 删旧清单 `stickers/manifest_manga-cos.json`
3. 跑 `python scripts/make_previews.py`（会**自动清理**旧前缀的孤儿缩略图/大图），再跑 `sync_stickers.py`
4. `app.js` → `THEMES` 里把 `id` 与 `manifest` 路径一起改（`label` 按需改）
5. 浏览器里旧的分区记忆（`localStorage: fish-gallery-partition-<主题>`）指向不存在的分区，会自动回退到第一个分区，无害

### 重命名一个主题（`manga` → `bsm`）
1. `git mv data/manga data/bsm`；删旧清单 `stickers/manifest_manga-*.json`
2. 跑两个脚本（自动清理旧前缀产物并生成新清单）
3. `app.js` **两处都改**：`THEMES` 的 `id` 与各分区 `manifest` 路径；`themeConfig` 的 `id`
4. 主题的立绘/logo 路径写在 `themeConfig` 里，与目录名无关；想一起改名就同步改 `assets/` 文件与引用
5. 验证、推送

### 删图之后
`make_previews.py` 默认会**清理孤儿产物**（源文件已不存在的缩略图/大图）。
若某个分区被整体删空，其旧产物不会被自动清（避免误删），需要手动删 `previews/<主题>-<分区>-*` 与 `large/<主题>-<分区>-*`。

---

## 本地使用（不起公网服务，只看自己这台电脑）

项目根目录提供了三个 Windows 脚本，**不需要联网、不需要 GitHub**：

| 文件 | 作用 |
|---|---|
| `启动本地预览.bat` | 双击即在本机起服务并打开浏览器（默认 `http://127.0.0.1:8000/`） |
| `创建桌面快捷方式.bat` | 在桌面生成「图片站（W）」快捷方式，以后双击它就等于启动 |
| `create_shortcuts.ps1` | 上者实际调用的 PowerShell 脚本；想改快捷方式名字就改里面的 `-Name` |

用法要点：
- 服务窗口**要保持开着**，关掉窗口即停止服务。
- 换端口：`启动本地预览.bat 8080`；只起服务不开浏览器：`启动本地预览.bat --no-browser`（自动化测试用）。
- 端口已在监听时会直接打开页面，不会重复起第二个服务。
- **别双击 `index.html` 用 `file://` 打开**：浏览器会拦截 `fetch('stickers/…')`，页面会是空墙。
- 手机/平板在同局域网想看：用 `http://<本机局域网IP>:8000`，但**局域网 IP 不是安全上下文，灯箱里的「复制图片」会失效**（看图与下载正常）。
- 图标取自 `logo/favicon.ico`；换了 `logo/favicon.png` 之后重新生成 .ico 并重跑一次 `创建桌面快捷方式.bat` 即可刷新图标。

