/* pay.js — 充值弹层（原型=模拟支付：点击即到账，标注清晰）
 * 用法：DG.PAY.show('revive') 任意场景打开；main.js 每帧 begin()/draw() 挂钩，
 * begin 在场景控件前吞掉点击(独占输入)，draw 在最上层渲染。
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U;
  var PAY = { open: false, from: '', _tap: null };
  DG.PAY = PAY;

  PAY.show = function (from, gap) {
    PAY.open = true; PAY.from = from || ''; PAY.gap = gap || 0;
    DG.D.track('pay_show_' + PAY.from);
  };
  PAY.close = function () { PAY.open = false; };
  var FROM_TXT = { // 上下文遗憾行：收银台开在遗憾现场
    revive: '💔 就差一步! 复活还差 {n}💎',
    box_pity: '✨ 冲刺保底还差 {n}💎',
    perk4: '🔒 那张金卡还差 {n}💎',
    puzzle: '🧩 最后一片还差 {n}💎',
    wish: '🔦 点亮矿灯还差 {n}💎'
  };

  /* 在场景控件声明之前调用：独占本帧点击 */
  PAY.begin = function () {
    if (!PAY.open) return;
    PAY._tap = DG.UI.tap;
    DG.UI.tap = null;
  };

  function grant(gem, label) {
    var s = DG.SAVE.d;
    s.gem += gem;
    DG.FX.banner('💎 +' + gem + '  ' + label, { color: '#8fd0ff', size: 46, life: 2 });
    DG.A.sfx('buy', { vibrate: true, strong: true });
    DG.SAVE.save();
  }

  PAY.buyPack = function (i) {
    var s = DG.SAVE.d, p = DG.D.iap.packs[i];
    s.simPaidRmb += p.rmb;
    var first = !s.firstCharged[i];
    var got = first ? p.gem * 2 : p.gem + p.bonus;
    if (first) s.firstCharged[i] = 1;
    grant(got, first ? '首充双倍!' : '充值到账(模拟)');
  };

  PAY.buyMonthly = function () {
    var s = DG.SAVE.d, m = DG.D.iap.monthly;
    s.simPaidRmb += m.rmb;
    s.monthlyUntil = U.dayKeyOffset(m.days);
    grant(m.gemDaily, '矿工月卡开通! 今日份已发');
    s.monthlyClaimed = U.todayKey();
    DG.SAVE.save();
  };

  /* 货币栏星钻位的"＋"充值热区（home/meta 调用，x0=货币栏起始x） */
  PAY.gemHotspot = function (x0) {
    var P = DG.P, UI = DG.UI;
    if (P.ios) return false; // iOS 不展示充值入口
    var w = Math.min(220, (P.W - x0 - 20) / 4 - 10);
    var x = x0 + (w + 10), y = P.safeTop + 8, h = 52;
    UI.label(x + w - 13, y + h / 2 + 1, '＋', { size: 26, bold: true, align: 'center', color: '#8fd0ff' });
    if (UI.tap && U.inRect(UI.tap.x, UI.tap.y, x, y, w, h)) { UI.tap = null; PAY.show('bar'); return true; }
    return false;
  };

  /* 在场景内容之后调用：最上层渲染 */
  PAY.draw = function (ctx) {
    if (!PAY.open) return;
    var UI = DG.UI, P = DG.P, D = DG.D, s = DG.SAVE.d;
    DG.UI.tap = PAY._tap; PAY._tap = null;   // 归还点击给弹层控件
    UI.dim(0.8);
    var x = 30, w = P.W - 60, y = P.safeTop + 60, h = P.H - y - 90;
    UI.panel(x, y, w, h);
    UI.label(P.W / 2, y + 48, '💎 星钻充值', { size: 38, bold: true, align: 'center', color: '#ffd76a' });
    // 上下文遗憾行：差多少补多少
    if (PAY.gap > 0 && FROM_TXT[PAY.from]) {
      var bl = 0.7 + 0.3 * Math.sin(Date.now() / 200);
      ctx.globalAlpha = bl;
      UI.label(P.W / 2, y + 86, FROM_TXT[PAY.from].replace('{n}', PAY.gap), { size: 26, bold: true, align: 'center', color: '#ff9f4a' });
      ctx.globalAlpha = 1;
    } else {
      UI.label(P.W / 2, y + 86, '60💎 = 1个盲盒 · 首充双倍=白拿一倍', { size: 21, align: 'center', color: '#9aa4b8' });
    }
    UI.label(P.W / 2, y + 114, '⚠️ 原型模拟支付：点击即到账，不产生真实扣费', { size: 18, align: 'center', color: '#ff9f4a' });

    // iOS：不展示任何付费入口（合规）
    if (P.ios) {
      UI.label(P.W / 2, y + h / 2 - 20, '🍎 iOS端暂未开放充值', { size: 30, bold: true, align: 'center', color: '#dfe6f2' });
      UI.label(P.W / 2, y + h / 2 + 24, '星钻可通过挖掘新发现、每日目标与里程碑获得', { size: 21, align: 'center', color: '#9aa4b8' });
      if (UI.button(P.W / 2 - 110, y + h - 76, 220, 50, '关闭', { color: '#3a4356', fontSize: 24 })) PAY.close();
      return;
    }

    // 月卡
    var my = y + 132;
    var mAct = D.monthlyActive(s);
    UI.panel(x + 24, my, w - 48, 110, { color: 'rgba(64,52,24,0.92)', borderColor: '#ffb02e' });
    UI.label(x + 48, my + 32, '⛏️ 矿工月卡  ¥' + D.iap.monthly.rmb, { size: 28, bold: true, color: '#ffd76a' });
    UI.label(x + 48, my + 70, '每日' + D.iap.monthly.gemDaily + '💎 · 隔夜矿车×2 · 开局撤离×1.1', { size: 19, color: '#e8dcc0', maxW: w - 260 });
    if (mAct) UI.label(x + w - 70, my + 55, '✅ 生效中\n剩' + Math.max(0, Math.round((s.monthlyUntil % 100) - (U.todayKey() % 100))) + '天', { size: 20, align: 'right', color: '#4cd471' });
    else if (UI.button(x + w - 190, my + 30, 150, 52, '¥' + D.iap.monthly.rmb + ' 开通', { fontSize: 24 })) PAY.buyMonthly();

    // 充值档位 2×3；金色高亮"恰好补足缺口的最小档"
    var gy = my + 130;
    var cw = (w - 72) / 2, chh = 118;
    var bestIdx = 0;
    if (PAY.gap > 0) {
      bestIdx = -1;
      for (var bi = 0; bi < D.iap.packs.length; bi++) {
        var bp = D.iap.packs[bi];
        var bGet = !s.firstCharged[bi] ? bp.gem * 2 : bp.gem + bp.bonus;
        if (bGet >= PAY.gap) { bestIdx = bi; break; }
      }
      if (bestIdx < 0) bestIdx = D.iap.packs.length - 1;
    }
    for (var i = 0; i < D.iap.packs.length; i++) {
      var p = D.iap.packs[i];
      var px = x + 24 + (i % 2) * (cw + 24), py = gy + Math.floor(i / 2) * (chh + 14);
      UI.panel(px, py, cw, chh);
      if (i === bestIdx) {
        ctx.strokeStyle = 'rgba(255,215,106,' + (0.6 + 0.4 * Math.sin(Date.now() / 220)) + ')';
        ctx.lineWidth = 4;
        U.rr(ctx, px + 2, py + 2, cw - 4, chh - 4, 12); ctx.stroke();
        UI.label(px + cw / 2, py - 2, PAY.gap > 0 ? '▼ 正好补上' : '▼ 推荐', { size: 16, bold: true, align: 'center', color: '#ffd76a' });
      }
      var first = !s.firstCharged[i];
      DG.A.draw(ctx, 'ui_gem', px + 16, py + 16, 40, 40);
      UI.label(px + 64, py + 34, '' + p.gem, { size: 30, bold: true, color: '#8fd0ff' });
      UI.label(px + 16, py + 74, first ? '🎁 首充双倍→' + p.gem * 2 : (p.bonus ? '+送' + p.bonus : '基础档'), { size: 18, color: first ? '#ffd76a' : '#9aa4b8' });
      if (UI.button(px + cw - 108, py + chh - 54, 96, 42, '¥' + p.rmb, { fontSize: 22, badge: first ? '!' : 0 })) PAY.buyPack(i);
    }

    UI.label(P.W / 2, y + h - 84, 'SSR最坏成本可算清: 25抽×60=1500💎(¥150封顶)', { size: 16, align: 'center', color: '#5a6478' });
    UI.label(P.W / 2, y + h - 62, '累计充值(模拟): ¥' + s.simPaidRmb + ' · 未成年人请在监护人指导下进行', { size: 16, align: 'center', color: '#5a6478' });
    if (UI.button(P.W / 2 - 110, y + h - 52, 220, 46, '关闭', { color: '#3a4356', fontSize: 24 })) PAY.close();
  };
})();
