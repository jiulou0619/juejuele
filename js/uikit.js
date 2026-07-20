/* uikit.js — 即时模式 Canvas UI：按钮/面板/进度条/滚动列表/弹窗
 * 每帧：UI.begin() -> 场景内声明控件(先声明的先吃点击) -> UI.end()
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U, P = DG.P;
  var UI = {
    C: {
      bg: '#151a23', panel: '#212837', panel2: '#2a3245', line: '#3c465c',
      txt: '#e8ecf4', dim: '#9aa4b8', gold: '#ffd76a', pri: '#ffb02e',
      green: '#4cd471', red: '#ff5a5a', blue: '#4aa3ff', purple: '#b678ff'
    },
    pointer: { down: false, x: 0, y: 0, downX: 0, downY: 0, moved: false },
    tap: null,           // 本帧点击 {x,y}，被控件消费后置 null
    justDown: null, justUp: null,
    _scroll: {}, _sc: null, _capture: null
  };
  DG.UI = UI;
  var pt = UI.pointer;

  UI.begin = function (dt) {
    UI.tap = null; UI.justDown = null; UI.justUp = null; UI.cancelled = false;
    var evs = P.events;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.t === 'down') {
        pt.down = true; pt.x = pt.downX = e.x; pt.y = pt.downY = e.y; pt.moved = false;
        UI.justDown = { x: e.x, y: e.y };
      } else if (e.t === 'move') {
        pt.x = e.x; pt.y = e.y;
        if (U.dist(e.x, e.y, pt.downX, pt.downY) > 14) pt.moved = true;
      } else if (e.t === 'up') {
        pt.down = false; pt.x = e.x; pt.y = e.y;
        UI.justUp = { x: e.x, y: e.y };
        if (!pt.moved && !UI._capture) UI.tap = { x: e.x, y: e.y };
        UI._capture = null;
      } else if (e.t === 'cancel') {
        // 系统打断触摸（来电/手势）：不算点击，不算抬起
        pt.down = false; pt.moved = true;
        UI._capture = null;
        UI.cancelled = true;
      }
    }
    evs.length = 0;
    // 滚动惯性
    for (var k in UI._scroll) {
      var s = UI._scroll[k];
      if (!s.dragging && Math.abs(s.vel) > 5) {
        s.off += s.vel * dt; s.vel *= Math.pow(0.05, dt);
        if (s.off < 0) { s.off = 0; s.vel = 0; }
        if (s.off > s.max) { s.off = s.max; s.vel = 0; }
      }
    }
  };
  UI.end = function () { };

  function tapHit(x, y, w, h) {
    if (!UI.tap) return false;
    var tx = UI.tap.x, ty = UI.tap.y;
    if (UI._sc) {
      if (!U.inRect(tx, ty, UI._sc.x, UI._sc.y, UI._sc.w, UI._sc.h)) return false;
      ty += UI._sc.off;
    }
    return U.inRect(tx, ty, x, y, w, h);
  }
  function pressHit(x, y, w, h) {
    if (!pt.down || pt.moved) return false;
    var tx = pt.x, ty = pt.y;
    if (UI._sc) {
      if (!U.inRect(tx, ty, UI._sc.x, UI._sc.y, UI._sc.w, UI._sc.h)) return false;
      ty += UI._sc.off;
    }
    return U.inRect(tx, ty, x, y, w, h);
  }

  /* 按钮（Bluestone像素底座）。返回 true=本帧被点。
   * opts.color 语义：主按钮不传(金色光边)；'#3a4356'/panel2=次要(无光边)；其他色=该色光边 */
  UI.button = function (x, y, w, h, label, opts) {
    opts = opts || {};
    var ctx = P.ctx;
    var pressed = !opts.disabled && pressHit(x, y, w, h);
    var prImg = DG.A.images.pr_btn;
    var bsImg = DG.A.images.bs_button;
    var secondary = opts.color === '#3a4356' || opts.color === UI.C.panel2 || (typeof opts.color === 'string' && opts.color.indexOf('rgba') === 0);
    ctx.save();
    if (pressed) { ctx.translate(0, 2); }
    var txtCol, subCol;
    if (prImg) { // Prinbles UNDER 橄榄石板
      if (opts.disabled) ctx.globalAlpha = 0.5;
      ninePatch(ctx, prImg, x, y, w, h, 24, Math.min(20, h * 0.35));
      if (secondary && !opts.disabled) { // 次要钮：暗色罩层区分主次
        ctx.fillStyle = 'rgba(18,22,32,0.45)';
        U.rr(ctx, x + 3, y + 3, w - 6, h - 6, 10); ctx.fill();
      }
      ctx.globalAlpha = 1;
      var accent2 = (opts.disabled || secondary) ? null : opts.color;
      if (accent2 && accent2 !== UI.C.pri) { // 特殊色按钮保留色光边语义
        ctx.strokeStyle = accent2;
        ctx.globalAlpha = 0.85; ctx.lineWidth = 2.5;
        U.rr(ctx, x + 3, y + 3, w - 6, h - 6, 10); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      txtCol = opts.disabled ? '#9aa08a' : '#fff8e0';
      subCol = opts.disabled ? '#9aa08a' : 'rgba(255,250,225,0.78)';
      var dbl = opts.disabled ? null : 'rgba(30,32,14,0.8)'; // 深色底字代替shadow（手机canvas阴影极慢）
    } else if (bsImg) {
      ctx.imageSmoothingEnabled = false;
      if (opts.disabled) ctx.globalAlpha = 0.55;
      ninePatch(ctx, bsImg, x, y, w, h, 13, Math.min(18, h * 0.4));
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 1;
      var accent = (opts.disabled || secondary) ? null : (opts.color || UI.C.pri);
      if (accent) {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 2.5;
        U.rr(ctx, x + 3, y + 3, w - 6, h - 6, 8); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      txtCol = opts.disabled ? '#79819a' : accent === UI.C.pri ? '#ffd76a' : accent ? '#fff' : '#dfe6f2';
      subCol = opts.disabled ? '#79819a' : 'rgba(200,210,230,0.8)';
    } else {
      var col = opts.disabled ? '#3a4152' : (opts.color || UI.C.pri);
      ctx.fillStyle = col;
      U.rr(ctx, x, y, w, h, Math.min(16, h * 0.3)); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
      U.rr(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(16, h * 0.3)); ctx.stroke();
      txtCol = opts.disabled ? '#79819a' : (opts.txtColor || '#2b2410');
      subCol = opts.disabled ? '#79819a' : (opts.subColor || 'rgba(43,36,16,0.75)');
    }
    var fs = Math.max(opts.fontSize || Math.min(30, h * 0.42), 20);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var ly = y + h / 2 + (opts.sub ? -fs * 0.4 : 0);
    if (opts.glyph) {
      var gs = fs * 1.1;
      ctx.font = 'bold ' + Math.floor(fs) + 'px Xiaolai, sans-serif';
      var tw = ctx.measureText(label).width;
      DG.A.draw(ctx, opts.glyph, x + w / 2 - tw / 2 - gs - 6, ly - gs / 2, gs, gs);
      if (dbl) { ctx.fillStyle = dbl; ctx.fillText(label, x + w / 2 + gs / 2 + 2, ly + 2); }
      ctx.fillStyle = txtCol;
      ctx.fillText(label, x + w / 2 + gs / 2 + 2, ly);
    } else {
      ctx.font = 'bold ' + Math.floor(fs) + 'px Xiaolai, sans-serif';
      if (dbl) { ctx.fillStyle = dbl; ctx.fillText(label, x + w / 2, ly + 2); }
      ctx.fillStyle = txtCol;
      ctx.fillText(label, x + w / 2, ly);
    }
    if (opts.sub) {
      ctx.font = Math.floor(Math.max(fs * 0.72, 19)) + 'px Xiaolai, sans-serif';
      if (dbl) { ctx.fillStyle = dbl; ctx.fillText(opts.sub, x + w / 2, y + h / 2 + fs * 0.55 + 2, w - 16); }
      ctx.fillStyle = subCol;
      ctx.fillText(opts.sub, x + w / 2, y + h / 2 + fs * 0.55, w - 16);
    }
    if (opts.badge) {
      ctx.fillStyle = UI.C.red;
      ctx.beginPath(); ctx.arc(x + w - 8, y + 8, 12, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 18px Xiaolai, sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(typeof opts.badge === 'number' ? '' + opts.badge : '!', x + w - 8, y + 9);
    }
    ctx.restore();
    if (!opts.disabled && tapHit(x, y, w, h)) { UI.tap = null; DG.A.sfx('ui_tap', { vibrate: true }); return true; }
    return false;
  };

  /* 九宫格拉伸（用面板贴图角不变形） */
  function ninePatch(ctx, img, x, y, w, h, s, d) {
    var iw = img.width, ih = img.height;
    if (d * 2 > w) d = w / 2; if (d * 2 > h) d = h / 2;
    ctx.drawImage(img, 0, 0, s, s, x, y, d, d);
    ctx.drawImage(img, iw - s, 0, s, s, x + w - d, y, d, d);
    ctx.drawImage(img, 0, ih - s, s, s, x, y + h - d, d, d);
    ctx.drawImage(img, iw - s, ih - s, s, s, x + w - d, y + h - d, d, d);
    ctx.drawImage(img, s, 0, iw - 2 * s, s, x + d, y, w - 2 * d, d);
    ctx.drawImage(img, s, ih - s, iw - 2 * s, s, x + d, y + h - d, w - 2 * d, d);
    ctx.drawImage(img, 0, s, s, ih - 2 * s, x, y + d, d, h - 2 * d);
    ctx.drawImage(img, iw - s, s, s, ih - 2 * s, x + w - d, y + d, d, h - 2 * d);
    ctx.drawImage(img, s, s, iw - 2 * s, ih - 2 * s, x + d, y + d, w - 2 * d, h - 2 * d);
  }

  /* 公开的九宫格绘制（pixel=true 关闭平滑保持像素感） */
  UI.img9 = function (id, x, y, w, h, s, d, pixel, alpha) {
    var img = DG.A.images[id];
    if (!img) return false;
    var ctx = P.ctx;
    if (pixel) ctx.imageSmoothingEnabled = false;
    if (alpha != null) ctx.globalAlpha = alpha;
    ninePatch(ctx, img, x, y, w, h, s, d);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    return true;
  };

  /* 面板：不指定 color 时用 Bluestone 像素面板(九宫格)，指定 color 走扁平样式 */
  UI.panel = function (x, y, w, h, opts) {
    opts = opts || {};
    var ctx = P.ctx;
    if (!opts.color && UI.img9(opts.img || 'bs_panel', x, y, w, h, 14, opts.corner || 26, true, opts.alpha == null ? 0.97 : opts.alpha)) return;
    ctx.fillStyle = opts.color || UI.C.panel;
    U.rr(ctx, x, y, w, h, opts.r == null ? 18 : opts.r); ctx.fill();
    if (opts.border !== false) {
      ctx.strokeStyle = opts.borderColor || UI.C.line; ctx.lineWidth = 2;
      U.rr(ctx, x + 1, y + 1, w - 2, h - 2, opts.r == null ? 18 : opts.r); ctx.stroke();
    }
  };

  /* 藏品/图鉴格子：木质槽位 */
  UI.slot = function (x, y, w, h, alpha) {
    if (!UI.img9('bs_slot', x, y, w, h, 12, 16, true, alpha)) {
      UI.panel(x, y, w, h, { color: 'rgba(20,24,33,0.6)', r: 10 });
    }
  };

  /* 悬浮半透明小圆片（HUD用，不遮背景） */
  UI.chip = function (x, y, w, h, alpha) {
    var ctx = P.ctx;
    ctx.fillStyle = 'rgba(8,10,16,' + (alpha == null ? 0.42 : alpha) + ')';
    U.rr(ctx, x, y, w, h, h / 2); ctx.fill();
  };

  UI.MINFONT = 20; // 手机可读性地板：任何文字不小于此

  /* 文本。opts:{size,color,bold,align,base,maxW,stroke} — stroke=深色描边(花背景上保证可读) */
  UI.label = function (x, y, txt, opts) {
    opts = opts || {};
    var ctx = P.ctx;
    var fsz = Math.max(opts.size || 26, UI.MINFONT);
    ctx.font = (opts.bold ? 'bold ' : '') + fsz + 'px Xiaolai, sans-serif';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.base || 'middle';
    if (opts.stroke) {
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = Math.max(3, fsz / 7);
      if (opts.maxW) ctx.strokeText(txt, x, y, opts.maxW); else ctx.strokeText(txt, x, y);
    }
    ctx.fillStyle = opts.color || UI.C.txt;
    if (opts.maxW) ctx.fillText(txt, x, y, opts.maxW); else ctx.fillText(txt, x, y);
  };

  /* 自动换行文本，返回占用高度 */
  UI.wrapText = function (x, y, txt, maxW, opts) {
    opts = opts || {};
    var ctx = P.ctx, size = Math.max(opts.size || 26, UI.MINFONT), lh = size * 1.45;
    ctx.font = (opts.bold ? 'bold ' : '') + size + 'px Xiaolai, sans-serif';
    ctx.fillStyle = opts.color || UI.C.txt;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    var line = '', yy = y;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (ch === '\n' || ctx.measureText(line + ch).width > maxW) {
        ctx.fillText(line, x, yy); yy += lh; line = ch === '\n' ? '' : ch;
      } else line += ch;
    }
    if (line) { ctx.fillText(line, x, yy); yy += lh; }
    return yy - y;
  };

  /* 进度条 */
  UI.bar = function (x, y, w, h, ratio, color, label) {
    var ctx = P.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    U.rr(ctx, x, y, w, h, h / 2); ctx.fill();
    ratio = U.clamp(ratio, 0, 1);
    if (ratio > 0.01) {
      ctx.fillStyle = color;
      U.rr(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * ratio), h - 4, (h - 4) / 2); ctx.fill();
    }
    if (label) {
      ctx.font = 'bold ' + Math.floor(Math.max(h * 0.62, 16)) + 'px Xiaolai, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
      ctx.strokeText(label, x + w / 2, y + h / 2 + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    }
  };

  /* 滚动区域：drawFn 内用内容坐标绘制（视口顶部 = y，内容从 y 开始向下） */
  UI.scroll = function (id, x, y, w, h, contentH, drawFn) {
    var s = UI._scroll[id];
    if (!s) s = UI._scroll[id] = { off: 0, vel: 0, dragging: false, lastY: 0 };
    s.max = Math.max(0, contentH - h);
    if (s.off > s.max) s.off = s.max;
    // 拖动
    if (pt.down && U.inRect(pt.downX, pt.downY, x, y, w, h) && pt.moved) {
      if (!s.dragging) { s.dragging = true; s.lastY = pt.y; UI._capture = id; }
      var dy = pt.y - s.lastY;
      s.off = U.clamp(s.off - dy, 0, s.max);
      s.vel = -dy * 30;
      s.lastY = pt.y;
    } else if (s.dragging && !pt.down) s.dragging = false;

    var ctx = P.ctx;
    ctx.save();
    U.rr(ctx, x, y, w, h, 4); ctx.clip();
    ctx.translate(0, -s.off);
    UI._sc = { x: x, y: y, w: w, h: h, off: s.off };
    drawFn(s.off);
    UI._sc = null;
    ctx.restore();
    // 滚动条
    if (s.max > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      var bh = Math.max(40, h * h / contentH);
      var by = y + (h - bh) * (s.off / s.max);
      U.rr(ctx, x + w - 8, by, 6, bh, 3); ctx.fill();
    }
  };

  /* 全屏遮罩（弹窗底），点遮罩返回 true */
  UI.dim = function (alpha) {
    var ctx = P.ctx;
    ctx.fillStyle = 'rgba(0,0,0,' + (alpha == null ? 0.65 : alpha) + ')';
    ctx.fillRect(-20, -20, P.W + 40, P.H + 40);
    if (tapHit(-20, -20, P.W + 40, P.H + 40)) return false; // 不自动消费
    return false;
  };

  /* 顶部货币栏，返回栏高。x0=起始x(给返回键让位，防遮挡) */
  UI.currencyBar = function (items, x0) {
    var ctx = P.ctx, y = P.safeTop + 26, h = 52;
    if (x0 == null) x0 = 20;
    var w = Math.min(220, (P.W - x0 - 20) / items.length - 10);
    var plate = DG.A.images.pr_plate;
    for (var i = 0; i < items.length; i++) {
      var x = x0 + i * (w + 10);
      if (plate) UI.img9('pr_plate', x, y, w, h, 18, 20, false, 1);
      else UI.panel(x, y, w, h, { color: 'rgba(0,0,0,0.5)', r: 26, border: false });
      DG.A.draw(ctx, items[i].icon, x + 5, y + 5, h - 10, h - 10);
      // 奶油色大字+深色底字：橄榄底板上也看得清
      UI.label(x + h + 3, y + h / 2 + 3, items[i].txt, { size: 27, bold: true, color: 'rgba(30,32,14,0.85)', maxW: w - h - 12 });
      UI.label(x + h + 3, y + h / 2 + 1, items[i].txt, { size: 27, bold: true, color: '#fff8e0', maxW: w - h - 12 });
    }
    return y + h;
  };

  DG.A.defSfx('ui_tap', '通用按钮点击音 哒');
})();
