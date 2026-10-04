日向翔阳雨衣形象 · Spine 动作修正版 V3

打开 preview.html 查看三个动作。也可使用 http://127.0.0.1:4177/preview.html?view=hop 。
预览支持放大、0.5 倍速、暂停、拖动时间轴和显示骨骼。

这次的修正
1. 雨靴整块绑定到单个骨骼，保持靴筒、鞋头和鞋底轮廓；膝部只影响露出的皮肤。
2. 修正粗拆层中误分到雨靴的皮肤描边，避免出现分离的腿部线条。
3. 袖子和手掌合成连续采样表面，肩部混合权重并保留雨衣底层遮挡。
4. 腿部加入体积矫正网格动画，避免短腿在下蹲时被线性权重挤出尖角。
5. 头部原画合成完整表面，消除眼、嘴和头发拆层边界的滤波裂缝。

内容
hinata-raincoat.json / hinata-raincoat.atlas / hinata-atlas-1.png：Spine 4.2 格式动画及图集。
images/：JSON 对应的运行时表面 PNG。
original-layers/：47 张原始拆层，文件内容保持不变。
rig-layers.json：原画坐标和运行时表面的组成。
runtime/：官方 Spine WebGL 4.2 运行时及许可证。
animations-preview.gif / hop-closeup.gif：由官方运行时实际渲染后编码的预览。
keyframes-review.png / inspection/：原始站姿、下蹲、腾空和落地的检查画面。
validation.json / visual-connectivity.json：运行时与逐帧画面检查。
asset-provenance.json / prompt-set.json：像素来源和之前补绘的提示词记录。

动作
idle：3.2 秒，呼吸和轻微肘腕摆动。
hop：2.4 秒，蓄力、摆臂起跳、收腿和落地缓冲。
happy_bounce：2.4 秒，连续小跳。

Spine 编辑
在 Spine 4.2 中用 Import Data 导入 JSON，图像目录使用 images/。
本包提供 JSON、atlas 和 PNG，不包含原生 .spine 工程；未在 Spine 编辑器中执行导入验证。
骨骼旋转、平移和比例采用每秒 60 帧的关键帧。腿部还包含同步烘焙的标准 deform 时间轴。
修改腿部骨骼动作时，应同步调整或重新烘焙 deform 关键帧，避免腿部轮廓与雨靴错位。
本版本没有转身、眨眼或新服装。

检查范围
Chrome 中实际加载官方 Spine 4.2 运行时并测试离线 HTML。
三个动作共 240 个时刻，以 2 倍像素密度检查轮廓连通；未发现分离的手脚。
已检查站立、下蹲、腾空和落地的放大画面。
完整雨靴的顶点间距离在所有动作中保持不变，着地时靴子位置及角度保持稳定。
关键帧和 GIF 用于继续评审动作效果。

补绘说明
复用了上一版通过内置 image_gen 生成的雨衣隐藏底层，仅使用头部以下的雨衣区域。
原来的腿根生成图不参与本版运行时；原始脸部和头发仍来自已确定的原画。
提示词见 prompt-set.json；本轮没有重新生成角色形象。
