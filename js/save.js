/* save.js — 存档（局外永久数据），默认结构在 data.js 的 DG.D.defaultSave() */
var DG = typeof GameGlobal !== 'undefined' ? (GameGlobal.DG = GameGlobal.DG || {}) : (window.DG = window.DG || {});

(function () {
  var KEY = 'digo_save_v1';
  var S = { d: null, _t: 0 };
  DG.SAVE = S;

  function merge(dst, src) { // 版本升级时补新字段
    for (var k in src) {
      if (dst[k] === undefined) dst[k] = src[k];
      else if (typeof src[k] === 'object' && src[k] && !Array.isArray(src[k]) && typeof dst[k] === 'object' && dst[k]) merge(dst[k], src[k]);
    }
    return dst;
  }

  S.load = function () {
    var def = DG.D.defaultSave();
    var got = DG.P.load(KEY);
    S.d = got ? merge(got, def) : def;
    S.dailyReset();
  };

  S.save = function () { DG.P.store(KEY, S.d); };

  /* 跨天重置每日内容 */
  S.dailyReset = function () {
    var today = DG.U.todayKey();
    if (S.d.daily.key !== today) {
      if (S.d.daily.key) {
        S.d.days++;                              // 跨天：游戏天数+1
        S.d.yesterM = S.d.daily.stats.m || 0;    // 存昨日挖掘量 → 隔夜矿车
      }
      S.d.daily = DG.D.defaultDaily();
      S.d.daily.key = today;
      S.save();
    }
  };

  S.wipe = function () { S.d = DG.D.defaultSave(); S.save(); };
})();
