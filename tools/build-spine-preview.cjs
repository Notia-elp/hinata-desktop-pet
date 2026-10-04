const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source = path.resolve(__dirname, '../output/hinata-live2d-v2');
const out = path.resolve(__dirname, '../output/hinata-spine-preview');
const model = JSON.parse(fs.readFileSync(path.join(source, 'layers.json')));
const W = model.width, H = model.height, step = 128;
const bones = [
  {name:'root'}, {name:'motion',parent:'root'},
  {name:'body',parent:'motion',x:48,y:420,length:220},
  {name:'chest',parent:'body',x:10,y:285,length:190},
  {name:'head',parent:'chest',x:-18,y:180,length:410},
  {name:'hair',parent:'head',x:-5,y:350,length:180},
  {name:'sleeve_L',parent:'chest',x:-135,y:-30,length:180},
  {name:'sleeve_R',parent:'chest',x:215,y:-30,length:190},
  {name:'boot_L',parent:'motion',x:-115,y:160,length:150},
  {name:'boot_R',parent:'motion',x:220,y:155,length:150}
];
const bind = [];
for (const b of bones) {const p = b.parent ? bind[bones.findIndex(q=>q.name===b.parent)] : {x:0,y:0}; bind.push({x:p.x+(b.x||0),y:p.y+(b.y||0)});}
const clamp = x=>Math.max(0,Math.min(1,x));
const smooth = x=>{x=clamp(x);return x*x*(3-2*x);};
const round = x=>Math.round(x*1e6)/1e6;
function weights(x,y) {
  // Spatial weights depend on the original position, never the part label.
  // Clipped vertices interpolate the SAME global triangle's weighted bind
  // positions. This makes adjacent masks a continuous piecewise-affine surface.
  const low=smooth((y-1140)/250), high=1-smooth((y-570)/210);
  const mid=1-low-high, crown=high*(1-smooth((y-120)/210))*.62;
  const armY=smooth((y-710)/120)*(1-smooth((y-1020)/160));
  const left=mid*armY*(1-smooth((x-420)/130))*.48;
  const right=mid*armY*smooth((x-640)/160)*.48;
  const chestMix=1-smooth((y-780)/260);
  const bodyMid=mid-left-right;
  const lr=smooth((x-500)/140);
  return [0, low*.12, bodyMid*(1-chestMix), bodyMid*chestMix,
    high-crown, crown, left, right, low*.88*(1-lr), low*.88*lr];
}
function gv(x,y){const ws=weights(x,y), px=x-W/2, py=H-y;return {x,y,ws,locals:ws.map((w,i)=>[px-bind[i].x,py-bind[i].y])};}
const lattice=[];
for(let y=0;y<H;y+=step) for(let x=0;x<W;x+=step){
  const a=gv(x,y),b=gv(x+step,y),c=gv(x+step,y+step),d=gv(x,y+step);
  lattice.push([a,b,c],[a,c,d]);
}
function clip(poly, axis, limit, sign){
  const result=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],av=sign*(a[axis]-limit),bv=sign*(b[axis]-limit);
    if(av>=-1e-8)result.push(a);
    if((av>=0)!==(bv>=0)){const t=av/(av-bv);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
  }
  return result;
}
function bary(p,tri){const [a,b,c]=tri,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
  const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;return [u,v,1-u-v];}
function mesh(layer){
  const points=[],triangles=[],lookup=new Map(), x0=layer.x,y0=layer.y,x1=x0+layer.width,y1=y0+layer.height;
  function vertex(p,base){
    const key=round(p.x)+','+round(p.y);if(lookup.has(key))return lookup.get(key);
    const bc=bary(p,base),vs=[];
    for(let bone=1;bone<bones.length;bone++){
      let weight=0,px=0,py=0;
      base.forEach((v,i)=>{const a=bc[i]*v.ws[bone];weight+=a;px+=a*v.locals[bone][0];py+=a*v.locals[bone][1];});
      if(weight>1e-8)vs.push([bone,round(px/weight),round(py/weight),weight]);
    }
    const sum=vs.reduce((s,v)=>s+v[3],0);vs.forEach(v=>v[3]=v[3]/sum);
    const i=points.length;points.push({x:p.x,y:p.y,vs});lookup.set(key,i);return i;
  }
  for(const base of lattice){
    let poly=base.map(({x,y})=>({x,y}));
    for(const [axis,limit,sign] of [['x',x0,1],['x',x1,-1],['y',y0,1],['y',y1,-1]])poly=clip(poly,axis,limit,sign);
    if(poly.length<3)continue;
    const ids=poly.map(p=>vertex(p,base));
    for(let i=1;i<ids.length-1;i++){
      const [a,b,c]=[points[ids[0]],points[ids[i]],points[ids[i+1]]];
      const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if(Math.abs(area)>1e-5)triangles.push(ids[0],ids[i],ids[i+1]);
    }
  }
  function perimeter(p){if(Math.abs(p.y-y0)<1e-5)return p.x-x0;
    if(Math.abs(p.x-x1)<1e-5)return layer.width+p.y-y0;
    if(Math.abs(p.y-y1)<1e-5)return layer.width+layer.height+x1-p.x;
    if(Math.abs(p.x-x0)<1e-5)return 2*layer.width+layer.height+y1-p.y;return null;}
  const boundary=points.map((p,i)=>({i,t:perimeter(p)})).filter(p=>p.t!==null).sort((a,b)=>a.t-b.t).map(p=>p.i);
  const order=[...boundary,...points.map((_,i)=>i).filter(i=>!boundary.includes(i))],remap=new Map(order.map((i,j)=>[i,j]));
  const vertices=[],uvs=[];order.forEach(i=>{const p=points[i];uvs.push(round((p.x-x0)/layer.width),round((p.y-y0)/layer.height));vertices.push(p.vs.length,...p.vs.flat());});
  const edges=[];for(let i=0;i<boundary.length;i++)edges.push(i*2,((i+1)%boundary.length)*2);
  return {type:'mesh',path:layer.id,uvs,triangles:triangles.map(i=>remap.get(i)),vertices,hull:boundary.length,edges,width:layer.width,height:layer.height};
}
const identity=()=>Object.fromEntries(bones.slice(1).map(b=>[b.name,{x:0,y:0,r:0,sx:1,sy:1}]));
function jump(t,start,end,height){if(t<start||t>end)return 0;const u=(t-start)/(end-start);return 4*height*u*(1-u);}
function pulse(t,center,width){return Math.exp(-Math.pow((t-center)/width,2));}
function pose(name,t,duration){
  if(t>=duration-1e-6)t=0; // exactly closed loops
  const p=identity(),phase=2*Math.PI*t/duration;
  if(name==='idle'){
    const breath=(1-Math.cos(phase))/2;
    p.body.sy=1+.007*breath;p.chest.sx=1+.014*breath;p.chest.sy=1+.011*breath;
    p.head.r=.95*Math.sin(phase);p.head.y=4*breath;p.hair.r=1.1*Math.sin(phase);
    p.sleeve_L.r=.8*Math.sin(phase);p.sleeve_R.r=-.65*Math.sin(phase);
  }else if(name==='hop'){
    const y=jump(t,.38,1.13,250),prep=pulse(t,.27,.14),landing=pulse(t,1.16,.09),stretch=pulse(t,.48,.09);
    p.motion.y=y;p.motion.sx=1+.048*prep+.036*landing-.025*stretch;
    p.motion.sy=1-.09*prep-.065*landing+.04*stretch;
    p.head.r=1.8*Math.sin(phase);p.head.y=-9*prep+7*landing;
    p.hair.r=-4*pulse(t,.42,.15)+3.5*pulse(t,1.22,.14);
    p.sleeve_L.r=-3.4*pulse(t,.82,.3);p.sleeve_R.r=3.4*pulse(t,.82,.3);
    p.boot_L.r=-2.8*pulse(t,.82,.23);p.boot_R.r=2.8*pulse(t,.82,.23);
  }else{
    const a=jump(t,.28,.97,290),b=jump(t,1.23,1.99,340);
    const prep=pulse(t,.19,.105)+pulse(t,1.13,.105),land=pulse(t,1,.07)+pulse(t,2.02,.075);
    const air=(a+b)/340,wiggle=Math.sin(2*phase);
    p.motion.y=a+b;p.motion.x=36*wiggle;
    p.motion.sx=1+.035*prep+.04*land-.018*air;p.motion.sy=1-.075*prep-.07*land+.035*air;
    p.body.r=1.9*wiggle;p.head.r=-2.8*wiggle;p.head.y=-7*prep+8*land;
    p.hair.r=3.8*Math.sin(4*phase);p.sleeve_L.r=-5*air;p.sleeve_R.r=5*air;
    p.boot_L.r=-5*air;p.boot_R.r=5*air;p.boot_L.y=10*air;p.boot_R.y=10*air;
  }
  const gate=smooth(t/.12)*smooth((duration-t)/.12);
  for(const v of Object.values(p)){v.x*=gate;v.y*=gate;v.r*=gate;v.sx=1+(v.sx-1)*gate;v.sy=1+(v.sy-1)*gate;}
  return p;
}
const definitions=[{id:'idle',label:'待机呼吸',duration:3.2,description:'轻轻呼吸，歪头晃动，发梢和袖口跟随。'},
  {id:'hop',label:'轻轻蹦跳',duration:2.4,description:'蓄力蹲一下，向上蹦起，落地回弹。'},
  {id:'happy_bounce',label:'开心连跳',duration:2.4,description:'一轻一高连续跳，左右摇摆，雨靴和发梢跟随。'}];
function animation(def){const anim={bones:{}};
  for(const bone of bones.slice(1))anim.bones[bone.name]={rotate:[],translate:[],scale:[]};
  for(let i=0;i<=Math.round(def.duration*60);i++){
    const t=i/60,p=pose(def.id,t,def.duration);
    for(const [bone,v]of Object.entries(p)){const a=anim.bones[bone];a.rotate.push({time:round(t),value:round(v.r)});a.translate.push({time:round(t),x:round(v.x),y:round(v.y)});a.scale.push({time:round(t),x:round(v.sx),y:round(v.sy)});}
  }
  if(def.id!=='idle')anim.events=(def.id==='hop'?[1.13]:[.97,1.99]).map(time=>({time,name:'land'}));
  return anim;
}
async function main(){
  fs.mkdirSync(path.join(out,'images'),{recursive:true});
  fs.mkdirSync(path.join(out,'original-layers'),{recursive:true});
  const approved=await sharp(path.join(source,'reference-approved.png')).ensureAlpha().raw().toBuffer();
  const originalLayers=model.layers;
  const prepared=[];let copiedSeamPixels=0;
  for(const original of originalLayers){
    fs.copyFileSync(path.join(source,original.file),path.join(out,'original-layers',original.id+'.png'));
    const l={...original,x:Math.max(0,original.x-4),y:Math.max(0,original.y-4)};
    l.width=Math.min(W,original.x+original.width+4)-l.x;l.height=Math.min(H,original.y+original.height+4)-l.y;
    const raw=Buffer.alloc(l.width*l.height*4),old=await sharp(path.join(source,original.file)).ensureAlpha().raw().toBuffer();
    const distance=new Int16Array(l.width*l.height).fill(-1),queue=new Int32Array(distance.length);let start=0,end=0;
    for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++){
      const src=(y*original.width+x)*4,i=(y+original.y-l.y)*l.width+x+original.x-l.x;old.copy(raw,i*4,src,src+4);
      if(old[src+3]>0){distance[i]=0;queue[end++]=i;}
    }
    while(start<end){const i=queue[start++],d=distance[i];if(d>=4)continue;
      const x=i%l.width,y=Math.floor(i/l.width);
      for(const j of [x?i-1:-1,x+1<l.width?i+1:-1,y?i-l.width:-1,y+1<l.height?i+l.width:-1]){
        if(j<0||distance[j]>=0)continue;distance[j]=d+1;queue[end++]=j;
      }
    }
    // Sampling support only: copy neighboring APPROVED pixels into internal
    // transparent cut seams. This is 4px texture extrusion, not painted fills.
    // Exterior partially-transparent silhouette pixels are never extended.
    for(let i=0;i<distance.length;i++)if(distance[i]>0&&raw[i*4+3]===0){const global=((l.y+Math.floor(i/l.width))*W+l.x+i%l.width)*4;
      if(approved[global+3]>=240){approved.copy(raw,i*4,global,global+4);copiedSeamPixels++;}}
    await sharp(raw,{raw:{width:l.width,height:l.height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));prepared.push(l);
  }
  model.layers=prepared;
  fs.writeFileSync(path.join(out,'rig-layers.json'),JSON.stringify(prepared,null,2));
  const attachments={};for(const l of model.layers)attachments[l.id]={[l.id]:mesh(l)};
  const json={skeleton:{hash:'original-pixel-rig',spine:'4.2.00',x:-512,y:0,width:1024,height:1536,images:'./images/',fps:60},bones,
    slots:model.layers.map(l=>({name:l.id,bone:'motion',attachment:l.id})),skins:[{name:'default',attachments}],
    events:{land:{}},animations:Object.fromEntries(definitions.map(d=>[d.id,animation(d)]))};
  fs.writeFileSync(path.join(out,'hinata-raincoat.json'),JSON.stringify(json));
  // Unrotated shelf packing; the images are copied at their original resolution.
  const pages=[];let page={items:[],x:3,y:3,row:0};pages.push(page);
  for(const l of [...model.layers].sort((a,b)=>b.height-a.height)){
    if(page.x+l.width+3>2048){page.x=3;page.y+=page.row;page.row=0;}
    if(page.y+l.height+3>2048){page={items:[],x:3,y:3,row:0};pages.push(page);}
    page.items.push({l,x:page.x,y:page.y});page.x+=l.width+6;page.row=Math.max(page.row,l.height+6);
  }
  const texts=[],textures={};
  for(let i=0;i<pages.length;i++){
    const p=pages[i],name='hinata-atlas-'+(i+1)+'.png';
    const height=2**Math.ceil(Math.log2(p.y+p.row+3));
    await sharp({create:{width:2048,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
      .composite(p.items.map(({l,x,y})=>({input:path.join(out,'images',l.id+'.png'),left:x,top:y}))).png().toFile(path.join(out,name));
    textures[name]='data:image/png;base64,'+fs.readFileSync(path.join(out,name)).toString('base64');
    texts.push(name+'\nsize: 2048,'+height+'\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\npma: false\n'+
      p.items.map(({l,x,y})=>l.id+'\n  bounds: '+[x,y,l.width,l.height].join(',')+'\n  offsets: 0,0,'+l.width+','+l.height+'\n  rotate: false\n  index: -1').join('\n'));
  }
  const atlas=texts.join('\n\n')+'\n';fs.writeFileSync(path.join(out,'hinata-raincoat.atlas'),atlas);
  fs.writeFileSync(path.join(out,'preview-data.js'),'window.PET_DATA='+JSON.stringify({skeleton:json,atlas,textures,layers:prepared,animations:definitions})+';');
  const sha = file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const provenance={source:'../hinata-live2d-v2',layerCount:model.layers.length,boneCount:bones.length,pageCount:pages.length,
    originalLayerFilesUnchanged:originalLayers.every(l=>sha(path.join(source,l.file))===sha(path.join(out,'original-layers',l.id+'.png'))),
    samplingSupport:{pixels:4,source:'Neighboring approved-image pixels only; no new drawing.',copiedSeamPixels},
    sourceImageSHA256:sha(path.join(source,'reference-approved.png')),runtime:'Official @esotericsoftware/spine-webgl 4.2 branch',runtimeSHA256:sha(path.join(out,'runtime/spine-webgl.js')),
    rig:'Shared triangulation with barycentrically interpolated weighted bind positions; visible pieces remain joined.',
    limitations:['遮挡补全未完成；保持原姿势做连续网格变形，未制作独立转身、挥手或眨眼。','未在 Spine 编辑器中执行导入；本包是 JSON/atlas/PNG，不含原生 .spine 文件。'],animations:definitions};
  fs.writeFileSync(path.join(out,'asset-provenance.json'),JSON.stringify(provenance,null,2));
  const officialSource=fs.readFileSync(path.join(__dirname,'SpineTextureAtlas-reference.ts'),'utf8');
  const license=officialSource.match(/\/\*[\s\S]*?\*\//)[0];
  fs.writeFileSync(path.join(out,'runtime/LICENSE.txt'),license+'\n\nSource: https://github.com/EsotericSoftware/spine-runtimes/tree/4.2/spine-ts\n');
  console.log(JSON.stringify({layers:model.layers.length,bones:bones.length,atlasPages:pages.length,meshVertices:Object.values(attachments).reduce((s,a)=>s+Object.values(a)[0].uvs.length/2,0),animations:definitions.map(d=>d.id)}));
}
main().catch(e=>{console.error(e);process.exit(1);});
