// People: one procedural low-poly person model shared by Bimo, the
// pedestrians and the Kalong crew, plus the three behaviours: the player
// character with punching and shooting, wandering pedestrians who flee from
// trouble, and hostile enemies who strafe and shoot back. Pedestrians wear
// Jakarta: batik shirts, office whites, ojek green, guard uniforms, vendor
// aprons, colourful hijabs, student backpacks and construction vests.
import * as THREE from 'three';
import { BLOCK, BLOCKS, COLORS, HALF, ON_FOOT, PITCH, ROAD } from './config.js';

const limbGeo = new THREE.BoxGeometry(1, 1, 1);

function limb(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(limbGeo, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function batikTexture(base, line) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (let row = -1; row < 4; row += 1) {
    ctx.beginPath();
    for (let x = 0; x <= 64; x += 4) {
      const y = row * 20 + Math.sin((x + row * 14) * 0.14) * 6 + 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = line;
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.arc((i * 29) % 64, (i * 23) % 64, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const batikTextures = [
  batikTexture('#2a3a6e', '#e8ddc0'),
  batikTexture('#6e3a2a', '#f2c94c'),
  batikTexture('#3a5e3a', '#e8e8e4'),
];
const flashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });

// A person facing +Z. opts: shirt, pants, skin, hat ('cap'|'helmet'|'hardhat'
// |'hijab'|null), hatColor, vest, tie, apron, backpack, backpackColor,
// batik (0..2 or -1), scale, width. Returns the group and the joints.
export function makePersonModel(opts = {}) {
  const group = new THREE.Group();
  const batik = opts.batik !== undefined && opts.batik !== null && opts.batik >= 0 ? opts.batik : -1;
  const shirtMat = batik >= 0
    ? new THREE.MeshStandardMaterial({ map: batikTextures[batik % batikTextures.length], roughness: 0.85 })
    : new THREE.MeshStandardMaterial({ color: opts.shirt ?? 0x3f6d9e, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: opts.pants ?? 0x2e3a4d, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: opts.skin ?? 0xa86a42, roughness: 0.7 });
  const torso = limb(0.56, 0.62, 0.3, shirtMat, 0, 0.82, 0);
  const head = limb(0.34, 0.36, 0.32, skinMat, 0, 1.34, 0);
  group.add(torso, head);
  const hat = opts.hat || null;
  const hatColor = opts.hatColor ?? 0xc94f43;
  const hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.8 });
  if (hat === 'cap') {
    group.add(limb(0.37, 0.12, 0.35, hatMat, 0, 1.55, 0));
    group.add(limb(0.37, 0.05, 0.2, hatMat, 0, 1.5, 0.24));
  } else if (hat === 'helmet') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), hatMat);
    dome.position.set(0, 1.44, 0);
    dome.castShadow = true;
    group.add(dome);
    group.add(limb(0.3, 0.1, 0.06, new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.2 }), 0, 1.42, 0.2));
  } else if (hat === 'hardhat') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    dome.position.set(0, 1.5, 0);
    group.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), hatMat);
    brim.position.set(0, 1.5, 0);
    group.add(brim);
  } else if (hat === 'hijab') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), hatMat);
    cap.scale.set(1, 1.05, 1);
    cap.position.set(0, 1.42, -0.02);
    group.add(cap);
    group.add(limb(0.4, 0.55, 0.2, hatMat, 0, 1.28, -0.14));
    group.add(limb(0.46, 0.3, 0.1, hatMat, 0, 1.08, 0.14));
  } else {
    group.add(limb(0.36, 0.1, 0.34, new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 1 }), 0, 1.54, 0));
  }
  if (opts.vest) {
    const vestMat = new THREE.MeshStandardMaterial({ color: 0xe87f2e, roughness: 0.8 });
    group.add(limb(0.58, 0.5, 0.32, vestMat, 0, 0.84, 0));
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.6 });
    group.add(limb(0.59, 0.07, 0.33, stripeMat, 0, 0.78, 0));
    group.add(limb(0.59, 0.07, 0.33, stripeMat, 0, 0.94, 0));
  }
  if (opts.tie) {
    group.add(limb(0.09, 0.4, 0.03, new THREE.MeshStandardMaterial({ color: 0x7a2e2e, roughness: 0.8 }), 0, 0.92, 0.16));
  }
  if (opts.apron) {
    group.add(limb(0.44, 0.5, 0.03, new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.9 }), 0, 0.72, 0.17));
  }
  if (opts.backpack) {
    group.add(limb(0.36, 0.45, 0.18, new THREE.MeshStandardMaterial({ color: opts.backpackColor ?? 0x2e5f8a, roughness: 0.85 }), 0, 0.9, -0.24));
  }
  const legL = new THREE.Group();
  legL.position.set(-0.15, 0.52, 0);
  legL.add(limb(0.22, 0.52, 0.24, pantsMat, 0, -0.26, 0));
  const legR = new THREE.Group();
  legR.position.set(0.15, 0.52, 0);
  legR.add(limb(0.22, 0.52, 0.24, pantsMat, 0, -0.26, 0));
  const armL = new THREE.Group();
  armL.position.set(-0.37, 1.06, 0);
  armL.add(limb(0.16, 0.5, 0.18, shirtMat, 0, -0.22, 0));
  const armR = new THREE.Group();
  armR.position.set(0.37, 1.06, 0);
  armR.add(limb(0.16, 0.5, 0.18, shirtMat, 0, -0.22, 0));
  group.add(legL, legR, armL, armR);
  const gun = limb(0.07, 0.12, 0.34, new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.4, metalness: 0.5 }), 0, -0.5, 0.14);
  gun.visible = false;
  armR.add(gun);
  const width = opts.width ?? 1;
  const scale = opts.scale ?? 1;
  group.scale.set(width, scale, width);
  const parts = { legL, legR, armL, armR, gun, head, torso };
  return {
    group,
    parts,
    shirtMat,
    setFlash(on) {
      torso.material = on ? flashMat : shirtMat;
    },
  };
}

function animateWalk(model, phase, amount) {
  const swing = Math.sin(phase) * 0.6 * amount;
  model.parts.legL.rotation.x = swing;
  model.parts.legR.rotation.x = -swing;
  model.parts.armL.rotation.x = -swing * 0.7;
  model.parts.armR.rotation.x = swing * 0.7;
}

// Jakarta street outfits: office, batik, ojek, guard, vendor, hijab, student,
// casual, construction. Skin tones, builds and colours all vary.
export function pickOutfit(rng) {
  const skin = rng.pick(COLORS.skin);
  const scale = rng.range(0.92, 1.08);
  const width = rng.range(0.9, 1.15);
  const roll = rng.next();
  if (roll < 0.14) return { shirt: 0xf0f0ea, pants: rng.pick([0x2e3a4d, 0x3a3a3a]), skin, tie: true, scale, width };
  if (roll < 0.28) return { pants: rng.pick(COLORS.pants), skin, batik: rng.int(0, 2), scale, width };
  if (roll < 0.38) return { shirt: COLORS.ojekGreen, pants: 0x2e3a4d, skin, hat: 'helmet', hatColor: COLORS.ojekGreen, scale, width };
  if (roll < 0.47) return { shirt: COLORS.guardBlue, pants: 0x1f2a44, skin, hat: 'cap', hatColor: COLORS.guardBlue, scale, width };
  if (roll < 0.57) return { shirt: rng.pick(COLORS.shirt), pants: rng.pick(COLORS.pants), skin, apron: true, hat: 'cap', hatColor: rng.pick(COLORS.shirt), scale, width };
  if (roll < 0.7) return { shirt: rng.pick(COLORS.shirt), pants: rng.pick(COLORS.pants), skin, hat: 'hijab', hatColor: rng.pick(COLORS.hijab), scale, width };
  if (roll < 0.8) return { shirt: 0xf0f0ea, pants: 0x5a5a5a, skin, backpack: true, backpackColor: rng.pick([0x2e5f8a, 0xc23a2e, 0x4d7c5f]), scale, width };
  if (roll < 0.9) return { shirt: rng.pick(COLORS.shirt), pants: rng.pick(COLORS.pants), skin, hat: rng.chance(0.3) ? 'cap' : null, hatColor: rng.pick(COLORS.shirt), scale, width };
  return { shirt: rng.pick(COLORS.shirt), pants: rng.pick(COLORS.pants), skin, vest: true, hat: 'hardhat', hatColor: rng.pick([0xf2c94c, 0xf0f0ea, 0xe87f2e]), scale, width };
}

// Ray against a sphere: the distance along the ray, or null for a miss.
export function rayHitSphere(origin, dir, cx, cy, cz, radius) {
  const ox = cx - origin.x;
  const oy = cy - origin.y;
  const oz = cz - origin.z;
  const tca = ox * dir.x + oy * dir.y + oz * dir.z;
  if (tca < 0) return null;
  const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
  const r2 = radius * radius;
  if (d2 > r2) return null;
  return tca - Math.sqrt(r2 - d2);
}

export class PlayerCharacter {
  constructor(scene, start) {
    // Bimo: bright orange jacket and a red cap, readable at a distance.
    this.model = makePersonModel({ shirt: 0xe87f2e, pants: 0x2e3a4d, skin: 0xa86a42, hat: 'cap', hatColor: 0xc23a2e });
    this.model.parts.gun.visible = true;
    scene.add(this.model.group);
    this.x = start.x;
    this.z = start.z;
    this.heading = start.heading;
    this.health = 100;
    this.speed = 0;
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.shotTimer = 0;
    this.ammo = ON_FOOT.magazine;
    this.reloadTimer = 0;
    this.aiming = false;
    this.dead = false;
    this.flashTimer = 0;
    this.syncMesh();
  }

  get radius() {
    return ON_FOOT.radius;
  }

  syncMesh() {
    this.model.group.position.set(this.x, 0, this.z);
    this.model.group.rotation.y = this.heading;
  }

  // moveX/moveZ: desired world-space direction (already normalised or zero).
  update(dt, moveX, moveZ, running, faceHeading, world, hooks) {
    if (this.dead) return;
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.model.setFlash(false);
    }
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo = ON_FOOT.magazine;
        if (hooks && hooks.reloaded) hooks.reloaded();
      }
    }
    const moving = moveX !== 0 || moveZ !== 0;
    const speed = moving ? (running ? ON_FOOT.runSpeed : ON_FOOT.walkSpeed) : 0;
    this.speed = speed;
    if (moving) {
      const nx = this.x + moveX * speed * dt;
      const nz = this.z + moveZ * speed * dt;
      const hit = world.collideCircle(nx, nz, this.radius);
      this.x = hit.x;
      this.z = hit.z;
      const wantHeading = Math.atan2(moveX, moveZ);
      let diff = wantHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, 12 * dt);
      this.walkPhase += speed * dt * 1.9;
    } else if (faceHeading !== null && faceHeading !== undefined) {
      let diff = faceHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, 14 * dt);
    }
    const amount = moving ? (running ? 1 : 0.7) : 0;
    animateWalk(this.model, this.walkPhase, amount);
    if (this.aiming) this.model.parts.armR.rotation.x = -Math.PI / 2 + Math.sin(this.walkPhase) * 0.05;
    this.syncMesh();
  }

  punch(targets, hooks) {
    if (this.punchTimer > 0 || this.dead) return false;
    this.punchTimer = ON_FOOT.punchCooldown;
    this.model.parts.armR.rotation.x = -1.9;
    let hitAny = false;
    for (const t of targets) {
      if (t.dead) continue;
      const dx = t.x - this.x;
      const dz = t.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist > ON_FOOT.punchRange + (t.radius || 0.5)) continue;
      const angle = Math.atan2(dx, dz);
      let diff = angle - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 1.2) continue;
      hitAny = true;
      t.knockback = { x: dx / (dist || 1), z: dz / (dist || 1), force: 5 };
      if (t.damage) t.damage(ON_FOOT.punchDamage, hooks);
    }
    if (hooks) {
      hooks.punchSwung(hitAny);
      if (hitAny && hooks.punchHit) hooks.punchHit();
    }
    return hitAny;
  }

  // Fire the pistol along `dir` from `origin`. targets: [{x,z,dead,damage,radius}].
  shoot(origin, dir, targets, hooks) {
    if (this.shotTimer > 0 || this.reloadTimer > 0 || this.dead) return null;
    if (this.ammo <= 0) {
      this.reloadTimer = ON_FOOT.reloadTime;
      if (hooks && hooks.reloadStart) hooks.reloadStart();
      return null;
    }
    this.shotTimer = ON_FOOT.shotCooldown;
    this.ammo -= 1;
    let best = null;
    let bestT = ON_FOOT.shotRange;
    for (const t of targets) {
      if (t.dead) continue;
      const hit = rayHitSphere(origin, dir, t.x, 1.0, t.z, (t.radius || 0.5) + 0.25);
      if (hit !== null && hit < bestT) {
        best = t;
        bestT = hit;
      }
    }
    const end = { x: origin.x + dir.x * bestT, y: origin.y + dir.y * bestT, z: origin.z + dir.z * bestT };
    if (best && best.damage) best.damage(ON_FOOT.shotDamage, hooks);
    if (hooks && hooks.shotFired) hooks.shotFired(origin, end, !!best);
    return { hit: best, end };
  }

  startReload(hooks) {
    if (this.ammo < ON_FOOT.magazine && this.reloadTimer <= 0) {
      this.reloadTimer = ON_FOOT.reloadTime;
      if (hooks && hooks.reloadStart) hooks.reloadStart();
    }
  }

  damage(amount, hooks) {
    if (this.dead) return;
    this.health -= amount;
    this.flashTimer = 0.12;
    this.model.setFlash(true);
    if (hooks && hooks.playerHurt) hooks.playerHurt(amount);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.model.group.rotation.x = -Math.PI / 2;
      this.model.group.position.y = 0.3;
      if (hooks && hooks.playerDown) hooks.playerDown();
    }
  }

  revive(x, z, heading) {
    this.dead = false;
    this.health = 100;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.ammo = ON_FOOT.magazine;
    this.model.group.rotation.x = 0;
    this.model.group.position.y = 0;
    this.model.setFlash(false);
    this.syncMesh();
  }

  setVisible(v) {
    this.model.group.visible = v;
  }
}

export class Pedestrian {
  constructor(scene, x, z, rng) {
    this.model = makePersonModel(pickOutfit(rng));
    scene.add(this.model.group);
    this.x = x;
    this.z = z;
    this.heading = rng.range(0, Math.PI * 2);
    this.health = 50;
    this.dead = false;
    this.state = 'wander';
    this.target = null;
    this.pauseTimer = rng.range(0, 3);
    this.downTimer = 0;
    this.fadeTimer = 0;
    this.walkPhase = rng.range(0, 6);
    this.speed = 0;
    this.knockback = null;
    this.rng = rng;
    this.syncMesh();
  }

  get radius() {
    return 0.5;
  }

  syncMesh() {
    this.model.group.position.set(this.x, this.downTimer > 0 ? 0.25 : 0, this.z);
    this.model.group.rotation.y = this.heading;
  }

  pickTarget() {
    const bx = Math.floor(this.rng.next() * BLOCKS);
    const bz = Math.floor(this.rng.next() * BLOCKS);
    const ox = -HALF + ROAD + bx * PITCH;
    const oz = -HALF + ROAD + bz * PITCH;
    const edge = Math.floor(this.rng.next() * 4);
    const along = 3 + this.rng.next() * (BLOCK - 6);
    if (edge === 0) this.target = { x: ox + along, z: oz + 1.2 };
    else if (edge === 1) this.target = { x: ox + along, z: oz + BLOCK - 1.2 };
    else if (edge === 2) this.target = { x: ox + 1.2, z: oz + along };
    else this.target = { x: ox + BLOCK - 1.2, z: oz + along };
  }

  fleeFrom(x, z) {
    if (this.dead || this.downTimer > 0) return;
    this.state = 'flee';
    const dx = this.x - x;
    const dz = this.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this.target = { x: this.x + (dx / d) * 40, z: this.z + (dz / d) * 40 };
    this.pauseTimer = 0;
  }

  damage(amount, hooks) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.fadeTimer = 4;
      this.model.group.rotation.x = -Math.PI / 2;
      this.model.group.position.y = 0.25;
      if (hooks && hooks.pedDown) hooks.pedDown(this, true);
    } else {
      this.downTimer = 1.6;
      this.model.group.rotation.x = -Math.PI / 2;
      if (hooks && hooks.pedDown) hooks.pedDown(this, false);
    }
  }

  update(dt, world, hooks) {
    if (this.dead) {
      this.fadeTimer -= dt;
      return this.fadeTimer <= 0;
    }
    if (this.knockback) {
      this.x += this.knockback.x * this.knockback.force * dt;
      this.z += this.knockback.z * this.knockback.force * dt;
      this.knockback.force *= Math.max(0, 1 - 4 * dt);
      if (this.knockback.force < 0.5) this.knockback = null;
    }
    if (this.downTimer > 0) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.model.group.rotation.x = 0;
        this.model.group.position.y = 0;
        this.state = 'flee';
        this.pickTarget();
      }
      this.syncMesh();
      return false;
    }
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      this.speed = 0;
      animateWalk(this.model, this.walkPhase, 0);
      this.syncMesh();
      return false;
    }
    if (!this.target) this.pickTarget();
    const dx = this.target.x - this.x;
    const dz = this.target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.2) {
      if (this.state === 'flee') {
        this.state = 'wander';
        this.pauseTimer = this.rng.range(0, 2);
      } else {
        this.pauseTimer = this.rng.range(1, 4);
      }
      this.target = null;
      this.speed = 0;
      animateWalk(this.model, this.walkPhase, 0);
      this.syncMesh();
      return false;
    }
    const speed = this.state === 'flee' ? 5.6 : 1.9;
    this.speed = speed;
    const nx = this.x + (dx / dist) * speed * dt;
    const nz = this.z + (dz / dist) * speed * dt;
    const hit = world.collideCircle(nx, nz, this.radius);
    this.x = hit.x;
    this.z = hit.z;
    this.heading = Math.atan2(dx, dz);
    this.walkPhase += speed * dt * 1.9;
    animateWalk(this.model, this.walkPhase, this.state === 'flee' ? 1 : 0.6);
    this.syncMesh();
    return false;
  }

  dispose(scene) {
    scene.remove(this.model.group);
  }
}

export class Enemy {
  constructor(scene, x, z, rng, home) {
    // The Kalong crew: black shirts, red caps, armed.
    this.model = makePersonModel({ shirt: 0x2a2a2e, pants: 0x2e2e33, skin: rng.pick(COLORS.skin), hat: 'cap', hatColor: 0xc23a2e });
    this.model.parts.gun.visible = true;
    scene.add(this.model.group);
    this.x = x;
    this.z = z;
    this.home = home || { x, z };
    this.heading = rng.range(0, Math.PI * 2);
    this.health = 100;
    this.maxHealth = 100;
    this.dead = false;
    this.state = 'idle';
    this.shotTimer = rng.range(0.4, 1.4);
    this.strafeDir = rng.chance(0.5) ? 1 : -1;
    this.strafeTimer = rng.range(1, 2.5);
    this.walkPhase = rng.range(0, 6);
    this.speed = 0;
    this.knockback = null;
    this.fadeTimer = 0;
    this.rng = rng;
    this.flashTimer = 0;
    this.syncMesh();
  }

  get radius() {
    return 0.5;
  }

  syncMesh() {
    this.model.group.position.set(this.x, 0, this.z);
    this.model.group.rotation.y = this.heading;
  }

  alert() {
    if (!this.dead && this.state === 'idle') this.state = 'combat';
  }

  damage(amount, hooks) {
    if (this.dead) return;
    this.health -= amount;
    this.flashTimer = 0.12;
    this.model.setFlash(true);
    this.alert();
    if (this.health <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.fadeTimer = 5;
      this.model.group.rotation.x = -Math.PI / 2;
      this.model.group.position.y = 0.25;
      this.model.setFlash(false);
      if (hooks && hooks.enemyDown) hooks.enemyDown(this);
    }
  }

  update(dt, player, world, hooks) {
    if (this.dead) {
      this.fadeTimer -= dt;
      // Sink into the ground during the last stretch so the body does not
      // pop out of view.
      if (this.fadeTimer < 1.5) this.model.group.position.y = 0.25 - (1.5 - this.fadeTimer) * 0.3;
      return this.fadeTimer <= 0;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.model.setFlash(false);
    }
    if (this.knockback) {
      this.x += this.knockback.x * this.knockback.force * dt;
      this.z += this.knockback.z * this.knockback.force * dt;
      this.knockback.force *= Math.max(0, 1 - 4 * dt);
      if (this.knockback.force < 0.5) this.knockback = null;
    }
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (this.state === 'idle') {
      if (dist < 22 && !player.inCar) this.state = 'combat';
      else {
        const hx = this.home.x - this.x;
        const hz = this.home.z - this.z;
        const hd = Math.hypot(hx, hz);
        if (hd > 3) {
          const nx = this.x + (hx / hd) * 1.4 * dt;
          const nz = this.z + (hz / hd) * 1.4 * dt;
          const hit = world.collideCircle(nx, nz, this.radius);
          this.x = hit.x;
          this.z = hit.z;
          this.heading = Math.atan2(hx, hz);
          this.walkPhase += 1.4 * dt * 1.9;
          animateWalk(this.model, this.walkPhase, 0.5);
        } else {
          animateWalk(this.model, this.walkPhase, 0);
        }
        this.syncMesh();
        return false;
      }
    }
    // Combat: keep 7-13 m from the player, strafe, shoot with spread.
    this.heading = Math.atan2(dx, dz);
    let moveX = 0;
    let moveZ = 0;
    if (dist > 13) {
      moveX = dx / dist;
      moveZ = dz / dist;
    } else if (dist < 6) {
      moveX = -dx / dist;
      moveZ = -dz / dist;
    }
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = this.rng.range(1, 2.5);
    }
    moveX += (-dz / (dist || 1)) * this.strafeDir * 0.6;
    moveZ += (dx / (dist || 1)) * this.strafeDir * 0.6;
    const len = Math.hypot(moveX, moveZ);
    if (len > 0.01) {
      const speed = 3.4;
      const nx = this.x + (moveX / len) * speed * dt;
      const nz = this.z + (moveZ / len) * speed * dt;
      const hit = world.collideCircle(nx, nz, this.radius);
      this.x = hit.x;
      this.z = hit.z;
      this.walkPhase += speed * dt * 1.9;
      animateWalk(this.model, this.walkPhase, 0.7);
    } else {
      animateWalk(this.model, this.walkPhase, 0);
    }
    this.model.parts.armR.rotation.x = -Math.PI / 2;
    this.shotTimer -= dt;
    if (this.shotTimer <= 0 && dist < 34) {
      this.shotTimer = this.rng.range(1.1, 2.0);
      const origin = { x: this.x, y: 1.35, z: this.z };
      const spread = 0.1 + dist * 0.003;
      const aim = Math.atan2(dx, dz) + (this.rng.next() - 0.5) * 2 * spread;
      const dir = { x: Math.sin(aim), y: -0.03, z: Math.cos(aim) };
      const hitT = player.inCar ? null : rayHitSphere(origin, dir, player.x, 1.0, player.z, 0.55);
      const endDist = hitT !== null ? hitT : 34;
      const end = { x: origin.x + dir.x * endDist, y: origin.y + dir.y * endDist, z: origin.z + dir.z * endDist };
      if (hooks && hooks.enemyShot) hooks.enemyShot(origin, end);
      if (hitT !== null && hooks && hooks.enemyHitPlayer) hooks.enemyHitPlayer(this.rng.range(7, 13));
    }
    this.syncMesh();
    return false;
  }

  dispose(scene) {
    scene.remove(this.model.group);
  }
}

export class PeopleManager {
  constructor(scene, world, rng, pedCount) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.peds = [];
    this.enemies = [];
    for (let i = 0; i < pedCount; i += 1) this.spawnPed();
  }

  spawnPed() {
    const ped = new Pedestrian(this.scene, 0, 0, this.rng);
    ped.pickTarget();
    ped.x = ped.target.x;
    ped.z = ped.target.z;
    ped.target = null;
    ped.syncMesh();
    this.peds.push(ped);
    return ped;
  }

  spawnEnemy(x, z, home) {
    const enemy = new Enemy(this.scene, x, z, this.rng, home);
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) e.dispose(this.scene);
    this.enemies = [];
  }

  aliveEnemies() {
    return this.enemies.filter((e) => !e.dead);
  }

  scareNearby(x, z, radius) {
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.fleeFrom(x, z);
    }
  }

  update(dt, player, hooks) {
    // Iterate over snapshots: an update can kill the player, which fails
    // the mission and replaces these arrays mid-loop. Removing by index
    // lookup keeps a stale snapshot entry from disposing twice.
    for (const ped of [...this.peds]) {
      if (ped.update(dt, this.world, hooks)) {
        const idx = this.peds.indexOf(ped);
        if (idx >= 0) {
          ped.dispose(this.scene);
          this.peds.splice(idx, 1);
          this.spawnPed();
        }
      }
    }
    for (const enemy of [...this.enemies]) {
      if (enemy.update(dt, player, this.world, hooks)) {
        const idx = this.enemies.indexOf(enemy);
        if (idx >= 0) {
          enemy.dispose(this.scene);
          this.enemies.splice(idx, 1);
        }
      }
    }
  }
}
