/**
 * PM2 wrapper for cloudflared tunnel.
 * Spawns cloudflared as a child process so PM2 can manage its lifecycle.
 * PM2's interpreter:none mode is unreliable on Windows — this is the safe pattern.
 */
const { spawn } = require('child_process');

const child = spawn('cloudflared', ['tunnel', 'run', 'qc-renderer'], {
  stdio: 'inherit',
  shell: false,
});

child.on('error', (err) => {
  console.error('[cloudflared] failed to start:', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  console.log(`[cloudflared] exited — code=${code} signal=${signal}`);
  process.exit(code ?? 1);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
