/* ===========================================================================
 * theme-data.js —— 全站唯一需要维护的"文案 / 图片 / 配色"配置文件
 *
 * 【怎么用】
 *   · 改顶栏站名、页脚站名、浏览器标签标题、顶栏 logo → 改下面 site.brand
 *   · 调站名/logo 的大小、粗细、字距、间距 → 改 site.brand.style（键名就是 CSS 变量名）
 *   · 改某个主题的文案、立绘、配色、分区 → 改 themes 里对应的那一项
 *   · 新增一个主题 → 在 themes 数组**末尾**加一项（左侧主题书签与分区条会自动出现）
 *
 * 【两条硬约定】
 *   1. themes[0] 必须是"index.html 里写死的那个主题"（现在是 manga）——
 *      它是首屏没有 JS 时的兜底，也是"缺字段回落到 HTML 原值"的基准。
 *   2. 这个文件必须在 app.js **之前**加载（见 index.html 的 <script> 顺序）。
 *      它是同步加载的，所以首屏不会先闪一下默认主题再变。
 *
 * 【注意】文案里没有的东西不要臆造：某个主题不写某字段，就自动沿用 index.html 的默认文案。
 * =========================================================================== */
window.GALLERY_THEME_DATA = {
  /* ── 全站通用：不随主题切换而变 ───────────────────────────────────────── */
  site: {
    brand: {
      name: '『和武叶佐乃の伊甸园』',        // 顶栏站名 + 页脚站名（两处共用这一份）
      title: '『和武叶佐乃の伊甸园』',       // 浏览器标签页标题
      logo: {
        color: 'logo/deepseek_蓝鲸_彩色.png',   // 顶栏那个（歪着放的彩色 logo）
        black: 'logo/deepseek_蓝鲸_黑色.png',   // 页脚那个（黑色 logo）
        alt: '伊甸园 Logo',
      },
      // 可调属性：键名 = CSS 变量名，值 = 任意合法 CSS 值。
      // 不写 = 用 styles.css 里的默认值；写了就覆盖（手机上会自动按比例缩小）。
      style: {
        '--brand-name-size': '20px',           // 站名字号
        '--brand-name-weight': '1000',          // 站名字重（粗细）
        '--brand-name-spacing': '0.05em',      // 站名字距
        '--brand-gap': '10px',                 // 顶栏 logo 与文字的间距
        '--brand-logo-size': '60px',           // 顶栏 logo 边长
        '--brand-footer-gap': '9px',           // 页脚 logo 与文字的间距
        '--brand-footer-weight': '900',        // 页脚字重
        '--brand-footer-logo-size': '52px',    // 页脚 logo 边长
      },
    },
  },

  /* ── 主题列表：加主题 = 在末尾加一项 ──────────────────────────────────── */
  themes: [
    {
      id: 'manga',
      name: '漫画主题',            // 切换主题时的确认框里显示
      label: '圣女',               // 左侧主题书签上显示
      vars: {                      // 色板：CSS 变量名 → 值（键名见 styles.css 的 :root）
        '--ink': '#2e241d', '--deep': '#3d3226', '--blue': '#a8743f',
        '--mist': '#efe3cf', '--paper': '#f8f3ea', '--gold': '#b08a5a',
        '--coral': '#e0b7a4', '--line': 'rgba(46, 36, 29, 0.13)', '--muted': '#7d6b5b',
        '--sticker-shadow': '#2a2119',
        '--tape-coral': 'rgba(224, 183, 164, 0.86)',
        '--tape-mist': 'rgba(239, 227, 207, 0.92)',
      },
      hero: {
        kicker: '白聖女と黒牧師',                               // 大标题上方那行小字
        titleLines: ['白圣女', '&黑牧师', 'in伊甸园'],            // 左侧大标题的三行（按顺序）
        titleOffsets: ['-70px', '30px', '-30px'],               // 每行各自的左右偏移：负数往左、正数往右；不写就沿用 index.html 那三条
        lede: '记录可爱的圣女大人',                             // 大标题下方的副标题
        cta: '入园',                                        // 按钮文字（箭头是页面自带的）
        art: {                                                  // 立绘
          png: 'assets/001.png',
          webp: 'assets/001.webp',
          alt: '白圣女与黑牧师立绘',
        },
        artTag: '白圣女 · 塞西莉娅',                            // 立绘左上角标签
        note: '黑牧师 · 劳伦斯',                                // 立绘右下角标签
        // 大标题的可调属性（键名 = CSS 变量名，不写就用 styles.css 的默认值）
        style: {
          '--hero-title-size': 'clamp(3.1rem, 5vw, 5.7rem)',  // 字号（桌面）；想让手机单独小一点再加 --hero-title-size-mobile
          '--hero-title-weight': '900',                       // 字重
          '--hero-title-spacing': '2px',                      // 字距（每行内部）
          '--hero-title-line-height': '1.08',                 // 行高
          '--hero-title-gap': '15px',                         // 三行之间的间距
        },
      },
      partitions: [                                             // 该主题的分区（顶部分区条）
        { id: 'default', label: '默认区', manifest: 'stickers/manifest_manga-default.json' },
        { id: 'cos', label: 'Cos区', manifest: 'stickers/manifest_manga-cos.json' },
        { id: 'meme', label: '表情墙', manifest: 'stickers/manifest_manga-meme.json' },
      ],
    },
    {
      id: 'whale',
      name: '童话般的你主题',      // 切换确认框里显示（想改成"童话般的你主题"就改这一行）
      label: '童话',               // 左侧主题书签上显示
      vars: {
        '--ink': '#16213d', '--deep': '#202d52', '--blue': '#607aa9',
        '--mist': '#dfe8f5', '--paper': '#f7f8fb', '--gold': '#b99a67',
        '--coral': '#f1c7c5', '--line': 'rgba(22, 33, 61, 0.13)', '--muted': '#73809a',
        '--sticker-shadow': '#182544',
        '--tape-coral': 'rgba(241, 199, 197, 0.86)',
        '--tape-mist': 'rgba(223, 232, 245, 0.92)',
      },
      hero: {
        kicker: '儚キミ_Charge',
        titleLines: ['童话般的你', '发起恋爱猛攻', 'in伊甸园'],   // 左侧大标题的三行（按顺序）
        titleOffsets: ['-10px', '-5px', '-10px'],               // 每行各自的左右偏移：负数往左、正数往右；不写就沿用 index.html 那三条
        lede: '记录童话的美',
        cta: '入园',
        art: {
          png: 'assets/theme-whale.png',
          webp: 'assets/theme-whale.webp',
          alt: '童话立绘',
        },
        artTag: '档案 · NO.001',
        note: '冬川花璃',
        // 大标题的可调属性（键名 = CSS 变量名，不写就用 styles.css 的默认值）
        style: {
          '--hero-title-size': 'clamp(3.1rem, 5vw, 4.5rem)',  // 字号（桌面）；想让手机单独小一点再加 --hero-title-size-mobile
          '--hero-title-weight': '900',                       // 字重
          '--hero-title-spacing': '2px',                      // 字距（每行内部）
          '--hero-title-line-height': '1.08',                 // 行高
          '--hero-title-gap': '30px',                         // 三行之间的间距
        },
      },
      partitions: [
        { id: 'default', label: '默认区', manifest: 'stickers/manifest_whale-default.json' },
        { id: 'cos', label: '番外篇', manifest: 'stickers/manifest_whale-cos.json' },
      ],
    },
  ],
};
