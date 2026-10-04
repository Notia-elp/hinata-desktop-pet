'use strict';
const {app,BrowserWindow,Tray,Menu,nativeImage,ipcMain,screen,dialog}=require('electron');
const fs=require('fs'),path=require('path');
const {dimensions,settle,fallPlan,fallAt,cleanSettings}=require('./window-physics.cjs');
const testMode=app.commandLine.hasSwitch('self-test');
const storage=testMode?path.resolve(app.commandLine.getSwitchValue('test-output')||path.join(__dirname,'test-output')):path.join(path.dirname(process.execPath),'data');
fs.mkdirSync(storage,{recursive:true});app.setPath('userData',storage);app.setName('日向雨衣桌宠');app.setAppUserModelId('local.hinata.raincoat.pet');
const settingsFile=path.join(storage,'settings.json');let settings=cleanSettings();
try{settings=cleanSettings(JSON.parse(fs.readFileSync(settingsFile,'utf8')));}catch{}
if(testMode)settings.autoActivity=false;
let win,tray,menu,poll,animations=[],floorPixel=dimensions(settings.size).height*.9,pressState=null,fall=null,ignored=true,hit=false,ready=false,landingStarted=false,pendingAction=null,testCursor=null,previousCursor=null,previousTick=performance.now(),quitting=false;
const errors=[];
const send=message=>{if(win&&!win.isDestroyed())win.webContents.send('pet:message',message);};
function store(){if(testMode||!win||win.isDestroyed())return;settings.x=win.getBounds().x;fs.writeFileSync(settingsFile,JSON.stringify(settings,null,2)+'\n');}
function failure(error){errors.push(String(error.stack||error));try{fs.appendFileSync(path.join(storage,'error.log'),new Date().toISOString()+' '+String(error.stack||error)+'\n');}catch{}}
process.on('uncaughtException',failure);process.on('unhandledRejection',failure);
function setIgnore(value){if(ignored===value&&ready)return;ignored=value;win.setIgnoreMouseEvents(value,{forward:true});}
function updateSettings(){send({type:'settings',...settings,hidden:!win.isVisible()});buildMenu();store();}
function areaFor(bounds=win.getBounds()){return screen.getDisplayMatching(bounds).workArea;}
// Supplying the size prevents Windows frame/DPI rounding from accumulating on every move.
function move(x,y){win.setBounds({x:Math.round(x),y:Math.round(y),...dimensions(settings.size)},false);}
function placeOnFloor(){const b=win.getBounds(),target=settle(b,areaFor(b),floorPixel);move(target.x,target.y);store();}
function release(short=false){if(!pressState)return;pressState=null;if(short){setIgnore(!hit);return;}const b=win.getBounds();fall={...fallPlan(b,areaFor(b),floorPixel,settings.size),started:performance.now()};landingStarted=false;setIgnore(!hit);}
function command(id){if(fall){pendingAction=id;return;}send({type:'play',id});}
function toggle(){if(win.isVisible()){send({type:'cancel'});win.hide();}else{win.showInactive();placeOnFloor();win.setAlwaysOnTop(settings.alwaysOnTop,'pop-up-menu');}updateSettings();}
function resize(size){if(pressState||fall)return;settings.size=size;const d=dimensions(size);win.setResizable(true);win.setSize(d.width,d.height,false);win.setResizable(false);send({type:'resize'});updateSettings();}
function buildMenu(){if(!win)return;
 menu=Menu.buildFromTemplate([
  {id:'visibility',label:win.isVisible()?'隐藏日向':'显示日向',click:toggle},
  {label:'动作',submenu:animations.map(a=>({id:'act-'+a.id,label:a.label,click:()=>command(a.id)}))},
  {label:'颜表情',submenu:[['auto','跟随动作'],['stunned','白眼呆住'],['shocked','惊讶大叫'],['grin','咧嘴笑'],['determined','认真脸']].map(([id,label])=>({id:'expr-'+id,label,type:'radio',checked:settings.expression===id,click:()=>{settings.expression=id;updateSettings();}}))},
  {label:'大小',submenu:[[220,'小'],[300,'标准'],[380,'大']].map(([size,label])=>({id:'size-'+size,label,type:'radio',checked:settings.size===size,click:()=>resize(size)}))},
  {id:'auto',label:'自动活动',type:'checkbox',checked:settings.autoActivity,click:item=>{settings.autoActivity=item.checked;updateSettings();}},
  {id:'top',label:'保持置顶',type:'checkbox',checked:settings.alwaysOnTop,click:item=>{settings.alwaysOnTop=item.checked;win.setAlwaysOnTop(item.checked,'pop-up-menu');updateSettings();}},
  {id:'reset',label:'回到屏幕右下角',click:()=>{send({type:'cancel'});pressState=fall=null;const area=screen.getPrimaryDisplay().workArea,b=win.getBounds();move(area.x+area.width-b.width-45,area.y+area.height-floorPixel);send({type:'reset'});store();}},
  {type:'separator'},
  {label:'使用说明',click:()=>dialog.showMessageBox(win,{type:'info',title:'日向雨衣桌宠',message:'长按日向 0.3 秒，抓夹会把他提起。',detail:'拖动鼠标可移动日向，松开后落到任务栏上方。\n单击：蹦跳；双击：颠球。\n右键角色或托盘图标：动作、表情、大小、隐藏和退出。\n开机启动默认关闭，本版不修改系统启动项。'})},
  {id:'exit',label:'退出桌宠',click:()=>{quitting=true;app.quit();}}
 ]);tray?.setContextMenu(menu);
}
function tick(){if(!win||win.isDestroyed())return;const now=performance.now(),dt=Math.max(.008,(now-previousTick)/1000);previousTick=now;
 const cursor=testCursor||screen.getCursorScreenPoint(),b=win.getBounds();const velocityX=previousCursor?(cursor.x-previousCursor.x)/dt:0;previousCursor=cursor;
 send({type:'pointer',x:cursor.x-b.x,y:cursor.y-b.y,velocityX:Math.max(-1400,Math.min(1400,velocityX))});
 if(fall){const time=(now-fall.started)/1000,next=fallAt(fall,time);move(next.x,next.y);send({type:'drop',offsetX:fall.from.x-next.x,offsetY:fall.from.y-next.y,landing:next.landing,landingStarted,finished:next.finished});if(next.landing)landingStarted=true;
  if(next.finished){fall=null;store();if(pendingAction){command(pendingAction);pendingAction=null;}}
 }
}
function listen(name,handler){ipcMain.on('pet:'+name,(event,value)=>{if(event.sender===win?.webContents)handler(value);});}
listen('ready',metrics=>{if(!Number.isFinite(metrics?.floorPixel))return;floorPixel=metrics.floorPixel;animations=Array.isArray(metrics.animations)?metrics.animations.filter(a=>/^[a-z_]+$/.test(a.id)):animations;ready=true;placeOnFloor();win.showInactive();win.setAlwaysOnTop(settings.alwaysOnTop,'pop-up-menu');updateSettings();});
listen('metrics',metrics=>{if(!Number.isFinite(metrics?.floorPixel))return;floorPixel=metrics.floorPixel;if(!pressState&&!fall)placeOnFloor();});
listen('hit',value=>{hit=value===true;if(!pressState)setIgnore(!hit);});
listen('press',point=>{if(!Number.isFinite(point?.x)||!Number.isFinite(point.y))return;const b=win.getBounds();pressState={screen:{x:b.x+point.x,y:b.y+point.y},active:false};setIgnore(false);});
listen('pickup',()=>{if(pressState)pressState.active=true;});
listen('grab-frame',point=>{if(!pressState?.active||!Number.isFinite(point?.x)||!Number.isFinite(point.y))return;const cursor=testCursor||screen.getCursorScreenPoint(),lift=Math.max(0,Math.min(1,point.lift)),x=pressState.screen.x+(cursor.x-pressState.screen.x)*lift,y=pressState.screen.y+(cursor.y-pressState.screen.y)*lift;move(x-point.x,y-point.y);});
listen('release',value=>release(value?.short));listen('context-menu',()=>menu?.popup({window:win}));listen('error',failure);
if(!testMode&&!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(win){win.showInactive();placeOnFloor();win.setAlwaysOnTop(settings.alwaysOnTop,'pop-up-menu');updateSettings();}});
 app.whenReady().then(async()=>{
  const area=screen.getPrimaryDisplay().workArea,d=dimensions(settings.size),x=settings.x??area.x+area.width-d.width-45;
  win=new BrowserWindow({...d,x:Math.round(x),y:Math.round(area.y+area.height-d.height),title:'日向雨衣桌宠',transparent:true,backgroundColor:'#00000000',frame:false,thickFrame:false,resizable:false,maximizable:false,minimizable:false,skipTaskbar:true,hasShadow:false,show:false,alwaysOnTop:settings.alwaysOnTop,icon:path.join(__dirname,'assets/icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webgl:true,backgroundThrottling:true}});
  win.setMenu(null);win.setAlwaysOnTop(settings.alwaysOnTop,'pop-up-menu');setIgnore(true);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  win.webContents.on('render-process-gone',(_event,details)=>failure('Renderer exited: '+JSON.stringify(details)));win.webContents.on('console-message',(_event,details)=>{if(details.level==='error')failure(details.message);});
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets/icon.png')).resize({width:32,height:32}));tray.setToolTip('日向雨衣桌宠 · 长按拖拽 / 右键菜单');tray.on('double-click',toggle);buildMenu();
  win.on('blur',()=>{if(pressState)send({type:'cancel'});});win.on('close',()=>{quitting=true;store();});
  screen.on('display-removed',()=>{if(!pressState&&!fall)placeOnFloor();});screen.on('display-metrics-changed',()=>{if(!pressState&&!fall)placeOnFloor();});
  poll=setInterval(tick,16);await win.loadFile(path.join(__dirname,'pet.html'));
  if(testMode)require('./self-test.cjs').run({app,win,getMenu:()=>menu,getErrors:()=>errors,getState:()=>({ready,ignored,fall,floorPixel,settings:{...settings},bounds:win.getBounds(),workArea:areaFor()}),setCursor:point=>{testCursor=point;},resize,command,updateSettings,storage}).catch(error=>{failure(error);fs.writeFileSync(path.join(storage,'desktop-validation.json'),JSON.stringify({passed:false,errors},null,2));app.exit(1);});
 }).catch(error=>{failure(error);if(testMode)app.exit(1);else dialog.showErrorBox('桌宠启动失败',String(error.message||error));});
 app.on('before-quit',()=>{quitting=true;store();if(poll)clearInterval(poll);tray?.destroy();});app.on('window-all-closed',()=>app.quit());
}
