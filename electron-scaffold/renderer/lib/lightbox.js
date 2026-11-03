/* UI Kit · 放大预览（Lightbox）组件  v1.0.0
 *
 * 用途：列表点一项 → 弹窗全屏放大看，支持图片 / 视频、左右翻页、滚轮缩放、1:1 切换、Esc 关闭。
 * 依赖：./lightbox.css（同目录），可选 theme.css 的设计令牌。
 *
 * 用法：
 *   <link rel="stylesheet" href="lib/lightbox.css">
 *   <script src="lib/lightbox.js"></script>
 *
 *   MediaLightbox.open({
 *     items: [
 *       { src: 'https://x/a.png', title: '标题', meta: '3840×2160 · 2.6MB' },
 *       { src: 'https://x/b.mp4', type: 'video', title: '视频', thumb: 'https://x/b.jpg' }
 *     ],
 *     index: 0,
 *     onDownload: (item, i) => { ... },     // 可选：右下角下载按钮点击
 *     onIndexChange: (i) => {}              // 可选：翻页回调
 *   });
 *   MediaLightbox.close();
 *
 * 注意（踩过的坑）：
 *   - 遮罩必须是纯色，不能用 backdrop-filter：Electron --disable-gpu 下会露出桌面/发黑。
 *   - 视频 src 换成图片前必须 pause() 并 removeAttribute('src')，否则媒体句柄不释放、切换后仍在后台播。
 *   - 键盘监听挂在 document 上时要防重复绑定；close 时务必解绑，否则页面其它输入框的 Esc 也被吃掉。
 */
(function (global) {
  'use strict';

  var els = null;
  var items = [];
  var cur = -1;
  var scale = 1;
  var panX = 0, panY = 0;
  var dragging = false, dragStart = null;
  var cbs = { download: null, index: null, close: null };
  var keyBound = false;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function build() {
    if (els) return;

    var mask = h('div', 'lb-mask');
    mask.setAttribute('role', 'dialog');
    mask.setAttribute('aria-modal', 'true');
    mask.setAttribute('aria-label', '放大预览');
    mask.setAttribute('tabindex', '-1');        // 让焦点落在遮罩上，避免关闭按钮一上来就带焦点框
    mask.style.outline = 'none';

    var bar = h('div', 'lb-bar');
    var title = h('div', 'lb-title');
    var counter = h('div', 'lb-counter');
    var meta = h('div', 'lb-meta');
    var dlBtn = h('button', 'lb-btn lb-primary', '下载');
    dlBtn.style.display = 'none';
    var closeBtn = h('button', 'lb-btn lb-close', '关闭  Esc');
    bar.appendChild(title);
    bar.appendChild(counter);
    bar.appendChild(meta);
    bar.appendChild(dlBtn);
    bar.appendChild(closeBtn);

    var stage = h('div', 'lb-stage');
    var prev = h('button', 'lb-nav lb-prev', '‹');
    var next = h('button', 'lb-nav lb-next', '›');
    prev.title = '上一项  ←';
    next.title = '下一项  →';
    var tip = h('div', 'lb-tip');
    var spin = h('span', 'lb-spin');
    var tipText = h('span', '', '加载中…');
    tip.appendChild(spin);
    tip.appendChild(tipText);
    var hint = h('div', 'lb-hint', '← → 翻页　滚轮缩放　双击 1:1　Esc 关闭');
    stage.appendChild(prev);
    stage.appendChild(tip);
    stage.appendChild(hint);
    stage.appendChild(next);

    var strip = h('div', 'lb-strip');

    mask.appendChild(bar);
    mask.appendChild(stage);
    mask.appendChild(strip);
    document.body.appendChild(mask);

    els = { mask: mask, bar: bar, title: title, counter: counter, meta: meta, dl: dlBtn,
            close: closeBtn, stage: stage, prev: prev, next: next, tip: tip, tipText: tipText,
            strip: strip, media: null };

    closeBtn.addEventListener('click', close);
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    dlBtn.addEventListener('click', function () {
      if (cbs.download && items[cur]) cbs.download(items[cur], cur);
    });
    // 点遮罩空白处关闭，点媒体本身不关
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target === stage) close();
    });
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function resetView() {
    scale = 1; panX = 0; panY = 0;
    applyTransform();
  }

  function applyTransform() {
    var m = els && els.media;
    if (!m) return;
    m.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    m.classList.toggle('lb-zoom', scale > 1.001);
  }

  function onWheel(e) {
    var m = els.media;
    if (!m || m.tagName !== 'IMG') return;      // 视频不接管滚轮（留给音量/进度）
    e.preventDefault();
    var step = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    var next = Math.min(6, Math.max(0.2, scale * step));
    if (next === scale) return;
    scale = next;
    if (scale <= 1.001) { panX = 0; panY = 0; }
    applyTransform();
  }

  function onDown(e) {
    var m = els && els.media;
    if (!m || m.tagName !== 'IMG' || scale <= 1.001) return;
    dragging = true;
    dragStart = { x: e.clientX - panX, y: e.clientY - panY };
    m.classList.add('lb-grabbing');
  }

  function onMove(e) {
    if (!dragging) return;
    panX = e.clientX - dragStart.x;
    panY = e.clientY - dragStart.y;
    applyTransform();
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    if (els && els.media) els.media.classList.remove('lb-grabbing');
  }

  function onKey(e) {
    if (!els || !els.mask.classList.contains('lb-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
  }

  function showTip(text, spinning) {
    els.tipText.textContent = text || '';
    els.tip.classList.add('lb-show');
    els.tip.querySelector('.lb-spin').style.display = spinning ? 'block' : 'none';
  }
  function hideTip() { els.tip.classList.remove('lb-show'); }

  function clearMedia() {
    var old = els.media;
    if (!old) return;
    if (old.tagName === 'VIDEO') {
      try { old.pause(); } catch (_) {}
      old.removeAttribute('src');
      old.load();
    }
    if (old.parentNode) old.parentNode.removeChild(old);
    els.media = null;
  }

  function render() {
    var it = items[cur];
    if (!it) return;
    clearMedia();
    resetView();

    var isVideo = it.type === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(it.src || '');
    var el;
    if (isVideo) {
      el = h('video', 'lb-media');
      el.controls = true;
      el.autoplay = true;
      el.muted = true;              // 静音自启，不惊扰；控制条可手动开声
      el.playsInline = true;
      el.preload = 'auto';
    } else {
      el = h('img', 'lb-media');
      el.alt = it.title || '预览图';
      el.draggable = false;
      el.addEventListener('dblclick', function () {
        if (scale > 1.001) { resetView(); }
        else { scale = 2; applyTransform(); }
      });
    }
    el.addEventListener('load', hideTip);
    el.addEventListener('loadeddata', hideTip);
    el.addEventListener('error', function () {
      showTip('资源加载失败（可能是防盗链或链接失效）', false);
    });
    el.src = it.src;
    els.stage.appendChild(el);
    els.media = el;

    if (!isVideo) showTip('加载中…', true);

    els.title.textContent = it.title || '';
    els.meta.textContent = it.meta || '';
    els.counter.textContent = items.length > 1 ? (cur + 1) + ' / ' + items.length : '';
    els.prev.disabled = cur <= 0;
    els.next.disabled = cur >= items.length - 1;
    els.dl.style.display = cbs.download ? '' : 'none';

    // 缩略条（>=2 项且至少有 thumb/src 时显示）
    els.strip.innerHTML = '';
    if (items.length > 1) {
      items.forEach(function (item, i) {
        var t = h('img', 'lb-thumb' + (i === cur ? ' lb-active' : ''));
        t.src = item.thumb || item.src;
        t.alt = item.title || ('第 ' + (i + 1) + ' 项');
        t.loading = 'lazy';
        t.addEventListener('click', function () { go(i); });
        els.strip.appendChild(t);
      });
    }
  }

  function go(i) {
    if (i < 0 || i >= items.length || i === cur) return;
    cur = i;
    render();
    if (cbs.index) cbs.index(cur);
  }

  function open(opts) {
    opts = opts || {};
    items = Array.isArray(opts.items) ? opts.items.filter(Boolean) : [];
    if (!items.length) return;
    cbs.download = typeof opts.onDownload === 'function' ? opts.onDownload : null;
    cbs.index = typeof opts.onIndexChange === 'function' ? opts.onIndexChange : null;
    cbs.close = typeof opts.onClose === 'function' ? opts.onClose : null;
    cur = Math.max(0, Math.min(items.length - 1, opts.index || 0));

    build();
    els.mask.classList.add('lb-open');
    document.body.style.overflow = 'hidden';
    if (!keyBound) { document.addEventListener('keydown', onKey); keyBound = true; }
    render();
    if (els.mask) els.mask.focus({ preventScroll: true });
  }

  function close() {
    if (!els || !els.mask.classList.contains('lb-open')) return;
    els.mask.classList.remove('lb-open');
    document.body.style.overflow = '';
    clearMedia();
    if (keyBound) { document.removeEventListener('keydown', onKey); keyBound = false; }
    if (cbs.close) cbs.close();
  }

  global.MediaLightbox = {
    open: open,
    close: close,
    next: function () { go(cur + 1); },
    prev: function () { go(cur - 1); },
    get index() { return cur; },
    get isOpen() { return !!(els && els.mask.classList.contains('lb-open')); }
  };
})(window);
