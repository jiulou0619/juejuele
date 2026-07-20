/* assets.js — 资源占位系统
 * 现阶段所有贴图用「色块+emoji/文字」代替，音效为空实现。
 * 每个资源都在此注册（含给美术的说明），之后替换为真实图片/音频时只改这里。
 */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var A = { reg: {}, sfxReg: {}, images: {} };
  DG.A = A;
  var U = DG.U;

  /* 注册一个视觉资源：id, {glyph:占位emoji/字, color:占位底色, shape:'rect'|'circle'|'none', art:'给美术的说明', size:'建议尺寸'} */
  A.def = function (id, o) { A.reg[id] = o; return id; };
  /* 注册一个音效：id, 说明 */
  A.defSfx = function (id, desc) { A.sfxReg[id] = desc; return id; };

  /* 绘制资源占位：底色圆角块 + 居中 glyph */
  A.draw = function (ctx, id, x, y, w, h, opts) {
    opts = opts || {};
    var img = A.images[id];
    if (img) { ctx.drawImage(img, x, y, w, h); return; } // 有真实贴图直接画（无需注册占位）
    var r = A.reg[id];
    if (!r) return; // 图未加载完/弱网失败：静默跳过，别糊一屏品红占位
    if (r.shape !== 'none') {
      ctx.fillStyle = opts.color || r.color || '#555';
      if (r.shape === 'circle') {
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        U.rr(ctx, x, y, w, h, Math.min(w, h) * 0.18); ctx.fill();
      }
      if (opts.border !== false) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
        if (r.shape === 'circle') { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 1, 0, Math.PI * 2); ctx.stroke(); }
        else { U.rr(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(w, h) * 0.18); ctx.stroke(); }
      }
    }
    if (r.glyph) {
      ctx.font = Math.floor(h * (r.glyphScale || 0.58)) + 'px Xiaolai, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = r.glyphColor || '#fff';
      ctx.fillText(r.glyph, x + w / 2, y + h / 2 + h * 0.03);
    }
  };

  /* 图标按需染色（按钮内的图标要跟按钮文字同色，否则和底色糊成一片）。
   * 结果缓存成离屏画布，同一(图标,颜色)只算一次；超量整体清空。 */
  var tintCache = {}, tintN = 0;
  A.tinted = function (id, color) {
    var key = id + '|' + color;
    var c = tintCache[key];
    if (c !== undefined) return c;
    var img = A.images[id];
    if (!img) return null;                       // 图还没加载：这次先按原色画
    try {
      var cv = DG.P.newCanvas(64, 64), g = cv.getContext('2d');
      g.drawImage(img, 0, 0, 64, 64);
      g.globalCompositeOperation = 'source-in';  // 只保留图标形状，整体填成目标色
      g.fillStyle = color;
      g.fillRect(0, 0, 64, 64);
      if (tintN > 120) { tintCache = {}; tintN = 0; }
      tintCache[key] = cv; tintN++;
      return cv;
    } catch (e) { tintCache[key] = null; return null; }
  };
  /* 染色绘制：拿不到染色版就退回原色，绝不空绘 */
  A.drawTint = function (ctx, id, x, y, w, h, color) {
    var t = color && A.tinted(id, color);
    if (t) ctx.drawImage(t, x, y, w, h);
    else A.draw(ctx, id, x, y, w, h);
  };

  /* ---------- 真实音效（assets/sfx/*.mp3；未映射的id保持静音） ---------- */
  A.sfxFiles = {
    dig: 'dig.mp3', pop_s: 'collect_sound.mp3', pop_m: 'dig_double_sound.mp3', pop_l: 'dig_hard_sound.mp3',
    blast_s: 'rocket_launch.mp3', blast_m: 'bomb_sound.mp3', blast_l: 'bomb2.mp3',
    drill: 'swing_sound.mp3', rainbow: 'sharp_sound_sound.mp3', merge: 'special_combine.mp3',
    combo_up: 'clear_combo.mp3', fever_start: 'fever.mp3', fever_end: 'clear_combo2.mp3',
    coin: 'collect_point.mp3', milestone: 'bonus_sound.mp3', layer: 'new_level.mp3',
    ice: 'sharp_sound_sound.mp3', poison: 'collect_item.mp3', purify: 'bonus_earned.mp3',
    tnt: 'tnt.mp3', dead: 'failed.mp3',
    settle_count: 'fast_high_ui_sound.mp3', box_open: 'success.mp3', box_ssr: 'yay.mp3',
    wheel_spin: 'fast_high_ui_sound.mp3', wheel_win: 'success.mp3',
    puzzle_place: 'collect_item.mp3', puzzle_done: 'bonus_earned.mp3',
    buy: 'gold_acquire_sound.mp3', event: 'interface_click.mp3', ui: 'interface_click.mp3'
  };
  var sfxPool = {}, sfxLast = {};
  var hasWxAudio = typeof wx !== 'undefined' && !!wx.createInnerAudioContext;
  function sfxVol() {
    var sv = DG.SAVE && DG.SAVE.d;
    if (!sv || !sv.opt) return 0.3;
    if (!sv.opt.sfx) return 0;
    return sv.opt.sfxVol != null ? sv.opt.sfxVol : 0.3;
  }
  A.sfx = function (id, opts) {
    if (opts && opts.vibrate) DG.P.vibrate(opts.strong);
    if (sfxVol() <= 0) return; // 音量0=静音
    var f = A.sfxFiles[id];
    if (!f) return;
    var now = Date.now();
    if (sfxLast[id] && now - sfxLast[id] < 70) return; // 同音效70ms限流，防连点刷屏
    sfxLast[id] = now;
    try {
      var pool = sfxPool[id] || (sfxPool[id] = []);
      var a = null;
      for (var i = 0; i < pool.length; i++) {
        var c = pool[i];
        if (hasWxAudio ? !c.__busy : (c.paused || c.ended)) { a = c; break; }
      }
      if (!a && pool.length < 4) {
        if (hasWxAudio) {
          a = wx.createInnerAudioContext();
          a.src = 'assets/sfx/' + f;
          (function (ac) { ac.onEnded(function () { ac.__busy = false; }); ac.onError(function () { ac.__busy = false; }); })(a);
        } else {
          a = new Audio('assets/sfx/' + f);
        }
        pool.push(a);
      }
      if (!a) return;
      if (hasWxAudio) { a.__busy = true; a.volume = sfxVol(); a.stop(); a.play(); }
      else { a.currentTime = 0; a.volume = sfxVol(); var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); }
    } catch (e) {}
  };

  /* ---------- BGM：bgm_1→2→3→4→回到1 永久循环，音量30%，可开关 ---------- */
  A.bgmFiles = ['bgm_1.mp3', 'bgm_2.mp3', 'bgm_3.mp3', 'bgm_4.mp3'];
  var bgm = { idx: 0, cur: null, started: false };
  function bgmVol() {
    var sv = DG.SAVE && DG.SAVE.d;
    if (!sv || !sv.opt) return 0.3;
    if (!sv.opt.bgm) return 0;
    return sv.opt.bgmVol != null ? sv.opt.bgmVol : 0.3;
  }
  function bgmOn() { return bgmVol() > 0; }
  function playBgmTrack(i) {
    bgm.idx = ((i % A.bgmFiles.length) + A.bgmFiles.length) % A.bgmFiles.length;
    if (!bgmOn()) { bgm.started = false; return; }
    var src = 'assets/sfx/' + A.bgmFiles[bgm.idx];
    try {
      if (hasWxAudio) {
        if (!bgm.cur) {
          bgm.cur = wx.createInnerAudioContext();
          bgm.cur.onEnded(function () { playBgmTrack(bgm.idx + 1); }); // 放完接下一首，取模回到第1首
          bgm.cur.onError(function () { playBgmTrack(bgm.idx + 1); });
        }
        bgm.cur.src = src; bgm.cur.volume = bgmVol(); bgm.cur.play();
      } else {
        if (!bgm.cur) {
          bgm.cur = new Audio();
          bgm.cur.addEventListener('ended', function () { playBgmTrack(bgm.idx + 1); });
          bgm.cur.addEventListener('error', function () { playBgmTrack(bgm.idx + 1); });
        }
        bgm.cur.src = src; bgm.cur.volume = bgmVol();
        var pr = bgm.cur.play();
        if (pr && pr.catch) pr.catch(function () { bgm.started = false; }); // 浏览器需用户手势，失败下次点按重试
      }
    } catch (e) { bgm.started = false; }
  }
  A.startBgm = function () {
    if (bgm.started || !bgmOn()) return;
    bgm.started = true;
    playBgmTrack(bgm.idx);
  };
  /* 滑条调音量：实时应用；调到0=暂停，从0调起=续播 */
  A.applyBgmVol = function () {
    var v = bgmVol();
    if (v <= 0) { A.setBgm(false); return; }
    try { if (bgm.cur) bgm.cur.volume = v; } catch (e) {}
    if (!bgm.started) A.setBgm(true);
  };
  /* 开关切换：关=暂停当前曲目，开=从暂停处继续（或重新起播） */
  A.setBgm = function (on) {
    if (!on) {
      bgm.started = false;
      try { if (bgm.cur) bgm.cur.pause(); } catch (e) {}
    } else {
      if (bgm.cur) {
        bgm.started = true;
        try { var pr = bgm.cur.play(); if (pr && pr.catch) pr.catch(function () { bgm.started = false; }); } catch (e) { bgm.started = false; }
      } else A.startBgm();
    }
  };

  /* ---------- 真实贴图清单（assets/ 下；加载完成前自动回退文字占位） ---------- */
  A.manifest = {
    block_red: 'block_red.png', block_blue: 'block_blue.png', block_green: 'block_green.png',
    block_yellow: 'block_yellow.png', block_purple: 'block_purple.png',
    blk_rock: 'blk_rock.png', blk_rock2: 'blk_rock2.png', blk_tnt: 'blk_tnt.png',
    blk_ice: 'blk_ice.png', blk_poison: 'blk_poison.png', blk_gold: 'blk_gold.png',
    blk_repair: 'blk_repair.png', blk_fossil: 'blk_fossil.png', blk_fossil2: 'blk_fossil2.png', blk_fossil3: 'blk_fossil3.png',
    sp_rocket: 'sp_rocket.png', sp_hrocket: 'sp_hrocket.png', sp_bomb: 'sp_bomb.png',
    sp_drill: 'sp_drill.png', sp_rainbow: 'sp_rainbow.png',
    ev_merchant: 'ev_merchant.png', ev_gamble: 'ev_gamble.png', ev_chest: 'ev_chest.png', ev_puzzle: 'ev_puzzle.png',
    bg_topsoil: 'bg_topsoil.jpg', bg_stone: 'bg_stone.jpg', bg_ice: 'bg_ice.jpg', bg_gas: 'bg_gas.jpg', bg_lava: 'bg_lava.jpg',
    fx_pop_s: 'fx_pop_s.png', fx_pop_m: 'fx_pop_m.png', fx_blast: 'fx_blast.png',
    fx_dirt: 'fx_dirt.png', fx_rainbow_s: 'fx_rainbow_s.png', fx_rainbow_l: 'fx_rainbow_l.png',
    fx_fever_frame: 'fx_fever_frame.png', fx_lava_strip: 'fx_lava_strip.png',
    // 货币/HUD 图标统一走 ic_ 图标集（同一套线条与描边，避免新旧两批混用）
    ui_coin: 'ic_coin.png', ui_gem: 'ic_gem.png', ui_key: 'ic_key.png', ui_ticket: 'ic_ticket.png',
    ui_fire: 'ic_fire.png', ui_flag: 'ic_flag.png', ui_trophy: 'ic_trophy.png', ui_share: 'ic_share.png',
    ui_dust: 'ic_spark.png', ui_puzzle: 'ic_puzzle.png', ui_energy: 'ic_pick.png',
    logo: 'logo.png', wheel_face: 'wheel_face.png', wheel_blank: 'wheel_blank.png',
    wp_coin: 'wp_coin.png', wp_gem: 'wp_gem.png', wp_bomb: 'wp_bomb.png', wp_gold: 'wp_gold.png',
    wp_ticket: 'wp_ticket.png', wp_dust: 'wp_dust.png', wp_puzzle: 'wp_puzzle.png', wp_boxkey: 'wp_boxkey.png',
    chest_closed: 'chest_closed.png', chest_open: 'chest_open.png',
    dog_corgi: 'dog_corgi.png', dog_dachs: 'dog_dachs.png', dog_bulldog: 'dog_bulldog.png', dog_schnauzer: 'dog_schnauzer.png',
    ui_exit_badge: 'ui_exit_badge.png',
    panel_gold: 'panel_gold.png', panel_blue: 'panel_blue.png', panel_gray: 'panel_gray.png',
    panel_dark: 'panel_dark.png', panel_brown: 'panel_brown.png',
    bs_panel: 'bs_panel.png', bs_button: 'bs_button.png', bs_bar: 'bs_bar.png',
    bs_book: 'bs_book.png', bs_slot: 'bs_slot.png', bs_window: 'bs_window.png',
    fo_g1: 'fo_g1.png', fo_g2: 'fo_g2.png', fo_g3: 'fo_g3.png', fo_g4: 'fo_g4.png', fo_g5: 'fo_g5.png',
    fo_p1: 'fo_p1.png', fo_p2: 'fo_p2.png', fo_p3: 'fo_p3.png', fo_p4: 'fo_p4.png',
    fo_o1: 'fo_o1.png', fo_o2: 'fo_o2.png', fo_o3: 'fo_o3.png',
    puzzle_p1: 'puzzle_p1.jpg', puzzle_p2: 'puzzle_p2.jpg', puzzle_p3: 'puzzle_p3.jpg',
    puzzle_p4: 'puzzle_p4.jpg', puzzle_p5: 'puzzle_p5.jpg', puzzle_p6: 'puzzle_p6.jpg',
    sk_default: 'sk_default.png', sk_lava: 'sk_lava.png', sk_ghost: 'sk_ghost.png',
    sk_goldpick: 'sk_goldpick.png', sk_lemon: 'sk_lemon.png', sk_starry: 'sk_starry.png',
    sk_sakura: 'sk_sakura.png', sk_champ: 'sk_champ.png',
    vu_panel: 'vu_panel.png', vu_slot: 'vu_slot.png', vu_barbase: 'vu_barbase.png', vu_note: 'vu_note.png',
    vu_button_yellow: 'vu_button_yellow.png', vu_button_green: 'vu_button_green.png',
    vu_button_red: 'vu_button_red.png', vu_button_purple: 'vu_button_purple.png',
    vu_button_blue: 'vu_button_blue.png', vu_button_cream: 'vu_button_cream.png',
    vu_button_black: 'vu_button_black.png',
    vu_bar_yellow: 'vu_bar_yellow.png', vu_bar_green: 'vu_bar_green.png', vu_bar_red: 'vu_bar_red.png',
    vu_bar_purple: 'vu_bar_purple.png', vu_bar_blue: 'vu_bar_blue.png',
    vu_bar_cream: 'vu_bar_cream.png', vu_bar_black: 'vu_bar_black.png',
    vu_label: 'vu_labelAdvanced_black.png', vu_container: 'vu_colorContainer_black.png',
    pr_btn: 'pr_btn.png', pr_btn_h: 'pr_btn_h.png', pr_plate: 'pr_plate.png',
    pr_snd_on: 'pr_snd_on.png', pr_snd_off: 'pr_snd_off.png',
    pr_arrow_l: 'pr_arrow_l.png', pr_arrow_r: 'pr_arrow_r.png',
    ic_shop: 'ic_shop.png', ic_box: 'ic_box.png', ic_book: 'ic_book.png',
    ic_wheel: 'ic_wheel.png', ic_puzzle: 'ic_puzzle.png', ic_gym: 'ic_gym.png',
    ic_music: 'ic_music.png', ic_music_off: 'ic_music_off.png'
  };
  /* 图标包（白图标已按语义染色烘焙成 assets/ic_*.png），统一走 ic_ 前缀 */
  A.ICONS = ('coin gem key ticket pick fire flag trophy share tick lock unlock excl quest refresh settings ' +
    'down back next calendar chest puzzle shop book wheel gym bomb rocket magnet ruler stamina star bone ingot ' +
    'stone crown tag bag potion snow volcano meteor toxic repair friends hammer shovel compass map light leaf ' +
    'mountain ghost skull shield clock bell spark rank like sycee starcoin clover rainbow night sun heart wand ' +
    'bookmark ring axe doc grid info cross gem2 plus mult music music_off target ' +
    'wrench drill hit npc tv sword nail orb pear flower water link battery watch cat protect ' +
    'adjust robot chip star6 star3 horn cart fog demon dagger saw capsule').split(' ');
  for (var ii = 0; ii < A.ICONS.length; ii++) A.manifest['ic_' + A.ICONS[ii]] = 'ic_' + A.ICONS[ii] + '.png';

  A.preload = function () {
    for (var id in A.manifest) (function (key) {
      DG.P.newImage('assets/' + A.manifest[key], function (img) { A.images[key] = img; });
    })(id);
  };

  /* ---------- 通用 UI 资源 ---------- */
  A.def('ui_coin', { glyph: '🪙', shape: 'none', art: '金币图标 64x64，卡通描边风', size: '64x64' });
  A.def('ui_gem', { glyph: '💎', shape: 'none', art: '钻石(高级货币)图标 64x64', size: '64x64' });
  A.def('ui_key', { glyph: '🔑', shape: 'none', art: '盲盒钥匙(盲盒券)图标 64x64', size: '64x64' });
  A.def('ui_energy', { glyph: '⛏️', shape: 'none', art: '镐力(体力)图标 64x64', size: '64x64' });
  A.def('ui_ticket', { glyph: '🎟️', shape: 'none', art: '转盘券图标 64x64', size: '64x64' });
  A.def('ui_puzzle', { glyph: '🧩', shape: 'none', art: '拼图碎片图标 64x64', size: '64x64' });
})();
