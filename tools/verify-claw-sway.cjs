const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
const previous=JSON.parse(fs.readFileSync(path.join(root,'inspection/before-cute-claw.json'))),current=JSON.parse(fs.readFileSync(path.join(root,'hinata-raincoat.json')));
const span=keys=>Math.max(...keys.map(k=>k.value||0))-Math.min(...keys.map(k=>k.value||0));
const rotations={};
for(const bone of ['body','chest','head','upper_arm_L','upper_arm_R','forearm_L','forearm_R']){
 const oldSpan=span(previous.animations.drag_hold.bones[bone].rotate),newSpan=span(current.animations.drag_hold.bones[bone].rotate);
 rotations[bone]={previousPeakToPeakDegrees:oldSpan,currentPeakToPeakDegrees:newSpan,factor:newSpan/oldSpan};
 assert.ok(Math.abs(newSpan/oldSpan-1.5)<.000002,'Sway is not 50% larger: '+bone);
}
for(const bone of ['hair','hair_L','hair_R','hair_fringe','hair_outer_L','mouth'])assert.deepEqual(current.animations.drag_hold.bones[bone],previous.animations.drag_hold.bones[bone],bone+' changed');
function load(file){const context={};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);return context.PetDragController;}
const oldController=load(path.join(root,'inspection/before-cute-claw-controller.js')),newController=load(path.join(__dirname,'pet-drag-controller.js'));
const response=[];
for(const speed of [300,-600,1400,-1400]){
 const fake=()=>({state:null,phase:'held',pointer:{},velocity:speed,swing:0,swingSpeed:0});const old=fake(),now=fake();let error=0;
 for(let i=0;i<240;i++){old.velocity=now.velocity=speed;oldController.prototype.advance.call(old,1/240);newController.prototype.advance.call(now,1/240);error=Math.max(error,Math.abs(now.swing-old.swing*1.5));assert.ok(Math.abs(now.swing)<=9);}
 assert.ok(error<1e-10);response.push({velocityPixelsPerSecond:speed,previousSwing:old.swing,currentSwing:now.swing,factor:now.swing/old.swing,maximumScalingError:error});
}
const report={heldSwayFactor:1.5,rotations,mouseResponse:response,currentDragLimitDegrees:9,previousDragLimitDegrees:6,hairAndMouthMotionUnchanged:true};
fs.writeFileSync(path.join(root,'claw-sway-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
