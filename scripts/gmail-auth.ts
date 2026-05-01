import 'dotenv/config';
import * as http from 'http';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const REDIRECT_URI = 'http://localhost:3333/callback';

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env before running this script.');
    process.exit(1);
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent select_account',
  });

  console.log('\nOpening auth URL — if it does not open automatically, paste it into your browser:\n');
  console.log(url);
  console.log('\nWaiting for Google to redirect to localhost:3333 …\n');

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url ?? '/', `http://localhost:3333`);
      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const error = reqUrl.searchParams.get('error');
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<p>Auth failed: ${error}. You can close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      const authCode = reqUrl.searchParams.get('code');
      if (!authCode) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<p>No code returned. You can close this tab.</p>');
        server.close();
        reject(new Error('No code in callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<p>Authorization successful — you can close this tab and check your terminal.</p>');
      server.close();
      resolve(authCode);
    });

    server.listen(3333, '127.0.0.1', () => {
      // Try to open the browser automatically; ignore errors (user can paste manually)
      import('child_process').then(({ exec }) => {
        const cmd = process.platform === 'win32' ? `start "" "${url}"`
          : process.platform === 'darwin' ? `open "${url}"`
          : `xdg-open "${url}"`;
        exec(cmd);
      }).catch(() => {});
    });

    server.on('error', reject);
  });

  const { tokens } = await auth.getToken(code);

  console.log('\n--- Copy this into your .env file ---\n');
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('\n-------------------------------------\n');
}

main().catch((err) => {
  console.error('Auth failed:', err.message);
  process.exit(1);
});
