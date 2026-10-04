"""Encode images rendered by the official Spine runtime; no artwork edits."""
from pathlib import Path
from PIL import Image
import sys
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent.parent/'output'/'hinata-spine-preview'
files=sorted((root/'frames').glob('all-*.png'))
frames=[Image.open(p).convert('RGB') for p in files]
palette=frames[10].quantize(colors=256,method=Image.Quantize.MEDIANCUT)
encoded=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
encoded[0].save(root/'animations-preview.gif',save_all=True,append_images=encoded[1:],duration=[70,60,70]*48,loop=0,optimize=True,disposal=1)
frames[0].save(root/'animations-preview.webp',save_all=True,append_images=frames[1:],duration=[67,66,67]*48,loop=0,quality=88,method=4)
# Individual clips include their own title and description in the recorded card.
# Each card is 291px wide in the 900px composite; gutters are approximately14px.
for name,left,right,count in [('idle',0,291,48),('hop',305,595,36),('happy_bounce',609,900,36)]:
    clip=[im.crop((left,0,right,im.height)) for im in frames[:count]]
    pal=clip[10].quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    coded=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in clip]
    coded[0].save(root/(name+'.gif'),save_all=True,append_images=coded[1:],duration=[70,60,70]*(count//3),loop=0,optimize=True,disposal=1)
    checked=Image.open(root/(name+'.gif'))
    duration=0
    for i in range(checked.n_frames):
        checked.seek(i)
        duration+=checked.info['duration']
    assert duration==count/15*1000, (name,duration)
print('Encoded composite and three individual GIF previews.')
zoom_files=sorted((root/'frames').glob('zoom-*.png'))
if zoom_files:
    zoom=[Image.open(p).convert('RGB') for p in zoom_files]
    palette=zoom[10].quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    clip=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in zoom]
    clip[0].save(root/'hop-closeup.gif',save_all=True,append_images=clip[1:],duration=[70,60,70]*12,loop=0,optimize=True,disposal=1)
    print('Encoded enlarged articulated hop GIF.')
for name in ['face','boots','hem']:
    files=sorted((root/'frames').glob(name+'-*.png'))
    if files:
        pictures=[Image.open(p).convert('RGB') for p in files]
        palette=pictures[len(pictures)//3].quantize(colors=256,method=Image.Quantize.MEDIANCUT)
        coded=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in pictures]
        coded[0].save(root/(name+'-closeup.gif'),save_all=True,append_images=coded[1:],duration=[70,60,70]*(len(coded)//3),loop=0,optimize=True,disposal=1)
        pictures[0].save(root/(name+'-closeup.webp'),save_all=True,append_images=pictures[1:],duration=[67,66,67]*(len(pictures)//3),loop=0,quality=92,method=4)
        print('Encoded '+name+' detail preview.')
