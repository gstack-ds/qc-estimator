import 'dotenv/config';
import { google } from 'googleapis';
import * as readline from 'readline';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env before running this script.');
    process.exit(1);
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');

  const url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\nOpen this URL in your browser and authorize the app:\n');
  console.log(url);
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>((resolve) => {
    rl.question('Paste the authorization code here: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
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
