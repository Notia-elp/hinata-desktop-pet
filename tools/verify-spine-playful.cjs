const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
async function main(){
 const data=JSON.parse(fs.readFileSync(path.join(root,'hinata-raincoat.json'))),old=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../output/hinata-spine-joints-v4/hinata-raincoat.json')));
 const legacy=[];for(const id of Object.keys(old.animations)){
  for(const b of old.bones){if(['hair','hair_L','hair_R'].includes(b.name)||(b.name==='mouth'&&['hop','happy_bounce'].includes(id)))continue;if(JSON.stringify(old.animations[id].bones[b.name])!==JSON.stringify(data.animations[id].bones[b.name]))throw Error('Approved bone timeline changed: '+id+' '+b.name);}
  for(const s of Object.keys(old.animations[id].slots))if(JSON.stringify(old.animations[id].slots[s])!==JSON.stringify(data.animations[id].slots[s]))throw Error('Approved expression changed: '+id+' '+s);
  if(JSON.stringify(old.animations[id].deform)!==JSON.stringify(data.animations[id].deform))throw Error('Approved skin correction changed: '+id);legacy.push(id);
 }
 const before=JSON.parse(fs.readFileSync(path.join(root,'inspection/hair-motion-before.json')));
 for(const [id,anim]of Object.entries(before.animations)){
  for(const [name,timeline]of Object.entries(anim.bones))if(!['hair','hair_L','hair_R','hair_outer_L','volleyball'].includes(name)&&JSON.stringify(timeline)!==JSON.stringify(data.animations[id].bones[name]))throw Error('Non-hair motion changed: '+id+' '+name);
  for(const key of ['slots','deform','events'])if(JSON.stringify(anim[key])!==JSON.stringify(data.animations[id][key]))throw Error('Non-hair animation content changed: '+id+' '+key);
 }
 const fringeBefore=JSON.parse(fs.readFileSync(path.join(root,'inspection/fringe-motion-before.json')));
 for(const [id,anim]of Object.entries(fringeBefore.animations))for(const [name,timeline]of Object.entries(anim.bones))if(name!=='volleyball'&&JSON.stringify(timeline)!==JSON.stringify(data.animations[id].bones[name]))throw Error('Existing motion changed during fringe adjustment: '+id+' '+name);
 for(const [slot,items]of Object.entries(fringeBefore.skins[0].attachments))for(const [id,a]of Object.entries(items)){
  const actual=data.skins[0].attachments[slot][id],expected=id==='hair_surface'?{...a,vertices:actual.vertices}:a;
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Existing mesh changed during fringe adjustment: '+id);
 }
 for(const [slot,items]of Object.entries(old.skins[0].attachments))for(const [id,a]of Object.entries(items)){
  const actual=data.skins[0].attachments[slot][id];
  // Only the left front-hair weights are intentionally revised. Keep its
  // topology, UVs, and every other attachment exactly at the approved mesh.
  const expected=id==='hair_surface'?{...a,vertices:actual.vertices}:a;
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Approved mesh changed: '+id);
 }
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1240,height:1150},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 const report=await page.evaluate(data=>{
  const r={runtimeLoads:true,finiteVertices:true,loopMaxError:0,gripContactError:0,rigidBootLengthError:0,groundedAnkleError:0,ballContactError:0,ballArcHeight:0,jumpMouthScaleError:0,jumpMouthEdgeLengthError:0,jumpMouthLocalOffset:0,hairLocalRotationMax:0,hairLocalOffsetMax:0,hairAngularSpeedMax:0,animations:[]};
  const rest=petPreview.sample('idle',0,true);const idx=(s,id)=>s.slotNames.indexOf(id);
  for(const p of petPreview.players){const id=p.def.id,start=petPreview.sample(id,0),end=petPreview.sample(id,p.def.duration),angles={};
   if(p.def.loop!==false)for(let i=0;i<start.vertices.length;i++)for(let j=0;j<start.vertices[i].length;j++)r.loopMaxError=Math.max(r.loopMaxError,Math.abs(start.vertices[i][j]-end.vertices[i][j]));
   let previousHair=null;
   for(let t=0;t<p.def.duration;t+=1/240){const s=petPreview.sample(id,t);for(const v of s.vertices)for(const n of v)if(!Number.isFinite(n))r.finiteVertices=false;
    const h=s.bones.find(b=>b.name==='hair'),hb=data.bones.find(b=>b.name==='hair');
    r.hairLocalRotationMax=Math.max(r.hairLocalRotationMax,Math.abs(h.r));r.hairLocalOffsetMax=Math.max(r.hairLocalOffsetMax,Math.hypot(h.x-hb.x,h.y-hb.y));
    if(previousHair!==null)r.hairAngularSpeedMax=Math.max(r.hairAngularSpeedMax,Math.abs(h.r-previousHair)*240);previousHair=h.r;
    if(['hop','happy_bounce','proud_hops'].includes(id)){
     const b=s.bones.find(b=>b.name==='mouth'),bind=data.bones.find(b=>b.name==='mouth'),v=s.vertices[idx(s,'mouth')],v0=start.vertices[idx(start,'mouth')];
     r.jumpMouthScaleError=Math.max(r.jumpMouthScaleError,Math.abs(b.sx-1),Math.abs(b.sy-1));r.jumpMouthLocalOffset=Math.max(r.jumpMouthLocalOffset,Math.hypot(b.x-bind.x,b.y-bind.y));
     for(let j=2;j<v.length;j+=2)r.jumpMouthEdgeLengthError=Math.max(r.jumpMouthEdgeLengthError,Math.abs(Math.hypot(v[j]-v[0],v[j+1]-v[1])-Math.hypot(v0[j]-v0[0],v0[j+1]-v0[1])));
    }
    for(const side of ['L','R']){
     const [gx,gy]=side==='L'?[404,1045]:[719,1111];const contact=name=>{const a=data.skins[0].attachments[name][name],l=PET_DATA.layers.find(q=>q.id===name);let index=-1;for(let v=0;v<a.uvs.length;v+=2)if(Math.hypot(l.x+a.uvs[v]*l.width-gx,l.y+a.uvs[v+1]*l.height-gy)<.001)index=v;if(index<0)throw Error('Missing grip');return s.vertices[idx(s,name)].slice(index,index+2);};
     const h=contact('arm_'+side),c=contact('coat_surface');r.gripContactError=Math.max(r.gripContactError,Math.hypot(h[0]-c[0],h[1]-c[1]));
     const name='boot_'+side,v=s.vertices[idx(s,name)],v0=rest.vertices[idx(rest,name)];for(let j=2;j<v.length;j+=2)r.rigidBootLengthError=Math.max(r.rigidBootLengthError,Math.abs(Math.hypot(v[j]-v[0],v[j+1]-v[1])-Math.hypot(v0[j]-v0[0],v0[j+1]-v0[1])));
     if(['head_juggle','sway','stunned','shocked','grin','determined'].includes(id)){const b=s.bones.find(b=>b.name==='foot_'+side),target=PET_DATA.chains['leg_'+side].c;r.groundedAnkleError=Math.max(r.groundedAnkleError,Math.hypot(b.worldX-target.x,b.worldY-target.y));}
    }
    for(const name of ['forearm_L','forearm_R','shin_L','shin_R','hair','hair_L','hair_R','hair_outer_L','hair_fringe','mouth','eye_L','brow_L']){const b=s.bones.find(b=>b.name===name);if(!angles[name])angles[name]={min:b.r,max:b.r,minY:b.y,maxY:b.y};angles[name].min=Math.min(angles[name].min,b.r);angles[name].max=Math.max(angles[name].max,b.r);angles[name].minY=Math.min(angles[name].minY,b.y);angles[name].maxY=Math.max(angles[name].maxY,b.y);}
    if(id!=='head_juggle'&&s.slotNames.includes('volleyball'))throw Error('Ball leaked into '+id);
   }
   r.animations.push({id,duration:p.animation.duration,angles,attachments:start.attachments.filter(a=>/stunned|shocked|grin|determined/.test(a))});
  }
  // Compare the generated sphere's lower edge to the identical hair-weighted
  // crown vertex used by the baked trajectory, in actual runtime world space.
  const p=petPreview.players.find(p=>p.def.id==='head_juggle');for(const t of [0,.9,1.8,2.7]){petPreview.sample('head_juggle',t);const b=p.skeleton.findBone('volleyball'),hair=p.skeleton.findBone('hair'),ws=[['hair',.92],['head',.08]];let x=0,y=0;
   for(const [name,w]of ws){const posed=p.skeleton.findBone(name),bind=data.bones.find(q=>q.name===name);const restB=rest.bones.find(q=>q.name===name),dx=-50-restB.worldX,dy=1522-restB.worldY;x+=w*(posed.worldX+dx*posed.a+dy*posed.b);y+=w*(posed.worldY+dx*posed.c+dy*posed.d);}
   r.ballContactError=Math.max(r.ballContactError,Math.hypot(b.worldX-x,b.worldY-86*Math.hypot(b.c,b.d)-y));
  }
  const bottom=petPreview.sample('head_juggle',.9).bones.find(b=>b.name==='volleyball').worldY,top=petPreview.sample('head_juggle',1.35).bones.find(b=>b.name==='volleyball').worldY;r.ballArcHeight=top-bottom;
  return r;
 },data);
 report.legacyBodyMotionUnchanged=legacy;report.allNonHairMotionUnchanged=true;report.requestedLeftHairCorrection='Outer-left locks stay on one pivot; crown/side timelines damped coherently without changing artwork, mesh topology or UVs';report.requestedMouthCorrections=['hop','happy_bounce','proud_hops'];report.pageErrors=errors;
 report.fringeOnlyAdjustment={existingTimelinesUnchanged:true,rearAndOtherMeshesUnchanged:true,maximumAdditionalRotation:Math.max(...report.animations.map(a=>Math.max(Math.abs(a.angles.hair_fringe.min),Math.abs(a.angles.hair_fringe.max))))};
 // At 60 fps the fastest local rotation must remain below 0.35 degrees/frame.
 if(report.hairLocalRotationMax>2.11||report.hairLocalOffsetMax>.81||report.hairAngularSpeedMax>21)throw Error('Hair motion exceeds restrained amplitude or speed limits: '+JSON.stringify({rotation:report.hairLocalRotationMax,offset:report.hairLocalOffsetMax,speed:report.hairAngularSpeedMax}));
 if(report.jumpMouthScaleError>1e-6||report.jumpMouthEdgeLengthError>.003||report.jumpMouthLocalOffset>.66)throw Error('Jump mouth proportions or movement changed unexpectedly');
 fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(report,null,2));
 if(process.argv.includes('--checks-only')){await browser.close();console.log(JSON.stringify(report));if(errors.length||!report.finiteVertices||report.loopMaxError>.003||report.gripContactError>.003||report.rigidBootLengthError>.003||report.groundedAnkleError>.01||report.ballContactError>.01)process.exitCode=1;return;}
 fs.mkdirSync(path.join(root,'frames'),{recursive:true});fs.mkdirSync(path.join(root,'inspection'),{recursive:true});
 await page.locator('#view').selectOption('all');await page.evaluate(()=>petPreview.renderAll(.45));await page.screenshot({path:path.join(root,'preview-actions.png'),fullPage:true});
 await page.locator('#view').selectOption('expressions');await page.evaluate(()=>petPreview.renderAll(.7));await page.screenshot({path:path.join(root,'preview-expressions.png'),fullPage:true});
 const review=[];
 for(const id of ['head_juggle','sway','proud_hops','stunned','shocked','grin','determined','idle','hop','happy_bounce']){
  await page.locator('#view').selectOption(id);const p=await page.evaluate(id=>petPreview.players.find(p=>p.def.id===id).def,id),count=Math.round(p.duration*15);
  for(let i=0;i<count;i++){await page.evaluate(({id,t})=>petPreview.renderAt(id,t),{id,t:i/15});const png=Buffer.from(await page.evaluate(id=>petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1],id),'base64');
   await sharp(png).flatten({background:'#faf3e7'}).resize({width:420}).png().toFile(path.join(root,'frames',id+'-'+String(i).padStart(3,'0')+'.png'));
   if(i===Math.round(count/4)&&p.category){const label=Buffer.from(`<svg width="420" height="55"><text x="210" y="35" text-anchor="middle" font-size="24" font-family="Microsoft YaHei" fill="#574537">${p.label}</text></svg>`);review.push({input:label,left:(review.length/2)*420,top:0});review.push({input:await sharp(png).flatten({background:'#faf3e7'}).resize({width:420}).png().toBuffer(),left:((review.length-1)/2)*420,top:55});}
  }
 }
 const fixed=[];for(const v of review)fixed.push({...v,input:v.top?await sharp(v.input).resize(420,515,{fit:'contain',background:'#faf3e7'}).png().toBuffer():v.input});await sharp({create:{width:2940,height:570,channels:4,background:'#faf3e7'}}).composite(fixed).png().toFile(path.join(root,'review.png'));
 await page.locator('#view').selectOption('hop');await page.locator('#focus').selectOption('face');
 for(let i=0;i<36;i++){await page.evaluate(t=>petPreview.renderAt('hop',t),i/15);const png=Buffer.from(await page.evaluate(()=>petPreview.players.find(p=>p.def.id==='hop').canvas.toDataURL().split(',')[1]),'base64');await sharp(png).flatten({background:'#faf3e7'}).resize({width:420}).png().toFile(path.join(root,'frames','head-hop-'+String(i).padStart(3,'0')+'.png'));}
 await page.locator('#focus').selectOption('hem');
 for(let i=0;i<36;i++){await page.evaluate(t=>petPreview.renderAt('hop',t),i/15);const png=Buffer.from(await page.evaluate(()=>petPreview.players.find(p=>p.def.id==='hop').canvas.toDataURL().split(',')[1]),'base64');await sharp(png).flatten({background:'#faf3e7'}).resize({width:620}).png().toFile(path.join(root,'frames','hem-hop-'+String(i).padStart(3,'0')+'.png'));}
 fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(report,null,2));await browser.close();
 console.log(JSON.stringify(report));if(errors.length||!report.finiteVertices||report.loopMaxError>.003||report.gripContactError>.003||report.rigidBootLengthError>.003||report.groundedAnkleError>.01||report.ballContactError>.01)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1);});
