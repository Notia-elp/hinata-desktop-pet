const fs=require('fs'),path=require('path');
const deps='C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),{chromium}=require(deps+'playwright');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const tag=process.argv[2]||'current';
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}});
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/')+'?view=hop&focus=hem');await page.waitForFunction(()=>petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 const tiles=[];
 for(const t of [0,.61,1.28,2.05]){
  const png=Buffer.from(await page.evaluate(t=>{petPreview.renderAt('hop',t);return petPreview.players.find(p=>p.def.id==='hop').canvas.toDataURL().split(',')[1];},t),'base64');
  await sharp(png).resize(620,760).flatten({background:'#faf3e7'}).png().toFile(path.join(root,'inspection',`garment-${tag}-${t}.png`));
  const tile=await sharp(png).resize(310,380).flatten({background:'#faf3e7'}).png().toBuffer();tiles.push({input:tile,left:(tiles.length%2)*310,top:Math.floor(tiles.length/2)*380});
 }
 await sharp({create:{width:620,height:760,channels:4,background:'#faf3e7'}}).composite(tiles).png().toFile(path.join(root,`garment-${tag}-review.png`));
 await browser.close();console.log('Saved garment-'+tag+'-review.png');
})().catch(e=>{console.error(e);process.exit(1);});
