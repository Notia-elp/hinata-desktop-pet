"""Encode actual Spine runtime captures; no painting or rig changes."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parent.parent/'output/hinata-spine-playful-v5'
durations={'head_juggle':3.6,'sway':3.2,'proud_hops':2.4,'stunned':2.8,'shocked':2.8,'grin':3.2,'determined':3.2,'idle':3.2,'hop':2.4,'happy_bounce':2.4,'head-hop':2.4,'hem-hop':2.4}
report=[]
for name,seconds in durations.items():
 files=sorted((root/'frames').glob(name+'-*.png'))
 assert len(files)==round(seconds*15),(name,len(files))
 frames=[Image.open(p).convert('RGB') for p in files]
 palette=frames[len(frames)//4].quantize(colors=256,method=Image.Quantize.MEDIANCUT)
 coded=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
 ms=([70,60,70]*(len(frames)//3))
 coded[0].save(root/(name+'.gif'),save_all=True,append_images=coded[1:],duration=ms,loop=0,optimize=True,disposal=1)
 frames[0].save(root/(name+'.webp'),save_all=True,append_images=frames[1:],duration=ms,loop=0,quality=92,method=4)
 with Image.open(root/(name+'.gif')) as gif:
  total=0
  for i in range(gif.n_frames):gif.seek(i);total+=gif.info.get('duration',0)
  assert total==round(seconds*1000),(name,total)
  assert gif.info.get('loop')==0
 report.append({'id':name,'sourceFrames':len(files),'durationMs':total,'gif':name+'.gif','webp':name+'.webp'})
print(json.dumps(report))
(root/'encoded-previews.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
