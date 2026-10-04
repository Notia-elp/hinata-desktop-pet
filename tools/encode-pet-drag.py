"""Encode actual Spine/browser drag captures; original previews stay intact."""
from pathlib import Path
from PIL import Image
import json
import shutil
root=Path(__file__).resolve().parent.parent/'output/hinata-spine-playful-v5'
report=[]
for name,ms in [('drag-pickup',360),('drag-drag_hold',2400),('drag-put_down',500),('drag-demo',3600)]:
    files=sorted((root/'frames').glob(name+'-*.png'))
    frames=[Image.open(p).convert('RGB') for p in files]
    assert frames,name
    durations=[round((i+1)*ms/len(frames)/10)*10-round(i*ms/len(frames)/10)*10 for i in range(len(frames))]
    palette=frames[len(frames)//3].quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    coded=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
    # Entry and landing play once; the hold/demo previews loop.
    options={'loop':0} if name in ['drag-drag_hold','drag-demo'] else {}
    coded[0].save(root/(name+'.gif'),save_all=True,append_images=coded[1:],duration=durations,optimize=True,disposal=1,**options)
    frames[0].save(root/(name+'.webp'),save_all=True,append_images=frames[1:],duration=durations,loop=0 if options else 1,quality=92,method=4)
    with Image.open(root/(name+'.gif')) as result:
        total=0
        for i in range(result.n_frames):
            result.seek(i)
            total+=result.info['duration']
        assert total==ms,(name,total)
    report.append({'id':name,'frames':len(files),'durationMs':ms,'loop':bool(options)})
(root/'drag-encoded-previews.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
for source,destination in [('drag-demo','claw-drag-demo'),('drag-drag_hold','claw-hold'),('drag-demo','claw-drag-demo-v2'),('drag-drag_hold','claw-hold-v2')]:
    for extension in ['gif','webp']:
        shutil.copyfile(root/(source+'.'+extension),root/(destination+'.'+extension))
for source,destination in [('drag-keyframes-review.png','claw-keyframes-review.png'),('drag-held-preview.png','claw-held-preview.png'),('drag-keyframes-review.png','claw-keyframes-review-v2.png'),('drag-held-preview.png','claw-held-preview-v2.png')]:
    shutil.copyfile(root/source,root/destination)
print(json.dumps(report))
