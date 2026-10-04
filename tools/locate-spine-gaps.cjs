const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:1150}});
 await page.goto('file:///'+path.join(root,'preview.html').replaceAll('\\','/'));await page.waitForFunction(()=>window.petPreview?.ready);await page.evaluate(()=>petPreview.pause());
 let rows=JSON.parse(fs.readFileSync(path.join(root,'visual-validation.json'))).stats.filter(s=>s.holes.length);
 if(process.argv.includes('--largest'))rows=rows.sort((a,b)=>b.holes[0].pixels-a.holes[0].pixels).slice(0,6);
 for(const row of rows){
  await page.locator('#view').selectOption(row.id);await page.locator('#focus').selectOption(row.focus);
  const mapped=await page.evaluate(row=>{petPreview.renderAt(row.id,row.t);const p=petPreview.players.find(p=>p.def.id===row.id),b=p.skeleton.findBone('head'),c=p.renderer.camera,h=Math.round(p.canvas.height*620/p.canvas.width),det=b.a*b.d-b.b*b.c;
   const snap=petPreview.sample(row.id,row.t);
   return row.holes.map(v=>{const wx=c.position.x+(v.x/620-.5)*c.viewportWidth,wy=c.position.y+(.5-v.y/h)*c.viewportHeight,dx=wx-b.worldX,dy=wy-b.worldY,surfaces=[];
    for(const name of ['coat_surface','arm_L','arm_R','coat_rear']){const index=snap.slotNames.indexOf(name),pos=snap.vertices[index],a=PET_DATA.skeleton.skins[0].attachments[name][name],layer=PET_DATA.layers.find(l=>l.id===name);
     for(let j=0;j<a.triangles.length;j+=3){const [i,k,l]=a.triangles.slice(j,j+3),ax=pos[i*2],ay=pos[i*2+1],bx=pos[k*2],by=pos[k*2+1],cx=pos[l*2],cy=pos[l*2+1],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy),u=((by-cy)*(wx-cx)+(cx-bx)*(wy-cy))/den,z=((cy-ay)*(wx-cx)+(ax-cx)*(wy-cy))/den;
      if(u>=0&&z>=0&&u+z<=1){surfaces.push({name,x:layer.x+layer.width*(u*a.uvs[i*2]+z*a.uvs[k*2]+(1-u-z)*a.uvs[l*2]),y:layer.y+layer.height*(u*a.uvs[i*2+1]+z*a.uvs[k*2+1]+(1-u-z)*a.uvs[l*2+1])});break;}
     }
    }
    return {...v,sourceX:552+(dx*b.d-dy*b.b)/det,sourceY:651-(-dx*b.c+dy*b.a)/det,surfaces};});},row);
  console.log(JSON.stringify({id:row.id,t:row.t,focus:row.focus,mapped}));
  const png=await page.evaluate(id=>petPreview.players.find(p=>p.def.id===id).canvas.toDataURL().split(',')[1],row.id);
  const raw=await sharp(Buffer.from(png,'base64')).resize({width:620}).ensureAlpha().raw().toBuffer();
  console.log(JSON.stringify({id:row.id,t:row.t,coverage:row.holes.map(v=>raw[(Math.round(v.y)*620+Math.round(v.x))*4+3])}));
  await sharp(Buffer.from(png,'base64')).resize({width:620}).flatten({background:'#65dded'}).png().toFile(path.join(root,'inspection',`gap-${row.id}-${row.focus}-${row.t.toFixed(2)}.png`));
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
