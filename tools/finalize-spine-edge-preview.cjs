// Publish versioned runtime captures and repair provenance, without modifying art.
const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'visual-validation.json')));
 const definitions=JSON.parse(fs.readFileSync(path.join(root,'asset-provenance.json'))).animations;
 const expected=report.animations.reduce((sum,id)=>{const d=definitions.find(a=>a.id===id).duration;return sum+Math.round(d*30)+Math.round(d*15);},0);
 if(report.frames!==expected||report.largestEnclosedHolePixels||report.largestDetachedPixels||(report.errors||[]).length)throw Error('Final alpha audit did not pass');
 for(const type of ['gif','webp']){
  fs.copyFileSync(path.join(root,'head-hop.'+type),path.join(root,'head-hop-extra-tip-fix.'+type));
  fs.copyFileSync(path.join(root,'head-hop.'+type),path.join(root,'head-hop-edge-cleanup.'+type));
  fs.copyFileSync(path.join(root,'hem-hop.'+type),path.join(root,'hem-hop-edge-cleanup.'+type));
 }
 fs.copyFileSync(path.join(root,'head-contours-review.png'),path.join(root,'head-contours-extra-tip-fix.png'));
 fs.copyFileSync(path.join(root,'head-contours-review.png'),path.join(root,'head-contours-edge-cleanup.png'));
 const tiles=[];
 for(const [name,left]of [['duplicate-before',0],['edge-cleanup-final',420]]){
  const input=await sharp(path.join(root,'inspection',`left-${name}-2.05-rear.png`)).extract({left:60,top:385,width:140,height:130}).resize(420,390).png().toBuffer();
  tiles.push({input,left,top:0});
 }
 await sharp({create:{width:840,height:390,channels:4,background:'#faf3e7'}}).composite(tiles).png().toFile(path.join(root,'left-extra-tip-compare.png'));
 const old=await sharp(path.join(root,'art/rear-hair-before-extra-tip-fix.png')).ensureAlpha().raw().toBuffer();
 const {data:now,info}=await sharp(path.join(root,'images/hair_rear_complete.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let changed=0;for(let i=3;i<now.length;i+=4)if(now[i]!==old[i])changed++;
 fs.writeFileSync(path.join(root,'inspection/extra-tip-alpha-review.json'),JSON.stringify({width:info.width,height:info.height,changedAlphaPixels:changed,scope:'Narrow left rear ownership extension; original painted RGB retained. Runtime atlas sampling extrusion is separate.',comparison:'left-extra-tip-compare.png',audit:'visual-validation.json'},null,2)+'\n');
 console.log(JSON.stringify({alphaFrames:report.frames,holes:0,detached:0,changedHairAlphaPixels:changed,previews:['hem-hop-edge-cleanup.gif','head-hop-edge-cleanup.gif']}));
})().catch(e=>{console.error(e);process.exit(1);});
