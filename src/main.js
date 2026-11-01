import * as THREE from 'three';
import './style.css';
import { buildWorld } from './world.js';
import { createCats } from './cats.js';
import { movePlayer, readProgress, saveProgress, compassHeading } from './gameplay.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const catIcon = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 13 5 4l9 5h4l9-5-2 9c3 3 3 10 0 13-4 4-14 4-18 0-3-3-3-10 0-13Z"/><path d="M10 17h.1m11.8 0h.1M14 21l2 2 2-2m-2 2v3M2 20l7 1m-7 4 7-1m21-4-7 1m7 4-7-1"/><path d="m8 10 1 3m15-3-1 3"/></svg>';
document.querySelectorAll('[data-cat-icon]').forEach(el => el.innerHTML = catIcon);
const soundIcons = {
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/></svg>',
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/></svg>'
};
$('sound-icon').innerHTML = soundIcons.off;

function init() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 300);
  camera.rotation.order = 'YXZ';
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = !touch;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Explore the village. Use WASD or arrow keys to move, mouse to look, and click a nearby cat.');
  canvas.setAttribute('tabindex', '0');
  $('scene').appendChild(canvas);
  const world = buildWorld(scene);
  const occluders = scene.children.filter(item => item.isMesh && item.name === 'painted-village');
  const friends = createCats(scene, world.catSpots);
  const ids = friends.cats.map(cat => cat.id);
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  friends.reset(readProgress(storage, ids));
  const audio = createAudio();
  let phase = 'intro', previousPhase = 'intro', yaw = 0, pitch = 0, activeCat = null;
  let foundTimer, noticeTimer, hintTimer, lastTargetCheck = 0;
  let completionDue = Infinity;
  let completedThisVisit = friends.cats.every(cat => cat.found);
  const keys = new Set();
  const ray = new THREE.Raycaster(); ray.far = 7.5;
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  let elapsed = 0, walkingTime = 0;
  let drag = null, joystickPointer = null;
  const stick = { x: 0, y: 0 };

  function notify(message, ms = 4000) {
    clearTimeout(noticeTimer); $('notification').textContent = message; $('notification').hidden = false;
    noticeTimer = setTimeout(() => $('notification').hidden = true, ms);
  }
  function clearMovement() { keys.clear(); stick.x = stick.y = 0; joystickPointer = null; $('joystick-thumb').style.transform = ''; drag = null; }
  function releaseMouse() { if (document.pointerLockElement === canvas) document.exitPointerLock(); clearMovement(); }
  function captureMouse() {
    if (phase !== 'playing' || touch || !canvas.requestPointerLock) return;
    try { const p = canvas.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch { /* Drag-to-look remains available. */ }
  }
  document.addEventListener('pointerlockerror', () => { if (phase === 'playing') notify('Drag the view to look around. You can still click cats to say hello.', 6000); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && phase === 'playing') pause(); });
  function setPhase(next) {
    phase = next;
    $('intro').hidden = next !== 'intro';
    $('hud').hidden = next === 'intro';
    document.body.classList.toggle('playing', next !== 'intro');
    $('pause-dialog').hidden = next !== 'paused';
    $('help-dialog').hidden = next !== 'help';
    $('journal-backdrop').hidden = next !== 'journal';
    $('complete-dialog').hidden = next !== 'complete';
    if (next !== 'playing') { releaseMouse(); $('target').hidden = true; $('reticle').classList.remove('active'); }
    const focusTargets = { paused: 'resume', help: 'help-close', journal: 'journal-close', complete: 'keep-exploring', intro: 'start' };
    if (focusTargets[next]) $(focusTargets[next]).focus({ preventScroll: true });
    if (next === 'playing') canvas.focus({ preventScroll: true });
  }
  function resetView() {
    camera.position.fromArray(world.spawn); camera.lookAt(...world.lookAt);
    yaw = camera.rotation.y; pitch = camera.rotation.x;
  }
  function start() {
    resetView();
    if (foundCats().length === ids.length) { completionDue = Infinity; setPhase('complete'); }
    else { setPhase('playing'); captureMouse(); }
  }
  function resume() { setPhase('playing'); captureMouse(); }
  function pause() { if (phase === 'playing') setPhase('paused'); }
  function openJournal() { previousPhase = phase; renderJournal(); setPhase('journal'); }
  function closeJournal() { const next = previousPhase === 'intro' ? 'intro' : previousPhase === 'complete' ? 'complete' : 'playing'; setPhase(next); if (next === 'playing') captureMouse(); }
  function foundCats() { return friends.cats.filter(cat => cat.found); }
  function refreshProgress() {
    const count = foundCats().length;
    $('count').innerHTML = `${count} <i>/ ${ids.length}</i>`;
    $('journal-open').setAttribute('aria-label', `Open cat journal, ${count} of ${ids.length} cats found`);
    $('start-label').textContent = count ? 'Continue your stroll' : 'Enter the painting';
    $('pause-restart').hidden = count !== ids.length;
    renderJournal();
  }
  function renderJournal() {
    const count = foundCats().length;
    $('journal-count').textContent = `${count} of ${ids.length} friends found`;
    $('progress-bar').style.width = `${count / ids.length * 100}%`;
    $('journal-list').innerHTML = friends.cats.map((cat, index) => `<article class="journal-cat ${cat.found ? 'found' : ''}"><div class="journal-cat-art">${catIcon}</div><div><h3>${cat.found ? cat.name : 'A little mystery'}</h3><p>${cat.found ? cat.story : 'Somewhere beneath this starry sky.'}</p></div><span class="cat-index">${cat.found ? '✦' : String(index + 1).padStart(2, '0')}</span></article>`).join('');
  }
  function hint() {
    if (phase !== 'playing') return;
    const remaining = friends.cats.filter(cat => !cat.found).sort((a, b) => camera.position.distanceTo(a.group.position) - camera.position.distanceTo(b.group.position));
    $('hint-text').textContent = remaining.length ? remaining[0].hint : 'Every little friend has been found. The night is yours to wander.';
    $('hint-card').hidden = false; clearTimeout(hintTimer);
    hintTimer = setTimeout(() => $('hint-card').hidden = true, 13000);
  }
  function pick(ndc = { x: 0, y: 0 }) {
    camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
    const catHits = ray.intersectObjects(friends.selectable, false);
    if (!catHits.length) return null;
    const hit = catHits[0];
    const walls = ray.intersectObjects(occluders, false);
    if (walls.length && walls[0].distance < hit.distance - 0.04) return null;
    return friends.cats.find(cat => cat.id === hit.object.userData.catId) ?? null;
  }
  function discover(cat) {
    if (phase !== 'playing' || !cat) return false;
    if (cat.found) { notify(`${cat.name} is happy to see you again.`, 2300); return false; }
    if (!friends.find(cat.id)) return false;
    const found = foundCats();
    if (!saveProgress(storage, found.map(friend => friend.id))) notify('Your browser could not save this visit. Your finds will last for this session.', 6000);
    refreshProgress(); audio.found();
    $('hint-card').hidden = true;
    $('discovery-count').textContent = `A NEW LITTLE FRIEND · ${String(found.length).padStart(2, '0')} / 08`;
    $('discovery-name').textContent = cat.name; $('discovery-story').textContent = cat.story;
    $('discovery').hidden = false; clearTimeout(foundTimer);
    foundTimer = setTimeout(() => $('discovery').hidden = true, 4800);
    if (found.length === ids.length && !completedThisVisit) {
      completedThisVisit = true;
      completionDue = performance.now() + 2300;
    }
    return true;
  }
  function spot(ndc) {
    if (phase !== 'playing') return;
    const cat = pick(ndc);
    if (cat) discover(cat);
  }
  function look(dx, dy) { yaw -= dx * .0025; pitch = THREE.MathUtils.clamp(pitch - dy * .0025, -1.35, 1.35); camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
  function updateTarget() {
    activeCat = pick();
    $('target').hidden = !activeCat;
    $('reticle').classList.toggle('active', Boolean(activeCat));
    if (activeCat) {
      $('target').querySelector('.target-name').textContent = activeCat.found ? activeCat.name : 'A little friend';
      $('target').querySelector('small').textContent = activeCat.found ? 'ALREADY IN YOUR JOURNAL' : touch ? 'TAP TO SAY HELLO' : 'CLICK TO SAY HELLO';
    }
  }
  function backToIntro() { setPhase('intro'); $('hint-card').hidden = true; $('discovery').hidden = true; }
  $('start').onclick = start;
  $('resume').onclick = resume;
  $('pause-button').onclick = pause;
  $('touch-pause').onclick = pause;
  $('brand').onclick = e => { e.preventDefault(); if (phase !== 'intro') setPhase('paused'); };
  $('return-title').onclick = backToIntro;
  $('journal-open').onclick = openJournal;
  $('pause-journal').onclick = openJournal;
  $('complete-journal').onclick = openJournal;
  $('journal-close').onclick = closeJournal;
  $('journal-backdrop').onclick = e => { if (e.target === $('journal-backdrop')) closeJournal(); };
  $('help').onclick = () => { previousPhase = phase; setPhase('help'); };
  function closeHelp() { const next = previousPhase === 'intro' ? 'intro' : 'playing'; setPhase(next); if (next === 'playing') captureMouse(); }
  $('help-close').onclick = closeHelp; $('help-done').onclick = closeHelp;
  $('hint').onclick = hint;
  $('hint-close').onclick = () => $('hint-card').hidden = true;
  $('touch-spot').onclick = () => spot();
  $('sound').onclick = () => {
    const enabled = audio.toggle(); $('sound-icon').innerHTML = enabled ? soundIcons.on : soundIcons.off;
    $('sound').setAttribute('aria-pressed', String(enabled));
    $('sound').setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
    $('sound').title = enabled ? 'Turn sound off' : 'Turn sound on';
    $('sound').querySelector('.sound-label').textContent = enabled ? 'Sound on' : 'Sound off';
  };
  $('keep-exploring').onclick = resume;
  function restart() {
    completionDue = Infinity; friends.reset(); completedThisVisit = false;
    $('discovery').hidden = true; $('hint-card').hidden = true;
    if (!saveProgress(storage, [])) notify('Your browser could not save the reset.');
    refreshProgress(); start();
  }
  $('restart').onclick = restart;
  $('pause-restart').onclick = restart;

  window.addEventListener('keydown', e => {
    if (e.code === 'Tab' && ['paused','help','journal','complete'].includes(phase)) {
      const container = { paused: $('pause-dialog'), help: $('help-dialog'), journal: $('journal'), complete: $('complete-dialog') }[phase];
      const focusable = [...container.querySelectorAll('button,a,[tabindex="0"]')];
      const index = focusable.indexOf(document.activeElement);
      if (e.shiftKey && index <= 0) { e.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!e.shiftKey && index === focusable.length - 1) { e.preventDefault(); focusable[0]?.focus(); }
      return;
    }
    if (e.code === 'Escape') {
      if (phase === 'playing') pause(); else if (phase === 'help') closeHelp(); else if (phase === 'journal') closeJournal();
      return;
    }
    if (phase !== 'playing') return;
    if (e.target instanceof Element && e.target.closest('button,a,input,select,textarea,[contenteditable]')) return;
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) { e.preventDefault(); keys.add(e.code); }
    if (!e.repeat && e.code === 'KeyH') hint();
    if (!e.repeat && e.code === 'KeyJ') openJournal();
    if (!e.repeat && (e.code === 'KeyE' || e.code === 'Space')) spot();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { clearMovement(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('mousemove', e => { if (phase === 'playing' && document.pointerLockElement === canvas) look(e.movementX, e.movementY); });
  canvas.addEventListener('pointerdown', e => {
    if (phase !== 'playing') return;
    if (document.pointerLockElement === canvas) { spot(); return; }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, travel: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || phase !== 'playing' || document.pointerLockElement === canvas) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.travel += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    look(dx, dy);
  });
  canvas.addEventListener('pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.travel < 8) { pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); spot(pointer); }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => drag = null);
  function joystickMove(e) {
    const rect = $('joystick').getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy), max = rect.width * .32;
    const factor = distance > max ? max / distance : 1;
    stick.x = dx * factor / max; stick.y = dy * factor / max;
    $('joystick-thumb').style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
  }
  $('joystick').addEventListener('pointerdown', e => { joystickPointer = e.pointerId; $('joystick').setPointerCapture(e.pointerId); joystickMove(e); });
  $('joystick').addEventListener('pointermove', e => { if (e.pointerId === joystickPointer) joystickMove(e); });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) $('joystick').addEventListener(type, () => { joystickPointer = null; stick.x = stick.y = 0; $('joystick-thumb').style.transform = ''; });
  window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause(); $('error-text').textContent = 'The painting lost its graphics connection. Your saved cats are safe. Reload to step back inside.'; $('error').hidden = false; });

  refreshProgress();
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), .05); elapsed += delta;
    if (phase === 'intro' || (phase === 'help' && previousPhase === 'intro')) {
      camera.position.set(reducedMotion ? 0 : Math.sin(elapsed * .045) * .65, 5.6, 25);
      camera.lookAt(0, 6, -15);
    } else if (phase === 'playing') {
      let forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - stick.y;
      let strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x;
      const length = Math.hypot(forward, strafe); if (length > 1) { forward /= length; strafe /= length; }
      const speed = delta * 4.1;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed;
      const next = movePlayer(camera.position, dx, dz, world.colliders);
      const moving = Math.hypot(next.x - camera.position.x, next.z - camera.position.z) > .0001;
      camera.position.x = next.x; camera.position.z = next.z;
      if (moving) walkingTime += delta * 8;
      camera.position.y = 1.7 + (!reducedMotion && moving ? Math.sin(walkingTime) * .035 : 0);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      $('compass-heading').textContent = compassHeading(yaw);
      $('location').textContent = camera.position.x < -16 ? 'Beneath the cypress' : camera.position.z < -21 ? 'The quiet church' : camera.position.x > 15 ? 'A lane less traveled' : camera.position.z < -7 ? 'The sleeping village' : 'The village at night';
      if (elapsed - lastTargetCheck > .09) { scene.updateMatrixWorld(); updateTarget(); lastTargetCheck = elapsed; }
    }
    if (phase === 'playing' && performance.now() >= completionDue) {
      completionDue = Infinity; $('discovery').hidden = true; setPhase('complete');
    }
    world.update(reducedMotion ? 0 : elapsed); friends.update(reducedMotion ? 0 : elapsed);
    renderer.render(scene, camera);
  }
  animate();
  $('loading').style.opacity = '0'; setTimeout(() => $('loading').hidden = true, 500);

  // Available only to the local development browser tests; excluded from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
    window.__game = {
      get state() { return { phase, found: foundCats().map(cat => cat.id), position: camera.position.toArray(), yaw, pitch, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
      get cats() { return world.catSpots; },
      get colliders() { return world.colliders; },
      teleport(x,y,z) { camera.position.set(x,y,z); },
      aimAt(x,y,z) { camera.lookAt(x,y,z); yaw = camera.rotation.y; pitch = camera.rotation.x; },
      pick() { scene.updateMatrixWorld(); return pick()?.id ?? null; },
      project(x,y,z) { const v = new THREE.Vector3(x,y,z).project(camera); return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2}; }
    };
  }
}
try { init(); } catch (error) {
  console.error(error); $('loading').hidden = true; $('error').hidden = false;
}
