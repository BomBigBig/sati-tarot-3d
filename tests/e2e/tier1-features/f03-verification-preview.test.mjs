import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSatiExpressApp } from '../../../backend/geminiProxyServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

describe('Tier 1 - Feature 3: Verification & Preview Server Configuration', () => {
  it('T1-F3-01: package.json defines a valid "test" script', () => {
    const pkgPath = path.join(PROJECT_ROOT, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.ok(pkg.scripts && pkg.scripts.test, 'package.json must define scripts.test');
    assert.ok(pkg.scripts.test.includes('runner.mjs'), 'scripts.test must invoke runner.mjs');
  });

  it('T1-F3-02: vite.config.js is present and configures server plugins', () => {
    const viteConfigPath = path.join(PROJECT_ROOT, 'vite.config.js');
    assert.ok(fs.existsSync(viteConfigPath), 'vite.config.js must exist');
    const content = fs.readFileSync(viteConfigPath, 'utf8');
    assert.ok(content.includes('defineConfig'), 'vite.config.js must use defineConfig');
    assert.ok(content.includes('createSatiExpressApp'), 'vite.config.js must integrate createSatiExpressApp');
  });

  it('T1-F3-03: verify_project.mjs script exists and checks required assets', () => {
    const verifyScriptPath = path.join(PROJECT_ROOT, '.agents/skills/sati-3d-engine/scripts/verify_project.mjs');
    assert.ok(fs.existsSync(verifyScriptPath), 'verify_project.mjs must exist');
    const content = fs.readFileSync(verifyScriptPath, 'utf8');
    assert.ok(content.includes('sanctuary_room.glb'), 'Must verify sanctuary_room.glb');
    assert.ok(content.includes('divination_table.glb'), 'Must verify divination_table.glb');
    assert.ok(content.includes('player_hands.glb'), 'Must verify player_hands.glb');
  });

  it('T1-F3-04: package.json scripts contain build and verify', () => {
    const pkgPath = path.join(PROJECT_ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.ok(pkg.scripts.build, 'build script must exist');
    assert.ok(pkg.scripts.verify, 'verify script must exist');
  });

  it('T1-F3-05: Backend Express app /api/sati/health responds with HTTP 200', async () => {
    const app = createSatiExpressApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/sati/health`);
      assert.equal(res.status, 200, 'Health endpoint must return 200');
      const data = await res.json();
      assert.equal(data.ok, true, 'Health response ok must be true');
      assert.ok(data.engine, 'Health response must identify engine');
    } finally {
      server.close();
    }
  });
});
