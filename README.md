# ORBIT ARCADE · 浏览器游戏合集

无需安装，支持电脑浏览器与手机。所有美术由原生 Canvas 和 CSS 绘制，无第三方资源依赖。

## 极速边界 · NEON APEX

游玩：https://yiyi0420.github.io/PlaneGaming/racing/

原创伪 3D 街机竞速游戏，包含 4 辆车、4 张地图、6 种配色、5 种涂装、3 种轮毂，以及引擎、涡轮、轮胎调校。

支持漂移集气、氮气加速、6 人 AI 竞速、单人计时、晴雨雪、1～3 圈比赛、3 档难度、小地图、救援和本地纪录。

WASD / 方向键驾驶，空格漂移，Shift 氮气，P / Esc 暂停，R 救援。手机使用屏幕按钮。详细说明见 [赛车文档](racing/README.md)。

## 银河防线 · 飞机大战

游玩：https://yiyi0420.github.io/PlaneGaming/

自动射击、武器升级、护盾、修复补给、Boss 战、清屏脉冲与本地最高分。

WASD / 方向键移动，X 脉冲，P / Esc 暂停，Enter 开始或重开。也支持鼠标跟随和触屏拖动。

## 本地运行与发布

直接打开根目录的 `index.html` 或 `racing/index.html` 即可。GitHub Pages 从 `main` 分支根目录自动发布。游戏均为单人玩法，不含在线联机；配置和纪录只保存在当前浏览器。

## 检查

`node tests/racing-smoke.cjs`：物理与功能检查，覆盖 16 组完整双圈比赛，以及各地图、皮肤的桌面／手机渲染坐标。
