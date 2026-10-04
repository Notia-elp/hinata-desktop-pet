/* Long-press interaction for the exported Spine pet. No native-window dependency.
 * Host callbacks: onPickup/onMove/onDrop/onIdle receive client and root positions.
 * Call advance(dt), applyPose(), then place(camera) before drawing the skeleton.
 */
(function(global){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 class PetDragController{
  constructor(player,options={}){
   this.p=player;this.runtime=options.runtime||global.spine;this.options=options;
   this.holdMs=options.holdMs??300;this.phase='inactive';this.state=null;
   this.offset={x:0,y:0};this.swing=0;this.swingSpeed=0;this.velocity=0;this.pointer=null;
   this.handlers={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:e=>this.up(e),lostpointercapture:e=>this.up(e)};
   for(const [name,fn]of Object.entries(this.handlers))player.canvas.addEventListener(name,fn);
   this.blur=()=>this.up({pointerId:this.pointer?.id});global.addEventListener('blur',this.blur);
   player.canvas.style.touchAction='none';player.canvas.style.cursor='grab';
  }
   emit(name){this.options[name]?.({phase:this.phase,clientX:this.pointer?.x??this.lastPoint?.x,clientY:this.pointer?.y??this.lastPoint?.y,screenX:this.pointer?.screenX??this.lastPoint?.screenX,screenY:this.pointer?.screenY??this.lastPoint?.screenY,rootX:this.offset.x,rootY:this.offset.y});}
  worldPoint(x,y,camera=this.p.renderer.camera){const r=this.p.canvas.getBoundingClientRect();return {x:camera.position.x+(x-r.left-r.width/2)/r.width*camera.viewportWidth,y:camera.position.y-(y-r.top-r.height/2)/r.height*camera.viewportHeight};}
  hit(e){const c=this.p.canvas,r=c.getBoundingClientRect(),gl=this.p.renderer.context.gl;
   const x=Math.floor((e.clientX-r.left)/r.width*c.width),y=Math.floor((r.bottom-e.clientY)/r.height*c.height);
   if(x<0||y<0||x>=c.width||y>=c.height)return false;
   const pixel=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return pixel[3]>=24;
  }
  down(e){
   if(e.button!==0||e.isPrimary===false||this.pointer||!this.hit(e))return;
   e.preventDefault();const point=this.worldPoint(e.clientX,e.clientY);
   const bone=this.p.skeleton.findBone(point.y-this.offset.y>900?'head':'body');
   const local=bone.worldToLocal({...point});
   this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,screenX:e.screenX,screenY:e.screenY,time:performance.now(),bone:bone.data.name,local};
   this.beforePendingPhase=this.phase;this.phase='pending';
   try{this.p.canvas.setPointerCapture(e.pointerId);}catch{}
   this.timer=setTimeout(()=>this.pickup(),this.holdMs);
  }
  createState(){
   const data=new this.runtime.AnimationStateData(this.p.skeletonData);data.defaultMix=.12;
   data.setMix('pickup','drag_hold',.04);data.setMix('put_down','idle',.1);
   this.state=new this.runtime.AnimationState(data);
  }
  enableDemo(){this.createState();this.state.setAnimation(0,'idle',true);this.phase='idle';}
  pickup(){
   if(!this.pointer)return;
   if(!this.state){this.createState();const entry=this.state.setAnimation(0,this.p.def.id,this.p.def.loop!==false);entry.trackTime=this.p.t;this.state.apply(this.p.skeleton);}
   this.state.clearTrack(1);this.state.timeScale=1;this.state.setAnimation(0,'pickup',false);this.state.addAnimation(0,'drag_hold',true,.36);
   this.pickupTime=0;this.pickPoint={x:this.pointer.x,y:this.pointer.y};
   this.phase='pickup';this.p.canvas.style.cursor='grabbing';this.options.onActivate?.();this.emit('onPickup');
  }
  move(e){if(e.pointerId!==this.pointer?.id)return;
   const now=performance.now(),dt=Math.max(.008,(now-this.pointer.time)/1000);
   this.velocity=clamp((e.clientX-this.pointer.x)/dt,-1400,1400);
   Object.assign(this.pointer,{x:e.clientX,y:e.clientY,screenX:e.screenX,screenY:e.screenY,time:now});
   if(this.phase!=='pending')this.emit('onMove');
  }
  up(e){if(!this.pointer||e.pointerId!==this.pointer.id)return;
   clearTimeout(this.timer);this.lastPoint={x:this.pointer.x,y:this.pointer.y,screenX:this.pointer.screenX,screenY:this.pointer.screenY};const id=this.pointer.id;
   this.pointer=null;this.p.canvas.style.cursor='grab';
   try{if(this.p.canvas.hasPointerCapture(id))this.p.canvas.releasePointerCapture(id);}catch{}
   if(this.phase==='pending'){this.phase=this.beforePendingPhase;return;}
   this.phase='dropping';this.dropTime=0;this.from={...this.offset};
   this.fallDuration=clamp(Math.sqrt(2*Math.abs(this.from.y)/4200),.24,.65);
   this.landStart=this.fallDuration-.24;this.landStarted=false;this.landed=false;
   const camera=this.p.renderer.camera,limit=Math.max(0,camera.viewportWidth/2-470);
   this.toX=clamp(this.offset.x,-limit,limit);
   this.state.timeScale=1;this.state.setAnimation(1,'claw_release',false);if(this.landStart===0)this.startLanding();
   this.emit('onDrop');
  }
  startLanding(){this.landStarted=true;this.state.setAnimation(0,'put_down',false);this.state.addAnimation(0,'idle',true,.5);}
  advance(dt){
   if(this.state)this.state.update(dt);
   if(this.phase==='pickup')this.pickupTime+=dt;
   if(this.phase==='pickup'&&this.state.getCurrent(0)?.animation.name==='drag_hold')this.phase='held';
   const target=this.pointer&&this.phase==='held'?clamp(-this.velocity*.005,-6,6):0;
   this.swingSpeed+=((target-this.swing)*100-18*this.swingSpeed)*dt;
   this.swing=clamp(this.swing+this.swingSpeed*dt,-6,6);this.velocity*=Math.exp(-8*dt);
   if(this.phase==='dropping'){
    this.dropTime+=dt;if(!this.landStarted&&this.dropTime>=this.landStart)this.startLanding();
    const u=clamp(this.dropTime/this.fallDuration,0,1),ease=u*u;
    this.offset.y=this.from.y*(1-ease);this.offset.x=this.from.x+(this.toX-this.from.x)*ease;
    if(u===1&&!this.landed){this.landed=true;this.offset.y=0;this.emit('onLand');}
    if(this.dropTime>=this.fallDuration+.26){this.offset.y=0;this.phase='idle';this.state.clearTrack(1);this.emit('onIdle');}
   }
  }
  applyPose(){if(!this.state)return false;const s=this.p.skeleton;s.setToSetupPose();this.state.apply(s);const motion=s.findBone('motion');motion.rotation+=this.swing;
   if(this.phase==='dropping'){const claw=s.findBone('claw_root'),a=motion.rotation*Math.PI/180,dx=this.from.x-this.offset.x,dy=this.from.y-this.offset.y;claw.x+=dx*Math.cos(a)+dy*Math.sin(a);claw.y+=-dx*Math.sin(a)+dy*Math.cos(a);}
   return true;}
  place(camera){if(!this.state)return;
   const s=this.p.skeleton,root=s.findBone('root');root.x=this.offset.x;root.y=this.offset.y;s.updateWorldTransform(this.runtime.Physics.none);
   if(this.pointer&&['pickup','held'].includes(this.phase)){
    const u=this.phase==='pickup'?clamp((this.pickupTime-.2)/.16,0,1):1,lift=u*u*(3-2*u),x=this.phase==='pickup'?this.pickPoint.x+(this.pointer.x-this.pickPoint.x)*lift:this.pointer.x,y=this.phase==='pickup'?this.pickPoint.y+(this.pointer.y-this.pickPoint.y)*lift:this.pointer.y;
    const bone=s.findBone(this.pointer.bone),anchor=bone.localToWorld({...this.pointer.local}),point=this.worldPoint(x,y,camera);
    root.x+=point.x-anchor.x;root.y+=point.y-anchor.y;this.offset={x:root.x,y:root.y};s.updateWorldTransform(this.runtime.Physics.none);
   }
  }
  snapshot(){const anchor=this.pointer?this.p.skeleton.findBone(this.pointer.bone).localToWorld({...this.pointer.local}):null;
   return {phase:this.phase,animation:this.state?.getCurrent(0)?.animation.name||this.p.def.id,offset:{...this.offset},swing:this.swing,anchor,pointer:this.pointer?{id:this.pointer.id,x:this.pointer.x,y:this.pointer.y}:null};}
  reset(){clearTimeout(this.timer);const id=this.pointer?.id;this.pointer=null;try{if(id!=null&&this.p.canvas.hasPointerCapture(id))this.p.canvas.releasePointerCapture(id);}catch{}
   this.state=null;this.phase='inactive';this.offset={x:0,y:0};this.swing=this.swingSpeed=this.velocity=0;this.p.canvas.style.cursor='grab';}
  destroy(){this.reset();for(const [name,fn]of Object.entries(this.handlers))this.p.canvas.removeEventListener(name,fn);global.removeEventListener('blur',this.blur);}
 }
 global.PetDragController=PetDragController;
})(globalThis);
