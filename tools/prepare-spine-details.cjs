const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const src=path.resolve(__dirname,'../output/hinata-live2d-v2'),out=path.resolve(__dirname,'../output/hinata-spine-joints-v4');
const W=1024,H=1536,model=JSON.parse(fs.readFileSync(path.join(src,'layers.json'))),layers=[];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
async function main(){
 fs.mkdirSync(path.join(out,'custom'),{recursive:true});
 const original=await sharp(path.join(src,'reference-approved.png')).ensureAlpha().raw().toBuffer();
 const blank=await sharp(path.join(out,'art/face-blank.png')).ensureAlpha().raw().toBuffer();
 const closed=await sharp(path.join(out,'art/expression-closed.png')).ensureAlpha().raw().toBuffer();
 const masks=new Map();for(const l of model.layers){const m=new Uint8Array(W*H),r=await sharp(path.join(src,l.file)).ensureAlpha().raw().toBuffer();
  for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++)if(r[(y*l.width+x)*4+3]>24)m[(l.y+y)*W+l.x+x]=1;masks.set(l.id,m);
 }
 const union=ids=>{const m=new Uint8Array(W*H);for(const id of ids){const s=masks.get(id);for(let i=0;i<m.length;i++)if(s[i])m[i]=1;}return m;};
 const isSkin=g=>original[g*4]>205&&original[g*4+1]>125&&original[g*4+2]>110;
 const distance=(mask,limit)=>{const d=new Int16Array(W*H).fill(-1),q=new Int32Array(W*H);let a=0,b=0;for(let i=0;i<d.length;i++)if(mask[i]){d[i]=0;q[b++]=i;}
  while(a<b){const i=q[a++];if(d[i]>=limit)continue;const x=i%W;for(const j of [x?i-1:-1,x+1<W?i+1:-1,i>=W?i-W:-1,i+W<d.length?i+W:-1])if(j>=0&&d[j]<0){d[j]=d[i]+1;q[b++]=j;}}return d;};
 async function save(id,x,y,width,height,raw,extra={}){const l={id,x,y,width,height,visible:true,...extra};await sharp(raw,{raw:{width,height,channels:4}}).png().toFile(path.join(out,'custom',id+'.png'));layers.push(l);return l;}
 const groups={eye_L:['eye_white_L','iris_L','upper_lid_L','lower_lid_L'],eye_R:['eye_white_R','iris_R','upper_lid_R','lower_lid_R'],
  brow_L:['brow_L'],brow_R:['brow_R'],nose:['nose'],mouth:['mouth_inside','mouth_teeth','mouth_tongue','mouth_line'],cheek_L:['blush_L'],cheek_R:['blush_R']};
 const distances=[],eraseDistances=[];
 for(const [id,ids] of Object.entries(groups)){
  const selected=model.layers.filter(l=>ids.includes(l.id)),pad=id.startsWith('eye')?12:8;
  const x=Math.max(0,Math.min(...selected.map(l=>l.x))-pad),y=Math.max(0,Math.min(...selected.map(l=>l.y))-pad);
  const right=Math.max(...selected.map(l=>l.x+l.width))+pad,bottom=Math.max(...selected.map(l=>l.y+l.height))+pad,width=right-x,height=bottom-y;
  const featureMask=union(ids);
  if(id.startsWith('eye')){const [cx,cy,rx,ry]=id==='eye_L'?[412,521,84,66]:[620,432,73,74],a=-25*Math.PI/180;
   for(let g=0;g<featureMask.length;g++)if(featureMask[g]){const dx=g%W-cx,dy=Math.floor(g/W)-cy,tx=dx*Math.cos(a)+dy*Math.sin(a),ty=-dx*Math.sin(a)+dy*Math.cos(a);if(tx*tx/(rx*rx)+ty*ty/(ry*ry)>1.18)featureMask[g]=0;}
  }
  // Erase the complete original feature, including its bright iris and rim.
  eraseDistances.push(distance(featureMask,16));
  // Keep only the feature artwork, without a rectangular skin-colour plate.
  for(let g=0;g<featureMask.length;g++)if(featureMask[g]){const r=original[g*4],green=original[g*4+1],b=original[g*4+2];let keep;
   if(id.startsWith('cheek'))keep=r>205&&green<183&&b<150&&r-green>58;
   else if(id.startsWith('brow'))keep=r<190||green<165&&b<105;
   else if(id==='nose')keep=green<175&&b<155;
   else keep=r<210||green<160||green>185&&b>185&&Math.abs(r-green)<40;
   if(id.startsWith('eye')){const side=id.slice(-1);if(masks.get('iris_'+side)[g]||masks.get('eye_white_'+side)[g])keep=true;}
   if(!keep)featureMask[g]=0;
  }
  const d=distance(featureMask,4),raw=Buffer.alloc(width*height*4);distances.push(d);
  for(let py=0;py<height;py++)for(let px=0;px<width;px++){const g=(y+py)*W+x+px,i=(py*width+px)*4;if(d[g]>=0&&d[g]<=1){original.copy(raw,i,g*4,g*4+4);if(d[g])raw[i+3]=Math.round(raw[i+3]*.5);}}
  await save(id,x,y,width,height,raw,{group:'feature',bone:id});
 }
 const hairMask=union(model.layers.filter(l=>l.id.startsWith('hair')).map(l=>l.id)),faceMask=union(['face','ear_L','ear_R']);
 const fullHeadMask=union(model.layers.filter(l=>/^(hair|face|ear|eye|iris|upper_lid|lower_lid|brow|blush|nose|mouth)/.test(l.id)).map(l=>l.id));
 for(let g=0;g<hairMask.length;g++)if(hairMask[g]){
  if(isSkin(g)){hairMask[g]=0;continue;}
  if(original[g*4]<190){let orange=false;const x=g%W,y=Math.floor(g/W);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<W&&y+dy>=0&&y+dy<H){const j=(y+dy)*W+x+dx;if(original[j*4]>195&&original[j*4+1]<175&&original[j*4+2]<95)orange=true;}if(!orange)hairMask[g]=0;}
 }
 const base={x:290,y:245,width:530,height:450},faceRaw=Buffer.alloc(base.width*base.height*4),headNear=distance(fullHeadMask,4);
 for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++){const g=(base.y+y)*W+base.x+x,i=(y*base.width+x)*4;
  if(original[g*4+3]&&blank[g*4+3])blank.copy(faceRaw,i,g*4,g*4+4);
  const fd=Math.min(...eraseDistances.map(d=>d[g]<0?999:d[g]));
  if(headNear[g]>=0&&!hairMask[g]){original.copy(faceRaw,i,g*4,g*4+4);
   if(fd<=16){const fill=1-smooth((fd-2)/14);for(let c=0;c<3;c++)faceRaw[i+c]=Math.round(original[g*4+c]*(1-fill)+blank[g*4+c]*fill);}
  }
  // Continuous hidden scalp behind the animated bangs. It is occluded in rest.
  if(hairMask[g]){if(blank[g*4+3])blank.copy(faceRaw,i,g*4,g*4+4);else faceRaw[i+3]=0;}
  if(headNear[g]<0)faceRaw[i+3]=0;
 }
 await save('face_base',base.x,base.y,base.width,base.height,faceRaw,{group:'face'});
 // Hidden neck overlap behind the chin and hood when the head rocks.
 const neckMatte=await sharp(Buffer.from('<svg width="1024" height="1536"><path fill="white" d="M530 655 L662 609 L714 662 L606 716 L550 701 Z"/></svg>')).ensureAlpha().raw().toBuffer();
 const neckRaw=Buffer.alloc(210*110*4);for(let y=0;y<110;y++)for(let x=0;x<210;x++){const g=(625+y)*W+510+x,i=(y*210+x)*4;blank.copy(neckRaw,i,g*4,g*4+4);neckRaw[i+3]=Math.min(neckRaw[i+3],neckMatte[g*4+3]);}
 await save('neck_underlay',510,625,210,110,neckRaw,{group:'body'});
 const hairLs=model.layers.filter(l=>l.id.startsWith('hair')),hx=Math.min(...hairLs.map(l=>l.x))-2,hy=4,hw=770,hh=690;
 const hairRaw=Buffer.alloc(hw*hh*4);for(let y=0;y<hh;y++)for(let x=0;x<hw;x++){const g=(y+hy)*W+x+hx,i=(y*hw+x)*4;if(hairMask[g])original.copy(hairRaw,i,g*4,g*4+4);}
 // Antialias the inner segmentation edge only. The approved exterior already
 // has its own alpha coverage and is retained exactly.
 const hairA=Buffer.from(Array.from({length:hw*hh},(_,i)=>hairRaw[i*4+3]));
 const softHair=await sharp(hairA,{raw:{width:hw,height:hh,channels:1}}).blur(.7).greyscale().raw().toBuffer();
 for(let y=0;y<hh;y++)for(let x=0;x<hw;x++){const g=(y+hy)*W+x+hx,i=(y*hw+x)*4;
  if(original[g*4+3]>=240&&softHair[y*hw+x]>0){original.copy(hairRaw,i,g*4,g*4+4);hairRaw[i+3]=softHair[y*hw+x];}
 }
 await save('hair_surface',hx,hy,hw,hh,hairRaw,{group:'hair'});
 // Extract only generated pen strokes, not a new face, and register them to
 // the original facial landmarks. Original open expressions stay intact.
 for(const [id,x,y,width,height,dx,dy,slot] of [['eye_L_closed',348,485,140,88,-11,-15,'eye_L'],['eye_R_closed',550,405,150,88,-3,-12,'eye_R'],['mouth_closed',495,530,112,62,6,22,'mouth']]){
  const raw=Buffer.alloc(width*height*4);for(let py=0;py<height;py++)for(let px=0;px<width;px++){
   const g=(y+py)*W+x+px,i=(py*width+px)*4,r=closed[g*4],green=closed[g*4+1];
   const coverage=(1-smooth((r-185)/45))*(1-smooth((green-145)/35));if(coverage>0&&!(id==='mouth_closed'&&px>102)){closed.copy(raw,i,g*4,g*4+4);raw[i+3]=Math.round(raw[i+3]*coverage);}
  }await save(id,x+dx,y+dy,width,height,raw,{group:'feature',bone:slot,alternateFor:slot});
 }
 // Register only the hidden painted boot cavities; original front artwork
 // will occlude these patches and keep the approved outer boot silhouette.
 for(const [side,sx,sy,sw,sh,x,y,width,height] of [['L',270,1028,227,101,357,1241,151,67],['R',650,1064,230,104,666,1255,151,68]]){
  const raw=await sharp(path.join(out,'art/boot-lined.png')).extract({left:sx,top:sy,width:sw,height:sh}).resize(width,height).ensureAlpha().raw().toBuffer();
  for(let py=0;py<height;py++)for(let px=0;px<width;px++){const g=(y+py)*W+x+px;raw[(py*width+px)*4+3]=Math.min(raw[(py*width+px)*4+3],original[g*4+3]);}
  await save('boot_back_'+side,x,y,width,height,raw,{group:'boot',bone:'foot_'+side});
 }
 for(const [side,sx,sy,sw,sh,x,y,width,height] of [['L',302,1070,140,70,386,1252,100,50],['R',677,1100,145,76,690,1268,99,52]]){
  const raw=await sharp(path.join(out,'art/boot-calf-overlap.png')).extract({left:sx,top:sy,width:sw,height:sh}).resize(width,height).ensureAlpha().raw().toBuffer();
  for(let i=0;i<width*height;i++){if(raw[i*4+2]<135||raw[i*4]<210)raw[i*4+3]=0;}
  await save('leg_overlap_'+side,x,y,width,height,raw,{group:'boot',bone:'foot_'+side});
 }
 // A continuous front cuff, extracted across the old cut ownership boundary,
 // overlaps the calf and hides raster-cut teeth at the joint.
 for(const [side,x,y,width,height] of [['L',350,1230,205,98],['R',650,1230,190,105]]){
   const orange=new Uint8Array(W*H);for(let py=0;py<height;py++)for(let px=0;px<width;px++){
     const g=(y+py)*W+x+px,r=original[g*4],green=original[g*4+1],b=original[g*4+2];
     if(r>190&&green>75&&green<197&&b<100&&original[g*4+3]>240)orange[g]=1;
   }
   const d=distance(orange,2),raw=Buffer.alloc(width*height*4);
   for(let py=0;py<height;py++)for(let px=0;px<width;px++){const g=(y+py)*W+x+px,i=(py*width+px)*4;if(d[g]>=0){original.copy(raw,i,g*4,g*4+4);if(d[g]>0)raw[i+3]=Math.round(raw[i+3]*(1-smooth(d[g]/2.5)));raw[i+3]=Math.round(raw[i+3]*smooth((height-1-py)/10));}}
   await save('boot_lip_'+side,x,y,width,height,raw,{group:'boot',bone:'foot_'+side});
 }
 const pants=await sharp(path.join(out,'art/shorts-hidden.png')).extract({left:195,top:468,width:680,height:465}).resize(376,228).ensureAlpha().raw().toBuffer();
 // Only hidden waist and crotch are used. Visible approved pant hems remain
 // in front, so registration differences cannot replace their outline.
 for(let y=0;y<228;y++)for(let x=0;x<376;x++){const gx=385+x,gy=990+y;
   const hem=gx<555?1137+(gx-393)*.31:gx>597?1194-(gx-607)*.18:1147;
   const edge=1-smooth((gy-hem+1)/2);pants[(y*376+x)*4+3]=Math.round(pants[(y*376+x)*4+3]*edge);
 }
  await save('shorts_hidden',385,990,376,228,pants,{group:'body'});
 const pantsRaw=Buffer.alloc(390*213*4);for(let y=0;y<213;y++)for(let x=0;x<390;x++){
  const gx=385+x,gy=1020+y,g=gy*W+gx,r=original[g*4],green=original[g*4+1],b=original[g*4+2];
  const hem=gx<555?1137+(gx-393)*.31:gx>597?1194-(gx-607)*.18:1147;
  if(r<155&&Math.abs(r-green)<35&&b>green*.6&&gy>hem-13&&gy<hem+4){const i=(y*390+x)*4;original.copy(pantsRaw,i,g*4,g*4+4);pantsRaw[i+3]=Math.round(pantsRaw[i+3]*smooth((gy-hem+13)/8));}
 }
 await save('shorts_surface',385,1020,390,213,pantsRaw,{group:'body'});
 const coatBack=await sharp(path.join(out,'coat-occlusion-generated.png')).ensureAlpha().raw().toBuffer();
 const noButtons=await sharp(path.join(out,'art/coat-no-buttons.png')).ensureAlpha().raw().toBuffer();
 const rear={x:260,y:970,width:650,height:265},rearRaw=Buffer.alloc(rear.width*rear.height*4);
 for(let y=0;y<rear.height;y++)for(let x=0;x<rear.width;x++){const g=(rear.y+y)*W+rear.x+x,i=(y*rear.width+x)*4,r=coatBack[g*4],green=coatBack[g*4+1],b=coatBack[g*4+2];
  if(!coatBack[g*4+3]||!(green-b>65||r<190&&r>b*1.5&&green>b*1.4))continue;
  coatBack.copy(rearRaw,i,g*4,g*4+4);rearRaw[i+3]=Math.min(rearRaw[i+3],original[g*4+3]);
  for(const button of model.layers.filter(l=>l.id.startsWith('button'))){const d=Math.hypot(rear.x+x-button.x-button.width/2,rear.y+y-button.y-button.height/2);if(d<22){const t=1-smooth((d-17)/5);for(let c=0;c<3;c++)rearRaw[i+c]=Math.round(rearRaw[i+c]*(1-t)+noButtons[g*4+c]*t);}}
 }
 await save('coat_rear',rear.x,rear.y,rear.width,rear.height,rearRaw,{group:'fixed_body'});
 for(const l of model.layers.filter(l=>l.id.startsWith('button'))){
  const width=l.width+8,height=l.height+8,x=l.x-4,y=l.y-4,raw=Buffer.alloc(width*height*4),d=distance(masks.get(l.id),4);
  for(let py=0;py<height;py++)for(let px=0;px<width;px++){const g=(y+py)*W+x+px,i=(py*width+px)*4;if(d[g]>=0){original.copy(raw,i,g*4,g*4+4);raw[i+3]=Math.round(raw[i+3]*(1-smooth(d[g]/4)));}}
  await save(l.id+'_rigid',x,y,width,height,raw,{group:'button',bone:l.id+'_rigid',center:[l.x+l.width/2,l.y+l.height/2]});
 }
 fs.writeFileSync(path.join(out,'custom-layers.json'),JSON.stringify(layers,null,2));console.log({surfaces:layers.length});
}
main().catch(e=>{console.error(e);process.exit(1);});
