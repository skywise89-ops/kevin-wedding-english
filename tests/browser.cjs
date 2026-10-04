/* Run against real Chromium and WebKit. Device tests still need an iPhone. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium, webkit } = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname,'..');
const artifacts = path.join(root,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
const originalSW = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const phraseCount = JSON.parse(fs.readFileSync(path.join(root,'data/phrases.json'))).phrases.length;
const supplementalLessons = JSON.parse(fs.readFileSync(path.join(root,'data/lessons.json'))).filter(l=>l.extra);
const assets = JSON.parse(originalSW.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
const mime = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
let revision = 1, failCSS = false, mismatch = false;
function bytes(file, rev=revision) {
 let b = fs.readFileSync(path.join(root,file));
 if(file==='data/phrases.json' && rev>1) {
  const data = JSON.parse(b);data.phrases.find(p=>p.id==='tilt-your-chin-down-just-a-little').en = 'Chin down a little. Release '+rev+'.';b=Buffer.from(JSON.stringify(data));
 }
 return b;
}
function worker() {
 const hashes = Object.fromEntries(assets.map(f=>[f,crypto.createHash('sha256').update(bytes(f==='./'?'index.html':f)).digest('hex')]));
 return originalSW.replace(/const VERSION = '[^']+';/,"const VERSION = 'browser-test-"+revision+"';").replace(/const HASHES = {[\s\S]*?};/,'const HASHES = '+JSON.stringify(hashes)+';');
}
const server = http.createServer((request,response)=> {
 const url = new URL(request.url,'http://localhost'), file=decodeURIComponent(url.pathname.replace(/^\/wedding\//,'')) || 'index.html';
 if(!url.pathname.startsWith('/wedding/') || file.includes('..')){response.writeHead(404).end();return;}
 if(failCSS && file==='assets/style.css'){response.writeHead(503).end('test failed release');return;}
 try {
  response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.setHeader('Cache-Control','no-store');
  response.end(file==='sw.js'?worker():mismatch && file==='data/phrases.json'?bytes(file,revision+1):bytes(file));
 }catch{response.writeHead(404).end('not found');}
});
const passed=[], errors=[];
const check=(name,condition)=>{assert.ok(condition,name);passed.push(name);};
async function ready(page) {
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.waitForFunction(()=>document.querySelector('footer [data-offline]')?.textContent.includes('완료'));
}
async function offlineStatus(page) {
 return page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  return new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=e=>resolve(e.data);registration.active.postMessage({type:'STATUS'},[channel.port2]);});
 });
}
async function layout(page,name) {
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 check(name+' has no horizontal overflow',!overflow);
 const targets=await page.locator('button:visible').evaluateAll(elements=>elements.filter(e=>!e.disabled).map(e=>({name:e.getAttribute('aria-label')||e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
 check(name+' buttons meet 48px targets',targets.every(t=>t.width>=47.9&&t.height>=47.9));
 check(name+' icon buttons have names',await page.locator('button.iconbtn:visible').evaluateAll(elements=>elements.every(e=>!!e.getAttribute('aria-label'))));
}
async function main(engine,label,base) {
 const launch=engine===chromium?{headless:true,...(process.env.KWE_CHROME_PATH?{executablePath:process.env.KWE_CHROME_PATH}:{})}:{headless:true};
 const browser=await engine.launch(launch);
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:'light'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(label+': '+e.message));page.on('response',r=>{if(r.status()>=400)errors.push(label+': HTTP '+r.status()+' '+r.url());});
 await page.goto(base+'index.html');await page.waitForSelector('#today-lesson .btn');await ready(page);
 check(label+' first install has no update banner',await page.locator('#update-banner').count()===0);
 await layout(page,label+' home');
 await page.screenshot({path:path.join(artifacts,'home-'+label+'.png')});
 await page.getByRole('link',{name:'촬영 현장 열기'}).click();await page.waitForSelector('.phrase');
 await layout(page,label+' field');
 await page.getByRole('button',{name:'모든 표현 보기'}).click();await page.evaluate(()=>scrollTo(0,1800));
 await page.locator('.tabbar a').filter({hasText:'홈'}).click();await page.waitForSelector('#today-lesson .btn');
 await page.locator('.tabbar a').filter({hasText:'현장'}).click();await page.waitForSelector('.phrase');
 await page.waitForFunction(()=>scrollY>1700);
 check(label+' expanded field list and scroll survive navigation',await page.locator('.phrase').count()===phraseCount);
 await page.evaluate(()=>scrollTo(0,0));
 await page.getByRole('searchbox',{name:'상황·한국어·영어 검색'}).fill('턱 내려');
 await page.waitForFunction(()=>document.querySelector('.phrase')?.dataset.id==='tilt-your-chin-down-just-a-little'&&!document.querySelector('#clear-search').hidden);
 check(label+' search and clear controls stay separated',await page.evaluate(()=>{const icon=document.querySelector('.search-wrap>span[data-icon]').getBoundingClientRect(),clear=document.querySelector('#clear-search').getBoundingClientRect(),input=document.querySelector('#q').getBoundingClientRect();return icon.right<clear.left&&clear.right<=input.right;}));
 check(label+' chin query finds actual directing phrase',(await page.locator('.phrase .en').first().innerText()).includes('chin'));
 await page.locator('[data-star]').first().click();
 check(label+' saving never duplicates a result',await page.locator('.phrase[data-id="tilt-your-chin-down-just-a-little"]').count()===1);
 await page.locator('[data-kit]').first().click();
 await page.locator('[data-show]').first().click();
 check(label+' English presentation opens',await page.locator('#show-dialog').evaluate(e=>e.open));
 check(label+' presentation sentence matches card',(await page.locator('#show-text').innerText()).includes('chin'));
 await page.screenshot({path:path.join(artifacts,'show-'+label+'.png')});
 await page.getByRole('button',{name:'큰 문장 닫기'}).click();
 await page.waitForFunction(()=>!document.querySelector('.toast.show')&&(!document.querySelector('.toast')||getComputedStyle(document.querySelector('.toast')).opacity==='0'));await page.screenshot({path:path.join(artifacts,'field-'+label+'.png')});
 await page.evaluate(()=>{
  window._originalSpeak=speechSynthesis.speak.bind(speechSynthesis);window._originalCancel=speechSynthesis.cancel.bind(speechSynthesis);
  speechSynthesis.speak=function(utterance){window._testUtterance=utterance;utterance.onstart&&utterance.onstart();};speechSynthesis.cancel=function(){};
 });
 await page.locator('[data-play]').first().click();
 check(label+' playback exposes a stop state',await page.locator('[data-play]').first().getAttribute('aria-pressed')==='true');
 await page.locator('[data-play]').first().click();
 check(label+' playback stops and clears its state',await page.locator('[data-play]').first().getAttribute('aria-pressed')==='false');
 await page.locator('[data-play]').first().click();await page.evaluate(()=>window._testUtterance.onerror({error:'synthesis-failed'}));
 check(label+' playback failure resets the control',await page.locator('[data-play]').first().getAttribute('aria-pressed')==='false');
 await page.evaluate(()=>{speechSynthesis.speak=window._originalSpeak;speechSynthesis.cancel=window._originalCancel;});
 await page.evaluate(()=>{KWE.set('theme','dark');KWE.set('size',26);});
 await page.getByRole('button',{name:'야외',exact:true}).click();
 check(label+' outdoor readable',await page.evaluate(()=>KWE.get('outdoor')&&KWE.get('theme')==='light'&&KWE.get('size')>=22));
 await page.screenshot({path:path.join(artifacts,'outdoor-'+label+'.png')});
 await page.getByRole('button',{name:'야외',exact:true}).click();
 check(label+' outdoor restores personal settings',await page.evaluate(()=>KWE.get('theme')==='dark'&&KWE.get('size')===26));
 check(label+' browser chrome color follows the screen theme',await page.evaluate(()=>document.querySelector('meta[name="theme-color"]').content===getComputedStyle(document.body).getPropertyValue('--bg').trim()));
 await page.screenshot({path:path.join(artifacts,'dark-'+label+'.png')});
 await page.evaluate(()=>{KWE.set('theme','light');KWE.set('size',18);});
 await page.getByRole('searchbox',{name:'상황·한국어·영어 검색'}).fill('없는표현xyz');await page.getByText('맞는 표현을 찾지 못했어요').waitFor();
 await page.getByRole('button',{name:'전체 표현으로'}).click();
 await page.locator('[data-scope="kit"]').click();
 check(label+' shooting kit contains the chosen phrase',await page.locator('.phrase').count()===1);
 await page.locator('#kit-name').fill('토요일 야외 촬영');
 await page.locator('[data-scope="all"]').click();await page.getByRole('searchbox',{name:'상황·한국어·영어 검색'}).fill('좀 가까이');
 await page.waitForFunction(()=>document.querySelector('.phrase')?.dataset.id==='come-a-little-closer-to-each-other');
 await page.locator('[data-kit]').first().click();await page.locator('[data-scope="kit"]').click();await page.getByRole('button',{name:'검색 지우기'}).click();
 const originalOrder=await page.evaluate(()=>KWE.load().kit.slice());
 await page.locator('[data-direction="-1"]:not(:disabled)').first().click();
 check(label+' kit order saved',await page.evaluate(first=>KWE.load().kit[0]!==first,originalOrder[0]));
 await page.locator('.tabbar a').filter({hasText:'홈'}).click();await page.getByRole('link',{name:/토요일 야외 촬영/}).waitFor();
 await page.locator('.tabbar a').filter({hasText:'현장'}).click();await page.waitForSelector('.phrase');
 check(label+' navigation preserves search and filter',await page.locator('[data-scope="kit"]').getAttribute('aria-pressed')==='true');
 await page.goto(base+'practice.html#quick');await page.getByRole('button',{name:'영어 확인'}).waitFor();
 await page.screenshot({path:path.join(artifacts,'practice-'+label+'.png')});
 await page.getByRole('button',{name:'영어 확인'}).click();await page.locator('[data-grade="1"]').click();
 const session=await page.evaluate(()=>JSON.parse(JSON.stringify(KWE.load().session)));
 check(label+' again rating does not extend the short set',session.ids.length===5&&session.index===1);
 await page.goto(base+'index.html');await page.getByRole('link',{name:/이전 연습/}).click();await page.getByRole('button',{name:'영어 확인'}).waitFor();
 check(label+' incomplete recall resumes',await page.evaluate(()=>KWE.load().session.index===1));
 for(let i=1;i<5;i++){await page.getByRole('button',{name:'영어 확인'}).click();await page.locator('[data-grade="4"]').click();}
 await page.getByRole('heading',{name:'오늘의 한 걸음, 완료'}).waitFor();
 check(label+' five-card set completes and clears session',await page.evaluate(()=>KWE.load().session===null));
 const originPort=server.address().port;
 if(label==='webkit') await new Promise(resolve=>server.close(resolve));
 else await context.setOffline(true);
 await page.goto(base+'field.html#scope=kit');await page.waitForSelector('.phrase');
 check(label+' kit stays usable offline',await page.locator('.phrase').count()===2);
 await page.locator('[data-scope="all"]').click();await page.getByRole('searchbox',{name:'상황·한국어·영어 검색'}).fill('턱내려');
 await page.waitForFunction(()=>document.querySelectorAll('.phrase').length===1&&document.querySelector('.phrase')?.dataset.id==='tilt-your-chin-down-just-a-little');
 check(label+' Korean alias search works offline',(await page.locator('.phrase .en').innerText()).includes('chin'));
 await page.locator('[data-scope="saved"]').click();
 check(label+' saved expressions stay searchable offline',await page.locator('.phrase').count()===1);
 await page.goto(base+'practice.html#kit');await page.getByRole('button',{name:'영어 확인'}).waitFor();
 await page.getByRole('button',{name:'영어 확인'}).click();await page.locator('[data-grade="3"]').click();
 check(label+' offline recall persists',await page.evaluate(()=>KWE.load().session.index===1));
 await page.goto(base+'lessons/0009-micro-adjustment-direction.html');await page.locator('.lesson-wrap>h1').waitFor();
 check(label+' offline lesson renders',await page.locator('.exprow').count()>0);
 const checkbox=page.locator('#checklist input').first();await checkbox.check();
 await page.evaluate(()=>scrollTo(0,650));await page.waitForFunction(()=>scrollY>=640&&scrollY<=660);await page.goto(base+'index.html');await page.waitForSelector('#today-lesson .btn');
 await page.getByRole('link',{name:'이어서 학습'}).click();await page.waitForSelector('#checklist input');
 await page.waitForFunction(()=>scrollY>500&&document.querySelector('#checklist input')?.checked);
 check(label+' lesson checklist and position resume',await checkbox.isChecked()&&await page.evaluate(()=>scrollY)>500);
 if(label==='webkit') await new Promise(resolve=>server.listen(originPort,'127.0.0.1',resolve));
 else await context.setOffline(false);
 await page.goto(base+'practice.html#shadow');await page.getByRole('button',{name:'따라 말했어요 · 다음'}).waitFor();
 check(label+' shadowing offers manual progression',await page.locator('#stage').innerText().then(t=>t.includes('발음 평가가 아닙니다')));
 await page.getByRole('button',{name:'따라 말했어요 · 다음'}).click();
 await page.goto(base+'practice.html#quiz');await page.locator('[data-choice]').first().click();
 check(label+' quiz gives text feedback',(await page.locator('#feedback').innerText()).length>0);await page.getByRole('button',{name:'다음 문제'}).click();
 await page.goto(base+'index.html');await page.getByRole('button',{name:'설정',exact:true}).click();
 const stateBefore=await page.evaluate(()=>localStorage.getItem('kwe_state_v2'));
 await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":3,"lessons":{},"pins":7}')});
 await page.locator('#import-preview').filter({hasText:'올바르지 않습니다'}).waitFor();
 check(label+' invalid backup preserves original',await page.evaluate(()=>localStorage.getItem('kwe_state_v2'))===stateBefore);
 const backup=JSON.parse(stateBefore);backup.kitName='검증 백업';
 await page.locator('#import-file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(1048577,32)});
 await page.locator('#import-preview').filter({hasText:'1MB'}).waitFor();
 check(label+' oversized backup preserves original',await page.evaluate(()=>localStorage.getItem('kwe_state_v2'))===stateBefore);
 await page.locator('#import-file').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.getByRole('button',{name:'확인하고 복원'}).waitFor();
 check(label+' backup preview precedes replacement',await page.evaluate(()=>localStorage.getItem('kwe_state_v2'))===stateBefore);
 await page.getByRole('button',{name:'확인하고 복원'}).click();await page.waitForSelector('#today-lesson .btn');
 check(label+' backup restores and retains recovery copy',await page.evaluate(before=>KWE.load().kitName==='검증 백업'&&localStorage.getItem('kwe_state_v2:recovery')===before,stateBefore));
 await page.getByRole('button',{name:'설정',exact:true}).click();
 const [recoveryDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'변경 전 데이터 내려받기'}).click()]);
 const recoveryPath=await recoveryDownload.path();
 check(label+' recovery export contains the exact pre-change data',fs.readFileSync(recoveryPath,'utf8')===stateBefore);
 await page.locator('#import-file').setInputFiles(recoveryPath);await page.getByRole('button',{name:'확인하고 복원'}).click();await page.waitForSelector('#today-lesson .btn');
 check(label+' recovery backup can restore the previous user state',await page.evaluate(name=>KWE.load().kitName===name,JSON.parse(stateBefore).kitName));
 for(const width of [320,375,430]){
  await page.setViewportSize({width,height:844});await page.goto(base+'field.html#q=턱%20내려');await page.waitForSelector('.phrase');await layout(page,label+' '+width+'px');
  if(width===320)await page.screenshot({path:path.join(artifacts,'small-'+label+'.png')});
 }
 await page.locator('.category-picker summary').click();await page.locator('[data-cat="micro"]').click();
 check(label+' category selection keeps results and keyboard focus',await page.locator('.phrase').count()===1&&await page.evaluate(()=>document.activeElement===document.querySelector('.category-picker summary')));
 await page.setViewportSize({width:844,height:390});await page.locator('[data-show]').first().click();
 check(label+' landscape presentation close stays available',await page.locator('#close-show').isVisible());await page.getByRole('button',{name:'큰 문장 닫기'}).click();
 await page.setViewportSize({width:1200,height:900});await page.goto(base+'index.html');await page.waitForSelector('#today-lesson .btn');await layout(page,label+' desktop');
 await page.goto(base+'docs/icon-comparison.html');await page.screenshot({path:path.join(artifacts,'icons-'+label+'.png'),fullPage:true});
 check(label+' icon comparison has all three originals',await page.locator('section.option').count()===3);
 await context.close();
 const migrated=await browser.newContext({viewport:{width:390,height:844}});
 const phraseId='tilt-your-chin-down-just-a-little';
 const v2={version:2,lessons:{'1':{done:true,first:'2026-09-01',last:'2026-09-01',due:'2026-09-02',reps:1,ease:2.5,interval:1,lapses:0}},cards:{},pins:[phraseId],days:{},settings:{theme:'dark',rate:.85,voice:'Samantha',size:20,outdoor:false,showKo:true},checks:{'1':[true]}};
 await migrated.addInitScript(data=>{if(!localStorage.getItem('kwe_state_v2'))localStorage.setItem('kwe_state_v2',JSON.stringify(data));},v2);
 const mp=await migrated.newPage();await mp.goto(base+'field.html');await mp.waitForSelector('.phrase');
 check(label+' real browser migrates v2 without losing progress',await mp.evaluate(id=>KWE.load().lessons['1'].done&&KWE.load().pins.includes(id)&&KWE.get('voice')==='Samantha'&&KWE.get('rate')===.85&&KWE.get('size')===20,phraseId));await migrated.close();
 return browser;
 }catch(error){await browser.close();throw error;}
}
async function updates(browser,base) {
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(base+'field.html#q=턱%20내려');await page.waitForSelector('.phrase');await ready(page);
 const first=(await page.locator('.phrase .en').first().innerText());
 await page.evaluate(async()=>{await (await caches.open('unrelated-app')).put('/unrelated',new Response('keep'));});
 revision=2;
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await page.getByRole('button',{name:'업데이트 적용'}).waitFor();
 await page.reload();await page.waitForSelector('.phrase');
 check('pending update keeps old code and content coherent',await page.locator('.phrase .en').first().innerText()===first);
 await page.getByRole('button',{name:'업데이트 적용'}).click();await page.waitForFunction(()=>document.querySelector('.phrase .en')?.textContent.includes('Release 2'));
 check('user activation switches the entire release',(await offlineStatus(page)).version==='browser-test-2');
 check('activation keeps unrelated app caches',await page.evaluate(async()=>await caches.has('unrelated-app')));
 revision=3;failCSS=true;
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;});
 check('failed install leaves active release intact',(await offlineStatus(page)).version==='browser-test-2'&&(await offlineStatus(page)).ready);
 check('failed cache is discarded',await page.evaluate(async()=>!(await caches.keys()).some(k=>k.endsWith('browser-test-3'))));
 failCSS=false;revision=4;mismatch=true;
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;});
 check('hash mismatch never activates a mixed release',(await offlineStatus(page)).version==='browser-test-2');
 mismatch=false;revision=2;
 await context.setOffline(true);await page.reload();await page.waitForSelector('.phrase');
 check('last good release survives failed updates offline',(await page.locator('.phrase .en').first().innerText()).includes('Release 2'));
 await context.close();revision=1;
}
async function groupLesson(browser,label,base) {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:'light'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(label+' group lesson: '+e.message));
 const filename='lessons/0021-family-group-photos.html',family='could-we-get-the-immediate-family-for-the-next-o';
 try {
  await page.goto(base+'index.html');await page.waitForSelector('#today-lesson .btn');await ready(page);
  check(label+' group lesson shortcut is outside the collapsed library',await page.locator('#group-lesson').isVisible());
  await page.locator('#lesson-library summary').click();await page.getByRole('button',{name:'실전 보충',exact:true}).click();
  check(label+' supplemental filter exposes the group lesson',await page.locator('.lesson-item').count()===supplementalLessons.length&&await page.locator('.lesson-item[href="'+filename+'"]').count()===1);
  await page.getByRole('button',{name:'전체',exact:true}).click();await page.getByRole('searchbox',{name:'레슨 검색'}).fill('그룹 촬영');
  check(label+' Korean group search finds the family and friends lessons',await page.locator('.lesson-item[href="'+filename+'"]').count()===1&&await page.locator('.lesson-item[href="lessons/0022-friends-group-photos.html"]').count()===1);
  await page.locator('#group-lesson').click();await page.locator('.exprow').first().waitFor();
  check(label+' group lesson teaches all six canonical field phrases',await page.locator('.exprow').count()===6);
  check(label+' supplemental lesson uses a meaningful label instead of Week 0',!(await page.locator('.lesson-wrap').innerText()).includes('Week 0'));
  await layout(page,label+' group lesson');
  await page.screenshot({path:path.join(artifacts,'group-lesson-'+label+'.png')});
  const first=page.locator('.exprow [data-sentence-save]').first();await first.click();
  check(label+' group lesson shares existing field bookmark IDs',await page.evaluate(id=>KWE.load().pins.includes(id),family));
  const sample=page.locator('.scn [data-sentence-save]').first(),sampleId=await sample.getAttribute('data-sentence-save');await sample.click();
  check(label+' supplemental scenario saves its translation and lesson 21 source',await page.evaluate(id=>KWE.load().sentences[id].lessons[0]===21&&KWE.load().sentences[id].ko.includes('직계 가족'),sampleId));
  await page.locator('#checklist input').first().check();await page.locator('.quiz-choices').nth(1).locator('label[data-correct="true"]').click();
  await page.locator('[data-g="4"]').click();await page.reload();
  check(label+' group lesson completion, checklist and quiz persist',await page.evaluate(()=>KWE.load().lessons['21'].done&&KWE.load().checks['21'][0]&&KWE.load().quizAnswers['21'][1]===1));
  await page.getByRole('button',{name:'설정',exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'백업 내보내기'}).click()]);
  const backupPath=await download.path();await page.locator('#import-file').setInputFiles(backupPath);
  await page.getByRole('button',{name:'확인하고 복원'}).click();await page.locator('.exprow').first().waitFor();
  check(label+' backup restore retains supplemental progress and sentences',await page.evaluate(id=>KWE.load().lessons['21'].done&&KWE.load().sentences[id].lessons[0]===21,sampleId));
  const originPort=server.address().port;
  if(label==='webkit')await new Promise(resolve=>server.close(resolve));else await context.setOffline(true);
  try {
   await page.goto(base+'index.html');await page.waitForSelector('#today-lesson .btn');await page.locator('#group-lesson').click();await page.locator('.exprow').first().waitFor();
   check(label+' new group lesson is fully available offline',await page.locator('.exprow').count()===6&&await first.getAttribute('aria-pressed')==='true');
   await page.goto(base+'field.html#scope=saved');await page.waitForSelector('.phrase');
   check(label+' group core and supplemental scenario remain usable in field offline',await page.locator('.phrase[data-id="'+family+'"]').count()===1&&await page.locator('.phrase[data-id="'+sampleId+'"]').count()===1);
  }finally{if(label==='webkit')await new Promise(resolve=>server.listen(originPort,'127.0.0.1',resolve));else await context.setOffline(false);}
  await page.goto(base+'practice.html#saved');await page.getByRole('button',{name:'영어 확인'}).waitFor();
  check(label+' saved group lesson expressions enter recall practice',await page.evaluate(id=>KWE.load().session.ids.includes(id),sampleId));
 }finally{await context.close();}
}
async function friendsLesson(browser,label,base) {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:'light'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(label+' friends lesson: '+e.message));
 const filename='lessons/0022-friends-group-photos.html',joke='friends-relax-this-isn-t-a-passport-photo',fallback='friends-no-pose-needed-just-enjoy-being-together',family='could-we-get-the-immediate-family-for-the-next-o';
 try {
  await page.goto(base+'index.html');await page.waitForSelector('#today-lesson .btn');await ready(page);
  check(label+' friends lesson is directly visible on home',await page.locator('#friends-lesson').isVisible());
  await page.evaluate(id=>{const state=KWE.load();state.pins=[id];state.lessons['21']={done:true,first:'2026-10-04',last:'2026-10-04',due:'2026-10-08',reps:1,ease:2.5,interval:4,lapses:0};state.settings.rate=.85;KWE.save();},family);
  await page.locator('#lesson-library summary').click();await page.getByRole('searchbox',{name:'레슨 검색'}).fill('친구 농담');
  check(label+' friends joke search finds its lesson',await page.locator('.lesson-item[href="'+filename+'"]').count()===1);
  await page.locator('#friends-lesson').click();await page.locator('.exprow').first().waitFor();
  await layout(page,label+' friends lesson');
  await page.locator('.exprow [data-sentence-save="'+joke+'"]').click();
  check(label+' joke saves to its field ID and every occurrence',await page.locator('[data-sentence-save="'+joke+'"]').evaluateAll(buttons=>buttons.every(b=>b.getAttribute('aria-pressed')==='true')));
  await page.locator('.quiz-choices').nth(2).locator('label[data-correct="true"]').click();
  await page.locator('.quiz-save [data-sentence-save="'+fallback+'"]').click();
  check(label+' quiet fallback quiz answer is saved to its field ID',await page.evaluate(id=>KWE.load().pins.includes(id),fallback));
  await page.locator('#checklist input').first().check();await page.locator('[data-g="4"]').click();await page.reload();
  check(label+' friends completion and quiz persist alongside prior family progress',await page.evaluate(()=>KWE.load().lessons['22'].done&&KWE.load().checks['22'][0]&&KWE.load().quizAnswers['22'][2]===2&&KWE.load().lessons['21'].due==='2026-10-08'&&KWE.get('rate')===.85));
  await page.locator('#expressions').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,'friends-lesson-'+label+'.png')});
  await page.goto(base+'field.html#q=친구사진');await page.waitForSelector('.phrase');
  check(label+' friends photo search exposes all eight new expressions',await page.locator('.phrase').count()===8);
  await page.locator('.phrase[data-id="'+joke+'"] [data-kit]').click();
  check(label+' saved joke can be added to a shooting kit',await page.evaluate(id=>KWE.load().kit.includes(id),joke));
  for(const [query,wanted] of [['그룹 농담',joke],['환호','friends-on-three-cheer-for-these-two'],['앨범 커버','friends-give-me-your-best-album-cover-pose'],['농담 반응 없음',fallback]]){
   await page.getByRole('searchbox',{name:'상황·한국어·영어 검색'}).fill(query);
   await page.waitForFunction(id=>document.querySelector('.phrase')?.dataset.id===id,wanted);
   check(label+' field search finds friends prompt: '+query,await page.locator('.phrase').first().getAttribute('data-id')===wanted);
  }
  await page.getByRole('searchbox',{name:'상황·한국어·영어 검색'}).fill('친구사진');await page.waitForFunction(()=>document.querySelectorAll('.phrase').length===8);
  await page.waitForFunction(()=>!document.querySelector('.toast.show')&&(!document.querySelector('.toast')||getComputedStyle(document.querySelector('.toast')).opacity==='0'));
  await page.screenshot({path:path.join(artifacts,'friends-field-'+label+'.png')});
  await page.getByRole('button',{name:'설정',exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'백업 내보내기'}).click()]);
  await page.locator('#import-file').setInputFiles(await download.path());await page.getByRole('button',{name:'확인하고 복원'}).click();await page.waitForSelector('.phrase');
  check(label+' friends backup restore preserves new and existing pins, kit and lessons',await page.evaluate(({joke,fallback,family})=>{const s=KWE.load();return [joke,fallback,family].every(id=>s.pins.includes(id))&&s.kit.includes(joke)&&s.lessons['22'].done&&s.lessons['21'].due==='2026-10-08'&&s.settings.rate===.85;},{joke,fallback,family}));
  const originPort=server.address().port;
  if(label==='webkit')await new Promise(resolve=>server.close(resolve));else await context.setOffline(true);
  try {
   await page.goto(base+filename);await page.locator('.exprow').first().waitFor();
   check(label+' friends lesson and saved joke work offline',await page.locator('.exprow').count()===6&&await page.locator('.exprow [data-sentence-save="'+joke+'"]').getAttribute('aria-pressed')==='true');
   await page.goto(base+'field.html#q=친구사진');await page.waitForSelector('.phrase');
   check(label+' all friends expressions remain searchable offline',await page.locator('.phrase').count()===8);
   await page.goto(base+'field.html#scope=kit');await page.waitForSelector('.phrase');
   check(label+' friends shooting kit remains available offline',await page.locator('.phrase[data-id="'+joke+'"]').count()===1);
   await page.goto(base+'practice.html#saved');await page.getByRole('button',{name:'영어 확인'}).waitFor();
   check(label+' friends jokes and fallback enter offline recall',await page.evaluate(({joke,fallback})=>KWE.load().session.ids.includes(joke)&&KWE.load().session.ids.includes(fallback),{joke,fallback}));
  }finally{if(label==='webkit')await new Promise(resolve=>server.listen(originPort,'127.0.0.1',resolve));else await context.setOffline(false);}
  await page.setViewportSize({width:320,height:844});await page.goto(base+filename);await layout(page,label+' friends lesson 320px');
 }finally{await context.close();}
}
async function lessonSaves(browser,label,base) {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(label+' lesson saves: '+e.message));
 const filename='lessons/0001-arrival-greeting-car-exit.html';
 try {
  await page.goto(base+filename);await ready(page);
  const canonical='you-made-it-you-both-look-amazing-already';
  const first=page.locator('.exprow [data-sentence-save]').first();await first.click();
  check(label+' lesson core save updates every occurrence of the same sentence',await page.locator('[data-sentence-save="'+canonical+'"]').evaluateAll(buttons=>buttons.every(b=>b.getAttribute('aria-pressed')==='true')));
  await page.reload();check(label+' lesson save persists after reload',await first.getAttribute('aria-pressed')==='true');
  const sample=page.locator('.scn [data-sentence-save]').first(),sampleId=await sample.getAttribute('data-sentence-save');await sample.click();
  check(label+' scenario stores a complete sentence snapshot',await page.evaluate(id=>KWE.load().sentences[id].en.includes('No rush at all')&&KWE.load().pins.includes(id),sampleId));
  const response=page.locator('.dialogue [data-sentence-save]').nth(1),responseId=await response.getAttribute('data-sentence-save');await response.click();
  check(label+' dialogue saves the existing Korean meaning',await page.evaluate(id=>KWE.load().sentences[id].ko.includes('긴장'),responseId));
  await page.locator('.mission [data-sentence-save]').click();
  await page.locator('.quiz-choices').first().locator('label[data-correct="true"]').click();
  const answer=page.locator('.quiz-save [data-sentence-save]').first();check(label+' correct quiz sentence can be saved after answering',await answer.isVisible());
  await answer.click();check(label+' saving a duplicate quiz sentence toggles the same bookmark',await first.getAttribute('aria-pressed')==='false');
  await first.click();
  check(label+' canonical bookmark is never duplicated',await page.evaluate(id=>KWE.load().pins.filter(p=>p===id).length===1,canonical));
  await page.evaluate(()=>scrollTo(0,300));await page.waitForFunction(()=>!document.querySelector('.toast.show')&&getComputedStyle(document.querySelector('.toast')).opacity==='0');
  await page.screenshot({path:path.join(artifacts,'lesson-saves-'+label+'.png')});
  await page.goto(base+'field.html#scope=saved');await page.waitForSelector('.phrase');
  check(label+' every lesson bookmark is usable in field saved results',await page.locator('.phrase').count()===4&&await page.locator('.phrase[data-id="'+sampleId+'"]').count()===1);
  await page.goto(base+'practice.html#saved');await page.getByRole('button',{name:'영어 확인'}).waitFor();
  check(label+' supplemental lesson sentences enter saved practice',await page.evaluate(id=>KWE.load().session.ids.includes(id),sampleId));
  await page.getByRole('button',{name:'설정',exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'백업 내보내기'}).click()]);
  const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  check(label+' exported backup includes supplemental sentence definitions',backup.sentences[sampleId].en.includes('No rush at all')&&backup.pins.includes(sampleId));
  await page.locator('#import-file').setInputFiles({name:'lesson-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.getByRole('button',{name:'확인하고 복원'}).click();await page.getByRole('button',{name:'영어 확인'}).waitFor();
  check(label+' restored backup keeps the lesson sentences and practice session',await page.evaluate(id=>KWE.load().sentences[id]&&KWE.load().session.ids.includes(id),sampleId));
  await page.goto(base+'field.html#scope=saved');await page.waitForSelector('.phrase');
  await page.locator('[data-star="'+sampleId+'"]').click();await page.goto(base+filename);
  check(label+' field removal is reflected back in the lesson',await sample.getAttribute('aria-pressed')==='false');
  const originPort=server.address().port;
  if(label==='webkit')await new Promise(resolve=>server.close(resolve));else await context.setOffline(true);
  try {
   await page.reload();await sample.click();await page.goto(base+'field.html#scope=saved');await page.waitForSelector('.phrase');
   check(label+' lesson sentences can be saved and found offline',await page.locator('.phrase[data-id="'+sampleId+'"]').count()===1);
  }finally{if(label==='webkit')await new Promise(resolve=>server.listen(originPort,'127.0.0.1',resolve));else await context.setOffline(false);}
  await page.setViewportSize({width:320,height:844});await page.goto(base+filename);await layout(page,label+' lesson 320px');
 }finally{await context.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/wedding/`;
 try {
  const chrome=await main(chromium,'chromium',base);try{await lessonSaves(chrome,'chromium',base);await groupLesson(chrome,'chromium',base);await friendsLesson(chrome,'chromium',base);await updates(chrome,base);}finally{await chrome.close();}
  const safari=await main(webkit,'webkit',base);try{await lessonSaves(safari,'webkit',base);await groupLesson(safari,'webkit',base);await friendsLesson(safari,'webkit',base);}finally{await safari.close();}
  assert.deepEqual(errors,[],'normal flows have no JS errors or failed resources');
  for(const size of [180,192,512,1024]){const metadata=await sharp(path.join(root,`assets/icon-${size}-v3.png`)).metadata();check(`${size}px icon is opaque square`,metadata.width===size&&metadata.height===size&&!metadata.hasAlpha);}
  const images=['home-chromium.png','field-chromium.png','practice-chromium.png'];
  await sharp({create:{width:1170,height:844,channels:3,background:'#f6f5f0'}}).composite(await Promise.all(images.map(async(file,index)=>({input:await sharp(path.join(artifacts,file)).resize(390,844).toBuffer(),left:index*390,top:0})))).png().toFile(path.join(artifacts,'screens-overview.png'));
  fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify({passed,errors,engines:['Chromium desktop Chrome with mobile viewport','WebKit 26.5 desktop with mobile viewport'],offlineMethods:{Chromium:'browserContext.setOffline(true)',WebKit:'origin HTTP server stopped; setOffline has known engine bug #42775'},realIPhone:false,voiceOver:false},null,2));
  console.log(`PASS ${passed.length} browser assertions across Chromium and WebKit. Real iPhone and VoiceOver not tested.`);
 }finally{if(server.listening)server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
