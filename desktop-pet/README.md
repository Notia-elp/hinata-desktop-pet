# 日向雨衣 Windows 桌宠

本目录是 Windows x64 桌宠应用，使用已确认的黄色雨衣形象、Spine 动画、表情与可爱抓娃娃机抓夹。原动画工程保留在 `../output/hinata-spine-playful-v5/`，没有改动角色贴图或已有动画关键帧。

## 使用

双击 `dist/HinataPet-Windows-x64-0.1.0/HinataPet.exe`。运行时不需要 Node、Python、Spine 编辑器或预览服务器。搬移程序时保留整个程序文件夹。

- 单击角色播放蹦跳，双击播放头顶颠球。
- 长按 300 毫秒，抓夹合拢并提起角色；拖动鼠标移动，松手后张爪放下，落到所在屏幕的工作区底部。
- 右键角色或托盘图标选择动作、表情、大小、自动活动、置顶、隐藏和退出。
- 托盘的“回到屏幕右下角”将角色找回主屏幕。
- 透明区域允许鼠标点击穿过；切换窗口或按 Escape 可结束提起。

设置和日志写入程序旁的 `data/`。退出后保留 `data/settings.json` 可保留偏好；无需保存 Chromium 缓存。开机启动、安装器、自动更新和代码签名尚未添加。

## 文件结构

| 文件 | 内容 |
| --- | --- |
| `main.cjs` | 原生透明窗口、托盘、跨屏坐标、长按拖动与落地 |
| `renderer.js` | 本地 Spine WebGL 播放、表情、抓夹释放与鼠标惯性 |
| `preload.cjs` | 限定通道的隔离进程桥接 |
| `window-physics.cjs` | 尺寸、工作区落地及设置校验 |
| `assets/` | 已确认的 JSON、图集、离线运行时、图标及许可证 |
| `assets/asset-manifest.json` | 动画来源与每份原始资源的 SHA-256 |
| `build-windows.ps1` | 固定版本的 Windows x64 便携构建 |
| `self-test.cjs`、`tests/` | 原生应用交互自检与落地计算测试 |
| `test-output/` | 本机验证报告及透明画面截图，可重新生成 |

## 开发与构建

已有素材可直接开发。安装 Node.js 后，在本目录执行：

```powershell
npm install
npm start
npm test
npm run build:win
```

Electron 固定为 44.5.1，sharp 固定为 0.35.4。便携构建脚本不依赖 npm 安装结果，会下载官方 Electron Windows x64 运行时并缓存到 `.cache/`。`electron-release.json` 保存下载地址和长度，成品的 `build-info.json` 保存运行时版本和压缩包 SHA-256。首次构建需要网络，已有运行时缓存后可离线构建。脚本只给生成的运行时文件夹添加 AppContainer 读取和执行权限，以支持 Electron 子进程。

需要同步新动画时，从项目根目录执行 `node tools/sync-desktop-assets.cjs`，然后重新构建。本机脚本可使用预装的 sharp；其他机器先安装本目录依赖。不要将 `.cache/`、`node_modules/` 或用户 `data/` 当作源代码提交。

原生应用自检（从本目录执行）：

```powershell
$petExe = Join-Path $PWD 'dist/HinataPet-Windows-x64-0.1.0/HinataPet.exe'
$petReport = Join-Path $PWD 'test-output'
$petTest = Start-Process -FilePath $petExe -ArgumentList @('--self-test', ('--test-output="' + $petReport + '"')) -WindowStyle Hidden -PassThru
$petTest.WaitForExit()
$petTest.ExitCode
Get-Content (Join-Path $petReport 'desktop-validation.json')
```

自检使用真实 Electron 窗口、托盘和渲染器；鼠标事件由 WebContents 注入，拖动坐标由测试指针提供。它会临时显示另一个原生窗口，检查失去焦点后安全落地，完成后退出，不改变日常设置。报告 `passed: true`、退出码 0 表示通过。不能用浏览器预览替代这项原生检查。

## 验证范围

本机 Windows 自检检查透明像素与点击穿透、原生置顶、十项动作菜单、独立表情、短按、长按提起、真实窗口横向和纵向移动、抓夹附件显示、惯性摆动、松手落地、切换窗口释放、大小切换与托盘隐藏/显示。移动时显式提交固定窗口尺寸，避免 Windows DPI/边框取整导致尺寸逐帧累积；允许正常的一像素取整。落地坐标同步实际画布尺寸。四项计算测试覆盖负坐标显示器、工作区、重力曲线和无效设置。

本机实测为单显示器 125% 缩放。跨屏工作区和负坐标由计算测试覆盖，尚未在真实多显示器或混合 DPI 环境实测。图形依赖 WebGL；没有可用图形上下文时会显示启动错误。运行时并非原生 `.spine` 编辑工程，原素材目录仍提供 JSON 导入及纹理。

透明窗口、置顶层级与穿透使用 [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) / [BaseWindow](https://www.electronjs.org/docs/latest/api/base-window)；工作区坐标来自 [screen](https://www.electronjs.org/docs/latest/api/screen)。渲染器禁止 Node 集成，启用进程沙箱与上下文隔离，只加载本地脚本和素材；参考 [Electron 安全指南](https://www.electronjs.org/docs/latest/tutorial/security)。

排球直径现为头部发型宽度的三分之二（约 513.33 个源像素），对应初始小球的约 2.9845 倍；球的接触轨迹已同步调整。桌面画布上方增加透明空间，角色仍按原大小显示，球在颠球峰值时可以完整显示。原生自检另检查 32 个颠球时刻的球尺寸及画布裁切，画面保存在 `test-output/desktop-juggle.png`。

Spine、Electron、Chromium 许可证随素材和便携程序保留。
