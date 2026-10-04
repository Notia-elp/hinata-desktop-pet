const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-preview');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1220,height:870},deviceScaleFactor:1});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Test offline opening exactly as the user will open the delivered HTML.
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready,{timeout:30000});
 await page.evaluate(()=>petPreview.pause());
 const data=JSON.parse(fs.readFileSync(path.join(root,'hinata-raincoat.json')));
 const report=await page.evaluate(data=>{
   const result={runtimeLoads:true,animations:[],registrationMaxError:0,loopMaxError:0,finiteVertices:true};
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
       maxMove=Math.max(maxMove,Math.abs(s.bones.find(b=>b.name==='motion').y));
     }
     result.animations.push({name:p.def.id,duration:p.animation.duration,highestMeshY:peak,lowestMeshY:lowest,maximumRootLift:maxMove});
   }
   return result;
 },data).catch(async e=>{throw e;});
 await page.click('#setup');await page.screenshot({path:path.join(root,'preview-rest.png'),fullPage:true});
 await page.evaluate(()=>petPreview.renderAll(.65));await page.screenshot({path:path.join(root,'preview-actions.png'),fullPage:true});
 await page.check('#bones');await page.screenshot({path:path.join(root,'preview-bones.png'),fullPage:true});await page.uncheck('#bones');
 await page.click('#reset');await page.waitForTimeout(250);const before=await page.locator('.status').first().textContent();await page.click('#play');await page.waitForTimeout(120);const after=await page.locator('.status').first().textContent();
 report.controls={playingAdvancesTime:before!=='0.00 s / 3.2 s',pauseLabel:await page.locator('#play').textContent()};
 await page.locator('.slider').first().fill('1.2');report.controls.scrubWorks=(await page.locator('.status').first().textContent()).startsWith('1.20');
 fs.mkdirSync(path.join(root,'frames'),{recursive:true});
 // One common 9.6-second period: idle loops three times, each jump four.
 for(let i=0;i<144;i++){
   const t=i/15;
   await page.evaluate(t=>{petPreview.pause();for(const p of petPreview.players)petPreview.renderAt(p.def.id,t%p.def.duration);},t);
   const frame=await page.locator('#grid').screenshot();
   await sharp(frame).resize({width:900}).png().toFile(path.join(root,'frames','all-'+String(i).padStart(3,'0')+'.png'));
 }
  report.browserErrors=errors;report.offlineFileOpen=true;report.previewFrames=144;
  report.uncropped=report.animations.every(a=>a.highestMeshY<2050&&a.lowestMeshY>-100);
  if(!report.uncropped||!report.finiteVertices||report.registrationMaxError>.005||report.loopMaxError>.005||errors.length)throw Error('Spine validation failed: '+JSON.stringify(report));
 fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
