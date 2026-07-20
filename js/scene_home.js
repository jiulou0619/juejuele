/* scene_home.js — 主界面：开始挖掘、每日目标/签到、六大系统入口 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U, UI = DG.UI, P = DG.P;

  function ensureDaily() {
    var s = DG.SAVE.d;
    DG.SAVE.dailyReset();
    if (!s.daily.goals) {
      var rng = U.seededRng(s.daily.key);
      var pool = DG.D.dailyGoalPool.slice();
      var goals = [];
      while (goals.length < 3 && pool.length) {
        var i = Math.floor(rng() * pool.length);
        goals.push(pool[i].id);
        pool.splice(i, 1);
      }
      // 矿情联动：3条目标必含1条与今日矿情对应（增益让它"今天特别顺手"）
      var dm = DG.D.todayMod();
      if (dm.goal && goals.indexOf(dm.goal) < 0) goals[2] = dm.goal;
      s.daily.goals = goals;
      DG.SAVE.save();
    }
    // 当日累挖600m→转盘券
    if (s.daily.stats.m >= 600 && !s.daily.wheelDigUsed) {
      s.daily.wheelDigUsed = true;
      s.ticket++;
      DG.FX.banner('🎫 今日挖满600m 转盘券+1', { color: '#8fd0ff', size: 40 });
      DG.SAVE.save();
    }
  }

  function unlocked(id) { return DG.D.unlocks[id](DG.SAVE.d); }
  var resetArm = 0;    // 重置按钮二次确认计时
  var setOpen = false; // 声音设置弹层

  /* 可拖动音量滑条：返回新值(0~1)或null */
  function volSlider(ctx, x, y, w, val) {
    var UI = DG.UI, U = DG.U;
    // 轨道
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    U.rr(ctx, x, y - 9, w, 18, 9); ctx.fill();
    ctx.fillStyle = '#4aa3ff';
    if (val > 0) { U.rr(ctx, x, y - 9, Math.max(18, w * val), 18, 9); ctx.fill(); }
    // 圆钮
    var kx = x + w * val;
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath(); ctx.arc(kx, y, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(30,32,14,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(kx, y, 17, 0, Math.PI * 2); ctx.stroke();
    // 拖动（判定区上下放宽）
    var pt = UI.pointer;
    if (pt.down && U.inRect(pt.downX, pt.downY, x - 30, y - 44, w + 60, 88)) {
      var v = (pt.x - x) / w;
      if (v < 0) v = 0; if (v > 1) v = 1;
      return Math.round(v * 20) / 20;
    }
    return null;
  }

  DG.Main.scene('home', {
    enter: function () {
      setOpen = false;
      ensureDaily();
      DG.D.calcBonuses();
      var s = DG.SAVE.d;
      // 隔夜矿车：昨天挖得越深，今天开门红越大（赴约机制；月卡×2）
      if (s.yesterM > 0 && !s.daily.cart) {
        s.daily.cart = true;
        var mOn = DG.D.monthlyActive(s);
        var cart = Math.min(800, Math.round(s.yesterM)) * (mOn ? 2 : 1);
        s.coin += cart;
        DG.FX.banner('🚚 隔夜矿车运回 🪙' + cart + '!' + (mOn ? ' (月卡×2)' : ' (昨日' + s.yesterM + 'm)'), { color: '#ffd76a', size: 40, life: 2.5 });
        DG.SAVE.save();
      }
      // 月卡每日星钻
      if (DG.D.monthlyActive(s) && s.monthlyClaimed !== U.todayKey()) {
        s.monthlyClaimed = U.todayKey();
        s.gem += DG.D.iap.monthly.gemDaily;
        DG.FX.banner('⛏️ 月卡每日 💎+' + DG.D.iap.monthly.gemDaily, { color: '#8fd0ff', size: 42, life: 2 });
        DG.SAVE.save();
      }
      // 新解锁提示
      var names = { shop: '🛒 商店', daily: '📅 每日目标', box: '🎁 盲盒藏品', codex: '📖 图鉴', wheel: '🎡 幸运转盘', puzzle: '🧩 拼图', skin: '💪 强化' };
      for (var k in DG.D.unlocks) {
        if (unlocked(k) && !s.seenUnlock[k]) {
          s.seenUnlock[k] = 1;
          DG.FX.banner('🔓 解锁 ' + names[k] + '!', { color: '#ffd76a', size: 46, life: 1.6 });
          DG.SAVE.save();
        }
      }
    },

    frame: function (dt, ctx) {
      var s = DG.SAVE.d;
      // 泥土背景暗化铺底
      var bg = DG.A.images.bg_topsoil;
      if (bg) {
        ctx.drawImage(bg, -4, -4, P.W + 8, P.H + 8);
        // 背景压暗+去饱和：暖木UI才浮得出来（休闲游戏惯用的"暗世界·亮界面"关系）
        ctx.fillStyle = 'rgba(42,38,37,0.72)';
        ctx.fillRect(-4, -4, P.W + 8, P.H + 8);
      }
      // 声音设置弹层（模态：先画先吃输入，直接return）
      if (setOpen) {
        if (!s.opt) s.opt = { bgm: 1, sfx: 1, bgmVol: 0.3, sfxVol: 0.3 };
        if (s.opt.bgmVol == null) s.opt.bgmVol = 0.3;
        if (s.opt.sfxVol == null) s.opt.sfxVol = 0.3;
        UI.dim(0.75);
        var sw = P.W - 120, sx = 60, sh = 420, sy2 = Math.floor((P.H - sh) / 2) - 40;
        UI.panel(sx, sy2, sw, sh);
        UI.label(P.W / 2, sy2 + 56, '声 音 设 置', { size: 34, bold: true, align: 'center', color: '#ffd76a' });
        // 音乐
        DG.A.draw(ctx, s.opt.bgmVol > 0 ? 'ic_music' : 'ic_music_off', sx + 36, sy2 + 108, 44, 44);
        UI.label(sx + 96, sy2 + 130, '音乐', { size: 26, bold: true, color: '#fff' });
        UI.label(sx + sw - 40, sy2 + 130, Math.round(s.opt.bgmVol * 100) + '%', { size: 24, bold: true, align: 'right', color: '#8fd0ff' });
        var nv = volSlider(ctx, sx + 40, sy2 + 186, sw - 80, s.opt.bgmVol);
        if (nv != null && nv !== s.opt.bgmVol) { s.opt.bgmVol = nv; s.opt.bgm = nv > 0 ? 1 : 0; DG.A.applyBgmVol(); }
        // 音效
        DG.A.draw(ctx, 'pr_snd_on', sx + 36, sy2 + 232, 44, 44);
        UI.label(sx + 96, sy2 + 254, '音效', { size: 26, bold: true, color: '#fff' });
        UI.label(sx + sw - 40, sy2 + 254, Math.round(s.opt.sfxVol * 100) + '%', { size: 24, bold: true, align: 'right', color: '#8fd0ff' });
        var nv2 = volSlider(ctx, sx + 40, sy2 + 310, sw - 80, s.opt.sfxVol);
        if (nv2 != null && nv2 !== s.opt.sfxVol) { s.opt.sfxVol = nv2; s.opt.sfx = nv2 > 0 ? 1 : 0; }
        if (UI.justUp) { DG.SAVE.save(); DG.A.sfx('ui_tap'); } // 松手时存档+试听音效
        if (UI.button(P.W / 2 - 110, sy2 + sh - 76, 220, 56, '关闭', { color: '#3a4356', fontSize: 26 })) setOpen = false;
        return;
      }
      var by = UI.currencyBar([
        { icon: 'ui_coin', txt: U.fmt(s.coin) },
        { icon: 'ui_gem', txt: U.fmt(s.gem) },
        { icon: 'ui_key', txt: '' + s.boxkey },
        { icon: 'ui_ticket', txt: '' + s.ticket }
      ]);
      DG.PAY.gemHotspot(20);
      // 声音设置入口（右上角，点开滑条调音量）
      if (!s.opt) s.opt = { bgm: 1, sfx: 1, bgmVol: 0.3, sfxVol: 0.3 };
      var bgmMute = !s.opt.bgm || !s.opt.bgmVol;
      var sfxMute = !s.opt.sfx || !s.opt.sfxVol;
      if (UI.button(P.W - 130, by + 10, 56, 56, '', { color: '#3a4356' })) setOpen = true;
      DG.A.draw(ctx, bgmMute ? 'ic_music_off' : 'ic_music', P.W - 130 + 11, by + 21, 34, 34);
      if (UI.button(P.W - 66, by + 10, 56, 56, '', { color: '#3a4356' })) setOpen = true;
      DG.A.draw(ctx, sfxMute ? 'pr_snd_off' : 'pr_snd_on', P.W - 66 + 11, by + 21, 34, 34);
      // 内容整体垂直居中（高屏不再顶部堆内容、底部留大片空地）
      var contentH = 56 + (s.runCount >= 2 ? 196 : 128) + 128 + (unlocked('daily') ? 394 : 90) + 202;
      var pad = Math.max(0, Math.floor((P.H - by - contentH - 46) / 2));
      UI.label(P.W / 2, by + pad + 30, '最深 ' + s.bestM + 'm · 累计 ' + U.fmt(s.cumM) + 'm · ' + s.runCount + '局', { size: 24, align: 'center', color: UI.C.dim });

      // 开始按钮
      var sy = by + pad + 56;
      if (UI.button(P.W / 2 - 220, sy, 440, 104, '开 始 挖 掘', { fontSize: 42, sub: s.daily.firstRun ? '当日首局收益 ×2' : '目标：挖得比 ' + s.bestM + 'm 更深', badge: s.daily.firstRun ? '!' : 0 })) {
        DG.Main.go('run');
      }

      // 局前补给：金币的常青去处（第2局后出现）
      var showSup = s.runCount >= 2;
      if (showSup) {
        if (!s.supplies) s.supplies = {};
        var scw = (P.W - 60 - 24) / 3;
        for (var sp = 0; sp < DG.D.supplies.length; sp++) {
          var sit = DG.D.supplies[sp];
          var sx3 = 30 + sp * (scw + 12);
          var on = !!s.supplies[sit.id];
          if (UI.button(sx3, sy + 116, scw, 64, sit.name, { color: on ? null : UI.C.panel2, fontSize: 21, glyph: sit.icon, sub: on ? '✓ 已备好·点击退' : '🪙' + sit.cost })) {
            if (on) { delete s.supplies[sit.id]; s.coin += sit.cost; }
            else if (s.coin >= sit.cost) { s.coin -= sit.cost; s.supplies[sit.id] = 1; DG.A.sfx('buy', { vibrate: true }); DG.FX.text(sx3 + scw / 2, sy + 104, sit.desc, { color: '#8fd0ff', size: 24 }); }
            else DG.FX.text(sx3 + scw / 2, sy + 104, '金币不足', { color: '#ff9f4a', size: 24 });
            DG.SAVE.save();
          }
        }
      }
      // 今日矿情 + 每日挑战：两张等高卡片，不再散排文字
      var my = sy + (showSup ? 196 : 128);
      var mod = DG.D.todayMod();
      var cardW = (P.W - 80) / 2;
      UI.panel(30, my, cardW, 108);
      UI.label(52, my + 28, '📻 今日矿情', { size: 21, bold: true, color: UI.C.blue });
      UI.label(52, my + 56, mod.name, { size: 22, bold: true, color: '#fff', maxW: cardW - 44 });
      UI.label(52, my + 84, mod.desc, { size: 17, color: '#8a92a8', maxW: cardW - 44 });
      if (s.runCount >= 3) {
        var ch = DG.D.todayChallenge();
        if (UI.button(50 + cardW, my, cardW, 108, '⚔️ 每日挑战', {
          color: s.daily.chDone ? UI.C.panel2 : '#8a3a3a', txtColor: '#fff', fontSize: 26,
          sub: s.daily.chDone ? '今日最深 ' + s.daily.chBest + 'm' : '双修饰硬局 → 💎40',
          badge: s.daily.chDone ? 0 : '!'
        })) DG.Main.go('run', { challenge: true });
      } else {
        UI.panel(50 + cardW, my, cardW, 108);
        UI.label(50 + cardW + cardW / 2, my + 54, '⚔️ 挑战 · 3局后解锁', { size: 20, align: 'center', color: '#5a6478' });
      }

      // 每日面板
      var dy = my + 128;
      if (unlocked('daily')) {
        UI.panel(30, dy, P.W - 60, 372);
        UI.label(54, dy + 44, '📅 每日', { size: 28, bold: true, color: '#fff' });
        // 签到
        var canSign = !s.daily.signed;
        var signIdx = s.signDay % 7;
        if (UI.button(P.W - 288, dy + 16, 234, 60, canSign ? '签到 D' + (signIdx + 1) : '✅ 已签到', { fontSize: 23, disabled: !canSign, sub: canSign ? DG.D.signin7[signIdx].txt : null })) {
          s.daily.signed = true;
          var give = DG.D.signin7[signIdx];
          DG.Run.grantGive(give.give);
          s.signDay++;
          DG.FX.banner('📅 签到 ' + give.txt, { color: '#8fd0ff', size: 40 });
          DG.SAVE.save();
        }
        // 三条目标：文字+进度条一列，按钮右侧垂直居中，行距拉开
        var gy = dy + 92;
        var doneAll = true;
        var bestOT = null; // 矿工加班候选：进度最高的未完成目标(≥70%)
        for (var i = 0; i < s.daily.goals.length; i++) {
          var g = null;
          for (var j = 0; j < DG.D.dailyGoalPool.length; j++) if (DG.D.dailyGoalPool[j].id === s.daily.goals[i]) g = DG.D.dailyGoalPool[j];
          if (!g) continue;
          var cur = Math.min(g.target, s.daily.stats[g.key] || 0);
          var done = cur >= g.target;
          if (!done && cur / g.target >= 0.7 && (!bestOT || cur / g.target > bestOT.ratio)) bestOT = { g: g, cur: cur, ratio: cur / g.target };
          var claimed = s.daily.goalsClaimed.indexOf(g.id) >= 0;
          if (!claimed) doneAll = false;
          UI.label(54, gy + 16, g.txt, { size: 23, color: done ? '#4cd471' : '#dfe6f2', maxW: 420 });
          UI.bar(54, gy + 34, 420, 18, cur / g.target, done ? '#4cd471' : '#4aa3ff', cur + '/' + g.target);
          if (claimed) UI.label(P.W - 144, gy + 26, '✅', { size: 30, align: 'center' });
          else if (UI.button(P.W - 240, gy - 4, 190, 64, done ? '领取' : '未完成', { fontSize: 23, disabled: !done, sub: done ? '🪙100 💎10' : null })) {
            s.daily.goalsClaimed.push(g.id);
            s.coin += 100; s.gem += 10;
            DG.FX.text(P.W - 140, gy + 20, '+100🪙 +10💎', { color: '#ffd76a', size: 26 });
            DG.SAVE.save();
          }
          gy += 76;
        }
        // 全完成→盲盒券
        if (s.daily.goalsClaimed.length >= 3 && !s.daily.allClaimed) {
          if (UI.button(54, gy, P.W - 168, 48, '🎉 全部完成! 领取盲盒券×1', { fontSize: 22 })) {
            s.daily.allClaimed = true;
            s.boxkey++;
            DG.FX.banner('盲盒券 +1', { color: '#ffd76a', size: 44 });
            DG.SAVE.save();
          }
        } else {
          UI.label(54, gy + 22, s.daily.allClaimed ? '✅ 今日3条已全部完成' : '完成全部3条 → 额外盲盒券×1', { size: 20, color: UI.C.dim });
        }
        // 矿工加班：就差一口气的目标，看广告补满（日限1）
        if (bestOT && !s.daily.overtimeUsed) {
          if (UI.button(40, dy + 382, P.W - 80, 52, '⏰ 加班一班: 看广告补满『' + bestOT.g.txt + '』', { fontSize: 21, sub: bestOT.cur + '/' + bestOT.g.target + ' · 就差一口气 · 日限1(模拟)' })) {
            (function (g2) {
              DG.D.adStub('overtime', function () {
                s.daily.stats[g2.key] = g2.target;
                s.daily.overtimeUsed = true;
                DG.SAVE.save();
              });
            })(bestOT.g);
          }
          dy += 456;
        } else dy += 394;
      } else {
        UI.panel(30, dy, P.W - 60, 70);
        UI.label(P.W / 2, dy + 35, '📅 每日目标 · 完成第2局解锁', { size: 24, align: 'center', color: UI.C.dim });
        dy += 90;
      }

      // 系统入口 3×2（新图标包）
      var tabs = [
        { id: 'shop', txt: '商店', icon: 'ic_shop', lock: '完成第1局解锁' },
        { id: 'box', txt: '盲盒', icon: 'ic_box', lock: '第3局或100m解锁' },
        { id: 'codex', txt: '图鉴', icon: 'ic_book', lock: '第4局或150m解锁' },
        { id: 'wheel', txt: '转盘', icon: 'ic_wheel', lock: '第2天或250m解锁' },
        { id: 'puzzle', txt: '拼图', icon: 'ic_puzzle', lock: '第5局或350m解锁' },
        { id: 'skin', txt: '强化', icon: 'ic_gym', lock: '完成拼图1或600m解锁' }
      ];
      var bw = (P.W - 60 - 40) / 3, bh = 92;
      for (var t = 0; t < tabs.length; t++) {
        var tx = 30 + (t % 3) * (bw + 20), ty = dy + Math.floor(t / 3) * (bh + 18);
        var un = unlocked(tabs[t].id);
        var badge = 0;
        if (tabs[t].id === 'shop' && un) { // 有买得起的升级→红点，让金币的用处看得见
          for (var si2 = 0; si2 < DG.D.shop.length; si2++) {
            var shIt = DG.D.shop[si2], shLv = s.shop[shIt.id] || 0;
            if (shLv < shIt.max && s.coin >= DG.D.shopPrice(shIt, shLv).cost) { badge = '!'; break; }
          }
        }
        if (tabs[t].id === 'box' && s.boxkey > 0) badge = s.boxkey;
        if (tabs[t].id === 'wheel' && un && !s.daily.wheelFree) badge = '!';
        if (tabs[t].id === 'puzzle' && s.piece > 0) badge = s.piece;
        if (UI.button(tx, ty, bw, bh, un ? tabs[t].txt : '🔒' + tabs[t].txt, { color: un ? UI.C.panel2 : '#3a4356', glyph: un ? tabs[t].icon : null, fontSize: 26, badge: un ? badge : 0, sub: un ? null : tabs[t].lock, subColor: '#6a7288' })) {
          if (un) DG.Main.go('meta', tabs[t].id);
          else DG.FX.text(tx + bw / 2, ty - 10, tabs[t].lock, { color: '#ff9f4a', size: 24 });
        }
      }

      // debug: 重置（二次确认防误触）
      var armed = resetArm && Date.now() - resetArm < 2500;
      if (UI.button(P.W - 150, P.H - 50, 130, 36, armed ? '再点一次确认!' : '重置存档', { color: armed ? '#8a3a3a' : 'rgba(60,66,86,0.5)', txtColor: armed ? '#fff' : '#6a7288', fontSize: 18 })) {
        if (armed) { resetArm = 0; DG.SAVE.wipe(); DG.Main.go('home'); }
        else resetArm = Date.now();
      }
      UI.label(20, P.H - 32, '原型版', { size: 18, color: '#5a6478' });
    }
  });
})();
