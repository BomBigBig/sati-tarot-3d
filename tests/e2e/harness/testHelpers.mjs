/**
 * Test Helpers & Assertion Utilities for SATI E2E Testing Suite
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupHeadlessEnv, createMockCanvas, disposalTracker } from './headlessEnv.mjs';

setupHeadlessEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

/**
 * Synchronously or asynchronously load a GLB file from public/models
 * @param {string} filename (e.g. 'divination_table.glb')
 * @returns {Promise<THREE.GLTF>}
 */
export async function loadTestGLB(filename) {
  const filePath = path.join(PROJECT_ROOT, 'public/models', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`GLB file not found: ${filePath}`);
  }
  const buf = fs.readFileSync(filePath);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', (gltf) => {
      resolve(gltf);
    }, (err) => {
      reject(err);
    });
  });
}

/**
 * Creates a standard mock state for SATI engine and main application
 */
export function createMockState(overrides = {}) {
  return {
    screen: 'game',
    modelsLoaded: true,
    user: {
      fullname: 'สมชาย ใจมั่นคง',
      nickname: 'บอม',
      birthdate: '1996-06-25',
      birthTime: '10:30',
      email: 'somchai@gmail.com'
    },
    cameraMode: '1P',
    cameraUnlocked: false,
    coins: 10,
    hasDeckPass: false,
    deckNumber: 1,
    remainingDeck: [],
    natalCards: [],
    natalCompleted: false,
    activeSpread: [],
    pickTargetCount: 10,
    isPicking: true,
    isAnimatingShuffle: false,
    isThinking: false,
    isSpeaking: false,
    chatHistory: [],
    lastTopic: '',
    dialogueCollapsed: false,
    dockCollapsed: false,
    uiHidden: false,
    handGrab: null,
    isHoveringCrystal: false,
    ...overrides
  };
}

/**
 * Creates a mock canvas with specified dimensions
 */
export function createTestCanvas(width = 1920, height = 1080) {
  return createMockCanvas(width, height);
}

/**
 * Simulates a pointer event (pointerdown, pointermove, pointerup) on a canvas or window
 */
export function simulatePointerEvent(target, type, clientX = 0, clientY = 0, buttons = 0) {
  const eventTarget = target && typeof target.closest === 'function' ? target : { closest: () => null };
  const event = {
    type,
    target: eventTarget,
    clientX,
    clientY,
    buttons,
    button: 0,
    preventDefault: () => {},
    stopPropagation: () => {}
  };
  if (target && typeof target.dispatchEvent === 'function') {
    target.dispatchEvent(event);
  }
  if (typeof globalThis.window.dispatchEvent === 'function') {
    globalThis.window.dispatchEvent(event);
  }
  return event;
}

/**
 * Simulates a touch event (touchstart, touchmove, touchend)
 */
export function simulateTouchEvent(target, type, touches = [{ clientX: 195, clientY: 422, identifier: 0 }]) {
  const event = {
    type,
    touches,
    changedTouches: touches,
    targetTouches: touches,
    preventDefault: () => {},
    stopPropagation: () => {}
  };
  if (target && typeof target.dispatchEvent === 'function') {
    target.dispatchEvent(event);
  }
  return event;
}

/**
 * Simulates window resize event
 */
export function simulateResize(width, height) {
  globalThis.window.innerWidth = width;
  globalThis.window.innerHeight = height;
  const ev = new Event('resize');
  globalThis.window.dispatchEvent(ev);
}

/**
 * Spy on an object method
 */
export function spyOn(obj, methodName) {
  const original = obj[methodName];
  const calls = [];
  const spy = function(...args) {
    calls.push({ args, thisValue: this });
    if (typeof original === 'function') {
      return original.apply(this, args);
    }
  };
  spy.calls = calls;
  spy.restore = () => {
    obj[methodName] = original;
  };
  obj[methodName] = spy;
  return spy;
}

/**
 * Numeric range assertion
 */
export function assertInRange(value, min, max, message) {
  assert.ok(
    value >= min && value <= max,
    `${message || 'Expected value in range'}: expected ${value} to be between [${min}, ${max}]`
  );
}

/**
 * Close-to numeric assertion
 */
export function assertCloseTo(actual, expected, tolerance = 0.05, message) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${message || 'Expected values close'}: expected ${actual} to be close to ${expected} (diff: ${diff} > tolerance: ${tolerance})`
  );
}

export { disposalTracker };
