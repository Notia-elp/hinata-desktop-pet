const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const deps='C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),sharp=require(deps+'sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const before=JSON.parse(fs.readFileSync(path.join(root,'inspection/before-drag-animation.json'))),now=JSON.parse(fs.readFileSync(path.join(root,'hinata-raincoat.json')));
 const mechanical=name=>name.startsWith('claw_');
 assert.deepEqual(now.bones.filter(b=>!mechanical(b.name)),before.bones,'Existing bones changed');
 assert.deepEqual(now.slots.filter(s=>!mechanical(s.name)),before.slots,'Existing slots changed');
 for(const [slot,attachments]of Object.entries(before.skins[0].attachments))assert.deepEqual(now.skins[0].attachments[slot],attachments,'Existing mesh changed: '+slot);
 for(const [id,anim]of Object.entries(before.animations)){
  const actual={...now.animations[id],bones:Object.fromEntries(Object.entries(now.animations[id].bones).filter(([name])=>!mechanical(name)))};
  assert.deepEqual(actual,anim,'Existing animation changed: '+id);
 }
 const previous=JSON.parse(fs.readFileSync(path.join(root,'inspection/before-claw.json')));
 for(const id of ['put_down'])for(const key of ['bones','slots','deform','events']){
  const actual=['bones','slots'].includes(key)?Object.fromEntries(Object.entries(now.animations[id][key]).filter(([name])=>!mechanical(name))):now.animations[id][key];
  assert.deepEqual(actual,previous.animations[id][key],id+' character '+key+' changed');
 }
 assert.equal(now.bones.length-before.bones.length,6);assert.equal(now.slots.length-before.slots.length,8);
 assert.ok(now.animations.claw_release,'Missing independent jaw-release animation');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/')+'?view=drag');await page.waitForFunction(()=>window.petPreview?.ready);
 const canvas=page.locator('#canvas-drag_hold');await canvas.scrollIntoViewIfNeeded();
 const state=()=>page.evaluate(()=>petPreview.dragState('drag_hold'));
 const equipment=()=>page.evaluate(()=>{const p=petPreview.players.find(p=>p.def.id==='drag_hold'),root=p.skeleton.findBone('claw_root');return{visible:p.skeleton.slots.filter(s=>s.data.name.startsWith('claw_')&&s.getAttachment()&&s.color.a>.01).map(s=>s.data.name),hub:{x:root.worldX,y:root.worldY},releaseTrack:p.drag.state?.getCurrent(1)?.animation.name||null,upper:p.skeleton.findBone('claw_upper_L').rotation};});
 assert.equal((await equipment()).visible.length,0,'Claw visible during idle');
 async function headPoint(){return page.evaluate(()=>{const p=petPreview.players.find(p=>p.def.id==='drag_hold'),b=p.skeleton.findBone('head'),c=p.renderer.camera,r=p.canvas.getBoundingClientRect();const point=b.localToWorld({x:0,y:220});return{x:r.left+(point.x-c.position.x)/c.viewportWidth*r.width+r.width/2,y:r.top-(point.y-c.position.y)/c.viewportHeight*r.height+r.height/2};});}
 let pos=await headPoint();await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.waitForTimeout(80);await page.mouse.up();await page.waitForTimeout(350);assert.equal((await state()).phase,'idle','Short click activated drag');
 const rect=await canvas.boundingBox();await page.mouse.move(rect.x+8,rect.y+8);await page.mouse.down();await page.waitForTimeout(400);assert.equal((await state()).phase,'idle','Transparent background can be grabbed');await page.mouse.up();
 pos=await headPoint();await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.waitForTimeout(360);assert.ok(['pickup','held'].includes((await state()).phase),'Long press failed');
 await page.mouse.move(pos.x+80,pos.y-115,{steps:14});await page.waitForTimeout(500);let held=await state();assert.equal(held.animation,'drag_hold');assert.equal(held.phase,'held');assert.ok(held.offset.y>150,'Dragging did not lift character');
 const error=await page.evaluate(()=>{const p=petPreview.players.find(p=>p.def.id==='drag_hold'),s=p.drag.snapshot(),c=p.renderer.camera,r=p.canvas.getBoundingClientRect(),x=r.left+(s.anchor.x-c.position.x)/c.viewportWidth*r.width+r.width/2,y=r.top-(s.anchor.y-c.position.y)/c.viewportHeight*r.height+r.height/2;return Math.hypot(x-s.pointer.x,y-s.pointer.y);});assert.ok(error<.05,'Grab point slipped: '+error);
 const png=Buffer.from(await canvas.evaluate(c=>c.toDataURL().split(',')[1]),'base64');await sharp(png).resize(620,760).flatten({background:'#faf3e7'}).png().toFile(path.join(root,'drag-held-preview.png'));
 const heldClaw=await equipment();assert.equal(heldClaw.visible.length,8,'Not all claw parts visible during hold');
 await page.mouse.up();await page.waitForTimeout(80);assert.equal((await state()).phase,'dropping');const opening=await equipment();assert.equal(opening.releaseTrack,'claw_release');assert.ok(Math.abs(opening.upper-heldClaw.upper)>2,'Jaws did not open immediately on release');assert.ok(opening.hub.y>=heldClaw.hub.y-10,'Machine fell with the character');
 await page.waitForTimeout(700);let released=await state();assert.equal(released.phase,'idle');assert.equal(released.animation,'idle');assert.equal(released.offset.y,0);assert.equal((await equipment()).visible.length,0,'Claw remained visible after release');assert.equal((await equipment()).releaseTrack,null);
 pos=await headPoint();await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.waitForTimeout(400);await page.mouse.move(rect.x-15,pos.y-20,{steps:8});await page.mouse.up();await page.waitForTimeout(800);assert.equal((await state()).phase,'idle','Releasing outside canvas stuck drag');
 pos=await headPoint();await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.waitForTimeout(400);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();await page.waitForTimeout(800);assert.equal((await state()).phase,'idle','Focus loss stuck drag');
 const report={existingAnimationsUnchanged:Object.keys(before.animations),existingMeshesAndBonesUnchanged:true,landingCharacterTimelinesUnchanged:true,requestedHeldSwayFactor:1.5,addedMechanicalBones:6,addedMechanicalParts:8,shortClickIgnored:true,transparentBackgroundIgnored:true,longPressMs:300,pointerAnchoringErrorPixels:error,heldAnimation:held.animation,dragLiftSourcePixels:held.offset.y,claw:{heldParts:heldClaw.visible,opensImmediatelyOnRelease:true,independentReleaseTrack:opening.releaseTrack,machineStaysAboveDroppingCharacter:true,hiddenDuringIdle:true,releaseTrackCleared:true},releaseReturnsIdle:true,releaseOutsideCanvas:true,focusLossReleases:true,pageErrors:errors};
 assert.equal(errors.length,0);fs.writeFileSync(path.join(root,'drag-interaction-validation.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exit(1);});
