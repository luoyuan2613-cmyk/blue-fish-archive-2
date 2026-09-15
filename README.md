# 白圣女与黑牧师伊甸园 · 图片收藏站

纯静态图片站：**无框架、无构建、无后端**，只有 `index.html` + `styles.css` + `app.js`，
数据是每个「主题 × 分区」一份 JSON 清单（由脚本生成）。
界面沿用上游 [EDMOK/blue-fish-archive](https://github.com/EDMOK/blue-fish-archive) 的「深海贴纸风」，
内容为收集整理的他人作品 —— 来源与授权见站内「来源」区与页脚声明（**不可删除**）。

| 项 | 值 |
|---|---|
| 线上地址 | https://blue-fish-archive-2.luoyuan2613.workers.dev/ |
| 仓库 | `git@github.com:luoyuan2613-cmyk/blue-fish-archive-2.git`（**SSH**，非 HTTPS） |
| 托管 | Cloudflare Workers 静态资源；推送到 `main` 自动部署 |
| 本地预览 | 双击 `启动本地预览.bat`，或桌面快捷方式「图片站（W）」 |
| 数据目录（日常只动这里） | `data/<主题>/<分区>/` |

> 最后更新：2026-09-15（结构与流程的一次大改后的版本）

---

## 一、目录结构

```
fish-gallery/
├── index.html            页面结构 + 全部文案
├── styles.css            样式（深海贴纸风；追加式改动，未动上游规则）
├── app.js               交互：瀑布流 / 灯箱 / 主题书签头 / 分区切换
├── _headers              Cloudflare 缓存策略（本地服务会忽略它）
├── .assetsignore         部署忽略清单（决定哪些文件不上传到 Cloudflare，见 §四）
│
├── data/<主题>/<分区>/    ← 素材目录（唯一需要你操作的目录）
│     例：data/manga/default/  data/manga/cos/  data/whale/default/  data/whale/cos/
├── previews/             480px WebP 缩略图（脚本生成，产物名带「主题-分区-」前缀）
├── large/                原尺寸 WebP（脚本生成，灯箱看图用）
├── stickers/             每个「主题×分区」一份清单：manifest_<主题>-<分区>.json（脚本生成，勿手改）
├── assets/               首页立绘（含主题专用立绘 theme-whale.*）
├── logo/                 站点图标与品牌标记（含 favicon.ico）
├── memes/                看板娘图片与音效
│
├── scripts/
│   ├── make_previews.py  data/<主题>/<分区>/ → previews/ + large/，并清理孤儿产物
│   └── sync_stickers.py  data/<主题>/<分区>/ → stickers/manifest_<主题>-<分区>.json
├── .github/workflows/
│   ├── sync-stickers.yml     push 后自动生成缩略图与清单并提交回仓库
│   └── validate-stickers.yml PR 时校验清单是否与素材同步
│
├── 启动本地预览.bat        双击起本地服务并打开浏览器
├── 创建桌面快捷方式.bat    在桌面生成/刷新「图片站（W）」快捷方式
├── create_shortcuts.ps1    上面那个 bat 实际调用的 PowerShell
├── UPLOAD.md               操作手册（加/删图、新增/重命名主题与分区）
└── 开发交接（和武）.md      完整交接与历史踩坑记录
```

**主题 × 分区**：主题（`manga` / `whale`）各自拥有一套分区（`default` / `cos`），互不混合。
切主题时，顶部导航和作品墙顶部的分区入口会整体换成该主题自己的分区。
分区数量与图片数量由素材目录决定，页面标签上会显示各区实际数量。

---

## 二、日常操作

### 加图 / 删图（本地，三条命令）

```bash
# 1) 图片放进对应分区，例如 data/whale/cos/
# 2) 生成缩略图与大图（自动清理源文件已不存在的旧产物）
python scripts/make_previews.py
# 3) 重新生成清单
python scripts/sync_stickers.py
# 4) 提交并推送（推上去才会到云端）
git add -A && git commit -m "加图" && git push
```

⚠️ **在 Windows PowerShell 里 `&&` 不可用**（5.1 不支持），请逐行执行：

```powershell
git add -A
git commit -m "加图"
git push
```
（cmd 或 Git Bash 里 `&&` 可用；`;` 在 PowerShell 里可连接但不短路。）

只想提交图片内容、不带其它杂项时：

```powershell
git add data previews large stickers
git commit -m "加图"
git push
```

**删图同理**：删掉 `data/<主题>/<分区>/` 里的原图 → 跑上面两条脚本（自动清孤儿产物与清单条目）→ 提交推送。

**格式**：`PNG · JPG · JPEG · GIF · WebP · APNG`。**GIF / APNG 不生成缩略图**，前端直接播原图。
**换图请改文件名**：`data/`、`previews/`、`large/` 是永久缓存，同名换内容老访客会一直看到旧图。
单张 ≤ **25 MiB**（Cloudflare 限制）。中文名、带空格的文件名都可以。

### 网页方式（不装任何东西）

在 GitHub 网页上往 `data/<主题>/<分区>/` 上传或删除文件并 Commit 即可：
CI 会自动生成清单与缩略图、清理孤儿产物并提交回来（因为 `data/**` 在触发路径里），随后自动部署。

### 本地预览（Windows）

- 双击 `启动本地预览.bat` → 起 `http://127.0.0.1:8000/` 并打开浏览器；**关掉窗口即停止服务**。
- 换端口：`启动本地预览.bat 8080`；只起服务不开浏览器：`启动本地预览.bat --no-browser`。
- 端口已在监听时会直接开页面，不会重复起服务。
- 别用 `file://` 直接双击 `index.html`：浏览器会拦截 `fetch('stickers/…')`，页面会是空墙。
- 手机/平板同局域网看：用 `http://<本机IP>:8000`，但**局域网 IP 不是安全上下文，灯箱「复制图片」会失效**（看图/下载正常）。

---

## 三、推送与排错

### 标准推送

```powershell
git add -A
git commit -m "说明"
git push          # 或 git push origin main
```
推送成功后 CI 与 Cloudflare 约 1–2 分钟生效；部署切换的几十秒内站点会短暂打不开（正常）。

### 遇到 `Permission denied (publickey)` 的排查顺序（2026-09 事故复盘）

**不要急着重生成 SSH Key。** 按顺序查：

```powershell
ssh -T git@github.com      # 1) 通 → 账号与密钥没问题，问题在「Git 用的 ssh」与「手敲的 ssh」不一致
git remote -v              # 2) 确认远端是你要推的仓库
git ls-remote origin       # 3) 若 1 成功而这里失败 → 就是两套 ssh 配置不一致
ssh -v -T git@github.com   # 4) 看 identity file 列表：全是 type -1 = 找不到密钥文件
ssh-add -l                 # 5) 看 ssh-agent 里有没有加载 key
```

**当时的真实根因**：本机 GitHub 用的密钥文件名是 **`id_ed25519_manga`（非默认名）**，且
`%USERPROFILE%\.ssh\` 下**没有 `config`**。于是：
- **系统 OpenSSH**（`C:\Windows\System32\OpenSSH\ssh.exe`）能找到 —— 它连得上 Windows ssh-agent（服务已运行、key 已加载）；
- **Git 自带 ssh**（`C:\Program Files\Git\usr\bin\ssh.exe`）找不到 —— 它用的是另一套 agent socket，又没有 key 文件、没有 config → `publickey` 拒绝。

**已做的两处加固（都已实测）**：

1. `%USERPROFILE%\.ssh\config` 显式指定密钥文件（**根治**，不再依赖 agent）：
   ```
   Host github.com
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_manga
     IdentitiesOnly yes
     AddKeysToAgent yes
   ```
   加固前 Git 自带 ssh 报 `Permission denied`，加固后成功 `Hi luoyuan2613-cmyk!`；
   连 `git ls-remote` 走自带 ssh 也能列出提交。
2. `git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"`（当时的救急修法）。
   有了第 1 条后它已非必需，留着也无害。

**已知的其它推送坑**：

| 现象 | 原因与对策 |
|---|---|
| `git clone https://github.com/...` 卡死/超时 | 本机到 `github.com:443` 不通，**必须走 SSH**（`git@github.com:...`） |
| `The token '&' is not a valid statement separator` | Windows PowerShell 5.1 不支持 `&&`，逐行执行或用 cmd/Git Bash |
| `git push` 长时间无输出后超时 | 图片较多时上传慢（数十 MB），重试即可；或用后台任务推送 |
| 本地比远端多 N 个提交 | 说明只 commit 没 push；`git log --oneline origin/main..HEAD` 查看，再 `git push` |

---

## 四、部署链路与缓存

```
改 data/<主题>/<分区>/  →  跑两条脚本  →  git push
        ↓
GitHub Actions：sync-stickers.yml 生成 previews/ + large/ + 清单并提交回仓库
        ↓
Cloudflare Workers：自动拉取仓库，作为静态资源发布（约 1–2 分钟）
```

- **CI 触发路径只有**：`data/**`、`scripts/*.py`、`.github/workflows/sync-stickers.yml`。
  只推 `previews/`、`large/`、`stickers/` **不会触发任何工作流**（所以别只删产物）；需要时可去
  Actions 页面手动 `Run workflow`。
- **`.assetsignore` 是部署的命门**：Cloudflare 的部署命令是 `npx wrangler deploy` 且资源目录是仓库根，
  若 `deploy` 把 `.git/` 一起当静态资源，`pack` 文件会超 **25 MiB** 上限导致
  `Asset too large` 构建失败（本项目曾因此长期部署不生效）。因此该文件排除了
  `.git`、`.github`、`scripts`、`*.md`、`*.bat`、`*.ps1` —— **不要删**。
- **缓存策略（`_headers`）**：
  | 路径 | Cache-Control |
  |---|---|
  | `/data/*`、`/previews/*`、`/large/*` | `max-age=31536000, immutable`（永久，故换图要改名） |
  | `/logo/*`、`/assets/*`、`/memes/*` | `max-age=600`（10 分钟，换素材后能较快生效） |
  | `index.html`、`app.js`、清单等 | `max-age=0, must-revalidate`（每次发布即时生效） |
- **仓库设置**：`Settings → Actions → General → Workflow permissions` 需为 **Read and write**，
  否则 CI 无法把生成的清单/缩略图提交回仓库。
- **部署切换期**：推送后替换实例的约 60 秒内域名会全部超时，属正常现象，等 1 分钟再试。

---

## 五、新增 / 重命名 主题与分区

摘要（**详细步骤见 [UPLOAD.md](UPLOAD.md)**）：

```
data/<主题>/<分区>/   →   stickers/manifest_<主题>-<分区>.json
```
1. **建目录放图**即完成数据侧（脚本自动发现，有图才生成清单）。
2. 前端要在 `app.js` 里同步：`THEMES`（哪个主题有哪些分区、各自读哪份清单）与
   `themeConfig`（配色/立绘/文案）——**两处 id 必须一致**，这是唯一容易漏改的地方。
3. 本地跑两条脚本 → 刷新验证 → 推送。
4. 重命名时要 `git mv` 目录、删旧清单、跑脚本（会自动清理旧前缀产物），再改 `app.js` 两处。

---

## 六、文档索引

| 文件 | 用途 |
|---|---|
| `README.md` | 本文件：结构、日常操作、推送排错、部署与缓存 |
| `UPLOAD.md` | 操作手册：加/删图速查、本地使用、**新增/重命名主题与分区全流程** |
| `开发交接（和武）.md` | 交接文档：完整历史、13 个已踩坑（含部署事故、缓存坑、无头验证三陷阱等） |

---

## 七、版权提示（收录他人作品，必读）

- 站内「来源」区与页脚「非官方整理 · 版权归原作者所有」**不可删除**；请如实标注原作者、平台与授权协议。
- 需要撤下某张图时：删 `data/` 里的原图 → 跑两条脚本（自动清产物与清单）→ 推送。
- 上游原作者的素材（立绘、表情包、logo、看板娘图）未随本仓库分发。
