/* data.js — 全部内容配置与数值（调参只改这里）
 * 依据《掘掘乐》最终设计文档 v1.0（裁定版）
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U, A = DG.A;
  var D = {};
  DG.D = D;

  /* ================= 核心数值 ================= */
  D.tune = {
    cols: 8,
    matchMin: 3,          // ≥3连通整组消除
    comboWindow: 2.5,     // 连击窗口秒（可被商店/强化加长）
    comboMulCap: 3.0,     // 连击得分倍率上限
    durBase: 100,         // 镐耐久基础
    durCostPop: 1,        // 整组消除耗
    durCostDig: 3,        // 单敲耗
    durCostRock: 5,       // 单敲硬岩耗
    durCostPoison: 3,     // 毒块被消耗
    feverMax: 120,        // Fever 能量槽
    feverDur: 8,          // Fever 基础秒数
    feverDurCap: 12,
    layerHeal: 20,        // 过层回复（调局长主旋钮）
    mileHeal: 10,         // 每50m里程碑回复
    lavaIdle: 4,          // 熔岩层：停顿几秒后开始灼烧
    lavaDps: 5,           // 灼烧 耐久/秒
    reviveDur: 60,        // 复活回复耐久
    spCap: 6,             // 场上特殊道具上限
    critP: 0.04,          // 暴击消除概率（非Fever期）
    perkSkipHeal: 15      // 三选一"都不选"修镐回复
  };

  /* 前3局新手必爽包（按 runCount 索引；挑战局不生效） */
  D.ftue = [
    { rocketAt: 3, feverGain: 1.25, comboWin: 0.5, digCost: 1, colors3: 24, goldAdd: 0.03, feverForceAt: 75, mergeGiftAt: 45 },
    { rocketAt: 4, feverGain: 1.10, comboWin: 0.5, digCost: 2 },
    { comboWin: 0.3 }
  ];

  /* ================= 方块颜色（5色，双编码：色+emoji） ================= */
  D.colors = {
    red:    { color: '#d95763', glyph: '🟥' },
    blue:   { color: '#4a90d9', glyph: '🟦' },
    green:  { color: '#57a85c', glyph: '🟩' },
    yellow: { color: '#d9a743', glyph: '🟨' },
    purple: { color: '#9a6bd9', glyph: '🟪' }
  };
  A.def('block_red',    { glyph: '🟥', color: '#d95763', art: '红色矿土方块 90x90，含轻微裂纹纹理', size: '90x90' });
  A.def('block_blue',   { glyph: '🟦', color: '#4a90d9', art: '蓝色矿土方块 90x90', size: '90x90' });
  A.def('block_green',  { glyph: '🟩', color: '#57a85c', art: '绿色矿土方块 90x90', size: '90x90' });
  A.def('block_yellow', { glyph: '🟨', color: '#d9a743', art: '黄色矿土方块 90x90', size: '90x90' });
  A.def('block_purple', { glyph: '🟪', color: '#9a6bd9', art: '紫色矿土方块 90x90', size: '90x90' });

  /* ================= 特殊道具 ================= */
  D.specials = {
    rocket:  { glyph: '🚀', name: '火箭↕',  desc: '清除一整列' },
    bomb:    { glyph: '💣', name: '炸弹',   desc: '小范围3×3' },
    bigbomb: { glyph: '💥', name: '大爆炸', desc: '大范围5×5' },
    drill:   { glyph: '🌀', name: '钻地机', desc: '向下钻穿3列宽' },
    hrocket: { glyph: '🚀', name: '火箭↔',  desc: '清除一整行' },
    cross:   { glyph: '➕', name: '十字冲击', desc: '整行+整列' },
    bigcross:{ glyph: '💠', name: '巨十字', desc: '3行+3列' },
    rainbow: { glyph: '🌈', name: '彩钻',   desc: '消全屏最多色' },
    rainbow2:{ glyph: '🎆', name: '双彩钻', desc: '消全屏前两多色' },
    nuke:    { glyph: '🌞', name: '地心冲击', desc: '清空可视区' }
  };
  A.def('sp_rocket',  { glyph: '🚀', color: '#37415a', art: '火箭道具方块 90x90，带方向感', size: '90x90' });
  A.def('sp_bomb',    { glyph: '💣', color: '#37415a', art: '炸弹道具方块 90x90', size: '90x90' });
  A.def('sp_drill',   { glyph: '🌀', color: '#37415a', art: '钻地机道具方块 90x90', size: '90x90' });
  A.def('sp_rainbow', { glyph: '🌈', color: '#37415a', art: '彩钻道具方块 90x90，虹彩流光', size: '90x90' });

  /* 组大小→道具（4~5🚀 / 6~8💣 / 9~11🌀 / ≥12🌈）；Fever期间门槛-1档
   * 火箭方向由消除组的形状决定（grid.popGroup 里：组更高→竖、更宽→横） */
  D.specialForSize = function (n) {
    var mods = (DG.Run && DG.Run.mods) || {};
    var rocketAt = mods.rocketAt || 4;
    if (mods.feverOn) n += 2; // Fever 门槛降档
    if (n >= 12) return 'rainbow';
    if (n >= 9) return 'drill';
    if (n >= 6) return mods.bigBomb ? 'bigbomb' : 'bomb';
    if (n >= rocketAt) return 'rocket';
    return null;
  };

  /* 拖拽合并表 */
  D.mergeTable = function (a, b) {
    var k = [a, b].sort().join('+');
    var t = {
      'hrocket+rocket': 'cross', 'rocket+rocket': 'cross', 'hrocket+hrocket': 'cross',
      'bomb+bomb': 'bigbomb', 'bigbomb+bomb': 'nuke', 'bigbomb+bigbomb': 'nuke',
      'bomb+rocket': 'bigcross', 'bomb+hrocket': 'bigcross', 'bigbomb+rocket': 'bigcross', 'bigbomb+hrocket': 'bigcross',
      'drill+drill': 'cross', 'drill+rocket': 'cross', 'drill+hrocket': 'cross', 'bomb+drill': 'bigcross', 'bigbomb+drill': 'bigcross',
      'rainbow+rainbow': 'nuke'
    }[k];
    if (t) return t;
    if (a === 'rainbow' || b === 'rainbow') return 'rainbow2';
    return 'bigbomb';
  };

  /* ================= 障碍/功能方块 ================= */
  A.def('blk_rock',   { glyph: '🪨', color: '#6b6f7a', art: '硬岩方块 90x90，两段破碎状态各一张', size: '90x90x2态' });
  A.def('blk_tnt',    { glyph: '🧨', color: '#8a4030', art: 'TNT方块 90x90，引线微光', size: '90x90' });
  A.def('blk_ice',    { glyph: '🧊', color: '#9fd6e8', art: '冰壳覆盖层（半透明，叠加在彩色块上）', size: '90x90 半透明' });
  A.def('blk_poison', { glyph: '🦠', color: '#5c7a3a', art: '毒块 90x90，冒泡动效可后补', size: '90x90' });
  A.def('blk_gold',   { glyph: '💰', color: '#c9a227', art: '金矿块 90x90，闪光', size: '90x90' });
  A.def('blk_repair', { glyph: '🔧', color: '#4a8ea8', art: '修理包方块 90x90', size: '90x90' });
  A.def('blk_fossil', { glyph: '🦴', color: '#a89878', art: '化石方块 90x90，三段出土状态', size: '90x90x3态' });
  A.def('ev_merchant',{ glyph: '🦫', color: '#7a5c96', art: '流浪商人事件块 90x90，发光边', size: '90x90' });
  A.def('ev_gamble',  { glyph: '❓', color: '#96455c', art: '赌石摊事件块 90x90', size: '90x90' });
  A.def('ev_chest',   { glyph: '📦', color: '#8a6d3b', art: '宝箱事件块 90x90', size: '90x90' });
  A.def('ev_puzzle',  { glyph: '🧩', color: '#3b7a8a', art: '密室拼图事件块 90x90', size: '90x90' });

  /* onDestroy 钩子：只改棋盘+发事件，奖励结算在 run.js */
  function midOf(r, c) { var p = DG.Grid.cellXY(r, c); return { x: p.x + DG.Grid.cell / 2, y: p.y + DG.Grid.cell / 2 }; }
  D.blockDefs = {
    rock:   { glyph: '🪨', color: '#6b6f7a', hp: 2, name: '硬岩' },
    tnt:    { glyph: '🧨', color: '#8a4030', hp: 1, name: 'TNT',
      onDestroy: function (r, c, evs) { DG.Grid.chain.push({ r: r, c: c, sp: 'bigbomb', delay: 0.12 }); evs.push({ ev: 'tnt' }); } }, // TNT=大范围5×5
    poison: { glyph: '🦠', color: '#5c7a3a', hp: 1, name: '毒块',
      onDestroy: function (r, c, evs, cause) {
        var p = midOf(r, c);
        evs.push({ ev: 'poison', cause: cause, x: p.x, y: p.y });
        // 感染相邻2个彩色块
        var dirs = U.shuffle([[-1,0],[1,0],[0,-1],[0,1]]), done = 0;
        for (var i = 0; i < dirs.length && done < 2; i++) {
          var n = DG.Grid.at(r + dirs[i][0], c + dirs[i][1]);
          if (n && n.kind === 'color' && !n.ice) {
            DG.Grid.cells[r + dirs[i][0]][c + dirs[i][1]] = D.makeBlock('poison');
            done++;
          }
        }
      } },
    gold:   { glyph: '💰', color: '#c9a227', hp: 1, name: '金矿块',
      onDestroy: function (r, c, evs) { var p = midOf(r, c); evs.push({ ev: 'gold', x: p.x, y: p.y }); } },
    repair: { glyph: '🔧', color: '#4a8ea8', hp: 1, name: '修理包',
      onDestroy: function (r, c, evs) { var p = midOf(r, c); evs.push({ ev: 'repair', x: p.x, y: p.y }); } },
    fossil: { glyph: '🦴', color: '#a89878', hp: 3, name: '化石',
      onDestroy: function (r, c, evs) { var p = midOf(r, c); evs.push({ ev: 'fossil', x: p.x, y: p.y }); } },
    ev_merchant: { glyph: '🦫', color: '#7a5c96', hp: 1, name: '流浪商人', ev: true,
      onDestroy: function (r, c, evs) { evs.push({ ev: 'event', id: 'merchant' }); } },
    ev_gamble:   { glyph: '❓', color: '#96455c', hp: 1, name: '赌石摊', ev: true,
      onDestroy: function (r, c, evs) { evs.push({ ev: 'event', id: 'gamble' }); } },
    ev_chest:    { glyph: '📦', color: '#8a6d3b', hp: 1, name: '宝箱', ev: true,
      onDestroy: function (r, c, evs) { evs.push({ ev: 'event', id: 'chest' }); } },
    ev_puzzle:   { glyph: '🧩', color: '#3b7a8a', hp: 1, name: '密室拼图', ev: true,
      onDestroy: function (r, c, evs) { evs.push({ ev: 'puzzle_piece' }); } }
  };
  D.makeBlock = function (t) {
    var def = D.blockDefs[t];
    return { kind: 'block', t: t, hp: def.hp, color: def.color, fy: 0 };
  };

  /* ================= 地层（层=规则包，二期直接加数据） ================= */
  D.strata = [
    { id: 'topsoil', name: '表土层', from: 0,   bg: '#2a2118', colors: ['red', 'blue', 'green', 'yellow'],
      rock: 0, tnt: 0, ice: 0, poison: 0, note: '4色热身' },
    { id: 'stone',   name: '岩层',   from: 30,  bg: '#26262e', colors: ['red', 'blue', 'green', 'yellow'],
      rock: 0.06, tnt: 0.02, ice: 0, poison: 0, note: '硬岩+TNT埋藏' },
    { id: 'ice',     name: '冰晶层', from: 70,  bg: '#1c2a36', colors: ['red', 'blue', 'green', 'yellow', 'purple'],
      rock: 0.05, tnt: 0.02, ice: 0.08, poison: 0, note: '升5色+冰壳两段消，连击≥5热浪破冰' },
    { id: 'gas',     name: '瓦斯层', from: 120, bg: '#232e1e', colors: ['red', 'blue', 'green', 'yellow', 'purple'],
      rock: 0.05, tnt: 0.025, ice: 0.04, poison: 0.04, note: '毒块感染，连击5全屏净化+8金/块' },
    { id: 'lava',    name: '熔岩层', from: 180, bg: '#301c1c', colors: ['red', 'blue', 'green', 'yellow', 'purple'],
      rock: 0.07, tnt: 0.03, ice: 0, poison: 0.05, lava: true, note: '岩浆逼近：停顿灼烧耐久；此后无尽渐难' }
  ];
  D.stratumAt = function (m) {
    var s = D.strata[0];
    for (var i = 0; i < D.strata.length; i++) if (m >= D.strata[i].from) s = D.strata[i];
    return s;
  };
  D.stratumIndex = function (m) {
    var idx = 0;
    for (var i = 0; i < D.strata.length; i++) if (m >= D.strata[i].from) idx = i;
    return idx;
  };

  /* ================= 方块生成 rollCell（depthCells=累计生成方块数，8块=1米） ================= */
  D._genState = { evLayerDone: {}, fossilLayerDone: {} };
  D.resetGen = function () { D._genState = { evLayerDone: {}, fossilLayerDone: {} }; };

  D.rollCell = function (depthCells, safe) {
    var m = depthCells / 8;
    var s = D.stratumAt(m);
    var li = D.stratumIndex(m);
    var deep = Math.max(0, m - 180);
    var RM = (DG.Run && DG.Run.rates) || {};   // 当日矿情/每日挑战/局内强化 的生成速率修饰
    var rockP = (s.rock + (deep > 0 ? Math.min(0.06, deep / 50 * 0.02) : 0)) * (RM.rockMul == null ? 1 : RM.rockMul);
    var tntP = Math.min(0.08, (s.tnt + (deep > 0 ? deep / 50 * 0.005 : 0)) * (RM.tntMul == null ? 1 : RM.tntMul));
    var poisonP = (s.poison + (deep > 0 ? Math.min(0.04, deep / 50 * 0.01) : 0)) * (RM.poisonMul == null ? 1 : RM.poisonMul);
    var goldP = (Math.min(0.05, 0.02 + li * 0.005) + (D.bonusCache.oreRate || 0)) * (RM.oreMul == null ? 1 : RM.oreMul) + (RM.oreAdd || 0);
    var repairP = 0.008 * (RM.repairMul == null ? 1 : RM.repairMul);
    var iceP = Math.max(s.ice, RM.iceAll || 0);

    if (!safe) {
      // 每层1个事件块：进层后 8~20 米处
      var next = D.strata[li + 1];
      var layerLen = (next ? next.from : s.from + 50) - s.from;
      var into = m - s.from;
      var evKey = li + '_' + Math.floor(deep / 50); // 无尽段每50m一层
      if (!D._genState.evLayerDone[evKey] && into > Math.min(12, layerLen * 0.3)) {
        if (Math.random() < 0.05) {
          D._genState.evLayerDone[evKey] = 1;
          var pool = ['ev_merchant', 'ev_gamble', 'ev_chest', 'ev_puzzle'];
          return D.makeBlock(U.pick(pool));
        }
      }
      // 层末矿脉带：边界前2米金矿高发+1化石
      if (next && m > next.from - 2 && m < next.from) {
        if (!D._genState.fossilLayerDone[li] && Math.random() < 0.1) {
          D._genState.fossilLayerDone[li] = 1;
          return D.makeBlock('fossil');
        }
        if (Math.random() < 0.15) return D.makeBlock('gold');
      }
      var r = Math.random();
      if ((r -= rockP) < 0) return D.makeBlock('rock');
      if ((r -= tntP) < 0) return D.makeBlock('tnt');
      if ((r -= poisonP) < 0) return D.makeBlock('poison');
      if ((r -= goldP) < 0) return D.makeBlock('gold');
      if ((r -= repairP) < 0) return D.makeBlock('repair');
      if (m > 30 && (r -= 0.004) < 0) return D.makeBlock('fossil'); // 野生化石(30m+)，收藏可持续推进
    }
    // 首局前24m只出3色 → 大组遍地=新手必爽
    var pool = s.colors;
    var ft = DG.Run && DG.Run.ftue;
    if (ft && ft.colors3 && m < ft.colors3) pool = s.colors.slice(0, 3);
    var key = U.pick(pool);
    var cell = { kind: 'color', t: key, color: D.colors[key].color, ice: 0, fy: 0 };
    if (!safe && iceP > 0 && Math.random() < iceP) cell.ice = 1;
    return cell;
  };

  /* ================= 方块绘制（真实贴图，缺图回退占位） ================= */
  D.blockImg = function (cell) { // 障碍/事件块 → 贴图id（含分级状态）
    if (cell.t === 'rock') return cell.hp > 1 ? 'blk_rock' : 'blk_rock2';
    if (cell.t === 'fossil') return cell.hp >= 3 ? 'blk_fossil3' : cell.hp === 2 ? 'blk_fossil2' : 'blk_fossil';
    return { tnt: 'blk_tnt', poison: 'blk_poison', gold: 'blk_gold', repair: 'blk_repair', ev_merchant: 'ev_merchant', ev_gamble: 'ev_gamble', ev_chest: 'ev_chest', ev_puzzle: 'ev_puzzle' }[cell.t];
  };
  D.spImg = { rocket: 'sp_rocket', hrocket: 'sp_hrocket', bomb: 'sp_bomb', drill: 'sp_drill', rainbow: 'sp_rainbow' };
  D.drawCell = function (ctx, cell, x, y, size) {
    var IM = A.images, img;
    if (cell.kind === 'color') {
      img = IM['block_' + cell.t];
      if (img) ctx.drawImage(img, x, y, size, size);
      else {
        ctx.fillStyle = cell.color;
        U.rr(ctx, x, y, size, size, size * 0.16); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        U.rr(ctx, x + 3, y + 3, size - 6, (size - 6) * 0.4, size * 0.12); ctx.fill();
      }
      if (cell.hl) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; U.rr(ctx, x + 2, y + 2, size - 4, size - 4, size * 0.16); ctx.stroke(); }
      if (cell.ice > 0) {
        if (IM.blk_ice) { ctx.globalAlpha = 0.88; ctx.drawImage(IM.blk_ice, x - 2, y - 2, size + 4, size + 4); ctx.globalAlpha = 1; }
        else {
          ctx.fillStyle = 'rgba(190,230,250,0.65)';
          U.rr(ctx, x, y, size, size, size * 0.16); ctx.fill();
          ctx.font = Math.floor(size * 0.5) + 'px Xiaolai, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('🧊', x + size / 2, y + size / 2);
        }
      }
    } else if (cell.kind === 'block') {
      var def = D.blockDefs[cell.t];
      img = IM[D.blockImg(cell)];
      if (img) ctx.drawImage(img, x, y, size, size);
      else {
        ctx.fillStyle = def.color;
        U.rr(ctx, x, y, size, size, size * 0.16); ctx.fill();
        ctx.font = Math.floor(size * 0.55) + 'px Xiaolai, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(def.glyph, x + size / 2, y + size / 2);
      }
      if (def.ev) { // 事件块金色呼吸描边
        ctx.strokeStyle = 'rgba(255,215,106,' + (0.55 + 0.35 * Math.sin(Date.now() / 250)) + ')';
        ctx.lineWidth = 3;
        U.rr(ctx, x + 1, y + 1, size - 2, size - 2, size * 0.16); ctx.stroke();
      }
      if (def.hp > 1 && !def.ev) {
        ctx.font = 'bold ' + Math.floor(size * 0.24) + 'px Xiaolai, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
        ctx.strokeText('' + cell.hp, x + size - 12, y + 14);
        ctx.fillStyle = '#fff';
        ctx.fillText('' + cell.hp, x + size - 12, y + 14);
      }
    } else if (cell.kind === 'special') {
      img = IM[D.spImg[cell.sp]];
      if (img) {
        // 微光呼吸底
        ctx.fillStyle = 'rgba(143,208,255,' + (0.12 + 0.08 * Math.sin(Date.now() / 220)) + ')';
        U.rr(ctx, x, y, size, size, size * 0.24); ctx.fill();
        ctx.drawImage(img, x + 1, y + 1, size - 2, size - 2);
      } else {
        ctx.fillStyle = '#37415a';
        U.rr(ctx, x, y, size, size, size * 0.28); ctx.fill();
        ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 3;
        U.rr(ctx, x + 2, y + 2, size - 4, size - 4, size * 0.28); ctx.stroke();
        ctx.font = Math.floor(size * 0.6) + 'px Xiaolai, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(D.specials[cell.sp].glyph, x + size / 2, y + size / 2);
      }
    }
  };

  /* ================= 入层三选一（16条强化池，带流派标签；同流派2件激活羁绊） ================= */
  D.perks = [
    { id: 'rocket3',  rar: 'gold',  tag: 'blast', name: '轻量燃料', desc: '3连即可产出火箭', apply: function (M) { M.rocketAt = 3; } },
    { id: 'bigbomb',  rar: 'gold',  tag: 'blast', name: '扩装药',   desc: '炸弹升级为5×5巨型炸弹', apply: function (M) { M.bigBomb = true; } },
    { id: 'fever25',  rar: 'blue',  tag: 'fever', name: '狂热引擎', desc: '狂热充能速度+25%', apply: function (M) { M.feverGain = (M.feverGain || 1) + 0.25; } },
    { id: 'dur30',    rar: 'white', tag: 'craft', name: '加固镐柄', desc: '耐久上限+30并回满', apply: function (M, R) { R.durMax += 30; R.dur = R.durMax; } },
    { id: 'combo1s',  rar: 'blue',  tag: 'fever', name: '余韵',     desc: '连击窗口+1秒', apply: function (M) { M.comboWin = (M.comboWin || 0) + 1; } },
    { id: 'dig1',     rar: 'blue',  tag: 'craft', name: '精准手感', desc: '单敲耗耐久3→1', apply: function (M) { M.digCost = 1; } },
    { id: 'coin40',   rar: 'white', tag: 'greed', name: '聚宝纹',   desc: '本局金币+40%', apply: function (M) { M.coinMul = (M.coinMul || 1) + 0.4; } },
    { id: 'drop8',    rar: 'gold',  tag: 'blast', name: '连锁矿脉', desc: '≥8块消除15%掉落随机道具', apply: function (M) { M.dropOn8 = true; } },
    { id: 'rock1',    rar: 'white', tag: 'craft', name: '碎岩锤',   desc: '硬岩1次波及即碎', apply: function (M) { M.rockOneHit = true; } },
    { id: 'poison30', rar: 'blue',  tag: 'greed', name: '炼毒术',   desc: '毒块被道具炸毁+30金币', apply: function (M) { M.poisonBonus = true; } },
    { id: 'chain05',  rar: 'gold',  tag: 'blast', name: '殉爆专家', desc: '连锁每级加成0.3→0.5', apply: function (M) { M.chainK = 0.5; } },
    { id: 'mile25',   rar: 'white', tag: 'craft', name: '深呼吸',   desc: '里程碑回复10→25', apply: function (M) { M.mileHeal = 25; } },
    { id: 'ember',    rar: 'blue',  tag: 'fever', name: '狂热余烬', desc: '狂热结束保留40%能量', apply: function (M) { M.feverKeep = 0.4; } },
    { id: 'radar',    rar: 'white', tag: 'greed', name: '掘金雷达', desc: '金矿出现率+2%', apply: function (M, R) { R.rates.oreAdd += 0.02; } },
    { id: 'wide',     rar: 'blue',  tag: 'blast', name: '贯穿弹头', desc: '火箭清除2行/2列', apply: function (M) { M.wideRocket = true; } },
    { id: 'exit15',   rar: 'gold',  tag: 'greed', name: '险中求财', desc: '撤离倍率每50m +15%(原+10%)', apply: function (M) { M.exitStep = 0.15; } }
  ];
  D.rollPerks = function (run) {
    var pool = D.perks.filter(function (p) { return run.perks.indexOf(p.id) < 0; });
    // 耐久<30% 保底出修理类
    var out = [];
    if (run.dur / run.durMax < 0.3) {
      var fix = pool.filter(function (p) { return p.id === 'dur30' || p.id === 'mile25'; });
      if (fix.length) { out.push(U.pick(fix)); pool = pool.filter(function (p) { return p.id !== out[0].id; }); }
    }
    var w = { white: 60, blue: 30, gold: 10 };
    while (out.length < 3 && pool.length) {
      var picked = U.wpick(pool.map(function (p) { return { w: w[p.rar], p: p }; })).p;
      out.push(picked);
      pool = pool.filter(function (p) { return p.id !== picked.id; });
    }
    return out;
  };

  /* ================= 局内事件 ================= */
  D.events = {
    merchant: {
      name: '流浪商人 🦫', desc: '用局内金币换补给（再遇涨价）',
      offers: function (run) {
        var k = Math.pow(1.5, run.merchantMet || 0);
        return [
          { txt: '💣 炸弹×3', cost: Math.round(30 * k), act: function (R) { R.pendingSpecials = (R.pendingSpecials || []).concat(['bomb', 'bomb', 'bomb']); } },
          { txt: '🔧 +30耐久', cost: Math.round(50 * k), act: function (R) { R.dur = Math.min(R.durMax, R.dur + 30); } },
          { txt: '🎁 随机道具', cost: Math.round(80 * k), act: function (R) { R.pendingSpecials = (R.pendingSpecials || []).concat([U.pick(['drill', 'rainbow', 'bigbomb'])]); } }
        ];
      }
    },
    gamble: {
      name: '赌石摊 ❓', desc: '40金币任选一块原石',
      cost: 40,
      roll: function () {
        var r = Math.random();
        if (r < 0.5) return { txt: '开出 30金币', coin: 30 };
        if (r < 0.85) return { txt: '开出 80金币！', coin: 80 };
        if (r < 0.99) return { txt: '大赚！200金币！！', coin: 200 };
        return { txt: '传说藏品！！！', coin: 0, relic: true };
      }
    },
    chest: {
      name: '宝箱 📦', desc: '',
      roll: function (run) {
        if (!DG.SAVE.d.daily.chestPiece) { DG.SAVE.d.daily.chestPiece = 1; return { txt: '拼图碎片×1 🧩', piece: 1 }; } // 每日首个宝箱必得碎片
        var r = Math.random();
        if (r < 0.3) return { txt: '金币×20 🪙', coin: 20 };
        if (r < 0.55) return { txt: '+20耐久 🔧', dur: 20 };
        if (r < 0.85) return { txt: '随机道具 🎁', sp: U.pick(['bomb', 'rocket', 'drill']) };
        return { txt: '拼图碎片×1 🧩', piece: 1 };
      }
    }
  };

  /* ================= 充值/商业化（原型全部模拟支付；价格单一数据源便于调整） ================= */
  D.iap = {
    packs: [ // 充值档位：首充双倍(每档一次)
      { rmb: 6,   gem: 60,   bonus: 0 },
      { rmb: 30,  gem: 300,  bonus: 30 },
      { rmb: 68,  gem: 680,  bonus: 100 },
      { rmb: 128, gem: 1280, bonus: 260 },
      { rmb: 328, gem: 3280, bonus: 850 },
      { rmb: 648, gem: 6480, bonus: 2000 }
    ],
    monthly: { rmb: 30, gemDaily: 60, days: 30 },   // 矿工月卡：每日60💎+隔夜矿车×2+开局撤离倍率+10%
    revive: [0, 20, 40, 80, 160],                    // 第n次复活价：首次=看广告(桩)，之后星钻递增
    perk4: 15,                                       // 三选一第四格(金卡诱惑位)解锁价；每日首次可看广告免费
    puzzleLast: 10,                                  // 拼图最后一片补齐
    pityKey: 48,                                     // 保底冲刺 星钻→券（冲刺8折；60=全经济唯一锚，唯二折扣=首充双倍+冲刺8折）
    pityKeyWindow: 5,
    wishGem: 30,                                     // 许愿矿灯星钻价（广告轨每日1次免费）
    wheelGem: 20                                     // 转盘星钻直转价
  };
  D.monthlyActive = function (s) { return s.monthlyUntil && U.todayKey() <= s.monthlyUntil; };

  /* 模拟广告桩 + 埋点（上线替换为激励视频SDK；payLog 记曝光/点击供调价） */
  D.adStub = function (tag, cb) {
    D.track('ad_' + tag);
    DG.FX.text(DG.P.W / 2, DG.P.safeTop + 150, '📺 模拟广告·' + tag, { color: '#8fd0ff', size: 22, life: 1.2 });
    cb();
  };
  D.track = function (tag) {
    var s = DG.SAVE.d;
    s.payLog = s.payLog || {};
    s.payLog[tag] = (s.payLog[tag] || 0) + 1;
    DG.SAVE.save();
  };
  /* 广告频控总表：复活每局1 · 结算×2日2 · 矿车追回每局1/日3 · 加班日1 · 许愿日1 · 拼图每幅1 · 第四格日1 ≈日总8次 */

  /* ================= 六货币 ================= */
  D.currencies = {
    coin: { name: '金币', icon: 'ui_coin' },
    gem: { name: '星钻', icon: 'ui_gem' },
    boxkey: { name: '盲盒钥匙', icon: 'ui_key' },
    dust: { name: '星尘', icon: 'ui_dust' },
    piece: { name: '拼图碎片', icon: 'ui_puzzle' },
    ticket: { name: '转盘券', icon: 'ui_ticket' }
  };
  A.def('ui_dust', { glyph: '✨', shape: 'none', art: '星尘货币图标 64x64', size: '64x64' });

  /* ================= 商店（永久升级） ================= */
  D.shop = [
    { id: 'dur',   icon: '⛏️', name: '强化钻齿', desc: '耐久上限+10/级', max: 10, base: 100, mul: 1.40, stat: 'durMax', per: 10 },
    { id: 'magnet',icon: '🧲', name: '聚金磁铁', desc: '金币获取+5%/级', max: 20, base: 60,  mul: 1.35, stat: 'coinPct', per: 5 },
    { id: 'depth', icon: '📏', name: '深度红利', desc: '深度结算+10%/级', max: 10, base: 120, mul: 1.40, stat: 'depthPct', per: 10, needM: 100 },
    { id: 'fever', icon: '🔥', name: '狂热引擎', desc: '狂热时长+0.5s/级', max: 8,  base: 120, mul: 1.45, stat: 'feverDur', per: 0.5, needRuns: 3 },
    { id: 'combo', icon: '⏱️', name: '连击稳定器', desc: '连击窗口+0.2s/级', max: 5,  base: 150, mul: 1.50, stat: 'comboWin', per: 0.2, needRuns: 3 },
    { id: 'arms',  icon: '🎯', name: '军火专家', desc: '道具收益+8%/级', max: 10, base: 130, mul: 1.45, stat: 'powerPct', per: 8, needM: 200 }
  ];
  D.shopPrice = function (item, lv) {
    var gate = [0, 0, 0, 0, 0, 0, 800, 800, 800, 800, 800, 3000, 3000, 3000, 3000, 3000, 8000, 8000, 8000, 8000, 8000];
    return { cost: Math.round(item.base * Math.pow(item.mul, lv) / 10) * 10, needM: gate[lv + 1] || 8000 };
  };

  /* ================= 局前补给（金币的常青去处：单局增益，出发前买） ================= */
  D.supplies = [
    { id: 'rocket', name: '火箭出发', desc: '开局自带1个火箭', cost: 250, icon: 'sp_rocket' },
    { id: 'armor', name: '加固镐头', desc: '本局耐久上限+25', cost: 500, icon: 'ui_energy' },
    { id: 'nose', name: '金币嗅觉', desc: '本局金币+30%', cost: 450, icon: 'ui_coin' }
  ];

  /* ================= 盲盒：5套×8件=40藏品 ================= */
  /* 每套绑定一种全局属性；单件按稀有度给小词条，集4半效/集8全效 */
  D.sets = [
    { id: 'vein',  name: '地心矿脉', icon: '⛏️', stat: 'coinPct', setVal: 10, unit: '%', statName: '金币获取',
      items: [['原煤', '🪨'], ['黄铜齿轮', '⚙️'], ['粗银锭', '🥈'], ['磁石', '🧲'], ['琥珀金', '🟡'], ['紫晶簇', '🟣'], ['翡翠之心', '💚'], ['地心熔金', '🌋']] },
    { id: 'bone',  name: '远古化石', icon: '🦴', stat: 'durMax', setVal: 15, unit: '', statName: '耐久上限',
      items: [['三叶虫', '🐚'], ['菊石', '🌀'], ['恐龙足印', '🐾'], ['琥珀昆虫', '🪲'], ['剑齿', '🦷'], ['古蕨叶', '🌿'], ['翼龙之翼', '🦇'], ['霸王龙颅', '🦖']] },
    { id: 'star',  name: '星陨碎屑', icon: '🌠', stat: 'feverChargePct', setVal: 15, unit: '%', statName: '狂热充能',
      items: [['陨铁屑', '⚫'], ['流星砂', '💫'], ['月尘', '🌙'], ['星核片', '⭐'], ['彗尾冰', '❄️'], ['日冕石', '🌞'], ['暗物质', '🌑'], ['超新星遗珠', '🌟']] },
    { id: 'mech',  name: '机械残骸', icon: '🔩', stat: 'powerPct', setVal: 12, unit: '%', statName: '道具收益',
      items: [['生锈弹簧', '🔩'], ['断裂钻头', '🔧'], ['蒸汽阀', '🎛️'], ['铜管', '🥉'], ['压力表', '🕰️'], ['引擎芯', '🔋'], ['奇械核心', '💠'], ['失落钻机AI', '🤖']] },
    { id: 'luck',  name: '幸运宝石', icon: '💎', stat: 'luckPct', setVal: 10, unit: '%', statName: '三选一金卡率',
      items: [['幸运石英', '🔮'], ['猫眼石', '🐱'], ['四叶琥珀', '🍀'], ['蓝月光', '🌛'], ['鸽血红', '❤️'], ['帝王绿', '💚'], ['天命黑蛋白', '🖤'], ['欧皇之泪', '💧']] }
  ];
  // 每套8件稀有度固定：4N 2R 1SR 1SSR（下标0~3=N，4~5=R，6=SR，7=SSR）
  D.rarOfIdx = function (i) { return i < 4 ? 'N' : i < 6 ? 'R' : i < 7 ? 'SR' : 'SSR'; };
  D.rarCfg = {
    N:   { w: 58, dust: 5,   pct: 0.4, color: '#9aa4b8' },
    R:   { w: 30, dust: 20,  pct: 1.0, color: '#4aa3ff' },
    SR:  { w: 10, dust: 80,  pct: 2.5, color: '#b678ff' },
    SSR: { w: 2,  dust: 300, pct: 5.0, color: '#ffb02e' }
  };
  D.boxCost = { gem: 60 };   // 星钻直购一盒
  D.pity = { ssr: 25, r10: 10 };
  D.allItems = function () {
    var out = [];
    for (var s = 0; s < D.sets.length; s++)
      for (var i = 0; i < 8; i++) {
        var it = D.sets[s].items[i];
        out.push({ id: D.sets[s].id + '_' + i, set: D.sets[s], idx: i, name: it[0], glyph: it[1], rar: D.rarOfIdx(i) });
      }
    return out;
  };

  /* ================= 转盘（8格；空盘面旋转+图标固定正向叠加） ================= */
  D.wheel = [
    { w: 30, txt: '金币×200', glyph: '🪙', img: 'wp_coin', give: { coin: 200 } },
    { w: 10, txt: '星钻×20', glyph: '💎', img: 'wp_gem', give: { gem: 20 } },
    { w: 10, txt: '盲盒钥匙', glyph: '🔑', img: 'wp_boxkey', give: { boxkey: 1 } },
    { w: 12, txt: '拼图碎片', glyph: '🧩', img: 'wp_puzzle', give: { piece: 1 } },
    { w: 15, txt: '星尘×40', glyph: '✨', img: 'wp_dust', give: { dust: 40 } },
    { w: 6,  txt: '转盘券', glyph: '🎫', img: 'wp_ticket', give: { ticket: 1 } },
    { w: 12, txt: '金币×600', glyph: '💰', img: 'wp_gold', give: { coin: 600 } },
    { w: 5,  txt: '大奖 盲盒钥匙×3+星钻60', glyph: '👑', img: 'wp_jackpot', give: { boxkey: 3, gem: 60 } }
  ];
  D.ticketCoinCost = 800; // 金币购转盘券（日限1）

  /* 顶部货币栏：全局唯一定义，首页/二级页共用，避免同一格位显示不同货币 */
  D.topBar = function (s) {
    return [
      { icon: 'ui_coin', txt: U.fmt(s.coin), tip: '金币：商店升级 / 局前补给' },
      { icon: 'ui_gem', txt: U.fmt(s.gem), tip: '星钻：开盲盒 / 复活 / 转盘' },
      { icon: 'ui_key', txt: '' + s.boxkey, tip: '盲盒钥匙：免费开1个盲盒' },
      { icon: 'ui_ticket', txt: '' + s.ticket, tip: '转盘券：免费转1次转盘' }
    ];
  };

  /* ================= 拼图：6幅×9片 ================= */
  D.puzzles = [
    { id: 'p1', name: '地心熔炉', pic: ['🌋', '🔥', '⛰️', '🔥', '🌋', '🔥', '⛰️', '🔥', '🌋'], reward: { skin: 'lava', coin: 500 }, rtxt: '熔岩皮肤+500金币' },
    { id: 'p2', name: '星空矿脉', pic: ['🌌', '⭐', '🌙', '⭐', '🌌', '⭐', '🌙', '⭐', '🌌'], reward: { gem: 150, boxkey: 1 }, rtxt: '星钻150+盲盒钥匙1' },
    { id: 'p3', name: '幽灵矿洞', pic: ['👻', '🕯️', '⛏️', '🕯️', '👻', '🕯️', '⛏️', '🕯️', '👻'], reward: { skin: 'ghost' }, rtxt: '幽灵皮肤' },
    { id: 'p4', name: '机械之城', pic: ['⚙️', '🔩', '🤖', '🔩', '⚙️', '🔩', '🤖', '🔩', '⚙️'], reward: { dust: 300, boxkey: 2 }, rtxt: '星尘300+盲盒钥匙2' },
    { id: 'p5', name: '黄金王座', pic: ['👑', '🪙', '💰', '🪙', '👑', '🪙', '💰', '🪙', '👑'], reward: { skin: 'goldpick' }, rtxt: '黄金皮肤' },
    { id: 'p6', name: '远古之秘', pic: ['🦖', '🦴', '🗿', '🦴', '🦖', '🦴', '🗿', '🦴', '🦖'], reward: { ssrTicket: 1 }, rtxt: 'SSR自选券' }
  ];

  /* ================= 皮肤（8款，≤3%微加成） ================= */
  D.skins = [
    { id: 'default', name: '铁镐',   glyph: '🔩', stat: null, val: 0, how: '初始拥有', statName: '' },
    { id: 'lava',    name: '熔岩钻头', glyph: '🌋', stat: 'coinPct', val: 2, how: '完成拼图1', statName: '金币+2%' },
    { id: 'ghost',   name: '幽灵镐',  glyph: '👻', stat: 'comboWin', val: 0.1, how: '完成拼图3', statName: '连击窗+0.1s' },
    { id: 'goldpick',name: '黄金钻头', glyph: '👑', stat: 'coinPct', val: 3, how: '完成拼图5', statName: '金币+3%' },
    { id: 'lemon',   name: '柠檬镐',  glyph: '🍋', stat: 'durMax', val: 5, how: '签到第7天', statName: '耐久+5' },
    { id: 'starry',  name: '星空钻头', glyph: '🌌', stat: 'feverDur', val: 0.3, how: '星钻600购买', cost: 600, statName: '狂热+0.3s' },
    { id: 'sakura',  name: '樱花镐',  glyph: '🌸', stat: 'pieceRate', val: 2, how: '星钻400购买', cost: 400, statName: '碎片率+2%' },
    { id: 'champ',   name: '冠军钻头', glyph: '🏆', stat: 'depthPct', val: 3, how: '单局挖到300m', statName: '深度结算+3%' }
  ];

  /* ================= 化石收藏（绿/紫/橙三档；挖到化石块随机出土） ================= */
  D.fossilTiers = {
    green:  { name: '绿·优秀', color: '#4cd471', gem: 10, dust: 10 },
    purple: { name: '紫·史诗', color: '#b678ff', gem: 30, dust: 30 },
    orange: { name: '橙·传世', color: '#ffb02e', gem: 80, dust: 100 }
  };
  D.fossilList = [
    { id: 'fo_g1', tier: 'green',  name: '菊石出土' },
    { id: 'fo_g2', tier: 'green',  name: '三叶虫石板' },
    { id: 'fo_g3', tier: 'green',  name: '古鱼化石' },
    { id: 'fo_g4', tier: 'green',  name: '巨兽足印' },
    { id: 'fo_g5', tier: 'green',  name: '考古现场' },
    { id: 'fo_p1', tier: 'purple', name: '霸王龙全骨架' },
    { id: 'fo_p2', tier: 'purple', name: '三角龙头骨' },
    { id: 'fo_p3', tier: 'purple', name: '远古藏宝图' },
    { id: 'fo_p4', tier: 'purple', name: '狗头金' },
    { id: 'fo_o1', tier: 'orange', name: '《蒙娜丽鼠》' },
    { id: 'fo_o2', tier: 'orange', name: '《戴珍珠耳环的鼹鼠》' },
    { id: 'fo_o3', tier: 'orange', name: '《鼹星夜》' }
  ];
  /* 深度决定品质：紫≥40m解锁，橙≥100m解锁且越深权重越高（挖得深=挖得好） */
  D.rollFossil = function (m) {
    var gw = 68;
    var pw = m >= 40 ? 27 : 0;
    var ow = m >= 100 ? Math.min(15, 5 + (m - 100) / 50) : 0;
    var r = Math.random() * (gw + pw + ow);
    var tier = r < gw ? 'green' : r < gw + pw ? 'purple' : 'orange';
    var pool = [], missing = [];
    for (var i = 0; i < D.fossilList.length; i++) {
      var f = D.fossilList[i];
      if (f.tier !== tier) continue;
      pool.push(f);
      if (!DG.SAVE.d.fossils[f.id]) missing.push(f);
    }
    return (missing.length && Math.random() < 0.6) ? U.pick(missing) : U.pick(pool); // 6成偏向未收集
  };

  /* ================= 图鉴（矿物Tab=局内方块首见） ================= */
  D.codex = [
    { id: 'red', name: '红矿土', glyph: '🟥', gem: 5 }, { id: 'blue', name: '蓝矿土', glyph: '🟦', gem: 5 },
    { id: 'green', name: '绿矿土', glyph: '🟩', gem: 5 }, { id: 'yellow', name: '黄矿土', glyph: '🟨', gem: 5 },
    { id: 'purple', name: '紫矿土', glyph: '🟪', gem: 5 },
    { id: 'rock', name: '硬岩', glyph: '🪨', gem: 5 }, { id: 'tnt', name: '天然火药', glyph: '🧨', gem: 15 },
    { id: 'ice', name: '万年冰壳', glyph: '🧊', gem: 15 }, { id: 'poison', name: '瘴气结晶', glyph: '🦠', gem: 15 },
    { id: 'gold', name: '金矿石', glyph: '💰', gem: 5 }, { id: 'repair', name: '工匠遗物', glyph: '🔧', gem: 15 },
    { id: 'fossil', name: '远古化石', glyph: '🦴', gem: 30 },
    { id: 'sp_rocket', name: '火箭', glyph: '🚀', gem: 5 }, { id: 'sp_bomb', name: '炸弹', glyph: '💣', gem: 5 },
    { id: 'sp_drill', name: '钻地机', glyph: '🌀', gem: 15 }, { id: 'sp_rainbow', name: '彩钻', glyph: '🌈', gem: 30 },
    { id: 'ev_merchant', name: '流浪商人', glyph: '🦫', gem: 15 }, { id: 'ev_gamble', name: '赌石摊', glyph: '❓', gem: 15 },
    { id: 'ev_chest', name: '矿下宝箱', glyph: '📦', gem: 15 }, { id: 'ev_puzzle', name: '密室拼图', glyph: '🧩', gem: 15 },
    { id: 'relic', name: '传说藏品·赌石', glyph: '🏺', gem: 50 },
    { id: 'm100', name: '百米俱乐部', glyph: '💯', gem: 15 }, { id: 'm200', name: '深渊挑战者', glyph: '🕳️', gem: 30 },
    { id: 'fever', name: '狂热!', glyph: '🔥', gem: 5 }, { id: 'merge', name: '道具合并', glyph: '🧪', gem: 15 },
    { id: 'chain3', name: '三重连锁', glyph: '⛓️', gem: 15 }, { id: 'combo10', name: '十连击', glyph: '🔟', gem: 15 },
    { id: 'purify', name: '全屏净化', glyph: '🕊️', gem: 30 }, { id: 'nuke', name: '地心冲击', glyph: '☀️', gem: 30 },
    { id: 'survivor', name: '岩浆生还者', glyph: '🧯', gem: 30 }
  ];

  /* ================= 每日矿情（全体普通局生效的当日修饰符，纯参数造"今天不一样"） ================= */
  D.dailyMods = [
    { id: 'gold',  name: '黄金潮 💰', desc: '金矿出现率+60%', oreMul: 1.6, goal: 'ore' },
    { id: 'tnt',   name: '火药味 🧨', desc: 'TNT埋藏翻倍，连锁更疯狂', tntMul: 2, goal: 'items' },
    { id: 'fever', name: '狂热日 🔥', desc: '狂热充能+30%', feverMul: 1.3, goal: 'fever' },
    { id: 'combo', name: '余韵日 ⏱️', desc: '连击窗口+0.6s', comboWin: 0.6, goal: 'blocks' },
    { id: 'rock',  name: '硬骨头 🪨', desc: '硬岩+50%，但每块+3金币', rockMul: 1.5, rockCoin: 3, goal: 'digm' },
    { id: 'deep',  name: '深潜日 📏', desc: '深度结算+30%', depthMul: 1.3, goal: 'digm' },
    { id: 'repair',name: '工匠日 🔧', desc: '修理包出现率翻倍', repairMul: 2, goal: 'runs' },
  ];
  D.modOfKey = function (key) { // 任意日期的矿情（明日预告用）
    var rng = U.seededRng(key * 7 + 3);
    return D.dailyMods[Math.floor(rng() * D.dailyMods.length)];
  };
  D.todayMod = function () { return D.modOfKey(U.todayKey()); };

  /* ================= 每日挑战（更难修饰符×2 + 每日一次奖励，锻炼后期思考） ================= */
  D.challengeMods = [
    { id: 'norep',   name: '无补给', desc: '不出现修理包', repairMul: 0 },
    { id: 'rock2',   name: '岩层暴动', desc: '硬岩出现率×2', rockMul: 2 },
    { id: 'poison2', name: '瘴气弥漫', desc: '毒块出现率×2', poisonMul: 2 },
    { id: 'ice2',    name: '极寒', desc: '全地层出现冰壳', iceAll: 0.07 },
    { id: 'dur70',   name: '劣质镐', desc: '初始耐久-30', durDelta: -30 },
    { id: 'fastlava',name: '岩浆焦土', desc: '岩浆从120m就开始逼近', lavaFrom: 120 },
    { id: 'short',   name: '短促连击', desc: '连击窗口-0.8s', comboWin: -0.8 },
  ];
  D.todayChallenge = function () {
    var rng = U.seededRng(U.todayKey() * 13 + 5);
    var pool = D.challengeMods.slice(), out = [];
    while (out.length < 2 && pool.length) {
      var i = Math.floor(rng() * pool.length);
      out.push(pool[i]); pool.splice(i, 1);
    }
    return out;
  };
  D.challengeReward = { gem: 40 };          // 每日首次完成
  D.challengeDeepReward = { boxkey: 1 };    // 挑战中挖到≥100m 追加

  /* ================= 三选一羁绊（同流派2件激活套装效果=后期build思考） ================= */
  D.perkTags = {
    blast: { name: '爆破', color: '#ff7a4a', bonus: '道具收益×1.5', apply: function (M) { M.blastSet = true; } },
    greed: { name: '贪婪', color: '#ffd76a', bonus: '本局金币再+20%', apply: function (M) { M.coinMul = (M.coinMul || 1) + 0.2; } },
    craft: { name: '工匠', color: '#8fd0ff', bonus: '里程碑额外+10耐久', apply: function (M) { M.mileHeal = (M.mileHeal || DG.D.tune.mileHeal) + 10; } },
    fever: { name: '狂热', color: '#b678ff', bonus: '狂热时长+2s', apply: function (M) { M.feverDurPlus = (M.feverDurPlus || 0) + 2; } }
  };

  /* ================= 每日 ================= */
  D.dailyGoalPool = [
    { id: 'digm', txt: '累计挖掘300米', target: 300, key: 'm' },
    { id: 'blocks', txt: '消除180个方块', target: 180, key: 'blocks' },
    { id: 'fever', txt: '触发3次狂热', target: 3, key: 'fever' },
    { id: 'items', txt: '使用10个道具', target: 10, key: 'items' },
    { id: 'runs', txt: '完成2局挖掘', target: 2, key: 'runs' },
    { id: 'ore', txt: '收集30个金矿块', target: 30, key: 'ore' }
  ];
  D.signin7 = [
    { txt: '金币×200', give: { coin: 200 } }, { txt: '星钻×30', give: { gem: 30 } },
    { txt: '转盘券×2', give: { ticket: 2 } }, { txt: '盲盒钥匙×1', give: { boxkey: 1 } },
    { txt: '星尘×100', give: { dust: 100 } }, { txt: '星钻×50', give: { gem: 50 } },
    { txt: '柠檬镐+盲盒钥匙×3', give: { boxkey: 3, skin: 'lemon' } }
  ];
  D.milesCum = [ // 累计深度
    { m: 100, txt: '累计100m', give: { gem: 20 } }, { m: 300, txt: '累计300m', give: { boxkey: 1 } },
    { m: 500, txt: '累计500m', give: { gem: 50 } }, { m: 1000, txt: '累计1000m', give: { gem: 100 } },
    { m: 2000, txt: '累计2000m', give: { boxkey: 3 } }, { m: 5000, txt: '累计5000m', give: { ssrTicket: 1 } }
  ];
  D.milesRun = [ // 单局纪录
    { m: 50, txt: '单局50m', give: { gem: 10 } }, { m: 100, txt: '单局100m', give: { gem: 30 } },
    { m: 200, txt: '单局200m', give: { gem: 100 } }, { m: 300, txt: '单局300m', give: { skin: 'champ' } }
  ];

  /* ================= 系统解锁时间线 ================= */
  D.unlocks = {
    shop:  function (s) { return s.runCount >= 1; },
    daily: function (s) { return s.runCount >= 2; },
    box:   function (s) { return s.runCount >= 3 || s.cumM >= 100; },
    codex: function (s) { return s.runCount >= 4 || s.cumM >= 150; },
    wheel: function (s) { return s.days >= 2 || s.cumM >= 250; },
    puzzle:function (s) { return s.runCount >= 5 || s.cumM >= 350; },
    skin:  function (s) { return s.puzzleDone >= 1 || s.cumM >= 600; }
  };

  /* ================= 局外加成聚合 ================= */
  D.bonusCache = {};
  D.calcBonuses = function () {
    var s = DG.SAVE.d;
    var B = { coinPct: 0, durMax: 0, depthPct: 0, feverDur: 0, comboWin: 0, powerPct: 0, feverChargePct: 0, luckPct: 0, pieceRate: 0, oreRate: 0 };
    var i;
    // 商店
    for (i = 0; i < D.shop.length; i++) {
      var it = D.shop[i], lv = s.shop[it.id] || 0;
      if (lv > 0) B[it.stat] = (B[it.stat] || 0) + it.per * lv;
    }
    // 藏品单件 + 套装
    var items = D.allItems();
    var setCount = {};
    for (i = 0; i < items.length; i++) {
      var itm = items[i];
      if (s.col[itm.id]) {
        B[itm.set.stat] = (B[itm.set.stat] || 0) + D.rarCfg[itm.rar].pct * (itm.set.stat === 'durMax' ? 2 : 1);
        setCount[itm.set.id] = (setCount[itm.set.id] || 0) + 1;
      }
    }
    for (i = 0; i < D.sets.length; i++) {
      var st = D.sets[i], n = setCount[st.id] || 0;
      if (n >= 8) B[st.stat] = (B[st.stat] || 0) + st.setVal;
      else if (n >= 4) B[st.stat] = (B[st.stat] || 0) + st.setVal / 2;
    }
    // 皮肤
    var sk = null;
    for (i = 0; i < D.skins.length; i++) if (D.skins[i].id === s.skin) sk = D.skins[i];
    if (sk && sk.stat) B[sk.stat] = (B[sk.stat] || 0) + sk.val;
    // 图鉴等级：每10条+2%金币
    var codexN = 0;
    for (var k in s.codex) codexN++;
    B.codexLv = Math.floor(codexN / 10);
    B.coinPct += B.codexLv * 2;
    // 拼图永久金币
    B.coinPct += Math.min(6, s.puzzleDone);
    // 化石收藏：集齐整档给永久加成（绿:金币+3% 紫:耐久+10 橙:深度结算+5%）
    var ftC = { green: 0, purple: 0, orange: 0 }, ftT = { green: 0, purple: 0, orange: 0 };
    for (i = 0; i < D.fossilList.length; i++) {
      ftT[D.fossilList[i].tier]++;
      if (s.fossils[D.fossilList[i].id]) ftC[D.fossilList[i].tier]++;
    }
    if (ftC.green >= ftT.green) B.coinPct += 3;
    if (ftC.purple >= ftT.purple) B.durMax += 10;
    if (ftC.orange >= ftT.orange) B.depthPct += 5;
    D.bonusCache = B;
    return B;
  };

  /* ================= 默认存档 ================= */
  D.defaultDaily = function () {
    return {
      key: 0, firstRun: true, signed: false, chestPiece: 0,
      goals: null, goalsClaimed: [], allClaimed: false,
      wheelFree: false, wheelDigUsed: false, ticketBought: false,
      cart: false,               // 隔夜矿车已领
      perk4Ad: false,            // 第四格今日广告免费已用
      settleX2: 0,               // 当日结算翻倍广告已用次数
      adMissed: 0,               // 矿车追回广告已用次数(日3)
      overtimeUsed: false,       // 矿工加班已用(日1)
      wishAd: false,             // 许愿广告轨已用(日1)
      chDone: false, chDeep: false, chBest: 0, // 每日挑战
      stats: { m: 0, blocks: 0, fever: 0, items: 0, runs: 0, ore: 0 }
    };
  };
  D.defaultSave = function () {
    return {
      v: 1,
      opt: { bgm: 1, sfx: 1, bgmVol: 0.3, sfxVol: 0.3 }, // 音量0~1，默认30%；0=静音
      supplies: {},                                      // 已购局前补给（下局消耗）
      coin: 0, gem: 0, boxkey: 0, dust: 0, piece: 0, ticket: 0, ssrTicket: 0,
      runCount: 0, cumM: 0, bestM: 0, bestScore: 0, days: 1, lastDay: 0, yesterM: 0,
      signDay: 0,             // 已签到天数(0~7)
      shop: {},               // id->lv
      col: {},                // 藏品 id->1
      dupCount: {},           // 藏品重复次数
      setRewarded: {},        // 套装集齐奖励已发
      pityBox: 0, pitySinceR: 0, boxCount: 0,
      codex: {},              // 图鉴 id->1
      fossils: {},            // 化石收藏 id->数量
      puzzleDone: 0,          // 已完成拼图数（按顺序）
      pieceInCur: 0,          // 当前拼图已镶嵌片数
      skins: ['default'], skin: 'default',
      milesCumDone: [], milesRunDone: [],
      seenUnlock: {},         // 解锁提示已看
      ftue: 0,                // 新手引导进度 0点消→1出道具→2用道具→3完成
      firstCharged: {},       // 首充双倍已用档位
      payLog: {},             // 付费/广告埋点计数
      wish: null,             // 许愿矿灯 {set,left}
      pieceAdUsed: {},        // 拼图广告轨已用（按幅索引）
      monthlyUntil: 0,        // 月卡到期日(dayKey)
      monthlyClaimed: 0,      // 月卡当日已领(dayKey)
      simPaidRmb: 0,          // 模拟累计充值(仅原型统计)
      daily: D.defaultDaily()
    };
  };

  /* ================= 音效注册（全部占位，接入时替换 assets.js 的 sfx） ================= */
  A.defSfx('pop_s', '小组消除(3~5块)：清脆 啵');
  A.defSfx('pop_m', '中组消除(6~8块)：啵+碎石');
  A.defSfx('pop_l', '大组消除(9+块)：轰隆碎裂');
  A.defSfx('dig', '单敲硬掘：镐击 铛');
  A.defSfx('blast_s', '火箭发射音');
  A.defSfx('blast_m', '炸弹爆炸');
  A.defSfx('blast_l', '巨型炸弹/合并大爆炸');
  A.defSfx('drill', '钻地机钻进（持续0.5s）');
  A.defSfx('rainbow', '彩钻虹光音');
  A.defSfx('merge', '道具合并 咔嚓+充能');
  A.defSfx('combo_up', '连击提升 音阶逐级升高(8档)');
  A.defSfx('fever_start', 'Fever开启 拉满的上升音+BGM切快版');
  A.defSfx('fever_end', 'Fever结束 降速音');
  A.defSfx('coin', '金币拾取 叮(可连发)');
  A.defSfx('milestone', '每50m里程碑 锣声');
  A.defSfx('layer', '进入新地层 低沉钟声+风');
  A.defSfx('ice', '冰壳碎裂');
  A.defSfx('poison', '毒块破裂 噗嗤');
  A.defSfx('purify', '全屏净化 圣洁和弦');
  A.defSfx('tnt', 'TNT引爆(连锁时120ms一声,音高递增)');
  A.defSfx('hurt', '耐久大量流失警告');
  A.defSfx('dead', '耐久归零 镐断裂');
  A.defSfx('settle_count', '结算数字滚动 嗒嗒嗒');
  A.defSfx('box_open', '盲盒开启 悬念鼓点+揭晓');
  A.defSfx('box_ssr', 'SSR登场 金光爆发');
  A.defSfx('wheel_spin', '转盘旋转 嗒嗒嗒减速');
  A.defSfx('wheel_win', '转盘中奖');
  A.defSfx('puzzle_place', '拼图镶嵌 咔');
  A.defSfx('puzzle_done', '拼图完成 完整旋律');
  A.defSfx('buy', '商店购买 收银+升级音');
  A.defSfx('event', '事件触发 神秘音');
  A.defSfx('bgm_main', 'BGM:主界面 轻松矿洞民谣循环');
  A.defSfx('bgm_run', 'BGM:局内 节奏挖掘曲(Fever时切1.25倍速版)');
})();
