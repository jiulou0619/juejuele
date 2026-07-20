/* 微信小游戏入口 — 按依赖顺序加载 */
require('./js/platform.js');
require('./js/util.js');
require('./js/assets.js');
require('./js/fx.js');
require('./js/uikit.js');
require('./js/data.js');
require('./js/save.js');
require('./js/grid.js');
require('./js/run.js');
require('./js/pay.js');
require('./js/main.js');
require('./js/scene_run.js');
require('./js/scene_home.js');
require('./js/scene_meta.js');

GameGlobal.DG.Main.boot();
