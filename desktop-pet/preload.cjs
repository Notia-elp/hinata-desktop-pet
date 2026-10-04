'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const channels=new Set(['ready','metrics','hit','press','pickup','grab-frame','release','context-menu','error']);
contextBridge.exposeInMainWorld('desktopPet',{
 send:(name,value)=>{if(channels.has(name))ipcRenderer.send('pet:'+name,value);},
 onMessage:callback=>{const handler=(_event,message)=>callback(message);ipcRenderer.on('pet:message',handler);return()=>ipcRenderer.removeListener('pet:message',handler);}
});
