import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
let server;
try { await fetch(baseURL); }
catch {
  server = spawn('npm', ['run', 'dev', '--', '--port', '5173', '--strictPort'], { stdio: 'ignore', detached: true });
  let ready = false;
  for (let i=0; i<60; i++) {
    await new Promise(resolve => setTimeout(resolve, 250));
    try { await fetch(baseURL); ready=true; break; } catch { /* Wait for Vite to bind. */ }
  }
  if (!ready) throw new Error('Vite server did not start');
}
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
let checks = 0;
function passed(message) { checks++; console.log(`PASS ${message}`); }
function watch(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type()==='error') errors.push(message.text()); });
}
async function ready(page) {
  await page.goto(`${baseURL}/?test=1`);
  await page.waitForFunction(() => window.__game);
  await page.waitForSelector('#loading', {state: 'hidden'});
  await page.evaluate(() => document.fonts.ready);
}
async function ui(page, id) {
  // A pointer-locked browser routes clicks to the canvas; dispatch the same DOM
  // button activation used by keyboard accessibility when checking HUD dialogs.
  await page.locator(`#${id}`).evaluate(element => element.click());
}
async function state(page) { return page.evaluate(() => window.__game.state); }
async function waitPhase(page, phase) { await page.waitForFunction(phase => window.__game.state.phase === phase, phase); }

try {
  await mkdir('.artifacts', {recursive:true});
  const context = await browser.newContext({viewport:{width:1100,height:780}, deviceScaleFactor:1});
  const page = await context.newPage(); watch(page);
  await ready(page);
  assert.equal((await state(page)).phase, 'intro');
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#start').isVisible(), true);
  await page.screenshot({path:'.artifacts/intro.png'});
  await page.locator('#help').click();
  assert.equal(await page.locator('#help-dialog').isVisible(), true);
  await page.locator('#help-done').click(); await waitPhase(page,'intro');
  passed('intro renders, WebGL initializes, instructions open and close');

  await page.locator('#start').click(); await waitPhase(page,'playing');
  await page.locator('#sound').focus(); await page.keyboard.press('Space');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');
  await page.locator('#scene canvas').focus();
  passed('keyboard Space activates a focused HUD button without spotting a cat');
  const before=(await state(page)).position;
  await page.keyboard.down('w');
  try { await page.waitForFunction(z => window.__game.state.position[2] < z - .5, before[2], {timeout:20000}); }
  finally { await page.keyboard.up('w'); }
  const after=(await state(page)).position;
  assert.ok(after[2] < before[2] - .5, `Expected forward travel, got ${before} -> ${after}`);
  assert.ok(Math.abs(after[1]-1.7) < .1);
  await page.keyboard.press('h');
  assert.equal(await page.locator('#hint-card').isVisible(), true);
  assert.ok((await page.locator('#hint-text').textContent()).length>20);
  await page.keyboard.press('j'); await waitPhase(page,'journal');
  assert.equal(await page.locator('.journal-cat').count(),8);
  await page.keyboard.press('Escape'); await waitPhase(page,'playing');
  await page.screenshot({path:'.artifacts/playing.png'});
  passed('WASD moves the player, hints and journal keyboard controls work');

  const unavailable = await page.evaluate(() => {
    const game=window.__game, cat=game.cats.find(cat=>cat.id==='cobalt');
    game.teleport(0,1.7,21); game.aimAt(cat.position[0],cat.position[1]+.65,cat.position[2]);
    const distant=game.pick();
    game.teleport(13.6,1.7,1.3); game.aimAt(cat.position[0],cat.position[1]+.65,cat.position[2]);
    return {distant,behindWall:game.pick()};
  });
  assert.equal(unavailable.distant,null);
  assert.equal(unavailable.behindWall,null);
  passed('cats beyond spotting range and behind a building cannot be collected');

  const cats = await page.evaluate(() => window.__game.cats);
  for (const cat of cats) {
    const vantage = await page.evaluate(id => {
      const g=window.__game, cat=g.cats.find(cat=>cat.id===id), [cx,cy,cz]=cat.position;
      const blocked=(x,z)=>g.colliders.some(c=>x>c.minX-.4&&x<c.maxX+.4&&z>c.minZ-.4&&z<c.maxZ+.4);
      for (const radius of [2.5,3,2,4,1.6,5]) for (let j=0;j<32;j++) {
        const angle=j/32*Math.PI*2, x=cx+Math.sin(angle)*radius, z=cz+Math.cos(angle)*radius;
        if(x< -30||x>30||z< -41||z>27||blocked(x,z))continue;
        g.teleport(x,1.7,z); g.aimAt(cx,cy+.65,cz);
        if(g.pick()===id) return [x,1.7,z];
      }
      return null;
    },cat.id);
    assert.ok(vantage,`No unobstructed walkable vantage found for ${cat.name}`);
    await page.keyboard.press('e');
    await page.waitForFunction(id => window.__game.state.found.includes(id), cat.id);
    assert.equal(await page.locator('#discovery-name').textContent(),cat.name);
    // Repeated spotting must not increment the journal count.
    const count=(await state(page)).found.length;
    await page.keyboard.press('e');
    assert.equal((await state(page)).found.length,count);
    if(cat.id==='vincent') {
      await page.keyboard.press('j'); await waitPhase(page,'journal');
      await page.waitForTimeout(2700);
      assert.equal((await state(page)).phase,'journal','Completion must not interrupt the open journal');
      await page.keyboard.press('Escape');
    }
    if(cat.id==='cobalt') {
      await page.reload(); await page.waitForFunction(()=>window.__game); await page.waitForSelector('#loading',{state:'hidden'});
      assert.deepEqual((await state(page)).found,['cobalt']);
      assert.equal(await page.locator('#start-label').textContent(),'Continue your stroll');
      await ui(page,'start'); await waitPhase(page,'playing');
      passed('finding a cat persists across reload and duplicate finds do not count twice');
    }
  }
  assert.equal((await state(page)).found.length,8);
  await waitPhase(page,'complete');
  assert.equal(await page.locator('#complete-dialog').isVisible(),true);
  await page.screenshot({path:'.artifacts/completed.png'});
  await ui(page,'complete-journal'); await waitPhase(page,'journal');
  assert.equal(await page.locator('.journal-cat.found').count(),8);
  await ui(page,'journal-close'); await waitPhase(page,'complete');
  await ui(page,'keep-exploring'); await waitPhase(page,'playing');
  passed('all eight cats can be found, completion appears, and exploration can continue');
  await ui(page,'pause-button'); await waitPhase(page,'paused');
  await ui(page,'resume'); await waitPhase(page,'playing');
  passed('pause and resume retain progress');
  await page.reload(); await page.waitForFunction(()=>window.__game); await page.waitForSelector('#loading',{state:'hidden'});
  assert.equal((await state(page)).found.length,8);
  await page.locator('#start').click(); await waitPhase(page,'complete');
  await page.locator('#keep-exploring').click(); await waitPhase(page,'playing');
  await ui(page,'pause-button'); await waitPhase(page,'paused');
  assert.equal(await page.locator('#pause-restart').isVisible(),true);
  await page.locator('#pause-restart').click(); await waitPhase(page,'playing');
  assert.deepEqual((await state(page)).found,[]);
  await page.reload(); await page.waitForFunction(()=>window.__game);
  assert.deepEqual((await state(page)).found,[]);
  assert.equal(await page.locator('#start-label').textContent(),'Enter the painting');
  passed('completed saves can replay after reload, and restart persistently clears the journal');
  await context.close();

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const mobile=await mobileContext.newPage(); watch(mobile);
  await ready(mobile);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await mobile.screenshot({path:'.artifacts/mobile.png'});
  await mobile.locator('#start').tap(); await waitPhase(mobile,'playing');
  assert.equal(await mobile.locator('#joystick').isVisible(),true);
  assert.equal(await mobile.locator('#touch-spot').isVisible(),true);
  assert.equal(await mobile.locator('#touch-pause').isVisible(),true);
  const mobileBefore=(await state(mobile)).position;
  const joystick=await mobile.locator('#joystick').boundingBox();
  const x=joystick.x+joystick.width/2,y=joystick.y+joystick.height/2;
  const cdp=await mobileContext.newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-30}]});
  await mobile.waitForFunction(z=>window.__game.state.position[2]<z-.3,mobileBefore[2],{timeout:20000});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const mobileAfter=(await state(mobile)).position;
  assert.ok(mobileAfter[2]<mobileBefore[2]-.3,'Touch joystick should move forward');
  await mobile.locator('#hint').tap(); assert.equal(await mobile.locator('#hint-card').isVisible(),true);
  await mobile.locator('#journal-open').tap(); await waitPhase(mobile,'journal');
  const journalBox=await mobile.locator('#journal').boundingBox();
  assert.ok(journalBox.width<=390);
  await mobile.locator('#journal-close').tap(); await waitPhase(mobile,'playing');
  await mobile.locator('#touch-pause').tap(); await waitPhase(mobile,'paused');
  passed('mobile layout fits, touch joystick moves, and hint/journal/pause controls work');
  await mobileContext.close();
  assert.deepEqual(errors,[],`Browser errors: ${errors.join('\n')}`);
  passed('desktop and mobile finish without browser or console errors');
  console.log(`\n${checks} browser checks passed. Screenshots saved in .artifacts/.`);
} finally {
  await browser.close();
  if(server) { try { process.kill(-server.pid,'SIGTERM'); } catch { /* Already exited. */ } }
}
