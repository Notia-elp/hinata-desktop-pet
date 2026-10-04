const fs=require('fs'),path=require('path');
const deps='C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),sharp=require(deps+'sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}});await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/')+'?view=drag_hold');await page.waitForFunction(()=>petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 const tiles=[];
 for(const [id,t]of [['pickup',0],['pickup',.18],['pickup',.36],['drag_hold',.6],['drag_hold',1.2],['drag_hold',1.8],['put_down',.25],['put_down',.33],['put_down',.5]]){
  await page.locator('#view').selectOption(id);
  const png=Buffer.from(await page.evaluate(({id,t})=>{petPreview.renderAt(id,t);return petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1];},{id,t}),'base64');
  const tile=await sharp(png).resize(310,380).flatten({background:'#faf3e7'}).png().toBuffer();tiles.push({input:tile,left:tiles.length%3*310,top:Math.floor(tiles.length/3)*380});
 }
 await sharp({create:{width:930,height:1140,channels:4,background:'#faf3e7'}}).composite(tiles).png().toFile(path.join(root,'drag-keyframes-review.png'));
 for(const [id,duration]of [['pickup',.36],['drag_hold',2.4],['put_down',.5]]){
  await page.locator('#view').selectOption(id);const count=Math.round(duration*30);
  for(let i=0;i<count;i++){const png=Buffer.from(await page.evaluate(({id,t})=>{petPreview.renderAt(id,t);return petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1];},{id,t:i/30}),'base64');await sharp(png).resize(420,515).flatten({background:'#faf3e7'}).png().toFile(path.join(root,'frames',`drag-${id}-${String(i).padStart(3,'0')}.png`));}
 }
 await browser.close();console.log('Saved drag-keyframes-review.png and 30 fps interaction captures');
})().catch(e=>{console.error(e);process.exit(1);});
