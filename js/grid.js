/* grid.js — 挖掘棋盘核心：连通消除、上升补位(挖深错觉)、特殊道具、连锁
 * 坐标：row 0 在屏幕顶部；消除后下方方块向上补位、新行从底部进入 => 表现为"越挖越深"
 * 内容表全部来自 DG.D（rollCell / blockDefs / tune）
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U;
  var G = {};
  DG.Grid = G;

  /* ---------- 初始化 ---------- */
  G.newRun = function (boardX, boardY, boardW, boardH) {
    var D = DG.D;
    G.cols = D.tune.cols;
    G.cell = Math.floor(boardW / G.cols);
    G.rows = Math.floor(boardH / G.cell);
    G.x = boardX + (boardW - G.cell * G.cols) / 2;
    G.y = boardY;
    G.cells = [];
    G.depthRow = 0;        // 累计生成的行数（越大=挖得越深）
    G.busy = 0;            // >0 时动画中，暂不接受输入
    G.chain = [];          // 待触发的特殊道具 [{r,c,sp,delay}]
    G.pops = [];           // 消除闪光动画 [{x,y,t,color}]
    G.spOrder = 0;
    for (var r = 0; r < G.rows; r++) {
      var row = [];
      for (var c = 0; c < G.cols; c++) { var cl = DG.D.rollCell(G.depthRow, r < 3); G.depthRow++; cl._pr = r; row.push(cl); }
      G.cells.push(row);
    }
  };

  G.at = function (r, c) {
    if (r < 0 || c < 0 || r >= G.rows || c >= G.cols) return null;
    return G.cells[r][c];
  };

  G.cellXY = function (r, c) { return { x: G.x + c * G.cell, y: G.y + r * G.cell }; };
  G.hitCell = function (px, py) {
    var c = Math.floor((px - G.x) / G.cell), r = Math.floor((py - G.y) / G.cell);
    if (r < 0 || c < 0 || r >= G.rows || c >= G.cols) return null;
    return { r: r, c: c };
  };

  /* ---------- 连通查找（同色 kind=color 且无冰） ---------- */
  G.groupAt = function (r, c) {
    var start = G.at(r, c);
    if (!start || start.kind !== 'color' || start.ice > 0) return [];
    var t = start.t, seen = {}, stack = [[r, c]], out = [];
    while (stack.length) {
      var cur = stack.pop(), rr = cur[0], cc = cur[1], key = rr + '_' + cc;
      if (seen[key]) continue;
      seen[key] = 1;
      var cell = G.at(rr, cc);
      if (!cell || cell.kind !== 'color' || cell.t !== t || cell.ice > 0) continue;
      out.push({ r: rr, c: cc, cell: cell });
      stack.push([rr - 1, cc], [rr + 1, cc], [rr, cc - 1], [rr, cc + 1]);
    }
    return out;
  };

  /* ---------- 消除结算 ----------
   * 返回事件列表供 run.js 计分：
   * {ev:'clear',n,color,cx,cy} {ev:'treasure',id,x,y} {ev:'obstacle',id,x,y,dead}
   * {ev:'special_spawn',sp} {ev:'special_fire',sp} {ev:'hazard',id}
   */
  function destroyCell(r, c, cause, evs) {
    var cell = G.at(r, c);
    if (!cell) return;
    var p = G.cellXY(r, c), cx = p.x + G.cell / 2, cy = p.y + G.cell / 2;
    var def = DG.D.blockDefs[cell.kind === 'color' ? 'color' : cell.t] || {};

    // 障碍类：先扣血
    if (cell.kind === 'block') {
      var mods = (DG.Run && DG.Run.mods) || {};
      cell.hp -= (cause === 'special' ? 2 : 1);
      if (mods.rockOneHit && cell.t === 'rock') cell.hp = 0;
      DG.FX.burst(cx, cy, cell.color || '#888', 4, 160);
      if (cell.hp > 0) { evs.push({ ev: 'obstacle', id: cell.t, x: cx, y: cy, dead: false }); return; }
      evs.push({ ev: 'obstacle', id: cell.t, x: cx, y: cy, dead: true });
      if (def.onDestroy) def.onDestroy(r, c, evs, cause);
      G.cells[r][c] = null;
      G.pops.push({ x: cx, y: cy, t: 0, color: cell.color || '#999' });
      return;
    }
    // 冰冻覆盖：破冰不破块
    if (cell.ice > 0 && cause !== 'special') {
      cell.ice--;
      DG.FX.burst(cx, cy, '#bfe8ff', 5, 150);
      evs.push({ ev: 'ice', x: cx, y: cy });
      return;
    }
    // 特殊道具被波及 → 连锁
    if (cell.kind === 'special') {
      G.chain.push({ r: r, c: c, sp: cell.sp, delay: 0.12 });
      G.cells[r][c] = null;
      return;
    }
    // 彩色块
    if (cell.item) evs.push({ ev: 'treasure', id: cell.item, x: cx, y: cy });
    if (cell.hazard) evs.push({ ev: 'hazard', id: cell.hazard, x: cx, y: cy, r: r, c: c });
    G.cells[r][c] = null;
    G.pops.push({ x: cx, y: cy, t: 0, color: cell.color });
    DG.FX.burst(cx, cy, cell.color, 5, 200);
  }

  /* 组消除周围的障碍伤害（相邻挖掘规则）；Fever期间波及一圈全消 */
  function damageNeighbors(group, evs) {
    var seen = {}, i;
    for (i = 0; i < group.length; i++) seen[group[i].r + '_' + group[i].c] = 1;
    var fever = !!(DG.Run && DG.Run.mods && DG.Run.mods.feverOn);
    for (i = 0; i < group.length; i++) {
      var g = group[i];
      var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (var d = 0; d < 4; d++) {
        var rr = g.r + dirs[d][0], cc = g.c + dirs[d][1], key = rr + '_' + cc;
        if (seen[key]) continue;
        var n = G.at(rr, cc);
        if (!n) continue;
        if (n.kind === 'block' || n.ice > 0) { seen[key] = 1; destroyCell(rr, cc, 'adjacent', evs); }
        else if (fever && n.kind === 'color') { seen[key] = 1; destroyCell(rr, cc, 'pop', evs); evs.push({ ev: 'fever_splash' }); }
      }
    }
  }

  /* 点击一组：≥matchMin 整组消除；生成特殊道具 */
  G.popGroup = function (r, c) {
    var evs = [];
    var group = G.groupAt(r, c);
    var min = (DG.Run && DG.Run.mods && DG.Run.mods.feverOn) ? 2 : DG.D.tune.matchMin;
    if (group.length < min) return { evs: evs, n: 0 };
    var color = group[0].cell.t, colorHex = group[0].cell.color;
    damageNeighbors(group, evs);
    for (var i = 0; i < group.length; i++) {
      var g = group[i];
      if (G.at(g.r, g.c) !== g.cell) continue; // 格子已被替换(如毒块感染)则跳过，防连环误消
      destroyCell(g.r, g.c, 'pop', evs);
    }
    // ≥4 生成特殊道具（生成在点击位置）；场上上限=spCap，超出则最早的自动引爆
    var spId = DG.D.specialForSize(group.length);
    if (spId === 'rocket') {
      // 火箭方向由消除组形状决定：组更高→竖火箭清列，更宽→横火箭清行
      var mnR = 1e9, mxR = -1, mnC = 1e9, mxC = -1;
      for (var gi = 0; gi < group.length; gi++) {
        if (group[gi].r < mnR) mnR = group[gi].r; if (group[gi].r > mxR) mxR = group[gi].r;
        if (group[gi].c < mnC) mnC = group[gi].c; if (group[gi].c > mxC) mxC = group[gi].c;
      }
      var hh = mxR - mnR, ww = mxC - mnC;
      spId = hh > ww ? 'rocket' : hh < ww ? 'hrocket' : (Math.random() < 0.5 ? 'rocket' : 'hrocket');
    }
    if (spId && !G.at(r, c)) {
      G.cells[r][c] = { kind: 'special', sp: spId, fy: 0, spo: G.spOrder++ };
      var sxy = G.cellXY(r, c);
      evs.push({ ev: 'special_spawn', sp: spId, x: sxy.x + G.cell / 2, y: sxy.y + G.cell / 2 });
      var sps = [];
      for (var ri = 0; ri < G.rows; ri++) for (var ci = 0; ci < G.cols; ci++) {
        var sc = G.at(ri, ci);
        if (sc && sc.kind === 'special') sps.push({ r: ri, c: ci, o: sc.spo || 0 });
      }
      if (sps.length > DG.D.tune.spCap) {
        sps.sort(function (a, b) { return a.o - b.o; });
        G.chain.push({ r: sps[0].r, c: sps[0].c, sp: G.at(sps[0].r, sps[0].c).sp, delay: 0.2 });
        G.cells[sps[0].r][sps[0].c] = null;
      }
    }
    var p = G.cellXY(r, c);
    evs.unshift({ ev: 'clear', n: group.length, color: color, cx: p.x + G.cell / 2, cy: p.y + G.cell / 2, colorHex: colorHex });
    G.collapse();
    G.busy = Math.max(G.busy, 0.16);
    return { evs: evs, n: group.length };
  };

  /* 单块挖掘（不足三连时） */
  G.digSingle = function (r, c) {
    var evs = [];
    var cell = G.at(r, c);
    if (!cell) return { evs: evs, n: 0 };
    if (cell.kind === 'special') return G.fireSpecial(r, c);
    var p = G.cellXY(r, c);
    if (cell.kind === 'block' && cell.t === 'rock') cell.hp = 1; // 单敲硬岩直接碎（耗5耐久）
    destroyCell(r, c, cell.kind === 'block' ? 'adjacent' : 'pop', evs);
    evs.unshift({ ev: 'dig', n: 1, cx: p.x + G.cell / 2, cy: p.y + G.cell / 2 });
    G.collapse();
    G.busy = Math.max(G.busy, 0.12);
    return { evs: evs, n: 1 };
  };

  /* ---------- 特殊道具 ---------- */
  function cellsForSpecial(sp, r, c) {
    var out = [], i, j;
    var wide = !!(DG.Run && DG.Run.mods && DG.Run.mods.wideRocket); // 强化:贯穿弹头
    if (sp === 'bomb') { for (i = r - 1; i <= r + 1; i++) for (j = c - 1; j <= c + 1; j++) out.push([i, j]); }               // 炸弹=小范围3×3
    else if (sp === 'bigbomb') { for (i = r - 2; i <= r + 2; i++) for (j = c - 2; j <= c + 2; j++) out.push([i, j]); }        // TNT/大爆炸=大范围5×5
    else if (sp === 'hrocket') { for (j = 0; j < G.cols; j++) { out.push([r, j]); if (wide) out.push([r + 1, j]); } }         // 横火箭=整行
    else if (sp === 'rocket') { for (i = 0; i < G.rows; i++) { out.push([i, c]); if (wide) out.push([i, c + 1]); } }          // 竖火箭=整列
    else if (sp === 'drill') { for (i = r; i < G.rows; i++) for (j = c - 1; j <= c + 1; j++) out.push([i, j]); }              // 钻地机=从所在处向下钻穿3列宽
    else if (sp === 'cross') { for (j = 0; j < G.cols; j++) out.push([r, j]); for (i = 0; i < G.rows; i++) out.push([i, c]); }
    else if (sp === 'bigcross') {
      for (i = r - 1; i <= r + 1; i++) for (j = 0; j < G.cols; j++) out.push([i, j]);
      for (i = 0; i < G.rows; i++) for (j = c - 1; j <= c + 1; j++) out.push([i, j]);
    }
    else if (sp === 'rainbow2') {
      var cnt2 = {};
      for (i = 0; i < G.rows; i++) for (j = 0; j < G.cols; j++) {
        var cl2 = G.at(i, j);
        if (cl2 && cl2.kind === 'color' && cl2.ice <= 0) cnt2[cl2.t] = (cnt2[cl2.t] || 0) + 1;
      }
      var tops = Object.keys(cnt2).sort(function (a, b) { return cnt2[b] - cnt2[a]; }).slice(0, 2);
      for (i = 0; i < G.rows; i++) for (j = 0; j < G.cols; j++) {
        var cl3 = G.at(i, j);
        if (cl3 && cl3.kind === 'color' && tops.indexOf(cl3.t) >= 0) out.push([i, j]);
      }
      out.push([r, c]);
    }
    else if (sp === 'rainbow') {
      // 清除场上数量最多的颜色
      var count = {}, best = null, bn = 0;
      for (i = 0; i < G.rows; i++) for (j = 0; j < G.cols; j++) {
        var cc = G.at(i, j);
        if (cc && cc.kind === 'color' && cc.ice <= 0) { count[cc.t] = (count[cc.t] || 0) + 1; if (count[cc.t] > bn) { bn = count[cc.t]; best = cc.t; } }
      }
      for (i = 0; i < G.rows; i++) for (j = 0; j < G.cols; j++) {
        var c2 = G.at(i, j);
        if (c2 && c2.kind === 'color' && c2.t === best) out.push([i, j]);
      }
      out.push([r, c]);
    } else if (sp === 'nuke') { for (i = 0; i < G.rows; i++) for (j = 0; j < G.cols; j++) out.push([i, j]); }
    return out;
  }

  G.fireSpecial = function (r, c, spOverride) {
    var evs = [];
    var cell = G.at(r, c);
    var sp = spOverride || (cell && cell.sp);
    if (!sp) return { evs: evs, n: 0 };
    // 仅当引爆的是自己时移除；连锁/拖放落点若是其他道具，交给波及逻辑正常连锁而非静默删除
    if (!spOverride && cell && cell.kind === 'special') G.cells[r][c] = null;
    var area = cellsForSpecial(sp, r, c);
    // 先快照目标，再按身份销毁：中途被感染/替换的新块不会在同次引爆中被连杀
    var targets = [], i;
    for (i = 0; i < area.length; i++) {
      var t0 = G.at(area[i][0], area[i][1]);
      if (t0) targets.push({ r: area[i][0], c: area[i][1], cell: t0 });
    }
    var n = 0;
    for (i = 0; i < targets.length; i++) {
      if (G.at(targets[i].r, targets[i].c) !== targets[i].cell) continue;
      destroyCell(targets[i].r, targets[i].c, 'special', evs);
      n++;
    }
    var p = G.cellXY(r, c);
    evs.unshift({ ev: 'special_fire', sp: sp, n: n, cx: p.x + G.cell / 2, cy: p.y + G.cell / 2 });
    DG.FX.shake(sp === 'nuke' ? 16 : 8, 0.25);
    G.collapse();
    G.busy = Math.max(G.busy, 0.2);
    return { evs: evs, n: n };
  };

  /* 拖拽合并两个特殊道具 → 升级效果 */
  G.mergeSpecials = function (r1, c1, r2, c2) {
    var a = G.at(r1, c1), b = G.at(r2, c2);
    if (!a || !b || a.kind !== 'special' || b.kind !== 'special') return null;
    var merged = DG.D.mergeTable(a.sp, b.sp);
    G.cells[r1][c1] = null;
    G.cells[r2][c2] = null;
    return G.fireSpecial(r2, c2, merged);
  };

  /* ---------- 补位：下方上升 + 底部生成新行 ---------- */
  G.collapse = function () {
    for (var c = 0; c < G.cols; c++) {
      var stack = [];
      for (var r = 0; r < G.rows; r++) if (G.cells[r][c]) stack.push(G.cells[r][c]);
      // 依次从顶部放回，空位由底部新块补
      for (var r2 = 0; r2 < G.rows; r2++) {
        var idx = r2;
        if (idx < stack.length) {
          var old = stack[idx]._pr;
          G.cells[r2][c] = stack[idx];
          if (old != null && old !== r2) stack[idx].fy = (old - r2) * G.cell + (stack[idx].fy || 0); // 从旧位置滑入
        } else {
          var fresh = DG.D.rollCell(G.depthRow, false);
          G.depthRow++;
          fresh.fy = (G.rows - r2 + 1) * G.cell; // 从屏幕底部下方滑入
          G.cells[r2][c] = fresh;
        }
      }
    }
    // 记录当前位置供下次动画
    for (var rr = 0; rr < G.rows; rr++) for (var cc = 0; cc < G.cols; cc++) { var cl = G.cells[rr][cc]; if (cl) cl._pr = rr; }
  };

  /* ---------- 帧更新 ---------- */
  G.step = function (dt) {
    if (G.busy > 0) G.busy -= dt;
    var speed = G.cell * 16;
    for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
      var cell = G.cells[r][c];
      if (cell && cell.fy) {
        var dir = cell.fy > 0 ? -1 : 1;
        cell.fy += dir * speed * dt;
        if ((dir === -1 && cell.fy < 0) || (dir === 1 && cell.fy > 0)) cell.fy = 0;
        if (cell.fy !== 0) G.busy = Math.max(G.busy, 0.01);
      }
    }
    for (var i = G.pops.length - 1; i >= 0; i--) {
      G.pops[i].t += dt;
      if (G.pops[i].t > 0.25) G.pops.splice(i, 1);
    }
    // 连锁特殊道具
    var fired = [];
    for (var k = G.chain.length - 1; k >= 0; k--) {
      var ch = G.chain[k];
      ch.delay -= dt;
      if (ch.delay <= 0) { G.chain.splice(k, 1); fired.push(ch); }
    }
    var chainEvs = [];
    for (var f = 0; f < fired.length; f++) {
      var res = G.fireSpecial(fired[f].r, fired[f].c, fired[f].sp);
      chainEvs = chainEvs.concat(res.evs);
    }
    return chainEvs;
  };

  /* ---------- 绘制 ---------- */
  G.draw = function (ctx) {
    var pad = 3;
    for (var r = 0; r < G.rows; r++) for (var c = 0; c < G.cols; c++) {
      var cell = G.cells[r][c];
      if (!cell) continue;
      var p = G.cellXY(r, c);
      var y = p.y + (cell.fy || 0);
      DG.D.drawCell(ctx, cell, p.x + pad, y + pad, G.cell - pad * 2);
    }
    for (var i = 0; i < G.pops.length; i++) {
      var pp = G.pops[i], k = pp.t / 0.25;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = pp.color || '#fff';
      var s = G.cell * (0.5 + k * 0.7);
      ctx.beginPath(); ctx.arc(pp.x, pp.y, s / 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  };
})();
