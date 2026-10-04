const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-live2d-v2');
const old=path.resolve(__dirname,'../output/hinata-live2d-v1');
const W=1024,H=1536;
const defs=[
 ['hair_back','后发可见部分','头发'],['hair_front_center','正面刘海','头发'],['hair_front_L','左侧发束','头发'],['hair_front_R','右侧发束','头发'],['hair_crown','顶部发束','头发'],
 ['face','脸部可见底色','头部'],['ear_L','左耳','头部'],['ear_R','右耳','头部'],['neck','脖颈','头部'],
 ['eye_white_L','左眼白','眼睛'],['eye_white_R','右眼白','眼睛'],['iris_L','左虹膜瞳孔高光','眼睛'],['iris_R','右虹膜瞳孔高光','眼睛'],['upper_lid_L','左上眼线','眼睛'],['upper_lid_R','右上眼线','眼睛'],['lower_lid_L','左下眼线','眼睛'],['lower_lid_R','右下眼线','眼睛'],
 ['brow_L','左眉','五官'],['brow_R','右眉','五官'],['blush_L','左脸红笔触','五官'],['blush_R','右脸红笔触','五官'],['nose','鼻部笔触','五官'],
 ['mouth_inside','口腔可见底色','嘴巴'],['mouth_teeth','上牙','嘴巴'],['mouth_tongue','舌头','嘴巴'],['mouth_line','嘴部轮廓','嘴巴'],
 ['coat_torso','雨衣前身','服装'],['sleeve_L','左袖','服装'],['sleeve_R','右袖','服装'],['hood_back','后兜帽','服装'],['collar_L','左前领','服装'],['collar_R','右前领','服装'],['hem_back','后衣摆','服装'],
 ['shorts_L','左侧短裤','服装'],['shorts_R','右侧短裤','服装'],['hand_L','左手','四肢'],['hand_R','右手','四肢'],['leg_L','左腿可见部分','四肢'],['leg_R','右腿可见部分','四肢'],['boot_L','左雨靴','四肢'],['boot_R','右雨靴','四肢'],
 ['button_01','纽扣01','配件'],['button_02','纽扣02','配件'],['button_03','纽扣03','配件'],['button_04','纽扣04','配件'],['crow','乌鸦徽章','配件'],['edge_residual','孤立透明边缘微像素','边缘保留']
];
const ids=new Map(defs.map((d,i)=>[d[0],i]));
const palette=[[255,0,0],[0,255,0],[0,0,255],[0,128,128],[128,0,255],[0,0,128],[255,128,0],[255,255,0],[0,255,255],[255,0,255],[255,128,255],[128,128,128],[128,128,255],[0,128,0],[255,255,255]];
const inside=(x,y,b)=>x>=b[0]&&y>=b[1]&&x<b[2]&&y<b[3];
const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16BE(n);return b;};
const s16=n=>{const b=Buffer.alloc(2);b.writeInt16BE(n);return b;};
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const s32=n=>{const b=Buffer.alloc(4);b.writeInt32BE(n);return b;};
function pascal(s){const b=Buffer.from(s,'ascii');const a=Buffer.concat([Buffer.from([b.length]),b]);return Buffer.concat([a,Buffer.alloc((4-a.length%4)%4)]);}
function luni(s){return Buffer.concat([Buffer.from('8BIMluni'),u32(4+s.length*2),u32(s.length),...s.split('').map(c=>u16(c.charCodeAt(0)))]);}
function savePSD(layers,composite,file){
 const records=[],channelBytes=[];
 for(const l of [...layers].reverse()){
  const n=l.width*l.height,ch=[];
  for(const [id,k]of [[-1,3],[0,0],[1,1],[2,2]]){const b=Buffer.alloc(n);for(let i=0;i<n;i++)b[i]=l.raw[i*4+k];const data=Buffer.concat([u16(0),b]);ch.push(Buffer.concat([s16(id),u32(data.length)]));channelBytes.push(data);}
  const extra=Buffer.concat([u32(0),u32(0),pascal(l.id),luni(l.label+' ['+l.id+']')]);
  records.push(Buffer.concat([s32(l.y),s32(l.x),s32(l.y+l.height),s32(l.x+l.width),u16(4),...ch,Buffer.from('8BIMnorm'),Buffer.from([255,0,l.visible?0:2,0]),u32(extra.length),extra]));
 }
 let info=Buffer.concat([s16(-layers.length),...records,...channelBytes]);if(info.length%2)info=Buffer.concat([info,Buffer.alloc(1)]);
 const mask=Buffer.concat([u32(info.length),info,u32(0)]),planes=[];
 for(let k=0;k<4;k++){const b=Buffer.alloc(W*H);for(let i=0;i<W*H;i++)b[i]=composite[i*4+k];planes.push(b);}
 const header=Buffer.concat([Buffer.from('8BPS'),u16(1),Buffer.alloc(6),u16(4),u32(H),u32(W),u16(8),u16(3)]);
 fs.writeFileSync(file,Buffer.concat([header,u32(0),u32(0),u32(mask.length),mask,u16(0),...planes]));
}
async function main(){
 const source=await sharp(path.join(root,'reference-approved.png')).ensureAlpha().raw().toBuffer();
 const meta=await sharp(path.join(root,'segmentation-guide.png')).metadata();if(meta.width!==W||meta.height!==H)throw Error('Guide is not registered at original dimensions');
 const guide=await sharp(path.join(root,'segmentation-guide.png')).ensureAlpha().raw().toBuffer();
 // The generated guide only chooses ownership. Every delivered visible RGBA
 // sample is copied byte-for-byte from the approved source at the same coordinate.
 const region=new Int16Array(W*H).fill(-1),queue=new Int32Array(W*H);let start=0,end=0;
 for(let i=0;i<W*H;i++){
  if(source[i*4+3]<24)continue;
  const v=[guide[i*4],guide[i*4+1],guide[i*4+2]];
  const [r,g,b]=v;let best=-1;
  if(r>140&&g<65&&b<65)best=0;
  else if(g>80&&r<75&&b<75)best=g>190?1:13;
  else if(b>80&&r<75&&g<75)best=b>190?2:5;
  else if(r<85&&g>65&&b>65&&Math.abs(g-b)<45)best=g>185?8:3;
  else if(r>90&&b>170&&g<75)best=i<W*690?4:9;
  else if(r>185&&g>175&&b<105)best=7;
  else if(r>185&&g>60&&g<185&&b<105)best=6;
  else if(r>185&&g>80&&g<185&&b>185)best=10;
  else if(r>65&&r<200&&Math.max(r,g,b)-Math.min(r,g,b)<35)best=11;
  else if(r>65&&r<200&&g>65&&g<200&&b>190)best=12;
  else if(Math.min(r,g,b)>210)best=14;
  if(best>=0&&guide[i*4+3]>12){region[i]=best;queue[end++]=i;}
 }
 while(start<end){const i=queue[start++],x=i%W;for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,i-W,i+W])if(j>=0&&j<W*H&&region[j]<0&&source[j*4+3]>0){region[j]=region[i];queue[end++]=j;}}
 const owner=new Int16Array(W*H).fill(-1);
 const buttonCenters=[[574,769],[559,870],[544,981],[529,1075]];
 function classify(x,y,i){
  const r=source[i*4],g=source[i*4+1],b=source[i*4+2],p=region[i],gl=[guide[i*4],guide[i*4+1],guide[i*4+2]];
  const skin=r>140&&g>80&&b>65&&r-g<100&&g-b<90;
  if(y<690){
   // Mouth region includes the guide's blue upper-tooth strip.
   if((p===5||(p===2&&y>510))&&inside(x,y,[475,520,636,649])){
    if(r>175&&g>155&&b>140&&r-b<85)return 'mouth_teeth';
    if(r<120&&g<75){let border=false;for(const [dx,dy]of [[-2,0],[2,0],[0,-2],[0,2]]){const j=(y+dy)*W+x+dx;const pp=region[j];if(pp!==5&&pp!==2)border=true;}return border?'mouth_line':'mouth_inside';}
    if(r>185&&g>85&&b>75)return 'mouth_tongue';
    return 'mouth_inside';
   }
   const eye=inside(x,y,[328,456,491,587])?'L':inside(x,y,[550,358,688,504])?'R':null;
   if(eye){
    const cx=eye==='L'?427:615,cy=eye==='L'?522:444,rx=eye==='L'?38:37,ry=46;
    const irisDistance=((x-cx)/rx)**2+((y-cy)/ry)**2;
    const irisColor=r>g*1.13&&g>b*1.10;
    if(irisDistance<1.1&&(irisColor||irisDistance<0.75&&(p===3)))return 'iris_'+eye;
    if(Math.max(...gl)<120&&r<160&&g<115){return (y<(eye==='L'?535:459)?'upper_lid_':'lower_lid_')+eye;}
    if(p===2||p===3){if(r-b<35&&g>135)return 'eye_white_'+eye;if(irisDistance<1.45&&irisColor)return 'iris_'+eye;}
   }
   if(p===4&&r-g>35&&g-b>25)return x<520?'brow_L':'brow_R';
   if(inside(x,y,[501,507,532,538])&&r-g>42)return 'nose';
   if(p===1&&inside(x,y,[378,571,458,636])&&r-g>55&&r>180)return 'blush_L';
   if(p===1&&inside(x,y,[642,495,715,564])&&r-g>55&&r>180)return 'blush_R';
   if(p===0&&skin&&r-g<68&&g-b<60&&inside(x,y,[300,270,805,670])){if(x<378&&y>541)return 'ear_L';if(x>714&&y>357&&y<530)return 'ear_R';return 'face';}
   if(p===0&&inside(x,y,[378,470,714,680])&&r-g<70)return y>663?'neck':'face';
   if(p===0){
    if(y<193)return 'hair_crown';
    if(x<352&&y>311)return 'hair_front_L';
    if(x>693&&y>277&&y<551)return 'hair_front_R';
    if(x>328&&x<717&&y>220&&y<453)return 'hair_front_center';
    return 'hair_back';
   }
   if(p===1||p===4||p===2||p===3||p===5){
    if(x<378&&y>541)return 'ear_L';
    if(x>714&&y>357&&y<530)return 'ear_R';
    if(y>663&&x>515&&x<679)return 'neck';
    return 'face';
   }
   if(p===6&&inside(x,y,[350,545,714,655])&&r<160&&g<100)return 'face';
   if(p===6&&skin&&inside(x,y,[300,545,714,665]))return x<378?'ear_L':'face';
   if(p===6){if(x<553)return 'collar_L';if(y>637)return 'collar_R';return 'hood_back';}
   if(skin&&y<655)return 'face';
   return y<600?'hair_back':'hood_back';
  }
  for(let k=0;k<buttonCenters.length;k++){const [cx,cy]=buttonCenters[k];if((x-cx)**2+(y-cy)**2<17**2)return 'button_0'+(k+1);}
  if(p===14&&inside(x,y,[602,761,686,858])&&r<140&&g<140&&b<140)return 'crow';
  if(y<748&&inside(x,y,[514,641,673,747])&&(p===1||p===13))return 'neck';
  if(p===10&&(inside(x,y,[316,963,441,1088])||inside(x,y,[685,1030,813,1150])))return x<540?'hand_L':'hand_R';
  if(p===8)return 'sleeve_L';
  if(p===9)return 'sleeve_R';
  if(p===11&&y>1070)return x<572?'shorts_L':'shorts_R';
  if(p===12&&y>1123)return x<572?'leg_L':'leg_R';
  if(p===13&&y>1238)return x<572?'boot_L':'boot_R';
  if(p===6){if(y>1020)return 'hem_back';if(y<755)return x<553?'collar_L':'collar_R';return 'hood_back';}
  if(p===7||p===14)return 'coat_torso';
  if(y>1220)return x<572?'boot_L':'boot_R';
  if(y>1140&&skin)return x<572?'leg_L':'leg_R';
  return 'coat_torso';
 }
 const counts=new Uint32Array(defs.length),bounds=defs.map(()=>[W,H,0,0]);
 start=0;end=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(source[i*4+3]<24)continue;owner[i]=ids.get(classify(x,y,i));queue[end++]=i;}
 // Carry the original low-alpha antialias fringe with its adjacent original part.
 while(start<end){const i=queue[start++],x=i%W;for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,i-W,i+W])if(j>=0&&j<W*H&&owner[j]<0&&source[j*4+3]>0){owner[j]=owner[i];queue[end++]=j;}}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!source[i*4+3])continue;if(owner[i]<0)owner[i]=ids.get('edge_residual');const id=owner[i];counts[id]++;const b=bounds[id];b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x+1);b[3]=Math.max(b[3],y+1);}
 const layers=[];
 for(let id=0;id<defs.length;id++){
  if(!counts[id])continue;
  const [name,label,group]=defs[id],[x,y,right,bottom]=bounds[id],width=right-x,height=bottom-y,raw=Buffer.alloc(width*height*4);
  for(let yy=y;yy<bottom;yy++)for(let xx=x;xx<right;xx++){const i=yy*W+xx;if(owner[i]===id)source.copy(raw,((yy-y)*width+xx-x)*4,i*4,i*4+4);}
  await sharp(raw,{raw:{width,height,channels:4}}).png().toFile(path.join(root,'layers',name+'.png'));
  layers.push({id:name,label,group,x,y,width,height,raw,visible:true,file:'layers/'+name+'.png',origin:'approved-source-pixels',pixelCount:counts[id]});
 }
 const merged=Buffer.alloc(source.length);let duplicates=0;
 for(const l of layers)for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++){const j=(y*l.width+x)*4;if(!l.raw[j+3])continue;const k=((l.y+y)*W+l.x+x)*4;if(merged[k+3])duplicates++;l.raw.copy(merged,k,j,j+4);}
 let different=0,missing=0;for(let i=0;i<W*H;i++){const k=i*4;if(source[k+3]&&!merged[k+3])missing++;if(source[k+3]&&source.subarray(k,k+4).compare(merged.subarray(k,k+4))!==0)different++;}
 if(duplicates||missing||different)throw Error(JSON.stringify({duplicates,missing,different}));
 await sharp(merged,{raw:{width:W,height:H,channels:4}}).png().toFile(path.join(root,'assembled.png'));
 // Keep hidden-region candidates separately; never mix regenerated visible
 // artwork into the exact reconstruction or call these finalized occlusion fills.
 const backupIds=['face_base','neck','arm_L','arm_R','leg_L','leg_R','shorts','hood_back','sleeve_L','sleeve_R','hair_back','hair_front_center'];
 const previous=JSON.parse(fs.readFileSync(path.join(old,'layers.json'),'utf8'));
 const candidateDir=path.join(root,'occlusion-candidates');fs.mkdirSync(candidateDir,{recursive:true});
 const candidates=[];
 for(const oldId of backupIds){const l=previous.layers.find(v=>v.id===oldId),id='candidate_'+oldId;const dest=path.join(candidateDir,id+'.png');const misplaced=path.join(root,'layers',id+'.png');if(fs.existsSync(misplaced)&&!fs.existsSync(dest))fs.renameSync(misplaced,dest);fs.copyFileSync(path.join(old,l.file),dest);candidates.push({...l,id,label:l.label+'（未校准候选）',visible:false,file:'occlusion-candidates/'+id+'.png',origin:'previous-unapproved-redraw'});}
 fs.writeFileSync(path.join(candidateDir,'candidates.json'),JSON.stringify({status:'not aligned; not included in PSD or review composite',layers:candidates},null,2));
 savePSD(layers,merged,path.join(root,'hinata_original_pixel_separation.psd'));
 const validation={source:'reference-approved.png',width:W,height:H,visibleOriginalLayers:layers.filter(l=>l.visible).length,separateUnalignedCandidates:backupIds.length,candidatesIncludedInPSD:false,duplicateVisiblePixels:duplicates,missingSourcePixels:missing,changedVisibleRGBA: different,scalingOrRotationApplied:false,hiddenFillStatus:'not finalized',CubismImport:'not yet verified',binding:'not started'};
 fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(validation,null,2));
 const model={version:2,width:W,height:H,status:'original-pixel-separation-review',source:'reference-approved.png',leftRight:'screen coordinates',layers:layers.map(({raw,...l})=>l),notes:['所有默认显示部件直接保存原图 RGBA 像素与坐标，无缩放、旋转或重画。','Imagegen 只生成机器分区参考图；默认叠合图不含重画部件。','隐藏的补全候选尚未校准，不作为完成的遮挡补全材料。','仍需完成遮挡补全与切边审核后才可进入 Live2D 绑定。']};
 fs.writeFileSync(path.join(root,'layers.json'),JSON.stringify(model,null,2));
 await montage(layers.filter(l=>l.visible));
 console.log(JSON.stringify(validation,null,2));
}
async function montage(layers){
 const cols=6,cw=230,ch=235,rows=Math.ceil(layers.length/cols),width=cols*cw,height=rows*ch+80,parts=[];
 let svg=`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f7f2e9"/><text x="24" y="34" font-family="Microsoft YaHei" font-size="22" fill="#432b1f">原图像素拆层 · 可见部件总览</text><text x="24" y="61" font-family="Microsoft YaHei" font-size="14" fill="#806652">${layers.length} 个原图部件 · 坐标与颜色保留 · 隐藏补全尚待校准</text>`;
 for(let i=0;i<layers.length;i++){const l=layers[i],x=i%cols*cw,y=80+Math.floor(i/cols)*ch;svg+=`<rect x="${x+6}" y="${y+4}" width="${cw-12}" height="${ch-8}" rx="10" fill="white" stroke="#e3d4bc"/><text x="${x+16}" y="${y+ch-35}" font-family="Microsoft YaHei" font-size="13" fill="#503428">${l.label}</text><text x="${x+16}" y="${y+ch-16}" font-family="sans-serif" font-size="11" fill="#9b8066">${l.id}</text>`;const b=await sharp(l.raw,{raw:{width:l.width,height:l.height,channels:4}}).resize(cw-32,ch-70,{fit:'inside'}).png().toBuffer();const m=await sharp(b).metadata();parts.push({input:b,left:x+Math.round((cw-m.width)/2),top:y+15+Math.round((ch-75-m.height)/2)});}
 await sharp(Buffer.from(svg+'</svg>')).composite(parts).png().toFile(path.join(root,'layer-preview.png'));
}
main().catch(e=>{console.error(e);process.exit(1)});
