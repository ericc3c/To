export type TimeOfDay = 'sunset' | 'twilight' | 'day';
export type CameraPerspective = 'third' | 'first';
export type GameState = 'title' | 'playing' | 'paused';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ColliderCircle {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface InspectableLandmark {
  id: string;
  title: string;
  jpTitle: string;
  subtitle: string;
  caption: string;
  position: Vec3;
  lookAtOffset: Vec3;
  cameraZoomOffset: Vec3;
  interactRadius: number;
}

export interface LightingPreset {
  id: TimeOfDay;
  label: string;
  jpLabel: string;
  sunDirection: Vec3;
  sunColor: string;
  sunIntensity: number;
  skyTopColor: string;
  skyHorizonColor: string;
  skySunGlowColor: string;
  cloudLitColor: string;
  cloudShadowColor: string;
  cloudRimColor: string;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  fogColor: string;
  fogDensity: number;
  waterShallowColor: string;
  waterDeepColor: string;
  waterFoamColor: string;
  waterSunSpecColor: string;
  lanternEmissiveIntensity: number;
  bloomStrength: number;
  starVisibility: number;
}

export const LIGHTING_PRESETS: Record<TimeOfDay, LightingPreset> = {
  sunset: {
    id: 'sunset',
    label: 'Sunset · Golden Hour',
    jpLabel: '夕凪 · 黄昏',
    sunDirection: { x: -0.68, y: 0.26, z: -0.68 },
    sunColor: '#ff9e58',
    sunIntensity: 2.3,
    skyTopColor: '#2d5a9e',
    skyHorizonColor: '#ff9d6c',
    skySunGlowColor: '#ffe099',
    cloudLitColor: '#fff0d6',
    cloudShadowColor: '#8c6b94',
    cloudRimColor: '#ffb36b',
    hemiSkyColor: '#ffb88c',
    hemiGroundColor: '#48523e',
    hemiIntensity: 0.85,
    fogColor: '#f5a87f',
    fogDensity: 0.0048,
    waterShallowColor: '#26b0a6',
    waterDeepColor: '#124e78',
    waterFoamColor: '#ffe9d6',
    waterSunSpecColor: '#ffcf87',
    lanternEmissiveIntensity: 0.85,
    bloomStrength: 0.42,
    starVisibility: 0.15,
  },
  twilight: {
    id: 'twilight',
    label: 'Twilight · Blue Hour',
    jpLabel: '宵闇 · 青の時間',
    sunDirection: { x: -0.72, y: 0.09, z: -0.68 },
    sunColor: '#ff758f',
    sunIntensity: 0.85,
    skyTopColor: '#0f1e47',
    skyHorizonColor: '#5a4e8c',
    skySunGlowColor: '#e87a90',
    cloudLitColor: '#9fa8da',
    cloudShadowColor: '#282d54',
    cloudRimColor: '#ff8da1',
    hemiSkyColor: '#5c6bc0',
    hemiGroundColor: '#1e272e',
    hemiIntensity: 0.55,
    fogColor: '#3b3b6d',
    fogDensity: 0.0055,
    waterShallowColor: '#196f84',
    waterDeepColor: '#0b2545',
    waterFoamColor: '#b8c6db',
    waterSunSpecColor: '#ff9ebb',
    lanternEmissiveIntensity: 1.85,
    bloomStrength: 0.68,
    starVisibility: 0.92,
  },
  day: {
    id: 'day',
    label: 'High Summer · Noon',
    jpLabel: '盛夏 · 白昼',
    sunDirection: { x: -0.42, y: 0.78, z: -0.46 },
    sunColor: '#fff7e6',
    sunIntensity: 2.5,
    skyTopColor: '#0066cc',
    skyHorizonColor: '#88d4f7',
    skySunGlowColor: '#ffffff',
    cloudLitColor: '#ffffff',
    cloudShadowColor: '#8ba8c7',
    cloudRimColor: '#fffdf7',
    hemiSkyColor: '#99e2ff',
    hemiGroundColor: '#557a46',
    hemiIntensity: 0.95,
    fogColor: '#a6e1fa',
    fogDensity: 0.0035,
    waterShallowColor: '#1cd4c6',
    waterDeepColor: '#005f99',
    waterFoamColor: '#ffffff',
    waterSunSpecColor: '#ffffff',
    lanternEmissiveIntensity: 0.12,
    bloomStrength: 0.28,
    starVisibility: 0.0,
  },
};

export const TIME_CYCLE_ORDER: TimeOfDay[] = ['sunset', 'twilight', 'day'];

export function getNextTimeOfDay(current: TimeOfDay): TimeOfDay {
  const idx = TIME_CYCLE_ORDER.indexOf(current);
  if (idx === -1) return 'sunset';
  return TIME_CYCLE_ORDER[(idx + 1) % TIME_CYCLE_ORDER.length];
}

/**
 * Evaluates the centerline X coordinate of the coastal cobblestone path
 * leading from the southern harbor (z = 34) up to the northern hilltop shrine (z = -32).
 */
export function pathCenterXAtZ(z: number): number {
  const clampedZ = Math.max(-36, Math.min(38, z));
  return (
    Math.sin(clampedZ * 0.085) * 6.5 +
    Math.cos(clampedZ * 0.042 + 0.7) * 2.2 -
    1.8
  );
}

/**
 * Returns shortest planar distance from (x, z) to the cobblestone path curve.
 */
export function distanceToPath(x: number, z: number): number {
  if (z < -34 || z > 37) {
    const endZ = z < -34 ? -34 : 37;
    const endX = pathCenterXAtZ(endZ);
    return Math.hypot(x - endX, z - endZ);
  }
  const pathX = pathCenterXAtZ(z);
  return Math.abs(x - pathX);
}

/**
 * Deterministic, smooth procedural island terrain heightfield.
 * - Southern edge (z > 32) slopes gently into the Setouchi sea (y <= 0).
 * - Northern hilltop (z around -28 to -34) flattens into the Shrine terrace at y ~ 11.2m.
 * - Cobblestone path blends smoothly into the hillside so stairs/stones sit flush.
 */
export function groundHeightAt(x: number, z: number): number {
  //Wooden pier extension over the harbor water
  const pierX = pathCenterXAtZ(35);
  if (Math.abs(x - pierX) <= 2.2 && z >= 33.5 && z <= 47.0) {
    return 0.65;
  }

  // Distance from island center (slightly offset north-west for organic shape)
  const cx = x + 1.5;
  const cz = z + 4.0;
  const radialDist = Math.hypot(cx * 0.92, cz * 0.78);

  // Island outer coast falloff
  const coastFalloff = Math.max(0, 1 - Math.pow(radialDist / 50.0, 2.25));
  if (coastFalloff <= 0.001) {
    return -2.8;
  }

  // South-to-north elevation ramp (low at harbor z=34, high at shrine z=-30)
  const northNormalized = Math.max(0, Math.min(1, (34.0 - z) / 64.0));
  const hillProfile = Math.pow(northNormalized, 1.38) * 11.6;

  // Gentle organic Setouchi rolling terraces
  constUndulation =
    Math.sin(x * 0.11 + z * 0.09) * 0.65 +
    Math.cos(x * 0.07 - z * 0.12) * 0.55 +
    Math.sin(x * 0.23 + z * 0.19) * 0.18;

  let rawHeight = (hillProfile + theUndulation(x, z)) * coastFalloff - 0.35;

  // Flatten the hilltop shrine terrace around (pathCenterXAtZ(-30), -30)
  const shrineX = pathCenterXAtZ(-30);
  const distToShrine = Math.hypot(x - shrineX, z - -30);
  if (distToShrine < 12.0) {
    const shrineFlatten = Math.max(0, Math.min(1, 1 - (distToShrine - 5.5) / 6.5));
    const smoothFlat = shrineFlatten * shrineFlatten * (3 - 2 * shrineFlatten);
    const terraceHeight = 10.6;
    rawHeight = rawHeight * (1 - smoothFlat) + terraceHeight * smoothFlat;
  }

  // Flatten the harbor plaza near z = 26..34
  const harborX = pathCenterXAtZ(30);
  const distToHarbor = Math.hypot(x - harborX, z - 30);
  if (distToHarbor < 9.5) {
    const hFlat = Math.max(0, Math.min(1, 1 - (distToHarbor - 4.0) / 5.5));
    const smoothHarbor = hFlat * hFlat * (3 - 2 * hFlat);
    const plazaHeight = 0.75;
    rawHeight = rawHeight * (1 - smoothHarbor) + plazaHeight * smoothHarbor;
  }

  // Smoothly level the cross-slope across the cobblestone path
  const dPath = distanceToPath(x, z);
  if (dPath < 3.2 && z >= -31 && z <= 34) {
    const pathBlend = Math.max(0, Math.min(1, 1 - (dPath - 1.4) / 1.8));
    const smoothPath = pathBlend * pathBlend * (3 - 2 * pathBlend);
    const centerElevation =
      (Math.pow(Math.max(0, Math.min(1, (34.0 - z) / 64.0)), 1.38) * 10.6 + 0.55) *
      Math.max(0.65, coastFalloff);
    rawHeight = rawHeight * (1 - smoothPath * 0.65) + centerElevation * (smoothPath * 0.65) + smoothPath * 0.06;
  }

  return rawHeight;
}

function theUndulation(x: number, z: number): number {
  return (
    Math.sin(x * 0.11 + z * 0.09) * 0.65 +
    Math.cos(x * 0.07 - z * 0.12) * 0.55 +
    Math.sin(x * 0.23 + z * 0.19) * 0.18
  );
}

const theUndulationRef = theUndulation;
let constUndulation = 0;
void theUndulationRef;
void constUndulation;

export function createLandmarks(): InspectableLandmark[] {
  const vendingX = pathCenterXAtZ(20) - 3.6;
  const vendingZ = 20;

  const busStopX = pathCenterXAtZ(12) + 3.8;
  const busStopZ = 12;

  const toriiX = pathCenterXAtZ(3);
  const toriiZ = 3;

  const jizoX = pathCenterXAtZ(-8) - 2.9;
  const jizoZ = -8;

  const boatX = pathCenterXAtZ(35) + 4.4;
  const boatZ = 42.0;

  const shrineX = pathCenterXAtZ(-30);
  const shrineZ = -30.5;

  return [
    {
      id: 'fishing_boat',
      title: 'Moored Fishing Boat "Setouchi-maru"',
      jpTitle: 'SETOUCHI-MARU · GYOSEN',
      subtitle: 'Harbor Pier · South Cove',
      caption:
        'Salt-bleached cedar planks rock gently against the pier tires. A coiled turquoise net smells of sun-baked kelp, diesel, and the quiet promise of tomorrow’s morning tide.',
      position: { x: boatX, y: 0.25, z: boatZ },
      lookAtOffset: { x: 0, y: 0.8, z: 0 },
      cameraZoomOffset: { x: -3.2, y: 1.9, z: -2.4 },
      interactRadius: 6.2,
    },
    {
      id: 'vending_machine',
      title: 'Retro Roadside Vending Machine',
      jpTitle: 'JIDOHANBAIKI · COLD DRINKS',
      subtitle: 'Coastal Path · Lower Slope',
      caption:
        'Beneath a sun-rusted corrugated tin awning, the red-and-white jidohanbaiki hums a low, comforting 60-hertz lullaby. Condensation beads behind the glass next to chilled cans of melon soda and citrus coffee.',
      position: {
        x: vendingX,
        y: groundHeightAt(vendingX, vendingZ),
        z: vendingZ,
      },
      lookAtOffset: { x: 0, y: 1.25, z: 0 },
      cameraZoomOffset: { x: 2.8, y: 1.5, z: 2.2 },
      interactRadius: 4.8,
    },
    {
      id: 'bus_stop',
      title: 'Countryside Wooden Bus Stop',
      jpTitle: 'SHIOKAZE TEIRYUJO · BUS STOP',
      subtitle: 'Coastal Path · Mid-Slope',
      caption:
        'Only three buses pass this way each day. On the sun-warmed cedar bench, someone left a hand-drawn timetable and a pressed hydrangea petal tucked beneath a smooth sea stone.',
      position: {
        x: busStopX,
        y: groundHeightAt(busStopX, busStopZ),
        z: busStopZ,
      },
      lookAtOffset: { x: 0, y: 1.3, z: 0 },
      cameraZoomOffset: { x: -2.9, y: 1.6, z: 2.1 },
      interactRadius: 4.8,
    },
    {
      id: 'torii_gate',
      title: 'Weathered Vermilion Torii Gate',
      jpTitle: 'SHIOMIZAKA · MYOJIN TORII',
      subtitle: 'Sacred Threshold · Mid-Hill',
      caption:
        'Faded cinnabar lacquer peels in delicate flakes where sea breezes meet the cedar grove. Stepping beneath the kasagi lintel, the cicadas’ chorus softens into the hush of the sanctuary trail.',
      position: {
        x: toriiX,
        y: groundHeightAt(toriiX, toriiZ),
        z: toriiZ,
      },
      lookAtOffset: { x: 0, y: 2.6, z: 0 },
      cameraZoomOffset: { x: 0.4, y: 2.1, z: 4.8 },
      interactRadius: 5.2,
    },
    {
      id: 'jizo_statue',
      title: 'Mossy Stone Jizo with Red Bibs',
      jpTitle: 'OJIZO-SAMA · WAYSIDE GUARDIAN',
      subtitle: 'Cedar Trail · Upper Slope',
      caption:
        'Carved from soft Setouchi granite, the little guardian wears a hand-sewn vermilion bib faded by August sun. Three small white pebbles rest neatly upon its head, left by travelers wishing for safe passage.',
      position: {
        x: jizoX,
        y: groundHeightAt(jizoX, jizoZ),
        z: jizoZ,
      },
      lookAtOffset: { x: 0, y: 0.95, z: 0 },
      cameraZoomOffset: { x: 2.1, y: 1.35, z: 1.9 },
      interactRadius: 4.5,
    },
    {
      id: 'hilltop_shrine',
      title: 'Misaki Hilltop Shinto Shrine',
      jpTitle: 'MISAKI JINJA & FURIN CHIME',
      subtitle: 'Summit Sanctuary · North Overlook',
      caption:
        'High above the shimmering inland sea, a glass furin wind chime dances under the cypress eaves. Each clear ring scatters across the golden water toward distant island silhouettes.',
      position: {
        x: shrineX,
        y: groundHeightAt(shrineX, shrineZ),
        z: shrineZ,
      },
      lookAtOffset: { x: 0, y: 2.2, z: 0 },
      cameraZoomOffset: { x: 0, y: 2.1, z: 5.8 },
      interactRadius: 6.8,
    },
  ];
}

/**
 * Finds the closest inspectable landmark within its interaction radius.
 */
export function findNearestLandmark(
  playerPos: Vec3,
  landmarks: InspectableLandmark[]
): InspectableLandmark | null {
  let closest: InspectableLandmark | null = null;
  let bestDist = Infinity;

  for (const lm of landmarks) {
    const dx = playerPos.x - lm.position.x;
    const dz = playerPos.z - lm.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= lm.interactRadius && dist < bestDist) {
      bestDist = dist;
      closest = lm;
    }
  }
  return closest;
}

/**
 * Resolves player movement against circular prop colliders, shoreline water depth,
 * and island perimeter bounds so the player never walks off the world or clips through props.
 */
export function resolvePlayerMovement(
  current: Vec2,
  desired: Vec2,
  colliders: ColliderCircle[],
  playerRadius = 0.45
): Vec3 {
  let nextX = desired.x;
  let nextZ = desired.z;

  // Clamp outer world radius
  const maxWorldRadius = 46.5;
  const distFromOrigin = Math.hypot(nextX, nextZ);
  if (distFromOrigin > maxWorldRadius && nextZ < 33.5) {
    const scale = maxWorldRadius / distFromOrigin;
    nextX *= scale;
    nextZ *= scale;
  }

  // Push out of circular prop colliders
  for (const col of colliders) {
    const dx = nextX - col.x;
    const dz = nextZ - col.z;
    const dist = Math.hypot(dx, dz);
    const minDist = col.radius + playerRadius;
    if (dist < minDist) {
      if (dist > 0.0001) {
        const push = (minDist - dist) / dist;
        nextX += dx * push;
        nextZ += dz * push;
      } else {
        nextX += minDist;
      }
    }
  }

  // Prevent walking into deep ocean water (except when on the wooden pier)
  const nextY = groundHeightAt(nextX, nextZ);
  if (nextY < -0.15) {
    // Allow sliding along shoreline if one axis is valid
    const slideXHeight = groundHeightAt(nextX, current.z);
    const slideZHeight = groundHeightAt(current.x, nextZ);
    if (slideXHeight >= -0.15) {
      nextZ = current.z;
    } else if (slideZHeight >= -0.15) {
      nextX = current.x;
    } else {
      nextX = current.x;
      nextZ = current.z;
    }
  }

  const finalY = Math.max(-0.15, groundHeightAt(nextX, nextZ));
  return { x: nextX, y: finalY, z: nextZ };
}

/**
 * Frame-rate independent exponential damping helper.
 */
export function dampValue(
  current: number,
  target: number,
  lambda: number,
  dt: number
): number {
  return current + (target - current) * (1 - Math.exp(-lambda * Math.max(0, dt)));
}
