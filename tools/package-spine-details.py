from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root=Path(__file__).resolve().parent.parent/'output'/'hinata-spine-joints-v4'
model=json.loads((root/'hinata-raincoat.json').read_text(encoding='utf-8'))
ids={a['path'] for slot in model['skins'][0]['attachments'].values() for a in slot.values()}
assets=[root/'images'/f'{name}.png' for name in sorted(ids)]
names=['README.txt','hinata-raincoat.json','hinata-raincoat.atlas','hinata-atlas-1.png',
 'preview.html','preview-data.js','asset-provenance.json','rig-layers.json','source-layers.json',
 'prompt-set.json','validation.json','visual-connectivity.json','keyframes-review.png',
 'animations-preview.gif','animations-preview.webp','idle.gif','hop.gif','happy_bounce.gif',
 'hop-closeup.gif','face-closeup.gif','boots-closeup.gif','hem-closeup.gif',
 'face-closeup.webp','boots-closeup.webp','hem-closeup.webp',
 'coat-occlusion-generated.png','reference-approved.png']
files=[root/n for n in names]+assets
for folder in ['runtime','original-layers','art']:
 files.extend(p for p in (root/folder).rglob('*') if p.is_file())
files.extend(root/'inspection'/n for n in ['face-smile.png','face-joy.png','hem-grip.png','boot-joint.png','boot-lining-0.82.png'])
with ZipFile(root.with_suffix('.zip'),'w',ZIP_DEFLATED,compresslevel=6) as z:
 for p in files: z.write(p,root.name+'/'+p.relative_to(root).as_posix())
with ZipFile(root.with_suffix('.zip')) as z:
 assert z.testzip() is None
 for p in files: assert z.read(root.name+'/'+p.relative_to(root).as_posix())==p.read_bytes()
print(f'Packaged and checked {len(files)} files; {root.with_suffix(".zip").stat().st_size} bytes.')
