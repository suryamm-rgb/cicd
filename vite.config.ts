import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

function gitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// Build info is injected at build time (CI passes these; locally they fall back to sane defaults).
// Docker passes empty strings when build args are unset, so treat '' like undefined.
if (!process.env.VITE_APP_VERSION) process.env.VITE_APP_VERSION = pkg.version;
if (!process.env.VITE_COMMIT_SHA) process.env.VITE_COMMIT_SHA = gitSha();

/** Emits a static /health.json next to index.html on every production build. */
function healthJson(): Plugin {
  return {
    name: 'health-json',
    apply: 'build',
    generateBundle() {
      const body = {
        status: 'ok',
        version: process.env.VITE_APP_VERSION,
        commit: process.env.VITE_COMMIT_SHA,
        buildTime: new Date().toISOString(),
      };
      this.emitFile({
        type: 'asset',
        fileName: 'health.json',
        source: `${JSON.stringify(body, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), healthJson()],
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text', 'text-summary', 'lcov', 'json-summary', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
      },
    },
  },
});
