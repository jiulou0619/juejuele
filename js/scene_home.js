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

  DG.Main.scene('home', {
    enter: function () {
      ensureDaily();
      DG.D.calcBonuses();
      var s = DG.SAVE.d;
      // 隔夜矿车：昨天挖得越深，今天开门红越大（赴约机制；月卡×2）
      if (s.yesterM > 0 && !s.daily.cart) {
        s.daily.cart = true;
        var mOn = DG.D.monthlyActive(s);
        var cart = Math.min(800, Math.round(s.yesterM)) * (mOn ? 2 : 1);
        s.coin += cart;
        DG.FX.banner('🛒 隔夜矿车运回 🪙' + cart + '!' + (mOn ? ' (月卡×2)' : ' (昨日' + s.yesterM + 'm)'), { color: '#ffd76a', size: 40, life: 2.5 });
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
        ctx.fillStyle = 'rgba(8,10,16,0.45)';
        ctx.fillRect(-4, -4, P.W + 8, P.H + 8);
      }
      var by = UI.currencyBar([
        { icon: 'ui_coin', txt: U.fmt(s.coin) },
        { icon: 'ui_gem', txt: U.fmt(s.gem) },
        { icon: 'ui_key', txt: '' + s.boxkey },
        { icon: 'ui_ticket', txt: '' + s.ticket }
      ]);
      DG.PAY.gemHotspot(20);
      // 标题（Logo 图，缺图回退文字）
      var logo = DG.A.images.logo;
      if (logo) {
        var lw = 520, lh = lw * logo.height / logo.width;
        ctx.drawImage(logo, P.W / 2 - lw / 2, by + 10, lw, lh);
      } else {
        UI.label(P.W / 2, by + 56, '⛏️ 掘 掘 乐 ⛏️', { size: 60, bold: true, align: 'center', color: '#ffd76a' });
      }
      UI.label(P.W / 2, by + 182, '最深 ' + s.bestM + 'm · 累计 ' + U.fmt(s.cumM) + 'm · ' + s.runCount + '局', { size: 24, align: 'center', color: UI.C.dim });
      // 柯基矿工吉祥物
      var dog = DG.A.images.dog_corgi;
      if (dog) {
        var dh = 230, dw = dh * dog.width / dog.height;
        ctx.drawImage(dog, 14, P.H - dh - 56, dw, dh);
      }

      // 开始按钮
      var sy = by + 208;
      if (UI.button(P.W / 2 - 220, sy, 440, 104, '▶️ 开始挖掘', { fontSize: 42, sub: s.daily.firstRun ? '🎁 当日首局收益 ×2' : '目标：挖得比 ' + s.bestM + 'm 更深', badge: s.daily.firstRun ? '!' : 0 })) {
        DG.Main.go('run');
      }

      // 今日矿情 + 每日挑战
      var my = sy + 116;
      var mod = DG.D.todayMod();
      UI.label(36, my + 24, '📻 今日矿情', { size: 22, bold: true, color: UI.C.blue });
      UI.label(36, my + 52, mod.name + ' · ' + mod.desc, { size: 20, color: UI.C.dim, maxW: 380 });
      UI.label(36, my + 78, '明日 · ' + DG.D.modOfKey(U.dayKeyOffset(1)).name, { size: 18, color: '#5a6478' });
      if (s.runCount >= 3) {
        var ch = DG.D.todayChallenge();
        if (UI.button(P.W - 300, my + 8, 280, 76, '⚔️ 每日挑战', {
          color: s.daily.chDone ? UI.C.panel2 : '#8a3a3a', txtColor: '#fff', fontSize: 26,
          sub: s.daily.chDone ? '今日最深 ' + s.daily.chBest + 'm' : ch[0].name + '+' + ch[1].name + ' → 💎40',
          badge: s.daily.chDone ? 0 : '!'
        })) DG.Main.go('run', { challenge: true });
      } else {
        UI.label(P.W - 160, my + 40, '⚔️ 挑战·3局后解锁', { size: 20, align: 'center', color: '#5a6478' });
      }

      // 每日面板
      var dy = my + 96;
      if (unlocked('daily')) {
        UI.panel(30, dy, P.W - 60, 300);
        UI.label(54, dy + 36, '📅 每日', { size: 28, bold: true, color: '#fff' });
        // 签到
        var canSign = !s.daily.signed;
        var signIdx = s.signDay % 7;
        if (UI.button(P.W - 260, dy + 12, 210, 48, canSign ? '签到 D' + (signIdx + 1) : '已签到', { fontSize: 22, disabled: !canSign, sub: canSign ? DG.D.signin7[signIdx].txt : null })) {
          s.daily.signed = true;
          var give = DG.D.signin7[signIdx];
          DG.Run.grantGive(give.give);
          s.signDay++;
          DG.FX.banner('📅 签到 ' + give.txt, { color: '#8fd0ff', size: 40 });
          DG.SAVE.save();
        }
        // 三条目标
        var gy = dy + 72;
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
          UI.label(54, gy + 20, g.txt, { size: 24, color: done ? '#4cd471' : '#dfe6f2' });
          UI.bar(54, gy + 38, 380, 16, cur / g.target, done ? '#4cd471' : '#4aa3ff', cur + '/' + g.target);
          if (claimed) UI.label(P.W - 150, gy + 28, '✅', { size: 28, align: 'center' });
          else if (UI.button(P.W - 220, gy + 6, 160, 46, done ? '领取' : '未完成', { fontSize: 20, disabled: !done, sub: done ? '🪙100 💎10' : null })) {
            s.daily.goalsClaimed.push(g.id);
            s.coin += 100; s.gem += 10;
            DG.FX.text(P.W - 140, gy + 20, '+100🪙 +10💎', { color: '#ffd76a', size: 26 });
            DG.SAVE.save();
          }
          gy += 66;
        }
        // 全完成→盲盒券
        if (s.daily.goalsClaimed.length >= 3 && !s.daily.allClaimed) {
          if (UI.button(54, gy + 2, P.W - 168, 46, '🎉 全部完成! 领取盲盒券×1', { fontSize: 22 })) {
            s.daily.allClaimed = true;
            s.boxkey++;
            DG.FX.banner('🎟️ 盲盒券 +1', { color: '#ffd76a', size: 44 });
            DG.SAVE.save();
          }
        } else {
          UI.label(54, gy + 24, '完成全部3条 → 盲盒券×1 🎟️', { size: 20, color: UI.C.dim });
        }
        // 矿工加班：就差一口气的目标，看广告补满（日限1）
        if (bestOT && !s.daily.overtimeUsed) {
          if (UI.button(40, dy + 306, P.W - 80, 50, '⏰ 加班一班: 看广告补满『' + bestOT.g.txt + '』', { fontSize: 21, sub: bestOT.cur + '/' + bestOT.g.target + ' · 就差一口气 · 日限1(模拟)' })) {
            (function (g2) {
              DG.D.adStub('overtime', function () {
                s.daily.stats[g2.key] = g2.target;
                s.daily.overtimeUsed = true;
                DG.SAVE.save();
              });
            })(bestOT.g);
          }
          dy += 380;
        } else dy += 320;
      } else {
        UI.panel(30, dy, P.W - 60, 70);
        UI.label(P.W / 2, dy + 35, '📅 每日目标 · 完成第2局解锁', { size: 24, align: 'center', color: UI.C.dim });
        dy += 90;
      }

      // 系统入口 3×2
      var tabs = [
        { id: 'shop', txt: '🛒 商店', lock: '完成第1局解锁' },
        { id: 'box', txt: '🎁 盲盒', lock: '第3局或100m解锁' },
        { id: 'codex', txt: '📖 图鉴', lock: '第4局或150m解锁' },
        { id: 'wheel', txt: '🎡 转盘', lock: '第2天或250m解锁' },
        { id: 'puzzle', txt: '🧩 拼图', lock: '第5局或350m解锁' },
        { id: 'skin', txt: '💪 强化', lock: '完成拼图1或600m解锁' }
      ];
      var bw = (P.W - 60 - 40) / 3, bh = 92;
      for (var t = 0; t < tabs.length; t++) {
        var tx = 30 + (t % 3) * (bw + 20), ty = dy + Math.floor(t / 3) * (bh + 18);
        var un = unlocked(tabs[t].id);
        var badge = 0;
        if (tabs[t].id === 'box' && s.boxkey > 0) badge = s.boxkey;
        if (tabs[t].id === 'wheel' && un && !s.daily.wheelFree) badge = '!';
        if (tabs[t].id === 'puzzle' && s.piece > 0) badge = s.piece;
        if (UI.button(tx, ty, bw, bh, un ? tabs[t].txt : '🔒' + tabs[t].txt.slice(2), { color: un ? UI.C.panel2 : '#242a38', txtColor: un ? '#fff' : '#6a7288', fontSize: 26, badge: un ? badge : 0, sub: un ? null : tabs[t].lock, subColor: '#6a7288' })) {
          if (un) DG.Main.go('meta', tabs[t].id);
          else DG.FX.text(tx + bw / 2, ty - 10, tabs[t].lock, { color: '#ff9f4a', size: 24 });
        }
      }

      // debug: 重置
      if (UI.button(P.W - 120, P.H - 50, 100, 36, '重置存档', { color: 'rgba(60,66,86,0.5)', txtColor: '#6a7288', fontSize: 18 })) {
        DG.SAVE.wipe();
        DG.Main.go('home');
      }
      UI.label(20, P.H - 32, '原型版 · 贴图/音效为文字占位', { size: 18, color: '#5a6478' });
    }
  });
})();
