'use strict';
const bridge=window.desktopPet,canvas=document.querySelector('#pet'),DATA=window.PET_DATA;
let renderer,skeleton,skeletonData,state,ready=false,phase='idle',expression='auto',autoActivity=true,hidden=false;
let pointer={x:-1,y:-1,velocityX:0},press=null,timer=null,grab=null,clock=0,swing=0,swingSpeed=0,lastHit=null,lastTime=performance.now(),lastDraw=0,pendingDt=0,nextActivity=15,dropOffset={x:0,y:0};
let floorWorldY=null,metricsHeight=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const send=(name,value)=>bridge?.send(name,value);
const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
function project(point){const camera=renderer.camera;return{x:canvas.clientWidth/2+(point.x-camera.position.x)/camera.viewportWidth*canvas.clientWidth,y:canvas.clientHeight/2-(point.y-camera.position.y)/camera.viewportHeight*canvas.clientHeight};}
function unproject(x,y){const camera=renderer.camera;return{x:camera.position.x+(x-canvas.clientWidth/2)/canvas.clientWidth*camera.viewportWidth,y:camera.position.y-(y-canvas.clientHeight/2)/canvas.clientHeight*camera.viewportHeight};}
function alphaAt(x,y){if(!ready||x<0||y<0||x>=canvas.clientWidth||y>=canvas.clientHeight)return 0;const gl=renderer.context.gl,pixel=new Uint8Array(4);gl.readPixels(Math.floor(x/canvas.clientWidth*canvas.width),Math.min(canvas.height-1,Math.floor((canvas.clientHeight-y)/canvas.clientHeight*canvas.height)),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return pixel[3];}
function bounds(){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const slot of skeleton.slots){if(slot.data.name.startsWith('claw_')||slot.data.name==='volleyball')continue;const a=slot.getAttachment();if(!(a instanceof spine.MeshAttachment))continue;const v=new Float32Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,v.length,v,0,2);for(let i=0;i<v.length;i+=2){minX=Math.min(minX,v[i]);maxX=Math.max(maxX,v[i]);minY=Math.min(minY,v[i+1]);maxY=Math.max(maxY,v[i+1]);}}
 return {minX,minY,maxX,maxY};
}
function play(id){if(!ready||['pickup','held','dropping','pending'].includes(phase))return;const animation=skeletonData.findAnimation(id);if(!animation||['pickup','drag_hold','put_down','claw_release'].includes(id))return;
 state.clearTrack(1);state.setAnimation(0,id,id==='idle');if(id!=='idle')state.addAnimation(0,'idle',true,animation.duration);nextActivity=clock+12+Math.random()*14;
}
function applyExpression(){if(expression==='auto')return;for(const id of ['eye_L','eye_R','mouth','brow_L','brow_R'])skeleton.setAttachment(id,id+'_'+expression);for(const side of ['L','R'])skeleton.findBone('eye_'+side).scaleY=1;
 if(expression==='determined'){const l=skeleton.findBone('brow_L'),r=skeleton.findBone('brow_R');l.rotation=l.data.rotation-12;r.rotation=r.data.rotation+14;l.y=l.data.y-3;r.y=r.data.y-3;}}
function pickup(){if(!press||!ready)return;phase='pickup';grab={bone:press.bone,local:press.local};state.clearTrack(1);state.setAnimation(0,'pickup',false);state.addAnimation(0,'drag_hold',true,.36);send('pickup');canvas.classList.add('held');}
function release(cancelled=false){if(!press)return;clearTimeout(timer);const id=press.id;press=null;try{if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}catch{}
 if(phase==='pending'){phase='idle';if(!cancelled)play('hop');send('release',{short:true});return;}
 if(['pickup','held'].includes(phase)){phase='dropping';grab=null;state.setAnimation(1,'claw_release',false);send('release',{short:false});}canvas.classList.remove('held');}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||press||phase==='dropping'||alphaAt(e.clientX,e.clientY)<24)return;e.preventDefault();const point=unproject(e.clientX,e.clientY),bone=skeleton.findBone(point.y>900?'head':'body');press={id:e.pointerId,bone:bone.data.name,local:bone.worldToLocal({...point})};phase='pending';try{canvas.setPointerCapture(e.pointerId);}catch{}send('press',{x:e.clientX,y:e.clientY});timer=setTimeout(pickup,300);});
canvas.addEventListener('pointerup',e=>{if(e.pointerId===press?.id)release();});canvas.addEventListener('pointercancel',e=>{if(e.pointerId===press?.id)release(true);});canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===press?.id)release(true);});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();release(true);send('context-menu');});
canvas.addEventListener('dblclick',()=>play('head_juggle'));window.addEventListener('blur',()=>release(true));
window.addEventListener('keydown',e=>{if(e.key==='Escape')release(true);});
bridge?.onMessage(message=>{switch(message.type){
 case 'pointer':pointer=message;break;
 case 'play':play(message.id);break;
 case 'settings':expression=message.expression;autoActivity=message.autoActivity;hidden=message.hidden;break;
 case 'drop':dropOffset={x:message.offsetX,y:message.offsetY};if(message.landing&&!message.landingStarted){state.setAnimation(0,'put_down',false);state.addAnimation(0,'idle',true,.5);}if(message.finished){phase='idle';state.clearTrack(1);dropOffset={x:0,y:0};nextActivity=clock+15;}break;
 case 'cancel':release(true);break;
 case 'reset':clearTimeout(timer);press=grab=null;phase='idle';swing=swingSpeed=0;dropOffset={x:0,y:0};state.clearTracks();state.setAnimation(0,'idle',true);break;
 case 'resize':clearTimeout(timer);press=grab=null;phase='idle';swing=swingSpeed=0;state.clearTracks();state.setAnimation(0,'idle',true);requestAnimationFrame(()=>{draw(0);send('ready',{floorPixel:project({x:0,y:bounds().minY}).y,animations:DATA.animations.filter(a=>!['pickup','drag_hold','put_down'].includes(a.id)).map(a=>({id:a.id,label:a.label}))});});break;
}});
async function init(){
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:true});if(!gl)throw Error('无法创建 WebGL，请更新显卡驱动后重试。');renderer=new spine.SceneRenderer(canvas,gl,false);spine.GLTexture.DISABLE_UNPACK_PREMULTIPLIED_ALPHA_WEBGL=true;
 const atlas=new spine.TextureAtlas(DATA.atlas);for(const [name,url]of Object.entries(DATA.textures))atlas.pages.find(p=>p.name===name).setTexture(new spine.GLTexture(gl,await loadImage(url),false));
 skeletonData=new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(DATA.skeleton);skeleton=new spine.Skeleton(skeletonData);const data=new spine.AnimationStateData(skeletonData);data.defaultMix=.12;data.setMix('pickup','drag_hold',.04);data.setMix('put_down','idle',.1);state=new spine.AnimationState(data);state.setAnimation(0,'idle',true);
 ready=true;draw(0);const idleBounds=bounds();floorWorldY=idleBounds.minY;metricsHeight=canvas.clientHeight;send('ready',{floorPixel:project({x:0,y:floorWorldY}).y,bodyBounds:idleBounds,animations:DATA.animations.filter(a=>!['pickup','drag_hold','put_down'].includes(a.id)).map(a=>({id:a.id,label:a.label}))});requestAnimationFrame(tick);
}
function draw(dt){const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
 const camera=renderer.camera;camera.viewportHeight=3000;camera.viewportWidth=3000*canvas.clientWidth/canvas.clientHeight;camera.position.set(0,1325,0);camera.update();state.update(dt);
 if(phase==='pickup'&&state.getCurrent(0)?.animation.name==='drag_hold')phase='held';const target=phase==='held'?clamp(-pointer.velocityX*.0075,-9,9):0;swingSpeed+=((target-swing)*100-18*swingSpeed)*dt;swing=clamp(swing+swingSpeed*dt,-9,9);
 skeleton.setToSetupPose();state.apply(skeleton);const motion=skeleton.findBone('motion');motion.rotation+=swing;
 if(phase==='dropping'){const claw=skeleton.findBone('claw_root'),scale=canvas.clientHeight/3000,dx=dropOffset.x/scale,dy=-dropOffset.y/scale,a=motion.rotation*Math.PI/180;claw.x+=dx*Math.cos(a)+dy*Math.sin(a);claw.y+=-dx*Math.sin(a)+dy*Math.cos(a);}
 applyExpression();skeleton.updateWorldTransform(spine.Physics.none);const gl=renderer.context.gl;gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(skeleton,false);renderer.end();
 if(floorWorldY!==null&&metricsHeight!==canvas.clientHeight){metricsHeight=canvas.clientHeight;send('metrics',{floorPixel:project({x:0,y:floorWorldY}).y});}
 if(grab&&['pickup','held'].includes(phase)){const anchor=project(skeleton.findBone(grab.bone).localToWorld({...grab.local})),entry=state.getCurrent(0),u=phase==='pickup'?clamp((entry.trackTime-.2)/.16,0,1):1;send('grab-frame',{x:anchor.x,y:anchor.y,lift:u*u*(3-2*u)});}
 const hit=alphaAt(pointer.x,pointer.y)>=24;if(lastHit!==hit){lastHit=hit;send('hit',hit);}
}
function tick(now){const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;if(!hidden){clock+=dt;pendingDt+=dt;if(now-lastDraw>=1000/60-.5){draw(Math.min(pendingDt,.05));pendingDt=0;lastDraw=now;}if(autoActivity&&phase==='idle'&&clock>=nextActivity){const choices=['sway','hop','happy_bounce','head_juggle','proud_hops','grin'];play(choices[Math.floor(Math.random()*choices.length)]);}}requestAnimationFrame(tick);}
function ballBounds(){if(!ready||!skeleton.findSlot('volleyball').getAttachment())return null;const b=skeleton.findBone('volleyball'),rx=86*Math.hypot(b.a,b.b),ry=86*Math.hypot(b.c,b.d),left=project({x:b.worldX-rx,y:b.worldY}).x,right=project({x:b.worldX+rx,y:b.worldY}).x,top=project({x:b.worldX,y:b.worldY+ry}).y,bottom=project({x:b.worldX,y:b.worldY-ry}).y;return{diameter:172*b.scaleX,left,right,top,bottom,canvasWidth:canvas.clientWidth,canvasHeight:canvas.clientHeight};}
window.petApp={snapshot:()=>({ready,phase,animation:state?.getCurrent(0)?.animation.name,expression,swing,volleyball:ballBounds(),floorPixel:floorWorldY===null?null:project({x:0,y:floorWorldY}).y,body:ready?bounds():null,attachments:ready?Object.fromEntries(skeleton.slots.map(s=>[s.data.name,s.getAttachment()?.name||null])):{},cornerAlpha:ready?alphaAt(2,2):-1}),grabPoint:()=>project(skeleton.findBone('head').localToWorld({x:0,y:220})),png:()=>canvas.toDataURL()};
init().catch(e=>{send('error',e.stack||e.message);const error=document.querySelector('#error');error.hidden=false;error.textContent=e.message;});
