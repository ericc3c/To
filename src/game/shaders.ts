import * as THREE from 'three';
import { LIGHTING_PRESETS, TimeOfDay, dampValue } from './islandLogic';

export interface SharedUniforms {
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uSunIntensity: { value: number };
  uSkyColor: { value: THREE.Color };
  uGroundColor: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uSkyTopColor: { value: THREE.Color };
  uSkyHorizonColor: { value: THREE.Color };
  uSkySunGlowColor: { value: THREE.Color };
  uCloudLitColor: { value: THREE.Color };
  uCloudShadowColor: { value: THREE.Color };
  uCloudRimColor: { value: THREE.Color };
  uWaterShallowColor: { value: THREE.Color };
  uWaterDeepColor: { value: THREE.Color };
  uWaterFoamColor: { value: THREE.Color };
  uWaterSunSpecColor: { value: THREE.Color };
  uLanternGlow: { value: number };
  uStarVisibility: { value: number };
}

export function createSharedUniforms(initialTime: TimeOfDay = 'sunset'): SharedUniforms {
  const p = LIGHTING_PRESETS[initialTime];
  const sunDir = new THREE.Vector3(p.sunDirection.x, p.sunDirection.y, p.sunDirection.z).normalize();

  return {
    uTime: { value: 0 },
    uSunDir: { value: sunDir },
    uSunColor: { value: new THREE.Color(p.sunColor) },
    uSunIntensity: { value: p.sunIntensity },
    uSkyColor: { value: new THREE.Color(p.hemiSkyColor) },
    uGroundColor: { value: new THREE.Color(p.hemiGroundColor) },
    uFogColor: { value: new THREE.Color(p.fogColor) },
    uFogDensity: { value: p.fogDensity },
    uSkyTopColor: { value: new THREE.Color(p.skyTopColor) },
    uSkyHorizonColor: { value: new THREE.Color(p.skyHorizonColor) },
    uSkySunGlowColor: { value: new THREE.Color(p.skySunGlowColor) },
    uCloudLitColor: { value: new THREE.Color(p.cloudLitColor) },
    uCloudShadowColor: { value: new THREE.Color(p.cloudShadowColor) },
    uCloudRimColor: { value: new THREE.Color(p.cloudRimColor) },
    uWaterShallowColor: { value: new THREE.Color(p.waterShallowColor) },
    uWaterDeepColor: { value: new THREE.Color(p.waterDeepColor) },
    uWaterFoamColor: { value: new THREE.Color(p.waterFoamColor) },
    uWaterSunSpecColor: { value: new THREE.Color(p.waterSunSpecColor) },
    uLanternGlow: { value: p.lanternEmissiveIntensity },
    uStarVisibility: { value: p.starVisibility },
  };
}

const _targetColor = new THREE.Color();
const _targetSunDir = new THREE.Vector3();

export function updateSharedUniforms(
  uniforms: SharedUniforms,
  targetMode: TimeOfDay,
  dt: number,
  elapsed: number
): void {
  uniforms.uTime.value = elapsed;
  const p = LIGHTING_PRESETS[targetMode];
  const alpha = 1 - Math.exp(-3.5 * Math.max(0.001, dt));

  _targetSunDir.set(p.sunDirection.x, p.sunDirection.y, p.sunDirection.z).normalize();
  uniforms.uSunDir.value.lerp(_targetSunDir, alpha).normalize();

  uniforms.uSunColor.value.lerp(_targetColor.set(p.sunColor), alpha);
  uniforms.uSunIntensity.value = dampValue(uniforms.uSunIntensity.value, p.sunIntensity, 3.5, dt);
  uniforms.uSkyColor.value.lerp(_targetColor.set(p.hemiSkyColor), alpha);
  uniforms.uGroundColor.value.lerp(_targetColor.set(p.hemiGroundColor), alpha);
  uniforms.uFogColor.value.lerp(_targetColor.set(p.fogColor), alpha);
  uniforms.uFogDensity.value = dampValue(uniforms.uFogDensity.value, p.fogDensity, 3.5, dt);

  uniforms.uSkyTopColor.value.lerp(_targetColor.set(p.skyTopColor), alpha);
  uniforms.uSkyHorizonColor.value.lerp(_targetColor.set(p.skyHorizonColor), alpha);
  uniforms.uSkySunGlowColor.value.lerp(_targetColor.set(p.skySunGlowColor), alpha);
  uniforms.uCloudLitColor.value.lerp(_targetColor.set(p.cloudLitColor), alpha);
  uniforms.uCloudShadowColor.value.lerp(_targetColor.set(p.cloudShadowColor), alpha);
  uniforms.uCloudRimColor.value.lerp(_targetColor.set(p.cloudRimColor), alpha);

  uniforms.uWaterShallowColor.value.lerp(_targetColor.set(p.waterShallowColor), alpha);
  uniforms.uWaterDeepColor.value.lerp(_targetColor.set(p.waterDeepColor), alpha);
  uniforms.uWaterFoamColor.value.lerp(_targetColor.set(p.waterFoamColor), alpha);
  uniforms.uWaterSunSpecColor.value.lerp(_targetColor.set(p.waterSunSpecColor), alpha);

  uniforms.uLanternGlow.value = dampValue(
    uniforms.uLanternGlow.value,
    p.lanternEmissiveIntensity,
    3.5,
    dt
  );
  uniforms.uStarVisibility.value = dampValue(
    uniforms.uStarVisibility.value,
    p.starVisibility,
    3.5,
    dt
  );
}

const GLSL_NOISE_LIB = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 st) {
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    value += amp * valueNoise(st);
    st = rot * st * 2.03 + vec2(17.1, 31.7);
    amp *= 0.5;
  }
  return value;
}
`;

/**
 * Custom 3-Band Painterly Toon ShaderMaterial for props, foliage, and stylized surfaces.
 * Features:
 * - 3-band toon shading with soft gradients (highlight, midtone, cool/warm shadow band)
 * - Warm Fresnel rim lighting
 * - Procedural gouache/watercolor brushstroke noise so nothing looks like flat plastic
 * - Dappled komorebi sunlight projection
 * - Optional vertex wind sway for foliage/trees/banners
 * - Optional lantern emissive glow that scales with dusk/twilight
 */
export interface ToonMaterialOptions {
  color: string | number;
  shadowTint?: string | number;
  rimColor?: string | number;
  rimPower?: number;
  rimStrength?: number;
  brushScale?: number;
  brushStrength?: number;
  windSway?: number;
  komorebiStrength?: number;
  emissiveColor?: string | number;
  emissiveFactor?: number;
  useVertexColors?: boolean;
}

export function createPainterlyToonMaterial(
  shared: SharedUniforms,
  opts: ToonMaterialOptions
): THREE.ShaderMaterial {
  const baseCol = new THREE.Color(opts.color);
  const shadowCol = opts.shadowTint
    ? new THREE.Color(opts.shadowTint)
    : baseCol.clone().multiplyScalar(0.46).offsetHSL(0.04, 0.08, 0);
  const rimCol = opts.rimColor ? new THREE.Color(opts.rimColor) : new THREE.Color('#ffd494');
  const emissiveCol = opts.emissiveColor
    ? new THREE.Color(opts.emissiveColor)
    : new THREE.Color('#000000');

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uSunIntensity: shared.uSunIntensity,
      uSkyColor: shared.uSkyColor,
      uGroundColor: shared.uGroundColor,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
      uLanternGlow: shared.uLanternGlow,
      uBaseColor: { value: baseCol },
      uShadowColor: { value: shadowCol },
      uRimColor: { value: rimCol },
      uRimPower: { value: opts.rimPower ?? 2.8 },
      uRimStrength: { value: opts.rimStrength ?? 0.45 },
      uBrushScale: { value: opts.brushScale ?? 4.5 },
      uBrushStrength: { value: opts.brushStrength ?? 0.08 },
      uWindSway: { value: opts.windSway ?? 0.0 },
      uKomorebiStrength: { value: opts.komorebiStrength ?? 0.25 },
      uEmissiveColor: { value: emissiveCol },
      uEmissiveFactor: { value: opts.emissiveFactor ?? 0.0 },
    },
    vertexColors: opts.useVertexColors ?? false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWindSway;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      #ifdef USE_COLOR
        varying vec3 vColor;
      #endif

      void main() {
        vUv = uv;
        #ifdef USE_COLOR
          vColor = color;
        #endif
        vec3 pos = position;

        #ifdef USE_INSTANCING
          mat4 instMat = instanceMatrix;
        #else
          mat4 instMat = mat4(1.0);
        #endif

        vec4 worldPos4 = modelMatrix * instMat * vec4(pos, 1.0);

        if (uWindSway > 0.001) {
          float heightMask = max(0.0, pos.y);
          float wave = sin(uTime * 2.1 + worldPos4.x * 0.45 + worldPos4.z * 0.35) * 0.65
                     + cos(uTime * 3.4 + worldPos4.z * 0.7) * 0.35;
          worldPos4.x += wave * uWindSway * heightMask * 0.12;
          worldPos4.z += wave * uWindSway * heightMask * 0.08;
        }

        vWorldPos = worldPos4.xyz;
        mat3 normMat = mat3(modelMatrix * instMat);
        vNormal = normalize(normMat * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos4;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uSkyColor;
      uniform vec3 uGroundColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uLanternGlow;

      uniform vec3 uBaseColor;
      uniform vec3 uShadowColor;
      uniform vec3 uRimColor;
      uniform float uRimPower;
      uniform float uRimStrength;
      uniform float uBrushScale;
      uniform float uBrushStrength;
      uniform float uKomorebiStrength;
      uniform vec3 uEmissiveColor;
      uniform float uEmissiveFactor;

      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      #ifdef USE_COLOR
        varying vec3 vColor;
      #endif

      ${GLSL_NOISE_LIB}

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Painterly gouache brushstroke noise perturbation
        vec2 brushCoord = vWorldPos.xz * uBrushScale + vec2(vWorldPos.y * uBrushScale * 0.7);
        float stroke = fbm(brushCoord * vec2(1.6, 0.55)) - 0.5;
        float fineGrain = valueNoise(brushCoord * 4.5) - 0.5;

        float NdotL = dot(N, L) + stroke * uBrushStrength * 1.8;

        // 3-Band Ghibli Toon Ramp with soft artistic transitions
        float band1 = smoothstep(-0.12, 0.08, NdotL);
        float band2 = smoothstep(0.32, 0.52, NdotL);
        float band3 = smoothstep(0.76, 0.90, NdotL);

        vec3 baseAlbedo = uBaseColor;
        #ifdef USE_COLOR
          baseAlbedo *= vColor;
        #endif
        baseAlbedo *= (1.0 + stroke * uBrushStrength + fineGrain * (uBrushStrength * 0.5));

        vec3 shadowTone = uShadowColor;
        #ifdef USE_COLOR
          shadowTone *= vColor;
        #endif

        // Hemisphere sky/ground ambient tint
        float hemiFactor = N.y * 0.5 + 0.5;
        vec3 hemiAmbient = mix(uGroundColor, uSkyColor, hemiFactor) * 0.36;

        // Assemble 3-band cel color
        vec3 midTone = baseAlbedo * (0.85 + 0.15 * uSunColor);
        vec3 highTone = baseAlbedo * (1.06 + 0.25 * uSunColor * min(uSunIntensity, 2.2) * 0.45);
        vec3 peakTone = highTone * 1.12 + uSunColor * 0.08;

        vec3 celColor = mix(shadowTone + hemiAmbient * 0.45, midTone, band1);
        celColor = mix(celColor, highTone, band2);
        celColor = mix(celColor, peakTone, band3);

        // Komorebi dappled sunlight (drifting leaf canopy light pattern)
        if (uKomorebiStrength > 0.001 && N.y > 0.05) {
          vec2 canopyUv = vWorldPos.xz * 0.38 + vec2(uTime * 0.08, -uTime * 0.06);
          float dapple = smoothstep(0.56, 0.72, fbm(canopyUv));
          celColor += uSunColor * dapple * uKomorebiStrength * band1 * 0.22 * min(uSunIntensity, 2.0);
        }

        // Warm Fresnel Rim Light (stronger on sunlit/upward edges)
        float fresnel = pow(1.0 - max(0.0, dot(V, N)), uRimPower);
        float sunRimMask = smoothstep(-0.35, 0.6, dot(N, L) + 0.25);
        vec3 rimContribution = uRimColor * uSunColor * fresnel * uRimStrength * sunRimMask * (0.45 + 0.35 * uSunIntensity);
        celColor += rimContribution;

        // Warm roadside lantern & shrine light pools on nearby ground/props at Sunset & Twilight
        if (uLanternGlow > 0.2) {
          // Approximate distance to the path centerline where Toro lanterns & vending machine sit
          float pathCenter = sin(clamp(vWorldPos.z, -36.0, 38.0) * 0.085) * 6.5
                           + cos(clamp(vWorldPos.z, -36.0, 38.0) * 0.042 + 0.7) * 2.2 - 1.8;
          float dToPath = abs(vWorldPos.x - pathCenter);
          float lanternSpacing = abs(fract((vWorldPos.z - 6.0) / 9.5 + 0.5) - 0.5) * 9.5;
          float lanternPool = exp(- (dToPath * dToPath * 0.14 + lanternSpacing * lanternSpacing * 0.18));
          celColor += vec3(1.0, 0.62, 0.24) * lanternPool * uLanternGlow * 0.42;
        }

        // Emissive lantern/window glow
        if (uEmissiveFactor > 0.001) {
          celColor += uEmissiveColor * uEmissiveFactor * uLanternGlow;
        }

        // Exponential squared horizon fog
        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, 1.65));
        fogFactor = clamp(fogFactor, 0.0, 0.92);
        vec3 finalColor = mix(celColor, uFogColor, fogFactor);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

/**
 * Custom Painterly Cobblestone Path ShaderMaterial with 3-band toon shading,
 * procedural rounded river-stone pattern, warm lantern pools, and komorebi sunlight.
 */
export function createCobblestonePathMaterial(
  shared: SharedUniforms,
  cobbleMap: THREE.Texture
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uSunIntensity: shared.uSunIntensity,
      uSkyColor: shared.uSkyColor,
      uGroundColor: shared.uGroundColor,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
      uLanternGlow: shared.uLanternGlow,
      uCobbleMap: { value: cobbleMap },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv * vec2(2.0, 28.0);
        vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos4.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos4;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uSkyColor;
      uniform vec3 uGroundColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uLanternGlow;
      uniform sampler2D uCobbleMap;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      ${GLSL_NOISE_LIB}

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDir);
        vec3 texCol = texture2D(uCobbleMap, vUv).rgb;

        float stroke = fbm(vWorldPos.xz * 2.5) - 0.5;
        float NdotL = dot(N, L) + stroke * 0.14;

        float band1 = smoothstep(-0.1, 0.12, NdotL);
        float band2 = smoothstep(0.35, 0.58, NdotL);

        vec3 shadowCol = texCol * mix(vec3(0.38, 0.42, 0.52), uSkyColor * 0.55, 0.4);
        vec3 midCol = texCol * (0.72 + 0.22 * uSunColor * min(uSunIntensity, 2.0) * 0.5);
        vec3 litCol = texCol * (0.95 + 0.28 * uSunColor * min(uSunIntensity, 2.2) * 0.5);

        vec3 col = mix(shadowCol, midCol, band1);
        col = mix(col, litCol, band2);

        // Komorebi dappled sunlight along the path
        vec2 canopyUv = vWorldPos.xz * 0.36 + vec2(uTime * 0.08, -uTime * 0.06);
        float dapple = smoothstep(0.55, 0.72, fbm(canopyUv));
        col += uSunColor * dapple * 0.18 * band1 * min(uSunIntensity, 2.2);

        // Warm Toro lantern light pools at Sunset & Twilight
        if (uLanternGlow > 0.2) {
          float lanternSpacing = abs(fract((vWorldPos.z - 6.0) / 9.5 + 0.5) - 0.5) * 9.5;
          float pool = exp(-lanternSpacing * lanternSpacing * 0.18);
          col += vec3(1.0, 0.64, 0.26) * pool * uLanternGlow * 0.52;
        }

        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = clamp(1.0 - exp(-pow(dist * uFogDensity, 1.65)), 0.0, 0.92);
        col = mix(col, uFogColor, fogFactor);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Sky Dome ShaderMaterial featuring:
 * - Makoto Shinkai / Studio Ghibli atmospheric sky gradient
 * - Towering, fluffy volumetric-style cumulonimbus clouds (seamless 3D dome projection, zero atan seam)
 * - Self-shadowed cloud bases, warm silver/golden rim linings, sun disc & twilight stars
 */
export function createSkyDomeMaterial(shared: SharedUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uSkyTopColor: shared.uSkyTopColor,
      uSkyHorizonColor: shared.uSkyHorizonColor,
      uSkySunGlowColor: shared.uSkySunGlowColor,
      uCloudLitColor: shared.uCloudLitColor,
      uCloudShadowColor: shared.uCloudShadowColor,
      uCloudRimColor: shared.uCloudRimColor,
      uStarVisibility: shared.uStarVisibility,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyTopColor;
      uniform vec3 uSkyHorizonColor;
      uniform vec3 uSkySunGlowColor;
      uniform vec3 uCloudLitColor;
      uniform vec3 uCloudShadowColor;
      uniform vec3 uCloudRimColor;
      uniform float uStarVisibility;

      varying vec3 vWorldDir;

      ${GLSL_NOISE_LIB}

      // Billowy cumulonimbus density function
      float cloudFbm(vec2 p) {
        float f = 0.0;
        float amp = 0.55;
        mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          float n = valueNoise(p);
          float billow = 1.0 - abs(n * 2.0 - 1.0);
          f += amp * mix(n, billow, 0.58);
          p = rot * p * 2.02 + vec2(13.4, 29.1);
          amp *= 0.5;
        }
        return f;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        vec3 sunDir = normalize(uSunDir);

        // 1. Sky gradient
        float elev = clamp(dir.y, 0.0, 1.0);
        float horizonCurve = pow(1.0 - elev, 2.6);
        vec3 skyCol = mix(uSkyTopColor, uSkyHorizonColor, horizonCurve);

        // Warm solar atmospheric scattering & sun disc
        float sunAmt = max(0.0, dot(dir, sunDir));
        skyCol += uSkySunGlowColor * pow(sunAmt, 6.0) * 0.48;
        float sunDisc = smoothstep(0.9965, 0.9992, sunAmt);
        skyCol += uSkySunGlowColor * sunDisc * 2.2;

        // 2. Twilight stars in upper sky dome
        if (uStarVisibility > 0.01 && elev > 0.12) {
          vec2 starUv = dir.xz / (dir.y + 0.35) * 95.0;
          float starHash = hash21(floor(starUv));
          vec2 starFract = fract(starUv) - 0.5;
          float starSpot = smoothstep(0.18, 0.02, length(starFract));
          float twinkle = 0.65 + 0.35 * sin(uTime * 2.5 + starHash * 40.0);
          float starMask = step(0.986, starHash) * starSpot * twinkle * smoothstep(0.12, 0.45, elev);
          skyCol += vec3(1.0, 0.97, 0.9) * starMask * uStarVisibility * 1.4;
        }

        // 3. Seamless Towering Volumetric-Style Cumulonimbus Clouds (zero atan discontinuity)
        if (dir.y > -0.02 && dir.y < 0.72) {
          // Seamless dome projection using normalized horizontal vector + elevation
          vec2 domeXZ = dir.xz / (dir.y + 0.38);
          vec2 cloudUv = domeXZ * 1.35 + vec2(uTime * 0.008, uTime * 0.004);

          float towerHeight = 0.20 + 0.28 * fbm(domeXZ * 0.65 + vec2(2.1, 1.4));
          float puffs = cloudFbm(cloudUv * 1.35);
          float detailPuffs = cloudFbm(cloudUv * 3.1 - vec2(uTime * 0.01, 0.0));

          float verticalEnvelope = smoothstep(0.01, 0.07, dir.y) *
                                   smoothstep(towerHeight + 0.18, towerHeight - 0.08, dir.y);
          float density = smoothstep(0.46, 0.67, puffs * 0.78 + detailPuffs * 0.22 + verticalEnvelope * 0.36 - 0.26)
                        * verticalEnvelope;

          if (density > 0.005) {
            // Directional derivative toward sun for volumetric 3-band self-shadowing
            vec2 lightOffset = normalize(sunDir.xz + vec2(0.001)) * 0.08;
            float sampleTowardSun = cloudFbm((cloudUv + lightOffset) * 1.35);
            float lightGrad = clamp((sampleTowardSun - puffs) * 3.6 + dir.y * 1.5 + 0.46, 0.0, 1.0);

            float cBand1 = smoothstep(0.25, 0.42, lightGrad);
            float cBand2 = smoothstep(0.62, 0.78, lightGrad);

            vec3 cloudCol = mix(uCloudShadowColor, mix(uCloudShadowColor, uCloudLitColor, 0.65), cBand1);
            cloudCol = mix(cloudCol, uCloudLitColor, cBand2);

            // Golden/silver lining around cloud edges near the sun
            float edgeRim = (1.0 - smoothstep(0.05, 0.55, density)) * pow(max(0.0, sunAmt), 1.8);
            cloudCol += uCloudRimColor * edgeRim * 1.15;

            float horizonFade = smoothstep(0.0, 0.09, dir.y);
            cloudCol = mix(uSkyHorizonColor, cloudCol, horizonFade);

            skyCol = mix(skyCol, cloudCol, clamp(density * 1.25, 0.0, 0.96));
          }
        }

        if (dir.y < 0.0) {
          skyCol = mix(uSkyHorizonColor, uSkyTopColor * 0.4, clamp(-dir.y * 3.0, 0.0, 1.0));
        }

        gl_FragColor = vec4(skyCol, 1.0);
      }
    `,
  });
}

/**
 * Sparkling Turquoise Setouchi Ocean ShaderMaterial featuring:
 * - Multi-wave Gerstner/sine vertex displacement
 * - Analytic island shoreline distance & animated foam ripples along the beach/tetrapods/pier
 * - Ray-marched sky & cloud reflections + glittering anime sun sparkles
 */
export function createOceanMaterial(shared: SharedUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uSkyTopColor: shared.uSkyTopColor,
      uSkyHorizonColor: shared.uSkyHorizonColor,
      uWaterShallowColor: shared.uWaterShallowColor,
      uWaterDeepColor: shared.uWaterDeepColor,
      uWaterFoamColor: shared.uWaterFoamColor,
      uWaterSunSpecColor: shared.uWaterSunSpecColor,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float waveHeight(vec2 p, float t) {
        float w1 = sin(p.x * 0.35 + p.y * 0.25 + t * 1.4) * 0.09;
        float w2 = cos(p.x * 0.22 - p.y * 0.42 + t * 1.1) * 0.07;
        float w3 = sin(p.x * 0.85 + p.y * 0.75 - t * 2.1) * 0.03;
        return w1 + w2 + w3;
      }

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        float h = waveHeight(worldPos.xz, uTime);
        worldPos.y += h;

        // Finite difference normal
        float eps = 0.25;
        float hx = waveHeight(worldPos.xz + vec2(eps, 0.0), uTime) - h;
        float hz = waveHeight(worldPos.xz + vec2(0.0, eps), uTime) - h;
        vNormal = normalize(vec3(-hx / eps, 1.0, -hz / eps));
        vWorldPos = worldPos.xyz;

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyTopColor;
      uniform vec3 uSkyHorizonColor;
      uniform vec3 uWaterShallowColor;
      uniform vec3 uWaterDeepColor;
      uniform vec3 uWaterFoamColor;
      uniform vec3 uWaterSunSpecColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      varying vec3 vWorldPos;
      varying vec3 vNormal;

      ${GLSL_NOISE_LIB}

      // Approximate island radial footprint for shoreline depth & foam ripples
      float approxIslandDepth(vec2 xz) {
        vec2 c = vec2(xz.x + 1.5, xz.y + 4.0);
        float radial = length(vec2(c.x * 0.92, c.y * 0.78));
        float shapePerturb = sin(xz.x * 0.11 + xz.y * 0.09) * 2.2 + cos(xz.x * 0.07 - xz.y * 0.12) * 1.8;
        float shoreDist = (radial + shapePerturb) - 38.5;

        // Also create foam around the southern pier (x ~ -1.5, z ~ 34..47)
        float pierDist = max(abs(xz.x - (-1.2)) - 2.3, max(33.5 - xz.y, xz.y - 47.0));
        return min(shoreDist, max(0.0, pierDist));
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Add procedural normal ripple detail
        vec2 rippleUv1 = vWorldPos.xz * 0.42 + vec2(uTime * 0.18, uTime * 0.12);
        vec2 rippleUv2 = vWorldPos.xz * 0.78 - vec2(uTime * 0.14, -uTime * 0.21);
        float n1 = valueNoise(rippleUv1);
        float n2 = valueNoise(rippleUv2);
        N = normalize(N + vec3((n1 - 0.5) * 0.22, 0.0, (n2 - 0.5) * 0.22));

        // Depth-based turquoise to deep Setouchi cobalt color
        float shoreMetric = approxIslandDepth(vWorldPos.xz);
        float depthFactor = smoothstep(-2.0, 18.0, shoreMetric);
        vec3 waterCol = mix(uWaterShallowColor, uWaterDeepColor, depthFactor);

        // Painterly wave band patterns
        float waveBand = smoothstep(0.48, 0.65, fbm(vWorldPos.xz * 0.18 + vec2(0.0, uTime * 0.09)));
        waterCol = mix(waterCol, uWaterShallowColor * 1.18, waveBand * (1.0 - depthFactor * 0.6) * 0.35);

        // Ray-marched style sky & cloud reflection via reflection vector
        vec3 R = reflect(-V, N);
        float fresnel = pow(1.0 - max(0.0, dot(V, N)), 3.2);
        vec3 reflSky = mix(uSkyHorizonColor, uSkyTopColor, clamp(R.y * 1.4, 0.0, 1.0));
        float reflCloud = smoothstep(0.54, 0.72, fbm(R.xz * 3.5 + vec2(uTime * 0.02)));
        reflSky = mix(reflSky, uWaterFoamColor, reflCloud * 0.45);
        waterCol = mix(waterCol, reflSky, clamp(fresnel * 0.68, 0.08, 0.72));

        // Animated shoreline foam ripples (3 concentric lapping rings)
        if (shoreMetric < 6.5 && shoreMetric > -4.5) {
          float shorePhase = shoreMetric * 1.65 - uTime * 1.8 + fbm(vWorldPos.xz * 0.45) * 2.4;
          float ring = smoothstep(0.62, 0.88, sin(shorePhase));
          float shoreEnvelope = smoothstep(6.2, 0.2, shoreMetric) * smoothstep(-4.2, -0.5, shoreMetric);
          float foamLace = step(0.42, ring * shoreEnvelope + (n1 - 0.45) * 0.35);
          waterCol = mix(waterCol, uWaterFoamColor, foamLace * 0.88);
        }

        // Anime glittering solar specular sparkles on water
        vec3 H = normalize(L + V);
        float NdotH = max(0.0, dot(N, H));
        float specBroad = pow(NdotH, 28.0);
        float sparkleGrid = valueNoise(vWorldPos.xz * 2.4 + vec2(uTime * 1.6, -uTime * 1.3));
        float sparkle = step(0.86, specBroad * 1.35 + sparkleGrid * 0.42);
        waterCol += uWaterSunSpecColor * (specBroad * 0.65 + sparkle * 1.45);

        // Horizon fog
        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = clamp(1.0 - exp(-pow(dist * uFogDensity, 1.65)), 0.0, 0.94);
        vec3 finalCol = mix(waterCol, uFogColor, fogFactor);

        gl_FragColor = vec4(finalCol, 0.93);
      }
    `,
  });
}

/**
 * Lush Hillside Grass Instanced ShaderMaterial with wind-sway wave ripples,
 * root-to-tip Ghibli color gradient, and komorebi sunlight highlights.
 */
export function createGrassShaderMaterial(shared: SharedUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uSunIntensity: shared.uSunIntensity,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
      uBaseGreen: { value: new THREE.Color('#2f6e3b') },
      uTipGreen: { value: new THREE.Color('#8cd156') },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWindGust;

      ${GLSL_NOISE_LIB}

      void main() {
        vUv = uv;
        vec3 pos = position;

        #ifdef USE_INSTANCING
          mat4 instMat = instanceMatrix;
        #else
          mat4 instMat = mat4(1.0);
        #endif

        vec4 worldBase = modelMatrix * instMat * vec4(0.0, 0.0, 0.0, 1.0);

        // Rolling wind meadow wave across the hillside
        float gust = fbm(worldBase.xz * 0.09 + vec2(uTime * 0.42, uTime * 0.26));
        float sway = (sin(uTime * 2.6 + worldBase.x * 0.35 + worldBase.z * 0.25) * 0.25 + (gust - 0.45) * 0.65)
                   * pow(uv.y, 1.5);

        pos.x += sway;
        pos.z += sway * 0.6;

        vec4 worldPos = modelMatrix * instMat * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        vWindGust = gust;

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uBaseGreen;
      uniform vec3 uTipGreen;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWindGust;

      void main() {
        vec3 col = mix(uBaseGreen, uTipGreen, smoothstep(0.05, 0.92, vUv.y));
        // Highlight wind-swept waves with warm sunlight
        float waveHighlight = smoothstep(0.52, 0.78, vWindGust) * vUv.y;
        col += uSunColor * waveHighlight * 0.28 * min(uSunIntensity, 2.2);

        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = clamp(1.0 - exp(-pow(dist * uFogDensity, 1.65)), 0.0, 0.92);
        col = mix(col, uFogColor, fogFactor);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
