// @vitest-environment node
import { describe, it } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const UI_DIR = resolve(__dirname, '..');

describe('build', () => {
  it('should compile and bundle without errors', { timeout: 30_000 }, () => {
    execSync('npm run build', {
      cwd: UI_DIR,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 30_000,
    });
  });
});
