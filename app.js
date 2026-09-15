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
 * 前端 THEMES 与之一一对应：切换主题时，分区条会整体换成该主题自己的分区，
 * 并加载该主题的清单。两个主题的分区永不混在一起。
 * 新增分区：建目录 data/<主题>/<新分区>/ 放图，再在两个主题的 partitions 里各加一项。
 * ------------------------------------------------------------------------- */
const THEMES = [
  {
    id: 'manga',
    name: '漫画主题',
    label: '漫画',
    partitions: [
      { id: 'default', label: '默认区', manifest: 'stickers/manifest_manga-default.json' },
      { id: 'cos', label: 'Cos区', manifest: 'stickers/manifest_manga-cos.json' },
    ],
  },
  {
    id: 'whale',
    name: '蓝色大肥鱼主题',
    label: '蓝鲸',
    partitions: [
      { id: 'default', label: '默认区', manifest: 'stickers/manifest_whale-default.json' },
      { id: 'cos', label: 'Cos区', manifest: 'stickers/manifest_whale-cos.json' },
    ],
  },
];

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

async function fetchPartition(themeId, partitionId) {
  const theme = getThemeById(themeId);
  const partition = theme.partitions.find((part) => part.id === partitionId);
  if (!partition) throw new Error(`unknown partition: ${themeId}/${partitionId}`);
  const key = cacheKey(themeId, partitionId);
  if (partitionCache.has(key)) return partitionCache.get(key);
  const response = await fetch(partition.manifest, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${partition.manifest} unavailable`);
  const stickers = await response.json();
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

  const source = sticker.preview || sticker.original;
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
      image.src = sticker.original;
      return;
    }
    card.remove();
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

function openLightbox(index) {
  showSticker(index);
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (maximizeButton) maximizeButton.focus();
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
    ? sticker.original
    : sticker.large || sticker.preview || sticker.original;
  if (lightboxImage.complete && lightboxImage.naturalWidth > 0) {
    lightboxImage.classList.add('is-ready');
  }
  lightboxImage.alt = sticker.alt || '表情包大图预览';
  downloadButton.href = sticker.original;
  downloadButton.download = sticker.filename || 'sticker';
  // 翻页浏览只按需取大图（prefetchNeighbours），不在这里额外预取原图
  if (actionStatus) actionStatus.textContent = isMaximized ? MAXIMIZE_HINT : '';
  lightboxMediaShell.classList.toggle('is-animated', animated);
  updateLightboxMeta(sticker, index);
  const hasNeighbours = stickerList.length > 1;
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
    const source = neighbour.large || neighbour.preview;
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
  lightbox.classList.remove('is-open');
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
}

if (maximizeButton) maximizeButton.addEventListener('click', () => setMaximized(!isMaximized));
lightboxImage.addEventListener('load', () => lightboxImage.classList.add('is-ready'));
if (lightboxPrev) lightboxPrev.addEventListener('click', () => stepLightbox(-1));
if (lightboxNext) lightboxNext.addEventListener('click', () => stepLightbox(1));
document.querySelectorAll('[data-close-lightbox]').forEach((element) => {
  element.addEventListener('click', closeLightbox);
});
document.addEventListener('keydown', (event) => {
  if (!lightbox.classList.contains('is-open')) return;
  if (event.key === 'Escape') {
    if (isMaximized) setMaximized(false);   // 最大化时 Esc 先还原大小
    else closeLightbox();
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
 * themeConfig 就是"主题清单"。约定：
 *  - 数组长度 <= 1 时，书签头完全不渲染（连容器都不出现在 DOM 里）
 *  - vars 里的键必须对应 styles.css :root 的变量名，会通过
 *    document.documentElement.style.setProperty 覆盖；切回默认主题时按快照还原
 *  - art / logo / mascot 按主题替换；不写 logo/mascot 就沿用页面默认值
 * ------------------------------------------------------------------------- */
const themeConfig = [
  {
    id: 'manga',
    name: '漫画主题',
    label: '漫画',
    matches: ['白圣女', '伊甸园', '黑牧师', '圣女'],
    vars: {
      '--ink': '#2e241d', '--deep': '#3d3226', '--blue': '#a8743f',
      '--mist': '#efe3cf', '--paper': '#f8f3ea', '--gold': '#b08a5a',
      '--coral': '#e0b7a4', '--line': 'rgba(46, 36, 29, 0.13)', '--muted': '#7d6b5b',
      '--sticker-shadow': '#2a2119',
      '--tape-coral': 'rgba(224, 183, 164, 0.86)',
      '--tape-mist': 'rgba(239, 227, 207, 0.92)',
    },
    art: { png: 'assets/001.png', webp: 'assets/001.webp' },
    alt: '白圣女与黑牧师立绘',
    note: '黑牧师 · 劳伦斯',              // 与 index.html 的 .art-note 保持一致
    artTag: '白圣女 · 塞西莉娅',           // 与 index.html 的 .art-tag 保持一致
    copy: { kicker: '白聖女と黒牧師', lede: '记录可爱的圣女大人' }   // 与 index.html 的 hero 文案一致,
  },
  {
    id: 'whale',
    name: '蓝色大肥鱼主题',
    label: '蓝鲸',
    matches: ['大肥鱼', '鲸鱼娘', 'DeepSeek'],
    vars: {
      '--ink': '#16213d', '--deep': '#202d52', '--blue': '#607aa9',
      '--mist': '#dfe8f5', '--paper': '#f7f8fb', '--gold': '#b99a67',
      '--coral': '#f1c7c5', '--line': 'rgba(22, 33, 61, 0.13)', '--muted': '#73809a',
      '--sticker-shadow': '#182544',
      '--tape-coral': 'rgba(241, 199, 197, 0.86)',
      '--tape-mist': 'rgba(223, 232, 245, 0.92)',
    },
    art: { png: 'assets/theme-whale.png', webp: 'assets/theme-whale.webp' },
    alt: '蓝色大肥鱼立绘',
    note: '蓝色大肥鱼',
    artTag: '档案 · NO.001',
    copy: { kicker: '鲸鱼娘 DEEPSEEK', lede: '同人表情收藏' },
  },
];

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
  const done = () => {
    if (!theme.art) return;
    heroArtImage.setAttribute('src', theme.art.png);
    heroArtImage.setAttribute('alt', theme.alt || '');
    if (heroArtWebp) {
      if (theme.art.webp) heroArtWebp.setAttribute('srcset', theme.art.webp);
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

function applyTheme(id, { animate = true, skipPartitionReload = false } = {}) {
  const theme = themeConfig.find((item) => item.id === id) || getDefaultTheme();
  activeThemeId = theme.id;
  document.documentElement.dataset.theme = theme.id;

  applyThemeVars(theme);
  swapHeroArt(theme, { animate });
  if (theme.logo) {
    setThemeImage('.wordmark .brand-logo-color', theme.logo.color);
    setThemeImage('.site-footer .brand-logo-black', theme.logo.black);
  }
  if (theme.mascot) setThemeImage('.mascot-sticker img', theme.mascot);
  if (theme.copy) {
    setThemeText('.hero-kicker', theme.copy.kicker);
    setThemeText('.hero-lede', theme.copy.lede);
  }
  if (theme.artTag) setThemeText('.art-tag', theme.artTag);
  if (theme.note) setThemeText('.art-note', theme.note);

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

initMascot();
initNavScroll();
initBackToTop();
initTheme();
renderPartitionNav();
setActivePartition(currentPartition);
loadStickers();
