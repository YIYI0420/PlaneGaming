# ORBIT 游戏合集

## 新游戏：断电之后

手机优先的单人 3D 僵尸 FPS。一张公交总站、三波进攻、电网/炮台二选一、三种强化，以及开闸撤离流程。支持 M4A1、AK-47、AWM，红点、四倍与八倍镜，另带备用手枪。

入口：https://yiyi0420.github.io/PlaneGaming/blackout/

需要通过 HTTP 服务运行，不能双击 HTML。玩法、操作与本地启动见 [blackout/README.md](blackout/README.md)，完整规则见 [blackout/SPEC.md](blackout/SPEC.md)。

## 极速边界

原创伪 3D 街机赛车，包含 4 辆车、4 张地图、可自选的涂装与调校、漂移氮气、AI 竞速和计时赛。

入口：https://yiyi0420.github.io/PlaneGaming/racing/

本地打开 `racing/index.html` 即可，详细说明见 `racing/README.md`。

## 飞机大战

直接用浏览器打开 `index.html` 即可游玩，无需安装、构建或联网。

GitHub Pages 游玩链接：https://yiyi0420.github.io/PlaneGaming/

GitHub 源码仓库：https://github.com/YIYI0420/PlaneGaming

GitHub Pages 从 `main` 分支根目录发布。首次发布工作流已成功完成；不同地区的网络可达性仍需实际验证。

## 操作

- **WASD / 方向键**：移动；也可以使用鼠标跟随或手机手指拖动。
- **自动射击**：开局后持续开火。
- **X / 右下角脉冲按钮**：清除敌机与敌方子弹，对 Boss 造成伤害。初始 3 次。
- **P / Esc / 右上角暂停按钮**：暂停与继续。切换窗口时自动暂停。
- **Enter**：开始、继续或重新挑战。
- **音符按钮**：开启或关闭合成音效，默认关闭。

每 20 秒升级一波敌机，每第 4 波出现 Boss。击败 Boss 恢复 1 格生命并补充 1 次脉冲。拾取补给可升级武器（最高 3 级）、获得 8 秒护盾或恢复生命。最高分保存在当前浏览器本地；浏览器禁止本地存储时仍可游玩。

## 文件

- `index.html`：中文界面。
- `style.css`：桌面与手机布局。
- `game.js`：原生 Canvas 游戏、碰撞检测、粒子特效与 Web Audio 音效。

飞机大战与赛车图形由代码绘制，无外部依赖；僵尸 FPS 使用仓库随附的 Three.js（MIT 许可），无需运行时 CDN。
