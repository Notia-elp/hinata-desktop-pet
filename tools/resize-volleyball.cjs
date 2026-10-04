'use strict';
// Update only the ball's baked timeline; retain the approved paint, meshes and other clips.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
const file=path.join(root,'hinata-raincoat.json'),beforePath=path.join(root,'inspection/volleyball-size-before.json');
const current=JSON.parse(fs.readFileSync(file,'utf8')),unchanged=structuredClone(current);
fs.mkdirSync(path.dirname(beforePath),{recursive:true});
if(!fs.existsSync(beforePath))fs.writeFileSync(beforePath,JSON.stringify(current));
const base=JSON.parse(fs.readFileSync(beforePath,'utf8')).animations.head_juggle.bones.volleyball;
const diameter=770*2/3,factor=diameter/172,ball=structuredClone(base),radius=86;
for(let i=0;i<ball.translate.length;i++){
 const a=base.rotate[i].value*Math.PI/180,s=base.scale[i];
 assert.equal(ball.translate[i].time,s.time);assert.equal(ball.translate[i].time,base.rotate[i].time);
 ball.translate[i].y=Math.round((base.translate[i].y+(factor-1)*radius*Math.hypot(s.x*Math.sin(a),s.y*Math.cos(a)))*1e6)/1e6;
 ball.scale[i].x=Math.round(s.x*factor*1e6)/1e6;ball.scale[i].y=Math.round(s.y*factor*1e6)/1e6;
}
current.animations.head_juggle.bones.volleyball=ball;
unchanged.animations.head_juggle.bones.volleyball=ball;assert.deepEqual(current,unchanged);
fs.writeFileSync(file,JSON.stringify(current));
const previewPath=path.join(root,'preview-data.js'),text=fs.readFileSync(previewPath,'utf8');
const preview=JSON.parse(text.slice('window.PET_DATA='.length).trim().replace(/;$/,''));
preview.skeleton=current;fs.writeFileSync(previewPath,'window.PET_DATA='+JSON.stringify(preview)+';');
const provenancePath=path.join(root,'asset-provenance.json'),provenance=JSON.parse(fs.readFileSync(provenancePath,'utf8'));
provenance.volleyballSizing={paintedHeadWidth:770,baseBallDiameter:172,diameter,relativeToHead:2/3,scale:factor,contact:'Ellipse lower edge remains on the moving painted crown; radius included in each translation key.',otherAnimationsAndMeshesUnchanged:true,source:'../../tools/resize-volleyball.cjs'};
fs.writeFileSync(provenancePath,JSON.stringify(provenance,null,2));
console.log(JSON.stringify(provenance.volleyballSizing));
