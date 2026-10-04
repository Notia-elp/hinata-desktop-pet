// Register the generated components by mechanical joint centres. Sharp only
// transforms/crops painted RGBA; no new painted colours or silhouette fills.
const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=path.resolve(__dirname,'../output/hinata-spine-playful-v5'),W=1024,H=1536,rad=180/Math.PI;
const layers=[],bones=[];
const rig={hub:[550,-90],L:{A:[510,-65],B:[150,250],C:[410,770]},R:{A:[590,-65],B:[955,245],C:[827,770]}};
function addBone(name,parent,A,B,parentOrigin,parentAngle=0){const dx=A[0]-parentOrigin[0],dy=parentOrigin[1]-A[1],c=Math.cos(parentAngle/rad),s=Math.sin(parentAngle/rad),angle=B?Math.atan2(A[1]-B[1],B[0]-A[0])*rad:0;
 const b={name,parent,x:dx*c+dy*s,y:-dx*s+dy*c,rotation:angle-parentAngle};if(B)b.length=Math.hypot(B[0]-A[0],B[1]-A[1]);bones.push(b);return angle;}
async function register(id,crop,sourceA,sourceB,targetA,targetB,bone,mirror=false,depth='rear'){
 let image=await sharp(path.join(out,'art/claw-parts-generated-v2.png')).extract(crop).png().toBuffer();
 const srcA=[sourceA[0]-crop.left,sourceA[1]-crop.top],srcB=[sourceB[0]-crop.left,sourceB[1]-crop.top];
 if(mirror){image=await sharp(image).flop().png().toBuffer();srcA[0]=crop.width-1-srcA[0];srcB[0]=crop.width-1-srcB[0];}
 const dx=srcB[0]-srcA[0],dy=srcB[1]-srcA[1],tx=targetB[0]-targetA[0],ty=targetB[1]-targetA[1],den=dx*dx+dy*dy;
 const a=(tx*dx+ty*dy)/den,b=(ty*dx-tx*dy)/den,ox=targetA[0]-a*srcA[0]+b*srcA[1],oy=targetA[1]-b*srcA[0]-a*srcA[1];
 const corners=[[0,0],[crop.width,0],[crop.width,crop.height],[0,crop.height]].map(([x,y])=>[a*x-b*y+ox,b*x+a*y+oy]);
 const x=Math.floor(Math.min(...corners.map(p=>p[0])))-2,y=Math.floor(Math.min(...corners.map(p=>p[1])))-2,width=Math.ceil(Math.max(...corners.map(p=>p[0])))-x+2,height=Math.ceil(Math.max(...corners.map(p=>p[1])))-y+2;
 const source=await sharp(image).ensureAlpha().raw().toBuffer(),raw=Buffer.alloc(width*height*4),det=a*a+b*b;
 for(let py=0;py<height;py++)for(let px=0;px<width;px++){
  const sx=(a*(x+px-ox)+b*(y+py-oy))/det,sy=(-b*(x+px-ox)+a*(y+py-oy))/det;
  if(sx<0||sy<0||sx>=crop.width-1||sy>=crop.height-1)continue;
  const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,i=(py*width+px)*4;let alpha=0,r=0,g=0,bl=0;
  for(const [xx,yy,w]of [[ix,iy,(1-fx)*(1-fy)],[ix+1,iy,fx*(1-fy)],[ix,iy+1,(1-fx)*fy],[ix+1,iy+1,fx*fy]]){
   const q=(yy*crop.width+xx)*4,aw=w*source[q+3];alpha+=aw;r+=aw*source[q];g+=aw*source[q+1];bl+=aw*source[q+2];}
  if(alpha){raw[i]=Math.round(r/alpha);raw[i+1]=Math.round(g/alpha);raw[i+2]=Math.round(bl/alpha);raw[i+3]=Math.round(alpha);}
 }
 await sharp(raw,{raw:{width,height,channels:4}}).png().toFile(path.join(out,'custom',id+'.png'));
 const l={id,x,y,width,height,visible:true,hidden:true,group:'claw',bone,depth,registration:{sourceA,sourceB,targetA,targetB,mirror,a,b,ox,oy}};layers.push(l);return l;
}
(async()=>{
 bones.push({name:'claw_root',parent:'motion',x:rig.hub[0]-W/2,y:H-rig.hub[1]});
 await register('claw_machine_arm',{left:270,top:0,width:280,height:632},[407,540],[407,33],rig.hub,[550,-330],'claw_root',false,'front');
 for(const side of ['L','R']){
  const {A,B,C}=rig[side],angle=addBone('claw_upper_'+side,'claw_root',A,B,rig.hub);
  addBone('claw_lower_'+side,'claw_upper_'+side,B,C,A,angle);
  await register('claw_link_'+side,{left:820,top:35,width:150,height:590},[891,110],[891,548],A,B,'claw_upper_'+side);
  const lower=await register('claw_finger_'+side,{left:240,top:630,width:350,height:600},[313,710],[467,1168],B,C,'claw_lower_'+side,side==='L');
  // Foreground rubber hook is a crop of the identical registered lower finger.
  // Its remainder stays behind the character, so the pads wrap over the coat.
  const crop={left:Math.max(0,C[0]-80-lower.x),top:Math.max(0,C[1]-65-lower.y)};
  crop.width=Math.min(155,lower.width-crop.left);crop.height=Math.min(110,lower.height-crop.top);
  const id='claw_pad_'+side;await sharp(path.join(out,'custom',lower.id+'.png')).extract(crop).png().toFile(path.join(out,'custom',id+'.png'));
  layers.push({id,x:lower.x+crop.left,y:lower.y+crop.top,width:crop.width,height:crop.height,visible:true,hidden:true,group:'claw',bone:'claw_lower_'+side,depth:'pad'});
 }
 addBone('claw_back','claw_root',rig.hub,[675,765],rig.hub);
 await register('claw_back_finger',{left:830,top:630,width:150,height:600},[906,709],[885,1167],rig.hub,[675,765],'claw_back');
 fs.writeFileSync(path.join(out,'art/claw-rig.json'),JSON.stringify({mode:'Built-in ImageGen',paint:'art/claw-parts-generated-v2.png',prompt:'art/claw-prompt-v2.json',style:'Rounded cream enamel, orange joint caps, friendly smiling hub and soft orange contact pads.',rig,bones,layers},null,2)+'\n');
 console.log(JSON.stringify({layers:layers.length,bones:bones.length}));
})().catch(e=>{console.error(e);process.exit(1);});
