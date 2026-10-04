const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
const layers=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../output/hinata-spine-joints-v4/custom-layers.json')));
const boxes={
 stunned:[[350,456,140,126],[554,372,144,130],[350,390,85,58],[514,316,90,67],[465,525,170,101]],
 shocked:[[334,441,168,147],[547,350,155,145],[345,383,96,58],[510,310,100,67],[483,503,175,167]],
 grin:[[332,455,156,105],[552,362,154,101],[340,388,107,57],[520,309,80,66],[450,514,196,127]],
 determined:[[326,436,175,145],[548,350,158,155],[340,381,110,65],[510,305,110,73],[463,538,160,87]]
};
const ids=['eye_L','eye_R','brow_L','brow_R','mouth'],centers=[[412,521],[620,432],[390,417],[553,353],[555,580]];
function components(mask,w,h){const seen=new Uint8Array(mask.length),all=[];
 for(let i=0;i<mask.length;i++){if(!mask[i]||seen[i])continue;const q=[i];seen[i]=1;for(let k=0;k<q.length;k++){const a=q[k],x=a%w,y=Math.floor(a/w);for(const b of [x?a-1:-1,x+1<w?a+1:-1,y?a-w:-1,y+1<h?a+w:-1])if(b>=0&&mask[b]&&!seen[b]){seen[b]=1;q.push(b);}}all.push(q);}return all.sort((a,b)=>b.length-a.length);}
async function main(){
 await require('./prepare-spine-head-contours.cjs')(root,layers,sharp);
 for(const [variant,regions] of Object.entries(boxes)){
 const full=await sharp(path.join(root,'art','expression-'+variant+'.png')).ensureAlpha().raw().toBuffer();
 for(let n=0;n<ids.length;n++){
  const id=ids[n],[x,y,w,h]=regions[n],raw=Buffer.alloc(w*h*4),mask=new Uint8Array(w*h);
  if(id.startsWith('brow')){const original=layers.find(l=>l.id===id),name=id+'_'+variant;fs.copyFileSync(path.join(root,'custom',id+'.png'),path.join(root,'custom',name+'.png'));layers.push({...original,id:name,alternateFor:id});continue;}
  if(id==='mouth'&&variant==='shocked'){
   const name=id+'_'+variant;await sharp(path.join(root,'art/mouth-shocked-isolated.png')).trim().resize(143,148,{fit:'fill'}).png().toFile(path.join(root,'custom',name+'.png'));
   layers.push({id:name,x:484,y:506,width:143,height:148,visible:true,group:'feature',bone:id,alternateFor:id});continue;
  }
  let matte=null;if(id==='mouth'&&variant==='shocked')matte=await sharp(Buffer.from('<svg width="1024" height="1536"><polygon fill="white" points="490,542 522,528 580,519 601,529 619,564 637,611 628,640 596,656 559,665 526,662 509,642 496,612 487,582"/></svg>')).ensureAlpha().raw().toBuffer();
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){const i=py*w+px,g=((y+py)*1024+x+px)*4;full.copy(raw,i*4,g,g+4);const r=full[g],a=full[g+1],b=full[g+2];
   const white=a>173&&b>174&&Math.abs(r-a)<23&&Math.abs(a-b)<22;
   const ink=(r<225&&a<170&&b<150)||(n===2||n===3)&&r>160&&a<165&&b<90;
   const drool=id==='mouth'&&variant==='stunned'&&b>a&&b>150;
   mask[i]=(white||ink||drool)&&(!matte||matte[g+3]>128)?1:0;
  }
  const cs=components(mask,w,h),keep=new Uint8Array(w*h);if(!cs.length)throw Error('Empty '+id+' '+variant);
  // White interiors connect the pupil and ink rim; isolated skin and hair are
  // excluded by the tight feature ROIs. Tiny drool belongs to the same mouth.
  for(const i of cs[0])keep[i]=1;
  if(variant==='stunned'&&id==='mouth')for(const c of cs.slice(1))if(c.length>25){const blue=c.filter(i=>raw[i*4+2]>raw[i*4+1]&&raw[i*4+2]>150).length;if(blue>c.length*.25)for(const i of c)keep[i]=1;}
  // Fill fully enclosed gaps, retaining antialias coverage at the outer edge.
  const outside=new Uint8Array(w*h),q=[];for(let i=0;i<w*h;i++)if(!keep[i]&&(i<w||i>=w*(h-1)||i%w===0||i%w===w-1)){outside[i]=1;q.push(i);}
  for(let k=0;k<q.length;k++){const a=q[k],px=a%w,py=Math.floor(a/w);for(const b of [px?a-1:-1,px+1<w?a+1:-1,py?a-w:-1,py+1<h?a+w:-1])if(b>=0&&!keep[b]&&!outside[b]){outside[b]=1;q.push(b);}}
  for(let i=0;i<keep.length;i++)if(!outside[i])keep[i]=1;
  // One-pixel coverage fringe uses the generated ink colours, with no skin plate.
  const cover=await sharp(Buffer.from(keep.map(v=>v*255)),{raw:{width:w,height:h,channels:1}}).blur(.45).greyscale().raw().toBuffer();
  let left=w,top=h,right=0,bottom=0;for(let i=0;i<keep.length;i++){raw[i*4+3]=Math.min(raw[i*4+3],cover[i]);if(cover[i]>5){left=Math.min(left,i%w);right=Math.max(right,i%w);top=Math.min(top,Math.floor(i/w));bottom=Math.max(bottom,Math.floor(i/w));}}
  const cw=right-left+1,ch=bottom-top+1,name=id+'_'+variant;
  const cropped=await sharp(raw,{raw:{width:w,height:h,channels:4}}).extract({left,top,width:cw,height:ch}).png().toBuffer();
  // Preserve each hand-painted feature's slant and proportions, translating its
  // centre to the same landmark used by the approved head rig.
  let [cx,cy]=centers[n];if(id==='mouth'&&variant==='determined')cy=585;if(id==='mouth'&&variant==='grin')cy=578;
  await fs.promises.writeFile(path.join(root,'custom',name+'.png'),cropped);
  layers.push({id:name,x:Math.round(cx-cw/2),y:Math.round(cy-ch/2),width:cw,height:ch,visible:true,group:'feature',bone:id,alternateFor:id});
 }
 }
 const ball=await sharp(path.join(root,'art/volleyball-generated.png')).trim().resize(172,172,{fit:'contain',background:'#00000000'}).png().toBuffer();
 fs.writeFileSync(path.join(root,'custom/volleyball.png'),ball);layers.push({id:'volleyball',x:394,y:-168,width:172,height:172,visible:true,group:'prop',bone:'volleyball',hidden:true});
 fs.writeFileSync(path.join(root,'custom-layers.json'),JSON.stringify(layers,null,2));
 const tiles=[];for(let n=0;n<4;n++){const variant=Object.keys(boxes)[n];const comps=[];for(const id of ids){const l=layers.find(l=>l.id===id+'_'+variant);comps.push({input:path.join(root,'custom',l.id+'.png'),left:l.x-275,top:l.y-285});}tiles.push({input:await sharp({create:{width:455,height:410,channels:4,background:'#ffdfc5'}}).composite(comps).png().toBuffer(),left:n*455,top:0});}
 await sharp({create:{width:1820,height:410,channels:4,background:'#eee'}}).composite(tiles).png().toFile(path.join(root,'art/features-registration.png'));
 console.log(JSON.stringify({custom:layers.length}));
}
main().catch(e=>{console.error(e);process.exit(1);});
