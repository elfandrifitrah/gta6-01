// Screenshot staging behind ?shot=<name>. Each shot drives the real game
// into an interesting state through the same APIs a player uses — entering
// a car, raising heat, starting a mission — then frames a fixed camera.
// Nothing is faked: the traffic, police, enemies and HUD are all live, and
// the capture script waits for window.__shotReady before shooting the frame.
import { Car } from './vehicles.js';

// title: the title screen over a slow orbit of the monument square.
function stageTitle(game) {
  game.titleAngle = 0.8;
}

// chase: Bimo fleeing north up Jl. Sudirman in a red coupe, four stars.
// A fixed camera north of the action looks south: the coupe approaches
// head-on with two pursuers closing behind it, towers and the busway
// framing the corridor.
function stageChase(game) {
  // Head-on pursuit: the camera sits north of the action looking south
  // down Jl. Sudirman (yaw PI puts the camera on the north side). The
  // player coasts north from speed 18 and lands near the camera target.
  // The patrol cars are staged as static pursuit cars on the busway lane
  // just behind the coupe, so the AI cannot rear-end it during the
  // warmup and stall the formation out of frame. Their light bars are
  // frozen mid-flash, one red and one blue.
  const car = new Car(game.scene, {
    x: 21.8, z: 67, heading: Math.PI, color: 0xc23a2e, kind: 'coupe', driver: null, owned: true,
  });
  game.addCar(car);
  game.enterCar(car);
  car.speed = 18;
  game.setHeat(68);
  const bars = [0.2, 0.55];
  // East in the busway lane: 5+ m clear of the coupe's path, so the
  // pairwise collision pass never shoves the rolling coupe.
  [[27, 52], [28, 58]].forEach(([x, z], i) => {
    const cop = new Car(game.scene, {
      x, z, heading: Math.PI, color: 0x1f3a6e, kind: 'sedan', driver: 'police', police: true,
    });
    cop.sirenPhase = bars[i];
    cop.syncMesh();
    game.addCar(cop);
  });
  game.shotCamera = {
    target: { x: 22, y: 2, z: 45 },
    yaw: Math.PI,
    pitch: -0.16,
    distance: 20,
  };
  game.hud.message('Four stars. Lose the police on Jl. Sudirman.', 6);
}

// fight: the Kopor Hilang job at the warehouse yard, mid-gunfight. The
// mission starts honestly (Macet Total is marked done first), Bimo walks
// into the yard, and the Kalongs open fire.
function stageFight(game) {
  game.missions.applySave(['macet'], false);
  game.missions.startAvailable();
  game.teleportPlayer(104, 20, Math.PI);
  game.shotCamera = {
    target: { x: 104, y: 1.6, z: 12 },
    yaw: 0.32,
    pitch: -0.12,
    distance: 19,
  };
}

// vista: a high camera south of the square looking north: the whole
// monument and plaza in the foreground, the roundabout and the skyscraper
// corridor behind it, with the HUD and minimap visible.
function stageVista(game) {
  game.teleportPlayer(0, 18, Math.PI * 0.75);
  game.shotCamera = {
    target: { x: -5, y: 18, z: -5 },
    yaw: 2.6,
    pitch: -0.42,
    distance: 75,
  };
  game.hud.message('Jakarta, golden hour. The debt is $5,000. The city is open.', 6);
}

export function stageShot(game, name) {
  if (name === 'title') stageTitle(game);
  else if (name === 'chase') stageChase(game);
  else if (name === 'fight') stageFight(game);
  else if (name === 'vista') stageVista(game);
  else stageVista(game);
  return name;
}
