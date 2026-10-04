const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source = path.resolve(__dirname, '../output/hinata-live2d-v2');
const out = path.resolve(__dirname, '../output/hinata-spine-joints-v4');
const custom=JSON.parse(fs.readFileSync(path.join(out,'custom-layers.json')));
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
addChain('L','chest',[453,760],[380,920],[375,1000],1,'arm');
addChain('R','chest',[727,735],[780,945],[755,1072],-1,'arm');
// Knees belong to the exposed skin. The complete rubber boot is a rigid
// attachment on the cuff bone; no boot pixels are weighted to thigh/shin.
addChain('L','body',[470,1157],[429,1210],[434,1274],1,'leg');
addChain('R','body',[681,1187],[723,1237],[735,1290],-1,'leg');
const featureCenters={eye_L:[412,521],eye_R:[620,432],brow_L:[390,417],brow_R:[553,353],nose:[520,522],mouth:[555,580],cheek_L:[420,600],cheek_R:[684,528]};
for(const [name,coords]of Object.entries(featureCenters)){const a=point(...coords);bones.push({name,parent:'head',x:a.x-40,y:a.y-885,length:20});}
for(const [name,coords]of [['hair_L',[300,415]],['hair_R',[738,320]]]){const a=point(...coords);bones.push({name,parent:'head',x:a.x-40,y:a.y-885,length:60});}
const grabs={L:[404,1045],R:[719,1111]};
for(const side of ['L','R']){const c=chains['arm_'+side],a=point(...grabs[side]),dx=a.x-c.c.x,dy=a.y-c.c.y,cos=Math.cos(c.theta2*rad),sin=Math.sin(c.theta2*rad);
 bones.push({name:'hem_'+side,parent:'hand_'+side,x:dx*cos+dy*sin,y:-dx*sin+dy*cos,rotation:-c.theta2,length:24});}
for(const l of custom.filter(l=>l.group==='button')){const a=point(...l.center);bones.push({name:l.bone,parent:'motion',x:a.x,y:a.y,length:20});}
const bind=[];
for(const b of bones){const p=b.parent?bind[bones.findIndex(q=>q.name===b.parent)]:{x:0,y:0,r:0};
  const cos=Math.cos(p.r*rad),sin=Math.sin(p.r*rad);bind.push({x:p.x+(b.x||0)*cos-(b.y||0)*sin,y:p.y+(b.x||0)*sin+(b.y||0)*cos,r:p.r+(b.rotation||0)});}
const clamp = x=>Math.max(0,Math.min(1,x));
const smooth = x=>{x=clamp(x);return x*x*(3-2*x);};
const round = x=>Math.round(x*1e6)/1e6;
function family(id){
  if(id==='coat_surface'||id==='coat_occlusion_underlay')return 'cloth';
  const c=custom.find(l=>l.id===id);if(c){if(c.group==='fixed_body')return 'fixed_body';if(c.group==='feature'||c.group==='button')return 'feature_'+c.bone;if(c.group==='hair')return 'hair';if(c.group==='face')return 'face';if(c.group==='boot')return 'boot_'+id.slice(-1);}
  if(id==='arm_L')return 'arm_L';if(id==='arm_R')return 'arm_R';
  if(id==='boot_L')return 'boot_L';if(id==='boot_R')return 'boot_R';
  for(const side of ['L','R']){if(['sleeve_'+side,'hand_'+side].includes(id))return 'arm_'+side;
    if(['leg_'+side,'boot_'+side,'hip_fill_'+side].includes(id))return 'leg_'+side;}
  if(id==='edge_residual')return 'edges';
  return 'body';
}
function weights(x,y,group){
  if(group==='edges')group=y>1200?(x<570?'leg_L':'leg_R'):y>800&&y<1100&&x<445?'arm_L':y>790&&y<1130&&x>740?'arm_R':'body';
  const w=new Array(bones.length).fill(0),set=(name,v)=>w[bones.findIndex(b=>b.name===name)]=v;
  if(group.startsWith('feature_')){set(group.slice(8),1);}
  else if(group==='fixed_body'){set('body',1);}
  else if(group==='face'){set('head',1);}
  else if(group==='hair'){
    const crown=1-smooth((y-230)/180),left=smooth((410-x)/140)*(1-crown),right=smooth((x-620)/170)*(1-crown);
    set('hair',crown*.92+(1-crown)*.22);set('hair_L',left*.68);set('hair_R',right*.68);set('head',Math.max(0,1-w.reduce((a,b)=>a+b,0)));
  }
  else if(group.startsWith('boot_')){set('foot_'+group.slice(-1),1);}
  else if(group!=='body'&&group!=='cloth'){
    const arm=group.startsWith('arm'),c=chains[group],zone=arm?32:18;
    const upper=1-smooth((y-c.B[1]+zone)/(zone*2));
    const tip=smooth((y-c.C[1]+(arm?16:28))/(arm?24:20));
    const attach=arm?smooth((y-c.A[1]+55)/100):smooth((y-c.A[1]+12)/48);
    const helper=(1-tip)*Math.max(0,1-Math.abs(y-c.B[1])/zone)*.5;
    set(c.names[0],upper*(1-tip)*(1-helper)*attach);
    set(c.helper,helper*(1-tip)*attach);
    set(c.names[1],(1-upper)*(1-tip)*(1-helper)*attach);
    set(c.names[2],tip*attach);if(attach<1)set(arm?'chest':'body',1-attach);
  }else{
    const head=1-smooth((y-580)/180),hair=head*(1-smooth((y-180)/170))*.7;
    const chest=(1-head)*(1-smooth((y-780)/230));
    set('body',1-head-chest);set('chest',chest);set('head',head-hair);set('hair',hair);
    const cloth=smooth((y-880)/150);
    if(cloth&&group==='cloth'){const amounts=['L','R'].map(side=>{const [gx,gy]=grabs[side],d=Math.hypot((x-gx)/1.05,(y-gy)/1.25);return cloth*(1-smooth((d-35)/200));});
      const sum=amounts.reduce((a,b)=>a+b,0),limit=Math.min(1,sum);for(let i=0;i<w.length;i++)w[i]*=1-limit;
      if(sum){set('hem_L',limit*amounts[0]/sum);set('hem_R',limit*amounts[1]/sum);}
    }
  }
  const sum=w.reduce((a,b)=>a+b,0);return w.map(v=>v/sum);
}
function gv(x,y,group){const ws=weights(x,y,group),px=x-W/2,py=H-y;return {x,y,ws,locals:ws.map((w,i)=>{const cos=Math.cos(bind[i].r*rad),sin=Math.sin(bind[i].r*rad);return [(px-bind[i].x)*cos+(py-bind[i].y)*sin,-(px-bind[i].x)*sin+(py-bind[i].y)*cos];})};}
const lattices=new Map();
for(const group of ['body','cloth','edges','boot_L','boot_R','hair','face',...Object.keys(chains)]){const list=[],gridStep=['body','cloth','hair'].includes(group)?24:group.startsWith('leg')?16:step;
  const xs=[...new Set([...Array.from({length:Math.ceil(W/gridStep)+1},(_,i)=>Math.min(W,i*gridStep)),404,719])].sort((a,b)=>a-b);
  const ys=[...new Set([...Array.from({length:Math.ceil(H/gridStep)+1},(_,i)=>Math.min(H,i*gridStep)),1045,1111])].sort((a,b)=>a-b);
  for(let iy=0;iy<ys.length-1;iy++)for(let ix=0;ix<xs.length-1;ix++){const x=xs[ix],y=ys[iy],right=xs[ix+1],bottom=ys[iy+1],a=gv(x,y,group),b=gv(right,y,group),c=gv(right,bottom,group),d=gv(x,bottom,group);list.push([a,b,c],[a,c,d]);}
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
  let bases=lattices.get(family(layer.id));if(!bases){const a=gv(x0,y0,family(layer.id)),b=gv(x1,y0,family(layer.id)),c=gv(x1,y1,family(layer.id)),d=gv(x0,y1,family(layer.id));bases=[[a,b,c],[a,c,d]];}
  for(const base of bases){
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
    p.head.r=.95*Math.sin(phase);p.head.y=4*breath;p.hair.r=3.8*Math.sin(phase-.35)*Math.sin(phase/2);
    p.hair_L.r=3*Math.sin(phase-.65);p.hair_R.r=-3.5*Math.sin(phase-.8);
    p.upper_arm_L.r=-1.7*Math.sin(phase);p.forearm_L.r=3.5*breath;p.hand_L.r=-2*breath;
    p.upper_arm_R.r=1.5*Math.sin(phase);p.forearm_R.r=-3*breath;p.hand_R.r=2*breath;
    p.elbow_L.r=p.forearm_L.r/2;p.elbow_R.r=p.forearm_R.r/2;
  }else{
    const happy=name==='happy_bounce';
    p.motion.y=track(happy?[[0,0],[.1,0],[.2,-20],[.31,0],[.63,240],[.97,0],[1.08,-23],[1.21,0],[1.58,280],[1.96,0],[2.08,-21],[2.4,0]]:
      [[0,0],[.12,0],[.34,-23],[.48,0],[.82,240],[1.16,0],[1.28,-24],[1.65,0],[2.4,0]],t);
    p.motion.x=happy?track([[0,0],[.31,0],[.63,-24],[.97,0],[1.21,0],[1.58,28],[1.96,0],[2.4,0]],t):0;
    const tuck=track(happy?[[0,0],[.31,0],[.58,20],[.73,22],[.97,0],[1.21,0],[1.53,24],[1.69,26],[1.96,0],[2.4,0]]:
      [[0,0],[.48,0],[.73,18],[.9,22],[1.06,10],[1.16,0],[2.4,0]],t);
    const lift=track(happy?[[0,0],[.2,.25],[.31,.12],[.57,1],[.74,1],[.97,.18],[1.08,.35],[1.21,.12],[1.54,1.05],[1.74,.92],[1.96,.25],[2.08,.4],[2.4,0]]:
      [[0,0],[.12,0],[.34,.25],[.48,.12],[.73,1],[.9,.95],[1.16,.2],[1.28,.4],[1.7,0],[2.4,0]],t);
    const flight=happy?(t>.31&&t<.97)||(t>1.21&&t<1.96):t>.48&&t<1.16;
    p.upper_arm_L.r=-30*lift;p.forearm_L.r=40*lift;p.hand_L.r=-6*lift;
    p.upper_arm_R.r=27*lift;p.forearm_R.r=-38*lift;p.hand_R.r=5*lift;
    p.elbow_L.r=p.forearm_L.r/2;p.elbow_R.r=p.forearm_R.r/2;
    const air=tuck/(happy?26:22);
    solveLeg(p,'L',tuck,8*air,flight,-7*air);
    solveLeg(p,'R',tuck*.87,-8*air,flight,8*air);
    p.head.r=(happy?-2.8:1.4)*Math.sin(phase);p.head.y=3*lift;
    p.hair.r=track(happy?[[0,0],[.2,-4],[.42,12],[.63,-8],[.84,9],[1.08,-13],[1.32,14],[1.58,-9],[1.81,11],[2.08,-14],[2.23,5],[2.4,0]]:
      [[0,0],[.34,-4],[.57,13],[.82,-8],[1.02,10],[1.28,-14],[1.48,8],[1.7,-5],[2.1,0],[2.4,0]],t);
    p.hair.y=6*Math.sin(phase*2)*lift;
    p.hair_L.r=-.65*p.hair.r+4*Math.sin(phase*2-.5)*lift;p.hair_R.r=.75*p.hair.r-4*Math.sin(phase*2-.9)*lift;
  }
  const expression=faceState(name,t,duration),wave=Math.sin(phase);
  for(const side of ['L','R']){p['eye_'+side].x=(side==='L'?1.8:2.2)*wave;p['eye_'+side].y=1.5*Math.sin(phase*2);p['eye_'+side].sy=expression.closed?1:1-.88*expression.blink;
    p['brow_'+side].y=3.2*expression.joy;p['brow_'+side].r=(side==='L'?-4:4)*expression.joy;
    p['cheek_'+side].sx=1+.025*expression.joy;p['cheek_'+side].sy=1+.03*expression.joy;
  }
  p.nose.x=.9*wave;p.nose.y=1.5*Math.sin(phase*2);p.nose.r=1.8*wave;p.nose.sx=1+.05*expression.joy;
  p.mouth.sy=expression.smile?1:.87+.18*expression.joy;p.mouth.sx=1+.035*expression.joy;p.mouth.y=2.5*wave;p.mouth.r=1.2*wave;
  // Cloth follows each grip's position while keeping local fabric orientation;
  // the hand's wrist rotation must not twist the front button strip.
  for(const side of ['L','R'])p['hem_'+side].r=-(p['upper_arm_'+side].r+p['forearm_'+side].r+p['hand_'+side].r);
  const posedWorld=worldPose(p);
  for(const l of custom.filter(l=>l.group==='button')){const [x,y]=l.center,ws=weights(x,y,'cloth'),px=x-W/2,py=H-y;let wx=0,wy=0;
    for(let i=0;i<ws.length;i++)if(ws[i]){const br=bind[i].r*rad,wr=posedWorld[i].r*rad,dx=px-bind[i].x,dy=py-bind[i].y,lx=dx*Math.cos(br)+dy*Math.sin(br),ly=-dx*Math.sin(br)+dy*Math.cos(br);
      wx+=ws[i]*(posedWorld[i].x+lx*Math.cos(wr)-ly*Math.sin(wr));wy+=ws[i]*(posedWorld[i].y+lx*Math.sin(wr)+ly*Math.cos(wr));}
    p[l.bone].x=wx-p.motion.x-px;p[l.bone].y=wy-p.motion.y-py;
  }
  const gate=smooth(t/.12)*smooth((duration-t)/.12);
  for(const v of Object.values(p)){v.x*=gate;v.y*=gate;v.r*=gate;v.sx=1+(v.sx-1)*gate;v.sy=1+(v.sy-1)*gate;}
  return p;
}
function faceState(name,t,duration){
 if(t>=duration-1e-6)t=0;
 const centers=name==='idle'?[[1.2,.065],[2.82,.065]]:name==='hop'?[[.34,.06],[.83,.13]]:[[.63,.12],[1.58,.13]];
 let blink=0;for(const [center,hold]of centers){const d=Math.abs(t-center);blink=Math.max(blink,1-smooth((d-hold)/.055));}
 const joy=name==='idle'?(1-Math.cos(2*Math.PI*t/duration))*.5:track([[0,0],[.3,.25],[.7,1],[1.15,.4],[1.5,1],[2.15,.3],[2.4,0]],t);
 return {blink,closed:blink>.82,smile:name==='idle'&&t>.72&&t<2.14,joy};
}
const definitions=[{id:'idle',label:'待机呼吸',duration:3.2,description:'呼吸、眨眼、笑口切换，眉毛和鼻子轻动，发梢轻摇。'},
  {id:'hop',label:'抓衣角蹦跳',duration:2.4,description:'屈膝蓄力，抓着衣角上提；腾空笑眯眼，发梢回弹。'},
  {id:'happy_bounce',label:'开心连跳',duration:2.4,description:'抓住衣角连续蹦跳，双膝收起，头发随起落摆动。'}];
const skinCorrections=[];
function worldPose(p){
  const world=[];
  for(const b of bones){const delta=p[b.name]||{x:0,y:0,r:0},parent=b.parent?world[bones.findIndex(q=>q.name===b.parent)]:{x:0,y:0,r:0};
    const c=Math.cos(parent.r*rad),s=Math.sin(parent.r*rad),x=(b.x||0)+(delta.x||0),y=(b.y||0)+(delta.y||0);
    world.push({x:parent.x+x*c-y*s,y:parent.y+x*s+y*c,r:parent.r+(b.rotation||0)+(delta.r||0)});
  }return world;
}
function correctedSkin(layer,p,world){
 const vertices=[];
 for(let i=0;i<layer.uvs.length;i+=2){
  const x=layer.x+layer.uvs[i]*layer.width,y=layer.y+layer.uvs[i+1]*layer.height,px=x-W/2,py=H-y,ws=weights(x,y,family(layer.id));
  // Dual-quaternion corrective avoids linear blend collapse at a short knee.
  // Bake the corrective as a standard Spine mesh deform timeline.
  let qw=0,qz=0,dx=0,dy=0;
  for(let b=0;b<bones.length;b++)if(ws[b]){
   const angle=(world[b].r-bind[b].r)*rad,c=Math.cos(angle),s=Math.sin(angle),hc=Math.cos(angle/2),hs=Math.sin(angle/2);
   const tx=world[b].x-bind[b].x*c+bind[b].y*s,ty=world[b].y-bind[b].x*s-bind[b].y*c;
   qw+=ws[b]*hc;qz+=ws[b]*hs;dx+=ws[b]*(tx*hc+ty*hs)/2;dy+=ws[b]*(ty*hc-tx*hs)/2;
  }
  const n=Math.hypot(qw,qz);qw/=n;qz/=n;dx/=n;dy/=n;
  const c=qw*qw-qz*qz,s=2*qw*qz;
  const targetX=px*c-py*s+2*(dx*qw-dy*qz)-p.motion.x,targetY=px*s+py*c+2*(dx*qz+dy*qw)-p.motion.y;
  vertices.push(round(targetX-px),round(targetY-py));
 }return vertices;
}
function animation(def){const anim={bones:{}};
  anim.slots={eye_L:{attachment:[]},eye_R:{attachment:[]},mouth:{attachment:[]}};
  anim.deform={default:{}};for(const l of skinCorrections)anim.deform.default[l.id]={[l.id]:[]};
  for(const bone of bones.slice(1))anim.bones[bone.name]={rotate:[],translate:[],scale:[]};
  for(let i=0;i<=Math.round(def.duration*60);i++){
    const t=i/60,p=pose(def.id,t,def.duration);
    const face=faceState(def.id,t,def.duration);for(const id of ['eye_L','eye_R','mouth']){
      const name=id==='mouth'?(face.smile?'mouth_closed':'mouth'):(face.closed?id+'_closed':id),keys=anim.slots[id].attachment;
      if(!keys.length||keys.at(-1).name!==name)keys.push({time:round(t),name});
    }
    for(const [bone,v]of Object.entries(p)){const a=anim.bones[bone];a.rotate.push({time:round(t),value:round(v.r)});a.translate.push({time:round(t),x:round(v.x),y:round(v.y)});a.scale.push({time:round(t),x:round(v.sx),y:round(v.sy)});}
    const world=worldPose(p);for(const l of skinCorrections)anim.deform.default[l.id][l.id].push({time:round(t),vertices:correctedSkin(l,p,world)});
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
  const familyCode={'body':0,'edges':0,'arm_L':1,'arm_R':2,'leg_L':3,'leg_R':4,'boot_L':5,'boot_R':6},ownership=new Uint8Array(W*H);
  const owners=new Int16Array(W*H).fill(-1),rgbaFiles=new Map(),transfers=new Map();
  for(const [index,l]of originalLayers.entries()){const rgba=await sharp(path.join(source,l.file)).ensureAlpha().raw().toBuffer(),code=familyCode[family(l.id)];rgbaFiles.set(l.id,rgba);transfers.set(l.id,[]);
    for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++)if(rgba[(y*l.width+x)*4+3]>0){const g=(l.y+y)*W+l.x+x;ownership[g]=code;owners[g]=index;}}
  const initialOwners=owners.slice();let reassignedContourPixels=0;
  // The original coarse masks assigned narrow skin outline strips to the
  // boot. Move those strips back to the skin before making the boot rigid.
  for(const side of ['L','R']){
    const skinIndex=originalLayers.findIndex(l=>l.id==='leg_'+side),bootIndex=originalLayers.findIndex(l=>l.id==='boot_'+side),skin=originalLayers[skinIndex];
    for(let y=skin.y;y<skin.y+skin.height-7;y++)for(let x=skin.x-5;x<skin.x+skin.width+5;x++){
      const g=y*W+x;if(initialOwners[g]!==bootIndex)continue;
      let adjacent=false;
      for(let dy=-4;dy<=4&&!adjacent;dy++)for(let dx=-4;dx<=4;dx++){if(dx*dx+dy*dy<=16&&initialOwners[(y+dy)*W+x+dx]===skinIndex){adjacent=true;break;}}
      if(adjacent){owners[g]=skinIndex;ownership[g]=familyCode['leg_'+side];transfers.get('leg_'+side).push(g);reassignedContourPixels++;}
    }
  }
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
    if(generated[global*4+3]>0){generated.copy(patch,i,global*4,global*4+4);patch[i+3]=Math.min(patch[i+3],approved[global*4+3]);occlusionPixels++;}}
  await sharp(patch,{raw:{width:under.width,height:under.height,channels:4}}).png().toFile(path.join(out,'images',under.id+'.png'));
  // Pants and legs are behind the coat; arms and hands are in front.
  const caps=[];
  for(const [side,x,y,width,height] of [['L',380,1060,170,105],['R',595,1090,190,108]]){
    const l={id:'hip_fill_'+side,label:side+'腿根隐藏补绘',x,y,width,height,visible:true},raw=Buffer.alloc(width*height*4);
    for(let py=0;py<height;py++)for(let px=0;px<width;px++){const g=(y+py)*W+x+px,i=(py*width+px)*4;
      if(approved[g*4+3]>0&&newCaps[g*4+3]>0){newCaps.copy(raw,i,g*4,g*4+4);raw[i+3]=Math.min(raw[i+3],approved[g*4+3]);}}
    await sharp(raw,{raw:{width,height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));caps.push(l);
  }
  // Pack connected artwork into one surface per anatomical unit. This keeps
  // texture filtering from revealing seams between dozens of exclusive cuts.
  async function merge(id,list){
    const x=Math.min(...list.map(l=>l.x)),y=Math.min(...list.map(l=>l.y)),right=Math.max(...list.map(l=>l.x+l.width)),bottom=Math.max(...list.map(l=>l.y+l.height));
    const l={id,x,y,width:right-x,height:bottom-y,visible:true,originalParts:list.map(q=>q.id)},raw=Buffer.alloc(l.width*l.height*4);
    for(const part of list){const pixels=await sharp(path.join(out,'images',part.id+'.png')).ensureAlpha().raw().toBuffer();
      for(let py=0;py<part.height;py++)for(let px=0;px<part.width;px++){
        const src=(py*part.width+px)*4;if(!pixels[src+3])continue;
        const g=(part.y+py)*W+part.x+px,i=((part.y+py-y)*l.width+part.x+px-x)*4;
        approved.copy(raw,i,g*4,g*4+4);
      }
    }
    await sharp(raw,{raw:{width:l.width,height:l.height,channels:4}}).png().toFile(path.join(out,'images',id+'.png'));return l;
  }
  const isHead=id=>/^(hair|face|ear|eye|iris|upper_lid|lower_lid|brow|blush|nose|mouth)/.test(id);
  const shorts=await merge('shorts',prepared.filter(l=>l.id.startsWith('shorts')));
  const head=await merge('head_surface',prepared.filter(l=>isHead(l.id)));
  const coat=await merge('coat_surface',prepared.filter(l=>family(l.id)==='body'&&!isHead(l.id)&&!l.id.startsWith('shorts')));
  const arms=[];for(const side of ['L','R'])arms.push(await merge('arm_'+side,prepared.filter(l=>family(l.id)==='arm_'+side)));
  for(const l of custom)fs.copyFileSync(path.join(out,'custom',l.id+'.png'),path.join(out,'images',l.id+'.png'));
  const cleanCoat=await sharp(path.join(out,'art/coat-no-buttons.png')).ensureAlpha().raw().toBuffer();
  for(const l of [coat,under]){
    const raw=await sharp(path.join(out,'images',l.id+'.png')).ensureAlpha().raw().toBuffer();
    for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++){const i=(y*l.width+x)*4,g=(l.y+y)*W+l.x+x,r=raw[i],green=raw[i+1],b=raw[i+2];
      if(l.y+y>1080&&((r>200&&green<210&&b>green*.55)||(r<155&&Math.abs(r-green)<35&&b>green*.6)))raw[i+3]=0;
      for(const button of originalLayers.filter(q=>q.id.startsWith('button'))){const cx=button.x+button.width/2,cy=button.y+button.height/2,d=Math.hypot(l.x+x-cx,l.y+y-cy);
        if(d<22&&raw[i+3]){const blend=1-smooth((d-17)/5);for(let c=0;c<3;c++)raw[i+c]=Math.round(raw[i+c]*(1-blend)+cleanCoat[g*4+c]*blend);}
      }
    }await sharp(raw,{raw:{width:l.width,height:l.height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));
  }
  // Fill the front garment's internal ownership cuts once, in the same mesh.
  // The curved front hem is separate from the rear skirt and follows the grip.
  const frontMatte=await sharp(Buffer.from(`<svg width="1024" height="1536"><path fill="white" d="M250 560 H920 V970 L874 1158 Q800 1175 719 1110 Q645 1136 560 1147 Q520 1149 493 1141 L495 1116 L404 1044 Q340 1052 272 1090 L250 1050 Z"/></svg>`)).ensureAlpha().raw().toBuffer();
  const coatPixels=await sharp(path.join(out,'images',coat.id+'.png')).ensureAlpha().raw().toBuffer();
  for(let y=0;y<coat.height;y++)for(let x=0;x<coat.width;x++){
    const i=(y*coat.width+x)*4,g=(coat.y+y)*W+coat.x+x,gy=coat.y+y,gx=coat.x+x;
    const coatTone=gy>550&&coatPixels[i+1]-coatPixels[i+2]>65&&coatPixels[i]-coatPixels[i+1]<130;
    if(((gy<640&&gx<730)||(gy<665&&gx<613))&&!coatTone){coatPixels[i+3]=0;}
    const alpha=gy<1174&&(gx<410||gx>750)?255:frontMatte[g*4+3];
    if(!alpha){coatPixels[i+3]=0;continue;}
    if(gy>560&&(gx>670||gy>640)&&generated[g*4+3]&&(approved[g*4+3]||gy<900)){
      const r=generated[g*4],green=generated[g*4+1],b=generated[g*4+2];
      let yellow=green-b>65&&r-green<130;
      if(!yellow&&r<190&&r>b*1.5&&green>b*1.4){for(let dy=-3;dy<=3&&!yellow;dy++)for(let dx=-3;dx<=3;dx++){const q=g+dy*W+dx;if(generated[q*4+1]-generated[q*4+2]>80&&generated[q*4]-generated[q*4+1]<75){yellow=true;break;}}}
      if(yellow&&!coatPixels[i+3]){generated.copy(coatPixels,i,g*4,g*4+4);coatPixels[i+3]=gy<900?generated[g*4+3]:Math.min(generated[g*4+3],approved[g*4+3]);}
    }
    coatPixels[i+3]=Math.round(coatPixels[i+3]*alpha/255);
  }
  await sharp(coatPixels,{raw:{width:coat.width,height:coat.height,channels:4}}).png().toFile(path.join(out,'images',coat.id+'.png'));
  const rear=custom.find(l=>l.id==='coat_rear'),rearPixels=await sharp(path.join(out,'images/coat_rear.png')).ensureAlpha().raw().toBuffer();
  const rearMatte=await sharp(Buffer.from(`<svg width="1024" height="1536"><path fill="white" d="M260 970 H880 L874 1158 Q815 1181 747 1200 Q672 1227 614 1220 Q546 1210 487 1188 Q452 1180 400 1172 Q315 1152 272 1090 Z"/></svg>`)).ensureAlpha().raw().toBuffer();
  for(let y=0;y<rear.height;y++)for(let x=0;x<rear.width;x++){const i=(y*rear.width+x)*4,g=(rear.y+y)*W+rear.x+x;
    if(!rearMatte[g*4+3]){rearPixels[i+3]=0;continue;}
    if(rearPixels[i+3]<240&&rear.y+y>1090){const q=g-140*W;generated.copy(rearPixels,i,q*4,q*4+4);}
    rearPixels[i+3]=Math.min(rearMatte[g*4+3],rearPixels[i+3]);
  }
  await sharp(rearPixels,{raw:{width:rear.width,height:rear.height,channels:4}}).png().toFile(path.join(out,'images/coat_rear.png'));
  // Smooth internal calf-to-cuff masks while retaining the original outer skin
  // outline. The calf overlaps the filled boot cavity behind its front lip.
  for(const l of prepared.filter(l=>l.id.startsWith('leg_'))){const raw=await sharp(path.join(out,'images',l.id+'.png')).ensureAlpha().raw().toBuffer();
    const alpha=Buffer.from(Array.from({length:l.width*l.height},(_,i)=>raw[i*4+3]));
    const softened=await sharp(alpha,{raw:{width:l.width,height:l.height,channels:1}}).blur(.6).greyscale().raw().toBuffer();
    for(let i=0;i<l.width*l.height;i++){const g=(l.y+Math.floor(i/l.width))*W+l.x+i%l.width;
      if(approved[g*4+3]>=240&&l.y+Math.floor(i/l.width)>l.y+l.height-38){approved.copy(raw,i*4,g*4,g*4+4);raw[i*4+3]=softened[i];}}
    await sharp(raw,{raw:{width:l.width,height:l.height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));
  }
  for(const side of ['L','R']){
    const rimY=x=>side==='L'?1290-.0035*(x-435)**2:1306-.18*(x-704)-.001*(x-704)**2;
    for(const l of prepared.filter(l=>l.id==='leg_'+side||l.id==='boot_'+side)){
      const raw=await sharp(path.join(out,'images',l.id+'.png')).ensureAlpha().raw().toBuffer();
      for(let y=0;y<l.height;y++)for(let x=0;x<l.width;x++){const gx=l.x+x,gy=l.y+y,i=(y*l.width+x)*4;
        const inCuff=side==='L'?gx>387&&gx<485:gx>692&&gx<783;
        if(!inCuff)continue;const edge=rimY(gx);
        if(l.id.startsWith('leg')){
          if(gy>edge-4&&raw[i]<200&&raw[i+1]<170)raw[i+3]=0;
          raw[i+3]=Math.round(raw[i+3]*(1-smooth((gy-edge+2)/3)));
        }else if(gy<edge&&gy>edge-9&&raw[i]<200&&raw[i+1]<170){raw[i+3]=0;}
      }
      await sharp(raw,{raw:{width:l.width,height:l.height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));
    }
  }
  model.layers=[...custom.filter(l=>l.id==='coat_rear'),...custom.filter(l=>l.id.startsWith('boot_back')),...custom.filter(l=>l.id.startsWith('leg_overlap')),
    ...prepared.filter(l=>l.id.startsWith('leg_')),...prepared.filter(l=>l.id.startsWith('boot_')),
    ...custom.filter(l=>l.id.startsWith('boot_lip')),
    ...custom.filter(l=>l.id==='shorts_hidden'||l.id==='neck_underlay'),coat,...custom.filter(l=>l.group==='button'),...custom.filter(l=>l.id==='face_base'||l.id==='hair_surface'),
    ...custom.filter(l=>l.group==='feature'),...arms];
  fs.writeFileSync(path.join(out,'rig-layers.json'),JSON.stringify(model.layers,null,2));
  const attachments={};for(const l of model.layers){const a=mesh(l);
    if(l.id==='leg_L'||l.id==='leg_R'){
      a.vertices=a.uvs.flatMap((u,i)=>i%2===0?[round(l.x+u*l.width-W/2),round(H-l.y-a.uvs[i+1]*l.height)]:[]);
      skinCorrections.push({...l,uvs:a.uvs});
    }const slot=l.alternateFor||l.id;if(!attachments[slot])attachments[slot]={};attachments[slot][l.id]=a;
  }
  const json={skeleton:{hash:'original-pixel-rig',spine:'4.2.00',x:-512,y:0,width:1024,height:1536,images:'./images/',fps:60},bones,
    slots:model.layers.filter(l=>!l.alternateFor).map(l=>({name:l.id,bone:'motion',attachment:l.id})),skins:[{name:'default',attachments}],
    events:{land:{}},animations:Object.fromEntries(definitions.map(d=>[d.id,animation(d)]))};
  fs.writeFileSync(path.join(out,'hinata-raincoat.json'),JSON.stringify(json));
  // Unrotated shelf packing; the images are copied at their original resolution.
  const pages=[];let page={items:[],x:3,y:3,row:0};pages.push(page);
  // Preserve straight-alpha edge colors in transparent texels. This is
  // sampling padding only; it changes no visible pixels or silhouettes.
  for(const l of model.layers){const raw=await sharp(path.join(out,'images',l.id+'.png')).ensureAlpha().raw().toBuffer(),dist=new Int8Array(l.width*l.height).fill(-1),q=new Int32Array(dist.length);let a=0,b=0;
    for(let i=0;i<dist.length;i++)if(raw[i*4+3]){dist[i]=0;q[b++]=i;}
    while(a<b){const i=q[a++];if(dist[i]>=3)continue;const x=i%l.width;
      for(const j of [x?i-1:-1,x+1<l.width?i+1:-1,i>=l.width?i-l.width:-1,i+l.width<dist.length?i+l.width:-1])if(j>=0&&dist[j]<0){dist[j]=dist[i]+1;q[b++]=j;raw[j*4]=raw[i*4];raw[j*4+1]=raw[i*4+1];raw[j*4+2]=raw[i*4+2];}
    }await sharp(raw,{raw:{width:l.width,height:l.height,channels:4}}).png().toFile(path.join(out,'images',l.id+'.png'));
  }
  for(const l of [...model.layers].sort((a,b)=>b.height-a.height)){
    if(page.x+l.width+3>2048){page.x=3;page.y+=page.row;page.row=0;}
    if(page.y+l.height+3>2048){page={items:[],x:3,y:3,row:0};pages.push(page);}
    page.items.push({l,x:page.x,y:page.y});page.x+=l.width+6;page.row=Math.max(page.row,l.height+6);
  }
  const texts=[],textures={};
  for(let i=0;i<pages.length;i++){
    const p=pages[i],name='hinata-atlas-'+(i+1)+'.png';
    const height=2**Math.ceil(Math.log2(p.y+p.row+3));
    const packed=Buffer.alloc(2048*height*4);
    for(const {l,x,y}of p.items){const raw=await sharp(path.join(out,'images',l.id+'.png')).ensureAlpha().raw().toBuffer();for(let row=0;row<l.height;row++)raw.copy(packed,((y+row)*2048+x)*4,row*l.width*4,(row+1)*l.width*4);}
    await sharp(packed,{raw:{width:2048,height,channels:4}}).png().toFile(path.join(out,name));
    textures[name]='data:image/png;base64,'+fs.readFileSync(path.join(out,name)).toString('base64');
    texts.push(name+'\nsize: 2048,'+height+'\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\npma: false\n'+
      p.items.map(({l,x,y})=>l.id+'\n  bounds: '+[x,y,l.width,l.height].join(',')+'\n  offsets: 0,0,'+l.width+','+l.height+'\n  rotate: false\n  index: -1').join('\n'));
  }
  const atlas=texts.join('\n\n')+'\n';fs.writeFileSync(path.join(out,'hinata-raincoat.atlas'),atlas);
  fs.writeFileSync(path.join(out,'preview-data.js'),'window.PET_DATA='+JSON.stringify({skeleton:json,atlas,textures,layers:model.layers,animations:definitions,chains})+';');
  const sha = file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const provenance={source:'../hinata-live2d-v2',layerCount:model.layers.length,boneCount:bones.length,pageCount:pages.length,
    originalLayerFilesUnchanged:originalLayers.every(l=>sha(path.join(source,l.file))===sha(path.join(out,'original-layers',l.id+'.png'))),
    samplingSupport:{pixels:4,source:'Neighboring approved-image pixels of the same rig attachment family only; no new drawing.',copiedSeamPixels},
    boundaryRepair:{reassignedContourPixels,transferredPixelsRetainSourceRGB:true,jointAlphaMasksRefined:true,removedFromRuntime:'Exclusive-mask edge fragments are omitted from runtime surfaces; complete source pixels remain in original-layers/.'},
    sourceImageSHA256:sha(path.join(source,'reference-approved.png')),runtime:'Official @esotericsoftware/spine-webgl 4.2 branch',runtimeSHA256:sha(path.join(out,'runtime/spine-webgl.js')),
    occlusionUnderlay:{source:'coat-occlusion-generated.png',usedPixels:occlusionPixels,scope:'Localized hidden coat fills merged into the front mesh; separate rear skirt, registered painted boot cavities, calf overlap and complete hidden shorts.'},
    rig:'Arm sleeves and hands consolidated into continuous shared weighted meshes. Skin-only thigh/shin chains with dual-quaternion volume corrective baked to standard Spine mesh deform keys. Full boots rigidly bound to a single foot bone, independently counter-rotated. Leg IK baked to FK; planted cuff targets on ground.',
    archiveLayers:originalLayers.length,runtimeSurfaces:model.layers.map(l=>({id:l.id,originalParts:l.originalParts||[l.id]})),
    chains,
    articulation:{hem:'Each hem grab shares exactly the hand grip vertex position; wrist counter-rotation preserves cloth orientation.',face:'Two eyes, brows, nose, mouth and cheeks on separate bones; closed-eye and soft-smile attachment swaps.',hair:'Root and side locks animate independently with increased recoil.',boots:'Opaque painted interior cavities, rigid complete boot shells, registered calf overlap, antialiased joint masks.'},
    generationMode:'Built-in ImageGen; prompt-set.json records the executed local fill/expression prompts.',
    limitations:['目前只制作正面待机、单跳和连跳，未制作转身。','已通过 Spine 4.2 官方运行时加载和动画检查；未在 Spine 编辑器中执行导入。本包是 JSON/atlas/PNG，不含原生 .spine 文件。'],animations:definitions};
  fs.writeFileSync(path.join(out,'asset-provenance.json'),JSON.stringify(provenance,null,2));
  const officialSource=fs.readFileSync(path.join(__dirname,'SpineTextureAtlas-reference.ts'),'utf8');
  const license=officialSource.match(/\/\*[\s\S]*?\*\//)[0];
  fs.writeFileSync(path.join(out,'runtime/LICENSE.txt'),license+'\n\nSource: https://github.com/EsotericSoftware/spine-runtimes/tree/4.2/spine-ts\n');
  console.log(JSON.stringify({layers:model.layers.length,bones:bones.length,atlasPages:pages.length,meshVertices:Object.values(attachments).reduce((s,a)=>s+Object.values(a)[0].uvs.length/2,0),animations:definitions.map(d=>d.id)}));
}
main().catch(e=>{console.error(e);process.exit(1);});
