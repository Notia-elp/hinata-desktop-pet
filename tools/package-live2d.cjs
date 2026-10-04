const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../output/hinata-live2d-v1');
const W = 1024, H = 1536;
const atlasConfig = {
  head: {cols:3,rows:3}, eyes: {cols:2,rows:7},
  clothes: {cols:3,rows:3}, limbs: {cols:2,rows:4}, mouth: {cols:2,rows:4}, sidehair:{cols:2,rows:1}
};
// Bounding rectangles are model coordinates, not atlas coordinates.
// Screen-left/right naming avoids ambiguity in the original tilted pose.
const parts = [
  ['hair_back','后发底层','head',3,[126,22,757,659],true,'头发'],
  ['arm_L','左臂遮挡补全','limbs',6,[338,755,137,273],false,'四肢'],
  ['arm_R','右臂遮挡补全','limbs',7,[658,759,128,308],false,'四肢'],
  ['leg_L','左腿','limbs',2,[391,1118,145,250],true,'四肢'],
  ['leg_R','右腿','limbs',3,[592,1129,184,249],true,'四肢'],
  ['boot_L','左雨靴','limbs',4,[266,1249,203,246],true,'四肢'],
  ['boot_R','右雨靴','limbs',5,[617,1270,230,235],true,'四肢'],
  ['shorts','短裤','clothes',8,[383,1059,389,170],true,'服装'],
  ['hood_back','后兜帽','clothes',0,[430,568,380,208],true,'服装'],
  ['neck','脖颈','head',8,[493,610,163,154],true,'头部'],
  ['coat_torso','雨衣主体','clothes',1,[321,673,530,510],true,'服装'],
  ['sleeve_L','左袖','clothes',4,[270,740,249,316],true,'服装'],
  ['sleeve_R','右袖','clothes',5,[640,723,212,348],true,'服装'],
  ['hem_L','左衣摆补全部件','clothes',6,[306,1046,211,143],false,'服装'],
  ['hem_R','右衣摆补全部件','clothes',7,[668,1037,208,152],false,'服装'],
  ['collar_L','左前领','clothes',2,[458,642,116,149],true,'服装'],
  ['collar_R','右前领','clothes',3,[551,626,219,132],true,'服装'],
  ['button_01','纽扣01','mouth',7,[557,756,31,32],true,'配件'],
  ['button_02','纽扣02','mouth',7,[545,851,30,32],true,'配件'],
  ['button_03','纽扣03','mouth',7,[535,936,31,31],true,'配件'],
  ['button_04','纽扣04','mouth',7,[521,1011,31,31],true,'配件'],
  ['button_05','纽扣05','mouth',7,[512,1076,30,30],true,'配件'],
  ['crow','乌鸦徽章','mouth',6,[621,789,72,89],true,'配件'],
  ['ear_L','左耳','head',1,[296,536,103,125],true,'头部'],
  ['ear_R','右耳','head',2,[697,366,106,142],true,'头部'],
  ['face_base','脸部完整底色','head',0,[287,219,508,451],true,'头部'],
  ['eye_white_L','左眼白','eyes',0,[365,471,126,109],true,'眼睛'],
  ['eye_white_R','右眼白','eyes',1,[589,383,128,111],true,'眼睛'],
  ['iris_L','左虹膜瞳孔高光','eyes',2,[402,481,72,94],true,'眼睛'],
  ['iris_R','右虹膜瞳孔高光','eyes',3,[621,394,73,94],true,'眼睛'],
  ['eye_lower_L','左下眼线','eyes',6,[367,549,122,33],true,'眼睛'],
  ['eye_lower_R','右下眼线','eyes',7,[591,463,126,32],true,'眼睛'],
  ['eye_upper_L','左上眼睑睫毛','eyes',4,[357,465,139,50],true,'眼睛'],
  ['eye_upper_R','右上眼睑睫毛','eyes',5,[581,370,141,57],true,'眼睛'],
  ['brow_L','左眉','eyes',8,[379,434,83,27],true,'五官'],
  ['brow_R','右眉','eyes',9,[615,343,90,31],true,'五官'],
  ['blush_L','左脸红','eyes',10,[384,575,85,62],true,'五官'],
  ['blush_R','右脸红','eyes',11,[652,492,76,62],true,'五官'],
  ['nose','鼻子','mouth',4,[512,507,21,23],true,'五官'],
  ['mouth_inside','口腔底色','mouth',0,[485,528,138,113],true,'嘴巴'],
  ['mouth_tongue','舌头','mouth',2,[507,583,104,55],true,'嘴巴'],
  ['mouth_teeth','上牙','mouth',1,[490,530,119,39],true,'嘴巴'],
  ['mouth_outline','嘴部轮廓','mouth',3,[485,527,139,116],true,'嘴巴'],
  ['eye_closed_L','左闭眼替换','eyes',12,[367,500,126,31],false,'表情替换'],
  ['eye_closed_R','右闭眼替换','eyes',13,[590,413,126,31],false,'表情替换'],
  ['mouth_closed','闭嘴微笑替换','mouth',5,[497,561,112,24],false,'表情替换'],
  ['hair_front_center','中间刘海','head',4,[363,174,355,289],true,'头发'],
  ['hair_front_L','左侧刘海','sidehair',0,[269,244,118,300],true,'头发'],
  ['hair_front_R','右侧刘海','sidehair',1,[719,244,81,223],true,'头发'],
  ['hair_cowlick','头顶翘发','head',7,[368,10,247,184],true,'头发'],
  ['hand_L','左手','limbs',0,[329,983,99,115],true,'四肢'],
  ['hand_R','右手','limbs',1,[702,1036,100,122],true,'四肢'],
];
const u16 = n => { const b=Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const s16 = n => { const b=Buffer.alloc(2); b.writeInt16BE(n); return b; };
const u32 = n => { const b=Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const s32 = n => { const b=Buffer.alloc(4); b.writeInt32BE(n); return b; };
function pascal(s) { const b=Buffer.from(s,'ascii').subarray(0,255); const v=Buffer.concat([Buffer.from([b.length]),b]); return Buffer.concat([v,Buffer.alloc((4-v.length%4)%4)]); }
function unicode(s) { const chars=Array.from(s); return Buffer.concat([u32(chars.length),...chars.map(c=>u16(c.charCodeAt(0)))]); }
function block(key,data) {return Buffer.concat([Buffer.from('8BIM'+key),u32(data.length),data,Buffer.alloc(data.length%2)]);}
async function cropPart(key, index) {
  const cfg=atlasConfig[key], file=path.join(root,'atlases',key+'.png');
  const meta=await sharp(file).metadata();
  const col=index%cfg.cols, row=Math.floor(index/cfg.cols);
  let left=Math.round(col*meta.width/cfg.cols), top=Math.round(row*meta.height/cfg.rows);
  let right=Math.round((col+1)*meta.width/cfg.cols), bottom=Math.round((row+1)*meta.height/cfg.rows);
  // optional measured atlas crops override nominal cell boundaries
  const custom=JSON.parse(fs.existsSync(path.join(root,'atlas-crops.json'))?fs.readFileSync(path.join(root,'atlas-crops.json'),'utf8'):'{}');
  if(custom[key]?.[index]) [left,top,right,bottom]=custom[key][index];
  const {data,info}=await sharp(file).extract({left,top,width:right-left,height:bottom-top}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Alpha-only bounding crop: no invented linework or paint is added here.
  let x0=info.width,y0=info.height,x1=0,y1=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
  if(x0>=x1||y0>=y1)throw Error(`Empty atlas cell ${key}/${index}`);
  return sharp(data,{raw:info}).extract({left:x0,top:y0,width:x1-x0,height:y1-y0}).png().toBuffer();
}
async function main(){
  const layers=[];
  const overridesFile=path.join(root,'layout-overrides.json');
  const overrides=fs.existsSync(overridesFile)?JSON.parse(fs.readFileSync(overridesFile,'utf8')):{};
  for(const [id,label,atlas,cell,defaultRect,visible,group] of parts){
    const rect=overrides[id]?.rect||defaultRect;
    const shown=overrides[id]?.visible??visible;
    const source=await cropPart(atlas,cell);
    const buf=await sharp(source).resize(rect[2],rect[3],{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
    const file=id+'.png';fs.writeFileSync(path.join(root,'layers',file),buf);
    const raw=await sharp(buf).ensureAlpha().raw().toBuffer();
    layers.push({id,label,group,x:rect[0],y:rect[1],width:rect[2],height:rect[3],visible:shown,file:'layers/'+file,atlas,cell,raw});
  }
  const merged=await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers.filter(l=>l.visible).map(l=>({input:l.raw,raw:{width:l.width,height:l.height,channels:4},left:l.x,top:l.y}))).png().toBuffer();
  fs.writeFileSync(path.join(root,'assembled.png'),merged);
  const records=[],channelData=[];
  // PSD layer records are topmost first. Four raw channels per layer.
  for(const l of [...layers].reverse()){
    const size=l.width*l.height, channels=[];
    for(const [cid,k]of [[-1,3],[0,0],[1,1],[2,2]]){
      const planar=Buffer.alloc(size);for(let i=0;i<size;i++)planar[i]=l.raw[i*4+k];
      const bytes=Buffer.concat([u16(0),planar]);channels.push(Buffer.concat([s16(cid),u32(bytes.length)]));channelData.push(bytes);
    }
    const extra=Buffer.concat([u32(0),u32(0),pascal(l.id),block('luni',unicode(l.label+' ['+l.id+']'))]);
    records.push(Buffer.concat([s32(l.y),s32(l.x),s32(l.y+l.height),s32(l.x+l.width),u16(4),...channels,Buffer.from('8BIMnorm'),Buffer.from([255,0,l.visible?0:2,0]),u32(extra.length),extra]));
  }
  let info=Buffer.concat([s16(-layers.length),...records,...channelData]);if(info.length%2)info=Buffer.concat([info,Buffer.alloc(1)]);
  const mask=Buffer.concat([u32(info.length),info,u32(0)]);
  const comp=await sharp(merged).ensureAlpha().raw().toBuffer(),planes=[];
  for(let k=0;k<4;k++){const b=Buffer.alloc(W*H);for(let i=0;i<W*H;i++)b[i]=comp[i*4+k];planes.push(b);}
  const header=Buffer.concat([Buffer.from('8BPS'),u16(1),Buffer.alloc(6),u16(4),u32(H),u32(W),u16(8),u16(3)]);
  fs.writeFileSync(path.join(root,'hinata_raincoat_material_separation.psd'),Buffer.concat([header,u32(0),u32(0),u32(mask.length),mask,u16(0),...planes]));
  const manifest={version:1,width:W,height:H,status:'material-separation-review',leftRight:'screen coordinates',source:'reference-approved.png',layers:layers.map(({raw,...l})=>l),notes:['图层素材由 imagegen 按批准形象分拆并补画，叠合坐标在拆层阶段重新对齐。','PSD 为 RGB / 8bit，图层唯一命名、普通混合，无蒙版依赖。','闭眼、闭嘴和遮挡补全部件默认隐藏。','当前未绑定 ArtMesh、变形器、参数或物理；尚非可运行的 .moc3 模型。','大角度转头和张手等复杂动作可能需要确认后补充侧面或手型。']};
  fs.writeFileSync(path.join(root,'layers.json'),JSON.stringify(manifest,null,2));
  await buildPreview(layers);
  console.log(JSON.stringify({layers:layers.length,visible:layers.filter(l=>l.visible).length,psd:path.join(root,'hinata_raincoat_material_separation.psd'),preview:path.join(root,'layer-preview.png')},null,2));
}
async function buildPreview(layers){
  const cols=6,cw=230,ch=235,rows=Math.ceil(layers.length/cols),outW=cols*cw,outH=rows*ch+80;
  const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
  let svg=`<svg width="${outW}" height="${outH}"><rect width="100%" height="100%" fill="#f7f2e9"/><text x="24" y="34" font-family="Microsoft YaHei" font-size="23" fill="#432b1f">雨衣日向 · Live2D 拆层素材预览</text><text x="24" y="61" font-family="Microsoft YaHei" font-size="15" fill="#806652">${layers.length} 个独立图层 / 按屏幕左右命名 / 先审素材，尚未绑定</text>`;
  const comps=[];
  for(let i=0;i<layers.length;i++){
    const l=layers[i],x=(i%cols)*cw,y=80+Math.floor(i/cols)*ch;
    svg+=`<rect x="${x+6}" y="${y+4}" width="${cw-12}" height="${ch-8}" rx="10" fill="white" stroke="#e3d4bc"/><text x="${x+16}" y="${y+ch-35}" font-family="Microsoft YaHei" font-size="14" fill="#503428">${esc(l.label)}</text><text x="${x+16}" y="${y+ch-16}" font-family="sans-serif" font-size="11" fill="#9b8066">${l.id}${l.visible?'':' / hidden'}</text>`;
    const b=await sharp(l.raw,{raw:{width:l.width,height:l.height,channels:4}}).resize(cw-32,ch-70,{fit:'inside'}).png().toBuffer();
    const m=await sharp(b).metadata();comps.push({input:b,left:x+Math.round((cw-m.width)/2),top:y+15+Math.round((ch-75-m.height)/2)});
  }
  svg+='</svg>';
  await sharp(Buffer.from(svg)).composite(comps).png().toFile(path.join(root,'layer-preview.png'));
}
main().catch(e=>{console.error(e);process.exit(1)});
