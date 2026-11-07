'use strict';
// Headless browser integration. Run in CI after installing Playwright + Chromium.
// The 3D module is progressive: if the GPU or its CDN is unavailable, gameplay must
// continue with the original Canvas 2D rather than an empty world.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
  '.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    const name=decodeURIComponent(u.pathname)==='/'?'/index.html':decodeURIComponent(u.pathname);
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep))throw Error('Invalid path');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).on('error',()=>{res.destroy();}).pipe(res);
  }catch{res.writeHead(404);res.end();}
});
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
(async()=>{
  await listen();
  const port=server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:[
      '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox'
    ]});
    const page=await browser.newPage({viewport:{width:1365,height:820},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'commit',timeout:30000});
    await page.waitForFunction(()=>{
      return !!window.CityEngine &&
        document.getElementById('world').width>0 &&
        Number(document.getElementById('population').textContent.replace(/\s/g,''))>0;
    },null,{timeout:20000});
    await page.waitForTimeout(4500);
    const before=await page.evaluate(()=>{
      const canvas=document.getElementById('world');
      const city=JSON.parse(localStorage.getItem(window.CityEngine.SAVE_KEY));
      return {
        saved:JSON.stringify(city),
        world2d:canvas.toDataURL('image/png').length,
        gpu:!!window.MetropoleRenderer3D,
        active:!!window.MetropoleRenderer3D?.active,
        webglShown:document.body.classList.contains('graphics3d-active'),
        terrain:window.CityGraphicsModel.build(city,window.CityEngine.analyze(city)).groups.ground.length
      };
    });
    assert.ok(before.world2d>100,'the fallback canvas must draw even when offline');
    assert.equal(before.terrain,1296);
    if(before.gpu&&before.active){
      assert.equal(before.active,before.webglShown,'renderer activation and visible layer must match');
      await page.evaluate(()=>document.querySelector('[data-action="toggleGraphics"]').click());
      await page.waitForTimeout(500);
      const current=await page.evaluate(()=>({
        active:window.MetropoleRenderer3D.active,
        shown:document.body.classList.contains('graphics3d-active')
      }));
      assert.equal(current.active,!before.active,'graphics switch must change render mode');
      assert.equal(current.shown,current.active,'render mode and canvas visibility must agree');
      await page.evaluate(()=>document.querySelector('[data-action="toggleGraphics"]').click());
      await page.waitForTimeout(500);
    }
    const after=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem(window.CityEngine.SAVE_KEY))));
    assert.equal(after,before.saved,'graphics changes must never overwrite or alter city saves');
    assert.equal(errors.length,0,'unhandled browser runtime error: '+errors.join('; '));
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
    await page.screenshot({path:path.join(root,'artifacts','graphics-browser.png'),fullPage:true});
    console.log('PASS BROWSER GRAPHICS: real browser boot, fallback, 3D/2D switch, saves intact. WebGL loaded:',before.gpu);
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
