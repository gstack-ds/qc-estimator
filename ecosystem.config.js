module.exports = {
  apps: [
    {
      name: 'qc-deck-renderer',
      script: 'deck-renderer/dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        // RENDERER_PORT defaults to 3001
        // RENDERER_SECRET must be set — same value as RENDERER_SECRET in Vercel env vars
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: 'logs/deck-renderer-error.log',
      out_file: 'logs/deck-renderer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'qc-lead-scanner',
      script: 'scripts/run-scanner.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        TZ: 'America/New_York',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: 'logs/scanner-error.log',
      out_file: 'logs/scanner-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
