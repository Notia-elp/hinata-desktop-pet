const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-joints-v4');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1200,height:1200}});await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/')+'?view=hop&focus=hem');await page.waitForFunction(()=>petPreview?.ready);await page.evaluate(()=>petPreview.pause());
const names=['coat_rear','shorts_surface','shorts_hidden','coat_surface','coat_occlusion_underlay','leg_L','arm_L','boot_L'];const parts=[];
for(const name of names){const b64=await page.evaluate(name=>{petPreview.renderAt('hop',.82);const p=petPreview.players.find(p=>p.def.id==='hop'),r=p.renderer,gl=r.context.gl;for(const slot of p.skeleton.slots)slot.color.a=slot.data.name===name?1:0;gl.clear(gl.COLOR_BUFFER_BIT);r.begin();r.drawSkeleton(p.skeleton,false);r.end();return p.canvas.toDataURL().split(',')[1]},name);
const img=await sharp(Buffer.from(b64,'base64')).resize(420,500,{fit:'contain'}).png().toBuffer();parts.push({input:img,left:(parts.length%4)*420,top:Math.floor(parts.length/4)*550+40});
const label=await sharp(Buffer.from(`<svg width="420" height="40"><text x="10" y="30" font-size="22">${name}</text></svg>`)).png().toBuffer();parts.push({input:label,left:((parts.length-1)/2%4)*420,top:Math.floor((parts.length-1)/2/4)*550});
}
// positions based on pair count
parts.forEach((p,i)=>{const n=Math.floor(i/2);p.left=n%4*420;p.top=Math.floor(n/4)*550+(i%2?0:40)});
await sharp({create:{width:1680,height:1100,channels:4,background:'#e5dfd0'}}).composite(parts).png().toFile(path.join(root,'inspection/surface-diagnosis.png'));await browser.close();})();
