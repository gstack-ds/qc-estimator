module.exports = {
  apps: [
    {
      name: 'qc-lead-scanner',
      script: 'node',
      args: '--loader tsx scripts/run-scanner.ts',
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
