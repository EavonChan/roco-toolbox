/* =============================================================================
 * shell.js — 共用外壳（原型基准重建 · 阶段 0）
 *
 * 它干三件事，别的都不管：
 *   1. 渲染线上那根真实骨架：标题栏 + 六页签（尺寸来自 tokens.css 实测值）；
 *   2. 把页面装进「真实屏宽容器」：375 / 390 / 并排，不改页面自身布局；
 *   3. 提供评审开关：4px 参考线、元素边框、状态（默认/空/加载/异常）、整页高度。
 *
 * 它**不**画任何业务内容，也**不**替页面决定间距 —— 那些是页面自己的事。
 *
 * 页面侧契约（照抄即可）：
 *   <body>
 *     <div class="proto-page" data-page="dashboard" data-title="看板">…</div>
 *     <script src="../_shared/shell.js"></script>
 *   </body>
 *
 * 可选属性（写在 .proto-page 上）：
 *   data-tabs="static"   页签只切高亮、不跳页（页面还没建好时用）
 *   data-baseline="dashboard"  自动生成 375 / 390 基准截图链接
 *
 * URL 参数（也可用 # 传，方便分享某一次评审状态）：
 *   ?embed=1       作为被嵌页运行（并排模式的两个 iframe 用它）
 *   ?w=375|390|both  w=both 即并排
 *   ?state=default|empty|loading|error
 *   ?guides=1&outline=1&height=full
 * ========================================================================== */
(function () {
  'use strict';

  /**
   * 主导航（2026-11-22 起五入口）：看板 / 家园 / 收集 / 换蛋 / 我的。
   *
   * 「附近」不再是页签，挂进「我的 · 游戏数据」；「小组」的管理入口进了「我的 · 小组」，
   * 原「小组」页签只剩换蛋/需求广场，因此改名「换蛋」。
   */
  var TABS = [
    ['dashboard', '看板'],
    ['home', '家园'],
    ['collection', '收集'],
    ['swap', '换蛋'],
    ['profile', '我的'],
  ];

  var STATE_LABEL = {
    default: '默认（有数据）',
    empty: '空数据',
    loading: '加载中',
    error: '异常',
  };

  var params = new URLSearchParams(location.search);
  var hash = new URLSearchParams(location.hash.replace(/^#/, ''));

  function read(name, fallback) {
    if (params.has(name)) return params.get(name);
    if (hash.has(name)) return hash.get(name);
    return fallback;
  }

  var IN_IFRAME = (function () {
    try {
      return window.top !== window.self;
    } catch (e) {
      return true;
    }
  })();
  var EMBED = IN_IFRAME || read('embed', '') === '1';

  var pageEl = document.querySelector('.proto-page');
  if (!pageEl) {
    console.warn('[shell] 没找到 .proto-page，外壳不启动');
    return;
  }

  var pageId = pageEl.dataset.page || 'unknown';
  var pageTitle = pageEl.dataset.title || (TABS.find(function (t) { return t[0] === pageId; }) || [])[1] || pageId;
  var tabsMode = pageEl.dataset.tabs === 'static' ? 'static' : 'navigate';

  var settings = {
    width: read('w', '375'),
    state: read('state', 'default'),
    guides: read('guides', '0') === '1',
    outline: read('outline', '0') === '1',
    height: read('height', 'viewport'),
  };
  if (settings.width !== 'both' && settings.width !== '390') settings.width = '375';
  if (!STATE_LABEL[settings.state]) settings.state = 'default';
  if (settings.height !== 'full') settings.height = 'viewport';

  /* ---------------------------------------------------------------------------
   * 骨架：标题栏 + 六页签（结构照抄线上 App.tsx / TabNav.tsx）
   * 关键点：它是 .proto-page 的**兄弟**，不进页面 padding；
   *        外层 .chrome 负责 sticky，滚动时标题栏和页签一起钉在顶部。
   * ------------------------------------------------------------------------ */
  function buildChrome() {
    var wrap = document.createElement('div');
    wrap.className = 'chrome';
    wrap.setAttribute('data-shell-part', 'chrome');

    var header = document.createElement('header');
    header.className = 'chrome-header';

    var h1 = document.createElement('h1');
    h1.className = 'chrome-title';
    h1.textContent = '小布助手';

    var actions = document.createElement('div');
    actions.className = 'chrome-actions';
    ['刷新', '教程'].forEach(function (label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chrome-btn';
      b.textContent = label;
      // 设计稿里这两颗只做样子：点了给个反馈，不刷新、不弹教程
      b.addEventListener('click', function () {
        b.blur();
      });
      actions.appendChild(b);
    });

    header.appendChild(h1);
    header.appendChild(actions);

    var nav = document.createElement('nav');
    nav.className = 'chrome-nav';
    nav.setAttribute('data-tour', 'tab-nav');

    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chrome-tab';
      b.dataset.tab = t[0];
      b.textContent = t[1];
      if (t[0] === pageId) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', function () {
        onTab(t[0]);
      });
      nav.appendChild(b);
    });

    wrap.appendChild(header);
    wrap.appendChild(nav);
    return wrap;
  }

  function setActiveTab(id) {
    var tabs = document.querySelectorAll('.chrome-tab');
    for (var i = 0; i < tabs.length; i += 1) {
      if (tabs[i].dataset.tab === id) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
  }

  function onTab(id) {
    if (id === pageId) return;
    if (tabsMode === 'static') {
      // 页面还没建：只切高亮，并在说明条上写明「该页尚未重建」
      setActiveTab(id);
      notify('「' + (TABS.find(function (t) { return t[0] === id; }) || [])[1] + '」这页还没重建（阶段 1 逐页做）');
      return;
    }
    if (EMBED && IN_IFRAME) {
      parent.postMessage({ __protoShell: true, type: 'nav', page: id }, '*');
      return;
    }
    location.href = toEmbedUrl(id);
  }

  function toEmbedUrl(id) {
    var q = new URLSearchParams();
    q.set('embed', '1');
    q.set('state', settings.state);
    return '../' + id + '/index.html?' + q.toString() + hashSuffix();
  }

  function hashSuffix() {
    var h = new URLSearchParams();
    if (settings.guides) h.set('guides', '1');
    if (settings.outline) h.set('outline', '1');
    if (settings.height === 'full') h.set('height', 'full');
    var s = h.toString();
    return s ? '#' + s : '';
  }

  /* ---------------------------------------------------------------------------
   * 状态机：状态写在 <body data-state> 与 .proto-page[data-state] 上，
   * 页面自己的 CSS 用 [data-state="empty"] 之类选择器接管显示。
   * ------------------------------------------------------------------------ */
  function applyState(state) {
    settings.state = state;
    document.body.dataset.state = state;
    pageEl.dataset.state = state;
    document.dispatchEvent(new CustomEvent('proto-state', { detail: { state: state } }));
    syncBar();
    syncUrl();
  }

  function applyChromeFlags() {
    document.body.classList.toggle('shell-outline', settings.outline);
    document.body.classList.toggle('shell-guides-on', settings.guides);
    var g = document.querySelector('[data-shell-part="guides"]');
    if (g) g.hidden = !settings.guides;
    var devices = document.querySelectorAll('.shell-device');
    for (var i = 0; i < devices.length; i += 1) {
      devices[i].dataset.height = settings.height;
    }
    syncBar();
    syncUrl();
  }

  function syncUrl() {
    if (EMBED) return; // 嵌在 iframe 里的那份不改外层地址栏
    var h = new URLSearchParams();
    h.set('w', settings.width);
    if (settings.state !== 'default') h.set('state', settings.state);
    if (settings.guides) h.set('guides', '1');
    if (settings.outline) h.set('outline', '1');
    if (settings.height === 'full') h.set('height', 'full');
    try {
      history.replaceState(null, '', location.pathname + '?' + h.toString());
    } catch (e) {
      /* file:// 下个别浏览器不让改地址栏，忽略 */
    }
  }

  /* ---------------------------------------------------------------------------
   * 说明条：告诉评审人「现在看的哪一页、什么状态、基准图在哪」
   * ------------------------------------------------------------------------ */
  var noteEl = null;
  function notify(text) {
    if (!noteEl) return;
    noteEl.textContent = text;
    noteEl.hidden = !text;
  }

  function buildCaption() {
    var cap = document.createElement('div');
    cap.className = 'shell-caption';

    var name = document.createElement('b');
    name.textContent = pageTitle;

    var meta = document.createElement('span');
    meta.innerHTML =
      '基准 <code>roco-toolbox.pages.dev</code> · 2026-11-22 截图 · 容器 <code>max-w-md 448px</code>';

    cap.appendChild(name);
    cap.appendChild(meta);

    // data-baseline 写了空串 = 这页没有基准截图（例如外壳自检页），就不给链接
    var baseline = pageEl.hasAttribute('data-baseline') ? pageEl.dataset.baseline : pageId;
    if (baseline) {
      var links = document.createElement('span');
      links.innerHTML =
        '基准图：' +
        '<a href="../_基准截图/' + baseline + '-375.png" target="_blank" rel="noopener">375</a> · ' +
        '<a href="../_基准截图/' + baseline + '-390.png" target="_blank" rel="noopener">390</a>';
      cap.appendChild(links);
    }

    noteEl = document.createElement('span');
    noteEl.className = 'shell-state-note';
    noteEl.hidden = true;
    cap.appendChild(noteEl);

    return cap;
  }

  /* ---------------------------------------------------------------------------
   * 工具栏
   * ------------------------------------------------------------------------ */
  var barButtons = {};
  function barGroup(label, items) {
    var group = document.createElement('div');
    group.className = 'shell-bar-group';
    if (label) {
      var l = document.createElement('span');
      l.className = 'shell-bar-label';
      l.textContent = label;
      group.appendChild(l);
    }
    items.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.text;
      b.dataset.key = item.key;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', item.onClick);
      (barButtons[item.key] = barButtons[item.key] || []).push(b);
      group.appendChild(b);
    });
    return group;
  }

  function buildBar() {
    var bar = document.createElement('div');
    bar.className = 'shell-bar';
    bar.setAttribute('data-shell-part', 'bar');

    bar.appendChild(
      barGroup('屏宽', [
        { key: 'w375', text: '375', onClick: function () { setWidth('375'); } },
        { key: 'w390', text: '390', onClick: function () { setWidth('390'); } },
        { key: 'wBoth', text: '并排', onClick: function () { setWidth('both'); } },
      ]),
    );

    bar.appendChild(
      barGroup('参考', [
        { key: 'guides', text: '参考线', onClick: function () { settings.guides = !settings.guides; applyChromeFlags(); } },
        { key: 'outline', text: '元素边框', onClick: function () { settings.outline = !settings.outline; applyChromeFlags(); } },
        { key: 'height', text: '整页', onClick: function () { settings.height = settings.height === 'full' ? 'viewport' : 'full'; applyChromeFlags(); } },
      ]),
    );

    bar.appendChild(
      barGroup('状态', [
        { key: 'stDefault', text: '默认', onClick: function () { setState('default'); } },
        { key: 'stEmpty', text: '空', onClick: function () { setState('empty'); } },
        { key: 'stLoading', text: '加载', onClick: function () { setState('loading'); } },
        { key: 'stError', text: '异常', onClick: function () { setState('error'); } },
      ]),
    );

    var collapseGroup = document.createElement('div');
    collapseGroup.className = 'shell-bar-group';
    var collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'shell-bar-collapse';
    collapse.textContent = '收';
    collapse.title = '收起 / 展开工具栏（也可以点键盘 H）';
    collapse.addEventListener('click', toggleBar);
    collapseGroup.appendChild(collapse);
    bar.appendChild(collapseGroup);

    return bar;
  }

  var barEl = null;
  var barCollapsed = false;
  function toggleBar() {
    barCollapsed = !barCollapsed;
    barEl.dataset.collapsed = String(barCollapsed);
    for (var i = 0; i < barEl.children.length - 1; i += 1) {
      barEl.children[i].hidden = barCollapsed;
    }
  }

  function syncBar() {
    if (!barEl) return;
    var pressed = {
      w375: settings.width === '375',
      w390: settings.width === '390',
      wBoth: settings.width === 'both',
      guides: settings.guides,
      outline: settings.outline,
      height: settings.height === 'full',
      stDefault: settings.state === 'default',
      stEmpty: settings.state === 'empty',
      stLoading: settings.state === 'loading',
      stError: settings.state === 'error',
    };
    Object.keys(pressed).forEach(function (key) {
      (barButtons[key] || []).forEach(function (b) {
        b.setAttribute('aria-pressed', String(pressed[key]));
      });
    });
  }

  function setWidth(w) {
    settings.width = w;
    if (EMBED) {
      applyChromeFlags();
      return;
    }
    render();
  }

  function setState(state) {
    if (settings.width === 'both' && !EMBED) {
      settings.state = state;
      syncBar();
      syncUrl();
      broadcast();
      notify('并排两侧已切到「' + STATE_LABEL[state] + '」');
      return;
    }
    applyState(state);
  }

  function broadcast() {
    var frames = document.querySelectorAll('.shell-stage iframe');
    for (var i = 0; i < frames.length; i += 1) {
      frames[i].contentWindow.postMessage(
        {
          __protoShell: true,
          type: 'state',
          state: settings.state,
          guides: settings.guides,
          outline: settings.outline,
        },
        '*',
      );
    }
  }

  /* ---------------------------------------------------------------------------
   * 舞台渲染
   * ------------------------------------------------------------------------ */
  var shellEl = null;

  function makeGuides() {
    var g = document.createElement('div');
    g.className = 'shell-guides';
    g.setAttribute('data-shell-part', 'guides');
    g.hidden = !settings.guides;
    return g;
  }

  function makeSlot(width) {
    var slot = document.createElement('div');
    slot.className = 'shell-slot';

    var label = document.createElement('div');
    label.className = 'shell-slot-label';
    label.innerHTML = '<b>' + width + '</b> × ' + (width === 390 ? 844 : 812);
    slot.appendChild(label);

    var device = document.createElement('div');
    device.className = 'shell-device';
    device.dataset.w = String(width);
    device.dataset.height = settings.height;
    device.style.setProperty('--device-w', width + 'px');
    slot.appendChild(device);
    return { slot: slot, device: device };
  }

  function render() {
    // 单宽度：页面本体直接放进设备（真实 375/390 宽，能点能滚）
    if (shellEl) shellEl.innerHTML = '';
    shellEl = document.querySelector('[data-shell-part="stage-root"]') || document.createElement('div');
    shellEl.innerHTML = '';

    var stage = document.createElement('div');
    stage.className = 'shell-stage';

    if (settings.width === 'both') {
      [375, 390].forEach(function (w) {
        var s = makeSlot(w);
        var frame = document.createElement('iframe');
        frame.className = 'shell-frame';
        frame.title = w + ' 宽';
        frame.style.cssText = 'display:block;border:0;width:' + w + 'px;height:' + (w === 390 ? 844 : 812) + 'px;background:#fff;';
        if (settings.height === 'full') frame.style.height = '100%';
        frame.src = '?embed=1&w=' + w + '&state=' + settings.state + hashSuffix().replace('#', '&');
        s.device.appendChild(frame);
        var g = makeGuides();
        g.style.position = 'absolute';
        s.device.appendChild(g);
        stage.appendChild(s.slot);
      });
      // 并排时设备不要自己再设宽高，交给 iframe
      var devices = stage.querySelectorAll('.shell-device');
      for (var i = 0; i < devices.length; i += 1) {
        devices[i].style.width = 'auto';
        devices[i].style.height = 'auto';
        devices[i].style.overflow = 'visible';
        devices[i].style.position = 'relative';
      }
    } else {
      var s1 = makeSlot(Number(settings.width));
      var chrome = buildChrome();
      var g1 = makeGuides();
      s1.device.appendChild(g1);
      s1.device.appendChild(chrome);
      s1.device.appendChild(pageEl);
      stage.appendChild(s1.slot);
    }

    shellEl.appendChild(stage);
    applyChromeFlags();
    syncBar();
    syncUrl();
  }

  /* ---------------------------------------------------------------------------
   * 启动
   * ------------------------------------------------------------------------ */
  function boot() {
    if (EMBED) {
      // 被嵌页：只补骨架 + 状态，不做评审台
      document.body.classList.add('shell-embed');
      var chrome = buildChrome();
      document.body.insertBefore(chrome, pageEl);
      var g = makeGuides();
      if (settings.guides) document.body.appendChild(g);
      applyState(settings.state);
      applyChromeFlags();
      window.addEventListener('message', function (e) {
        var d = e.data || {};
        if (!d.__protoShell) return;
        if (d.type === 'state') {
          settings.guides = !!d.guides;
          settings.outline = !!d.outline;
          if (d.guides && !document.querySelector('[data-shell-part="guides"]')) {
            document.body.appendChild(makeGuides());
          }
          applyChromeFlags();
          applyState(d.state);
        }
        if (d.type === 'nav') {
          // 外层会把两个 iframe 一起换页，这里不用自己跳
        }
      });
      return;
    }

    // 评审台
    var shell = document.createElement('div');
    shell.className = 'shell';
    shell.setAttribute('data-shell-part', 'shell');
    shell.appendChild(buildCaption());

    var stageRoot = document.createElement('div');
    stageRoot.setAttribute('data-shell-part', 'stage-root');
    stageRoot.style.display = 'flex';
    stageRoot.style.justifyContent = 'center';
    stageRoot.style.width = '100%';
    shell.appendChild(stageRoot);
    document.body.insertBefore(shell, pageEl);

    barEl = buildBar();
    document.body.appendChild(barEl);

    shellEl = stageRoot;
    pageEl.parentNode.removeChild(pageEl);

    render();
    applyState(settings.state);

    window.addEventListener('message', function (e) {
      var d = e.data || {};
      if (!d.__protoShell) return;
      if (d.type === 'nav') handleNav(d.page);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'h' || e.key === 'H') toggleBar();
    });
  }

  /**
   * 点页签换页。并排模式下两个 iframe 一起换，单宽度模式下直接跳地址。
   * 页面还没重建时（阶段 0）会 404 —— 所以外壳类页面用 data-tabs="static" 把它关掉。
   */
  function handleNav(nextPageId) {
    var nextTitle = (TABS.find(function (t) { return t[0] === nextPageId; }) || [])[1] || nextPageId;
    pageTitle = nextTitle;
    var nameEl = document.querySelector('.shell-caption b');
    if (nameEl) nameEl.textContent = nextTitle;
    setActiveTab(nextPageId);

    var frames = document.querySelectorAll('.shell-stage iframe');
    if (frames.length) {
      for (var i = 0; i < frames.length; i += 1) {
        var m = /[?&]w=(\d+)/.exec(frames[i].src);
        var w = m ? m[1] : '375';
        frames[i].src =
          '../' + nextPageId + '/index.html?embed=1&w=' + w + '&state=' + settings.state +
          hashSuffix().replace('#', '&');
      }
      return;
    }
    location.href = '../' + nextPageId + '/index.html?' + hashSuffix().replace('#', '');
  }

  window.ProtoShell = {
    version: '0.1.0',
    page: { id: pageId, title: pageTitle },
    getSettings: function () {
      return Object.assign({}, settings);
    },
    setWidth: setWidth,
    setState: setState,
    setGuides: function (on) {
      settings.guides = !!on;
      applyChromeFlags();
    },
    setOutline: function (on) {
      settings.outline = !!on;
      applyChromeFlags();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
