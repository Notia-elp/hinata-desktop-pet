const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
function islands(raw,w,h){const mask=new Uint8Array(w*h),q=new Int32Array(w*h),sizes=[];
 for(let i=0;i<mask.length;i++)if(!mask[i]&&raw[i*4+3]>=128){let a=0,b=1;mask[i]=1;q[0]=i;while(a<b){const p=q[a++],x=p%w,y=Math.floor(p/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h){const n=(y+dy)*w+x+dx;if(!mask[n]&&raw[n*4+3]>=128){mask[n]=1;q[b++]=n;}}}sizes.push(b);}return sizes.sort((a,b)=>b-a);}
function holes(raw,w,h){const seen=new Uint8Array(w*h),q=new Int32Array(w*h),out=[];
 for(let i=0;i<seen.length;i++)if(!seen[i]&&raw[i*4+3]<24){let a=0,b=1,border=false,sumX=0,sumY=0;seen[i]=1;q[0]=i;
  while(a<b){const n=q[a++],x=n%w,y=Math.floor(n/w);sumX+=x;sumY+=y;if(!x||!y||x===w-1||y===h-1)border=true;for(const j of [x?n-1:-1,x<w-1?n+1:-1,y?n-w:-1,y<h-1?n+w:-1])if(j>=0&&!seen[j]&&raw[j*4+3]<24){seen[j]=1;q[b++]=j;}}
  if(!border&&b>=4)out.push({pixels:b,x:sumX/b,y:sumY/b});
 }return out.sort((a,b)=>b.pixels-a.pixels);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 const stats=[],poses=[],cavities=[];
 const jumpOnly=process.argv.includes('--jump-only');
 const dragOnly=process.argv.includes('--drag-only');
 const definitions=(await page.evaluate(()=>petPreview.players.map(p=>[p.def.id,p.def.duration]))).filter(([id])=>(!jumpOnly||['hop','happy_bounce','proud_hops'].includes(id))&&(!dragOnly||['pickup','drag_hold','put_down'].includes(id)));
 const audits=[...definitions.map(([id,duration])=>({id,duration,focus:'full',fps:30})),...definitions.map(([id,duration])=>({id,duration,focus:'face',fps:15}))];
 for(const {id,duration,focus,fps}of audits){
  await page.locator('#view').selectOption(id);await page.locator('#focus').selectOption(focus);
  for(let i=0;i<Math.round(duration*fps);i++){
   const t=i/fps;const result=await page.evaluate(({id,t})=>{petPreview.renderAt(id,t);const p=petPreview.players.find(p=>p.def.id===id),props=p.skeleton.slots.filter(s=>s.data.name==='volleyball'||s.data.name.startsWith('claw_')),alpha=props.map(s=>s.color.a);for(const s of props)s.color.a=0;
    const r=p.renderer,gl=r.context.gl;gl.clear(gl.COLOR_BUFFER_BIT);r.begin();r.drawSkeleton(p.skeleton,false);r.end();gl.finish();const png=p.canvas.toDataURL().split(',')[1];props.forEach((s,i)=>s.color.a=alpha[i]);return png;},{id,t});
   const {data,info}=await sharp(Buffer.from(result,'base64')).resize({width:620}).ensureAlpha().raw().toBuffer({resolveWithObject:true});const cc=islands(data,info.width,info.height),empty=holes(data,info.width,info.height);stats.push({id,t,focus,main:cc[0],detached:cc[1]||0,holes:empty});
  }
 }
 for(const [id,t]of [['head_juggle',0],['head_juggle',.225],['head_juggle',.45],['head_juggle',.675],['head_juggle',.9],['proud_hops',.2],['proud_hops',.63],['proud_hops',1.08]]){
  await page.locator('#view').selectOption(id);await page.evaluate(({id,t})=>petPreview.renderAt(id,t),{id,t});
  const png=Buffer.from(await page.evaluate(id=>petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1],id),'base64');const tile=await sharp(png).resize(310,380).flatten({background:'#faf3e7'}).png().toBuffer();poses.push({input:tile,left:(poses.length%4)*310,top:Math.floor(poses.length/4)*380});
  await page.locator('#focus').selectOption('boots');await page.evaluate(({id,t})=>petPreview.renderAt(id,t),{id,t});
  const result=await page.evaluate(id=>{const p=petPreview.players.find(p=>p.def.id===id),r=p.renderer,gl=r.context.gl;for(const slot of p.skeleton.slots)if(!slot.data.name.startsWith('boot_'))slot.color.a=0;gl.clear(gl.COLOR_BUFFER_BIT);r.begin();r.drawSkeleton(p.skeleton,false);r.end();gl.finish();
   const points=['L','R'].map(side=>{const b=p.skeleton.findBone('foot_'+side),w=r.camera.viewportWidth,h=r.camera.viewportHeight;return {side,x:Math.round((b.worldX-r.camera.position.x+w/2)/w*p.canvas.width),y:Math.round((r.camera.position.y+h/2-b.worldY)/h*p.canvas.height)};});const png=p.canvas.toDataURL().split(',')[1];for(const slot of p.skeleton.slots)slot.color.a=1;return {png,points};},id);
  const {data,info}=await sharp(Buffer.from(result.png,'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(const p of result.points){const alpha=data[(p.y*info.width+p.x)*4+3];cavities.push({id,t,side:p.side,alpha});if(alpha<240)throw Error('Boot interior hole');}
 }
 await sharp({create:{width:1240,height:760,channels:4,background:'#faf3e7'}}).composite(poses).png().toFile(path.join(root,'keyframes-review.png'));
 await page.locator('#view').selectOption('head_juggle');for(const name of ['stunned','shocked','grin','determined']){await page.locator('#expression').selectOption(name);const snap=await page.evaluate(()=>petPreview.renderAt('head_juggle',.45));for(const slot of ['eye_L','eye_R','mouth','brow_L','brow_R'])if(snap.attachments[snap.slotNames.indexOf(slot)]!==slot+'_'+name)throw Error('Expression override failed '+name);}
 await page.locator('#expression').selectOption('auto');await page.locator('#focus').selectOption('full');await page.locator('#speed').selectOption('.5').catch(()=>page.locator('#speed').selectOption('0.5'));
 await page.click('#reset');await page.waitForTimeout(200);const t1=await page.locator('.card:visible .slider').inputValue();await page.click('#play');await page.waitForTimeout(100);const t2=await page.locator('.card:visible .slider').inputValue();if(Number(t1)<=0||Math.abs(Number(t2)-Number(t1))>.06)throw Error('Pause/play controls failed');
 await page.locator('.card:visible .slider').fill('1.2');if(!(await page.locator('.card:visible .status').textContent()).startsWith('1.20'))throw Error('Scrub failed');
 await page.locator('#view').selectOption('all');await page.evaluate(()=>petPreview.renderAll(.45));await page.screenshot({path:path.join(root,'preview-actions.png'),fullPage:true});
 await page.locator('#view').selectOption('expressions');await page.evaluate(()=>petPreview.renderAll(.7));await page.screenshot({path:path.join(root,'preview-expressions.png'),fullPage:true});
 const report={frames:stats.length,animations:definitions.map(([id])=>id),largestDetachedPixels:Math.max(...stats.map(s=>s.detached)),largestEnclosedHolePixels:Math.max(0,...stats.flatMap(s=>s.holes.map(h=>h.pixels))),alphaThreshold:128,holeAlphaThreshold:24,minimumRecordedHolePixels:4,comparisonWidth:620,ballExcludedFromConnectivity:true,mechanismExcludedFromBodyConnectivity:true,cavities,controls:{expressionOverrides:true,pausePlay:true,slowMotion:true,scrub:true},errors,stats};
 fs.writeFileSync(path.join(root,dragOnly?'drag-visual-validation.json':jumpOnly?'visual-validation-mouth.json':'visual-validation.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({frames:report.frames,largestDetachedPixels:report.largestDetachedPixels,largestEnclosedHolePixels:report.largestEnclosedHolePixels,holes:stats.filter(s=>s.holes.length).slice(0,12),minimumBootInteriorAlpha:Math.min(...cavities.map(c=>c.alpha)),controls:report.controls,errors}));if(errors.length||report.largestDetachedPixels>50||report.largestEnclosedHolePixels>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
