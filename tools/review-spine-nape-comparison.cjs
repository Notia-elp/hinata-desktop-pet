// Compare actual runtime captures at the same hop time (1.20 s), before and
// after the painted rear-nape change. This never modifies source artwork.
const path=require('path'),sharp=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../output/hinata-spine-playful-v5');
(async()=>{
 const before=await sharp(path.join(root,'head-hop-left-hair-fix.gif'),{page:18}).extract({left:65,top:305,width:125,height:115}).resize(375,345).png().toBuffer();
 const after=await sharp(path.join(root,'head-hop.gif'),{page:18}).extract({left:65,top:305,width:125,height:115}).resize(375,345).png().toBuffer();
 await sharp({create:{width:770,height:345,channels:4,background:'#faf3e7'}}).composite([{input:before,left:0,top:0},{input:after,left:395,top:0}]).png().toFile(path.join(root,'left-nape-compare-final.png'));
 console.log('left-nape-compare-final.png: before (left), after (right), hop 1.20 s');
})().catch(e=>{console.error(e);process.exit(1);});
