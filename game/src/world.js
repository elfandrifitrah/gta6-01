// Jakarta, fictionalized: a 5 by 5 grid of districts around a monument
// square, with a glass skyscraper corridor, a grand roundabout, a Kota Tua
// old town, kampung alleys, mosques, an elevated toll road, a flyover, an
// MRT rail line, busway lanes, warung stalls, billboards and street signs.
// Everything is procedural geometry and canvas textures drawn in code; no
// real logos, no real landmark copies. Buildings, trees, lamps and props are
// instanced, so the whole city draws in a handful of calls. The module also
// owns collision: every solid thing registers an axis-aligned box.
import * as THREE from 'three';
import { BLOCK, BLOCKS, COLORS, CORRIDOR_X, EXTENT, HALF, PITCH, ROAD, ROAD_CENTRES, ROUNDABOUT } from './config.js';
import { makeRng } from './random.js';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function textTexture(width, height, draw) {
  const tex = canvasTexture(width, height, draw);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function buildingTextures(rng) {
  const lit = [];
  const diffuse = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2efe8';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const isLit = rng.chance(0.3);
        lit.push(isLit);
        ctx.fillStyle = isLit ? '#ffd489' : '#2a3542';
        ctx.fillRect(4 + col * 21, 6 + row * 25, 14, 15);
      }
    }
  });
  const emissive = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    let i = 0;
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        if (lit[i]) {
          ctx.fillStyle = '#ffb85c';
          ctx.fillRect(4 + col * 21, 6 + row * 25, 14, 15);
        }
        i += 1;
      }
    }
  });
  return { diffuse, emissive };
}

function glassTexture(rng) {
  const lit = [];
  const diffuse = canvasTexture(128, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#7fa8cc');
    grad.addColorStop(0.5, '#5a7fa8');
    grad.addColorStop(1, '#4a6a94');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const isLit = rng.chance(0.22);
        lit.push(isLit);
        ctx.fillStyle = isLit ? '#ffe0a0' : 'rgba(20,34,52,0.55)';
        ctx.fillRect(4 + col * 21, 6 + row * 21, 15, 13);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(20, 0, 26, h);
  });
  const emissive = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    let i = 0;
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        if (lit[i]) {
          ctx.fillStyle = '#ffcf7a';
          ctx.fillRect(4 + col * 21, 6 + row * 21, 15, 13);
        }
        i += 1;
      }
    }
  });
  return { diffuse, emissive };
}

function asphaltTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a3d43';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i += 1) {
      const shade = 48 + Math.random() * 30;
      ctx.fillStyle = `rgb(${shade},${shade},${shade + 4})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#d8c25a';
    ctx.fillRect(w / 2 - 3, 8, 2, 44);
    ctx.fillRect(w / 2 + 1, 8, 2, 44);
    ctx.fillRect(w / 2 - 3, 72, 2, 44);
    ctx.fillRect(w / 2 + 1, 72, 2, 44);
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(4, 0, 2, h);
    ctx.fillRect(w - 6, 0, 2, h);
  });
}

function buswayTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7a4038';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i += 1) {
      const shade = 110 + Math.random() * 30;
      ctx.fillStyle = `rgb(${shade},${shade * 0.6},${shade * 0.55})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#f0e8d8';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('BUSWAY', 0, 9);
    ctx.restore();
    ctx.fillStyle = '#f0e8d8';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
  });
}

function paverTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#b5afa2';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a29d90';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
}

function waterTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i += 1) {
      const y = i * 13 + 6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.2 + i) * 2);
      ctx.stroke();
    }
  });
  tex.repeat.set(8, 4);
  return tex;
}

function batikTexture(base, line) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    for (let row = -1; row < 5; row += 1) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const y = row * 32 + Math.sin((x + row * 20) * 0.09) * 9 + 16;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = line;
    for (let i = 0; i < 24; i += 1) {
      ctx.beginPath();
      ctx.arc((i * 53) % w, (i * 37) % h, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function palmFrondTexture() {
  const tex = textTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#3e7a34';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const cx = w / 2;
    const cy = h - 6;
    for (let i = 0; i < 9; i += 1) {
      const angle = -Math.PI / 2 + (i - 4) * 0.32;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const tipX = cx + Math.cos(angle) * 62;
      const tipY = cy + Math.sin(angle) * 62;
      ctx.quadraticCurveTo(cx + Math.cos(angle) * 34, cy + Math.sin(angle) * 34 - 14, tipX, tipY + 16);
      ctx.stroke();
    }
  });
  return tex;
}

function flagTexture() {
  return textTexture(64, 40, (ctx, w, h) => {
    ctx.fillStyle = '#e11e2b';
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#f5f5f0';
    ctx.fillRect(0, h / 2, w, h / 2);
  });
}

function signTexture(text, sub) {
  return textTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#1d6b3a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, sub ? 30 : 41);
    if (sub) {
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(sub, w / 2, 53);
    }
  });
}

function billboardTexture(brand, tagline, bg, fg, accent) {
  return textTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(w - 110, 70, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(brand, 36, 110);
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText(tagline, 36, 160);
    ctx.fillStyle = accent;
    ctx.fillRect(36, 190, 220, 10);
  });
}

function wayangTexture() {
  return textTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a2118';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8b25a';
    // A generic tall-headdress silhouette: an original abstract figure.
    ctx.beginPath();
    ctx.moveTo(64, 18);
    ctx.lineTo(78, 60);
    ctx.lineTo(72, 96);
    ctx.lineTo(86, 150);
    ctx.lineTo(78, 236);
    ctx.lineTo(50, 236);
    ctx.lineTo(42, 150);
    ctx.lineTo(56, 96);
    ctx.lineTo(50, 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2118';
    ctx.beginPath();
    ctx.arc(64, 74, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8b25a';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

function faceTexture(base, accent) {
  return textTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(44, 48, 12, 0, Math.PI * 2);
    ctx.arc(84, 48, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(44, 50, 6, 0, Math.PI * 2);
    ctx.arc(84, 50, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 78, 26, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);
  });
}

export function createWorld(scene, seed, movers) {
  const rng = makeRng(seed);
  const colliders = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const animated = { flags: [], beacons: null, clouds: [], boats: [], ondel: [], train: null, tollCars: [], flyCars: [] };

  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  // Sky dome: deep tropical blue above, warm orange haze at the horizon.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(480, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(COLORS.skyTop) },
        horizon: { value: new THREE.Color(COLORS.skyHorizon) },
      },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vDir; void main() { float t = pow(max(vDir.y, 0.0), 0.5); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(COLORS.fog, 190, 470);

  // Low golden sun: long shadows across the avenues.
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(150, 85, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 450;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x9db8dd, 0x8a7a5f, 0.9));

  // Ground, port apron and the bay.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 30);
  ground.receiveShadow = true;
  scene.add(ground);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT + 120, 18), new THREE.MeshStandardMaterial({ color: COLORS.concrete, roughness: 1 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, 0.06, HALF + 9);
  apron.receiveShadow = true;
  scene.add(apron);
  const waterTex = waterTexture();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 140),
    new THREE.MeshStandardMaterial({ map: waterTex, color: 0x9fd4e8, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.12, HALF + 18 + 70);
  scene.add(water);

  // Roads with dashed centre lines. The texture repeats along the length
  // so the dashes stay dashes instead of stretching into stripes.
  const asphalt = asphaltTexture();
  asphalt.repeat.set(1, 20);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 });
  for (const c of ROAD_CENTRES) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, EXTENT), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.05, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, EXTENT), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.rotation.z = Math.PI / 2;
    hRoad.position.set(0, 0.05, c);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
  }

  // The busway: a red median lane down Jl. Sudirman.
  const buswayTex = buswayTexture();
  buswayTex.repeat.set(1, 12);
  const busway = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, EXTENT),
    new THREE.MeshStandardMaterial({ map: buswayTex, roughness: 0.95 }),
  );
  busway.rotation.x = -Math.PI / 2;
  busway.position.set(CORRIDOR_X, 0.08, 0);
  busway.receiveShadow = true;
  scene.add(busway);

  // Zebra crossings at the four intersections around the monument square.
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e4 });
  for (const [cx, cz] of [[-26, -26], [26, 26], [-26, 26], [26, -26]]) {
    for (let i = 0; i < 5; i += 1) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 8), zebraMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(cx - 4 + i * 2, 0.09, cz + 8.5);
      scene.add(stripe);
    }
  }

  // Sidewalks: one raised paver slab per block.
  const paver = paverTexture();
  paver.repeat.set(6, 6);
  const walkMat = new THREE.MeshStandardMaterial({ map: paver, roughness: 1 });
  const blockOrigins = [];
  for (let bx = 0; bx < BLOCKS; bx += 1) {
    for (let bz = 0; bz < BLOCKS; bz += 1) {
      const ox = -HALF + ROAD + bx * PITCH;
      const oz = -HALF + ROAD + bz * PITCH;
      blockOrigins.push({ bx, bz, ox, oz });
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(ox + BLOCK / 2, 0.12, oz + BLOCK / 2);
      walk.receiveShadow = true;
      scene.add(walk);
    }
  }

  // District map: what each block holds.
  const districts = {
    '0,0': 'shophouses', '1,0': 'shophouses', '2,0': 'towers', '3,0': 'towers', '4,0': 'market',
    '0,1': 'shophouses', '1,1': 'police', '2,1': 'towers', '3,1': 'towers', '4,1': 'hotel',
    '0,2': 'park', '1,2': 'midrise', '2,2': 'square', '3,2': 'mosque', '4,2': 'warehouse',
    '0,3': 'chop', '1,3': 'midrise', '2,3': 'towers', '3,3': 'towers', '4,3': 'kampung',
    '0,4': 'garage', '1,4': 'midrise', '2,4': 'hospital', '3,4': 'kampung', '4,4': 'kampung',
  };

  // Shared building geometry and materials.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const wallTex = buildingTextures(rng);
  const wallSide = new THREE.MeshStandardMaterial({ map: wallTex.diffuse, emissiveMap: wallTex.emissive, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: COLORS.roof, roughness: 1 });
  const glassTex = glassTexture(rng);
  const glassSide = new THREE.MeshStandardMaterial({ map: glassTex.diffuse, emissiveMap: glassTex.emissive, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.45 });
  const glassRoof = new THREE.MeshStandardMaterial({ color: 0x3a4552, roughness: 0.8 });

  const midrise = [];
  const towers = [];
  const towerTops = [];
  const shopBoxes = [];
  const shopRoofs = [];
  const kampungBoxes = [];
  const kampungRoofs = [];
  const roofProps = [];

  for (const { bx, bz, ox, oz } of blockOrigins) {
    const kind = districts[`${bx},${bz}`];
    if (kind === 'square' || kind === 'park') continue;
    if (kind === 'towers' || kind === 'hotel') {
      // Two or three glass towers with setbacks and rooftop props.
      const spots = kind === 'hotel'
        ? [{ dx: 20, dz: 20, w: 24, d: 24, h: 44 }]
        : [{ dx: 11, dz: 11, w: 15, d: 15 }, { dx: 29, dz: 12, w: 14, d: 14 }, { dx: 20, dz: 29, w: 16, d: 15 }];
      for (const s of spots) {
        const h = s.h || rng.range(30, 62);
        const cx = ox + s.dx;
        const cz = oz + s.dz;
        towers.push({ x: cx, z: cz, w: s.w, d: s.d, h, color: rng.pick(COLORS.glassTower) });
        addCollider(cx - s.w / 2, cx + s.w / 2, cz - s.d / 2, cz + s.d / 2);
        if (h > 34) towerTops.push({ x: cx, z: cz, w: s.w * 0.55, d: s.d * 0.55, h: rng.range(4, 9), y: h, color: rng.pick(COLORS.glassTower) });
        roofProps.push({ x: cx + s.w * 0.25, z: cz + s.d * 0.2, y: h, kind: 'ac' });
        if (h > 45) roofProps.push({ x: cx, z: cz, y: h, kind: 'antenna' });
      }
      continue;
    }
    if (kind === 'shophouses') {
      // Colonial shophouses: two storeys, cream facades, terracotta hip roofs.
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const w = 11;
          const d = 14;
          const cx = ox + 4 + col * 12 + w / 2;
          const cz = oz + 5 + row * 19 + d / 2;
          const h = rng.range(7, 9);
          shopBoxes.push({ x: cx, z: cz, w, d, h, color: rng.pick([0xefe6d0, 0xe8d9b8, 0xdfd2bd, 0xf2ead8, 0xdcc9a8]) });
          shopRoofs.push({ x: cx, z: cz, w: w + 1.5, d: d + 1.5, h: 2.6, y: h, color: COLORS.roofTerracotta });
          addCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
        }
      }
      continue;
    }
    if (kind === 'kampung') {
      // Dense low houses with pitched corrugated roofs and narrow alleys.
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          if (rng.chance(0.12)) continue;
          const w = rng.range(6, 8);
          const d = rng.range(6, 8);
          const cx = ox + 5 + col * 9.5 + rng.range(-0.8, 0.8);
          const cz = oz + 5 + row * 9.5 + rng.range(-0.8, 0.8);
          const h = rng.range(3.2, 4.6);
          kampungBoxes.push({ x: cx, z: cz, w, d, h, color: rng.pick([0xd8c9a8, 0xc9b8a3, 0xb8c4b0, 0xd0a890, 0xe0d9c8, 0xc4b098]) });
          kampungRoofs.push({ x: cx, z: cz, w: w + 1, d: d + 1, h: rng.range(1.4, 2), y: h, color: rng.pick(COLORS.roofMetal) });
          addCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
        }
      }
      continue;
    }
    if (kind === 'midrise') {
      for (let qx = 0; qx < 2; qx += 1) {
        for (let qz = 0; qz < 2; qz += 1) {
          const w = rng.range(12, 16);
          const d = rng.range(12, 16);
          const h = rng.range(9, 22);
          const cx = ox + 9 + qx * 20 + (16 - w) / 2;
          const cz = oz + 9 + qz * 20 + (16 - d) / 2;
          midrise.push({ x: cx, z: cz, w, d, h, color: rng.pick(COLORS.building) });
          addCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
          if (rng.chance(0.5)) roofProps.push({ x: cx + w * 0.2, z: cz, y: h, kind: 'ac' });
        }
      }
      continue;
    }
    // Landmark blocks get one big building; the rest is handled below.
    if (kind === 'garage' || kind === 'warehouse' || kind === 'chop' || kind === 'police' || kind === 'hospital') {
      const spec = {
        garage: { w: 30, d: 18, h: 8, color: 0xc9a06b, dz: 12 },
        warehouse: { w: 34, d: 18, h: 11, color: 0xa89a8a, dz: 10 },
        chop: { w: 28, d: 16, h: 7, color: 0x8a949e, dz: 12 },
        police: { w: 26, d: 20, h: 12, color: 0xd8dde2, dz: 20 },
        hospital: { w: 30, d: 20, h: 14, color: 0xf0f0ee, dz: 20 },
      }[kind];
      const cx = ox + BLOCK / 2;
      const cz = oz + spec.dz;
      midrise.push({ x: cx, z: cz, w: spec.w, d: spec.d, h: spec.h, color: spec.color });
      addCollider(cx - spec.w / 2, cx + spec.w / 2, cz - spec.d / 2, cz + spec.d / 2);
    }
  }

  function instancedBoxes(list, materials, shadow) {
    const mesh = new THREE.InstancedMesh(boxGeo, materials, list.length);
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y || 0.12, p.z);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(p.color));
    });
    mesh.castShadow = !!shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  instancedBoxes(midrise, [wallSide, wallSide, roofMat, roofMat, wallSide, wallSide], true);
  instancedBoxes(towers, [glassSide, glassSide, glassRoof, glassRoof, glassSide, glassSide], true);
  instancedBoxes(towerTops, [glassSide, glassSide, glassRoof, glassRoof, glassSide, glassSide], true);
  instancedBoxes(shopBoxes, [wallSide, wallSide, roofMat, roofMat, wallSide, wallSide], true);
  instancedBoxes(kampungBoxes, [wallSide, wallSide, roofMat, roofMat, wallSide, wallSide], true);

  // Pyramid roofs for shophouses and kampung houses.
  const roofGeo = new THREE.ConeGeometry(0.72, 1, 4);
  roofGeo.translate(0, 0.5, 0);
  roofGeo.rotateY(Math.PI / 4);
  function instancedRoofs(list) {
    const mesh = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), list.length);
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(p.color));
    });
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  }
  instancedRoofs(shopRoofs);
  instancedRoofs(kampungRoofs);

  // Rooftop props: AC units and antenna spires with red beacons.
  const acGeo = new THREE.BoxGeometry(1.6, 1, 1.2);
  acGeo.translate(0, 0.5, 0);
  const acSpots = roofProps.filter((p) => p.kind === 'ac');
  const acMesh = new THREE.InstancedMesh(acGeo, new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.8 }), Math.max(1, acSpots.length));
  acSpots.forEach((p, i) => {
    dummy.position.set(p.x, p.y + 0.12, p.z);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    acMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(acMesh);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xff2222, emissiveIntensity: 2 });
  animated.beacons = beaconMat;
  const antennaSpots = roofProps.filter((p) => p.kind === 'antenna');
  for (const p of antennaSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7, 5), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    pole.position.set(p.x, p.y + 3.5, p.z);
    scene.add(pole);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), beaconMat);
    tip.position.set(p.x, p.y + 7.2, p.z);
    scene.add(tip);
  }

  // Masjid Agung: white hall, gold dome, four minarets.
  const mosque = new THREE.Group();
  const hallMat = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.85 });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 18), hallMat);
  hall.position.y = 4.5;
  hall.castShadow = true;
  mosque.add(hall);
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xd8a83c, metalness: 0.55, roughness: 0.35 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.y = 9;
  mosque.add(dome);
  const domeTip = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), domeMat);
  domeTip.position.y = 15.4;
  mosque.add(domeTip);
  for (const [mx, mz] of [[-12, -10], [12, -10], [-12, 10], [12, 10]]) {
    const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 20, 8), hallMat);
    minaret.position.set(mx, 10, mz);
    minaret.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    cap.position.set(mx, 20, mz);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.2, 6), domeMat);
    spike.position.set(mx, 22.4, mz);
    mosque.add(minaret, cap, spike);
  }
  mosque.position.set(52, 0.12, 0);
  scene.add(mosque);
  addCollider(40, 64, -10, 10);

  // Small musholla in the kampung: a white box with a green dome.
  const musholla = new THREE.Group();
  const mBox = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 6), hallMat);
  mBox.position.y = 2.25;
  mBox.castShadow = true;
  const mDome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2e8a5e, roughness: 0.5 }));
  mDome.position.y = 4.5;
  musholla.add(mBox, mDome);
  musholla.position.set(60, 0.12, 112);
  scene.add(musholla);
  addCollider(56, 64, 109, 115);

  // Tugu Semangat: stepped pedestal, tapered obelisk, golden flame.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(30, 32, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 1 }));
  plaza.position.set(0, 0.15, 0);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const monument = new THREE.Group();
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xb8a88e, roughness: 0.9 });
  for (let i = 0; i < 3; i += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(16 - i * 3, 1.6, 16 - i * 3), pedestalMat);
    step.position.y = 0.8 + i * 1.6;
    step.castShadow = true;
    monument.add(step);
  }
  const shaftGeo = new THREE.CylinderGeometry(2.2, 3.6, 46, 4);
  shaftGeo.rotateY(Math.PI / 4);
  const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.75 }));
  shaft.position.y = 4.8 + 23;
  shaft.castShadow = true;
  monument.add(shaft);
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xff9a1e, emissiveIntensity: 1.4, roughness: 0.4 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6.5, 10), flameMat);
  flame.position.y = 4.8 + 46 + 3;
  monument.add(flame);
  const flameBall = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), flameMat);
  flameBall.position.y = 4.8 + 46 + 0.6;
  monument.add(flameBall);
  monument.position.set(0, 0.3, 0);
  scene.add(monument);
  addCollider(-8, 8, -8, 8);
  // Flower beds around the plaza.
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 });
  const bloomMat = new THREE.MeshStandardMaterial({ color: 0xd44a6e, roughness: 0.8 });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 2), bedMat);
    bed.position.set(Math.sin(angle) * 18, 0.4, Math.cos(angle) * 18);
    bed.rotation.y = angle;
    scene.add(bed);
    const bloom = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 1.4), bloomMat);
    bloom.position.set(Math.sin(angle) * 18, 0.7, Math.cos(angle) * 18);
    bloom.rotation.y = angle;
    scene.add(bloom);
  }
  // Wayang silhouette fence panels around the square.
  const wayangTex = wayangTexture();
  const panelMat = new THREE.MeshStandardMaterial({ map: wayangTex, roughness: 0.9 });
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 + 0.26;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4), panelMat);
    panel.position.set(Math.sin(angle) * 28.5, 2.3, Math.cos(angle) * 28.5);
    panel.rotation.y = angle + Math.PI;
    scene.add(panel);
  }

  // Bundaran Semangat: grand roundabout with a fountain and a flower sculpture.
  const circle = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 14, 0.3, 36), new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 1 }));
  circle.position.set(ROUNDABOUT.x, 0.15, ROUNDABOUT.z);
  circle.receiveShadow = true;
  scene.add(circle);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.8, 1.1, 24), new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.85 }));
  basin.position.set(ROUNDABOUT.x, 0.7, ROUNDABOUT.z);
  basin.castShadow = true;
  scene.add(basin);
  const fountainPool = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.3, 24), new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.15 }));
  fountainPool.position.set(ROUNDABOUT.x, 1.2, ROUNDABOUT.z);
  scene.add(fountainPool);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 10), new THREE.MeshStandardMaterial({ color: 0xdff2f8, transparent: true, opacity: 0.55, roughness: 0.2 }));
  jet.position.set(ROUNDABOUT.x, 3.4, ROUNDABOUT.z);
  scene.add(jet);
  const flower = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 8), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.9 }));
  stem.position.y = 3.5;
  flower.add(stem);
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xd44a6e, roughness: 0.7 });
  for (let i = 0; i < 6; i += 1) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), petalMat);
    petal.scale.set(1, 0.35, 0.6);
    const angle = (i / 6) * Math.PI * 2;
    petal.position.set(Math.sin(angle) * 1.9, 7.2, Math.cos(angle) * 1.9);
    petal.rotation.y = angle;
    flower.add(petal);
  }
  const flowerCore = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.6 }));
  flowerCore.position.y = 7.2;
  flower.add(flowerCore);
  flower.position.set(ROUNDABOUT.x, 1.2, ROUNDABOUT.z);
  scene.add(flower);
  addCollider(ROUNDABOUT.x - 5.6, ROUNDABOUT.x + 5.6, ROUNDABOUT.z - 5.6, ROUNDABOUT.z + 5.6);

  // Park: banyan trees, a pendopo pavilion, paths.
  const parkOx = -HALF + ROAD + 0 * PITCH;
  const parkOz = -HALF + ROAD + 2 * PITCH;
  function banyan(x, z, s) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 1.4 * s, 5 * s, 8), new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 1 }));
    trunk.position.y = 2.5 * s;
    trunk.castShadow = true;
    tree.add(trunk);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f6d33, roughness: 1 });
    for (const [dx, dy, dz, r] of [[0, 6.2, 0, 4.2], [-2.6, 5.4, 1, 2.6], [2.4, 5.6, -1, 2.8]]) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), canopyMat);
      blob.scale.y = 0.55;
      blob.position.set(dx * s, dy * s, dz * s);
      blob.castShadow = true;
      tree.add(blob);
    }
    for (let i = 0; i < 5; i += 1) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4 * s, 5), new THREE.MeshStandardMaterial({ color: 0x5a4630 }));
      const angle = (i / 5) * Math.PI * 2;
      root.position.set(Math.sin(angle) * 2.6 * s, 3.4 * s, Math.cos(angle) * 2.6 * s);
      tree.add(root);
    }
    tree.position.set(x, 0.12, z);
    scene.add(tree);
    addCollider(x - 1.2 * s, x + 1.2 * s, z - 1.2 * s, z + 1.2 * s);
    return tree;
  }
  banyan(parkOx + 10, parkOz + 10, 1.2);
  banyan(parkOx + 30, parkOz + 28, 1);
  banyan(parkOx + 28, parkOz + 8, 0.9);
  const pendopo = new THREE.Group();
  for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c33, roughness: 1 }));
    post.position.set(px, 1.7, pz);
    pendopo.add(post);
  }
  const pendopoRoof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.4, 4), new THREE.MeshStandardMaterial({ color: COLORS.roofTerracotta, roughness: 0.9 }));
  pendopoRoof.position.y = 4.6;
  pendopoRoof.rotation.y = Math.PI / 4;
  pendopo.add(pendopoRoof);
  pendopo.position.set(parkOx + 20, 0.12, parkOz + 20);
  scene.add(pendopo);
  const fountain2 = new THREE.Group();
  const basin2 = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.9, 18), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.8 }));
  basin2.position.y = 0.45;
  const pool2 = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.25, 18), new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.2 }));
  pool2.position.y = 0.95;
  fountain2.add(basin2, pool2);
  fountain2.position.set(parkOx + 12, 0.12, parkOz + 30);
  scene.add(fountain2);
  addCollider(parkOx + 8.6, parkOx + 15.4, parkOz + 26.6, parkOz + 33.4);

  // Hospital cross and police flag.
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xd43a2e, emissive: 0x661108, roughness: 0.6 });
  const cross = new THREE.Group();
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.4, 0.6), crossMat));
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.6), crossMat);
  cross.add(crossH);
  cross.position.set(0, 17.5, 104);
  scene.add(cross);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
  flagPole.position.set(-58, 4.5, -60);
  scene.add(flagPole);
  const flagTex = flagTexture();
  const policeFlag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
  policeFlag.position.set(-56.6, 8.2, -60);
  scene.add(policeFlag);
  animated.flags.push(policeFlag);

  // Market sheds, stalls and food carts at Pasar Pagi.
  const stripeTex = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#e8e8e4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c23a2e';
    for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 8, h);
  });
  stripeTex.repeat.set(3, 1);
  const stallSpots = [
    { x: 92, z: -112, name: 'NASI GORENG MBAK SRI', color: 0xd9a441 },
    { x: 104, z: -114, name: 'SATE AYAM PAK DE', color: 0xc94f43 },
    { x: 116, z: -112, name: 'KOPI SEDAP', color: 0x7a5a3a },
    { x: 92, z: -96, name: 'BUBUR AYAM 77', color: 0x4d7c5f },
    { x: 116, z: -96, name: 'ES CAMPUR SEGAR', color: 0x3f6d9e },
  ];
  for (const stall of stallSpots) {
    const group = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 2), new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 1 }));
    counter.position.y = 0.55;
    counter.castShadow = true;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 2.6), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.9 }));
    awning.position.y = 2.5;
    awning.rotation.x = 0.14;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.7), new THREE.MeshBasicMaterial({ map: signTexture(stall.name, null), side: THREE.DoubleSide }));
    board.position.set(0, 2.1, 1.05);
    group.add(counter, awning, board);
    for (const [px, pz] of [[-1.7, -1], [1.7, -1], [-1.7, 1], [1.7, 1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 5), new THREE.MeshStandardMaterial({ color: 0x5a4630 }));
      post.position.set(px, 1.25, pz);
      group.add(post);
    }
    group.position.set(stall.x, 0.12, stall.z);
    scene.add(group);
    addCollider(stall.x - 1.8, stall.x + 1.8, stall.z - 1.4, stall.z + 1.4);
  }
  // Food carts with umbrellas.
  for (const [x, z, c] of [[98, -104, 0xe87f2e], [110, -104, 0x2e8a5e], [-60, 96, 0xc23a2e]]) {
    const cart = new THREE.Group();
    const cartBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    cartBox.position.y = 0.85;
    cartBox.castShadow = true;
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 10);
    wheelGeo.rotateX(Math.PI / 2);
    for (const side of [-0.6, 0.6]) {
      const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      wheel.position.set(side, 0.35, 0);
      cart.add(wheel);
    }
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.9 }));
    umbrella.position.y = 2.5;
    const umbrellaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    umbrellaPole.position.y = 1.8;
    cart.add(cartBox, umbrella, umbrellaPole);
    cart.position.set(x, 0.12, z);
    scene.add(cart);
    addCollider(x - 1, x + 1, z - 0.7, z + 0.7);
  }

  // Port: cranes, containers, fishing boats.
  function portCrane(x, z) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.7 });
    for (const [lx, lz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 14, 0.7), legMat);
      leg.position.set(lx, 7, lz);
      crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 1.4), legMat);
    beam.position.set(2, 14.5, 0);
    crane.add(beam);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xf0f0ea }));
    cab.position.set(0, 13, 0);
    crane.add(cab);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cable.position.set(8, 11, 0);
    crane.add(cable);
    const load = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x2e5f8a }));
    load.position.set(8, 7, 0);
    crane.add(load);
    crane.position.set(x, 0.12, z);
    scene.add(crane);
    addCollider(x - 3.5, x + 3.5, z - 2.5, z + 2.5);
  }
  portCrane(80, 146);
  portCrane(118, 146);
  const containerGeo = new THREE.BoxGeometry(6, 2.6, 2.4);
  const containerColors = [0xc23a2e, 0x2e5f8a, 0x4d7c5f, 0xd9a441, 0x7a6ba8];
  const containerSpots = [];
  for (let i = 0; i < 8; i += 1) {
    containerSpots.push({ x: 56 + (i % 4) * 7, z: 144 + Math.floor(i / 4) * 4, color: containerColors[i % containerColors.length], stack: i % 3 === 0 });
  }
  const containers = new THREE.InstancedMesh(containerGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), containerSpots.length + 2);
  let ci = 0;
  for (const c of containerSpots) {
    dummy.position.set(c.x, 0.12, c.z);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    containers.setMatrixAt(ci, dummy.matrix);
    containers.setColorAt(ci, color.setHex(c.color));
    addCollider(c.x - 3, c.x + 3, c.z - 1.2, c.z + 1.2);
    ci += 1;
    if (c.stack) {
      dummy.position.set(c.x, 2.72, c.z);
      dummy.updateMatrix();
      containers.setMatrixAt(ci, dummy.matrix);
      containers.setColorAt(ci, color.setHex(containerColors[(ci + 2) % containerColors.length]));
      ci += 1;
    }
  }
  containers.count = ci;
  containers.castShadow = true;
  scene.add(containers);
  function buildBoat(x, z, hullColor) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 7), new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.7 }));
    hull.position.y = 0.55;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 3), new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.9 }));
    canopy.position.set(0, 1.9, -0.5);
    const outrigger = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c33 }));
    outrigger.rotation.z = Math.PI / 2;
    outrigger.position.set(2.2, 0.3, 0);
    boat.add(hull, canopy, outrigger);
    boat.position.set(x, 0.1, z);
    boat.rotation.y = rng.range(-0.3, 0.3);
    scene.add(boat);
    return boat;
  }
  animated.boats = [buildBoat(60, HALF + 34, 0xc94f43), buildBoat(126, HALF + 30, 0x2e5f8a), buildBoat(20, HALF + 44, 0xe0d9c8), buildBoat(-30, HALF + 40, 0x4d7c5f)];

  // Clouds: white puffs and a few big dramatic storm-grey masses.
  const cloudWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  const cloudGrey = new THREE.MeshBasicMaterial({ color: 0x9aa4b0, transparent: true, opacity: 0.9, fog: false });
  for (let i = 0; i < 11; i += 1) {
    const stormy = i < 3;
    const cloud = new THREE.Group();
    const puffs = stormy ? 5 : 2 + Math.floor(rng.next() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(4, stormy ? 11 : 8), 10, 8), stormy ? cloudGrey : cloudWhite);
      puff.scale.y = stormy ? 0.5 : 0.42;
      puff.position.set(p * 6 - puffs * 3, rng.range(-1, 1), rng.range(-2, 2));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-280, 280), rng.range(stormy ? 95 : 70, stormy ? 115 : 100), rng.range(-240, 240));
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // Street trees: instanced trunks and leaf blobs along the sidewalks.
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 2.6, 6);
  trunkGeo.translate(0, 1.3, 0);
  const leafGeo = new THREE.IcosahedronGeometry(1.7, 1);
  const treeSpots = [];
  for (const { ox, oz } of blockOrigins) {
    for (let i = 0; i < 2; i += 1) {
      const edge = rng.pick(['n', 's', 'e', 'w']);
      let x = ox + 20;
      let z = oz + 20;
      if (edge === 'n') { x = ox + rng.range(6, 34); z = oz + 1.6; }
      if (edge === 's') { x = ox + rng.range(6, 34); z = oz + BLOCK - 1.6; }
      if (edge === 'e') { x = ox + BLOCK - 1.6; z = oz + rng.range(6, 34); }
      if (edge === 'w') { x = ox + 1.6; z = oz + rng.range(6, 34); }
      if (Math.hypot(x, z) < 34) continue; // keep the monument plaza clear
      if (Math.hypot(x - ROUNDABOUT.x, z - ROUNDABOUT.z) < 17) continue;
      treeSpots.push({ x, z, s: rng.range(0.8, 1.25) });
    }
  }
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: COLORS.treeTrunk, roughness: 1 }), treeSpots.length);
  const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), treeSpots.length);
  treeSpots.forEach((t, i) => {
    dummy.position.set(t.x, 0.12, t.z);
    dummy.scale.setScalar(t.s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 3.4 * t.s;
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
    leafMesh.setColorAt(i, color.setHex(rng.pick(COLORS.treeLeaf)));
    addCollider(t.x - 0.4, t.x + 0.4, t.z - 0.4, t.z + 0.4);
  });
  trunkMesh.castShadow = true;
  leafMesh.castShadow = true;
  scene.add(trunkMesh, leafMesh);

  // Palms along the corridor and the bay front.
  const palmSpots = [];
  for (let z = -124; z <= 124; z += 26) {
    if (Math.abs(z + 26) < 16) continue;
    palmSpots.push({ x: CORRIDOR_X - 7.5, z, s: rng.range(0.9, 1.2), lean: rng.range(-0.06, 0.06) });
    palmSpots.push({ x: CORRIDOR_X + 7.5, z: z + 13, s: rng.range(0.9, 1.2), lean: rng.range(-0.06, 0.06) });
  }
  for (let x = -110; x <= 110; x += 28) palmSpots.push({ x, z: HALF + 8, s: rng.range(1, 1.3), lean: rng.range(-0.05, 0.05) });
  const palmTrunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 7, 6);
  palmTrunkGeo.translate(0, 3.5, 0);
  const palmTrunks = new THREE.InstancedMesh(palmTrunkGeo, new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }), palmSpots.length);
  const frondTex = palmFrondTexture();
  const frondMat = new THREE.MeshStandardMaterial({ map: frondTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1, color: 0xffffff });
  const frondGeo = new THREE.PlaneGeometry(7, 7);
  frondGeo.translate(0, -2.6, 0);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 2);
  palmSpots.forEach((p, i) => {
    dummy.position.set(p.x, 0.12, p.z);
    dummy.scale.setScalar(p.s);
    dummy.rotation.set(p.lean, 0, 0);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 2; k += 1) {
      dummy.position.set(p.x, 7 * p.s, p.z);
      dummy.rotation.set(0, (k * Math.PI) / 2 + 0.4, 0);
      dummy.updateMatrix();
      fronds.setMatrixAt(i * 2 + k, dummy.matrix);
    }
    addCollider(p.x - 0.4, p.x + 0.4, p.z - 0.4, p.z + 0.4);
  });
  palmTrunks.castShadow = true;
  scene.add(palmTrunks, fronds);

  // Street lamps at every intersection.
  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.4, 6);
  lampPoleGeo.translate(0, 2.7, 0);
  const lampHeadGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampSpots = [];
  for (const cx of ROAD_CENTRES) {
    for (const cz of ROAD_CENTRES) {
      lampSpots.push({ x: cx + 7.2, z: cz + 7.2 });
      lampSpots.push({ x: cx - 7.2, z: cz - 7.2 });
    }
  }
  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.7 }), lampSpots.length);
  const lampHeads = new THREE.InstancedMesh(lampHeadGeo, new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffd489, emissiveIntensity: 1.6 }), lampSpots.length);
  lampSpots.forEach((p, i) => {
    dummy.position.set(p.x, 0.12, p.z);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 5.55;
    dummy.updateMatrix();
    lampHeads.setMatrixAt(i, dummy.matrix);
  });
  scene.add(lampPoles, lampHeads);

  // Red-and-white flags around the plaza and the corridor.
  const flagPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 8, 6);
  const flagSpots = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + 0.39;
    flagSpots.push({ x: Math.sin(angle) * 17, z: Math.cos(angle) * 17 });
  }
  for (const z of [-104, -52, 52, 104]) flagSpots.push({ x: CORRIDOR_X - 7.5, z });
  for (const p of flagSpots) {
    const pole = new THREE.Mesh(flagPoleGeo, new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    pole.position.set(p.x, 4, p.z);
    scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
    flag.position.set(p.x + 1.35, 7.1, p.z);
    scene.add(flag);
    animated.flags.push(flag);
    addCollider(p.x - 0.2, p.x + 0.2, p.z - 0.2, p.z + 0.2);
  }

  // Umbul-umbul: pennant strings across three streets.
  const flagShape = new THREE.Shape();
  flagShape.moveTo(-0.4, 0);
  flagShape.lineTo(0.4, 0);
  flagShape.lineTo(0, -1);
  flagShape.closePath();
  const pennantGeo = new THREE.ShapeGeometry(flagShape);
  const pennantMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const pennantSpots = [];
  const lineMat = new THREE.LineBasicMaterial({ color: 0x444444 });
  for (const [ax, az, bx, bz] of [[-84, -26, -72, -26], [20, 78, 32, 78], [72, -104, 84, -104]]) {
    const pts = [];
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      pts.push(new THREE.Vector3(ax + (bx - ax) * t, 5.6 - Math.sin(t * Math.PI) * 0.9, az + (bz - az) * t));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    for (let i = 1; i < 10; i += 1) {
      const t = i / 10;
      pennantSpots.push({ x: ax + (bx - ax) * t, y: 5.6 - Math.sin(t * Math.PI) * 0.9, z: az + (bz - az) * t, color: [0xe11e2b, 0xf5f5f0, 0xf2c94c][i % 3], angle: Math.atan2(bx - ax, bz - az) });
    }
  }
  const pennants = new THREE.InstancedMesh(pennantGeo, pennantMat, pennantSpots.length);
  pennantSpots.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, p.angle, 0);
    dummy.updateMatrix();
    pennants.setMatrixAt(i, dummy.matrix);
    pennants.setColorAt(i, color.setHex(p.color));
  });
  scene.add(pennants);

  // Ondel-ondel: giant Betawi puppets, original shapes, painted faces.
  function ondelOndel(x, z, bodyColor, faceBase, faceAccent) {
    const puppet = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 2.8, 12), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85 }));
    body.position.y = 1.4;
    body.castShadow = true;
    const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 12), new THREE.MeshStandardMaterial({ color: faceAccent, roughness: 0.8 }));
    shoulders.position.y = 2.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), new THREE.MeshStandardMaterial({ color: faceBase, roughness: 0.7 }));
    head.position.y = 3.9;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: faceTexture(faceBase, faceAccent) }));
    face.position.set(0, 3.9, 0.8);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 }));
    hair.position.y = 4.05;
    const armGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.6, 6);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: faceBase, roughness: 0.8 }));
      arm.position.set(side * 1.5, 2.2, 0);
      arm.rotation.z = side * 0.9;
      puppet.add(arm);
    }
    puppet.add(body, shoulders, head, face, hair);
    puppet.position.set(x, 0.12, z);
    scene.add(puppet);
    animated.ondel.push(puppet);
    addCollider(x - 1.5, x + 1.5, z - 1.5, z + 1.5);
  }
  ondelOndel(-92, -88, 0xc23a2e, 0xf2e8d8, 0xf2c94c);
  ondelOndel(-16, 16, 0x2e5f9e, 0xe8d8b8, 0xc23a2e);

  // Street name signs: green plates on poles.
  const streetSigns = [
    { x: -85.2, z: -70.8, text: 'Jl. Hayam Wuruk', angle: 0 },
    { x: 33.2, z: -70.8, text: 'Jl. Sudirman', angle: 0 },
    { x: -33.2, z: 33.2, text: 'Jl. Merdeka', angle: Math.PI / 2 },
    { x: 85.2, z: 85.2, text: 'Jl. Thamrin', angle: Math.PI / 2 },
    { x: -122.8, z: 33.2, text: 'Jl. Gajah Mada', angle: 0 },
    { x: 122.8, z: -33.2, text: 'Jl. Rasuna Said', angle: Math.PI / 2 },
    { x: 96, z: 96, text: 'Gang Kampung', angle: 0 },
    { x: -33.2, z: -122.8, text: 'Jl. Angkasa', angle: Math.PI / 2 },
  ];
  for (const s of streetSigns) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x666666 }));
    pole.position.set(s.x, 1.6, s.z);
    scene.add(pole);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: signTexture(s.text, null), side: THREE.DoubleSide }));
    plate.position.set(s.x, 3.1, s.z);
    plate.rotation.y = s.angle;
    scene.add(plate);
    addCollider(s.x - 0.2, s.x + 0.2, s.z - 0.2, s.z + 0.2);
  }

  // Billboards with invented Indonesian-sounding brands.
  const billboards = [
    { x: 40, z: -60, angle: -Math.PI / 2, brand: 'KOPI SENJA', tag: 'Rasa rumah.', bg: '#3a2a1e', fg: '#f2e8d8', accent: '#e87f2e' },
    { x: -40, z: 60, angle: Math.PI / 2, brand: 'TEH MELATI', tag: 'Segar setiap saat.', bg: '#2e5f3a', fg: '#ffffff', accent: '#f2c94c' },
    { x: 90, z: -52, angle: -Math.PI / 2, brand: 'SABUN WANGI', tag: 'Wangi sepanjang hari.', bg: '#7a3a6e', fg: '#ffffff', accent: '#ffd489' },
    { x: -90, z: 118, angle: 0, brand: 'ES KRIM PELANGI', tag: 'Manisnya Nusantara.', bg: '#2e5f9e', fg: '#ffffff', accent: '#e87f2e' },
  ];
  for (const b of billboards) {
    const group = new THREE.Group();
    for (const side of [-3, 3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 9, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      leg.position.set(side, 4.5, 0);
      group.add(leg);
    }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    panel.position.y = 11;
    panel.castShadow = true;
    group.add(panel);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.1), new THREE.MeshBasicMaterial({ map: billboardTexture(b.brand, b.tag, b.bg, b.fg, b.accent) }));
    face.position.set(0, 11, 0.2);
    group.add(face);
    group.position.set(b.x, 0.12, b.z);
    group.rotation.y = b.angle;
    scene.add(group);
    addCollider(b.x - 1, b.x + 1, b.z - 1, b.z + 1);
  }

  // Traffic cones at a roadwork patch and a busway entrance.
  const coneGeo = new THREE.ConeGeometry(0.35, 0.8, 10);
  coneGeo.translate(0, 0.4, 0);
  const coneSpots = [];
  for (let i = 0; i < 5; i += 1) coneSpots.push({ x: -80 + i * 1.6, z: 20 });
  for (let i = 0; i < 4; i += 1) coneSpots.push({ x: 24 + i * 1.4, z: -60 });
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshStandardMaterial({ color: 0xe87f2e, roughness: 0.8 }), coneSpots.length);
  coneSpots.forEach((p, i) => {
    dummy.position.set(p.x, 0.12, p.z);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);
  });
  scene.add(cones);

  // Busway shelters on the corridor sidewalks.
  function buswayShelter(x, z) {
    const group = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.35, roughness: 0.15 }));
    glass.position.y = 1.2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 3), new THREE.MeshStandardMaterial({ color: COLORS.busRed, roughness: 0.7 }));
    roof.position.y = 2.7;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x6d4c33 }));
    bench.position.y = 0.5;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: signTexture('HALTE BUSWAY', 'Kota - Sudirman'), side: THREE.DoubleSide }));
    board.position.set(0, 2.1, 1.25);
    group.add(glass, roof, bench, board);
    group.position.set(x, 0.12, z);
    scene.add(group);
    // No collider: the shelter stands at the intersection corner and its
    // box would block the lane. Its glass sits clear of the swept path.
  }
  buswayShelter(36, -78);
  buswayShelter(36, 78);

  // Ojek pangkalan stands: parked bikes and waiting riders in green jackets.
  function ojekStand(x, z, angle) {
    const group = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const bike = movers.makeBikeModel('scooter', { shirt: COLORS.ojekGreen, pants: 0x2e3a4d, skin: 0xa86a42, hat: 'helmet', hatColor: COLORS.ojekGreen }, {});
      bike.group.position.set(i * 1.4 - 1.4, 0, 0.5);
      bike.group.rotation.y = 0.2;
      group.add(bike.group);
    }
    for (let i = 0; i < 2; i += 1) {
      const rider = movers.makePersonModel({ shirt: COLORS.ojekGreen, pants: 0x2e3a4d, skin: 0xa86a42, hat: 'helmet' });
      rider.group.position.set(i * 1.6 - 0.8, 0, -1);
      rider.group.rotation.y = Math.PI + 0.3;
      group.add(rider.group);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture('OJEK PANGKALAN', null), side: THREE.DoubleSide }));
    sign.position.set(0, 2.4, 0);
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x666666 }));
    signPole.position.y = 1.2;
    group.add(sign, signPole);
    group.position.set(x, 0.12, z);
    group.rotation.y = angle;
    scene.add(group);
    addCollider(x - 2.4, x + 2.4, z - 1.6, z + 1.6);
  }
  ojekStand(40, -90, 0);
  ojekStand(-40, 88, Math.PI);

  // Bajaj stand near the market.
  function bajajStand(x, z) {
    for (let i = 0; i < 2; i += 1) {
      const bajaj = movers.makeBajajModel();
      bajaj.group.position.set(x + i * 3.4, 0.12, z);
      bajaj.group.rotation.y = 0.15;
      scene.add(bajaj.group);
    }
    addCollider(x - 1.5, x + 4.5, z - 1.6, z + 1.6);
  }
  bajajStand(88, -88);

  // Elevated toll road along the west edge, with moving cars.
  const tollX = -HALF - 15;
  const tollDeck = new THREE.Mesh(new THREE.BoxGeometry(11, 1, 360), new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 1 }));
  tollDeck.position.set(tollX, 8, 0);
  scene.add(tollDeck);
  for (const side of [-5, 5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 360), new THREE.MeshStandardMaterial({ color: 0x6a6a66 }));
    rail.position.set(tollX + side, 9, 0);
    scene.add(rail);
  }
  const pillarGeo = new THREE.BoxGeometry(2, 8, 2);
  pillarGeo.translate(0, 4, 0);
  const tollPillars = new THREE.InstancedMesh(pillarGeo, new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 1 }), 15);
  for (let i = 0; i < 15; i += 1) {
    dummy.position.set(tollX, 0, -168 + i * 24);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    tollPillars.setMatrixAt(i, dummy.matrix);
  }
  scene.add(tollPillars);
  for (let i = 0; i < 3; i += 1) {
    const car = movers.makeCarModel('sedan', 0xd8d8d8, false);
    const dir = i === 2 ? -1 : 1;
    car.group.position.set(tollX + (dir > 0 ? -2.6 : 2.6), 8.6, -120 + i * 110);
    car.group.rotation.y = dir > 0 ? 0 : Math.PI;
    scene.add(car.group);
    animated.tollCars.push({ group: car.group, dir, speed: 17 + i * 2 });
  }

  // Coastal flyover over the bay, with moving cars.
  const flyZ = HALF + 26;
  const flyDeck = new THREE.Mesh(new THREE.BoxGeometry(300, 1, 9), new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 1 }));
  flyDeck.position.set(0, 7, flyZ);
  scene.add(flyDeck);
  const flyPillars = new THREE.InstancedMesh(pillarGeo, new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 1 }), 12);
  for (let i = 0; i < 12; i += 1) {
    dummy.position.set(-143 + i * 26, 0, flyZ);
    dummy.scale.set(1, 0.9, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    flyPillars.setMatrixAt(i, dummy.matrix);
  }
  scene.add(flyPillars);
  for (let i = 0; i < 2; i += 1) {
    const car = movers.makeCarModel(i === 0 ? 'suv' : 'mpv', i === 0 ? 0xe8e8e8 : 0x333a42, false);
    const dir = i === 0 ? 1 : -1;
    car.group.position.set(-80 + i * 140, 7.6, flyZ + (dir > 0 ? -2.2 : 2.2));
    car.group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(car.group);
    animated.flyCars.push({ group: car.group, dir, speed: 15 + i * 3 });
  }

  // Elevated MRT line along the north edge, with two stations and a train.
  const railZ = -HALF - 14;
  const guideway = new THREE.Mesh(new THREE.BoxGeometry(320, 1.1, 7), new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 1 }));
  guideway.position.set(0, 9, railZ);
  scene.add(guideway);
  const railPillars = new THREE.InstancedMesh(pillarGeo, new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 1 }), 13);
  for (let i = 0; i < 13; i += 1) {
    dummy.position.set(-156 + i * 26, 0, railZ);
    dummy.scale.set(1, 1.1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    railPillars.setMatrixAt(i, dummy.matrix);
  }
  scene.add(railPillars);
  function mrtStation(x, name) {
    const group = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 9), new THREE.MeshStandardMaterial({ color: 0xb5afa2, roughness: 1 }));
    platform.position.y = 9.6;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x3f6d9e, roughness: 0.7 }));
    roof.position.y = 14;
    for (const [px, pz] of [[-10, -4], [10, -4], [-10, 4], [10, 4]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.4, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      post.position.set(px, 11.8, pz);
      group.add(post);
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 1), new THREE.MeshBasicMaterial({ map: signTexture(name, 'MRT'), side: THREE.DoubleSide }));
    board.position.set(0, 12.4, 0);
    const stairs = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x8a8a86 }));
    stairs.position.set(8, 4.6, 6);
    stairs.rotation.x = 0.6;
    group.add(platform, roof, board, stairs);
    group.position.set(x, 0, railZ);
    scene.add(group);
  }
  mrtStation(-52, 'STASIUN MELATI');
  mrtStation(52, 'STASIUN KOTA');
  const train = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const coach = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 2.8, 2.7), new THREE.MeshStandardMaterial({ color: COLORS.busWhite, roughness: 0.6 }));
    body.position.y = 1.9;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(10.1, 0.7, 2.75), new THREE.MeshStandardMaterial({ color: COLORS.busRed, roughness: 0.6 }));
    stripe.position.y = 1.2;
    const windows = new THREE.Mesh(new THREE.BoxGeometry(9, 0.9, 2.75), new THREE.MeshStandardMaterial({ color: COLORS.glass, roughness: 0.2 }));
    windows.position.y = 2.5;
    coach.add(body, stripe, windows);
    coach.position.x = (i - 1) * 10.6;
    train.add(coach);
  }
  train.position.set(-120, 9.6, railZ);
  scene.add(train);
  animated.train = { group: train, dir: 1, wait: 0, speed: 14, lastStop: null };

  // Collision: circle vs registered boxes, pushing out along the smallest axis.
  function collideCircle(x, z, radius) {
    let hit = false;
    for (const c of colliders) {
      if (x + radius < c.minX || x - radius > c.maxX || z + radius < c.minZ || z - radius > c.maxZ) continue;
      hit = true;
      const pushLeft = x + radius - c.minX;
      const pushRight = c.maxX - (x - radius);
      const pushUp = z + radius - c.minZ;
      const pushDown = c.maxZ - (z - radius);
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) x = c.minX - radius;
      else if (min === pushRight) x = c.maxX + radius;
      else if (min === pushUp) z = c.minZ - radius;
      else z = c.maxZ + radius;
    }
    const limit = HALF + 20;
    const cx = Math.max(-limit, Math.min(limit, x));
    const cz = Math.max(-limit, Math.min(limit, z));
    if (cx !== x || cz !== z) hit = true;
    return { x: cx, z: cz, hit };
  }

  function isOnRoad(x, z) {
    for (const c of ROAD_CENTRES) {
      if (Math.abs(x - c) < 8 || Math.abs(z - c) < 8) return true;
    }
    return Math.hypot(x - ROUNDABOUT.x, z - ROUNDABOUT.z) < 16;
  }

  const clockState = { time: 0 };
  function update(dt, time, focus) {
    clockState.time = time;
    waterTex.offset.x = (time * 0.008) % 1;
    for (const cloud of animated.clouds) {
      cloud.position.x += dt * 1.1;
      if (cloud.position.x > 300) cloud.position.x = -300;
    }
    for (let i = 0; i < animated.boats.length; i += 1) {
      const boat = animated.boats[i];
      boat.position.y = 0.1 + Math.sin(time * 0.7 + i * 1.7) * 0.14;
      boat.rotation.z = Math.sin(time * 0.5 + i) * 0.03;
    }
    for (let i = 0; i < animated.flags.length; i += 1) {
      animated.flags[i].rotation.y = Math.sin(time * 1.8 + i * 1.3) * 0.14;
    }
    if (animated.beacons) animated.beacons.emissiveIntensity = 1.2 + Math.sin(time * 3) * 1.1;
    for (let i = 0; i < animated.ondel.length; i += 1) {
      animated.ondel[i].rotation.z = Math.sin(time * 0.8 + i * 2) * 0.04;
    }
    for (const mover of animated.tollCars) {
      mover.group.position.z += mover.dir * mover.speed * dt;
      if (mover.group.position.z > 175) mover.group.position.z = -175;
      if (mover.group.position.z < -175) mover.group.position.z = 175;
    }
    for (const mover of animated.flyCars) {
      mover.group.position.x += mover.dir * mover.speed * dt;
      if (mover.group.position.x > 145) mover.group.position.x = -145;
      if (mover.group.position.x < -145) mover.group.position.x = 145;
    }
    const trainState = animated.train;
    if (trainState) {
      if (trainState.wait > 0) {
        trainState.wait -= dt;
      } else {
        trainState.group.position.x += trainState.dir * trainState.speed * dt;
        const tx = trainState.group.position.x;
        // Stop at each station once per pass: the stop triggers on arrival
        // inside the station window, and only re-arms after leaving it,
        // so the train does not wait forever at the first station.
        let atStation = null;
        for (const s of [-52, 52]) if (Math.abs(tx - s) < 2) atStation = s;
        if (atStation !== null && trainState.lastStop !== atStation) {
          trainState.wait = 4;
          trainState.lastStop = atStation;
        } else if (atStation === null) {
          trainState.lastStop = null;
        }
        if (tx > 125) trainState.dir = -1;
        if (tx < -125) trainState.dir = 1;
      }
    }
    if (focus) {
      sun.position.set(focus.x + 150, 85, focus.z + 50);
      sun.target.position.set(focus.x, 0, focus.z);
    }
  }

  return { colliders, collideCircle, isOnRoad, update, train: animated.train };
}
