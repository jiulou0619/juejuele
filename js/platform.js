/* platform.js — 双端兼容层：微信小游戏 / 浏览器
 * 提供：DG.P.canvas/ctx、逻辑坐标(宽固定750)、触摸事件队列、存储、震动
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var isWX = typeof wx !== 'undefined' && !!wx.getSystemInfoSync;
  var P = { isWX: isWX, DESIGN_W: 750 };
  DG.P = P;
  // iOS 微信小游戏虚拟支付受限：隐藏所有¥入口（浏览器可用 ?ios=1 调试）
  P.ios = isWX ? (wx.getSystemInfoSync().platform === 'ios')
    : (typeof location !== 'undefined' && /[?&]ios=1/.test(location.search));

  var canvas, ctx, dpr, winW, winH;

  if (isWX) {
    canvas = wx.createCanvas(); // 首个 canvas 为主屏
    try { // 自定义字体（注意：完整TTF超微信包体限制，上线需子集化或CDN加载）
      wx.loadFontFace({ family: 'Xiaolai', global: true, source: 'url("assets/fonts/Xiaolai.ttf")' });
    } catch (e) { }
    var sys = wx.getSystemInfoSync();
    winW = sys.windowWidth;
    winH = sys.windowHeight;
    dpr = Math.min(sys.pixelRatio || 2, 2);
    canvas.width = winW * dpr;
    canvas.height = winH * dpr;
    P.safeTop = (sys.safeArea ? sys.safeArea.top : 20) * (750 / winW);
  } else {
    canvas = document.getElementById('game') || document.createElement('canvas');
    if (!canvas.parentNode) document.body.appendChild(canvas);
    P.safeTop = 10;
  }

  function layout() {
    if (isWX) return;
    winW = window.innerWidth || 375;
    winH = window.innerHeight || 667;
    // 桌面浏览器强制竖屏比例便于调试
    if (winW / winH > 750 / 1200) winW = Math.round(winH * 750 / 1334);
    if (winW < 50) winW = 375;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = winW * dpr;
    canvas.height = winH * dpr;
    canvas.style.width = winW + 'px';
    canvas.style.height = winH + 'px';
    P.scale = canvas.width / 750;
    P.H = canvas.height / P.scale;
    P.winW = winW;
    // 刘海屏安全区（viewport-fit=cover 时顶部内容避开刘海）
    var sat = 0;
    try { sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0; } catch (e) { }
    P.safeTop = Math.max(10, sat * (750 / winW));
  }
  if (!isWX) {
    layout();
    window.addEventListener('resize', layout);
  }

  ctx = canvas.getContext('2d');
  P.canvas = canvas;
  P.ctx = ctx;
  P.scale = canvas.width / 750;         // 物理像素 -> 逻辑像素
  P.W = 750;
  P.H = canvas.height / P.scale;        // 逻辑高度（约1334，随屏幕比例变化）
  P.winW = winW;

  P.resetTransform = function () {
    ctx.setTransform(P.scale, 0, 0, P.scale, 0, 0);
  };

  /* ---------- 输入：统一为逻辑坐标事件队列 ---------- */
  P.events = []; // {t:'down'|'move'|'up', x, y}
  function pushEv(t, cx, cy) {
    P.events.push({ t: t, x: cx * (750 / winW), y: cy * (750 / winW) });
    if (P.events.length > 64) P.events.shift();
  }

  // 单指策略：只跟踪第一根手指的 identifier，其余触点忽略；系统打断发 'cancel' 而非 'up'
  var activeTouch = null;
  function findTouch(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  }
  if (isWX) {
    wx.onTouchStart(function (e) {
      if (activeTouch !== null) return;
      var t = (e.changedTouches && e.changedTouches[0]) || e.touches[0];
      if (t) { activeTouch = t.identifier; pushEv('down', t.clientX, t.clientY); }
    });
    wx.onTouchMove(function (e) {
      var t = findTouch(e.touches, activeTouch) || findTouch(e.changedTouches, activeTouch);
      if (t) pushEv('move', t.clientX, t.clientY);
    });
    wx.onTouchEnd(function (e) {
      var t = findTouch(e.changedTouches, activeTouch);
      if (t) { activeTouch = null; pushEv('up', t.clientX, t.clientY); }
    });
    wx.onTouchCancel(function (e) {
      if (activeTouch === null) return;
      var t = findTouch(e.changedTouches, activeTouch);
      activeTouch = null;
      pushEv('cancel', t ? t.clientX : 0, t ? t.clientY : 0);
    });
  } else {
    var rect = function () { return canvas.getBoundingClientRect(); };
    var mdown = false;
    canvas.addEventListener('mousedown', function (e) { mdown = true; var r = rect(); pushEv('down', e.clientX - r.left, e.clientY - r.top); });
    window.addEventListener('mousemove', function (e) { if (!mdown) return; var r = rect(); pushEv('move', e.clientX - r.left, e.clientY - r.top); });
    window.addEventListener('mouseup', function (e) { if (!mdown) return; mdown = false; var r = rect(); pushEv('up', e.clientX - r.left, e.clientY - r.top); });
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (activeTouch !== null) return;
      var r = rect(); var t = e.changedTouches[0];
      if (t) { activeTouch = t.identifier; pushEv('down', t.clientX - r.left, t.clientY - r.top); }
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var r = rect(); var t = findTouch(e.touches, activeTouch);
      if (t) pushEv('move', t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      var r = rect(); var t = findTouch(e.changedTouches, activeTouch);
      if (t) { activeTouch = null; pushEv('up', t.clientX - r.left, t.clientY - r.top); }
    }, { passive: false });
    canvas.addEventListener('touchcancel', function (e) {
      if (activeTouch === null) return;
      activeTouch = null;
      pushEv('cancel', 0, 0);
    }, { passive: false });
  }

  /* ---------- 存储 ---------- */
  P.load = function (key) {
    try {
      var s = isWX ? wx.getStorageSync(key) : localStorage.getItem(key);
      if (!s) return null;
      return typeof s === 'string' ? JSON.parse(s) : s;
    } catch (e) { return null; }
  };
  P.store = function (key, obj) {
    try {
      var s = JSON.stringify(obj);
      if (isWX) wx.setStorageSync(key, s); else localStorage.setItem(key, s);
    } catch (e) { /* 存储失败静默 */ }
  };

  /* ---------- 震动 ---------- */
  P.vibrate = function (strong) {
    try {
      if (isWX) { strong ? wx.vibrateShort({ type: 'heavy' }) : wx.vibrateShort({ type: 'light' }); }
      else if (navigator.vibrate) navigator.vibrate(strong ? 30 : 10);
    } catch (e) { }
  };

  P.now = function () { return Date.now(); };

  /* 图片加载（双端） */
  P.newImage = function (src, cb) {
    var img = isWX ? wx.createImage() : new Image();
    img.onload = function () { cb(img); };
    img.onerror = function () { /* 缺图时静默回退占位 */ };
    img.src = src;
  };
})();
