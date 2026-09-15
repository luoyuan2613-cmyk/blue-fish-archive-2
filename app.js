const stickerGrid = document.querySelector('#sticker-grid');
const stickerCount = document.querySelector('#sticker-count');
const wallEmpty = document.querySelector('#wall-empty');
const wallRetry = document.querySelector('#wall-retry');
const siteNav = document.querySelector('.site-nav');
const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxMediaShell = document.querySelector('.lightbox-media-shell');
const lightboxMeta = document.querySelector('#lightbox-meta');
const lightboxPrev = document.querySelector('#lightbox-prev');
const lightboxNext = document.querySelector('#lightbox-next');
const maximizeButton = document.querySelector('#maximize-button');
const maximizeLabel = document.querySelector('#maximize-label');
const lightboxHint = document.querySelector('.lightbox-hint');
const downloadButton = document.querySelector('#download-button');
const actionStatus = document.querySelector('#action-status');
const mascot = document.querySelector('#mascot');
const mascotBubble = document.querySelector('#mascot-bubble');
const mascotAudio = document.querySelector('#mascot-audio');
const stickerPartitions = document.querySelector('#sticker-partitions');
const partitionNav = document.querySelector('#partition-nav');
const navPartitions = document.querySelector('#nav-partitions');   // 顶部导航里的分区入口
const partitionStatus = document.querySelector('#partition-status');
const heroArtImage = document.querySelector('#hero-art-image');
const heroArtWebp = document.querySelector('#hero-art-webp');

const isAnimatedSticker = (sticker) => /\.(gif|apng)$/i.test(sticker.original);

/* ---------------------------------------------------------------------------
 * 需求一：主题 → 分区 两层结构（主题之间互不混合）
 *
 * 数据层由目录结构决定（scripts/sync_stickers.py 自动发现）：
 *   data/<主题>/<分区>/  →  stickers/manifest_<主题>-<分区>.json
 *
 * 文案/图片/配色的数据层**全部来自 theme-data.js**（唯一需要维护的配置文件）：
 *   window.GALLERY_THEME_DATA = { site: {...}, themes: [...] }
 *   · site   = 全站通用（顶栏站名、logo、浏览器标题…），不随主题变
 *   · themes = 每个主题的色板 / hero 文案 / 立绘 / 分区；**数组第一项 = 默认主题**，
 *              必须与 index.html 里的静态文案一致（无 JS 首屏兜底 + 缺字段的回落基准）
 * 新增主题：在 theme-data.js 的 themes 末尾加一项即可，这里不用改。
 * ------------------------------------------------------------------------- */
const THEME_DATA = (window.GALLERY_THEME_DATA && typeof window.GALLERY_THEME_DATA === 'object')
  ? window.GALLERY_THEME_DATA
  : { site: {}, themes: [] };
const SITE = THEME_DATA.site || {};
const themeConfig = Array.isArray(THEME_DATA.themes) ? THEME_DATA.themes : [];
// 别名：分区信息与主题信息现在同源（以前是两份手工对齐、还互相不一致的列表），
// 老调用点（getThemeById / getActivePartitions / THEMES[0]…）因此不用改。
const THEMES = themeConfig;

// 清单缓存按"主题/分区"分键：主题切换后取的是另一份文件，互不干扰
const partitionCache = new Map();
const cacheKey = (themeId, partitionId) => `${themeId}/${partitionId}`;

function getThemeById(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}

const getActivePartitions = () => getThemeById(activeThemeId).partitions;

function getActivePartition() {
  const partitions = getActivePartitions();
  return partitions.find((part) => part.id === currentPartition) || partitions[0];
}

/* ---------------------------------------------------------------------------
 * 图片地址收口（为"图片迁到对象存储 / 国内 CDN"做准备）
 *
 * 清单里可以带 storage 段（见 scripts/sync_stickers.py）：
 *   { "storage": { "baseUrl": "https://img.example.com/",
 *                  "previewBaseUrl": "", "largeBaseUrl": "" },
 *     "items": [ … ] }
 *
 * 前端所有取图都经过 getImageUrl()，所以将来换 CDN 只需改清单里的 baseUrl，
 * 不必再动任何渲染代码。baseUrl 为空时行为与改造前完全一致（相对路径）；
 * 已经是绝对地址（http(s):// / data: / blob: / 以 / 开头）的路径原样返回，
 * 便于迁移期间逐张过渡。
 * ------------------------------------------------------------------------- */
const storageConfig = { baseUrl: '', previewBaseUrl: '', largeBaseUrl: '' };

// 每次都按新清单重置（缺字段即视为空）：
// 否则从"带 baseUrl 的分区"切到"旧格式/本地分区"时，旧 baseUrl 会残留，
// 把相对路径拼成上一个 CDN 的地址。
function applyStorageConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  ['baseUrl', 'previewBaseUrl', 'largeBaseUrl'].forEach((key) => {
    storageConfig[key] = typeof source[key] === 'string' ? source[key].trim() : '';
  });
}

// 把资源路径转成"浏览器真会照着请求"的 URL。
//
// ⚠️ 必须做这一步（坑 26，线上实测过）：素材是从推特存下来的，文件名里带着
// `#白聖女と黒牧師` 这类内容 —— 而 `#` 在 URL 里是**锚点**，浏览器会把 `#` 之后整段丢掉，
// 于是请求的是一个不存在的短路径 → 404 → 卡片被判为加载失败。
// 同理 `?` 会被当成查询串的开头。这两个字符必须显式转义：
// encodeURI 认为它们"合法"（在 URI 里确实合法），所以要在它之后手工替换。
function encodeImagePath(path) {
  return encodeURI(path).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

function joinStorageUrl(base, path) {
  if (!path) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) {
    return path;                                  // 已是完整地址（http(s):、//cdn...）→ 原样返回，别二次编码
  }
  const encoded = encodeImagePath(path);          // 相对路径 / 站点根路径 → 都要转义
  if (!base) return encoded;                      // 未配置 baseUrl → 保持相对路径
  return base.replace(/\/+$/, '') + '/' + encoded.replace(/^\/+/, '');
}

// kind: 'original'（默认）| 'preview' | 'large'
function getImageUrl(path, kind = 'original') {
  if (!path) return '';
  const fallback = storageConfig.baseUrl;
  const base =
    kind === 'preview' ? storageConfig.previewBaseUrl || fallback
      : kind === 'large' ? storageConfig.largeBaseUrl || fallback
        : fallback;
  return joinStorageUrl(base, path);
}

async function fetchPartition(themeId, partitionId) {
  const theme = getThemeById(themeId);
  const partition = theme.partitions.find((part) => part.id === partitionId);
  if (!partition) throw new Error(`unknown partition: ${themeId}/${partitionId}`);
  const key = cacheKey(themeId, partitionId);
  if (partitionCache.has(key)) return partitionCache.get(key);
  const response = await fetch(partition.manifest, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${partition.manifest} unavailable`);
  const payload = await response.json();
  // 兼容两种清单格式：新的 { storage, items } 与旧的裸数组（旧数据永不失效）
  const legacyArray = Array.isArray(payload);
  const stickers = legacyArray ? payload : (payload && payload.items) || [];
  applyStorageConfig(legacyArray ? null : payload && payload.storage);   // 旧格式 → 清空为相对路径
  partitionCache.set(key, stickers);
  return stickers;
}

let activeThemeId = THEMES[0].id;                    // 初始主题 = THEMES[0]（页面默认那套）
let currentPartition = THEMES[0].partitions[0].id;   // 初始分区 = 该主题的第一个分区
let stickerList = [];
let activeIndex = -1;
let activeSticker = null;
let isMaximized = false;            // 灯箱「最大化」状态（不调用全屏 API，只放大到视口）

const revealItems = document.querySelectorAll('[data-reveal]');
revealItems.forEach((item) => {
  if (item.dataset.delay) {
    item.style.setProperty('--delay', `${item.dataset.delay}ms`);
  }
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    // rootMargin 提前约 640px 触发入场动画:元素还在视口外时动画就已开始,
    // 滚到时不再有"卡半拍才开始动"的感觉。
    { rootMargin: '640px 0px', threshold: 0.05 },
  );
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

function createStickerCard(sticker, index) {
  const card = document.createElement('button');
  card.className = 'sticker-card';
  card.type = 'button';
  card.style.setProperty('--tilt', `${index % 2 === 0 ? 0.4 : -0.4}deg`);
  card.style.setProperty('--sticker-delay', `${Math.min(index, 16) * 58}ms`);
  card.setAttribute('aria-label', '打开表情预览');

  const inner = document.createElement('span');
  inner.className = 'sticker-card-inner';

  const source = getImageUrl(sticker.preview, 'preview') || getImageUrl(sticker.original);
  const image = document.createElement('img');
  image.src = source;
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  // 预先声明宽高让浏览器在加载前就按正确宽高比占位,图片到达后高度不再变化,
  // CSS columns 也就不会在每次加载时重新平衡列导致整墙抖动。
  if (sticker.width > 0 && sticker.height > 0) {
    image.width = sticker.width;
    image.height = sticker.height;
  }
  let triedOriginal = false;
  image.onload = () => card.classList.add('is-loaded');
  image.onerror = () => {
    if (sticker.preview && !triedOriginal) {
      triedOriginal = true;
      image.src = getImageUrl(sticker.original);
      return;
    }
    // ⚠️ 兜底**绝不把卡片从 DOM 里删掉**（坑 26）。
    // 墙是 CSS 多列（`columns: 4 210px`）均衡分列的：从中间抽掉一张卡片，
    // 整面墙会重新分列 —— 屏幕上同一位置的图就"闪一下换成了另一张"。
    // 懒加载滚到哪张坏图、就在哪一刻重排，所以表现为"滚动时概率性闪图，加载完就好了"。
    // 现在只标记状态：节点与占位高度都留着，任何一张图加载失败都不会再动布局。
    card.classList.add('is-broken');
  };
  // 命中缓存时 load 事件可能早于监听注册,补一次判断
  if (image.complete && image.naturalWidth > 0) {
    card.classList.add('is-loaded');
  }

  inner.appendChild(image);
  card.appendChild(inner);

  // 每隔几张随手贴一段和纸胶带,整面墙更像手账本
  const tapeSlot = index % 6;
  if (tapeSlot === 1 || tapeSlot === 4) {
    const tape = document.createElement('span');
    tape.className = tapeSlot === 4 ? 'card-tape is-right' : 'card-tape';
    tape.setAttribute('aria-hidden', 'true');
    card.appendChild(tape);
  }

  if (isAnimatedSticker(sticker)) {
    card.classList.add('is-animated');
  }

  card.addEventListener('click', () => openLightbox(index));
  return card;
}

// 数字从上往下滚到总数,比直接蹦出一个数字更像"清点完毕"
let countAnimationRun = 0;

function animateStickerCount(total) {
  if (!stickerCount) return;
  // 连点分类标签会连续触发多次动画；用世代令牌让旧动画自动让位，
  // 否则多个 rAF 循环会同时往同一个节点写数字，出现"数字乱跳/停在 0"。
  const run = ++countAnimationRun;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || total < 2) {
    stickerCount.textContent = `已收录 ${total} 枚`;
    return;
  }
  const duration = 900;
  const startTime = performance.now();
  const tick = (now) => {
    if (run !== countAnimationRun) return;
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - (1 - progress) ** 3;
    stickerCount.textContent = `已收录 ${Math.round(total * eased)} 枚`;
    if (progress < 1) window.requestAnimationFrame(tick);
  };
  stickerCount.textContent = '已收录 0 枚';
  window.requestAnimationFrame(tick);
  // 兜底：rAF 在后台标签页会被暂停（无头浏览器同样不派发），
  // 若动画没能在预期时间内跑完，到点直接写终值，保证数字不会永远停在 0。
  window.setTimeout(() => {
    if (run === countAnimationRun) stickerCount.textContent = `已收录 ${total} 枚`;
  }, duration + 240);
}

// Fisher-Yates 洗牌（原地打乱传入的数组）。
// 每次刷新页面、切换分区、点"重新加载"都会重新洗一次，
// 灯箱翻页用的就是同一个 stickerList，因此顺序自动跟随，无需额外改动。
function shuffleInPlace(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function renderStickers(stickers) {
  // 渲染逻辑只认"传进来的这一批"，不掺任何分区/分类状态：
  // 这样瀑布流核心逻辑（去重 / 卡片 / 计数）在切换数据源时完全复用。
  stickerList = shuffleInPlace([
    ...new Map(
      stickers
        .filter((sticker) => sticker && sticker.original)
        .map((sticker) => [sticker.original, sticker]),
    ).values(),
  ]);
  renderStickerGrid();
}

function renderStickerGrid(animateCount = true) {
  if (!stickerGrid) return;
  stickerGrid.replaceChildren();
  const isEmpty = stickerList.length === 0;

  if (wallEmpty) wallEmpty.hidden = !isEmpty;
  if (stickerCount) {
    stickerCount.hidden = isEmpty;
    if (isEmpty) {
      stickerCount.textContent = '';
    } else if (animateCount) {
      animateStickerCount(stickerList.length);
    } else {
      stickerCount.textContent = `已收录 ${stickerList.length} 枚`;
    }
  }
  if (isEmpty) return;

  const fragment = document.createDocumentFragment();
  stickerList.forEach((sticker, index) => {
    fragment.appendChild(createStickerCard(sticker, index));
  });
  stickerGrid.appendChild(fragment);
}

function updatePartitionStatus() {
  if (!partitionStatus) return;
  partitionStatus.textContent = stickerCount && !stickerCount.hidden ? stickerCount.textContent : '';
}

// 分类条：只渲染有内容的分类（空分类自动隐藏），全部为空则整条不显示

/* ---------------------------------------------------------------------------
 * 查看器：两种来源 + 真缩放
 *
 * 来源：
 *  - list  ：从瀑布流点进来，有「上一张 / 下一张」
 *  - single：页面上的独立图片（首页立绘），没有翻页
 *
 * 缩放（原生实现，不引库）：
 *  - 百分比以**原始像素**为基准（100% = 1:1），下限是「适应窗口」，上限 400%
 *  - 滚轮 / 双击 / ＋− 按钮 / 键盘（+ - 0）都能缩放；双击在「适应 ↔ 100%」之间切换
 *  - 放大超出可视框后可**按住拖动平移**，并限制在边界内（不会拖出画布）
 *  - Esc 逐级退出：先归位缩放 → 再退出最大化 → 最后关闭
 * ------------------------------------------------------------------------- */
const ZOOM_MAX_PERCENT = 400;
const ZOOM_STEP = 1.25;

let viewerMode = 'list';          // 'list' | 'single'
let singleView = null;            // single 模式下的 { src, alt, label, downloadName }
let zoomPercent = 100;            // 相对原始像素的百分比（100 = 1:1）
let fitPercent = 100;             // 「适应窗口」对应的百分比，图片加载后测得
let panX = 0;
let panY = 0;
let panning = null;

function setViewerMeta(text) {
  if (lightboxMeta) lightboxMeta.textContent = text || '';
}

// 查看器两种形态（**打开时是卡片态，不是沉浸态**）：
//   卡片态（默认）：白卡 + 纸胶带 + 透明棋盘格，图片按原始尺寸适应窗口居中，
//                   档案条与操作按钮都在卡片里（图三那种样子）。
//   沉浸态：白卡装饰全部收掉、图片撑满视口，底部控件默认隐藏、鼠标唤醒后半透明浮现。
//
// ⚠️ 这里曾经写成 `lightbox.classList.contains('is-open')` —— 于是**点开即沉浸态**，
//    白卡、留白、卡片里的按钮全都没了，看起来"点开就是大图"，
//    再点「最大化」也只是从"铺满"变成"更铺满"，两态几乎没有区别。
//    正确判据：只有点了「最大化」才沉浸；放大（缩放）只在沉浸态里发生。
function isImmersive() {
  if (!lightbox || !lightbox.classList.contains('is-open')) return false;
  return isMaximized || !isAtFit();
}

function syncImmersive() {
  if (!lightbox) return;
  lightbox.classList.toggle('is-immersive', isImmersive());
}

function updateViewerHint() {
  if (!lightboxHint) return;
  const immersive = isImmersive();
  if (!immersive) {
    // 卡片态：图片已完整可见，能做的只有进全屏 / 翻页
    lightboxHint.textContent = viewerMode === 'single' ? '双击全屏 · Esc 关闭' : '← → 切换 · 双击全屏';
    return;
  }
  if (viewerMode === 'single') {
    lightboxHint.textContent = isPannable() ? '拖动平移 · 双击还原' : '双击 1:1 · Esc 关闭';
    return;
  }
  lightboxHint.textContent = isPannable()
    ? '拖动平移 · 滚轮缩放'
    : isAtFit() ? '滚轮缩放 · 双击 1:1' : '双击 适应窗口';
}

function clearZoomStyles() {
  if (lightboxImage) {
    lightboxImage.style.width = '';
    lightboxImage.style.height = '';
    lightboxImage.style.transform = '';
    lightboxImage.classList.remove('is-pannable', 'is-panning');
  }
  if (lightboxMediaShell) lightboxMediaShell.classList.remove('is-zoomed');
  updateViewerHint();
}

const isAtFit = () => Math.abs(zoomPercent - fitPercent) < 0.5;

// 「适应窗口」的百分比 = 图片**实际渲染尺寸** ÷ 原始像素。
// 用图片自己的内容盒来量，两种形态都成立：
//   卡片态：图片在流内（width/height: auto），盒子尺寸就是显示尺寸 → 直接除；
//   沉浸态：图片绝对定位铺满可视框 + object-fit: contain
//           → 取宽高两个方向里较小的那个比例，就是 contain 的缩放比。
function measureFitPercent() {
  clearZoomStyles();
  const nw = lightboxImage.naturalWidth;
  const nh = lightboxImage.naturalHeight;
  const bw = lightboxImage.clientWidth;
  const bh = lightboxImage.clientHeight;
  if (!nw || !nh || !bw || !bh) {
    fitPercent = 100;
    return;
  }
  fitPercent = Math.max(1, Math.min(bw / nw, bh / nh) * 100);
}

function isPannable() {
  if (!lightboxImage || !lightboxMediaShell) return false;
  return (
    lightboxImage.clientWidth > lightboxMediaShell.clientWidth + 1 ||
    lightboxImage.clientHeight > lightboxMediaShell.clientHeight + 1
  );
}

// 平移边界：按图片"相对可视框的实际对齐方式"推算，不能假设居中。
//
// 原因（实测）：图片比容器大时，浏览器会把 place-items:center 退化成左上对齐
// （CSS 规范为避免内容永久裁掉），此时图片左边=容器左边，
// 若仍按 ±(溢出量/2) 限制，就会有一半画面永远拖不到
// （实测 3307 宽的图只允许 ±977，而真实需要 0 ~ -1953）。
function clampPan() {
  const img = lightboxImage;
  const shell = lightboxMediaShell;
  // offsetLeft/Top 是布局值，不受 transform 影响，正好表示"未平移时图片相对可视框的偏移"
  const anchorX = img.offsetLeft;
  const anchorY = img.offsetTop;

  // 某个方向的可平移区间：
  // - 图片比框大 → 两端边缘都要能顶到框边，区间覆盖完整溢出量
  // - 图片比框小 → 保持在中间（把 anchor 造成的偏差抵消掉）
  const axisRange = (imgSize, shellSize, anchor) => {
    const overflow = imgSize - shellSize;
    if (overflow > 0) return { min: -overflow - anchor, max: -anchor };
    const center = (shellSize - imgSize) / 2 - anchor;
    return { min: center, max: center };
  };

  const rx = axisRange(img.clientWidth, shell.clientWidth, anchorX);
  const ry = axisRange(img.clientHeight, shell.clientHeight, anchorY);
  panX = Math.min(rx.max, Math.max(rx.min, panX));
  panY = Math.min(ry.max, Math.max(ry.min, panY));
}

function applyZoom() {
  if (!lightboxImage || !lightboxImage.naturalWidth) return;
  if (isAtFit()) {                       // 适应窗口 → 交回 CSS，外观与改造前一致
    clearZoomStyles();
    panX = 0;
    panY = 0;
    syncImmersive();
    return;
  }
  lightboxMediaShell.classList.add('is-zoomed');
  lightboxImage.style.width = `${(lightboxImage.naturalWidth * zoomPercent) / 100}px`;
  lightboxImage.style.height = 'auto';
  clampPan();
  lightboxImage.style.transform = `translate(${panX}px, ${panY}px)`;
  lightboxImage.classList.toggle('is-pannable', isPannable());
  updateViewerHint();
  syncImmersive();
}

function setZoom(percent) {
  const max = Math.max(ZOOM_MAX_PERCENT, fitPercent);   // 图很小、适应已超 400% 时不至于卡死
  // 下限：适应窗口。但"适应"本身是**放大**的时候（本图库图片都小于视口，适应 ≈ 1.9 倍），
  // 要允许缩回 100%（原始像素、最清晰），否则「双击 1:1」会被夹住、看起来毫无反应。
  const min = Math.min(fitPercent, 100);
  zoomPercent = Math.min(max, Math.max(min, percent));
  applyZoom();
}

function zoomBy(factor) {
  // 卡片态下的"放大" = 点「最大化」进入沉浸态（图片撑满视口）：
  // 卡片态里图片本来就是完整可见的（按原始尺寸适应窗口），没有"再放大一点"的余地。
  // 逐格缩放、拖动平移都发生在沉浸态里。
  if (factor > 1 && !isImmersive()) {
    setMaximized(true);
    return;
  }
  setZoom(zoomPercent * factor);
}

function zoomToFit() {
  panX = 0;
  panY = 0;
  zoomPercent = fitPercent;
  applyZoom();
}

function zoomToOneToOne() {
  panX = 0;
  panY = 0;
  setZoom(100);
}

function toggleFitAndOneToOne() {
  // 卡片态双击 = 进沉浸态（"双击放大"在卡片态的语义就是放大到全屏）
  if (!isImmersive()) {
    setMaximized(true);
    return;
  }
  if (isAtFit()) zoomToOneToOne();
  else zoomToFit();
}

function resetZoom() {
  zoomPercent = fitPercent;
  panX = 0;
  panY = 0;
  clearZoomStyles();
  syncImmersive();
}

// 图片就绪后：测出「适应」百分比、更新单图模式的尺寸说明
function syncViewerImage() {
  if (!lightboxImage) return;
  if (!(lightboxImage.complete && lightboxImage.naturalWidth > 0)) return;
  lightboxImage.classList.add('is-ready');
  measureFitPercent();
  resetZoom();
  if (viewerMode === 'single' && singleView) {
    setViewerMeta(`${singleView.label} · ${lightboxImage.naturalWidth}×${lightboxImage.naturalHeight}`);
  }
}

function revealLightbox() {
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  // 打开时一律回到「适应窗口 + 卡片态」（is-maximized 已在 closeLightbox 里复位），
  // 免得上一轮残留的百分比/平移让这次点开直接变成沉浸态。
  measureFitPercent();
  zoomPercent = fitPercent;
  panX = 0;
  panY = 0;
  clearZoomStyles();
  syncImmersive();
}

// 页面上的单张图片（首页立绘）用同一个查看器打开
function openSingleImage(src, { alt = '', label = '单图', downloadName = '' } = {}) {
  if (!src) return;
  viewerMode = 'single';
  singleView = { src, alt, label, downloadName };
  lightboxImage.classList.remove('is-ready');
  resetZoom();
  lightboxImage.src = src;
  lightboxImage.alt = alt;
  if (downloadButton) {
    downloadButton.href = src;
    downloadButton.download = downloadName || label;
  }
  if (lightboxMediaShell) lightboxMediaShell.classList.remove('is-animated');
  if (lightboxPrev) lightboxPrev.hidden = true;
  if (lightboxNext) lightboxNext.hidden = true;
  setViewerMeta(label);
  updateViewerHint();
  syncViewerImage();
  revealLightbox();
}

// 首页立绘：点击或键盘 Enter/Space 放大（图源取当前实际显示的那张，主题切换后自动跟随）
function initHeroArtZoom() {
  const heroWindow = document.querySelector('#hero-art-window');
  if (!heroWindow || !heroArtImage) return;
  const open = () => {
    const src = heroArtImage.currentSrc || heroArtImage.src;
    if (!src) return;
    openSingleImage(src, {
      alt: heroArtImage.alt || '立绘',
      label: '立绘',
      downloadName: src.split('/').pop() || 'art',
    });
  };
  heroWindow.addEventListener('click', open);
  heroWindow.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
}

/* ---------------------------------------------------------------------------
 * 沉浸态底部控件的显隐：**只由鼠标决定**，不涉及焦点、也不涉及键盘。
 *
 * 规则（三条，简单直观）：
 *   1. 鼠标在画面上移动 → 控件显现；
 *   2. 鼠标停住不动 1.5 秒 → 控件自动隐藏；
 *   3. 点底部按钮（尤其「最大化」）→ 立刻隐藏，画面保持干净；之后鼠标一动又会出现。
 *
 * 为什么不用 :focus-within / :focus-visible 这类焦点条件：
 * 鼠标点过的按钮会**一直保持聚焦**，焦点条件于是一直成立，那一行就永远亮着
 * —— 这正是"缩放/最大化后按钮不隐藏"的根因（实测复现过）。
 * 只按鼠标动没动来判断，逻辑单一，任何浏览器里表现都一致。
 * ------------------------------------------------------------------------- */
const CHROME_IDLE_MS = 1500;       // 鼠标停住多久后自动隐藏

let chromeIdleTimer = null;

function setChromeShown(shown) {
  if (!lightbox) return;
  lightbox.classList.toggle('is-chrome-shown', Boolean(shown));
}

// 立刻隐藏，并取消尚未到期的倒计时
function hideChrome() {
  window.clearTimeout(chromeIdleTimer);
  chromeIdleTimer = null;
  setChromeShown(false);
}

// 鼠标动一下 → 显现，并重新开始 1.5 秒倒计时
function showChromeBriefly() {
  setChromeShown(true);
  window.clearTimeout(chromeIdleTimer);
  chromeIdleTimer = window.setTimeout(hideChrome, CHROME_IDLE_MS);
}

function initChromeAutoHide() {
  if (!lightbox) return;

  lightbox.addEventListener('pointermove', () => {
    if (!lightbox.classList.contains('is-immersive')) return;
    showChromeBriefly();
  });

  // 点底部控件（最大化 / 下载）→ 先立刻收起来；鼠标再动一下就回来
  lightbox.addEventListener('click', (event) => {
    if (!lightbox.classList.contains('is-immersive')) return;
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.lightbox-actions')) return;
    hideChrome();
  });
}

// 缩放交互：滚轮 / 双击 / 拖动平移（原「− 适应 ＋」按钮行已按需求移除）
function initViewerZoom() {
  if (!lightbox) return;
  lightbox.addEventListener(
    'wheel',
    (event) => {
      if (!lightbox.classList.contains('is-open') || !lightboxImage.naturalWidth) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    },
    { passive: false },
  );
  lightboxImage.addEventListener('dblclick', (event) => {
    event.preventDefault();
    toggleFitAndOneToOne();
  });

  lightboxImage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !isPannable()) return;
    panning = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: panX, startY: panY };
    try {
      lightboxImage.setPointerCapture(event.pointerId);   // 合成事件可能没有真实指针，失败也不影响拖动
    } catch (error) {
      /* 忽略：没有捕获也能靠 pointermove 收到事件 */
    }
    lightboxImage.classList.add('is-panning');
    event.preventDefault();
  });
  lightboxImage.addEventListener('pointermove', (event) => {
    if (!panning || event.pointerId !== panning.id) return;
    panX = panning.startX + (event.clientX - panning.x);
    panY = panning.startY + (event.clientY - panning.y);
    clampPan();
    lightboxImage.style.transform = `translate(${panX}px, ${panY}px)`;
  });
  const endPan = (event) => {
    if (!panning || event.pointerId !== panning.id) return;
    panning = null;
    lightboxImage.classList.remove('is-panning');
  };
  lightboxImage.addEventListener('pointerup', endPan);
  lightboxImage.addEventListener('pointercancel', endPan);

  // 视口尺寸变了，「适应窗口」的百分比也跟着变（contain 是按可视框算的）：
  // 重新量一次；正处在放大状态就保持当前倍数，只把平移边界重新夹一遍。
  window.addEventListener('resize', () => {
    if (!lightbox.classList.contains('is-open')) return;
    if (!(lightboxImage.complete && lightboxImage.naturalWidth > 0)) return;
    measureFitPercent();
    if (isAtFit()) {
      zoomPercent = fitPercent;
      resetZoom();
    } else {
      zoomPercent = Math.max(fitPercent, zoomPercent);
      applyZoom();
    }
  });
}

function openLightbox(index) {
  viewerMode = 'list';
  singleView = null;
  updateViewerHint();
  showSticker(index);
  revealLightbox();
}

function showSticker(index) {
  const sticker = stickerList[index];
  if (!sticker) return;
  activeIndex = index;
  activeSticker = sticker;
  const animated = isAnimatedSticker(sticker);
  // 静态图显示 WebP 大图层(几十~一两百 KB),动画图才加载原文件;
  // 下载仍指向原图,这里只优化「看」,不改变「取」。
  lightboxImage.classList.remove('is-ready');
  lightboxImage.src = animated
    ? getImageUrl(sticker.original)
    : getImageUrl(sticker.large, 'large')
      || getImageUrl(sticker.preview, 'preview')
      || getImageUrl(sticker.original);
  if (lightboxImage.complete && lightboxImage.naturalWidth > 0) {
    lightboxImage.classList.add('is-ready');
  }
  lightboxImage.alt = sticker.alt || '表情包大图预览';
  downloadButton.href = getImageUrl(sticker.original);
  downloadButton.download = sticker.filename || 'sticker';
  // 翻页浏览只按需取大图（prefetchNeighbours），不在这里额外预取原图
  if (actionStatus) actionStatus.textContent = isMaximized ? MAXIMIZE_HINT : '';
  lightboxMediaShell.classList.toggle('is-animated', animated);
  updateLightboxMeta(sticker, index);
  resetZoom();
  syncViewerImage();
  const hasNeighbours = viewerMode === 'list' && stickerList.length > 1;
  if (lightboxPrev) lightboxPrev.hidden = !hasNeighbours;
  if (lightboxNext) lightboxNext.hidden = !hasNeighbours;
  prefetchNeighbours(index);
}

function updateLightboxMeta(sticker, index) {
  if (!lightboxMeta) return;
  const format = (sticker.filename || sticker.original).split('.').pop().toUpperCase();
  const size = sticker.width > 0 && sticker.height > 0 ? `${sticker.width}×${sticker.height}` : '';
  lightboxMeta.textContent = [
    `第 ${index + 1} / ${stickerList.length} 枚`,
    format,
    size,
  ]
    .filter(Boolean)
    .join(' · ');
}

// 预取左右邻居的大图,翻页时不用盯着空白等
function prefetchNeighbours(index) {
  if (stickerList.length < 2) return;
  [-1, 1].forEach((step) => {
    const neighbour = stickerList[(index + step + stickerList.length) % stickerList.length];
    if (!neighbour || isAnimatedSticker(neighbour)) return;
    const source = getImageUrl(neighbour.large, 'large') || getImageUrl(neighbour.preview, 'preview');
    if (!source) return;
    const preload = new Image();
    preload.src = source;
  });
}

function stepLightbox(step) {
  if (stickerList.length < 2 || activeIndex < 0) return;
  showSticker((activeIndex + step + stickerList.length) % stickerList.length);
}

function closeLightbox() {
  setMaximized(false);                 // 关闭时一并退出最大化，下次打开是正常大小
  resetZoom();
  syncImmersive();
  window.clearTimeout(chromeIdleTimer);
  chromeIdleTimer = null;
  setChromeShown(false);
  panning = null;
  viewerMode = 'list';
  singleView = null;
  lightbox.classList.remove('is-open');
  lightbox.classList.remove('is-immersive');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  window.setTimeout(() => {
    if (!lightbox.classList.contains('is-open')) {
      lightboxImage.removeAttribute('src');
      lightboxImage.classList.remove('is-ready');
    }
  }, 650);
}

/* ---------------------------------------------------------------------------
 * 灯箱「最大化」查看
 * 不调用 Fullscreen API（用户选择：浏览器 UI 保留），只给灯箱加一个状态类，
 * 由 styles.css 把白卡装饰收掉、图片放大到视口，操作条浮到底部居中。
 * 退出方式：再点一次按钮 / 按 Esc（Esc 先还原大小，再按一次才关闭灯箱）。
 * ------------------------------------------------------------------------- */
const MAXIMIZE_HINT = '已最大化 · 按 Esc 或再点按钮还原';

function setMaximized(next) {
  isMaximized = Boolean(next);
  if (lightbox) lightbox.classList.toggle('is-maximized', isMaximized);
  if (maximizeButton) maximizeButton.setAttribute('aria-pressed', String(isMaximized));
  if (maximizeLabel) maximizeLabel.textContent = isMaximized ? '还原大小' : '最大化';
  if (actionStatus) actionStatus.textContent = isMaximized ? MAXIMIZE_HINT : '';
  // 卡片 ↔ 沉浸 换的是整套布局，可视框尺寸跟着变 → 「适应窗口」的百分比必须重算，
  // 否则滚轮第一格会突然跳变（先变小再变大，实测过）。顺序不能乱：
  // 先切布局类 → 再量尺寸 → 再归位缩放 → 最后按新状态复核一次。
  syncImmersive();
  measureFitPercent();
  zoomPercent = fitPercent;
  panX = 0;
  panY = 0;
  clearZoomStyles();
  syncImmersive();
}

if (maximizeButton) maximizeButton.addEventListener('click', () => setMaximized(!isMaximized));
lightboxImage.addEventListener('load', () => {
  lightboxImage.classList.add('is-ready');
  syncViewerImage();          // 测「适应」百分比 + 更新单图模式的尺寸说明
});
if (lightboxPrev) lightboxPrev.addEventListener('click', () => stepLightbox(-1));
if (lightboxNext) lightboxNext.addEventListener('click', () => stepLightbox(1));
document.querySelectorAll('[data-close-lightbox]').forEach((element) => {
  element.addEventListener('click', closeLightbox);
});
document.addEventListener('keydown', (event) => {
  if (!lightbox.classList.contains('is-open')) return;
  if (event.key === 'Escape') {
    // 逐级退出：先归位缩放 → 再退出最大化 → 最后关闭
    if (!isAtFit()) zoomToFit();
    else if (isMaximized) setMaximized(false);
    else closeLightbox();
  } else if (event.key === '+' || event.key === '=') {
    zoomBy(ZOOM_STEP);
  } else if (event.key === '-' || event.key === '_') {
    zoomBy(1 / ZOOM_STEP);
  } else if (event.key === '0') {
    zoomToFit();
  } else if (event.key === 'ArrowLeft') {
    stepLightbox(-1);
  } else if (event.key === 'ArrowRight') {
    stepLightbox(1);
  }
});

// 滚过首屏后导航浮起成白色贴纸条
// 一键回顶端：滚过约一屏才淡入（首屏不抢视线），点击平滑回顶并尊重"减少动效"偏好
function initBackToTop() {
  const button = document.querySelector('#back-to-top');
  if (!button) return;
  const sync = () => {
    const threshold = Math.max(320, window.innerHeight * 0.8);
    button.classList.toggle('is-visible', window.scrollY > threshold);
  };
  sync();
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
}

function initNavScroll() {
  if (!siteNav) return;
  const sync = () => siteNav.classList.toggle('is-scrolled', window.scrollY > 26);
  sync();
  window.addEventListener('scroll', sync, { passive: true });
}

function initMascot() {
  if (!mascot) return;
  if (mascotAudio) mascotAudio.volume = 0.42;

  const holdDelay = 420;
  const dragThreshold = 7;
  const clickComboWindow = 620;
  const shortAudioCooldown = 120;
  const storageKey = 'deepseek-mascot-position';
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let hasDragged = false;
  let holdTimer = null;
  let audioStopTimer = null;
  let bopResetTimer = null;
  let comboResetTimer = null;
  let completedHold = false;
  let comboCount = 0;
  let lastClickAt = 0;
  let lastShortAudioAt = 0;

  function clampPosition(x, y) {
    const rect = mascot.getBoundingClientRect();
    const padding = 10;
    return {
      x: Math.min(Math.max(padding, x), window.innerWidth - rect.width - padding),
      y: Math.min(Math.max(padding, y), window.innerHeight - rect.height - padding),
    };
  }

  function setPosition(x, y, persist = false) {
    const position = clampPosition(x, y);
    mascot.style.left = `${position.x}px`;
    mascot.style.top = `${position.y}px`;
    mascot.style.right = 'auto';
    mascot.style.bottom = 'auto';
    if (persist) {
      localStorage.setItem(storageKey, JSON.stringify(position));
    }
  }

  function restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        setPosition(saved.x, saved.y);
      }
    } catch (error) {
      localStorage.removeItem(storageKey);
    }
  }

  function clearHoldTimer() {
    window.clearTimeout(holdTimer);
    holdTimer = null;
  }

  function clearBopTimer() {
    window.clearTimeout(bopResetTimer);
    bopResetTimer = null;
  }

  function playMascotAudio({ full = false } = {}) {
    if (!mascotAudio) return;
    const now = performance.now();
    if (!full && now - lastShortAudioAt < shortAudioCooldown) return;
    window.clearTimeout(audioStopTimer);
    mascotAudio.pause();
    mascotAudio.currentTime = 0;
    mascotAudio.play().catch(() => {});
    if (full) {
      lastShortAudioAt = 0;
      return;
    }
    lastShortAudioAt = now;
    audioStopTimer = window.setTimeout(() => {
      mascotAudio.pause();
      mascotAudio.currentTime = 0;
    }, 320);
  }

  function updateCombo(fullAudio) {
    const now = performance.now();
    comboCount = fullAudio || now - lastClickAt > clickComboWindow
      ? 1
      : Math.min(comboCount + 1, 9);
    lastClickAt = now;
    window.clearTimeout(comboResetTimer);
    comboResetTimer = window.setTimeout(() => {
      comboCount = 0;
    }, clickComboWindow);
    return comboCount;
  }

  function bopMascot({ fullAudio = false } = {}) {
    const combo = updateCombo(fullAudio);
    const isCombo = !fullAudio && combo >= 2;
    mascot.classList.remove('is-bopping', 'is-combo-bopping');
    void mascot.offsetWidth;
    mascot.classList.add(isCombo ? 'is-combo-bopping' : 'is-bopping', 'is-talking');
    mascotBubble.textContent = fullAudio
      ? '听完嘛'
      : isCombo
        ? `再戳×${combo}`
        : '嘻';
    playMascotAudio({ full: fullAudio });
    clearBopTimer();
    bopResetTimer = window.setTimeout(() => {
      mascot.classList.remove('is-bopping', 'is-combo-bopping', 'is-talking');
      mascotBubble.textContent = '戳我';
    }, isCombo ? 480 : 740);
  }

  function startPress(event) {
    if (pointerId !== null) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    const rect = mascot.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    hasDragged = false;
    completedHold = false;
    mascot.setPointerCapture(pointerId);
    clearBopTimer();
    mascot.classList.remove('is-bopping', 'is-combo-bopping', 'is-talking');
    mascot.classList.add('is-pressed');
    mascotBubble.textContent = '别捏';
    clearHoldTimer();
    holdTimer = window.setTimeout(() => {
      if (!hasDragged) {
        completedHold = true;
        mascot.classList.add('is-holding');
        mascotBubble.textContent = '咕噜咕噜';
      }
    }, holdDelay);
  }

  function movePress(event) {
    if (event.pointerId !== pointerId) return;
    const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (distance > dragThreshold) {
      hasDragged = true;
      clearHoldTimer();
      mascot.classList.add('is-dragging');
      mascot.classList.remove('is-holding', 'is-bopping', 'is-combo-bopping', 'is-talking');
      mascotBubble.textContent = '搬家中';
    }
    if (hasDragged) {
      setPosition(event.clientX - offsetX, event.clientY - offsetY);
    }
  }

  function endPress(event) {
    if (event.pointerId !== pointerId) return;
    clearHoldTimer();
    mascot.releasePointerCapture(pointerId);
    pointerId = null;
    mascot.classList.remove('is-pressed', 'is-holding', 'is-dragging');
    if (hasDragged) {
      const rect = mascot.getBoundingClientRect();
      setPosition(rect.left, rect.top, true);
      mascotBubble.textContent = '放好啦';
      window.setTimeout(() => {
        mascotBubble.textContent = '戳我';
      }, 700);
      return;
    }
    bopMascot({ fullAudio: completedHold });
  }

  restorePosition();
  mascot.addEventListener('pointerdown', startPress);
  mascot.addEventListener('pointermove', movePress);
  mascot.addEventListener('pointerup', endPress);
  mascot.addEventListener('pointercancel', endPress);
  mascot.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      bopMascot();
    }
  });
  window.addEventListener('resize', () => {
    const rect = mascot.getBoundingClientRect();
    setPosition(rect.left, rect.top, true);
  });
}

async function loadStickers() {
  // 初始只加载"当前主题 + 当前分区"这一份清单，其余等点击时才 fetch
  const themeId = activeThemeId;
  const partitionId = currentPartition;
  try {
    const stickers = await fetchPartition(themeId, partitionId);
    if (themeId !== activeThemeId || partitionId !== currentPartition) return;  // 竞态保护
    renderStickers(stickers);
  } catch (error) {
    if (themeId !== activeThemeId || partitionId !== currentPartition) return;
    renderStickers([]);        // 空数组 → 空状态；不影响其它主题/分区
  }
}


async function reloadStickers() {
  if (stickerCount) {
    stickerCount.hidden = false;
    stickerCount.textContent = '整理中…';
  }
  if (wallEmpty) wallEmpty.hidden = true;
  partitionCache.clear();                            // 手动重试 = 绕过缓存重新取
  await loadStickers();
}

/* ---------- 分区切换 ---------- */

function setActivePartition(id) {
  const partitions = getActivePartitions();
  currentPartition = partitions.some((part) => part.id === id) ? id : partitions[0].id;
  try {
    window.localStorage.setItem(`fish-gallery-partition-${activeThemeId}`, currentPartition);
  } catch (error) {
    /* localStorage 不可用时忽略：只是不记忆分区 */
  }
  // 作品墙顶部的分区条 + 顶部导航的分区入口，两处一起高亮
  if (partitionNav) {
    partitionNav.querySelectorAll('[data-partition]').forEach((button) => {
      const isActive = button.dataset.partition === currentPartition;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }
  if (navPartitions) {
    navPartitions.querySelectorAll('[data-partition]').forEach((link) => {
      const isActive = link.dataset.partition === currentPartition;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }
}

function getSavedPartition(themeId) {
  try {
    return window.localStorage.getItem(`fish-gallery-partition-${themeId}`);
  } catch (error) {
    return null;
  }
}


// 切换分区 = 换数据源：先关灯箱（否则灯箱仍停在上一个分区的图片上），
// 再清空瀑布流容器、拉取目标分区清单、重新渲染。原有灯箱/复制/下载逻辑不用改，
// 它们都只依赖 stickerList，而 stickerList 现在就是"当前分区的那一批"。
async function setPartition(id) {
  if (id === currentPartition) return;
  if (lightbox && lightbox.classList.contains('is-open')) closeLightbox();
  setActivePartition(id);
  stickerGrid && stickerGrid.replaceChildren();      // 立即清空，避免旧分区图片残留
  if (wallEmpty) wallEmpty.hidden = true;
  if (stickerCount) {
    stickerCount.hidden = false;
    stickerCount.textContent = '整理中…';
  }
  await loadStickers();
}

// 顶部导航里的分区入口：点击即切区，并锚到作品墙（既"跳转"又"切换"）。
// 与作品墙顶部的分区条共用 currentPartition / setPartition，两处状态永远一致；
// 切主题时由 applyTheme 调用重新渲染，因此显示的自然是对应主题的分区。
function renderNavPartitionLinks() {
  if (!navPartitions) return;
  const partitions = getActivePartitions();
  navPartitions.replaceChildren();
  partitions.forEach((partition) => {
    const link = document.createElement('a');
    link.className = 'nav-partition-link';
    link.href = '#wall';
    link.dataset.partition = partition.id;
    link.textContent = partition.label;
    const isActive = partition.id === currentPartition;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'true');
    link.addEventListener('click', () => setPartition(partition.id));
    navPartitions.appendChild(link);
  });
}

function renderPartitionNav() {
  if (!stickerPartitions || !partitionNav) return;
  const partitions = getActivePartitions();
  renderNavPartitionLinks();             // 导航入口始终跟随主题渲染
  if (partitions.length <= 1) {          // 该主题只有一个分区时，墙顶那条不显示
    stickerPartitions.hidden = true;
    return;
  }
  stickerPartitions.hidden = false;
  partitionNav.replaceChildren();
  partitions.forEach((partition) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'partition-tab';
    button.dataset.partition = partition.id;
    button.textContent = partition.label;
    const isActive = partition.id === currentPartition;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.addEventListener('click', () => setPartition(partition.id));
    partitionNav.appendChild(button);
  });
}


if (wallRetry) wallRetry.addEventListener('click', reloadStickers);

// 计数是动画写入的（约 900ms），用 MutationObserver 让状态行跟着走，
// 不必去改动 animateStickerCount 的内部实现。
if (stickerCount && typeof MutationObserver === 'function') {
  new MutationObserver(updatePartitionStatus).observe(stickerCount, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

/* ---------------------------------------------------------------------------
 * 需求二：主题书签头
 *
 * 主题清单来自 theme-data.js（见文件顶部说明），这里只负责"渲染"：
 *  - 数组长度 <= 1 时，书签头完全不渲染（连容器都不出现在 DOM 里）
 *  - vars 里的键必须对应 styles.css :root 的变量名，会通过
 *    document.documentElement.style.setProperty 覆盖；切回默认主题时按快照还原
 *  - hero / art 按主题替换；**某个字段没写就回落到 index.html 的原始值**
 *    （老实现是"没写就沿用上一个主题"，会残留 —— 这里用启动快照修掉了）
 *  - 顶栏站名与 logo 已改为**全站通用**（site.brand），切主题时不再被动过
 * ------------------------------------------------------------------------- */

const THEME_STORAGE_KEY = 'fish-gallery-theme';
// 默认主题 = 页面 HTML 里本来就写着的那个（第一项），首屏不产生任何视觉跳动
function getDefaultTheme() {
  return themeConfig[0];
}

function getActiveTheme() {
  return themeConfig.find((theme) => theme.id === activeThemeId) || getDefaultTheme();
}

// 读取页面初始状态作为"基底快照"：切主题时先还原再覆盖，避免变量互相污染
const baseThemeVars = (() => {
  const declared = themeConfig[0]?.vars || {};
  const names = new Set([
    ...Object.keys(declared),
    ...themeConfig.flatMap((theme) => Object.keys(theme.vars || {})),
  ]);
  const rootStyle = document.documentElement.style;
  const snapshot = {};
  names.forEach((name) => {
    snapshot[name] = rootStyle.getPropertyValue(name).trim();
  });
  return snapshot;
})();

function restoreBaseVars() {
  Object.entries(baseThemeVars).forEach(([name, value]) => {
    if (value) document.documentElement.style.setProperty(name, value);
    else document.documentElement.style.removeProperty(name);
  });
}

function applyThemeVars(theme) {
  restoreBaseVars();
  const rootStyle = document.documentElement.style;
  Object.entries(theme.vars || {}).forEach(([name, value]) => rootStyle.setProperty(name, value));
}

function setThemeImage(selector, src) {
  const element = document.querySelector(selector);
  if (element && src) element.setAttribute('src', src);
}

function swapHeroArt(theme, { animate = true } = {}) {
  if (!heroArtImage) return;
  // 立绘缺字段时回落到页面原始值（不是"沿用上一个主题的图"）
  const art = (theme.hero && theme.hero.art) || {};
  const next = {
    png: art.png || artDefaults.png,
    webp: art.webp || artDefaults.webp,
    alt: art.alt || artDefaults.alt,
  };
  const done = () => {
    if (next.png) heroArtImage.setAttribute('src', next.png);
    heroArtImage.setAttribute('alt', next.alt || '');
    if (heroArtWebp) {
      if (next.webp) heroArtWebp.setAttribute('srcset', next.webp);
      else heroArtWebp.removeAttribute('srcset');
    }
    const window_ = heroArtImage.closest('.hero-art-window');
    if (window_) window_.classList.remove('is-swapping');
  };
  const window_ = heroArtImage.closest('.hero-art-window');
  if (!animate || !window_) {
    done();
    return;
  }
  window_.classList.add('is-swapping');
  window.setTimeout(done, 180);
}

function setThemeText(selector, text) {
  if (!text) return;
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

/* ---------------------------------------------------------------------------
 * 配置 → DOM 的绑定表
 *
 * 加一个新主题只要在 theme-data.js 里写数据，这里**不用改**；
 * 只有"新增一处可主题化的文案"时才需要在这里加一行（并在 index.html 加锚点）。
 * 每项：[配置路径, 选择器]；选择器命中多个元素时，配置给数组就按序写、给字符串就写全部。
 * ------------------------------------------------------------------------- */
const TEXT_BINDINGS = [
  ['hero.kicker', '.hero-kicker'],
  ['hero.titleLines', '#hero-title span'],      // 大标题的三行
  ['hero.lede', '.hero-lede'],
  ['hero.cta', '.hero-cta span:first-child'],
  ['hero.artTag', '.art-tag'],
  ['hero.note', '.art-note'],
];

// 启动时把 index.html 的原始文案/图片记下来，作为"某个主题没写该字段"时的回落基准。
// （老实现只做了 CSS 变量的快照，文案与图片是"没写就沿用上一个主题"，会残留。）
const textDefaults = new Map();
const artDefaults = { png: '', webp: '', alt: '' };

function captureDomDefaults() {
  TEXT_BINDINGS.forEach(([, selector]) => {
    textDefaults.set(selector, Array.from(document.querySelectorAll(selector), (el) => el.textContent));
  });
  if (heroArtImage) {
    artDefaults.png = heroArtImage.getAttribute('src') || '';
    artDefaults.alt = heroArtImage.getAttribute('alt') || '';
  }
  if (heroArtWebp) artDefaults.webp = heroArtWebp.getAttribute('srcset') || '';
}

// 按绑定表渲染一个主题的文案；配置里没有的项写回原始值（幂等）
function applyThemeText(theme) {
  const hero = theme.hero || {};
  TEXT_BINDINGS.forEach(([path, selector]) => {
    const value = path === 'hero.titleLines' ? hero.titleLines
      : path === 'hero.kicker' ? hero.kicker
        : path === 'hero.lede' ? hero.lede
          : path === 'hero.cta' ? hero.cta
            : path === 'hero.artTag' ? hero.artTag
              : hero.note;
    const defaults = textDefaults.get(selector) || [];
    const list = Array.isArray(value) ? value : [value];
    document.querySelectorAll(selector).forEach((el, index) => {
      const next = (list[index] ?? (list.length === 1 ? list[0] : undefined)) || defaults[index];
      if (next) el.textContent = next;
    });
  });
}

/* ---------------------------------------------------------------------------
 * 全站通用文案（site.brand）：顶栏/页脚站名 + 浏览器标签 + logo + 可调属性
 *
 * 刻意**不参与主题切换** —— 只在启动时渲染一次，之后切主题顶栏纹丝不动。
 * 可调属性走 CSS 变量（不是内联样式）：内联样式优先级最高，会压死样式表里的
 * 媒体查询，手机上字号就再也缩不小了（见交接文档坑 14 那类事故）。
 * ------------------------------------------------------------------------- */
function initSiteCopy() {
  const brand = SITE.brand || {};

  // 可调属性：键名即 CSS 变量名；不配的项由 styles.css 里的默认值兜底
  Object.entries(brand.style || {}).forEach(([name, value]) => {
    if (value) document.documentElement.style.setProperty(name, String(value));
  });

  // 顶栏 + 页脚站名（两处共用 [data-copy="brand"]）
  if (brand.name) {
    document.querySelectorAll('[data-copy="brand"]').forEach((el) => {
      el.textContent = brand.name;
    });
  }
  // 浏览器标签标题
  if (brand.title) document.title = brand.title;

  // logo（顶栏彩色 / 页脚黑色）：文案与图片缺失时都保留 HTML 原样
  const logo = brand.logo || {};
  setThemeImage('[data-brand-logo="color"]', logo.color);
  setThemeImage('[data-brand-logo="black"]', logo.black);
  if (logo.alt) {
    document.querySelectorAll('[data-brand-logo]').forEach((img) => img.setAttribute('alt', logo.alt));
  }
}

function applyTheme(id, { animate = true, skipPartitionReload = false } = {}) {
  const theme = themeConfig.find((item) => item.id === id) || getDefaultTheme();
  activeThemeId = theme.id;
  document.documentElement.dataset.theme = theme.id;

  applyThemeVars(theme);
  swapHeroArt(theme, { animate });
  // 注意：这里**不再动顶栏站名与 logo** —— 它们是全站通用的（site.brand，见 initSiteCopy）
  if (theme.mascot) setThemeImage('.mascot-sticker img', theme.mascot);
  applyThemeText(theme);

  document.querySelectorAll('.theme-tab').forEach((tab) => {
    const isActive = tab.dataset.theme === theme.id;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });

  // 【主题 ↔ 分区联动】每个主题有自己的一套分区：
  // 主题一变，分区条整体重建，并加载该主题自己的清单。
  // 两个主题的清单是不同文件，永不混在一起。
  const partitions = getActivePartitions();
  const saved = getSavedPartition(theme.id);
  const nextPartition = partitions.some((part) => part.id === saved) ? saved : partitions[0].id;
  currentPartition = nextPartition;
  renderPartitionNav();
  setActivePartition(nextPartition);
  if (!skipPartitionReload) loadStickers();

  const defaultTheme = getDefaultTheme();
  if (theme.id === defaultTheme.id) {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (error) {
      /* 隐私模式下 localStorage 不可用，忽略 */
    }
  } else {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    } catch (error) {
      /* 同上 */
    }
  }
}

// 主题书签头：只有 1 个主题时什么都不渲染（容器直接不进 DOM）
function initThemeTabs() {
  if (themeConfig.length <= 1) return;
  const host = document.createElement('div');
  host.className = 'theme-switcher';
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', '主题切换');

  themeConfig.forEach((theme) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'theme-tab';
    tab.dataset.theme = theme.id;
    tab.textContent = theme.label || theme.name;
    tab.title = theme.name;
    tab.setAttribute('aria-pressed', 'false');
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      if (theme.id === activeThemeId) return;
      // 二次确认：避免误触把整站配色、立绘、文案一起换掉
      const confirmed = window.confirm(`切换到「${theme.name}」？\n\n会同时替换立绘与全站配色，可随时切回。`);
      if (!confirmed) return;
      tab.classList.add('is-switching');
      window.setTimeout(() => {
        applyTheme(theme.id);
        tab.classList.remove('is-switching');
      }, 140);
    });
    host.appendChild(tab);
  });

  const footer = document.querySelector('.site-footer');
  if (footer && footer.parentNode) footer.parentNode.insertBefore(host, footer);
  else document.body.appendChild(host);
}

function initTheme() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  const initial = themeConfig.some((theme) => theme.id === stored) ? stored : getDefaultTheme().id;
  // 顺序要紧：先把书签头建出来，applyTheme 才能在它们身上标记选中态。
  // （反过来的话，applyTheme 里那段 querySelectorAll('.theme-tab') 会扑空，
  //   表现为"页面主题正确、但没有任何书签头是激活状态"。）
  initThemeTabs();
  applyTheme(initial, { animate: false, skipPartitionReload: true });   // 分区条与清单由文件末尾统一初始化
  // 调试/自动化验证用：?theme=whale 可强制指定主题，且不写 localStorage
  const forced = new URLSearchParams(window.location.search).get('theme');
  if (forced && themeConfig.some((theme) => theme.id === forced)) applyTheme(forced, { animate: false });
}


// 顺序有依赖，别打乱：
//   1) captureDomDefaults 先把 index.html 的原始文案/立绘记下来，供"主题缺字段"时回落
//   2) initSiteCopy 渲染全站通用文案（顶栏站名/logo/标签标题/可调属性）
//   3) initTheme → applyTheme 才会去覆盖主题级文案（这时快照已经就位）
captureDomDefaults();
initSiteCopy();
initMascot();
initNavScroll();
initHeroArtZoom();
initViewerZoom();
initChromeAutoHide();
initBackToTop();
initTheme();
renderPartitionNav();
setActivePartition(currentPartition);
loadStickers();
