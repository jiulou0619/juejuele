/* run.js — 单局(run)状态机：耐久、连击、Fever、地层推进、三选一、事件、结算
 * 状态：play / perk / event / settle
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U, T = null;
  var R = {};
  DG.Run = R;

  var COMBO_WORDS = [[20, '神级!!'], [15, '疯狂!'], [10, '华丽!'], [5, '漂亮'], [3, '不错']];

  R.newRun = function (arg) {
    T = DG.D.tune;
    DG.D.resetGen();
    var B = DG.D.calcBonuses();
    R.state = 'play';
    R.newbie = DG.SAVE.d.runCount < 3;   // 新手保护：前3局耗损减半、岩浆宽限+2s
    R.mods = {};                    // 局内强化修改器（perk/fever写入，grid/data读取）
    R.time = 0;                     // 本局时长（FTUE硬保证用）
    R.critCount = 0;                // 暴击次数
    R.burstAcc = 0; R.burstT = 0; R.peakClear = 0; R.mergeCount = 0; // 高光统计
    // 前3局必爽包
    R.ftue = (!(arg && arg.challenge) && DG.D.ftue[DG.SAVE.d.runCount]) || null;
    if (R.ftue) {
      if (R.ftue.rocketAt) R.mods.rocketAt = R.ftue.rocketAt;
      if (R.ftue.feverGain) R.mods.feverGain = R.ftue.feverGain;
      if (R.ftue.comboWin) R.mods.comboWin = R.ftue.comboWin;
      if (R.ftue.digCost) R.mods.digCost = R.ftue.digCost;
    }
    // 模式：普通局吃"今日矿情"，每日挑战局吃2条挑战修饰符
    R.challenge = !!(arg && arg.challenge);
    R.dayMod = R.challenge ? null : DG.D.todayMod();
    R.chMods = R.challenge ? DG.D.todayChallenge() : [];
    var rates = { rockMul: 1, tntMul: 1, poisonMul: 1, oreMul: 1, repairMul: 1, iceAll: 0, oreAdd: 0 };
    var srcs = R.dayMod ? [R.dayMod] : R.chMods;
    R.dayComboWin = 0; R.dayFeverMul = 1; R.dayDepthMul = 1; R.dayRockCoin = 0; R.lavaFrom = 0;
    var durDelta = 0;
    for (var si = 0; si < srcs.length; si++) {
      var md = srcs[si];
      if (md.rockMul != null) rates.rockMul *= md.rockMul;
      if (md.tntMul != null) rates.tntMul *= md.tntMul;
      if (md.poisonMul != null) rates.poisonMul *= md.poisonMul;
      if (md.oreMul != null) rates.oreMul *= md.oreMul;
      if (md.repairMul != null) rates.repairMul *= md.repairMul;
      if (md.iceAll) rates.iceAll = Math.max(rates.iceAll, md.iceAll);
      if (md.comboWin) R.dayComboWin += md.comboWin;
      if (md.feverMul) R.dayFeverMul *= md.feverMul;
      if (md.depthMul) R.dayDepthMul *= md.depthMul;
      if (md.rockCoin) R.dayRockCoin += md.rockCoin;
      if (md.durDelta) durDelta += md.durDelta;
      if (md.lavaFrom) R.lavaFrom = md.lavaFrom;
    }
    R.rates = rates;
    if (R.ftue && R.ftue.goldAdd) R.rates.oreAdd += R.ftue.goldAdd;
    R.durMax = Math.round(Math.max(40, T.durBase + (B.durMax || 0) + durDelta)); // 取整，别出现101.6这种数
    R.dur = R.durMax;
    R.exitMult = 1 + (DG.D.monthlyActive(DG.SAVE.d) ? 0.1 : 0); // 撤离倍率：100m起每50m累积；月卡开局+0.1
    R.initCells = 0;
    R.m = 0; R.lastMile = 0;
    R.stratum = 0;
    R.coins = 0;                    // 局内拾取金币
    R.score = 0;
    R.combo = 0; R.comboT = 0; R.comboPeak = 0;
    R.fever = 0; R.feverT = 0; R.feverCount = 0;
    R.fossilN = 0; R.healN = 0;                 // 每局化石上限 / 回血递减计数
    R.giftT = 0;                                // 开局赠礼演出倒计时
    R.itemsUsed = 0; R.oreGot = 0; R.blocksCleared = 0;
    R.perks = []; R.perkChoices = null; R.pendingPerks = 0;
    R.tagSetDone = {};              // 已激活的流派羁绊
    R.offer = null; R.offers = [];   // 不暂停的悬浮事件卡（当前+排队）
    R.merchantMet = 0;
    R.reviveCount = 0;
    R.lavaIdle = 0; R.burning = false; R.burnTotal = 0;
    R.deadCheckT = 0.5;
    R.settleData = null;
    R.pendingSpecials = [];
    R.evQueue = [];        // 排队中的事件（当前有浮层时先入队）
    R.pendingPerks = null; // 排队中的三选一
    R.codexFound = [];     // 本局图鉴新发现（结算汇总展示）
    R.acc = { coin: 0, gem: 0, dur: 0, t: 0 }; // 飘字聚合器（金币/星钻/耐久增减）
    R.coinLog = {};
    // 局前补给消耗（挑战局不生效不消耗，保持公平）
    var sup = DG.SAVE.d.supplies || {};
    if (!R.challenge && (sup.rocket || sup.armor || sup.nose)) {
      if (sup.armor) { R.durMax += 25; R.dur = R.durMax; }
      if (sup.nose) R.mods.coinMul = (R.mods.coinMul || 1) * 1.3;
      if (sup.rocket) R.pendingSpecials.push('rocket');
      DG.SAVE.d.supplies = {};
      DG.SAVE.save();
      DG.FX.banner('🎒 补给已装备!', { color: '#8fd0ff', size: 44, life: 1.2 });
    }
  };

  /* 浮层(三选一)关闭后：弹出排队内容，否则回到 play */
  function drainOverlays() {
    if (R.pendingPerks && R.pendingPerks.length) {
      R.perkChoices = R.pendingPerks; R.pendingPerks = null;
      R.perk4 = R.pendingPerk4 || null; R.pendingPerk4 = null;
      R.state = 'perk'; return;
    }
    R.state = 'play';
  }

  R.comboWindow = function () {
    var B = DG.D.bonusCache;
    return Math.max(1.2, T.comboWindow + (B.comboWin || 0) + (R.mods.comboWin || 0) + (R.dayComboWin || 0));
  };
  R.comboMul = function () { return Math.min(T.comboMulCap, 1 + 0.1 * R.combo); };

  /* 局内金币入账（含各乘区）。飘字不再逐笔冒——0.6秒窗口内聚合成一条 */
  function gainCoin(n, x, y, why) {
    var mul = (R.mods.coinMul || 1) * (R.mods.feverOn ? 2 : 1);
    n = Math.round(n * mul);
    if (n <= 0) return;
    R.coins += n;
    R.coinLog = R.coinLog || {};
    R.coinLog[why || '?'] = (R.coinLog[why || '?'] || 0) + n;
    R.acc.coin += n; R.acc.t = 0.6;
    DG.A.sfx('coin');
  }

  /* 聚合飘字：金币/星钻在左上钱包处冒一条；耐久净变化在左下耐久条上方冒一条 */
  function flushAcc() {
    if (R.acc.coin || R.acc.gem) {
      var parts = [];
      if (R.acc.coin) parts.push('+' + U.fmt(R.acc.coin) + '🪙');
      if (R.acc.gem) parts.push('+' + R.acc.gem + '💎');
      DG.FX.text(96, DG.P.safeTop + 104, parts.join(' '), { color: '#ffd76a', size: 28, life: 1.0, speed: 40 });
      R.acc.coin = 0; R.acc.gem = 0;
    }
    if (R.acc.dur) {
      DG.FX.text(150, DG.P.H - 172, (R.acc.dur > 0 ? '+' : '') + R.acc.dur + '⛏', { color: R.acc.dur > 0 ? '#4cd471' : '#ff7a6a', size: 30, life: 1.0, speed: 40 });
      R.acc.dur = 0;
    }
  }

  function codexFind(id, x, y) {
    var s = DG.SAVE.d;
    if (s.codex[id]) return;
    var entry = null;
    for (var i = 0; i < DG.D.codex.length; i++) if (DG.D.codex[i].id === id) entry = DG.D.codex[i];
    if (!entry) return;
    s.codex[id] = 1;
    s.gem += entry.gem;
    // 并入聚合飘字，完整名字进结算汇总（图鉴发现不再单独冒字）
    if (R.acc) { R.acc.gem += entry.gem; R.acc.t = 0.6; }
    R.codexFound = R.codexFound || [];
    R.codexFound.push(entry.glyph + entry.name);
    DG.SAVE.save();
  }

  function feverGain(n, viaSpecial) {
    var B = DG.D.bonusCache;
    var g = (n + Math.max(0, n - 4) * 2) * (R.mods.feverGain || 1) * (1 + (B.feverChargePct || 0) / 100) * (R.dayFeverMul || 1);
    g = Math.min(g, 30);                        // 单次事件充能封顶：TNT连锁一炮灌满→永动机
    if (viaSpecial) g *= 0.5;                   // 道具清块半充能（道具本身免耐久，不能再白送狂热）
    g /= (1 + R.feverCount * 0.35);             // 每爆发一次，下次更难充满，狂热无法无缝续杯
    if (!R.mods.feverOn) {
      R.fever += g;
      if (R.fever >= T.feverMax) startFever();
    }
  }

  function startFever() {
    R.fever = T.feverMax;
    R.mods.feverOn = true;
    var B = DG.D.bonusCache;
    R.feverT = T.feverDur + (B.feverDur || 0) + (R.mods.feverDurPlus || 0);
    R.feverCount++;
    DG.SAVE.d.daily.stats.fever++;
    DG.FX.banner('🔥 狂热爆发 🔥', { color: '#ff8f3f', size: 84, life: 1.4, pri: true });
    DG.FX.flash('#ff8f3f', 0.25);
    DG.FX.shake(10, 0.3);
    DG.A.sfx('fever_start', { vibrate: true, strong: true });
    codexFind('fever');
  }
  function endFever() {
    R.mods.feverOn = false;
    R.fever = T.feverMax * (R.mods.feverKeep || 0); // 强化:狂热余烬
    R.feverT = 0;
    DG.A.sfx('fever_end');
  }

  function comboUp(cx, cy) {
    R.comboT = R.comboWindow();
    R.combo++;
    if (R.combo > R.comboPeak) R.comboPeak = R.combo;
    // 连击词只在跨档瞬间冒一次（3/5/10/15/20），平时看右上角计数即可
    if (R.combo === 3 || R.combo === 5 || R.combo === 10 || R.combo === 15 || R.combo === 20) {
      var word = '';
      for (var i = 0; i < COMBO_WORDS.length; i++) if (R.combo >= COMBO_WORDS[i][0]) { word = COMBO_WORDS[i][1]; break; }
      var size = Math.min(56, 32 + R.combo * 2);
      DG.FX.text(cx, cy - 50, word + ' x' + R.combo, { color: R.combo >= 10 ? '#ff6b4a' : '#ffcf3f', size: size });
      DG.A.sfx('combo_up');
    }
    if (R.combo === 10) codexFind('combo10');
    // 连击≥5：热浪破冰 + 全屏净化毒块
    if (R.combo === 5) purifyBoard();
  }

  /* 连击5：破全场冰壳；瓦斯层净化毒块每块+8金 */
  function purifyBoard() {
    var G = DG.Grid, n = 0, ice = 0;
    for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
      var cell = G.at(r, c);
      if (!cell) continue;
      if (cell.ice > 0) { cell.ice = 0; ice++; }
      if (cell.kind === 'block' && cell.t === 'poison') {
        var p = G.cellXY(r, c);
        G.cells[r][c] = null;
        gainCoin(8, p.x + G.cell / 2, p.y + G.cell / 2, 'purify');
        n++;
      }
    }
    if (n > 0 || ice > 0) {
      DG.FX.banner(n > 0 ? '🕊️ 全屏净化!' : '🌊 热浪破冰!', { color: '#8fd0ff', size: 60, pri: true });
      DG.A.sfx('purify', { vibrate: true });
      if (n > 0) codexFind('purify');
      G.collapse();
    }
  }

  /* ---------- 处理棋盘事件 ---------- */
  R.handleEvents = function (evs, viaSpecial) {
    var s = DG.SAVE.d, B = DG.D.bonusCache;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.ev === 'clear') {
        R.blocksCleared += e.n;
        s.daily.stats.blocks += e.n;
        codexFind(e.color, e.cx, e.cy);
        var base = (10 + Math.min(400, R.m) * 0.2) * e.n * (1 + 0.15 * Math.max(0, e.n - 3)) * R.comboMul() * (R.mods.feverOn ? 2 : 1);
        R.score += Math.round(base);
        // 暴击判定提前：暴击与得分合并成一条飘字
        var crit = !R.mods.feverOn && e.n >= 3 && Math.random() < T.critP;
        if (crit) {
          R.score += Math.round(base * 2);
          R.critCount++;
          gainCoin(2 * Math.min(30, e.n), e.cx, e.cy, 'crit');
          DG.FX.text(e.cx, e.cy, '💥暴击 +' + U.fmt(Math.round(base * 3)), { color: '#ffd76a', size: 44 });
          DG.FX.shake(6, 0.12);
          DG.A.sfx('pop_l', { vibrate: true });
        } else if (e.n >= 5) {
          // 小消除(3~4连)不冒分数字，靠粒子+音效反馈；≥5连才值得冒
          DG.FX.text(e.cx, e.cy, '+' + U.fmt(Math.round(base)), { color: e.n >= 9 ? '#ff9f4a' : '#ffcf3f', size: e.n >= 9 ? 42 : 32 });
        }
        if (e.n >= 6) {
          DG.FX.shake(e.n >= 9 ? 8 : 4, 0.15);
          DG.FX.spr(e.cx, e.cy, e.n >= 9 ? 'fx_pop_m' : 'fx_pop_s', e.n >= 9 ? 240 : 170, 0.4);
          DG.A.sfx(e.n >= 9 ? 'pop_l' : 'pop_m', { vibrate: true });
        }
        else DG.A.sfx('pop_s');
        R.burstAcc += e.n; if (R.burstT <= 0) R.burstT = 0.9;
        feverGain(e.n, viaSpecial);
        // 强化：≥8块消除15%掉道具
        if (R.mods.dropOn8 && e.n >= 8 && Math.random() < 0.15) R.pendingSpecials.push(U.pick(['rocket', 'bomb', 'drill']));
      }
      else if (e.ev === 'dig') { R.blocksCleared++; s.daily.stats.blocks++; DG.FX.spr(e.cx, e.cy, 'fx_dirt', 120, 0.35); DG.A.sfx('dig', { vibrate: true }); }
      else if (e.ev === 'gold') {
        R.oreGot++; s.daily.stats.ore++;
        var li = DG.D.stratumIndex(R.m);
        gainCoin(1 + li, e.x, e.y, 'ore');
        R.dur = Math.min(R.durMax, R.dur + 1);
        codexFind('gold', e.x, e.y);
      }
      else if (e.ev === 'repair') {
        R.dur = Math.min(R.durMax, R.dur + 15);
        R.acc.dur += 15; R.acc.t = 0.6;
        codexFind('repair', e.x, e.y);
      }
      else if (e.ev === 'fossil') {
        gainCoin(30, e.x, e.y, 'fossil');
        codexFind('fossil', e.x, e.y);
        // 每局化石出土上限：超过后只给金币，不再刷屏/攒星尘
        R.fossilN++;
        if (R.fossilN > 8) { gainCoin(60, e.x, e.y, 'fossil'); continue; }
        // 化石收藏：按深度roll品质（绿/紫/橙）
        var fo = DG.D.rollFossil(R.m);
        var ft = DG.D.fossilTiers[fo.tier];
        var isNewF = !s.fossils[fo.id];
        s.fossils[fo.id] = (s.fossils[fo.id] || 0) + 1;
        if (isNewF) s.gem += ft.gem;
        else { // 重复化石：星尘每日封顶，超出转等值金币（否则刷浅层化石可日产1500+，所有定价失效）
          var fc = s.daily.fossilDust || 0;
          if (fc < DG.D.dust.fossilDailyCap) { s.dust += ft.dust; s.daily.fossilDust = fc + ft.dust; }
          else gainCoin(ft.dust * 3, e.x, e.y, 'fossil');
        }
        DG.FX.banner('🦴 ' + fo.name, { color: ft.color, size: 48, life: 1.8, pri: true });
        DG.FX.text(e.x, e.y - 54, isNewF ? '✨NEW +' + ft.gem + '💎' : '重复 → ✨+' + ft.dust, { color: ft.color, size: 30, life: 1.4 });
        DG.FX.spr(e.x, e.y, fo.id, 300, 1.1);
        DG.FX.shake(fo.tier === 'orange' ? 12 : 6, 0.3);
        DG.A.sfx(fo.tier === 'orange' ? 'box_ssr' : 'milestone', { vibrate: true, strong: fo.tier !== 'green' });
        DG.D.calcBonuses();
        DG.SAVE.save();
      }
      else if (e.ev === 'poison') {
        // 道具炸毒块=安全处理，不掉耐久（有炼毒术强化还+30金）；只有普通消除/波及才中毒
        if (viaSpecial) { if (R.mods.poisonBonus) gainCoin(30, e.x, e.y, 'poison'); }
        else { R.dur -= T.durCostPoison; R.acc.dur -= T.durCostPoison; R.acc.t = 0.6; }
        codexFind('poison', e.x, e.y);
        DG.A.sfx('poison');
      }
      else if (e.ev === 'ice') { codexFind('ice', e.x, e.y); DG.A.sfx('ice'); }
      else if (e.ev === 'tnt') { codexFind('tnt'); DG.A.sfx('tnt', { vibrate: true }); }
      else if (e.ev === 'obstacle' && e.dead) { if (e.id === 'rock') { gainCoin(1 + (R.dayRockCoin || 0), e.x, e.y, 'rock'); codexFind('rock', e.x, e.y); } }
      else if (e.ev === 'special_spawn') {
        codexFind('sp_' + (e.sp === 'hrocket' ? 'rocket' : e.sp === 'bigbomb' ? 'bomb' : e.sp));
        // 只在新手期报"名字·作用"；熟练后道具亮相本身就是反馈，不冒字
        if (e.x != null && s.ftue < 4) {
          var spd = DG.D.specials[e.sp];
          DG.FX.text(e.x, e.y - 30, spd.name + '·' + spd.desc, { color: '#8fd0ff', size: 24, life: 1.0 });
        }
        DG.A.sfx('merge');
      }
      else if (e.ev === 'special_fire') {
        R.itemsUsed++; s.daily.stats.items++;
        // 道具清块小额金币；军火专家(powerPct)与爆破羁绊放大
        gainCoin(Math.round(e.n * 0.1 * (1 + (B.powerPct || 0) / 100) * (R.mods.blastSet ? 1.5 : 1)), e.cx, e.cy, 'special');
        DG.A.sfx(e.sp === 'nuke' || e.sp === 'bigbomb' ? 'blast_l' : e.sp === 'bomb' ? 'blast_m' : 'blast_s', { vibrate: true, strong: true });
        if (e.sp === 'nuke') codexFind('nuke');
        // 爆炸贴图特效
        var fxId = (e.sp === 'rainbow' || e.sp === 'rainbow2') ? 'fx_rainbow_l'
          : (e.sp === 'bomb' || e.sp === 'bigbomb' || e.sp === 'nuke' || e.sp === 'bigcross') ? 'fx_blast' : 'fx_pop_m';
        DG.FX.spr(e.cx, e.cy, fxId, e.sp === 'nuke' ? 420 : e.sp === 'bigbomb' ? 320 : 220, 0.5);
        R.burstAcc += e.n; if (R.burstT <= 0) R.burstT = 0.9;
        feverGain(Math.min(8, e.n), true);
      }
      else if (e.ev === 'event') { triggerEvent(e.id); }
      else if (e.ev === 'puzzle_piece') {
        if (s.puzzleDone >= DG.D.puzzles.length) {
          gainCoin(200, null, null, 'puzzle');
          DG.FX.banner('🧩 密室已通 → 🪙200', { color: '#8fd0ff', size: 44 });
        } else {
          s.piece++;
          DG.FX.banner('🧩 拼图碎片 +1', { color: '#8fd0ff', size: 52 });
        }
        codexFind('ev_puzzle');
        DG.SAVE.save();
      }
    }
  };

  /* ---------- 点击入口（scene_run 调用） ---------- */
  R.tapAt = function (r, c) {
    if (R.state !== 'play' || DG.Grid.busy > 0.06) return;
    var G = DG.Grid;
    var cell = G.at(r, c);
    if (!cell) return;
    R.lavaIdle = 0;

    if (cell.kind === 'special') {
      var res = G.fireSpecial(r, c);
      R.handleEvents(res.evs, true);
      comboUp(G.cellXY(r, c).x, G.cellXY(r, c).y);
      afterAction();
      return;
    }
    var group = G.groupAt(r, c);
    var min = R.mods.feverOn ? 2 : T.matchMin;
    var deepCost = Math.floor(R.m / 130); // 越深每铲越费镐：130m起+1——后段压力上来，复活/补给的价值随深度陡升
    if (cell.kind === 'color' && group.length >= min) {
      var res2 = G.popGroup(r, c);
      if (!R.mods.feverOn) spendDur(T.durCostPop + deepCost);
      R.handleEvents(res2.evs, false);
      var p = G.cellXY(r, c);
      comboUp(p.x + G.cell / 2, p.y);
    } else {
      // 单敲硬掘：保底永不卡死
      var cost = (cell.kind === 'block' && cell.t === 'rock' ? T.durCostRock : (R.mods.digCost || T.durCostDig)) + deepCost;
      if (R.mods.feverOn) cost = 0;
      var res3 = G.digSingle(r, c);
      spendDur(cost);
      R.handleEvents(res3.evs, false);
    }
    afterAction();
  };

  R.dragMerge = function (r1, c1, r2, c2) {
    if (R.state !== 'play') return false;
    var res = DG.Grid.mergeSpecials(r1, c1, r2, c2);
    if (!res) return false;
    R.lavaIdle = 0;
    var mxy = DG.Grid.cellXY(r2, c2);
    DG.FX.text(mxy.x + DG.Grid.cell / 2, mxy.y, '🧪 合并!', { color: '#b678ff', size: 40 });
    DG.A.sfx('merge', { vibrate: true, strong: true });
    R.mergeCount++;
    codexFind('merge');
    R.handleEvents(res.evs, true);
    comboUp(DG.P.W / 2, DG.P.H / 2);
    afterAction();
    return true;
  };

  /* 特殊道具移动引爆（拖到普通格） */
  R.dragFire = function (r1, c1, r2, c2) {
    if (R.state !== 'play') return false;
    var G = DG.Grid;
    var a = G.at(r1, c1);
    if (!a || a.kind !== 'special') return false;
    var sp = a.sp;
    G.cells[r1][c1] = null;
    R.lavaIdle = 0;
    var res = G.fireSpecial(r2, c2, sp);
    R.handleEvents(res.evs, true);
    comboUp(G.cellXY(r2, c2).x, G.cellXY(r2, c2).y);
    afterAction();
    return true;
  };

  function spendDur(n) {
    if (n <= 0) return;
    if (R.newbie) n = Math.ceil(n / 2); // 新手保护
    R.dur -= n;
    if (R.dur <= R.durMax * 0.25) DG.A.sfx('hurt');
  }

  /* 局内回血递减：里程碑/过层/修镐共用计数，越到后期回得越少，耐久始终是真正的沙漏 */
  function runHeal(base) {
    var h = Math.max(2, Math.round(base * Math.pow(0.85, R.healN)));
    R.healN++;
    return h;
  }

  function afterAction() {
    updateDepth();
    placePendingSpecials();
    if (R.dur <= 0) onDead();
  }

  /* 把待发道具写进棋盘。loud=true 时演出"某个普通方块被替换成道具"的过程（局前补给用） */
  function placePendingSpecials(loud) {
    if (!R.pendingSpecials || !R.pendingSpecials.length) return;
    var G = DG.Grid;
    while (R.pendingSpecials.length) {
      var sp = R.pendingSpecials.shift();
      var spots = [];
      for (var r = 2; r < G.rows - 1; r++) for (var c = 0; c < G.cols; c++) {
        var cell = G.at(r, c);
        if (cell && cell.kind === 'color' && !cell.ice) spots.push([r, c]);
      }
      if (!spots.length) break;
      var s = U.pick(spots);
      var old = G.at(s[0], s[1]);
      var p = G.cellXY(s[0], s[1]);
      var cx = p.x + G.cell / 2, cy = p.y + G.cell / 2;
      G.cells[s[0]][s[1]] = { kind: 'special', sp: sp, fy: 0, spo: G.spOrder++ };
      if (loud) {
        // 原方块炸开 → 道具从碎屑里冒出来，玩家能看清"哪一格变成了道具"
        var col = (old && old.color) || '#c9b79e'; // cell.color 已经是色值
        DG.FX.burst(cx, cy, col, 14, 220);
        DG.FX.spr(cx, cy, 'fx_pop_m', 190, 0.45);
        DG.FX.text(cx, cy - 46, DG.D.specials[sp].name + ' 就位!', { color: '#ffd15c', size: 30, life: 1.3 });
        DG.FX.shake(5, 0.18);
        DG.A.sfx('merge', { vibrate: true, strong: true });
      } else {
        DG.FX.text(cx, cy, '🎁', { size: 40 });
      }
    }
  }

  /* ---------- 深度推进 / 地层 / 里程碑 ---------- */
  function updateDepth() {
    var G = DG.Grid;
    var m = Math.max(0, Math.floor((G.depthRow - G.rows * G.cols) / 8));
    if (m <= R.m) return;
    R.m = m;
    // 每50m里程碑（100m起同时累积撤离倍率 = push-your-luck）
    if (Math.floor(m / 50) > Math.floor(R.lastMile / 50)) {
      var heal = runHeal(R.mods.mileHeal || T.mileHeal);
      R.dur = Math.min(R.durMax, R.dur + heal);
      var mileTxt = Math.floor(m / 50) * 50 + 'm · ⛏+' + heal;
      if (m >= 100) {
        R.exitMult = Math.min(2, R.exitMult + (R.mods.exitStep || 0.1));
        mileTxt += ' · 🏳×' + R.exitMult.toFixed(1);
      }
      DG.FX.banner(mileTxt, { color: '#4cd471', size: 44, life: 1.3 });
      DG.A.sfx('milestone', { vibrate: true });
    }
    R.lastMile = m;
    if (m >= 100) codexFind('m100');
    if (m >= 200) codexFind('m200');
    // 地层推进
    var idx = DG.D.stratumIndex(m);
    var deepPerk = m >= 180 && Math.floor((m - 180) / 50) + 4 > R.stratum; // 无尽段每50m一次
    if (idx > R.stratum || deepPerk) {
      R.stratum = deepPerk ? R.stratum + 1 : idx;
      var st = DG.D.stratumAt(m);
      R.dur = Math.min(R.durMax, R.dur + runHeal(T.layerHeal));
      DG.FX.banner('⬇️ ' + st.name + ' ⬇️', { color: '#ffd76a', size: 64, life: 1.6, pri: true });
      DG.A.sfx('layer', { vibrate: true, strong: true });
      // 入层三选一（若当前有事件浮层则排队，防状态互相覆盖）
      var choices = DG.D.rollPerks(R);
      // 第四格诱惑位：抽一张未拥有的金卡（与三选一不重复），锁着展示
      var goldPool = [];
      for (var gp = 0; gp < DG.D.perks.length; gp++) {
        var pp2 = DG.D.perks[gp];
        if (pp2.rar === 'gold' && R.perks.indexOf(pp2.id) < 0 && choices.indexOf(pp2) < 0) goldPool.push(pp2);
      }
      var p4 = (DG.SAVE.d.runCount >= 2 && !R.challenge && goldPool.length) ? DG.U.pick(goldPool) : null; // 前2局与挑战局不推付费位
      if (choices.length) {
        if (R.state === 'play') { R.perkChoices = choices; R.perk4 = p4; R.state = 'perk'; }
        else { R.pendingPerks = choices; R.pendingPerk4 = p4; }
      }
    }
  }

  R.pickPerk = function (i) {
    // -1=都不选修镐；-2=第四格诱惑位(界面层已完成扣费/广告)
    if (i === -1) {
      var skipHeal = runHeal(T.perkSkipHeal);
      R.dur = Math.min(R.durMax, R.dur + skipHeal);
      DG.FX.text(DG.P.W / 2, DG.P.H * 0.4, '🔧 ⛏+' + skipHeal, { color: '#8fd0ff', size: 36 });
      R.perkChoices = null; R.perk4 = null;
      drainOverlays();
      return;
    }
    var p = i === -2 ? R.perk4 : (R.perkChoices && R.perkChoices[i]);
    if (!p) return;
    R.perks.push(p.id);
    p.apply(R.mods, R);   // 选中反馈交给底部◆图标，不再弹横幅（减噪）
    // 同流派第2件 → 激活羁绊
    if (p.tag && !R.tagSetDone[p.tag]) {
      var cnt = 0;
      for (var k = 0; k < R.perks.length; k++) {
        for (var j = 0; j < DG.D.perks.length; j++)
          if (DG.D.perks[j].id === R.perks[k] && DG.D.perks[j].tag === p.tag) cnt++;
      }
      if (cnt >= 2) {
        R.tagSetDone[p.tag] = 1;
        var tg = DG.D.perkTags[p.tag];
        tg.apply(R.mods);
        DG.FX.banner('🔗 【' + tg.name + '】羁绊! ' + tg.bonus, { color: tg.color, size: 48, life: 2, pri: true });
        DG.A.sfx('merge', { vibrate: true, strong: true });
      }
    }
    R.perkChoices = null; R.perk4 = null;
    drainOverlays();
  };

  /* ---------- 局内事件（不暂停版）：宝箱即挖即开；赌石/商人=底部限时悬浮卡，边挖边选 ---------- */
  function triggerEvent(id) {
    DG.A.sfx('event', { vibrate: true });
    codexFind('ev_' + id);
    if (id === 'chest') { resolveChest(); return; }
    if (id === 'goldrush') { resolveGoldrush(); return; }
    R.offers.push(id);
    if (!R.offer) promoteOffer();
  }

  /* 金脉喷发：瞬时爽点——随机6个彩块当场变金矿块，肉眼可见的一片金 */
  function resolveGoldrush() {
    var G = DG.Grid, spots = [];
    for (var r = 2; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
      var cl = G.at(r, c);
      if (cl && cl.kind === 'color' && !cl.ice) spots.push([r, c]);
    }
    U.shuffle(spots);
    var n = Math.min(6, spots.length);
    for (var i = 0; i < n; i++) {
      var p = spots[i];
      G.cells[p[0]][p[1]] = DG.D.makeBlock('gold');
      var xy = G.cellXY(p[0], p[1]);
      DG.FX.burst(xy.x + G.cell / 2, xy.y + G.cell / 2, '#ffd15c', 10, 200);
    }
    DG.FX.banner('💰 金脉喷发! ×' + n, { color: '#ffd15c', size: 56, pri: true });
    DG.FX.shake(8, 0.3);
    DG.A.sfx('milestone', { vibrate: true, strong: true });
  }

  function resolveChest() { // 宝箱是纯礼物，直接开不打断
    var res = DG.D.events.chest.roll(R);
    if (res.coin) gainCoin(res.coin, null, null, 'chest');
    if (res.dur) { R.dur = Math.min(R.durMax, R.dur + res.dur); R.acc.dur += res.dur; R.acc.t = 0.6; }
    if (res.sp) { R.pendingSpecials.push(res.sp); placePendingSpecials(); }
    if (res.piece) {
      if (DG.SAVE.d.puzzleDone >= DG.D.puzzles.length) { gainCoin(res.piece * 200, null, null, 'chest'); res.txt = '🪙' + res.piece * 200 + ' (拼图已全通)'; }
      else DG.SAVE.d.piece += res.piece;
      DG.SAVE.save();
    }
    DG.FX.banner('📦 ' + res.txt, { color: '#ffd76a', size: 44, life: 1.5, pri: !!res.piece });
    DG.A.sfx('box_open', { vibrate: true });
  }

  function promoteOffer() {
    var id = R.offers.shift();
    if (!id) { R.offer = null; return; }
    var E = DG.D.events[id];
    if (id === 'merchant') {
      R.offer = { id: id, t: 12, max: 12, offers: E.offers(R), bought: [] };
      R.merchantMet++;
    } else if (id === 'curse') {
      R.offer = { id: 'curse', t: 10, max: 10 };
    } else {
      R.offer = { id: 'gamble', t: 10, max: 10, stones: 3 };
    }
  }
  R.dismissOffer = function () { promoteOffer(); };

  R.offerBuy = function (i) {
    var o = R.offer;
    if (!o || o.id !== 'merchant') return;
    var it = o.offers[i];
    if (!it || o.bought.indexOf(i) >= 0 || R.coins < it.cost) return;
    R.coins -= it.cost;
    it.act(R);
    o.bought.push(i);
    placePendingSpecials();
    DG.A.sfx('buy', { vibrate: true });
    if (o.bought.length >= o.offers.length) promoteOffer();
  };

  /* 契约石：push-your-luck——献耐久换金币，血少时是艰难抉择 */
  R.offerCurse = function () {
    var o = R.offer;
    if (!o || o.id !== 'curse') return;
    R.dur -= 12;
    R.acc.dur -= 12; R.acc.t = 0.6;
    gainCoin(250, null, null, 'curse');
    DG.FX.banner('🗿 契约达成 🪙250', { color: '#c58cf7', size: 46, pri: true });
    DG.A.sfx('event', { vibrate: true });
    promoteOffer();
    if (R.dur <= 0) onDead();
  };

  R.offerGamble = function () {
    var o = R.offer;
    if (!o || o.id !== 'gamble' || o.stones <= 0 || R.coins < 40) return;
    R.coins -= 40;
    o.stones--;
    var res = DG.D.events.gamble.roll();
    if (res.coin) gainCoin(res.coin, null, null, 'gamble');
    if (res.relic) codexFind('relic');
    var big = res.relic || (res.coin >= 200);
    if (big) DG.FX.banner('❓ ' + res.txt, { color: '#ffd76a', size: 48, pri: true });
    else DG.FX.text(DG.P.W / 2, DG.P.H - 220, res.txt, { color: res.coin >= 80 ? '#ffd76a' : '#9aa4b8', size: 30, life: 1.3 });
    DG.A.sfx(big ? 'wheel_win' : 'dig', { vibrate: true });
    if (o.stones <= 0) promoteOffer();
  };

  /* ---------- 死局兜底：塌方松动 ---------- */
  function checkDeadlock() {
    var G = DG.Grid, r, c;
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) {
      var cell = G.at(r, c);
      if (!cell) continue;
      if (cell.kind === 'special') return;
      if (cell.kind === 'color' && !cell.ice && G.groupAt(r, c).length >= T.matchMin) return;
    }
    // 重排彩色块
    var colors = [];
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) {
      var cl = G.at(r, c);
      if (cl && cl.kind === 'color') colors.push(cl);
    }
    colors = U.shuffle(colors);
    var i = 0;
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) {
      var cl2 = G.at(r, c);
      if (cl2 && cl2.kind === 'color') { G.cells[r][c] = colors[i++]; G.cells[r][c].fy = -20; }
    }
    DG.FX.banner('💨 塌方松动!', { color: '#c8b89a', size: 56, pri: true });
    DG.FX.shake(8, 0.4);
  }

  /* ---------- 帧更新 ---------- */
  R.step = function (dt) {
    if (R.state !== 'play') { flushAcc(); return; }
    R.time += dt;
    // 开局赠礼：棋盘落定后再把某个普通方块变成道具（带炸开演出）
    if (R.giftT > 0) { R.giftT -= dt; if (R.giftT <= 0) placePendingSpecials(true); }
    // 聚合飘字窗口
    if (R.acc.t > 0) { R.acc.t -= dt; if (R.acc.t <= 0) flushAcc(); }
    // 悬浮事件卡计时：不理会就自动溜走
    if (R.offer) {
      R.offer.t -= dt;
      if (R.offer.t <= 0) promoteOffer();
    }
    // 高光统计：固定0.9s爆发窗口（不随新消除续期，否则连打整局都算一次爆发）
    if (R.burstT > 0) {
      R.burstT -= dt;
      if (R.burstT <= 0) { if (R.burstAcc > R.peakClear) R.peakClear = R.burstAcc; R.burstAcc = 0; }
    }
    var chainEvs = DG.Grid.step(dt);
    if (chainEvs.length) {
      R.handleEvents(chainEvs, true);
      updateDepth();
      if (R.dur <= 0 && (R.state === 'play' || R.state === 'event' || R.state === 'perk')) { onDead(); return; } // 连锁伤害也要判死
    }
    // 连击衰减
    if (R.combo > 0) {
      R.comboT -= dt;
      if (R.comboT <= 0) { R.combo = 0; R.comboT = 0; }
    }
    // Fever
    if (R.mods.feverOn) {
      R.feverT -= dt;
      R.fever = T.feverMax * Math.max(0, R.feverT) / (T.feverDur + (DG.D.bonusCache.feverDur || 0));
      if (R.feverT <= 0) endFever();
    }
    // 熔岩层灼烧（每日挑战"岩浆焦土"可提前）
    var st = DG.D.stratumAt(R.m);
    if (st.lava || (R.lavaFrom && R.m >= R.lavaFrom)) {
      R.lavaIdle += dt;
      R.burning = R.lavaIdle > T.lavaIdle + (R.newbie ? 2 : 0);
      if (R.burning) {
        R.dur -= T.lavaDps * dt;
        R.burnTotal += dt;
        if (R.burnTotal > 5) codexFind('survivor');
        if (R.dur <= 0) { onDead(); return; }
      }
    } else R.burning = false;
    // 死局检查（棋盘静止时）
    if (DG.Grid.busy <= 0) {
      R.deadCheckT -= dt;
      if (R.deadCheckT <= 0) { R.deadCheckT = 1.0; checkDeadlock(); }
    }
  };

  /* ---------- 死亡 / 复活 / 撤离 / 结算 ---------- */
  function onDead() {
    R.dur = 0;
    R.offer = null; R.offers.length = 0;
    DG.FX.clear();               // 清掉战斗残留特效，别压在挽留/结算界面上
    DG.FX.shake(12, 0.5);
    DG.A.sfx('dead', { vibrate: true, strong: true });
    R.state = 'dead'; // 总是给复活选择（价格阶梯递增），拒绝后才真正结算
  }

  R.declineRevive = function () { DG.FX.clear(); R.state = 'settle'; R.settleData = R.buildSettle(false); };

  R.canRevive = function () { return true; };
  R.reviveCost = function () { // 第n次复活价：0=看广告
    var lad = DG.D.iap.revive;
    return lad[Math.min(R.reviveCount, lad.length - 1)];
  };
  R.revive = function () { // 扣费/广告由界面层处理；这里只执行复活
    R.reviveCount++;
    R.dur = Math.min(R.durMax, T.reviveDur);
    R.settleData = null;
    R.state = 'play';
    var G = DG.Grid;
    var res = G.fireSpecial(Math.floor(G.rows / 2), Math.floor(G.cols / 2), 'bigbomb');
    R.handleEvents(res.evs, true);
    DG.FX.banner('💪 复活!', { color: '#4cd471', size: 64, pri: true });
    drainOverlays(); // 恢复被死亡打断的事件/三选一
  };

  R.exitRun = function () { R.offer = null; R.offers.length = 0; DG.FX.clear(); R.state = 'settle'; R.settleData = R.buildSettle(true); };

  R.buildSettle = function (exitVoluntary) {
    var s = DG.SAVE.d, B = DG.D.calcBonuses();
    var bonusPct = (B.coinPct || 0) / 100;
    // 深度奖励：500m内线性，之后开方衰减（防无尽段金币爆炸）
    var depthBase = R.m <= 500 ? R.m * 2 : 1000 + Math.round(Math.sqrt(R.m - 500) * 20);
    var depthCoin = Math.round(depthBase * (1 + (B.depthPct || 0) / 100) * (R.dayDepthMul || 1));
    var comboCoin = Math.min(50, R.comboPeak) * 2; // 连击结算封顶
    var raw = R.coins + depthCoin + comboCoin;
    // 满载而归：主动撤离才吃撤离倍率；耐久耗尽只拿基础值（错失奖励而非惩罚）
    var exitMul = exitVoluntary ? R.exitMult : 1;
    var total = Math.round(raw * (1 + bonusPct) * exitMul);
    var first = s.daily.firstRun;
    if (first) total *= 2;
    // 矿车追回：镐碎错失的那笔钱，精确到个位（广告可追回）
    var missedCoin = 0;
    if (!exitVoluntary && R.exitMult > 1) {
      missedCoin = Math.round(raw * (1 + bonusPct) * R.exitMult) * (first ? 2 : 1) - total;
    }
    var newRecord = R.m > s.bestM;

    // 写档
    s.daily.firstRun = false;
    s.coin += total;
    s.runCount++;
    s.cumM += R.m;
    s.daily.stats.m += R.m;
    s.daily.stats.runs++;
    // 当日累挖600m→转盘券（结算时立刻发，不再依赖回到主界面时检查）
    var gotDigTicket = false;
    if (s.daily.stats.m >= 600 && !s.daily.wheelDigUsed) {
      s.daily.wheelDigUsed = true;
      s.ticket++;
      gotDigTicket = true;
    }
    if (R.m > s.bestM) s.bestM = R.m;
    if (R.score > s.bestScore) s.bestScore = R.score;

    // 里程碑
    var granted = [];
    if (R.codexFound && R.codexFound.length) granted.push('📖 新发现×' + R.codexFound.length + ': ' + R.codexFound.slice(0, 3).join('、') + (R.codexFound.length > 3 ? '…' : ''));
    if (gotDigTicket) granted.push('今日累挖600m → 🎫转盘券×1');
    // 每日挑战奖励（每日一次；挑战局挖到100m追加盲盒钥匙）
    if (R.challenge) {
      if (R.m > (s.daily.chBest || 0)) s.daily.chBest = R.m;
      if (!s.daily.chDone) {
        s.daily.chDone = true;
        grantGive(DG.D.challengeReward);
        granted.push('⚔️ 每日挑战完成 → ' + giveTxt(DG.D.challengeReward));
      }
      if (R.m >= 100 && !s.daily.chDeep) {
        s.daily.chDeep = true;
        grantGive(DG.D.challengeDeepReward);
        granted.push('⚔️ 挑战深潜100m → ' + giveTxt(DG.D.challengeDeepReward));
      }
    }
    var i, mi;
    for (i = 0; i < DG.D.milesCum.length; i++) {
      mi = DG.D.milesCum[i];
      if (s.cumM >= mi.m && s.milesCumDone.indexOf(mi.m) < 0) { s.milesCumDone.push(mi.m); grantGive(mi.give); granted.push(mi.txt + ' → ' + giveTxt(mi.give)); }
    }
    for (i = 0; i < DG.D.milesRun.length; i++) {
      mi = DG.D.milesRun[i];
      if (s.bestM >= mi.m && s.milesRunDone.indexOf(mi.m) < 0) { s.milesRunDone.push(mi.m); grantGive(mi.give); granted.push(mi.txt + ' → ' + giveTxt(mi.give)); }
    }
    DG.SAVE.save();
    return {
      m: R.m, score: R.score, comboPeak: R.comboPeak, comboCoin: comboCoin, picked: R.coins,
      depthCoin: depthCoin, bonusPct: Math.round(bonusPct * 100), total: total,
      first: first, granted: granted, newRecord: newRecord, fever: R.feverCount,
      exitMul: exitMul, exitVoluntary: !!exitVoluntary, missedMult: !exitVoluntary && R.exitMult > 1 ? R.exitMult : 0,
      missedCoin: missedCoin, missedClaimed: false,
      challenge: R.challenge,
      highlight: R.peakClear >= 12 ? '一次轰掉 ' + R.peakClear + ' 块!'
        : R.comboPeak >= 8 ? R.comboPeak + ' 连击不断线!'
        : R.critCount >= 2 ? '暴击 ' + R.critCount + ' 次!'
        : R.feverCount >= 3 ? '狂热×' + R.feverCount + '!' : null
    };
  };

  /* 矿车追回：看广告拿回镐碎错失的撤离奖励 */
  R.claimMissed = function (d) {
    if (d.missedClaimed || d.missedCoin <= 0) return;
    d.missedClaimed = true;
    var s = DG.SAVE.d;
    s.coin += d.missedCoin;
    s.daily.adMissed++;
    DG.D.track('claim_missed');
    DG.A.sfx('coin', { vibrate: true });  // 面板内✅行即反馈，不再弹横幅压面板
    DG.SAVE.save();
  };

  /* 供场景层调用的引导/连局接口 */
  R.forceFever = startFever;
  R.flushSpecials = placePendingSpecials;
  /* 开局赠礼延时演出：等棋盘落定再把方块变成道具，玩家才看得见"哪一格变了" */
  R.armGiftFx = function (delay) { if (R.pendingSpecials.length) R.giftT = delay || 0.55; };

  /* 拼图全通后，碎片产出全部折算成金币（转盘/宝箱/密室还在产，不能让它变成第二个死资源） */
  var PIECE_COIN = 200;
  function puzzleAllDone() { return DG.SAVE.d.puzzleDone >= DG.D.puzzles.length; }
  R.puzzlePieceCoin = PIECE_COIN;

  function grantGive(g) {
    var s = DG.SAVE.d;
    if (g.coin) s.coin += g.coin;
    if (g.gem) s.gem += g.gem;
    if (g.boxkey) s.boxkey += g.boxkey;
    if (g.dust) s.dust += g.dust;
    if (g.piece) { if (puzzleAllDone()) s.coin += g.piece * PIECE_COIN; else s.piece += g.piece; }
    if (g.ticket) s.ticket += g.ticket;
    if (g.ssrTicket) s.ssrTicket = (s.ssrTicket || 0) + g.ssrTicket;
    if (g.skin && s.skins.indexOf(g.skin) < 0) s.skins.push(g.skin);
  }
  R.grantGive = grantGive;
  function giveTxt(g) {
    var out = [];
    if (g.coin) out.push('🪙' + g.coin);
    if (g.gem) out.push('💎' + g.gem);
    if (g.boxkey) out.push('🔑' + g.boxkey);
    if (g.dust) out.push('✨' + g.dust);
    if (g.piece) out.push(puzzleAllDone() ? '🪙' + g.piece * PIECE_COIN : '🧩' + g.piece);
    if (g.ticket) out.push('🎫' + g.ticket);
    if (g.ssrTicket) out.push('SSR自选券');
    if (g.skin) out.push('皮肤!');
    return out.join(' ');
  }
  R.giveTxt = giveTxt;
})();
