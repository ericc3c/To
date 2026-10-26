import * as THREE from 'three';
import {
  ColliderCircle,
  distanceToPath,
  groundHeightAt,
  pathCenterXAtZ,
} from './islandLogic';
import {
  SharedUniforms,
  createCobblestonePathMaterial,
  createGrassShaderMaterial,
  createPainterlyToonMaterial,
} from './shaders';

export interface AnimatedSceneRefs {
  fishingBoat: THREE.Group;
  furinPendulum: THREE.Group;
  pollenPoints: THREE.Points;
  lanternPointLights: THREE.PointLight[];
  traveler: {
    root: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    hat: THREE.Group;
  };
}

/**
 * Generates procedural CanvasTextures for cobblestone, wood grain, and rusted tin.
 */
function createProceduralCobbleTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7e786d';
  ctx.fillRect(0, 0, 256, 256);

  // Draw organic rounded cobblestones with mossy mortar seams
  const rows = 8;
  const cols = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = ((c + (r % 2) * 0.5) / cols) * 256;
      const cy = ((r + 0.5) / rows) * 256;
      const rx = 16 + ((r * 7 + c * 13) % 6);
      const ry = 11 + ((r * 11 + c * 5) % 4);

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, ((r + c) % 3) * 0.12, 0, Math.PI * 2);
      const shade = 148 + ((r * 19 + c * 23) % 42);
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 12})`;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#555c4b';
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Builds the Setouchi Island terrain mesh and coastal cobblestone path mesh.
 */
export function buildIslandTerrainAndPath(
  scene: THREE.Scene,
  shared: SharedUniforms,
  maxAnisotropy: number
): void {
  // 1. Sculpted Island Terrain with vertex colors (sandy shore -> lush Ghibli grass -> mossy rock)
  const segs = 110;
  const size = 108;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const colSand = new THREE.Color('#e6d2a8');
  const colGrassLow = new THREE.Color('#43873e');
  const colGrassHigh = new THREE.Color('#64ab44');
  const colPathVerge = new THREE.Color('#827c68');
  const colSlopeRock = new THREE.Color('#63695e');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = groundHeightAt(x, z);
    posAttr.setY(i, y);

    const dPath = distanceToPath(x, z);
    if (y < 0.42) {
      tmpCol.copy(colSand);
    } else if (dPath < 2.1 && z >= -31 && z <= 34) {
      const t = Math.max(0, Math.min(1, (dPath - 1.1) / 1.0));
      tmpCol.copy(colPathVerge).lerp(colGrassLow, t);
    } else {
      const hNorm = Math.max(0, Math.min(1, y / 11.0));
      tmpCol.copy(colGrassLow).lerp(colGrassHigh, hNorm * 0.75);
      if (Math.abs(x) > 18 && y > 2.5) {
        tmpCol.lerp(colSlopeRock, 0.35);
      }
    }

    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrainMat = createPainterlyToonMaterial(shared, {
    color: '#ffffff',
    shadowTint: '#465469',
    useVertexColors: true,
    brushScale: 2.2,
    brushStrength: 0.1,
    komorebiStrength: 0.48,
    rimStrength: 0.22,
  });

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  scene.add(terrainMesh);

  // 2. Coastal Cobblestone Path ribbon following the hill up to the shrine
  const lengthSegs = 120;
  const widthSegs = 6;
  const pathGeo = new THREE.PlaneGeometry(2.5, 65.5, widthSegs, lengthSegs);
  pathGeo.rotateX(-Math.PI / 2);

  const pPos = pathGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    const localX = pPos.getX(i);
    const localZ = pPos.getZ(i);
    const worldZ = localZ + 1.25;
    const centerX = pathCenterXAtZ(worldZ);
    const worldX = centerX + localX;
    const edgeDrop = Math.pow(Math.abs(localX) / 1.25, 2.0) * 0.04;
    const worldY = groundHeightAt(worldX, worldZ) + 0.045 - edgeDrop;

    pPos.setXYZ(i, worldX, worldY, worldZ);
  }
  pathGeo.computeVertexNormals();

  const cobbleTex = createProceduralCobbleTexture(maxAnisotropy);
  const pathMat = createCobblestonePathMaterial(shared, cobbleTex);

  const pathMesh = new THREE.Mesh(pathGeo, pathMat);
  pathMesh.receiveShadow = true;
  scene.add(pathMesh);
}

/**
 * 1. Concrete Coastal Tetrapod (4-legged tetrahedral wave-breaker)
 */
function createTetrapod(shared: SharedUniforms): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = createPainterlyToonMaterial(shared, {
    color: '#c9c5ba',
    shadowTint: '#6e757a',
    brushScale: 6.0,
    brushStrength: 0.1,
  });
  const wetBaseMat = createPainterlyToonMaterial(shared, {
    color: '#5a6650',
    shadowTint: '#343d31',
    brushScale: 7.0,
    brushStrength: 0.12,
  });

  const legGeo = new THREE.CylinderGeometry(0.22, 0.36, 1.15, 8);
  legGeo.translate(0, 0.45, 0);

  // 1 vertical leg + 3 downward tripod legs at 109.5 deg tetrahedral angles
  const topLeg = new THREE.Mesh(legGeo, concreteMat);
  topLeg.position.y = 0.55;
  topLeg.castShadow = true;
  topLeg.receiveShadow = true;
  group.add(topLeg);

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const leg = new THREE.Mesh(legGeo, i === 0 ? wetBaseMat : concreteMat);
    leg.position.set(0, 0.62, 0);
    leg.rotation.y = angle;
    leg.rotation.z = 1.91; // ~109.5 degrees from top axis
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  }

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), concreteMat);
  hub.position.y = 0.62;
  group.add(hub);

  return group;
}

/**
 * 2. Wooden Harbor Pier
 */
function createWoodenPier(shared: SharedUniforms): THREE.Group {
  const group = new THREE.Group();
  const timberMat = createPainterlyToonMaterial(shared, {
    color: '#8c6747',
    shadowTint: '#4a3525',
    brushScale: 5.0,
    brushStrength: 0.1,
  });
  const darkPileMat = createPainterlyToonMaterial(shared, {
    color: '#4f3b2b',
    shadowTint: '#261d16',
  });
  const ironMat = createPainterlyToonMaterial(shared, {
    color: '#383d42',
    shadowTint: '#1c1f24',
  });

  // 10 Support pilings driven into the seabed
  const pileGeo = new THREE.CylinderGeometry(0.16, 0.18, 2.4, 8);
  for (let z = 34.5; z <= 46.5; z += 3.0) {
    for (const side of [-1.75, 1.75]) {
      const pile = new THREE.Mesh(pileGeo, darkPileMat);
      pile.position.set(side, -0.35, z - 34.0);
      pile.castShadow = true;
      group.add(pile);
    }
  }

  // Longitudinal stringer beams
  const beamGeo = new THREE.BoxGeometry(0.24, 0.26, 13.8);
  for (const side of [-1.6, 0, 1.6]) {
    const beam = new THREE.Mesh(beamGeo, darkPileMat);
    beam.position.set(side, 0.46, 6.5);
    group.add(beam);
  }

  // Individual weathered deck planks
  const plankGeo = new THREE.BoxGeometry(4.2, 0.1, 0.42);
  for (let i = 0; i < 28; i++) {
    const plank = new THREE.Mesh(plankGeo, timberMat);
    plank.position.set(
      ((i % 3) - 1) * 0.02,
      0.62 + ((i * 7) % 3) * 0.005,
      i * 0.48
    );
    plank.receiveShadow = true;
    plank.castShadow = true;
    group.add(plank);
  }

  // Mooring bollards & coiled rope
  const bollardGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.42, 8);
  const bollardCapGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 8);
  for (const bz of [3.5, 9.5, 12.6]) {
    const bollard = new THREE.Mesh(bollardGeo, ironMat);
    bollard.position.set(1.8, 0.85, bz);
    const cap = new THREE.Mesh(bollardCapGeo, ironMat);
    cap.position.set(1.8, 1.08, bz);
    group.add(bollard, cap);
  }

  const ropeMat = createPainterlyToonMaterial(shared, {
    color: '#d4b886',
    shadowTint: '#8a724a',
  });
  const ropeTorus = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 16), ropeMat);
  ropeTorus.rotation.x = Math.PI / 2;
  ropeTorus.position.set(1.45, 0.71, 9.5);
  group.add(ropeTorus);

  return group;
}

/**
 * 3. Small Moored Setouchi Fishing Boat (8 distinct parts)
 */
function createFishingBoat(shared: SharedUniforms): THREE.Group {
  const boat = new THREE.Group();

  const hullWhiteMat = createPainterlyToonMaterial(shared, {
    color: '#f4efe6',
    shadowTint: '#99a8b8',
  });
  const hullTurquoiseMat = createPainterlyToonMaterial(shared, {
    color: '#1b8a99',
    shadowTint: '#0d4a59',
  });
  const woodDeckMat = createPainterlyToonMaterial(shared, {
    color: '#b88658',
    shadowTint: '#6e4c2e',
  });
  const windowGlowMat = createPainterlyToonMaterial(shared, {
    color: '#3a4f63',
    emissiveColor: '#ffbe6b',
    emissiveFactor: 0.75,
  });
  const lifebuoyMat = createPainterlyToonMaterial(shared, {
    color: '#e85338',
    shadowTint: '#8f2818',
  });
  const darkMetalMat = createPainterlyToonMaterial(shared, {
    color: '#2c333a',
    shadowTint: '#14181c',
  });

  // 1. Extruded boat hull shape
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.15, -2.2);
  hullShape.lineTo(1.15, -2.2);
  hullShape.quadraticCurveTo(1.35, 0.4, 0.85, 1.8);
  hullShape.lineTo(0, 2.65);
  hullShape.lineTo(-0.85, 1.8);
  hullShape.quadraticCurveTo(-1.35, 0.4, -1.15, -2.2);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.75,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.14,
  });
  hullGeo.rotateX(Math.PI / 2);
  const hullMesh = new THREE.Mesh(hullGeo, hullWhiteMat);
  hullMesh.position.y = 0.65;
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  boat.add(hullMesh);

  // 2. Turquoise waterline stripe & keel
  const keelMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 4.3), hullTurquoiseMat);
  keelMesh.position.set(0, 0.08, 0.05);
  boat.add(keelMesh);

  // 3. Wooden recessed deck
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.12, 3.8), woodDeckMat);
  deckMesh.position.set(0, 0.72, 0.0);
  boat.add(deckMesh);

  // 4. Wheelhouse cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.15, 1.45), hullWhiteMat);
  cabin.position.set(0, 1.32, -0.25);
  cabin.castShadow = true;
  boat.add(cabin);

  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.12, 1.68), hullTurquoiseMat);
  cabinRoof.position.set(0, 1.92, -0.25);
  boat.add(cabinRoof);

  // 5. Cabin windows (glowing warmly at twilight)
  const frontWin = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.42, 1.48), windowGlowMat);
  frontWin.position.set(0, 1.52, -0.25);
  boat.add(frontWin);

  // 6. Navigation mast & signal lamp
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.35, 6), darkMetalMat);
  mast.position.set(0, 2.55, -0.4);
  const mastCross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), darkMetalMat);
  mastCross.rotation.z = Math.PI / 2;
  mastCross.position.set(0, 2.95, -0.4);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    createPainterlyToonMaterial(shared, {
      color: '#fff3d1',
      emissiveColor: '#ffaa44',
      emissiveFactor: 1.2,
    })
  );
  lamp.position.set(0, 3.25, -0.4);
  boat.add(mast, mastCross, lamp);

  // 7. Orange Lifebuoy ring on cabin flank
  const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 8, 16), lifebuoyMat);
  buoy.rotation.y = Math.PI / 2;
  buoy.position.set(-0.71, 1.32, -0.25);
  boat.add(buoy);

  // 8. Stern outboard motor & rubber tire fenders
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.65, 0.45), darkMetalMat);
  motor.position.set(0, 0.65, -2.35);
  boat.add(motor);

  for (const fz of [-1.1, 0.5]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 12), darkMetalMat);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(-1.26, 0.45, fz);
    boat.add(tire);
  }

  return boat;
}

/**
 * 4. Weathered Red Myojin Torii Gate
 */
function createToriiGate(shared: SharedUniforms): THREE.Group {
  const group = new THREE.Group();

  const vermilionMat = createPainterlyToonMaterial(shared, {
    color: '#d93b2b',
    shadowTint: '#751914',
    brushScale: 5.5,
    brushStrength: 0.11,
  });
  const blackCapMat = createPainterlyToonMaterial(shared, {
    color: '#242226',
    shadowTint: '#111012',
  });
  const stoneBaseMat = createPainterlyToonMaterial(shared, {
    color: '#80827b',
    shadowTint: '#454742',
  });
  const goldPlaqueMat = createPainterlyToonMaterial(shared, {
    color: '#e8b84b',
    shadowTint: '#8c681e',
  });

  // 1. Stone kamebara foundation pedestals
  for (const side of [-1.75, 1.75]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.55, 10), stoneBaseMat);
    base.position.set(side, 0.27, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // 2. Tapered vermilion hashira pillars
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.1, 12), vermilionMat);
    pillar.position.set(side, 2.3, 0);
    pillar.rotation.z = side < 0 ? -0.025 : 0.025; // Subtle inward batter
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  }

  // 3. Lower tie beam (Nuki) + wedges (Kusabi)
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.24, 0.22), vermilionMat);
  nuki.position.set(0, 3.38, 0);
  nuki.castShadow = true;
  group.add(nuki);

  for (const side of [-1.75, 1.75]) {
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.28), blackCapMat);
    wedge.position.set(side, 3.38, 0);
    group.add(wedge);
  }

  // 4. Secondary upper tie beam (Shimagi)
  const shimagi = new THREE.Mesh(new THREE.BoxGeometry(4.95, 0.22, 0.32), vermilionMat);
  shimagi.position.set(0, 4.18, 0);
  shimagi.castShadow = true;
  group.add(shimagi);

  // 5. Curved top lintel (Kasagi) with upward-sweeping wing tips
  const kasagiCenter = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.26, 0.44), blackCapMat);
  kasagiCenter.position.set(0, 4.42, 0);
  kasagiCenter.castShadow = true;
  group.add(kasagiCenter);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.24, 0.44), blackCapMat);
    wing.position.set(side * 2.85, 4.5, 0);
    wing.rotation.z = side * 0.16;
    group.add(wing);
  }

  // 6. Central strut (Gakuzuka) & gold-framed Shrine Tablet
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.85, 0.24), blackCapMat);
  strut.position.set(0, 3.8, 0);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.28), goldPlaqueMat);
  plaque.position.set(0, 3.82, 0.04);
  group.add(strut, plaque);

  return group;
}

/**
 * 5. Moss-Covered Stone Toro Lantern (Glows warmly at Sunset / Twilight)
 */
function createToroLantern(
  shared: SharedUniforms,
  lanternLights: THREE.PointLight[],
  withPointLight = false
): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = createPainterlyToonMaterial(shared, {
    color: '#8f9188',
    shadowTint: '#4d5049',
    brushScale: 7.0,
    brushStrength: 0.12,
  });
  const mossMat = createPainterlyToonMaterial(shared, {
    color: '#4e7a3d',
    shadowTint: '#2b4721',
  });
  const warmPaperMat = createPainterlyToonMaterial(shared, {
    color: '#fff2cc',
    emissiveColor: '#ff9d3b',
    emissiveFactor: 1.5,
  });

  // 1. Hexagonal foundation & lotus base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.26, 6), stoneMat);
  base.position.y = 0.13;
  base.castShadow = true;
  group.add(base);

  // 2. Cylindrical shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.85, 8), stoneMat);
  shaft.position.y = 0.68;
  shaft.castShadow = true;
  group.add(shaft);

  // 3. Ornate middle platform (Chudai)
  const chudai = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.24, 0.2, 6), stoneMat);
  chudai.position.y = 1.2;
  group.add(chudai);

  // 4. Firebox (Hibukuro) with glowing warm washi core & stone corner mullions
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 6), warmPaperMat);
  core.position.y = 1.48;
  group.add(core);

  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), stoneMat);
    bar.position.set(Math.cos(a) * 0.24, 1.48, Math.sin(a) * 0.24);
    group.add(bar);
  }

  // 5. Broad hexagonal umbrella roof (Kasa) + Moss patches + Finial (Hoju)
  const kasa = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.36, 6), stoneMat);
  kasa.position.y = 1.84;
  kasa.castShadow = true;
  group.add(kasa);

  const mossCap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.22, 6), mossMat);
  mossCap.position.set(0.04, 1.93, 0.03);
  group.add(mossCap);

  const hoju = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), stoneMat);
  hoju.position.y = 2.08;
  group.add(hoju);

  if (withPointLight) {
    const pt = new THREE.PointLight(0xff9d42, 1.2, 9.5, 1.8);
    pt.position.set(0, 1.5, 0);
    group.add(pt);
    lanternLights.push(pt);
  }

  return group;
}

/**
 * 6. Small Stone Jizo Statues with Red Bibs
 */
function createJizoCluster(shared: SharedUniforms): THREE.Group {
  const cluster = new THREE.Group();

  const stoneMat = createPainterlyToonMaterial(shared, {
    color: '#9e9f95',
    shadowTint: '#555750',
  });
  const redBibMat = createPainterlyToonMaterial(shared, {
    color: '#e0342b',
    shadowTint: '#7a1510',
  });
  const mossMat = createPainterlyToonMaterial(shared, {
    color: '#51803f',
    shadowTint: '#2b4720',
  });
  const woodStaffMat = createPainterlyToonMaterial(shared, {
    color: '#7a5638',
    shadowTint: '#402c1b',
  });

  // Mossy stone platform
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.24, 0.85), stoneMat);
  plinth.position.y = 0.12;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  cluster.add(plinth);

  const mossPad = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 0.72), mossMat);
  mossPad.position.y = 0.25;
  cluster.add(mossPad);

  const offsets = [
    { x: -0.48, scale: 0.92, rotY: 0.12 },
    { x: 0.0, scale: 1.08, rotY: 0.0 },
    { x: 0.48, scale: 0.85, rotY: -0.15 },
  ];

  for (const cfg of offsets) {
    const jizo = new THREE.Group();
    jizo.position.set(cfg.x, 0.24, 0);
    jizo.scale.setScalar(cfg.scale);
    jizo.rotation.y = cfg.rotY;

    // Lotus base
    const lotus = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 10), stoneMat);
    lotus.position.y = 0.07;

    // Rounded torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.32, 6, 10), stoneMat);
    torso.position.y = 0.36;
    torso.castShadow = true;

    // Serene round head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 12), stoneMat);
    head.position.y = 0.72;
    head.castShadow = true;

    // Bright vermilion cloth bib (yodarekake) draped over chest
    const bibCollar = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.032, 6, 14), redBibMat);
    bibCollar.rotation.x = Math.PI / 2 + 0.15;
    bibCollar.position.set(0, 0.56, 0.02);

    const bibApron = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.24, 10, 1, true, -1.1, 2.2), redBibMat);
    bibApron.position.set(0, 0.45, 0.03);

    // Small shakujo staff
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 6), woodStaffMat);
    staff.position.set(0.16, 0.42, 0.12);
    staff.rotation.z = -0.1;

    // 2 tiny stacked river pebbles on the head
    const pebble1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), stoneMat);
    pebble1.scale.set(1.2, 0.6, 1.0);
    pebble1.position.set(0, 0.88, 0);

    jizo.add(lotus, torso, head, bibCollar, bibApron, staff, pebble1);
    cluster.add(jizo);
  }

  return cluster;
}

/**
 * 7. Retro Red & White Japanese Vending Machine (Jidohanbaiki) under a Rusted Tin Roof
 */
function createVendingMachineShelter(shared: SharedUniforms): THREE.Group {
  const group = new THREE.Group();

  const redCabMat = createPainterlyToonMaterial(shared, {
    color: '#d92b2b',
    shadowTint: '#781414',
  });
  const whiteFrontMat = createPainterlyToonMaterial(shared, {
    color: '#f5f2eb',
    shadowTint: '#9ea8b5',
  });
  const displayGlowMat = createPainterlyToonMaterial(shared, {
    color: '#fff8e7',
    emissiveColor: '#ffe0a3',
    emissiveFactor: 1.35,
  });
  const buttonGlowMat = createPainterlyToonMaterial(shared, {
    color: '#ffd166',
    emissiveColor: '#ffaa00',
    emissiveFactor: 1.6,
  });
  const rustedTinMat = createPainterlyToonMaterial(shared, {
    color: '#8f4b32',
    shadowTint: '#4a2416',
    brushScale: 8.0,
    brushStrength: 0.15,
  });
  const woodPostMat = createPainterlyToonMaterial(shared, {
    color: '#6e5239',
    shadowTint: '#38291c',
  });
  const darkSlotMat = createPainterlyToonMaterial(shared, {
    color: '#25282c',
    shadowTint: '#111214',
  });

  // 1. Concrete pad
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.14, 1.6),
    createPainterlyToonMaterial(shared, { color: '#9c9a92', shadowTint: '#595853' })
  );
  pad.position.y = 0.07;
  pad.receiveShadow = true;
  group.add(pad);

  // 2. Red cabinet body
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.92, 0.78), redCabMat);
  cabinet.position.set(-0.2, 1.03, 0);
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  group.add(cabinet);

  // 3. White upper front fascia
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.15, 0.06), whiteFrontMat);
  fascia.position.set(-0.2, 1.36, 0.38);
  group.add(fascia);

  // 4. Illuminated drink display window + miniature colorful drink cans inside
  const windowBack = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.68, 0.04), displayGlowMat);
  windowBack.position.set(-0.2, 1.48, 0.41);
  group.add(windowBack);

  const canColors = ['#2ec4b6', '#ff9f1c', '#e71d36', '#5bc0be', '#8ac926', '#6f4e37'];
  const canGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.11, 8);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      const canMat = createPainterlyToonMaterial(shared, {
        color: canColors[(row * 3 + col) % canColors.length],
        emissiveColor: canColors[(row * 3 + col) % canColors.length],
        emissiveFactor: 0.45,
      });
      const can = new THREE.Mesh(canGeo, canMat);
      can.position.set(-0.56 + col * 0.145, 1.35 + row * 0.26, 0.43);
      group.add(can);
    }
  }

  // 5. Glowing selection button strip & coin mechanism
  const btnStrip = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.05), buttonGlowMat);
  btnStrip.position.set(-0.2, 1.04, 0.41);
  group.add(btnStrip);

  // 6. Dark lower dispensing pickup flap
  const pickupFlap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.06), darkSlotMat);
  pickupFlap.position.set(-0.28, 0.45, 0.39);
  group.add(pickupFlap);

  // 7. Blue roadside bottle recycling bin next to machine
  const binMat = createPainterlyToonMaterial(shared, {
    color: '#2b6cb0',
    shadowTint: '#16385e',
  });
  const bin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.46), binMat);
  bin.position.set(0.66, 0.55, 0.05);
  bin.castShadow = true;
  group.add(bin);

  // 8. Timber frame & corrugated rusted tin shelter roof overhead
  const postGeo = new THREE.CylinderGeometry(0.055, 0.065, 2.35, 8);
  for (const px of [-0.95, 0.95]) {
    for (const pz of [-0.62, 0.62]) {
      const post = new THREE.Mesh(postGeo, woodPostMat);
      post.position.set(px, 1.24, pz);
      post.castShadow = true;
      group.add(post);
    }
  }

  // Corrugated tin ribs
  const roofGroup = new THREE.Group();
  roofGroup.position.set(0, 2.42, 0.05);
  roofGroup.rotation.x = 0.14;
  const tinBase = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.05, 1.75), rustedTinMat);
  tinBase.castShadow = true;
  roofGroup.add(tinBase);

  const ribGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.76, 6);
  ribGeo.rotateX(Math.PI / 2);
  for (let rx = -1.05; rx <= 1.05; rx += 0.18) {
    const rib = new THREE.Mesh(ribGeo, rustedTinMat);
    rib.position.set(rx, 0.03, 0);
    roofGroup.add(rib);
  }
  group.add(roofGroup);

  return group;
}

/**
 * 8. Traditional Wooden Countryside Bus Stop & Round Enameled Sign
 */
function createBusStop(shared: SharedUniforms): THREE.Group {
  const group = new THREE.Group();

  const cedarMat = createPainterlyToonMaterial(shared, {
    color: '#8f6946',
    shadowTint: '#4d3623',
    brushScale: 5.0,
    brushStrength: 0.12,
  });
  const roofShingleMat = createPainterlyToonMaterial(shared, {
    color: '#4a5559',
    shadowTint: '#252b2e',
  });
  const signBlueMat = createPainterlyToonMaterial(shared, {
    color: '#1e6091',
    shadowTint: '#0d314d',
  });
  const signWhiteMat = createPainterlyToonMaterial(shared, {
    color: '#f7f4eb',
    shadowTint: '#a5b1bd',
  });
  const rustPostMat = createPainterlyToonMaterial(shared, {
    color: '#6e5a4f',
    shadowTint: '#362b26',
  });

  // 1. Timber wait-shed frame & slatted walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.95, 0.1), cedarMat);
  backWall.position.set(0, 1.05, -0.65);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  for (const sx of [-1.1, 1.1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.95, 1.25), cedarMat);
    sideWall.position.set(sx, 1.05, -0.05);
    sideWall.castShadow = true;
    group.add(sideWall);
  }

  // 2. Wooden waiting bench inside shed
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.46), cedarMat);
  benchSeat.position.set(0, 0.52, -0.35);
  const benchLegL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.42), cedarMat);
  benchLegL.position.set(-0.75, 0.25, -0.35);
  const benchLegR = benchLegL.clone();
  benchLegR.position.x = 0.75;
  group.add(benchSeat, benchLegL, benchLegR);

  // 3. Pitched shingle roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.14, 1.72), roofShingleMat);
  roof.position.set(0, 2.12, -0.02);
  roof.rotation.x = -0.14;
  roof.castShadow = true;
  group.add(roof);

  // 4. Notice board poster inside shed
  const poster = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.03), signWhiteMat);
  poster.position.set(0, 1.32, -0.58);
  group.add(poster);

  // 5. Classic Japanese Rural Bus Stop Sign (Teiryujo) beside shed
  const signGroup = new THREE.Group();
  signGroup.position.set(-1.65, 0, 0.45);

  const concreteBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.22, 12), roofShingleMat);
  concreteBase.position.y = 0.11;
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.05, 8), rustPostMat);
  signPole.position.y = 1.12;
  const signDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 18), signBlueMat);
  signDisc.rotation.x = Math.PI / 2;
  signDisc.position.y = 2.15;
  const signInner = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16), signWhiteMat);
  signInner.rotation.x = Math.PI / 2;
  signInner.position.y = 2.15;
  const timetable = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.04), signWhiteMat);
  timetable.position.y = 1.48;

  signGroup.add(concreteBase, signPole, signDisc, signInner, timetable);
  group.add(signGroup);

  return group;
}

/**
 * 9. Wooden Utility Pole with Transformer, Insulators & Streetlamp
 */
function createUtilityPole(shared: SharedUniforms): {
  group: THREE.Group;
  wireAnchors: THREE.Vector3[];
} {
  const group = new THREE.Group();
  const poleMat = createPainterlyToonMaterial(shared, {
    color: '#594230',
    shadowTint: '#2b1f16',
  });
  const metalArmMat = createPainterlyToonMaterial(shared, {
    color: '#757d82',
    shadowTint: '#3d4245',
  });
  const insulatorMat = createPainterlyToonMaterial(shared, {
    color: '#f0efe9',
    shadowTint: '#9aa4ad',
  });
  const warningBandMat = createPainterlyToonMaterial(shared, {
    color: '#f2b705',
    shadowTint: '#8c6900',
  });

  // Tapered timber pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 6.4, 10), poleMat);
  pole.position.y = 3.2;
  pole.castShadow = true;
  group.add(pole);

  // Yellow safety band near base
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.168, 0.65, 10), warningBandMat);
  band.position.y = 1.15;
  group.add(band);

  // Transformer bucket drum
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.65, 10), metalArmMat);
  drum.position.set(0.28, 4.55, 0);
  group.add(drum);

  // Cross-arm + 3 ceramic insulators
  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 0.08), metalArmMat);
  crossArm.position.set(0, 5.85, 0);
  group.add(crossArm);

  const wireAnchors: THREE.Vector3[] = [];
  for (const ix of [-0.62, 0, 0.62]) {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.16, 8), insulatorMat);
    ins.position.set(ix, 5.96, 0);
    group.add(ins);
    wireAnchors.push(new THREE.Vector3(ix, 6.02, 0));
  }

  return { group, wireAnchors };
}

/**
 * 10. Hilltop Shinto Shrine (Haiden sanctuary, curved roof with Chigi/Katsuogi, Shimenawa rope, Saisenbako & Furin wind chime)
 */
function createHilltopShrine(shared: SharedUniforms): {
  group: THREE.Group;
  furinPendulum: THREE.Group;
} {
  const group = new THREE.Group();

  const stoneMat = createPainterlyToonMaterial(shared, {
    color: '#919389',
    shadowTint: '#4d4f49',
  });
  const vermilionMat = createPainterlyToonMaterial(shared, {
    color: '#d43828',
    shadowTint: '#6e1810',
  });
  const plasterMat = createPainterlyToonMaterial(shared, {
    color: '#f5efe2',
    shadowTint: '#9ea6b2',
  });
  const roofBarkMat = createPainterlyToonMaterial(shared, {
    color: '#3b4247',
    shadowTint: '#1c2024',
  });
  const goldMat = createPainterlyToonMaterial(shared, {
    color: '#e8b948',
    shadowTint: '#876516',
  });
  const ropeMat = createPainterlyToonMaterial(shared, {
    color: '#d9bc7e',
    shadowTint: '#856d3d',
  });
  const warmLanternMat = createPainterlyToonMaterial(shared, {
    color: '#fff4d6',
    emissiveColor: '#ff9d3b',
    emissiveFactor: 1.5,
  });

  // 1. Stone foundation terrace & front steps
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.75, 5.4), stoneMat);
  foundation.position.y = 0.375;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.25, 0.45),
      stoneMat
    );
    step.position.set(0, 0.125 + s * 0.25, 2.95 - s * 0.35);
    step.receiveShadow = true;
    group.add(step);
  }

  // 2. Main Shrine Hall walls & vermilion corner columns
  const hallWalls = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.75, 3.8), plasterMat);
  hallWalls.position.set(0, 2.12, -0.15);
  hallWalls.castShadow = true;
  hallWalls.receiveShadow = true;
  group.add(hallWalls);

  const colGeo = new THREE.CylinderGeometry(0.16, 0.18, 2.85, 10);
  const colPositions = [
    [-2.55, 1.72],
    [2.55, 1.72],
    [-2.55, -2.0],
    [2.55, -2.0],
    [-1.15, 1.75],
    [1.15, 1.75],
  ];
  for (const [cx, cz] of colPositions) {
    const col = new THREE.Mesh(colGeo, vermilionMat);
    col.position.set(cx, 2.15, cz);
    col.castShadow = true;
    group.add(col);
  }

  // 3. Sweeping Irimoya / Nagare-zukuri Roof + Golden Chigi & Katsuogi ridge billets
  const lowerRoof = new THREE.Mesh(new THREE.ConeGeometry(4.85, 1.65, 4), roofBarkMat);
  lowerRoof.rotation.y = Math.PI / 4;
  lowerRoof.scale.set(1.22, 1.0, 0.95);
  lowerRoof.position.set(0, 4.18, 0.05);
  lowerRoof.castShadow = true;
  group.add(lowerRoof);

  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.28, 0.36), roofBarkMat);
  ridgeBeam.position.set(0, 4.88, -0.05);
  group.add(ridgeBeam);

  // 4 Katsuogi ceremonial ridge logs with gold caps
  const billetGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.78, 8);
  billetGeo.rotateX(Math.PI / 2);
  for (let bx = -1.35; bx <= 1.35; bx += 0.9) {
    const billet = new THREE.Mesh(billetGeo, goldMat);
    billet.position.set(bx, 5.08, -0.05);
    group.add(billet);
  }

  // Forked Chigi finials at both gable ends
  for (const side of [-1.95, 1.95]) {
    for (const tilt of [-0.42, 0.42]) {
      const chigi = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.14), goldMat);
      chigi.position.set(side, 5.25, -0.05);
      chigi.rotation.x = tilt;
      group.add(chigi);
    }
  }

  // 4. Braided Shimenawa sacred rope & white zigzag Shide paper streamers
  const shimenawa = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 2.35, 8), ropeMat);
  shimenawa.rotation.z = Math.PI / 2;
  shimenawa.position.set(0, 3.12, 1.85);
  group.add(shimenawa);

  for (const sx of [-0.7, -0.24, 0.24, 0.7]) {
    const shide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.03), plasterMat);
    shide.position.set(sx, 2.88, 1.88);
    shide.rotation.z = 0.15;
    group.add(shide);
  }

  // 5. Saisenbako wooden offering box & hanging brass Suzu bell
  const saisen = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.68, 0.72),
    createPainterlyToonMaterial(shared, { color: '#7a5230', shadowTint: '#3d2817' })
  );
  saisen.position.set(0, 1.09, 2.15);
  saisen.castShadow = true;
  group.add(saisen);

  const suzuBell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), goldMat);
  suzuBell.position.set(0, 2.72, 2.08);
  const bellRope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 1.35, 6), ropeMat);
  bellRope.position.set(0, 1.98, 2.08);
  group.add(suzuBell, bellRope);

  // 6. Glowing paper Cho-chin lanterns flanking the entrance
  for (const lx of [-1.45, 1.45]) {
    const lantern = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.28, 6, 10), warmLanternMat);
    lantern.position.set(lx, 2.75, 1.92);
    group.add(lantern);
  }

  // 7. Glass Furin (Wind Chime) hanging from the right front eave with swaying Tanzaku paper strip
  const furinAnchor = new THREE.Group();
  furinAnchor.position.set(2.35, 3.32, 1.95);

  const glassBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.72),
    createPainterlyToonMaterial(shared, {
      color: '#a8e6ff',
      emissiveColor: '#80d4ff',
      emissiveFactor: 0.4,
    })
  );
  furinAnchor.add(glassBowl);

  const furinPendulum = new THREE.Group();
  const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 4), plasterMat);
  stringMesh.position.y = -0.22;
  const tanzaku = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.36, 0.012),
    createPainterlyToonMaterial(shared, {
      color: '#ffe8d6',
      emissiveColor: '#ffb38a',
      emissiveFactor: 0.35,
      windSway: 1.4,
    })
  );
  tanzaku.position.y = -0.45;
  furinPendulum.add(stringMesh, tanzaku);
  furinAnchor.add(furinPendulum);

  group.add(furinAnchor);

  return { group, furinPendulum };
}

/**
 * 11. Japanese Cedar Tree (Sugi) - Multi-tiered conical canopy with wind sway
 */
function createCedarTree(shared: SharedUniforms, variant = 0): THREE.Group {
  const tree = new THREE.Group();

  const trunkMat = createPainterlyToonMaterial(shared, {
    color: '#6e4732',
    shadowTint: '#362116',
  });
  const canopyMat = createPainterlyToonMaterial(shared, {
    color: variant % 2 === 0 ? '#2b6e3f' : '#367d44',
    shadowTint: '#143824',
    rimColor: '#b8e86b',
    rimStrength: 0.55,
    windSway: 0.85,
  });

  // Trunk + flared root buttress
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.38, 3.6, 8), trunkMat);
  trunk.position.y = 1.8;
  trunk.castShadow = true;
  tree.add(trunk);

  // 5 layered foliage cones
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const radius = 1.95 * (1 - t * 0.58);
    const height = 1.75 * (1 - t * 0.25);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 9), canopyMat);
    cone.position.y = 2.4 + i * 1.05;
    cone.rotation.y = i * 0.7;
    cone.castShadow = true;
    cone.receiveShadow = true;
    tree.add(cone);
  }

  return tree;
}

/**
 * 12. Hydrangea Bush Cluster (Ajisai)
 */
function createHydrangeaBush(shared: SharedUniforms, hueIndex = 0): THREE.Group {
  const bush = new THREE.Group();

  const leafMat = createPainterlyToonMaterial(shared, {
    color: '#34733d',
    shadowTint: '#183d21',
    windSway: 0.45,
  });

  const palette = ['#6495ed', '#9b7ede', '#56b4e9', '#d47fa6'];
  const bloomMat = createPainterlyToonMaterial(shared, {
    color: palette[hueIndex % palette.length],
    shadowTint: '#394878',
    rimColor: '#e0f2fe',
    rimStrength: 0.5,
    windSway: 0.55,
  });

  // Leafy mound base (3 overlapping spheres)
  const moundOffsets = [
    [0, 0.38, 0, 0.58],
    [-0.32, 0.3, 0.18, 0.44],
    [0.34, 0.32, -0.15, 0.46],
  ];
  for (const [mx, my, mz, r] of moundOffsets) {
    const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), leafMat);
    leaf.scale.y = 0.78;
    leaf.position.set(mx, my, mz);
    leaf.castShadow = true;
    bush.add(leaf);
  }

  // 6 Hydrangea flower head puffs
  const headGeo = new THREE.IcosahedronGeometry(0.18, 1);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3;
    const rad = 0.28 + (i % 2) * 0.14;
    const head = new THREE.Mesh(headGeo, bloomMat);
    head.position.set(
      Math.cos(angle) * rad,
      0.56 + (i % 2) * 0.1,
      Math.sin(angle) * rad
    );
    bush.add(head);
  }

  return bush;
}

/**
 * 13. Stylized 3rd-Person Island Traveler with Straw Hat & Satchel
 */
export function createTravelerCharacter(shared: SharedUniforms): AnimatedSceneRefs['traveler'] {
  const root = new THREE.Group();

  const skinMat = createPainterlyToonMaterial(shared, {
    color: '#ffdfc4',
    shadowTint: '#c99779',
  });
  const shirtMat = createPainterlyToonMaterial(shared, {
    color: '#faf6eb',
    shadowTint: '#a7b4c2',
  });
  const pantsMat = createPainterlyToonMaterial(shared, {
    color: '#2c4969',
    shadowTint: '#162638',
  });
  const strawHatMat = createPainterlyToonMaterial(shared, {
    color: '#ebca7a',
    shadowTint: '#9e7c36',
  });
  const ribbonMat = createPainterlyToonMaterial(shared, {
    color: '#d93829',
    shadowTint: '#781810',
  });
  const hairMat = createPainterlyToonMaterial(shared, {
    color: '#2b2628',
    shadowTint: '#121011',
  });
  const bagMat = createPainterlyToonMaterial(shared, {
    color: '#9c5f34',
    shadowTint: '#523018',
  });

  // Soft radial contact shadow disc under feet
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshBasicMaterial({
      color: 0x162018,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // Torso (Linen summer shirt)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.56, 10), shirtMat);
  torso.position.y = 0.94;
  torso.castShadow = true;
  root.add(torso);

  // Cross-body leather satchel bag
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.42), bagMat);
  strap.position.set(0, 0.94, 0);
  strap.rotation.z = 0.42;
  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.28), bagMat);
  satchel.position.set(0.22, 0.72, -0.04);
  root.add(strap, satchel);

  // Head & Hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
  head.position.y = 1.38;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.172, 12, 10), hairMat);
  hair.position.set(0, 1.41, -0.02);
  root.add(head, hair);

  // Straw Sun Hat (Mugiwara-boshi) with vermilion ribbon
  const hat = new THREE.Group();
  hat.position.set(0, 1.5, 0);
  hat.rotation.x = -0.12;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.03, 18), strawHatMat);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.14, 14), strawHatMat);
  crown.position.y = 0.07;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.192, 0.04, 14), ribbonMat);
  ribbon.position.y = 0.03;
  hat.add(brim, crown, ribbon);
  root.add(hat);

  // Articulated Arms
  const createArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.24, 1.16, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.22, 8), shirtMat);
    sleeve.position.y = -0.1;
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.24, 4, 8), skinMat);
    forearm.position.y = -0.3;
    pivot.add(sleeve, forearm);
    return pivot;
  };
  const leftArm = createArm(-1);
  const rightArm = createArm(1);
  root.add(leftArm, rightArm);

  // Articulated Legs
  const createLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.66, 0);
    const trouser = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.42, 8), pantsMat);
    trouser.position.y = -0.21;
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.18, 8), skinMat);
    ankle.position.y = -0.48;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), bagMat);
    shoe.position.set(0, -0.6, -0.03);
    pivot.add(trouser, ankle, shoe);
    return pivot;
  };
  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);
  root.add(leftLeg, rightLeg);

  return { root, leftArm, rightArm, leftLeg, rightLeg, hat };
}

/**
 * Populates the entire Setouchi island with all props, instanced hillside grass,
 * power lines, and drifting golden komorebi pollen particles.
 */
export function populateIslandProps(
  scene: THREE.Scene,
  shared: SharedUniforms
): {
  colliders: ColliderCircle[];
  animated: AnimatedSceneRefs;
} {
  const colliders: ColliderCircle[] = [];
  const lanternPointLights: THREE.PointLight[] = [];

  const placeOnGround = (obj: THREE.Object3D, x: number, z: number, yOffset = 0) => {
    const y = groundHeightAt(x, z) + yOffset;
    obj.position.set(x, y, z);
    scene.add(obj);
    return y;
  };

  // 1. Harbor Pier at southern shore
  const pierX = pathCenterXAtZ(35);
  const pier = createWoodenPier(shared);
  pier.position.set(pierX, 0, 34.0);
  scene.add(pier);

  // 2. Moored Fishing Boat beside the pier
  const fishingBoat = createFishingBoat(shared);
  fishingBoat.position.set(pierX + 4.4, 0.02, 42.0);
  fishingBoat.rotation.y = -0.18;
  scene.add(fishingBoat);

  // 3. Concrete Coastal Tetrapods breakwater along the harbor shore
  const tetrapodPositions = [
    [-11.5, 33.5],
    [-9.8, 34.2],
    [-8.2, 34.6],
    [-6.6, 35.0],
    [5.8, 35.2],
    [7.4, 34.8],
    [9.1, 34.3],
    [10.8, 33.6],
    [12.4, 32.9],
  ];
  tetrapodPositions.forEach(([tx, tz], i) => {
    const tetra = createTetrapod(shared);
    tetra.position.set(tx, -0.25, tz);
    tetra.rotation.y = i * 1.1;
    tetra.scale.setScalar(0.92 + (i % 3) * 0.1);
    scene.add(tetra);
    colliders.push({ id: `tetra_${i}`, x: tx, z: tz, radius: 1.05 });
  });

  // 4. Retro Vending Machine under Rusted Tin Roof
  const vendX = pathCenterXAtZ(20) - 3.6;
  const vendZ = 20;
  const vending = createVendingMachineShelter(shared);
  vending.rotation.y = 0.42;
  placeOnGround(vending, vendX, vendZ);
  colliders.push({ id: 'vending_machine', x: vendX, z: vendZ, radius: 1.35 });

  // Warm point light for the vending machine at twilight
  const vendLight = new THREE.PointLight(0xffbe66, 1.1, 8.0, 1.8);
  vendLight.position.set(vendX + 0.4, groundHeightAt(vendX, vendZ) + 1.5, vendZ + 0.5);
  scene.add(vendLight);
  lanternPointLights.push(vendLight);

  // 5. Traditional Wooden Bus Stop
  const busX = pathCenterXAtZ(12) + 3.8;
  const busZ = 12;
  const busStop = createBusStop(shared);
  busStop.rotation.y = -1.25;
  placeOnGround(busStop, busX, busZ);
  colliders.push({ id: 'bus_stop', x: busX, z: busZ, radius: 1.5 });

  // 6. Weathered Red Torii Gate spanning the cobblestone path at z = 3
  const toriiX = pathCenterXAtZ(3);
  const toriiZ = 3;
  const torii = createToriiGate(shared);
  // Orient perpendicular to path tangent
  const pathDx = pathCenterXAtZ(2.5) - pathCenterXAtZ(3.5);
  torii.rotation.y = Math.atan2(pathDx, -1.0);
  placeOnGround(torii, toriiX, toriiZ);
  // Add colliders for left & right Torii pillars so player walks cleanly through the center
  colliders.push(
    { id: 'torii_left', x: toriiX - 1.75, z: toriiZ, radius: 0.45 },
    { id: 'torii_right', x: toriiX + 1.75, z: toriiZ, radius: 0.45 }
  );

  // 7. Mossy Stone Jizo Statues with Red Bibs at z = -8
  const jizoX = pathCenterXAtZ(-8) - 2.9;
  const jizoZ = -8;
  const jizo = createJizoCluster(shared);
  jizo.rotation.y = 0.58;
  placeOnGround(jizo, jizoX, jizoZ);
  colliders.push({ id: 'jizo_cluster', x: jizoX, z: jizoZ, radius: 1.0 });

  // 8. Stone Toro Lanterns flanking the path up the hill (6 lanterns, 3 with active PointLights)
  const lanternZs = [25, 15, 6, -3, -14, -23];
  lanternZs.forEach((lz, idx) => {
    const side = idx % 2 === 0 ? 2.25 : -2.25;
    const lx = pathCenterXAtZ(lz) + side;
    const withLight = idx % 2 === 0;
    const toro = createToroLantern(shared, lanternPointLights, withLight);
    placeOnGround(toro, lx, lz);
    colliders.push({ id: `toro_${idx}`, x: lx, z: lz, radius: 0.5 });
  });

  // 9. Wooden Utility Poles with Sagging Overhead Power Lines along the hillside
  const poleCoords: [number, number][] = [
    [pathCenterXAtZ(28) - 4.2, 28],
    [pathCenterXAtZ(14) - 4.5, 14],
    [pathCenterXAtZ(-1) - 4.4, -1],
    [pathCenterXAtZ(-16) - 4.6, -16],
  ];
  const worldWireAnchors: THREE.Vector3[][] = [];
  poleCoords.forEach(([px, pz], idx) => {
    const { group: poleGroup, wireAnchors } = createUtilityPole(shared);
    const py = placeOnGround(poleGroup, px, pz);
    colliders.push({ id: `pole_${idx}`, x: px, z: pz, radius: 0.35 });
    worldWireAnchors.push(
      wireAnchors.map((a) => new THREE.Vector3(px + a.x, py + a.y, pz + a.z))
    );
  });

  // Connect adjacent utility poles with sagging catenary power lines
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x22262b });
  for (let i = 0; i < worldWireAnchors.length - 1; i++) {
    for (let w = 0; w < 3; w++) {
      const p0 = worldWireAnchors[i][w];
      const p2 = worldWireAnchors[i + 1][w];
      const mid = new THREE.Vector3().addVectors(p0, p2).multiplyScalar(0.5);
      mid.y -= 0.72; // Natural catenary sag
      const curve = new THREE.CatmullRomCurve3([p0, mid, p2]);
      const tubeGeo = new THREE.TubeGeometry(curve, 14, 0.018, 5, false);
      scene.add(new THREE.Mesh(tubeGeo, wireMat));
    }
  }

  // 10. Hilltop Shinto Shrine at z = -30.5
  const shrineX = pathCenterXAtZ(-30);
  const shrineZ = -30.5;
  const { group: shrineGroup, furinPendulum } = createHilltopShrine(shared);
  placeOnGround(shrineGroup, shrineX, shrineZ);
  colliders.push({ id: 'shrine_main', x: shrineX, z: shrineZ - 0.2, radius: 2.9 });

  const shrineLight = new THREE.PointLight(0xffa64d, 1.4, 11.0, 1.6);
  shrineLight.position.set(shrineX, groundHeightAt(shrineX, shrineZ) + 2.6, shrineZ + 2.2);
  scene.add(shrineLight);
  lanternPointLights.push(shrineLight);

  // 11. Japanese Cedar Trees (Sugi) framing the hillside and sanctuary grove
  const treeCoords: [number, number, number][] = [
    [-11, 22, 1.05],
    [10, 21, 0.95],
    [-13, 12, 1.2],
    [11, 8, 1.1],
    [-9, 3, 1.15],
    [8, 1, 1.0],
    [-12, -5, 1.25],
    [9, -7, 1.15],
    [-8, -14, 1.1],
    [7, -15, 1.2],
    [-10, -24, 1.3],
    [8, -24, 1.25],
    [-7, -32, 1.35],
    [7, -32, 1.35],
    [-15, -18, 1.15],
    [15, -12, 1.05],
    [-16, 4, 1.0],
    [14, 16, 0.95],
  ];
  treeCoords.forEach(([tx, tz, scale], idx) => {
    const tree = createCedarTree(shared, idx);
    tree.scale.setScalar(scale);
    placeOnGround(tree, tx, tz);
    colliders.push({ id: `tree_${idx}`, x: tx, z: tz, radius: 0.55 * scale });
  });

  // 12. Hydrangea Bush Clusters (Ajisai) along the cobblestone path
  const bushCoords: [number, number][] = [
    [pathCenterXAtZ(23) + 2.5, 23],
    [pathCenterXAtZ(18) - 2.4, 18],
    [pathCenterXAtZ(10) - 2.6, 10],
    [pathCenterXAtZ(5) + 2.7, 5],
    [pathCenterXAtZ(-2) + 2.5, -2],
    [pathCenterXAtZ(-9) + 2.6, -9],
    [pathCenterXAtZ(-18) - 2.5, -18],
    [pathCenterXAtZ(-25) + 2.8, -25],
    [shrineX - 3.8, shrineZ + 2.2],
    [shrineX + 3.8, shrineZ + 2.2],
  ];
  bushCoords.forEach(([bx, bz], idx) => {
    const bush = createHydrangeaBush(shared, idx);
    bush.rotation.y = idx * 0.9;
    placeOnGround(bush, bx, bz);
  });

  // 13. Instanced Lush Hillside Grass with Wind-Sway Vertex Shader
  buildHillsideGrass(scene, shared);

  // 14. Drifting Golden-Hour Pollen / Dust Motes in the Air
  const pollenPoints = createAtmosphericPollen(scene, shared);

  // 15. 3rd-Person Traveler Character
  const traveler = createTravelerCharacter(shared);
  scene.add(traveler.root);

  return {
    colliders,
    animated: {
      fishingBoat,
      furinPendulum,
      pollenPoints,
      lanternPointLights,
      traveler,
    },
  };
}

/**
 * Creates 2,200 instanced multi-blade grass tufts across the green hillside slopes.
 */
function buildHillsideGrass(scene: THREE.Scene, shared: SharedUniforms): void {
  // 3 crossed tapered grass blades per tuft
  const bladeGeo = new THREE.PlaneGeometry(0.18, 0.58, 1, 3);
  bladeGeo.translate(0, 0.29, 0);
  // Taper top vertices of the blade
  const pos = bladeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    if (py > 0.5) {
      pos.setX(i, pos.getX(i) * 0.15);
    } else if (py > 0.3) {
      pos.setX(i, pos.getX(i) * 0.65);
    }
  }

  const grassMat = createGrassShaderMaterial(shared);
  const maxCount = 2200;
  const instMesh = new THREE.InstancedMesh(bladeGeo, grassMat, maxCount);

  const dummy = new THREE.Object3D();
  let placed = 0;

  // Deterministic pseudo-random scatter across island
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let attempt = 0; attempt < 4500 && placed < maxCount; attempt++) {
    const rx = (nextRand() - 0.5) * 58;
    const rz = (nextRand() - 0.5) * 64;
    const dPath = distanceToPath(rx, rz);
    if (dPath < 2.15) continue; // Keep off the cobblestone path
    const y = groundHeightAt(rx, rz);
    if (y < 0.75 || y > 10.2) continue; // Keep above beach sand and off shrine stone terrace

    dummy.position.set(rx, y - 0.03, rz);
    dummy.rotation.set(
      (nextRand() - 0.5) * 0.15,
      nextRand() * Math.PI * 2,
      (nextRand() - 0.5) * 0.15
    );
    const s = 0.75 + nextRand() * 0.65;
    dummy.scale.set(s, s * (0.85 + nextRand() * 0.4), s);
    dummy.updateMatrix();
    instMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }

  instMesh.count = placed;
  instMesh.instanceMatrix.needsUpdate = true;
  instMesh.computeBoundingSphere();
  scene.add(instMesh);
}

/**
 * Creates drifting golden-hour pollen / dust motes in the air.
 */
function createAtmosphericPollen(
  scene: THREE.Scene,
  shared: SharedUniforms
): THREE.Points {
  const count = 260;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 44;
    const z = (Math.random() - 0.5) * 58;
    const baseH = Math.max(0.5, groundHeightAt(x, z));
    positions[i * 3] = x;
    positions[i * 3 + 1] = baseH + 0.5 + Math.random() * 4.5;
    positions[i * 3 + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: shared.uTime,
      uSunColor: shared.uSunColor,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.45 + position.z * 0.5) * 0.65;
        p.y += cos(uTime * 0.35 + position.x * 0.4) * 0.35;
        p.z += sin(uTime * 0.4 + position.y * 0.6) * 0.55;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(24.0 / -mvPosition.z, 2.0, 6.5);
        vAlpha = 0.45 + 0.45 * sin(uTime * 1.8 + position.x * 2.0 + position.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float circle = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(mix(vec3(1.0, 0.96, 0.82), uSunColor, 0.45), circle * vAlpha * 0.8);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
}
