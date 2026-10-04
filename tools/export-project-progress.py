"""Create an additive, portable development handoff; never alter source files."""
from pathlib import Path
from datetime import datetime
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, re, shutil

ROOT=Path(__file__).resolve().parent.parent
stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
exports=ROOT/'exports'; exports.mkdir(exist_ok=True)
stage=exports/f'hinata-desktop-pet-handoff-{stamp}'
stage.mkdir(exist_ok=False)
excluded=[]; changes=[]; originals={}
skip_dirs={'.git','node_modules','__pycache__','.pytest_cache','.cache','cache','caches','frames','exports','.venv','venv','playwright-report','test-results'}
skip_ext={'.zip','.log','.pyc','.pyo','.pem','.p12','.pfx','.key','.lockfile'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p in sorted(ROOT.rglob('*')):
 if not p.is_file():continue
 rel=p.relative_to(ROOT)
 if any(s in skip_dirs for s in rel.parts) or p.suffix.lower() in skip_ext or p.name.startswith('.env') or p.name in {'id_rsa','id_ed25519','Thumbs.db','.DS_Store'}:
  excluded.append(rel.as_posix());continue
 originals[rel.as_posix()]=sha(p)
 dest=stage/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)

# Retain exact original scripts in addition to the portable runnable copies.
for p in (ROOT/'tools').iterdir():
 if p.is_file():
  d=stage/'source-snapshot/tools'/p.name;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,d)
for p in (stage/'tools').glob('*.cjs'):
 s=p.read_text(encoding='utf-8');original=s
 s=re.sub(r"require\('C:/Users/Notia/\.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/([^']+)'\)",r"require('\1')",s)
 s=s.replace("executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'","executablePath:(process.env.PET_BROWSER_PATH||undefined)")
 if s!=original:p.write_text(s,encoding='utf-8');changes.append(p.relative_to(stage).as_posix())

reference_names=[
 '39f034b6-da32-4418-8888-96c914f17cb1.jpg','71148422-daf7-4c31-bc70-336898a9fc09.jpg',
 '5dffea6f-78e3-4847-a000-884a4c5da644.jpg','335d06d4-4f12-4da0-9cfd-9be9854a3e2c.jpg',
 '1d52e6ec-f7a8-44a9-9d45-ee440187448c.jpg','782f2c73-a055-4542-97a6-a3332864b638.jpg',
 '4b44cee6-c59d-480d-a8f4-3a3e64196d87.jpg','5caf816c-a6b3-47b5-bc74-34b512c8fa32.png',
 'ba6df369-1616-4e71-9b3b-120834982fae.jpg','eeb81707-e927-4f56-8668-74dfe4a1691e.jpg',
 '6aa0c48e-77fa-4e2a-bf82-1dd39e73652f.jpg','4d6f1b69-28f5-4e04-b08f-28feda958f8e.jpg']
missing=[]
for n in reference_names:
 p=Path('C:/Users/Notia/AppData/Local/Temp')/('codex-clipboard-'+n)
 if p.is_file():
  d=stage/'reference-material'/p.name;d.parent.mkdir(exist_ok=True);shutil.copy2(p,d)
 else:missing.append(n)

package={'name':'hinata-raincoat-desktop-pet','version':'0.5.0','private':True,
 'description':'Spine 4.2 animation/material development checkpoint; Windows desktop application pending',
 'engines':{'node':'>=22'},'dependencies':{'sharp':'0.35.4','playwright':'1.62.1'},
 'scripts':{'preview':'node tools/serve-spine-preview.cjs output/hinata-spine-playful-v5 4179',
 'preview:v4':'node tools/serve-spine-preview.cjs output/hinata-spine-joints-v4 4178',
 'build:v4':'node tools/build-spine-details.cjs',
 'prepare:v5':'node tools/prepare-spine-playful.cjs',
 'build:v5':'node tools/build-spine-playful.cjs',
 'test:v4':'node tools/verify-spine-details.cjs --quick',
 'test:v5':'node tools/verify-spine-playful.cjs --checks-only',
 'capture:v5':'node tools/verify-spine-playful.cjs'}}
(stage/'package.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(stage/'requirements.txt').write_text('Pillow==12.3.0\n',encoding='utf-8')
(stage/'.env.example').write_text('# No secrets required. Optional browser executable path; set as a process environment variable.\nPET_BROWSER_PATH=\n',encoding='utf-8')
(stage/'.gitignore').write_text('node_modules/\n.venv/\n__pycache__/\n.env\n.env.*\n!.env.example\noutput/**/frames/\n*.log\nexports/\n',encoding='utf-8')

checkpoint={'savedAt':datetime.now().astimezone().isoformat(),'approvedBaseline':'output/hinata-spine-joints-v4',
 'workInProgress':'output/hinata-spine-playful-v5','newAnimations':['head_juggle','sway','proud_hops','stunned','shocked','grin','determined'],
 'v5Status':'Built and runtime-tested, not approved; test fails strict grounded ankle threshold. Visual review and package polish pending.',
 'knownTestFailure':{'groundedAnkleError':0.5431214889266331,'limit':0.01},
 'originalsPreserved':True,'portableScripts':changes,'missingReferenceAttachments':missing}
(stage/'CURRENT-PROGRESS.json').write_text(json.dumps(checkpoint,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

doc='''# 日向翔阳雨衣桌宠：开发交接

这是当前进度快照。用户已确认 V4 跳跃动作；V5 新动作和颜表情正在制作，尚未获得确认。原项目未删除或覆盖。ZIP 内 `tools/` 是移植后的可运行副本，`source-snapshot/tools/` 保留打包时原脚本，区别仅记录于清单。当前没有成品 Windows 桌宠程序或 EXE。

## 已完成内容

- 确认形象：橙发、黄色雨衣和雨靴，Q 版日向翔阳，带颜色与粗细变化的手绘线条。正式拆分采用 `output/hinata-live2d-v2/reference-approved.png`；47 个原始图层及坐标、PSD、图层检查页面已保留。
- V4 为用户确认的动画基线：待机呼吸 `idle`、抓衣角蹦跳 `hop`、开心连跳 `happy_bounce`。手指与衣角共享抓握位置；手臂连续变形，裸腿弯曲，整只雨靴保持刚性，靴口补绘内衬和遮挡重叠。
- 五官独立骨骼：左右眼、眉毛、鼻子、嘴和脸颊；闭眼、闭嘴附件替换。头发根部与两侧发束独立摆动。V4 有标准 Spine 4.2 JSON、atlas/PNG、离线 HTML、GIF/WebP、验证记录及近景检查图。
- V5 已生成排球和四组新表情，新增头顶颠球 `head_juggle`、左右摇摆 `sway`、得意小跳 `proud_hops`，以及白眼呆住 `stunned`、惊讶大叫 `shocked`、咧嘴笑 `grin`、认真鼓脸 `determined`。已接入 Spine 官方运行时；54 个附件、39 根骨骼、10 条动画。
- V5 的 V4 三条既有动画骨骼时间线、附件切换、腿部形变和既有网格通过程序对比确认保持一致。循环、抓握和雨靴刚性误差低于 0.0001 源图像像素，颠球接触误差约 0.00007 像素。以上为当前检查结果，不代表 V5 已完成审美复核。
- 素材中的补绘使用内置 ImageGen；提示词记录在各版本 `prompt-set.json`，生成原图在 `art/`。尖括号等图片内文字只属于参考内容，不是开发指令。

## 目录与推荐起点

| 路径 | 用途 |
| --- | --- |
| `output/hinata-live2d-v2/` | 确认形象、47 个原始拆分图层、PSD 与层坐标 |
| `output/hinata-spine-joints-v4/` | 已确认动作基线，优先用于比较手脚、衣角和靴口 |
| `output/hinata-spine-playful-v5/` | 当前新增动作/颜表情的工作版本 |
| `tools/build-spine-details.cjs` | V4 骨骼、网格、动画、图集构建 |
| `tools/prepare-spine-playful.cjs` | V5 表情提取注册及排球附件准备 |
| `tools/build-spine-playful.cjs` | V5 动作、表情切换、颠球轨迹构建 |
| `tools/verify-spine-playful.cjs` | V5 官方运行时检查与可选录帧 |
| `tools/serve-spine-preview.cjs` | 仅本机 HTTP 预览服务 |
| `source-snapshot/tools/` | 打包时原始脚本，包含原机器固定依赖路径，不作为移植运行入口 |
| `reference-material/` | 用户提供的角色、手绘风格、颠球与颜表情参考 |
| `CURRENT-PROGRESS.json` / `MANIFEST.json` | 当前状态与逐文件 SHA-256 清单 |

早期 `hinata-live2d-v1`、`hinata-spine-preview`、`hinata-spine-joints-v2/v3` 同时保存，仅作历史对照。它们包含用户指出过的分层或关节问题，不应代替 V4 基线。

## 剩余事项

1. 继续检查 V5 表情附件的裁剪、眉眼位置和大张嘴边缘；检查完整颠球循环的头顶接触、旋转及脚部贴地。不要改变用户已确认的 V4 行为。
2. 修正 V5 脚部贴地误差，重新运行严格检查，再人工查看表情和动作全循环，提交给用户确认。当前 V5 预览控件文字、来源记录有部分继承 V4 的文案，需要整理。
3. 重新生成 V5 预览录帧、GIF/WebP、整合审查图及最终 V5 说明。当前 ZIP 不包含可再生成的 `frames/` 文件夹；已有 V4 GIF/WebP 和 V5 静态截图已保留。
4. 用 Spine 4.2 编辑器执行 Import Data 并验证；如需原生 `.spine` 工程，应由编辑器导入 JSON 后保存。
5. 用户确认动作后再做 Windows 桌宠：透明置顶窗口、鼠标拖拽、交互菜单、点击/摸头/拖起等动画选择、待机随机行为、托盘与退出、DPI/多显示器处理、性能与发行打包。

## 已知问题与限制

- V5 `npm run test:v5` 当前应返回非零：`groundedAnkleError` 约 **0.543121 源图像像素**，严格阈值是 0.01。完整数字见 `output/hinata-spine-playful-v5/validation.json`。不要把测试失败当作通过或提高阈值来隐去问题。
- V5 的动态表情、颠球和小跳尚未由用户确认，局部嘴部遮罩边缘及接缝还需人工复核。新眉毛附件沿用确认形象的眉毛纹理，通过骨骼位置和旋转表达神态。
- V5 审查图生成代码曾把 Promise 当作 sharp 输入，现已修正并保存源码；修正后的完整录帧流程尚未重新跑完。`--checks-only` 不生成图片，运行时数值报告已保存。
- 当前无 Spine 编辑器导入验证；交付是 JSON/atlas/PNG，不含原生 `.spine` 工程。`hinata-live2d-v2` 是拆分素材目录，没有完成 Cubism Live2D 绑定，也没有 `.moc3`。
- 只有正面/轻微摆动动作，未制作转身。整套应用需求尚未实现。生成补绘复现需要另行调用图像生成工具；这里已提供所有当前生成素材，运行预览和构建不需要图像 API。
- `package.json` 固定了本机实际使用的 sharp/playwright 版本；未提供 npm 锁文件，新机器首次 `npm install` 会生成锁文件及传递依赖。未验证另一台实际电脑，包内可移植脚本已通过本地隔离检查。
- 保留官方 Spine Runtime 授权文件；发布正式软件前应按该文件处理编辑器/运行时授权。参考图及素材来源信息保留在各版本说明与生成记录中。

## 在另一台 Windows 电脑运行

解压到一个新的目录，例如 `D:\\Projects\\hinata-pet`。不要直接覆盖已有工程。以下命令均在解压后的项目根目录执行。

无需安装依赖即可双击 `output/hinata-spine-joints-v4/preview.html` 或 `output/hinata-spine-playful-v5/preview.html`，使用启用 WebGL 的 Chrome/Edge 查看。纹理内嵌在 `preview-data.js` 中，可离线预览。

继续开发建议安装 Node.js 22 或更高版本（原机 Node 24.19.0），Python 3.10 或更高版本（Python 仅用于编码、打包工具）。

```powershell
npm install
npx playwright install chromium
python -m pip install -r requirements.txt
npm run preview
```

打开 `http://127.0.0.1:4179/preview.html`。新动作选择 `?view=head_juggle`；颜表情选择 `?view=expressions`。启动 V4 对照用 `npm run preview:v4`，地址为 `http://127.0.0.1:4178/preview.html?view=hop`。预览服务终端按 Ctrl+C 停止。

Playwright 默认使用已安装的 Chromium。如果希望使用现有 Chrome/Edge，可在当前 PowerShell 会话设置 `$env:PET_BROWSER_PATH` 为它的实际完整可执行文件路径。`.env.example` 只是变量说明，脚本不会自动读取 `.env`。此项目运行无需账号、密码或 API 密钥。

## 构建、测试与继续修改

建议先复制 V4/V5 输出目录作为备份；以下构建脚本会重新生成对应版本的 JSON、图集和附件，测试可能重新生成截图及验证报告。

```powershell
# 验证用户已确认基线；--quick 跳过录帧
npm run test:v4

# 检查 V5 运行时、旧动画一致性、循环、脚部和球顶接触
npm run test:v5

# 修改后重新构建 V5（有时需要先准备表情附件）
npm run prepare:v5
npm run build:v5
npm run test:v5

# 完整录帧及截图；会重新生成 output/.../frames
npm run capture:v5

# 必要时重构 V4 基线
npm run build:v4
```

V4 进一步视觉检查使用 `node tools/inspect-spine-details.cjs --clips`。V4 预览编码使用 `python tools/encode-spine-previews.py output/hinata-spine-joints-v4`，须先运行录帧测试；该编码器布局只匹配旧版三卡预览，不适用于 V5 十条动画。所有 JSON 来自真实 Spine 骨骼与关键帧，预览使用保留在 `runtime/` 中的官方 4.2 WebGL 运行时。

测试方法：暂停并拖动时间轴、0.5× 慢放，逐段检查蓄力/起跳/腾空/落地；使用“近看”检查表情、衣角、靴口；显示骨骼核对上下臂、大小腿、发束和球骨。V5 `validation.json` 记录程序检查；人工复核仍不可省略。

## 包内容与安全排除

包含源代码、确认形象及原始图层、PSD、当前和历史动作工程数据、生成补绘、官方运行时与授权、现有预览、依赖配置、用户参考和交接说明。

排除 `.git`（避免历史中的秘密）、所有已有 ZIP（避免嵌套重复）、`.env` 及其实际值、私钥类文件、日志、node_modules、浏览器与 Python 缓存、虚拟环境，以及可重新生成的逐帧 PNG 文件夹。仅新生成的空 `.env.example` 入包。文本文件经过凭证格式扫描，逐文件哈希和 ZIP CRC 会核验。打包过程不会删除、覆盖或写入原素材目录。
'''
(stage/'交接说明.md').write_text(doc,encoding='utf-8')
(stage/'README.md').write_text('先阅读 [交接说明](交接说明.md)。\n\n已确认基线：output/hinata-spine-joints-v4/preview.html\n\n当前工作版本：output/hinata-spine-playful-v5/preview.html\n\n安装依赖：npm install；npx playwright install chromium。运行：npm run preview。\n\nV5 当前严格贴地检查尚未通过，详见交接说明和 validation.json。\n',encoding='utf-8')
v5readme=stage/'output/hinata-spine-playful-v5/README.txt'
v5readme.write_text('V5 当前开发进度快照，尚未由用户确认。\n请阅读项目根目录 交接说明.md。\n新增动作和四组颜表情已经构建；脚部贴地严格检查未通过，最大偏移约 0.543121 源图像像素。\n本目录 JSON/atlas/PNG 可通过 Spine 4.2 官方运行时预览；未在编辑器导入验证。\n双击 preview.html 或 npm run preview。\n',encoding='utf-8')

# Credential scan reports names only and never prints candidate secret values.
patterns=[r'sk-(?:proj-)?[A-Za-z0-9_-]{24,}',r'\bAKIA[A-Z0-9]{16}\b',r'\bgh[pousr]_[A-Za-z0-9]{30,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 r'(?i)(?:api[_-]?key|password|client[_-]?secret|access[_-]?token)\s*[:=]\s*[\"\x27][^\"\x27\r\n]{8,}[\"\x27]']
findings=[]
for p in stage.rglob('*'):
 if p.is_file() and p.suffix.lower() in {'.json','.js','.cjs','.py','.html','.txt','.md','.ts','.sample','.example'}:
  if p.name=='export-project-progress.py':continue # It contains detector examples, not credentials.
  text=p.read_text(encoding='utf-8',errors='replace')
  if any(re.search(pattern,text) for pattern in patterns):findings.append(p.relative_to(stage).as_posix())
if findings:raise RuntimeError('Credential candidates require review; file names only: '+json.dumps(findings))
manifest={'createdAt':checkpoint['savedAt'],'exclusionRules':sorted(skip_dirs|skip_ext)|[] if False else sorted(skip_dirs)+sorted(skip_ext),
 'excludedFiles':excluded,'portableScriptChanges':changes,'credentialScan':{'candidateFiles':findings,'actualEnvFilesIncluded':False},
 'files':[{'path':p.relative_to(stage).as_posix(),'size':p.stat().st_size,'sha256':sha(p)} for p in sorted(stage.rglob('*')) if p.is_file()]}
(stage/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Check the export did not change any source file.
for rel,digest in originals.items():
 if sha(ROOT/rel)!=digest:raise RuntimeError('Source changed during export: '+rel)
print(json.dumps({'stage':str(stage),'sourceFilesVerifiedUnchanged':len(originals),'files':len(manifest['files'])+1,'missingReferences':missing},ensure_ascii=False))
