'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createInputDriver}=require('../self-test.cjs');

// No Electron/graphics needed: exercise the same driver used by the native test.
function fixture(options={}){
 const state={nativeFocused:false,documentFocused:false,phase:'idle',ignored:false,time:0,focusCalls:0,events:[],cursor:null};
 const win={
  focus(){state.focusCalls++;if(!options.delayedFocus){state.nativeFocused=true;state.documentFocused=true;}},
  isFocused:()=>state.nativeFocused,
  getBounds:()=>({x:100,y:200,width:352,height:586}),
  webContents:{
   async executeJavaScript(source){
    if(source==='document.hasFocus()')return state.documentFocused;
    if(source==='petApp.grabPoint()')return {x:40.4,y:80.6};
    if(source==='petApp.snapshot()')return {phase:state.phase};
    if(source.startsWith('({documentFocused:'))return {documentFocused:state.documentFocused,events:[{type:'lostpointercapture',pointerId:1}]};
    throw Error('Unexpected script: '+source);
   },
   sendInputEvent(event){assert.ok(state.nativeFocused&&state.documentFocused,'Input injected without focus');state.events.push(event);if(event.type==='mouseDown')state.phase=options.pressPhase||'pending';}
  }
 };
 const host={win,getState:()=>({ignored:state.ignored}),setCursor:point=>{state.cursor=point;}};
 const wait=async ms=>{state.time+=ms;options.onWait?.(state,ms);};
 return {state,driver:createInputDriver(host,wait)};
}

test('initial inactive window gains native and renderer focus before mouse input',async()=>{
 const {state,driver}=fixture({delayedFocus:true,onWait:s=>{s.nativeFocused=s.time>=50;s.documentFocused=s.time>=150;}});
 const point=await driver.down();
 assert.deepEqual(point,{x:40.4,y:80.6});assert.equal(state.focusCalls,1);assert.equal(state.time,300);
 assert.deepEqual(state.cursor,{x:140.4,y:280.6});
 assert.deepEqual(state.events,[{type:'mouseMove',x:40,y:81},{type:'mouseDown',button:'left',clickCount:1,x:40,y:81}]);
});

test('native focus without renderer focus times out before any injection',async()=>{
 const {state,driver}=fixture({delayedFocus:true,onWait:s=>{s.nativeFocused=true;}});
 await assert.rejects(driver.down(),/Could not focus desktop pet.*documentFocused.*false/);
 assert.equal(state.time,2000);assert.equal(state.events.length,0);assert.equal(state.focusCalls,1);
});

test('unavailable native focus times out without retries or input',async()=>{
 const {state,driver}=fixture({delayedFocus:true});
 await assert.rejects(driver.down(),/Could not focus desktop pet/);
 assert.equal(state.events.length,0);assert.equal(state.focusCalls,1);
});

test('focus lost while positioning the test cursor is not silently restored',async()=>{
 const {state,driver}=fixture({onWait:s=>{s.nativeFocused=false;s.documentFocused=false;}});
 await assert.rejects(driver.down(),/Synthetic input lost focus/);
 assert.equal(state.events.length,0);assert.equal(state.focusCalls,1);
});

test('a synthetic press must actually enter an active phase',async()=>{
 const {state,driver}=fixture({pressPhase:'idle'});
 await assert.rejects(driver.down(),/Synthetic press did not start/);
 assert.equal(state.events.filter(e=>e.type==='mouseDown').length,1);
});

test('a cancelled press fails with capture diagnostics instead of being retried',async()=>{
 const {state,driver}=fixture({pressPhase:'dropping'});
 await assert.rejects(driver.down(),/Press was cancelled:.*lostpointercapture/);
 assert.equal(state.events.filter(e=>e.type==='mouseDown').length,1);
});

test('hold observes pending, pickup and held for at least the original 800 ms',async()=>{
 const {state,driver}=fixture({onWait:s=>{s.phase=s.time>=660?'held':s.time>=300?'pickup':'pending';}});
 state.phase='pending';state.nativeFocused=state.documentFocused=true;
 assert.equal((await driver.held()).phase,'held');assert.equal(state.time,800);assert.equal(state.focusCalls,0);
});

test('capture loss during a hold fails immediately, even after held was reached',async()=>{
 const {state,driver}=fixture({onWait:s=>{s.phase=s.time>=700?'dropping':s.time>=660?'held':'pickup';}});
 state.phase='pending';state.nativeFocused=state.documentFocused=true;
 await assert.rejects(driver.held(),/Long press was cancelled:.*dropping.*lostpointercapture/);
 assert.equal(state.time,700);assert.equal(state.focusCalls,0);assert.equal(state.events.length,0);
});

test('hold timeout is bounded and does not accept a stuck pickup',async()=>{
 const {state,driver}=fixture();state.phase='pickup';
 await assert.rejects(driver.held(),/Long press did not reach held/);
 assert.equal(state.time,2000);assert.equal(state.focusCalls,0);
});

test('mouse up checks focus without refocusing a cancelled interaction',async()=>{
 const {state,driver}=fixture();
 await assert.rejects(driver.up(),/Synthetic input lost focus/);
 assert.equal(state.events.length,0);assert.equal(state.focusCalls,0);
});

test('a grab cancelled during native movement fails before mouse up can hide it',async()=>{
 const {state,driver}=fixture();state.phase='dropping';state.nativeFocused=state.documentFocused=true;
 await assert.rejects(driver.checkHeld(),/Grab ended before mouse up:.*lostpointercapture/);
 assert.equal(state.events.length,0);assert.equal(state.focusCalls,0);
 state.phase='held';assert.equal((await driver.checkHeld()).phase,'held');
});

test('cancellation during screenshot preparation cannot pass as the injected release',async()=>{
 const {state,driver}=fixture();state.phase='dropping';state.nativeFocused=state.documentFocused=true;
 await assert.rejects(driver.up(),/Unexpected phase before mouse up \(expected held\):.*dropping/);
 assert.equal(state.events.length,0);assert.equal(state.focusCalls,0);
});

test('short-click release rejects a press that already started pickup',async()=>{
 const {state,driver}=fixture();state.phase='pickup';state.nativeFocused=state.documentFocused=true;
 await assert.rejects(driver.up('pending'),/Unexpected phase before mouse up \(expected pending\)/);
 assert.equal(state.events.length,0);
});

test('normal mouse up uses current grab coordinates and the next press can refocus',async()=>{
 const {state,driver}=fixture();await driver.down();await driver.up('pending');
 assert.deepEqual(state.events.at(-1),{type:'mouseUp',button:'left',clickCount:1,x:40,y:81});
 state.phase='idle';state.nativeFocused=state.documentFocused=false;await driver.down();assert.equal(state.focusCalls,2);
});
