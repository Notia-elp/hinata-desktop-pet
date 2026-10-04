const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-joints-v4');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1220,height:870},deviceScaleFactor:1});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Test offline opening exactly as the user will open the delivered HTML.
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready,{timeout:30000});
 await page.evaluate(()=>petPreview.pause());
 const data=JSON.parse(fs.readFileSync(path.join(root,'hinata-raincoat.json')));
 const report=await page.evaluate(data=>{
   const result={runtimeLoads:true,animations:[],registrationMaxError:0,loopMaxError:0,finiteVertices:true,groundedAnkleError:0,groundedFootAngleError:0,rigidBootLengthError:0,gripContactError:0,faceAnimated:false,hairRange:0};
   const rest=petPreview.sample('idle',0,true);
   data.slots.forEach((s,i)=>{const a=data.skins[0].attachments[s.name][s.name];for(let v=0;v<a.uvs.length;v+=2){
     // Layer crop is registered at the approved source position.
     const l=window.PET_DATA.layers.find(l=>l.id===s.name);
     const x=l.x+a.uvs[v]*l.width-512,y=1536-l.y-a.uvs[v+1]*l.height;
     result.registrationMaxError=Math.max(result.registrationMaxError,Math.abs(x-rest.vertices[i][v]),Math.abs(y-rest.vertices[i][v+1]));
   }});
   for(const p of petPreview.players){
     let peak=-Infinity,lowest=Infinity,maxMove=0;const a=petPreview.sample(p.def.id,0),end=petPreview.sample(p.def.id,p.def.duration);
     for(let i=0;i<a.vertices.length;i++)for(let j=0;j<a.vertices[i].length;j++)result.loopMaxError=Math.max(result.loopMaxError,Math.abs(a.vertices[i][j]-end.vertices[i][j]));
     for(let t=0;t<=p.def.duration;t+=1/30){const s=petPreview.sample(p.def.id,t);peak=Math.max(peak,s.bounds.maxY);lowest=Math.min(lowest,s.bounds.minY);for(const v of s.vertices)for(const n of v)if(!Number.isFinite(n))result.finiteVertices=false;
       for(const [side,gx,gy]of [['L',404,1045],['R',719,1111]]){
        const contact=id=>{const k=data.slots.findIndex(q=>q.name===id),l=PET_DATA.layers.find(q=>q.id===id),a=data.skins[0].attachments[id][id];let best=Infinity,index=-1;
          for(let v=0;v<a.uvs.length;v+=2){const d=Math.hypot(l.x+a.uvs[v]*l.width-gx,l.y+a.uvs[v+1]*l.height-gy);if(d<best){best=d;index=v;}}
          if(best>.001)throw Error('Grip vertex missing');return [s.vertices[k][index],s.vertices[k][index+1]];};
        const hand=contact('arm_'+side),cloth=contact('coat_surface');result.gripContactError=Math.max(result.gripContactError,Math.hypot(hand[0]-cloth[0],hand[1]-cloth[1]));
       }
       for(const side of ['L','R']){const k=data.slots.findIndex(q=>q.name==='boot_'+side),v=s.vertices[k],r=rest.vertices[k];for(let j=2;j<v.length;j+=2){const d=Math.hypot(v[j]-v[0],v[j+1]-v[1]),d0=Math.hypot(r[j]-r[0],r[j+1]-r[1]);result.rigidBootLengthError=Math.max(result.rigidBootLengthError,Math.abs(d-d0));}}
       maxMove=Math.max(maxMove,Math.abs(s.bones.find(b=>b.name==='motion').y));
     }
     const metrics={};
     for(const joint of ['forearm_L','forearm_R','shin_L','shin_R']){const rotations=[];for(let t=0;t<=p.def.duration;t+=1/60)rotations.push(petPreview.sample(p.def.id,t).bones.find(b=>b.name===joint).r);metrics[joint]={min:Math.min(...rotations),max:Math.max(...rotations),range:Math.max(...rotations)-Math.min(...rotations)};}
     const grounded=p.def.id==='hop'?[.2,.34,1.28,1.5]:p.def.id==='happy_bounce'?[.2,1.08,2.08]:[];
     for(const t of grounded){const s=petPreview.sample(p.def.id,t);for(const side of ['L','R']){const b=s.bones.find(b=>b.name==='foot_'+side),c=PET_DATA.chains['leg_'+side];result.groundedAnkleError=Math.max(result.groundedAnkleError,Math.hypot(b.worldX-c.c.x,b.worldY-c.c.y));result.groundedFootAngleError=Math.max(result.groundedFootAngleError,Math.abs(((b.worldRotation-180+540)%360)-180));}}
     result.animations.push({name:p.def.id,duration:p.animation.duration,highestMeshY:peak,lowestMeshY:lowest,maximumRootLift:maxMove,jointAngles:metrics});
     const hair=[];for(let t=0;t<=p.def.duration;t+=1/30)hair.push(petPreview.sample(p.def.id,t).bones.find(b=>b.name==='hair').r);result.hairRange=Math.max(result.hairRange,Math.max(...hair)-Math.min(...hair));
   }
   result.faceAnimated=['eye_L','eye_R','brow_L','brow_R','nose','mouth'].every(id=>{const a=petPreview.sample('hop',0).bones.find(b=>b.name===id),b=petPreview.sample('hop',.83).bones.find(b=>b.name===id);return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.r-b.r)+Math.abs(a.sx-b.sx)+Math.abs(a.sy-b.sy)>.001;});
   return result;
 },data).catch(async e=>{throw e;});
 await page.click('#setup');await page.screenshot({path:path.join(root,'preview-rest.png'),fullPage:true});
 await page.evaluate(()=>petPreview.renderAll(.65));await page.screenshot({path:path.join(root,'preview-actions.png'),fullPage:true});
 await page.evaluate(()=>petPreview.renderAll(.34));await page.screenshot({path:path.join(root,'preview-crouch.png'),fullPage:true});
 await page.evaluate(()=>petPreview.renderAll(.82));await page.screenshot({path:path.join(root,'preview-fold.png'),fullPage:true});
 await page.check('#bones');await page.screenshot({path:path.join(root,'preview-bones.png'),fullPage:true});await page.uncheck('#bones');
 await page.click('#reset');await page.waitForTimeout(250);const before=await page.locator('.status').first().textContent();await page.click('#play');await page.waitForTimeout(120);const after=await page.locator('.status').first().textContent();
 report.controls={playingAdvancesTime:before!=='0.00 s / 3.2 s',pauseLabel:await page.locator('#play').textContent()};
 await page.locator('.slider').first().fill('1.2');report.controls.scrubWorks=(await page.locator('.status').first().textContent()).startsWith('1.20');
 await page.locator('#view').selectOption('hop');await page.evaluate(()=>petPreview.renderAt('hop',.82));await page.screenshot({path:path.join(root,'preview-enlarged.png'),fullPage:true});
 report.controls.enlargedViewWorks=await page.locator('.card:visible').count()===1;await page.locator('#view').selectOption('all');
 fs.mkdirSync(path.join(root,'frames'),{recursive:true});
 if(process.argv.includes('--zoom')){
   await page.locator('#view').selectOption('hop');
   for(let i=0;i<36;i++){await page.evaluate(t=>petPreview.renderAt('hop',t),i/15);const frame=await page.locator('.card:visible .stage').screenshot();await sharp(frame).resize({width:480}).png().toFile(path.join(root,'frames','zoom-'+String(i).padStart(3,'0')+'.png'));}
   await page.locator('#view').selectOption('all');
 }
 // One common 9.6-second period: idle loops three times, each jump four.
 const frameCount=process.argv.includes('--quick')?0:144;
 for(let i=0;i<frameCount;i++){
   const t=i/15;
   await page.evaluate(t=>{petPreview.pause();for(const p of petPreview.players)petPreview.renderAt(p.def.id,t%p.def.duration);},t);
   const frame=await page.locator('#grid').screenshot();
   await sharp(frame).resize({width:900}).png().toFile(path.join(root,'frames','all-'+String(i).padStart(3,'0')+'.png'));
 }
  report.browserErrors=errors;report.offlineFileOpen=true;report.previewFrames=fs.readdirSync(path.join(root,'frames')).filter(n=>n.startsWith('all-')).length;report.framesRenderedThisRun=frameCount;
  report.zoomPreviewFrames=fs.readdirSync(path.join(root,'frames')).filter(n=>n.startsWith('zoom-')).length;
  report.uncropped=report.animations.every(a=>a.highestMeshY<2050&&a.lowestMeshY>-100);
  report.articulated=report.animations.filter(a=>a.name!=='idle').every(a=>Object.values(a.jointAngles).every(j=>j.range>25));
  if(!report.uncropped||!report.articulated||!report.finiteVertices||report.registrationMaxError>.005||report.loopMaxError>.005||report.groundedAnkleError>.1||report.groundedFootAngleError>.1||report.rigidBootLengthError>.01||report.gripContactError>.01||!report.faceAnimated||report.hairRange<25||errors.length)throw Error('Spine validation failed: '+JSON.stringify(report));
 fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
