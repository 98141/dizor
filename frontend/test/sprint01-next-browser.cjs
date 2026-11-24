"use strict";
// Sprint 01: real production Next build + real Express/auth + ephemeral replica set (Inicio y Centro de alertas).
// Own random loopback ports, sanitized child environment, no .env or external providers.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),front=path.join(root,'frontend'),out=path.join(path.resolve(root,'../docs/auditoria-admin/rediseño-premium/evidencias-sprint-01'),'next');
const puppeteer=require(process.env.DIZOR_BROWSER_TOOLS || 'C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core');
fs.mkdirSync(out,{recursive:true});
const tempRoot=fs.realpathSync(os.tmpdir()),stage=fs.mkdtempSync(path.join(tempRoot,'dizor-sprint01-next-'));
const result={mode:'sprint01',checks:[],tasks:[],pageErrors:[],hydrationErrors:[],externalRequests:[],routes:[],isolatedNext:true,realBackend:true};
let page,browser,nextServer,fixture,readyFixture=false,buildLog='',serverLog='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function command(args,env,onData){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:stage,env,windowsHide:true});const timer=setTimeout(()=>child.kill(),240000);child.stdout.on('data',d=>onData(d.toString()));child.stderr.on('data',d=>onData(d.toString()));child.once('error',reject);child.once('exit',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});});}
(async()=>{try{
 const port=await new Promise(resolve=>{const probe=http.createServer();probe.listen(0,'127.0.0.1',()=>{const p=probe.address().port;probe.close(()=>resolve(p));});});
 fixture=require('../../backend/test/helpers/phase2Fixture.cjs');process.env.CLIENT_URL=`http://127.0.0.1:${port}`;process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED='false';await fixture.setup();readyFixture=true;
 const ctx=fixture.context,apiUrl=ctx.base+'/api',origin=`http://127.0.0.1:${port}`;
 fs.cpSync(front,stage,{recursive:true,filter:file=>!['node_modules','.next','.git','test'].includes(path.basename(file))&&!path.basename(file).startsWith('.env')});
 fs.symlinkSync(path.join(front,'node_modules'),path.join(stage,'node_modules'),'junction');
 const guard=path.join(stage,'offline.cjs');fs.writeFileSync(guard,`const net=require('node:net');const fetch=globalThis.fetch;globalThis.fetch=async(input,init)=>{if(process.env.DIZOR_ISOLATED_RUNTIME==='1'&&['localhost','127.0.0.1'].includes(new URL(typeof input==='string'?input:input.url).hostname))return fetch(input,init);throw Error('Isolated fetch blocked');};const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const value=args[0];if(value&&typeof value==='object'&&value.path)return connect.apply(this,args);if(typeof value==='string'&&value.includes('pipe'))return connect.apply(this,args);if(process.env.DIZOR_ISOLATED_RUNTIME==='1'){const normalized=Array.isArray(value)?value[0]:value;const host=typeof normalized==='object'?normalized.host:args[1];if(host===undefined||['localhost','127.0.0.1','::1'].includes(host))return connect.apply(this,args);}throw Error('Isolated TCP blocked');};`);
 const env={};for(const name of ['SystemRoot','WINDIR','COMSPEC','PATH','PATHEXT','TEMP','TMP','NUMBER_OF_PROCESSORS'])if(process.env[name])env[name]=process.env[name];
 Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_API_URL:apiUrl,NEXT_PUBLIC_SITE_URL:origin,NODE_OPTIONS:`--require=${JSON.stringify(guard)}`});
 const nextBin=path.join(front,'node_modules/next/dist/bin/next');
 const built=await command([nextBin,'build','--webpack'],env,text=>{buildLog+=text;fs.writeFileSync(path.join(out,'build-sprint01.txt'),buildLog);});fs.writeFileSync(path.join(out,'build-sprint01.txt'),buildLog);fs.writeFileSync(path.join(out,'build-sprint01.json'),JSON.stringify({exitCode:built.code,signal:built.signal,isolatedCopy:true,envFilesCopied:false,inheritedCredentials:false,network:'build fetch/TCP blocked; runtime loopback only',compiler:'Next.js --webpack'},null,2));assert.equal(built.code,0,buildLog.slice(-5000));
 nextServer=spawn(process.execPath,[nextBin,'start','--hostname','127.0.0.1','--port',String(port)],{cwd:stage,env:{...env,DIZOR_ISOLATED_RUNTIME:'1'},windowsHide:true});nextServer.stdout.on('data',d=>{serverLog+=d;});nextServer.stderr.on('data',d=>{serverLog+=d;});
 for(let attempt=0;attempt<80;attempt++){try{const r=await fetch(origin+'/admin');if(r.status===200)break;}catch{}await sleep(250);if(attempt===79)throw Error(serverLog);}
 browser=await puppeteer.launch({executablePath:process.env.DIZOR_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--disable-sync','--no-first-run']});
 page=await browser.newPage();const downloads=path.join(stage,'downloads');fs.mkdirSync(downloads);await (await page.createCDPSession()).send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await page.setViewport({width:1440,height:1000});
 page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('console',m=>{if(/hydration|hydrating|did not match|Minified React error #4\d\d/i.test(m.text()))result.hydrationErrors.push(m.text());});
 await page.setRequestInterception(true);
 const cookie=async role=>{const cookies=await page.cookies();if(cookies.length)await page.deleteCookie(...cookies);const raw=role==='superadmin'?ctx.superCookie:role==='vendedor'?ctx.vendorCookie:ctx.adminCookie;await page.setCookie(...raw.split('; ').filter(pair=>pair.includes('=')).map(pair=>{const index=pair.indexOf('=');return {name:pair.slice(0,index),value:pair.slice(index+1),url:origin,httpOnly:true,sameSite:'Lax'};}));};
 const text=async value=>page.waitForFunction(t=>document.body.innerText.includes(t),{timeout:20000},value);
 const goto=async(url,value)=>{const r=await page.goto(origin+url,{waitUntil:'domcontentloaded'});assert.ok([200,304].includes(r.status()),`${url}: ${r.status()}`);await text(value);result.routes.push(url);};
 const click=async(label,selector='button,a')=>{
  const find=new Function('return Array.from(document.querySelectorAll('+JSON.stringify(selector)+')).find(e=>e.getClientRects().length>0 && e.textContent.trim()==='+JSON.stringify(label)+')');
  const found=await page.waitForFunction(find,{timeout:20000});const href=await found.evaluate(e=>e.tagName==='A'?e.href:null);await found.dispose();
  await page.locator(find).setTimeout(20000).click();
  if(href&&href.startsWith(origin+'/'))await page.waitForFunction(href=>location.href===href,{timeout:20000},href);
 };
 const link=async href=>{await page.locator(new Function('return Array.from(document.querySelectorAll('+JSON.stringify('a[href='+JSON.stringify(href)+']')+')).find(e=>e.getClientRects().length>0)')).setTimeout(20000).click();await page.waitForFunction(href=>location.href===href,{timeout:20000},origin+href);};
 const check=label=>result.checks.push(label);
 await require('./helpers/sprint01NextFlow.cjs')({page,fixture,ctx,origin,out,result,cookie,text,goto,click,link,check,sleep});

 }finally{
  if(result.passed){const oldFailure=path.join(out,"ultimo-fallo.png");if(fs.existsSync(oldFailure))fs.unlinkSync(oldFailure);}
  if(page && !result.passed){try{result.overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left < -1;}).map(e=>({tag:e.tagName,class:e.className,rect:{left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right},padding:getComputedStyle(e).padding})).slice(0,20)}));result.failure={url:page.url(),text:await page.evaluate(()=>document.body.innerText),activeElement:await page.evaluate(()=>document.activeElement.tagName+': '+document.activeElement.textContent.trim().slice(0,100))};await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'ultimo-fallo.png'),fullPage:true});}catch{}}
  if(browser)await browser.close();if(nextServer){nextServer.kill();await new Promise(resolve=>{if(nextServer.exitCode!==null)return resolve();nextServer.once('exit',resolve);setTimeout(resolve,5000);});}
  if(readyFixture)await fixture.close();
  fs.writeFileSync(path.join(out,'next-navegador.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(out,'next-servidor.txt'),serverLog);if(buildLog)fs.writeFileSync(path.join(out,'build-sprint01.txt'),buildLog);
  const junction=path.join(stage,'node_modules');if(fs.existsSync(junction)){assert(fs.lstatSync(junction).isSymbolicLink());fs.unlinkSync(junction);}const target=fs.realpathSync(stage);assert.equal(path.dirname(target),tempRoot);assert(path.basename(target).startsWith('dizor-sprint01-next-'));fs.rmSync(target,{recursive:true,force:true});
 }
 console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
