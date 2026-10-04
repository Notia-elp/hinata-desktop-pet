const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source = path.resolve(__dirname, '../output/hinata-live2d-v2');
const out = path.resolve(__dirname, '../output/hinata-spine-joints-v2');
const model = JSON.parse(fs.readFileSync(path.join(source, 'layers.json')));
const W = model.width, H = model.height, step = 32;
const bones = [
  {name:'root'}, {name:'motion',parent:'root'},
  {name:'body',parent:'motion',x:48,y:420},
  {name:'chest',parent:'body',x:10,y:285},
  {name:'head',parent:'chest',x:-18,y:180},
  {name:'hair',parent:'head',x:-5,y:350}
];
const rad=Math.PI/180, deg=180/Math.PI;
const chains={};
const point=(x,y)=>({x:x-W/2,y:H-y});
function addChain(name,parent,A,B,C,sign,kind){
  const a=point(...A),b=point(...B),c=point(...C);
  const origin=parent==='body'?{x:48,y:420}:{x:58,y:705};
  const theta1=Math.atan2(b.y-a.y,b.x-a.x)*deg,theta2=Math.atan2(c.y-b.y,c.x-b.x)*deg;
  const len1=Math.hypot(b.x-a.x,b.y-a.y),len2=Math.hypot(c.x-b.x,c.y-b.y);
  const names=kind==='arm'?['upper_arm_'+name,'forearm_'+name,'hand_'+name]:['thigh_'+name,'shin_'+name,'foot_'+name];
  bones.push({name:names[0],parent,x:a.x-origin.x,y:a.y-origin.y,rotation:theta1,length:len1});
  bones.push({name:names[1],parent:names[0],x:len1,rotation:theta2-theta1,length:len2});
  bones.push({name:names[2],parent:names[1],x:len2,rotation:(kind==='leg'?180:theta2)-theta2,length:kind==='leg'?85:36});
  const helper=(kind==='leg'?'knee_':'elbow_')+name;
  bones.push({name:helper,parent:names[0],x:len1,rotation:(theta2-theta1)/2,length:25});
  chains[kind+'_'+name]={A,B,C,a,b,c,theta1,theta2,len1,len2,sign,names,helper};
}
addChain('L','chest',[455,778],[368,900],[375,1015],1,'arm');
addChain('R','chest',[705,755],[785,945],[757,1091],-1,'arm');
addChain('L','body',[460,1154],[435,1243],[386,1428],1,'leg');
addChain('R','body',[667,1186],[706,1285],[735,1440],-1,'leg');
const bind=[];
for(const b of bones){const p=b.parent?bind[bones.findIndex(q=>q.name===b.parent)]:{x:0,y:0,r:0};
  const cos=Math.cos(p.r*rad),sin=Math.sin(p.r*rad);bind.push({x:p.x+(b.x||0)*cos-(b.y||0)*sin,y:p.y+(b.x||0)*sin+(b.y||0)*cos,r:p.r+(b.rotation||0)});}
const clamp = x=>Math.max(0,Math.min(1,x));
const smooth = x=>{x=clamp(x);return x*x*(3-2*x);};
const round = x=>Math.round(x*1e6)/1e6;
function family(id){
  for(const side of ['L','R']){if(['sleeve_'+side,'hand_'+side].includes(id))return 'arm_'+side;
    if(['leg_'+side,'boot_'+side,'hip_fill_'+side].includes(id))return 'leg_'+side;}
  if(id==='edge_residual')return 'edges';
  return 'body';
}
function weights(x,y,group){
  if(group==='edges')group=y>1200?(x<570?'leg_L':'leg_R'):y>800&&y<1100&&x<445?'arm_L':y>790&&y<1130&&x>740?'arm_R':'body';
  const w=new Array(bones.length).fill(0),set=(name,v)=>w[bones.findIndex(b=>b.name===name)]=v;
  if(group!=='body'){
    const c=chains[group],zone=group.startsWith('arm')?50:60;
    const upper=1-smooth((y-c.B[1]+zone)/zone),lower=smooth((y-c.B[1])/zone);
    const tip=smooth((y-c.C[1]+(group.startsWith('arm')?12:30))/(group.startsWith('arm')?34:65));
    const attach=group.startsWith('arm')?smooth((y-c.A[1]+35)/70):1;
    set(c.names[0],upper*attach);set(c.helper,Math.max(0,1-upper-lower)*attach);set(c.names[1],Math.max(0,lower-tip)*attach);set(c.names[2],tip*attach);if(attach<1)set('chest',1-attach);
  }else{
    const head=1-smooth((y-580)/180),hair=head*(1-smooth((y-180)/170))*.7;
    const chest=(1-head)*(1-smooth((y-780)/230));
    set('body',1-head-chest);set('chest',chest);set('head',head-hair);set('hair',hair);
  }
  const sum=w.reduce((a,b)=>a+b,0);return w.map(v=>v/sum);
}
function gv(x,y,group){const ws=weights(x,y,group),px=x-W/2,py=H-y;return {x,y,ws,locals:ws.map((w,i)=>{const cos=Math.cos(bind[i].r*rad),sin=Math.sin(bind[i].r*rad);return [(px-bind[i].x)*cos+(py-bind[i].y)*sin,-(px-bind[i].x)*sin+(py-bind[i].y)*cos];})};}
const lattices=new Map();
for(const group of ['body','edges',...Object.keys(chains)]){const list=[],gridStep=group==='body'?64:step;
  for(let y=0;y<H;y+=gridStep)for(let x=0;x<W;x+=gridStep){const a=gv(x,y,group),b=gv(x+gridStep,y,group),c=gv(x+gridStep,y+gridStep,group),d=gv(x,y+gridStep,group);list.push([a,b,c],[a,c,d]);}
  lattices.set(group,list);
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
  for(const base of lattices.get(family(layer.id))){
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
function track(keys,t){
  const n=keys.length;if(t<=keys[0][0])return keys[0][1];if(t>=keys[n-1][0])return keys[n-1][1];
  const slope=i=>(keys[i+1][1]-keys[i][1])/(keys[i+1][0]-keys[i][0]);
  const velocity=i=>{if(i===0||i===n-1)return 0;const a=slope(i-1),b=slope(i);return a*b<=0?0:2*a*b/(a+b);};
  let i=0;while(keys[i+1][0]<t)i++;
  const h=keys[i+1][0]-keys[i][0],u=(t-keys[i][0])/h;
  return (2*u**3-3*u*u+1)*keys[i][1]+(u**3-2*u*u+u)*h*velocity(i)+(-2*u**3+3*u*u)*keys[i+1][1]+(u**3-u*u)*h*velocity(i+1);
}
function solveLeg(p,side,tuck,spread,flight,flex){
  const c=chains['leg_'+side];
  // Grounded targets stay in world space while the body crouches. In flight
  // the ankle moves with the body and folds towards the hip. Bake two-bone IK
  // into editable FK rotation keys, retaining actual thigh/shin/foot chains.
  const tx=c.c.x+(flight?spread:-p.motion.x),ty=c.c.y+(flight?tuck:-p.motion.y);
  const dx=tx-c.a.x,dy=ty-c.a.y,d=Math.max(Math.abs(c.len1-c.len2)+.0001,Math.min(c.len1+c.len2-.0001,Math.hypot(dx,dy)));
  const phi=Math.acos(Math.max(-1,Math.min(1,(d*d-c.len1*c.len1-c.len2*c.len2)/(2*c.len1*c.len2))))*c.sign;
  const theta=Math.atan2(dy,dx)-Math.atan2(c.len2*Math.sin(phi),c.len1+c.len2*Math.cos(phi));
  p[c.names[0]].r=theta*deg-c.theta1;
  p[c.names[1]].r=phi*deg-(c.theta2-c.theta1);
  p[c.helper].r=p[c.names[1]].r/2;
  p[c.names[2]].r=flex-(theta*deg+phi*deg-c.theta2);
}
function pose(name,t,duration){
  if(t>=duration-1e-6)t=0; // exactly closed loops
  const p=identity(),phase=2*Math.PI*t/duration;
  if(name==='idle'){
    const breath=(1-Math.cos(phase))/2;
    p.chest.sx=1+.014*breath;p.chest.sy=1+.011*breath;
    p.head.r=.95*Math.sin(phase);p.head.y=4*breath;p.hair.r=1.1*Math.sin(phase);
    p.upper_arm_L.r=-1.7*Math.sin(phase);p.forearm_L.r=3.5*breath;p.hand_L.r=-2*breath;
    p.upper_arm_R.r=1.5*Math.sin(phase);p.forearm_R.r=-3*breath;p.hand_R.r=2*breath;
    p.elbow_L.r=p.forearm_L.r/2;p.elbow_R.r=p.forearm_R.r/2;
  }else{
    const happy=name==='happy_bounce';
    p.motion.y=track(happy?[[0,0],[.1,0],[.2,-45],[.31,0],[.63,240],[.97,0],[1.08,-52],[1.21,0],[1.58,300],[1.96,0],[2.08,-52],[2.4,0]]:
      [[0,0],[.12,0],[.34,-52],[.48,0],[.82,260],[1.16,0],[1.28,-48],[1.65,0],[2.4,0]],t);
    p.motion.x=happy?track([[0,0],[.31,0],[.63,-24],[.97,0],[1.21,0],[1.58,28],[1.96,0],[2.4,0]],t):0;
    const tuck=track(happy?[[0,0],[.31,0],[.58,65],[.73,70],[.97,0],[1.21,0],[1.53,75],[1.69,80],[1.96,0],[2.4,0]]:
      [[0,0],[.48,0],[.73,48],[.9,60],[1.06,25],[1.16,0],[2.4,0]],t);
    const lift=track(happy?[[0,0],[.2,.25],[.31,.12],[.57,1],[.74,1],[.97,.18],[1.08,.35],[1.21,.12],[1.54,1.05],[1.74,.92],[1.96,.25],[2.08,.4],[2.4,0]]:
      [[0,0],[.12,0],[.34,.25],[.48,.12],[.73,1],[.9,.95],[1.16,.2],[1.28,.4],[1.7,0],[2.4,0]],t);
    const flight=happy?(t>.31&&t<.97)||(t>1.21&&t<1.96):t>.48&&t<1.16;
    p.upper_arm_L.r=-42*lift;p.forearm_L.r=70*lift;p.hand_L.r=-13*lift;
    p.upper_arm_R.r=39*lift;p.forearm_R.r=-66*lift;p.hand_R.r=11*lift;
    p.elbow_L.r=p.forearm_L.r/2;p.elbow_R.r=p.forearm_R.r/2;
    const air=tuck/(happy?80:60);
    solveLeg(p,'L',tuck,50*air,flight,-10*air);
    solveLeg(p,'R',tuck*.87,-45*air,flight,12*air);
    p.head.r=(happy?-2.8:1.4)*Math.sin(phase);p.head.y=3*lift;
    p.hair.r=-4.5*lift+3*Math.sin(phase*2)*lift;
  }
  const gate=smooth(t/.12)*smooth((duration-t)/.12);
  for(const v of Object.values(p)){v.x*=gate;v.y*=gate;v.r*=gate;v.sx=1+(v.sx-1)*gate;v.sy=1+(v.sy-1)*gate;}
  return p;
}
const definitions=[{id:'idle',label:'待机呼吸',duration:3.2,description:'轻轻呼吸，肘部轻弯，手腕和发梢微动。'},
  {id:'hop',label:'屈膝蹦跳',duration:2.4,description:'屈膝蓄力 → 摆臂起跳 → 收腿 → 脚底着地缓冲。'},
  {id:'happy_bounce',label:'开心连跳',duration:2.4,description:'连续蹦跳，双肘抬起弯曲，膝盖收拢，雨靴翻动。'}];
function animation(def){const anim={bones:{}};
  for(const bone of bones.slice(1))anim.bones[bone.name]={rotate:[],translate:[],scale:[]};
  for(let i=0;i<=Math.round(def.duration*60);i++){
    const t=i/60,p=pose(def.id,t,def.duration);
    for(const [bone,v]of Object.entries(p)){const a=anim.bones[bone];a.rotate.push({time:round(t),value:round(v.r)});a.translate.push({time:round(t),x:round(v.x),y:round(v.y)});a.scale.push({time:round(t),x:round(v.sx),y:round(v.sy)});}
  }
  if(def.id!=='idle')anim.events=(def.id==='hop'?[1.16]:[.97,1.96]).map(time=>({time,name:'land'}));
  return anim;
}
async function main(){
  fs.mkdirSync(path.join(out,'images'),{recursive:true});
  fs.mkdirSync(path.join(out,'original-layers'),{recursive:true});
  const approved=await sharp(path.join(source,'reference-approved.png')).ensureAlpha().raw().toBuffer();
  const originalLayers=model.layers;
  const newCaps=await sharp(path.join(out,'leg-caps-generated.png')).ensureAlpha().raw().toBuffer();
  const familyCode={'body':0,'edges':0,'arm_L':1,'arm_R':2,'leg_L':3,'leg_R':4},ownership=new Uint8Array(W*H);
  const owners=new Int16Array(W*H).fill(-1),rgbaFiles=new Map(),transfers=new Map();
  for(const [index,l]of originalLayers.entries()){const rgba=await sharp(path.join(source,l.file)).ensureAlpha().raw().toBuffer(),code=familyCode[family(l.id)];rgbaFiles.set(l.id,rgba);transfers.set(l.id,[]);
    for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++)if(rgba[(y*l.width+x)*4+3]>0){const g=(l.y+y)*W+l.x+x;ownership[g]=code;owners[g]=index;}}
  const initialOwners=owners.slice();let reassignedContourPixels=0;
  for(let y=710;y<H;y++)for(let x=0;x<W;x++){const g=y*W+x,index=initialOwners[g];if(index<0)continue;
    const l=originalLayers[index];if(family(l.id)!=='body'||l.id.startsWith('shorts'))continue;
    const [r,green,b]=approved.subarray(g*4,g*4+3);const brown=r<205&&green<175&&b<115&&r>green&&green>b;
    const exterior=[g-1,g+1,g-W,g+W].some(i=>i>=0&&i<W*H&&approved[i*4+3]<24);if(!brown&&!exterior)continue;
    let best=-1,bestDist=999;
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=dx*dx+dy*dy;if(d>16||d>=bestDist||x+dx<0||x+dx>=W||y+dy<0||y+dy>=H)continue;
      const j=initialOwners[(y+dy)*W+x+dx];if(j<0||!familyCode[family(originalLayers[j].id)])continue;best=j;bestDist=d;}
    if(best>=0){owners[g]=best;ownership[g]=familyCode[family(originalLayers[best].id)];transfers.get(originalLayers[best].id).push(g);reassignedContourPixels++;}
  }
  const prepared=[];let copiedSeamPixels=0;
  for(const original of originalLayers){
    fs.copyFileSync(path.join(source,original.file),path.join(out,'original-layers',original.id+'.png'));
    const l={...original,x:Math.max(0,original.x-4),y:Math.max(0,original.y-4)};
    l.width=Math.min(W,original.x+original.width+4)-l.x;l.height=Math.min(H,original.y+original.height+4)-l.y;
    const raw=Buffer.alloc(l.width*l.height*4),old=rgbaFiles.get(original.id),ownerIndex=originalLayers.indexOf(original);
    const distance=new Int16Array(l.width*l.height).fill(-1),queue=new Int32Array(distance.length);let start=0,end=0;
    for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++){
      const src=(y*original.width+x)*4,i=(y+original.y-l.y)*l.width+x+original.x-l.x;old.copy(raw,i*4,src,src+4);
      if(owners[(y+original.y)*W+x+original.x]!==ownerIndex)raw[i*4+3]=0;
      if(raw[i*4+3]>0){distance[i]=0;queue[end++]=i;}
    }
    for(const g of transfers.get(original.id)){const x=g%W-l.x,y=Math.floor(g/W)-l.y;if(x<0||y<0||x>=l.width||y>=l.height)throw Error('Contour transfer outside padded crop');const i=y*l.width+x;
      approved.copy(raw,i*4,g*4,g*4+4);if(distance[i]<0){distance[i]=0;queue[end++]=i;}}
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
      if(approved[global+3]>=240&&ownership[global/4]===familyCode[family(original.id)]){approved.copy(raw,i*4,global,global+4);copiedSeamPixels++;}}
    await sharp(raw,{raw:{width:l.width,height:l.height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));prepared.push(l);
  }
  const generated=await sharp(path.join(out,'coat-occlusion-generated.png')).ensureAlpha().raw().toBuffer();
  const armMask=new Uint8Array(W*H);
  for(const l of originalLayers.filter(l=>family(l.id).startsWith('arm'))){const pixels=await sharp(path.join(source,l.file)).ensureAlpha().raw().toBuffer();
    for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++)if(pixels[(y*l.width+x)*4+3]>0)armMask[(l.y+y)*W+l.x+x]=1;}
  const under={id:'coat_occlusion_underlay',label:'手臂后方雨衣补绘',x:260,y:680,width:650,height:510,visible:true};
  const patch=Buffer.alloc(under.width*under.height*4);let occlusionPixels=0;
  for(let y=0;y<under.height;y++)for(let x=0;x<under.width;x++){const global=(under.y+y)*W+under.x+x,i=(y*under.width+x)*4;
    if(armMask[global]&&generated[global*4+3]>0){generated.copy(patch,i,global*4,global*4+4);patch[i+3]=Math.min(patch[i+3],approved[global*4+3]);occlusionPixels++;}}
  await sharp(patch,{raw:{width:under.width,height:under.height,channels:4}}).png().toFile(path.join(out,'images',under.id+'.png'));
  // Pants and legs are behind the coat; arms and hands are in front.
  const caps=[];
  for(const [side,x,y,width,height] of [['L',380,1060,170,105],['R',595,1090,190,108]]){
    const l={id:'hip_fill_'+side,label:side+'腿根隐藏补绘',x,y,width,height,visible:true},raw=Buffer.alloc(width*height*4);
    for(let py=0;py<height;py++)for(let px=0;px<width;px++){const g=(y+py)*W+x+px,i=(py*width+px)*4;
      if(approved[g*4+3]>0&&newCaps[g*4+3]>0){newCaps.copy(raw,i,g*4,g*4+4);raw[i+3]=Math.min(raw[i+3],approved[g*4+3]);}}
    await sharp(raw,{raw:{width,height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));caps.push(l);
  }
  model.layers=[under,...caps,...prepared.filter(l=>family(l.id).startsWith('leg')||l.id.startsWith('shorts')),...prepared.filter(l=>family(l.id)==='body'&&!l.id.startsWith('shorts')),...prepared.filter(l=>family(l.id).startsWith('arm'))];
  fs.writeFileSync(path.join(out,'rig-layers.json'),JSON.stringify(model.layers,null,2));
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
  fs.writeFileSync(path.join(out,'preview-data.js'),'window.PET_DATA='+JSON.stringify({skeleton:json,atlas,textures,layers:model.layers,animations:definitions,chains})+';');
  const sha = file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const provenance={source:'../hinata-live2d-v2',layerCount:model.layers.length,boneCount:bones.length,pageCount:pages.length,
    originalLayerFilesUnchanged:originalLayers.every(l=>sha(path.join(source,l.file))===sha(path.join(out,'original-layers',l.id+'.png'))),
    samplingSupport:{pixels:4,source:'Neighboring approved-image pixels only; no new drawing.',copiedSeamPixels},
    boundaryRepair:{reassignedContourPixels,sourceRGBAUnchanged:true,removedFromRuntime:'597 isolated low-alpha edge particles, kept in original-layers/.'},
    sourceImageSHA256:sha(path.join(source,'reference-approved.png')),runtime:'Official @esotericsoftware/spine-webgl 4.2 branch',runtimeSHA256:sha(path.join(out,'runtime/spine-webgl.js')),
    occlusionUnderlay:{source:'coat-occlusion-generated.png',usedPixels:occlusionPixels,scope:'Only original arm/hand occluded areas; head and all original visible layers remain source art.'},
    rig:'Articulated upper-arm/forearm/hand and thigh/shin/foot chains. Two-bone leg IK baked to FK; planted ankles and counter-rotated feet. Weighted shared mesh within each limb family.',
    chains,
    limitations:['雨衣遮挡区域已局部补绘；未制作转身或眨眼。','未在 Spine 编辑器中执行导入；本包是 JSON/atlas/PNG，不含原生 .spine 文件。'],animations:definitions};
  fs.writeFileSync(path.join(out,'asset-provenance.json'),JSON.stringify(provenance,null,2));
  const officialSource=fs.readFileSync(path.join(__dirname,'SpineTextureAtlas-reference.ts'),'utf8');
  const license=officialSource.match(/\/\*[\s\S]*?\*\//)[0];
  fs.writeFileSync(path.join(out,'runtime/LICENSE.txt'),license+'\n\nSource: https://github.com/EsotericSoftware/spine-runtimes/tree/4.2/spine-ts\n');
  console.log(JSON.stringify({layers:model.layers.length,bones:bones.length,atlasPages:pages.length,meshVertices:Object.values(attachments).reduce((s,a)=>s+Object.values(a)[0].uvs.length/2,0),animations:definitions.map(d=>d.id)}));
}
main().catch(e=>{console.error(e);process.exit(1);});
