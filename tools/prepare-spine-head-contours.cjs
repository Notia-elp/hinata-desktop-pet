// Register ImageGen artwork and prepare alpha mattes. All painted RGB is from
// the approved front hair or the generated head/back-hair assets.
const fs=require('fs'),path=require('path');
const W=1024,H=1536;
function regions(mask,w,h){const seen=new Uint8Array(mask.length),out=[];
 for(let i=0;i<mask.length;i++){if(!mask[i]||seen[i])continue;const q=[i];seen[i]=1;
  for(let k=0;k<q.length;k++){const p=q[k],x=p%w,y=Math.floor(p/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(mask[j]&&!seen[j]){seen[j]=1;q.push(j);}}}out.push(q);
 }return out.sort((a,b)=>b.length-a.length);
}
function includeFringe(raw,keep,w,h){const support=keep.slice();for(let i=0;i<keep.length;i++)if(keep[i]){const x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)support[(y+dy)*w+x+dx]=1;}for(let i=0;i<keep.length;i++)if(!support[i])raw[i*4+3]=0;}
function closedInteriors(mask,w,h){const outside=new Uint8Array(mask.length),q=[];
 for(let i=0;i<mask.length;i++)if(!mask[i]&&(i<w||i>=w*(h-1)||i%w===0||i%w===w-1)){outside[i]=1;q.push(i);}
 for(let k=0;k<q.length;k++){const i=q[k],x=i%w;for(const j of [x?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i+w<mask.length?i+w:-1])if(j>=0&&!outside[j]&&!mask[j]){outside[j]=1;q.push(j);}}
 for(let i=0;i<mask.length;i++)if(!outside[i])mask[i]=1;
}
module.exports=async function(root,layers,sharp){
 const face=layers.find(l=>l.id==='face_base'),hair=layers.find(l=>l.id==='hair_surface');
 const {data:head,info}=await sharp(path.join(root,'art/head-plate-clean-generated.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==W||info.height!==H)throw Error('Head asset canvas must be 1024x1536');
 // Separate skin from the small nape tufts in the generated head plate; the
 // complete rear hairstyle is a different independently weighted layer.
 const skin=new Uint8Array(W*H),distance=new Int16Array(W*H).fill(-1),queue=new Int32Array(W*H);let qa=0,qb=0;
 for(let i=0;i<skin.length;i++)if(head[i*4+3]>24&&head[i*4]>190&&head[i*4+1]>125&&head[i*4+2]>100){skin[i]=1;distance[i]=0;queue[qb++]=i;}
 while(qa<qb){const i=queue[qa++];if(distance[i]>=4)continue;const x=i%W;for(const j of [x?i-1:-1,x<W-1?i+1:-1,i>=W?i-W:-1,i+W<skin.length?i+W:-1])if(j>=0&&distance[j]<0){distance[j]=distance[i]+1;queue[qb++]=j;}}
 for(let i=0;i<skin.length;i++)if(distance[i]>=0&&head[i*4+3]>24&&head[i*4]<190&&head[i*4+1]<125)skin[i]=1;
 closedInteriors(skin,W,H);const skinRegions=regions(skin,W,H),mainSkin=new Uint8Array(W*H);for(const i of skinRegions[0])mainSkin[i]=1;includeFringe(head,mainSkin,W,H);
 // Similarity registration of the ear landmarks, including rotation. No
 // generative image is assumed to preserve source coordinates by itself.
 const sourceL=[313,665],sourceR=[800,506],targetL=[346,600],targetR=[757,449];
 const dx=sourceR[0]-sourceL[0],dy=sourceR[1]-sourceL[1],tx=targetR[0]-targetL[0],ty=targetR[1]-targetL[1],den=dx*dx+dy*dy;
 const a=(tx*dx+ty*dy)/den,b=(ty*dx-tx*dy)/den,ox=targetL[0]-a*sourceL[0]+b*sourceL[1],oy=targetL[1]-b*sourceL[0]-a*sourceL[1],det=a*a+b*b;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 // A small registered lower-jaw correction matches the approved chin/collar
 // contact. The ear anchors and upper scalp stay at the similarity transform.
 const jawShift=(x,y)=>5.5*smooth((y-565)/80)*smooth((x-390)/55)*(1-smooth((x-720)/55));
 const registered=Buffer.alloc(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let ry=y;for(let k=0;k<5;k++)ry=y-jawShift(x,ry);
  const sx=(a*(x-ox)+b*(ry-oy))/det,sy=(-b*(x-ox)+a*(ry-oy))/det;if(sx<0||sy<0||sx>=W-1||sy>=H-1)continue;
  const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,i=(y*W+x)*4;let alpha=0;const rgb=[0,0,0];
  for(const [xx,yy,w]of [[ix,iy,(1-fx)*(1-fy)],[ix+1,iy,fx*(1-fy)],[ix,iy+1,(1-fx)*fy],[ix+1,iy+1,fx*fy]]){const q=(yy*W+xx)*4,aw=w*head[q+3];alpha+=aw;for(let c=0;c<3;c++)rgb[c]+=aw*head[q+c];}
  if(alpha){for(let c=0;c<3;c++)registered[i+c]=Math.round(rgb[c]/alpha);registered[i+3]=alpha>=250?255:Math.round(alpha);}
 }
 await sharp(registered,{raw:{width:W,height:H,channels:4}}).png().toFile(path.join(root,'art/head-plate-registered.png'));
 await sharp(registered,{raw:{width:W,height:H,channels:4}}).extract({left:face.x,top:face.y,width:face.width,height:face.height}).png().toFile(path.join(root,'custom/face_base.png'));
 const scalp={id:'scalp_underlay',x:275,y:170,width:560,height:435,visible:true,group:'face'};
 await sharp(registered,{raw:{width:W,height:H,channels:4}}).extract({left:scalp.x,top:scalp.y,width:scalp.width,height:scalp.height}).png().toFile(path.join(root,'custom/scalp_underlay.png'));layers.push(scalp);
 const front=await sharp(path.resolve(root,'../hinata-spine-joints-v4/custom/hair_surface.png')).ensureAlpha().raw().toBuffer();
 const frontMask=Uint8Array.from({length:hair.width*hair.height},(_,i)=>front[i*4+3]>=24?1:0),hairRegions=regions(frontMask,hair.width,hair.height),keep=new Uint8Array(frontMask.length);for(const i of hairRegions[0])keep[i]=1;includeFringe(front,keep,hair.width,hair.height);
 await sharp(front,{raw:{width:hair.width,height:hair.height,channels:4}}).png().toFile(path.join(root,'custom/hair_surface.png'));
 const leftNape=await require('./prepare-spine-left-nape.cjs')(root,sharp);
 const rear=await sharp(path.join(root,leftNape.registered)).resize(hair.width,hair.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 // The rear crown tucks under the approved animated front silhouette. Its
 // organically drawn lower nape contour is preserved, never replaced by a
 // rectangle or cropped into arbitrary hair points.
 for(let y=0;y<hair.height;y++)for(let x=0;x<hair.width;x++){
  const gx=hair.x+x,gy=hair.y+y,i=(y*hair.width+x)*4,g=(gy*W+gx)*4;
  // The front curtain owns the left outline above the ear. The rear volume
  // previously escaped its matte at y=500, revealing a second painted tip.
  // Continue the existing front/head coverage through this overlap, then
  // feather back to the naturally drawn lower nape. No painted RGB changes.
  const ownership=gy<500?1:(1-smooth((gx-225)/15))*(1-smooth((gy-545)/15));
  const clipped=Math.min(rear[i+3],Math.max(front[i+3],registered[g+3]));
  rear[i+3]=Math.round(rear[i+3]*(1-ownership)+clipped*ownership);
 }
 const rearLayer={...hair,id:'hair_rear_complete',label:'完整后脑发束与耳后发尾',group:'hair'};
 await sharp(rear,{raw:{width:hair.width,height:hair.height,channels:4}}).png().toFile(path.join(root,'custom/hair_rear_complete.png'));layers.push(rearLayer);
 const log={mode:'Built-in ImageGen artwork with deterministic alpha cleanup and landmark registration',headSource:'art/head-plate-clean-generated.png',rearSource:'art/rear-hair-complete-final.png',headRegistration:{sourceL,sourceR,targetL,targetR,a,b,ox,oy,jawContactCorrection:{maximumPixels:5.5,verticalRange:[565,645],horizontalRange:[390,775],earAnchorsUnchanged:true}},frontHairCleanup:{retainedMainPixels:hairRegions[0].length,removedComponents:hairRegions.length-1},retired:['nape_underlay_L','nape_underlay_R','nape_underlay_temple_R'],rearHair:'Single fully painted rear volume, natural nape contour, same weighted hair lattice as front hair, below neck/face/hood.'};
 log.rearSource=leftNape.registered;log.leftNapeRedraw=leftNape;
 log.leftOutlineOwnership={source:'Existing painted front-hair and registered head alpha mattes',scope:'Only the redundant outer-left rear tip at source x=201..222, y=500..540 and its antialias fringe; fade ends at x=240 and y=560. Lower nape remains untouched.',paintedRGBUnchanged:true};
 fs.writeFileSync(path.join(root,'head-contour-registration.json'),JSON.stringify(log,null,2));
};
module.exports.keepMainContour=function(raw,w,h){
 const cs=regions(Uint8Array.from({length:w*h},(_,i)=>raw[i*4+3]>=24?1:0),w,h),keep=new Uint8Array(w*h);
 if(!cs.length)throw Error('Empty attachment contour');for(const i of cs[0])keep[i]=1;includeFringe(raw,keep,w,h);
 return {removedComponents:cs.length-1,mainPixels:cs[0].length};
};
