/* scene_run.js — 局内场景：棋盘渲染、点击/拖拽输入、HUD、三选一/事件/结算界面 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U, UI = DG.UI, P = DG.P, FX = DG.FX;
  var hudH = 116, botH = 176;   // 顶部紧凑；底部：狂热条+耐久条等粗、撤离大按钮（局内UI v3）
  var drag = null;          // {r,c,sp} 拖拽中的特殊道具
  var hlGroup = [];         // 按下预判高亮
  var settleT = 0;          // 结算数字滚动
  var idleT = 0;            // 发呆计时：超时脉冲提示最大可消组
  var hintCells = null;     // 提示组
  var hintMsg = null;       // 引导文案（画进底部狂热条槽位，不挡棋盘）
  var offerRef = null, offerOpen = false; // 事件卡默认收起成小胸针，点开才展开
  var recordShown = false;  // 本局破纪录横幅只出一次
  var hotStreak = 0;        // 趁热打铁：连点"再来一局"计数（会话内，不写档）
  var mergeArmT = null;     // FTUE合并教学起始时间
  var mergeGiftDone = false;// 合并赠礼只送一次

  DG.Main.scene('run', {
    enter: function (arg) {
      var top = P.safeTop + hudH;
      DG.Run.newRun(arg);
      DG.Grid.newRun(15, top, P.W - 30, P.H - top - botH - 10);
      drag = null; hlGroup = []; settleT = 0;
      idleT = 0; hintCells = null; recordShown = false;
      mergeArmT = null; mergeGiftDone = false;
      var R = DG.Run, G = DG.Grid;
      if (!(arg && arg.hot) || R.challenge) hotStreak = 0;
      // 首局印章：中部印一个6连同色团，保证第一个道具准时出现
      if (DG.SAVE.d.runCount === 0 && !R.challenge && G.rows > 8) {
        var col = 2 + Math.floor(Math.random() * 3);
        var ck = ['red', 'blue', 'green'][Math.floor(Math.random() * 3)];
        for (var rr = 6; rr <= 7; rr++) for (var cc = col; cc < col + 3; cc++)
          G.cells[rr][cc] = { kind: 'color', t: ck, color: DG.D.colors[ck].color, ice: 0, fy: 0, _pr: rr };
      }
      // 趁热打铁：连局赠道具 🚀→💣→🌀
      if (hotStreak > 0 && !R.challenge) {
        var gift = hotStreak >= 3 ? 'drill' : hotStreak === 2 ? 'bomb' : 'rocket';
        R.pendingSpecials.push(gift);
        R.flushSpecials();
        DG.FX.banner('🔥 趁热 x' + hotStreak + ' 赠' + DG.D.specials[gift].glyph, { color: '#ff9f4a', size: 46, life: 1.5, pri: true });
      } else if (R.challenge && R.chMods.length) {
        DG.FX.banner('⚔️ ' + R.chMods[0].name + '·' + R.chMods[1].name, { color: '#ff7a4a', size: 46, life: 2, pri: true });
      } else if (R.dayMod) {
        DG.FX.banner('📻 ' + R.dayMod.name, { color: '#8fd0ff', size: 44, life: 1.5, pri: true });
      }
    },

    /* 新手引导：跟着棋盘状态走的四步软引导，零文字墙 */
    ftueTick: function (ctx) {
      var s = DG.SAVE.d, R = DG.Run, G = DG.Grid;
      hintMsg = null;
      if (s.ftue >= 4 || R.challenge) return;
      if (s.ftue === 3 && s.codex.merge) { s.ftue = 4; DG.SAVE.save(); return; } // 老档迁移
      // 首Fever硬保证：75s还没Fever就"矿脉能量暴走"（包装成运气不是补课）
      if (R.ftue && R.ftue.feverForceAt && R.feverCount === 0 && R.time > R.ftue.feverForceAt && R.state === 'play') {
        R.forceFever();
        DG.FX.banner('⚡ 矿脉能量暴走!', { color: '#ff8f3f', size: 56, pri: true });
      }
      var msg = null;
      if (s.ftue === 0) {
        if (R.blocksCleared > 0) { s.ftue = 1; DG.SAVE.save(); }
        else {
          msg = '点击 3个以上相连的同色方块 开挖!';
          if (!hintCells) hintCells = this.findBestGroup();
        }
      }
      if (s.ftue === 1) {
        var sp = null;
        for (var r = 0; r < G.rows && !sp; r++) for (var c = 0; c < G.cols && !sp; c++) {
          var cl = G.at(r, c);
          if (cl && cl.kind === 'special') sp = { r: r, c: c };
        }
        if (sp) { s.ftue = 2; DG.SAVE.save(); }
        else if (R.blocksCleared < 60) msg = '一次消得越多越爽! 4连以上产出强力道具';
      }
      if (s.ftue === 2) {
        if (R.itemsUsed > 0) { s.ftue = 3; DG.SAVE.save(); }
        else {
          msg = '点道具引爆试试!';
          var pulse = 0.5 + 0.4 * Math.sin(Date.now() / 160);
          ctx.strokeStyle = 'rgba(143,208,255,' + pulse + ')';
          ctx.lineWidth = 6;
          for (var r2 = 0; r2 < G.rows; r2++) for (var c2 = 0; c2 < G.cols; c2++) {
            var cl2 = G.at(r2, c2);
            if (cl2 && cl2.kind === 'special') {
              var pp = G.cellXY(r2, c2);
              U.rr(ctx, pp.x + 2, pp.y + 2, G.cell - 4, G.cell - 4, 14); ctx.stroke();
            }
          }
        }
      }
      if (s.ftue === 3) {
        // 第4步：合并教学（两个道具间画虚线；45s不会就白送一个炸弹到旁边）
        if (R.mergeCount > 0 || s.codex.merge) { s.ftue = 4; DG.SAVE.save(); return; }
        if (mergeArmT == null) mergeArmT = R.time;
        var sps = [];
        for (var r3 = 0; r3 < G.rows; r3++) for (var c3 = 0; c3 < G.cols; c3++) {
          var cl3 = G.at(r3, c3);
          if (cl3 && cl3.kind === 'special') sps.push({ r: r3, c: c3 });
        }
        if (sps.length >= 2) {
          msg = '拖一个道具到另一个上 = 合并大招!';
          var a = G.cellXY(sps[0].r, sps[0].c), b = G.cellXY(sps[1].r, sps[1].c);
          ctx.save();
          ctx.setLineDash([8, 8]);
          ctx.strokeStyle = 'rgba(255,215,106,0.9)';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(a.x + G.cell / 2, a.y + G.cell / 2);
          ctx.lineTo(b.x + G.cell / 2, b.y + G.cell / 2);
          ctx.stroke();
          ctx.restore();
        } else if (sps.length === 1 && R.ftue && R.ftue.mergeGiftAt && !mergeGiftDone && R.time - mergeArmT > R.ftue.mergeGiftAt) {
          // 合并赠礼：在唯一道具旁写入一个炸弹
          mergeGiftDone = true;
          var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (var d3 = 0; d3 < 4; d3++) {
            var nr = sps[0].r + dirs[d3][0], nc = sps[0].c + dirs[d3][1];
            var ncell = G.at(nr, nc);
            if (ncell && ncell.kind === 'color') {
              G.cells[nr][nc] = { kind: 'special', sp: 'bomb', fy: 0, spo: G.spOrder++, _pr: nr };
              DG.FX.text(G.cellXY(nr, nc).x + G.cell / 2, G.cellXY(nr, nc).y + G.cell / 2, '🎁', { size: 44 });
              break;
            }
          }
        }
      }
      hintMsg = msg; // 画在底部狂热条槽位（bottomPanel负责渲染），完全不挡棋盘
    },

    /* 结算屏钩子：给玩家两条"马上再来一局"的理由 */
    nextHooks: function (d) {
      var s = DG.SAVE.d, D = DG.D, hooks = [], i;
      // 最接近完成的每日目标
      if (s.daily.goals) {
        var best = null, bestRatio = -1;
        for (i = 0; i < s.daily.goals.length; i++) {
          var g = null;
          for (var j = 0; j < D.dailyGoalPool.length; j++) if (D.dailyGoalPool[j].id === s.daily.goals[i]) g = D.dailyGoalPool[j];
          if (!g || s.daily.goalsClaimed.indexOf(g.id) >= 0) continue;
          var cur = Math.min(g.target, s.daily.stats[g.key] || 0);
          var ratio = cur / g.target;
          if (cur >= g.target) { hooks.push('📅 「' + g.txt + '」已完成，回基地领奖!'); best = null; break; }
          if (ratio > bestRatio) { bestRatio = ratio; best = g; }
        }
        if (best && bestRatio > 0.2) {
          var c2 = Math.min(best.target, s.daily.stats[best.key] || 0);
          hooks.push('📅 ' + best.txt + '  ' + c2 + '/' + best.target);
        }
      }
      // 距纪录 / 最近累计里程碑 / 盲盒钩子
      if (d && s.bestM > d.m && s.bestM - d.m <= 40) hooks.push('🏁 距最深纪录只差 ' + (s.bestM - d.m) + 'm');
      for (i = 0; i < D.milesCum.length; i++) {
        if (s.milesCumDone.indexOf(D.milesCum[i].m) < 0) {
          var diff = D.milesCum[i].m - s.cumM;
          if (diff > 0 && diff <= 150) hooks.push('🎖️ 累计' + D.milesCum[i].m + 'm里程碑 还差' + diff + 'm');
          break;
        }
      }
      if (s.boxkey > 0) hooks.push('🎁 还有 ' + s.boxkey + ' 个盲盒没开');
      else if (D.pity.ssr - s.pityBox <= 8 && s.boxCount > 0) hooks.push('✨ SSR保底只剩 ' + (D.pity.ssr - s.pityBox) + ' 抽');
      return hooks.slice(0, 2);
    },

    /* 找最大可消组（发呆提示/新手引导共用） */
    findBestGroup: function () {
      var G = DG.Grid, best = null, bn = 0, seen = {};
      for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
        if (seen[r + '_' + c]) continue;
        var cell = G.at(r, c);
        if (!cell || cell.kind !== 'color' || cell.ice > 0) continue;
        var g = G.groupAt(r, c);
        for (var i = 0; i < g.length; i++) seen[g[i].r + '_' + g[i].c] = 1;
        if (g.length >= 3 && g.length > bn) { bn = g.length; best = g; }
      }
      return best;
    },

    frame: function (dt, ctx) {
      var R = DG.Run, G = DG.Grid;
      R.step(dt);

      var st = DG.D.stratumAt(R.m);
      // 背景 = 地层贴图（缺图回退地层色）
      var bgImg = DG.A.images['bg_' + st.id];
      if (bgImg) ctx.drawImage(bgImg, -4, -4, P.W + 8, P.H + 8);
      else { ctx.fillStyle = st.bg; ctx.fillRect(-20, -20, P.W + 40, P.H + 40); }

      /* ---------- 输入（play 状态） ---------- */
      if (R.state === 'play') this.input(ctx);
      else { hlGroup = this.clearHl(); drag = null; }

      /* 发呆提示：3秒无操作脉冲最大可消组 */
      if (R.state === 'play' && G.busy <= 0) {
        idleT += dt;
        if (UI.justDown || UI.tap) { idleT = 0; hintCells = null; }
        if (idleT > 3 && !hintCells) hintCells = this.findBestGroup();
      } else { idleT = 0; hintCells = null; }

      /* ---------- 棋盘 ---------- */
      ctx.save();
      U.rr(ctx, 10, P.safeTop + hudH - 6, P.W - 20, P.H - (P.safeTop + hudH) - botH, 14);
      ctx.clip();
      G.draw(ctx);
      // 发呆提示脉冲描边 + 指引手
      if (hintCells && R.state === 'play') {
        var pulse = 0.45 + 0.4 * Math.sin(Date.now() / 180);
        ctx.strokeStyle = 'rgba(255,255,255,' + pulse + ')';
        ctx.lineWidth = 5;
        var hx = 0, hy = 0;
        for (var hi = 0; hi < hintCells.length; hi++) {
          var hc = hintCells[hi];
          if (G.at(hc.r, hc.c) !== hc.cell) { hintCells = null; break; } // 棋盘已变，作废
          var hp = G.cellXY(hc.r, hc.c);
          U.rr(ctx, hp.x + 4, hp.y + 4, G.cell - 8, G.cell - 8, 12); ctx.stroke();
          hx += hp.x + G.cell / 2; hy += hp.y + G.cell / 2;
        }
        if (hintCells) {
          hx /= hintCells.length; hy /= hintCells.length;
          ctx.font = '44px Xiaolai, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('👇', hx, hy - 46 - 6 * Math.sin(Date.now() / 150));
        }
      }
      ctx.restore();

      // 拖拽跟随
      if (drag) {
        var pt = UI.pointer;
        ctx.globalAlpha = 0.85;
        DG.D.drawCell(ctx, { kind: 'special', sp: drag.sp }, pt.x - G.cell / 2, pt.y - G.cell / 2, G.cell);
        ctx.globalAlpha = 1;
        // 落点预览
        var hit = G.hitCell(pt.x, pt.y);
        if (hit) {
          var tgt = G.at(hit.r, hit.c);
          ctx.strokeStyle = tgt && tgt.kind === 'special' ? '#ffb02e' : '#8fd0ff';
          ctx.lineWidth = 5;
          var pxy = G.cellXY(hit.r, hit.c);
          U.rr(ctx, pxy.x + 2, pxy.y + 2, G.cell - 4, G.cell - 4, 12); ctx.stroke();
        }
      }

      if (R.state === 'play') this.ftueTick(ctx);
      this.hud(ctx, dt);

      /* ---------- 状态浮层 ---------- */
      if (R.state === 'play' && R.offer) this.offerCard(ctx);
      if (R.state === 'perk') this.perkOverlay(ctx);
      else if (R.state === 'dead') this.deadOverlay(ctx);
      else if (R.state === 'settle') this.settleOverlay(ctx, dt);
    },

    /* 悬浮事件卡：不暂停游戏，限时存在。默认收起成小胸针（不挡棋盘），点开才展开 */
    offerCard: function (ctx) {
      var R = DG.Run, o = R.offer;
      var w = P.W - 40, x = 20;
      if (o !== offerRef) { offerRef = o; offerOpen = false; }
      if (!offerOpen) {
        var pw = 264, ph = 52, py = P.H - botH - ph - 10;
        var isM = o.id === 'merchant';
        if (UI.button(20, py, pw, ph, isM ? '🦫 商人来了 · 点开' : '❓ 赌石摊 · 点开', { color: '#3a4356', fontSize: 21, badge: '!' })) offerOpen = true;
        UI.bar(24, py + ph + 2, pw - 8, 6, o.t / o.max, isM ? '#b678ff' : '#ff9f4a');
        return;
      }
      if (o.id === 'merchant') {
        var h = 128, y = P.H - botH - h - 14;
        UI.panel(x, y, w, h, { color: 'rgba(14,18,28,0.9)', borderColor: '#b678ff', r: 14 });
        UI.label(x + 18, y + 24, '🦫 流浪商人路过…', { size: 22, bold: true, color: '#d8c8f0' });
        if (UI.button(x + w - 60, y + 8, 48, 36, '▾', { color: '#3a4356', fontSize: 20 })) { offerOpen = false; return; }
        UI.label(x + w - 76, y + 26, '🪙' + R.coins, { size: 20, align: 'right', color: UI.C.gold });
        var bw = (w - 48) / 3;
        for (var i = 0; i < o.offers.length; i++) {
          var it = o.offers[i], bx = x + 12 + i * (bw + 12);
          var got = o.bought.indexOf(i) >= 0;
          if (UI.button(bx, y + 40, bw, 58, got ? '✅' : it.txt, { fontSize: 18, sub: got ? null : '🪙' + it.cost, disabled: got || R.coins < it.cost })) DG.Run.offerBuy(i);
        }
        UI.bar(x + 12, y + h - 16, w - 24, 8, o.t / o.max, '#b678ff');
      } else { // 赌石
        var h2 = 92, y2 = P.H - botH - h2 - 14;
        UI.panel(x, y2, w, h2, { color: 'rgba(28,17,22,0.9)', borderColor: '#ff9f4a', r: 14 });
        UI.label(x + 18, y2 + 30, '❓ 赌石摊 · 原石×' + o.stones, { size: 24, bold: true, color: '#ffd76a' });
        UI.label(x + 18, y2 + 60, '半数废石 · 也可能一夜暴富', { size: 16, color: '#c8a890' });
        if (UI.button(x + w - 250, y2 + 16, 174, 52, '砸! 🪙40', { fontSize: 24, disabled: R.coins < 40 })) DG.Run.offerGamble();
        if (UI.button(x + w - 66, y2 + 16, 48, 52, '▾', { color: '#3a4356', fontSize: 20 })) { offerOpen = false; return; }
        UI.bar(x + 12, y2 + h2 - 14, w - 24, 8, o.t / o.max, '#ff9f4a');
      }
    },

    clearHl: function () {
      for (var i = 0; i < hlGroup.length; i++) hlGroup[i].cell.hl = false;
      return [];
    },

    input: function (ctx) {
      var R = DG.Run, G = DG.Grid;
      // 按下高亮同组（预判反馈）
      if (UI.justDown) {
        hlGroup = this.clearHl();
        var h = G.hitCell(UI.justDown.x, UI.justDown.y);
        if (h) {
          var cell = G.at(h.r, h.c);
          if (cell && cell.kind === 'special') drag = { r: h.r, c: h.c, sp: cell.sp, moved: false };
          else {
            hlGroup = G.groupAt(h.r, h.c);
            if (hlGroup.length >= (R.mods.feverOn ? 2 : DG.D.tune.matchMin))
              for (var i = 0; i < hlGroup.length; i++) hlGroup[i].cell.hl = true;
            else hlGroup = [];
          }
        }
      }
      if (drag && UI.pointer.moved) drag.moved = true;
      // 触摸被系统打断：放弃拖拽与高亮
      if (UI.cancelled) { hlGroup = this.clearHl(); drag = null; }
      // 拖拽期间棋盘可能因连锁塌陷移动：源格不再是同一道具则放弃
      if (drag) {
        var src = G.at(drag.r, drag.c);
        if (!src || src.kind !== 'special' || src.sp !== drag.sp) drag = null;
      }
      // 抬起
      if (UI.justUp) {
        hlGroup = this.clearHl();
        if (drag) {
          var up = G.hitCell(UI.justUp.x, UI.justUp.y);
          if (drag.moved && up && !(up.r === drag.r && up.c === drag.c)) {
            var tgt = G.at(up.r, up.c);
            if (tgt && tgt.kind === 'special') R.dragMerge(drag.r, drag.c, up.r, up.c);
            else R.dragFire(drag.r, drag.c, up.r, up.c);
            UI.tap = null;
          }
          drag = null;
        }
      }
      // 点击（悬浮事件卡区域让位给卡上按钮）
      var lowLimit = P.H - botH;
      if (R.offer) lowLimit -= offerOpen ? (R.offer.id === 'merchant' ? 156 : 120) : 70;
      if (UI.tap && UI.tap.y > P.safeTop + hudH && UI.tap.y < lowLimit) {
        var t = G.hitCell(UI.tap.x, UI.tap.y);
        if (t) { R.tapAt(t.r, t.c); UI.tap = null; }
      }
    },

    hud: function (ctx, dt) {
      var R = DG.Run, y = P.safeTop;
      var C = UI.C;
      // 悬浮HUD：不再画整条底色，元素各自带小chip/描边，露出背景
      var bestM = DG.SAVE.d.bestM;
      UI.label(P.W / 2, y + 34, R.m + 'm', { size: 44, bold: true, align: 'center', color: '#fff', stroke: true });
      if (bestM > 0 && R.m < bestM && bestM - R.m <= 30) {
        var blink = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        ctx.globalAlpha = blink;
        UI.label(P.W / 2, y + 74, '距纪录只差 ' + (bestM - R.m) + 'm!', { size: 26, bold: true, align: 'center', color: '#ff9f4a', stroke: true });
        ctx.globalAlpha = 1;
      } else if (R.m >= bestM && bestM > 0 && R.state === 'play') {
        if (!recordShown) {
          recordShown = true;
          DG.FX.banner('🏆 新纪录!', { color: '#ffd76a', size: 60, life: 1.6, pri: true });
          DG.A.sfx('milestone', { vibrate: true, strong: true });
        }
        UI.label(P.W / 2, y + 74, '纪录刷新中 · ' + DG.D.stratumAt(R.m).name, { size: 24, align: 'center', color: '#ffd76a', stroke: true });
      } else {
        UI.label(P.W / 2, y + 74, DG.D.stratumAt(R.m).name, { size: 24, align: 'center', color: '#e8ecf4', stroke: true });
      }
      // 金币 / 分数（左上小chip）
      UI.chip(12, y + 8, 156, 40);
      DG.A.draw(ctx, 'ui_coin', 18, y + 13, 30, 30);
      UI.label(54, y + 28, U.fmt(R.coins), { size: 24, bold: true, color: C.gold });
      UI.chip(12, y + 52, 132, 30);
      UI.label(22, y + 67, '分 ' + U.fmt(R.score), { size: 18, color: '#dfe6f2' });
      // 连击（右上chip）
      if (R.combo >= 2) {
        UI.chip(P.W - 196, y + 8, 184, 40);
        UI.label(P.W - 20, y + 28, 'COMBO x' + R.combo, { size: 26, bold: true, align: 'right', color: R.combo >= 10 ? '#ff6b4a' : C.gold });
        UI.bar(P.W - 186, y + 52, 164, 10, R.comboT / R.comboWindow(), '#ff9f4a');
      }
      if (R.mods.feverOn) { // Fever 全屏火圈（screen混合：暗部不遮挡画面，只叠加火光）
        var ff = DG.A.images.fx_fever_frame;
        if (ff) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(Date.now() / 110);
          ctx.drawImage(ff, -6, -6, P.W + 12, P.H + 12);
          ctx.restore();
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = 'rgba(255,120,60,' + (0.4 + 0.3 * Math.sin(Date.now() / 90)) + ')';
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, P.W - 10, P.H - 10);
        }
      }
      // 岩浆警告（底部岩浆条上涌）
      if ((DG.D.stratumAt(R.m).lava || (R.lavaFrom && R.m >= R.lavaFrom)) && R.state === 'play') {
        var lavaImg = DG.A.images.fx_lava_strip;
        var danger = R.burning ? 1 : Math.max(0, (R.lavaIdle - (DG.D.tune.lavaIdle - 3)) / 3);
        if (lavaImg && danger > 0) {
          var lh = P.W * (lavaImg.height / lavaImg.width);
          ctx.globalAlpha = 0.5 + danger * 0.5;
          ctx.drawImage(lavaImg, 0, P.H - lh * (0.35 + danger * 0.65) - botH + 30, P.W, lh);
          ctx.globalAlpha = 1;
        }
        if (R.burning) {
          UI.label(P.W / 2, P.H - botH - 30, '🌋 岩浆灼烧中! 快挖!', { size: 30, bold: true, align: 'center', color: C.red, stroke: true });
          ctx.strokeStyle = 'rgba(255,60,40,' + (0.5 + 0.4 * Math.sin(Date.now() / 70)) + ')';
          ctx.lineWidth = 14; ctx.strokeRect(7, 7, P.W - 14, P.H - 14);
        } else if (R.lavaIdle > DG.D.tune.lavaIdle - 2) {
          UI.label(P.W / 2, P.H - botH - 30, '🌋 岩浆逼近...', { size: 26, align: 'center', color: '#ff9f4a', stroke: true });
        }
      }
      // ---- 底部面板（局内UI v2）：Fever + 大耐久条在左下 · 撤离在右下 ----
      var y0 = P.H - botH + 6;
      // 狂热条（与耐久等粗）
      var fr = R.mods.feverOn ? R.fever / DG.D.tune.feverMax : Math.min(1, R.fever / DG.D.tune.feverMax);
      if (hintMsg && R.state === 'play') { // 引导语占用狂热条槽位：零遮挡
        UI.panel(20, y0, P.W - 290, 44, { color: 'rgba(20,26,38,0.95)', borderColor: '#4aa3ff', r: 10 });
        UI.label(20 + (P.W - 290) / 2, y0 + 22, hintMsg, { size: 20, bold: true, align: 'center', color: '#8fd0ff', maxW: P.W - 314 });
      } else {
        UI.bar(20, y0, P.W - 290, 44, fr, R.mods.feverOn ? '#ff6b3f' : '#b678ff', R.mods.feverOn ? '狂热爆发中!!' : '狂热 ' + Math.floor(fr * 100) + '%');
        DG.A.draw(ctx, 'ui_fire', 26, y0 + 6, 32, 32);
      }
      // 大耐久条（低耐久红色脉冲告警）
      var durRatio = Math.max(0, R.dur / R.durMax);
      var durLow = durRatio < 0.25;
      if (durLow) {
        ctx.strokeStyle = 'rgba(255,70,50,' + (0.4 + 0.5 * Math.sin(Date.now() / 130)) + ')';
        ctx.lineWidth = 5;
        U.rr(ctx, 16, y0 + 48, P.W - 282, 52, 26); ctx.stroke();
      }
      UI.bar(20, y0 + 52, P.W - 290, 44, durRatio, durLow ? UI.C.red : UI.C.green, Math.ceil(Math.max(0, R.dur)) + ' / ' + Math.round(R.durMax));
      DG.A.draw(ctx, 'ui_energy', 26, y0 + 58, 32, 32);
      // 已获强化图标
      if (R.perks.length) {
        var px = 26;
        UI.chip(14, y0 + 106, 22 + R.perks.length * 28, 32);
        for (var i = 0; i < R.perks.length; i++) {
          var pk = null;
          for (var j = 0; j < DG.D.perks.length; j++) if (DG.D.perks[j].id === R.perks[i]) pk = DG.D.perks[j];
          if (pk) { UI.label(px, y0 + 122, '◆', { size: 20, color: pk.rar === 'gold' ? '#ffb02e' : pk.rar === 'blue' ? '#4aa3ff' : '#c8d0e0' }); px += 28; }
        }
      }
      // 撤离按钮（右下大按钮）；时机成熟时隐晦发光提示——懂的人自然懂
      if (R.state === 'play') {
        var wiseExit = durLow && R.exitMult > 1;   // 血少+倍率在手=该考虑走了
        var exitTxt = R.exitMult > 1 ? '撤离 ×' + R.exitMult.toFixed(1) : '撤离结算';
        var exitCol = R.exitMult > 1 ? '#8f6a1e' : '#3a4356';
        if (wiseExit) {
          ctx.strokeStyle = 'rgba(255,215,106,' + (0.35 + 0.35 * Math.sin(Date.now() / 260)) + ')';
          ctx.lineWidth = 4;
          U.rr(ctx, P.W - 254, y0 + 4, 238, 104, 16); ctx.stroke();
        }
        if (UI.button(P.W - 250, y0 + 8, 230, 96, exitTxt, { color: exitCol, txtColor: '#fff', fontSize: 26, glyph: 'ui_flag', sub: wiseExit ? '见好就收…?' : (R.exitMult > 1 ? '满载而归' : null) })) DG.Run.exitRun();
      }
    },

    perkOverlay: function (ctx) {
      var R = DG.Run;
      UI.dim(0.72);
      UI.label(P.W / 2, 250, '深入矿层 · 选择强化', { size: 40, bold: true, align: 'center', color: '#ffd76a' });
      var rc = { white: '#5a6478', blue: '#2f5a8f', gold: '#8f6a1e' };
      var rn = { white: '', blue: '稀有', gold: '★金色★' };
      for (var i = 0; i < R.perkChoices.length; i++) {
        var p = R.perkChoices[i];
        var y = 330 + i * 200, x = 60, w = P.W - 120, h = 170;
        UI.panel(x, y, w, h, { color: rc[p.rar], borderColor: p.rar === 'gold' ? '#ffb02e' : UI.C.line });
        UI.label(x + 30, y + 44, p.name + (rn[p.rar] ? '  ' + rn[p.rar] : ''), { size: 34, bold: true, color: '#fff' });
        UI.label(x + 30, y + 92, p.desc, { size: 26, color: '#dfe6f2' });
        // 流派标签 + 羁绊提示（已有同流派1件时高亮"将激活"）
        if (p.tag) {
          var tg = DG.D.perkTags[p.tag];
          var owned = 0;
          for (var pk = 0; pk < R.perks.length; pk++)
            for (var pj = 0; pj < DG.D.perks.length; pj++)
              if (DG.D.perks[pj].id === R.perks[pk] && DG.D.perks[pj].tag === p.tag) owned++;
          var chip = '[' + tg.name + ']';
          if (owned >= 1 && !R.tagSetDone[p.tag]) chip += ' 🔗选它激活羁绊:' + tg.bonus;
          UI.label(x + 30, y + h - 34, chip, { size: 20, bold: owned >= 1, color: tg.color });
        }
        if (UI.button(x + w - 150, y + h - 66, 130, 50, '选择', { fontSize: 26 })) { DG.Run.pickPerk(i); return; }
      }
      var sy = 330 + R.perkChoices.length * 200 + 8;
      // 第四格诱惑位：看得见的金卡，差一步——广告(每日1次)或星钻解锁
      if (R.perk4) {
        var s4 = DG.SAVE.d;
        var px4 = 60, pw4 = P.W - 120, ph4 = 118;
        UI.panel(px4, sy, pw4, ph4, { color: 'rgba(64,52,20,0.94)', borderColor: '#ffb02e' });
        UI.label(px4 + 26, sy + 34, '🔒 ' + R.perk4.name + '  ★金色★', { size: 28, bold: true, color: '#ffd76a' });
        UI.label(px4 + 26, sy + 76, R.perk4.desc, { size: 22, color: '#e8dcc0', maxW: pw4 - 310 });
        if (!s4.daily.perk4Ad) {
          if (UI.button(px4 + pw4 - 288, sy + 31, 132, 56, '📺 免费', { fontSize: 22, sub: '今日1次' })) {
            s4.daily.perk4Ad = true; DG.SAVE.save();
            DG.Run.pickPerk(-2); return;
          }
        }
        if (UI.button(px4 + pw4 - 146, sy + 31, 124, 56, '💎' + DG.D.iap.perk4, { fontSize: 22 })) {
          if (s4.gem >= DG.D.iap.perk4) { s4.gem -= DG.D.iap.perk4; DG.SAVE.save(); DG.Run.pickPerk(-2); return; }
          DG.PAY.show('perk4');
        }
        sy += ph4 + 10;
      }
      if (UI.button(P.W / 2 - 220, sy, 440, 54, '🔧 都不选 · 修镐 +' + DG.D.tune.perkSkipHeal + '耐久', { color: '#3a4356', fontSize: 24 })) { DG.Run.pickPerk(-1); return; }
    },

    deadOverlay: function (ctx) {
      var R = DG.Run, s = DG.SAVE.d;
      UI.dim(0.8);
      UI.label(P.W / 2, P.H * 0.26, '💔 镐子碎了…', { size: 52, bold: true, align: 'center', color: '#ff8a8a' });
      UI.label(P.W / 2, P.H * 0.26 + 58, '深度 ' + R.m + 'm', { size: 30, align: 'center', color: UI.C.dim });
      // 遗憾具象化：差纪录 / 错失的撤离倍率
      var ry2 = P.H * 0.26 + 102;
      var gap = s.bestM - R.m;
      if (gap > 0 && gap <= 40) {
        var bl = 0.6 + 0.4 * Math.sin(Date.now() / 180);
        ctx.globalAlpha = bl;
        UI.label(P.W / 2, ry2, '🏁 距最深纪录仅差 ' + gap + 'm !!', { size: 32, bold: true, align: 'center', color: '#ff9f4a' });
        ctx.globalAlpha = 1; ry2 += 46;
      }
      if (R.exitMult > 1) {
        UI.label(P.W / 2, ry2, '💰 撤离奖励 ×' + R.exitMult.toFixed(1) + ' 即将作废（复活可保住）', { size: 24, align: 'center', color: '#ffd76a' });
        ry2 += 44;
      }
      // 复活阶梯：首次广告→星钻递增；护栏：挑战局禁付费复活、每局星钻复活≤2次
      var cost = R.reviveCost();
      var by2 = Math.max(P.H * 0.46, ry2 + 20);
      var payBlocked = cost > 0 && (R.challenge || R.reviveCount >= 3);
      if (cost === 0) {
        if (UI.button(P.W / 2 - 220, by2, 440, 88, '📺 看广告免费复活', { fontSize: 30, sub: '+60耐久 · 炸开周围(原型模拟广告)' })) {
          DG.D.adStub('revive', function () { DG.Run.revive(); });
        }
      } else if (!payBlocked) {
        if (UI.button(P.W / 2 - 220, by2, 440, 88, '💎' + cost + ' 立即复活', { fontSize: 30, sub: '持有💎' + s.gem + ' · +60耐久炸开周围' })) {
          if (s.gem >= cost) { s.gem -= cost; DG.SAVE.save(); DG.D.track('revive_gem'); DG.Run.revive(); }
          else DG.PAY.show('revive', cost - s.gem);
        }
      } else {
        UI.label(P.W / 2, by2 + 30, R.challenge ? '⚔️ 挑战模式凭实力说话' : '本局复活次数已达上限', { size: 24, align: 'center', color: UI.C.dim });
        by2 -= 40;
      }
      if (UI.button(P.W / 2 - 140, by2 + 130, 280, 64, '结算离场', { color: '#3a4356', txtColor: '#fff', fontSize: 26 })) DG.Run.declineRevive();
    },

    settleOverlay: function (ctx, dt) {
      var R = DG.Run, d = R.settleData;
      if (!d) return;
      settleT = Math.min(1, settleT + dt * 1.2);
      var k = U.easeOutCubic(settleT);
      UI.dim(0.85);
      var x = 40, w = P.W - 80;
      var sD = DG.SAVE.d;
      var hooks = this.nextHooks(d);
      // 预算内容高度（与下方绘制常数保持一致），面板贴内容、整体垂直居中
      var estH = 50 + 48 + (d.newRecord ? 38 : 0) + (d.highlight ? 34 : 0) + 8;
      estH += (6 + (d.exitMul > 1 ? 1 : 0)) * 44;
      estH += 8 + 60;
      if (d.x2Claimed) estH += 50; else if (sD.daily.settleX2 < 2) estH += 76;
      if (d.missedCoin > 0) { if (d.missedClaimed) estH += 50; else if (sD.daily.adMissed < 3) estH += 76; }
      estH += Math.min(d.granted.length, 3) * 34;
      if (hooks.length) estH += 6 + 32 + hooks.length * 36;
      estH += 10 + 70 + 36 + 22; // 排行/分享行 + 明日预告 + 底衬
      var btnH = 88;
      var y = Math.max(P.safeTop + 30, Math.floor((P.H - estH - 14 - btnH) / 2) - 10);
      UI.panel(x, y, w, estH);
      // ---- 头部：标题 + 徽章行（依次向下排，绝不叠字）----
      var cy = y + 50;
      UI.label(P.W / 2, cy, d.challenge ? '挑 战 结 算' : d.first ? '结算 · 当日首局×2' : '挖 掘 结 算', { size: 38, bold: true, align: 'center', color: '#ffd76a' });
      cy += 48;
      if (d.newRecord) { UI.label(P.W / 2, cy, '🏆 新纪录!', { size: 30, bold: true, align: 'center', color: '#ff9f4a' }); cy += 38; }
      if (d.highlight) { UI.label(P.W / 2, cy, '🏅 ' + d.highlight, { size: 24, align: 'center', color: '#ffcf3f', maxW: w - 60 }); cy += 34; }
      cy += 8;
      // ---- 数据行 ----
      var rows = [
        ['最深深度', d.m + 'm'],
        ['单局得分', U.fmt(Math.round(d.score * k))],
        ['拾取金币', '🪙' + Math.round(d.picked * k)],
        ['深度奖励', '🪙' + Math.round(d.depthCoin * k)],
        ['连击峰值 x' + d.comboPeak, '🪙' + Math.round(d.comboCoin * k)],
        ['局外加成 · 狂热×' + d.fever, '+' + d.bonusPct + '%']
      ];
      if (d.exitMul > 1) rows.push(['💰 满载而归', '×' + d.exitMul.toFixed(1)]);
      for (var i = 0; i < rows.length; i++) {
        UI.label(x + 34, cy, rows[i][0], { size: 26, color: UI.C.dim });
        UI.label(x + w - 34, cy, rows[i][1], { size: 26, bold: true, align: 'right', color: '#fff' });
        cy += 44;
      }
      cy += 8;
      UI.label(x + 34, cy, '总收入', { size: 32, bold: true, color: '#ffd76a' });
      UI.label(x + w - 34, cy, '🪙 ' + U.fmt(Math.round(d.total * k)), { size: 44, bold: true, align: 'right', color: '#ffd76a' });
      cy += 60;
      // ---- 广告×2：领取后原地变成到账行（不再弹横幅压住面板）----
      if (d.x2Claimed) {
        UI.label(P.W / 2, cy + 14, '✅ 已翻倍 · 额外 +' + U.fmt(d.total) + '🪙 到账', { size: 25, bold: true, align: 'center', color: '#4cd471' });
        cy += 50;
      } else if (sD.daily.settleX2 < 2) {
        if (UI.button(x + 30, cy, w - 60, 64, '📺 广告×奖励 · 总收入×2 (+' + U.fmt(d.total) + '🪙)', { fontSize: 25, sub: '今日剩' + (2 - sD.daily.settleX2) + '次 · 模拟' })) {
          d.x2Claimed = true;
          sD.daily.settleX2++;
          sD.coin += d.total;
          DG.SAVE.save();
        }
        cy += 76;
      }
      // ---- 矿车追回 ----
      if (d.missedCoin > 0) {
        if (d.missedClaimed) {
          UI.label(P.W / 2, cy + 14, '✅ 矿车追回 +' + U.fmt(d.missedCoin) + '🪙', { size: 25, bold: true, align: 'center', color: '#4cd471' });
          cy += 50;
        } else if (sD.daily.adMissed < 3) {
          if (UI.button(x + 30, cy, w - 60, 64, '📺 追回矿车 +' + U.fmt(d.missedCoin) + '🪙', { fontSize: 25, sub: '错失撤离×' + d.missedMult.toFixed(1) + ' · 看广告拿回(模拟)' })) {
            DG.D.adStub('missed_cart', function () { DG.Run.claimMissed(d); });
          }
          cy += 76;
        }
      }
      // ---- 奖励与发现（最多3行，超宽自动压缩）----
      for (var g = 0; g < d.granted.length && g < 3; g++) {
        UI.label(P.W / 2, cy, d.granted[g], { size: 22, align: 'center', color: '#8fd0ff', maxW: w - 50 });
        cy += 34;
      }
      // ---- 就差一点 ----
      if (hooks.length) {
        cy += 6;
        UI.label(P.W / 2, cy, '— 就差一点 —', { size: 20, align: 'center', color: UI.C.dim });
        cy += 32;
        for (var hk = 0; hk < hooks.length; hk++) {
          UI.label(P.W / 2, cy, hooks[hk], { size: 24, bold: true, align: 'center', color: '#ffd76a', maxW: w - 50 });
          cy += 36;
        }
      }
      // ---- 排行 / 分享 ----
      cy += 10;
      if (UI.button(x + 30, cy, (w - 80) / 2, 60, '排行榜', { color: '#3a4356', txtColor: '#fff', fontSize: 25, glyph: 'ui_trophy' })) {
        DG.D.track('rank_view');
        DG.FX.banner('🏆 好友排行 · 上线微信后开放', { pri: true });
      }
      if (UI.button(x + w / 2 + 10, cy, (w - 80) / 2, 60, '分享战报', { color: '#3a4356', txtColor: '#fff', fontSize: 25, glyph: 'ui_share' })) {
        DG.D.track('share_settle');
        DG.FX.banner('📤 战报已生成 · 分享给好友 (模拟)', { pri: true });
      }
      cy += 70;
      // ---- 明日预告（面板内底部）----
      var tm = DG.D.modOfKey(U.dayKeyOffset(1));
      var ni = sD.signDay % 7;
      var preLine = !sD.daily.signed
        ? '📅 还没签到 · 回基地领 ' + DG.D.signin7[ni].txt
        : '🌙 明日 ' + tm.name + ' · 可签第' + (ni + 1) + '天 · 首局又×2';
      UI.label(P.W / 2, cy + 12, preLine, { size: 21, align: 'center', color: (!sD.daily.signed || ni === 3 || ni === 6) ? '#ffd76a' : UI.C.dim, maxW: P.W - 90 });
      // ---- 面板下方：两个大按钮 ----
      var btnY = Math.min(y + estH + 14, P.H - btnH - 16);
      if (UI.button(40, btnY, (P.W - 100) / 2, btnH, '🔄 再来一局', { fontSize: 32, sub: !d.challenge ? '🔥赠' + (hotStreak >= 2 ? '🌀' : hotStreak === 1 ? '💣' : '🚀') : null })) {
        if (!d.challenge) hotStreak++;
        DG.Main.go('run', { hot: true, challenge: d.challenge });
      }
      if (UI.button(60 + (P.W - 100) / 2, btnY, (P.W - 100) / 2, btnH, '🏠 回基地', { color: '#3a4356', txtColor: '#fff', fontSize: 32 })) { hotStreak = 0; DG.Main.go('home'); }
    }
  });
})();
