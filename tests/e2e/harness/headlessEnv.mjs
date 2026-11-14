/**
 * Headless DOM, Canvas, WebGL, Fetch, Storage and Web Audio Environment for Node.js
 * Enables full Three.js scene creation, GLB parsing, shader lifecycle, and E2E simulation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createMockCanvas2D } from './mockCanvas2D.mjs';
import { MockAudioContext } from './mockAudio.mjs';
import { MockStorage } from './mockStorage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const WEBGL_CONSTANTS = {
  VERSION: 7938,
  ACTIVE_UNIFORMS: 35718,
  ACTIVE_ATTRIBUTES: 35721,
  DEPTH_BITS: 3414,
  STENCIL_BITS: 3415,
  MAX_TEXTURE_SIZE: 3379,
  MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
  MAX_RENDERBUFFER_SIZE: 34024,
  MAX_VERTEX_ATTRIBS: 34921,
  MAX_VERTEX_UNIFORM_VECTORS: 36347,
  MAX_VARYING_VECTORS: 36348,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
  MAX_TEXTURE_IMAGE_UNITS: 34930,
  MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
  SHADING_LANGUAGE_VERSION: 35724,
  COLOR_BUFFER_BIT: 16384,
  DEPTH_BUFFER_BIT: 256,
  STENCIL_BUFFER_BIT: 1024,
  TRIANGLES: 4,
  POINTS: 0,
  LINES: 1,
  LINE_STRIP: 3,
  TRIANGLE_STRIP: 5,
  RGBA: 6408,
  RGB: 6407,
  RGBA8: 32856,
  UNSIGNED_BYTE: 5121,
  FLOAT: 5126,
  HALF_FLOAT: 5131,
  TEXTURE_2D: 3553,
  TEXTURE_CUBE_MAP: 34067,
  FRAMEBUFFER: 36160,
  RENDERBUFFER: 36161,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_MAG_FILTER: 10240,
  LINEAR: 9729,
  NEAREST: 9728,
  CLAMP_TO_EDGE: 33071,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
  STATIC_DRAW: 35044,
  DYNAMIC_DRAW: 35048,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  FRAGMENT_SHADER: 35632,
  VERTEX_SHADER: 35633,
  MAX_DRAW_BUFFERS: 34852,
  MAX_COLOR_ATTACHMENTS: 36063,
  COLOR_ATTACHMENT0: 36064
};

// Global disposal trackers
export const disposalTracker = {
  geometries: [],
  materials: [],
  textures: [],
  reset() {
    this.geometries = [];
    this.materials = [];
    this.textures = [];
  }
};

let originalGeoDispose = null;
let originalMatDispose = null;
let originalTexDispose = null;
let originalFetch = null;
let originalRequest = null;
let isInitialized = false;

export function hookDisposalSpies() {
  if (originalGeoDispose) return;
  originalGeoDispose = THREE.BufferGeometry.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function() {
    disposalTracker.geometries.push(this);
    return originalGeoDispose.apply(this, arguments);
  };

  originalMatDispose = THREE.Material.prototype.dispose;
  THREE.Material.prototype.dispose = function() {
    disposalTracker.materials.push(this);
    return originalMatDispose.apply(this, arguments);
  };

  originalTexDispose = THREE.Texture.prototype.dispose;
  THREE.Texture.prototype.dispose = function() {
    disposalTracker.textures.push(this);
    return originalTexDispose.apply(this, arguments);
  };
}

export function createMockWebGLContext(canvas) {
  let contextLost = false;
  let loseContextHandler = null;
  let restoreContextHandler = null;

  const loseExt = {
    loseContext() {
      contextLost = true;
      if (typeof canvas.dispatchEvent === 'function') {
        const ev = new Event('webglcontextlost');
        ev.preventDefault = () => {};
        canvas.dispatchEvent(ev);
      }
    },
    restoreContext() {
      contextLost = false;
      if (typeof canvas.dispatchEvent === 'function') {
        const ev = new Event('webglcontextrestored');
        canvas.dispatchEvent(ev);
      }
    }
  };

  const gl = {
    ...WEBGL_CONSTANTS,
    canvas,
    drawingBufferWidth: canvas.width || 1920,
    drawingBufferHeight: canvas.height || 1080,
    isContextLost: () => contextLost,
    getParameter(p) {
      if (contextLost) return null;
      if (p === 7938) return 'WebGL 2.0 (Headless SATI Mock)';
      if (p === 35724) return 'WebGL GLSL ES 3.00';
      if (p === 3379) return 8192;
      if (p === 34076) return 8192;
      if (p === 34852) return 8;
      if (p === 34024) return 8192;
      if (p === 34921) return 16;
      if (p === 36347) return 1024;
      if (p === 36348) return 30;
      if (p === 35661) return 32;
      if (p === 35660) return 16;
      if (p === 34930) return 16;
      if (p === 36349) return 1024;
      if (p === 3414) return 24;
      if (p === 3415) return 8;
      return 16;
    },
    getExtension(name) {
      if (name === 'WEBGL_lose_context') return loseExt;
      if (name === 'EXT_texture_filter_anisotropic') return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047 };
      if (name === 'OES_texture_float') return {};
      if (name === 'OES_texture_half_float') return {};
      return {};
    },
    getShaderPrecisionFormat() {
      return { precision: 23, rangeMin: 127, rangeMax: 127 };
    },
    getProgramParameter(program, param) {
      if (param === 35718 || param === 35721) return 0;
      return true;
    },
    getShaderParameter() { return true; },
    getShaderInfoLog() { return ''; },
    getProgramInfoLog() { return ''; },
    getActiveUniform() { return null; },
    getActiveAttrib() { return null; },
    getUniformLocation() { return {}; },
    getAttribLocation() { return 0; },
    createShader: () => ({}),
    createProgram: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({}),
    createFramebuffer: () => ({}),
    createRenderbuffer: () => ({}),
    createVertexArray: () => ({}),
    deleteShader: () => {},
    deleteProgram: () => {},
    deleteBuffer: () => {},
    deleteTexture: () => {},
    deleteFramebuffer: () => {},
    deleteRenderbuffer: () => {},
    deleteVertexArray: () => {}
  };

  return new Proxy(gl, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => ({});
    }
  });
}

export function createMockCanvas(width = 1920, height = 1080) {
  const eventListeners = new Map();
  let glProxy = null;
  let ctx2D = null;

  const canvas = {
    width,
    height,
    style: {
      touchAction: 'none'
    },
    closest: () => null,
    getContext(type) {
      if (type === '2d') {
        if (!ctx2D) ctx2D = createMockCanvas2D(canvas);
        return ctx2D;
      }
      if (!glProxy) glProxy = createMockWebGLContext(canvas);
      return glProxy;
    },
    addEventListener(event, handler) {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event).push(handler);
    },
    removeEventListener(event, handler) {
      const list = eventListeners.get(event) || [];
      eventListeners.set(event, list.filter((h) => h !== handler));
    },
    dispatchEvent(event) {
      const list = eventListeners.get(event.type) || [];
      list.forEach((h) => h(event));
      return true;
    },
    toDataURL() {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    }
  };

  return canvas;
}

export class MockProgressEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.lengthComputable = init.lengthComputable || false;
    this.loaded = init.loaded || 0;
    this.total = init.total || 0;
  }
}

export class MockImage {
  constructor() {
    this._src = '';
    this.width = 512;
    this.height = 512;
    this.onload = null;
    this.onerror = null;
  }
  get src() {
    return this._src;
  }
  set src(val) {
    this._src = val;
    if (typeof this.onload === 'function') {
      setTimeout(() => this.onload(), 0);
    }
  }
}

export function setupHeadlessEnv() {
  if (isInitialized) return;
  isInitialized = true;

  hookDisposalSpies();

  // ProgressEvent
  if (typeof globalThis.ProgressEvent === 'undefined') {
    globalThis.ProgressEvent = MockProgressEvent;
  }

  // URL blob mock for Three.js texture loaders
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = () => 'blob:headless-mock-url';
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = () => {};
  }

  // Request URL normalizer for Node.js
  originalRequest = globalThis.Request;
  globalThis.Request = class HeadlessRequest extends originalRequest {
    constructor(input, init) {
      if (typeof input === 'string' && input.startsWith('/')) {
        input = 'http://localhost' + input;
      }
      super(input, init);
    }
  };

  // Window event listeners store
  const windowListeners = new Map();

  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    location: { href: 'http://localhost/' },
    addEventListener(event, handler) {
      if (!windowListeners.has(event)) windowListeners.set(event, []);
      windowListeners.get(event).push(handler);
    },
    removeEventListener(event, handler) {
      const list = windowListeners.get(event) || [];
      windowListeners.set(event, list.filter((h) => h !== handler));
    },
    dispatchEvent(event) {
      const list = windowListeners.get(event.type) || [];
      list.forEach((h) => h(event));
      return true;
    },
    requestAnimationFrame(cb) {
      return setTimeout(cb, 16);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    URL: globalThis.URL,
    AudioContext: MockAudioContext,
    localStorage: new MockStorage(),
    sessionStorage: new MockStorage()
  };

  globalThis.self = globalThis.window;
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame;
  globalThis.Image = MockImage;
  globalThis.AudioContext = MockAudioContext;
  globalThis.localStorage = globalThis.window.localStorage;
  globalThis.sessionStorage = globalThis.window.sessionStorage;

  // Document mock with DOM element queries
  const domElements = new Map();

  function createMockElement(tag, id = '') {
    const classListSet = new Set();
    const styleObj = {};
    const attrs = new Map();
    const listeners = new Map();

    const el = {
      tagName: tag.toUpperCase(),
      id,
      className: '',
      style: styleObj,
      dataset: {},
      value: '',
      textContent: '',
      classList: {
        add(...cls) { cls.forEach(c => classListSet.add(c)); el.className = Array.from(classListSet).join(' '); },
        remove(...cls) { cls.forEach(c => classListSet.delete(c)); el.className = Array.from(classListSet).join(' '); },
        contains(c) { return classListSet.has(c); },
        toggle(c, force) {
          const has = classListSet.has(c);
          const add = force !== undefined ? force : !has;
          if (add) classListSet.add(c); else classListSet.delete(c);
          el.className = Array.from(classListSet).join(' ');
          return add;
        }
      },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k) { attrs.delete(k); },
      addEventListener(evt, fn) {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt).push(fn);
      },
      removeEventListener(evt, fn) {
        const list = listeners.get(evt) || [];
        listeners.set(evt, list.filter(h => h !== fn));
      },
      dispatchEvent(evt) {
        const list = listeners.get(evt.type) || [];
        list.forEach(h => h(evt));
        return true;
      },
      click() {
        el.dispatchEvent(new Event('click'));
      },
      focus() {},
      blur() {},
      appendChild(child) { return child; },
      removeChild(child) { return child; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
    return el;
  }

  globalThis.document = {
    body: createMockElement('body'),
    createElement(tag) {
      if (tag === 'canvas') return createMockCanvas();
      return createMockElement(tag);
    },
    getElementById(id) {
      if (!domElements.has(id)) {
        domElements.set(id, createMockElement('div', id));
      }
      return domElements.get(id);
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
      return createMockElement('div');
    },
    querySelectorAll(sel) {
      return [createMockElement('div')];
    },
    addEventListener: globalThis.window.addEventListener,
    removeEventListener: globalThis.window.removeEventListener
  };

  // Fetch Interceptor for GLB models & Local APIs
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';

    // Model files interceptor
    if (url.includes('.glb')) {
      const filename = path.basename(new URL(url, 'http://localhost').pathname);
      const filePath = path.join(PROJECT_ROOT, 'public/models', filename);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        return new Response(buf, {
          status: 200,
          headers: { 'Content-Type': 'model/gltf-binary' }
        });
      }
    }

    // Default to originalFetch
    if (typeof originalFetch === 'function') {
      try {
        return await originalFetch(input, init);
      } catch (err) {
        // If relative URL or offline, return mock response
        return new Response(JSON.stringify({ ok: true, fallback: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
}

export function teardownHeadlessEnv() {
  disposalTracker.reset();
}
