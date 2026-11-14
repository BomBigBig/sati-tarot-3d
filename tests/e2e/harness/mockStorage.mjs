/**
 * Mock Web Storage (localStorage / sessionStorage) for Headless Node.js
 */

export class MockStorage {
  constructor() {
    this.store = new Map();
  }

  get length() {
    return this.store.size;
  }

  getItem(key) {
    const k = String(key);
    return this.store.has(k) ? this.store.get(k) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  clear() {
    this.store.clear();
  }

  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] !== undefined ? keys[index] : null;
  }
}
