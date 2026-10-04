const fs=require('fs'),path=require('path');
const deps='C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const sharp=require(deps+'sharp'),{chromium}=require(deps+'playwright');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const data=JSON.parse(fs.readFileSync(path.join(root,'hinata-raincoat.json'))),old=JSON.parse(fs.readFileSync(path.join(root,'../hinata-spine-joints-v4/hinata-raincoat.json')));
 const layer=JSON.parse(fs.readFileSync(path.join(root,'rig-layers.json'))).find(l=>l.id==='hair_surface');
 const a=data.skins[0].attachments.hair_surface.hair_surface;
 const pixels=await sharp(path.join(root,'custom/hair_surface.png')).ensureAlpha().raw().toBuffer();
 const selected=[],fringe=[];
 for(let i=0;i<a.triangles.length;i+=3){const tri=a.triangles.slice(i,i+3),x=tri.reduce((s,j)=>s+a.uvs[j*2],0)/3*layer.width,y=tri.reduce((s,j)=>s+a.uvs[j*2+1],0)/3*layer.height;
  if(layer.x+x<335&&layer.y+y>180&&layer.y+y<430&&pixels[(Math.floor(y)*layer.width+Math.floor(x))*4+3]>=128)selected.push(tri);
  if(layer.x+x>=335&&layer.x+x<710&&layer.y+y>230&&layer.y+y<535&&pixels[(Math.floor(y)*layer.width+Math.floor(x))*4+3]>=128)fringe.push(tri);
 }
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready);
 const report=await page.evaluate(({selected,fringe,data,old})=>{
  petPreview.pause();const p=petPreview.players.find(p=>p.def.id==='hop');
  const oldData=JSON.parse(JSON.stringify(data));for(const id of ['idle','hop','happy_bounce'])for(const name of ['hair','hair_L','hair_R'])oldData.animations[id].bones[name]=old.animations[id].bones[name];
  oldData.skins[0].attachments.hair_surface.hair_surface.vertices=old.skins[0].attachments.hair_surface.hair_surface.vertices;
  const baseline=new spine.SkeletonJson(new spine.AtlasAttachmentLoader(p.atlas)).readSkeletonData(oldData);
  const area=(v,[a,b,c])=>(v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1])-(v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
  const results=[];
  for(const player of petPreview.players){const id=player.def.id;
   for(const mode of ['current',...(['idle','hop','happy_bounce'].includes(id)?['baseline']:[])]){let min=Infinity,max=0,folds=0,worstTime=0,fringeMin=Infinity,fringeMax=0,fringeFolds=0;
    const skeleton=mode==='current'?player.skeleton:new spine.Skeleton(baseline),slot=skeleton.findSlot('hair_surface'),attachment=slot.getAttachment(),v=new Float32Array(attachment.worldVerticesLength);
    skeleton.setToSetupPose();skeleton.updateWorldTransform(spine.Physics.none);attachment.computeWorldVertices(slot,0,v.length,v,0,2);const restAreas=selected.map(tri=>area(v,tri)),fringeRest=fringe.map(tri=>area(v,tri));
    const anim=mode==='current'?player.animation:baseline.findAnimation(id);
    for(let t=0;t<player.def.duration;t+=1/120){skeleton.setToSetupPose();anim.apply(skeleton,-1,t,false,[],1,spine.MixBlend.replace,spine.MixDirection.mixIn);skeleton.updateWorldTransform(spine.Physics.none);attachment.computeWorldVertices(slot,0,v.length,v,0,2);
     for(let i=0;i<selected.length;i++){const ratio=area(v,selected[i])/restAreas[i];if(ratio<min){min=ratio;worstTime=t;}max=Math.max(max,ratio);if(ratio<=0)folds++;}
     if(mode==='current')for(let i=0;i<fringe.length;i++){const ratio=area(v,fringe[i])/fringeRest[i];fringeMin=Math.min(fringeMin,ratio);fringeMax=Math.max(fringeMax,ratio);if(ratio<=0)fringeFolds++;}
    }results.push({id,mode,minimumAreaRatio:min,maximumAreaRatio:max,foldedTriangles:folds,worstTime,...(mode==='current'?{fringeMinimumAreaRatio:fringeMin,fringeMaximumAreaRatio:fringeMax,fringeFoldedTriangles:fringeFolds}:{})});
   }
  }
  return {sampleRate:120,paintedLeftTriangles:selected.length,paintedFringeTriangles:fringe.length,results};
 },{selected,fringe,data,old});
 fs.writeFileSync(path.join(root,'left-hair-validation.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));
 if(report.results.some(r=>r.mode==='current'&&(r.foldedTriangles||r.minimumAreaRatio<.9||r.maximumAreaRatio>1.1)))throw Error('Left hair still collapses, stretches or folds');
 if(report.results.some(r=>r.mode==='current'&&(r.fringeFoldedTriangles||r.fringeMinimumAreaRatio<.8||r.fringeMaximumAreaRatio>1.2)))throw Error('Fringe collapses, stretches excessively or folds');
})().catch(e=>{console.error(e);process.exit(1);});
