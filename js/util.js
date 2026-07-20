/* util.js — 通用工具 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = {};
  DG.U = U;

  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rndi = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  U.rndf = function (a, b) { return a + Math.random() * (b - a); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  // 权重随机：[{w:权重,...}] 返回选中项
  U.wpick = function (arr, rnd) {
    var total = 0, i;
    for (i = 0; i < arr.length; i++) total += arr[i].w;
    var r = (rnd || Math.random)() * total;
    for (i = 0; i < arr.length; i++) { r -= arr[i].w; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  };
  // 数字缩写 12.3万
  U.fmt = function (n) {
    n = Math.floor(n);
    if (n < 10000) return '' + n;
    if (n < 100000000) return (n / 10000).toFixed(n < 100000 ? 1 : 0) + '万';
    return (n / 100000000).toFixed(1) + '亿';
  };
  // 可复现随机（每日挑战用）
  U.seededRng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.easeOutBack = function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };

  U.rr = function (ctx, x, y, w, h, r) { // 圆角矩形路径
    if (r > w / 2) r = w / 2; if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  U.inRect = function (px, py, x, y, w, h) { return px >= x && px <= x + w && py >= y && py <= y + h; };
  U.dist = function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  U.todayKey = function () { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  U.dayKeyOffset = function (n) { var d = new Date(Date.now() + n * 86400000); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
})();
