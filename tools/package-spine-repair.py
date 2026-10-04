from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root=Path(__file__).resolve().parent.parent/'output'/'hinata-spine-joints-v3'
model=json.loads((root/'hinata-raincoat.json').read_text(encoding='utf-8'))
assets=[root/'images'/f'{s["name"]}.png' for s in model['slots']]
names=['README.txt','hinata-raincoat.json','hinata-raincoat.atlas','hinata-atlas-1.png',
       'preview.html','preview-data.js','asset-provenance.json','rig-layers.json','source-layers.json',
       'prompt-set.json','validation.json','visual-connectivity.json','keyframes-review.png',
       'animations-preview.gif','animations-preview.webp','idle.gif','hop.gif','happy_bounce.gif',
       'hop-closeup.gif','coat-occlusion-generated.png','reference-approved.png']
files=[root/n for n in names]+assets
for folder in ['runtime','original-layers','inspection']:
    files.extend(p for p in (root/folder).rglob('*') if p.is_file())
with ZipFile(root.with_suffix('.zip'),'w',ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:
        z.write(p,root.name+'/'+p.relative_to(root).as_posix())
with ZipFile(root.with_suffix('.zip')) as z:
    assert z.testzip() is None
    for p in files:
        assert z.read(root.name+'/'+p.relative_to(root).as_posix())==p.read_bytes()
print(f'Packaged and checked {len(files)} files; {root.with_suffix(".zip").stat().st_size} bytes.')
