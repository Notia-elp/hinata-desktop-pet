'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8');

// Run the actual renderer and its listeners. Only browser, clock and Spine services
// are substituted; no production source is rewritten or interaction state injected.
function renderer(){
 let now=0,nextTimer=0,frames=[],onMessage;
 const timers=new Map(),captures=new Set(),classes=new Set(),messages=[],animations=[];
 const target=()=>({listeners:{},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},emit(type,event={}){for(const fn of this.listeners[type]||[])fn(event);}});
 const gl={readPixels(...args){args.at(-1)[3]=255;},viewport(){},clearColor(){},clear(){}};
 const canvas=Object.assign(target(),{
  clientWidth:352,clientHeight:586,width:352,height:586,getContext:()=>gl,
  classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
  setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),
  releasePointerCapture(id){if(captures.delete(id))canvas.emit('lostpointercapture',{pointerId:id});}
 });
 class MeshAttachment{
  constructor(){this.name='body';this.worldVerticesLength=4;}
  computeWorldVertices(_slot,_start,_length,out){out.set([-100,0,100,1500]);}
 }
 class Skeleton{
  constructor(){this.bones=new Map();const mesh=new MeshAttachment();this.slots=[{data:{name:'body'},getAttachment:()=>mesh}];}
  findBone(name){if(!this.bones.has(name))this.bones.set(name,{data:{name},x:0,y:0,rotation:0,worldToLocal:p=>p,localToWorld:p=>p});return this.bones.get(name);}
  findSlot(){return{getAttachment:()=>null};}
  setToSetupPose(){} updateWorldTransform(){}
 }
 class AnimationState{
  constructor(){this.tracks=[];}
  setAnimation(track,name){animations.push(name);return this.tracks[track]={animation:{name},trackTime:0};}
  addAnimation(track,name,_loop,delay){this.tracks[track].next={animation:{name},trackTime:0,delay};}
  getCurrent(track){return this.tracks[track];}
  clearTrack(track){this.tracks[track]=null;}
  clearTracks(){this.tracks=[];}
  update(dt){for(let i=0;i<this.tracks.length;i++){const entry=this.tracks[i];if(!entry)continue;entry.trackTime+=dt;if(entry.next&&entry.trackTime>=entry.next.delay)this.tracks[i]={...entry.next,trackTime:entry.trackTime-entry.next.delay};}}
  apply(){}
 }
 const spine={
  MeshAttachment,Skeleton,AnimationState,Physics:{none:0},GLTexture:class{},
  TextureAtlas:class{},AtlasAttachmentLoader:class{},
  SkeletonJson:class{readSkeletonData(){return{findAnimation:name=>({name,duration:.5})};}},
  AnimationStateData:class{setMix(){}},
  SceneRenderer:class{
   constructor(){this.context={gl};this.camera={position:{x:0,y:0,set(x,y){this.x=x;this.y=y;}},update(){}};}
   begin(){} drawSkeleton(){} end(){}
  }
 };
 const window=Object.assign(target(),{PET_DATA:{textures:{},animations:[]},desktopPet:{send:(name,value)=>messages.push({name,value}),onMessage:fn=>{onMessage=fn;}}});
 vm.runInNewContext(source,{
  window,document:{querySelector:()=>canvas},spine,performance:{now:()=>now},
  setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{at:now+delay,fn});return id;},
  clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>frames.push(fn)
 },{filename:'renderer.js'});
 assert.ok(window.petApp.snapshot().ready);
 assert.ok(messages.some(message=>message.name==='ready'),'Renderer initialization completed');
 const advance=milliseconds=>{const end=now+milliseconds;while(now<end){now=Math.min(end,now+10);for(const [id,timer]of timers)if(timer.at<=now){timers.delete(id);timer.fn();}const scheduled=frames;frames=[];for(const frame of scheduled)frame(now);}};
 const pointer=(type,pointerId=1)=>canvas.emit(type,{pointerId,button:0,clientX:176,clientY:220,preventDefault(){}});
 return{
  advance,pointer,window,host:message=>onMessage(message),messages,animations,
  snapshot:()=>window.petApp.snapshot(),captured:id=>captures.has(id),heldClass:()=>classes.has('held'),
  releases:()=>messages.filter(message=>message.name==='release'),
  down(){pointer('pointerdown');},
  hold(){pointer('pointerdown');advance(700);assert.equal(window.petApp.snapshot().phase,'held');}
 };
}

for(const type of ['pointerup','pointercancel','lostpointercapture']){
 for(const phase of ['pending','pickup','held'])test(`${type} from another pointer leaves ${phase} grab intact`,()=>{
  const pet=renderer();pet.down();if(phase!=='pending')pet.advance(phase==='pickup'?300:700);
  assert.equal(pet.snapshot().phase,phase);pet.pointer(type,2);
  assert.equal(pet.snapshot().phase,phase);assert.equal(pet.releases().length,0);assert.ok(pet.captured(1));
  pet.advance(700);assert.equal(pet.snapshot().phase,'held');
 });
 test(`${type} from the active pointer releases once despite duplicate cancellation`,()=>{
  const pet=renderer();pet.hold();pet.pointer(type);
  pet.pointer(type);pet.pointer('pointercancel');pet.pointer('lostpointercapture');
  assert.equal(pet.snapshot().phase,'dropping');assert.deepEqual(pet.releases().map(message=>message.value.short),[false]);
  assert.equal(pet.captured(1),false);assert.equal(pet.heldClass(),false);
 });
}

for(const type of ['pointercancel','lostpointercapture'])test(`${type} while pending cancels the timer without hopping`,()=>{
 const pet=renderer();pet.down();pet.advance(100);pet.pointer(type);pet.advance(1000);
 assert.equal(pet.snapshot().phase,'idle');assert.equal(pet.animations.includes('hop'),false);
 assert.equal(pet.messages.some(message=>message.name==='pickup'),false);
 assert.deepEqual(pet.releases().map(message=>message.value.short),[true]);
});

test('short primary click hops without starting pickup',()=>{
 const pet=renderer();pet.down();pet.advance(80);pet.pointer('pointerup');
 assert.equal(pet.snapshot().phase,'idle');assert.equal(pet.snapshot().animation,'hop');
 pet.advance(1000);assert.equal(pet.messages.some(message=>message.name==='pickup'),false);
 assert.deepEqual(pet.releases().map(message=>message.value.short),[true]);
});

test('300 ms primary hold picks up, reaches held, releases and finishes the drop',()=>{
 const pet=renderer();pet.down();pet.advance(299);assert.equal(pet.snapshot().phase,'pending');
 pet.advance(1);assert.equal(pet.snapshot().phase,'pickup');assert.ok(pet.heldClass());
 pet.advance(400);assert.equal(pet.snapshot().phase,'held');assert.equal(pet.snapshot().animation,'drag_hold');
 pet.pointer('pointerup');assert.equal(pet.snapshot().phase,'dropping');
 assert.deepEqual(pet.releases().map(message=>message.value.short),[false]);
 pet.host({type:'drop',offsetX:0,offsetY:0,landing:true,landingStarted:false,finished:false});
 pet.advance(600);pet.host({type:'drop',offsetX:0,offsetY:0,landing:true,landingStarted:true,finished:true});
 assert.equal(pet.snapshot().phase,'idle');assert.equal(pet.snapshot().animation,'idle');
 assert.equal(pet.captured(1),false);assert.equal(pet.heldClass(),false);
});

const cancellations={blur:pet=>pet.window.emit('blur'),Escape:pet=>pet.window.emit('keydown',{key:'Escape'}),'host cancel':pet=>pet.host({type:'cancel'})};
for(const [name,cancel]of Object.entries(cancellations))for(const phase of ['pending','held'])test(`${name} still cancels a ${phase} grab`,()=>{
 const pet=renderer();if(phase==='held')pet.hold();else pet.down();
 cancel(pet);cancel(pet);pet.advance(1000);
 assert.equal(pet.snapshot().phase,phase==='held'?'dropping':'idle');
 assert.deepEqual(pet.releases().map(message=>message.value.short),[phase==='pending']);
 assert.equal(pet.animations.includes('hop'),false);assert.equal(pet.captured(1),false);
 assert.equal(pet.messages.filter(message=>message.name==='pickup').length,phase==='held'?1:0);
});
