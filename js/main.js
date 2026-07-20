/* main.js — 启动、场景管理、主循环 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var M = { scenes: {}, cur: null, curName: '' };
  DG.Main = M;

  M.scene = function (name, obj) { M.scenes[name] = obj; };
  M.go = function (name, arg) {
    if (M.cur && M.cur.exit) M.cur.exit();
    M.curName = name;
    M.cur = M.scenes[name];
    DG.FX.clear();
    if (M.cur.enter) M.cur.enter(arg);
  };

  var last = 0;
  function loop(ts) {
    var dt = Math.min((ts - last) / 1000 || 0.016, 0.05);
    last = ts;
    var P = DG.P, ctx = P.ctx;
    P.resetTransform();
    ctx.translate(DG.FX.ox, DG.FX.oy);
    ctx.fillStyle = DG.UI.C.bg;
    ctx.fillRect(-20, -20, P.W + 40, P.H + 40);

    DG.UI.begin(dt);
    DG.PAY.begin();                 // 充值弹层开启时独占输入
    if (M.cur && M.cur.frame) M.cur.frame(dt, ctx);
    DG.FX.update(dt);
    DG.FX.draw(ctx);
    DG.PAY.draw(ctx);               // 充值弹层最上层渲染
    DG.UI.end();

    requestAnimationFrame(loop);
  }

  M.boot = function () {
    DG.SAVE.load();
    DG.A.preload();
    M.go('home');
    requestAnimationFrame(loop);
  };
})();
