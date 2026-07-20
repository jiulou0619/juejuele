/* scene_meta.js — 局外系统：商店 / 盲盒藏品 / 图鉴 / 转盘 / 拼图 / 皮肤 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U, UI = DG.UI, P = DG.P, D_ = null;
  var tab = 'shop';
  var boxResult = null;      // 开盒结果 {item,isNew,dust}
  var boxAnim = null;        // CSGO式开箱滚动动画
  var puzzleShow = null;     // 拼图完成后的整图展示悬浮
  var dustOpen = false;      // 星尘兑换所弹层
  var dustPick = null;       // 兑换二次确认 {item, cost}

  /* 本周键：定向补件按自然周限量，不需要额外的重置系统 */
  function weekKey() {
    var t = new Date();
    var d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7));
    return '' + d.getFullYear() + (d.getMonth() + 1) + d.getDate();
  }
  function dustWeekLeft(s) {
    if (s.dustWeekKey !== weekKey()) { s.dustWeekKey = weekKey(); s.dustWeekN = 0; }
    return DG.D.dust.weekCap - (s.dustWeekN || 0);
  }
  /* 该套里玩家最接近、最该补的一件（用于重复弹窗的"还差多少"指引） */
  function nextTarget(s, set) {
    var D = DG.D, own = 0, best = null;
    for (var i = 0; i < 8; i++) {
      if (s.col[set.id + '_' + i]) { own++; continue; }
      var rar = D.rarOfIdx(i);
      if (rar === 'SSR') continue;                 // SSR不上架定向
      var cost = D.dust.price[rar];
      if (!best || cost < best.cost) best = { idx: i, rar: rar, cost: cost, name: set.items[i][0], set: set };
    }
    return own >= 2 ? best : null;                 // 该套需已有≥2件才解锁兑换
  }
  var codexPage = 0;         // 图鉴翻页页码
  var wheel = { ang: 0, spinning: false, t: 0, dur: 0, from: 0, to: 0, targetIdx: -1, result: null };

  var TABS = [
    { id: 'shop', txt: '商店', icon: 'ic_shop' }, { id: 'box', txt: '盲盒', icon: 'ic_box' }, { id: 'codex', txt: '图鉴', icon: 'ic_book' },
    { id: 'wheel', txt: '转盘', icon: 'ic_wheel' }, { id: 'puzzle', txt: '拼图', icon: 'ic_puzzle' }, { id: 'skin', txt: '强化', icon: 'ic_gym' }
  ];

  /* ---------- 盲盒抽取（三重保底：25硬保底SSR / 10抽R+ / 首盒R+） ---------- */
  function rollBox() {
    var s = DG.SAVE.d, D = DG.D;
    s.boxCount++; s.pityBox++; s.pitySinceR++;
    var rar;
    if (s.pityBox >= D.pity.ssr) rar = 'SSR';
    else {
      var r = Math.random() * 100;
      if (r < 2) rar = 'SSR'; else if (r < 12) rar = 'SR'; else if (r < 42) rar = 'R'; else rar = 'N';
      if (rar === 'N' && (s.pitySinceR >= D.pity.r10 || s.boxCount === 1)) rar = 'R';
    }
    if (rar === 'SSR') s.pityBox = 0;
    if (rar !== 'N') s.pitySinceR = 0;
    var pool = D.allItems().filter(function (it) { return it.rar === rar; });
    // 许愿矿灯：定向加权——同稀有度下75%改用许愿套装的未拥有子池（不改稀有度概率，公示不变）
    if (s.wish && s.wish.left > 0) {
      var wpool = pool.filter(function (it) { return it.set.id === s.wish.set && !s.col[it.id]; });
      if (wpool.length && Math.random() < 0.65) pool = wpool;
    }
    var item = U.pick(pool);
    var isNew = !s.col[item.id];
    if (s.wish) {
      s.wish.left--;
      if (isNew && item.set.id === s.wish.set) {
        s.wish = null;
        DG.FX.banner('🔦 矿灯熄灭 · 愿望达成!', { color: '#ffd76a', size: 44, life: 2 });
      } else if (s.wish.left <= 0) s.wish = null;
    }
    var dust = 0;
    if (isNew) {
      s.col[item.id] = 1;
      checkSetDone(item.set);
    } else {
      dust = D.rarCfg[rar].dust;
      s.dust += dust;
      s.dupCount[item.id] = (s.dupCount[item.id] || 0) + 1;
    }
    D.calcBonuses();
    DG.SAVE.save();
    DG.A.sfx(rar === 'SSR' ? 'box_ssr' : 'box_open', { vibrate: true, strong: rar === 'SSR' });
    return { item: item, isNew: isNew, dust: dust, rar: rar };
  }

  function checkSetDone(set) {
    var s = DG.SAVE.d, n = 0;
    for (var i = 0; i < 8; i++) if (s.col[set.id + '_' + i]) n++;
    if (n >= 8 && !s.setRewarded[set.id]) {
      s.setRewarded[set.id] = 1;
      s.gem += 100;
      DG.FX.banner('🎊 集齐【' + set.name + '】+100💎', { color: '#ffb02e', size: 44, life: 2 });
    }
  }

  function setOwnedCount(set) {
    var s = DG.SAVE.d, n = 0;
    for (var i = 0; i < 8; i++) if (s.col[set.id + '_' + i]) n++;
    return n;
  }

  /* CSGO式开箱：结果先定，横向滚带减速停在结果上；点击任意处直接出结果 */
  function startCase(res) {
    var all = DG.D.allItems();
    var reel = [];
    for (var i = 0; i < 26; i++) reel.push(all[Math.floor(Math.random() * all.length)]);
    var land = 21;
    reel[land] = res.item;
    var jit = (Math.random() - 0.5) * 56;
    // 非SSR时90%概率：落点前一格放SSR，指针刚划过它才停——"就差一格"
    if (res.rar !== 'SSR' && Math.random() < 0.9) {
      var ssrs = all.filter(function (it2) { return it2.rar === 'SSR'; });
      if (ssrs.length) {
        reel[land - 1] = U.pick(ssrs);
        jit = -(12 + Math.random() * 40); // 停得偏左，贴着刚错过的SSR
      }
    }
    boxAnim = { reel: reel, res: res, land: land, t: 0, dur: 2.0, hold: 0, jit: jit };
    DG.A.sfx('wheel_spin');
  }

  function drawCase(ctx, dt) {
    var D = DG.D;
    UI.dim(0.85);
    var wW = P.W - 40, wx = 20, wh = 240, wy = P.H * 0.42 - wh / 2;
    UI.panel(wx, wy - 88, wW, wh + 210);
    UI.label(P.W / 2, wy - 46, '📦 开 启 中 …', { size: 32, bold: true, align: 'center', color: '#ffd76a' });
    ctx.save();
    U.rr(ctx, wx + 14, wy, wW - 28, wh, 12); ctx.clip();
    ctx.fillStyle = 'rgba(10,12,18,0.92)';
    ctx.fillRect(wx + 14, wy, wW - 28, wh);
    var cardW = 172, innerW = wW - 28;
    var F = boxAnim.land * cardW + cardW / 2 - innerW / 2 + boxAnim.jit;
    var kk = U.easeOutCubic(Math.min(1, boxAnim.t / boxAnim.dur));
    var off = kk * F;
    for (var ri = 0; ri < boxAnim.reel.length; ri++) {
      var cx2 = wx + 14 + ri * cardW - off;
      if (cx2 > wx + wW || cx2 + cardW < wx) continue;
      var it2 = boxAnim.reel[ri];
      var rc2 = D.rarCfg[it2.rar];
      ctx.fillStyle = 'rgba(34,40,56,0.96)';
      U.rr(ctx, cx2 + 6, wy + 12, cardW - 12, wh - 24, 12); ctx.fill();
      UI.glyph(ctx, it2.glyph, cx2 + cardW / 2, wy + wh / 2 - 24, 84);
      ctx.fillStyle = rc2.color;
      ctx.fillRect(cx2 + 12, wy + wh - 30, cardW - 24, 10);
      UI.label(cx2 + cardW / 2, wy + wh - 52, it2.rar, { size: 20, bold: true, align: 'center', color: rc2.color });
    }
    ctx.restore();
    // 金色中线指针
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(P.W / 2, wy - 6); ctx.lineTo(P.W / 2, wy + wh + 6); ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.moveTo(P.W / 2 - 13, wy - 18); ctx.lineTo(P.W / 2 + 13, wy - 18); ctx.lineTo(P.W / 2, wy - 2); ctx.closePath(); ctx.fill();
    UI.label(P.W / 2, wy + wh + 64, '👆 点击任意处 加速揭晓', { size: 22, align: 'center', color: '#9aa4b8' });
    boxAnim.t += dt;
    if (UI.tap) { UI.tap = null; if (boxAnim.t < boxAnim.dur) boxAnim.t = boxAnim.dur; }
    if (boxAnim.t >= boxAnim.dur) {
      boxAnim.hold += dt;
      if (boxAnim.hold > 0.35) {
        boxResult = boxAnim.res;
        DG.A.sfx(boxResult.rar === 'SSR' ? 'box_ssr' : 'box_open', { vibrate: true, strong: boxResult.rar === 'SSR' });
        boxAnim = null;
      }
    }
  }

  /* 拼图锯齿块路径：tb=[上,右,下,左] 1凸/-1凹/0平边 */
  function jigPath(ctx, x, y, w, h, tb) {
    var r = Math.min(w, h) * 0.14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (tb[0]) { ctx.lineTo(x + w / 2 - r, y); ctx.arc(x + w / 2, y, r, Math.PI, 0, tb[0] > 0); }
    ctx.lineTo(x + w, y);
    if (tb[1]) { ctx.lineTo(x + w, y + h / 2 - r); ctx.arc(x + w, y + h / 2, r, -Math.PI / 2, Math.PI / 2, tb[1] < 0); }
    ctx.lineTo(x + w, y + h);
    if (tb[2]) { ctx.lineTo(x + w / 2 + r, y + h); ctx.arc(x + w / 2, y + h, r, 0, Math.PI, tb[2] < 0); }
    ctx.lineTo(x, y + h);
    if (tb[3]) { ctx.lineTo(x, y + h / 2 + r); ctx.arc(x, y + h / 2, r, Math.PI / 2, Math.PI * 1.5, tb[3] < 0); }
    ctx.closePath();
  }
  /* 3×3 内部咬合：竖缝/横缝各自交错，边框平边 */
  function jigTabs(r, c) {
    var right = c < 2 ? ((r + c) % 2 ? 1 : -1) : 0;
    var left = c > 0 ? -((r + c - 1) % 2 ? 1 : -1) : 0;
    var bottom = r < 2 ? ((r * 2 + c) % 2 ? 1 : -1) : 0;
    var top = r > 0 ? -(((r - 1) * 2 + c) % 2 ? 1 : -1) : 0;
    return [top, right, bottom, left];
  }

  DG.Main.scene('meta', {
    enter: function (arg) { tab = arg || 'shop'; boxResult = null; boxAnim = null; puzzleShow = null; dustOpen = false; dustPick = null; codexPage = 0; wheel.spinning = false; wheel.result = null; },

    frame: function (dt, ctx) {
      var s = DG.SAVE.d;
      // 页面背景：泥土图暗化，UI悬浮其上不再一片黑
      var bg = DG.A.images.bg_topsoil;
      if (bg) {
        ctx.drawImage(bg, -4, -4, P.W + 8, P.H + 8);
        ctx.fillStyle = 'rgba(8,10,16,0.55)';
        ctx.fillRect(-4, -4, P.W + 8, P.H + 8);
      }
      // 返回键在最左，货币栏右移让位（修遮挡bug）
      var modal = (tab === 'box' && (!!boxResult || !!boxAnim || dustOpen)) || (tab === 'puzzle' && !!puzzleShow);
      if (UI.button(14, P.safeTop + 26, 72, 52, '←', { color: '#3a4356', txtColor: '#fff', fontSize: 30, disabled: modal })) { DG.Main.go('home'); return; }
      // 顶栏四格全局统一（和首页完全一致）；星尘是专用材料，只在盲盒页显示
      var by = UI.currencyBar(DG.D.topBar(s), 98);
      DG.PAY.gemHotspot(98);
      var tw = (P.W - 40) / 6;
      for (var i = 0; i < TABS.length; i++) {
        var un = DG.D.unlocks[TABS[i].id] ? DG.D.unlocks[TABS[i].id](s) : true;
        var active = tab === TABS[i].id;
        if (UI.button(20 + i * tw, by + 8, tw - 6, 56, un ? TABS[i].txt : '🔒', {
          color: active ? UI.C.pri : UI.C.panel2, glyph: un ? TABS[i].icon : null, fontSize: 21, disabled: !un || modal
        })) { tab = TABS[i].id; boxResult = null; wheel.result = null; }
      }
      var top = by + 80;
      this[tab](ctx, top, dt);
    },

    /* ================= 商店 ================= */
    /* 商店：投入式升级——金币随时投进去填当前级进度条，填满即升1级。
     * 金币永远有去处（不再"买不起就干瞪眼/买得起秒空"），大额成本也不吓人。 */
    shop: function (ctx, top) {
      var s = DG.SAVE.d;
      if (!s.shopInv) s.shopInv = {};
      UI.label(P.W / 2, top + 20, '永久升级 · 投入金币填满进度条=升1级', { size: 22, align: 'center', color: UI.C.dim });
      var itemH = 150;
      var listTop = top + 50;
      UI.scroll('shop', 20, listTop, P.W - 40, P.H - listTop - 20, DG.D.shop.length * (itemH + 14), function () {
        for (var i = 0; i < DG.D.shop.length; i++) {
          var it = DG.D.shop[i];
          var y = listTop + i * (itemH + 14);
          var lv = s.shop[it.id] || 0;
          var maxed = lv >= it.max;
          var pr = DG.D.shopPrice(it, lv);
          var inv = s.shopInv[it.id] || 0;
          var gatedM = it.needM && s.cumM < it.needM;
          var gatedR = it.needRuns && s.runCount < it.needRuns;
          var gateDepth = s.cumM < pr.needM && lv >= 5;
          UI.panel(20, y, P.W - 40, itemH);
          UI.label(50, y + 42, it.icon + ' ' + it.name + '  Lv.' + lv + '/' + it.max, { size: 30, bold: true, color: '#fff' });
          UI.label(50, y + 84, it.desc, { size: 24, color: UI.C.dim });
          if (maxed) {
            UI.bar(50, y + 112, 300, 16, 1, UI.C.green);
            UI.label(P.W - 80, y + itemH / 2, 'MAX', { size: 28, bold: true, align: 'right', color: UI.C.green });
            continue;
          }
          // 当前级的投入进度条：满了才算升1级
          UI.bar(50, y + 108, 340, 20, inv / pr.cost, inv >= pr.cost * 0.85 ? UI.C.gold : UI.C.blue, U.fmt(inv) + '/' + U.fmt(pr.cost));
          if (gatedM || gatedR) UI.label(P.W - 60, y + itemH / 2, gatedM ? '需累计' + it.needM + 'm' : '需' + it.needRuns + '局', { size: 22, align: 'right', color: UI.C.pri });
          else if (gateDepth) UI.label(P.W - 60, y + itemH / 2, '需累计' + pr.needM + 'm', { size: 22, align: 'right', color: UI.C.pri });
          else {
            var amt = Math.min(s.coin, pr.cost - inv);
            if (UI.button(P.W - 240, y + 46, 180, 60, '投入', { fontSize: 25, disabled: amt <= 0, sub: amt > 0 ? '🪙' + U.fmt(amt) : '金币不足' })) {
              s.coin -= amt;
              inv += amt;
              if (inv >= pr.cost) { // 填满=升级，仪式感拉满
                s.shop[it.id] = lv + 1;
                s.shopInv[it.id] = 0;
                DG.D.calcBonuses();
                DG.A.sfx('buy', { vibrate: true, strong: true });
                DG.FX.banner(it.icon + ' ' + it.name + ' Lv.' + (lv + 1) + '!', { color: UI.C.green, size: 46 });
              } else {
                s.shopInv[it.id] = inv;
                DG.A.sfx('coin');
                DG.FX.text(P.W - 150, y + 30, '+' + U.fmt(amt), { color: UI.C.gold, size: 26 });
              }
              DG.SAVE.save();
            }
          }
        }
      });
    },

    /* ================= 盲盒 ================= */
    box: function (ctx, top, dt) {
      var s = DG.SAVE.d, D = DG.D;
      var busy = !!boxResult || !!boxAnim || dustOpen;
      // SSR保底进度条（goal-gradient：离终点越近越想走完）
      var pityRemain = D.pity.ssr - s.pityBox;
      var hot = pityRemain <= 3;
      UI.bar(40, top + 4, P.W - 80, 26, s.pityBox / D.pity.ssr, hot ? '#ffb02e' : UI.C.purple, 'SSR保底 ' + s.pityBox + '/' + D.pity.ssr + (hot ? ' 🔥' : ''));
      // 星尘只在这里露出：它就是在这页因重复藏品产生、也在这页消耗；自选券持有时也在此提示
      UI.label(P.W / 2, top + 48, '✨星尘 ' + U.fmt(s.dust) + (s.ssrTicket > 0 ? ' · 👑自选券×' + s.ssrTicket : '') + ' · N58% R30% SR10% SSR2%', { size: 19, align: 'center', color: UI.C.dim, maxW: P.W - 40 });
      if (UI.button(40, top + 68, (P.W - 100) / 2, 70, '开1个 (🔑1)', { fontSize: 28, disabled: s.boxkey < 1 || busy })) { s.boxkey--; startCase(rollBox()); }
      if (UI.button(60 + (P.W - 100) / 2, top + 68, (P.W - 100) / 2, 70, '开1个 (💎' + D.boxCost.gem + ')', { color: '#5a4a8f', txtColor: '#fff', fontSize: 28, disabled: busy })) {
        if (s.gem >= D.boxCost.gem) { s.gem -= D.boxCost.gem; startCase(rollBox()); }
        else DG.PAY.show('box', D.boxCost.gem - s.gem); // 钻石不足→直接开收银台
      }
      // 星尘兑换所入口（星尘唯一出口，就开在它产生的地方）
      var dLeft = dustWeekLeft(s);
      if (UI.button(40, top + 146, P.W - 80, 56, '✨ 星尘兑换所  ' + U.fmt(s.dust), {
        color: UI.C.panel2, fontSize: 23, disabled: busy,
        sub: dLeft > 0 ? '补齐缺的藏品 · 本周可兑 ' + dLeft + ' 件' : '本周额度已用完 · 仍可淬火钻头'
      })) dustOpen = true;
      var yy = top + 214;
      // 保底走廊：差≤5抽 → 一键冲底"必出SSR"（冲刺8折48/抽，先耗手里的券）
      if (pityRemain <= D.iap.pityKeyWindow && s.boxCount > 0) {
        var needKeys = Math.max(0, pityRemain - s.boxkey);
        var rushCost = needKeys * D.iap.pityKey;
        UI.panel(40, yy, P.W - 80, 96, { color: 'rgba(90,44,26,0.94)', borderColor: '#ffb02e' });
        var bl2 = 0.75 + 0.25 * Math.sin(Date.now() / 200);
        ctx.globalAlpha = bl2;
        UI.label(60, yy + 30, '🔥 一键 ' + pityRemain + ' 连开 → 必出SSR!', { size: 26, bold: true, color: '#ffd76a' });
        ctx.globalAlpha = 1;
        UI.label(60, yy + 66, '(25抽硬保底数学兜底) · 单抽60💎 · 冲刺8折', { size: 17, color: '#e8dcc0' });
        if (UI.button(P.W - 262, yy + 24, 210, 50, rushCost > 0 ? '💎' + rushCost + ' 冲!' : '用券冲!', { fontSize: 24, disabled: busy })) {
          if (s.gem >= rushCost) {
            s.gem -= rushCost;
            D.track('pity_rush');
            var order = { N: 0, R: 1, SR: 2, SSR: 3 };
            var best = null, dustSum = 0, newCnt = 0;
            for (var pk2 = 0; pk2 < pityRemain; pk2++) {
              if (s.boxkey > 0) s.boxkey--;
              var rr2 = rollBox();
              dustSum += rr2.dust; if (rr2.isNew) newCnt++;
              if (!best || order[rr2.rar] > order[best.rar]) best = rr2;
            }
            best.multi = pityRemain + '连开完: ✨NEW×' + newCnt + ' · 星尘+' + dustSum;
            boxResult = best;
            DG.SAVE.save();
          } else DG.PAY.show('box_pity', rushCost - s.gem);
        }
        yy += 106;
      }
      if (s.ssrTicket > 0) {
        if (UI.button(40, yy, P.W - 80, 56, '✨ 使用SSR自选券（获得1件未拥有SSR）', { color: '#8f6a1e', txtColor: '#fff', fontSize: 24, disabled: busy })) {
          var missing = D.allItems().filter(function (it) { return it.rar === 'SSR' && !s.col[it.id]; });
          s.ssrTicket--;
          if (missing.length) {
            var got = U.pick(missing);
            s.col[got.id] = 1;
            checkSetDone(got.set);
            boxResult = { item: got, isNew: true, dust: 0, rar: 'SSR' };
          } else { s.dust += 300; DG.FX.banner('SSR已集齐 → 星尘+300', { size: 40 }); }
          D.calcBonuses(); DG.SAVE.save();
        }
        yy += 66;
      }
      // 藏品收集网格：5套×8
      var listTop = yy + 10;
      var rowH = 176;
      UI.scroll('box', 20, listTop, P.W - 40, P.H - listTop - 20, D.sets.length * rowH + 40, function () {
        for (var si = 0; si < D.sets.length; si++) {
          var set = D.sets[si];
          var y = listTop + si * rowH;
          var n = setOwnedCount(set);
          var eff = n >= 8 ? '全效' : n >= 4 ? '半效' : '未激活';
          UI.label(30, y + 22, set.icon + ' ' + set.name + ' ' + n + '/8' + (n === 7 ? '  🔥差1件!' : ''), { size: 26, bold: true, color: n === 7 ? '#ffd76a' : '#fff' });
          // 许愿矿灯：7/8时点亮，5盒内该套定向×3
          if (s.wish && s.wish.set === set.id) {
            UI.label(P.W - 40, y + 22, '🔦 定向×3 · 剩' + s.wish.left + '盒', { size: 20, align: 'right', color: '#ffd76a' });
          } else if (n === 7 && !s.wish && !busy) {
            if (UI.button(P.W - 212, y + 2, 172, 40, s.daily.wishAd ? '🔦 许愿 💎' + D.iap.wishGem : '🔦 许愿 📺免费', { fontSize: 18 })) {
              (function (setId) {
                if (!s.daily.wishAd) { s.daily.wishAd = true; D.adStub('wish', function () { s.wish = { set: setId, left: 5 }; DG.SAVE.save(); }); }
                else if (s.gem >= D.iap.wishGem) { s.gem -= D.iap.wishGem; s.wish = { set: setId, left: 5 }; D.track('wish_gem'); DG.SAVE.save(); }
                else DG.PAY.show('wish', D.iap.wishGem - s.gem);
              })(set.id);
            }
          } else {
            UI.label(P.W - 40, y + 22, '套装:' + set.statName + '+' + set.setVal + set.unit + ' [' + eff + ']', { size: 20, align: 'right', color: n >= 4 ? '#4cd471' : UI.C.dim });
          }
          for (var i = 0; i < 8; i++) {
            var id = set.id + '_' + i;
            var x = 30 + i * ((P.W - 70) / 8);
            var cw = (P.W - 70) / 8 - 8;
            var owned = s.col[id];
            var rar = D.rarOfIdx(i);
            UI.slot(x, y + 44, cw, cw + 30, owned ? 1 : 0.5);
            if (owned) { ctx.strokeStyle = D.rarCfg[rar].color; ctx.lineWidth = 3; U.rr(ctx, x + 2, y + 46, cw - 4, cw + 26, 10); ctx.stroke(); }
            ctx.font = Math.floor(cw * 0.55) + 'px Xiaolai, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.globalAlpha = owned ? 1 : 0.35;
            ctx.fillText(owned ? set.items[i][1] : '❓', x + cw / 2, y + 44 + cw / 2);
            ctx.globalAlpha = 1;
            UI.label(x + cw / 2, y + 44 + cw + 14, owned ? set.items[i][0] : rar, { size: 20, bold: owned, align: 'center', color: owned ? '#f0f3fa' : D.rarCfg[rar].color, maxW: cw });
          }
        }
      });
      // 开盒结果弹窗
      if (boxResult) {
        UI.dim(0.82);
        var it = boxResult.item, rc = D.rarCfg[it.rar];
        var bx = P.W / 2 - 220, bw = 440, bh = 540, byy = P.H / 2 - 320;
        UI.panel(bx, byy, bw, bh, { borderColor: rc.color, color: it.rar === 'SSR' ? '#3a3020' : null });
        UI.label(P.W / 2, byy + 50, it.rar + (boxResult.isNew ? '  ✨NEW✨' : '  (重复)'), { size: 34, bold: true, align: 'center', color: rc.color });
        UI.glyph(ctx, it.glyph, P.W / 2, byy + 180, 130);
        UI.label(P.W / 2, byy + 290, '【' + it.set.name + '】' + it.name, { size: 30, bold: true, align: 'center', color: '#fff' });
        if (boxResult.isNew) {
          UI.label(P.W / 2, byy + 334, '词条: ' + it.set.statName + '+' + rc.pct * (it.set.stat === 'durMax' ? 2 : 1) + (it.set.unit || ''), { size: 24, align: 'center', color: UI.C.dim });
        } else {
          // 重复不再是终点：把星尘换算成"离补齐下一件还差多少"，每一次重复都成为刻度
          UI.label(P.W / 2, byy + 328, '分解 → ✨星尘+' + boxResult.dust, { size: 24, align: 'center', color: UI.C.dim });
          var tg = nextTarget(s, it.set);
          if (tg) {
            var need = Math.max(0, tg.cost - s.dust);
            UI.label(P.W / 2, byy + 362, need > 0 ? ('距兑换【' + tg.name + '】还差 ✨' + U.fmt(need)) : ('✨ 可兑换【' + tg.name + '】了!'), { size: 21, align: 'center', color: need > 0 ? UI.C.blue : UI.C.green, maxW: bw - 40 });
            UI.bar(bx + 60, byy + 382, bw - 120, 14, Math.min(1, s.dust / tg.cost), need > 0 ? UI.C.blue : UI.C.green);
          }
        }
        if (boxResult.multi) UI.label(P.W / 2, byy + 364, boxResult.multi, { size: 20, align: 'center', color: '#8fd0ff' });
        if (UI.button(bx + 30, byy + bh - 162, (bw - 80) / 2, 60, '再开 (🔑' + s.boxkey + ')', { fontSize: 23, disabled: s.boxkey < 1 })) { s.boxkey--; boxResult = null; startCase(rollBox()); }
        if (UI.button(bx + bw / 2 + 10, byy + bh - 162, (bw - 80) / 2, 60, '再开 (💎' + D.boxCost.gem + ')', { color: '#5a4a8f', txtColor: '#fff', fontSize: 23 })) {
          if (s.gem >= D.boxCost.gem) { s.gem -= D.boxCost.gem; boxResult = null; startCase(rollBox()); }
          else DG.PAY.show('box', D.boxCost.gem - s.gem);
        }
        if (UI.button(bx + 30, byy + bh - 88, bw - 60, 58, '收下', { color: '#3a4356', txtColor: '#fff', fontSize: 24 })) boxResult = null;
      }
      // 开箱滚动动画（最后画，盖住一切）
      if (boxAnim) drawCase(ctx, dt);
      if (dustOpen) this.dustShop(ctx);
    },

    /* ================= 星尘兑换所 =================
     * 星尘唯一的消耗出口。三段：定向补件(N/R/SR) / SSR自选券 / 钻头淬火永久轨。 */
    dustShop: function (ctx) {
      var s = DG.SAVE.d, D = DG.D, P2 = P;
      UI.dim(0.86);
      var x = 26, w = P.W - 52;

      // ---- 二次确认层 ----
      if (dustPick) {
        var p = dustPick;
        UI.dim(0.6);
        var cw = P.W - 120, cx = 60, chh = 430, cy = Math.floor((P.H - chh) / 2);
        UI.panel(cx, cy, cw, chh);
        UI.label(P.W / 2, cy + 54, p.title, { size: 30, bold: true, align: 'center', color: UI.C.txt, maxW: cw - 40 });
        if (p.glyph) UI.glyph(ctx, p.glyph, P.W / 2, cy + 150, 110);
        UI.label(P.W / 2, cy + 240, p.sub, { size: 23, align: 'center', color: UI.C.blue, maxW: cw - 50 });
        var afford = s.dust >= p.cost;
        UI.label(P.W / 2, cy + 286, afford ? ('✨ ' + U.fmt(p.cost)) : ('还差 ✨' + U.fmt(p.cost - s.dust)), { size: 27, bold: true, align: 'center', color: afford ? UI.C.gold : UI.C.red });
        if (UI.button(cx + 26, cy + chh - 92, (cw - 78) / 2, 64, '确认兑换', { fontSize: 25, disabled: !afford })) { p.go(); dustPick = null; }
        if (UI.button(cx + cw / 2 + 13, cy + chh - 92, (cw - 78) / 2, 64, '再想想', { color: UI.C.panel2, fontSize: 25 })) dustPick = null;
        return;
      }

      // 预扫：每套的可兑件与状态（决定行高：有货=卡片区块，无货=一行小字）
      var rows = [];
      for (var si = 0; si < D.sets.length; si++) {
        var set = D.sets[si], ownN = setOwnedCount(set), items = [];
        for (var i = 0; i < 8; i++) {
          var id = set.id + '_' + i;
          if (s.col[id]) continue;
          var rar = D.rarOfIdx(i);
          if (rar === 'SSR') continue;             // SSR不上架定向
          items.push({ set: set, i: i, id: id, rar: rar, cost: D.dust.price[rar], bought: !!s.dustBuy[id] });
        }
        rows.push({ set: set, own: ownN, items: items,
          state: ownN < 2 ? 'locked' : (items.length ? 'open' : 'done') });
      }
      var CARD_H = 172, BLOCK_H = 48 + CARD_H + 22, LINE_H = 44;
      var contentH = 12;
      for (var ri = 0; ri < rows.length; ri++) contentH += rows[ri].state === 'open' ? BLOCK_H : LINE_H;
      contentH += 24 + 96 + 96 + 30; // 分隔 + SSR行 + 淬火行

      // 面板贴内容自适应高度并垂直居中；内容超高时内部滚动
      var need = 108 + contentH + 84;
      var maxH = P.H - P.safeTop - 76;
      var h = Math.min(need, maxH);
      var y = Math.max(P.safeTop + 30, Math.floor((P.H - h) / 2));
      UI.panel(x, y, w, h);
      UI.label(P.W / 2, y + 46, '星 尘 兑 换 所', { size: 34, bold: true, align: 'center', color: UI.C.gold });
      UI.label(P.W / 2, y + 84, '✨ ' + U.fmt(s.dust) + '  ·  本周还可兑换 ' + Math.max(0, dustWeekLeft(s)) + ' 件', { size: 22, align: 'center', color: UI.C.dim });
      var listTop = y + 108, listH = h - 108 - 84;

      UI.scroll('dustshop', x + 10, listTop, w - 20, listH, contentH, function () {
        var cy2 = listTop + 12;
        for (var ri = 0; ri < rows.length; ri++) {
          var row = rows[ri], set = row.set;
          if (row.state !== 'open') { // 收齐/未解锁：一行小字带走，不占屏
            UI.glyph(ctx, set.icon, x + 44, cy2 + 20, 26);
            UI.label(x + 66, cy2 + 20, set.name + '  ' + row.own + '/8', { size: 21, color: UI.C.dim });
            UI.label(x + w - 34, cy2 + 20, row.state === 'done' ? '✅ 可兑部分已收齐' : '🔒 集齐2件解锁兑换', { size: 19, align: 'right', color: row.state === 'done' ? UI.C.green : UI.C.dim });
            cy2 += LINE_H;
            continue;
          }
          // 套头：图标+名字+进度
          UI.glyph(ctx, set.icon, x + 46, cy2 + 22, 30);
          UI.label(x + 72, cy2 + 22, set.name, { size: 24, bold: true, color: UI.C.txt });
          UI.label(x + w - 34, cy2 + 22, row.own + '/8 · ' + set.statName + '套装', { size: 19, align: 'right', color: UI.C.dim });
          // 藏品卡片：图标+名字+稀有度+价格钮
          var cw2 = (w - 76) / 4, showN = Math.min(4, row.items.length);
          for (var k = 0; k < showN; k++) {
            var it = row.items[k];
            var cx2 = x + 30 + k * cw2, ct = cy2 + 48;
            UI.slot(cx2, ct, cw2 - 10, CARD_H, it.bought ? 0.45 : 1);
            ctx.strokeStyle = D.rarCfg[it.rar].color; ctx.lineWidth = 2.5;
            U.rr(ctx, cx2 + 2, ct + 2, cw2 - 14, CARD_H - 4, 10); ctx.stroke();
            ctx.globalAlpha = it.bought ? 0.4 : 1;
            UI.glyph(ctx, it.set.items[it.i][1], cx2 + (cw2 - 10) / 2, ct + 42, 54);
            ctx.globalAlpha = 1;
            UI.label(cx2 + (cw2 - 10) / 2, ct + 84, it.set.items[it.i][0], { size: 18, bold: true, align: 'center', color: UI.C.txt, maxW: cw2 - 22 });
            UI.label(cx2 + (cw2 - 10) / 2, ct + 108, it.rar, { size: 16, align: 'center', color: D.rarCfg[it.rar].color });
            if (it.bought) {
              UI.label(cx2 + (cw2 - 10) / 2, ct + 142, '✅ 已兑', { size: 19, align: 'center', color: UI.C.green });
            } else {
              var can = dustWeekLeft(s) > 0 && s.dust >= it.cost;
              (function (it2) {
                if (UI.button(cx2 + 8, ct + 122, cw2 - 26, 42, '✨' + it2.cost, { color: can ? null : UI.C.panel2, fontSize: 19, disabled: !can })) {
                  dustPick = {
                    title: '【' + it2.set.name + '】' + it2.set.items[it2.i][0],
                    glyph: it2.set.items[it2.i][1], cost: it2.cost,
                    sub: it2.rar + ' · 词条 ' + it2.set.statName + '+' + D.rarCfg[it2.rar].pct + (it2.set.unit || ''),
                    go: function () {
                      s.dust -= it2.cost; s.col[it2.id] = 1; s.dustBuy[it2.id] = 1; s.dustWeekN = (s.dustWeekN || 0) + 1;
                      checkSetDone(it2.set); D.calcBonuses(); DG.SAVE.save();
                      boxResult = { item: { id: it2.id, name: it2.set.items[it2.i][0], glyph: it2.set.items[it2.i][1], rar: it2.rar, set: it2.set }, isNew: true, dust: 0, rar: it2.rar };
                      dustOpen = false;
                      DG.A.sfx('box_open', { vibrate: true, strong: true });
                    }
                  };
                }
              })(it);
            }
          }
          cy2 += BLOCK_H;
        }
        // ---- 分隔线 + 常青兑换 ----
        ctx.strokeStyle = UI.C.line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 40, cy2 + 10); ctx.lineTo(x + w - 40, cy2 + 10); ctx.stroke();
        cy2 += 24;
        // SSR自选券行：图标+说明左，按钮右
        var ssrLeft = Math.max(0, D.dust.ssrCap - (s.dustSsrN || 0));
        UI.glyph(ctx, '👑', x + 58, cy2 + 44, 44);
        UI.label(x + 96, cy2 + 30, 'SSR自选券', { size: 23, bold: true, color: UI.C.txt });
        UI.label(x + 96, cy2 + 60, '任选1件未拥有SSR · 终身限' + D.dust.ssrCap + '次 剩' + ssrLeft, { size: 18, color: UI.C.dim, maxW: w - 340 });
        if (UI.button(x + w - 232, cy2 + 16, 200, 58, '✨' + D.dust.ssrTicket, { fontSize: 22, disabled: ssrLeft <= 0 || s.dust < D.dust.ssrTicket })) {
          dustPick = {
            title: 'SSR 自选券', glyph: '👑', cost: D.dust.ssrTicket,
            sub: '使用后从未拥有的SSR中获得1件',
            go: function () { s.dust -= D.dust.ssrTicket; s.ssrTicket = (s.ssrTicket || 0) + 1; s.dustSsrN = (s.dustSsrN || 0) + 1; DG.SAVE.save(); DG.FX.banner('✨ SSR自选券 ×1', { color: UI.C.gold, size: 44, pri: true }); }
          };
        }
        cy2 += 96;
        // 钻头淬火行：图标+进度条左，按钮右
        var lv = s.drillLv || 0, dp = D.dust.drill;
        UI.glyph(ctx, '⛏', x + 58, cy2 + 44, 44);
        UI.label(x + 96, cy2 + 30, '钻头淬火  Lv.' + lv + '/' + dp.length, { size: 23, bold: true, color: UI.C.txt });
        UI.bar(x + 96, cy2 + 50, w - 350, 16, lv / dp.length, UI.C.green, '耐久上限 +' + lv * 2);
        if (UI.button(x + w - 232, cy2 + 16, 200, 58, lv >= dp.length ? 'MAX' : '✨' + dp[lv], { fontSize: 22, disabled: lv >= dp.length || s.dust < dp[lv] })) {
          s.dust -= dp[lv]; s.drillLv = lv + 1; D.calcBonuses(); DG.SAVE.save();
          DG.A.sfx('buy', { vibrate: true });
          DG.FX.banner('⛏ 钻头淬火 Lv.' + s.drillLv, { color: UI.C.green, size: 42 });
        }
      });
      UI.label(P.W / 2, y + h - 78, 'SSR藏品无法定向兑换，仅限盲盒开出', { size: 19, align: 'center', color: UI.C.dim });
      if (UI.button(P.W / 2 - 120, y + h - 62, 240, 54, '关闭', { color: UI.C.panel2, fontSize: 25 })) dustOpen = false;
    },

    /* ================= 图鉴（矿物Tab） ================= */
    codex: function (ctx, top) {
      var s = DG.SAVE.d, D = DG.D;
      var found = 0;
      for (var k in s.codex) found++;
      var lv = Math.floor(found / 10);
      UI.label(P.W / 2, top + 20, '📖 已发现 ' + found + '/' + D.codex.length + ' · 图鉴等级 ' + lv + ' (金币+' + lv * 2 + '%)', { size: 24, align: 'center', color: UI.C.dim });
      /* 翻页书：矿物页 + 化石页，左右翻页（上下滑动会让很多人错过下半部分） */
      var listTop = top + 44;
      var viewH = P.H - listTop - 14;
      var minPer = 20, foPer = 4, pzPer = 4;
      var minPages = Math.ceil(D.codex.length / minPer);
      var foPages = Math.ceil(D.fossilList.length / foPer);
      var pzPages = Math.ceil(D.puzzles.length / pzPer);
      var totalPages = minPages + foPages + pzPages;
      if (codexPage < 0) codexPage = 0;
      if (codexPage >= totalPages) codexPage = totalPages - 1;
      var bookH = Math.min(viewH, 1030);
      UI.img9('bs_book', 10, listTop, P.W - 20, bookH, 26, 42, true);
      var isMin = codexPage < minPages;
      var isFo = !isMin && codexPage < minPages + foPages;
      // 标题放左页、加成信息放右页：中缝装饰不再压字
      UI.label(190, listTop + 44, isMin ? '⛏️ 矿物图鉴' : isFo ? '🦴 化石收藏' : '🧩 拼图画廊', { size: 28, bold: true, align: 'center', color: '#6b4a20', maxW: 330 });
      if (isMin) {
        UI.label(560, listTop + 38, '每发现10条 → 全局金币+2%', { size: 18, align: 'center', color: '#8a6c44', maxW: 330 });
        UI.label(560, listTop + 62, '首次发现给星钻', { size: 18, align: 'center', color: '#8a6c44', maxW: 330 });
      } else if (isFo) {
        var cnt = { green: 0, purple: 0, orange: 0 }, tot = { green: 0, purple: 0, orange: 0 };
        for (var f0 = 0; f0 < D.fossilList.length; f0++) { tot[D.fossilList[f0].tier]++; if (s.fossils[D.fossilList[f0].id]) cnt[D.fossilList[f0].tier]++; }
        UI.label(560, listTop + 38, '绿' + cnt.green + '/' + tot.green + '(金币+3%) 紫' + cnt.purple + '/' + tot.purple + '(耐久+10)', { size: 18, align: 'center', color: '#7a5c34', maxW: 330 });
        UI.label(560, listTop + 62, '橙' + cnt.orange + '/' + tot.orange + '(深度结算+5%)', { size: 18, align: 'center', color: '#7a5c34', maxW: 330 });
      } else {
        UI.label(560, listTop + 38, '已完成 ' + s.puzzleDone + ' / ' + D.puzzles.length + ' 幅', { size: 18, align: 'center', color: '#8a6c44', maxW: 330 });
        UI.label(560, listTop + 62, '每完成一幅 → 永久金币+1%', { size: 18, align: 'center', color: '#8a6c44', maxW: 330 });
      }
      var cy0 = listTop + 92;
      if (isMin) {
        var cellW = 136, cellH = 128, rowH = 148;
        var colX = [52, 202, 412, 562];
        var start = codexPage * minPer;
        for (var i = start; i < Math.min(D.codex.length, start + minPer); i++) {
          var e = D.codex[i];
          var li = i - start;
          var x = colX[li % 4], y = cy0 + Math.floor(li / 4) * rowH;
          var got = s.codex[e.id];
          if (got) { // 已发现：深色石板亮字
            if (!UI.img9('bs_button', x, y, cellW, cellH, 13, 16, true, 1)) {
              UI.panel(x, y, cellW, cellH, { color: 'rgba(30,34,48,0.92)', r: 12 });
            }
            UI.glyph(ctx, e.glyph, x + cellW / 2, y + 38, 42);
            UI.label(x + cellW / 2, y + 82, e.name, { size: 20, align: 'center', color: '#dfe6f2', maxW: cellW - 14 });
            UI.label(x + cellW / 2, y + 108, '💎' + e.gem, { size: 18, align: 'center', color: UI.C.gold });
          } else { // 未发现：羊皮纸内凹格+虚线框（配书页，不再糊深色）
            ctx.fillStyle = 'rgba(105,82,52,0.15)';
            U.rr(ctx, x, y, cellW, cellH, 12); ctx.fill();
            ctx.save();
            ctx.setLineDash([7, 6]);
            ctx.strokeStyle = 'rgba(96,72,44,0.6)'; ctx.lineWidth = 2.5;
            U.rr(ctx, x + 2, y + 2, cellW - 4, cellH - 4, 12); ctx.stroke();
            ctx.restore();
            ctx.font = '38px Xiaolai, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(110,84,50,0.7)';
            ctx.fillText('?', x + cellW / 2, y + 40);
            UI.label(x + cellW / 2, y + 82, '???', { size: 20, align: 'center', color: '#8a6c44' });
            UI.label(x + cellW / 2, y + 108, '💎' + e.gem, { size: 18, align: 'center', color: '#9a7c50' });
          }
        }
      } else if (isFo) {
        // ---- 化石收藏页（每页4张大卡 2×2）----
        var cardW = 296, cardH = 372;
        var fstart = (codexPage - minPages) * foPer;
        for (var fi = fstart; fi < Math.min(D.fossilList.length, fstart + foPer); fi++) {
          var fo = D.fossilList[fi];
          var ftr = D.fossilTiers[fo.tier];
          var li2 = fi - fstart;
          var fx = (li2 % 2) ? 402 : 48;
          var fy = cy0 + Math.floor(li2 / 2) * (cardH + 16);
          var own = s.fossils[fo.id] || 0;
          if (own) { // 已拥有：深色石板 + 品质色实线框
            if (!UI.img9('bs_button', fx, fy, cardW, cardH, 13, 16, true, 1)) {
              UI.panel(fx, fy, cardW, cardH, { color: 'rgba(30,34,48,0.9)', r: 12 });
            }
            var img = DG.A.images[fo.id];
            if (img) ctx.drawImage(img, fx + 12, fy + 12, cardW - 24, cardW - 24);
            ctx.strokeStyle = ftr.color; ctx.lineWidth = 4;
            U.rr(ctx, fx + 2, fy + 2, cardW - 4, cardH - 4, 12); ctx.stroke();
            UI.label(fx + 14, fy + cardW + 16, fo.name, { size: 22, bold: true, color: ftr.color, maxW: cardW - 80 });
            UI.label(fx + cardW - 14, fy + cardW + 16, '×' + own, { size: 20, align: 'right', color: '#dfe6f2' });
            UI.label(fx + 14, fy + cardW + 46, ftr.name, { size: 18, color: '#9aa4b8' });
          } else { // 未拥有：羊皮纸空位 + 虚线框 + 幽灵预览
            ctx.fillStyle = 'rgba(105,82,52,0.15)';
            U.rr(ctx, fx, fy, cardW, cardH, 12); ctx.fill();
            var img2 = DG.A.images[fo.id];
            if (img2) {
              ctx.globalAlpha = 0.12;
              ctx.drawImage(img2, fx + 12, fy + 12, cardW - 24, cardW - 24);
              ctx.globalAlpha = 1;
            }
            ctx.save();
            ctx.setLineDash([8, 7]);
            ctx.strokeStyle = 'rgba(96,72,44,0.6)'; ctx.lineWidth = 3;
            U.rr(ctx, fx + 2, fy + 2, cardW - 4, cardH - 4, 12); ctx.stroke();
            ctx.restore();
            ctx.font = '72px Xiaolai, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(110,84,50,0.6)';
            ctx.fillText('?', fx + cardW / 2, fy + cardW / 2 - 6);
            UI.label(fx + 14, fy + cardW + 16, '？？？', { size: 22, bold: true, color: '#8a6c44' });
            UI.label(fx + cardW - 14, fy + cardW + 16, ftr.name, { size: 20, align: 'right', color: ftr.color });
            UI.label(fx + 14, fy + cardW + 46, fo.tier === 'orange' ? '100m+深处出土' : fo.tier === 'purple' ? '40m+出土' : '挖到化石块出土', { size: 18, color: '#8a6c44' });
          }
        }
      } else {
        // ---- 拼图画廊页（每页4幅 2×2）----
        var pcW = 296, pcH = 372;
        var pstart = (codexPage - minPages - foPages) * pzPer;
        for (var pi = pstart; pi < Math.min(D.puzzles.length, pstart + pzPer); pi++) {
          var pz2 = D.puzzles[pi];
          var pli = pi - pstart;
          var px2 = (pli % 2) ? 402 : 48;
          var py2 = cy0 + Math.floor(pli / 2) * (pcH + 16);
          var pimg2 = DG.A.images['puzzle_' + pz2.id];
          var doneP = pi < s.puzzleDone;
          var curP = pi === s.puzzleDone;
          if (doneP) { // 已完成：整图+金框
            if (pimg2) ctx.drawImage(pimg2, px2 + 8, py2 + 8, pcW - 16, pcW - 16);
            ctx.strokeStyle = '#d8a032'; ctx.lineWidth = 4;
            U.rr(ctx, px2 + 2, py2 + 2, pcW - 4, pcH - 4, 12); ctx.stroke();
            UI.label(px2 + 14, py2 + pcW + 16, pz2.name, { size: 22, bold: true, color: '#6b4a20', maxW: pcW - 90 });
            UI.label(px2 + pcW - 14, py2 + pcW + 16, '✅', { size: 24, align: 'right' });
            UI.label(px2 + 14, py2 + pcW + 46, pz2.rtxt, { size: 17, color: '#8a6c44', maxW: pcW - 28 });
          } else { // 进行中/未开始：幽灵图+虚线
            ctx.fillStyle = 'rgba(105,82,52,0.15)';
            U.rr(ctx, px2, py2, pcW, pcH, 12); ctx.fill();
            if (pimg2) {
              ctx.globalAlpha = curP ? 0.25 : 0.08;
              ctx.drawImage(pimg2, px2 + 8, py2 + 8, pcW - 16, pcW - 16);
              ctx.globalAlpha = 1;
            }
            ctx.save();
            ctx.setLineDash([8, 7]);
            ctx.strokeStyle = 'rgba(96,72,44,0.6)'; ctx.lineWidth = 3;
            U.rr(ctx, px2 + 2, py2 + 2, pcW - 4, pcH - 4, 12); ctx.stroke();
            ctx.restore();
            UI.label(px2 + 14, py2 + pcW + 16, curP ? pz2.name : '？？？', { size: 22, bold: true, color: '#8a6c44', maxW: pcW - 110 });
            UI.label(px2 + pcW - 14, py2 + pcW + 16, curP ? (s.pieceInCur + '/9') : '未解锁', { size: 20, align: 'right', color: curP ? '#6b8f3a' : '#9a7c50' });
            UI.label(px2 + 14, py2 + pcW + 46, curP ? '拼图页镶嵌碎片继续' : '完成上一幅后开启', { size: 17, color: '#9a7c50', maxW: pcW - 28 });
          }
        }
      }
      // ---- 翻页控件（页码带羊皮纸底衬，避开中缝深色装饰）----
      var pgY = listTop + bookH - 66;
      if (UI.button(30, pgY, 116, 54, '‹ 上页', { color: '#3a4356', fontSize: 22, disabled: codexPage <= 0 })) codexPage--;
      ctx.fillStyle = 'rgba(236,221,188,0.96)';
      U.rr(ctx, P.W / 2 - 88, pgY + 7, 176, 40, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(96,72,44,0.5)'; ctx.lineWidth = 2;
      U.rr(ctx, P.W / 2 - 88, pgY + 7, 176, 40, 10); ctx.stroke();
      UI.label(P.W / 2, pgY + 27, '第 ' + (codexPage + 1) + ' / ' + totalPages + ' 页', { size: 22, bold: true, align: 'center', color: '#4a3416' });
      if (UI.button(P.W - 146, pgY, 116, 54, '下页 ›', { color: '#3a4356', fontSize: 22, disabled: codexPage >= totalPages - 1 })) codexPage++;
    },

    /* ================= 转盘 ================= */
    wheel: function (ctx, top, dt) {
      var s = DG.SAVE.d, D = DG.D;
      var rad = 250;
      // 整组内容(轮盘+按钮区约 2*rad+260)在可用高度内垂直居中
      var groupH = rad * 2 + 260;
      var startY = top + Math.max(10, (P.H - top - groupH - 30) / 2);
      var cx = P.W / 2, cy = startY + rad + 30;
      // 旋转动画
      if (wheel.spinning) {
        wheel.t += dt;
        var k = U.easeOutCubic(Math.min(1, wheel.t / wheel.dur));
        wheel.ang = wheel.from + (wheel.to - wheel.from) * k;
        if (wheel.t >= wheel.dur) {
          wheel.spinning = false;
          var seg = D.wheel[wheel.targetIdx];
          wheel.result = seg;
          DG.A.sfx('wheel_win', { vibrate: true, strong: true });
          DG.FX.banner('🎉 ' + seg.txt + '!', { color: '#ffd76a', size: 52 });
        }
      }
      // 画轮盘：空盘面旋转 + 奖品图标位置随转但朝向永远正向
      var wBlank = DG.A.images.wheel_blank;
      var wImg = DG.A.images.wheel_face;
      var segN = D.wheel.length, segA = Math.PI * 2 / segN;
      if (wBlank) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wheel.ang);
        ctx.drawImage(wBlank, -rad - 8, -rad - 8, (rad + 8) * 2, (rad + 8) * 2);
        ctx.restore();
        for (var wi = 0; wi < segN; wi++) {
          var wa = wheel.ang - Math.PI / 2 + (wi + 0.5) * segA;
          var wx = cx + Math.cos(wa) * rad * 0.66, wy = cy + Math.sin(wa) * rad * 0.66;
          var icon = DG.A.images[D.wheel[wi].img];
          var isz = 84;
          if (icon) ctx.drawImage(icon, wx - isz / 2, wy - isz / 2, isz, isz * icon.height / icon.width);
          else UI.glyph(ctx, D.wheel[wi].glyph, wx, wy, 52);
        }
      } else if (wImg) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wheel.ang);
        ctx.drawImage(wImg, -rad - 8, -rad - 8, (rad + 8) * 2, (rad + 8) * 2);
        ctx.restore();
      } else {
        for (var i = 0; i < segN; i++) {
          var a0 = wheel.ang + i * segA - Math.PI / 2;
          ctx.fillStyle = i % 2 ? '#2a3245' : '#37415a';
          if (i === 7) ctx.fillStyle = '#8f6a1e';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, rad, a0, a0 + segA);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#151a23'; ctx.lineWidth = 3; ctx.stroke();
          var mid = a0 + segA / 2;
          ctx.save();
          ctx.translate(cx + Math.cos(mid) * rad * 0.62, cy + Math.sin(mid) * rad * 0.62);
          ctx.rotate(mid + Math.PI / 2);
          ctx.font = '36px Xiaolai, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(D.wheel[i].glyph, 0, -14);
          ctx.font = 'bold 17px Xiaolai, sans-serif'; ctx.fillStyle = '#dfe6f2';
          ctx.fillText(D.wheel[i].txt, 0, 20);
          ctx.restore();
        }
      }
      // 指针
      ctx.fillStyle = '#ffb02e';
      ctx.beginPath();
      ctx.moveTo(cx, cy - rad + 14);
      ctx.lineTo(cx - 20, cy - rad - 26);
      ctx.lineTo(cx + 20, cy - rad - 26);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      if (!wImg) {
        ctx.fillStyle = '#1a202c';
        ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
        ctx.font = '34px Xiaolai, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🎡', cx, cy + 2);
      }

      var byy = cy + rad + 40;
      function spin() {
        if (wheel.spinning) return;
        wheel.targetIdx = D.wheel.indexOf(U.wpick(D.wheel));
        // 奖励在起转瞬间就发放并存档（动画只是演出，中途退出不丢奖励）
        DG.Run.grantGive(D.wheel[wheel.targetIdx].give);
        DG.SAVE.save();
        wheel.spinning = true; wheel.result = null;
        wheel.t = 0; wheel.dur = 3.2;
        wheel.from = wheel.ang % (Math.PI * 2);
        var segA2 = Math.PI * 2 / D.wheel.length;
        // 目标扇区中心停在指针(顶部)下
        wheel.to = Math.PI * 2 * 5 - (wheel.targetIdx * segA2 + segA2 / 2) + (Math.random() - 0.5) * segA2 * 0.5;
        DG.A.sfx('wheel_spin');
      }
      var free = !s.daily.wheelFree;
      if (UI.button(40, byy, (P.W - 100) / 2, 70, free ? '🆓 免费转 (每日1次)' : '明日再来', { fontSize: 24, disabled: !free || wheel.spinning })) { s.daily.wheelFree = true; DG.SAVE.save(); spin(); }
      if (UI.button(60 + (P.W - 100) / 2, byy, (P.W - 100) / 2, 70, '🎫 用券转 (' + s.ticket + ')', { fontSize: 24, disabled: s.ticket < 1 || wheel.spinning })) { s.ticket--; DG.SAVE.save(); spin(); }
      var canBuy = !s.daily.ticketBought;
      if (UI.button(40, byy + 84, (P.W - 100) / 2, 56, canBuy ? '🪙' + D.ticketCoinCost + ' 购券(日1)' : '今日已购', { color: '#3a4356', txtColor: '#fff', fontSize: 22, disabled: !canBuy || s.coin < D.ticketCoinCost })) {
        s.coin -= D.ticketCoinCost; s.ticket++; s.daily.ticketBought = true; DG.SAVE.save(); DG.A.sfx('buy');
      }
      if (UI.button(60 + (P.W - 100) / 2, byy + 84, (P.W - 100) / 2, 56, '💎' + D.iap.wheelGem + ' 直接转', { color: '#5a4a8f', txtColor: '#fff', fontSize: 22, disabled: wheel.spinning })) {
        if (s.gem >= D.iap.wheelGem) { s.gem -= D.iap.wheelGem; D.track('wheel_gem'); DG.SAVE.save(); spin(); }
        else DG.PAY.show('wheel', D.iap.wheelGem - s.gem); // 钻石不足→直接开收银台
      }
      UI.label(P.W / 2, byy + 170, '额外获取：当日累计挖600m+1券 · 大奖5%概率', { size: 20, align: 'center', color: UI.C.dim });
    },

    /* ================= 拼图 ================= */
    puzzle: function (ctx, top) {
      var s = DG.SAVE.d, D = DG.D;
      // 完成整图展示：玩家点掉才进入下一幅
      if (puzzleShow) {
        UI.dim(0.9);
        var fimg = DG.A.images['puzzle_' + puzzleShow.id];
        var sz = P.W - 110, fx2 = 55, fy2 = Math.max(P.safeTop + 150, P.H / 2 - sz / 2 - 70);
        UI.label(P.W / 2, fy2 - 66, '🎉 拼 图 完 成 !', { size: 46, bold: true, align: 'center', color: '#ffd76a' });
        if (fimg) {
          ctx.drawImage(fimg, fx2, fy2, sz, sz);
          ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 6;
          U.rr(ctx, fx2 - 3, fy2 - 3, sz + 6, sz + 6, 10); ctx.stroke();
        } else {
          UI.panel(fx2, fy2, sz, sz);
        }
        UI.label(P.W / 2, fy2 + sz + 48, '【' + puzzleShow.name + '】', { size: 34, bold: true, align: 'center', color: '#fff' });
        UI.label(P.W / 2, fy2 + sz + 90, '🎁 ' + puzzleShow.rtxt + ' · 永久金币+1%', { size: 24, align: 'center', color: '#8fd0ff', maxW: P.W - 80 });
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 250);
        UI.label(P.W / 2, fy2 + sz + 136, '👆 点击任意处收下', { size: 24, align: 'center', color: '#ffd76a' });
        ctx.globalAlpha = 1;
        if (UI.tap) { UI.tap = null; puzzleShow = null; }
        return;
      }
      if (s.puzzleDone >= D.puzzles.length) {
        // 库存里剩的碎片一次性折算成金币（之后所有碎片产出在入账时就直接转金币）
        if (s.piece > 0) {
          var pc = s.piece * DG.Run.puzzlePieceCoin;
          s.coin += pc; s.piece = 0;
          DG.SAVE.save();
          DG.FX.banner('🧩 剩余碎片折算 🪙' + U.fmt(pc), { color: UI.C.gold, size: 44, pri: true });
        }
        UI.label(P.W / 2, top + 100, '🎉 全部拼图已完成!', { size: 40, bold: true, align: 'center', color: UI.C.gold });
        UI.label(P.W / 2, top + 150, '之后获得的拼图碎片将自动折算为金币 (🪙' + DG.Run.puzzlePieceCoin + '/片)', { size: 21, align: 'center', color: UI.C.dim, maxW: P.W - 80 });
        return;
      }
      var pz = D.puzzles[s.puzzleDone];
      UI.label(P.W / 2, top + 24, '第' + (s.puzzleDone + 1) + '幅 【' + pz.name + '】 ' + s.pieceInCur + '/9', { size: 30, bold: true, align: 'center', color: '#fff' });
      UI.label(P.W / 2, top + 62, '完成奖励: ' + pz.rtxt + ' · 每幅+1%永久金币', { size: 22, align: 'center', color: UI.C.dim });
      var cell = 150, gx = P.W / 2 - cell * 1.5, gy = top + 96;
      var pimg = DG.A.images['puzzle_' + pz.id]; // 有整图则自动切九块锯齿拼块；缺图回退emoji槽位
      if (pimg) {
        var gw = cell * 3;
        UI.panel(gx - 6, gy - 6, gw + 12, gw + 12, { color: 'rgba(12,15,22,0.82)', r: 10 });
        ctx.globalAlpha = 0.12; // 幽灵预览：让玩家看见完成后的样子
        ctx.drawImage(pimg, gx, gy, gw, gw);
        ctx.globalAlpha = 1;
        for (var i = 0; i < 9; i++) {
          var r0 = Math.floor(i / 3), c0 = i % 3;
          var x = gx + c0 * cell, y = gy + r0 * cell;
          var tb = jigTabs(r0, c0);
          if (i < s.pieceInCur) { // 已镶嵌：锯齿裁剪出咬合块，凸耳自动带邻块画面
            ctx.save();
            jigPath(ctx, x, y, cell, cell, tb);
            ctx.clip();
            ctx.drawImage(pimg, gx, gy, gw, gw);
            ctx.restore();
            jigPath(ctx, x, y, cell, cell, tb);
            ctx.strokeStyle = 'rgba(255,215,106,0.55)'; ctx.lineWidth = 2.5;
            ctx.stroke();
          } else {
            jigPath(ctx, x, y, cell, cell, tb);
            ctx.strokeStyle = 'rgba(220,225,240,0.18)'; ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.font = '40px Xiaolai, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(220,225,240,0.35)';
            ctx.fillText('❓', x + cell / 2, y + cell / 2);
          }
        }
      } else {
        for (var i = 0; i < 9; i++) {
          var x = gx + (i % 3) * cell, y = gy + Math.floor(i / 3) * cell;
          var got = i < s.pieceInCur;
          UI.slot(x + 4, y + 4, cell - 8, cell - 8, got ? 1 : 0.45);
          if (got) { ctx.strokeStyle = '#4aa3ff'; ctx.lineWidth = 3; U.rr(ctx, x + 6, y + 6, cell - 12, cell - 12, 8); ctx.stroke(); }
          ctx.globalAlpha = got ? 1 : 0.15;
          UI.glyph(ctx, pz.pic[i], x + cell / 2, y + cell / 2, 64);
          ctx.globalAlpha = 1;
        }
      }
      var byy = gy + cell * 3 + 30;
      UI.label(P.W / 2, byy, '🧩 碎片: ' + s.piece + '  (来源: 局内宝箱/密室事件/转盘)', { size: 24, align: 'center', color: UI.C.gold });
      // 差最后一片的煎熬时刻：广告轨(每幅限1次)为主 + 星钻第二轨
      var lastGap = s.pieceInCur === 8 && s.piece < 1;
      var adAvail = lastGap && !s.pieceAdUsed[s.puzzleDone];
      if (lastGap) {
        var bl3 = 0.75 + 0.25 * Math.sin(Date.now() / 200);
        ctx.globalAlpha = bl3;
        if (adAvail) {
          if (UI.button(P.W / 2 - 220, byy + 108, 440, 52, '📺 矿洞里似乎还有一片…看广告寻回', { fontSize: 22, sub: '每幅限1次(模拟)' })) {
            ctx.globalAlpha = 1;
            (function (idx) { D.adStub('puzzle_piece', function () { s.pieceAdUsed[idx] = 1; s.piece++; DG.SAVE.save(); }); })(s.puzzleDone);
          }
        }
        if (UI.button(P.W / 2 - 160, byy + (adAvail ? 168 : 108), 320, 48, '💎' + D.iap.puzzleLast + ' 直接补上!', { fontSize: 22, sub: '就差这一片了…' })) {
          ctx.globalAlpha = 1;
          if (s.gem >= D.iap.puzzleLast) { s.gem -= D.iap.puzzleLast; s.piece++; D.track('puzzle_gem'); DG.SAVE.save(); DG.A.sfx('buy', { vibrate: true }); }
          else DG.PAY.show('puzzle', D.iap.puzzleLast - s.gem);
        }
        ctx.globalAlpha = 1;
      }
      if (UI.button(P.W / 2 - 180, byy + 30, 360, 72, '镶嵌一片 🧩', { fontSize: 30, disabled: s.piece < 1 })) {
        s.piece--; s.pieceInCur++;
        DG.A.sfx('puzzle_place', { vibrate: true });
        if (s.pieceInCur >= 9) {
          DG.Run.grantGive(pz.reward);
          puzzleShow = { id: pz.id, name: pz.name, rtxt: pz.rtxt }; // 整图展示悬浮，点掉才进下一幅
          s.puzzleDone++; s.pieceInCur = 0;
          DG.A.sfx('puzzle_done', { vibrate: true, strong: true });
          DG.D.calcBonuses();
        }
        DG.SAVE.save();
      }
      // 已完成列表
      var ly = byy + (lastGap ? (adAvail ? 232 : 172) : 120);
      for (var d = 0; d < s.puzzleDone; d++) UI.label(P.W / 2, ly + d * 34, '✅ ' + D.puzzles[d].name, { size: 22, align: 'center', color: '#4cd471' });
    },

    /* ================= 皮肤 ================= */
    skin: function (ctx, top) {
      var s = DG.SAVE.d, D = DG.D;
      UI.label(P.W / 2, top + 20, '强化装备(外观+加成) · 同时装备1件 · 集4件一次性+100💎', { size: 22, align: 'center', color: UI.C.dim });
      // 集4奖励
      if (s.skins.length >= 4 && !s.skinSetRewarded) {
        s.skinSetRewarded = 1; s.gem += 100;
        DG.FX.banner('💪 集齐4件强化 +100💎', { color: '#ffd76a', size: 42 });
        DG.SAVE.save();
      }
      var cw = (P.W - 60) / 2, chh = 160;
      var listTop = top + 50;
      UI.scroll('skin', 20, listTop, P.W - 40, P.H - listTop - 20, Math.ceil(D.skins.length / 2) * (chh + 14), function () {
        for (var i = 0; i < D.skins.length; i++) {
          var sk = D.skins[i];
          var x = 25 + (i % 2) * (cw + 10), y = listTop + Math.floor(i / 2) * (chh + 14);
          var owned = s.skins.indexOf(sk.id) >= 0;
          var equipped = s.skin === sk.id;
          UI.panel(x, y, cw, chh, { color: owned ? 'rgba(33,40,55,0.88)' : 'rgba(14,18,26,0.55)', borderColor: equipped ? '#ffb02e' : UI.C.line });
          var skImg = DG.A.images['sk_' + sk.id];
          ctx.globalAlpha = owned ? 1 : 0.4;
          if (skImg) {
            var ih = 92, iw = ih * skImg.width / skImg.height;
            if (iw > 100) { iw = 100; ih = iw * skImg.height / skImg.width; }
            ctx.drawImage(skImg, x + 56 - iw / 2, y + 58 - ih / 2, iw, ih);
          } else UI.glyph(ctx, sk.glyph, x + 52, y + 56, 58);
          ctx.globalAlpha = 1;
          UI.label(x + 100, y + 38, sk.name, { size: 26, bold: true, color: owned ? '#fff' : '#8a92a8' });
          UI.label(x + 100, y + 72, sk.statName || '无加成', { size: 20, color: '#8fd0ff' });
          if (equipped) UI.label(x + cw / 2, y + 126, '✅ 已装备', { size: 22, align: 'center', color: '#4cd471' });
          else if (owned) {
            if (UI.button(x + cw / 2 - 70, y + 104, 140, 44, '装备', { fontSize: 22 })) { s.skin = sk.id; DG.D.calcBonuses(); DG.SAVE.save(); }
          }
          else if (sk.cost) {
            if (UI.button(x + cw / 2 - 90, y + 104, 180, 44, '💎' + sk.cost, { fontSize: 22, disabled: s.gem < sk.cost })) {
              s.gem -= sk.cost; s.skins.push(sk.id); DG.SAVE.save(); DG.A.sfx('buy', { vibrate: true });
            }
          }
          else UI.label(x + cw / 2, y + 126, '🔒 ' + sk.how, { size: 18, align: 'center', color: UI.C.dim, maxW: cw - 16 });
        }
      });
    }
  });
})();
