import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextTimeOfDay,
  pathCenterXAtZ,
  distanceToPath,
  groundHeightAt,
  createLandmarks,
  findNearestLandmark,
  resolvePlayerMovement,
  dampValue,
  LIGHTING_PRESETS,
} from './islandLogic';

test('getNextTimeOfDay cycles through sunset -> twilight -> day -> sunset', () => {
  assert.equal(getNextTimeOfDay('sunset'), 'twilight');
  assert.equal(getNextTimeOfDay('twilight'), 'day');
  assert.equal(getNextTimeOfDay('day'), 'sunset');
});

test('lighting presets include distinct sun intensities, fog colors, and lantern glow', () => {
  assert.ok(LIGHTING_PRESETS.twilight.lanternEmissiveIntensity > LIGHTING_PRESETS.day.lanternEmissiveIntensity);
  assert.ok(LIGHTING_PRESETS.day.sunIntensity > LIGHTING_PRESETS.twilight.sunIntensity);
  assert.notEqual(LIGHTING_PRESETS.sunset.fogColor, LIGHTING_PRESETS.twilight.fogColor);
});

test('terrain elevation rises from harbor pier at south to hilltop shrine at north', () => {
  const pierX = pathCenterXAtZ(35);
  const pierHeight = groundHeightAt(pierX, 40);
  assert.equal(pierHeight, 0.65);

  const harborHeight = groundHeightAt(pathCenterXAtZ(30), 30);
  const shrineHeight = groundHeightAt(pathCenterXAtZ(-30), -30);
  assert.ok(shrineHeight > harborHeight + 7.0, `Expected shrine (${shrineHeight}) > harbor (${harborHeight}) + 7`);
  assert.equal(distanceToPath(pathCenterXAtZ(10), 10), 0);
});

test('findNearestLandmark detects landmarks within interaction radius and returns null when far', () => {
  const landmarks = createLandmarks();
  assert.equal(landmarks.length, 6);

  const vending = landmarks.find((l) => l.id === 'vending_machine')!;
  const detected = findNearestLandmark(
    { x: vending.position.x + 1.2, y: vending.position.y, z: vending.position.z - 1.0 },
    landmarks
  );
  assert.ok(detected);
  assert.equal(detected.id, 'vending_machine');

  const farResult = findNearestLandmark({ x: 999, y: 0, z: 999 }, landmarks);
  assert.equal(farResult, null);
});

test('resolvePlayerMovement prevents clipping through circular colliders and deep water', () => {
  const colliders = [{ id: 'test_pillar', x: 0, y: 0, z: 10, radius: 1.5 }];
  const resolved = resolvePlayerMovement(
    { x: 0, z: 13 },
    { x: 0, z: 10.5 },
    colliders,
    0.5
  );
  const distToCollider = Math.hypot(resolved.x - 0, resolved.z - 10);
  assert.ok(distToCollider >= 1.99, `Expected player to be pushed outside radius 2.0, got ${distToCollider}`);

  // Deep ocean check far off coast
  const safeStart = { x: pathCenterXAtZ(30), z: 30 };
  const deepOceanAttempt = { x: 42, z: 42 };
  const waterResolved = resolvePlayerMovement(safeStart, deepOceanAttempt, [], 0.45);
  assert.ok(waterResolved.y >= -0.15, `Expected player to stay above deep water, got y=${waterResolved.y}`);
});

test('dampValue smoothly interpolates toward target value', () => {
  const half = dampValue(0, 10, 8, 0.1);
  assert.ok(half > 4 && half < 7);
  assert.equal(dampValue(5, 5, 10, 0.016), 5);
});
