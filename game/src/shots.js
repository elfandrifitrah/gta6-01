// Screenshot staging behind ?shot=start|play|end|vista. Written in this session.
import { CFG } from './config.js';

export function stageShot(name, G) {
  const p = CFG.places;
  if (name === 'start') {
    // Wanted chase on Jl. Sudirman, four stars.
    G.screen = 'play';
    G.wanted = 4;
    G.player.x = -2; G.player.z = -30; G.player.angle = 0;
    const car = G.vehicles.spawnMissionCar(-2, -26, 0xd32f2f, 'sedan');
    car.health = 100; car.driven = true; car.speed = 12;
    G.playerCar = car; G.player.mesh.visible = false;
    for (let i = 0; i < 3; i++) {
      const v = G.vehicles.spawnMissionCar(-8 + i * 6, -16 + i * 8, 0x1a237e, 'police');
      v.health = 100; v.driven = true; // staged static pursuit cars, clear of the collision pass
    }
    G.shotCam = null;
    G.announce('Wanted: 4 stars. Lose the police.');
    return;
  }
  if (name === 'play') {
    // Kopor Hilang combat at the warehouse yard.
    G.screen = 'play';
    G.missions.M.index = 1;
    G.missions.start();
    G.player.x = p.warehouse[0] - 8; G.player.z = p.warehouse[1] + 10; G.player.angle = Math.PI;
    G.ammo = 12;
    G.announce('Kopor Hilang: defeat the rivals.');
    return;
  }
  if (name === 'end') {
    // Title screen over the monument square.
    G.screen = 'title';
    G.player.x = p.monument[0]; G.player.z = p.monument[1] + 18; G.player.angle = Math.PI;
    G.shotCam = { x: -20, y: 7, z: 30, lookX: -20, lookY: 9, lookZ: -20, yaw: 0 };
    return;
  }
  // vista: monument, plaza, flags, corridor, busway, towers, bay, live HUD and minimap.
  G.screen = 'play';
  G.wanted = 1;
  G.player.x = p.monument[0]; G.player.z = p.monument[1] + 16; G.player.angle = 0;
  G.shotCam = { x: -48, y: 48, z: 26, lookX: 5, lookY: 0, lookZ: -75, yaw: 0 };
  G.announce('Jakarta, 2026. Golden hour.');
}
