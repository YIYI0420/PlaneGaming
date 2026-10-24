# 断电之后：Unity + URP 迁移工程

工程路径：`unity/AfterBlackout`。目标编辑器 **Unity 6000.6.7f1（6.6）**，URP **17.6.0**。

当前是可运行的 Unity 原型工程：已用 Unity 6000.6.7f1 完成 C# 编译、三关场景生成和导航烘焙，10 项编辑器测试与 1 项跨三关运行测试通过，Windows 构建已成功。运行测试检查移动、奔跑、跳跃、开镜同时射击、准星对齐、实际命中、重击、暂停和首领阶段，并导出相机截图。已使用 Web Build Support 完成 WebAssembly 导出。网页构建包含本地压缩解码与带哈希的资源文件名，输出到仓库 unity-game/。手机实机性能仍需进一步测试；Three.js 轻量版继续提供。

## 打开与运行

1. 在 Unity Hub 安装 Unity 6000.6.7f1；添加 Web Build Support。运行 Windows 版需要对应的 Windows 构建支持。
2. 在 Hub 登录并完成编辑器许可激活。
3. 在 Hub 的 Projects → Add → Add project from disk，选择本文件所在的 `AfterBlackout` 目录。**不要另建一个空模板再复制脚本。**
4. 等待 Package Manager 恢复 URP、uGUI 和 Test Framework。首次导入会生成 URP 设置、材质、Boot 与三关场景、烘焙 NavMesh，然后打开 Boot。
5. 如果首次导入没有自动执行，在菜单选择 **After Blackout → Generate project scenes and URP settings**。首次生成只用于准备工程；该菜单再次执行会重新生成场景，已手工编辑的关卡请先另存。
6. 在 Boot 场景按 Play，选择装备和关卡。之后在 Unity 编辑器逐一检查控制台、模型、碰撞、导航与触屏布局。

## 已迁移的系统

- M4、AK、AWM、备用手枪；有限主武器弹药、无限手枪备用；装填、开镜、四倍/八倍视野、相机中心射线。
- CharacterController 移动、跳跃、Shift 奔跑、体力、触屏摇杆/转向/射击/重击/交互，暂停与失焦处理。
- 五种刀的独立轻重击轨迹、接触时刻判定、收势锁定、重击体力成本、扇形与墙体遮挡。
- 三波、设施二选一、强化三选一；三阶段首领、护甲弱点、破势、冲撞、震地、毒液、冲击波、随从和补给。
- 三关选关与连续转场、撤离倒计时、单独首领训练、关卡纪录；新旧版本使用不同存储键。
- 核心逻辑不依赖 Unity，Unity 运行层负责物理、导航、渲染、音效和输入。

## 地图与画面

Unity 关卡数据从原版数值迁出后重新编排空间，不是把三张旧矩形地图直接换颜色：

| 地图 | Unity 场地与路线 |
|---|---|
| 公交总站 | 48×56 米；停车区、东侧维修棚、北侧出口 |
| 雨夜货运码头 | 68×66 米；西侧仓库、集装箱回廊、东北登船口 |
| 熔核供电站 | 60×66 米；变压器大厅、3.2 米高控制台与楼梯、北侧决战区 |

场景由编辑器脚本生成后保存，可继续编辑；导航在编辑器烘焙，运行时使用 NavMeshAgent。PBR 地面使用附带的 ambientCG CC0 色彩、法线、AO 与粗糙度材质（粗糙度已转换为 URP 光滑度）；三档 URP、软阴影、ACES、Bloom 和反射探针已配置生成代码。

已加入首轮写实素材：Pixelhouse 贴图骨骼僵尸及行走/攻击/死亡动画；M4A1、AK、备用手枪模型；项目自制的 AWM 风格模型、五种倒角刀具、手部和袖口；沥青、砖墙、金属板、木材的独立 PBR 材质，以及枪灯、轮胎、保险杠、油桶和托盘。护甲与首领采用同一基础骨骼的独立装甲变体。

当前达到可玩的写实素材原型阶段，车辆、建筑和部分附件仍为程序化模型，尚未达到商业成品的环境精细度与动作制作水平。`ArtSet` 保留完整 prefab 槽，可继续替换。外部素材来源、授权和修改记录见 THIRD_PARTY_NOTICES.md；网页提供独立署名页。

## 检查与构建

没有 Unity 也可以运行核心检查（PowerShell 7）：

```powershell
pwsh -File ./Tools/Test-Core.ps1
```

它真正编译 Core C#，检查所有 C# 的语法，并模拟 54 种关卡/主武器/设施/强化组合、首领阶段和撤离。它**不会**验证 Unity API 引用、场景外观、导航烘焙和 WebGL 构建；这些由对应的 Unity 编辑器检查负责。`python ./Tools/Verify-Assets.py` 另行检查场景、导航文件、GUID 和中文字符覆盖（字体检查需要 fontTools）。

装好编辑器并激活许可后：

```powershell
./Tools/Build.ps1 -Target Generate -EditorPath 'E:\unityhubeditor\6000.6.7f1\Editor\Unity.exe'
./Tools/Build.ps1 -Target Test -EditorPath 'E:\unityhubeditor\6000.6.7f1\Editor\Unity.exe'
./Tools/Build.ps1 -Target PlayTest -EditorPath 'E:\unityhubeditor\6000.6.7f1\Editor\Unity.exe'
./Tools/Build.ps1 -Target Web -EditorPath 'E:\unityhubeditor\6000.6.7f1\Editor\Unity.exe'
```

也可以在编辑器里选择 **After Blackout → Build Web for GitHub Pages**。Web 输出到仓库根目录的 `unity-game/`，启用 Gzip + Decompression Fallback；构建成功才会写出 `build-info.json`。Build 命令保留已生成场景，修改场景后不会在构建时自动覆盖。

`After Blackout → Build Windows player` / `-Target Windows` 输出到 `Builds/Windows/AfterBlackout.exe`。

`./Tools/Package.ps1` 将可移植源工程与 Windows 试玩分别打包到仓库的 `output/afterblackout-unity/`；源包不包含 Library、日志、账号或许可。试玩包内需要保留 EXE、Data 文件夹和 DLL。运行时请先解压整个包。

Web 包通过 HTTP 本地试玩、浏览器验证成功后，将完整 `unity-game/` 发布到 GitHub Pages。不能把 Unity 源工程当成网页上传后直接运行。大型构建需检查 GitHub 文件/站点大小限制，必要时改为 GitHub Actions 上传 Pages artifact。构建日志在 Logs/，不要提交 Unity 账号、许可证、Library/、Temp/ 或整个编辑器。

## 素材许可

详见 THIRD_PARTY_NOTICES.md。仅包含 CC0 材质与 OFL 中文字体，不包含商业游戏提取资源、Unity Editor 二进制或许可证。



