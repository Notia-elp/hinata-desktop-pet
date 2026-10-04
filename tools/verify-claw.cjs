// Check the painted coat contact and rigid grabber in the official runtime.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const rig=JSON.parse(fs.readFileSync(path.join(root,'art/claw-rig.json')));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 const result=await page.evaluate(rig=>{
  const report={rigidDistanceError:0,closedPadContactError:0,finiteVertices:true,frames:0,hiddenInOtherActions:true};
  const mechanical=name=>name.startsWith('claw_');
  const contact=(snapshot,x,y)=>{
   const layer=PET_DATA.layers.find(l=>l.id==='coat_surface'),a=PET_DATA.skeleton.skins[0].attachments.coat_surface.coat_surface,v=snapshot.vertices[snapshot.slotNames.indexOf('coat_surface')];
   const xy=i=>[layer.x+a.uvs[i*2]*layer.width,layer.y+a.uvs[i*2+1]*layer.height];
   for(let j=0;j<a.triangles.length;j+=3){const [i,k,n]=a.triangles.slice(j,j+3),A=xy(i),B=xy(k),C=xy(n),den=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]);
    if(Math.abs(den)<1e-8)continue;const u=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/den,w=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/den,z=1-u-w;
    if(Math.min(u,w,z)>=-1e-5)return {x:u*v[i*2]+w*v[k*2]+z*v[n*2],y:u*v[i*2+1]+w*v[k*2+1]+z*v[n*2+1]};
   }throw Error('Coat contact outside mesh');
  };
  for(const p of petPreview.players){const id=p.def.id;
   if(!['pickup','drag_hold','put_down'].includes(id)){const s=petPreview.sample(id,p.def.duration/2);if(s.slotNames.some(mechanical))report.hiddenInOtherActions=false;continue;}
   const initial=petPreview.sample(id,id==='pickup'?.1:0);
   for(let t=0;t<=p.def.duration+1e-8;t+=1/60){const s=petPreview.sample(id,t);report.frames++;
    for(let i=0;i<s.slotNames.length;i++)if(mechanical(s.slotNames[i])){const v=s.vertices[i],previous=initial.vertices[initial.slotNames.indexOf(s.slotNames[i])];for(const n of v)if(!Number.isFinite(n))report.finiteVertices=false;
     for(let j=2;j<v.length;j+=2)report.rigidDistanceError=Math.max(report.rigidDistanceError,Math.abs(Math.hypot(v[j]-v[0],v[j+1]-v[1])-Math.hypot(previous[j]-previous[0],previous[j+1]-previous[1])));
    }
    if(id==='drag_hold'||id==='pickup'&&t>=.33)for(const side of ['L','R']){const b=p.skeleton.findBone('claw_lower_'+side),tip=b.localToWorld({x:b.data.length,y:0}),target=contact(s,...rig.rig[side].C);report.closedPadContactError=Math.max(report.closedPadContactError,Math.hypot(tip.x-target.x,tip.y-target.y));}
   }
  }return report;
 },rig);
 await browser.close();assert.ok(result.finiteVertices);assert.ok(result.hiddenInOtherActions);assert.ok(result.rigidDistanceError<.003,'Metal parts stretched');assert.ok(result.closedPadContactError<3,'Closed pads slipped off painted coat: '+result.closedPadContactError);
 fs.writeFileSync(path.join(root,'claw-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exit(1);});
