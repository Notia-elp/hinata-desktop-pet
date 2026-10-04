const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-joints-v3');
function islands(alpha,w,h){
 const seen=new Uint8Array(w*h),sizes=[],queue=new Int32Array(w*h);
 for(let i=0;i<seen.length;i++)if(!seen[i]&&alpha[i*4+3]>=128){let a=0,b=1;queue[0]=i;seen[i]=1;
  while(a<b){const j=queue[a++],x=j%w,y=Math.floor(j/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const k=(y+dy)*w+x+dx;if(!seen[k]&&alpha[k*4+3]>=128){seen[k]=1;queue[b++]=k;}}}sizes.push(b);
 }return sizes.sort((a,b)=>b-a);
}
(async()=>{
 fs.mkdirSync(path.join(root,'inspection'),{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1300,height:1300},deviceScaleFactor:2});
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/')+'?view=hop');await page.waitForFunction(()=>window.petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 const stats=[],proof=[];
 for(const id of ['idle','hop','happy_bounce']){
  await page.locator('#view').selectOption(id);const duration=id==='idle'?3.2:2.4;
  for(let i=0;i<Math.round(duration*30);i++){
   const t=i/30;await page.evaluate(({id,t})=>petPreview.renderAt(id,t),{id,t});
   const png=Buffer.from(await page.evaluate(id=>petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1],id),'base64');
   const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});const cc=islands(data,info.width,info.height);
   stats.push({animation:id,time:t,mainPixels:cc[0],largestDetachedPixels:cc[1]||0});
  }
 }
 for(const [name,id,t] of [['原始站姿','hop',0],['屈膝蓄力','hop',.34],['腾空摆臂','hop',.82],['落地缓冲','hop',1.28]]){
  await page.locator('#view').selectOption(id);await page.evaluate(({id,t})=>petPreview.renderAt(id,t),{id,t});
  const png=Buffer.from(await page.evaluate(id=>petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1],id),'base64');
  await sharp(png).png().toFile(path.join(root,'inspection',id+'-'+t.toFixed(2)+'.png'));
  const label=Buffer.from(`<svg width="620" height="60"><text x="310" y="37" text-anchor="middle" font-size="25" font-family="Microsoft YaHei" fill="#50443a">${name} · ${t.toFixed(2)} s</text></svg>`);
  proof.push({input:await sharp(png).resize({width:620}).png().toBuffer(),left:proof.length/2*620,top:60});proof.push({input:label,left:(proof.length-1)/2*620,top:0});
 }
 await sharp({create:{width:2480,height:820,channels:4,background:'#f7f1e7'}}).composite(proof).png().toFile(path.join(root,'keyframes-review.png'));
 const report={sampledFrames:stats.length,alphaThreshold:128,pixelRatio:2,largestDetachedPixels:Math.max(...stats.map(s=>s.largestDetachedPixels)),frames:stats};
 fs.writeFileSync(path.join(root,'visual-connectivity.json'),JSON.stringify(report,null,2));
 if(report.largestDetachedPixels>20)throw Error('Visible detached component found: '+JSON.stringify(stats.filter(s=>s.largestDetachedPixels>20)));
 console.log(JSON.stringify({sampledFrames:report.sampledFrames,largestDetachedPixels:report.largestDetachedPixels}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
