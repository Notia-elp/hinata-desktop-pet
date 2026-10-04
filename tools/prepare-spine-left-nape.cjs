// Preserve the approved crown/right pixels and register only the ImageGen
// left-nape redraw. Premultiplied compositing also replaces the old silhouette.
module.exports=async function(root,sharp){
 const fs=require('fs'),path=require('path');
 const original=await sharp(path.join(root,'art/rear-hair-complete-final.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=original.info;
 const edited=await sharp(path.join(root,'art/rear-hair-left-nape-generated.png')).resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 const result=Buffer.from(original.data),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const blend=smooth((y-780)/100)*(1-smooth((x-420)/80));if(!blend)continue;
  const i=(y*w+x)*4,a=original.data[i+3]*(1-blend),b=edited[i+3]*blend,alpha=a+b;
  for(let c=0;c<3;c++)result[i+c]=alpha?Math.round((original.data[i+c]*a+edited[i+c]*b)/alpha):0;
  result[i+3]=Math.round(alpha);
 }
 const target=path.join(root,'art/rear-hair-left-nape-registered.png');
 await sharp(result,{raw:{width:w,height:h,channels:4}}).png().toFile(target);
 return {source:'art/rear-hair-left-nape-generated.png',registered:'art/rear-hair-left-nape-registered.png',region:{x:[0,500],y:[780,h]},feather:{x:[420,500],y:[780,880]},preserved:'Original crown, right side, central back volume and concealed inner nape pixels'};
};
