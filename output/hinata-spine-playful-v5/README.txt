日向翔阳 · 黄色雨衣桌宠动画与颜表情 V5

本次完成内容
新增动作：头顶颠球（head_juggle，3.6 秒）、左右摇摆（sway，3.2 秒）、
得意小跳（proud_hops，2.4 秒）。
新增颜表情：白眼呆住（stunned，2.8 秒）、惊讶大叫（shocked，2.8 秒）、
咧嘴笑（grin，3.2 秒）、认真脸（determined，3.2 秒）。
同时保留待机、抓衣角蹦跳和开心连跳。
新增长按拖拽三段：抓夹提起（pickup，0.36 秒，单次）、悬空晃动（drag_hold，2.4 秒，循环）、张爪放下（put_down，0.5 秒，单次）。当前共十三条角色动画，另有 claw_release 机械抓夹释放辅助动画，JSON 合计十四条。

长按拖拽交互
打开 preview.html?view=drag&revision=claw-cute-sway-v2：初始播放待机，按住角色的不透明区域 300 毫秒后出现抓娃娃机的三爪抓夹和短机械臂。
抓爪先合拢雨衣肩部两侧，提起动作在夹紧过程中后段开始；夹臂从头发后方绕下，橡胶夹头覆盖雨衣边缘，脸部保持完整可见。
拖动时抓住的局部位置跟随鼠标，身体产生小幅惯性摇晃，手臂、衣角、膝盖和靴子跟着动。
松手时抓爪立即张开、机械臂上收，角色按释放高度下落，在触地时伸腿、屈膝缓冲，再进入待机。抓夹在待机和其他动作中隐藏。
短点击、透明背景不会触发；指针捕获保证移出画布后仍能松开；失去窗口焦点、pointercancel 和 lostpointercapture 都能结束抓取。
?view=interactions 可分别看三段动作，?view=drag_hold 可看悬空循环；重播按钮恢复当前预览的初始状态。
pet-drag-controller.js 是独立的浏览器/Spine 交互模块，源代码为 tools/pet-drag-controller.js，构建脚本会复制到输出目录。
它提供 onPickup、onMove、onDrop、onLand、onIdle 回调，包括 clientX/Y、screenX/Y、rootX/Y。后续 Windows 宿主可用 screenX/Y 接窗口移动及屏幕落地逻辑。
当前已接入的是浏览器预览中的真实鼠标交互；本项目还没有 Windows 原生桌宠窗口或可执行程序。
执行顺序：advance(dt) 更新 AnimationState，applyPose() 应用动画，place(renderer.camera) 在绘制前保持抓点。回调仅提供交互状态，预览模块不调用原生窗口 API。
动画衔接使用 Spine AnimationState，pickup/put_down 不循环，drag_hold/idle 循环；拖拽惯性限幅由 6 度增加为 9 度，速度响应同步乘以 1.5。
悬空动画的身体、胸口、头部和手脚左右摇摆输入增加 50%，循环速度、提起/放下时序保持原样；头发和嘴部的独立运动保持已确认幅度。
claw_release 仅含抓夹骨骼和附件，用 track 1 在松手时立刻张爪，与 track 0 的角色下落/落地分开播放；机械装置保持释放时的高度并上收，避免与角色一起坠落。
新增八个机械附件、六根机械骨骼；原有四十一根角色骨骼的索引与角色网格保持不变，总计四十七根骨骼。
新增动画、交互和说明不覆盖原始图层，也不改变原有十条动画的角色关键帧。落地的角色关键帧保留；悬空动作按用户要求增加左右摇摆幅度；提起动作仍先合爪再提起。

抓夹素材与检查
使用内置 ImageGen 将抓夹改成奶油白外壳、圆润橙色关节、软橙色夹头和微笑机头，记录在 art/claw-parts-generated-v2.png 和 art/claw-prompt-v2.json。初版原图、提示词与 art/claw-rig-v1.json 保留。
tools/prepare-claw.cjs 将原图按两个关节定位点裁切、镜像及注册，保存八个独立附件和 art/claw-rig.json；不重绘角色。
左右两节夹臂用烘焙 IK 保持橡胶夹头贴住实际雨衣肩部，金属片仅作刚性旋转，不拉伸变形。
claw-validation.json：官方运行时 198 个采样姿势，刚性长度误差不超过 0.00015 素材像素，合爪夹点与雨衣实际网格的误差不超过 0.0046 素材像素；其他十个动作均不显示抓夹。
claw-sway-validation.json：悬空动作的躯干、头部及手臂摆幅与旧版比较均为 1.5 倍；四组相同速度的鼠标拖动响应也为 1.5 倍，限幅为 ±9 度。头发和嘴部关键帧逐项保持不变。
drag-interaction-validation.json：真实鼠标长按、拖动、立即张爪、放下、画布外释放和失焦检查通过，抓点滑动误差为 0。
drag-visual-validation.json：三段角色动作共 147 帧未发现达到检测门槛的透明空洞或离散碎片。机械抓夹围成的留空属于道具结构，身体连续性检查排除机械附件；抓夹另做刚性、夹点、显示与释放检查。
claw-drag-demo-v2.gif / claw-drag-demo-v2.webp：本次可爱抓夹与加大摇摆后的实际鼠标演示；claw-drag-demo-v1.gif 保留此前版本。
claw-keyframes-review-v2.png / claw-held-preview-v2.png：合爪、悬空和张爪放下的实际运行时画面。

遮挡与接缝修正
头部底图重新补绘并按两耳位置注册，脸、耳朵和下颌使用同一张连续底图，去掉旧发际线碎边和重复耳朵轮廓。
后发重新联想补画为独立的完整发型体积，包括分层发束、后脑阴影和两侧耳后的自然尖形发尾。
后发使用与前发相同的网格拓扑和基础权重，位于脸、脖颈和兜帽之后；前发刘海另有局部支点，三块旧橙色补片已退出运行时。
前发去掉散落的旧分割碎线和后发片段，兜帽去掉孤立的旧头发残留；保留原画主体的 RGB 和抗锯齿轮廓。
右腋下增加衣料重叠，左手抓衣角处补全后方雨衣，修复跳跃中短暂露出的细缝。
保留隐藏脖颈、连续衣袖和手、衣摆遮挡、短裤补全、小腿重叠、雨靴内衬。
整只雨靴保持刚性；手指与衣角共享抓握顶点。
贴地腿在循环过渡之后重新计算 IK，新增动作按 120 Hz 烘焙关键帧。
排球连续旋转、按抛物线弹起，并在头顶接触时短暂压缩。
接触点对应实际绘制的发顶；旋转后的压缩球体高度参与接触计算。
跳跃嘴部修正：抓衣角蹦跳、开心连跳、得意小跳都保持原始笑嘴比例，不再随独立情绪曲线压扁、放大。
嘴巴跟随头部运动，局部偏移只随实际腾空高度轻微变化（最多 0.65 个素材像素）。
左侧发束修正：新增 hair_outer_L 支点控制最外侧发束，以单一支点保持发束形状。
头发运动收敛：跳跃发顶额外旋转由约 ±14 度减至最多 2.1 度，局部上下偏移由 6 像素减至最多 0.8 像素。
起跳时轻微滞后，落地后一次小回弹；两侧发束同向跟随，最多 1.155 度，最外侧支点最多 0.5 度，去掉反复大幅反向甩动。
待机、摇摆、颠球与颜表情动作同步减小头发摆动。除颠球接触轨迹随发顶重新计算外，身体、手脚、衣摆、头部与表情关键帧保持不变。
最外侧保持 92% 的头发骨骼权重，额外支撑在素材 x=335..410、y=430..530 之间平滑过渡，避免反向混合而压扁发束。
前后发的外侧发束使用相同基础权重；前发主体 RGB、网格拓扑和 UV 保留，没有添加新补片。角色骨骼共 41 根，加机械抓夹 6 根，当前合计 47 根。
刘海单独加大摆幅：新增 hair_fringe，支点位于素材 (490,250)，作为发顶骨骼的子骨骼，额前发梢最多增加 2.1 度局部摆动。
发根逐渐过渡到原有发顶权重；仅前发的额前区域改变权重，后发、侧发、发顶和所有现有动作关键帧保持收小后的版本。
左耳后发尾重绘：使用内置 ImageGen 将后发外侧重复的细长尖角改为少量宽发束；只合入左下方重绘区域，保留发顶、右侧与内侧遮挡发量。
art/rear-hair-left-nape-generated.png 为重绘原图，art/rear-hair-left-nape-registered.png 为区域注册后的完整后发，提示词记录在 art/left-nape-redraw-prompt.json。
左耳上方多余尖角修正：后发在素材 y=500 处原本停止使用前发/头部遮挡轮廓，额外露出一个重复的后发尖角。
仅修正素材 x=201..222、y=500..540 的重复后发尖角及其抗锯齿边缘，遮挡过渡止于 x=240、y=560；耳后下方发束保留原有遮挡填充，补绘 RGB、骨骼和动作保持不变。
art/rear-hair-before-extra-tip-fix.png 保留修正前的运行时后发；custom/hair_rear_complete.png 为当前使用的遮挡修正图层。
衣摆与领口清理：补绘后衣摆为连续黄色布料，去掉旧短裤切口和重复的前衣摆内侧描边；移除旧补绘向外部透明区域扩出的不透明像素。
前衣片两侧保留原有外轮廓，将旧短裤切口的残留描边替换为同坐标的补绘布料；短裤仍由独立的完整附件绘制。
领口使用现有完整雨衣补绘的原像素接回弧形描边，去掉旧分割留下的白洞、橙色碎边和领口上方的圆形外凸。
本次没有更改手脚、衣摆或表情的骨骼与动作关键帧。

查看预览
双击 preview.html 可离线打开，不需要安装 Node 或 Python。
本机在线预览：http://127.0.0.1:4179/preview.html
?view=drag&revision=claw-cute-sway-v2：可爱抓夹、左右摇摆加大 50% 后的互动预览。
?view=all：三个新动作；?view=expressions：四组颜表情；
?view=hop&focus=face：跳跃时头发和脸的近景。
?view=hop&focus=hem&revision=hem-edge-cleanup：本次衣摆、短裤和领口清理后的近景。
“颜表情”菜单可以在同一个动作中切换表情；“跟随动作”恢复默认组合。
支持 0.5× 慢放、暂停、时间轴、原始姿势和显示骨骼。

文件
hinata-raincoat.json：标准 Spine 4.2 骨骼、权重、网格形变、附件切换和关键帧。
hinata-raincoat.atlas / hinata-atlas-1.png / hinata-atlas-2.png：运行时图集。
images/：全部 64 个运行时附件，包括八个机械抓夹附件；custom/：注册后的补绘和表情素材（旧补片文件保留，但不再被运行时引用）。
original-layers/：47 个原始拆分图层，源文件保留不变。
art/ / prompt-set.json：内置 ImageGen 生成素材与提示词记录。
art/head-contour-prompts.json：本次头部与完整后发补绘的全部提示词，使用内置 ImageGen。
art/coat-rear-continuous-generated-v2.png：使用内置 ImageGen 补绘的连续后衣摆原图；提示词与两次生成记录在 art/garment-cleanup-prompts.json。
images/coat_rear.png：完成原位缩放、透明轮廓与采样处理后，实际使用的后衣摆附件。
custom/hair_rear_complete.png：当前完整后发图层；art/rear-hair-complete-final.png：此前完整后发补绘原图，保留不变。
head-contour-registration.json：双耳对齐参数、前发轮廓清理和旧补片停用记录。
头部注册保持双耳锚点，局部校正下颌与衣领的重叠（最大 5.5 个素材像素）；所有着色来自补绘原图。
head-contours-review.png：腾空、回弹、落地等九个头部姿势的实际运行时画面。
head-contours-review-final.png / head-hop-repainted.gif / head-hop-repainted.webp：本次完整后发重绘后的最终预览。
head-contours-left-hair-fix.png / head-hop-left-hair-fix.gif / head-hop-left-hair-fix.webp：后续左侧发束修正的预览。
head-hop-left-nape-redraw.gif / head-hop-left-nape-redraw.webp：左耳后发尾重绘、收小摆幅之前的跳跃近景，保留供对比。
head-hop-gentle-hair.gif / head-hop-gentle-hair.webp：整体头发摆幅收小、刘海单独调整之前的跳跃近景，保留供对比。
head-hop-fringe-motion.gif / head-hop-fringe-motion.webp：刘海单独加大摆动阶段的跳跃近景，保留供对比。
head-hop-extra-tip-fix.gif / head-hop-extra-tip-fix.webp：左耳上方重复尖角修正后的当前跳跃近景。
head-hop-edge-cleanup.gif / head-hop-edge-cleanup.webp：当前最终头部近景，包含重复发尾与领口清理。
hem-hop-edge-cleanup.gif / hem-hop-edge-cleanup.webp：当前最终衣摆近景，36 帧，循环 2.4 秒。
garment-edge-cleanup-final-review.png：跳跃 0、0.61、1.28、2.05 秒的衣摆关键姿势。
left-extra-tip-compare.png：用户圈出位置的实际运行时局部对比，左为旧版、右为修正后，均为跳跃 2.05 秒。
left-nape-compare-final.png：同一跳跃 1.20 秒姿势的发尾局部对比，左为旧版、右为重绘后；两侧均取自实际运行时 GIF。
head-contours-left-nape-redraw.png：左耳后发尾重绘阶段的头部关键姿势。
head-contours-gentle-hair.png：整体头发摆幅收小阶段的头部关键姿势。
head-contours-fringe-motion.png：刘海单独调整阶段的头部关键姿势。
head-contours-extra-tip-fix.png：左耳上方重复尖角修正后的当前头部关键姿势。
head-contours-edge-cleanup.png：当前最终九个头部姿势。
left-hair-validation.json：120 Hz 检查十条动作中最外侧有绘制内容的 137 个网格三角形，记录压缩、拉伸与翻面，并与原版权重和摆动对比。
全部十条动画和修复后的跳跃头部近景分别有 GIF 与 WebP，来自官方运行时真实渲染帧。
review.png / keyframes-review.png / preview-*.png：画面审查图。
validation.json：数值检查；visual-validation.json：逐帧透明轮廓与控件检查。
drag-interaction-validation.json：真实鼠标长按、拖动、松手、画布外释放与失焦的检查，原有十条动画与原有角色骨骼/网格逐项比对保持一致，机械附件另行新增。
drag-visual-validation.json：新三段动画全身 30 fps、头部 15 fps，共 147 帧，门槛以上的透明空洞和离散碎片均为 0，控件全部通过。
drag-demo.gif / drag-demo.webp：实际鼠标事件和运行时衔接的 3.6 秒演示；录制完整经过 pending、pickup、held、dropping、idle。
drag-drag_hold.gif / drag-drag_hold.webp：悬空动作的独立循环预览。
drag-pickup.gif / drag-put_down.gif：提起和落地的单次预览。
drag-keyframes-review.png：三段动作的九个实际运行时姿势。
visual-validation-mouth.json：三个跳跃动作的最近一次独立接缝复查记录；文件名沿用早期嘴部检查。

构建与检查
项目根目录 tools/prepare-spine-playful.cjs：表情附件和隐藏头皮准备。
tools/prepare-spine-head-contours.cjs：头部补绘注册、独立完整后发和透明轮廓清理。
tools/prepare-spine-left-nape.cjs：只注册左耳后发尾重绘区域，透明边缘按预乘颜色混合，保留其他后发区域。
tools/review-spine-head-contours.cjs：录制头部极端姿势，检查耳后、脸颊与发束轮廓。
tools/review-spine-left-hair.cjs：并排检查左侧轮廓与隐藏后发后的画面。
tools/review-spine-garment.cjs：录制四个实际运行时衣摆姿势，复查手指、短裤、领口和外轮廓。
tools/verify-spine-left-hair.cjs：检查最左侧发束的局部形变，避免发束再次压扁或翻面。
tools/build-spine-playful.cjs：Spine JSON、图集和预览数据构建。
tools/verify-spine-playful.cjs：运动数值检查并录制预览。
tools/inspect-spine-playful.cjs：全部十三条角色动画的透明空洞与部件分离检查；--drag-only 仅检查三段交互。
全身按 30 fps、头部按 15 fps 检查；此前十条动画总计 1314 帧，新增拖拽三段总计 147 帧，当前十三条合计 1461 帧；排球和机械抓夹是独立道具，不计入身体连续性。
全套接缝检查结果：未发现达到检测门槛的透明空洞（620 像素比较宽度，透明度 <24，至少 4 个相邻像素）。
本次后发重绘最终复查：1314 帧，记录空洞为 0；最大离散轮廓为 1 个比较像素；全部控件检查通过，没有运行时错误。
左侧发束修正后再次完整复查：十条动画共 1314 帧，记录空洞为 0，最大离散轮廓为 1 个比较像素；控件与运行时检查通过。
左耳后发尾重绘后再次检查：三个跳跃动作 324 帧与全套 1314 帧均通过，记录空洞为 0。
头发摆幅收小后完整复查：全套 1314 帧通过，记录空洞为 0，最大离散轮廓为 1 个比较像素。
刘海单独加大后完整复查：十条动画共 1314 帧通过，记录空洞为 0，最大离散轮廓为 1 个比较像素。
重复后发尖角、衣摆与领口清理后的最终完整复查：十条动画共 1314 帧，门槛以上的透明空洞为 0，离散轮廓为 0，控件检查全部通过，无运行时错误。当前 validation.json / visual-validation.json 对应此最终版本。
新增拖拽之后，validation.json 的数值检查已覆盖十三条动画；visual-validation.json 保留此前十条的轮廓结果，新增三条的结果另存为 drag-visual-validation.json。原有十条的关键帧、网格和骨骼逐项保持不变。
刘海有绘制内容的 184 个三角形按 120 Hz 检查，未发现翻面，局部面积变化保持在原形的 87.7%～115.0%；现有后发网格与全部已有骨骼运动关键帧逐项比对相同。
最外侧发束按 120 Hz 检查，未发现翻面；两个大跳动作中的局部面积保持在原形的 99.8% 以上。
运行 node tools/inspect-spine-playful.cjs --jump-only 可单独复查三个跳跃动作。
tools/locate-spine-gaps.cjs：将检查出的接缝定位到头部坐标或衣料网格 UV，保存诊断画面。
tools/encode-spine-playful.py：将官方运行时录帧编码为 GIF/WebP。
tools/verify-pet-drag.cjs：真实指针交互与原有动画、骨骼、网格保留检查。
tools/prepare-claw.cjs：生成抓夹附件注册与机械骨骼；重建时先执行此脚本，再执行 build-spine-playful.cjs。
tools/verify-claw.cjs：检查合爪夹点、金属附件刚性和其他动作中的隐藏状态。
tools/verify-claw-sway.cjs：将悬空摆幅及相同鼠标速度下的惯性响应与上一版本比较，验证增加 50%。
tools/inspect-spine-playful.cjs --drag-only：仅复查新增三段动画的透明接缝。
tools/review-pet-drag.cjs：三段动画录帧与关键姿势。
tools/capture-pet-drag-demo.cjs：真实鼠标事件触发交互并录制演示。
tools/encode-pet-drag.py：编码新增动画与真实拖拽演示，保留原有动作的预览文件。
tools/finalize-spine-edge-preview.cjs：检查最终透明审查报告后，发布版本化头部与衣摆近景，并更新左侧发尾局部对比。
源脚本目前使用本机的 sharp/playwright/Pillow 运行环境；预览页面可独立离线运行。

编辑器与范围
使用 Spine 4.2 的 Import Data 导入 JSON；图片路径为 ./images/。
已通过官方 4.2 WebGL 运行时检查；当前环境没有 Spine 编辑器，未做编辑器导入验证。
这是 JSON/atlas/PNG 动画素材工程，不包含原生 .spine 文件。
本目录保存动画与表情素材。Windows 桌宠应用已另建在 ../../desktop-pet/，便携程序位于其中的 dist/HinataPet-Windows-x64-0.1.0/HinataPet.exe；转身动作尚未实现。
Spine Runtime 的授权文本保留在 runtime/LICENSE.txt。
