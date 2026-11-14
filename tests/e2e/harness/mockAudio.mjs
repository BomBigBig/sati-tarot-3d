/**
 * Mock Web Audio API for Headless Node.js
 * Tracks sound synthesis calls (SoundFX.playPick, SoundFX.playShuffle, etc.)
 */

export class MockAudioParam {
  constructor(defaultValue = 1) {
    this.value = defaultValue;
  }
  setValueAtTime(val) {
    this.value = val;
    return this;
  }
  linearRampToValueAtTime(val) {
    this.value = val;
    return this;
  }
  exponentialRampToValueAtTime(val) {
    this.value = val;
    return this;
  }
}

export class MockGainNode {
  constructor() {
    this.gain = new MockAudioParam(1);
    this.connectedTo = null;
  }
  connect(dest) {
    this.connectedTo = dest;
    return dest;
  }
  disconnect() {
    this.connectedTo = null;
  }
}

export class MockOscillatorNode {
  constructor() {
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.started = false;
    this.stopped = false;
    this.connectedTo = null;
  }
  connect(dest) {
    this.connectedTo = dest;
    return dest;
  }
  disconnect() {
    this.connectedTo = null;
  }
  start(when = 0) {
    this.started = true;
  }
  stop(when = 0) {
    this.stopped = true;
  }
}

export class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    this.createdNodes = [];
  }
  createGain() {
    const node = new MockGainNode();
    this.createdNodes.push(node);
    return node;
  }
  createOscillator() {
    const node = new MockOscillatorNode();
    this.createdNodes.push(node);
    return node;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}
