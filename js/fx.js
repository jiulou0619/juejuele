/* fx.js — 爽感反馈：飘字、粒子、震屏、闪光、横幅 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var U = DG.U;
  var FX = { floaters: [], parts: [], banners: [], shakeT: 0, shakeP: 0, flashT: 0, flashC: '#fff', ox: 0, oy: 0 };
  DG.FX = FX;

  /* 飘字：FX.text(x,y,'+120',{color,size,up,life,pop}) */
  FX.text = function (x, y, txt, o) {
    o = o || {};
    FX.floaters.push({
      x: x, y: y, txt: txt, t: 0,
      life: o.life || 0.9,
      vy: o.up === false ? 0 : -(o.speed || 90),
      size: o.size || 34,
      color: o.color || '#ffd76a',
      stroke: o.stroke !== false,
      pop: o.pop !== false
    });
    if (FX.floaters.length > 18) FX.floaters.shift(); // 同屏飘字硬上限
  };

  /* 图片特效：爆炸/彩光等贴图 放大淡出 */
  FX.sprs = [];
  FX.spr = function (x, y, imgId, size, life) {
    if (FX.lowQ && (size || 160) < 240) return; // 降质时略过小型贴图特效
    FX.sprs.push({ x: x, y: y, id: imgId, size: size || 160, t: 0, life: life || 0.45 });
    if (FX.sprs.length > (FX.lowQ ? 6 : 12)) FX.sprs.shift();
  };

  /* 色块粒子爆开（lowQ=帧率吃紧时主循环置位，粒子减半、上限收紧） */
  FX.lowQ = false;
  FX.burst = function (x, y, color, n, speed) {
    n = n || 8;
    if (FX.lowQ) n = Math.ceil(n / 2);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (speed || 260) * (0.4 + Math.random() * 0.8);
      FX.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t: 0, life: 0.5 + Math.random() * 0.3, size: 8 + Math.random() * 10, color: color });
    }
    var cap = FX.lowQ ? 100 : 220;
    while (FX.parts.length > cap) FX.parts.shift();
  };

  FX.shake = function (power, dur) { FX.shakeP = Math.max(FX.shakeP, power || 6); FX.shakeT = Math.max(FX.shakeT, dur || 0.2); };
  FX.flash = function (color, dur) { FX.flashC = color || '#fff'; FX.flashT = dur || 0.12; };

  /* 大字横幅：队列化串行播放。
   * 治理规则：默认时长加长(不再一闪而过)；积压≥3时低优先级横幅直接丢弃、只轻微加速；
   * 重要事件传 {pri:true}（Fever/进层/化石/羁绊/纪录等）保证必播。 */
  FX.bq = [];
  FX.bcur = null;
  FX.banner = function (txt, o) {
    o = o || {};
    if (!o.pri && FX.bq.length >= 3) return; // 拥挤时丢弃次要提示
    FX.bq.push({ txt: txt, t: 0, life: o.life || 1.6, color: o.color || '#ffcf3f', size: o.size || 72, y: o.y || DG.P.H * 0.32, pri: !!o.pri });
    if (FX.bq.length > 5) { // 超载时优先丢队列里最早的次要项
      for (var i = 0; i < FX.bq.length - 1; i++) if (!FX.bq[i].pri) { FX.bq.splice(i, 1); return; }
      FX.bq.splice(0, 1);
    }
  };

  FX.clear = function () { FX.floaters.length = 0; FX.parts.length = 0; FX.banners.length = 0; FX.bq.length = 0; FX.bcur = null; FX.sprs.length = 0; FX.shakeT = 0; FX.flashT = 0; };

  FX.update = function (dt) {
    var i;
    for (i = FX.floaters.length - 1; i >= 0; i--) {
      var f = FX.floaters[i]; f.t += dt; f.y += f.vy * dt;
      if (f.t >= f.life) FX.floaters.splice(i, 1);
    }
    for (i = FX.parts.length - 1; i >= 0; i--) {
      var p = FX.parts[i]; p.t += dt;
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) FX.parts.splice(i, 1);
    }
    // 横幅队列：串行播放（只轻微加速，保证读得完）
    if (!FX.bcur && FX.bq.length) FX.bcur = FX.bq.shift();
    if (FX.bcur) {
      FX.bcur.t += dt * (FX.bq.length >= 3 ? 1.3 : 1);
      if (FX.bcur.t >= FX.bcur.life) FX.bcur = null;
    }
    for (i = FX.sprs.length - 1; i >= 0; i--) {
      FX.sprs[i].t += dt;
      if (FX.sprs[i].t >= FX.sprs[i].life) FX.sprs.splice(i, 1);
    }
    if (FX.shakeT > 0) {
      FX.shakeT -= dt;
      FX.ox = (Math.random() * 2 - 1) * FX.shakeP;
      FX.oy = (Math.random() * 2 - 1) * FX.shakeP;
      if (FX.shakeT <= 0) { FX.ox = FX.oy = 0; FX.shakeP = 0; }
    }
    if (FX.flashT > 0) FX.flashT -= dt;
  };

  FX.draw = function (ctx) {
    var i;
    for (i = 0; i < FX.sprs.length; i++) {
      var sp = FX.sprs[i], img = DG.A.images[sp.id];
      if (!img) continue;
      var k2 = sp.t / sp.life;
      var s2 = sp.size * (0.7 + k2 * 0.7);
      ctx.globalAlpha = 1 - k2 * k2;
      ctx.drawImage(img, sp.x - s2 / 2, sp.y - s2 / 2, s2, s2);
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < FX.parts.length; i++) {
      var p = FX.parts[i];
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      var s = p.size * (1 - p.t / p.life * 0.5);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < FX.floaters.length; i++) {
      var f = FX.floaters[i];
      var k = f.t / f.life;
      var sc = f.pop && k < 0.2 ? U.easeOutBack(k / 0.2) : 1;
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.font = 'bold ' + Math.floor(f.size * sc) + 'px Xiaolai, sans-serif';
      if (f.stroke) { // lowQ时strokeText换成底字双绘（手机描边文字极慢）
        if (FX.lowQ) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.txt, f.x, f.y + 2); }
        else { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5; ctx.strokeText(f.txt, f.x, f.y); }
      }
      ctx.fillStyle = f.color;
      ctx.fillText(f.txt, f.x, f.y);
    }
    if (FX.bcur) {
      var b = FX.bcur;
      var kk = b.t / b.life;
      var scale = kk < 0.25 ? U.easeOutBack(kk / 0.25) : 1;
      ctx.globalAlpha = kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1;
      ctx.font = 'bold ' + Math.floor(b.size * scale) + 'px Xiaolai, sans-serif';
      if (FX.lowQ) { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(b.txt, DG.P.W / 2, b.y + 3); }
      else { ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 8; ctx.strokeText(b.txt, DG.P.W / 2, b.y); }
      ctx.fillStyle = b.color;
      ctx.fillText(b.txt, DG.P.W / 2, b.y);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
    if (FX.flashT > 0) {
      ctx.globalAlpha = Math.min(0.5, FX.flashT * 4);
      ctx.fillStyle = FX.flashC;
      ctx.fillRect(-20, -20, DG.P.W + 40, DG.P.H + 40);
      ctx.globalAlpha = 1;
    }
  };
})();
