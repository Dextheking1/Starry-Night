import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All cats face their local +Z axis, with their paws resting on local Y = 0.
// The painted coats are generated locally, so finding cats never needs a network.
export function createCats(scene, spots) {
  const cats = [];
  const selectable = [];
  const sphere = new THREE.SphereGeometry(1, 14, 10);
  const eyeSphere = new THREE.SphereGeometry(1, 12, 8);
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: '#ffda78', emissive: '#b97a19', emissiveIntensity: 0.65,
    roughness: 0.65,
  });
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: '#122031', roughness: 1 });
  const roseMaterial = new THREE.MeshStandardMaterial({ color: '#dca39c', roughness: 1 });
  const whiskerMaterial = new THREE.LineBasicMaterial({ color: '#f2dfbb', transparent: true, opacity: 0.8 });
  const creamMaterial = new THREE.MeshStandardMaterial({ color: '#e6d7b2', roughness: 1 });
  const haloGeometry = new THREE.TorusGeometry(0.27, 0.012, 6, 32);
  const temp = new THREE.Object3D();
  let lastTime = 0;

  function transformed(geometry, position, scale, rotation = [0, 0, 0]) {
    temp.position.fromArray(position);
    temp.scale.fromArray(scale);
    temp.rotation.set(...rotation);
    temp.updateMatrix();
    return geometry.clone().applyMatrix4(temp.matrix);
  }

  function merged(parts) {
    const result = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return result;
  }

  function earGeometry() {
    const g = new THREE.BufferGeometry();
    // A slightly rounded-looking triangular wedge; the front is +Z.
    const a = [-0.102, 0, 0.045], b = [0.102, 0, 0.045];
    const c = [0, 0.25, -0.015], d = [0, 0.015, -0.12];
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      ...a, ...b, ...c, ...a, ...c, ...d,
      ...b, ...d, ...c, ...a, ...d, ...b,
    ], 3));
    g.computeVertexNormals();
    // Match the UV-bearing sphere geometries for merging.
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(24).fill(0), 2));
    return g;
  }

  const ear = earGeometry();
  const bodyGeometry = merged([
    transformed(sphere, [0, 0.37, -0.015], [0.265, 0.365, 0.255]),
    transformed(sphere, [0, 0.75, 0.05], [0.285, 0.23, 0.23]),
    transformed(sphere, [-0.147, 0.075, 0.165], [0.115, 0.075, 0.17]),
    transformed(sphere, [0.147, 0.075, 0.165], [0.115, 0.075, 0.17]),
    transformed(ear, [-0.167, 0.89, 0.025], [1, 1, 1], [0, 0, 0.18]),
    transformed(ear, [0.167, 0.89, 0.025], [1, 1, 1], [0, 0, -0.18]),
  ].map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry));
  // The small pale bib, cheeks and toes give the silhouette a hand-painted finish.
  const faceGeometry = merged([
    transformed(sphere, [0, 0.385, 0.202], [0.14, 0.21, 0.045]),
    transformed(sphere, [-0.058, 0.682, 0.25], [0.075, 0.054, 0.041]),
    transformed(sphere, [0.058, 0.682, 0.25], [0.075, 0.054, 0.041]),
    transformed(sphere, [-0.147, 0.07, 0.275], [0.09, 0.052, 0.05]),
    transformed(sphere, [0.147, 0.07, 0.275], [0.09, 0.052, 0.05]),
  ]);
  const eyeGeometry = merged([
    transformed(eyeSphere, [-0.11, 0.778, 0.247], [0.064, 0.061, 0.022]),
    transformed(eyeSphere, [0.11, 0.778, 0.247], [0.064, 0.061, 0.022]),
  ]);
  const pupilGeometry = merged([
    transformed(eyeSphere, [-0.107, 0.781, 0.266], [0.013, 0.047, 0.008]),
    transformed(eyeSphere, [0.107, 0.781, 0.266], [0.013, 0.047, 0.008]),
  ]);
  const noseGeometry = merged([
    transformed(new THREE.ConeGeometry(1, 1, 3), [0, 0.71, 0.29], [0.027, 0.026, 0.018], [0, 0, Math.PI]),
    transformed(sphere, [-0.165, 0.958, 0.074], [0.052, 0.078, 0.011], [0, 0, 0.18]),
    transformed(sphere, [0.165, 0.958, 0.074], [0.052, 0.078, 0.011], [0, 0, -0.18]),
  ].map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry));
  const whiskerPoints = [];
  for (const side of [-1, 1]) {
    for (let line = -1; line <= 1; line++) {
      whiskerPoints.push(side * 0.09, 0.685 + line * 0.018, 0.282);
      whiskerPoints.push(side * 0.35, 0.685 + line * 0.062, 0.255);
    }
  }
  const whiskerGeometry = new THREE.BufferGeometry();
  whiskerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(whiskerPoints, 3));
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 0.055, -0.12),
    new THREE.Vector3(0.32, 0.29, -0.14), new THREE.Vector3(0.31, 0.54, -0.1),
    new THREE.Vector3(0.19, 0.61, -0.05),
  ]);
  const tailGeometry = new THREE.TubeGeometry(tailCurve, 16, 0.05, 7, false);

  function paintedCoat(color, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const base = new THREE.Color(color ?? '#bca481');
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(0, 0, 128, 128);
    let randomSeed = seed * 1697 + 41;
    const random = () => {
      randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) | 0;
      return (randomSeed >>> 0) / 4294967296;
    };
    for (let n = 0; n < 650; n++) {
      const light = random() > 0.45;
      ctx.strokeStyle = light ? 'rgba(255,226,173,0.13)' : 'rgba(8,24,49,0.16)';
      ctx.lineWidth = 0.8 + random() * 2;
      const x = random() * 128, y = random() * 128;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 5 - 2, y + 3 + random() * 8); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
  }

  spots.forEach((spot, index) => {
    const group = new THREE.Group();
    group.name = `cat-${spot.id}`;
    group.position.fromArray(spot.position);
    group.rotation.y = spot.rotation ?? 0;
    group.userData.catId = spot.id;
    const animated = new THREE.Group();
    group.add(animated);
    const coat = paintedCoat(spot.color, index + 1);
    function add(geometry, material, parent = animated, clickable = true) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (clickable) { mesh.userData.catId = spot.id; selectable.push(mesh); }
      parent.add(mesh);
      return mesh;
    }
    add(bodyGeometry, coat);
    add(faceGeometry, creamMaterial);
    add(eyeGeometry, goldMaterial);
    add(pupilGeometry, pupilMaterial);
    add(noseGeometry, roseMaterial);
    animated.add(new THREE.LineSegments(whiskerGeometry, whiskerMaterial));
    const tail = add(tailGeometry, coat);
    tail.position.set(0.17, 0.19, -0.17);

    // Three small forehead strokes read as tabby markings without busy textures.
    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spot.color ?? '#bca481').multiplyScalar(0.48), roughness: 1,
    });
    const stripeGeometry = merged([-1, 0, 1].map((j) =>
      transformed(sphere, [j * 0.065, 0.9 - Math.abs(j) * 0.014, 0.207], [0.013, 0.055, 0.009], [0, 0, -j * 0.2])
    ));
    add(stripeGeometry, stripeMaterial);
    const halo = add(haloGeometry, goldMaterial, group, false);
    halo.position.y = 1.36;
    halo.rotation.x = Math.PI / 2;
    halo.visible = false;
    halo.castShadow = false;
    scene.add(group);
    cats.push({ ...spot, group, found: false, animated, tail, halo, phase: index * 1.973, bounceAt: -99 });
  });

  return {
    cats,
    selectable,
    update(time) {
      lastTime = time;
      for (const cat of cats) {
        const breath = Math.sin(time * 1.7 + cat.phase);
        cat.animated.scale.set(1, 1 + breath * 0.014, 1);
        cat.tail.rotation.y = Math.sin(time * 1.35 + cat.phase) * 0.16;
        const elapsed = time - cat.bounceAt;
        cat.animated.position.y = elapsed >= 0 && elapsed < 0.7 ? Math.sin(elapsed / 0.7 * Math.PI) * 0.2 : 0;
        if (cat.found) {
          cat.halo.position.y = 1.36 + Math.sin(time * 2 + cat.phase) * 0.035;
          cat.halo.rotation.z = time * 0.25;
        }
      }
    },
    find(id) {
      const cat = cats.find((candidate) => candidate.id === id);
      if (!cat || cat.found) return false;
      cat.found = true;
      cat.halo.visible = true;
      cat.bounceAt = lastTime;
      return cat;
    },
    reset(foundIds = []) {
      const found = new Set(foundIds);
      for (const cat of cats) {
        cat.found = found.has(cat.id);
        cat.halo.visible = cat.found;
        cat.bounceAt = -99;
        cat.animated.position.y = 0;
      }
    },
  };
}
