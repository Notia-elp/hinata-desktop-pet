const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 const poses=[['hop',0],['hop',.57],['hop',.82],['hop',.933333],['hop',1.28],['happy_bounce',1.333333],['happy_bounce',1.533333],['happy_bounce',1.6],['head_juggle',.45]],tiles=[];
 for(const [id,t]of poses){await page.locator('#view').selectOption(id);await page.locator('#focus').selectOption('face');await page.evaluate(({id,t})=>petPreview.renderAt(id,t),{id,t});
  const png=Buffer.from(await page.evaluate(id=>petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1],id),'base64'),name=`contour-${id}-${t.toFixed(2)}.png`;
  const tile=await sharp(png).resize(420,515,{fit:'contain',background:'#faf3e7'}).flatten({background:'#faf3e7'}).png().toBuffer();fs.writeFileSync(path.join(root,'inspection',name),tile);
  tiles.push({input:tile,left:(tiles.length%3)*420,top:Math.floor(tiles.length/3)*515});
 }
 await sharp({create:{width:1260,height:1545,channels:4,background:'#faf3e7'}}).composite(tiles).png().toFile(path.join(root,'head-contours-review.png'));
 await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({poses:poses.length,errors}));
})().catch(e=>{console.error(e);process.exit(1);});
