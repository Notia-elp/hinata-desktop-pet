日向翔阳雨衣形象 · Spine 动画预览

查看
双击 preview.html，用 Chrome 或 Edge 打开。全部资源已包含，可离线播放。
三个动画同时展示，可暂停、调整速度、拖动时间轴、查看原始姿势与骨骼。
animations-preview.webp 和 animations-preview.gif 是三种动作的合并预览；idle.gif、hop.gif、happy_bounce.gif 是各自动图。

动画
idle：3.2 秒循环。待机呼吸、轻晃头、发梢和袖口跟随。
hop：2.4 秒循环。蓄力、小蹦跳、落地回弹。land 事件在 1.13 秒。
happy_bounce：2.4 秒循环。一轻一高连续跳、左右摇摆。land 事件在 0.97、1.99 秒。
Spine JSON 使用 60 fps 关键帧；GIF 预览为 15 fps。

Spine 数据
hinata-raincoat.json：Spine 4.2 JSON 骨架和动画数据。
hinata-raincoat.atlas：两页纹理图集索引。
hinata-atlas-1.png、hinata-atlas-2.png：透明 PNG 纹理。
images/：JSON 导入使用的纹理，均来自原图拆层。
original-layers/：未经修改的原始 47 张拆层，与上一版文件哈希一致。
rig-layers.json：动画纹理的位置；上下左右按画面坐标命名。

导入编辑
在 Spine 4.2 的菜单中选择“导入数据 / Import Data”，选择 hinata-raincoat.json。
图像目录指定本文件夹下的 images/。本骨架使用加权网格。
导入后可编辑骨骼与关键帧，再另存为原生 .spine 工程。
本包未在 Spine 桌面编辑器内验证导入，也没有生成原生 .spine 文件。
官方导入说明：https://en.esotericsoftware.com/spine-import#Data

制作方式与范围
47 个原图部件，共享连续三角网格，以 10 根骨骼驱动。
所有可见绘画像素来自已确认的雨衣原图，没有重新生成脸、服装或线条。
动画纹理在内部切边处延展 4 像素，延展内容仅复制该位置已有的原图像素，帮助线性采样避免细缝。
这个处理没有补画完整的手臂、颈部、衣服或被遮挡的区域。
因此当前动作保留原姿势做连续网格变形，没有独立转身、大幅挥手、眨眼、换口型等动作。

验证
validation.json 记录官方 Spine WebGL 运行时的离线加载、坐标对齐、有限顶点、循环衔接、画面边界与播放控件验证。
asset-provenance.json 记录原图、原始拆层和官方运行时来源与哈希。
GIF 从官方 Spine 运行时实际画面导出，主体运动来自 Spine 时间轴，不是网页 CSS 动画。

运行时
runtime/spine-webgl.js 为 Esoteric Software 官方 Spine 4.2 运行时。
版权与使用条款保留在 runtime/LICENSE.txt。
官方源码：https://github.com/EsotericSoftware/spine-runtimes/tree/4.2/spine-ts
