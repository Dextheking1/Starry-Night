import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WORLD_BOUNDS = { minX: -31, maxX: 31, minZ: -42, maxZ: 28 };

// Every mark in the village is generated locally: a small, walkable painted world.
function random(seed = 751) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
const rand = random();
function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function paintTexture(base, colors, roof = false) {
  const t = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      c.globalAlpha = .13 + rand() * .3;
      c.strokeStyle = colors[Math.floor(rand() * colors.length)];
      c.lineWidth = 1 + rand() * 3;
      const x = rand() * w, y = rand() * h;
      c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + (roof ? 2 : 9 + rand() * 14), y + (roof ? 11 + rand() * 15 : rand() * 5 - 2)); c.stroke();
    }
    if (roof) {
      c.globalAlpha = .5; c.strokeStyle = '#14243b'; c.lineWidth = 2;
      for (let y = 0; y <= h; y += 32) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
        for (let x = (y % 64 === 0 ? 0 : 16); x < w; x += 32) {
          c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 32); c.stroke();
        }
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function createSky() {
  const r = random(120);
  const texture = canvasTexture(3072, 1536, (c, w, h) => {
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#07153d'); bg.addColorStop(.25, '#122f68');
    bg.addColorStop(.46, '#244b79'); bg.addColorStop(.58, '#597c90'); bg.addColorStop(1, '#0e2644');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    // Long, broken marks flow across the blue underpainting.
    const blue = ['#5988af', '#507cb0', '#1b3b80', '#284b95', '#7ca3bb', '#0b2862'];
    for (let i = 0; i < 12500; i++) {
      const x = r() * w, y = r() * h * .59;
      const wave = Math.sin(x / 210 + y / 105) * 12 + Math.cos(x / 390 - y / 71) * 9;
      c.strokeStyle = blue[Math.floor(r() * blue.length)];
      c.globalAlpha = .17 + r() * .42; c.lineWidth = 1 + r() * 3.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y + wave * .4, x + 16 + r() * 23, y + wave); c.stroke();
    }
    // The central current curls back on itself, like ribbons of thick oil paint.
    function swirl(cx, cy, radius, direction, sx = 1) {
      const colors = ['#aec4bc', '#7faeb8', '#90b8bd', '#618fae', '#416d9e', '#365c9c', '#d3c994'];
      for (let ring = 0; ring < 67; ring++) {
        c.strokeStyle = colors[ring % colors.length]; c.globalAlpha = .25 + r() * .35;
        c.lineWidth = 1.4 + r() * 4.5;
        c.beginPath();
        for (let j = 0; j <= 210; j++) {
          const t = j / 210 * Math.PI * 3.3;
          const radiusAt = radius * (1 - j / 240) + (ring - 33) * 1.5;
          const x = cx + Math.cos(t * direction) * radiusAt * sx;
          const y = cy + Math.sin(t * direction) * radiusAt * .63;
          if (!j) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
    }
    swirl(w * .735, h * .375, 161, 1, 1.5);
    swirl(w * .62, h * .405, 119, -1, 1.45);
    swirl(w * .25, h * .29, 164, 1, 1.3);
    for (let j = 0; j < 44; j++) {
      c.strokeStyle = ['#799fb4', '#bed0bc', '#4473a1', '#7a9fb0'][j % 4];
      c.globalAlpha = .18; c.lineWidth = 2 + r() * 3;
      c.beginPath(); c.moveTo(w * .41, h * .445 + j * .8);
      c.bezierCurveTo(w * .57, h * .28 + j, w * .68, h * .49 - j, w * .8, h * .38 + j * .4); c.stroke();
    }
    function star(x, y, size) {
      const halo = c.createRadialGradient(x, y, 1, x, y, size * 2.1);
      halo.addColorStop(0, '#fff5bc'); halo.addColorStop(.22, '#efcf70');
      halo.addColorStop(.5, '#d2bd6880'); halo.addColorStop(1, '#d2bd6800');
      c.globalAlpha = 1; c.fillStyle = halo;
      c.beginPath(); c.arc(x, y, size * 2.1, 0, Math.PI * 2); c.fill();
      for (let j = 0; j < 95; j++) {
        const a = r() * Math.PI * 2, rr = size * (.35 + r() * 1.35);
        c.globalAlpha = .3 + r() * .45;
        c.strokeStyle = ['#f8e4a1', '#d8b658', '#ead284', '#b9b980'][j % 4]; c.lineWidth = 1 + r() * 3;
        c.beginPath(); c.ellipse(x, y, rr, rr * .84, 0, a, a + .08 + r() * .45); c.stroke();
      }
      c.globalAlpha = .95; c.fillStyle = '#f9e9b1';
      c.beginPath(); c.arc(x, y, size * .22, 0, Math.PI * 2); c.fill();
    }
    [[.58,.31,24],[.65,.3,21],[.8,.31,24],[.72,.26,18],[.88,.4,19],[.66,.455,17],[.79,.445,18],[.91,.3,25],[.49,.36,19],[.38,.31,23],[.2,.32,21],[.1,.4,19],[.32,.43,15],[.03,.33,21]].forEach(([x,y,s])=>star(x*w,y*h,s));
    // A large crescent on the eastern edge of the painting.
    const mx = w * .835, my = h * .365, mr = 44;
    const halo = c.createRadialGradient(mx,my,15,mx,my,mr*2.7);
    halo.addColorStop(0,'#f0d780b3'); halo.addColorStop(.5,'#c4bd6144'); halo.addColorStop(1,'#d2bd6800');
    c.globalAlpha=1; c.fillStyle=halo; c.beginPath();c.arc(mx,my,mr*2.7,0,Math.PI*2);c.fill();
    for(let i=0;i<45;i++){
      c.lineWidth=2+r()*3;c.strokeStyle=['#c6c487','#9eaa7d','#e1ce7f'][i%3];c.globalAlpha=.25;
      c.beginPath();c.ellipse(mx,my,mr+12+r()*55,mr+12+r()*49,0,r()*6,Math.PI*2);c.stroke();
    }
    c.globalAlpha=1;c.fillStyle='#f4d77c';c.beginPath();c.arc(mx,my,mr,0,Math.PI*2);c.fill();
    c.fillStyle='#274c7c';c.beginPath();c.arc(mx-24,my-17,mr*.88,0,Math.PI*2);c.fill();
    c.globalAlpha=.3;c.strokeStyle='#fff0ac';c.lineWidth=4;
    c.beginPath();c.arc(mx,my,mr-6,-.6,1.9);c.stroke();
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 24), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  sky.renderOrder = -10;
  sky.rotation.y = -.12;
  return sky;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color('#183c6a');
  scene.fog = new THREE.FogExp2('#294b67', .008);
  scene.add(createSky());
  scene.add(new THREE.HemisphereLight('#a4c6f6', '#485555', 1.55));
  const moon = new THREE.DirectionalLight('#aec8ff', 1.7);
  moon.position.set(-25, 45, 15); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -42; moon.shadow.camera.right = 42;
  moon.shadow.camera.top = 42; moon.shadow.camera.bottom = -42; moon.shadow.normalBias = .06;
  scene.add(moon);
  const warm = new THREE.DirectionalLight('#e5c18a', .4); warm.position.set(15, 10, 25); scene.add(warm);

  const root = new THREE.Group();
  const colliders = [];
  const palette = {
    cream: new THREE.MeshStandardMaterial({ map: paintTexture('#c0b798', ['#dfcfab','#8b947e','#e5cf92']), roughness: 1 }),
    blue: new THREE.MeshStandardMaterial({ map: paintTexture('#466e91', ['#6591a9','#2e507c','#87a1b2']), roughness: 1 }),
    sage: new THREE.MeshStandardMaterial({ map: paintTexture('#748879', ['#a1ac90','#526e6e','#b8b99a']), roughness: 1 }),
    ochre: new THREE.MeshStandardMaterial({ map: paintTexture('#af9163', ['#d4b078','#837951','#dcc28c']), roughness: 1 }),
    roof: new THREE.MeshStandardMaterial({ map: paintTexture('#315779', ['#467e96','#203d64','#668891'], true), roughness: 1 }),
    roofWarm: new THREE.MeshStandardMaterial({ map: paintTexture('#6c6358', ['#9a805e','#525c66','#b49a6c'], true), roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#172f46', roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ map: paintTexture('#45524b',['#6e7260','#263e45','#a18e64']), roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ map: paintTexture('#788c8b',['#a7afa0','#526b78','#c1bda1']), roughness: 1 }),
    window: new THREE.MeshBasicMaterial({ color: '#f6ca72', toneMapped: false }),
    windowDim: new THREE.MeshBasicMaterial({ color: '#bca25d', toneMapped: false }),
    terracotta: new THREE.MeshStandardMaterial({ color: '#ad7657', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#34594b', roughness: 1 }),
    cypress: new THREE.MeshStandardMaterial({ map: paintTexture('#153a43',['#315956','#527267','#0f2938']), roughness: 1 }),
    flower: new THREE.MeshStandardMaterial({ color: '#e9bc58', roughness: 1 }),
  };
  function add(geometry, material, x=0,y=0,z=0, rotation=0) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x,y,z);mesh.rotation.y=rotation;root.add(mesh);return mesh;
  }
  const box = (w,h,d,mat,x,y,z,rot=0) => add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,rot);
  function block(x,z,w,d,pad=.1){ colliders.push({minX:x-w/2-pad,maxX:x+w/2+pad,minZ:z-d/2-pad,maxZ:z+d/2+pad}); }
  function roofGeometry(w,h,d) {
    const x=w/2,z=d/2;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([
      -x,0,z, 0,h,z, -x,0,-z, 0,h,z, 0,h,-z, -x,0,-z,
      0,h,z, x,0,z, x,0,-z, 0,h,z, x,0,-z, 0,h,-z,
    ],3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,0,1],2));
    g.computeVertexNormals(); return g;
  }
  function gable(w,h,material,x,y,z,rot=0) {
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();
    add(new THREE.ShapeGeometry(shape),material,x,y,z,rot);
  }
  function windowAt(x,y,z,w=.75,h=1,rotation=0,lit=true) {
    const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=rotation;root.add(group);
    function part(w,h,d,m,px,py,pz){const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(px,py,pz);group.add(a);}
    part(w+.16,h+.18,.12,palette.dark,0,0,0);
    part(w,h,.13,lit?palette.window:palette.windowDim,0,0,.025);
    part(.055,h,.15,palette.wood,0,0,.05);part(w,.055,.15,palette.wood,0,0,.05);
    part(w+.3,.09,.24,palette.stone,0,-h/2-.08,.05);
  }
  function house(x,z,w,d,h,mat,roofMat=palette.roof) {
    box(w,h,d,mat,x,h/2,z);block(x,z,w,d);
    const rh=w*.38;
    add(roofGeometry(w+.65,rh,d+.65),roofMat,x,h-.03,z);
    gable(w,rh,mat,x,h,z+d/2+.005);gable(w,rh,mat,x,h,z-d/2-.005,Math.PI);
    const front=z+d/2+.08;
    box(.9,1.95,.15,palette.wood,x,1,front);box(.95,.09,.45,palette.stone,x,.07,front+.12);
    box(.055,.055,.05,palette.window,x+.27,.95,front+.1);
    windowAt(x-w*.28,1.95,front,.78,.95,0,rand()>.2);
    windowAt(x+w*.28,1.95,front,.78,.95,0,rand()>.2);
    if(h>4.2){windowAt(x-w*.25,3.8,front,.65,.85);windowAt(x+w*.25,3.8,front,.65,.85,0,false);}
    if(w>4.8) windowAt(x,h+.55,front,.5,.6,0,false);
    windowAt(x+w/2+.08,2,z,.65,.9,Math.PI/2,rand()>.3);
    box(.65,1.7,.65,palette.stone,x+w*.27,h+rh*.58,z-d*.2);
    box(.83,.16,.83,palette.dark,x+w*.27,h+rh*.58+.83,z-d*.2);
  }
  // Blue and ochre facades make the lane feel like a small, inhabited village.
  house(-10,10,6,5,4.6,palette.sage);
  house(10,10,5.5,5,3.9,palette.ochre,palette.roofWarm);
  house(-11,.4,7,6,5,palette.cream);
  house(10,-1,6,5.5,4.7,palette.blue);
  house(-12,-10,6,6,4.4,palette.ochre,palette.roofWarm);
  house(11,-11,5.8,5.6,5.1,palette.cream);
  house(-13,-21,6,5.5,4.6,palette.blue);
  house(14,-21,6,6,4.3,palette.sage);
  house(-22,-12,5.3,5,3.8,palette.sage);
  house(23,-7,5,5,4,palette.blue);
  house(-22,-26,6,6,4.9,palette.ochre);
  house(23,-30,5,6,4.8,palette.ochre);
  house(-12,-34,6,5,4.2,palette.sage);
  house(11,-35,5.5,5,5,palette.blue);

  // The church anchors the town, with an exaggerated, ink-blue needle spire.
  box(6.3,6.5,10,palette.cream,-1,3.25,-30);block(-1,-30,6.3,10);
  add(roofGeometry(7,3,10.5),palette.roof,-1,6.5,-30);
  gable(6.3,3,palette.cream,-1,6.5,-24.98);
  box(2.6,10,3.2,palette.stone,-1,5,-25.9);block(-1,-25.9,2.6,3.2);
  add(new THREE.ConeGeometry(2.3,7.6,4),palette.dark,-1,13.7,-25.9,Math.PI/4);
  box(.09,1.1,.09,palette.ochre,-1,18,-25.9);box(.55,.07,.07,palette.ochre,-1,18.15,-25.9);
  windowAt(-1,8.1,-24.22,.8,1.6);
  box(1.4,2.7,.15,palette.dark,-1,1.4,-24.2);
  windowAt(-3.25,3.5,-24.92,.72,1.6);windowAt(1.25,3.5,-24.92,.72,1.6);
  for(let j=0;j<3;j++)box(3.5+j*.35,.18,1+j*.35,palette.stone,-1,.1+j*.12,-24.1+j*.15);

  const groundMat=new THREE.MeshStandardMaterial({map:paintTexture('#344b51',['#58716a','#273e4b','#7e8766']),roughness:1});
  groundMat.map.repeat.set(70,70);
  const ground=add(new THREE.PlaneGeometry(350,350),groundMat,0,-.045,0);ground.rotation.x=-Math.PI/2;
  const pathMap=canvasTexture(512,512,(c,w,h)=>{
    c.fillStyle='#4c6573';c.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=40){for(let x=-30;x<w;x+=68){
      const xx=x+(y%80===0?0:34),yy=y+2;
      c.fillStyle=['#8296a0','#8f9c9d','#667e8e','#a0a99d','#6b8594'][Math.floor(rand()*5)];
      c.beginPath();c.roundRect(xx+3,yy+2,60+rand()*4,32+rand()*3,6);c.fill();
      c.globalAlpha=.18;c.strokeStyle='#d4caa4';c.lineWidth=2;c.beginPath();c.moveTo(xx+10,yy+8);c.lineTo(xx+52,yy+7);c.stroke();c.globalAlpha=1;
    }}
  });pathMap.wrapS=pathMap.wrapT=THREE.RepeatWrapping;pathMap.repeat.set(2,17);
  const pathMat=new THREE.MeshStandardMaterial({map:pathMap,roughness:1});
  const path=add(new THREE.PlaneGeometry(8.5,70),pathMat,0,-.015,-7);path.rotation.x=-Math.PI/2;
  for(const x of [-4.5,4.5])box(.24,.13,70,palette.stone,x,.02,-7);
  // Cross lanes run between the little houses.
  const crossMap=pathMap.clone();crossMap.repeat.set(8,1);crossMap.needsUpdate=true;
  const crossMat=new THREE.MeshStandardMaterial({map:crossMap,roughness:1});
  for(const z of [5,-6,-17]){const lane=add(new THREE.PlaneGeometry(48,3),crossMat,0,-.012,z);lane.rotation.x=-Math.PI/2;}

  // Rolling brush-marked hills beyond the roofline.
  const hillMat=new THREE.MeshStandardMaterial({map:paintTexture('#426b78',['#6a9290','#2d506b','#7d9b8d']),roughness:1});
  const farHillMat=new THREE.MeshStandardMaterial({map:paintTexture('#385e7a',['#4e7d94','#284b74','#6997a7']),roughness:1});
  for(let i=0;i<15;i++){
    const m=add(new THREE.SphereGeometry(1,14,8),i%2?hillMat:farHillMat,(i-7)*16,1,-68-rand()*22);
    m.scale.set(15+rand()*15,7+rand()*10,17+rand()*13);
  }
  for(let i=0;i<9;i++){
    const side=i<5?-1:1,m=add(new THREE.SphereGeometry(1,12,7),hillMat,side*(55+rand()*20),0,-50+i*12);
    m.scale.set(20,7+rand()*5,20);
  }

  function cypress(x,z,height,width=2.2){
    box(.5,height*.7,.5,palette.wood,x,height*.3,z);
    for(let i=0;i<7;i++){
      const y=height*(.18+i*.095),w=width*(1-i*.095);
      const m=add(new THREE.SphereGeometry(1,7,9),palette.cypress,x+Math.sin(i*2)*width*.17,y,z+Math.cos(i)*.3);
      m.scale.set(w,height*.24,w*.75);m.rotation.z=Math.sin(i*3)*.07;
    }
    add(new THREE.ConeGeometry(width*.45,height*.33,7),palette.cypress,x+.15,height*.94,z);
    block(x,z,width*1.2,width*1.1);
  }
  cypress(-21,0,23,2.7);cypress(-23,-1,18,1.7);
  cypress(23,17,11,1.5);cypress(-25,18,10,1.4);
  cypress(25,-40,12,1.8);cypress(-27,-38,13,1.6);
  cypress(6,-40,10,1.4);

  const glowTexture=canvasTexture(64,64,(c)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffe2aacc');g.addColorStop(.25,'#ffc96a55');g.addColorStop(1,'#ffc96a00');c.fillStyle=g;c.fillRect(0,0,64,64);});
  const lampGlows=[];
  function lamp(x,z){
    add(new THREE.CylinderGeometry(.065,.1,3.7,6),palette.dark,x,1.85,z);
    box(.55,.12,.55,palette.dark,x,3.48,z);box(.34,.58,.34,palette.window,x,3.77,z);
    for(const a of [-1,1])for(const b of [-1,1])box(.045,.64,.045,palette.dark,x+a*.18,3.77,z+b*.18);
    add(new THREE.ConeGeometry(.45,.3,4),palette.dark,x,4.18,z,Math.PI/4);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:'#ffdda1',transparent:true,depthWrite:false,opacity:.65}));
    sprite.position.set(x,3.8,z);sprite.scale.set(2.8,2.8,1);scene.add(sprite);lampGlows.push(sprite);
    const light=new THREE.PointLight('#ffbc60',8,9,2);light.position.set(x,3.2,z);scene.add(light);
    block(x,z,.25,.25);
  }
  lamp(-5.1,12);lamp(5.1,3.6);lamp(-5.1,-7);lamp(5.1,-19);lamp(-5.3,-24);
  function planter(x,z,s=1){
    add(new THREE.CylinderGeometry(.45*s,.3*s,.6*s,8),palette.terracotta,x,.3*s,z);
    for(let i=0;i<5;i++){
      const a=i*2.4,xx=x+Math.cos(a)*.25*s,zz=z+Math.sin(a)*.25*s;
      add(new THREE.CylinderGeometry(.025,.03,.65*s,4),palette.leaf,xx,.8*s,zz);
      add(new THREE.IcosahedronGeometry(.16*s,0),palette.flower,xx,1.12*s,zz);
      const leaf=add(new THREE.SphereGeometry(.12*s,4,4),palette.leaf,xx+.08,.8*s,zz);leaf.scale.y=.4;
    }
  }
  planter(-6.9,3.8);planter(6.7,2.3);planter(-7.8,12.9);planter(7.8,13);planter(-15.6,-5.8);planter(7.5,-7.8);
  // A bench, a dry-stone wall and a little well reward looking down side lanes.
  box(3,.16,.8,palette.wood,-6.3,.65,-17.5);box(3,.66,.12,palette.wood,-6.3,1.12,-17.84);
  for(const x of [-7.4,-5.2])box(.12,.6,.65,palette.dark,x,.3,-17.5);
  block(-6.3,-17.5,3,.8);
  box(3.4,1,.5,palette.stone,8,.5,-13);
  block(8,-13,3.4,.5);
  add(new THREE.CylinderGeometry(1.15,1.25,1.05,10,1,true),palette.stone,-2.5,.52,-11.4);
  add(new THREE.CylinderGeometry(.95,.95,.06,16),palette.dark,-2.5,.2,-11.4);
  for(const x of [-3.6,-1.4])box(.15,2.3,.15,palette.wood,x,1.5,-11.4);
  add(roofGeometry(3,1,2),palette.roofWarm,-2.5,2.65,-11.4);block(-2.5,-11.4,2.5,2.5);
  // Low garden fences retain the uncluttered, walkable lanes.
  for(const [x,z,w] of [[-10,6.1,6],[-12,-5.7,5],[12,-16.7,4]]){
    for(let j=0;j<w;j+=.55)box(.12,.82,.1,palette.wood,x-w/2+j,.41,z);
    box(w,.1,.1,palette.wood,x,.6,z);block(x,z,w,.15);
  }
  // Small painted grass strokes, warm poppies and slate stones along the road.
  const grassColors=['#81936e','#526f63','#9fa276','#395e5a'];
  const grassMats=grassColors.map(color=>new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
  for(let i=0;i<480;i++){
    const x=(rand()>.5?1:-1)*(4.8+rand()*25),z=rand()*67-40;
    if(colliders.some(a=>x>a.minX-.3&&x<a.maxX+.3&&z>a.minZ-.3&&z<a.maxZ+.3))continue;
    const h=.15+rand()*.35;
    const blade=add(new THREE.PlaneGeometry(.05+rand()*.08,h),grassMats[i%4],x,h/2,z,rand()*Math.PI);
    blade.rotation.z=(rand()-.5)*.5;
    if(i%12===0)add(new THREE.IcosahedronGeometry(.06,0),palette.flower,x,h,z);
  }

  // Bake static forms into material batches, keeping the painted town inexpensive.
  root.updateMatrixWorld(true);
  const buckets=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const g=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone());
    g.applyMatrix4(mesh.matrixWorld);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    const list=buckets.get(mesh.material)||[];list.push(g);buckets.set(mesh.material,list);
  });
  for(const [material,list] of buckets){
    const geometry=mergeGeometries(list,false);
    if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=material!==groundMat&&material!==pathMat&&material!==crossMat;mesh.receiveShadow=true;
    mesh.name='painted-village';scene.add(mesh);list.forEach(g=>g.dispose());
  }
  root.traverse(obj=>{if(obj.isMesh)obj.geometry.dispose();});

  const catSpots=[
    {id:'cobalt',name:'Cobalt',hint:'A blue house, a golden window. Look along the right side of the lane.',story:'A little dreamer with a coat the color of the evening.',color:'#91a7bb',position:[6.25,0,1.3],rotation:-.8},
    {id:'marigold',name:'Marigold',hint:'The first lantern keeps a small orange friend warm.',story:'She has collected every last bit of sunshine.',color:'#d6a15f',position:[-5.8,0,11.4],rotation:.6},
    {id:'cypress',name:'Cypress',hint:'Follow the tallest, darkest tree. Someone is hiding at its feet.',story:'The quiet guardian of the great cypress tree.',color:'#313b4a',position:[-18.4,0,2.2],rotation:1.1},
    {id:'indigo',name:'Indigo',hint:'A low stone wall on the right is the perfect place for a nap.',story:'Every wall in the village is a perfectly good bed.',color:'#8d8ca3',position:[8,1.02,-13],rotation:-1.3},
    {id:'poppy',name:'Poppy',hint:'Find the flowers beside the left-hand lane, beyond the tall tree.',story:'She considers herself the village gardener.',color:'#eee0ba',position:[-15.5,0,-4.7],rotation:.3},
    {id:'juniper',name:'Juniper',hint:'The church bells have a very small admirer. Look near the steps.',story:'He knows the sound of every bell in Saint-Rémy.',color:'#9a8b74',position:[2.65,0,-23.1],rotation:-.7},
    {id:'cosmo',name:'Cosmo',hint:'Explore the lane to the far right, behind the cream-colored house.',story:'A wandering soul who always finds his way home.',color:'#d6d3cc',position:[18.2,0,-16.8],rotation:-1.4},
    {id:'vincent',name:'Vincent',hint:'An empty bench on the left? Take a closer look.',story:'A painter at heart, watching the world turn blue.',color:'#b9794e',position:[-6.3,.75,-17.35],rotation:1.2},
  ];
  return {colliders,catSpots,spawn:[0,1.7,21],lookAt:[0,3,-12],update(time){
    lampGlows.forEach((glow,i)=>{glow.material.opacity=.57+Math.sin(time*1.4+i*2)*.045;});
  }};
}
