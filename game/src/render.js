// Renderer and follow camera. Written in this session.
import * as THREE from 'three';
import { clamp, angleLerp } from './random.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
  const projected = new THREE.Vector3();
  let camYaw = 0;
  let camDist = 15;
  let camPitch = 0.55;
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  function update(G, dt, input) {
    if (input.rightDrag) camYaw -= input.mouseDX * 0.005;
    if (input.down('KeyQ')) camYaw += dt * 2.2;
    camDist = clamp(camDist + input.wheel * 0.01, 8, 26);
    const focus = G.playerCar || G.player;
    const targetYaw = G.shotCam ? G.shotCam.yaw : (focus.angle + Math.PI);
    if (!G.shotCam) camYaw = angleLerp(camYaw, targetYaw, Math.min(1, dt * 2.5));
    let cx, cy, cz, lx, ly, lz;
    if (G.shotCam) {
      const s = G.shotCam;
      camera.position.set(s.x, s.y, s.z);
      camera.lookAt(s.lookX, s.lookY, s.lookZ);
      return;
    }
    const spd = G.playerCar ? Math.abs(G.playerCar.speed || 0) : 0;
    const fov = 62 + clamp(spd / 36, 0, 1) * 12;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = camera.fov + (fov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }
    const fx = focus.x, fz = focus.z;
    const lead = G.playerCar ? clamp(G.playerCar.speed / 28, -0.4, 1) * 5 : 0;
    cx = fx - Math.sin(camYaw) * camDist;
    cz = fz - Math.cos(camYaw) * camDist;
    cy = 7 + camDist * 0.35;
    lx = fx + Math.sin(focus.angle) * lead;
    ly = 1.5;
    lz = fz + Math.cos(focus.angle) * lead;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 6);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 6);
    if (G.shake > 0) {
      const k = G.shake * 0.45;
      camera.position.x += (Math.random() - 0.5) * k;
      camera.position.y += (Math.random() - 0.5) * k * 0.6;
      G.shake = Math.max(0, G.shake - dt * 1.8);
    }
    camera.lookAt(lx, ly, lz);
  }
  function project(x, y, z) {
    projected.set(x, y, z).project(camera);
    const W = window.innerWidth, H = window.innerHeight;
    return {
      x: (projected.x * 0.5 + 0.5) * W,
      y: (-projected.y * 0.5 + 0.5) * H,
      behind: projected.z > 1,
    };
  }
  function render(scene) { renderer.render(scene, camera); }
  return { renderer, camera, update, render, project, get camYaw() { return camYaw; }, setCamYaw(v) { camYaw = v; } };
}
