日向翔阳雨衣桌宠 · Spine 动画 V2：手肘和膝盖弯曲

双击 preview.html，用 Chrome / Edge 打开；无需联网。
“查看”可切换三个动作或放大其中一个。可暂停、慢放、拖动时间轴和显示骨骼。
hop-closeup.gif 是蹦跳的放大动图；animations-preview.gif 是三个动作的合并动图。

idle：3.2 秒循环，待机呼吸、微屈肘、手腕和发梢动作。
hop：2.4 秒循环，屈膝蓄力、伸腿摆臂起跳、空中收腿、屈膝落地缓冲。
happy_bounce：2.4 秒循环，连续跳跃，双肘举起弯曲、双膝收拢、雨靴与脚踝动作。
落地事件：hop 1.16 秒；happy_bounce 0.97 和 1.96 秒。

改动
22 根骨骼，左右独立的上臂—前臂—手、大腿—小腿—脚关节链。
脚部通过双关节 IK 求解姿势后烘焙成可编辑的 FK 关键帧。
下蹲及落地期间固定踝关节位置，脚部反向旋转保持鞋底方向；不是整个人压扁缩放。
肘与膝额外使用辅助骨，弯曲时维持体积。
动画按 60 fps 记录，身体轨迹用平滑曲线连接蓄力、腾空和缓冲阶段。

形象与补绘
original-layers/ 内保留未经修改的原始 47 张拆层。
原来的脸、头发、雨衣可见细节和雨靴继续使用原图像素。
把原拆层中误留在身体上的少量关节轮廓像素重新归到相应的四肢，原像素颜色及坐标没有重画。
用内置 imagegen 局部补绘手臂后方的雨衣和短裤下面的隐藏腿根，使用范围限定在被原图衣服或四肢遮住的区域。
精确提示词与原始结果记录在 prompt-set.json。
coat-occlusion-generated.png 和 leg-caps-generated.png 是补绘的原始结果，仅提取指定隐藏区域参与动画。
images/ 为动画使用的纹理，有 49 个有效网格部件。
内部采样切边仅向同一肢体的相邻原图像素延展 4px，避免身体残留旧手臂/腿部边缘。
原拆层中孤立的低透明度边缘微粒保留在 original-layers/，不参加新版动画。

Spine 文件
hinata-raincoat.json：Spine 4.2 骨架及三个动画。
hinata-raincoat.atlas、hinata-atlas-1.png：一个透明纹理图集。
在 Spine 4.2 中“导入数据 / Import Data”，选择 JSON；图像目录为 images/。
本包含加权网格。未在 Spine 桌面编辑器中验证导入，未生成原生 .spine 工程。
预览与动图使用 Esoteric Software 官方 Spine 4.2 WebGL 运行时；runtime/LICENSE.txt 保留版权和使用条款。

验证
validation.json：坐标还原、循环衔接、肘膝角度变化、接地时踝位置与脚部角度、画面边界、播放控件检查。
asset-provenance.json：原图/原始拆层哈希、骨骼与补绘范围。
动图从上述运行时的实际动画帧导出，15 fps，GIF 与 WebP 是查看用预览。
