const fs=require('fs'),path=require('path'),crypto=require('crypto');
let sharp;try{sharp=require('../desktop-pet/node_modules/sharp');}catch{sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');}
const project=path.resolve(__dirname,'..'),source=path.join(project,'output/hinata-spine-playful-v5'),out=path.join(project,'desktop-pet/assets');
(async()=>{fs.mkdirSync(path.join(out,'runtime'),{recursive:true});const files=['preview-data.js','hinata-raincoat.json','hinata-raincoat.atlas','hinata-atlas-1.png','hinata-atlas-2.png','asset-provenance.json','runtime/spine-webgl.js','runtime/LICENSE.txt'];
 for(const file of files)fs.copyFileSync(path.join(source,file),path.join(out,file));
 const png=await sharp(path.join(project,'output/hinata-live2d-v2/reference-approved.png')).extract({left:0,top:0,width:1024,height:790}).resize(256,256,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();fs.writeFileSync(path.join(out,'icon.png'),png);
 const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=0;ico[7]=0;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);fs.writeFileSync(path.join(out,'icon.ico'),Buffer.concat([ico,png]));
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),data=JSON.parse(fs.readFileSync(path.join(source,'hinata-raincoat.json')));
 fs.writeFileSync(path.join(out,'asset-manifest.json'),JSON.stringify({source:'../../output/hinata-spine-playful-v5',animations:Object.keys(data.animations),boneCount:data.bones.length,files:Object.fromEntries(files.map(f=>[f,hash(path.join(out,f))]))},null,2)+'\n');console.log('Synced the approved 14 Spine clips, textures, runtime and icon.');
})().catch(e=>{console.error(e);process.exit(1);});
