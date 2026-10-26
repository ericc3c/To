import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  CameraPerspective,
  GameState,
  InspectableLandmark,
  LIGHTING_PRESETS,
  TimeOfDay,
  createLandmarks,
  dampValue,
  findNearestLandmark,
  getNextTimeOfDay,
  groundHeightAt,
  pathCenterXAtZ,
  resolvePlayerMovement,
} from './game/islandLogic';
import {
  createOceanMaterial,
  createSharedUniforms,
  createSkyDomeMaterial,
  updateSharedUniforms,
} from './game/shaders';
import {
  AnimatedSceneRefs,
  buildIslandTerrainAndPath,
  populateIslandProps,
} from './game/props';
import { SetouchiAudioEngine } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';

// Pre-allocated scratch vectors outside render loop (zero GC)
const _camTargetPos = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3();
const _sunColorScratch = new THREE.Color();
const _hemiSkyScratch = new THREE.Color();
const _hemiGroundScratch = new THREE.Color();
const _fogColorScratch = new THREE.Color();

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [gameState, setGameState] = useState<GameState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [perspective, setPerspective] = useState<CameraPerspective>('third');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('sunset');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [nearbyLandmark, setNearbyLandmark] =
    useState<InspectableLandmark | null>(null);
  const [activeObservation, setActiveObservation] =
    useState<InspectableLandmark | null>(null);
  const [observedIds, setObservedIds] = useState<string[]>([]);
  const [currentZoneName, setCurrentZoneName] = useState<string>(
    'Minato Harbor · South Pier'
  );
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<SetouchiAudioEngine | null>(null);
  const landmarksRef = useRef<InspectableLandmark[]>(createLandmarks());

  // Mutable simulation refs so React HUD renders never tear down WebGL
  const stateRef = useRef<{
    gameState: GameState;
    perspective: CameraPerspective;
    timeOfDay: TimeOfDay;
    activeObservation: InspectableLandmark | null;
    nearbyLandmarkId: string | null;
    playerPos: THREE.Vector3;
    playerYaw: number;
    cameraPitch: number;
    walkCycle: number;
    stepDistanceAccum: number;
    touchMove: { x: number; y: number };
    touchLook: { x: number; y: number };
  }>({
    gameState: initialAutostart ? 'playing' : 'title',
    perspective: 'third',
    timeOfDay: 'sunset',
    activeObservation: null,
    nearbyLandmarkId: null,
    playerPos: new THREE.Vector3(
      pathCenterXAtZ(28.5),
      groundHeightAt(pathCenterXAtZ(28.5), 28.5),
      28.5
    ),
    playerYaw: 0, // Facing North (-Z) up the coastal cobblestone path
    cameraPitch: 0.08,
    walkCycle: 0,
    stepDistanceAccum: 0,
    touchMove: { x: 0, y: 0 },
    touchLook: { x: 0, y: 0 },
  });

  // Sync dataset attributes on document.body for inspection & testing
  useEffect(() => {
    stateRef.current.gameState = gameState;
    document.body.dataset.state = gameState;
    if (gameState !== 'playing') {
      document.exitPointerLock?.();
    }
    audioRef.current?.setPaused(gameState === 'paused');
  }, [gameState]);

  useEffect(() => {
    stateRef.current.perspective = perspective;
    document.body.dataset.perspective = perspective;
  }, [perspective]);

  useEffect(() => {
    stateRef.current.timeOfDay = timeOfDay;
    document.body.dataset.timeOfDay = timeOfDay;
  }, [timeOfDay]);

  useEffect(() => {
    stateRef.current.activeObservation = activeObservation;
  }, [activeObservation]);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new SetouchiAudioEngine();
    }
    audioRef.current.initAndResume();
  }, []);

  const handleStartGame = useCallback(() => {
    ensureAudio();
    stateRef.current.gameState = 'playing';
    document.body.dataset.state = 'playing';
    setGameState('playing');
    audioRef.current?.playFurinChime(0.65);
  }, [ensureAudio]);

  const handleTogglePerspective = useCallback(() => {
    ensureAudio();
    setPerspective((prev) => (prev === 'third' ? 'first' : 'third'));
  }, [ensureAudio]);

  const handleCycleTime = useCallback(() => {
    ensureAudio();
    setTimeOfDay((prev) => getNextTimeOfDay(prev));
    audioRef.current?.playFurinChime(0.5);
  }, [ensureAudio]);

  const handleSelectTime = useCallback(
    (mode: TimeOfDay) => {
      ensureAudio();
      setTimeOfDay(mode);
      audioRef.current?.playFurinChime(0.5);
    },
    [ensureAudio]
  );

  const handleToggleMute = useCallback(() => {
    ensureAudio();
    setIsMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, [ensureAudio]);

  const handleTriggerObserve = useCallback(() => {
    ensureAudio();
    const lm = findNearestLandmark(
      stateRef.current.playerPos,
      landmarksRef.current
    );
    if (!lm) return;
    document.exitPointerLock?.();
    setActiveObservation(lm);
    setObservedIds((prev) => (prev.includes(lm.id) ? prev : [...prev, lm.id]));
    audioRef.current?.playFurinChime(0.95);
  }, [ensureAudio]);

  const handleCloseObservation = useCallback(() => {
    setActiveObservation(null);
  }, []);

  const handleResetToHarbor = useCallback(() => {
    const startZ = 28.5;
    const startX = pathCenterXAtZ(startZ);
    stateRef.current.playerPos.set(
      startX,
      groundHeightAt(startX, startZ),
      startZ
    );
    stateRef.current.playerYaw = 0;
    stateRef.current.cameraPitch = 0.08;
    setActiveObservation(null);
    setGameState('playing');
  }, []);

  const handleTeleportToLandmark = useCallback(
    (lm: InspectableLandmark) => {
      ensureAudio();
      // Place traveler on the cobblestone path or pier right beside the landmark
      let targetZ = lm.position.z + 2.8;
      let targetX = pathCenterXAtZ(targetZ);
      if (lm.id === 'fishing_boat') {
        targetX = pathCenterXAtZ(35) + 0.8;
        targetZ = 41.5;
      } else if (lm.id === 'hilltop_shrine') {
        targetX = pathCenterXAtZ(-26.5);
        targetZ = -25.8;
      }
      const targetY = groundHeightAt(targetX, targetZ);
      stateRef.current.playerPos.set(targetX, targetY, targetZ);

      // Face the landmark
      const dx = lm.position.x - targetX;
      const dz = lm.position.z - targetZ;
      stateRef.current.playerYaw = Math.atan2(-dx, -dz);
      stateRef.current.cameraPitch = 0.05;
      setActiveObservation(null);
      audioRef.current?.playFurinChime(0.6);
    },
    [ensureAudio]
  );

  const handleTouchMoveInput = useCallback((dx: number, dy: number) => {
    stateRef.current.touchMove.x = dx;
    stateRef.current.touchMove.y = dy;
  }, []);

  const handleTouchLookInput = useCallback((dx: number, dy: number) => {
    stateRef.current.touchLook.x = dx;
    stateRef.current.touchLook.y = dy;
  }, []);

  // Main Three.js Scene & Simulation Setup (Runs once on mount)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard (SwiftShader / llvmpipe / Basic Render)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.dataset.testid = 'island-canvas';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialPreset = LIGHTING_PRESETS[stateRef.current.timeOfDay];
    scene.background = new THREE.Color(initialPreset.fogColor);
    const sceneFog = new THREE.FogExp2(
      initialPreset.fogColor,
      initialPreset.fogDensity
    );
    scene.fog = sceneFog;

    // Studio Environment Map (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.15,
      260
    );

    // Post-Processing: RenderPass + Subtle UnrealBloomPass for sky and lanterns
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
        initialPreset.bloomStrength,
        0.45,
        0.82
      );
      composer.addPass(bloomPass);
    }

    // 2. Shared Custom GLSL Shader Uniforms
    const sharedUniforms = createSharedUniforms(stateRef.current.timeOfDay);

    // 3. Sky Dome with Volumetric-Style Cumulonimbus Clouds
    const skyGeo = new THREE.SphereGeometry(185, 40, 28);
    const skyMat = createSkyDomeMaterial(sharedUniforms);
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // 4. Sparkling Turquoise Setouchi Ocean with Shoreline Foam & Ray-Marched Reflections
    const oceanGeo = new THREE.PlaneGeometry(340, 340, 88, 88);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = createOceanMaterial(sharedUniforms);
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = 0.0;
    scene.add(oceanMesh);

    // 5. Studio 3-Point / Outdoor Golden Hour Lighting Rig
    const sunLight = new THREE.DirectionalLight(
      initialPreset.sunColor,
      initialPreset.sunIntensity
    );
    sunLight.position.set(
      initialPreset.sunDirection.x * 60,
      initialPreset.sunDirection.y * 60,
      initialPreset.sunDirection.z * 60
    );
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    const d = 42;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 145;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(
      initialPreset.hemiSkyColor,
      initialPreset.hemiGroundColor,
      initialPreset.hemiIntensity
    );
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // 6. Island Terrain, Cobblestone Path, Props, Foliage & 3rd-Person Traveler
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    buildIslandTerrainAndPath(scene, sharedUniforms, maxAnisotropy);
    const { colliders, animated }: { colliders: typeof colliders; animated: AnimatedSceneRefs } =
      populateIslandProps(scene, sharedUniforms);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. Input Listeners (WASD / Arrows + Mouse PointerLock & Drag Look + Shortcuts)
    const keysPressed = new Set<string>();
    let isPointerDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      keysPressed.add(code);

      if (stateRef.current.gameState === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (stateRef.current.activeObservation) {
          setActiveObservation(null);
        } else {
          setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        }
        return;
      }

      if (stateRef.current.gameState !== 'playing') return;

      if (code === 'KeyE' || (code === 'Space' && stateRef.current.activeObservation)) {
        e.preventDefault();
        if (stateRef.current.activeObservation) {
          setActiveObservation(null);
        } else {
          handleTriggerObserve();
        }
      } else if (code === 'KeyV') {
        e.preventDefault();
        handleTogglePerspective();
      } else if (code === 'KeyT') {
        e.preventDefault();
        handleCycleTime();
      } else if (code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (code === 'KeyH') {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const clearInputs = () => {
      keysPressed.clear();
      isPointerDragging = false;
    };

    const onCanvasMouseDown = (e: MouseEvent) => {
      if (stateRef.current.gameState !== 'playing' || stateRef.current.activeObservation) {
        return;
      }
      ensureAudio();
      isPointerDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      // Request PointerLock on desktop click if supported
      if (
        document.pointerLockElement !== renderer.domElement &&
        renderer.domElement.requestPointerLock
      ) {
        try {
          renderer.domElement.requestPointerLock();
        } catch {
          // Ignore pointer lock rejection in automated/iframe contexts
        }
      }
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (stateRef.current.gameState !== 'playing' || stateRef.current.activeObservation) {
        return;
      }
      if (document.pointerLockElement === renderer.domElement) {
        stateRef.current.playerYaw -= e.movementX * 0.0024;
        stateRef.current.cameraPitch = Math.max(
          -0.55,
          Math.min(0.68, stateRef.current.cameraPitch + e.movementY * 0.002)
        );
      } else if (isPointerDragging) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        stateRef.current.playerYaw -= dx * 0.0045;
        stateRef.current.cameraPitch = Math.max(
          -0.55,
          Math.min(0.68, stateRef.current.cameraPitch + dy * 0.0035)
        );
      }
    };

    const onWindowMouseUp = () => {
      isPointerDragging = false;
    };

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      bloomPass?.resolution.set(w / 2, h / 2);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('mousedown', onCanvasMouseDown);

    // 8. Main Animation & Software-WebGL Paced Render Loop
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let hudCheckAccum = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const st = stateRef.current;
      if (st.gameState !== 'paused') {
        elapsed += dt;
      }

      // 1. Smoothly interpolate lighting & shader uniforms for Day / Sunset / Twilight
      updateSharedUniforms(sharedUniforms, st.timeOfDay, dt, elapsed);

      const targetPreset = LIGHTING_PRESETS[st.timeOfDay];
      const lightLerp = 1 - Math.exp(-3.5 * dt);
      sunLight.color.lerp(_sunColorScratch.set(targetPreset.sunColor), lightLerp);
      sunLight.intensity = dampValue(
        sunLight.intensity,
        targetPreset.sunIntensity,
        3.5,
        dt
      );
      sunLight.position.set(
        sharedUniforms.uSunDir.value.x * 60,
        sharedUniforms.uSunDir.value.y * 60,
        sharedUniforms.uSunDir.value.z * 60
      );

      hemiLight.color.lerp(_hemiSkyScratch.set(targetPreset.hemiSkyColor), lightLerp);
      hemiLight.groundColor.lerp(
        _hemiGroundScratch.set(targetPreset.hemiGroundColor),
        lightLerp
      );
      hemiLight.intensity = dampValue(
        hemiLight.intensity,
        targetPreset.hemiIntensity,
        3.5,
        dt
      );

      sceneFog.color.lerp(_fogColorScratch.set(targetPreset.fogColor), lightLerp);
      sceneFog.density = dampValue(
        sceneFog.density,
        targetPreset.fogDensity,
        3.5,
        dt
      );
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(sceneFog.color);
      }

      if (bloomPass) {
        bloomPass.strength = dampValue(
          bloomPass.strength,
          targetPreset.bloomStrength,
          3.5,
          dt
        );
      }

      // Scale Toro lantern & vending point lights by dusk/twilight intensity
      for (const pt of animated.lanternPointLights) {
        pt.intensity = sharedUniforms.uLanternGlow.value * 1.15;
      }

      // 2. Ambient World Animations: Moored Fishing Boat bobbing & Furin Wind Chime sway
      animated.fishingBoat.position.y =
        0.02 + Math.sin(elapsed * 1.55) * 0.065;
      animated.fishingBoat.rotation.z = Math.sin(elapsed * 1.2) * 0.035;
      animated.fishingBoat.rotation.x = Math.cos(elapsed * 0.95) * 0.022;

      animated.furinPendulum.rotation.z =
        Math.sin(elapsed * 2.8) * 0.18 + Math.cos(elapsed * 4.3) * 0.08;
      animated.furinPendulum.rotation.x = Math.sin(elapsed * 2.1 + 1.0) * 0.12;

      // 3. Player Movement & Camera Choreography
      if (st.gameState === 'title') {
        // Live World Camera Tour overlooking the harbor ocean shoreline, moored boat, and hillside Torii vista
        const tourAngle = elapsed * 0.16;
        const tourZ = 39.5 + Math.sin(tourAngle) * 4.5;
        const tourX = pathCenterXAtZ(32) + 8.5 + Math.cos(tourAngle * 0.7) * 4.0;
        const tourY = 4.2 + Math.sin(tourAngle * 0.5) * 0.6;

        camera.position.set(tourX, tourY, tourZ);
        _lookAtPos.set(
          pathCenterXAtZ(18),
          groundHeightAt(pathCenterXAtZ(18), 18) + 1.4,
          18
        );
        camera.lookAt(_lookAtPos);
      } else if (st.gameState === 'playing') {
        // Apply touch look joystick
        if (
          Math.abs(st.touchLook.x) > 0.01 ||
          Math.abs(st.touchLook.y) > 0.01
        ) {
          st.playerYaw -= st.touchLook.x * 2.1 * dt;
          st.cameraPitch = Math.max(
            -0.55,
            Math.min(0.68, st.cameraPitch + st.touchLook.y * 1.5 * dt)
          );
        }

        // Gather movement intent if not currently locked in a close-up observation
        let moveForward = 0;
        let moveRight = 0;
        if (!st.activeObservation) {
          if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp'))
            moveForward += 1;
          if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown'))
            moveForward -= 1;
          if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight'))
            moveRight += 1;
          if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft'))
            moveRight -= 1;

          moveRight += st.touchMove.x;
          moveForward -= st.touchMove.y;
        }

        const inputLen = Math.hypot(moveForward, moveRight);
        const isMoving = inputLen > 0.02;
        if (inputLen > 1) {
          moveForward /= inputLen;
          moveRight /= inputLen;
        }

        const walkSpeed = keysPressed.has('ShiftLeft') ? 6.2 : 4.3;
        if (isMoving) {
          const sinY = Math.sin(st.playerYaw);
          const cosY = Math.cos(st.playerYaw);

          // Forward vector in Three.js (-sin(yaw), -cos(yaw))
          const worldDx =
            (-sinY * moveForward + cosY * moveRight) * walkSpeed * dt;
          const worldDz =
            (-cosY * moveForward - sinY * moveRight) * walkSpeed * dt;

          const resolved = resolvePlayerMovement(
            { x: st.playerPos.x, z: st.playerPos.z },
            { x: st.playerPos.x + worldDx, z: st.playerPos.z + worldDz },
            colliders,
            0.45
          );

          const stepDist = Math.hypot(
            resolved.x - st.playerPos.x,
            resolved.z - st.playerPos.z
          );
          st.playerPos.set(resolved.x, resolved.y, resolved.z);
          st.walkCycle += stepDist * 3.4;
          st.stepDistanceAccum += stepDist;

          if (st.stepDistanceAccum >= 1.55) {
            st.stepDistanceAccum = 0;
            const onPier = st.playerPos.z > 33.5;
            audioRef.current?.playFootstep(onPier);
          }
        }

        // Update 3rd-Person Traveler mesh transform & limb swing
        const trav = animated.traveler;
        trav.root.visible = st.perspective === 'third';
        trav.root.position.copy(st.playerPos);
        trav.root.rotation.y = st.playerYaw;

        const swingAmp = isMoving ? Math.min(1, inputLen) * 0.55 : 0;
        const swingAngle = Math.sin(st.walkCycle) * swingAmp;
        trav.leftLeg.rotation.x = dampValue(
          trav.leftLeg.rotation.x,
          swingAngle,
          14,
          dt
        );
        trav.rightLeg.rotation.x = dampValue(
          trav.rightLeg.rotation.x,
          -swingAngle,
          14,
          dt
        );
        trav.leftArm.rotation.x = dampValue(
          trav.leftArm.rotation.x,
          -swingAngle * 0.75,
          14,
          dt
        );
        trav.rightArm.rotation.x = dampValue(
          trav.rightArm.rotation.x,
          swingAngle * 0.75,
          14,
          dt
        );

        // Camera Framing: Inspection Zoom vs 1st-Person vs 3rd-Person
        if (st.activeObservation) {
          const lm = st.activeObservation;
          _camDesiredPos.set(
            lm.position.x + lm.cameraZoomOffset.x,
            lm.position.y + lm.cameraZoomOffset.y,
            lm.position.z + lm.cameraZoomOffset.z
          );
          _camTargetPos.set(
            lm.position.x + lm.lookAtOffset.x,
            lm.position.y + lm.lookAtOffset.y,
            lm.position.z + lm.lookAtOffset.z
          );
          const camLerp = 1 - Math.exp(-5.5 * dt);
          camera.position.lerp(_camDesiredPos, camLerp);
          _lookAtPos.lerp(_camTargetPos, camLerp);
          camera.lookAt(_lookAtPos);
          camera.fov = dampValue(camera.fov, 42, 5.5, dt);
          camera.updateProjectionMatrix();
        } else if (st.perspective === 'first') {
          const headBob = isMoving ? Math.sin(st.walkCycle * 2.0) * 0.035 : 0;
          _camDesiredPos.set(
            st.playerPos.x,
            st.playerPos.y + 1.52 + headBob,
            st.playerPos.z
          );
          camera.position.lerp(_camDesiredPos, 1 - Math.exp(-18 * dt));

          const lookDist = 8.0;
          _camTargetPos.set(
            camera.position.x -
              Math.sin(st.playerYaw) * Math.cos(st.cameraPitch) * lookDist,
            camera.position.y - Math.sin(st.cameraPitch) * lookDist,
            camera.position.z -
              Math.cos(st.playerYaw) * Math.cos(st.cameraPitch) * lookDist
          );
          _lookAtPos.copy(_camTargetPos);
          camera.lookAt(_lookAtPos);
          if (Math.abs(camera.fov - 58) > 0.1) {
            camera.fov = dampValue(camera.fov, 58, 6, dt);
            camera.updateProjectionMatrix();
          }
        } else {
          // 3rd-Person Chase Camera with terrain height clearance
          const distBack = 3.85;
          const camHeight = 1.95 + st.cameraPitch * 1.65;
          const rawCamX =
            st.playerPos.x + Math.sin(st.playerYaw) * distBack + Math.cos(st.playerYaw) * 0.35;
          const rawCamZ =
            st.playerPos.z + Math.cos(st.playerYaw) * distBack - Math.sin(st.playerYaw) * 0.35;
          const minGroundY = groundHeightAt(rawCamX, rawCamZ) + 0.65;
          const rawCamY = Math.max(minGroundY, st.playerPos.y + camHeight);

          _camDesiredPos.set(rawCamX, rawCamY, rawCamZ);
          camera.position.lerp(_camDesiredPos, 1 - Math.exp(-10 * dt));

          _camTargetPos.set(
            st.playerPos.x - Math.sin(st.playerYaw) * 2.2,
            st.playerPos.y + 1.32 - st.cameraPitch * 1.1,
            st.playerPos.z - Math.cos(st.playerYaw) * 2.2
          );
          _lookAtPos.lerp(_camTargetPos, 1 - Math.exp(-12 * dt));
          camera.lookAt(_lookAtPos);
          if (Math.abs(camera.fov - 54) > 0.1) {
            camera.fov = dampValue(camera.fov, 54, 6, dt);
            camera.updateProjectionMatrix();
          }
        }

        // Update audio spatial mix & Furin chimes
        audioRef.current?.update(dt, st.playerPos.y);

        // Throttled (< 10Hz) check for nearby inspectable landmarks & island zone label
        hudCheckAccum += dt;
        if (hudCheckAccum >= 0.12) {
          hudCheckAccum = 0;
          const nearest = findNearestLandmark(
            st.playerPos,
            landmarksRef.current
          );
          const nextId = nearest ? nearest.id : null;
          if (nextId !== st.nearbyLandmarkId) {
            st.nearbyLandmarkId = nextId;
            setNearbyLandmark(nearest);
          }

          const pz = st.playerPos.z;
          const zone =
            pz > 26
              ? 'Minato Harbor · South Pier'
              : pz > 8
              ? 'Shiomizaka · Lower Cobblestone Path'
              : pz > -14
              ? 'Akagi Cedar Grove · Sacred Trail'
              : 'Misaki Summit · Hilltop Shrine';
          setCurrentZoneName((prev) => (prev === zone ? prev : zone));
        }
      }

      // 4. Render Scene
      if (isSoftwareGl || !composer) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousedown', onCanvasMouseDown);
      renderer.dispose();
    };
  }, [
    ensureAudio,
    handleCycleTime,
    handleStartGame,
    handleToggleMute,
    handleTogglePerspective,
    handleTriggerObserve,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-stone-950 select-none">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full"
        aria-label="Setouchi Island 3D Viewport"
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          onStart={handleStartGame}
          timeOfDay={timeOfDay}
          onCycleTime={handleCycleTime}
        />
      )}

      {/* Playing & Paused HUD Overlay */}
      {gameState !== 'title' && (
        <GameHud
          perspective={perspective}
          onTogglePerspective={handleTogglePerspective}
          timeOfDay={timeOfDay}
          onCycleTime={handleCycleTime}
          onSelectTime={handleSelectTime}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={() =>
            setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'))
          }
          isPaused={gameState === 'paused'}
          onResume={() => setGameState('playing')}
          onRestart={handleResetToHarbor}
          onReturnTitle={() => {
            setActiveObservation(null);
            setGameState('title');
          }}
          nearbyLandmark={nearbyLandmark}
          activeObservation={activeObservation}
          onTriggerObserve={handleTriggerObserve}
          onCloseObservation={handleCloseObservation}
          observedIds={observedIds}
          allLandmarks={landmarksRef.current}
          onTeleportToLandmark={handleTeleportToLandmark}
          currentZoneName={currentZoneName}
          dockCollapsed={dockCollapsed}
          onToggleDock={() => setDockCollapsed((prev) => !prev)}
          onTouchMoveInput={handleTouchMoveInput}
          onTouchLookInput={handleTouchLookInput}
        />
      )}
    </main>
  );
}
