/**
 * SATI Studio-Grade 3D Low-Poly GLB Asset Compiler (v2)
 * สร้างไฟล์โมเดล 3D Binary glTF 2.0 (.glb) สไตล์ Stylized Faceted Polygon (ไม่มีเส้นขอบดำ)
 * พร้อม Vertex Color ต่อเหลี่ยมสามเหลี่ยม (COLOR_0) และ UV Coordinates (TEXCOORD_0):
 *  1. public/models/sanctuary_room.glb   (กระโจมหมอดู + ม่านแดงทอง + พรมแขวน 3 ผืน + ขวดยา + ลูกแก้วสีรุ้ง)
 *  2. public/models/divination_table.glb (โต๊ะแปดเหลี่ยมแกะสลักลายโกธิค + ผ้ากำมะหยี่ขอบพู่ทอง + เทียน)
 *  3. public/models/sati_archmage.glb    (หมอดูสติผ้าโพกหัวจุกทอง + ผ้าคลุมไหล่ม่วงมีพู่ + เสื้อคลุมแดงปักดาวจันทร์ + เคราเงินหลายชั้น)
 *  4. public/models/player_hands.glb     (มือผู้เล่น 1P พร้อมกำไลทองและแหวนอัญมณี)
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

const OUT_DIR = path.resolve(process.cwd(), 'public', 'models');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Deterministic pseudo-random helper for consistent artisan facet jitter
function hashFloat(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Bake crisp flat-shaded non-indexed triangle geometry with optional matrix transform,
 * guaranteed UV (TEXCOORD_0), and optional per-triangle faceted vertex colors (COLOR_0).
 */
function bakePart(geometry, matrix = null, vertexColorOpts = null) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (matrix) {
    geo.applyMatrix4(matrix);
  }
  geo.computeVertexNormals();

  const count = geo.attributes.position.count;
  if (!geo.attributes.uv) {
    const posArr = geo.attributes.position.array;
    const uvArr = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      uvArr[i * 2] = (posArr[i * 3] + 1) * 0.5;
      uvArr[i * 2 + 1] = (posArr[i * 3 + 1] + 1) * 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  }

  if (vertexColorOpts) {
    const baseCol = new THREE.Color(vertexColorOpts.color || '#ffffff');
    const jitter = vertexColorOpts.jitter ?? 0.08;
    const seedOffset = vertexColorOpts.seed ?? 1;
    const posArr = geo.attributes.position.array;
    const colArr = new Float32Array(count * 3);
    const triCol = new THREE.Color();

    for (let i = 0; i < count; i += 3) {
      const triIdx = i / 3 + seedOffset * 17;
      const delta = (hashFloat(triIdx) - 0.5) * 2 * jitter;
      const cy = (posArr[i * 3 + 1] + posArr[(i + 1) * 3 + 1] + posArr[(i + 2) * 3 + 1]) / 3;

      if (vertexColorOpts.iridescent) {
        const hue = (0.48 + hashFloat(triIdx * 1.37) * 0.48 + cy * 0.14) % 1;
        triCol.setHSL(hue, 0.68, 0.60 + delta * 0.55);
      } else {
        triCol.copy(baseCol);
        const hsl = { h: 0, s: 0, l: 0 };
        triCol.getHSL(hsl);
        const gradShift = vertexColorOpts.yGrad ? Math.max(-0.08, Math.min(0.08, cy * vertexColorOpts.yGrad)) : 0;
        triCol.setHSL(
          (hsl.h + delta * 0.06 + 1) % 1,
          Math.max(0, Math.min(1, hsl.s + delta * 0.25)),
          Math.max(0.03, Math.min(0.95, hsl.l + delta + gradShift))
        );
      }

      for (let v = 0; v < 3; v++) {
        colArr[(i + v) * 3] = triCol.r;
        colArr[(i + v) * 3 + 1] = triCol.g;
        colArr[(i + v) * 3 + 2] = triCol.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  }

  return geo;
}

/**
 * Merge multiple transformed parts sharing a material into one draw call.
 */
function mergeParts(parts, defaultVertexColor = null) {
  const baked = parts.map((p, idx) => {
    const m = new THREE.Matrix4();
    const pos = p.pos ? new THREE.Vector3(...p.pos) : new THREE.Vector3(0, 0, 0);
    const rot = p.rot ? new THREE.Euler(...p.rot, 'XYZ') : new THREE.Euler(0, 0, 0);
    const quat = new THREE.Quaternion().setFromEuler(rot);
    const scl = p.scale ? new THREE.Vector3(...p.scale) : new THREE.Vector3(1, 1, 1);
    m.compose(pos, quat, scl);
    const vcOpts = p.vc !== undefined ? p.vc : (defaultVertexColor ? { ...defaultVertexColor, seed: idx + 1 } : null);
    return bakePart(p.geo, m, vcOpts);
  });

  let totalVerts = 0;
  let hasColors = false;
  for (const b of baked) {
    totalVerts += b.attributes.position.count;
    if (b.attributes.color) hasColors = true;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = hasColors ? new Float32Array(totalVerts * 3) : null;

  let vOffset3 = 0;
  let vOffset2 = 0;
  for (const b of baked) {
    const pArr = b.attributes.position.array;
    const nArr = b.attributes.normal.array;
    const uArr = b.attributes.uv.array;
    positions.set(pArr, vOffset3);
    normals.set(nArr, vOffset3);
    uvs.set(uArr, vOffset2);
    if (colors) {
      if (b.attributes.color) {
        colors.set(b.attributes.color.array, vOffset3);
      } else {
        colors.fill(1, vOffset3, vOffset3 + pArr.length);
      }
    }
    vOffset3 += pArr.length;
    vOffset2 += uArr.length;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) {
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return merged;
}

/**
 * Create an organic lofted low-poly mesh from cross-sectional rings.
 * Each ring: { y, rx, rz, ox?, oz?, waveAmp?, waveFreq?, wavePhase?, twist? }
 */
function createSculptedLoft(rings, radialSegs = 12, capBottom = false, capTop = false) {
  const positions = [];
  const uvs = [];
  const ringVerts = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const row = [];
    const twist = ring.twist || 0;
    const vCoord = 1 - r / Math.max(1, rings.length - 1);
    for (let s = 0; s <= radialSegs; s++) {
      const uFrac = s / radialSegs;
      const theta = uFrac * Math.PI * 2 + twist;
      const wave = ring.waveAmp
        ? Math.sin(theta * (ring.waveFreq || 6) + (ring.wavePhase || 0)) * ring.waveAmp
        : 0;
      const x = (ring.ox || 0) + Math.cos(theta) * (ring.rx + wave);
      const z = (ring.oz || 0) + Math.sin(theta) * (ring.rz + wave);
      row.push({ x, y: ring.y, z, u: uFrac, v: vCoord });
    }
    ringVerts.push(row);
  }

  const pushTri = (a, b, c) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    uvs.push(a.u, a.v, b.u, b.v, c.u, c.v);
  };

  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = ringVerts[r][s];
      const b = ringVerts[r][s + 1];
      const c = ringVerts[r + 1][s + 1];
      const d = ringVerts[r + 1][s];
      pushTri(a, d, b);
      pushTri(b, d, c);
    }
  }

  if (capBottom && rings.length > 0) {
    const bot = rings[0];
    const center = { x: bot.ox || 0, y: bot.y, z: bot.oz || 0, u: 0.5, v: 1 };
    for (let s = 0; s < radialSegs; s++) {
      pushTri(center, ringVerts[0][s], ringVerts[0][s + 1]);
    }
  }
  if (capTop && rings.length > 0) {
    const top = rings[rings.length - 1];
    const center = { x: top.ox || 0, y: top.y, z: top.oz || 0, u: 0.5, v: 0 };
    const last = ringVerts[rings.length - 1];
    for (let s = 0; s < radialSegs; s++) {
      pushTri(center, last[s + 1], last[s]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create a sculpted open front-split wizard coat (so inner purple tunic shows cleanly in the front!)
 */
function createOpenFrontCoat(rings, radialSegs = 12, gapHalfAngle = 0.36) {
  const positions = [];
  const uvs = [];
  const ringVerts = [];
  // Span from front-right gap edge (+gapHalfAngle from +Z axis) around the back to front-left gap edge
  const startAngle = Math.PI / 2 - gapHalfAngle;
  const endAngle = -Math.PI * 1.5 + gapHalfAngle;

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const row = [];
    const vCoord = 1 - r / Math.max(1, rings.length - 1);
    for (let s = 0; s <= radialSegs; s++) {
      const frac = s / radialSegs;
      const theta = startAngle + frac * (endAngle - startAngle);
      const wave = ring.waveAmp ? Math.sin(theta * (ring.waveFreq || 8)) * ring.waveAmp : 0;
      const x = Math.cos(theta) * (ring.rx + wave);
      const z = Math.sin(theta) * (ring.rz + wave);
      row.push({ x, y: ring.y, z, u: frac, v: vCoord });
    }
    ringVerts.push(row);
  }

  const pushTri = (a, b, c) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    uvs.push(a.u, a.v, b.u, b.v, c.u, c.v);
  };

  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = ringVerts[r][s];
      const b = ringVerts[r][s + 1];
      const c = ringVerts[r + 1][s + 1];
      const d = ringVerts[r + 1][s];
      pushTri(a, b, d);
      pushTri(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create a flowing folded cape / curtain cloth sheet
 */
function createDrapedClothSheet(wTop, wBot, height, segsW = 8, segsH = 6, foldAmp = 0.05, curveBack = 0.14) {
  const positions = [];
  const uvs = [];
  const grid = [];

  for (let iy = 0; iy <= segsH; iy++) {
    const v = iy / segsH;
    const y = (1 - v) * height;
    const w = wTop + (wBot - wTop) * v;
    const row = [];
    for (let ix = 0; ix <= segsW; ix++) {
      const u = ix / segsW;
      const x = (u - 0.5) * w;
      const archCurve = -Math.cos((u - 0.5) * Math.PI) * curveBack * (1 - v * 0.4);
      const fold = Math.sin(u * Math.PI * 5 + v * 1.4) * foldAmp * (0.35 + v * 0.85);
      row.push({ x, y, z: archCurve + fold, u, v: 1 - v });
    }
    grid.push(row);
  }

  for (let iy = 0; iy < segsH; iy++) {
    for (let ix = 0; ix < segsW; ix++) {
      const a = grid[iy][ix];
      const b = grid[iy][ix + 1];
      const c = grid[iy + 1][ix + 1];
      const d = grid[iy + 1][ix];
      positions.push(a.x, a.y, a.z, d.x, d.y, d.z, b.x, b.y, b.z);
      uvs.push(a.u, a.v, d.u, d.v, b.u, b.v);
      positions.push(b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
      uvs.push(b.u, b.v, d.u, d.v, c.u, c.v);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Spec-compliant Binary glTF 2.0 (.glb) Writer supporting POSITION, NORMAL, TEXCOORD_0, and COLOR_0
 */
function exportObjectToGLB(rootObject, outputFilePath) {
  const materials = [];
  const materialMap = new Map();
  const meshes = [];
  const nodes = [];
  const accessors = [];
  const bufferViews = [];
  const binChunks = [];
  let byteOffset = 0;

  function getMaterialIndex(matDef, hasVertexColors) {
    const key = JSON.stringify({ ...matDef, hasVertexColors });
    if (materialMap.has(key)) return materialMap.get(key);
    const c = hasVertexColors ? new THREE.Color('#ffffff') : new THREE.Color(matDef.color || '#ffffff');
    const em = new THREE.Color(matDef.emissive || '#000000');
    const emIntensity = matDef.emissiveIntensity ?? 1.0;

    const gltfMat = {
      name: matDef.name || `Mat_${materials.length}`,
      pbrMetallicRoughness: {
        baseColorFactor: [c.r, c.g, c.b, matDef.opacity ?? 1.0],
        metallicFactor: matDef.metalness ?? 0.08,
        roughnessFactor: matDef.roughness ?? 0.78
      },
      emissiveFactor: [
        Math.min(1, em.r * emIntensity),
        Math.min(1, em.g * emIntensity),
        Math.min(1, em.b * emIntensity)
      ],
      doubleSided: true
    };
    if ((matDef.opacity ?? 1.0) < 1.0) {
      gltfMat.alphaMode = 'BLEND';
    }
    const idx = materials.length;
    materials.push(gltfMat);
    materialMap.set(key, idx);
    return idx;
  }

  function addFloat32Attribute(float32Array, type = 'VEC3', computeMinMax = false) {
    const byteLength = float32Array.byteLength;
    const buf = Buffer.from(float32Array.buffer, float32Array.byteOffset, byteLength);
    binChunks.push(buf);

    const bvIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength,
      target: 34962
    });
    byteOffset += byteLength;

    const comps = type === 'VEC2' ? 2 : 3;
    const count = float32Array.length / comps;
    const acc = {
      bufferView: bvIndex,
      byteOffset: 0,
      componentType: 5126,
      count,
      type
    };

    if (computeMinMax && type === 'VEC3') {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < float32Array.length; i += 3) {
        const x = float32Array[i];
        const y = float32Array[i + 1];
        const z = float32Array[i + 2];
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
      acc.min = min;
      acc.max = max;
    }

    const accIndex = accessors.length;
    accessors.push(acc);
    return accIndex;
  }

  function processNode(obj) {
    const nodeIdx = nodes.length;
    const nodeDef = { name: obj.name || `Node_${nodeIdx}` };

    if (obj.position && (obj.position.x !== 0 || obj.position.y !== 0 || obj.position.z !== 0)) {
      nodeDef.translation = [obj.position.x, obj.position.y, obj.position.z];
    }
    if (obj.quaternion && (obj.quaternion.x !== 0 || obj.quaternion.y !== 0 || obj.quaternion.z !== 0 || obj.quaternion.w !== 1)) {
      nodeDef.rotation = [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w];
    }
    if (obj.scale && (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1)) {
      nodeDef.scale = [obj.scale.x, obj.scale.y, obj.scale.z];
    }

    nodes.push(nodeDef);

    if (obj.userData?.primitives?.length > 0) {
      const gltfPrimitives = obj.userData.primitives.map((prim) => {
        const flatGeo = bakePart(prim.geometry);
        const attributes = {
          POSITION: addFloat32Attribute(flatGeo.attributes.position.array, 'VEC3', true),
          NORMAL: addFloat32Attribute(flatGeo.attributes.normal.array, 'VEC3', false),
          TEXCOORD_0: addFloat32Attribute(flatGeo.attributes.uv.array, 'VEC2', false)
        };
        const hasVC = Boolean(flatGeo.attributes.color);
        if (hasVC) {
          attributes.COLOR_0 = addFloat32Attribute(flatGeo.attributes.color.array, 'VEC3', false);
        }
        const matIdx = getMaterialIndex(prim.material, hasVC);
        return { attributes, material: matIdx, mode: 4 };
      });
      const meshIdx = meshes.length;
      meshes.push({ name: `${nodeDef.name}_Mesh`, primitives: gltfPrimitives });
      nodeDef.mesh = meshIdx;
    }

    if (obj.children?.length > 0) {
      nodeDef.children = obj.children.map((ch) => processNode(ch));
    }
    return nodeIdx;
  }

  const rootNodeIdx = processNode(rootObject);
  const binPad = (4 - (byteOffset % 4)) % 4;
  if (binPad > 0) {
    binChunks.push(Buffer.alloc(binPad, 0));
    byteOffset += binPad;
  }
  const binBuffer = Buffer.concat(binChunks);

  const gltfJson = {
    asset: { version: '2.0', generator: 'SATI-Studio-LowPoly-GLB-Compiler-v2' },
    scene: 0,
    scenes: [{ name: rootObject.name || 'Scene', nodes: [rootNodeIdx] }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }]
  };

  let jsonStr = JSON.stringify(gltfJson);
  const jsonByteLen = Buffer.byteLength(jsonStr, 'utf8');
  const jsonPad = (4 - (jsonByteLen % 4)) % 4;
  if (jsonPad > 0) jsonStr += ' '.repeat(jsonPad);
  const jsonBuffer = Buffer.from(jsonStr, 'utf8');

  const totalLength = 12 + 8 + jsonBuffer.byteLength + 8 + binBuffer.byteLength;
  const glb = Buffer.alloc(totalLength);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(totalLength, 8);
  glb.writeUInt32LE(jsonBuffer.byteLength, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonBuffer.copy(glb, 20);
  const binStart = 20 + jsonBuffer.byteLength;
  glb.writeUInt32LE(binBuffer.byteLength, binStart);
  glb.writeUInt32LE(0x004e4942, binStart + 4);
  binBuffer.copy(glb, binStart + 8);

  fs.writeFileSync(outputFilePath, glb);
  return { sizeKB: (glb.byteLength / 1024).toFixed(1), nodes: nodes.length, meshes: meshes.length };
}

function createMeshNode(name, primitives, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const obj = new THREE.Object3D();
  obj.name = name;
  obj.position.set(...pos);
  obj.rotation.set(...rot);
  obj.scale.set(...scale);
  obj.userData.primitives = primitives;
  return obj;
}

// ============================================================================
// 1. FORTUNE-TELLER TENT SANCTUARY (public/models/sanctuary_room.glb)
// ============================================================================
function buildSanctuaryRoomGLB() {
  const root = new THREE.Object3D();
  root.name = 'SanctuaryRoom';

  const MATS = {
    tentFloor: { name: 'TentFloorWood', color: '#2b1b14', roughness: 0.88, metalness: 0.05 },
    tentCarpet: { name: 'TentCarpet', color: '#3b1c36', roughness: 0.92, metalness: 0.03 },
    tentWall: { name: 'TentWalls', color: '#5c3c2e', roughness: 0.9, metalness: 0.02 },
    woodFrame: { name: 'TentWoodRibs', color: '#45281a', roughness: 0.82, metalness: 0.08 },
    curtainRed: { name: 'CurtainBurgundy', color: '#5b1828', roughness: 0.86, metalness: 0.04 },
    purpleCloth: { name: 'AltarClothPurple', color: '#5b3078', roughness: 0.82, metalness: 0.05 },
    goldTrim: { name: 'GoldTrim', color: '#dfaf3a', roughness: 0.34, metalness: 0.65 },
    tapestrySun: { name: 'TapestrySunEye', color: '#ffffff', roughness: 0.85, metalness: 0.04 },
    tapestryOrb: { name: 'TapestrySacredOrb', color: '#ffffff', roughness: 0.85, metalness: 0.04 },
    tapestryStar: { name: 'TapestryStarNight', color: '#ffffff', roughness: 0.85, metalness: 0.04 },
    orbIridescent: { name: 'CrystalOrbIridescent', color: '#ffffff', emissive: '#9478d6', emissiveIntensity: 0.25, roughness: 0.14, metalness: 0.1 },
    orbCore: { name: 'CrystalOrbCore', color: '#ffd8f0', emissive: '#ffccf9', emissiveIntensity: 1.0, roughness: 0.1 },
    potionGreen: { name: 'PotionGreen', color: '#2d8a58', emissive: '#1e6e42', emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.1 },
    potionPurple: { name: 'PotionPurple', color: '#6b3896', emissive: '#54267a', emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.1 },
    potionAmber: { name: 'PotionAmber', color: '#bf7c2a', emissive: '#8c5315', emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.1 },
    clayJar: { name: 'TerracottaJar', color: '#9c7862', roughness: 0.82, metalness: 0.04 },
    bookLeather: { name: 'BookLeather', color: '#63262e', roughness: 0.78 },
    waxCandle: { name: 'CandleWax', color: '#f2e8d5', roughness: 0.68 },
    flameMat: { name: 'CandleFlame', color: '#ffcf5c', emissive: '#ffaa2e', emissiveIntensity: 1.2, roughness: 0.1 }
  };

  // Floor & Woven Carpet
  const floorParts = [
    { geo: new THREE.CylinderGeometry(9.5, 9.5, 0.16, 12), pos: [0, -0.08, -1.0], vc: { color: '#2a1a14', jitter: 0.03 } }
  ];
  const carpetParts = [
    { geo: new THREE.CylinderGeometry(4.2, 4.2, 0.03, 12), pos: [0, 0.015, -0.4], vc: { color: '#3b1b36', jitter: 0.05 } }
  ];

  // Octagonal Wooden Tent Frame & Warm Canvas Tent Walls
  const tentWallParts = [];
  const woodParts = [];
  const tentRadius = 6.4;
  const wallH = 4.6;
  const roofPeakY = 7.4;

  for (let i = 0; i < 8; i++) {
    const a1 = (i * Math.PI) / 4 + Math.PI / 8;
    const a2 = ((i + 1) * Math.PI) / 4 + Math.PI / 8;
    const x1 = Math.cos(a1) * tentRadius;
    const z1 = Math.sin(a1) * tentRadius - 1.2;
    const x2 = Math.cos(a2) * tentRadius;
    const z2 = Math.sin(a2) * tentRadius - 1.2;

    // Vertical wooden tent post at corner
    woodParts.push({
      geo: new THREE.CylinderGeometry(0.11, 0.13, wallH, 6),
      pos: [x1, wallH / 2, z1],
      vc: { color: '#45281a', jitter: 0.05 }
    });

    // Diagonal roof rafter beam to peak
    const midX = (x1 - 0) * 0.5;
    const midZ = (z1 - 1.2) * 0.5;
    const dx = -x1;
    const dz = -1.2 - z1;
    const len = Math.sqrt(dx * dx + (roofPeakY - wallH) ** 2 + dz * dz);
    const beamDir = new THREE.Vector3(dx, roofPeakY - wallH, dz).normalize();
    const qBeam = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
    const eBeam = new THREE.Euler().setFromQuaternion(qBeam);
    woodParts.push({
      geo: new THREE.CylinderGeometry(0.08, 0.1, len, 6),
      pos: [midX, (wallH + roofPeakY) / 2, midZ],
      rot: [eBeam.x, eBeam.y, eBeam.z],
      vc: { color: '#3d2216', jitter: 0.05 }
    });

    // Horizontal octagonal cornice cross-beam linking tent top wall joints
    const segLenBeam = Math.hypot(x2 - x1, z2 - z1);
    const segRotBeam = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
    woodParts.push({
      geo: new THREE.BoxGeometry(segLenBeam + 0.12, 0.14, 0.16),
      pos: [(x1 + x2) / 2, wallH - 0.06, (z1 + z2) / 2],
      rot: [0, segRotBeam, 0],
      vc: { color: '#3f2417', jitter: 0.05 }
    });

    // Wall panel (leave front camera opening open so camera never clips!)
    const segMidAngle = (a1 + a2) / 2;
    const isFrontCameraOpening = Math.sin(segMidAngle) > 0.65;
    if (!isFrontCameraOpening) {
      const segLen = Math.hypot(x2 - x1, z2 - z1) + 0.15;
      const segRotY = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
      tentWallParts.push({
        geo: new THREE.BoxGeometry(segLen, wallH, 0.12),
        pos: [(x1 + x2) / 2, wallH / 2, (z1 + z2) / 2],
        rot: [0, segRotY, 0]
      });
    }

    // Sloped tent ceiling canopy triangle
    const roofGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      x1, wallH, z1,
      x2, wallH, z2,
      0, roofPeakY, -1.2
    ]);
    roofGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    roofGeo.computeVertexNormals();
    tentWallParts.push({ geo: roofGeo, pos: [0, 0, 0] });
  }

  // Heavy Burgundy Framed Curtains Left & Right (matching media_1794626916630_0f3a7cff.jpg!)
  const curtainParts = [];
  const goldParts = [
    { geo: new THREE.TorusGeometry(2.8, 0.04, 6, 24), pos: [0, 0.03, -0.4], rot: [Math.PI / 2, 0, 0], vc: { color: '#d4a63a', jitter: 0.04 } },
    // Carved wooden peak medallion ring at tent apex
    { geo: new THREE.CylinderGeometry(0.38, 0.48, 0.22, 8), pos: [0, roofPeakY - 0.15, -1.2], vc: { color: '#cf9e32', jitter: 0.05 } }
  ];

  [-1, 1].forEach((side) => {
    // Draped curtain sheet pulled to the side framing the tent view without blocking cards/orbs
    const curtainGeo = createSculptedLoft([
      { y: 4.55, rx: 0.54, rz: 0.44, waveAmp: 0.06, waveFreq: 6 },
      { y: 3.15, rx: 0.46, rz: 0.39, waveAmp: 0.08, waveFreq: 6 },
      { y: 1.92, rx: 0.26, rz: 0.24, waveAmp: 0.04, waveFreq: 5 }, // cinched tie-back waist
      { y: 0.92, rx: 0.52, rz: 0.43, waveAmp: 0.09, waveFreq: 6 },
      { y: 0.0, rx: 0.66, rz: 0.50, waveAmp: 0.10, waveFreq: 6 }
    ], 12, false, false);
    curtainParts.push({
      geo: curtainGeo,
      pos: [side * 2.74, 0, -0.18],
      rot: [0, -side * 0.28, side * 0.07],
      vc: { color: '#5e1829', jitter: 0.06, yGrad: 0.015 }
    });
    // Sculpted double gold tie-back cuff + tassel finial around curtain waist
    goldParts.push(
      {
        geo: new THREE.CylinderGeometry(0.30, 0.28, 0.13, 8),
        pos: [side * 2.67, 1.92, -0.18],
        rot: [0, 0, side * 0.07],
        vc: { color: '#dfb140', jitter: 0.05 }
      },
      {
        geo: new THREE.OctahedronGeometry(0.06, 0),
        pos: [side * 2.42, 1.76, -0.18],
        vc: { color: '#ebb948', jitter: 0.04 }
      }
    );
  });

  // 3 Hanging Mystical Tapestries Behind Sati (UV-mapped canvas artwork!)
  const tapestrySunNode = createMeshNode('TapestryLeft', [
    { geometry: createDrapedClothSheet(1.55, 1.5, 2.55, 6, 4, 0.035, 0.04), material: MATS.tapestrySun }
  ], [-2.55, 1.45, -5.05], [0, 0.38, 0]);

  const tapestryOrbNode = createMeshNode('TapestryCenter', [
    { geometry: createDrapedClothSheet(1.75, 1.7, 2.75, 6, 4, 0.035, 0.04), material: MATS.tapestryOrb }
  ], [-0.85, 1.55, -5.75], [0, 0.12, 0]);

  const tapestryStarNode = createMeshNode('TapestryRight', [
    { geometry: createDrapedClothSheet(1.85, 1.8, 2.8, 6, 4, 0.035, 0.04), material: MATS.tapestryStar }
  ], [1.65, 1.52, -5.45], [0, -0.28, 0]);

  root.add(tapestrySunNode, tapestryOrbNode, tapestryStarNode);

  // Tapestry hanging wooden rods + gold finials
  [
    { p: [-2.55, 4.02, -5.05], ry: 0.38, w: 1.85 },
    { p: [-0.85, 4.32, -5.75], ry: 0.12, w: 2.05 },
    { p: [1.65, 4.34, -5.45], ry: -0.28, w: 2.15 }
  ].forEach(({ p, ry, w }) => {
    woodParts.push({
      geo: new THREE.CylinderGeometry(0.04, 0.04, w, 6),
      pos: p,
      rot: [0, ry, Math.PI / 2],
      vc: { color: '#5c3622', jitter: 0.04 }
    });
  });

  // Side Wooden Tables / Bookshelf Altars + Potion Bottles + Clay Jar + Candles
  const purpleClothParts = [];
  const potionGreenParts = [];
  const potionPurpleParts = [];
  const potionAmberParts = [];
  const clayParts = [];
  const bookParts = [];
  const waxParts = [];

  // Left Side Carved Cabinet Altar (Corner Posts, Recessed Panel, Purple Runner, Potion Flasks, Amphora)
  woodParts.push(
    { geo: new THREE.BoxGeometry(1.36, 1.32, 0.86), pos: [-2.65, 0.66, -1.65], rot: [0, 0.42, 0], vc: { color: '#3b2014', jitter: 0.05 } },
    { geo: new THREE.BoxGeometry(1.56, 0.11, 1.06), pos: [-2.65, 1.375, -1.65], rot: [0, 0.42, 0], vc: { color: '#593422', jitter: 0.05 } },
    { geo: new THREE.BoxGeometry(1.50, 0.14, 0.98), pos: [-2.65, 0.07, -1.65], rot: [0, 0.42, 0], vc: { color: '#361d11', jitter: 0.04 } }
  );
  // Corner carved pillars on Left Altar
  [[-0.64, -0.39], [0.64, -0.39], [-0.64, 0.39], [0.64, 0.39]].forEach(([ox, oz]) => {
    const cosR = Math.cos(0.42);
    const sinR = Math.sin(0.42);
    woodParts.push({
      geo: new THREE.CylinderGeometry(0.065, 0.075, 1.28, 6),
      pos: [-2.65 + ox * cosR + oz * sinR, 0.68, -1.65 - ox * sinR + oz * cosR],
      vc: { color: '#4d2d1d', jitter: 0.05 }
    });
  });
  purpleClothParts.push({
    geo: createDrapedClothSheet(1.36, 1.42, 0.56, 6, 3, 0.025, 0.02),
    pos: [-2.43, 0.88, -1.21],
    rot: [0, 0.42, 0],
    vc: { color: '#6b378f', jitter: 0.06 }
  });
  purpleClothParts.push({
    geo: new THREE.BoxGeometry(1.42, 0.04, 0.96),
    pos: [-2.65, 1.44, -1.65],
    rot: [0, 0.42, 0],
    vc: { color: '#753d9c', jitter: 0.06 }
  });
  goldParts.push(
    { geo: new THREE.ConeGeometry(0.045, 0.13, 6), pos: [-3.02, 0.78, -0.96], vc: { color: '#dfaf3a', jitter: 0.04 } },
    { geo: new THREE.ConeGeometry(0.045, 0.13, 6), pos: [-1.88, 0.78, -1.48], vc: { color: '#dfaf3a', jitter: 0.04 } }
  );

  // Right Side Open-Shelf Bookshelf (Back Frame, Side Uprights, Mid Shelf, Purple Runner, Books, Candles, Flasks)
  woodParts.push(
    // Back panel + side uprights + base plinth + mid shelf + beveled crown top
    { geo: new THREE.BoxGeometry(1.62, 1.54, 0.09), pos: [2.88, 0.77, -1.94], rot: [0, -0.42, 0], vc: { color: '#331c12', jitter: 0.04 } },
    { geo: new THREE.BoxGeometry(0.11, 1.54, 0.72), pos: [2.09, 0.77, -1.34], rot: [0, -0.42, 0], vc: { color: '#452819', jitter: 0.05 } },
    { geo: new THREE.BoxGeometry(0.11, 1.54, 0.72), pos: [3.41, 0.77, -1.94], rot: [0, -0.42, 0], vc: { color: '#452819', jitter: 0.05 } },
    { geo: new THREE.BoxGeometry(1.66, 0.12, 0.74), pos: [2.75, 0.14, -1.65], rot: [0, -0.42, 0], vc: { color: '#3d2215', jitter: 0.04 } },
    { geo: new THREE.BoxGeometry(1.56, 0.09, 0.68), pos: [2.75, 0.80, -1.65], rot: [0, -0.42, 0], vc: { color: '#4c2c1c', jitter: 0.05 } },
    { geo: new THREE.BoxGeometry(1.78, 0.11, 0.84), pos: [2.75, 1.58, -1.65], rot: [0, -0.42, 0], vc: { color: '#5c3623', jitter: 0.05 } }
  );
  purpleClothParts.push(
    {
      geo: new THREE.BoxGeometry(0.74, 0.04, 0.84),
      pos: [2.85, 1.64, -1.69],
      rot: [0, -0.42, 0],
      vc: { color: '#753d9c', jitter: 0.06 }
    },
    {
      geo: createDrapedClothSheet(0.68, 0.68, 0.52, 5, 2, 0.018, 0.02),
      pos: [2.67, 1.15, -1.31],
      rot: [0, -0.42, 0],
      vc: { color: '#69348b', jitter: 0.06 }
    }
  );

  // Sculpted Hardcover Spellbooks inside Right Open Bookshelf (Lower & Upper tiers + Gold Spine Bands!)
  const cosB = Math.cos(-0.42);
  const sinB = Math.sin(-0.42);
  const bookColors = ['#6e2833', '#2a566b', '#4b2a5e', '#754122', '#265c45', '#5a2232', '#233b66'];
  for (let b = 0; b < 7; b++) {
    const lx = -0.48 + b * 0.14;
    const hBook = 0.42 + (b % 3) * 0.06;
    const wBook = 0.095 + (b % 2) * 0.025;
    const tilt = b === 6 ? 0.24 : 0.0;
    const bx = 2.74 + lx * cosB + (b === 6 ? 0.05 : 0);
    const bz = -1.60 - lx * sinB;
    const by = 0.85 + hBook / 2;
    bookParts.push({
      geo: new THREE.BoxGeometry(wBook, hBook, 0.42),
      pos: [bx, by, bz],
      rot: [0, -0.42, tilt],
      vc: { color: bookColors[b], jitter: 0.06 }
    });
    goldParts.push({
      geo: new THREE.BoxGeometry(wBook + 0.008, 0.045, 0.43),
      pos: [bx, by + hBook * 0.24, bz],
      rot: [0, -0.42, tilt],
      vc: { color: '#d8aa38', jitter: 0.04 }
    });
  }

  // Faceted Low-Poly Potion Flasks + Wooden Cork Stoppers
  const bottleGeo = createSculptedLoft([
    { y: 0.0, rx: 0.14, rz: 0.14 },
    { y: 0.14, rx: 0.18, rz: 0.18 },
    { y: 0.28, rx: 0.08, rz: 0.08 },
    { y: 0.38, rx: 0.055, rz: 0.055 },
    { y: 0.42, rx: 0.07, rz: 0.07 }
  ], 8, true, true);
  const decanterGeo = createSculptedLoft([
    { y: 0.0, rx: 0.11, rz: 0.11 },
    { y: 0.16, rx: 0.16, rz: 0.16 },
    { y: 0.26, rx: 0.06, rz: 0.06 },
    { y: 0.38, rx: 0.045, rz: 0.045 },
    { y: 0.45, rx: 0.09, rz: 0.09 },
    { y: 0.52, rx: 0.02, rz: 0.02 }
  ], 6, true, true);

  potionGreenParts.push({ geo: bottleGeo, pos: [-2.95, 1.46, -1.95], vc: { color: '#2b8a58', jitter: 0.08 } });
  potionPurpleParts.push({ geo: bottleGeo, pos: [-2.42, 1.46, -1.98], scale: [0.85, 1.15, 0.85], vc: { color: '#763da8', jitter: 0.08 } });
  potionAmberParts.push({ geo: bottleGeo, pos: [2.30, 1.66, -1.78], scale: [0.85, 0.94, 0.85], vc: { color: '#c9842c', jitter: 0.08 } });
  potionPurpleParts.push({ geo: decanterGeo, pos: [2.56, 1.66, -1.86], scale: [0.88, 0.96, 0.88], vc: { color: '#7f44b8', jitter: 0.08 } });
  // Cork stoppers on left/right bottles
  [
    [-2.95, 1.90, -1.95],
    [-2.42, 1.96, -1.98],
    [2.30, 1.87, -1.78]
  ].forEach(([cx, cy, cz]) => {
    woodParts.push({
      geo: new THREE.CylinderGeometry(0.042, 0.036, 0.075, 6),
      pos: [cx, cy, cz],
      vc: { color: '#9c6e44', jitter: 0.05 }
    });
  });

  // Terracotta Jar & Foreground Potion Vials on Floor Left
  const jarGeo = createSculptedLoft([
    { y: 0.0, rx: 0.24, rz: 0.24 },
    { y: 0.35, rx: 0.42, rz: 0.42 },
    { y: 0.58, rx: 0.28, rz: 0.28 },
    { y: 0.68, rx: 0.32, rz: 0.32 }
  ], 10, true, false);
  clayParts.push({ geo: jarGeo, pos: [-3.1, 0.0, 0.15], vc: { color: '#9c7862', jitter: 0.06 } });
  potionGreenParts.push({ geo: bottleGeo, pos: [-2.52, 0.0, 0.36], scale: [0.72, 0.86, 0.72], vc: { color: '#2b8a58', jitter: 0.08 } });
  potionPurpleParts.push({ geo: decanterGeo, pos: [-2.28, 0.0, 0.22], scale: [0.68, 0.78, 0.68], vc: { color: '#6b3896', jitter: 0.08 } });

  // Side Shelf Dripping Candles + Brass Saucers (Right Shelf)
  const shelfCandles = [
    { x: 3.05, y: 1.66, z: -1.55, h: 0.40, r: 0.058 },
    { x: 3.22, y: 1.66, z: -1.42, h: 0.28, r: 0.050 },
    { x: 2.94, y: 1.66, z: -1.40, h: 0.18, r: 0.045 }
  ];
  shelfCandles.forEach((sc, idx) => {
    goldParts.push({
      geo: new THREE.CylinderGeometry(sc.r * 1.45, sc.r * 1.65, 0.03, 7),
      pos: [sc.x, sc.y + 0.015, sc.z],
      vc: { color: '#c8962e', jitter: 0.04 }
    });
    waxParts.push(
      {
        geo: new THREE.CylinderGeometry(sc.r * 0.88, sc.r * 1.12, sc.h, 7),
        pos: [sc.x, sc.y + sc.h / 2 + 0.02, sc.z],
        vc: { color: '#f3ead8', jitter: 0.04 }
      },
      {
        geo: new THREE.CylinderGeometry(sc.r * 1.25, sc.r * 1.32, 0.035, 7),
        pos: [sc.x, sc.y + sc.h * 0.88 + 0.02, sc.z],
        vc: { color: '#efe1c6', jitter: 0.04 }
      }
    );
    root.add(createMeshNode(
      `ShelfFlame_${idx}`,
      [{ geometry: new THREE.OctahedronGeometry(0.055, 0), material: MATS.flameMat }],
      [sc.x, sc.y + sc.h + 0.08, sc.z],
      [0, 0, 0],
      [0.8, 1.5, 0.8]
    ));
  });

  const archNode = createMeshNode('SanctuaryArchitecture', [
    { geometry: mergeParts(floorParts), material: MATS.tentFloor },
    { geometry: mergeParts(carpetParts), material: MATS.tentCarpet },
    { geometry: mergeParts(tentWallParts), material: MATS.tentWall },
    { geometry: mergeParts(woodParts), material: MATS.woodFrame },
    { geometry: mergeParts(curtainParts), material: MATS.curtainRed },
    { geometry: mergeParts(purpleClothParts), material: MATS.purpleCloth },
    { geometry: mergeParts(goldParts), material: MATS.goldTrim },
    { geometry: mergeParts(potionGreenParts), material: MATS.potionGreen },
    { geometry: mergeParts(potionPurpleParts), material: MATS.potionPurple },
    { geometry: mergeParts(potionAmberParts), material: MATS.potionAmber },
    { geometry: mergeParts(clayParts), material: MATS.clayJar },
    { geometry: mergeParts(bookParts), material: MATS.bookLeather },
    { geometry: mergeParts(waxParts), material: MATS.waxCandle }
  ]);
  root.add(archNode);

  return exportObjectToGLB(root, path.join(OUT_DIR, 'sanctuary_room.glb'));
}

// ============================================================================
// 2. CARVED GOTHIC OCTAGONAL VELVET TABLE (public/models/divination_table.glb)
// ============================================================================
function buildDivinationTableGLB() {
  const root = new THREE.Object3D();
  root.name = 'DivinationTable';

  const MATS = {
    woodCarved: { name: 'TableWoodCarved', color: '#472a1c', roughness: 0.78, metalness: 0.08 },
    woodDark: { name: 'TableWoodDark', color: '#2b1810', roughness: 0.85, metalness: 0.05 },
    velvetTop: { name: 'TableVelvet', color: '#ffffff', roughness: 0.9, metalness: 0.04 },
    velvetDrape: { name: 'TableVelvetDrape', color: '#45152b', roughness: 0.88, metalness: 0.04 },
    goldBright: { name: 'TableGold', color: '#dfb13f', roughness: 0.34, metalness: 0.65 },
    brassMetal: { name: 'BrassCandelabra', color: '#b58426', roughness: 0.4, metalness: 0.6 },
    waxCandle: { name: 'CandleWax', color: '#f3ead8', roughness: 0.68 },
    flameMat: { name: 'CandleFlame', color: '#ffcf5c', emissive: '#ffaa2e', emissiveIntensity: 1.25, roughness: 0.1 },
    orbIridescent: { name: 'CrystalOrbIridescent', color: '#ffffff', emissive: '#9478d6', emissiveIntensity: 0.25, roughness: 0.14, metalness: 0.1 },
    orbCore: { name: 'CrystalOrbCore', color: '#ffd8f0', emissive: '#ffccf9', emissiveIntensity: 1.0, roughness: 0.1 }
  };

  const woodParts = [
    { geo: new THREE.CylinderGeometry(2.38, 2.26, 0.16, 8), pos: [0, 0.86, 0], rot: [0, Math.PI / 8, 0], vc: { color: '#472a1c', jitter: 0.04 } },
    { geo: new THREE.CylinderGeometry(0.58, 0.92, 0.78, 8), pos: [0, 0.39, 0], rot: [0, Math.PI / 8, 0], vc: { color: '#3b2116', jitter: 0.05 } }
  ];
  const darkWoodParts = [];
  const velvetDrapeParts = [];
  const goldParts = [
    { geo: new THREE.CylinderGeometry(2.43, 2.43, 0.05, 8), pos: [0, 0.94, 0], rot: [0, Math.PI / 8, 0], vc: { color: '#dfaf3a', jitter: 0.04 } }
  ];

  // Carved Octagonal Apron Panels, Corner Tassels & Velvet Overhang Drape
  for (let i = 0; i < 8; i++) {
    const cornerA = (i * Math.PI) / 4 + Math.PI / 8;
    const faceA = (i * Math.PI) / 4;

    // 8 Carved wooden legs
    const lx = Math.cos(cornerA) * 2.02;
    const lz = Math.sin(cornerA) * 2.02;
    darkWoodParts.push({
      geo: new THREE.CylinderGeometry(0.12, 0.085, 0.82, 6),
      pos: [lx, 0.41, lz],
      vc: { color: '#2b1810', jitter: 0.04 }
    });
    goldParts.push({
      geo: new THREE.CylinderGeometry(0.1, 0.11, 0.1, 6),
      pos: [lx, 0.06, lz],
      vc: { color: '#c9972e', jitter: 0.04 }
    });

    // Hanging corner gold tassel & bead
    const tx = Math.cos(cornerA) * 2.34;
    const tz = Math.sin(cornerA) * 2.34;
    goldParts.push(
      { geo: new THREE.OctahedronGeometry(0.055, 0), pos: [tx, 0.72, tz], vc: { color: '#e5b845', jitter: 0.05 } },
      { geo: new THREE.ConeGeometry(0.052, 0.16, 6), pos: [tx, 0.61, tz], vc: { color: '#d4a02e', jitter: 0.05 } }
    );

    // Draped Velvet Side Flap hanging over each octagonal edge (wavy low-poly fold)
    const fx = Math.cos(faceA) * 2.18;
    const fz = Math.sin(faceA) * 2.18;
    const rotY = -faceA + Math.PI / 2;
    velvetDrapeParts.push({
      geo: createDrapedClothSheet(1.72, 1.76, 0.28, 5, 2, 0.032, 0.025),
      pos: [fx, 0.69, fz],
      rot: [0.06, rotY, 0],
      vc: { color: '#45152b', jitter: 0.07 }
    });

    // Gothic Carved Wooden Twin-Arch Apron Moldings & Studs beneath velvet flap
    woodParts.push(
      {
        geo: new THREE.BoxGeometry(1.64, 0.14, 0.09),
        pos: [Math.cos(faceA) * 1.98, 0.72, Math.sin(faceA) * 1.98],
        rot: [0, rotY, 0],
        vc: { color: '#3b2116', jitter: 0.05 }
      },
      {
        geo: new THREE.BoxGeometry(0.14, 0.44, 0.09),
        pos: [Math.cos(faceA) * 1.98, 0.48, Math.sin(faceA) * 1.98],
        rot: [0, rotY, 0],
        vc: { color: '#331b11', jitter: 0.05 }
      }
    );
    // Angled Gothic pointed arch struts + gold filigree studs
    [-1, 1].forEach((s) => {
      const rx = Math.cos(faceA) * 1.98 - Math.sin(faceA) * (s * 0.34);
      const rz = Math.sin(faceA) * 1.98 + Math.cos(faceA) * (s * 0.34);
      woodParts.push({
        geo: new THREE.BoxGeometry(0.62, 0.09, 0.08),
        pos: [rx, 0.56, rz],
        rot: [0, rotY, s * 0.52],
        vc: { color: '#45281a', jitter: 0.05 }
      });
    });
    goldParts.push({
      geo: new THREE.OctahedronGeometry(0.042, 0),
      pos: [Math.cos(faceA) * 2.04, 0.58, Math.sin(faceA) * 2.04],
      vc: { color: '#dfb140', jitter: 0.04 }
    });
  }

  // UV-Mapped Velvet Tabletop (so cards sit on a clean, lush dark burgundy-plum surface!)
  const velvetTopGeo = new THREE.CylinderGeometry(2.26, 2.26, 0.035, 8);
  velvetTopGeo.rotateY(Math.PI / 8);
  // Remap top face UVs cleanly to planar [0..1]
  const vPos = velvetTopGeo.attributes.position.array;
  const vUv = new Float32Array((vPos.length / 3) * 2);
  for (let i = 0; i < vPos.length / 3; i++) {
    vUv[i * 2] = vPos[i * 3] / 4.52 + 0.5;
    vUv[i * 2 + 1] = vPos[i * 3 + 2] / 4.52 + 0.5;
  }
  velvetTopGeo.setAttribute('uv', new THREE.BufferAttribute(vUv, 2));

  // Brass Candelabras & Melted Wax Candles on Table Corners (with Curved Candelabra Arms & Dripping Wax)
  const brassParts = [];
  const waxParts = [];
  let flameIdx = 0;
  [[-2.06, 0.24], [2.06, 0.24]].forEach(([bx, bz]) => {
    brassParts.push(
      { geo: new THREE.CylinderGeometry(0.15, 0.22, 0.055, 7), pos: [bx, 0.99, bz], vc: { color: '#b88628', jitter: 0.04 } },
      { geo: new THREE.CylinderGeometry(0.045, 0.068, 0.18, 7), pos: [bx, 1.07, bz], vc: { color: '#b88628', jitter: 0.04 } },
      { geo: new THREE.OctahedronGeometry(0.055, 0), pos: [bx, 1.09, bz], vc: { color: '#d8aa38', jitter: 0.04 } }
    );
    [[0, 0, 0.36], [-0.14, 0.13, 0.25], [0.14, -0.11, 0.21]].forEach(([ox, oz, h]) => {
      const cx = bx + ox;
      const cz = bz + oz;
      if (ox !== 0 || oz !== 0) {
        brassParts.push({
          geo: new THREE.BoxGeometry(0.028, 0.028, Math.hypot(ox, oz) + 0.02),
          pos: [bx + ox * 0.5, 1.08, bz + oz * 0.5],
          rot: [-0.22, Math.atan2(ox, oz), 0],
          vc: { color: '#c4922e', jitter: 0.04 }
        });
      }
      brassParts.push({ geo: new THREE.CylinderGeometry(0.088, 0.052, 0.036, 7), pos: [cx, 1.11, cz], vc: { color: '#c99632', jitter: 0.04 } });
      waxParts.push(
        {
          geo: new THREE.CylinderGeometry(0.055, 0.068, h, 7),
          pos: [cx, 1.13 + h / 2, cz],
          vc: { color: '#f3ead8', jitter: 0.04 }
        },
        {
          geo: new THREE.CylinderGeometry(0.072, 0.078, 0.03, 7),
          pos: [cx, 1.13 + h * 0.86, cz],
          vc: { color: '#efe2c8', jitter: 0.04 }
        }
      );
      root.add(createMeshNode(
        `CandleFlame_${flameIdx++}`,
        [{ geometry: new THREE.OctahedronGeometry(0.06, 0), material: MATS.flameMat }],
        [cx, 1.18 + h, cz],
        [0, 0, 0],
        [0.82, 1.5, 0.82]
      ));
    });
  });

  const tableMeshNode = createMeshNode('OctagonalTableMesh', [
    { geometry: mergeParts(woodParts), material: MATS.woodCarved },
    { geometry: mergeParts(darkWoodParts), material: MATS.woodDark },
    { geometry: mergeParts([{ geo: velvetTopGeo, pos: [0, 0.96, 0] }]), material: MATS.velvetTop },
    { geometry: mergeParts(velvetDrapeParts), material: MATS.velvetDrape },
    { geometry: mergeParts(goldParts), material: MATS.goldBright },
    { geometry: mergeParts(brassParts), material: MATS.brassMetal },
    { geometry: mergeParts(waxParts), material: MATS.waxCandle }
  ]);
  root.add(tableMeshNode);

  // Table Centerpiece Crystal Ball on Ornate 3-Legged Gothic Stand (F4)
  // Tabletop surface is at y = 0.98, ball center is at (0, 1.28, -0.92)
  const standParts = [
    // Brass ring collar cradling the crystal sphere at local y = -0.18
    { geo: new THREE.CylinderGeometry(0.23, 0.21, 0.05, 6), pos: [0, -0.18, 0], vc: { color: '#c59632', jitter: 0.04 } },
    // Beaded gold decorative trim ring
    { geo: new THREE.CylinderGeometry(0.19, 0.21, 0.03, 6), pos: [0, -0.20, 0], vc: { color: '#dfaf3a', jitter: 0.04 } },
    // Carved Gothic center stem finial & brass boss
    { geo: new THREE.CylinderGeometry(0.065, 0.095, 0.06, 6), pos: [0, -0.22, 0], vc: { color: '#b58426', jitter: 0.04 } },
    { geo: new THREE.OctahedronGeometry(0.065, 0), pos: [0, -0.245, 0], vc: { color: '#dfaf3a', jitter: 0.05 } }
  ];

  for (let leg = 0; leg < 3; leg++) {
    const a = (leg * Math.PI * 2) / 3 + Math.PI / 6;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    // Upper gothic prongs extending up to grasp lower sphere
    standParts.push({
      geo: new THREE.ConeGeometry(0.032, 0.10, 4),
      pos: [cosA * 0.22, -0.13, sinA * 0.22],
      rot: [-sinA * 0.22, -a, cosA * 0.22],
      vc: { color: '#dfaf3a', jitter: 0.04 }
    });
    // Upper curved leg segment
    standParts.push({
      geo: new THREE.BoxGeometry(0.05, 0.11, 0.05),
      pos: [cosA * 0.15, -0.23, sinA * 0.15],
      rot: [sinA * 0.36, -a, -cosA * 0.36],
      vc: { color: '#b58426', jitter: 0.04 }
    });
    // Lower outward flaring leg segment
    standParts.push({
      geo: new THREE.BoxGeometry(0.052, 0.08, 0.055),
      pos: [cosA * 0.22, -0.275, sinA * 0.22],
      rot: [-sinA * 0.24, -a, cosA * 0.24],
      vc: { color: '#a07420', jitter: 0.04 }
    });
    // Ornate brass claw foot resting on table surface at local y = -0.30
    standParts.push({
      geo: new THREE.CylinderGeometry(0.045, 0.06, 0.025, 5),
      pos: [cosA * 0.25, -0.295, sinA * 0.25],
      vc: { color: '#dfaf3a', jitter: 0.04 }
    });
    // Carved wood inlay accent
    standParts.push({
      geo: new THREE.BoxGeometry(0.035, 0.06, 0.035),
      pos: [cosA * 0.18, -0.25, sinA * 0.18],
      rot: [sinA * 0.36, -a, -cosA * 0.36],
      vc: { color: '#472a1c', jitter: 0.05 }
    });
  }

  // Golden Mystic Rune Halo Ring seated cleanly around the base of TabletopCrystalBall
  standParts.push({
    geo: new THREE.TorusGeometry(0.28, 0.016, 5, 12),
    pos: [0, -0.295, 0],
    rot: [Math.PI / 2, 0, 0],
    vc: { color: '#e3b644', jitter: 0.04 }
  });
  for (let st = 0; st < 6; st++) {
    const a = (st * Math.PI * 2) / 6;
    standParts.push({
      geo: new THREE.OctahedronGeometry(0.024, 0),
      pos: [Math.cos(a) * 0.28, -0.29, Math.sin(a) * 0.28],
      vc: { color: '#f0c85a', jitter: 0.04 }
    });
  }

  // Low-poly faceted crystal sphere (r = 0.25m, icosahedron subdiv 2 with deterministic facet jitter)
  const orbGeo = bakePart(new THREE.IcosahedronGeometry(0.25, 2), null, { iridescent: true, jitter: 0.08, seed: 21 });
  const coreGeo = new THREE.OctahedronGeometry(0.11, 0);

  const tabletopOrbNode = createMeshNode('TabletopCrystalBall', [
    { geometry: orbGeo, material: MATS.orbIridescent },
    { geometry: coreGeo, material: MATS.orbCore },
    { geometry: mergeParts(standParts), material: MATS.brassMetal }
  ], [0, 1.28, -0.92]);
  root.add(tabletopOrbNode);

  return exportObjectToGLB(root, path.join(OUT_DIR, 'divination_table.glb'));
}

// ============================================================================
// 3. SCULPTED FORTUNE-TELLER SATI (public/models/sati_archmage.glb)
//    Styled directly after the user's turnaround & scene references!
// ============================================================================
function buildArchmageSatiGLB() {
  const root = new THREE.Object3D();
  root.name = 'ArchmageSati';

  const MATS = {
    robeEmbroidered: { name: 'RobeEmbroidered', color: '#ffffff', roughness: 0.78, metalness: 0.08 },
    robeBurgundy: { name: 'RobeBurgundy', color: '#611d2f', roughness: 0.78, metalness: 0.06 },
    tunicPlum: { name: 'TunicPlum', color: '#4e2c69', roughness: 0.8, metalness: 0.06 },
    scarfPurple: { name: 'ScarfCapePurple', color: '#783f96', roughness: 0.76, metalness: 0.05 },
    sashMagenta: { name: 'SashRosePlum', color: '#94437a', roughness: 0.78, metalness: 0.05 },
    goldTrim: { name: 'ArchmageGold', color: '#dfb13c', roughness: 0.42, metalness: 0.42 },
    skinLight: { name: 'SkinLight', color: '#dba684', roughness: 0.65, metalness: 0.04 },
    skinShade: { name: 'SkinShade', color: '#bf8866', roughness: 0.7, metalness: 0.04 },
    beardSilver: { name: 'BeardSilver', color: '#dce0ea', roughness: 0.72, metalness: 0.06 },
    eyeDark: { name: 'EyeDark', color: '#1b141a', roughness: 0.25 },
    eyeGlint: { name: 'EyeGlint', color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 },
    gemGlow: { name: 'TurbanJewelGlow', color: '#ffd9ef', emissive: '#ff8cd6', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.2 },
    crystalViolet: { name: 'CrystalEarring', color: '#9c5cff', emissive: '#6e32d6', emissiveIntensity: 0.45, roughness: 0.18, metalness: 0.2 },
    emeraldGem: { name: 'RingEmerald', color: '#3bc47d', emissive: '#1e8a52', emissiveIntensity: 0.35, roughness: 0.18 },
    throneWood: { name: 'ThroneWood', color: '#3b2216', roughness: 0.84, metalness: 0.08 }
  };

  // 1. Carved Fortune-Teller Chair Behind Sati
  const throneWoodParts = [
    { geo: new THREE.BoxGeometry(1.32, 1.95, 0.14), pos: [0, 1.12, -0.44], vc: { color: '#3b2216', jitter: 0.04 } },
    { geo: new THREE.CylinderGeometry(0.24, 0.7, 0.36, 6), pos: [0, 2.22, -0.44], scale: [1.15, 1, 0.26], vc: { color: '#4a2b1c', jitter: 0.04 } },
    { geo: new THREE.CylinderGeometry(0.08, 0.1, 2.1, 6), pos: [-0.66, 1.1, -0.4], vc: { color: '#3b2216', jitter: 0.04 } },
    { geo: new THREE.CylinderGeometry(0.08, 0.1, 2.1, 6), pos: [0.66, 1.1, -0.4], vc: { color: '#3b2216', jitter: 0.04 } }
  ];
  const throneGoldParts = [
    { geo: new THREE.OctahedronGeometry(0.11, 0), pos: [-0.66, 2.24, -0.4], vc: { color: '#dfa938', jitter: 0.05 } },
    { geo: new THREE.OctahedronGeometry(0.11, 0), pos: [0.66, 2.24, -0.4], vc: { color: '#dfa938', jitter: 0.05 } }
  ];
  root.add(createMeshNode('SatiThrone', [
    { geometry: mergeParts(throneWoodParts), material: MATS.throneWood },
    { geometry: mergeParts(throneGoldParts), material: MATS.goldTrim }
  ]));

  // 2. SatiTorso Node (Sculpted Burgundy Robe + Embroidered Skirt + Purple Cape & Scarf w/ Tassels)
  // Inner Plum Tunic (visible down the front center split!)
  const tunicParts = [
    {
      geo: createSculptedLoft([
        { y: 0.04, rx: 0.56, rz: 0.44, waveAmp: 0.025, waveFreq: 8 },
        { y: 0.65, rx: 0.42, rz: 0.33 },
        { y: 1.02, rx: 0.44, rz: 0.34 },
        { y: 1.32, rx: 0.26, rz: 0.22 }
      ], 12, true, true),
      pos: [0, 0, 0],
      vc: { color: '#4d2b68', jitter: 0.06, yGrad: 0.04 }
    }
  ];

  // Outer Burgundy Coat (UV-mapped for stars & crescent moons embroidery!)
  const coatGeo = createOpenFrontCoat([
    { y: 0.02, rx: 0.66, rz: 0.52, waveAmp: 0.032, waveFreq: 8 },
    { y: 0.45, rx: 0.52, rz: 0.42, waveAmp: 0.02, waveFreq: 8 },
    { y: 0.72, rx: 0.44, rz: 0.35 },
    { y: 1.08, rx: 0.48, rz: 0.37 },
    { y: 1.34, rx: 0.32, rz: 0.26 }
  ], 14, 0.38);

  // Diagonal Rose-Plum Waist Sash
  const sashParts = [
    {
      geo: createSculptedLoft([
        { y: 0.64, rx: 0.46, rz: 0.37, waveAmp: 0.015, waveFreq: 6 },
        { y: 0.74, rx: 0.48, rz: 0.38, waveAmp: 0.015, waveFreq: 6 },
        { y: 0.84, rx: 0.45, rz: 0.36 }
      ], 12, false, false),
      pos: [0, 0, 0],
      rot: [0.06, 0, 0.08],
      vc: { color: '#94437a', jitter: 0.06 }
    }
  ];

  // Draped Purple Scarf Collar, Front Stoles & Flowing Back Cape (matching turnaround sheet!)
  const purpleCapeParts = [
    // Flowing faceted back cape
    {
      geo: createDrapedClothSheet(0.86, 1.24, 1.38, 8, 6, 0.055, 0.22),
      pos: [0, 0.06, -0.34],
      rot: [-0.08, 0, 0],
      vc: { color: '#7a4199', jitter: 0.08, yGrad: 0.04 }
    },
    // Shoulder cowl scarf wrap (sits cleanly behind silver beard so beard is never clipped)
    {
      geo: createSculptedLoft([
        { y: 1.14, rx: 0.49, rz: 0.33, waveAmp: 0.025, waveFreq: 6 },
        { y: 1.24, rx: 0.39, rz: 0.27, waveAmp: 0.02, waveFreq: 6 },
        { y: 1.33, rx: 0.29, rz: 0.22 }
      ], 12, false, false),
      pos: [0, 0, -0.05],
      vc: { color: '#8446a6', jitter: 0.07 }
    }
  ];

  // Left & Right Hanging Scarf Stoles with Gold Tassels
  const torsoGoldParts = [];
  [-1, 1].forEach((side) => {
    purpleCapeParts.push({
      geo: createDrapedClothSheet(0.16, 0.21, 0.66, 3, 4, 0.015, 0.02),
      pos: [side * 0.23, 0.74, 0.36],
      rot: [-0.14, side * 0.16, -side * 0.06],
      vc: { color: '#8648a8', jitter: 0.07 }
    });
    // Gold geometric scarf border & 3 tiny hanging tassels per stole
    torsoGoldParts.push({
      geo: new THREE.BoxGeometry(0.21, 0.055, 0.035),
      pos: [side * 0.25, 0.75, 0.42],
      rot: [-0.14, side * 0.16, -side * 0.06],
      vc: { color: '#dfb13b', jitter: 0.05 }
    });
    for (let t = -1; t <= 1; t++) {
      torsoGoldParts.push({
        geo: new THREE.ConeGeometry(0.022, 0.075, 5),
        pos: [side * 0.25 + t * 0.055, 0.68, 0.43],
        vc: { color: '#e5bc4c', jitter: 0.04 }
      });
    }
    // Gold lapel strips down front opening of burgundy coat
    torsoGoldParts.push({
      geo: new THREE.BoxGeometry(0.065, 1.24, 0.045),
      pos: [side * 0.19, 0.68, 0.36],
      rot: [-0.07, side * 0.22, -side * 0.05],
      vc: { color: '#dfa938', jitter: 0.05 }
    });
  });

  // Chest Necklaces & Hanging Tarot Medallion
  torsoGoldParts.push(
    { geo: new THREE.TorusGeometry(0.21, 0.016, 5, 12, Math.PI), pos: [0, 1.24, 0.22], rot: [0.85, 0, Math.PI], vc: { color: '#e2b74a', jitter: 0.04 } },
    { geo: new THREE.BoxGeometry(0.08, 0.11, 0.025), pos: [0, 1.02, 0.36], rot: [-0.12, 0, 0], vc: { color: '#e2b74a', jitter: 0.04 } }
  );

  root.add(createMeshNode('SatiTorso', [
    { geometry: mergeParts(tunicParts), material: MATS.tunicPlum },
    { geometry: coatGeo, material: MATS.robeEmbroidered },
    { geometry: mergeParts(sashParts), material: MATS.sashMagenta },
    { geometry: mergeParts(purpleCapeParts), material: MATS.scarfPurple },
    { geometry: mergeParts(torsoGoldParts), material: MATS.goldTrim }
  ]));

  // 3. SatiHead Node (Sculpted Face + Multi-Lock Silver Beard + Twisted Turban + Golden Dome + Glowing Gem!)
  const headSkinParts = [
    // Tapered Sculpted Human Head (Cranium -> Cheekbones -> Chin)
    {
      geo: createSculptedLoft([
        { y: -0.18, rx: 0.11, rz: 0.12 },
        { y: -0.06, rx: 0.165, rz: 0.185 },
        { y: 0.04, rx: 0.19, rz: 0.205 },
        { y: 0.14, rx: 0.18, rz: 0.19 },
        { y: 0.22, rx: 0.12, rz: 0.13 }
      ], 10, true, true),
      pos: [0, 0.02, 0.02],
      vc: { color: '#dba684', jitter: 0.05 }
    },
    // Sculpted Nose Bridge
    { geo: new THREE.ConeGeometry(0.038, 0.135, 4), pos: [0, 0.025, 0.225], rot: [0.22, Math.PI / 4, 0], vc: { color: '#dca887', jitter: 0.04 } }
  ];

  const headShadeParts = [
    // Neck
    { geo: new THREE.CylinderGeometry(0.11, 0.14, 0.22, 7), pos: [0, -0.16, 0.0], vc: { color: '#bf8866', jitter: 0.04 } },
    // Expressive Brow Ridge & Recessed Eye Sockets
    { geo: new THREE.BoxGeometry(0.24, 0.036, 0.07), pos: [0, 0.095, 0.195], vc: { color: '#c48d6b', jitter: 0.04 } },
    { geo: new THREE.OctahedronGeometry(0.032, 0), pos: [0, -0.032, 0.248], vc: { color: '#c48d6b', jitter: 0.04 } },
    // Left & Right Ears
    { geo: new THREE.BoxGeometry(0.035, 0.09, 0.05), pos: [-0.195, 0.02, 0.02], rot: [0, -0.2, 0.1], vc: { color: '#c89270', jitter: 0.04 } },
    { geo: new THREE.BoxGeometry(0.035, 0.09, 0.05), pos: [0.195, 0.02, 0.02], rot: [0, 0.2, -0.1], vc: { color: '#c89270', jitter: 0.04 } }
  ];

  const eyeDarkParts = [
    // Expressive dark faceted eyes
    { geo: new THREE.OctahedronGeometry(0.025, 1), pos: [-0.072, 0.055, 0.205], scale: [1.1, 0.95, 0.6], vc: { color: '#1b141a', jitter: 0.02 } },
    { geo: new THREE.OctahedronGeometry(0.025, 1), pos: [0.072, 0.055, 0.205], scale: [1.1, 0.95, 0.6], vc: { color: '#1b141a', jitter: 0.02 } }
  ];
  const eyeGlintParts = [
    { geo: new THREE.OctahedronGeometry(0.008, 0), pos: [-0.066, 0.062, 0.22] },
    { geo: new THREE.OctahedronGeometry(0.008, 0), pos: [0.078, 0.062, 0.22] }
  ];

  // Layered Multi-Strand Sculpted Silver Beard + Eyebrows + Mustache!
  const beardParts = [
    // Arched Expressive Eyebrows
    { geo: new THREE.BoxGeometry(0.088, 0.026, 0.038), pos: [-0.074, 0.096, 0.22], rot: [0, 0.2, 0.16], vc: { color: '#cfd5e2', jitter: 0.05 } },
    { geo: new THREE.BoxGeometry(0.088, 0.026, 0.038), pos: [0.074, 0.096, 0.22], rot: [0, -0.2, -0.16], vc: { color: '#cfd5e2', jitter: 0.05 } },
    // Curved Mustache Wings
    { geo: new THREE.ConeGeometry(0.044, 0.15, 5), pos: [-0.062, -0.072, 0.235], rot: [0.22, 0, -1.18], vc: { color: '#e4e8f2', jitter: 0.06 } },
    { geo: new THREE.ConeGeometry(0.044, 0.15, 5), pos: [0.062, -0.072, 0.235], rot: [0.22, 0, 1.18], vc: { color: '#e4e8f2', jitter: 0.06 } },
    // Main Center Beard Locks (overlapping sculpted silver locks clear of scarf)
    { geo: new THREE.ConeGeometry(0.095, 0.46, 5), pos: [0, -0.27, 0.235], rot: [Math.PI - 0.24, 0, 0], vc: { color: '#dce1ec', jitter: 0.07 } },
    { geo: new THREE.ConeGeometry(0.072, 0.4, 5), pos: [-0.065, -0.25, 0.225], rot: [Math.PI - 0.22, 0, -0.1], vc: { color: '#cfd6e4', jitter: 0.07 } },
    { geo: new THREE.ConeGeometry(0.072, 0.4, 5), pos: [0.065, -0.25, 0.225], rot: [Math.PI - 0.22, 0, 0.1], vc: { color: '#cfd6e4', jitter: 0.07 } },
    { geo: new THREE.ConeGeometry(0.055, 0.33, 5), pos: [-0.115, -0.2, 0.19], rot: [Math.PI - 0.18, 0, -0.2], vc: { color: '#c4ccdc', jitter: 0.07 } },
    { geo: new THREE.ConeGeometry(0.055, 0.33, 5), pos: [0.115, -0.2, 0.19], rot: [Math.PI - 0.18, 0, 0.2], vc: { color: '#c4ccdc', jitter: 0.07 } },
    // Lower beard tip lock
    { geo: new THREE.ConeGeometry(0.065, 0.36, 4), pos: [0, -0.35, 0.255], rot: [Math.PI - 0.22, Math.PI / 4, 0], vc: { color: '#b8c0d2', jitter: 0.06 } },
    // Silver hair tufts under turban sides
    { geo: new THREE.BoxGeometry(0.06, 0.16, 0.16), pos: [-0.17, 0.06, -0.02], vc: { color: '#c4ccdc', jitter: 0.06 } },
    { geo: new THREE.BoxGeometry(0.06, 0.16, 0.16), pos: [0.17, 0.06, -0.02], vc: { color: '#c4ccdc', jitter: 0.06 } }
  ];

  // Layered Wrapped Burgundy-Plum Turban (matching turnaround & tent scene!)
  const turbanClothParts = [
    // Lower criss-cross turban wrap ring
    {
      geo: new THREE.TorusGeometry(0.24, 0.105, 6, 14),
      pos: [0, 0.18, 0.0],
      rot: [Math.PI / 2 - 0.12, 0.14, 0],
      scale: [1.06, 1.12, 0.95],
      vc: { color: '#6b2236', jitter: 0.08 }
    },
    // Diagonal crossed turban fold Left & Right
    {
      geo: new THREE.TorusGeometry(0.23, 0.09, 6, 12),
      pos: [-0.02, 0.24, 0.0],
      rot: [Math.PI / 2 + 0.18, -0.24, 0.15],
      scale: [1.08, 1.1, 0.88],
      vc: { color: '#5c1b2e', jitter: 0.08 }
    },
    {
      geo: new THREE.TorusGeometry(0.22, 0.085, 6, 12),
      pos: [0.02, 0.25, -0.01],
      rot: [Math.PI / 2 - 0.18, 0.24, -0.15],
      scale: [1.06, 1.08, 0.88],
      vc: { color: '#78283e', jitter: 0.08 }
    }
  ];

  // Purple neck wrap tucked cleanly around back & sides behind ears/beard
  const headPurpleWrapParts = [
    {
      geo: new THREE.TorusGeometry(0.19, 0.062, 5, 10, Math.PI * 1.15),
      pos: [0, -0.14, -0.06],
      rot: [Math.PI / 2 + 0.18, 0, Math.PI * 0.92],
      vc: { color: '#723b91', jitter: 0.07 }
    }
  ];

  const headGoldParts = [
    // Faceted Golden Turban Dome Peak
    {
      geo: createSculptedLoft([
        { y: 0.28, rx: 0.19, rz: 0.2 },
        { y: 0.39, rx: 0.175, rz: 0.185 },
        { y: 0.48, rx: 0.11, rz: 0.12 },
        { y: 0.52, rx: 0.04, rz: 0.04 }
      ], 10, false, true),
      pos: [0, 0, -0.01],
      vc: { color: '#dfb13b', jitter: 0.08 }
    },
    // Gold oval jewel bezel on center forehead of turban
    { geo: new THREE.CylinderGeometry(0.065, 0.075, 0.04, 8), pos: [0, 0.23, 0.305], rot: [Math.PI / 2 - 0.15, 0, 0], scale: [0.85, 1, 1.25], vc: { color: '#e2b542', jitter: 0.05 } }
  ];

  const headGemGlowParts = [
    { geo: new THREE.OctahedronGeometry(0.048, 1), pos: [0, 0.23, 0.325], scale: [0.82, 1.18, 0.6] }
  ];

  const earringParts = [
    { geo: new THREE.OctahedronGeometry(0.048, 0), pos: [-0.215, -0.04, 0.02], scale: [0.75, 1.35, 0.75], vc: { color: '#9c5cff', jitter: 0.08 } },
    { geo: new THREE.OctahedronGeometry(0.048, 0), pos: [0.215, -0.04, 0.02], scale: [0.75, 1.35, 0.75], vc: { color: '#9c5cff', jitter: 0.08 } }
  ];

  root.add(createMeshNode('SatiHead', [
    { geometry: mergeParts(headSkinParts), material: MATS.skinLight },
    { geometry: mergeParts(headShadeParts), material: MATS.skinShade },
    { geometry: mergeParts(eyeDarkParts), material: MATS.eyeDark },
    { geometry: mergeParts(eyeGlintParts), material: MATS.eyeGlint },
    { geometry: mergeParts(beardParts), material: MATS.beardSilver },
    { geometry: mergeParts(turbanClothParts), material: MATS.robeBurgundy },
    { geometry: mergeParts(headPurpleWrapParts), material: MATS.scarfPurple },
    { geometry: mergeParts(headGoldParts), material: MATS.goldTrim },
    { geometry: mergeParts(headGemGlowParts), material: MATS.gemGlow },
    { geometry: mergeParts(earringParts), material: MATS.crystalViolet }
  ], [0, 1.56, 0.06]));

  // 4. SatiLeftArm & SatiRightArm (Clean draped shoulders, flared sleeves, satin gold cuffs & ringed hands)
  [-1, 1].forEach((side) => {
    const sleeveParts = [
      // Rounded shoulder cap seamlessly bridging torso coat to upper sleeve
      { geo: new THREE.IcosahedronGeometry(0.135, 1), pos: [0, 0, 0], scale: [0.95, 0.88, 1.0], vc: { color: '#641e31', jitter: 0.06 } },
      // Upper arm hanging naturally downward
      { geo: new THREE.CylinderGeometry(0.108, 0.13, 0.36, 8), pos: [side * 0.02, -0.17, 0.04], rot: [0.22, 0, -side * 0.08], vc: { color: '#611d2f', jitter: 0.06 } },
      // Forearm extending calmly onto back edge of tarot table
      { geo: new THREE.CylinderGeometry(0.115, 0.155, 0.42, 8), pos: [side * 0.01, -0.4, 0.26], rot: [1.14, 0, side * 0.06], vc: { color: '#58192a', jitter: 0.06 } }
    ];
    const goldArmParts = [
      { geo: new THREE.CylinderGeometry(0.158, 0.158, 0.036, 8), pos: [0, -0.47, 0.45], rot: [1.14, 0, side * 0.06], vc: { color: '#d4a63a', jitter: 0.04 } },
      // Gold wrist bracelet
      { geo: new THREE.TorusGeometry(0.068, 0.014, 6, 8), pos: [-side * 0.01, -0.49, 0.54], rot: [0.25, 0, 0], vc: { color: '#dfb140', jitter: 0.04 } },
      // Gold rings on fingers
      { geo: new THREE.TorusGeometry(0.016, 0.0055, 5, 6), pos: [-side * 0.02 + 0.018, -0.515, 0.71], rot: [Math.PI / 2, 0, 0], vc: { color: '#dfb140', jitter: 0.03 } }
    ];
    const plumInnerParts = [
      { geo: new THREE.CylinderGeometry(0.082, 0.1, 0.13, 7), pos: [0, -0.48, 0.49], rot: [1.2, 0, 0], vc: { color: '#452459', jitter: 0.05 } }
    ];
    const handSkinParts = [
      { geo: new THREE.BoxGeometry(0.14, 0.05, 0.145), pos: [-side * 0.02, -0.505, 0.61], rot: [0.15, 0, 0], vc: { color: '#dba684', jitter: 0.04 } },
      { geo: new THREE.BoxGeometry(0.028, 0.035, 0.08), pos: [-side * 0.095, -0.515, 0.65], rot: [0.25, -side * 0.55, 0], vc: { color: '#dba684', jitter: 0.04 } }
    ];
    const handShadeParts = [];
    for (let f = 0; f < 4; f++) {
      const fx = -side * 0.02 + (f - 1.5) * 0.033;
      const fLen = f === 1 || f === 2 ? 0.088 : 0.076;
      handSkinParts.push({
        geo: new THREE.BoxGeometry(0.026, 0.034, fLen),
        pos: [fx, -0.518, 0.72],
        rot: [0.35, 0, 0],
        vc: { color: '#dba684', jitter: 0.04 }
      });
      handShadeParts.push({
        geo: new THREE.BoxGeometry(0.022, 0.028, 0.06),
        pos: [fx, -0.545, 0.785],
        rot: [0.62, 0, 0],
        vc: { color: '#c48d6b', jitter: 0.04 }
      });
    }
    const ringGemParts = [
      { geo: new THREE.OctahedronGeometry(0.013, 0), pos: [-side * 0.02 + 0.018, -0.502, 0.71] }
    ];

    root.add(createMeshNode(
      side < 0 ? 'SatiLeftArm' : 'SatiRightArm',
      [
        { geometry: mergeParts(sleeveParts), material: MATS.robeBurgundy },
        { geometry: mergeParts(goldArmParts), material: MATS.goldTrim },
        { geometry: mergeParts(plumInnerParts), material: MATS.tunicPlum },
        { geometry: mergeParts(handSkinParts), material: MATS.skinLight },
        { geometry: mergeParts(handShadeParts), material: MATS.skinShade },
        { geometry: mergeParts(ringGemParts), material: MATS.emeraldGem }
      ],
      [side * 0.42, 1.18, 0.03]
    ));
  });

  return exportObjectToGLB(root, path.join(OUT_DIR, 'sati_archmage.glb'));
}

// ============================================================================
// 4. PLAYER FIRST-PERSON HANDS GLB WITH GOLD BRACELETS & RINGS
// ============================================================================
function buildPlayerHandsGLB() {
  const root = new THREE.Object3D();
  root.name = 'PlayerHandsRoot';

  const MATS = {
    skinLight: { name: 'PlayerSkin', color: '#dba684', roughness: 0.62, metalness: 0.04 },
    skinShade: { name: 'PlayerSkinShade', color: '#c18a68', roughness: 0.68, metalness: 0.04 },
    sleeveBurgundy: { name: 'PlayerSleeve', color: '#591b2e', roughness: 0.82, metalness: 0.06 },
    cuffGold: { name: 'PlayerCuffGold', color: '#e2b542', roughness: 0.30, metalness: 0.68 },
    gemEmerald: { name: 'PlayerGemEmerald', color: '#27a362', emissive: '#14693c', emissiveIntensity: 0.45, roughness: 0.14 },
    gemRuby: { name: 'PlayerGemRuby', color: '#cf2d52', emissive: '#941834', emissiveIntensity: 0.45, roughness: 0.14 }
  };

  [-1, 1].forEach((side) => {
    const sfx = side < 0 ? 'L' : 'R';
    const inner = -side;
    const handNode = new THREE.Object3D();
    handNode.name = side < 0 ? 'PlayerLeftHand' : 'PlayerRightHand';
    handNode.position.set(side * 0.78, 1.18, 2.08);

    // Sculpted long crimson forearm sleeve (-1.05m), gold cuff, bracelet, and tapered palm prism
    const sleeveGeo = createSculptedLoft([
      { y: -0.05, rx: 0.058, rz: 0.046, waveAmp: 0.004, waveFreq: 5 },
      { y: -0.25, rx: 0.074, rz: 0.059, oz: -0.018, waveAmp: 0.006, waveFreq: 5 },
      { y: -0.60, rx: 0.095, rz: 0.076, oz: -0.052, waveAmp: 0.008, waveFreq: 5 },
      { y: -1.05, rx: 0.114, rz: 0.092, oz: -0.092, waveAmp: 0.008, waveFreq: 5 }
    ], 10, true, true);
    sleeveGeo.rotateX(Math.PI / 2);

    const palmGeo = createSculptedLoft([
      { y: -0.015, rx: 0.041, rz: 0.022 },
      { y: 0.035, rx: 0.052, rz: 0.025, ox: inner * 0.005 },
      { y: 0.098, rx: 0.050, rz: 0.020, ox: inner * 0.002 }
    ], 10, true, true);
    palmGeo.rotateX(-Math.PI / 2);

    const goldParts = [
      { geo: new THREE.CylinderGeometry(0.062, 0.056, 0.032, 10), pos: [0, -0.002, 0.04], rot: [Math.PI / 2, 0, 0], vc: { color: '#e2b542', jitter: 0.04 } },
      { geo: new THREE.TorusGeometry(0.044, 0.009, 5, 10), pos: [0, 0.002, 0.015], rot: [0, 0, 0], vc: { color: '#ebc356', jitter: 0.04 } }
    ];

    const wristMesh = createMeshNode(`Wrist_${sfx}`, [
      { geometry: bakePart(sleeveGeo, null, { color: '#591b2e', jitter: 0.05 }), material: MATS.sleeveBurgundy },
      { geometry: mergeParts(goldParts), material: MATS.cuffGold },
      { geometry: bakePart(palmGeo, null, { color: '#dba684', jitter: 0.04 }), material: MATS.skinLight }
    ]);
    handNode.add(wristMesh);

    // Articulated hierarchical Proximal (1) -> Distal (2) finger nodes matching Blender rig naming!
    const fSpecs = [
      { name: 'Thumb', p: [inner * 0.042, -0.003, -0.028], yaw: inner * 0.45, l1: 0.048, l2: 0.042, r: 0.013, gem: null },
      { name: 'Index', p: [inner * 0.039, 0.003, -0.098], yaw: inner * 0.08, l1: 0.056, l2: 0.050, r: 0.0115, gem: MATS.gemEmerald },
      { name: 'Middle', p: [inner * 0.014, 0.005, -0.103], yaw: inner * 0.02, l1: 0.062, l2: 0.054, r: 0.012, gem: null },
      { name: 'Ring', p: [-inner * 0.015, 0.004, -0.099], yaw: -inner * 0.05, l1: 0.056, l2: 0.050, r: 0.011, gem: MATS.gemRuby },
      { name: 'Pinky', p: [-inner * 0.040, 0.001, -0.092], yaw: -inner * 0.14, l1: 0.048, l2: 0.044, r: 0.010, gem: null }
    ];

    fSpecs.forEach((f) => {
      const proxPrims = [
        {
          geometry: bakePart(new THREE.CylinderGeometry(f.r * 0.88, f.r * 1.04, f.l1, 6), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0, -f.l1 * 0.5), { color: '#dba684', jitter: 0.03 }),
          material: MATS.skinLight
        }
      ];
      if (f.gem) {
        proxPrims.push({
          geometry: bakePart(new THREE.TorusGeometry(f.r * 1.02, 0.0035, 4, 8), new THREE.Matrix4().setPosition(0, 0, -f.l1 * 0.52), { color: '#e5bc4c', jitter: 0.03 }),
          material: MATS.cuffGold
        });
        proxPrims.push({
          geometry: bakePart(new THREE.OctahedronGeometry(0.0075, 0), new THREE.Matrix4().makeScale(1.1, 0.65, 1.1).setPosition(0, f.r * 1.15, -f.l1 * 0.52)),
          material: f.gem
        });
      }
      const proxNode = createMeshNode(`${f.name}1_${sfx}`, proxPrims, f.p, [-0.08, f.yaw, 0]);
      const distNode = createMeshNode(`${f.name}2_${sfx}`, [
        {
          geometry: bakePart(new THREE.CylinderGeometry(f.r * 0.56, f.r * 0.86, f.l2, 6), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0, -f.l2 * 0.5), { color: '#c89270', jitter: 0.03 }),
          material: MATS.skinShade
        }
      ], [0, 0, -f.l1], [-0.14, 0, 0]);

      proxNode.add(distNode);
      handNode.add(proxNode);
    });

    root.add(handNode);
  });

  return exportObjectToGLB(root, path.join(OUT_DIR, 'player_hands.glb'));
}

const r1 = buildSanctuaryRoomGLB();
const r2 = buildDivinationTableGLB();
const r3 = buildArchmageSatiGLB();
const r4 = buildPlayerHandsGLB();

console.log('SATI Studio-Grade 3D Low-Poly GLB Models Compiled Successfully:');
console.log(' - public/models/sanctuary_room.glb  :', r1);
console.log(' - public/models/divination_table.glb:', r2);
console.log(' - public/models/sati_archmage.glb   :', r3);
console.log(' - public/models/player_hands.glb    :', r4);
