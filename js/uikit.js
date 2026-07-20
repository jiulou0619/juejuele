/* uikit.js — 即时模式 Canvas UI：按钮/面板/进度条/滚动列表/弹窗
 * 每帧：UI.begin() -> 场景内声明控件(先声明的先吃点击) -> UI.end()
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U, P = DG.P;
  var UI = {
    /* 配色「矿脉暖金 Warm Vein」：暖褐暗部与棕色地层同色系，明度拉开三档；
     * 正文/图形对比度全部过 WCAG（txt on panel 13.2:1，dim on panel 6.5:1，line 3.1:1）。
     * 注意：dim 不可直接压在背景图上（仅 2.9:1），必须落在 panel 或半透黑底之上。 */
    /* 配色骨架取自指定色板：#909FAA 石板蓝 / #2A2625 暖炭 / #BFA390 暖砂 / #76859E 雾霾蓝 / #794F3B 赭棕。
     * 语义色（绿/红/紫）按同等饱和度(~18%)从骨架派生，保证整体柔和统一。 */
    C: {
      bg: '#2a2625', panel: '#413734', panel2: '#544842', line: '#8a7566',
      txt: '#ece0d6', dim: '#909faa', gold: '#d8bb9e', pri: '#bfa390',
      green: '#8ca084', red: '#a4685a', blue: '#76859e', purple: '#8a7e9e',
      cream: '#bfa390', dark: '#2a2625', brown: '#794f3b', slate: '#909faa'
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

  /* 传入色 → Vector UI 按钮贴图变体（按色相自动匹配，调用点无需改动） */
  var VU_VARIANTS = ['yellow', 'green', 'red', 'purple', 'blue', 'cream', 'black'];
  function hexRgb(c) {
    if (typeof c !== 'string') return null;
    if (c.indexOf('rgba') === 0 || c.indexOf('rgb') === 0) {
      var m = c.match(/[\d.]+/g);
      return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
    }
    var h = c.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function variantOf(color) {
    if (color == null) return UI.VU.primary;              // 主按钮
    var rgb = hexRgb(color);
    if (!rgb) return UI.VU.primary;
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.16 || mx < 0.3) return UI.VU.secondary;     // 灰/很暗 = 次要钮
    var hu;
    if (mx === r) hu = ((g - b) / d + 6) % 6;
    else if (mx === g) hu = (b - r) / d + 2;
    else hu = (r - g) / d + 4;
    hu *= 60;
    if (hu < 20 || hu >= 330) return 'red';
    if (hu < 50) return UI.VU.primary;   // 橙金系一律走主按钮色，避免同屏三种黄
    if (hu < 70) return 'yellow';
    if (hu < 160) return 'green';
    if (hu < 250) return 'blue';
    return 'purple';
  }

  /* 按钮（Vector UI 矢量卡通底座）。返回 true=本帧被点。
   * opts.color 语义：主按钮不传；深灰/rgba=次要；其他色自动匹配同色系贴图 */
  /* 主按钮=暖沙(cream)：矿洞题材里比亮黄耐看，且与金色Logo/金币不撞；次要=暖深棕 */
  UI.VU = { primary: 'cream', secondary: 'black' };
  UI.button = function (x, y, w, h, label, opts) {
    opts = opts || {};
    var ctx = P.ctx;
    var pressed = !opts.disabled && pressHit(x, y, w, h);
    var vuVar = opts.disabled ? UI.VU.secondary : variantOf(opts.color); // 禁用态统一暗色，不留脏色
    var vuImg = DG.A.images['vu_button_' + vuVar];
    var prImg = DG.A.images.pr_btn;
    var bsImg = DG.A.images.bs_button;
    var secondary = opts.color === '#3a4356' || opts.color === UI.C.panel2 || (typeof opts.color === 'string' && opts.color.indexOf('rgba') === 0);
    ctx.save();
    if (pressed) { ctx.translate(0, 3); }
    var txtCol, subCol, dbl = null;
    if (vuImg) { // Vector UI：黑描边+渐变+底唇
      if (opts.disabled) ctx.globalAlpha = 0.62;
      ninePatch(ctx, vuImg, x, y, w, h, 66, Math.min(26, h * 0.42));
      ctx.globalAlpha = 1;
      var lightBtn = !opts.disabled && ['yellow', 'green', 'cream'].indexOf(vuVar) >= 0;
      txtCol = opts.disabled ? 'rgba(236,224,214,0.5)' : (lightBtn ? '#33291f' : '#ece0d6');
      subCol = opts.disabled ? 'rgba(236,224,214,0.45)' : (lightBtn ? 'rgba(51,41,31,0.72)' : 'rgba(236,224,214,0.78)');
      dbl = opts.disabled ? null : (lightBtn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.45)'); // 底字提可读性
    } else if (prImg) { // Prinbles UNDER 橄榄石板（回退）
      if (opts.disabled) ctx.globalAlpha = 0.5;
      ninePatch(ctx, prImg, x, y, w, h, 24, Math.min(20, h * 0.35));
      if (secondary && !opts.disabled) {
        ctx.fillStyle = 'rgba(18,22,32,0.45)';
        U.rr(ctx, x + 3, y + 3, w - 6, h - 6, 10); ctx.fill();
      }
      ctx.globalAlpha = 1;
      txtCol = opts.disabled ? '#9aa08a' : '#fff8e0';
      subCol = opts.disabled ? '#9aa08a' : 'rgba(255,250,225,0.78)';
      dbl = opts.disabled ? null : 'rgba(30,32,14,0.8)';
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
    ctx.font = 'bold ' + Math.floor(fs) + 'px Xiaolai, sans-serif';
    var lTok = label ? tokenize(label) : null;
    if (opts.glyph) {
      var gs = fs * 1.1;
      var tw = lTok ? 0 : ctx.measureText(label).width;
      if (lTok) { for (var q = 0; q < lTok.length; q++) tw += lTok[q].i ? fs * 1.18 : ctx.measureText(lTok[q].t).width; }
      DG.A.draw(ctx, opts.glyph, x + w / 2 - tw / 2 - gs - 6, ly - gs / 2, gs, gs);
      ctx.fillStyle = txtCol;
      if (lTok) UI.richText(ctx, lTok, x + w / 2 + gs / 2 + 2, ly, fs, 'center', dbl);
      else { if (dbl) { ctx.fillStyle = dbl; ctx.fillText(label, x + w / 2 + gs / 2 + 2, ly + 2); ctx.fillStyle = txtCol; } ctx.fillText(label, x + w / 2 + gs / 2 + 2, ly); }
    } else if (lTok) {
      ctx.fillStyle = txtCol;
      UI.richText(ctx, lTok, x + w / 2, ly, fs, 'center', dbl);
    } else {
      if (dbl) { ctx.fillStyle = dbl; ctx.fillText(label, x + w / 2, ly + 2); }
      ctx.fillStyle = txtCol;
      ctx.fillText(label, x + w / 2, ly);
    }
    if (opts.sub) {
      var sfs = Math.floor(Math.max(fs * 0.72, 19));
      ctx.font = sfs + 'px Xiaolai, sans-serif';
      var sTok = tokenize(opts.sub);
      if (sTok) { ctx.fillStyle = subCol; UI.richText(ctx, sTok, x + w / 2, y + h / 2 + fs * 0.55, sfs, 'center', dbl); }
      else {
        if (dbl) { ctx.fillStyle = dbl; ctx.fillText(opts.sub, x + w / 2, y + h / 2 + fs * 0.55 + 2, w - 16); }
        ctx.fillStyle = subCol;
        ctx.fillText(opts.sub, x + w / 2, y + h / 2 + fs * 0.55, w - 16);
      }
    }
    if (opts.badge) { // 暖红徽章（玫瑰红做小圆点会显糖果粉，这里单独用锈红）
      ctx.fillStyle = '#a4685a';
      ctx.beginPath(); ctx.arc(x + w - 8, y + 8, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x + w - 8, y + 8, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.font = 'bold 18px Xiaolai, sans-serif'; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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

  /* 面板：不指定 color 时用 Vector UI 深色面板(九宫格)，指定 color 走扁平样式(黑描边配矢量风) */
  UI.panel = function (x, y, w, h, opts) {
    opts = opts || {};
    var ctx = P.ctx;
    if (!opts.color) {
      if (UI.img9(opts.img || 'vu_panel', x, y, w, h, 64, opts.corner || 26, false, opts.alpha == null ? 0.98 : opts.alpha)) return;
      if (UI.img9('bs_panel', x, y, w, h, 14, opts.corner || 26, true, opts.alpha == null ? 0.97 : opts.alpha)) return;
    }
    var rr = opts.r == null ? 18 : opts.r;
    ctx.fillStyle = opts.color || UI.C.panel;
    U.rr(ctx, x, y, w, h, rr); ctx.fill();
    if (opts.border !== false) {
      ctx.strokeStyle = opts.borderColor || UI.C.line;
      ctx.lineWidth = opts.borderColor ? 3 : 4;
      U.rr(ctx, x + 2, y + 2, w - 4, h - 4, rr - 1); ctx.stroke();
    }
  };

  /* 藏品/图鉴格子：矢量槽位 */
  UI.slot = function (x, y, w, h, alpha) {
    if (UI.img9('vu_slot', x, y, w, h, 44, 18, false, alpha)) return;
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

  /* ===== emoji → 图标包 内联替换 =====
   * 在文字渲染层统一处理：任何 label/按钮/飘字里的 emoji 都画成图标包贴图，
   * 调用点无需改动；未映射的 emoji 原样以文字绘制。 */
  var EM = {
    '🪙': 'ic_coin', '💰': 'ic_sycee', '💎': 'ic_gem', '💠': 'ic_gem2', '🔑': 'ic_key', '🎟': 'ic_ticket', '🎫': 'ic_ticket',
    '⛏': 'ic_pick', '🔨': 'ic_hammer', '🔧': 'ic_wrench', '🧲': 'ic_magnet', '📏': 'ic_ruler', '🎯': 'ic_target',
    '🔥': 'ic_fire', '🌋': 'ic_volcano', '💥': 'ic_hit', '💣': 'ic_bomb', '🧨': 'ic_bomb', '🚀': 'ic_rocket',
    '🌀': 'ic_drill', '🌈': 'ic_rainbow', '🎆': 'ic_spark', '✨': 'ic_spark', '💫': 'ic_star3', '⚡': 'ic_spark',
    '🪨': 'ic_stone', '⛰': 'ic_mountain', '🧊': 'ic_snow', '❄': 'ic_snow', '🦠': 'ic_toxic', '💨': 'ic_fog',
    '🦴': 'ic_bone', '🦖': 'ic_skull', '🐚': 'ic_bone', '🦷': 'ic_dagger', '🪲': 'ic_bone', '🐾': 'ic_bone', '🦇': 'ic_demon',
    '❓': 'ic_quest', '❔': 'ic_quest', '📦': 'ic_chest', '🎁': 'ic_chest', '📺': 'ic_tv', '🦫': 'ic_npc',
    '🧩': 'ic_puzzle', '🛒': 'ic_shop', '🚚': 'ic_cart', '📖': 'ic_book', '🎡': 'ic_wheel', '💪': 'ic_gym', '⚔': 'ic_sword',
    '📅': 'ic_calendar', '⏰': 'ic_clock', '⏱': 'ic_watch', '🕰': 'ic_watch', '📻': 'ic_horn', '🔔': 'ic_bell',
    '🏆': 'ic_trophy', '🏅': 'ic_rank', '🎖': 'ic_rank', '🥈': 'ic_ingot', '🥉': 'ic_ingot', '👑': 'ic_crown',
    '🏳': 'ic_flag', '🏁': 'ic_flag', '📤': 'ic_share', '🔄': 'ic_refresh', '🏠': 'ic_shop', '🔒': 'ic_lock', '🔓': 'ic_unlock',
    '✅': 'ic_tick', '✓': 'ic_tick', '⚠': 'ic_excl', '❗': 'ic_excl', '💔': 'ic_heart', '❤': 'ic_heart', '🖤': 'ic_heart',
    '🎉': 'ic_spark', '🎊': 'ic_spark', '🌟': 'ic_star', '⭐': 'ic_star', '🌠': 'ic_meteor', '☄': 'ic_meteor',
    '🌙': 'ic_night', '🌛': 'ic_night', '🌑': 'ic_night', '🌌': 'ic_night', '🌞': 'ic_sun', '☀': 'ic_sun',
    '🍀': 'ic_clover', '🌿': 'ic_leaf', '🌸': 'ic_flower', '🍋': 'ic_pear', '🍎': 'ic_potion', '🧪': 'ic_potion',
    '👻': 'ic_ghost', '🗿': 'ic_skull', '💀': 'ic_skull', '🕯': 'ic_light', '🔦': 'ic_light', '🏺': 'ic_capsule',
    '⚙': 'ic_settings', '🔩': 'ic_nail', '🤖': 'ic_robot', '🎛': 'ic_adjust', '🔋': 'ic_battery', '🔗': 'ic_link', '⛓': 'ic_link',
    '🔮': 'ic_orb', '🟡': 'ic_coin', '🟣': 'ic_gem2', '💚': 'ic_heart', '💧': 'ic_water', '🌊': 'ic_water',
    '🐱': 'ic_cat', '🕊': 'ic_protect', '🕳': 'ic_stone', '💯': 'ic_star6', '🔟': 'ic_star6', '🧯': 'ic_repair',
    '🌟': 'ic_star6', '💠': 'ic_chip', '🥉': 'ic_capsule', '🪚': 'ic_saw',
    '🎒': 'ic_bag', '🗺': 'ic_map', '🧭': 'ic_compass', '🛡': 'ic_shield', '🆓': 'ic_tag', '👆': 'ic_down', '👇': 'ic_down',
    '⬇': 'ic_down', '←': 'ic_back', '→': 'ic_next', '▼': 'ic_down', '▾': 'ic_down',
    '🟥': 'block_red', '🟦': 'block_blue', '🟩': 'block_green', '🟨': 'block_yellow', '🟪': 'block_purple',
    '⚫': 'ic_stone', '➕': 'ic_plus', '✖': 'ic_mult', '❌': 'ic_cross'
  };
  var richCache = {}, richN = 0;
  function tokenize(txt) {
    var c = richCache[txt];
    if (c) return c;
    var out = [], buf = '', hit = false;
    for (var i = 0; i < txt.length; i++) {
      var code = txt.charCodeAt(i), adv = 1, ch;
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < txt.length) { ch = txt.substr(i, 2); adv = 2; }
      else ch = txt.charAt(i);
      var raw = adv;
      if (i + adv < txt.length && txt.charCodeAt(i + adv) === 0xFE0F) adv++; // 吃掉变体选择符
      var ic = EM[ch];
      if (ic) {
        hit = true;
        if (buf) { out.push({ t: buf }); buf = ''; }
        out.push({ i: ic });
      } else buf += txt.substr(i, raw === adv ? adv : raw);
      i += adv - 1;
    }
    if (buf) out.push({ t: buf });
    var res = hit ? out : null;   // null = 纯文字，走快路径
    if (richN > 400) { richCache = {}; richN = 0; }
    richCache[txt] = res; richN++;
    return res;
  }
  /* 带内联图标地绘制一行文字（字体/颜色由调用方先设好） */
  UI.richText = function (ctx, toks, x, y, fsz, align, strokeCol) {
    var isz = Math.round(fsz * 1.06), gap = Math.round(fsz * 0.12), i, w = 0;
    for (i = 0; i < toks.length; i++) w += toks[i].i ? isz + gap : ctx.measureText(toks[i].t).width;
    var cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    var oldAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    for (i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (tk.i) {
        DG.A.draw(ctx, tk.i, cx, y - isz / 2, isz, isz);
        cx += isz + gap;
      } else {
        if (strokeCol) { var sf = ctx.fillStyle; ctx.fillStyle = strokeCol; ctx.fillText(tk.t, cx + 1, y + 2); ctx.fillStyle = sf; }
        ctx.fillText(tk.t, cx, y);
        cx += ctx.measureText(tk.t).width;
      }
    }
    ctx.textAlign = oldAlign;
    return w;
  };
  UI.tokenize = tokenize;
  /* 单个大字形：有映射就画图标，否则回退emoji文字（内容数据的 glyph 字段统一走这里） */
  UI.glyph = function (ctx, ch, cx, cy, size) {
    if (!ch) return;
    var key = ch.replace(/️/g, '');
    var ic = EM[key];
    if (ic && DG.A.images[ic]) { DG.A.draw(ctx, ic, cx - size / 2, cy - size / 2, size, size); return; }
    ctx.font = Math.floor(size * 0.92) + 'px Xiaolai, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy);
  };

  /* 文本。opts:{size,color,bold,align,base,maxW,stroke} — stroke=深色描边(花背景上保证可读) */
  UI.label = function (x, y, txt, opts) {
    opts = opts || {};
    var ctx = P.ctx;
    var fsz = Math.max(opts.size || 26, UI.MINFONT);
    ctx.font = (opts.bold ? 'bold ' : '') + fsz + 'px Xiaolai, sans-serif';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.base || 'middle';
    var toks = txt == null ? null : tokenize('' + txt);
    if (toks) { // 含emoji → 走图标内联渲染
      ctx.fillStyle = opts.color || UI.C.txt;
      UI.richText(ctx, toks, x, y, fsz, opts.align || 'left', opts.stroke ? 'rgba(0,0,0,0.75)' : null);
      return;
    }
    if (opts.stroke) {
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = Math.max(3, fsz / 7);
      if (opts.maxW) ctx.strokeText(txt, x, y, opts.maxW); else ctx.strokeText(txt, x, y);
    }
    ctx.fillStyle = opts.color || UI.C.txt;
    if (opts.maxW) ctx.fillText(txt, x, y, opts.maxW); else ctx.fillText(txt, x, y);
  };

  /* 图标+文字：图标画在文字左侧，整体按 align 对齐。opts 同 UI.label，额外 iconSize */
  UI.iconLabel = function (x, y, icon, txt, opts) {
    opts = opts || {};
    var ctx = P.ctx;
    var fsz = Math.max(opts.size || 26, UI.MINFONT);
    var isz = opts.iconSize || Math.round(fsz * 1.15);
    var gap = opts.gap == null ? 6 : opts.gap;
    ctx.font = (opts.bold ? 'bold ' : '') + fsz + 'px Xiaolai, sans-serif';
    var tw = txt ? ctx.measureText(txt).width : 0;
    if (opts.maxW && tw > opts.maxW - isz - gap) tw = opts.maxW - isz - gap;
    var total = isz + (txt ? gap + tw : 0);
    var sx = opts.align === 'center' ? x - total / 2 : opts.align === 'right' ? x - total : x;
    DG.A.draw(ctx, icon, sx, y - isz / 2, isz, isz);
    if (txt) UI.label(sx + isz + gap, y, txt, { size: fsz, bold: opts.bold, color: opts.color, stroke: opts.stroke, maxW: tw + 1 });
    return total;
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

  /* 进度条（Vector UI 药丸条：黑底槽 + 同色系渐变填充） */
  UI.bar = function (x, y, w, h, ratio, color, label) {
    var ctx = P.ctx;
    ratio = U.clamp(ratio, 0, 1);
    var baseImg = DG.A.images.vu_barbase;
    var fillImg = DG.A.images['vu_bar_' + variantOf(color)];
    if (baseImg) {
      ninePatch(ctx, baseImg, x, y, w, h, 44, h / 2);
      if (ratio > 0.01 && fillImg) {
        var iw = Math.max(h - 8, (w - 10) * ratio);
        ninePatch(ctx, fillImg, x + 5, y + 4, iw, h - 8, 26, (h - 8) / 2);
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      U.rr(ctx, x, y, w, h, h / 2); ctx.fill();
      if (ratio > 0.01) {
        ctx.fillStyle = color;
        U.rr(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * ratio), h - 4, (h - 4) / 2); ctx.fill();
      }
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
    var plate = DG.A.images.vu_label;
    for (var i = 0; i < items.length; i++) {
      var x = x0 + i * (w + 10);
      if (plate) UI.img9('vu_label', x, y, w, h, 52, 22, false, 1);
      else UI.panel(x, y, w, h, { color: 'rgba(0,0,0,0.5)', r: 26, border: false });
      // 数字居中在条内，图标嵌在左端圆头里
      var fcx = x + h * 0.9 + (w - h * 0.9 - 16) / 2;
      UI.label(fcx, y + h / 2 + 3, items[i].txt, { size: 27, bold: true, align: 'center', color: 'rgba(0,0,0,0.55)', maxW: w - h - 26 });
      UI.label(fcx, y + h / 2 + 1, items[i].txt, { size: 27, bold: true, align: 'center', color: '#fff6e2', maxW: w - h - 26 });
      DG.A.draw(ctx, items[i].icon, x + 4, y + 5, h - 10, h - 10);
    }
    return y + h;
  };

  DG.A.defSfx('ui_tap', '通用按钮点击音 哒');
})();
