// Capture genuine pointer events and AnimationState transitions in the browser.
const fs=require('fs'),path=require('path');
const deps='C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),sharp=require(deps+'sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}});await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/')+'?view=drag');await page.waitForFunction(()=>petPreview?.ready);
 const canvas=page.locator('#canvas-drag_hold');await canvas.scrollIntoViewIfNeeded();
 const start=await page.evaluate(()=>{const p=petPreview.players.find(p=>p.def.id==='drag_hold'),r=p.canvas.getBoundingClientRect(),c=p.renderer.camera,v=p.skeleton.findBone('head').localToWorld({x:0,y:220});return{x:r.left+r.width/2+(v.x-c.position.x)/c.viewportWidth*r.width,y:r.top+r.height/2-(v.y-c.position.y)/c.viewportHeight*r.height};});
 await page.mouse.move(start.x,start.y);await page.mouse.down();const clock=Date.now(),poses=[];
 for(let i=0;i<72;i++){
  const wait=clock+i*50-Date.now();if(wait>0)await page.waitForTimeout(wait);
  if(i>=12&&i<=30){const u=(i-12)/18;await page.mouse.move(start.x+70*u,start.y-110*u);}
  if(i>=33&&i<=43){const u=(i-33)/10;await page.mouse.move(start.x+70-95*u,start.y-110-20*Math.sin(u*Math.PI));}
  if(i===46)await page.mouse.up();
  const image=Buffer.from(await canvas.evaluate(c=>c.toDataURL().split(',')[1]),'base64');
  await sharp(image).resize(420,515).flatten({background:'#faf3e7'}).png().toFile(path.join(root,'frames',`drag-demo-${String(i).padStart(3,'0')}.png`));
  poses.push(await page.evaluate(()=>petPreview.dragState('drag_hold')));
 }
 fs.writeFileSync(path.join(root,'inspection/drag-demo-states.json'),JSON.stringify(poses,null,2)+'\n');await browser.close();console.log(JSON.stringify({frames:72,seconds:3.6,phases:[...new Set(poses.map(p=>p.phase))],final:poses.at(-1).phase}));
})().catch(e=>{console.error(e);process.exit(1);});
