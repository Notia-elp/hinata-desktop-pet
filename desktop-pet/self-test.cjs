'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Synthetic input does not activate a showInactive() window. Electron requires
// BrowserWindow focus for sendInputEvent(); never restore focus during a grab,
// because that would hide a genuine blur/capture-loss cancellation.
function createInputDriver(host,wait=sleep){
 const {win}=host;
 const snapshot=()=>win.webContents.executeJavaScript('petApp.snapshot()');
 const focused=async()=>win.isFocused()&&await win.webContents.executeJavaScript('document.hasFocus()');
 const diagnostics=async()=>JSON.stringify({nativeFocused:win.isFocused(),host:host.getState(),renderer:await snapshot(),input:await win.webContents.executeJavaScript('({documentFocused:document.hasFocus(),events:window.__petSelfTestInputEvents||[]})')});
 async function verifyFocus(){if(!await focused())assert.fail('Synthetic input lost focus: '+await diagnostics());}
 return {
  async down(){
   win.focus();
   let hasFocus=false;for(let i=0;i<40;i++){if(await focused()){hasFocus=true;break;}await wait(50);}
   if(!hasFocus)assert.fail('Could not focus desktop pet before synthetic input: '+await diagnostics());
   const p=await win.webContents.executeJavaScript('petApp.grabPoint()'),b=win.getBounds();
   host.setCursor({x:b.x+p.x,y:b.y+p.y});await wait(150);await verifyFocus();
   assert.equal(host.getState().ignored,false,'Opaque character does not accept input');
   win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(p.x),y:Math.round(p.y)});
   win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:Math.round(p.x),y:Math.round(p.y)});
   for(let i=0;i<40;i++){const s=await snapshot();if(['pending','pickup','held'].includes(s.phase))return p;if(s.phase==='dropping')assert.fail('Press was cancelled: '+await diagnostics());await wait(25);}
   assert.fail('Synthetic press did not start: '+await diagnostics());
  },
  async up(expectedPhase='held'){const p=await win.webContents.executeJavaScript('petApp.grabPoint()');await verifyFocus();const s=await snapshot();if(s.phase!==expectedPhase)assert.fail('Unexpected phase before mouse up (expected '+expectedPhase+'): '+await diagnostics());win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(p.x),y:Math.round(p.y)});},
  async checkHeld(){const s=await snapshot();if(s.phase!=='held')assert.fail('Grab ended before mouse up: '+await diagnostics());await verifyFocus();return s;},
  async held(){
   // Observe the entire original 800 ms hold, including the transition. A
   // cancellation fails immediately instead of retrying or skipping a drop.
   for(let elapsed=0;elapsed<=2000;elapsed+=25){const s=await snapshot();if(!['pending','pickup','held'].includes(s.phase))assert.fail('Long press was cancelled: '+await diagnostics());if(elapsed>=800&&s.phase==='held'){await verifyFocus();return s;}if(elapsed<2000)await wait(25);}
   assert.fail('Long press did not reach held: '+await diagnostics());
  }
 };
}
exports.createInputDriver=createInputDriver;
exports.run=async host=>{
 const {win,app,storage}=host;for(let i=0;i<300&&!host.getState().ready;i++)await sleep(50);assert.ok(host.getState().ready,'Desktop renderer did not start');
 const snapshot=()=>win.webContents.executeJavaScript('petApp.snapshot()');
 const report={passed:false,platform:process.platform,versions:process.versions,checks:[],errors:[]};
 const check=name=>report.checks.push(name);await sleep(200);let s=await snapshot();assert.ok(s.ready);assert.equal(s.cornerAlpha,0);assert.ok(Math.abs(s.floorPixel-host.getState().floorPixel)<.1,'Canvas/native floor metrics disagree');assert.ok(win.isAlwaysOnTop(),JSON.stringify({host:host.getState(),visible:win.isVisible(),top:win.isAlwaysOnTop()}));check('transparent canvas and native topmost window');
 let b=win.getBounds();host.setCursor({x:b.x+2,y:b.y+2});await sleep(180);assert.ok(host.getState().ignored);check('transparent region enables native click-through');
 for(const id of ['idle','hop','happy_bounce','head_juggle','sway','proud_hops','stunned','shocked','grin','determined']){host.getMenu().getMenuItemById('act-'+id).click();await sleep(120);assert.equal((await snapshot()).animation,id);}
 check('all ten ordinary action and expression clips run from tray menu');
 host.command('head_juggle');await sleep(150);report.volleyball={samples:0,minDiameter:Infinity,maxDiameter:0,minTop:Infinity};
 for(let i=0;i<32;i++){const ball=(await snapshot()).volleyball;assert.ok(ball,'Volleyball not shown');assert.ok(ball.diameter>=(770*2/3)*.944&&ball.diameter<=(770*2/3)*1.056,'Volleyball does not match revised size');assert.ok(ball.top>=0&&ball.left>=0&&ball.right<=ball.canvasWidth&&ball.bottom<=ball.canvasHeight,'Volleyball clipped by native window');report.volleyball.samples++;report.volleyball.minDiameter=Math.min(report.volleyball.minDiameter,ball.diameter);report.volleyball.maxDiameter=Math.max(report.volleyball.maxDiameter,ball.diameter);report.volleyball.minTop=Math.min(report.volleyball.minTop,ball.top);if(i===4)fs.writeFileSync(path.join(storage,'desktop-juggle.png'),Buffer.from((await win.webContents.executeJavaScript('petApp.png()')).split(',')[1],'base64'));await sleep(90);}
 check('volleyball at two thirds of head width stays inside the native canvas throughout repeated bounces');host.command('idle');await sleep(160);
 if(app.commandLine.hasSwitch('ball-size-only')){report.errors=host.getErrors();assert.equal(report.errors.length,0);report.passed=true;report.final=host.getState();fs.writeFileSync(path.join(storage,'volleyball-validation.json'),JSON.stringify(report,null,2)+'\n');app.exit(0);return;}
 for(const id of ['stunned','shocked','grin','determined']){host.getMenu().getMenuItemById('expr-'+id).click();await sleep(100);s=await snapshot();assert.equal(s.attachments.eye_L,'eye_L_'+id);assert.equal(s.attachments.mouth,'mouth_'+id);}
 host.getMenu().getMenuItemById('expr-auto').click();host.command('idle');await sleep(180);check('independent expression selection and automatic reset');
 // Keep diagnostics inside the self-test; ordinary renderer behavior is unchanged.
 await win.webContents.executeJavaScript(`(()=>{const events=window.__petSelfTestInputEvents=[];const canvas=document.querySelector('#pet');const record=e=>{events.push({type:e.type,time:performance.now(),pointerId:e.pointerId,buttons:e.buttons,focused:document.hasFocus(),phase:petApp.snapshot().phase,captured:e.pointerId===undefined?null:canvas.hasPointerCapture(e.pointerId)});if(events.length>64)events.shift();};for(const type of ['pointerdown','pointerup','pointermove','pointercancel','gotpointercapture','lostpointercapture'])canvas.addEventListener(type,record,true);for(const type of ['focus','blur'])window.addEventListener(type,record,true);})()`);
 const {down,up,held,checkHeld}=createInputDriver(host);
 await down();await sleep(80);await up('pending');await sleep(220);assert.equal((await snapshot()).phase,'idle');check('short click stays out of claw interaction');host.command('idle');await sleep(200);
 const p=await down();s=await held();assert.equal(s.animation,'drag_hold');assert.equal(Object.entries(s.attachments).filter(([name,value])=>name.startsWith('claw_')&&value).length,8);
 // Move inward from the default right-hand position, away from the display edge.
 const start=win.getBounds();let maximumSwing=0;for(let i=1;i<=15;i++){host.setCursor({x:start.x+p.x-i*8,y:start.y+p.y-i*12});await sleep(30);maximumSwing=Math.max(maximumSwing,Math.abs((await snapshot()).swing));}
 const lifted=win.getBounds(),dragState=await checkHeld();assert.ok(lifted.y<start.y-140,'Native window did not lift: '+JSON.stringify({start,lifted,dragState}));assert.ok(lifted.x<start.x-40,'Native window did not follow horizontally: '+JSON.stringify({start,lifted,dragState}));assert.ok(Math.abs(lifted.width-start.width)<=1,'Window width grew during drag');assert.ok(Math.abs(lifted.height-start.height)<=1,'Window height grew during drag');assert.ok(maximumSwing>1&&maximumSwing<=9.001,'Drag swing out of range: '+maximumSwing);
 check('300 ms hold shows all claw parts and moves the real Windows window');report.drag={from:start,held:lifted,maximumSwingDegrees:maximumSwing};
 fs.writeFileSync(path.join(storage,'desktop-held.png'),Buffer.from((await win.webContents.executeJavaScript('petApp.png()')).split(',')[1],'base64'));
 await up();await sleep(80);assert.equal((await snapshot()).phase,'dropping');await sleep(2200);s=await snapshot();assert.equal(s.phase,'idle');assert.equal(s.animation,'idle');assert.equal(Object.entries(s.attachments).filter(([name,value])=>name.startsWith('claw_')&&value).length,0);b=win.getBounds();const native=host.getState();assert.ok(Math.abs(b.y+native.floorPixel-(native.workArea.y+native.workArea.height))<1.1);
 check('release opens the claw, falls to display work area and returns to idle');
 await down();await held();
 const {BrowserWindow}=require('electron');const focusTarget=new BrowserWindow({width:160,height:90,show:false,skipTaskbar:true,webPreferences:{sandbox:true}});await focusTarget.loadURL('data:text/html,<title>Desktop pet focus test</title>');await checkHeld();focusTarget.show();focusTarget.focus();
 for(let i=0;i<40&&(!focusTarget.isFocused()||win.isFocused());i++)await sleep(50);
 assert.ok(focusTarget.isFocused()&&!win.isFocused(),'Focus-loss test did not transfer native focus');await sleep(2200);
 const afterBlur=await snapshot();focusTarget.destroy();assert.equal(afterBlur.phase,'idle','Focus loss failed: '+JSON.stringify({focused:win.isFocused(),phase:afterBlur.phase,host:host.getState()}));check('another native window taking focus safely releases the pet');
 host.getMenu().getMenuItemById('size-220').click();await sleep(350);assert.ok(win.getBounds().height<start.height);const small=host.getState();assert.ok(Math.abs(small.bounds.y+small.floorPixel-(small.workArea.y+small.workArea.height))<1.1);host.getMenu().getMenuItemById('size-300').click();await sleep(350);check('native resize keeps feet on the desktop floor');
 host.getMenu().getMenuItemById('visibility').click();assert.equal(win.isVisible(),false);await sleep(100);host.getMenu().getMenuItemById('visibility').click();assert.equal(win.isVisible(),true);await sleep(150);check('tray hide and show');
 fs.writeFileSync(path.join(storage,'desktop-idle.png'),Buffer.from((await win.webContents.executeJavaScript('petApp.png()')).split(',')[1],'base64'));
 s=await snapshot();assert.ok(Math.abs(s.floorPixel-host.getState().floorPixel)<.1,'Canvas/native floor metrics disagree after resizing');report.errors=host.getErrors();assert.equal(report.errors.length,0,'Electron reported errors');report.passed=true;report.final=host.getState();fs.writeFileSync(path.join(storage,'desktop-validation.json'),JSON.stringify(report,null,2)+'\n');app.exit(0);
};
