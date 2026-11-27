/**
 * SATI Studio-Grade 3D Low-Poly Fortune-Teller Tent Engine (Three.js + GLTFLoader + Bloom IBL)
 * - โหลดโมเดล 3D Low-Poly (.glb) ทั้ง 4 ชุดผ่าน GLTFLoader:
 *   1. /models/sanctuary_room.glb  (กระโจมหมอดู + พรมแขวนผนัง 3 ผืน + ลูกแก้วคริสตัลขาตั้ง 3 ขา + โพชัน)
 *   2. /models/divination_table.glb (โต๊ะแปดเหลี่ยมผ้ากำมะหยี่ขอบทอง + พู่ห้อย + เชิงเทียน)
 *   3. /models/sati_custom.glb (ถ้ามี) หรือ /models/sati_archmage.glb (หมอดูสติ ผ้าโพกศีรษะและชุดปักทอง)
 *   4. /models/player_hands.glb    (มือผู้เล่นสวมกำไลทองและแหวนอัญมณีซ้าย/ขวา)
 * - ใช้ RoomEnvironment IBL + 2048x2048 PCFSoftShadow + EffectComposer (UnrealBloomPass + OutputPass)
 * - ผสาน Procedural CanvasTexture สำหรับลายปักเสื้อคลุม ผ้ากำมะหยี่ปูโต๊ะ พรมแขวน และผนังกระโจม
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCardBackTexture, createCardFrontTexture } from '../data/tarot78.js';
import {
  createRobeEmbroideryTexture,
  createVelvetTableClothTexture,
  createTapestryTexture,
  createTentWallTexture
} from './proceduralTextures.js';

export const CAM_POS = {
  login: new THREE.Vector3(0, 4.1, 8.1),
  loginLook: new THREE.Vector3(0, 2.0, -2.0),
  ledger: new THREE.Vector3(0, 2.9, 3.6),
  ledgerLook: new THREE.Vector3(0, 0.95, 1.25),
  view1P: new THREE.Vector3(0, 3.22, 4.44),
  view1PLook: new THREE.Vector3(0, 1.42, -0.50),
  view2P: new THREE.Vector3(0, 5.25, 2.05),
  view2PLook: new THREE.Vector3(0, 0.95, 0.15)
};

export function createSati3DEngine(options = {}) {
  const {
    canvas,
    state,
    qualityMode: initialQualityOption,
    onCardPicked,
    onSpreadCardInspect,
    onCrystalInspect,
    onDiscardInspect,
    onModelsLoaded,
    onSpreadProjection: directOnSpreadProjection,
    callbacks
  } = options || {};
  const onSpreadProjection = typeof directOnSpreadProjection === 'function'
    ? directOnSpreadProjection
    : (typeof callbacks?.onSpreadProjection === 'function' ? callbacks.onSpreadProjection : null);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#130b16');
  scene.fog = new THREE.FogExp2('#130b16', 0.032);

  const isCompactDevice = () =>
    (typeof window !== 'undefined' && window.innerWidth < 820) ||
    (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

  const normalizeQualityMode = (mode) =>
    mode === 'high' || mode === 'low' || mode === 'auto' ? mode : 'auto';

  const setDocumentPerfDataset = (val) => {
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.satiPerf = val;
    }
  };

  let qualityMode = normalizeQualityMode(initialQualityOption ?? state?.graphicsQuality);
  let adaptiveDprCapOverride = null;
  let adaptiveShadowsDisabled = false;
  let slowFrameCount = 0;

  const resolveQualityConfig = (mode) => {
    const normalized = normalizeQualityMode(mode);
    const compact = isCompactDevice();
    if (normalized === 'high') {
      return {
        mode: 'high',
        useTransmission: true,
        useBloom: true,
        shadowMapSize: 1536,
        shadowsEnabled: true,
        dprCap: 1.75,
        particlesVisible: true,
        perfTag: 'high'
      };
    }
    if (normalized === 'low') {
      return {
        mode: 'low',
        useTransmission: false,
        useBloom: false,
        shadowMapSize: 512,
        shadowsEnabled: false,
        dprCap: 1.0,
        particlesVisible: false,
        perfTag: 'low'
      };
    }
    return {
      mode: 'auto',
      useTransmission: false,
      useBloom: !compact,
      shadowMapSize: compact ? 512 : 1024,
      shadowsEnabled: true,
      dprCap: compact ? 1.25 : 1.5,
      particlesVisible: true,
      perfTag: compact ? 'low' : 'auto'
    };
  };

  const initialQualityCfg = resolveQualityConfig(qualityMode);
  let useTransmissionCrystal = initialQualityCfg.useTransmission;
  let useBloomComposer = initialQualityCfg.useBloom;

  const getCappedDpr = () => {
    let cap = resolveQualityConfig(qualityMode).dprCap;
    if (qualityMode === 'auto' && adaptiveDprCapOverride !== null) {
      cap = Math.min(cap, adaptiveDprCapOverride);
    }
    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    return Math.min(rawDpr, cap);
  };

  let cachedViewport = null;
  function updateCachedViewport(fallbackW = 0, fallbackH = 0) {
    let rect = null;
    if (typeof canvas?.getBoundingClientRect === 'function') {
      rect = canvas.getBoundingClientRect();
    }
    const left = Number.isFinite(Number(rect?.left)) ? Number(rect.left) : 0;
    const top = Number.isFinite(Number(rect?.top)) ? Number(rect.top) : 0;
    const winW = typeof window !== 'undefined' ? Number(window.innerWidth) : 0;
    const winH = typeof window !== 'undefined' ? Number(window.innerHeight) : 0;
    const rectW = Number(rect?.width) || 0;
    const rectH = Number(rect?.height) || 0;
    let width = rectW || Number(canvas?.clientWidth) || Number(fallbackW) || winW || Number(canvas?.width) || 0;
    let height = rectH || Number(canvas?.clientHeight) || Number(fallbackH) || winH || Number(canvas?.height) || 0;
    if (
      Number.isFinite(fallbackW) &&
      Number.isFinite(fallbackH) &&
      fallbackW > 0 &&
      fallbackH > 0 &&
      winW > 0 &&
      winH > 0 &&
      (Math.abs(width - fallbackW) > 1 || Math.abs(height - fallbackH) > 1)
    ) {
      width = fallbackW;
      height = fallbackH;
    }
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      cachedViewport = { left, top, width, height };
    } else {
      cachedViewport = null;
    }
    return cachedViewport;
  }

  const initViewport = updateCachedViewport();
  const winW0 = typeof window !== 'undefined' ? Number(window.innerWidth) : 0;
  const winH0 = typeof window !== 'undefined' ? Number(window.innerHeight) : 0;
  const initWidth = initViewport ? initViewport.width : Math.max(1, winW0 || 1);
  const initHeight = initViewport ? initViewport.height : Math.max(1, winH0 || 1);

  const currentCamPos = CAM_POS.login.clone();
  const currentCamLook = CAM_POS.loginLook.clone();
  let targetCamPos = CAM_POS.login.clone();
  let targetCamLook = CAM_POS.loginLook.clone();
  let animFrameId = null;
  let isDisposed = false;
  let contextLost = false;
  let currentAspect = initWidth / Math.max(1, initHeight);
  let camAspectZOffset = 0;
  let camAspectYOffset = 0;

  const camera = new THREE.PerspectiveCamera(48, currentAspect, 0.1, 50);
  camera.position.copy(currentCamPos);
  camera.lookAt(currentCamLook);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(initWidth, initHeight);
  renderer.setPixelRatio(getCappedDpr());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = initialQualityCfg.shadowsEnabled;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('transmissionResolutionScale' in renderer) {
    renderer.transmissionResolutionScale = isCompactDevice() ? 0.35 : 0.55;
  }

  // Image-Based Lighting (RoomEnvironment) for realistic metallic gold & crystal reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.36;
  pmremGenerator.dispose();

  // Post-Processing Pipeline: RenderPass -> Half-Res Selective Bloom -> ToneMapped OutputPass
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(getCappedDpr());
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, Math.floor(initWidth * 0.5)), Math.max(1, Math.floor(initHeight * 0.5))),
    0.26,
    0.4,
    0.95
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  let pointerMoved = false;
  let pointerValid = false;
  let pointerBlockedByUI = false;
  let frameCounter = 0;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
  const cardBackTex = createCardBackTexture();
  cardBackTex.anisotropy = maxAniso;

  // Studio Procedural Canvas Textures mapped onto GLB materials by material.name
  const textureMapByMaterial = {
    RobeEmbroidered: createRobeEmbroideryTexture(),
    TableVelvet: createVelvetTableClothTexture(),
    TapestrySunEye: createTapestryTexture('sun_eye'),
    TapestrySacredOrb: createTapestryTexture('sacred_orb'),
    TapestryStarNight: createTapestryTexture('star_night'),
    TentWalls: createTentWallTexture()
  };

  let satiGroup = null;
  let satiHead = null;
  let satiLeftArm = null;
  let satiRightArm = null;
  let satiHeadBaseY = 1.56;
  let satiGroupBaseY = 0.58;
  let satiHasRigNodes = false;
  let satiMixer = null;
  let satiActions = {};
  let activeSatiClip = '';
  let satiEyeLBone = null;
  let satiEyeRBone = null;
  let satiHeadBone = null;
  let gazeX = 0;
  let gazeY = 0;
  let elapsedTime = 0;
  let playerLeftHand = null;
  let playerRightHand = null;
  let arcaneParticles = null;

  const candleLights = [];
  const orbSpinMeshes = [];
  const orbCoreMeshes = [];
  const tabletopCrystalMeshes = [];
  const crystalMaterials = [];
  let crystalTapBoostUntil = 0;
  let tabletopCrystalLight = null;
  const CORE_COLOR_VIOLET = new THREE.Color('#7b2cbf');
  const CORE_COLOR_CYAN = new THREE.Color('#00f5d4');
  const TABLE_CRYSTAL_LIGHT_COLOR = new THREE.Color('#b388ff');

  // Pre-allocated zero-GC scratch objects for 60 FPS animate3D loop
  const _restLeftPos = new THREE.Vector3();
  const _restRightPos = new THREE.Vector3();
  const _targetLeftPos = new THREE.Vector3();
  const _targetRightPos = new THREE.Vector3();
  const _tmpSpreadTarget = new THREE.Vector3();
  const _projWorldVec = new THREE.Vector3();
  const _projCamVec = new THREE.Vector3();
  const _tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const _tmpQuat = new THREE.Quaternion();
  const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
  const BASE_HAND_SCALE = 1.88;
  const PROJECTION_DELTA_THRESHOLD = 0.35;
  let handRigL = null;
  let handRigR = null;
  let lastProjectedSpread = [];

  function applyCrystalMaterialQuality(mat) {
    if (!mat) return;
    mat.emissiveIntensity = useTransmissionCrystal ? 0.14 : 0.24;
    mat.transmission = useTransmissionCrystal ? 0.92 : 0;
    mat.opacity = useTransmissionCrystal ? 0.92 : 0.72;
    mat.needsUpdate = true;
  }

  function createFacetedCrystalMaterial(hasVertexColors = false) {
    const mat = new THREE.MeshPhysicalMaterial({
      name: 'CrystalOrbIridescent',
      color: 0xffffff,
      emissive: new THREE.Color('#6a48c4'),
      emissiveIntensity: useTransmissionCrystal ? 0.14 : 0.24,
      transmission: useTransmissionCrystal ? 0.92 : 0,
      ior: 1.52,
      thickness: 1.0,
      dispersion: 0.09,
      roughness: 0.08,
      metalness: 0.06,
      iridescence: 1.0,
      iridescenceIOR: 1.48,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.25,
      flatShading: true,
      transparent: true,
      opacity: useTransmissionCrystal ? 0.92 : 0.72,
      depthWrite: false,
      vertexColors: hasVertexColors
    });
    crystalMaterials.push(mat);
    return mat;
  }

  function createNebulaCoreMaterial() {
    return new THREE.MeshStandardMaterial({
      name: 'CrystalOrbCore',
      color: 0x000000,
      emissive: new THREE.Color('#7b2cbf'),
      emissiveIntensity: 1.6,
      roughness: 0.12,
      metalness: 0.08,
      flatShading: true
    });
  }
  let fanCardMeshes = [];
  let spreadCardMeshes = [];
  let discardCardMeshes = [];
  let hoveredCardMesh = null;
  let isFanSettled = false;
  let wasPickingForFan = Boolean(state?.isPicking);
  let lastShadowUpdateAt = 0;
  let playerShuffleGatherUntil = 0;
  let playerShuffleUntil = 0;
  const activeTimers = new Set();

  function requestShadowUpdate(immediate = true) {
    if (isDisposed || !renderer.shadowMap.enabled) return;
    renderer.shadowMap.needsUpdate = true;
    if (immediate) {
      lastShadowUpdateAt = elapsedTime;
    }
  }

  function syncPixelRatio() {
    const dpr = getCappedDpr();
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
  }

  // Warm Fortune-Teller Tent Lighting (<= 4 Active Real-Time Lights: hemiLight, keyLight, warmTableSpot, tabletopCrystalLight)
  const hemiLight = new THREE.HemisphereLight('#ffd8b0', '#1a0816', 0.82);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#ffe4c4', 1.48);
  keyLight.position.set(2.4, 6.2, 4.6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(initialQualityCfg.shadowMapSize, initialQualityCfg.shadowMapSize);
  keyLight.shadow.camera.near = 1.0;
  keyLight.shadow.camera.far = 16;
  keyLight.shadow.camera.left = -4.5;
  keyLight.shadow.camera.right = 4.5;
  keyLight.shadow.camera.top = 4.5;
  keyLight.shadow.camera.bottom = -4.5;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const warmTableSpot = new THREE.SpotLight('#ffb866', 6.2, 11, Math.PI / 3.4, 0.58, 1.4);
  warmTableSpot.position.set(0, 4.2, 1.4);
  warmTableSpot.target.position.set(0, 0.95, 0.2);
  scene.add(warmTableSpot, warmTableSpot.target);

  function applyQualityMode(nextMode) {
    const cfg = resolveQualityConfig(nextMode);
    qualityMode = cfg.mode;
    slowFrameCount = 0;
    adaptiveDprCapOverride = null;
    adaptiveShadowsDisabled = false;
    useTransmissionCrystal = cfg.useTransmission;
    useBloomComposer = cfg.useBloom;

    crystalMaterials.forEach(applyCrystalMaterialQuality);
    if (arcaneParticles) {
      arcaneParticles.visible = cfg.particlesVisible;
    }

    renderer.shadowMap.enabled = cfg.shadowsEnabled;
    renderer.shadowMap.autoUpdate = false;
    if (cfg.shadowsEnabled) {
      if (keyLight.shadow.mapSize.x !== cfg.shadowMapSize || keyLight.shadow.mapSize.y !== cfg.shadowMapSize) {
        keyLight.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
        if (keyLight.shadow.map) {
          keyLight.shadow.map.dispose();
          keyLight.shadow.map = null;
        }
      }
      requestShadowUpdate(true);
    }

    syncPixelRatio();
    setDocumentPerfDataset(cfg.perfTag);
    return qualityMode;
  }

  function enhanceStudioLowPolyGLB(rootObj) {
    rootObj.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;
      if (!child.material) return;

      const matName = child.material.name;

      // Upgrade Iridescent Crystal Orb to MeshPhysicalMaterial preserving COLOR_0 vertexColors
      if (matName === 'CrystalOrbIridescent') {
        const phys = createFacetedCrystalMaterial(Boolean(child.geometry?.attributes?.color));
        child.material = phys;
        child.castShadow = false;
        orbSpinMeshes.push(child);
        return;
      }

      if (matName === 'CrystalOrbCore') {
        child.material = createNebulaCoreMaterial();
        child.castShadow = false;
        orbCoreMeshes.push(child);
        return;
      } else if (matName === 'TurbanJewelGlow') {
        child.material.emissiveIntensity = 1.25;
      } else if (matName === 'CandleFlame') {
        child.material.emissiveIntensity = 1.35;
        child.castShadow = false;
      }

      // Bind procedural CanvasTextures for tapestry art, velvet table, robe embroidery & tent walls
      const procTex = textureMapByMaterial[matName];
      if (procTex) {
        child.material.map = procTex;
        child.material.color.setHex(0xffffff);
        if (matName.startsWith('Tapestry')) {
          child.material.side = THREE.DoubleSide;
        }
      }

      child.material.flatShading = true;
      child.material.needsUpdate = true;
    });
  }

  function registerFlickerFlame(parentObj, nodeName, baseIntensity) {
    const flameObj = parentObj.getObjectByName(nodeName);
    if (!flameObj) return;
    candleLights.push({
      flame: flameObj,
      baseY: flameObj.position.y,
      baseScaleX: flameObj.scale.x || 1,
      baseScaleY: flameObj.scale.y || 1,
      baseScaleZ: flameObj.scale.z || 1,
      baseIntensity
    });
  }

  // Build Floating Arcane Dust Particles in the Tent
  function createArcaneParticles() {
    const count = 84;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8.5;
      positions[i * 3 + 1] = 0.65 + Math.random() * 4.8;
      positions[i * 3 + 2] = -4.8 + Math.random() * 6.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#f5d473',
      size: 0.048,
      transparent: true,
      opacity: 0.58
    });
    arcaneParticles = new THREE.Points(geo, mat);
    arcaneParticles.visible = resolveQualityConfig(qualityMode).particlesVisible;
    scene.add(arcaneParticles);
  }

  async function tryLoadCustomGLB(loader, loadGLB, url) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) return null;
      return await loadGLB(url);
    } catch {
      return null;
    }
  }

  function extractHandRig(handObj, suffix) {
    if (!handObj) return null;
    const rig = { root: handObj, bones: {} };
    ['Wrist', 'Palm', ...FINGER_NAMES.flatMap((f) => [`${f}1`, `${f}2`])].forEach((bKey) => {
      const node = handObj.getObjectByName(`${bKey}_${suffix}`);
      if (node) {
        rig.bones[bKey] = {
          node,
          baseQuat: node.quaternion.clone(),
          curCurl: 0,
          curSplay: 0
        };
      }
    });
    return rig;
  }

  function poseHandFingers(rig, curls, splays, damp) {
    if (!rig?.bones) return;
    FINGER_NAMES.forEach((fName, idx) => {
      const b1 = rig.bones[`${fName}1`];
      const b2 = rig.bones[`${fName}2`];
      const targetC = curls[idx] ?? 0;
      const targetS = splays?.[idx] ?? 0;
      if (b1) {
        b1.curCurl += (targetC * 0.72 - b1.curCurl) * damp;
        b1.curSplay += (targetS - b1.curSplay) * damp;
        _tmpEuler.set(-b1.curCurl, b1.curSplay, 0, 'XYZ');
        _tmpQuat.setFromEuler(_tmpEuler);
        b1.node.quaternion.copy(b1.baseQuat).multiply(_tmpQuat);
      }
      if (b2) {
        b2.curCurl += (targetC * 0.96 - b2.curCurl) * damp;
        _tmpEuler.set(-b2.curCurl, 0, 0, 'XYZ');
        _tmpQuat.setFromEuler(_tmpEuler);
        b2.node.quaternion.copy(b2.baseQuat).multiply(_tmpQuat);
      }
    });
  }

  // Load all 4 GLB models from /models/*.glb (with optional Blender custom upgrades)
  async function loadAllGLBModels() {
    const loader = new GLTFLoader();
    const loadGLB = (url) =>
      new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

    const [roomGltf, tableGltf, customSatiGltf, customHandsGltf] = await Promise.all([
      loadGLB('/models/sanctuary_room.glb'),
      loadGLB('/models/divination_table.glb'),
      tryLoadCustomGLB(loader, loadGLB, '/models/sati_custom.glb'),
      tryLoadCustomGLB(loader, loadGLB, '/models/player_hands_custom.glb')
    ]);
    const [satiGltf, handsGltf] = await Promise.all([
      customSatiGltf ? Promise.resolve(customSatiGltf) : loadGLB('/models/sati_archmage.glb'),
      customHandsGltf ? Promise.resolve(customHandsGltf) : loadGLB('/models/player_hands.glb')
    ]);

    // 1. Fortune-Teller Tent Sanctuary GLB
    const roomScene = roomGltf.scene;
    enhanceStudioLowPolyGLB(roomScene);
    for (let i = 0; i < 3; i++) {
      registerFlickerFlame(roomScene, `ShelfFlame_${i}`, 0.72, 4.5);
    }
    scene.add(roomScene);

    // 2. Octagonal Divination Table GLB
    const tableScene = tableGltf.scene;
    enhanceStudioLowPolyGLB(tableScene);
    for (let i = 0; i < 6; i++) {
      registerFlickerFlame(tableScene, `CandleFlame_${i}`, 0.85, 4.8);
    }
    // Register TabletopCrystalBall meshes for hover/tap scrying raycast (F4/F9)
    const tabletopOrbObj = tableScene.getObjectByName('TabletopCrystalBall');
    if (tabletopOrbObj) {
      tabletopOrbObj.traverse((child) => {
        if (child.isMesh) {
          tabletopCrystalMeshes.push(child);
        }
      });
    }
    // Center Tabletop Crystal Ball PointLight with gentle breathing pulsation (F5)
    tabletopCrystalLight = new THREE.PointLight('#b388ff', 1.8, 3.8, 1.5);
    tabletopCrystalLight.position.set(0, 1.28, -0.92);
    tabletopCrystalLight.castShadow = false;
    scene.add(tabletopCrystalLight);

    scene.add(tableScene);

    // 3. Fortune-Teller Sati GLB (Blender Rigged Living Character, custom drop-in, or compiled studio character)
    satiGroup = satiGltf.scene;
    const hasBlenderClips = Boolean(satiGltf.animations && satiGltf.animations.length > 0);
    const isBlenderRig = Boolean(satiGroup.getObjectByName('SatiBlenderRig')) || hasBlenderClips;
    if (customSatiGltf && isBlenderRig) {
      satiGroup.traverse((child) => {
        if (!child.isMesh) return;
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = false;
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        const matName = child.material?.name;
        if (matName === 'CrystalOrbIridescent') {
          child.material = createFacetedCrystalMaterial(Boolean(child.geometry?.attributes?.color));
          child.castShadow = false;
          orbSpinMeshes.push(child);
        } else if (matName === 'CrystalOrbCore') {
          child.material = createNebulaCoreMaterial();
          child.castShadow = false;
          orbCoreMeshes.push(child);
        } else if (matName === 'TurbanJewelGlow' && child.material) {
          child.material.emissiveIntensity = 1.3;
        }
      });

      satiGroup.scale.setScalar(1.0);
      satiGroup.position.set(0, 0.56, -2.55);
      satiGroupBaseY = 0.56;

      satiHeadBone = satiGroup.getObjectByName('Head') || null;
      satiEyeLBone = satiGroup.getObjectByName('Eye_L') || null;
      satiEyeRBone = satiGroup.getObjectByName('Eye_R') || null;

      if (hasBlenderClips) {
        satiMixer = new THREE.AnimationMixer(satiGroup);
        satiActions = {};
        satiGltf.animations.forEach((clip) => {
          satiActions[clip.name] = satiMixer.clipAction(clip);
        });
        if (satiActions.Idle) {
          satiActions.Idle.play();
          activeSatiClip = 'Idle';
        }
      }
    } else if (customSatiGltf) {
      satiGroup.traverse((child) => {
        if (!child.isMesh) return;
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        child.castShadow = true;
        child.receiveShadow = false;
        if (child.material) {
          child.material.flatShading = false;
          child.material.roughness = 0.82;
          child.material.needsUpdate = true;
        }
      });
      const box = new THREE.Box3().setFromObject(satiGroup);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = size.y > 0 ? 2.48 / size.y : 1;
      satiGroup.scale.setScalar(scale);
      satiGroup.position.set(-center.x * scale, 0.62 - box.min.y * scale, -2.20 - center.z * scale);
      satiGroupBaseY = satiGroup.position.y;
    } else {
      enhanceStudioLowPolyGLB(satiGroup);
      satiGroup.position.set(0, 0.58, -2.52);
      satiGroupBaseY = 0.58;
    }
    satiHead = satiGroup.getObjectByName('SatiHead');
    satiLeftArm = satiGroup.getObjectByName('SatiLeftArm');
    satiRightArm = satiGroup.getObjectByName('SatiRightArm');
    if (satiHead) satiHeadBaseY = satiHead.position.y;
    satiHasRigNodes = Boolean(!satiMixer && satiHead && satiLeftArm && satiRightArm);
    scene.add(satiGroup);

    // 4. Player First-Person Hands GLB (Blender Sculpted Rig or Articulated Fallback)
    const handsScene = handsGltf.scene;
    enhanceStudioLowPolyGLB(handsScene);
    handsScene.traverse((child) => {
      if (child.isSkinnedMesh || child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = true;
      }
    });
    playerLeftHand = handsScene.getObjectByName('PlayerLeftHand');
    playerRightHand = handsScene.getObjectByName('PlayerRightHand');
    if (playerLeftHand) playerLeftHand.scale.setScalar(BASE_HAND_SCALE);
    if (playerRightHand) playerRightHand.scale.setScalar(BASE_HAND_SCALE);
    handRigL = extractHandRig(playerLeftHand, 'L');
    handRigR = extractHandRig(playerRightHand, 'R');
    scene.add(handsScene);

    if (!isDisposed) {
      requestShadowUpdate(true);
    }
    state.modelsLoaded = true;
    if (onModelsLoaded) onModelsLoaded();
  }

  function getViewportDimensions() {
    if (
      cachedViewport &&
      Number.isFinite(cachedViewport.width) &&
      Number.isFinite(cachedViewport.height) &&
      cachedViewport.width > 0 &&
      cachedViewport.height > 0
    ) {
      return cachedViewport;
    }
    const winW = typeof window !== 'undefined' ? Number(window.innerWidth) : 0;
    const winH = typeof window !== 'undefined' ? Number(window.innerHeight) : 0;
    const width = winW || Number(canvas?.width) || 0;
    const height = winH || Number(canvas?.height) || 0;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return { left: 0, top: 0, width, height };
  }

  function hasSpreadProjectionChanged(nextItems) {
    if (nextItems.length !== lastProjectedSpread.length) return true;
    for (let i = 0; i < nextItems.length; i += 1) {
      const next = nextItems[i];
      const prev = lastProjectedSpread[i];
      if (
        next.slotIdx !== prev.slotIdx ||
        next.totalSlots !== prev.totalSlots ||
        next.visible !== prev.visible ||
        next.reversed !== prev.reversed ||
        next.cardName !== prev.cardName ||
        Math.abs(next.xPct - prev.xPct) > PROJECTION_DELTA_THRESHOLD ||
        Math.abs(next.yPct - prev.yPct) > PROJECTION_DELTA_THRESHOLD
      ) {
        return true;
      }
    }
    return false;
  }

  function emitSpreadProjection() {
    if (typeof onSpreadProjection !== 'function' || isDisposed) return;

    if (!Array.isArray(spreadCardMeshes) || spreadCardMeshes.length === 0) {
      if (lastProjectedSpread.length > 0) {
        lastProjectedSpread = [];
        onSpreadProjection([]);
      }
      return;
    }

    if (
      !camera ||
      typeof camera.updateMatrixWorld !== 'function' ||
      !camera.matrixWorldInverse ||
      !camera.projectionMatrix
    ) {
      return;
    }

    if (!getViewportDimensions()) return;

    camera.updateMatrixWorld();
    const totalSlotsFallback = spreadCardMeshes.length;
    const isScreenAllowed = !state?.screen || state.screen === 'game';
    const nextItems = [];

    for (let idx = 0; idx < spreadCardMeshes.length; idx += 1) {
      const mesh = spreadCardMeshes[idx];
      if (!mesh || typeof mesh.getWorldPosition !== 'function') continue;
      if (typeof mesh.updateMatrixWorld === 'function') {
        mesh.updateMatrixWorld();
      }

      mesh.getWorldPosition(_projWorldVec);
      if (
        !Number.isFinite(_projWorldVec.x) ||
        !Number.isFinite(_projWorldVec.y) ||
        !Number.isFinite(_projWorldVec.z)
      ) {
        continue;
      }

      // Project bottom-front edge of the card in camera view (+Z edge on top face)
      const scaleY = Number.isFinite(mesh.scale?.y) ? mesh.scale.y : 1;
      const scaleZ = Number.isFinite(mesh.scale?.z) ? mesh.scale.z : 1;
      _projWorldVec.y += 0.007 * scaleY;
      _projWorldVec.z += 0.17 * scaleZ;

      let isInFront = true;
      if (typeof _projCamVec.applyMatrix4 === 'function') {
        _projCamVec.copy(_projWorldVec).applyMatrix4(camera.matrixWorldInverse);
        isInFront = Number.isFinite(_projCamVec.z) && _projCamVec.z < -0.05;
      }

      if (typeof _projWorldVec.project !== 'function') continue;
      _projWorldVec.project(camera);

      const ndcValid =
        Number.isFinite(_projWorldVec.x) &&
        Number.isFinite(_projWorldVec.y) &&
        Number.isFinite(_projWorldVec.z);
      const rawXPct = ndcValid ? (_projWorldVec.x * 0.5 + 0.5) * 100 : 50;
      const rawYPct = ndcValid ? (-_projWorldVec.y * 0.5 + 0.5) * 100 : 50;

      const visible = Boolean(
        isScreenAllowed &&
        mesh.visible !== false &&
        isInFront &&
        ndcValid &&
        _projWorldVec.z >= -1 &&
        _projWorldVec.z <= 1 &&
        rawXPct >= 0 &&
        rawXPct <= 100 &&
        rawYPct >= 0 &&
        rawYPct <= 100
      );

      const xPct = Math.round(Math.max(0, Math.min(100, rawXPct)) * 100) / 100;
      const yPct = Math.round(Math.max(0, Math.min(100, rawYPct)) * 100) / 100;
      const cardData = mesh.userData?.cardData;

      nextItems.push({
        slotIdx: typeof mesh.userData?.slotIdx === 'number' ? mesh.userData.slotIdx : idx,
        totalSlots: typeof mesh.userData?.totalSlots === 'number' ? mesh.userData.totalSlots : totalSlotsFallback,
        xPct,
        yPct,
        visible,
        reversed: Boolean(mesh.userData?.reversed ?? cardData?.reversed),
        cardName: String(cardData?.name || cardData?.th || '')
      });
    }

    if (hasSpreadProjectionChanged(nextItems)) {
      lastProjectedSpread = nextItems.map((item) => ({ ...item }));
      onSpreadProjection(nextItems);
    }
  }

  function updateCameraForAspect() {
    const rawW = typeof window !== 'undefined' ? Number(window.innerWidth) : 0;
    const rawH = typeof window !== 'undefined' ? Number(window.innerHeight) : 0;
    const fallbackW = Number(canvas?.clientWidth) || Number(canvas?.width) || cachedViewport?.width || 1;
    const fallbackH = Number(canvas?.clientHeight) || Number(canvas?.height) || cachedViewport?.height || 1;
    const w = Math.max(1, Number.isFinite(rawW) && rawW > 0 ? rawW : fallbackW);
    const h = Math.max(1, Number.isFinite(rawH) && rawH > 0 ? rawH : fallbackH);
    const aspect = w / h;
    currentAspect = aspect;
    camera.aspect = aspect;

    if (aspect < 0.75) {
      // Mobile portrait viewports (aspect ~0.46 to 0.75): keep intimate table FOV >= 58 without backing camera too far
      const portraitFactor = Math.min(1, Math.max(0, (0.75 - aspect) / 0.30));
      camera.fov = 58;
      camAspectZOffset = 0.85 + portraitFactor * 1.15;
      camAspectYOffset = camAspectZOffset * 0.36;
    } else if (aspect < 1.0) {
      // Near-square / Tablet viewports (aspect 0.75 to 1.0)
      const squareFactor = (1.0 - aspect) / 0.25;
      camera.fov = 48 + squareFactor * 6;
      camAspectZOffset = squareFactor * 0.65;
      camAspectYOffset = squareFactor * 0.65 * 0.36;
    } else {
      // Desktop / Landscape viewports (aspect >= 1.0)
      camera.fov = 44;
      camAspectZOffset = 0;
      camAspectYOffset = 0;
    }
    spreadCardMeshes.forEach((m) => {
      if (m.userData.isSpreadCard && m.userData.totalSlots && m.userData.targetPos && Math.abs(m.userData.targetPos.x) <= 0.9) {
        applySpreadCardPose(m, m.userData.slotIdx, m.userData.totalSlots);
      }
    });

    isFanSettled = false;
    camera.updateProjectionMatrix();
    if (qualityMode === 'auto' && !adaptiveShadowsDisabled && adaptiveDprCapOverride === null) {
      const cfg = resolveQualityConfig('auto');
      useBloomComposer = cfg.useBloom;
      setDocumentPerfDataset(cfg.perfTag);
      if (renderer.shadowMap.enabled && (keyLight.shadow.mapSize.x !== cfg.shadowMapSize || keyLight.shadow.mapSize.y !== cfg.shadowMapSize)) {
        keyLight.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
        if (keyLight.shadow.map) {
          keyLight.shadow.map.dispose();
          keyLight.shadow.map = null;
        }
        requestShadowUpdate(true);
      }
    }
    syncPixelRatio();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
    updateCachedViewport(w, h);
    emitSpreadProjection();
  }

  function setCameraTarget(posVec, lookVec) {
    targetCamPos = posVec.clone();
    targetCamLook = lookVec.clone();
  }

  function disposeCardMesh(m, disposedGeos, disposedMats) {
    if (!m) return;
    scene.remove(m);
    if (m.geometry) {
      if (disposedGeos) {
        if (!disposedGeos.has(m.geometry)) {
          disposedGeos.add(m.geometry);
          m.geometry.dispose();
        }
      } else {
        m.geometry.dispose();
      }
    }
    if (m.material) {
      if (Array.isArray(m.material)) {
        m.material.forEach((mat) => {
          if (!mat) return;
          if (disposedMats) {
            if (!disposedMats.has(mat)) {
              disposedMats.add(mat);
              mat.dispose();
            }
          } else {
            mat.dispose();
          }
        });
      } else {
        if (disposedMats) {
          if (!disposedMats.has(m.material)) {
            disposedMats.add(m.material);
            m.material.dispose();
          }
        } else {
          m.material?.dispose();
        }
      }
    }
  }

  function clearFanCardsOnly() {
    const disposedGeos = new Set();
    const disposedMats = new Set();
    fanCardMeshes.forEach((m) => disposeCardMesh(m, disposedGeos, disposedMats));
    fanCardMeshes = [];
    if (hoveredCardMesh?.userData?.isFanCard) {
      hoveredCardMesh = null;
    }
    isFanSettled = false;
    requestShadowUpdate(true);
  }

  function clear3DCards() {
    const disposedGeos = new Set();
    const disposedMats = new Set();
    fanCardMeshes.forEach((m) => disposeCardMesh(m, disposedGeos, disposedMats));
    spreadCardMeshes.forEach((m) => disposeCardMesh(m, disposedGeos, disposedMats));
    fanCardMeshes = [];
    spreadCardMeshes = [];
    hoveredCardMesh = null;
    isFanSettled = false;
    requestShadowUpdate(true);
    emitSpreadProjection();
  }

  function clearDiscardPile3D() {
    const disposedGeos = new Set();
    const disposedMats = new Set();
    discardCardMeshes.forEach((m) => disposeCardMesh(m, disposedGeos, disposedMats));
    discardCardMeshes = [];
    requestShadowUpdate(true);
  }

  function syncDiscardPile3D(discardList = state.discardPile) {
    clearDiscardPile3D();
    const totalUsed = Array.isArray(discardList) ? discardList.length : 0;
    if (totalUsed <= 0) return;

    const layers = Math.min(totalUsed, 24);
    const geo = new THREE.BoxGeometry(0.22, 0.012, 0.34);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: '#b88e28',
      roughness: 0.42,
      metalness: 0.4,
      flatShading: true
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: cardBackTex,
      roughness: 0.72,
      metalness: 0.06,
      flatShading: true
    });
    const mats = [edgeMat, edgeMat, backMat, backMat, edgeMat, edgeMat];

    for (let i = 0; i < layers; i++) {
      const mesh = new THREE.Mesh(geo, mats);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      const jitterX = Math.sin(i * 1.7) * 0.012;
      const jitterZ = Math.cos(i * 2.1) * 0.012;
      mesh.position.set(-1.30 + jitterX, 1.015 + i * 0.0125, -0.58 + jitterZ);
      mesh.rotation.y = 0.24 + Math.sin(i * 1.4) * 0.06;
      mesh.userData = {
        isDiscardPile: true,
        layerIndex: i,
        discardCount: totalUsed
      };
      scene.add(mesh);
      discardCardMeshes.push(mesh);
    }
    requestShadowUpdate(true);
  }

  function spawn78CardFan(preserveSpread = false) {
    if (preserveSpread) clearFanCardsOnly();
    else clear3DCards();
    const total = state.remainingDeck.length;
    if (total === 0) return;

    const geo = new THREE.BoxGeometry(0.22, 0.014, 0.34);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      roughness: 0.34,
      metalness: 0.45,
      flatShading: true
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: cardBackTex,
      roughness: 0.68,
      metalness: 0.08,
      flatShading: true
    });

    let radius = 1.62;
    let startAngle = Math.PI * 0.16;
    let endAngle = Math.PI * 0.84;
    if (currentAspect < 0.75) {
      const portraitFactor = Math.min(1, Math.max(0, (0.75 - currentAspect) / 0.30));
      radius = 1.62 - portraitFactor * 0.26;
      startAngle = Math.PI * (0.16 + portraitFactor * 0.06);
      endAngle = Math.PI * (0.84 - portraitFactor * 0.06);
    }

    state.remainingDeck.forEach((cardData, idx) => {
      // Lazy front-face material: render face-down cards with shared backMat on fan spawn for zero hitch!
      const mats = [edgeMat, edgeMat, backMat, backMat, edgeMat, edgeMat];
      const mesh = new THREE.Mesh(geo, mats);
      mesh.castShadow = false;
      mesh.receiveShadow = true;

      const t = total > 1 ? idx / (total - 1) : 0.5;
      const angle = startAngle + t * (endAngle - startAngle);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.85 + 0.18;

      mesh.position.set(x, 1.02 + idx * 0.0008, z);
      mesh.rotation.y = -angle + Math.PI / 2;
      mesh.userData = {
        cardData,
        slotIndex: idx,
        baseX: x,
        baseY: 1.02 + idx * 0.0008,
        baseZ: z,
        baseRotY: -angle + Math.PI / 2,
        isFanCard: true
      };
      scene.add(mesh);
      fanCardMeshes.push(mesh);
    });
    hoveredCardMesh = null;
    isFanSettled = false;
    requestShadowUpdate(true);
  }

  function applySpreadCardPose(mesh, slotIdx, totalSlots) {
    const isPortrait = currentAspect < 0.75;
    const portraitFactor = isPortrait ? Math.min(1, Math.max(0, (0.75 - currentAspect) / 0.30)) : 0;
    let tx = 0;
    let tz = 0;
    let cardScale = 1.0;

    if (totalSlots === 10) {
      const row = slotIdx < 5 ? 0 : 1;
      const col = slotIdx % 5;
      tx = (col - 2) * 0.34;
      tz = row === 0 ? -0.34 : 0.16;
      cardScale = 1.0 + portraitFactor * 0.24;
    } else if (totalSlots === 3) {
      tx = (slotIdx - 1) * (isPortrait ? 0.44 : 0.42);
      tz = -0.1;
      cardScale = 1.0 + portraitFactor * 0.36;
    } else {
      tx = 0;
      tz = -0.1;
      cardScale = 1.0 + portraitFactor * 0.48;
    }

    const isReversed = Boolean(mesh.userData.reversed ?? mesh.userData.cardData?.reversed);
    mesh.scale.setScalar(cardScale);
    mesh.userData.slotIdx = slotIdx;
    mesh.userData.totalSlots = totalSlots;
    mesh.userData.reversed = isReversed;
    mesh.userData.targetPos = new THREE.Vector3(tx, 1.05, tz);
    mesh.userData.targetRotX = Math.PI;
    mesh.userData.targetRotY = isReversed ? Math.PI : 0;
    mesh.userData.targetRotZ = 0;
    mesh.userData.flipping = true;
  }

  function placeSpreadCardIn3D(mesh, cardData, slotIdx, totalSlots) {
    if (!mesh || !mesh.userData) return;
    fanCardMeshes = fanCardMeshes.filter((m) => m !== mesh);
    if (hoveredCardMesh === mesh) {
      hoveredCardMesh = null;
      isFanSettled = false;
    }
    mesh.userData.isFanCard = false;
    mesh.userData.isSpreadCard = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Lazily generate & attach high-res Tarot Card Front only for actually drawn cards
    const activeData = cardData || mesh.userData.cardData;
    if (activeData) {
      mesh.userData.cardData = activeData;
    }
    mesh.userData.reversed = Boolean(activeData?.reversed);
    if (activeData && Array.isArray(mesh.material) && mesh.material.length >= 4) {
      const frontTex = createCardFrontTexture(activeData);
      frontTex.anisotropy = maxAniso;
      mesh.material[3] = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: 0.60,
        metalness: 0.04,
        flatShading: true
      });
    }

    applySpreadCardPose(mesh, slotIdx, totalSlots);
    spreadCardMeshes.push(mesh);
    requestShadowUpdate(true);
    emitSpreadProjection();
  }

  function playPlayerHandShuffle3D(onDone) {
    state.isPlayerShuffling = true;
    isFanSettled = false;
    playerShuffleGatherUntil = elapsedTime + 0.86;
    playerShuffleUntil = elapsedTime + 1.55;
    requestShadowUpdate(true);

    const midTimer = setTimeout(() => {
      activeTimers.delete(midTimer);
      if (isDisposed) return;
      spawn78CardFan(true);
      // Start fresh fan slightly centered so animate3D glides cards smoothly into the neat arc
      fanCardMeshes.forEach((m, idx) => {
        m.position.set(idx % 2 === 0 ? -0.10 : 0.10, m.userData.baseY + 0.05, 1.30);
        m.rotation.y = 0;
      });
      isFanSettled = false;
      syncDiscardPile3D(state.discardPile);
      requestShadowUpdate(true);
    }, 880);
    activeTimers.add(midTimer);

    const endTimer = setTimeout(() => {
      activeTimers.delete(endTimer);
      state.isPlayerShuffling = false;
      isFanSettled = false;
      playerShuffleGatherUntil = 0;
      playerShuffleUntil = 0;
      requestShadowUpdate(true);
      if (!isDisposed && onDone) onDone();
    }, 1580);
    activeTimers.add(endTimer);
  }

  function tuckNatalSpreadAway3D() {
    const disposedGeos = new Set();
    const disposedMats = new Set();
    spreadCardMeshes.forEach((m) => disposeCardMesh(m, disposedGeos, disposedMats));
    spreadCardMeshes = [];
    if (hoveredCardMesh?.userData?.isSpreadCard) {
      hoveredCardMesh = null;
    }
    requestShadowUpdate(true);
    emitSpreadProjection();
  }

  function updatePointerFromEvent(e, forceFresh = false) {
    let vp = forceFresh ? updateCachedViewport() : getViewportDimensions();
    if (!forceFresh) {
      const winW = typeof window !== 'undefined' ? Number(window.innerWidth) : 0;
      const winH = typeof window !== 'undefined' ? Number(window.innerHeight) : 0;
      if (
        winW > 0 &&
        winH > 0 &&
        cachedViewport &&
        cachedViewport.left === 0 &&
        cachedViewport.top === 0 &&
        (cachedViewport.width !== winW || cachedViewport.height !== winH)
      ) {
        vp = updateCachedViewport();
      }
    }
    const fallbackW = typeof window !== 'undefined' ? Number(window.innerWidth) : 0;
    const fallbackH = typeof window !== 'undefined' ? Number(window.innerHeight) : 0;
    const left = vp && Number.isFinite(vp.left) ? vp.left : 0;
    const top = vp && Number.isFinite(vp.top) ? vp.top : 0;
    const vw = vp ? vp.width : Math.max(1, fallbackW || 1);
    const vh = vp ? vp.height : Math.max(1, fallbackH || 1);
    const nx = ((e.clientX - left) / vw) * 2 - 1;
    const ny = -((e.clientY - top) / vh) * 2 + 1;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return false;
    pointer.x = nx;
    pointer.y = ny;
    pointerValid = true;
    return true;
  }

  function onPointerMove(e) {
    const blocked = Boolean(e.target?.closest?.('.pointer-auto') || e.target?.closest?.('dialog'));
    pointerBlockedByUI = blocked;
    if (blocked) {
      if (hoveredCardMesh) {
        hoveredCardMesh = null;
        isFanSettled = false;
      }
      state.isHoveringCrystal = false;
      pointerMoved = false;
      if (typeof document !== 'undefined' && document.body?.style && document.body.style.cursor !== 'default') {
        document.body.style.cursor = 'default';
      }
      return;
    }
    if (updatePointerFromEvent(e, false)) {
      pointerMoved = true;
    }
  }

  function onPointerDown(e) {
    if (state.screen !== 'game' || state.isAnimatingShuffle || state.isPlayerShuffling) return;
    if (e.target?.closest?.('.pointer-auto') || e.target?.closest?.('dialog')) return;
    if (!updatePointerFromEvent(e, true)) return;
    camera.updateMatrixWorld?.();
    raycaster.setFromCamera(pointer, camera);

    if (state.isPicking) {
      const hits = raycaster.intersectObjects(fanCardMeshes, false);
      if (hits.length > 0 && onCardPicked) {
        onCardPicked(hits[0].object);
        return;
      }
    } else {
      const hits = raycaster.intersectObjects(spreadCardMeshes, false);
      if (hits.length > 0 && onSpreadCardInspect) {
        const mesh = hits[0].object;
        onSpreadCardInspect(mesh.userData.cardData, mesh.userData.posLabel || 'หน้าไพ่บนโต๊ะ');
        return;
      }
    }

    if (discardCardMeshes.length > 0) {
      const discardHits = raycaster.intersectObjects(discardCardMeshes, false);
      if (discardHits.length > 0 && onDiscardInspect) {
        onDiscardInspect();
        return;
      }
    }

    if (tabletopCrystalMeshes.length > 0) {
      const crystalHits = raycaster.intersectObjects(tabletopCrystalMeshes, false);
      if (crystalHits.length > 0) {
        state.isHoveringCrystal = true;
        crystalTapBoostUntil = elapsedTime + 1.85;
        if (onCrystalInspect) onCrystalInspect();
      }
    }
  }

  const clock = new THREE.Clock();

  function onVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      clock.stop();
    } else if (!isDisposed && !contextLost) {
      clock.start();
    }
  }

  function onWebglContextLost(e) {
    e?.preventDefault?.();
    contextLost = true;
  }

  function onWebglContextRestored() {
    contextLost = false;
    clock.start();
    updateCameraForAspect();
    requestShadowUpdate(true);
  }

  function animate3D() {
    if (isDisposed) return;
    animFrameId = requestAnimationFrame(animate3D);
    if (contextLost || (typeof document !== 'undefined' && document.hidden)) return;

    frameCounter = (frameCounter + 1) | 0;
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsedTime += dt;
    const t = elapsedTime;

    // Faster Adaptive FPS Quality Guard in 'auto' mode:
    // 12 slow frames (dt > 0.036) -> disable bloom -> cap DPR to 1.0 -> disable shadows + set satiPerf='low'
    if (qualityMode === 'auto') {
      if (dt > 0.036) {
        slowFrameCount += 1;
        if (slowFrameCount >= 12) {
          if (useBloomComposer) {
            useBloomComposer = false;
          } else if (adaptiveDprCapOverride === null || adaptiveDprCapOverride > 1.0) {
            adaptiveDprCapOverride = 1.0;
            syncPixelRatio();
          } else if (renderer.shadowMap.enabled || !adaptiveShadowsDisabled) {
            renderer.shadowMap.enabled = false;
            adaptiveShadowsDisabled = true;
            setDocumentPerfDataset('low');
          }
          slowFrameCount = 0;
        }
      } else {
        slowFrameCount = Math.max(0, slowFrameCount - 1);
      }
    }

    const camDamp = 1 - Math.exp(-3.8 * dt);
    currentCamPos.lerp(targetCamPos, camDamp);
    currentCamLook.lerp(targetCamLook, camDamp);
    camera.position.copy(currentCamPos);

    let lookY = currentCamLook.y;
    let lookZ = currentCamLook.z;
    if (state.screen === 'game' && currentAspect < 1.0) {
      const squareFactor = Math.min(1, Math.max(0, (1.0 - currentAspect) / 0.25));
      const portraitFactor = currentAspect < 0.75 ? Math.min(1, Math.max(0, (0.75 - currentAspect) / 0.30)) : 0;
      if (state.cameraMode === '2P') {
        camera.position.z += squareFactor * 0.10 - portraitFactor * 0.22;
        camera.position.y += squareFactor * -0.15 - portraitFactor * 0.12;
        lookY += squareFactor * 0.02 + portraitFactor * 0.03;
        lookZ += squareFactor * 0.02 + portraitFactor * 0.04;
      } else {
        camera.position.z += squareFactor * 0.34 - portraitFactor * 0.22;
        camera.position.y += squareFactor * 0.30 + portraitFactor * 0.48;
        lookY += squareFactor * -0.04 - portraitFactor * 0.18;
        lookZ += squareFactor * 0.08 + portraitFactor * 0.26;
      }
    } else if (camAspectZOffset !== 0 || camAspectYOffset !== 0) {
      camera.position.z += camAspectZOffset;
      camera.position.y += camAspectYOffset;
    }
    camera.lookAt(currentCamLook.x, lookY, lookZ);

    if (state.screen === 'login') {
      camera.position.x = Math.sin(t * 0.25) * 0.72;
      camera.lookAt(CAM_POS.loginLook);
    }

    // rAF-throttled pointer hover raycasting (skip when stale or outside game screen; every 2nd frame in 'low' mode)
    if (state.screen !== 'game') {
      if (state.isHoveringCrystal) state.isHoveringCrystal = false;
      if (hoveredCardMesh) {
        hoveredCardMesh = null;
        isFanSettled = false;
      }
      if (pointerMoved) {
        pointerMoved = false;
        if (typeof document !== 'undefined' && document.body?.style && document.body.style.cursor !== 'default') {
          document.body.style.cursor = 'default';
        }
      }
    } else if (!pointerBlockedByUI && pointerMoved && pointerValid && (qualityMode !== 'low' || (frameCounter & 1) === 0)) {
      pointerMoved = false;
      raycaster.setFromCamera(pointer, camera);
      const targets = state.isPicking ? fanCardMeshes : spreadCardMeshes;
      const hits = targets.length > 0 ? raycaster.intersectObjects(targets, false) : [];
      const nextHovered = hits.length > 0 ? hits[0].object : null;
      if (nextHovered !== hoveredCardMesh) {
        hoveredCardMesh = nextHovered;
        isFanSettled = false;
      }

      let hoveringCrystal = false;
      let hoveringDiscard = false;
      if (!hoveredCardMesh && tabletopCrystalMeshes.length > 0) {
        const crystalHits = raycaster.intersectObjects(tabletopCrystalMeshes, false);
        hoveringCrystal = crystalHits.length > 0;
      }
      if (!hoveredCardMesh && !hoveringCrystal && discardCardMeshes.length > 0) {
        const discardHits = raycaster.intersectObjects(discardCardMeshes, false);
        hoveringDiscard = discardHits.length > 0;
      }
      state.isHoveringCrystal = hoveringCrystal;
      if (typeof document !== 'undefined' && document.body?.style) {
        document.body.style.cursor = (hoveredCardMesh || hoveringCrystal || hoveringDiscard) ? 'pointer' : 'default';
      }
    }

    // Candle flicker (emissive flame position + subtle scale pulse; no per-flame PointLight)
    for (let idx = 0; idx < candleLights.length; idx += 1) {
      const c = candleLights[idx];
      const flick = Math.sin(t * 9 + idx * 2) * 0.1 + Math.cos(t * 14 + idx) * 0.06;
      c.flame.position.y = c.baseY + flick * 0.08;
      const pulseY = 1 + flick * 0.55;
      const pulseXZ = 1 - flick * 0.22;
      c.flame.scale.set(c.baseScaleX * pulseXZ, c.baseScaleY * pulseY, c.baseScaleZ * pulseXZ);
    }

    const isCrystalSurging = Boolean(state.isHoveringCrystal) || t < crystalTapBoostUntil;

    // Iridescent Crystal Orbs outer shell spin smoothly on static 3-legged wooden/brass stands
    orbSpinMeshes.forEach((orbMesh, idx) => {
      const spinSpeed = isCrystalSurging ? 0.95 : 0.38;
      orbMesh.rotation.y = (idx % 2 === 0 ? 1 : -1) * t * spinSpeed;
    });

    // Inner counter-rotating faceted nebula cores with dynamic pulsing emissive (1.3 - 2.1, #7b2cbf to #00f5d4) (F5)
    orbCoreMeshes.forEach((coreMesh, idx) => {
      coreMesh.rotation.y = (idx % 2 === 0 ? -1 : 1) * t * (isCrystalSurging ? 1.45 : 0.72);
      coreMesh.rotation.x = Math.sin(t * 1.4 + idx * 1.2) * 0.35;
      coreMesh.rotation.z = Math.cos(t * 1.1 + idx * 1.5) * 0.25;

      const pulse = Math.sin(t * (isCrystalSurging ? 4.2 : 2.2) + idx * 1.8) * 0.5 + 0.5;
      const emissiveIntensity = (isCrystalSurging ? 1.85 : 1.3) + pulse * 0.85;
      if (coreMesh.material) {
        coreMesh.material.emissiveIntensity = emissiveIntensity;
        coreMesh.material.emissive.copy(CORE_COLOR_VIOLET).lerp(CORE_COLOR_CYAN, pulse * (isCrystalSurging ? 0.95 : 0.7));
      }
    });

    // Center Tabletop Crystal Ball breathing PointLight casting mystical violet-cyan light (F5)
    if (tabletopCrystalLight) {
      const breathe = Math.sin(t * 1.8) * 0.5 + 0.5;
      const tapPulse = t < crystalTapBoostUntil ? 1.4 : 0.0;
      const hoverBoost = state.isHoveringCrystal ? 1.0 : 0.0;
      tabletopCrystalLight.intensity = 1.5 + breathe * 0.6 + hoverBoost + tapPulse;
      tabletopCrystalLight.color.copy(TABLE_CRYSTAL_LIGHT_COLOR).lerp(CORE_COLOR_CYAN, breathe * 0.35 + (isCrystalSurging ? 0.35 : 0));
    }

    if (arcaneParticles && arcaneParticles.visible) {
      arcaneParticles.rotation.y = t * 0.03;
    }

    // Fortune-Teller Sati Living Animation (Blender NLA Mixer + Gaze Tracking, or Legacy Fallback)
    if (satiGroup) {
      if (satiMixer) {
        const desiredClip = state.isAnimatingShuffle
          ? 'Shuffle'
          : state.isThinking
            ? 'Thinking'
            : state.isSpeaking
              ? 'Talk'
              : 'Idle';
        if (desiredClip !== activeSatiClip && satiActions[desiredClip]) {
          const prevAction = satiActions[activeSatiClip];
          const nextAction = satiActions[desiredClip];
          nextAction.reset();
          nextAction.play();
          if (prevAction && prevAction !== nextAction) {
            prevAction.crossFadeTo(nextAction, desiredClip === 'Shuffle' ? 0.20 : 0.34, true);
          }
          activeSatiClip = desiredClip;
        }
        satiMixer.update(dt);

        // Micro-life interactive gaze follow: eyes & head subtly glance toward cursor / hovered card!
        const followActive = state.screen === 'game' && !state.isAnimatingShuffle && !state.isThinking;
        const targetGX = followActive ? THREE.MathUtils.clamp(pointer.x, -1, 1) : 0;
        const targetGY = followActive ? THREE.MathUtils.clamp(pointer.y, -1, 1) : 0;
        gazeX += (targetGX - gazeX) * 0.08;
        gazeY += (targetGY - gazeY) * 0.08;

        if (satiHeadBone) {
          satiHeadBone.rotateY(gazeX * 0.09);
          satiHeadBone.rotateX(-gazeY * 0.05);
        }
        if (satiEyeLBone && satiEyeRBone) {
          satiEyeLBone.rotateZ(-gazeX * 0.14);
          satiEyeLBone.rotateX(-gazeY * 0.09);
          satiEyeRBone.rotateZ(-gazeX * 0.14);
          satiEyeRBone.rotateX(-gazeY * 0.09);
        }
      } else if (satiHasRigNodes) {
        satiHead.position.y = satiHeadBaseY + Math.sin(t * 1.6) * 0.012;
        satiHead.rotation.y = Math.sin(t * 0.7) * 0.06;
        satiHead.rotation.x = Math.sin(t * 1.1) * 0.03;
        if (state.isAnimatingShuffle) {
          satiLeftArm.rotation.x = Math.sin(t * 14) * 0.28;
          satiRightArm.rotation.x = -Math.sin(t * 14) * 0.28;
          satiLeftArm.rotation.z = Math.cos(t * 14) * 0.15;
          satiRightArm.rotation.z = -Math.cos(t * 14) * 0.15;
        } else if (state.isThinking) {
          satiLeftArm.rotation.x = -0.18 + Math.sin(t * 4.5) * 0.08;
          satiRightArm.rotation.x = -0.18 + Math.cos(t * 4.5) * 0.08;
        } else {
          satiLeftArm.rotation.x = Math.sin(t * 1.4) * 0.05;
          satiRightArm.rotation.x = Math.cos(t * 1.4) * 0.05;
          satiLeftArm.rotation.z = 0;
          satiRightArm.rotation.z = 0;
        }
      } else {
        satiGroup.position.y = satiGroupBaseY + Math.sin(t * 1.6) * 0.014;
      }
    }

    // Fan cards hover lift & mobile portrait scale ergonomics (skip transform writes once settled)
    const cardDamp = 1 - Math.exp(-11.0 * dt);
    const spreadDamp = 1 - Math.exp(-8.5 * dt);
    const fanPortraitScale = currentAspect < 0.75
      ? 1.0 + Math.min(1, Math.max(0, (0.75 - currentAspect) / 0.30)) * 0.14
      : 1.0;
    const isPlayerShufflingNow = Boolean(state.isPlayerShuffling && t < playerShuffleUntil);
    const isGatheringShuffle = Boolean(state.isPlayerShuffling && t < playerShuffleGatherUntil);
    const isPickingNow = Boolean(state.isPicking);
    if (isPickingNow !== wasPickingForFan) {
      wasPickingForFan = isPickingNow;
      isFanSettled = false;
      if (!isPickingNow && hoveredCardMesh?.userData?.isFanCard) {
        hoveredCardMesh = null;
      }
    }
    const hasFanHover = Boolean(isPickingNow && hoveredCardMesh?.userData?.isFanCard);
    if (isGatheringShuffle) {
      isFanSettled = false;
      for (let idx = 0; idx < fanCardMeshes.length; idx += 1) {
        const m = fanCardMeshes[idx];
        m.scale.setScalar(fanPortraitScale);
        const gatherSide = idx % 2 === 0 ? -0.14 : 0.14;
        const weaveWave = Math.sin(t * 22 + idx * 0.5) * 0.05;
        m.position.x += (gatherSide - m.position.x) * cardDamp;
        m.position.z += (1.28 - m.position.z) * cardDamp;
        m.position.y += (1.08 + Math.abs(weaveWave) + (idx % 6) * 0.004 - m.position.y) * cardDamp;
        m.rotation.y += ((gatherSide * 0.8) - m.rotation.y) * cardDamp;
      }
    } else if (hasFanHover || !isFanSettled) {
      let allSettled = !hasFanHover;
      for (let idx = 0; idx < fanCardMeshes.length; idx += 1) {
        const m = fanCardMeshes[idx];
        if (Math.abs(m.scale.x - fanPortraitScale) > 0.0005) {
          m.scale.setScalar(fanPortraitScale);
          allSettled = false;
        }
        if (m.userData.baseX !== undefined) {
          const dx = m.userData.baseX - m.position.x;
          const dz = m.userData.baseZ - m.position.z;
          const dr = m.userData.baseRotY - m.rotation.y;
          if (Math.abs(dx) > 0.0005) {
            m.position.x += dx * cardDamp;
            allSettled = false;
          } else if (dx !== 0) {
            m.position.x = m.userData.baseX;
          }
          if (Math.abs(dz) > 0.0005) {
            m.position.z += dz * cardDamp;
            allSettled = false;
          } else if (dz !== 0) {
            m.position.z = m.userData.baseZ;
          }
          if (Math.abs(dr) > 0.0005) {
            m.rotation.y += dr * cardDamp;
            allSettled = false;
          } else if (dr !== 0) {
            m.rotation.y = m.userData.baseRotY;
          }
        }
        const targetY = m === hoveredCardMesh && isPickingNow ? m.userData.baseY + 0.14 : m.userData.baseY;
        const dy = targetY - m.position.y;
        if (Math.abs(dy) > 0.0005) {
          m.position.y += dy * cardDamp;
          allSettled = false;
        } else if (dy !== 0) {
          m.position.y = targetY;
        }
      }
      if (allSettled) {
        isFanSettled = true;
      }
    }

    // Spread cards flip & glide animation (arc upward mid-flip so corners never clip table)
    let hasActiveSpreadMotion = false;
    spreadCardMeshes.forEach((m) => {
      if (m.userData.targetPos) {
        const flipSin = Math.max(0, Math.sin(m.rotation.x));
        const flipLift = flipSin * 0.18 * (Number.isFinite(m.scale?.y) ? m.scale.y : 1);
        _tmpSpreadTarget.set(
          m.userData.targetPos.x,
          m.userData.targetPos.y + flipLift,
          m.userData.targetPos.z
        );
        m.position.lerp(_tmpSpreadTarget, spreadDamp);
        m.rotation.x += (m.userData.targetRotX - m.rotation.x) * spreadDamp;
        m.rotation.y += (m.userData.targetRotY - m.rotation.y) * spreadDamp;
        if (m.userData.targetRotZ !== undefined) {
          m.rotation.z += (m.userData.targetRotZ - m.rotation.z) * spreadDamp;
        }
        if (
          m.position.distanceToSquared(_tmpSpreadTarget) > 1e-6 ||
          Math.abs(m.rotation.x - m.userData.targetRotX) > 0.001 ||
          Math.abs(m.rotation.y - m.userData.targetRotY) > 0.001
        ) {
          hasActiveSpreadMotion = true;
        }
      }
    });

    // Articulated First-Person Player Hands (Zero-GC, Mobile/2P Adaptive, Finger Wave, Card Grab & Crystal Cupping!)
    if (playerRightHand && playerLeftHand) {
      const visible = state.screen === 'game';
      playerLeftHand.visible = visible;
      playerRightHand.visible = visible;
      if (visible) {
        const isPortrait = currentAspect < 0.75;
        const mobileXScale = isPortrait ? 0.54 : currentAspect < 1.0 ? 0.78 : 1.0;
        const handScale = BASE_HAND_SCALE * (isPortrait ? 0.84 : currentAspect < 1.0 ? 0.90 : 1.0);
        const hDampFast = 1 - Math.exp(-16.0 * dt);
        const hDampSoft = 1 - Math.exp(-9.0 * dt);
        const fingerDamp = 1 - Math.exp(-12.5 * dt);

        playerLeftHand.scale.setScalar(handScale);
        playerRightHand.scale.setScalar(handScale);

        const is2P = state.cameraMode === '2P';
        const restX = is2P ? 1.15 * mobileXScale : isPortrait ? 0.44 : 0.72 * mobileXScale;
        const restY = is2P ? 0.72 : isPortrait ? 1.22 : 1.40;
        const restZ = is2P ? 3.05 : isPortrait ? 2.80 : 2.12;
        _restLeftPos.set(-restX, restY + Math.sin(t * 1.9) * 0.014, restZ);
        _restRightPos.set(restX, restY + Math.sin(t * 1.9 + 1.1) * 0.014, restZ);

        // Organic idle finger wave curls [Thumb, Index, Middle, Ring, Pinky]
        const idleCurlsL = FINGER_NAMES.map((_, i) => 0.16 + Math.sin(t * 2.1 - i * 0.52) * 0.08);
        const idleCurlsR = FINGER_NAMES.map((_, i) => 0.16 + Math.sin(t * 2.1 - i * 0.52 + 0.9) * 0.08);
        // Right-hand rule: +rotX dips sleeve downward (-Y) & reveals dorsal hand; -rotY(L)/+rotY(R) splays elbows outward to shoulders!
        let targetRotLX = isPortrait ? 0.24 : 0.22;
        let targetRotLY = isPortrait ? -0.18 : -0.24;
        let targetRotLZ = -0.06;
        let targetRotRX = isPortrait ? 0.24 : 0.22;
        let targetRotRY = isPortrait ? 0.18 : 0.24;
        let targetRotRZ = 0.06;
        let targetCurlsL = idleCurlsL;
        let targetCurlsR = idleCurlsR;
        let targetSplaysL = [0, 0.02, 0, -0.02, -0.04];
        let targetSplaysR = [0, -0.02, 0, 0.02, 0.04];

        const grabActive = !is2P && state.handGrab && t - state.handGrab.startTime < 0.38;
        if (isPlayerShufflingNow && !is2P) {
          // Two-handed player card weave / riffle shuffle in the foreground
          const weave = Math.sin(t * 16.0);
          const liftL = Math.max(0, weave) * 0.08;
          const liftR = Math.max(0, -weave) * 0.08;
          const shufX = 0.28 * (isPortrait ? 0.82 : mobileXScale);
          _targetLeftPos.set(-shufX + Math.sin(t * 10) * 0.04, 1.24 + liftL, isPortrait ? 1.56 : 1.38);
          _targetRightPos.set(shufX - Math.sin(t * 10) * 0.04, 1.24 + liftR, isPortrait ? 1.56 : 1.38);
          targetRotLX = 0.16 + liftL * 0.6;
          targetRotLY = -0.34;
          targetRotLZ = -0.18;
          targetRotRX = 0.16 + liftR * 0.6;
          targetRotRY = 0.34;
          targetRotRZ = 0.18;
          targetCurlsL = [0.46 + liftL, 0.52, 0.48, 0.48, 0.44];
          targetCurlsR = [0.46 + liftR, 0.52, 0.48, 0.48, 0.44];
          playerLeftHand.position.lerp(_targetLeftPos, hDampFast);
          playerRightHand.position.lerp(_targetRightPos, hDampFast);
        } else if (grabActive) {
          // 3-phase draw: reach (0..0.42) -> pinch & lift (0.42..0.75) -> glide home (0.75..1.0)
          const u = Math.max(0, Math.min(1, (t - state.handGrab.startTime) / 0.38));
          const reachLift = Math.sin(u * Math.PI);
          const pinchAmt = u < 0.45 ? u / 0.45 : Math.max(0, 1 - (u - 0.45) / 0.55);
          const gp = state.handGrab.pos;
          const grabX = THREE.MathUtils.clamp(gp.x * (isPortrait ? 0.76 : 1.0), -1.35 * mobileXScale, 1.35 * mobileXScale);
          const grabY = (isPortrait ? 1.20 : 1.24) + reachLift * 0.14;
          const grabZ = Math.max(isPortrait ? 1.48 : 1.25, gp.z + (isPortrait ? 0.44 : 0.34));

          const pinchCurls = [0.42 * pinchAmt + 0.12, 0.65 * pinchAmt + 0.14, 0.52 * pinchAmt + 0.18, 0.56 * pinchAmt + 0.20, 0.60 * pinchAmt + 0.22];
          if (state.handGrab.side === 'left') {
            _targetLeftPos.set(grabX, grabY, grabZ);
            _targetRightPos.copy(_restRightPos);
            targetRotLX = 0.10 + reachLift * 0.08;
            targetRotLY = -grabX * 0.14 - 0.18;
            targetCurlsL = pinchCurls;
          } else {
            _targetRightPos.set(grabX, grabY, grabZ);
            _targetLeftPos.copy(_restLeftPos);
            targetRotRX = 0.10 + reachLift * 0.08;
            targetRotRY = -grabX * 0.14 + 0.18;
            targetCurlsR = pinchCurls;
          }
          playerLeftHand.position.lerp(_targetLeftPos, hDampFast);
          playerRightHand.position.lerp(_targetRightPos, hDampFast);
        } else if (!is2P && isCrystalSurging) {
          // Symmetric Crystal Ball Flanking along eye-to-orb sightline (sleeves drop & splay cleanly outward!) (F9)
          const breatheY = Math.sin(t * 2.6) * 0.018;
          const flankX = 0.44 * (isPortrait ? 0.85 : mobileXScale);
          _targetLeftPos.set(-flankX, 1.52 + breatheY, 0.44);
          _targetRightPos.set(flankX, 1.52 - breatheY, 0.44);
          targetRotLX = 0.16;
          targetRotLY = -0.36;
          targetRotLZ = -0.14;
          targetRotRX = 0.16;
          targetRotRY = 0.36;
          targetRotRZ = 0.14;
          targetCurlsL = FINGER_NAMES.map((_, i) => 0.42 + Math.sin(t * 3.0 - i * 0.45) * 0.10);
          targetCurlsR = FINGER_NAMES.map((_, i) => 0.42 + Math.sin(t * 3.0 - i * 0.45 + 0.8) * 0.10);
          playerLeftHand.position.lerp(_targetLeftPos, hDampSoft);
          playerRightHand.position.lerp(_targetRightPos, hDampSoft);
        } else if (is2P) {
          _targetLeftPos.copy(_restLeftPos);
          _targetRightPos.copy(_restRightPos);
          targetRotLX = 0.12;
          targetRotLY = -0.20;
          targetRotRX = 0.12;
          targetRotRY = 0.20;
          playerLeftHand.position.lerp(_targetLeftPos, hDampSoft);
          playerRightHand.position.lerp(_targetRightPos, hDampSoft);
        } else {
          // Hover card poise or organic idle cursor tracking
          const isHovering = Boolean(hoveredCardMesh && state.isPicking);
          const rawFocusX = hoveredCardMesh ? hoveredCardMesh.position.x : pointer.x * 1.15;
          const focusX = THREE.MathUtils.clamp(rawFocusX * mobileXScale, -1.25 * mobileXScale, 1.25 * mobileXScale);
          const focusZ = hoveredCardMesh ? hoveredCardMesh.position.z + 0.28 : 2.18;
          const focusY = hoveredCardMesh ? 1.26 : _restLeftPos.y;

          if (isHovering || Math.abs(pointer.x) > 0.18) {
            if (focusX < 0) {
              _targetLeftPos.set(Math.min(-0.14 * mobileXScale, focusX), focusY, focusZ);
              _targetRightPos.copy(_restRightPos);
              targetRotLX = isHovering ? 0.12 : 0.20;
              targetRotLY = THREE.MathUtils.clamp(-focusX * 0.18 - 0.22, -0.48, 0.15);
              if (isHovering) {
                targetCurlsL = [0.16, 0.06, 0.18, 0.28, 0.34];
                targetSplaysL = [0.06, 0.05, 0, -0.05, -0.08];
              }
            } else {
              _targetRightPos.set(Math.max(0.14 * mobileXScale, focusX), focusY, focusZ);
              _targetLeftPos.copy(_restLeftPos);
              targetRotRX = isHovering ? 0.12 : 0.20;
              targetRotRY = THREE.MathUtils.clamp(-focusX * 0.18 + 0.22, -0.15, 0.48);
              if (isHovering) {
                targetCurlsR = [0.16, 0.06, 0.18, 0.28, 0.34];
                targetSplaysR = [-0.06, -0.05, 0, 0.05, 0.08];
              }
            }
          } else {
            _targetLeftPos.copy(_restLeftPos);
            _targetRightPos.copy(_restRightPos);
            targetRotLY = (isPortrait ? -0.32 : -0.24) - pointer.x * 0.08;
            targetRotRY = (isPortrait ? 0.32 : 0.24) - pointer.x * 0.08;
          }
          playerLeftHand.position.lerp(_targetLeftPos, hDampSoft);
          playerRightHand.position.lerp(_targetRightPos, hDampSoft);
        }

        playerLeftHand.rotation.x += (targetRotLX - playerLeftHand.rotation.x) * hDampSoft;
        playerLeftHand.rotation.y += (targetRotLY - playerLeftHand.rotation.y) * hDampSoft;
        playerLeftHand.rotation.z += (targetRotLZ - playerLeftHand.rotation.z) * hDampSoft;
        playerRightHand.rotation.x += (targetRotRX - playerRightHand.rotation.x) * hDampSoft;
        playerRightHand.rotation.y += (targetRotRY - playerRightHand.rotation.y) * hDampSoft;
        playerRightHand.rotation.z += (targetRotRZ - playerRightHand.rotation.z) * hDampSoft;

        poseHandFingers(handRigL, targetCurlsL, targetSplaysL, fingerDamp);
        poseHandFingers(handRigR, targetCurlsR, targetSplaysR, fingerDamp);
      }
    }

    const hasAnimatedShadowCasters = Boolean(
      satiGroup ||
      (playerLeftHand?.visible && playerRightHand?.visible) ||
      hasActiveSpreadMotion
    );
    if (
      renderer.shadowMap.enabled &&
      qualityMode !== 'low' &&
      hasAnimatedShadowCasters &&
      t - lastShadowUpdateAt >= 0.12
    ) {
      requestShadowUpdate(true);
    }

    if (useBloomComposer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    emitSpreadProjection();
  }

  createArcaneParticles();
  applyQualityMode(qualityMode);
  updateCameraForAspect();
  window.addEventListener('resize', updateCameraForAspect);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerdown', onPointerDown);
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof canvas?.addEventListener === 'function') {
    canvas.addEventListener('webglcontextlost', onWebglContextLost);
    canvas.addEventListener('webglcontextrestored', onWebglContextRestored);
  }

  loadAllGLBModels().catch((err) => {
    console.error('Error loading GLB models:', err);
  });
  animate3D();

  function setQualityMode(mode) {
    if (isDisposed) return qualityMode;
    return applyQualityMode(mode);
  }

  function getQualityMode() {
    return qualityMode;
  }

  function dispose() {
    if (isDisposed) return;
    isDisposed = true;
    lastProjectedSpread = [];
    hoveredCardMesh = null;

    activeTimers.forEach((tid) => clearTimeout(tid));
    activeTimers.clear();
    if (state) state.isPlayerShuffling = false;

    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    window.removeEventListener('resize', updateCameraForAspect);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof canvas?.removeEventListener === 'function') {
      canvas.removeEventListener('webglcontextlost', onWebglContextLost);
      canvas.removeEventListener('webglcontextrestored', onWebglContextRestored);
    }

    clear3DCards();
    clearDiscardPile3D();

    if (tabletopCrystalLight) {
      scene.remove(tabletopCrystalLight);
      tabletopCrystalLight.dispose?.();
      tabletopCrystalLight = null;
    }
    keyLight.shadow?.dispose?.();
    orbCoreMeshes.forEach((m) => {
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    });
    orbCoreMeshes.length = 0;
    orbSpinMeshes.length = 0;
    tabletopCrystalMeshes.length = 0;
    crystalMaterials.length = 0;

    if (arcaneParticles) {
      arcaneParticles.geometry?.dispose();
      arcaneParticles.material?.dispose();
      scene.remove(arcaneParticles);
      arcaneParticles = null;
    }

    cardBackTex?.dispose?.();
    Object.values(textureMapByMaterial).forEach((tex) => tex?.dispose?.());

    if (scene.environment) {
      scene.environment.dispose?.();
    }

    if (composer && composer.dispose) {
      composer.dispose();
    }

    renderer.dispose();
    scene.clear();
  }

  return {
    getElapsedTime: () => elapsedTime,
    getFanCardMeshes: () => fanCardMeshes,
    getDiscardCardMeshes: () => discardCardMeshes,
    setCameraTarget,
    setQualityMode,
    getQualityMode,
    spawn78CardFan,
    placeSpreadCardIn3D,
    tuckNatalSpreadAway3D,
    clear3DCards,
    syncDiscardPile3D,
    clearDiscardPile3D,
    playPlayerHandShuffle3D,
    dispose
  };
}
