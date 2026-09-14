# 怎么加图（速查卡）

网站仓库：https://github.com/luoyuan2613-cmyk/blue-fish-archive-2
线上地址：https://blue-fish-archive-2.luoyuan2613.workers.dev/

**只需记住一件事：只动 `media/` 这一个文件夹，其余全部自动。**

---

## 方式一：网页上传（推荐，不用装任何东西）

1. 打开 https://github.com/luoyuan2613-cmyk/blue-fish-archive-2/tree/main/media
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
| **B. 自己删** | 在网页上删掉 `media/` 里的图，然后去 https://github.com/luoyuan2613-cmyk/blue-fish-archive-2/actions → 选 **Sync sticker manifest** → 右侧 **Run workflow** | 手动触发会让它重建；**只删图不触发，页面不会变**（删图不在自动触发路径里） |

---

## 几条注意事项

- **支持格式**：PNG / JPG / JPEG / GIF / WebP / APNG。GIF、APNG 不生成缩略图，直接播原图（会比较大）。
- **单张别超 25MB**（Cloudflare 单文件上限）。你现在最大的一张是 5MB，安全。
- **换图请改文件名**：`media/`、`previews/`、`large/` 里的文件是永久缓存，同名换内容老访客可能看到旧图。
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
