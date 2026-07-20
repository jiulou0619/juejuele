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
  var resetArm = 0; // 重置按钮二次确认计时

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
      // 音乐/音效开关（右上角，音量固定30%）
      if (!s.opt) s.opt = { bgm: 1, sfx: 1 };
      if (UI.button(P.W - 130, by + 10, 56, 56, '', { color: '#3a4356' })) {
        s.opt.bgm = s.opt.bgm ? 0 : 1;
        DG.A.setBgm(!!s.opt.bgm);
        DG.SAVE.save();
      }
      DG.A.draw(ctx, s.opt.bgm ? 'ic_music' : 'ic_music_off', P.W - 130 + 11, by + 21, 34, 34);
      if (!s.opt.bgm) { ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P.W - 122, by + 58); ctx.lineTo(P.W - 82, by + 18); ctx.stroke(); }
      if (UI.button(P.W - 66, by + 10, 56, 56, '', { color: '#3a4356' })) {
        s.opt.sfx = s.opt.sfx ? 0 : 1;
        DG.SAVE.save();
      }
      DG.A.draw(ctx, s.opt.sfx ? 'pr_snd_on' : 'pr_snd_off', P.W - 66 + 11, by + 21, 34, 34);
      // 内容整体垂直居中（高屏不再顶部堆内容、底部留大片空地）
      var contentH = 208 + 128 + 128 + (unlocked('daily') ? 394 : 90) + 202;
      var pad = Math.max(0, Math.floor((P.H - by - contentH - 46) / 2));
      // 标题（Logo 图，缺图回退文字）
      var logo = DG.A.images.logo;
      if (logo) {
        var lw = 520, lh = lw * logo.height / logo.width;
        ctx.drawImage(logo, P.W / 2 - lw / 2, by + pad + 10, lw, lh);
      } else {
        UI.label(P.W / 2, by + pad + 56, '⛏️ 掘 掘 乐 ⛏️', { size: 60, bold: true, align: 'center', color: '#ffd76a' });
      }
      UI.label(P.W / 2, by + pad + 182, '最深 ' + s.bestM + 'm · 累计 ' + U.fmt(s.cumM) + 'm · ' + s.runCount + '局', { size: 24, align: 'center', color: UI.C.dim });

      // 开始按钮
      var sy = by + pad + 208;
      if (UI.button(P.W / 2 - 220, sy, 440, 104, '▶️ 开始挖掘', { fontSize: 42, sub: s.daily.firstRun ? '🎁 当日首局收益 ×2' : '目标：挖得比 ' + s.bestM + 'm 更深', badge: s.daily.firstRun ? '!' : 0 })) {
        DG.Main.go('run');
      }

      // 今日矿情 + 每日挑战：两张等高卡片，不再散排文字
      var my = sy + 128;
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
          else if (UI.button(P.W - 234, gy + 2, 180, 50, done ? '领取' : '未完成', { fontSize: 21, disabled: !done, sub: done ? '🪙100 💎10' : null })) {
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
