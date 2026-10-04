# 日向雨衣 Windows 桌宠

已确认的 Q 版雨衣角色、分层素材、Spine 动画与 Electron 桌面应用。

- `desktop-pet/`：Windows 桌宠源码、依赖配置、离线渲染素材与测试。
- `output/hinata-live2d-v2/`：已确认形象的分层 PNG、PSD 和图层数据。
- `output/hinata-spine-playful-v5/`：当前动画 JSON、图集、绘制素材、浏览器预览与修订依据。
- `output/` 的其他版本：早期素材和脚本依赖的历史基线。
- `tools/`：素材处理、动画构建、同步与验证脚本。

## 运行与测试

安装 Node.js 后，在 `desktop-pet/` 目录执行：

```powershell
npm install
npm test
npm start
npm run build:win
```

具体交互、原生应用自检与构建说明见 [desktop-pet/README.md](desktop-pet/README.md)。Windows 便携成品在本机 `desktop-pet/dist/`，不纳入 Git。

当前包含待机、蹦跳、头顶颠球、独立表情及长按抓夹提起拖拽。排球直径约为角色发型宽度的三分之二。

## 当前限制

- 尚未实现安装器、开机启动、自动更新及代码签名。
- 原生窗口在单屏、125% 缩放环境验证；真实多屏与混合 DPI 仍需实测。
- 最近调整排球后，球尺寸与裁切专项验证通过；完整原生自检在长按状态检查中出现过 `dropping` 与 `held` 不一致，需要继续复查焦点和输入时序。
- 部分早期 `tools/` 脚本引用本机的依赖或图片路径，换电脑时需调整；桌宠应用自身使用已提交的本地素材。
- 动画以 Spine JSON 与贴图保存，未提供原生 `.spine` 编辑工程。

Git 保留源码、素材、依赖配置和修订基线，忽略依赖安装目录、缓存、用户数据、构建成品、逐帧预览、导出 ZIP 与秘密配置。
