// Presentation: the WebGL renderer, the third-person camera rig with screen
// shake, and the pooled particle effects (smoke, dust, exhaust, sparks,
// muzzle flash and tracers). Nothing here knows the rules; the game hands it
// a target to follow and events to show.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  resize();
  window.addEventListener('resize', resize);
  return { renderer, resize };
}

// Smooth chase camera: orbits with right-drag, zooms with the wheel, eases
// behind the car while driving, and shakes on impacts.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = -0.24;
    this.distance = 8;
    this.targetDistance = 8;
    this.trauma = 0;
    this.fov = 62;
    this.current = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.started = false;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  snapTo(target, heading) {
    this.yaw = heading + Math.PI;
    this.started = false;
  }

  update(dt, target, heading, driving, speedNorm, input) {
    if (input.dragDX !== 0 || input.dragDY !== 0) {
      this.yaw -= input.dragDX * 0.0045;
      this.pitch -= input.dragDY * 0.003;
    }
    if (input.down('KeyQ')) this.yaw += 1.9 * dt;
    if (input.wheelDelta !== 0) {
      this.targetDistance = Math.max(4, Math.min(16, this.targetDistance + input.wheelDelta * 0.008));
    }
    this.pitch = Math.max(-0.9, Math.min(0.35, this.pitch));
    if (driving) {
      // Ease behind the car, but never fight an active drag.
      if (input.dragDX === 0) {
        const behind = heading + Math.PI;
        let diff = behind - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, 1.6 * dt);
      }
      this.targetDistance += ((10.5 - this.targetDistance) * Math.min(1, 2 * dt));
    } else {
      this.targetDistance += ((7.5 - this.targetDistance) * Math.min(1, 2 * dt));
    }
    this.distance += (this.targetDistance - this.distance) * Math.min(1, 6 * dt);

    const pivot = new THREE.Vector3(target.x, target.y, target.z);
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ).multiplyScalar(this.distance);
    const desired = pivot.clone().add(off);
    if (desired.y < 0.7) desired.y = 0.7;
    if (!this.started) {
      this.current.copy(desired);
      this.look.copy(pivot);
      this.started = true;
    } else {
      const k = Math.min(1, 11 * dt);
      this.current.lerp(desired, k);
      this.look.lerp(pivot, Math.min(1, 14 * dt));
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const shakeAmt = this.trauma * this.trauma * 0.55;
    const sx = (Math.random() - 0.5) * shakeAmt;
    const sy = (Math.random() - 0.5) * shakeAmt;
    const sz = (Math.random() - 0.5) * shakeAmt;
    this.camera.position.set(this.current.x + sx, this.current.y + sy, this.current.z + sz);
    this.camera.lookAt(this.look);
    const targetFov = driving ? 62 + speedNorm * 10 : 62;
    this.fov += (targetFov - this.fov) * Math.min(1, 4 * dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

function glowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One pool of sprites reused for every puff, spark and flash in the game.
export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.softTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.hardTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.15)');
    for (let i = 0; i < 140; i += 1) {
      const mat = new THREE.SpriteMaterial({ map: this.softTex, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 0, gravity: 0, startOpacity: 0, startSize: 1 });
    }
    this.cursor = 0;
    // Tracer pool: short additive boxes stretched between two points.
    this.tracers = [];
    const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
    for (let i = 0; i < 10; i += 1) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    this.tracerCursor = 0;
    // One reusable flash light for muzzle flashes.
    this.flashLight = new THREE.PointLight(0xffc46b, 0, 18, 2);
    scene.add(this.flashLight);
    this.flashTimer = 0;
  }

  spawn(x, y, z, opts) {
    const count = opts.count || 1;
    for (let n = 0; n < count; n += 1) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      p.sprite.visible = true;
      p.sprite.position.set(
        x + (Math.random() - 0.5) * (opts.spread || 0.3),
        y + (Math.random() - 0.5) * (opts.spread || 0.3),
        z + (Math.random() - 0.5) * (opts.spread || 0.3),
      );
      const speed = opts.speed || 1;
      p.vx = (Math.random() - 0.5) * speed + (opts.vx || 0);
      p.vy = Math.random() * speed * 0.7 + (opts.vy || 0);
      p.vz = (Math.random() - 0.5) * speed + (opts.vz || 0);
      p.maxLife = opts.life || 0.7;
      p.life = p.maxLife;
      p.grow = opts.grow || 0;
      p.gravity = opts.gravity || 0;
      p.startOpacity = opts.opacity || 0.6;
      p.startSize = (opts.size || 0.5) * (0.7 + Math.random() * 0.6);
      p.sprite.scale.setScalar(p.startSize);
      p.sprite.material.color.setHex(opts.color || 0xcccccc);
      p.sprite.material.opacity = p.startOpacity;
      p.sprite.material.blending = opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.sprite.material.map = opts.additive ? this.hardTex : this.softTex;
      p.sprite.material.needsUpdate = false;
    }
  }

  smoke(x, y, z, strength) {
    this.spawn(x, y, z, { count: 2, color: 0x555550, size: 0.7 * strength, life: 1.1, speed: 1.2, vy: 1.4, grow: 1.6, opacity: 0.5, spread: 0.5 });
  }

  dust(x, y, z) {
    this.spawn(x, y, z, { count: 3, color: 0xc9b083, size: 0.55, life: 0.7, speed: 2.2, vy: 0.4, grow: 1.8, opacity: 0.45, spread: 0.8 });
  }

  exhaust(x, y, z, heading) {
    this.spawn(x - Math.sin(heading) * 2.1, y, z - Math.cos(heading) * 2.1, {
      count: 1, color: 0x777777, size: 0.28, life: 0.55, speed: 0.5, vy: 0.7, grow: 1.4, opacity: 0.35, spread: 0.15,
      vx: -Math.sin(heading) * 1.2, vz: -Math.cos(heading) * 1.2,
    });
  }

  sparks(x, y, z) {
    this.spawn(x, y, z, { count: 8, color: 0xffd98a, size: 0.16, life: 0.4, speed: 5, gravity: -9, opacity: 0.95, additive: true, spread: 0.3 });
  }

  bloodPuff(x, y, z) {
    this.spawn(x, y, z, { count: 4, color: 0xa32a22, size: 0.22, life: 0.45, speed: 2.4, gravity: -5, opacity: 0.8, spread: 0.25 });
  }

  muzzle(x, y, z, dir) {
    this.spawn(x, y, z, { count: 1, color: 0xffd98a, size: 0.85, life: 0.07, speed: 0, opacity: 0.95, additive: true });
    this.spawn(x + dir.x * 0.4, y + dir.y * 0.4, z + dir.z * 0.4, { count: 2, color: 0xff9a3c, size: 0.4, life: 0.09, speed: 1, opacity: 0.8, additive: true });
    this.flashLight.position.set(x, y, z);
    this.flashLight.intensity = 26;
    this.flashTimer = 0.06;
  }

  tracer(from, to) {
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    const mesh = t.mesh;
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.scale.set(1, 1, Math.max(0.1, a.distanceTo(b)));
    mesh.lookAt(b);
    mesh.visible = true;
    mesh.material.opacity = 0.85;
    t.life = 0.07;
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const age = 1 - p.life / p.maxLife;
      p.sprite.scale.setScalar(p.startSize * (1 + p.grow * age));
      p.sprite.material.opacity = p.startOpacity * (1 - age);
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
      else t.mesh.material.opacity = (t.life / 0.07) * 0.85;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flashLight.intensity = 0;
    }
  }
}
