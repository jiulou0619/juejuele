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
    wish: '🔦 点亮矿灯还差 {n}💎',
    box: '🎁 再开一盒还差 {n}💎',
    wheel: '🎡 再转一次还差 {n}💎'
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
    var x = x0 + (w + 10), y = P.safeTop + 26, h = 52;
    var ctx = P.ctx;
    ctx.fillStyle = '#3f8fdd';
    ctx.beginPath(); ctx.arc(x + w - 14, y + h / 2, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + w - 14, y + h / 2, 15, 0, Math.PI * 2); ctx.stroke();
    UI.label(x + w - 14, y + h / 2 + 1, '＋', { size: 24, bold: true, align: 'center', color: '#fff' });
    // 命中区=右端"+"圆圈那一小块（格子其余部分留给货币说明），上下放宽便于点按
    if (UI.tap && U.inRect(UI.tap.x, UI.tap.y, x + w - 46, y - 6, 52, h + 12)) { UI.tap = null; PAY.show('bar'); return true; }
    return false;
  };

  /* 在场景内容之后调用：最上层渲染 */
  var TIER = [ // 六档卡片配色：蓝→紫→金，越贵越华丽
    { bd: '#3d6ea8', bg: 'rgba(26,36,54,0.97)' },
    { bd: '#3d6ea8', bg: 'rgba(26,36,54,0.97)' },
    { bd: '#7a56b8', bg: 'rgba(38,30,58,0.97)' },
    { bd: '#7a56b8', bg: 'rgba(38,30,58,0.97)' },
    { bd: '#b8862e', bg: 'rgba(52,42,20,0.97)' },
    { bd: '#d8a032', bg: 'rgba(58,46,20,0.97)' }
  ];
  PAY.draw = function (ctx) {
    if (!PAY.open) return;
    var UI = DG.UI, P = DG.P, D = DG.D, s = DG.SAVE.d;
    DG.UI.tap = PAY._tap; PAY._tap = null;   // 归还点击给弹层控件
    UI.dim(0.84);
    var x = 26, w = P.W - 52;
    // iOS：不展示任何付费入口（合规）
    if (P.ios) {
      var ihh = 320, iy = Math.floor((P.H - ihh) / 2);
      UI.panel(x, iy, w, ihh);
      UI.label(P.W / 2, iy + 90, '🍎 iOS端暂未开放充值', { size: 30, bold: true, align: 'center', color: '#dfe6f2' });
      UI.label(P.W / 2, iy + 140, '星钻可通过挖掘新发现、每日目标与里程碑获得', { size: 21, align: 'center', color: '#9aa4b8', maxW: w - 60 });
      if (UI.button(P.W / 2 - 110, iy + ihh - 86, 220, 56, '关闭', { color: '#3a4356', fontSize: 24 })) PAY.close();
      return;
    }
    // 内容自适应高度，垂直居中
    var chh = 148, mh = 124;
    var h = 150 + (mh + 18) + chh * 3 + 16 * 2 + 18 + 46 + 62 + 22;
    var y = Math.max(P.safeTop + 24, Math.floor((P.H - h) / 2));
    UI.panel(x, y, w, h);
    UI.label(P.W / 2, y + 54, '星 钻 充 值', { size: 40, bold: true, align: 'center', color: '#ffd76a' });
    // 上下文遗憾行：差多少补多少
    if (PAY.gap > 0 && FROM_TXT[PAY.from]) {
      var bl = 0.7 + 0.3 * Math.sin(Date.now() / 200);
      ctx.globalAlpha = bl;
      UI.label(P.W / 2, y + 98, FROM_TXT[PAY.from].replace('{n}', PAY.gap), { size: 27, bold: true, align: 'center', color: '#ff9f4a' });
      ctx.globalAlpha = 1;
    } else {
      UI.label(P.W / 2, y + 98, '60💎 = 1个盲盒 · 首充双倍 = 白拿一倍', { size: 22, align: 'center', color: '#c9d2e4' });
    }
    UI.label(P.W / 2, y + 128, '⚠️ 原型模拟支付：点击即到账，不产生真实扣费', { size: 18, align: 'center', color: '#ff9f4a' });

    // 月卡：金色横幅
    var my = y + 150;
    var mAct = D.monthlyActive(s);
    UI.panel(x + 20, my, w - 40, mh, { color: 'rgba(66,52,22,0.97)', borderColor: '#ffb02e' });
    ctx.fillStyle = 'rgba(255,215,106,0.10)';
    U.rr(ctx, x + 20, my, w - 40, 44, 12); ctx.fill();
    UI.label(x + 46, my + 34, '⛏️ 矿工月卡', { size: 28, bold: true, color: '#ffd76a' });
    UI.label(x + 46, my + 72, '每日 ' + D.iap.monthly.gemDaily + '💎 领' + D.iap.monthly.days + '天 · 隔夜矿车×2', { size: 20, color: '#f0e6c8', maxW: w - 270 });
    UI.label(x + 46, my + 100, '开局撤离倍率 ×1.1 · 最实惠的长线选择', { size: 17, color: '#c9b88a', maxW: w - 270 });
    if (mAct) {
      UI.label(x + w - 52, my + 50, '✅ 生效中', { size: 24, bold: true, align: 'right', color: '#4cd471' });
      UI.label(x + w - 52, my + 82, '每天记得来领', { size: 17, align: 'right', color: '#9aa4b8' });
    } else if (UI.button(x + w - 210, my + mh / 2 - 30, 168, 60, '¥' + D.iap.monthly.rmb + ' 开通', { fontSize: 26 })) PAY.buyMonthly();

    // 充值档位 2×3；金色高亮"恰好补足缺口的最小档"
    var gy = my + mh + 18;
    var cw = (w - 60) / 2;
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
      var px = x + 20 + (i % 2) * (cw + 20), py = gy + Math.floor(i / 2) * (chh + 16);
      var tier = TIER[i] || TIER[0];
      UI.panel(px, py, cw, chh, { color: tier.bg, borderColor: tier.bd });
      var first = !s.firstCharged[i];
      // 首充×2 角标
      if (first) {
        ctx.fillStyle = '#c9821e';
        U.rr(ctx, px + cw - 96, py - 6, 90, 32, 8); ctx.fill();
        UI.label(px + cw - 51, py + 10, '首充×2', { size: 17, bold: true, align: 'center', color: '#fff' });
      }
      // 钻石图标 + 数量（大字居左）
      var isz = 44 + i * 3; // 越贵钻越大
      DG.A.draw(ctx, 'ui_gem', px + 18, py + 18, isz, isz);
      UI.label(px + 30 + isz, py + 18 + isz / 2, '' + p.gem, { size: 36, bold: true, color: '#8fd0ff' });
      // 到手行
      var got = first ? p.gem * 2 : p.gem + p.bonus;
      UI.label(px + 20, py + 84, '到手 ' + got + '💎' + (!first && p.bonus ? ' (含赠' + p.bonus + ')' : ''), { size: 19, bold: first, color: first ? '#ffd76a' : '#9aa4b8', maxW: cw - 36 });
      // 整宽金色价格钮
      if (UI.button(px + 14, py + chh - 50, cw - 28, 46, '¥ ' + p.rmb, { fontSize: 24 })) PAY.buyPack(i);
      if (i === bestIdx) {
        ctx.strokeStyle = 'rgba(255,215,106,' + (0.6 + 0.4 * Math.sin(Date.now() / 220)) + ')';
        ctx.lineWidth = 4;
        U.rr(ctx, px + 2, py + 2, cw - 4, chh - 4, 12); ctx.stroke();
        if (PAY.gap > 0) UI.label(px + cw / 2, py - 10, '▼ 正好补上', { size: 17, bold: true, align: 'center', color: '#ffd76a' });
      }
    }

    // 底部：说明两行 + 关闭按钮，互不重叠
    var fy = gy + chh * 3 + 16 * 2 + 18;
    UI.label(P.W / 2, fy, 'SSR最坏成本可算清: 25抽×60=1500💎 (¥150封顶)', { size: 16, align: 'center', color: '#7a849a' });
    UI.label(P.W / 2, fy + 24, '累计充值(模拟): ¥' + s.simPaidRmb + ' · 未成年人请在监护人指导下进行', { size: 16, align: 'center', color: '#7a849a' });
    if (UI.button(P.W / 2 - 130, fy + 44, 260, 56, '关闭', { color: '#3a4356', txtColor: '#fff', fontSize: 26 })) PAY.close();
  };
})();
