import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const workerEnvPath = resolve(homedir(), 'secrets', 'schedule-assistant-worker.env');
const legacyWorkerEnvPath = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'worker',
  '.dev.vars',
);

if (existsSync(legacyWorkerEnvPath)) {
  console.error(`Legacy local Worker secrets file is still present: ${legacyWorkerEnvPath}`);
  console.error('Move its values to ~/secrets/schedule-assistant-worker.env and remove worker/.dev.vars.');
  process.exit(1);
}

if (!existsSync(workerEnvPath)) {
  console.error(`Worker secrets file not found: ${workerEnvPath}`);
  console.error('Create it from worker/.dev.vars.example before running yarn worker:dev.');
  process.exit(1);
}

const dotenvResult = dotenv.config({ path: workerEnvPath });
if (dotenvResult.error) {
  console.error(`Failed to load Worker secrets from: ${workerEnvPath}`);
  console.error(dotenvResult.error.message);
  process.exit(1);
}

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const wranglerBin = resolve(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);

const child = spawn(
  wranglerBin,
  ['dev', '--config', 'worker/wrangler.jsonc', ...process.argv.slice(2)],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
