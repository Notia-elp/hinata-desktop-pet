const fs=require('fs'),path=require('path');
const deps='C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),{chromium}=require(deps+'playwright');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const tag=process.argv[2]||'current',browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}});
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready);
 await page.locator('#view').selectOption('hop');await page.locator('#focus').selectOption('face');
 const tiles=[];
 const times=process.argv[3]?process.argv[3].split(',').map(Number):[0,.57,1.22,1.28];
 for(const t of times)for(const rear of [true,false]){
  const png=Buffer.from(await page.evaluate(({t,rear})=>{
   const p=petPreview.players.find(p=>p.def.id==='hop');p.skeleton.findSlot('hair_rear_complete').color.a=rear?1:0;
   petPreview.renderAt('hop',t); // setToSetupPose restores slot alpha, so mask after posing
   p.skeleton.findSlot('hair_rear_complete').color.a=rear?1:0;
   const r=p.renderer,gl=r.context.gl;gl.clear(gl.COLOR_BUFFER_BIT);r.begin();r.drawSkeleton(p.skeleton,false);r.end();gl.finish();
   return p.canvas.toDataURL().split(',')[1];
  },{t,rear}),'base64');
  const tile=await sharp(png).extract({left:0,top:190,width:620,height:1200}).resize(310,600).flatten({background:'#faf3e7'}).png().toBuffer();
  fs.writeFileSync(path.join(root,'inspection',`left-${tag}-${t}-${rear?'rear':'front'}.png`),tile);
  tiles.push({input:tile,left:(tiles.length%2)*310,top:Math.floor(tiles.length/2)*600});
 }
 await sharp({create:{width:620,height:times.length*600,channels:4,background:'#faf3e7'}}).composite(tiles).png().toFile(path.join(root,`left-hair-${tag}.png`));
 await browser.close();console.log('Saved left-hair-'+tag+'.png; left rear visible / right front only');
})().catch(e=>{console.error(e);process.exit(1);});
