# 【站名】 图片收藏站

基于 [EDMOK/blue-fish-archive](https://github.com/EDMOK/blue-fish-archive)（蓝色大肥鱼档案馆）的静态图片站骨架，
保留其全部设计与交互（深海贴纸风、防抖瀑布流、灯箱翻页、复制转 PNG、国内可达字体 CDN），
已清空原作者的版权素材，替换为中立占位素材与占位文案。

**当前状态：已推送到 GitHub（`luoyuan2613-cmyk/blue-fish-archive-2`），CI 自动链路已验证通过；
已换入 28 张真实素材；尚待完成：品牌文案替换 + 接入 Cloudflare Pages。**

上线地址（连上 Cloudflare Pages 后生效）：`https://blue-fish-archive-2.pages.dev/`

---

## 一、目录结构

```
fish-gallery/
├── index.html          页面结构 + 全部文案（品牌占位点都在这里）
├── styles.css          样式（与原作一致，无需改动）
├── app.js              交互逻辑（与原作一致，无需改动）
├── stickers/manifest_<主题>-<分区>.json   每个「主题×分区」一份清单（脚本生成，勿手改）
├── data/<主题>/<分区>/   ← 素材目录（唯一需要你操作的目录）
├── previews/           480px WebP 缩略图（脚本生成，瀑布流用）
├── large/              原尺寸 WebP（脚本生成，灯箱看图用）
├── assets/             首页立绘：deepseek_whale.png / .webp
├── logo/               favicon.png、apple-touch-icon.png、品牌标记 2 张
├── memes/              看板娘图片与音效
├── scripts/
│   ├── make_previews.py    data/<主题>/<分区>/ → previews/ + large/（产物名带主题-分区前缀）
│   └── sync_stickers.py    data/<主题>/<分区>/ → 各自的分区清单（含宽高）
└── .github/workflows/
    ├── sync-stickers.yml       推送后自动生成缩略图与清单并提交回仓库
    └── validate-stickers.yml   PR 时校验清单是否同步
```

## 二、本地跑起来

```bash
# 需要 Python 3 + Pillow
pip install Pillow

# 1) 生成缩略图与大图（只处理新增/更新的文件，可反复执行）
python scripts/make_previews.py

# 2) 重新生成清单
python scripts/sync_stickers.py

# 3) 本地预览
python -m http.server 8000
# 打开 http://127.0.0.1:8000/
```

支持格式：`PNG · JPG · JPEG · GIF · WebP · APNG`。
注意：**GIF / APNG 不生成缩略图**，前端会直接播放原文件（原作设计如此）。

## 三、日常加图（本地）

1. 把图片拷进 `media/`（建议用新的文件名，避免老访客命中永久缓存看到旧图）。
2. 跑上面第 1、2 条命令。
3. 预览确认后提交推送。

推到 GitHub 后，`.github/workflows/sync-stickers.yml` 会在 `media/**` 有变更时
自动跑这两条脚本并把结果 commit 回仓库，**这一步之后你连命令都不用敲**。

### ⚠️ 工作流的路径触发规则（实测踩过的坑）

`sync-stickers.yml` **只在这些路径变化时触发**：

```
media/**    scripts/*.py    .github/workflows/sync-stickers.yml
```

`previews/**`、`large/**`、`stickers/manifest.json` **不在触发路径里**。因此：

| 你的操作 | 会发生什么 |
|---|---|
| 只往 `media/` 加图 → push | ✅ 触发，CI 生成缩略图 + 清单并提交回仓库 |
| 改了 `scripts/*.py` → push | ✅ 触发 |
| 只推 `stickers/manifest.json`（手改清单） | ❌ 什么都不触发，远端保持你推上去的样子 |
| 只删 `previews/` 或 `large/` 里的文件 | ❌ 不触发；这些孤儿文件会留在仓库里（不影响页面，因为页面只读 manifest） |

**安全做法**：永远只通过「改 `media/`」来增删图，并在本地跑完那两条脚本后**一起**提交
（这样 manifest 也不会不同步）。另外注意：CI 自己的提交只改了 `previews/`、`large/`、
`stickers/manifest.json`，所以**不会**再次触发自己，不会形成死循环。

### 已实测的链路（本仓库验证过）

- ✅ push `media/` 新图 → Actions 自动生成 `previews/` + `large/` + 更新 manifest → 以
  `github-actions[bot]` 身份提交回仓库（需仓库 Actions 权限为 **Read and write**，已开启）
- ✅ 清单不同步时 CI 会失败（`--check` 退出码 1），可作为护栏

## 四、上线（GitHub + Cloudflare Pages）

1. 新建 GitHub 仓库，把本目录推上去。
2. Cloudflare Pages → 连接该仓库：
   - **构建命令：留空**
   - **输出目录：`/`**
3. ⚠️ **仓库 Settings → Actions → General → Workflow permissions 必须选 "Read and write"**。
   不改这一步，CI 无法把生成的缩略图/清单推回仓库，线上页面会一直停在骨架屏。

选 Cloudflare Pages 而不是 Vercel / GitHub Pages 的原因：原站就在 `pages.dev` 上，
国内可直连；GitHub Pages 在大陆常常打不开，Vercel 的默认域名也不稳。

## 五、品牌替换点（7 处，全在 `index.html`，文件里已用 `【替换点 N】` 注释标出）

| # | 位置 | 占位符 |
|---|---|---|
| 1 | `<title>` 与 meta description | `【站名】` / `【一句话简介…】` |
| 2 | 导航站名与品牌标记 | `【站名】`（含 `<img alt>`） |
| 3 | Hero 三行文案 | `【副标题…】` / `【主标题上】`·`【主标题下】` / `【一句话简介】` |
| 4 | 首页立绘区 | `【标签…】` / 立绘 `alt` / `【立绘下方小字】` |
| 5 | 来源区两张卡 + 授权说明 | `【来源 A/B…】` / `【原作者名 · 平台】` / `【授权协议…】` |
| 6 | 页脚品牌 + 作者署名 | `【站名】` / `【作者名】` |
| 7 | 空状态文案 | 无需改，看需求 |

`【作者名】` 还出现在导航栏两个社交图标的 `aria-label` / `title` 里，
它们的 `href` 目前是 `#`，请换成你自己的 Bilibili / GitHub 地址（来源卡的 `href` 同理）。

替换完成后可以自查残留：

```bash
grep -n "【" index.html   # 应只剩你想保留的
```

## 六、占位素材清单（上线前全部要换掉）

| 文件 | 现在是什么 | 你要换成 |
|---|---|---|
| `media/ph01–ph06.png` | 6 张渐变占位块（含不同宽高比，用于验证瀑布流） | 你的图片，然后删掉这些 |
| `assets/deepseek_whale.png/.webp` | 422×750 渐变块 | 你的首页代表图（不需要可删整块 HTML） |
| `logo/deepseek_蓝鲸_彩色.png` | 占位圆形标记（**文件名沿用原作**，为了零改代码） | 你的 logo；换名后需同步改 `index.html` |
| `logo/deepseek_蓝鲸_黑色.png` | 同上，页脚用 | 同上 |
| `logo/favicon.png` / `apple-touch-icon.png` | 占位标记 | 你的站点图标 |
| `memes/120302wg44ju245iDQ38xu.png/.webp` | 占位看板娘笑脸 | 你的看板娘；不需要就删掉 `#mascot` 整块 |
| `memes/xixi.aac` | **0.5 秒静音**（本机无 ffmpeg，无法编码 AAC） | 你的音效（任意 AAC/MP3，改 `index.html` 里的 `<audio src>`） |

## 七、上线前 checklist

- [ ] 7 处品牌文案全部替换，`grep -n "【" index.html` 无残留占位符
- [ ] `media/` 里的占位图（`ph0*.png`）已删除，换成真实素材
- [ ] `previews/`、`large/`、`stickers/manifest.json` 已重新生成（删了图后会同步移除条目）
- [ ] 来源区逐条填写真实出处与授权协议
- [ ] 页脚保留「非官方整理 · 版权归原作者所有」声明
- [ ] 社交图标链接已换成你自己的地址
- [ ] Cloudflare Pages 的 Workflow permissions 已设为 Read and write
- [ ] 手机上看一眼瀑布流与灯箱

## 八、版权提示（收录他人作品时必读）

本站骨架默认面向「整理/展示他人作品」的场景，因此：

- 来源区与页脚声明**不可删除**；请如实标注原作者、平台与授权协议。
- 若原作者要求撤下，应能快速定位并删除对应文件（`media/` + `previews/` + `large/` 里的同名文件，删完重跑脚本）。
- 原作者素材（立绘、表情包、logo、看板娘图）已从本仓库全部清除，未随骨架分发。

## 九、与原作的差异（3 处，均已记录）

1. **`index.html`**：品牌文案占位化，来源区改为通用来源/授权结构，社交与来源链接改为占位 `href`。
2. **`stickers/manifest.json`**：`alt` 由 `鲸鱼娘同人表情包` 改为 `【图片说明】`。
   注意 `scripts/sync_stickers.py` 里的 `alt` 是硬编码的，**下一次跑脚本会被覆盖回角色名**；
   届时手动改 `sync_stickers.py` 里那一行为你想要的值，或每次生成后改清单。
3. **`app.js` / `styles.css`**：保持与原作者完全一致（按需求不做改动）。因此仍留有非功能性痕迹：
   - `app.js` 里看板娘位置的 localStorage 键名 `deepseek-mascot-position`；
   - `styles.css` 一条注释提到原角色名。
   两者都不影响功能，介意的话自行替换字符串即可。
