const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/Notia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'../output/hinata-live2d-v1');
const metadata=JSON.parse(fs.readFileSync(path.join(root,'layers.json'),'utf8'));
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:1400,height:940},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.route('http://layer-review.local/**',async route=>{
      const filename=path.resolve(root,'.'+decodeURIComponent(new URL(route.request().url()).pathname));
      if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename))return route.fulfill({status:404,body:'Not found'});
      await route.fulfill({status:200,body:fs.readFileSync(filename),contentType:filename.endsWith('.png')?'image/png':filename.endsWith('.json')?'application/json':'text/html; charset=utf-8'});
    });
    await page.goto('http://layer-review.local/review.html');
    await page.waitForFunction(()=>loaded===model.layers.length);
    const defaultImage=await page.locator('canvas').screenshot();
    const visibleCount=await page.locator('input[type=checkbox]:checked').count();
    await page.waitForFunction(()=>[...document.querySelectorAll('#compare img')].every(i=>i.complete&&i.naturalWidth>0));
    const sourceComparison=await page.evaluate(()=>{
      const sourceCanvas=document.createElement('canvas');sourceCanvas.width=model.width;sourceCanvas.height=model.height;
      const c=sourceCanvas.getContext('2d');c.drawImage(document.querySelector('#compare img'),0,0);
      const a=c.getImageData(0,0,model.width,model.height).data,b=ctx.getImageData(0,0,model.width,model.height).data;
      let changed=0,maxChannelDifference=0;for(let i=0;i<a.length;i+=4){let mismatch=false;for(let k=0;k<4;k++){const delta=Math.abs(a[i+k]-b[i+k]);maxChannelDifference=Math.max(maxChannelDifference,delta);if(delta)mismatch=true;}if(mismatch)changed++;}
      return {changedCanvasPixels:changed,maxChannelDifference};
    });
    if(metadata.version===2&&sourceComparison.changedCanvasPixels)throw Error('Browser source reconstruction mismatch: '+JSON.stringify(sourceComparison));
    await page.getByRole('checkbox',{name:metadata.version===2?'正面刘海':'中间刘海',exact:true}).uncheck();
    const changedImage=await page.locator('canvas').screenshot();
    if(defaultImage.equals(changedImage))throw Error('Layer visibility did not affect composite');
    await page.getByRole('button',{name:'恢复默认',exact:true}).click();
    const restoredImage=await page.locator('canvas').screenshot();
    if(!defaultImage.equals(restoredImage))throw Error('Reset did not restore default composite');
    await page.screenshot({path:path.join(root,'review-screenshot.png')});
    await page.getByRole('button',{name:'部件总览',exact:true}).click();
    if(await page.locator('#gallery .card').count()!==metadata.layers.length)throw Error('Missing component cards');
    await page.getByRole('button',{name:'对照原图',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('#compare img')].every(i=>i.complete&&i.naturalWidth>0));
    await page.screenshot({path:path.join(root,'comparison-preview.png')});
    if(errors.length)throw Error(errors.join('\n'));
    const result={loadedImages:metadata.layers.length,defaultVisible:visibleCount,sourceComparison,layerToggle:'passed',reset:'passed',gallery:'passed',comparison:'passed',browserErrors:errors};
    fs.writeFileSync(path.join(root,'browser-validation.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
