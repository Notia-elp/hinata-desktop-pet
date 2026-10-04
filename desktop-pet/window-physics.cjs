'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function dimensions(size){const scale=size/1536;return {width:Math.round(1800*scale),height:Math.round(3000*scale)};}
function settle(bounds,area,floorPixel){
 // Keep the visible character inside the work area, including negative monitor coordinates.
 const margin=Math.min(24,area.width/8);
 return {x:Math.round(clamp(bounds.x,area.x+margin-bounds.width*.15,area.x+area.width-margin-bounds.width*.85)),y:Math.round(area.y+area.height-floorPixel)};
}
function fallPlan(bounds,area,floorPixel,size){const to=settle(bounds,area,floorPixel),distance=to.y-bounds.y;
 return {from:{x:bounds.x,y:bounds.y},to,duration:clamp(Math.sqrt(2*Math.abs(distance)/(4200*size/1536)),.24,1.8)};
}
function fallAt(plan,time){const u=clamp(time/plan.duration,0,1),ease=u*u;
 return {x:Math.round(plan.from.x+(plan.to.x-plan.from.x)*ease),y:Math.round(plan.from.y+(plan.to.y-plan.from.y)*ease),land:time>=plan.duration,landing:time>=Math.max(0,plan.duration-.24),finished:time>=plan.duration+.26};
}
function cleanSettings(value={}){return {size:[220,300,380].includes(value.size)?value.size:300,alwaysOnTop:value.alwaysOnTop!==false,autoActivity:value.autoActivity!==false,expression:['auto','stunned','shocked','grin','determined'].includes(value.expression)?value.expression:'auto',x:Number.isFinite(value.x)?value.x:null};}
module.exports={dimensions,settle,fallPlan,fallAt,cleanSettings};
